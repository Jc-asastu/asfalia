import { useState } from 'react';
import { fmtCents, getInclusion, postVerifyInclusion, type InclusionResponse } from './api';
import { useI18n } from './i18n';

/** Portal del cliente: la tercera pata del sistema. Un cliente del exchange
 *  verifica que SU saldo esta contado dentro de los pasivos declarados —
 *  contra la raiz on-chain, sin ver el saldo de nadie mas. */
export function Portal({ accounts }: { accounts: { account: string; name: string }[] }) {
  const { t } = useI18n();
  const [selected, setSelected] = useState('');
  const [proof, setProof] = useState<InclusionResponse | null>(null);
  const [verdict, setVerdict] = useState<{ verified: boolean; reason?: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const run = async (account: string) => {
    setSelected(account);
    setProof(null);
    setVerdict(null);
    if (!account) return;
    setBusy(true);
    try {
      const p = await getInclusion(account);
      setProof(p);
      const v = await postVerifyInclusion(p.leafHex, p.path);
      setVerdict(v);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="portal">
      <div className="private-banner">
        <span aria-hidden="true">◆</span>
        {t.portal_banner}
      </div>

      <section className="portal-card">
        <h3>{t.portal_title}</h3>
        <p className="portal-lead">{t.portal_lead}</p>

        <label className="portal-label" htmlFor="account">{t.account}</label>
        <select id="account" data-tour="account" value={selected} onChange={(e) => run(e.target.value)}>
          <option value="">{t.choose_account}</option>
          {accounts.map((a) => (
            <option key={a.account} value={a.account}>
              {a.account} — {a.name}
            </option>
          ))}
        </select>

        {busy && <p className="portal-busy">{t.portal_busy}</p>}

        {proof && verdict && (
          <div className={`portal-result ${verdict.verified ? 'ok' : 'bad'}`} aria-live="polite">
            <div className="portal-verdict">
              {verdict.verified
                ? t.included
                : `${t.not_verified}${
                    verdict.reason === 'no_attest' ? ` — ${t.no_attest_reason}` : t.not_verified_reason_root
                  }`}
            </div>
            <dl className="portal-detail">
              <div><dt>{t.holder}</dt><dd>{proof.name}</dd></div>
              <div><dt>{t.own_balance}</dt><dd>{fmtCents(proof.cents)} USD</dd></div>
              <div><dt>{t.leaf}</dt><dd>{proof.leafHex.slice(0, 34)}…</dd></div>
              <div><dt>{t.path}</dt><dd>{t.siblings(proof.path.length)}</dd></div>
              <div><dt>{t.reconstructed_root}</dt><dd>{proof.rootHex.slice(0, 34)}…</dd></div>
            </dl>
            <p className="portal-note">{t.portal_note}</p>
          </div>
        )}
      </section>
    </div>
  );
}
