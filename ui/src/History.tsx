import { useEffect, useState } from 'react';
import { getChain, getHistory, type ChainAction, type HistoryResponse, type LogEntry, type ServerState } from './api';
import { useI18n, dateLocale } from './i18n';

type Cell = { kind: 'attest'; entry: LogEntry } | { kind: 'gap'; from: number; to: number };

/** Historial de emisiones: el latido hecho visible. Verde = solvente,
 *  rojo = insolvente, ORO = la entidad eligio no probar en ese periodo.
 *  Cada celda con attest apunta a su tx on-chain. */
export function History({ state, now }: { state: ServerState | null; now: number }) {
  const { t, lang } = useI18n();
  const [data, setData] = useState<HistoryResponse | null>(null);
  const [chain, setChain] = useState<ChainAction | null>(null);
  const [selected, setSelected] = useState<Cell | null>(null);

  useEffect(() => {
    const load = () => {
      getHistory().then(setData).catch(() => {});
      getChain().then(setChain).catch(() => {});
    };
    load();
    const i = setInterval(load, 5000);
    return () => clearInterval(i);
  }, []);

  if (!data) return <p>{t.loading_books}</p>;

  const hb = data.heartbeatSec;
  const entries = data.entries;

  // Celdas: con heartbeat, la linea de tiempo se divide en periodos y los
  // periodos sin emision son huecos. Sin heartbeat, solo las emisiones.
  const cells: Cell[] = [];
  if (hb && entries.length > 0) {
    const start = entries[0].ts;
    const step = hb * 1000;
    let idx = 0;
    for (let p = start; p < now * 1000; p += step) {
      const inPeriod: LogEntry[] = [];
      while (idx < entries.length && entries[idx].ts < p + step) inPeriod.push(entries[idx++]);
      if (inPeriod.length === 0) cells.push({ kind: 'gap', from: p, to: p + step });
      else for (const e of inPeriod) cells.push({ kind: 'attest', entry: e });
    }
  } else {
    for (const e of entries) cells.push({ kind: 'attest', entry: e });
  }

  const nextIn = state?.heartbeat?.nextAt ? Math.max(0, state.heartbeat.nextAt - now) : null;
  const fmtTime = (ms: number) =>
    new Date(ms).toLocaleString(dateLocale(lang), { hour12: false });

  const cellClass = (c: Cell) =>
    c.kind === 'gap'
      ? 'hist-cell gap'
      : !c.entry.ok
        ? 'hist-cell failed'
        : c.entry.verdict
          ? 'hist-cell ok'
          : 'hist-cell bad';

  const cellTitle = (c: Cell) =>
    c.kind === 'gap'
      ? `${t.hist_gap} · ${fmtTime(c.from)}`
      : `${fmtTime(c.entry.ts)} · ${c.entry.ok ? (c.entry.verdict ? t.solvent : t.not_solvent) : t.hist_failed}`;

  return (
    <div className="history">
      <div className="private-banner">
        <span aria-hidden="true">◆</span>
        {t.hist_banner}
      </div>

      <section className="hist-card">
        <div className="hist-head">
          <h3>{t.hist_title}</h3>
          {hb ? (
            <div className="hist-beat">
              <span className="pulse" aria-hidden="true" />
              {t.hist_beating(hb)}{nextIn !== null ? ` · ${t.hist_next(nextIn)}` : ''}
            </div>
          ) : (
            <div className="hist-beat off">{t.hist_off}</div>
          )}
        </div>

        <div className="hist-grid" role="list" data-tour="grid">
          {cells.map((c, i) => (
            <button
              key={i}
              role="listitem"
              className={`${cellClass(c)} ${selected === c ? 'selected' : ''}`}
              title={cellTitle(c)}
              aria-label={cellTitle(c)}
              onClick={() => setSelected(c)}
            />
          ))}
        </div>

        {chain?.data?.contractAction && (
          <div className="chain-row" data-tour="chainrow">
            <span className="chain-label">{t.chain_label}</span>
            <span className="chain-data">
              {chain.data.contractAction.__typename} · tx{' '}
              {chain.data.contractAction.transaction.hash.slice(0, 18)}… ·{' '}
              {t.chain_block} {chain.data.contractAction.transaction.block.height} ·{' '}
              {fmtTime(chain.data.contractAction.transaction.block.timestamp)}
            </span>
          </div>
        )}

        <div className="hist-legend">
          <span><i className="sw ok" /> {t.solvent}</span>
          <span><i className="sw bad" /> {t.not_solvent}</span>
          <span><i className="sw gap" /> {t.hist_gap_legend}</span>
        </div>

        {selected && (
          <div className="hist-detail" aria-live="polite">
            {selected.kind === 'gap' ? (
              <>
                <div className="hist-detail-verdict gap-text">{t.hist_gap}</div>
                <p className="portal-note">{t.hist_gap_note}</p>
                <dl className="portal-detail">
                  <div><dt>{t.hist_period}</dt><dd>{fmtTime(selected.from)} — {fmtTime(selected.to)}</dd></div>
                </dl>
              </>
            ) : (
              <>
                <div className={`hist-detail-verdict ${selected.entry.verdict ? 'ok-text' : 'bad-text'}`}>
                  {selected.entry.ok
                    ? selected.entry.verdict ? t.solvent : t.not_solvent
                    : t.hist_failed}
                </div>
                <dl className="portal-detail">
                  <div><dt>{t.hist_emitted}</dt><dd>{fmtTime(selected.entry.ts)}</dd></div>
                  <div><dt>{t.hist_trigger}</dt><dd>{selected.entry.trigger === 'heartbeat' ? t.hist_auto : t.hist_manual}</dd></div>
                  {selected.entry.txId && (
                    <div><dt>tx</dt><dd>{selected.entry.txId.slice(0, 34)}…</dd></div>
                  )}
                  {selected.entry.liabilitiesRoot && (
                    <div><dt>{t.liabilities_root}</dt><dd>{selected.entry.liabilitiesRoot.slice(0, 34)}…</dd></div>
                  )}
                  {selected.entry.durationSec != null && (
                    <div><dt>{t.hist_duration}</dt><dd>{selected.entry.durationSec.toFixed(1)}s</dd></div>
                  )}
                </dl>
              </>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
