// This module is structured to be extracted into a standalone package
// (@midnight-ntwrk/dapp-network or similar) without code changes. Do not
// introduce template substitutions, sibling-template imports, or globals
// here. All side-effecting inputs flow through function parameters.

import * as fs from 'node:fs';
import * as path from 'node:path';
import { Buffer } from 'node:buffer';
import { fileURLToPath } from 'node:url';

import { mnemonicToSeedSync, validateMnemonic } from '@scure/bip39';
import { wordlist } from '@scure/bip39/wordlists/english.js';

export type NetworkId = 'undeployed' | 'preview' | 'preprod';

export const NETWORK_IDS: readonly NetworkId[] = ['undeployed', 'preview', 'preprod'] as const;

export interface NetworkConfig {
  networkId: NetworkId;
  indexer: string;
  indexerWS: string;
  node: string;
  proofServer: string;
  faucet: string | null;
  composeServices: string[];
}

export interface DeploymentRecord {
  address: string;
  deployedAt: string;
  deployer: string;
}

export interface NetworkState {
  version: 2;
  activeNetwork: NetworkId;
  deployments: Partial<Record<NetworkId, DeploymentRecord>>;
}

export const STATE_FILE_NAME = '.midnight-state.json';
export const STATE_VERSION = 2 as const;

export const NETWORK_CONFIGS: Record<NetworkId, NetworkConfig> = {
  undeployed: {
    networkId: 'undeployed',
    indexer:   'http://127.0.0.1:8088/api/v4/graphql',
    indexerWS: 'ws://127.0.0.1:8088/api/v4/graphql/ws',
    node:      'ws://127.0.0.1:9944',
    proofServer: 'http://127.0.0.1:6300',
    faucet: null,
    composeServices: ['node', 'indexer', 'proof-server'],
  },
  preview: {
    networkId: 'preview',
    indexer:   'https://indexer.preview.midnight.network/api/v4/graphql',
    indexerWS: 'wss://indexer.preview.midnight.network/api/v4/graphql/ws',
    node:      'https://rpc.preview.midnight.network',
    proofServer: 'http://127.0.0.1:6300',
    faucet: 'https://midnight-tmnight-preview.nethermind.dev',
    composeServices: ['proof-server'],
  },
  preprod: {
    networkId: 'preprod',
    indexer:   'https://indexer.preprod.midnight.network/api/v4/graphql',
    indexerWS: 'wss://indexer.preprod.midnight.network/api/v4/graphql/ws',
    node:      'https://rpc.preprod.midnight.network',
    proofServer: 'http://127.0.0.1:6300',
    faucet: 'https://midnight-tmnight-preprod.nethermind.dev',
    composeServices: ['proof-server'],
  },
};

export function isNetworkId(v: unknown): v is NetworkId {
  return typeof v === 'string' && (NETWORK_IDS as readonly string[]).includes(v);
}

export interface FsOptions {
  cwd?: string;
}

function statePath(opts: FsOptions = {}): string {
  return path.join(opts.cwd ?? process.cwd(), STATE_FILE_NAME);
}

function validateState(value: unknown, file: string): NetworkState {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`Invalid state in ${file}: expected an object`);
  }
  const raw = value as Record<string, unknown>;
  const keys = Object.keys(raw).sort();
  const expected = ['activeNetwork', 'deployments', 'version'];
  if (keys.length !== expected.length || keys.some((key, i) => key !== expected[i])) {
    throw new Error(`Invalid state fields in ${file}: expected ${expected.join(', ')}`);
  }
  if (raw.version !== STATE_VERSION) {
    throw new Error(`Unsupported state-file version in ${file} (expected ${STATE_VERSION})`);
  }
  if (!isNetworkId(raw.activeNetwork)) throw new Error(`Invalid activeNetwork in ${file}`);
  if (!raw.deployments || typeof raw.deployments !== 'object' || Array.isArray(raw.deployments)) {
    throw new Error(`Invalid deployments in ${file}`);
  }
  const deployments: Partial<Record<NetworkId, DeploymentRecord>> = {};
  for (const [network, value] of Object.entries(raw.deployments as Record<string, unknown>)) {
    if (!isNetworkId(network) || !value || typeof value !== 'object' || Array.isArray(value)) {
      throw new Error(`Invalid deployment ${network} in ${file}`);
    }
    const deployment = value as Record<string, unknown>;
    const deploymentKeys = Object.keys(deployment).sort();
    const expectedDeploymentKeys = ['address', 'deployedAt', 'deployer'];
    if (
      deploymentKeys.length !== expectedDeploymentKeys.length ||
      deploymentKeys.some((key, i) => key !== expectedDeploymentKeys[i]) ||
      typeof deployment.address !== 'string' || !/^[0-9a-f]{32,}$/i.test(deployment.address) ||
      typeof deployment.deployer !== 'string' || deployment.deployer.length === 0 || deployment.deployer.length > 500 ||
      typeof deployment.deployedAt !== 'string' || !Number.isFinite(Date.parse(deployment.deployedAt))
    ) {
      throw new Error(`Invalid deployment ${network} in ${file}`);
    }
    deployments[network] = deployment as unknown as DeploymentRecord;
  }
  return { version: STATE_VERSION, activeNetwork: raw.activeNetwork, deployments };
}

