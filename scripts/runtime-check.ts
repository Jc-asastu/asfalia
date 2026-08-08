import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import {
  GENESIS_SEED,
  STATE_FILE_NAME,
  getOrCreateWallet,
  loadState,
  saveState,
  scrubLegacyWalletSecrets,
} from '../src/network.ts';
import { loadPrivateStatePassword } from '../src/runtime-secrets.ts';
import { loadContractPolicy, loadOwnerSecret } from '../src/contract-policy.ts';
import { appendHistory, loadHistory, type LogEntry } from '../src/attest-history.ts';
import { loadEntityBook, loadUsers, validateEntityBook, validateUsers } from '../src/entity-data.ts';

let failures = 0;
const expect = (condition: boolean, message: string) => {
  if (!condition) {
    failures++;
    console.error(`FAIL ${message}`);
  }
};
const throws = (fn: () => unknown, message: string) => {
  let rejected = false;
  try { fn(); } catch { rejected = true; }
  expect(rejected, message);
};

expect(getOrCreateWallet('undeployed', { env: {} }).seed === GENESIS_SEED, 'local devnet uses genesis');
throws(() => getOrCreateWallet('preview', { env: {} }), 'preview refuses to generate/persist a wallet');
throws(
  () => getOrCreateWallet('preview', { env: { MIDNIGHT_WALLET_SEED: 'xyz' } }),
  'invalid wallet seed is rejected before Buffer decoding',
);
expect(
  getOrCreateWallet('preview', { env: { MIDNIGHT_WALLET_SEED: `0x${'AB'.repeat(32)}` } }).seed ===
    'ab'.repeat(32),
  'valid environment seed is normalized without being persisted',
);
expect(
  loadPrivateStatePassword('undeployed', {}).length >= 16,
  'local devnet has an explicit development-only private-state password',
);
throws(
  () => loadPrivateStatePassword('preview', {}),
  'public networks require a private-state password',
);
throws(
  () => loadPrivateStatePassword('preview', { PRIVATE_STATE_PASSWORD: 'too-short' }),
  'short private-state passwords are rejected',
);
throws(() => loadOwnerSecret('preview', {}), 'public networks require the contract owner secret');
throws(
  () => loadOwnerSecret('preview', { ASFALIA_OWNER_SECRET: ` ${'ab'.repeat(32)}` }),
  'owner secrets are validated exactly and never silently trimmed',
);
expect(
  loadOwnerSecret('preview', { ASFALIA_OWNER_SECRET: 'ab'.repeat(32) }).length === 32,
  'valid owner secret decodes to 32 bytes',
);
throws(
  () => loadContractPolicy({ ASFALIA_VALIDITY: '2678401' }),
  'certificate validity cannot exceed the contract policy bound',
);

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'asfalia-runtime-check-'));
try {
  saveState({ version: 2, activeNetwork: 'preview', deployments: {} }, { cwd: tmp });
  const persisted = JSON.parse(fs.readFileSync(path.join(tmp, STATE_FILE_NAME), 'utf8'));
  expect(!('wallets' in persisted), 'state version 2 never writes a wallets field');
  expect(loadState({ cwd: tmp })?.version === 2, 'state version 2 round-trips');

  fs.writeFileSync(
    path.join(tmp, STATE_FILE_NAME),
    JSON.stringify({ version: 2, activeNetwork: 'preview', deployments: {}, wallets: {} }),
  );
  throws(() => loadState({ cwd: tmp }), 'state version 2 rejects unexpected secret-bearing fields');

  fs.writeFileSync(
    path.join(tmp, STATE_FILE_NAME),
    JSON.stringify({
      version: 1,
      activeNetwork: 'preview',
      wallets: { preview: { seed: 'ab'.repeat(32), mnemonic: 'secret words' } },
      deployments: {},
    }),
  );
  throws(
    () => scrubLegacyWalletSecrets({ cwd: tmp, env: {} }),
    'legacy secrets are not removed without explicit backup confirmation',
  );
  expect(
    scrubLegacyWalletSecrets({
      cwd: tmp,
      env: { ASFALIA_CONFIRM_WALLET_BACKUP: 'I_HAVE_BACKED_UP_ALL_WALLETS' },
    }),
    'confirmed migration removes legacy wallet material',
  );
  const migrated = JSON.parse(fs.readFileSync(path.join(tmp, STATE_FILE_NAME), 'utf8'));
  expect(migrated.version === 2 && !('wallets' in migrated), 'legacy migration keeps only safe state');

  expect(loadEntityBook().assets.length === 8, 'demo asset book passes strict validation');
  expect(loadUsers().length === 16, 'demo user book passes strict validation');
  const validBook = loadEntityBook();
  throws(
    () => validateEntityBook({ ...validBook, assets: [...validBook.assets, validBook.assets[0]] }),
    'asset count is enforced',
  );
  const validUsers = loadUsers();
  throws(
    () => validateUsers({ users: validUsers.map((user, i) => i === 1 ? { ...user, account: validUsers[0].account } : user) }),
    'duplicate accounts are rejected',
  );

  const historyFile = path.join(tmp, 'nested', 'attest-log.json');
  const historyEntry: LogEntry = {
    ts: 1,
    trigger: 'heartbeat',
    ok: true,
    verdict: true,
    txId: 'ab'.repeat(32),
    attestedAt: '1',
    validUntil: '2',
    assetsCommitment: 'cd'.repeat(32),
    liabilitiesRoot: 'ef'.repeat(32),
    durationSec: 0.5,
    error: null,
  };
  const savedHistory = appendHistory(historyFile, [], historyEntry);
  expect(savedHistory.length === 1 && loadHistory(historyFile).length === 1, 'history writes atomically and round-trips');
  fs.writeFileSync(historyFile, '{not json');
  throws(() => loadHistory(historyFile), 'corrupt history stops startup instead of silently resetting');
} finally {
  fs.rmSync(tmp, { recursive: true, force: true });
}

console.log(failures === 0 ? 'Runtime secret checks: OK' : `${failures} runtime check(s) failed`);
process.exit(failures === 0 ? 0 : 1);
