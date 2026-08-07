// Estado privado de Enku: los balances y el nonce del commitment.
// Vive en la maquina del prover. Jamas toca el ledger, los logs ni la UI.

import type { WitnessContext } from "@midnight-ntwrk/midnight-js-protocol/compact-runtime";


export type EnkuPrivateState = {
  readonly assets: bigint[]; // 8 items, centavos
  readonly liabilities: bigint[]; // 8 items, centavos
  readonly nonce: Uint8Array; // 32 bytes aleatorios
};

// Ledger se tipa unknown: managed/ se genera al compilar (en el Codespace) y
// los witnesses no leen el ledger — solo devuelven estado privado.
type WC = WitnessContext<unknown, EnkuPrivateState>;

export const witnesses = {
  assetBalances: ({ privateState }: WC): [EnkuPrivateState, bigint[]] => [
    privateState,
    privateState.assets,
  ],
  liabilityBalances: ({ privateState }: WC): [EnkuPrivateState, bigint[]] => [
    privateState,
    privateState.liabilities,
  ],
  commitmentNonce: ({ privateState }: WC): [EnkuPrivateState, Uint8Array] => [
    privateState,
    privateState.nonce,
  ],
};
