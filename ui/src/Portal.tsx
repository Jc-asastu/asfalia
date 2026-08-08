import { useState } from 'react';
import { fmtCents, getInclusion, type InclusionResponse } from './api';
import { useI18n } from './i18n';
import { verifyInclusionLocally, type LocalInclusionVerdict } from './verify-inclusion';

/** Portal del cliente: la tercera pata del sistema. Un cliente del exchange
 *  verifica que SU saldo esta contado dentro de los pasivos declarados —
 *  contra la raiz on-chain, sin ver el saldo de nadie mas. */
export function Portal({
  onChainRoot,
  tokenRequired,
}: {
  onChainRoot: string | null;
  tokenRequired: boolean;
}) {
  const { t } = useI18n();
  const [account, setAccount] = useState('');
  const [expectedAmount, setExpectedAmount] = useState('');
  const [accessToken, setAccessToken] = useState('');
  const [proof, setProof] = useState<InclusionResponse | null>(null);
  const [verdict, setVerdict] = useState<LocalInclusionVerdict | null>(null);
  const [checkedCents, setCheckedCents] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const run = async () => {
    setProof(null);
    setVerdict(null);
    setCheckedCents('');
    setError('');
    if (!account.trim() || !expectedAmount.trim()) return;
    setBusy(true);
    try {
      const normalizedAccount = account.trim();
      const amount = expectedAmount.trim().replace(',', '.');
      if (!/^[0-9]+(\.[0-9]{1,2})?$/.test(amount)) {
        throw new Error(t.invalid_expected_balance);
      }
      const [whole, fraction = ''] = amount.split('.');
      const cents = `${whole}${fraction.padEnd(2, '0')}`.replace(/^0+(?=\d)/, '');
      if (BigInt(cents) > (1n << 64n) - 1n) throw new Error(t.invalid_expected_balance);

      const p = await getInclusion(normalizedAccount, accessToken.trim());
      if (p.account !== normalizedAccount) throw new Error(t.account_mismatch);
      setProof(p);
      setCheckedCents(cents);
      setVerdict(await verifyInclusionLocally(p, cents, onChainRoot));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
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

        <form onSubmit={(event) => { event.preventDefault(); void run(); }}>
          <label className="portal-label" htmlFor="account">{t.account}</label>
          <input
            id="account"
            data-tour="account"
            value={account}
            onChange={(event) => setAccount(event.target.value)}
            placeholder={t.choose_account}
            autoComplete="username"
          />
          <label className="portal-label" htmlFor="expected-balance">{t.expected_balance}</label>
          <input
            id="expected-balance"
            inputMode="decimal"
            value={expectedAmount}
            onChange={(event) => setExpectedAmount(event.target.value)}
            placeholder="0.00"
          />
          {tokenRequired && (
            <>
              <label className="portal-label" htmlFor="client-token">{t.client_access_code}</label>
              <input
                id="client-token"
                type="password"
                value={accessToken}
                onChange={(event) => setAccessToken(event.target.value)}
                autoComplete="current-password"
              />
            </>
          )}
          <button
            className="attest-btn"
            type="submit"
            disabled={busy || !account.trim() || !expectedAmount.trim()}
          >
            {t.verify_inclusion}
          </button>
        </form>

        {busy && <p className="portal-busy">{t.portal_busy}</p>}
        {error && <p className="portal-busy" role="alert">{error}</p>}

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
              <div><dt>{t.holder}</dt><dd>{proof.account}</dd></div>
              <div><dt>{t.own_balance}</dt><dd>{fmtCents(checkedCents)} USD</dd></div>
              <div><dt>{t.leaf}</dt><dd>{verdict.leafHex.slice(0, 34)}…</dd></div>
              <div><dt>{t.path}</dt><dd>{t.siblings(proof.path.length)}</dd></div>
              <div><dt>{t.reconstructed_root}</dt><dd>{verdict.rootHex.slice(0, 34)}…</dd></div>
            </dl>
            <p className="portal-note">{t.portal_note}</p>
          </div>
        )}
      </section>
    </div>
  );
}
