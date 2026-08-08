import { createHash } from 'node:crypto';
import type * as http from 'node:http';

export type ServerScope = 'admin' | 'public';

export type ClientTokenRegistry = ReadonlyMap<string, string>;

const tokenDigest = (token: string): string =>
  createHash('sha256').update(token, 'utf8').digest('hex');

/**
 * ASFALIA_CLIENT_TOKENS is a JSON object whose keys are opaque access tokens
 * and whose values are the only account each token may read.
 */
export function loadClientTokenRegistry(
  raw: string | undefined = process.env.ASFALIA_CLIENT_TOKENS,
): ClientTokenRegistry {
  if (!raw?.trim()) return new Map();

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error('ASFALIA_CLIENT_TOKENS must be a JSON object mapping tokens to accounts');
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('ASFALIA_CLIENT_TOKENS must be a JSON object mapping tokens to accounts');
  }

  const registry = new Map<string, string>();
  for (const [token, account] of Object.entries(parsed as Record<string, unknown>)) {
    if (token.length < 16 || token.length > 256) {
      throw new Error('every client access token must contain between 16 and 256 characters');
    }
    if (typeof account !== 'string' || !account.trim()) {
      throw new Error('every client access token must map to a non-empty account');
    }
    registry.set(tokenDigest(token), account.trim());
  }
  return registry;
}

export function clientAccountFromRequest(
  req: http.IncomingMessage,
  registry: ClientTokenRegistry,
): string | null {
  const match = /^Bearer ([^\s]+)$/.exec(req.headers.authorization ?? '');
  if (!match) return null;
  return registry.get(tokenDigest(match[1])) ?? null;
}
