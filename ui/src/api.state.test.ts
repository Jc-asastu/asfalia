import assert from 'node:assert/strict';
import { test } from 'node:test';
import { getState, type ServerState } from './api';

async function withFetch(response: Response | Error, check: () => Promise<void>) {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input) => {
    assert.equal(input, '/api/state');
    if (response instanceof Error) throw response;
    return response;
  };
  try {
    await check();
  } finally {
    globalThis.fetch = originalFetch;
  }
}

test('getState returns a successful state response', async () => {
  const state: ServerState = {
    mode: 'public',
    capabilities: { entityConsole: false, clientProof: false },
    network: 'testnet',
    contractAddress: '0x1234',
    entity: 'Test entity',
    ledger: null,
    attest: null,
    score: { score: 0, level: 'poor', greens: 0, reds: 0, gaps: 0, failed: 0 },
    heartbeat: null,
    now: 123,
  };
  await withFetch(new Response(JSON.stringify(state), { status: 200 }), async () => {
    assert.deepEqual(await getState(), state);
  });
});

test('getState rejects a JSON error response instead of treating it as state', async () => {
  await withFetch(new Response(JSON.stringify({ error: 'Indexer unavailable' }), { status: 500 }), async () => {
    await assert.rejects(getState(), /Indexer unavailable/);
  });
});

test('getState propagates a network failure', async () => {
  await withFetch(new Error('Connection lost'), async () => {
    await assert.rejects(getState(), /Connection lost/);
  });
});