export function loadState(opts: FsOptions = {}): NetworkState | null {
  const p = statePath(opts);
  if (!fs.existsSync(p)) return null;
  const raw = fs.readFileSync(p, 'utf-8');
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (e) {
    throw new Error(`Failed to parse ${p}: ${(e as Error).message}. Back it up, then repair the JSON.`);
  }
  if ((parsed as { version?: unknown })?.version === 1) {
    throw new Error(
      `${p} uses legacy state version 1, which may contain wallet secrets. ` +
        'Back up the wallet in a secret manager, configure MIDNIGHT_WALLET_MNEMONIC or ' +
        'MIDNIGHT_WALLET_SEED, then run `npm run network -- scrub-wallets`.',
    );
  }
  return validateState(parsed, p);
}

export function saveState(state: NetworkState, opts: FsOptions = {}): void {
  const p = statePath(opts);
  // Write to a sibling tmp file then rename → atomic on POSIX. State version 2
  // contains deployment metadata only; wallet secrets are never written here.
  const tmp = `${p}.tmp-${process.pid}-${Date.now()}`;
  const safeState = validateState(state, p);
  try {
    fs.writeFileSync(tmp, `${JSON.stringify(safeState, null, 2)}\n`, { mode: 0o600 });
    fs.renameSync(tmp, p);
  } catch (error) {
    try { fs.rmSync(tmp, { force: true }); } catch { /* best effort */ }
    throw error;
  }
}

/**
 * Explicitly remove wallet material written by state version 1. This refuses
 * to run without a deliberate backup confirmation because the operation is
 * irreversible and a state file may contain credentials for several networks.
 */
export function scrubLegacyWalletSecrets(opts: SeedOptions = {}): boolean {
  const env = opts.env ?? process.env;
  const p = statePath({ cwd: opts.cwd });
  if (!fs.existsSync(p)) return false;

  let parsed: any;
  try {
    parsed = JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch (e) {
    throw new Error(`Failed to parse ${p}: ${(e as Error).message}`);
  }
  if (parsed?.version === STATE_VERSION) return false;
  if (parsed?.version !== 1 || !isNetworkId(parsed.activeNetwork)) {
    throw new Error(`Cannot migrate unsupported state file: ${p}`);
  }

  const hasWalletSecrets = Object.values(parsed.wallets ?? {}).some((wallet: any) =>
    Boolean(wallet?.seed || wallet?.mnemonic),
  );
  if (
    hasWalletSecrets &&
    env.ASFALIA_CONFIRM_WALLET_BACKUP !== 'I_HAVE_BACKED_UP_ALL_WALLETS'
  ) {
    throw new Error(
      'Refusing to remove legacy wallet secrets. Back up every seed/mnemonic securely, then set ' +
        'ASFALIA_CONFIRM_WALLET_BACKUP=I_HAVE_BACKED_UP_ALL_WALLETS and retry.',
    );
  }

  saveState(
    {
      version: STATE_VERSION,
      activeNetwork: parsed.activeNetwork,
      deployments: parsed.deployments ?? {},
    },
    { cwd: opts.cwd },
  );
  return true;
}

export function parseNetworkFlag(argv: string[]): NetworkId | null {
  for (let i = 2; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--network') {
      const v = argv[i + 1];
      if (v === undefined) throw new Error('--network requires a value');
      if (!isNetworkId(v)) {
        throw new Error(`Unknown network: ${v}. Supported: ${NETWORK_IDS.join(', ')}.`);
      }
      return v;
    }
    if (arg.startsWith('--network=')) {
      const v = arg.slice('--network='.length);
      if (!isNetworkId(v)) {
        throw new Error(`Unknown network: ${v}. Supported: ${NETWORK_IDS.join(', ')}.`);
      }
      return v;
    }
  }
  return null;
}

