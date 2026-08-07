/**
 * Attest one-shot: carga el libro privado, genera la prueba ZK contra el
 * proof server y publica veredicto + timestamp + commitment. Sin menu:
 * un comando, un resultado — pensado para el demo y para la API.
 */
import { connectEnku } from './contract';
import { loadEntityBook } from './entity-data';

const t0 = Date.now();
const book = loadEntityBook();
console.log(`\n  Enku attest — ${book.entity}`);
console.log('  Los balances no salen de esta maquina. Viaja la prueba.\n');

const conn = await connectEnku((m) => console.log(`  … ${m}`));

console.log('  Generando prueba ZK (proof server)…');
const tProve = Date.now();
const { txId, blockHeight } = await conn.attest();
console.log(`  Prueba + tx en ${((Date.now() - tProve) / 1000).toFixed(1)}s`);

const ledger = await conn.readLedger();
console.log('\n  ── Estado publico on-chain ──────────────────────────');
console.log(`  Veredicto:   ${ledger?.verdict ? 'SOLVENTE' : 'NO SOLVENTE'}`);
console.log(`  Attest:      ${new Date(Number(ledger?.attestedAt)).toISOString()}`);
console.log(`  Commitment:  ${ledger?.balancesCommitment.slice(0, 32)}…`);
console.log(`  Tx:          ${txId} (block ${blockHeight})`);
console.log(`\n  Total: ${((Date.now() - t0) / 1000).toFixed(1)}s\n`);

await conn.close();
process.exit(0);
