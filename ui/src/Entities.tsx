import { useState } from 'react';
import type { ServerState } from './api';
import { useI18n } from './i18n';

/** El registro: las entidades que attestan con Asfalia. Hoy una; el diseño
 *  es la lista. Elegís la entidad y recién ahí decís quién sos:
 *  ¿cliente de ella, o auditor/contraparte? */
export function Entities({
  state,
  now,
  onPick,
}: {
  state: ServerState | null;
  now: number;
  onPick: (subrole: 'client' | 'auditor') => void;
}) {
  const { t } = useI18n();
  const [selected, setSelected] = useState(false);

  const ledger = state?.ledger ?? null;
  const hasAttest = ledger && Number(ledger.attestedAt) > 0;
  const remaining = hasAttest ? Math.max(0, Number(ledger!.validUntil) - now) : 0;
  const fresh = remaining > 0;
  const mmss = (s: number) =>
    `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

  return (
    <main className="entities">
      <h2 className="entities-title">{t.entities_title}</h2>
      <p className="entities-lead">{t.entities_lead}</p>

      <div className="entity-list" data-tour="entity-list">
        <button
          className={`entity-row ${selected ? 'selected' : ''}`}
          onClick={() => setSelected(true)}
          aria-expanded={selected}
        >
          <div className="entity-row-main">
            <span className="entity-name">{state?.entity ?? '…'}</span>
            <span className="entity-contract">
              {t.contract} {state ? `${state.contractAddress.slice(0, 22)}…` : ''}
            </span>
          </div>
          <div className="entity-row-status">
            {hasAttest ? (
              <>
                <span className={`chip ${ledger!.verdict ? 'ok' : 'bad'}`}>
                  {ledger!.verdict ? t.solvent : t.not_solvent}
                </span>
                <span className={`entity-fresh ${fresh ? 'ok' : 'bad'}`}>
                  {fresh ? t.entities_expires(mmss(remaining)) : t.landing_live_expired}
                </span>
              </>
            ) : (
              <span className="chip">{t.not_attested}</span>
            )}
          </div>
        </button>

        <div className="entity-row placeholder" aria-hidden="true">
          <span className="entity-name dim">{t.entities_placeholder}</span>
        </div>
      </div>

      {selected && (
        <div className="subrole-ask" data-tour="subrole" aria-live="polite">
          <p className="subrole-q">{t.entities_whoare}</p>
          <div className="subrole-btns">
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
          </div>
        </div>
      )}
    </main>
  );
}
