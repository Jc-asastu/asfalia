import { useState } from 'react';
import { getInclusion, type InclusionResponse } from './api';
import { verifyInclusionLocally, type LocalInclusionVerdict } from './verify-inclusion';
import { useI18n } from './i18n';

/** Portal del cliente: la tercera pata del sistema.
 *
 *  Lo que cambia respecto de la version anterior no es cosmetico. Antes el
 *  cliente le mandaba la hoja al servidor de la ENTIDAD y el servidor
 *  contestaba "verificado": el cliente le preguntaba al auditado si el
 *  auditado decia la verdad.
 *
 *  Ahora la entidad entrega el salt y los hermanos, el cliente escribe el
 *  saldo que cree tener, y ESTE navegador reconstruye la hoja con los mismos
 *  circuitos puros del contrato y la compara contra la raiz on-chain. La
 *  entidad no participa del calculo, asi que no puede mentir en el.
 */
export function Portal({
  accounts,
  onChainRoot,
  tokenRequired,
}: {
  accounts: { account: string; name: string }[];
  onChainRoot: string | null;
  tokenRequired: boolean;
}) {
  const { t } = useI18n();
  const [account, setAccount] = useState('');
  const [amount, setAmount] = useState('');
  const [token, setToken] = useState('');
  const [proof, setProof] = useState<InclusionResponse | null>(null);
  const [verdict, setVerdict] = useState<LocalInclusionVerdict | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  /** "1.234,50" / "1234.5" -> centavos. El cliente escribe como quiere. */
  const toCents = (raw: string): string | null => {
    const normalized = raw.trim().replace(/\s/g, '').replace(/\.(?=\d{3}\b)/g, '').replace(',', '.');
    if (!/^\d+(\.\d{1,2})?$/.test(normalized)) return null;
    const [whole, frac = ''] = normalized.split('.');
    return `${whole}${frac.padEnd(2, '0')}`;
  };

  const run = async () => {
    setProof(null);
    setVerdict(null);
    setError(null);
    const cents = toCents(amount);
    if (!account || cents === null) {
      setError(t.own_balance_hint);
      return;
    }
    setBusy(true);
    try {
      const p = await getInclusion(account, token.trim() || undefined);
      setProof(p);
      setVerdict(await verifyInclusionLocally(p, cents, onChainRoot));
    } catch (e: any) {
      setError(e?.message ?? String(e));
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
        {accounts.length > 0 ? (
          <select id="account" data-tour="account" value={account} onChange={(e) => setAccount(e.target.value)}>
            <option value="">{t.choose_account}</option>
            {accounts.map((a) => (
              <option key={a.account} value={a.account}>
                {a.account} — {a.name}
              </option>
            ))}
          </select>
        ) : (
          <input
            id="account"
            data-tour="account"
            value={account}
            onChange={(e) => setAccount(e.target.value)}
            placeholder="AX-2026-0001"
          />
        )}

        <label className="portal-label" htmlFor="amount">{t.own_balance_input}</label>
        <input
          id="amount"
          inputMode="decimal"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="5.935.828,61"
        />
        <p className="portal-hint">{t.own_balance_hint}</p>

        {tokenRequired && (
          <>
            <label className="portal-label" htmlFor="token">{t.access_token}</label>
            <input id="token" type="password" value={token} onChange={(e) => setToken(e.target.value)} />
            <p className="portal-hint">{t.access_token_hint}</p>
          </>
        )}

        <button className="portal-verify" onClick={run} disabled={busy}>
          {busy ? t.portal_busy : t.verify_btn}
        </button>

        {error && <p className="portal-error" aria-live="polite">{error}</p>}

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
              <div><dt>{t.account}</dt><dd>{proof.account}</dd></div>
              <div><dt>{t.leaf}</dt><dd>{verdict.leafHex.slice(0, 34)}…</dd></div>
              <div><dt>{t.path}</dt><dd>{t.siblings(proof.path.length)}</dd></div>
              <div><dt>{t.reconstructed_root}</dt><dd>{verdict.rootHex.slice(0, 34)}…</dd></div>
            </dl>
            <p className="portal-note">{t.portal_note}</p>
            <p className="portal-note">{t.verify_local_note}</p>
          </div>
        )}
      </section>
    </div>
  );
}
