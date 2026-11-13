import type { PracticeHistory, WorkoutSport } from '../domain/types';

/**
 * Lecture de la pratique réelle depuis le bootstrap Compte.
 *
 * `outings` est la seule source branchée aujourd'hui. Elle ne porte pas le
 * sport : `sportStatus` reste donc `unknown` et aucune séance n'est attribuée
 * à la course ou au vélo par déduction. Les sorties `upcoming` sont ignorées.
 */
export interface AccountPracticeSnapshot {
  source: 'compte.bootstrap.outings';
  status: 'available' | 'partial' | 'absent';
  lastPracticeAt: string | null;
  sessionsLast7d: number | null;
  sport: WorkoutSport | null;
  sportStatus: 'unknown' | 'absent';
}

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function readOutings(payload: unknown): unknown[] | null {
  const record = asRecord(payload);
  if (!record) return null;
  const outings = record.outings;
  return Array.isArray(outings) ? outings : null;
}

function readDate(outing: Record<string, unknown>): number | null {
  const ended = typeof outing.endedAt === 'string' ? Date.parse(outing.endedAt) : NaN;
  if (Number.isFinite(ended)) return ended;
  const started =
    typeof outing.startedAt === 'string' ? Date.parse(outing.startedAt) : NaN;
  return Number.isFinite(started) ? started : null;
}

export function readAccountPractice(
  payload: unknown,
  now: number = Date.now()
): AccountPracticeSnapshot {
  const outings = readOutings(payload);
  if (!outings || outings.length === 0) {
    return {
      source: 'compte.bootstrap.outings',
      status: 'absent',
      lastPracticeAt: null,
      sessionsLast7d: null,
      sport: null,
      sportStatus: 'absent',
    };
  }

  const candidates = outings
    .map(asRecord)
    .filter((outing): outing is Record<string, unknown> => outing !== null)
    .filter((outing) => outing.status !== 'upcoming');

  if (candidates.length === 0) {
    return {
      source: 'compte.bootstrap.outings',
      status: 'absent',
      lastPracticeAt: null,
      sessionsLast7d: null,
      sport: null,
      sportStatus: 'absent',
    };
  }

  let lastMs: number | null = null;
  let lastIso: string | null = null;
  let sessionsLast7d = 0;
  let readable = 0;

  for (const outing of candidates) {
    const ms = readDate(outing);
    if (ms === null) continue;
    readable += 1;
    if (lastMs === null || ms > lastMs) {
      lastMs = ms;
      const endedAt =
        typeof outing.endedAt === 'string' ? outing.endedAt : null;
      const startedAt =
        typeof outing.startedAt === 'string' ? outing.startedAt : null;
      const endedMs = endedAt ? Date.parse(endedAt) : NaN;
      const startedMs = startedAt ? Date.parse(startedAt) : NaN;
      lastIso = Number.isFinite(endedMs)
        ? endedAt
        : Number.isFinite(startedMs)
          ? startedAt
          : new Date(ms).toISOString();
    }
    if (ms >= now - SEVEN_DAYS_MS && ms <= now + 60_000) {
      sessionsLast7d += 1;
    }
  }

  if (readable === 0 || lastMs === null) {
    return {
      source: 'compte.bootstrap.outings',
      status: 'partial',
      lastPracticeAt: null,
      sessionsLast7d: null,
      sport: null,
      sportStatus: 'unknown',
    };
  }

  return {
    source: 'compte.bootstrap.outings',
    status: 'available',
    lastPracticeAt: lastIso,
    sessionsLast7d,
    sport: null,
    sportStatus: 'unknown',
  };
}

/** Historique utilisable par les séances instantanées, ou `null` si absent. */
export function readPracticeHistory(
  payload: unknown,
  now: number = Date.now()
): PracticeHistory | null {
  const snapshot = readAccountPractice(payload, now);
  if (snapshot.status === 'absent' || snapshot.sessionsLast7d === null) {
    return null;
  }
  return {
    sessionsLast7d: snapshot.sessionsLast7d,
    lastPracticeAt: snapshot.lastPracticeAt,
    sport: snapshot.sport,
    sportStatus: snapshot.sportStatus,
  };
}
