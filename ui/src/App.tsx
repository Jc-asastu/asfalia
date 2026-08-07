import { useEffect, useRef, useState } from 'react';
import { getState, getBook, type ServerState } from './api';
import { Certificate } from './Certificate';
import { Treasury } from './Treasury';
import { Portal } from './Portal';
import { History } from './History';
import { Scanner } from './Scanner';
import { I18nProvider, useI18n, type Lang } from './i18n';
import { Landing } from './Landing';

export function App() {
  return (
    <I18nProvider>
      <Shell />
    </I18nProvider>
  );
}

/** Tres roles, tres recortes de la misma verdad. La separacion ES el producto:
 *  - entidad: consola local (los libros viven aca) — Tesoreria + Historial
 *  - auditor: lectura publica de la cadena — Certificado + Historial + Scanner
 *  - cliente: su cuenta y nada mas — Portal
 *  En produccion son tres despliegues; en el demo, un selector. */
type Role = 'entity' | 'auditor' | 'client';
type View = 'treasury' | 'auditor' | 'portal' | 'history' | 'scanner';

const ROLE_VIEWS: Record<Role, View[]> = {
  entity: ['treasury', 'history'],
  auditor: ['auditor', 'history', 'scanner'],
  client: ['portal'],
};

function Shell() {
  const { t, lang, setLang } = useI18n();
  const [role, setRole] = useState<Role | null>(
    () => (localStorage.getItem('asfalia-role') as Role) || null,
  );
  const [view, setView] = useState<View>('treasury');
  const [accounts, setAccounts] = useState<{ account: string; name: string }[]>([]);
  const [state, setState] = useState<ServerState | null>(null);
  // Reloj: segundos epoch del server + tick local entre polls.
  const [now, setNow] = useState(() => Math.floor(Date.now() / 1000));
  const offset = useRef(0);

  useEffect(() => {
    let alive = true;
    const poll = async () => {
      try {
        const s = await getState();
        if (!alive) return;
        offset.current = s.now - Math.floor(Date.now() / 1000);
        setState(s);
      } catch { /* server reiniciando: el proximo poll lo levanta */ }
    };
    poll();
    getBook().then((b) => setAccounts(b.users.map(({ account, name }) => ({ account, name }))));
    const p = setInterval(poll, 2000);
    const tk = setInterval(() => setNow(Math.floor(Date.now() / 1000) + offset.current), 1000);
    return () => { alive = false; clearInterval(p); clearInterval(tk); };
  }, []);

  const pickRole = (r: Role) => {
    localStorage.setItem('asfalia-role', r);
    setRole(r);
    setView(ROLE_VIEWS[r][0]);
  };
  const clearRole = () => {
    localStorage.removeItem('asfalia-role');
    setRole(null);
  };

  const langBtn = (l: Lang, label: string) => (
    <button
      className={`lang-btn ${lang === l ? 'active' : ''}`}
      onClick={() => setLang(l)}
      aria-pressed={lang === l}
    >
      {label}
    </button>
  );

  const TAB_LABEL: Record<View, string> = {
    treasury: t.tab_treasury,
    auditor: t.tab_auditor,
    portal: t.tab_portal,
    history: t.tab_history,
    scanner: t.tab_scanner,
  };

  const views = role ? ROLE_VIEWS[role] : [];
  const activeView = views.includes(view) ? view : views[0];

  return (
    <>
      <header className="masthead">
        <h1>
          ASFALIA
          <small>{t.subtitle}</small>
        </h1>
        <div className="mast-right">
          <div className="lang-switch">
            {langBtn('en', 'EN')}·{langBtn('es', 'ES')}
            {role && (
              <button className="lang-btn role-change" onClick={clearRole}>
                {t.role_change}
              </button>
            )}
          </div>
          <div className="file-no">
            {state ? (
              <>
                {t.network}: {state.network}
                <br />
                {t.contract} {state.contractAddress.slice(0, 20)}…
              </>
            ) : (
              t.connecting
            )}
          </div>
        </div>
      </header>

      {!role ? (
        <Landing state={state} onPick={pickRole} />
      ) : (
        <>
          <nav className="tabs" role="tablist">
            {views.map((v) => (
              <button
                key={v}
                role="tab"
                aria-selected={activeView === v}
                onClick={() => setView(v)}
              >
                {TAB_LABEL[v]}
              </button>
            ))}
          </nav>

          <main className="tabpanel">
            {activeView === 'auditor' ? (
              <Certificate state={state} now={now} />
            ) : activeView === 'portal' ? (
              <Portal accounts={accounts} />
            ) : activeView === 'history' ? (
              <History state={state} now={now} />
            ) : activeView === 'scanner' ? (
              <Scanner />
            ) : (
              <Treasury state={state} />
            )}
          </main>
        </>
      )}
    </>
  );
}
