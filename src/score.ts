// Score de credibilidad — una funcion DETERMINISTICA del historial publico
// de emisiones. No es un numero que Asfalia declara: cualquiera puede
// recomputarlo desde las transacciones ancladas en cadena.
//
// Moderado a proposito: el silencio y la insolvencia cuestan, la conducta
// sostenida recupera de a poco. No es lapidario — es memoria con perdon.

export type ScoreEvent = 'green' | 'red' | 'gap' | 'failed';

export const SCORE_RULES: Record<ScoreEvent, number> = {
  green: +1, // latido solvente: recuperacion lenta
  red: -12, // attestar insolvente: el evento grave
  gap: -6, // elegir no probar: sospechoso, pero menos que insolvente
  failed: -2, // falla operativa de emision
};

export type ScoreLevel = 'excellent' | 'good' | 'watch' | 'poor';

export interface ScoreResult {
  score: number; // 0..100
  level: ScoreLevel;
  greens: number;
  reds: number;
  gaps: number;
  failed: number;
}

interface LogEntryLike {
  ts: number;
  ok: boolean;
  verdict: boolean | null;
}

export function levelOf(score: number): ScoreLevel {
  if (score >= 90) return 'excellent';
  if (score >= 70) return 'good';
  if (score >= 40) return 'watch';
  return 'poor';
}

/** Reconstruye la linea de tiempo en periodos de heartbeat (igual que el grid
 *  del historial) y aplica las reglas en orden cronologico. Sin heartbeat
 *  configurado no hay nocion de hueco: solo cuentan las emisiones. */
export function computeScore(
  entries: LogEntryLike[],
  heartbeatSec: number | null,
  nowMs: number,
): ScoreResult {
  let score = 100;
  const counts = { greens: 0, reds: 0, gaps: 0, failed: 0 };

  const apply = (ev: ScoreEvent) => {
    score = Math.min(100, Math.max(0, score + SCORE_RULES[ev]));
    if (ev === 'green') counts.greens++;
    else if (ev === 'red') counts.reds++;
    else if (ev === 'gap') counts.gaps++;
    else counts.failed++;
  };

  const applyEntry = (e: LogEntryLike) =>
    apply(!e.ok ? 'failed' : e.verdict ? 'green' : 'red');

  if (heartbeatSec && entries.length > 0) {
    const step = heartbeatSec * 1000;
    let idx = 0;
    for (let p = entries[0].ts; p < nowMs; p += step) {
      const inPeriod: LogEntryLike[] = [];
      while (idx < entries.length && entries[idx].ts < p + step) inPeriod.push(entries[idx++]);
      if (inPeriod.length === 0) apply('gap');
      else inPeriod.forEach(applyEntry);
    }
  } else {
    entries.forEach(applyEntry);
  }

  return { score, level: levelOf(score), ...counts };
}