export interface ResolveOptions {
  argv?: string[];
  env?: NodeJS.ProcessEnv;
  cwd?: string;
}

export type ResolveSource = 'flag' | 'state' | 'default';

export interface ResolveResult {
  network: NetworkId;
  config: NetworkConfig;
  source: ResolveSource;
}

const ENV_OVERRIDES: Array<[keyof NetworkConfig, string]> = [
  ['indexer', 'MIDNIGHT_INDEXER_URL'],
  ['indexerWS', 'MIDNIGHT_INDEXER_WS_URL'],
  ['node', 'MIDNIGHT_NODE_URL'],
  ['faucet', 'MIDNIGHT_FAUCET_URL'],
  ['proofServer', 'MIDNIGHT_PROOF_SERVER_URL'],
];

function applyEnvOverrides(base: NetworkConfig, env: NodeJS.ProcessEnv): NetworkConfig {
  const out: NetworkConfig = { ...base, composeServices: [...base.composeServices] };
  for (const [field, varName] of ENV_OVERRIDES) {
    const v = env[varName];
    if (v) (out as unknown as Record<string, unknown>)[field] = v;
  }
  return out;
}

export function resolveNetwork(opts: ResolveOptions = {}): ResolveResult {
  const argv = opts.argv ?? process.argv;
  const env = opts.env ?? process.env;
  const cwd = opts.cwd ?? process.cwd();

  const flag = parseNetworkFlag(argv);
  let network: NetworkId;
  let source: ResolveSource;

  if (flag) {
    network = flag;
    source = 'flag';
  } else {
    const state = loadState({ cwd });
    if (state) {
      network = state.activeNetwork;
      source = 'state';
    } else {
      network = 'undeployed';
      source = 'default';
    }
  }

  const config = applyEnvOverrides(NETWORK_CONFIGS[network], env);
  return { network, config, source };
}

export const GENESIS_SEED = '0000000000000000000000000000000000000000000000000000000000000001';

// ─── Wallet identity (BIP-39, Lace-compatible) ─────────────────────────────────
//
// Public-network wallets may be supplied as a 24-word BIP-39 phrase whose
// seed is derived with the standard mnemonicToSeed PBKDF2 step (empty
// passphrase). Lace derives seeds the same way, so a phrase supplied here
// restores the identical wallet in Lace and vice versa.
//
// IMPORTANT: derivation must stay mnemonicToSeed (64-byte seed). Do NOT
// switch to mnemonicToEntropy — it also "works" but derives a different
// wallet from the same words, silently breaking Lace compatibility.

export function normalizeMnemonic(mnemonic: string): string {
  return mnemonic.trim().toLowerCase().split(/\s+/).join(' ');
}

export function isValidMnemonic(mnemonic: string): boolean {
  return validateMnemonic(normalizeMnemonic(mnemonic), wordlist);
}

/** Standard BIP-39 seed for a phrase: 64 bytes, returned as 128 hex chars. */
export function mnemonicToSeedHex(mnemonic: string): string {
  return Buffer.from(mnemonicToSeedSync(normalizeMnemonic(mnemonic))).toString('hex');
}

// BIP-32 master seeds must be 16-64 whole bytes → 32-128 hex chars in even
// steps. Validating up front matters because Buffer.from(s, 'hex') silently
// stops at the first invalid character, which would derive the wrong wallet
// from a truncated paste instead of failing.
const SEED_HEX_RE = /^(?:[0-9a-fA-F]{2}){16,64}$/;

export interface SeedOptions {
  env?: NodeJS.ProcessEnv;
  cwd?: string;
}

export interface WalletCredentials {
  seed: string;
}

