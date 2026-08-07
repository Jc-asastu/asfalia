import { useEffect, useState } from 'react';
import { fmtCents, getBook, postAttest, putBook, type Book, type ServerState } from './api';

/** Back-office de la entidad. Estos libros viven SOLO en esta maquina:
 *  el server que los sirve es local. A la cadena viaja la prueba. */
export function Treasury({ state }: { state: ServerState | null }) {
  const [book, setBook] = useState<Book | null>(null);
  const [editing, setEditing] = useState<{ side: 'assets' | 'clients'; index: number } | null>(null);
  const [draft, setDraft] = useState('');
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => { getBook().then(setBook); }, []);

  const job = state?.attest;
  useEffect(() => {
    if (!job?.running || !job.startedAt) return;
    const t = setInterval(() => setElapsed((Date.now() - job.startedAt!) / 1000), 250);
    return () => clearInterval(t);
  }, [job?.running, job?.startedAt]);

  if (!book) return <p>Cargando libros…</p>;

  const sum = (xs: { cents: string }[]) => xs.reduce((a, x) => a + BigInt(x.cents), 0n);
  const totalA = sum(book.assets);
  const totalL = sum(book.users);
  const covered = totalA >= totalL;
  const ratio = totalL > 0n ? Number((totalA * 10000n) / totalL) / 100 : 0;

  const startEdit = (side: 'assets' | 'clients', index: number, cents: string) => {
    setEditing({ side, index });
    setDraft((BigInt(cents) / 100n).toString());
  };
  const commitEdit = async () => {
    if (!editing || !/^\d+$/.test(draft)) return setEditing(null);
    const r = await putBook(editing.side, editing.index, `${draft}00`);
    if (r.book) setBook(r.book);
    setEditing(null);
  };

  const amountCell = (side: 'assets' | 'clients', i: number, cents: string, label: string) =>
    editing?.side === side && editing.index === i ? (
      <input
        autoFocus
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commitEdit}
        onKeyDown={(e) => e.key === 'Enter' && commitEdit()}
        aria-label={`Editar ${label} (USD, sin centavos)`}
      />
    ) : (
      <button onClick={() => startEdit(side, i, cents)} title="Editar importe">
        {fmtCents(cents)}
      </button>
    );

  return (
    <>
      <div className="private-banner">
        <span aria-hidden="true">◆</span>
        Libros privados — viven únicamente en la máquina de la entidad
      </div>

      <div className="treasury">
        <div className="ledger-tables">
          <section className="ledger-block">
            <h3>Activos</h3>
            <table>
              <tbody>
                {book.assets.map((it, i) => (
                  <tr key={it.label}>
                    <td>{it.label}</td>
                    <td className="amount">{amountCell('assets', i, it.cents, it.label)}</td>
                  </tr>
                ))}
                <tr className="total">
                  <td>Total</td>
                  <td className="amount">{fmtCents(totalA.toString())}</td>
                </tr>
              </tbody>
            </table>
          </section>

          <section className="ledger-block">
            <h3>Pasivos — cuentas de clientes ({book.users.length})</h3>
            <table>
              <tbody>
                {book.users.map((u, i) => (
                  <tr key={u.account}>
                    <td>
                      <span className="acct">{u.account}</span> {u.name}
                    </td>
                    <td className="amount">{amountCell('clients', i, u.cents, u.account)}</td>
                  </tr>
                ))}
                <tr className="total">
                  <td>Total</td>
                  <td className="amount">{fmtCents(totalL.toString())}</td>
                </tr>
              </tbody>
            </table>
          </section>

          <div className="coverage">
            <span>
              Cobertura de pasivos:{' '}
              <span className={`ratio ${covered ? 'ok' : 'bad'}`}>{ratio.toFixed(2)}%</span>
            </span>
            <span>
              Posición: <span className={`ratio ${covered ? 'ok' : 'bad'}`}>
                {covered ? 'cubierta' : 'descubierta'}
              </span>
            </span>
          </div>
        </div>

        <aside className="action-rail">
          <button
            className="attest-btn"
            disabled={job?.running ?? false}
            onClick={() => postAttest()}
          >
            {job?.running && job.kind === 'attest' ? 'Generando prueba…' : 'Generar attestación'}
          </button>

          <div className="job-status" aria-live="polite">
            {job?.running ? (
              <>
                <div className="timer">{elapsed.toFixed(0)}s</div>
                <div className="phase">{job.phase}</div>
              </>
            ) : job?.error ? (
              <div className="err">{job.phase}: {job.error.slice(0, 120)}</div>
            ) : job?.txId ? (
              <>
                <div className="phase">
                  {job.phase} — {job.durationSec?.toFixed(1)}s
                </div>
                <div className="txid">tx {job.txId}</div>
              </>
            ) : (
              <div>Sin attestaciones en esta sesión.</div>
            )}
          </div>

          <p className="action-note">
            La attestación genera una <strong>prueba de conocimiento cero</strong> sobre estos
            libros y publica únicamente el veredicto, los tiempos, el compromiso de activos y
            la <strong>raíz Merkle</strong> de las cuentas. Los importes no participan de
            ninguna transmisión — y ningún cliente puede quedar afuera del árbol sin que su
            verificación falle.
          </p>
        </aside>
      </div>
    </>
  );
}
