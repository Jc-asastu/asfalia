import { useEffect, useRef, useState } from 'react';
import { fmtCents, getBook, importCsv, postAttest, putBook, type Book, type ServerState } from './api';
import { useI18n, phaseText } from './i18n';

/** Back-office de la entidad. Estos libros viven SOLO en esta maquina:
 *  el server que los sirve es local. A la cadena viaja la prueba. */
export function Treasury({ state }: { state: ServerState | null }) {
  const { t } = useI18n();
  const [book, setBook] = useState<Book | null>(null);
  const [editing, setEditing] = useState<{ side: 'assets' | 'clients'; index: number } | null>(null);
  const [draft, setDraft] = useState('');
  const [elapsed, setElapsed] = useState(0);
  const [importMsg, setImportMsg] = useState<string | null>(null);
  const msgTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => { if (msgTimer.current) clearTimeout(msgTimer.current); }, []);

  const showMsg = (m: string) => {
    setImportMsg(m);
    if (msgTimer.current) clearTimeout(msgTimer.current);
    msgTimer.current = setTimeout(() => setImportMsg(null), 8000);
  };

  const doImport = (kind: 'assets' | 'clients') => (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    file
      .text()
      .then(async (csv) => {
        const r = await importCsv(kind, csv);
        if (r.error) showMsg(`✕ ${r.error}`);
        else { setBook(r.book); showMsg(`✓ ${t.import_ok}`); }
      })
      .catch((err) => showMsg(`✕ ${err?.message ?? err}`));
  };

  // Los libros se refrescan solos: la pantalla siempre refleja el estado real
  // de la maquina (editar sin polling dejaba vistas viejas en otras pantallas).
  // No pisa una edicion en curso.
  useEffect(() => {
    const load = () => { if (!editing) getBook().then(setBook).catch(() => {}); };
    load();
    const i = setInterval(load, 4000);
    return () => clearInterval(i);
  }, [editing]);

  const job = state?.attest;
  useEffect(() => {
    if (!job?.running || !job.startedAt) return;
    const tm = setInterval(() => setElapsed((Date.now() - job.startedAt!) / 1000), 250);
    return () => clearInterval(tm);
  }, [job?.running, job?.startedAt]);

  if (!book) return <p>{t.loading_books}</p>;

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
        aria-label={`${t.edit_amount}: ${label}`}
      />
    ) : (
      <button onClick={() => startEdit(side, i, cents)} title={t.edit_amount}>
        {fmtCents(cents)}
      </button>
    );

  return (
    <>
      <div className="private-banner">
        <span aria-hidden="true">◆</span>
        {t.private_banner}
      </div>

      <div className="treasury">
        <div className="ledger-tables">
          <section className="ledger-block">
            <h3>{t.assets}</h3>
            <table>
              <tbody>
                {book.assets.map((it, i) => (
                  <tr key={it.label}>
                    <td>{it.label}</td>
                    <td className="amount">{amountCell('assets', i, it.cents, it.label)}</td>
                  </tr>
                ))}
                <tr className="total">
                  <td>{t.total}</td>
                  <td className="amount">{fmtCents(totalA.toString())}</td>
                </tr>
              </tbody>
            </table>
          </section>

          <section className="ledger-block">
            <h3>{t.liabilities}</h3>
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
                  <td>{t.total}</td>
                  <td className="amount">{fmtCents(totalL.toString())}</td>
                </tr>
              </tbody>
            </table>
          </section>

          <div className="coverage">
            <span>
              {t.coverage}{' '}
              <span className={`ratio ${covered ? 'ok' : 'bad'}`}>{ratio.toFixed(2)}%</span>
            </span>
            <span>
              {t.position}{' '}
              <span className={`ratio ${covered ? 'ok' : 'bad'}`}>
                {covered ? t.covered : t.uncovered}
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
            {job?.running && job.kind === 'attest' ? t.attest_btn_busy : t.attest_btn}
          </button>

          <div className="job-status" aria-live="polite">
            {job?.running ? (
              <>
                <div className="timer">{elapsed.toFixed(0)}s</div>
                <div className="phase">{phaseText(t, job.phase)}</div>
              </>
            ) : job?.error ? (
              <div className="err">
                {phaseText(t, job.phase)}: {job.error.slice(0, 120)}
              </div>
            ) : job?.txId ? (
              <>
                <div className="phase">
                  {phaseText(t, job.phase)} — {job.durationSec?.toFixed(1)}s
                </div>
                <div className="txid">tx {job.txId}</div>
              </>
            ) : (
              <div>{t.no_attest_yet}</div>
            )}
          </div>

          <div className="import-box">
            <span className="import-title">{t.import_title}</span>
            <div className="import-btns">
              <label className="reveal-btn import-btn">
                {t.import_assets}
                <input type="file" accept=".csv,text/csv" onChange={doImport('assets')} hidden />
              </label>
              <label className="reveal-btn import-btn">
                {t.import_clients}
                <input type="file" accept=".csv,text/csv" onChange={doImport('clients')} hidden />
              </label>
            </div>
            {importMsg && <div className="import-msg" aria-live="polite">{importMsg}</div>}
            <span className="import-note">{t.import_note}</span>
          </div>

          <p className="action-note">
            {t.action_note_1}
            <strong>{t.action_note_zk}</strong>
            {t.action_note_2}
            <strong>{t.action_note_root}</strong>
            {t.action_note_3}
          </p>
        </aside>
      </div>
    </>
  );
}
