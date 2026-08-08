import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useI18n, type Strings } from './i18n';

// Tour guiado — patron heredado de Pulso: se oscurece la pantalla, un
// recorte ilumina el blanco y una tarjeta lo explica. Sin librerias.

type TourPhase = 'closed' | 'gate' | 'steps' | 'final';
type CardSide = 'left' | 'right' | 'below' | 'above';

export interface TourStep {
  target: string; // data-tour="..."
  view?: string; // si el paso vive en otra vista, navegar primero
  title: (t: Strings) => string;
  body: (t: Strings) => string;
}

interface Rect { top: number; left: number; width: number; height: number }

function measure(target: string, scroll: boolean): Rect | null {
  const el = document.querySelector(`[data-tour="${target}"]`);
  if (!el) return null;
  const box = el.getBoundingClientRect();
  if (box.width === 0 && box.height === 0) return null;
  // Pantallas bajas: si el blanco no entra completo en el viewport, centrarlo.
  if (scroll && (box.top < 70 || box.bottom > window.innerHeight - 20)) {
    el.scrollIntoView({ block: 'center', behavior: 'instant' as ScrollBehavior });
    const b2 = el.getBoundingClientRect();
    return { top: b2.top, left: b2.left, width: b2.width, height: b2.height };
  }
  return { top: box.top, left: box.left, width: box.width, height: box.height };
}

function pickSide(hole: Rect): CardSide {
  const vw = window.innerWidth;
  const cx = hole.left + hole.width / 2;
  if (cx < vw / 3) return 'right';
  if (cx > (vw * 2) / 3) return 'left';
  if (hole.top + hole.height + 210 < window.innerHeight) return 'below';
  return 'above';
}

const CARD_W = 330, GAP = 16, MARGIN = 12, EST_H = 200, PAD = 8;

function cardPosition(hole: Rect, side: CardSide) {
  const vw = window.innerWidth, vh = window.innerHeight;
  if (side === 'right')
    return { top: Math.min(Math.max(MARGIN, hole.top), vh - EST_H - MARGIN), left: Math.min(hole.left + hole.width + GAP, vw - CARD_W - MARGIN) };
  if (side === 'left')
    return { top: Math.min(Math.max(MARGIN, hole.top), vh - EST_H - MARGIN), left: Math.max(MARGIN, hole.left - GAP - CARD_W) };
  if (side === 'below')
    return { top: Math.min(hole.top + hole.height + GAP, vh - EST_H - MARGIN), left: Math.min(Math.max(MARGIN, hole.left), vw - CARD_W - MARGIN) };
  return { top: Math.max(MARGIN, hole.top - GAP - EST_H), left: Math.min(Math.max(MARGIN, hole.left), vw - CARD_W - MARGIN) };
}