/** Load wallet credentials. Public-network secrets are never generated, logged or persisted here. */
export function getOrCreateWallet(network: NetworkId, opts: SeedOptions = {}): WalletCredentials {
  const env = opts.env ?? process.env;

  if (network === 'undeployed') return { seed: GENESIS_SEED };

  const envSeed = env.MIDNIGHT_WALLET_SEED;
  const envMnemonic = env.MIDNIGHT_WALLET_MNEMONIC;
  if (envSeed && envMnemonic) {
    throw new Error(
      'Both MIDNIGHT_WALLET_SEED and MIDNIGHT_WALLET_MNEMONIC are set — unset one; they would select different wallets.',
    );
  }
  if (envSeed) {
    // Trim first: secrets pasted into env vars commonly carry stray whitespace
    // or a trailing newline, which the pre-validation code tolerated.
    const trimmed = envSeed.trim();
    const hex = trimmed.startsWith('0x') || trimmed.startsWith('0X') ? trimmed.slice(2) : trimmed;
    if (!SEED_HEX_RE.test(hex)) {
      throw new Error(
        'MIDNIGHT_WALLET_SEED must be 32-128 hex characters (16-64 whole bytes). ' +
          'A Lace-compatible BIP-39 seed is 128 hex characters — or set MIDNIGHT_WALLET_MNEMONIC to pass the phrase directly.',
      );
    }
    return { seed: hex.toLowerCase() };
  }
  if (envMnemonic) {
    if (!isValidMnemonic(envMnemonic)) {
      throw new Error(
        'MIDNIGHT_WALLET_MNEMONIC is not a valid BIP-39 recovery phrase (check the words and word count).',
      );
    }
    return { seed: mnemonicToSeedHex(envMnemonic) };
  }

  throw new Error(
    `No wallet credential configured for ${network}. Set MIDNIGHT_WALLET_MNEMONIC ` +
      'or MIDNIGHT_WALLET_SEED from a secret manager; Asfalia never stores or prints it.',
  );
}

/** Back-compat wrapper returning only the seed. Prefer getOrCreateWallet. */
export function getOrCreateSeed(network: NetworkId, opts: SeedOptions = {}): string {
  return getOrCreateWallet(network, opts).seed;
}

export function getDeployment(network: NetworkId, opts: FsOptions = {}): DeploymentRecord | null {
  const state = loadState(opts);
  return state?.deployments?.[network] ?? null;
}

export function recordDeployment(
  network: NetworkId,
  address: string,
  deployer: string,
  opts: FsOptions = {},
): void {
  const cwd = opts.cwd ?? process.cwd();
  const existing = loadState({ cwd });
  const next: NetworkState = existing ?? {
    version: STATE_VERSION,
    activeNetwork: network,
    deployments: {},
  };
  next.deployments = {
    ...next.deployments,
    [network]: { address, deployer, deployedAt: new Date().toISOString() },
  };
  saveState(next, { cwd });
}

export function setActiveNetwork(network: NetworkId, opts: FsOptions = {}): void {
  const cwd = opts.cwd ?? process.cwd();
  const existing = loadState({ cwd });
  if (existing && existing.activeNetwork === network) return; // no-op
  const next: NetworkState = existing ?? {
    version: STATE_VERSION,
    activeNetwork: network,
    deployments: {},
  };
  next.activeNetwork = network;
  saveState(next, { cwd });
}

// CLI entry point. Activates only when the file is run directly via tsx,
// not when imported. Keeps the module tree-shakeable for the future
// extracted package.
function isMain(): boolean {
  // import.meta.url is a `file://` URL; argv[1] is a filesystem path.
  // Compare resolved paths to handle symlinks/aliases.
  try {
    const here = fileURLToPath(import.meta.url);
    const invoked = process.argv[1] && fs.realpathSync(process.argv[1]);
    return invoked === fs.realpathSync(here);
  } catch {
    return false;
  }
}

function cliMain(argv: string[]): number {
  const args = argv.slice(2);
  if (args[0] === 'scrub-wallets') {
    const changed = scrubLegacyWalletSecrets();
    process.stdout.write(
      changed
        ? 'Legacy wallet material removed from .midnight-state.json.\n'
        : 'State already contains no legacy wallet material.\n',
    );
    return 0;
  }
  if (args.length === 0) {
    const r = resolveNetwork({ argv });
    const dep = getDeployment(r.network);
    process.stdout.write(`Active network: ${r.network}${r.source === 'default' ? ' (default)' : ''}\n`);
    if (dep) process.stdout.write(`Last deploy: ${dep.address}\n`);
    return 0;
  }
  const candidate = args[0];
  if (!isNetworkId(candidate)) {
    process.stderr.write(`Unknown network: ${candidate}. Supported: ${NETWORK_IDS.join(', ')}.\n`);
    return 1;
  }
  setActiveNetwork(candidate);
  process.stdout.write(`Active network is now: ${candidate}\n`);
  if (candidate !== 'undeployed') {
    if (!process.env.MIDNIGHT_WALLET_SEED && !process.env.MIDNIGHT_WALLET_MNEMONIC) {
      process.stdout.write(
        'Wallet credential not configured — set MIDNIGHT_WALLET_MNEMONIC or MIDNIGHT_WALLET_SEED.\n',
      );
    }
  }
  return 0;
}

if (isMain()) {
  try {
    process.exit(cliMain(process.argv));
  } catch (e) {
    process.stderr.write(`${(e as Error).message}\n`);
    process.exit(1);
  }
}
