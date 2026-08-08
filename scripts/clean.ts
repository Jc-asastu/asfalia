import * as fs from 'node:fs';
import * as path from 'node:path';

const root = path.resolve(process.cwd());
const targets = ['contracts/managed', '.midnight-wallet-state', 'ui/dist'];

for (const relative of targets) {
  const target = path.resolve(root, relative);
  if (target === root || !target.startsWith(`${root}${path.sep}`)) {
    throw new Error(`Refusing to clean path outside the repository: ${target}`);
  }
  fs.rmSync(target, { recursive: true, force: true });
  process.stdout.write(`removed ${relative}\n`);
}

process.stdout.write('Preserved .midnight-state.json (deployment metadata or legacy wallet backup).\n');
