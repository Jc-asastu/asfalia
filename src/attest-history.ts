import * as fs from 'node:fs';
import * as path from 'node:path';

const MAX_ENTRIES = 100_000;
const HASH_32_RE = /^[0-9a-f]{64}$/i;
const TX_ID_RE = /^[0-9a-f]{32,}$/i;
const DECIMAL_RE = /^\d+$/;
const ENTRY_KEYS = [
  'ts', 'trigger', 'ok', 'verdict', 'txId', 'attestedAt', 'validUntil',
  'assetsCommitment', 'liabilitiesRoot', 'durationSec', 'error',
] as const;

export type LogEntry = {
  ts: number;
  trigger: 'heartbeat' | 'manual';
  ok: boolean;
  verdict: boolean | null;
  txId: string | null;
  attestedAt: string | null;
  validUntil: string | null;
  assetsCommitment: string | null;
  liabilitiesRoot: string | null;
  durationSec: number | null;
  error: string | null;
};

function fail(file: string, index: number, message: string): never {
  throw new Error(`Invalid attestation history ${file} at entry ${index}: ${message}`);
}

function validateEntry(value: unknown, file: string, index: number): LogEntry {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    fail(file, index, 'expected an object');
  }
  const entry = value as Record<string, unknown>;
  const keys = Object.keys(entry).sort();
  const expected = [...ENTRY_KEYS].sort();
  if (keys.length !== expected.length || keys.some((key, i) => key !== expected[i])) {
    fail(file, index, `expected exactly: ${ENTRY_KEYS.join(', ')}`);
  }
  if (!Number.isSafeInteger(entry.ts) || (entry.ts as number) < 0) fail(file, index, 'ts must be a non-negative safe integer');
  if (entry.trigger !== 'heartbeat' && entry.trigger !== 'manual') fail(file, index, 'invalid trigger');
  if (typeof entry.ok !== 'boolean') fail(file, index, 'ok must be boolean');
  if (entry.verdict !== null && typeof entry.verdict !== 'boolean') fail(file, index, 'invalid verdict');
  if (entry.txId !== null && (typeof entry.txId !== 'string' || !TX_ID_RE.test(entry.txId))) fail(file, index, 'invalid txId');
  for (const field of ['attestedAt', 'validUntil'] as const) {
    if (entry[field] !== null && (typeof entry[field] !== 'string' || !DECIMAL_RE.test(entry[field]))) {
      fail(file, index, `${field} must be a decimal string or null`);
    }
  }
  for (const field of ['assetsCommitment', 'liabilitiesRoot'] as const) {
    if (entry[field] !== null && (typeof entry[field] !== 'string' || !HASH_32_RE.test(entry[field]))) {
      fail(file, index, `${field} must be 32-byte hex or null`);
    }
  }
  if (entry.durationSec !== null && (typeof entry.durationSec !== 'number' || !Number.isFinite(entry.durationSec) || entry.durationSec < 0)) {
    fail(file, index, 'durationSec must be a non-negative finite number or null');
  }
  if (entry.error !== null && (typeof entry.error !== 'string' || entry.error.length > 4_000)) {
    fail(file, index, 'error must be a string of at most 4000 characters or null');
  }
  if (entry.ok && entry.txId === null) fail(file, index, 'a successful entry requires txId');
  return entry as LogEntry;
}

export function validateHistory(value: unknown, file = '<memory>'): LogEntry[] {
  if (!Array.isArray(value)) throw new Error(`Invalid attestation history ${file}: expected an array`);
  if (value.length > MAX_ENTRIES) throw new Error(`Invalid attestation history ${file}: more than ${MAX_ENTRIES} entries`);
  const entries = value.map((entry, index) => validateEntry(entry, file, index));
  const successfulTxIds = new Set<string>();
  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];
    if (i > 0 && entry.ts < entries[i - 1].ts) fail(file, i, 'entries are not chronological');
    if (entry.ok && entry.txId) {
      const txId = entry.txId.toLowerCase();
      if (successfulTxIds.has(txId)) fail(file, i, `duplicate successful txId ${entry.txId}`);
      successfulTxIds.add(txId);
    }
  }
  return entries;
}

export function loadHistory(file: string): LogEntry[] {
  if (!fs.existsSync(file)) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (error) {
    throw new Error(`Failed to parse attestation history ${file}: ${(error as Error).message}`);
  }
  return validateHistory(parsed, file);
}

function atomicWrite(file: string, entries: LogEntry[]): void {
  const dir = path.dirname(file);
  fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
  const tmp = `${file}.tmp-${process.pid}-${Date.now()}`;
  try {
    fs.writeFileSync(tmp, `${JSON.stringify(entries, null, 2)}\n`, { mode: 0o600 });
    fs.renameSync(tmp, file);
  } catch (error) {
    try { fs.rmSync(tmp, { force: true }); } catch { /* best effort */ }
    throw error;
  }
}

export function appendHistory(file: string, history: LogEntry[], entry: LogEntry): LogEntry[] {
  const next = validateHistory([...history, entry], file);
  atomicWrite(file, next);
  return next;
}
