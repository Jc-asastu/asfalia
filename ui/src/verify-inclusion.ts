import { pureCircuits } from '../../contracts/managed/asfalia/contract/index.js';

import type { InclusionResponse } from './api';

const HEX_32 = /^[0-9a-fA-F]{64}$/;

const fromHex32 = (value: string, field: string): Uint8Array => {
  if (!HEX_32.test(value)) throw new Error(`${field} must be exactly 32 bytes`);
  return Uint8Array.from(value.match(/.{2}/g)!.map((byte) => Number.parseInt(byte, 16)));
};

const toHex = (value: Uint8Array): string =>
  Array.from(value, (byte) => byte.toString(16).padStart(2, '0')).join('');

export type LocalInclusionVerdict = {
  verified: boolean;
  reason?: 'no_attest' | 'root_mismatch';
  leafHex: string;
  rootHex: string;
};

/** Rebuild the client's leaf and Merkle path entirely inside the browser. */
export async function verifyInclusionLocally(
  proof: InclusionResponse,
  expectedCents: string,
  expectedRootHex: string | null,
): Promise<LocalInclusionVerdict> {
  if (!expectedRootHex || !HEX_32.test(expectedRootHex) || !/[^0]/.test(expectedRootHex)) {
    return { verified: false, reason: 'no_attest', leafHex: '', rootHex: '' };
  }
  if (!/^[0-9]+$/.test(expectedCents)) throw new Error('balance must be a non-negative integer');
  if (BigInt(expectedCents) > (1n << 64n) - 1n) throw new Error('balance exceeds Uint<64>');
  if (proof.path.length !== 4) throw new Error('a 16-leaf Merkle proof must have exactly 4 siblings');

  const accountBytes = new TextEncoder().encode(`asfalia:account:${proof.account}`);
  const id = new Uint8Array(await crypto.subtle.digest('SHA-256', accountBytes));

  let node = pureCircuits.leafHash({
    id,
    balance: BigInt(expectedCents),
    salt: fromHex32(proof.saltHex, 'saltHex'),
  });
  const leafHex = toHex(node);

  for (const [index, step] of proof.path.entries()) {
    if (step.siblingSide !== 'left' && step.siblingSide !== 'right') {
      throw new Error(`path[${index}].siblingSide is invalid`);
    }
    const sibling = fromHex32(step.siblingHex, `path[${index}].siblingHex`);
    node = step.siblingSide === 'right'
      ? pureCircuits.pairHash(node, sibling)
      : pureCircuits.pairHash(sibling, node);
  }

  const rootHex = toHex(node);
  return {
    verified: rootHex.toLowerCase() === expectedRootHex.toLowerCase(),
    reason: rootHex.toLowerCase() === expectedRootHex.toLowerCase() ? undefined : 'root_mismatch',
    leafHex,
    rootHex,
  };
}
