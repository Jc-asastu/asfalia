// Suite del circuito Enku — corre en el simulador de compact-runtime,
// sin proof server: verifica la LOGICA, no la prueba. La prueba real
// se ejercita end-to-end contra la devnet (npm run attest).
//
// En el simulador el tiempo de bloque es 0: los casos temporales se
// construyen alrededor de ese hecho (claimed=0 es "ahora" simulado).

import {
  type CircuitContext,
  QueryContext,
  sampleContractAddress,
  createConstructorContext,
  CostModel,
} from "@midnight-ntwrk/compact-runtime";
import { Contract, ledger } from "../contracts/managed/enku/contract/index.js";
import { witnesses, type EnkuPrivateState } from "../src/witnesses.js";

const NONCE = new Uint8Array(32).fill(7);
const NONCE_B = new Uint8Array(32).fill(9);

const SOLVENT_ASSETS = [500_00n, 1200_00n, 90_00n, 0n, 3000_00n, 45_00n, 800_00n, 10_00n];
const SOLVENT_LIABS = [400_00n, 300_00n, 25_00n, 0n, 1500_00n, 30_00n, 200_00n, 5_00n];

function makeContext(privateState: EnkuPrivateState) {
  const contract = new Contract<EnkuPrivateState>(witnesses);
  const { currentPrivateState, currentContractState, currentZswapLocalState } =
    contract.initialState(createConstructorContext(privateState, "0".repeat(64)));
  const ctx: CircuitContext<EnkuPrivateState> = {
    currentPrivateState,
    currentZswapLocalState,
    costModel: CostModel.initialCostModel(),
    currentQueryContext: new QueryContext(currentContractState.data, sampleContractAddress()),
  };
  return { contract, ctx };
}

/** attest(claimed, tolerance, validity) sobre libros dados; devuelve {ledger, ctx, contract}. */
function attest(
  assets: bigint[],
  liabilities: bigint[],
  opts: { nonce?: Uint8Array; claimed?: bigint; tolerance?: bigint; validity?: bigint } = {},
) {
  const { contract, ctx } = makeContext({
    assets,
    liabilities,
    nonce: opts.nonce ?? NONCE,
  });
  const next = contract.impureCircuits.attest(
    ctx,
    opts.claimed ?? 0n,
    opts.tolerance ?? 3600n,
    opts.validity ?? 300n,
  );
  return { contract, ctx: next.context, ledger: ledger(next.context.currentQueryContext.state) };
}

// ── Runner minimo ──────────────────────────────────────────────────────────────

let failures = 0;
const ok = (name: string) => console.log(`  OK   ${name}`);
const fail = (name: string, why: string) => { failures++; console.log(`  FAIL ${name} — ${why}`); };

function expect(name: string, got: unknown, want: unknown) {
  Object.is(got, want) ? ok(name) : fail(name, `dio ${got}, esperaba ${want}`);
}
function expectThrows(name: string, fn: () => void, fragment: string) {
  try {
    fn();
    fail(name, `no lanzo (esperaba "${fragment}")`);
  } catch (e: any) {
    const msg = e?.message ?? String(e);
    msg.includes(fragment) ? ok(name) : fail(name, `lanzo "${msg}" (esperaba "${fragment}")`);
  }
}

console.log("\n  Circuito attest — veredicto\n");

const solvente = attest(SOLVENT_ASSETS, SOLVENT_LIABS);
expect("activos > pasivos produce SOLVENTE", solvente.ledger.verdict, true);

const insolvente = attest(SOLVENT_LIABS, SOLVENT_ASSETS);
expect("pasivos > activos produce NO SOLVENTE", insolvente.ledger.verdict, false);

const exacto = attest(SOLVENT_ASSETS, SOLVENT_ASSETS);
expect("caso borde: activos exactamente iguales a pasivos es SOLVENTE", exacto.ledger.verdict, true);

const unCentavo = attest(SOLVENT_ASSETS, [...SOLVENT_ASSETS.slice(0, 7), SOLVENT_ASSETS[7] + 1n]);
expect("un solo centavo de pasivo de mas rompe el veredicto", unCentavo.ledger.verdict, false);

console.log("\n  Circuito attest — privacidad\n");

for (const [name, r] of [["solvente", solvente], ["insolvente", insolvente]] as const) {
  const publicState = JSON.stringify(r.ledger, (_, v) =>
    typeof v === "bigint" ? v.toString() : v instanceof Uint8Array ? Array.from(v).join(",") : v,
  );
  const leaked = [...SOLVENT_ASSETS, ...SOLVENT_LIABS]
    .filter((x) => x !== 0n)
    .some((x) => publicState.includes(x.toString()));
  expect(`ningun balance aparece en el estado publico (${name})`, leaked, false);
}

console.log("\n  Circuito attest — commitment\n");

const mismosLibros = attest(SOLVENT_ASSETS, SOLVENT_LIABS);
expect(
  "mismos libros + mismo nonce dan el mismo commitment (determinista)",
  Buffer.from(mismosLibros.ledger.balancesCommitment).toString("hex"),
  Buffer.from(solvente.ledger.balancesCommitment).toString("hex"),
);

const librosEditados = attest([...SOLVENT_ASSETS.slice(0, 7), 999_00n], SOLVENT_LIABS);
expect(
  "editar un solo item cambia el commitment (la prueba esta atada a los numeros)",
  Buffer.from(librosEditados.ledger.balancesCommitment).toString("hex") ===
    Buffer.from(solvente.ledger.balancesCommitment).toString("hex"),
  false,
);

const otroNonce = attest(SOLVENT_ASSETS, SOLVENT_LIABS, { nonce: NONCE_B });
expect(
  "mismos libros con otro nonce dan otro commitment (no hay fuerza bruta)",
  Buffer.from(otroNonce.ledger.balancesCommitment).toString("hex") ===
    Buffer.from(solvente.ledger.balancesCommitment).toString("hex"),
  false,
);

console.log("\n  Circuito attest — anclaje temporal\n");

expectThrows(
  "un timestamp del futuro es rechazado (no se puede posdatar)",
  () => attest(SOLVENT_ASSETS, SOLVENT_LIABS, { claimed: 999_999n }),
  "attest timestamp is in the future",
);

expect(
  "validUntil queda fijado en claimed + validez",
  attest(SOLVENT_ASSETS, SOLVENT_LIABS, { validity: 120n }).ledger.validUntil,
  120n,
);

console.log("\n  Circuito settle — la cadena decide\n");

{
  const r = attest(SOLVENT_ASSETS, SOLVENT_LIABS, { validity: 300n });
  try {
    r.contract.impureCircuits.settle(r.ctx);
    ok("certificado solvente y vigente es aceptado");
  } catch (e: any) {
    fail("certificado solvente y vigente es aceptado", e?.message ?? String(e));
  }
}

expectThrows(
  "certificado NO SOLVENTE es rechazado aunque este vigente",
  () => {
    const r = attest(SOLVENT_LIABS, SOLVENT_ASSETS, { validity: 300n });
    r.contract.impureCircuits.settle(r.ctx);
  },
  "certificate is not solvent",
);

expectThrows(
  "certificado con ventana agotada es rechazado por vencido",
  () => {
    // validity 0: validUntil == claimed == blockTime -> blockTimeLt(0) es falso.
    const r = attest(SOLVENT_ASSETS, SOLVENT_LIABS, { validity: 0n });
    r.contract.impureCircuits.settle(r.ctx);
  },
  "certificate has expired",
);

console.log(`\n  ${failures === 0 ? "Suite verde" : `${failures} fallas`}\n`);
process.exit(failures === 0 ? 0 : 1);
