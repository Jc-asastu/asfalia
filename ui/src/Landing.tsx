import { lazy, Suspense, useEffect, useState } from 'react';
import { getHistory, type ServerState } from './api';
import { useI18n } from './i18n';

const GoldField = lazy(() => import('./GoldField'));

type Role = 'entity' | 'auditor' | 'client';

/** La puerta de entrada: hero con el campo de oro, la cadena en vivo,
 *  y tres puertas — cada rol entra solo a lo que le corresponde. */
export function Landing({
  state,
  onPick,
}: {
  state: ServerState | null;
  onPick: (r: Role) => void;
}) {
  const { t } = useI18n();
  const [emissions, setEmissions] = useState<number | null>(null);
  const [entityOpen, setEntityOpen] = useState(false);

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
      </section>

      <section className="role-cards">
        <div className={`role-card entity ${entityOpen ? 'open' : ''}`}>
          <button className="role-card-main" onClick={() => setEntityOpen((o) => !o)}>
            <span className="role-name">{t.role_entity}</span>
            <span className="role-desc">{t.role_entity_desc}</span>
            <span className="role-cta">{t.landing_entity_cta} ↓</span>
          </button>
          {entityOpen && (
            <div className="entity-panel">
              <p className="entity-panel-lead">{t.landing_entity_lead}</p>
              <pre className="entity-cmds"><code>{`git clone https://github.com/Jc-asastu/asfalia
cd asfalia && npm install
npm run compile
docker compose up -d proof-server
npm run network preview && npm run setup
npm run dashboard`}</code></pre>
              <div className="entity-links">
                <a href="https://github.com/Jc-asastu/asfalia" target="_blank" rel="noreferrer">
                  {t.landing_link_repo}
                </a>
                <a
                  href="https://github.com/Jc-asastu/asfalia/blob/main/docs/deployment.md"
                  target="_blank"
                  rel="noreferrer"
                >
                  {t.landing_link_guide}
                </a>
                <button className="reveal-btn" onClick={() => onPick('entity')}>
                  {t.landing_entity_demo}
                </button>
              </div>
            </div>
          )}
        </div>

        <button className="role-card" onClick={() => onPick('auditor')}>
          <span className="role-name">{t.role_auditor}</span>
          <span className="role-desc">{t.role_auditor_desc}</span>
          <span className="role-cta">{t.landing_auditor_cta} →</span>
        </button>

        <button className="role-card" onClick={() => onPick('client')}>
          <span className="role-name">{t.role_client}</span>
          <span className="role-desc">{t.role_client_desc}</span>
          <span className="role-cta">{t.landing_client_cta} →</span>
        </button>
      </section>

      <footer className="landing-foot">
        <span>
          {t.contract}{' '}
          <a
            href={`https://explorer.preview.midnight.network/`}
            target="_blank"
            rel="noreferrer"
          >
            {state ? `${state.contractAddress.slice(0, 20)}…` : '…'}
          </a>{' '}
          · Midnight Preview · Apache 2.0
        </span>
      </footer>
    </main>
  );
}
