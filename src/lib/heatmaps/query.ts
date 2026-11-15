/**
 * Parsing strict des requêtes HTTP heatmaps (C02).
 *
 * Aucune valeur libre n'atteint le moteur : le sport appartient à la taxonomie
 * des neuf sports, les fenêtres et périodes sont fermées, les bornes k-anonymat
 * sont plancherisées côté serveur. Un paramètre invalide est une erreur 400,
 * jamais un repli silencieux sur une autre couche.
 */

import { z } from 'zod';
import { SPORT_FAMILIES } from '@/features/explorer-v2/sheet/sportSelection';
import type {
  CommunityTimeWindow,
  HeatmapSportFilter,
  PersonalTimeFilter,
  PersonalTimePeriodKind,
} from '@/features/heatmaps/types';

export const HEATMAP_SPORT_IDS = SPORT_FAMILIES.map((family) => family.sport) as readonly string[];

const SPORT_SET = new Set<string>(HEATMAP_SPORT_IDS);

export const COMMUNITY_TIME_WINDOWS: readonly CommunityTimeWindow[] = [
  'global',
  'last_7_days',
  'nocturnal',
];

export const PERSONAL_PERIOD_KINDS: readonly PersonalTimePeriodKind[] = [
  'all_time',
  'last_7_days',
  'last_30_days',
  'last_90_days',
  'year_to_date',
  'custom',
];

export type HeatmapQueryResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: string; code: string };

export interface CommunityHeatmapQuery {
  sport: HeatmapSportFilter;
  timeWindow: CommunityTimeWindow;
  minContributors: number;
  gridResolutionDeg: number;
}

export interface PersonalHeatmapQuery {
  sport: HeatmapSportFilter;
  period: PersonalTimeFilter;
  comparePeriod: PersonalTimeFilter | null;
  gridResolutionDeg: number;
}

const MIN_PUBLIC_QUERY_CONTRIBUTORS = 5;
const MAX_PUBLIC_QUERY_CONTRIBUTORS = 100;
const MIN_GRID_RESOLUTION = 0.0002;
const MAX_GRID_RESOLUTION = 0.01;

function isSportFilter(value: string): value is HeatmapSportFilter {
  return value === 'all' || SPORT_SET.has(value);
}

function isIsoDate(value: string): boolean {
  return Number.isFinite(Date.parse(value));
}

function parseBoundedNumber(
  raw: string | null,
  fallback: number,
  min: number,
  max: number
): number | null {
  if (raw === null || raw.trim() === '') return fallback;
  const parsed = Number(raw.replace(',', '.'));
  if (!Number.isFinite(parsed)) return null;
  return Math.min(max, Math.max(min, parsed));
}

/**
 * Valide `sport`, `window`, `minContributors` et la résolution.
 * Le seuil public demandé ne peut jamais descendre sous 5 contributeurs,
 * indépendamment du plancher absolu de sécurité du moteur (3).
 */
export function parseCommunityHeatmapQuery(
  searchParams: URLSearchParams
): HeatmapQueryResult<CommunityHeatmapQuery> {
  const rawSport = (searchParams.get('sport') ?? 'all').trim();
  if (!isSportFilter(rawSport)) {
    return { ok: false, error: 'sport invalide', code: 'invalid_sport' };
  }

  const rawWindow = (searchParams.get('window') ?? 'global').trim();
  if (!COMMUNITY_TIME_WINDOWS.includes(rawWindow as CommunityTimeWindow)) {
    return { ok: false, error: 'fenêtre invalide', code: 'invalid_window' };
  }

  const minContributors = parseBoundedNumber(
    searchParams.get('minContributors'),
    5,
    MIN_PUBLIC_QUERY_CONTRIBUTORS,
    MAX_PUBLIC_QUERY_CONTRIBUTORS
  );
  if (minContributors === null) {
    return { ok: false, error: 'seuil de contributeurs invalide', code: 'invalid_min_contributors' };
  }

  const gridResolutionDeg = parseBoundedNumber(
    searchParams.get('gridResolutionDeg'),
    0.001,
    MIN_GRID_RESOLUTION,
    MAX_GRID_RESOLUTION
  );
  if (gridResolutionDeg === null) {
    return { ok: false, error: 'résolution de grille invalide', code: 'invalid_grid_resolution' };
  }

  return {
    ok: true,
    value: {
      sport: rawSport,
      timeWindow: rawWindow as CommunityTimeWindow,
      minContributors: Math.floor(minContributors),
      gridResolutionDeg,
    },
  };
}

