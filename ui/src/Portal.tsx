import { useState } from 'react';
import { fmtCents, getInclusion, postVerifyInclusion, type InclusionResponse } from './api';

/** Portal del cliente: la tercera pata del sistema. Un cliente del exchange
 *  verifica que SU saldo esta contado dentro de los pasivos declarados —
 *  contra la raiz on-chain, sin ver el saldo de nadie mas. */
export function Portal({ accounts }: { accounts: { account: string; name: string }[] }) {
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
        Vista del cliente — solo ve su propia cuenta y hashes de hermanos, jamás otro saldo
      </div>

      <section className="portal-card">
        <h3>Verificación de inclusión</h3>
        <p className="portal-lead">
          ¿Mi saldo está contado dentro de los pasivos que la entidad declaró? La respuesta
          no la da la entidad: la da el árbol contra la raíz publicada en cadena.
        </p>

        <label className="portal-label" htmlFor="account">Cuenta</label>
        <select id="account" value={selected} onChange={(e) => run(e.target.value)}>
          <option value="">Elegir cuenta…</option>
          {accounts.map((a) => (
            <option key={a.account} value={a.account}>
              {a.account} — {a.name}
            </option>
          ))}
        </select>

        {busy && <p className="portal-busy">Reconstruyendo el camino hasta la raíz…</p>}

        {proof && verdict && (
          <div className={`portal-result ${verdict.verified ? 'ok' : 'bad'}`} aria-live="polite">
            <div className="portal-verdict">
              {verdict.verified
                ? '✓ Tu saldo está incluido en los pasivos declarados'
                : `✕ No se pudo verificar${verdict.reason ? ` — ${verdict.reason}` : ': la raíz no coincide con la cadena'}`}
            </div>
            <dl className="portal-detail">
              <div><dt>Titular</dt><dd>{proof.name}</dd></div>
              <div><dt>Saldo propio</dt><dd>{fmtCents(proof.cents)} USD</dd></div>
              <div><dt>Hoja (hash de tu cuenta)</dt><dd>{proof.leafHex.slice(0, 34)}…</dd></div>
              <div><dt>Camino de verificación</dt><dd>{proof.path.length} hermanos — solo hashes</dd></div>
              <div><dt>Raíz reconstruida</dt><dd>{proof.rootHex.slice(0, 34)}…</dd></div>
            </dl>
            <p className="portal-note">
              La raíz reconstruida desde tu hoja se comparó contra la raíz Merkle publicada
              on-chain por el attest. Si la entidad omitiera tu cuenta —o mintiera tu saldo—
              este camino no cerraría.
            </p>
          </div>
        )}
      </section>
    </div>
  );
}
