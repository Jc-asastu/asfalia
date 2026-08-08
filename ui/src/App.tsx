import { useEffect, useRef, useState } from 'react';
import { getState, getBook, type ServerState } from './api';
import { Certificate } from './Certificate';
import { Treasury } from './Treasury';
import { Portal } from './Portal';
import { History } from './History';
import { Scanner } from './Scanner';
import { I18nProvider, useI18n, type Lang } from './i18n';
import { Landing } from './Landing';
import { Entities } from './Entities';
import { GuidedTour, type TourStep } from './GuidedTour';

export function App() {
  return (
    <I18nProvider>
      <Shell />
    </I18nProvider>
  );
}

/** Dos mundos, una sola verdad:
 *  - PORTAL PUBLICO (/): landing -> registro de entidades -> ¿cliente o
 *    auditor? -> sus vistas. Jamas balances: todo lo que muestra es publico
 *    o propio del cliente.
 *  - CONSOLA LOCAL (/console): tesoreria + historial. No esta linkeada desde
 *    el portal: en produccion es un programa 24/7 en la maquina de la
 *    entidad (systemd, reinicio automatico), no una pagina web.
 */
type Stage = 'landing' | 'entities' | 'app';
type Subrole = 'client' | 'auditor';
type View = 'treasury' | 'auditor' | 'portal' | 'history' | 'scanner';

const SUBROLE_VIEWS: Record<Subrole, View[]> = {
  auditor: ['auditor', 'history', 'scanner'],
  client: ['portal'],
};

const AUDITOR_TOUR: TourStep[] = [
  {
    target: 'stamp', view: 'auditor',
    title: (t) => t.tour_stamp_title, body: (t) => t.tour_stamp_body,
  },
  {
    target: 'validity', view: 'auditor',
    title: (t) => t.tour_validity_title, body: (t) => t.tour_validity_body,
  },
  {
    target: 'roots', view: 'auditor',
    title: (t) => t.tour_roots_title, body: (t) => t.tour_roots_body,
  },
  {
    target: 'actions', view: 'auditor',
    title: (t) => t.tour_actions_title, body: (t) => t.tour_actions_body,
  },
  {
    target: 'grid', view: 'history',
    title: (t) => t.tour_grid_title, body: (t) => t.tour_grid_body,
  },
  {
    target: 'chainrow', view: 'history',
    title: (t) => t.tour_chainrow_title, body: (t) => t.tour_chainrow_body,
  },
  {
    target: 'scantable', view: 'scanner',
    title: (t) => t.tour_scan_title, body: (t) => t.tour_scan_body,
  },
];

const CLIENT_TOUR: TourStep[] = [
  {
    target: 'account', view: 'portal',
    title: (t) => t.tour_account_title, body: (t) => t.tour_account_body,
  },
];

const isConsole = window.location.pathname.startsWith('/console');

function Shell() {
  const { t, lang, setLang } = useI18n();
  const [theme, setTheme] = useState<'dark' | 'light'>(
    () => (localStorage.getItem('asfalia-theme') as 'dark' | 'light') || 'dark',
  );
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem('asfalia-theme', theme);
  }, [theme]);
  const [stage, setStage] = useState<Stage>('landing');
  const [subrole, setSubrole] = useState<Subrole | null>(null);
  const [view, setView] = useState<View>(isConsole ? 'treasury' : 'auditor');
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
    getBook().then((b) => setAccounts(b.users.map(({ account, name }) => ({ account, name })))).catch(() => {});
    const p = setInterval(poll, 2000);
    const tk = setInterval(() => setNow(Math.floor(Date.now() / 1000) + offset.current), 1000);
    return () => { alive = false; clearInterval(p); clearInterval(tk); };
  }, []);

  const pickSubrole = (r: Subrole) => {
    setSubrole(r);
    setView(SUBROLE_VIEWS[r][0]);
    setStage('app');
  };
  const exit = () => { setSubrole(null); setStage('landing'); };

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

  const views: View[] = isConsole
    ? ['treasury', 'history']
    : subrole
      ? SUBROLE_VIEWS[subrole]
      : [];
  const activeView = views.includes(view) ? view : views[0];

  const renderView = (v: View | undefined) =>
    v === 'auditor' ? (
      <Certificate state={state} now={now} />
    ) : v === 'portal' ? (
      <Portal accounts={accounts} />
    ) : v === 'history' ? (
      <History state={state} now={now} />
    ) : v === 'scanner' ? (
      <Scanner />
    ) : v === 'treasury' ? (
      <Treasury state={state} />
    ) : null;

  return (
    <>
      <header className="masthead">
        <h1>
          ASFALIA
          <small>{isConsole ? t.console_subtitle : t.subtitle}</small>
        </h1>
        <div className="mast-right">
          <div className="lang-switch">
            <button
              className="theme-btn"
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              aria-label={theme === 'dark' ? t.theme_light : t.theme_dark}
              title={theme === 'dark' ? t.theme_light : t.theme_dark}
            >
              {theme === 'dark' ? '☀' : '☾'}
            </button>
            {langBtn('en', 'EN')}·{langBtn('es', 'ES')}
            {!isConsole && stage !== 'landing' && (
              <button className="lang-btn role-change" onClick={exit}>
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

      {isConsole ? (
        <>
          <div className="private-banner console-banner">
            <span aria-hidden="true">◆</span>
            {t.console_banner}
          </div>
          <nav className="tabs" role="tablist">
            {views.map((v) => (
              <button key={v} role="tab" aria-selected={activeView === v} onClick={() => setView(v)}>
                {TAB_LABEL[v]}
              </button>
            ))}
          </nav>
          <main className="tabpanel">{renderView(activeView)}</main>
        </>
      ) : stage === 'landing' ? (
        <Landing state={state} onEnter={() => setStage('entities')} />
      ) : stage === 'entities' ? (
        <Entities state={state} now={now} onPick={pickSubrole} />
      ) : (
        <>
          <nav className="tabs" role="tablist">
            {views.map((v) => (
              <button key={v} role="tab" aria-selected={activeView === v} onClick={() => setView(v)}>
                {TAB_LABEL[v]}
              </button>
            ))}
          </nav>
          <main className="tabpanel">{renderView(activeView)}</main>
          {subrole === 'auditor' && (
            <GuidedTour
              steps={AUDITOR_TOUR}
              storageKey="asfalia.tour.auditor.v1"
              gateTitle="ASFALIA"
              gateBody={t.tour_gate_auditor}
              finalTitle={t.tour_final_title}
              finalBody={t.tour_final_auditor}
              onNavigate={(v) => setView(v as View)}
            />
          )}
          {subrole === 'client' && (
            <GuidedTour
              steps={CLIENT_TOUR}
              storageKey="asfalia.tour.client.v1"
              gateTitle="ASFALIA"
              gateBody={t.tour_gate_client}
              finalTitle={t.tour_final_title}
              finalBody={t.tour_final_client}
              onNavigate={(v) => setView(v as View)}
            />
          )}
        </>
      )}
    </>
  );
}
