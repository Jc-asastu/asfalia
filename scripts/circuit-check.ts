// Chequeo minimo del circuito (criterio de aceptacion HITO 2):
//   solvente -> verdict true · insolvente -> verdict false
//   y ningun balance aparece en el estado publico.
// Corre contra el simulador de compact-runtime, sin proof server.

import {
  type CircuitContext,
  QueryContext,
  sampleContractAddress,
  createConstructorContext,
  CostModel,
} from "@midnight-ntwrk/compact-runtime";
import {
  Contract,
  ledger,
} from "../contracts/managed/enku/contract/index.js";
import { witnesses, type EnkuPrivateState } from "../src/witnesses.js";

const nonce = new Uint8Array(32).fill(7); // fijo: es un chequeo, no una prueba real

function attest(assets: bigint[], liabilities: bigint[]) {
  const contract = new Contract<EnkuPrivateState>(witnesses);
  const privateState: EnkuPrivateState = { assets, liabilities, nonce };
  const { currentPrivateState, currentContractState, currentZswapLocalState } =
    contract.initialState(createConstructorContext(privateState, "0".repeat(64)));
  const ctx: CircuitContext<EnkuPrivateState> = {
    currentPrivateState,
    currentZswapLocalState,
    costModel: CostModel.initialCostModel(),
    currentQueryContext: new QueryContext(
      currentContractState.data,
      sampleContractAddress(),
    ),
  };
  // now=0, tolerancia maxima: el tiempo simulado arranca en 0 y esto lo satisface.
  const next = contract.impureCircuits.attest(ctx, 0n, 4_000_000_000n);
  return ledger(next.context.currentQueryContext.state);
}

const SOLVENT: [bigint[], bigint[]] = [
  [500_00n, 1200_00n, 90_00n, 0n, 3000_00n, 45_00n, 800_00n, 10_00n],
  [400_00n, 300_00n, 25_00n, 0n, 1500_00n, 30_00n, 200_00n, 5_00n],
];
const INSOLVENT: [bigint[], bigint[]] = [SOLVENT[1], SOLVENT[0]];

let failures = 0;
const check = (name: string, got: unknown, want: unknown) => {
  const ok = got === want;
  if (!ok) failures++;
  console.log(`${ok ? "OK " : "FAIL"} ${name}: ${got} (esperado ${want})`);
};

const a = attest(...SOLVENT);
check("solvente -> verdict", a.verdict, true);

const b = attest(...INSOLVENT);
check("insolvente -> verdict", b.verdict, false);

// Nada de los balances en el estado publico serializado.
for (const [name, state] of [["solvente", a], ["insolvente", b]] as const) {
  const publicState = JSON.stringify(state, (_, v) =>
    typeof v === "bigint" ? v.toString() : v instanceof Uint8Array ? Array.from(v).join(",") : v,
  );
  const leaked = [...SOLVENT[0], ...SOLVENT[1]]
    .filter((x) => x !== 0n)
    .some((x) => publicState.includes(x.toString()));
  check(`sin fuga de balances (${name})`, leaked, false);
}

process.exit(failures === 0 ? 0 : 1);
