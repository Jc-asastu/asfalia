import { useEffect, useState } from 'react';
import { fmtCents, getBook, postAttest, putBook, type Book, type ServerState } from './api';

/** Back-office de la entidad. Este libro vive SOLO en esta maquina:
 *  el server que lo sirve es local. A la cadena viaja la prueba. */
export function Treasury({ state }: { state: ServerState | null }) {
  const [book, setBook] = useState<Book | null>(null);
  const [editing, setEditing] = useState<{ side: 'assets' | 'liabilities'; index: number } | null>(null);
  const [draft, setDraft] = useState('');
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => { getBook().then(setBook); }, []);

  const job = state?.attest;
  useEffect(() => {
    if (!job?.running || !job.startedAt) return;
    const t = setInterval(() => setElapsed((Date.now() - job.startedAt!) / 1000), 250);
    return () => clearInterval(t);
  }, [job?.running, job?.startedAt]);

  if (!book) return <p>Cargando libro…</p>;

  const sum = (xs: { cents: string }[]) => xs.reduce((a, x) => a + BigInt(x.cents), 0n);
  const totalA = sum(book.assets);
  const totalL = sum(book.liabilities);
  const covered = totalA >= totalL;
  const ratio = totalL > 0n ? Number((totalA * 10000n) / totalL) / 100 : 0;

  const startEdit = (side: 'assets' | 'liabilities', index: number, cents: string) => {
    setEditing({ side, index });
    setDraft((BigInt(cents) / 100n).toString());
  };
  const commitEdit = async () => {
    if (!editing || !/^\d+$/.test(draft)) return setEditing(null);
    const cents = `${draft}00`;
    const r = await putBook(editing.side, editing.index, cents);
    if (r.book) setBook(r.book);
    setEditing(null);
  };

  const Ledger = ({ side, title, items }: { side: 'assets' | 'liabilities'; title: string; items: Book['assets'] }) => (
    <section className="ledger-block">
      <h3>{title}</h3>
      <table>
        <tbody>
          {items.map((it, i) => (
            <tr key={it.label}>
              <td>{it.label}</td>
              <td className="amount">
                {editing?.side === side && editing.index === i ? (
                  <input
                    autoFocus
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onBlur={commitEdit}
                    onKeyDown={(e) => e.key === 'Enter' && commitEdit()}
                    aria-label={`Editar ${it.label} (USD, sin centavos)`}
                  />
                ) : (
                  <button onClick={() => startEdit(side, i, it.cents)} title="Editar importe">
                    {fmtCents(it.cents)}
                  </button>
                )}
              </td>
            </tr>
          ))}
          <tr className="total">
            <td>Total</td>
            <td className="amount">{fmtCents(sum(items).toString())}</td>
          </tr>
        </tbody>
      </table>
    </section>
  );

  return (
    <>
      <div className="private-banner">
        <span aria-hidden="true">◆</span>
        Libro privado — este documento vive únicamente en la máquina de la entidad
      </div>

      <div className="treasury">
        <div>
          <div className="ledger-tables">
            <Ledger side="assets" title="Activos" items={book.assets} />
            <Ledger side="liabilities" title="Pasivos" items={book.liabilities} />
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
        </div>

        <aside className="action-rail">
          <button
            className="attest-btn"
            disabled={job?.running ?? false}
            onClick={() => postAttest()}
          >
            {job?.running ? 'Generando prueba…' : 'Generar attestación'}
          </button>

          <div className="job-status" aria-live="polite">
            {job?.running ? (
              <>
                <div className="timer">{elapsed.toFixed(0)}s</div>
                <div className="phase">{job.phase}</div>
              </>
            ) : job?.error ? (
              <div className="err">{job.error}</div>
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
            La attestación genera una <strong>prueba de conocimiento cero</strong> sobre
            este libro y publica únicamente el veredicto, el momento y un compromiso
            criptográfico. Los importes no participan de ninguna transmisión.
          </p>
        </aside>
      </div>
    </>
  );
}
