// Suite del circuito Asfalia — corre en el simulador de compact-runtime,
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
import { Contract, ledger } from "../contracts/managed/asfalia/contract/index.js";
import { witnesses, type ClientAccount, type AsfaliaPrivateState } from "../src/witnesses.js";
import { buildTree, inclusionProof, verifyInclusion, merkleRoot } from "../src/merkle.js";

const NONCE = new Uint8Array(32).fill(7);
const OWNER_SECRET = new Uint8Array(32).fill(201);
const OTHER_SECRET = new Uint8Array(32).fill(202);

const ASSETS = [500_00n, 1200_00n, 90_00n, 0n, 3000_00n, 45_00n, 800_00n, 10_00n]; // 5645,00
const bytes = (fill: number) => new Uint8Array(32).fill(fill);

/** 16 clientes de juguete; el saldo total se controla por parametro. */
function makeClients(balances: bigint[]): ClientAccount[] {
  if (balances.length !== 16) throw new Error("16 saldos");
  return balances.map((balance, i) => ({ id: bytes(i + 1), balance, salt: bytes(100 + i) }));
}
const SOLVENT_CLIENTS = makeClients([
  300_00n, 200_00n, 100_00n, 50_00n, 400_00n, 25_00n, 75_00n, 10_00n,
  120_00n, 80_00n, 60_00n, 40_00n, 90_00n, 30_00n, 20_00n, 5_00n,
]); // total 1605,00 < activos
const INSOLVENT_CLIENTS = makeClients([
  3000_00n, 2000_00n, 1000_00n, 500_00n, 400_00n, 250_00n, 750_00n, 100_00n,
  1200_00n, 800_00n, 600_00n, 400_00n, 900_00n, 300_00n, 200_00n, 50_00n,
]); // total 12450,00 > activos

