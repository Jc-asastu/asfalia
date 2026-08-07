import { useEffect, useRef, useState } from 'react';
import { postSettle, type ServerState } from './api';
import { useI18n, phaseText, dateLocale } from './i18n';

type Freshness = 'none' | 'valid' | 'grace' | 'expired';

/** La vista del auditor: un acta. Veredicto, vigencia, commitments. Nada mas existe. */
export function Certificate({ state, now }: { state: ServerState | null; now: number }) {
  const { t, lang } = useI18n();
  const [reveal, setReveal] = useState(false);
  const [thump, setThump] = useState(false);
  const lastAttest = useRef<string | null>(null);

  const ledger = state?.ledger ?? null;
  const attestedAt = ledger ? Number(ledger.attestedAt) : 0;
  const hasAttest = attestedAt > 0;
  // La vigencia viene DE LA CADENA: validUntil lo fija el circuito en el attest
  // y el mismo circuito la hace cumplir en el settlement.
  const validUntil = ledger ? Number(ledger.validUntil) : 0;
  const windowSec = hasAttest ? validUntil - attestedAt : 0;
  const remaining = hasAttest ? Math.max(0, validUntil - now) : 0;

  const freshness: Freshness = !hasAttest
    ? 'none'
    : remaining === 0
      ? 'expired'
      : remaining <= 60
        ? 'grace'
        : 'valid';

  // El sello golpea cuando entra un attest nuevo.
  useEffect(() => {
    if (!ledger) return;
    if (lastAttest.current && lastAttest.current !== ledger.attestedAt) {
      setThump(true);
      const tm = setTimeout(() => setThump(false), 600);
      return () => clearTimeout(tm);
    }
    lastAttest.current = ledger.attestedAt;
  }, [ledger?.attestedAt]);

  const mmss = (s: number) =>
    `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

  const freshLabel: Record<Freshness, [string, string]> = {
    none: ['—', ''],
    valid: [t.valid_until(mmss(remaining)), 'valid'],
    grace: [t.grace_until(mmss(remaining)), 'grace'],
    expired: [t.expired_line, 'expired'],
  };

  const job = state?.attest;

  return (
    <>
      <article className="certificate" aria-live="polite">
        <span className="corner tl" /><span className="corner tr" />
        <span className="corner bl" /><span className="corner br" />

        <div className="cert-head">
          <div>
            <div className="kicker">{t.kicker}</div>
            <h2>{t.record_title}</h2>
            <p className="entity">
              {t.attesting_entity} <strong>{state?.entity ?? '…'}</strong>
            </p>
          </div>
          <Seal />
        </div>

        <p className="declaration">{t.declaration}</p>

        <div className="stamp-zone">
          {!hasAttest ? (
            <span className="stamp none">{t.not_attested}</span>
          ) : (
            <span className={`stamp ${ledger!.verdict ? 'valid' : 'invalid'} ${thump ? 'thump' : ''}`}>
              {ledger!.verdict ? t.solvent : t.not_solvent}
            </span>
          )}
          {freshness === 'expired' && <span className="overstamp">{t.expired_stamp}</span>}
        </div>

        <dl className="clauses">
          <div className="clause">
            <dt>{t.attested_at}</dt>
            <dd>
              {hasAttest
                ? new Date(attestedAt * 1000).toLocaleString(dateLocale(lang), { hour12: false })
                : '—'}
            </dd>
          </div>
          <div className="clause">
            <dt>{t.validity(mmss(windowSec))}</dt>
            <dd className={freshLabel[freshness][1]}>{freshLabel[freshness][0]}</dd>
          </div>
          <div className="clause">
            <dt>{t.assets_commitment}</dt>
            <dd>{ledger ? `${ledger.assetsCommitment.slice(0, 34)}…` : '—'}</dd>
          </div>
          <div className="clause">
            <dt>{t.liabilities_root}</dt>
            <dd>{ledger ? `${ledger.liabilitiesRoot.slice(0, 34)}…` : '—'}</dd>
          </div>
          <div className="clause">
            <dt>{t.last_tx}</dt>
            <dd>{job?.txId ? `${job.txId.slice(0, 34)}…` : '—'}</dd>
          </div>
        </dl>
        {hasAttest && windowSec > 0 && (
          <div className={`validity-bar ${freshness}`}>
            <div style={{ width: `${(remaining / windowSec) * 100}%` }} />
          </div>
        )}

        <div className="cert-foot">
          <span className="verified">{t.verified_line}</span>
          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              className="reveal-btn"
              disabled={!hasAttest || (job?.running ?? false)}
              onClick={() => postSettle()}
              title={t.accept_cert_hint}
            >
              {t.accept_cert}
            </button>
            <button className="reveal-btn" onClick={() => setReveal((r) => !r)}>
              {t.reveal}
            </button>
          </div>
        </div>

        {job?.kind === 'settle' && (
          <div className="settle-strip" aria-live="polite">
            {job.running ? (
              <span>{t.settle_checking}</span>
            ) : job.error ? (
              <span className="rejected">
                ✕ {phaseText(t, job.phase)}{t.settle_rejected_suffix}
              </span>
            ) : job.txId ? (
              <span className="accepted">
                ✓ {phaseText(t, job.phase)} — {t.settle_tx} {job.txId.slice(0, 22)}…
              </span>
            ) : null}
          </div>
        )}
      </article>

      {reveal && (
        <div className="reveal-panel" role="status">
          <div className="empty-mark">∅</div>
          <p>
            <strong>{t.reveal_title}</strong>
            {t.reveal_body}
          </p>
        </div>
      )}
    </>
  );
}

/** Sello seco de Asfalia: anillos concentricos y leyenda. SVG puro, sin assets. */
function Seal() {
  return (
    <svg width="92" height="92" viewBox="0 0 100 100" aria-hidden="true">
      <defs>
        <path id="ring" d="M 50,50 m -37,0 a 37,37 0 1,1 74,0 a 37,37 0 1,1 -74,0" />
      </defs>
      <circle cx="50" cy="50" r="47" fill="none" stroke="#8a7535" strokeWidth="1.4" />
      <circle cx="50" cy="50" r="44" fill="none" stroke="#8a7535" strokeWidth="0.5" />
      <circle cx="50" cy="50" r="28" fill="none" stroke="#8a7535" strokeWidth="0.8" />
      <text fontSize="8.2" letterSpacing="2.6" fill="#8a7535" fontFamily="IBM Plex Mono, monospace">
        <textPath href="#ring">PROOF OF SOLVENCY · THAT EXPIRES ·</textPath>
      </text>
      <text x="50" y="54" textAnchor="middle" fontSize="9.5" letterSpacing="1.4"
        fill="#c4a84f" fontFamily="Spectral, serif" fontWeight="700">
        ASFALIA
      </text>
    </svg>
  );
}
