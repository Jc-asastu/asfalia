import { loadClientTokenRegistry, clientAccountFromRequest } from '../api/access.ts';
import { accountIdHex, loadUsers, toClientAccount } from '../src/entity-data.ts';

let failures = 0;
const expect = (condition: boolean, message: string) => {
  if (!condition) {
    failures++;
    console.error(`FAIL ${message}`);
  }
};

const token = '0123456789abcdef0123456789abcdef';
const registry = loadClientTokenRegistry(JSON.stringify({ [token]: 'AX-2026-0001' }));
expect(
  clientAccountFromRequest(
    { headers: { authorization: `Bearer ${token}` } } as never,
    registry,
  ) === 'AX-2026-0001',
  'a valid bearer token resolves only its configured account',
);
expect(
  clientAccountFromRequest(
    { headers: { authorization: 'Bearer wrong-token-value' } } as never,
    registry,
  ) === null,
  'an unknown bearer token is rejected',
);

for (const invalid of ['[]', '{bad', JSON.stringify({ short: 'AX-1' })]) {
  let rejected = false;
  try {
    loadClientTokenRegistry(invalid);
  } catch {
    rejected = true;
  }
  expect(rejected, `invalid token configuration is rejected: ${invalid}`);
}

const users = loadUsers();
expect(users.length === 16, 'demo book keeps exactly 16 client accounts');
expect(
  accountIdHex('AX-2026-0001') ===
    '337966da27e918cc834af59d097312cd794ff4743e2420f37599e45cd99c5873',
  'the account-id domain and encoding stay stable',
);
for (const user of users) {
  expect(user.idHex === accountIdHex(user.account), `${user.account} has a deterministic id`);
  try {
    toClientAccount(user);
  } catch {
    expect(false, `${user.account} converts to a circuit client`);
  }
}

let tamperedIdRejected = false;
try {
  toClientAccount({ ...users[0], idHex: '00'.repeat(32) });
} catch {
  tamperedIdRejected = true;
}
expect(tamperedIdRejected, 'an id that is not bound to its account is rejected');

console.log(failures === 0 ? 'Access checks: OK' : `Access checks: ${failures} failure(s)`);
process.exit(failures === 0 ? 0 : 1);