function attest(
  assets: bigint[],
  clients: ClientAccount[],
  opts: {
    claimed?: bigint;
    ownerSecret?: Uint8Array;
    tolerance?: bigint;
    validity?: bigint;
  } = {},
) {
  const contract = new Contract<AsfaliaPrivateState>(witnesses);
  const privateState: AsfaliaPrivateState = { assets, assetsNonce: NONCE, clients };
  const { currentPrivateState, currentContractState, currentZswapLocalState } =
    contract.initialState(
      createConstructorContext(privateState, "0".repeat(64)),
      OWNER_SECRET,
      opts.tolerance ?? 3600n,
      opts.validity ?? 300n,
    );
  const ctx: CircuitContext<AsfaliaPrivateState> = {
    currentPrivateState,
    currentZswapLocalState,
    costModel: CostModel.initialCostModel(),
    currentQueryContext: new QueryContext(currentContractState.data, sampleContractAddress()),
  };
  const next = contract.impureCircuits.attest(
    ctx,
    opts.ownerSecret ?? OWNER_SECRET,
    opts.claimed ?? 0n,
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
const hex = (b: Uint8Array) => Buffer.from(b).toString("hex");

console.log("\n  Circuito attest — veredicto\n");

const solvente = attest(ASSETS, SOLVENT_CLIENTS);
expect("activos > pasivos produce SOLVENTE", solvente.ledger.verdict, true);

const insolvente = attest(ASSETS, INSOLVENT_CLIENTS);
expect("pasivos > activos produce NO SOLVENTE", insolvente.ledger.verdict, false);

{
  // activos = 5645,00 exactos repartidos en 16 cuentas
  const exacto = attest(ASSETS, makeClients([
    1000_00n, 1000_00n, 1000_00n, 1000_00n, 500_00n, 500_00n, 300_00n, 100_00n,
    100_00n, 50_00n, 40_00n, 30_00n, 15_00n, 5_00n, 4_00n, 1_00n,
  ]));
  expect("caso borde: pasivos exactamente iguales a activos es SOLVENTE", exacto.ledger.verdict, true);

  const unCentavo = attest(ASSETS, makeClients([
    1000_00n, 1000_00n, 1000_00n, 1000_00n, 500_00n, 500_00n, 300_00n, 100_00n,
    100_00n, 50_00n, 40_00n, 30_00n, 15_00n, 5_00n, 4_00n, 1_01n,
  ]));
  expect("un solo centavo de pasivo de mas rompe el veredicto", unCentavo.ledger.verdict, false);
}

console.log("\n  Circuito attest — privacidad\n");

for (const [name, r, clients] of [
  ["solvente", solvente, SOLVENT_CLIENTS],
  ["insolvente", insolvente, INSOLVENT_CLIENTS],
] as const) {
  const publicState = JSON.stringify(r.ledger, (_, v) =>
    typeof v === "bigint" ? v.toString() : v instanceof Uint8Array ? hex(v) : v,
  );
  const leaked = [...ASSETS, ...clients.map((c) => c.balance)]
    .filter((x) => x !== 0n)
    .some((x) => publicState.includes(x.toString()));
  expect(`ningun saldo aparece en el estado publico (${name})`, leaked, false);
}

console.log("\n  Arbol Merkle de pasivos\n");

{
  const onChainRoot = hex(solvente.ledger.liabilitiesRoot);
  const jsRoot = await merkleRoot(SOLVENT_CLIENTS);
  expect("la raiz del circuito y la del servidor coinciden (mismo hash)", jsRoot, onChainRoot);

  const proof = await inclusionProof(SOLVENT_CLIENTS, 5, "cuenta-5");
  expect(
    "una cuenta real verifica su inclusion contra la raiz on-chain",
    await verifyInclusion(proof.leafHex, proof.path, onChainRoot),
    true,
  );
  expect("el camino de inclusion tiene log2(16) = 4 hermanos", proof.path.length, 4);

  // La entidad esconde la cuenta 5 (la reemplaza por otra) y re-attesta:
  const hidden = [...SOLVENT_CLIENTS];
  hidden[5] = { id: bytes(99), balance: 1_00n, salt: bytes(199) };
  const reAttested = attest(ASSETS, hidden);
  expect(
    "si la entidad esconde la cuenta, la verificacion del cliente FALLA",
    await verifyInclusion(proof.leafHex, proof.path, hex(reAttested.ledger.liabilitiesRoot)),
    false,
  );

  // La entidad miente el saldo del cliente (deflacion de pasivos):
  const lied = [...SOLVENT_CLIENTS];
  lied[5] = { ...lied[5], balance: 1n };
  const liedAttest = attest(ASSETS, lied);
  expect(
    "si la entidad miente el saldo del cliente, la verificacion FALLA",
    await verifyInclusion(proof.leafHex, proof.path, hex(liedAttest.ledger.liabilitiesRoot)),
    false,
  );

  const tree = await buildTree(SOLVENT_CLIENTS);
  const publicState = JSON.stringify(solvente.ledger, (_, v) =>
    typeof v === "bigint" ? v.toString() : v instanceof Uint8Array ? hex(v) : v,
  );
  const siblingLeaks = tree[0].some((leaf, i) => i !== 15 && publicState.includes(hex(leaf)));
  expect("las hojas individuales no aparecen en el estado publico", siblingLeaks, false);
}

console.log("\n  Circuito attest — commitment de activos y anclaje temporal\n");

{
  const mismos = attest(ASSETS, SOLVENT_CLIENTS);
  expect(
    "mismos libros + mismo nonce dan el mismo commitment (determinista)",
    hex(mismos.ledger.assetsCommitment),
    hex(solvente.ledger.assetsCommitment),
  );
  const editado = attest([...ASSETS.slice(0, 7), 999_00n], SOLVENT_CLIENTS);
  expect(
    "editar un activo cambia el commitment (la prueba esta atada a los numeros)",
    hex(editado.ledger.assetsCommitment) === hex(solvente.ledger.assetsCommitment),
    false,
  );
}

expectThrows(
  "una clave distinta no puede reemplazar el certificado",
  () => attest(ASSETS, SOLVENT_CLIENTS, { ownerSecret: OTHER_SECRET }),
  "only the Asfalia owner can attest",
);

expectThrows(
  "un timestamp del futuro es rechazado (no se puede posdatar)",
  () => attest(ASSETS, SOLVENT_CLIENTS, { claimed: 999_999n }),
  "attest timestamp is in the future",
);

expect(
  "validUntil usa la validez fijada al desplegar",
  attest(ASSETS, SOLVENT_CLIENTS, { validity: 120n }).ledger.validUntil,
  120n,
);

expectThrows(
  "el constructor rechaza una tolerancia nula",
  () => attest(ASSETS, SOLVENT_CLIENTS, { tolerance: 0n }),
  "attest tolerance must be positive",
);

expectThrows(
  "el constructor rechaza una vigencia mayor a 31 dias",
  () => attest(ASSETS, SOLVENT_CLIENTS, { validity: 2_678_401n }),
  "certificate validity exceeds 31 days",
);

console.log("\n  Circuito settle — la cadena decide\n");

{
  const r = attest(ASSETS, SOLVENT_CLIENTS, { validity: 300n });
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
    const r = attest(ASSETS, INSOLVENT_CLIENTS, { validity: 300n });
    r.contract.impureCircuits.settle(r.ctx);
  },
  "certificate is not solvent",
);

expectThrows(
  "el constructor no permite certificados ya vencidos",
  () => attest(ASSETS, SOLVENT_CLIENTS, { validity: 0n }),
  "certificate validity must be positive",
);

console.log(`\n  ${failures === 0 ? "Suite verde" : `${failures} fallas`}\n`);
process.exit(failures === 0 ? 0 : 1);