function parsePeriod(
  searchParams: URLSearchParams,
  prefix: '' | 'compare'
): HeatmapQueryResult<PersonalTimeFilter> {
  const kindKey = prefix === '' ? 'period' : 'comparePeriod';
  const rawKind = (searchParams.get(kindKey) ?? 'all_time').trim();
  if (!PERSONAL_PERIOD_KINDS.includes(rawKind as PersonalTimePeriodKind)) {
    return { ok: false, error: 'période invalide', code: 'invalid_period' };
  }

  if (rawKind !== 'custom') {
    return {
      ok: true,
      value: {
        kind: rawKind as PersonalTimePeriodKind,
        ...(searchParams.get('nocturnalOnly') === 'true' && prefix === ''
          ? { nocturnalOnly: true }
          : {}),
      },
    };
  }

  const fromIso = (searchParams.get(prefix === '' ? 'from' : 'compareFrom') ?? '').trim();
  const toIso = (searchParams.get(prefix === '' ? 'to' : 'compareTo') ?? '').trim();
  if (!fromIso || !toIso || !isIsoDate(fromIso) || !isIsoDate(toIso)) {
    return { ok: false, error: 'bornes de période invalides', code: 'invalid_period_range' };
  }
  if (Date.parse(fromIso) > Date.parse(toIso)) {
    return { ok: false, error: 'période inversée', code: 'invalid_period_range' };
  }

  return { ok: true, value: { kind: 'custom', fromIso, toIso } };
}

/** Valide le sport, la période principale et l'éventuelle période de comparaison. */
export function parsePersonalHeatmapQuery(
  searchParams: URLSearchParams
): HeatmapQueryResult<PersonalHeatmapQuery> {
  const rawSport = (searchParams.get('sport') ?? 'all').trim();
  if (!isSportFilter(rawSport)) {
    return { ok: false, error: 'sport invalide', code: 'invalid_sport' };
  }

  const period = parsePeriod(searchParams, '');
  if (!period.ok) return period;

  const compareRaw = (searchParams.get('comparePeriod') ?? '').trim();
  let comparePeriod: PersonalTimeFilter | null = null;
  if (compareRaw !== '') {
    const compare = parsePeriod(searchParams, 'compare');
    if (!compare.ok) return compare;
    comparePeriod = compare.value;
  }

  const gridResolutionDeg = parseBoundedNumber(
    searchParams.get('gridResolutionDeg'),
    0.001,
    MIN_GRID_RESOLUTION,
    MAX_GRID_RESOLUTION
  );
  if (gridResolutionDeg === null) {
    return { ok: false, error: 'résolution de grille invalide', code: 'invalid_grid_resolution' };
  }

  return {
    ok: true,
    value: {
      sport: rawSport,
      period: period.value,
      comparePeriod,
      gridResolutionDeg,
    },
  };
}

const PreferencesPatchSchema = z
  .object({
    globalHeatmapOptOut: z.boolean().optional(),
    globalHeatmap: z.boolean().optional(),
    routeRecommendations: z.boolean().optional(),
    mobilityAggregates: z.boolean().optional(),
  })
  .strict();

export type PreferencesPatch = z.infer<typeof PreferencesPatchSchema>;

export function parsePreferencesPatch(body: unknown): HeatmapQueryResult<PreferencesPatch> {
  const parsed = PreferencesPatchSchema.safeParse(body);
  if (!parsed.success) {
    return { ok: false, error: 'préférences invalides', code: 'invalid_preferences' };
  }
  if (Object.keys(parsed.data).length === 0) {
    return { ok: false, error: 'aucune préférence fournie', code: 'empty_preferences' };
  }
  return { ok: true, value: parsed.data };
}

const OptOutSchema = z.object({ revokeAllAggregates: z.boolean().optional() }).strict();

export function parseOptOutBody(
  body: unknown
): HeatmapQueryResult<{ revokeAllAggregates: boolean }> {
  if (body === null || body === undefined) {
    return { ok: true, value: { revokeAllAggregates: false } };
  }
  const parsed = OptOutSchema.safeParse(body);
  if (!parsed.success) {
    return { ok: false, error: 'corps invalide', code: 'invalid_body' };
  }
  return { ok: true, value: { revokeAllAggregates: parsed.data.revokeAllAggregates === true } };
}
