// Configuracion de red PURA: constantes, tipos y resolucion por flag/entorno.
//
// No toca el disco y no sabe nada de seeds, mnemonics ni deploys. Existe
// separado por eso: el sitio publico necesita saber a que indexer hablarle,
// y no puede depender de un modulo que ademas maneja la wallet de la entidad
// o lee `.midnight-state.json` (donde viven las seeds).
//
// `src/network.ts` re-exporta todo esto y le suma lo que sí toca el disco.

export type NetworkId = 'undeployed' | 'preview' | 'preprod';

export const NETWORK_IDS: readonly NetworkId[] = ['undeployed', 'preview', 'preprod'] as const;

export interface NetworkConfig {
  networkId: NetworkId;
  indexer: string;
  indexerWS: string;
  node: string;
  proofServer: string;
  faucet: string | null;
  composeServices: string[];
}

export const NETWORK_CONFIGS: Record<NetworkId, NetworkConfig> = {
  undeployed: {
    networkId: 'undeployed',
    indexer:   'http://127.0.0.1:8088/api/v4/graphql',
    indexerWS: 'ws://127.0.0.1:8088/api/v4/graphql/ws',
    node:      'ws://127.0.0.1:9944',
    proofServer: 'http://127.0.0.1:6300',
    faucet: null,
    composeServices: ['node', 'indexer', 'proof-server'],
  },
  preview: {
    networkId: 'preview',
    indexer:   'https://indexer.preview.midnight.network/api/v4/graphql',
    indexerWS: 'wss://indexer.preview.midnight.network/api/v4/graphql/ws',
    node:      'https://rpc.preview.midnight.network',
    proofServer: 'http://127.0.0.1:6300',
    faucet: 'https://midnight-tmnight-preview.nethermind.dev',
    composeServices: ['proof-server'],
  },
  preprod: {
    networkId: 'preprod',
    indexer:   'https://indexer.preprod.midnight.network/api/v4/graphql',
    indexerWS: 'wss://indexer.preprod.midnight.network/api/v4/graphql/ws',
    node:      'https://rpc.preprod.midnight.network',
    proofServer: 'http://127.0.0.1:6300',
    faucet: 'https://midnight-tmnight-preprod.nethermind.dev',
    composeServices: ['proof-server'],
  },
};

export function isNetworkId(v: unknown): v is NetworkId {
  return typeof v === 'string' && (NETWORK_IDS as readonly string[]).includes(v);
}

export function parseNetworkFlag(argv: string[]): NetworkId | null {
  for (let i = 2; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--network') {
      const v = argv[i + 1];
      if (v === undefined) throw new Error('--network requires a value');
      if (!isNetworkId(v)) {
        throw new Error(`Unknown network: ${v}. Supported: ${NETWORK_IDS.join(', ')}.`);
      }
      return v;
    }
    if (arg.startsWith('--network=')) {
      const v = arg.slice('--network='.length);
      if (!isNetworkId(v)) {
        throw new Error(`Unknown network: ${v}. Supported: ${NETWORK_IDS.join(', ')}.`);
      }
      return v;
    }
  }
  return null;
}

const ENV_OVERRIDES: Array<[keyof NetworkConfig, string]> = [
  ['indexer', 'MIDNIGHT_INDEXER_URL'],
  ['indexerWS', 'MIDNIGHT_INDEXER_WS_URL'],
  ['node', 'MIDNIGHT_NODE_URL'],
  ['faucet', 'MIDNIGHT_FAUCET_URL'],
  ['proofServer', 'MIDNIGHT_PROOF_SERVER_URL'],
];

export function applyEnvOverrides(base: NetworkConfig, env: NodeJS.ProcessEnv): NetworkConfig {
  const out: NetworkConfig = { ...base, composeServices: [...base.composeServices] };
  for (const [field, varName] of ENV_OVERRIDES) {
    const v = env[varName];
    if (v) (out as unknown as Record<string, unknown>)[field] = v;
  }
  return out;
}

/**
 * Resuelve la red SIN leer el disco: `--network <id>` o `MIDNIGHT_NETWORK`,
 * y si no hay ninguno, la devnet local. Es la que usa el sitio publico, que
 * no tiene (ni debe tener) el estado local de la entidad.
 */
export function resolveNetworkConfig(
  opts: { argv?: string[]; env?: NodeJS.ProcessEnv } = {},
): { network: NetworkId; config: NetworkConfig } {
  const argv = opts.argv ?? process.argv;
  const env = opts.env ?? process.env;
  const fromEnv = env.MIDNIGHT_NETWORK;
  const network: NetworkId =
    parseNetworkFlag(argv) ?? (isNetworkId(fromEnv) ? fromEnv : 'undeployed');
  return { network, config: applyEnvOverrides(NETWORK_CONFIGS[network], env) };
}
