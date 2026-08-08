import { computeScore } from '../src/score.ts';

type Entry = Parameters<typeof computeScore>[0][number];
const tx = (n: number) => n.toString(16).padStart(64, '0');
const entry = (overrides: Partial<Entry>): Entry => ({
  ts: 0,
  trigger: 'heartbeat',
  ok: true,
  verdict: true,
  txId: tx(1),
  ...overrides,
});

let failures = 0;
function expect(condition: boolean, message: string) {
  if (!condition) {
    failures++;
    console.error(`FAIL ${message}`);
  }
}

const manualGreen = computeScore([entry({ trigger: 'manual' })], null, 1);
expect(manualGreen.score === 100 && manualGreen.greens === 0, 'manual green cannot repair score');

const manualRed = computeScore([entry({ trigger: 'manual', verdict: false })], null, 1);
expect(manualRed.score === 88 && manualRed.reds === 1, 'manual red still counts');

const duplicate = computeScore([
  entry({ ts: 0, txId: tx(2) }),
  entry({ ts: 1, txId: tx(2) }),
], null, 2);
expect(duplicate.greens === 1, 'duplicate successful transaction identifiers are ignored');

const periodWorst = computeScore([
  entry({ ts: 1_000, txId: tx(3), verdict: true }),
  entry({ ts: 2_000, txId: tx(4), verdict: false }),
  entry({ ts: 3_000, txId: tx(5), verdict: false }),
], 10, 20_000);
expect(
  periodWorst.score === 82 && periodWorst.reds === 1 && periodWorst.gaps === 1,
  'one worst outcome is applied per heartbeat period',
);

const unordered = computeScore([
  entry({ ts: 8_000, txId: tx(7), ok: false, verdict: null }),
  entry({ ts: 1_000, txId: tx(6) }),
], 10, 11_000);
expect(unordered.failed === 1 && unordered.greens === 0, 'entries are sorted and failure beats green');

const ancient = computeScore([entry({ ts: 0, txId: tx(8) })], 1, 1_000_000_000_000);
expect(ancient.score === 0 && ancient.gaps === 999_999_999, 'large gap ranges are aggregated without a long loop');

console.log(failures === 0 ? 'Score checks: OK' : `${failures} score check(s) failed`);
process.exit(failures === 0 ? 0 : 1);
