import { Fragment, useEffect, useState } from 'react';
import { getScan, type ScanResponse } from './api';
import { useI18n, dateLocale } from './i18n';

/** El scanner de la cadena: cabeza en vivo + cada emision del contrato
 *  resuelta contra el INDEXER (hash real, bloque, timestamp). Los datos
 *  vienen de la cadena, no de nuestro log — el log solo aporta el veredicto. */
export function Scanner() {
  const { t, lang } = useI18n();
  const [data, setData] = useState<ScanResponse | null>(null);
  const [open, setOpen] = useState<string | null>(null);

  useEffect(() => {
    const load = () => getScan().then(setData).catch(() => {});
    load();
    const i = setInterval(load, 6000);
    return () => clearInterval(i);
  }, []);

  if (!data) return <p>{t.loading_books}</p>;

  const fmtTime = (ms: number) =>
    new Date(ms).toLocaleString(dateLocale(lang), { hour12: false });

  return (
    <div className="scanner">
      <div className="scan-head">
        <div className="scan-head-item">
          <span className="scan-label">{t.scan_head}</span>
          <span className="scan-value big">#{data.head?.height ?? '—'}</span>
        </div>
        <div className="scan-head-item">
          <span className="scan-label">{t.scan_head_hash}</span>
          <span className="scan-value">{data.head ? `${data.head.hash.slice(0, 26)}…` : '—'}</span>
        </div>
        <div className="scan-head-item">
          <span className="scan-label">{t.scan_head_time}</span>
          <span className="scan-value">{data.head ? fmtTime(data.head.timestamp) : '—'}</span>
        </div>
        <div className="scan-head-item">
          <span className="scan-label">{t.scan_contract}</span>
          <span className="scan-value">{data.contractAddress.slice(0, 26)}…</span>
        </div>
      </div>

      <section className="scan-card">
        <h3>{t.scan_title}</h3>
        <p className="portal-lead">{t.scan_lead}</p>

        <table className="scan-table" data-tour="scantable">
          <thead>
            <tr>
              <th>{t.scan_block}</th>
              <th>{t.scan_time}</th>
              <th>{t.scan_txhash}</th>
              <th>{t.scan_verdict}</th>
            </tr>
          </thead>
          <tbody>
            {data.rows.map((r) => (
              <Fragment key={r.identifier}>
                <tr
                  className={`scan-row ${open === r.identifier ? 'open' : ''}`}
                  onClick={() => setOpen(open === r.identifier ? null : r.identifier)}
                >
                  <td className="mono">#{r.block.height}</td>
                  <td>{fmtTime(r.block.timestamp)}</td>
                  <td className="mono">{r.hash.slice(0, 22)}…</td>
                  <td>
                    <span className={`chip ${r.verdict ? 'ok' : 'bad'}`}>
                      {r.verdict ? t.solvent : t.not_solvent}
                    </span>
                  </td>
                </tr>
                {open === r.identifier && (
                  <tr className="scan-detail-row" key={`${r.identifier}-d`}>
                    <td colSpan={4}>
                      <dl className="portal-detail">
                        <div><dt>{t.scan_txhash}</dt><dd>{r.hash}</dd></div>
                        <div><dt>{t.scan_identifier}</dt><dd>{r.identifier}</dd></div>
                        <div><dt>{t.scan_blockhash}</dt><dd>{r.block.hash}</dd></div>
                        <div><dt>{t.hist_trigger}</dt><dd>{r.trigger === 'heartbeat' ? t.hist_auto : t.hist_manual}</dd></div>
                      </dl>
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
            {data.rows.length === 0 && (
              <tr><td colSpan={4} className="scan-empty">{t.scan_empty}</td></tr>
            )}
          </tbody>
        </table>
      </section>
    </div>
  );
}
