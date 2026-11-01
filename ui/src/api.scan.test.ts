import assert from 'node:assert/strict';
import { test } from 'node:test';
import { getScan, type ScanResponse } from './api';

async function withFetch(response: Response | Error, check: () => Promise<void>) {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input) => {
    assert.equal(input, '/api/scan');
    if (response instanceof Error) throw response;
    return response;
  };
  try {
    await check();
  } finally {
    globalThis.fetch = originalFetch;
  }
}

test('getScan returns a successful scan response', async () => {
  const scan: ScanResponse = {
    head: { height: 42, hash: 'block-hash', timestamp: 123 },
    contractAddress: 'contract-address',
    rows: [],
  };
  await withFetch(new Response(JSON.stringify(scan), { status: 200 }), async () => {
    assert.deepEqual(await getScan(), scan);
  });
});

test('getScan rejects an HTTP 500 JSON error instead of treating it as scan data', async () => {
  await withFetch(new Response(JSON.stringify({ error: 'Indexer timeout' }), { status: 500 }), async () => {
    await assert.rejects(getScan(), /Indexer timeout/);
  });
});

test('getScan propagates a network failure', async () => {
  await withFetch(new Error('Connection lost'), async () => {
    await assert.rejects(getScan(), /Connection lost/);
  });
});
