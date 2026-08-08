/**
 * Pago de contraparte (demo): al aceptar el certificado, una segunda wallet
 * ("la contraparte") paga tNIGHT reales a la entidad. Sin frescura, sin
 * circuito nuevo: una transferencia unshielded comun, registrada en cadena.
 *
 * La seed de la contraparte se DERIVA de la seed de la entidad (sha256 con
 * dominio): deterministica y reconstruible, ningun secreto nuevo en disco.
 * Su estado de sync vive en .cp-state/ (gitignoreado).
 */
import * as path from 'node:path';
import * as fs from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import * as Rx from 'rxjs';

import { createWallet, persistWalletState, unshieldedToken, type WalletContext } from './wallet';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CP_DIR = path.resolve(__dirname, '..', '.cp-state');

// 1 tNIGHT = 10^6 unidades (verificado: el faucet de 5000 tNIGHT llega como 5.000.000.000)
export const TNIGHT = 1_000_000n;
export const PAYMENT_UNITS = 1_500n * TNIGHT; // el pago del demo: 1.500 tNIGHT
const FUND_UNITS = 3_000n * TNIGHT; // fondeo unico (la entidad tiene ~5000; 2x el pago con margen)

const deriveCpSeed = (entitySeed: string) =>
  createHash('sha256').update(`asfalia-counterparty:${entitySeed}`).digest('hex');

export type Counterparty = {
  ctx: WalletContext;
  address: string;
};

let cp: Counterparty | null = null;

async function syncedState(ctx: WalletContext) {
  return await ctx.wallet.waitForSyncedState();
}

const unshieldedBalance = (state: any): bigint =>
  state.unshielded.balances[unshieldedToken().raw] ?? 0n;

async function transferUnshielded(
  from: WalletContext,
  toAddress: string,
  amount: bigint,
): Promise<string> {
  const recipe = await from.wallet.transferTransaction(
    [
      {
        type: 'unshielded',
        outputs: [{ type: unshieldedToken().raw, receiverAddress: toAddress as any, amount }],
      },
    ],
    { shieldedSecretKeys: from.shieldedSecretKeys, dustSecretKey: from.dustSecretKey },
    { ttl: new Date(Date.now() + 30 * 60 * 1000) },
  );
  const finalized = await from.wallet.finalizeRecipe(recipe);
  const submitted = await from.wallet.submitTransaction(finalized);
  return String(submitted);
}

async function registerForDust(ctx: WalletContext) {
  const state = await syncedState(ctx);
  const unregistered = state.unshielded.availableCoins.filter(
    (c: any) => !c.meta?.registeredForDustGeneration,
  );
  if (unregistered.length > 0) {
    // Mismo baile que deploy.ts: la callback de firma ya produce la receta
    // completa — NO volver a firmar.
    const recipe = await ctx.wallet.registerNightUtxosForDustGeneration(
      unregistered,
      ctx.unshieldedKeystore.getPublicKey(),
      (payload: any) => ctx.unshieldedKeystore.signData(payload),
    );
    const finalized = await ctx.wallet.finalizeRecipe(recipe);
    await ctx.wallet.submitTransaction(finalized);
  }
  const dustNow = (await syncedState(ctx)).dust.balance(new Date());
  if (dustNow === 0n) {
    await Rx.firstValueFrom(
      ctx.wallet.state().pipe(
        Rx.throttleTime(5000),
        Rx.filter((s: any) => s.isSynced && s.dust.balance(new Date()) > 0n),
      ),
    );
  }
}

/** Prepara la contraparte: wallet derivada, fondeo unico desde la entidad
 *  y registro de DUST. Idempotente — con estado ya fondeado, solo sincroniza. */
export async function ensureCounterparty(
  entityCtx: WalletContext,
  network: string,
  networkConfig: any,
  entitySeed: string,
  onProgress: (m: string) => void = () => {},
): Promise<Counterparty> {
  if (cp) return cp;
  fs.mkdirSync(CP_DIR, { recursive: true });

  onProgress('counterparty wallet');
  const ctx = await createWallet({
    network: network as any,
    networkConfig,
    seed: deriveCpSeed(entitySeed),
    cwd: CP_DIR,
  });
  await syncedState(ctx);
  const address = ctx.unshieldedKeystore.getBech32Address().toString();

  let balance = unshieldedBalance(await syncedState(ctx));
  if (balance < PAYMENT_UNITS * 2n) {
    onProgress('funding counterparty');
    await transferUnshielded(entityCtx, address, FUND_UNITS);
    // esperar a que el fondeo aterrice en la vista de la contraparte
    await Rx.firstValueFrom(
      ctx.wallet.state().pipe(
        Rx.throttleTime(5000),
        Rx.filter((s: any) => s.isSynced && unshieldedBalance(s) >= FUND_UNITS),
      ),
    );
  }

  onProgress('counterparty DUST');
  await registerForDust(ctx);
  await persistWalletState(network as any, ctx, CP_DIR);

  cp = { ctx, address };
  return cp;
}

/** El pago del settlement: contraparte -> entidad, 1.500 tNIGHT. */
export async function settlementPayment(
  counterparty: Counterparty,
  entityAddress: string,
): Promise<string> {
  const id = await transferUnshielded(counterparty.ctx, entityAddress, PAYMENT_UNITS);
  await persistWalletState('preview' as any, counterparty.ctx, CP_DIR).catch(() => {});
  return id;
}
