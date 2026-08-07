import { useEffect, useRef, useState } from 'react';
import { getState, type ServerState } from './api';
import { Certificate } from './Certificate';
import { Treasury } from './Treasury';

export function App() {
  const [view, setView] = useState<'auditor' | 'treasury'>('treasury');
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
    const p = setInterval(poll, 2000);
    const t = setInterval(() => setNow(Math.floor(Date.now() / 1000) + offset.current), 1000);
    return () => { alive = false; clearInterval(p); clearInterval(t); };
  }, []);

  return (
    <>
      <header className="masthead">
        <h1>
          ENKU
          <small>Certificación de solvencia sin revelación de datos · Midnight Network</small>
        </h1>
        <div className="file-no">
          {state ? (
            <>
              red: {state.network}
              <br />
              contrato {state.contractAddress.slice(0, 20)}…
            </>
          ) : (
            'conectando…'
          )}
        </div>
      </header>

      <nav className="tabs" role="tablist">
        <button role="tab" aria-selected={view === 'treasury'} onClick={() => setView('treasury')}>
          Tesorería · entidad
        </button>
        <button role="tab" aria-selected={view === 'auditor'} onClick={() => setView('auditor')}>
          Certificado · auditor
        </button>
      </nav>

      <main className="tabpanel">
        {view === 'auditor'
          ? <Certificate state={state} now={now} />
          : <Treasury state={state} />}
      </main>
    </>
  );
}
