import type {
  LeaderboardMetric,
  LeaderboardPeriodKind,
  PeerComparisonQuery,
  PeriodLeaderboardQuery,
  SportCategory,
} from '@/features/rankings/types';

const PERIODS: readonly LeaderboardPeriodKind[] = ['weekly', 'monthly'];
const METRICS: readonly LeaderboardMetric[] = [
  'distanceMeters',
  'elevationGainMeters',
  'durationSec',
  'activityCount',
];
const SPORTS: readonly SportCategory[] = [
  'all',
  'running',
  'trail',
  'cycling',
  'gravel',
  'mtb',
  'hiking',
  'walking',
  'swimming',
  'skiing',
  'other',
];
const SCOPES: readonly NonNullable<PeriodLeaderboardQuery['scope']>[] = [
  'public',
  'club',
  'peers',
];

export type ParsedQuery<T> =
  | { ok: true; value: T }
  | { ok: false; error: string };

function parseEnum<T extends string>(
  raw: string | null,
  allowed: readonly T[],
  fallback: T
): T {
  if (!raw) return fallback;
  return (allowed as readonly string[]).includes(raw) ? (raw as T) : fallback;
}

export function parseReferenceDate(raw: string | null): ParsedQuery<string> {
  if (!raw) return { ok: true, value: new Date().toISOString() };
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) {
    return { ok: false, error: 'referenceDate invalide (ISO-8601 attendu).' };
  }
  // Une date future lointaine produirait une fenêtre vide : on la refuse.
  const maxMs = Date.now() + 366 * 86_400_000;
  if (parsed.getTime() > maxMs) {
    return { ok: false, error: 'referenceDate trop éloignée dans le futur.' };
  }
  return { ok: true, value: parsed.toISOString() };
}

export function parsePositiveInt(
  raw: string | null,
  fallback: number,
  min: number,
  max: number
): ParsedQuery<number> {
  if (raw === null || raw === '') return { ok: true, value: fallback };
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || Math.floor(parsed) !== parsed || parsed < min || parsed > max) {
    return { ok: false, error: `Valeur entière attendue entre ${min} et ${max}.` };
  }
  return { ok: true, value: parsed };
}

export function parseLeaderboardQuery(
  searchParams: URLSearchParams
): ParsedQuery<{ query: PeriodLeaderboardQuery; limit: number }> {
  const periodKind = parseEnum(searchParams.get('period'), PERIODS, 'weekly');
  const metric = parseEnum(searchParams.get('metric'), METRICS, 'distanceMeters');
  const sport = parseEnum(searchParams.get('sport'), SPORTS, 'all');
  const scope = parseEnum(searchParams.get('scope'), SCOPES, 'public');
  const reference = parseReferenceDate(searchParams.get('referenceDate'));
  if (!reference.ok) return reference;
  const limit = parsePositiveInt(searchParams.get('limit'), 25, 1, 100);
  if (!limit.ok) return limit;

  return {
    ok: true,
    value: {
      query: {
        periodKind,
        referenceDate: reference.value,
        metric,
        sport,
        scope,
      },
      limit: limit.value,
    },
  };
}

export function parsePeersQuery(
  searchParams: URLSearchParams
): ParsedQuery<PeerComparisonQuery> {
  const periodKind = parseEnum(searchParams.get('period'), PERIODS, 'weekly');
  const sport = parseEnum(searchParams.get('sport'), SPORTS, 'all');
  const reference = parseReferenceDate(searchParams.get('referenceDate'));
  if (!reference.ok) return reference;
  return {
    ok: true,
    value: { periodKind, referenceDate: reference.value, sport },
  };
}

export interface LegendsQuery {
  targetType: 'route' | 'segment';
  targetId: string | null;
  referenceDate: string;
  windowDays: number;
  minEffortsRequired: number;
}

export function parseLegendsQuery(
  searchParams: URLSearchParams
): ParsedQuery<LegendsQuery> {
  const targetType = searchParams.get('targetType') === 'segment' ? 'segment' : 'route';
  const targetIdRaw = searchParams.get('targetId');
  const targetId = targetIdRaw && targetIdRaw.trim() ? targetIdRaw.trim().slice(0, 120) : null;
  const reference = parseReferenceDate(searchParams.get('referenceDate'));
  if (!reference.ok) return reference;
  const windowDays = parsePositiveInt(searchParams.get('windowDays'), 90, 7, 365);
  if (!windowDays.ok) return windowDays;
  const minEffortsRequired = parsePositiveInt(
    searchParams.get('minEfforts'),
    2,
    1,
    50
  );
  if (!minEffortsRequired.ok) return minEffortsRequired;

  return {
    ok: true,
    value: {
      targetType,
      targetId,
      referenceDate: reference.value,
      windowDays: windowDays.value,
      minEffortsRequired: minEffortsRequired.value,
    },
  };
}

export function isLeaderboardMetric(value: string): value is LeaderboardMetric {
  return (METRICS as readonly string[]).includes(value);
}
