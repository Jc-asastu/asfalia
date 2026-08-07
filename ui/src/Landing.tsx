import { lazy, Suspense, useEffect, useState } from 'react';
import { getHistory, type ServerState } from './api';
import { useI18n } from './i18n';

const GoldField = lazy(() => import('./GoldField'));

/** La puerta: hero con el campo de oro y UNA entrada — el portal público.
 *  La entidad no entra por acá: su consola es un programa local 24/7
 *  (link a la guía, nada más). Los balances no tienen puerta web. */
export function Landing({
  state,
  onEnter,
}: {
  state: ServerState | null;
  onEnter: () => void;
}) {
  const { t } = useI18n();
  const [emissions, setEmissions] = useState<number | null>(null);

  useEffect(() => {
    getHistory()
      .then((h) => setEmissions(h.entries.filter((e) => e.ok).length))
      .catch(() => {});
  }, []);

  const ledger = state?.ledger ?? null;
  const hasAttest = ledger && Number(ledger.attestedAt) > 0;
  const fresh = hasAttest && Number(ledger!.validUntil) > (state?.now ?? 0);

  return (
    <main className="landing">
      <Suspense fallback={null}>
        <GoldField />
      </Suspense>

      <section className="hero">
        <div className="hero-kicker">{t.landing_kicker}</div>
        <h2 className="hero-title">ASFALIA</h2>
        <p className="hero-tagline">{t.landing_tagline}</p>
        <p className="hero-sub">{t.landing_sub}</p>

        <div className="live-strip" aria-live="polite">
          <span className="live-item">
            <i className={`live-dot ${fresh ? 'ok' : 'off'}`} />
            {state ? `${t.network}: ${state.network}` : t.connecting}
          </span>
          {hasAttest && (
            <span className="live-item">
              {ledger!.verdict ? t.solvent : t.not_solvent} ·{' '}
              {fresh ? t.landing_live_fresh : t.landing_live_expired}
            </span>
          )}
          {emissions !== null && (
            <span className="live-item">{t.landing_emissions(emissions)}</span>
          )}
        </div>

        <button className="attest-btn hero-cta" onClick={onEnter}>
          {t.landing_enter} →
        </button>
      </section>

      <section className="entity-note">
        <p>
          {t.landing_entity_note}{' '}
          <a
            href="https://github.com/Jc-asastu/asfalia/blob/main/docs/deployment.md"
            target="_blank"
            rel="noreferrer"
          >
            {t.landing_link_guide}
          </a>
          {' · '}
          <a href="https://github.com/Jc-asastu/asfalia" target="_blank" rel="noreferrer">
            {t.landing_link_repo}
          </a>
        </p>
      </section>

      <footer className="landing-foot">
        <span>
          {t.contract}{' '}
          <a href="https://explorer.preview.midnight.network/" target="_blank" rel="noreferrer">
            {state ? `${state.contractAddress.slice(0, 20)}…` : '…'}
          </a>{' '}
          · Midnight Preview · Apache 2.0
        </span>
      </footer>
    </main>
  );
}
