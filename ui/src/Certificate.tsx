import { useEffect, useRef, useState } from 'react';
import { postSettle, type ServerState } from './api';

type Freshness = 'none' | 'valid' | 'grace' | 'expired';

/** La vista del auditor: un acta. Veredicto, vigencia, commitment. Nada mas existe. */
export function Certificate({ state, now }: { state: ServerState | null; now: number }) {
  const [reveal, setReveal] = useState(false);
  const [thump, setThump] = useState(false);
  const lastAttest = useRef<string | null>(null);

  const ledger = state?.ledger ?? null;
  const attestedAt = ledger ? Number(ledger.attestedAt) : 0;
  const hasAttest = attestedAt > 0;
  // La vigencia viene DE LA CADENA: validUntil lo fijo el circuito en el attest
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
      const t = setTimeout(() => setThump(false), 600);
      return () => clearTimeout(t);
    }
    lastAttest.current = ledger.attestedAt;
  }, [ledger?.attestedAt]);

  const mmss = (s: number) =>
    `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

  const freshLabel: Record<Freshness, [string, string]> = {
    none: ['—', ''],
    valid: [`VIGENTE — vence en ${mmss(remaining)}`, 'valid'],
    grace: [`EN GRACIA — vence en ${mmss(remaining)}`, 'grace'],
    expired: ['VENCIDO — el veredicto ya no es aceptable', 'expired'],
  };

  return (
    <>
      <article className="certificate" aria-live="polite">
        <span className="corner tl" /><span className="corner tr" />
        <span className="corner bl" /><span className="corner br" />

        <div className="cert-head">
          <div>
            <div className="kicker">Certificado de solvencia · prueba de conocimiento cero</div>
            <h2>Acta de attestación</h2>
            <p className="entity">
              Entidad que acredita: <strong>{state?.entity ?? '…'}</strong>
            </p>
          </div>
          <Seal />
        </div>

        <p className="declaration">
          La entidad acredita que la totalidad de sus activos cubre la totalidad de sus
          pasivos, sin exhibir importe, composición ni contraparte alguna.
        </p>

        <div className="stamp-zone">
          {!hasAttest ? (
            <span className="stamp none">SIN ATTESTACIÓN</span>
          ) : (
            <span className={`stamp ${ledger!.verdict ? 'valid' : 'invalid'} ${thump ? 'thump' : ''}`}>
              {ledger!.verdict ? 'Solvente' : 'No solvente'}
            </span>
          )}
          {freshness === 'expired' && <span className="overstamp">Vencido</span>}
        </div>

        <dl className="clauses">
          <div className="clause">
            <dt>Atestado</dt>
            <dd>{hasAttest ? new Date(attestedAt * 1000).toLocaleString('es-AR', { hour12: false }) : '—'}</dd>
          </div>
          <div className="clause">
            <dt>Vigencia (ventana {mmss(windowSec)} fijada en cadena)</dt>
            <dd className={freshLabel[freshness][1]}>{freshLabel[freshness][0]}</dd>
          </div>
          <div className="clause">
            <dt>Compromiso sobre activos</dt>
            <dd>{ledger ? `${ledger.assetsCommitment.slice(0, 34)}…` : '—'}</dd>
          </div>
          <div className="clause">
            <dt>Raíz Merkle de pasivos (cuentas)</dt>
            <dd>{ledger ? `${ledger.liabilitiesRoot.slice(0, 34)}…` : '—'}</dd>
          </div>
          <div className="clause">
            <dt>Última transacción</dt>
            <dd>{state?.attest.txId ? `${state.attest.txId.slice(0, 34)}…` : '—'}</dd>
          </div>
        </dl>
        {hasAttest && windowSec > 0 && (
          <div className={`validity-bar ${freshness}`}>
            <div style={{ width: `${(remaining / windowSec) * 100}%` }} />
          </div>
        )}

        <div className="cert-foot">
          <span className="verified">Verificado en cadena — cualquiera verifica, nadie ve</span>
          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              className="reveal-btn"
              disabled={!hasAttest || (state?.attest.running ?? false)}
              onClick={() => postSettle()}
              title="La cadena solo acepta un certificado solvente y vigente"
            >
              Aceptar certificado
            </button>
            <button className="reveal-btn" onClick={() => setReveal((r) => !r)}>
              Revelar datos
            </button>
          </div>
        </div>

        {state?.attest.kind === 'settle' && (
          <div className="settle-strip" aria-live="polite">
            {state.attest.running ? (
              <span>Verificando en cadena…</span>
            ) : state.attest.error ? (
              <span className="rejected">✕ {state.attest.phase} — la transacción no entró al bloque</span>
            ) : state.attest.txId ? (
              <span className="accepted">✓ {state.attest.phase} — tx {state.attest.txId.slice(0, 22)}…</span>
            ) : null}
          </div>
        )}
      </article>

      {reveal && (
        <div className="reveal-panel" role="status">
          <div className="empty-mark">∅</div>
          <p>
            <strong>No hay datos que revelar.</strong> Los balances nunca salieron de la
            máquina de la entidad. Lo que viajó por la cadena es una prueba criptográfica,
            no un número.
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
      <circle cx="50" cy="50" r="47" fill="none" stroke="#5a6472" strokeWidth="1.4" />
      <circle cx="50" cy="50" r="44" fill="none" stroke="#5a6472" strokeWidth="0.5" />
      <circle cx="50" cy="50" r="28" fill="none" stroke="#5a6472" strokeWidth="0.8" />
      <text fontSize="8.2" letterSpacing="2.6" fill="#5a6472" fontFamily="Public Sans, sans-serif">
        <textPath href="#ring">PROOF OF SOLVENCY · THAT EXPIRES ·</textPath>
      </text>
      <text x="50" y="54" textAnchor="middle" fontSize="9.5" letterSpacing="1.4"
        fill="#5a6472" fontFamily="Spectral, serif" fontWeight="700">
        ASFALIA
      </text>
    </svg>
  );
}
