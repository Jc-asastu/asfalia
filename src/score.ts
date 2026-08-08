// Score operativo local — una funcion deterministica sobre la telemetria del
// daemon. No es estado publico de cadena ni debe presentarse como tal.
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
  trigger: 'heartbeat' | 'manual';
  ok: boolean;
  verdict: boolean | null;
  txId: string | null;
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

  const seenTxIds = new Set<string>();
  const ordered = [...entries]
    .sort((a, b) => a.ts - b.ts)
    .filter((entry) => {
      if (!entry.ok || !entry.txId) return true;
      const id = entry.txId.toLowerCase();
      if (seenTxIds.has(id)) return false;
      seenTxIds.add(id);
      return true;
    });

  // Manual green events never repair credibility. Only sustained automatic
  // heartbeats recover it; red and failed events always count.
  const eventOf = (e: LogEntryLike): ScoreEvent | null => {
    if (!e.ok || e.verdict === null) return 'failed';
    if (!e.verdict) return 'red';
    return e.trigger === 'heartbeat' ? 'green' : null;
  };

  if (heartbeatSec && ordered.length > 0) {
    const step = heartbeatSec * 1000;
    const firstHeartbeat = ordered.find((entry) => entry.trigger === 'heartbeat');
    if (!firstHeartbeat) {
      ordered.map(eventOf).filter((event): event is ScoreEvent => event !== null).forEach(apply);
      return { score, level: levelOf(score), ...counts };
    }
    let idx = 0;
    while (idx < ordered.length && ordered[idx].ts < firstHeartbeat.ts) {
      const event = eventOf(ordered[idx++]);
      if (event) apply(event);
    }
    const periodCount = Math.max(0, Math.ceil((nowMs - firstHeartbeat.ts) / step));
    const periods = new Map<number, ScoreEvent[]>();
    for (; idx < ordered.length; idx++) {
      const bucket = Math.floor((ordered[idx].ts - firstHeartbeat.ts) / step);
      if (bucket < 0 || bucket >= periodCount) continue;
      const event = eventOf(ordered[idx]);
      if (event) periods.set(bucket, [...(periods.get(bucket) ?? []), event]);
    }
    const applyGaps = (count: number) => {
      if (count <= 0) return;
      counts.gaps += count;
      score = Math.max(0, score + SCORE_RULES.gap * count);
    };
    let nextPeriod = 0;
    for (const [period, events] of [...periods.entries()].sort((a, b) => a[0] - b[0])) {
      applyGaps(period - nextPeriod);
      // At most one outcome per period; the most severe event wins.
      if (events.includes('red')) apply('red');
      else if (events.includes('failed')) apply('failed');
      else if (events.includes('green')) apply('green');
      else apply('gap');
      nextPeriod = period + 1;
    }
    applyGaps(periodCount - nextPeriod);
  } else {
    ordered.map(eventOf).filter((event): event is ScoreEvent => event !== null).forEach(apply);
  }

  return { score, level: levelOf(score), ...counts };
}
