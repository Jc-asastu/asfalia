/**
 * Vista publica de Asfalia: SOLO lee la cadena.
 *
 * `connectAsfalia` (src/contract.ts) levanta la wallet de la entidad, carga los
 * libros en el private state y necesita el proof server: es la conexion de
 * QUIEN EMITE. Esta es la de quien MIRA — auditor, contraparte, cualquiera.
 *
 * No toca la seed, no lee `data/`, no puede firmar ni probar nada. Lo unico
 * que importa del contrato compilado es el decodificador `ledger()`, para leer
 * el estado publico que el indexer devuelve.
 *
 * La separacion no es una convencion: `scripts/public-surface-check.ts` la
 * verifica estaticamente en CI. Si alguien importa aca la wallet o los libros,
 * el pipeline rompe.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { WebSocket } from 'ws';

import { indexerPublicDataProvider } from '@midnight-ntwrk/midnight-js-indexer-public-data-provider';
// Solo la config pura: `src/network.ts` tambien maneja seeds y lee
// `.midnight-state.json`, que es justamente lo que aca no puede existir.
import { resolveNetworkConfig, type NetworkConfig, type NetworkId } from './network-config';

// @ts-expect-error el provider del indexer usa WebSocket para las suscripciones
globalThis.WebSocket = WebSocket;

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CONTRACT_JS = path.resolve(
  __dirname, '..', 'contracts', 'managed', 'asfalia', 'contract', 'index.js',
);

/** El estado publico completo. Cinco campos: ninguno es un saldo. */
export type PublicLedger = {
  verdict: boolean;
  attestedAt: bigint;
  validUntil: bigint;
  assetsCommitment: string;
  liabilitiesRoot: string;
};

export type PublicView = {
  network: NetworkId;
  config: NetworkConfig;
  contractAddress: string;
  readLedger: () => Promise<PublicLedger | null>;
};

/**
 * Conecta en modo lectura. La direccion del contrato se pasa explicitamente
 * (bandera o variable de entorno): NO se busca en el estado local, porque un
 * auditor externo no tiene —ni tiene por que tener— ningun archivo de la
 * entidad. Es dato publico: esta en la cadena.
 */
export async function connectPublicView(
  opts: { contractAddress?: string } = {},
): Promise<PublicView> {
  const { network, config } = resolveNetworkConfig();
  const contractAddress = opts.contractAddress?.trim() || process.env.ASFALIA_CONTRACT?.trim() || '';
  if (!contractAddress) {
    throw new Error(
      'Falta la direccion del contrato. Pasala con --contract <address> o ASFALIA_CONTRACT=<address>.\n' +
      '  La entidad la muestra en la cabecera de su consola; tambien esta en cualquier explorador.',
    );
  }
  if (!fs.existsSync(CONTRACT_JS)) {
    throw new Error('Contrato sin compilar (hace falta para decodificar el ledger). Corre: npm run compile');
  }

  // Solo el decodificador del estado publico. Ni claves ZK ni witnesses.
  const Asfalia = await import(pathToFileURL(CONTRACT_JS).href);
  const publicDataProvider = indexerPublicDataProvider(config.indexer, config.indexerWS);

  async function readLedger(): Promise<PublicLedger | null> {
    const contractState = await publicDataProvider.queryContractState(contractAddress);
    if (!contractState) return null;
    const l = Asfalia.ledger(contractState.data);
    return {
      verdict: l.verdict as boolean,
      attestedAt: l.attestedAt as bigint,
      validUntil: l.validUntil as bigint,
      assetsCommitment: Buffer.from(l.assetsCommitment).toString('hex'),
      liabilitiesRoot: Buffer.from(l.liabilitiesRoot).toString('hex'),
    };
  }

  return { network, config, contractAddress, readLedger };
}
