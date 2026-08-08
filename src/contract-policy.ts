import { Buffer } from 'node:buffer';

import type { NetworkId } from './network';

export const DEFAULT_ATTEST_TOLERANCE_SECONDS = 5n * 60n;
export const MAX_ATTEST_TOLERANCE_SECONDS = 60n * 60n;
export const DEFAULT_CERTIFICATE_VALIDITY_SECONDS = 5n * 60n;
export const MAX_CERTIFICATE_VALIDITY_SECONDS = 31n * 24n * 60n * 60n;

// Public and deterministic on purpose: it is convenient for a disposable
// local devnet and must never be treated as a production credential.
const LOCAL_DEVELOPMENT_OWNER_SECRET =
  '2fe77065e00381878fdadd5274bd4249cd079058c0ea876a95acf90c177a5b0c';

export interface ContractPolicy {
  attestToleranceSeconds: bigint;
  certificateValiditySeconds: bigint;
}

function parseBoundedSeconds(
  env: NodeJS.ProcessEnv,
  name: string,
  fallback: bigint,
  maximum: bigint,
): bigint {
  const raw = env[name]?.trim();
  if (!raw) return fallback;
  if (!/^[0-9]+$/.test(raw)) {
    throw new Error(`${name} must be a positive integer in seconds`);
  }

  const value = BigInt(raw);
  if (value < 1n || value > maximum) {
    throw new Error(`${name} must be between 1 and ${maximum} seconds`);
  }
  return value;
}

/** Policy values are constructor arguments and cannot be changed per attest. */
export function loadContractPolicy(env: NodeJS.ProcessEnv = process.env): ContractPolicy {
  return {
    attestToleranceSeconds: parseBoundedSeconds(
      env,
      'ASFALIA_TOL',
      DEFAULT_ATTEST_TOLERANCE_SECONDS,
      MAX_ATTEST_TOLERANCE_SECONDS,
    ),
    certificateValiditySeconds: parseBoundedSeconds(
      env,
      'ASFALIA_VALIDITY',
      DEFAULT_CERTIFICATE_VALIDITY_SECONDS,
      MAX_CERTIFICATE_VALIDITY_SECONDS,
    ),
  };
}

/** Read the DApp authority secret without logging or persisting it. */
export function loadOwnerSecret(
  network: NetworkId,
  env: NodeJS.ProcessEnv = process.env,
): Uint8Array {
  const raw = env.ASFALIA_OWNER_SECRET?.trim();
  if (!raw) {
    if (network === 'undeployed') {
      return Uint8Array.from(Buffer.from(LOCAL_DEVELOPMENT_OWNER_SECRET, 'hex'));
    }
    throw new Error(
      'ASFALIA_OWNER_SECRET is required on preview and preprod (exactly 64 hexadecimal characters)',
    );
  }
  if (!/^[0-9a-fA-F]{64}$/.test(raw)) {
    throw new Error('ASFALIA_OWNER_SECRET must contain exactly 64 hexadecimal characters');
  }
  return Uint8Array.from(Buffer.from(raw, 'hex'));
}
