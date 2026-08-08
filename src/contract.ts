/**
 * Conexion compartida al contrato Asfalia: providers + contrato deployado.
 * La usan el CLI y la API del dashboard — una sola definicion, cero copias.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { WebSocket } from 'ws';

import { findDeployedContract } from '@midnight-ntwrk/midnight-js-contracts';
import { httpClientProofProvider } from '@midnight-ntwrk/midnight-js-http-client-proof-provider';
import { indexerPublicDataProvider } from '@midnight-ntwrk/midnight-js-indexer-public-data-provider';
import { levelPrivateStateProvider } from '@midnight-ntwrk/midnight-js-level-private-state-provider';
import { NodeZkConfigProvider } from '@midnight-ntwrk/midnight-js-node-zk-config-provider';
import { CompiledContract } from '@midnight-ntwrk/midnight-js-protocol/compact-js';

import { resolveNetwork, getOrCreateWallet, getDeployment } from './network';
import { createWallet, persistWalletState, type WalletContext } from './wallet';
import { witnesses } from './witnesses';
import { loadEntityBook, loadUsers, toPrivateState } from './entity-data';
import { loadOwnerSecret } from './contract-policy';

// @ts-expect-error Required for wallet sync
globalThis.WebSocket = WebSocket;

export const PRIVATE_STATE_ID = 'asfaliaPrivateState';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const zkConfigPath = path.resolve(__dirname, '..', 'contracts', 'managed', 'asfalia');

export async function loadCompiledContract() {
  const contractPath = path.join(zkConfigPath, 'contract', 'index.js');
  if (!fs.existsSync(contractPath)) {
    throw new Error('Contract not compiled! Run: npm run compile');
  }
  const Asfalia = await import(pathToFileURL(contractPath).href);
  const compiled = CompiledContract.make('asfalia', Asfalia.Contract).pipe(
    (CompiledContract.withWitnesses as any)(witnesses),
    (CompiledContract.withCompiledFileAssets as any)(zkConfigPath),
  );
  return { Asfalia, compiled };
}

export function createProviders(walletCtx: WalletContext, networkConfig: any) {
  const privateStatePassword =
    process.env.PRIVATE_STATE_PASSWORD?.trim() || 'Local-Devnet-Development-Placeholder-1';

  const walletProvider = {
    getCoinPublicKey: () => walletCtx.shieldedSecretKeys.coinPublicKey,
    getEncryptionPublicKey: () => walletCtx.shieldedSecretKeys.encryptionPublicKey,
    async balanceTx(tx: any, ttl?: Date) {
      const recipe = await walletCtx.wallet.balanceUnboundTransaction(
        tx,
        { shieldedSecretKeys: walletCtx.shieldedSecretKeys, dustSecretKey: walletCtx.dustSecretKey },
        { ttl: ttl ?? new Date(Date.now() + 30 * 60 * 1000) },
      );
      return walletCtx.wallet.finalizeRecipe(recipe);
    },
    submitTx: (tx: any) => walletCtx.wallet.submitTransaction(tx) as any,
  };

  const zkConfigProvider = new NodeZkConfigProvider(zkConfigPath);
  const accountId = walletCtx.unshieldedKeystore.getBech32Address().toString();

  return {
    privateStateProvider: levelPrivateStateProvider({
      privateStateStoreName: 'asfalia-state',
      accountId,
      privateStoragePasswordProvider: () => privateStatePassword,
    }),
    publicDataProvider: indexerPublicDataProvider(networkConfig.indexer, networkConfig.indexerWS),
    zkConfigProvider,
    proofProvider: httpClientProofProvider(networkConfig.proofServer, zkConfigProvider),
    walletProvider,
    midnightProvider: walletProvider,
  };
}

export type AsfaliaConnection = Awaited<ReturnType<typeof connectAsfalia>>;

/** Conecta wallet + providers + contrato deployado. Una llamada, todo listo. */
export async function connectAsfalia(onProgress: (msg: string) => void = () => {}) {
  const { network, config: networkConfig } = resolveNetwork();
  const deployment = getDeployment(network);
  if (!deployment) {
    throw new Error(`No deploy on file for network ${network}. Run: npm run setup`);
  }

  const { Asfalia, compiled } = await loadCompiledContract();

  onProgress('connecting wallet');
  const entitySeed = getOrCreateWallet(network).seed;
  const walletCtx = await createWallet({ network, networkConfig, seed: entitySeed });
  onProgress('syncing');
  await walletCtx.wallet.waitForSyncedState();
  await persistWalletState(network, walletCtx);

  onProgress('connecting contract');
  const providers = createProviders(walletCtx, networkConfig);
  const deployed: any = await findDeployedContract(providers, {
    compiledContract: compiled as any,
    contractAddress: deployment.address,
    privateStateId: PRIVATE_STATE_ID,
    initialPrivateState: toPrivateState(loadEntityBook(), loadUsers()),
  });

  /** Estado publico del contrato: veredicto + attestedAt + commitment. Nada mas existe. */
  async function readLedger() {
    const contractState = await providers.publicDataProvider.queryContractState(deployment!.address);
    if (!contractState) return null;
    const l = Asfalia.ledger(contractState.data);
    return {
      verdict: l.verdict as boolean,
      attestedAt: l.attestedAt as bigint,
      validUntil: l.validUntil as bigint,
      assetsCommitment: Buffer.from(l.assetsCommitment).toString('hex') as string,
      liabilitiesRoot: Buffer.from(l.liabilitiesRoot).toString('hex') as string,
    };
  }

  /** Ejecuta el attest: prueba ZK real contra el proof server.
   *  El tiempo de bloque va en SEGUNDOS epoch (verificado en el log del nodo:
   *  tblock=Timestamp(1786118610)). `claimed` retrocede 30s porque el bloque
   *  corre detras del wall-clock; la tolerancia (default 5 min) cubre el slack.
   *  ASFALIA_NOW permite sondeos controlados; tolerancia y vigencia quedan
   *  fijadas en el constructor del contrato y no se eligen en esta llamada. */
  async function attest() {
    const claimed = process.env.ASFALIA_NOW
      ? BigInt(process.env.ASFALIA_NOW)
      : BigInt(Math.floor(Date.now() / 1000) - 30);
    const ownerSecret = loadOwnerSecret(network);
    const tx = await deployed.callTx.attest(ownerSecret, claimed);
    return { txId: tx.public.txId as string, blockHeight: tx.public.blockHeight as number };
  }

  /** Settlement: la contraparte acepta el certificado. La cadena solo lo
   *  permite si el veredicto es solvente Y la ventana sigue abierta —
   *  vencido, el assert de blockTime rechaza la tx. */
  async function settle() {
    const tx = await deployed.callTx.settle();
    return { txId: tx.public.txId as string, blockHeight: tx.public.blockHeight as number };
  }

  async function close() {
    await persistWalletState(network, walletCtx);
    await walletCtx.wallet.stop();
  }

  const entityAddress = walletCtx.unshieldedKeystore.getBech32Address().toString();

  return {
    network, networkConfig, deployment, walletCtx, providers, deployed, Asfalia,
    entitySeed, entityAddress, readLedger, attest, settle, close,
  };
}
