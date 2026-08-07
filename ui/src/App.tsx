import { useEffect, useRef, useState } from 'react';
import { getState, getBook, type ServerState } from './api';
import { Certificate } from './Certificate';
import { Treasury } from './Treasury';
import { Portal } from './Portal';
import { History } from './History';
import { I18nProvider, useI18n, type Lang } from './i18n';

export function App() {
  return (
    <I18nProvider>
      <Shell />
    </I18nProvider>
  );
}

function Shell() {
  const { t, lang, setLang } = useI18n();
  const [view, setView] = useState<'auditor' | 'treasury' | 'portal' | 'history'>('treasury');
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

  const langBtn = (l: Lang, label: string) => (
    <button
      className={`lang-btn ${lang === l ? 'active' : ''}`}
      onClick={() => setLang(l)}
      aria-pressed={lang === l}
    >
      {label}
    </button>
  );

  return (
    <>
      <header className="masthead">
        <h1>
          ASFALIA
          <small>{t.subtitle}</small>
        </h1>
        <div className="mast-right">
          <div className="lang-switch">{langBtn('en', 'EN')}·{langBtn('es', 'ES')}</div>
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

      <nav className="tabs" role="tablist">
        <button role="tab" aria-selected={view === 'treasury'} onClick={() => setView('treasury')}>
          {t.tab_treasury}
        </button>
        <button role="tab" aria-selected={view === 'auditor'} onClick={() => setView('auditor')}>
          {t.tab_auditor}
        </button>
        <button role="tab" aria-selected={view === 'portal'} onClick={() => setView('portal')}>
          {t.tab_portal}
        </button>
        <button role="tab" aria-selected={view === 'history'} onClick={() => setView('history')}>
          {t.tab_history}
        </button>
      </nav>

      <main className="tabpanel">
        {view === 'auditor' ? (
          <Certificate state={state} now={now} />
        ) : view === 'portal' ? (
          <Portal accounts={accounts} />
        ) : view === 'history' ? (
          <History state={state} now={now} />
        ) : (
          <Treasury state={state} />
        )}
      </main>
    </>
  );
}
