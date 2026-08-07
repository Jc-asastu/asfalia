// Estado privado de Asfalia: los activos, su nonce, y las cuentas de clientes
// (los pasivos). Vive en la maquina del prover. Jamas toca el ledger,
// los logs ni la UI del auditor.

import type { WitnessContext } from "@midnight-ntwrk/midnight-js-protocol/compact-runtime";

export type ClientAccount = {
  readonly id: Uint8Array; // 32 bytes — identificador de la cuenta
  readonly balance: bigint; // centavos
  readonly salt: Uint8Array; // 32 bytes — ciega el saldo en la hoja del arbol
};

export type AsfaliaPrivateState = {
  readonly assets: bigint[]; // 8 items, centavos
  readonly assetsNonce: Uint8Array; // 32 bytes
  readonly clients: ClientAccount[]; // 16 cuentas
};

// Ledger se tipa unknown: managed/ se genera al compilar (en el Codespace) y
// los witnesses no leen el ledger — solo devuelven estado privado.
type WC = WitnessContext<unknown, AsfaliaPrivateState>;

export const witnesses = {
  assetBalances: ({ privateState }: WC): [AsfaliaPrivateState, bigint[]] => [
    privateState,
    privateState.assets,
  ],
  assetsNonce: ({ privateState }: WC): [AsfaliaPrivateState, Uint8Array] => [
    privateState,
    privateState.assetsNonce,
  ],
  clientAccounts: ({ privateState }: WC): [AsfaliaPrivateState, ClientAccount[]] => [
    privateState,
    privateState.clients,
  ],
};
