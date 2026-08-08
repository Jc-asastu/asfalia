import type { NetworkId } from './network';

const LOCAL_PRIVATE_STATE_PASSWORD = 'Local-Devnet-Development-Placeholder-1';

export function loadPrivateStatePassword(
  network: NetworkId,
  env: NodeJS.ProcessEnv = process.env,
): string {
  const configured = env.PRIVATE_STATE_PASSWORD;
  if (configured) {
    if (configured.length < 16) {
      throw new Error('PRIVATE_STATE_PASSWORD must contain at least 16 characters');
    }
    return configured;
  }
  if (network !== 'undeployed') {
    throw new Error(
      `PRIVATE_STATE_PASSWORD is required for ${network}; store it in a secret manager`,
    );
  }
  return LOCAL_PRIVATE_STATE_PASSWORD;
}
