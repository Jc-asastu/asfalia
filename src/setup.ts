// Orchestrator for `npm run setup`. Replaces the prior package.json chain
// `docker compose up -d --wait && npm run compile && npm run deploy` so
// we can branch on --network and forward it to deploy.
import { spawnSync } from 'node:child_process';
import { getOrCreateWallet, resolveNetwork, setActiveNetwork, parseNetworkFlag } from './network';
import { loadPrivateStatePassword } from './runtime-secrets';

function run(cmd: string, args: string[]): void {
  const r = spawnSync(cmd, args, { stdio: 'inherit', shell: false });
  if (r.status !== 0) {
    process.stderr.write(`\nCommand failed: ${cmd} ${args.join(' ')}\n`);
    process.exit(r.status ?? 1);
  }
}

async function main(): Promise<void> {
  const argv = process.argv;
  const flag = parseNetworkFlag(argv);
  if (flag) setActiveNetwork(flag);
  const { network, config } = resolveNetwork({ argv });

  // Fail before starting containers or compiling if public-network secrets are absent.
  getOrCreateWallet(network);
  loadPrivateStatePassword(network);

  process.stdout.write(`\n→ Setting up Asfalia on network: ${network}\n\n`);

  // 1. Bring up only the services this network needs.
  run('docker', ['compose', 'up', '-d', '--wait', ...config.composeServices]);

  // 2. Compile the contract (network-agnostic).
  run('npm', ['run', 'compile']);

  // 3. Deploy. Forward --network so deploy.ts sees the same network.
  const deployArgs = network === 'undeployed' ? [] : ['--', '--network', network];
  run('npm', ['run', 'deploy', ...deployArgs]);
}

main().catch((e) => {
  process.stderr.write(`\nSetup failed: ${(e as Error).message}\n`);
  process.exit(1);
});