export function GuidedTour({
  steps,
  storageKey,
  gateTitle,
  gateBody,
  finalTitle,
  finalBody,
  onNavigate,
}: {
  steps: TourStep[];
  storageKey: string;
  gateTitle: string;
  gateBody: string;
  finalTitle: string;
  finalBody: string;
  onNavigate?: (view: string) => void;
}) {
  const { t } = useI18n();
  const [phase, setPhase] = useState<TourPhase>('closed');
  const [stepIndex, setStepIndex] = useState(0);
  const [hole, setHole] = useState<Rect | null>(null);
  const primaryRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    try {
      if (!window.localStorage.getItem(storageKey)) setPhase('gate');
    } catch { /* modo privado */ }
  }, [storageKey]);

  const markSeen = useCallback(() => {
    try { window.localStorage.setItem(storageKey, '1'); } catch { /* ignorar */ }
  }, [storageKey]);

  const closeTour = useCallback(() => { markSeen(); setPhase('closed'); }, [markSeen]);

  const goTo = useCallback(
    (idx: number) => {
      const step = steps[idx];
      if (step?.view && onNavigate) onNavigate(step.view);
      setStepIndex(idx);
    },
    [steps, onNavigate],
  );

  const startTour = useCallback(() => { goTo(0); setPhase('steps'); }, [goTo]);

  const advance = useCallback(() => {
    if (stepIndex + 1 >= steps.length) setPhase('final');
    else goTo(stepIndex + 1);
  }, [stepIndex, steps.length, goTo]);

  const currentStep = steps[stepIndex];

  useLayoutEffect(() => {
    if (phase !== 'steps' || !currentStep) { setHole(null); return; }
    // La vista destino puede estar montando o esperando datos: reintentar
    // hasta 6 segundos antes de rendirse.
    let tries = 0;
    const recompute = (scroll = true) => {
      const r = measure(currentStep.target, scroll);
      if (r) { setHole(r); return true; }
      return false;
    };
    recompute();
    const iv = setInterval(() => {
      if (recompute() || tries++ > 30) clearInterval(iv);
    }, 200);
    const onResize = () => recompute(false);
    window.addEventListener('resize', onResize);
    return () => { window.removeEventListener('resize', onResize); clearInterval(iv); };
  }, [phase, currentStep, stepIndex]);

  useEffect(() => {
    if (phase === 'closed') return;
    primaryRef.current?.focus();
  }, [phase, stepIndex]);

  useEffect(() => {
    if (phase === 'closed') return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { closeTour(); return; }
      if (e.key === 'Enter' || e.key === 'ArrowRight') {
        e.preventDefault();
        if (phase === 'gate') startTour();
        else if (phase === 'steps') advance();
        else closeTour();
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [phase, closeTour, startTour, advance]);

  if (phase === 'closed') {
    return (
      <button type="button" className="tour-replay" onClick={() => setPhase('gate')} aria-label={t.tour_replay}>
        {t.tour_replay}
      </button>
    );
  }

  if (phase === 'gate') {
    return (
      <div className="tour-backdrop">
        <div className="tour-modal" role="dialog" aria-modal="true">
          <p className="tour-wordmark">{gateTitle}</p>
          <p className="tour-tagline">{gateBody}</p>
          <div className="tour-actions">
            <button type="button" className="attest-btn tour-primary" onClick={startTour} ref={primaryRef}>
              {t.tour_take}
            </button>
            <button type="button" className="reveal-btn" onClick={closeTour}>
              {t.tour_skip_to}
            </button>
          </div>
          <p className="tour-caption">{t.tour_caption(steps.length)}</p>
        </div>
      </div>
    );
  }

  if (phase === 'steps' && currentStep) {
    if (!hole) {
      const isLast = stepIndex === steps.length - 1;
      return (
        <div className="tour-backdrop">
          <div className="tour-modal" role="dialog" aria-modal="true">
            <p className="tour-counter">
              {String(stepIndex + 1).padStart(2, '0')} / {String(steps.length).padStart(2, '0')}
            </p>
            <h2 className="tour-title" aria-live="polite">{currentStep.title(t)}</h2>
            <p className="tour-body">{currentStep.body(t)}</p>
            <div className="tour-actions">
              <button type="button" className="tour-text-btn" onClick={closeTour}>{t.tour_skip}</button>
              <button type="button" className="attest-btn tour-primary" onClick={advance} ref={primaryRef}>
                {isLast ? t.tour_finish : t.tour_next}
              </button>
            </div>
          </div>
        </div>
      );
    }
    const padded: Rect = {
      top: hole.top - PAD, left: hole.left - PAD,
      width: hole.width + PAD * 2, height: hole.height + PAD * 2,
    };
    const side = pickSide(padded);
    const pos = cardPosition(padded, side);
    const isLast = stepIndex === steps.length - 1;
    return (
      <div className="tour-layer">
        <div
          className="tour-hole"
          style={{ top: padded.top, left: padded.left, width: padded.width, height: padded.height }}
        />
        <div className="tour-card" style={{ top: pos.top, left: pos.left }} role="dialog" aria-modal="true">
          <p className="tour-counter">
            {String(stepIndex + 1).padStart(2, '0')} / {String(steps.length).padStart(2, '0')}
          </p>
          <h2 className="tour-title" aria-live="polite">{currentStep.title(t)}</h2>
          <p className="tour-body">{currentStep.body(t)}</p>
          <div className="tour-foot">
            <button type="button" className="tour-text-btn" onClick={closeTour}>{t.tour_skip}</button>
            <button type="button" className="attest-btn tour-primary" onClick={advance} ref={primaryRef}>
              {isLast ? t.tour_finish : t.tour_next}
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (phase === 'final') {
    return (
      <div className="tour-backdrop">
        <div className="tour-modal" role="dialog" aria-modal="true">
          <h2 className="tour-wordmark">{finalTitle}</h2>
          <p className="tour-tagline">{finalBody}</p>
          <div className="tour-actions">
            <button type="button" className="attest-btn tour-primary" onClick={closeTour} ref={primaryRef}>
              {t.tour_enter}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return null;
}
