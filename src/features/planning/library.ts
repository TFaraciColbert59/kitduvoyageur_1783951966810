/**
 * K1.13 — Bibliothèque d'aventures multi-jours.
 * Recherche absorbée par la barre de recherche (pays, durée, thème) avec critères
 * compris et corrigeables, sans panneau de filtres standard, et filtrage P01 fail-closed.
 */

import type {
  MultiDayPlan,
  ParsedPlanCriteria,
  PlanSearchQuery,
  PlanSearchResult,
  RouteTheme,
  ViewerContextP01,
} from './models';
import { isPlanVisibleToViewerP01 } from './sharing';

const COUNTRY_ALIASES: Record<string, string> = {
  france: 'FR',
  fr: 'FR',
  suisse: 'CH',
  switzerland: 'CH',
  ch: 'CH',
  italie: 'IT',
  italy: 'IT',
  it: 'IT',
  espagne: 'ES',
  spain: 'ES',
  es: 'ES',
  norvege: 'NO',
  norway: 'NO',
  no: 'NO',
  japon: 'JP',
  japan: 'JP',
  jp: 'JP',
  ecosse: 'GB',
  scotland: 'GB',
  islande: 'IS',
  iceland: 'IS',
  is: 'IS',
  argentine: 'AR',
  argentina: 'AR',
  ar: 'AR',
  nepal: 'NP',
  np: 'NP',
};

const THEME_ALIASES: Record<string, RouteTheme> = {
  alpin: 'alpine',
  alpine: 'alpine',
  montagne: 'alpine',
  cotier: 'coastal',
  coastal: 'coastal',
  mer: 'coastal',
  littoral: 'coastal',
  foret: 'forest',
  forest: 'forest',
  crete: 'ridge',
  cretes: 'ridge',
  ridge: 'ridge',
  patrimoine: 'heritage',
  heritage: 'heritage',
  lac: 'lake',
  lacs: 'lake',
  lake: 'lake',
  desert: 'desert',
  glacier: 'glacier',
};

function normalizeToken(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

export function parseMultiDaySearchQuery(
  rawQuery: string,
  overrides?: Partial<ParsedPlanCriteria>,
): ParsedPlanCriteria {
  const normalized = normalizeToken(rawQuery);
  let countryCode: string | null = null;
  let minDays: number | null = null;
  let maxDays: number | null = null;
  let theme: RouteTheme | null = null;
  const textTerms: string[] = [];

  // Détection de plage de durée : "3-5 jours", "3 a 5 j", "4 jours", "5d"
  let working = normalized;
  const rangeMatch = /\b(\d+)\s*(?:-|a|to)\s*(\d+)\s*(?:jours?|j|days?|d)\b/.exec(working);
  if (rangeMatch) {
    const a = Number.parseInt(rangeMatch[1], 10);
    const b = Number.parseInt(rangeMatch[2], 10);
    minDays = Math.min(a, b);
    maxDays = Math.max(a, b);
    working = working.replace(rangeMatch[0], ' ');
  } else {
    const singleMatch = /\b(\d+)\s*(?:jours?|j|days?|d)\b/.exec(working);
    if (singleMatch) {
      const d = Number.parseInt(singleMatch[1], 10);
      minDays = d;
      maxDays = d;
      working = working.replace(singleMatch[0], ' ');
    }
  }

  for (const rawToken of working.split(/\s+/)) {
    const token = rawToken.replace(/[^a-z0-9]/g, '');
    if (!token) continue;

    if (!countryCode && COUNTRY_ALIASES[token]) {
      countryCode = COUNTRY_ALIASES[token];
      continue;
    }
    if (!theme && THEME_ALIASES[token]) {
      theme = THEME_ALIASES[token];
      continue;
    }
    textTerms.push(token);
  }

  return {
    countryCode: overrides?.countryCode !== undefined ? overrides.countryCode : countryCode,
    minDays: overrides?.minDays !== undefined ? overrides.minDays : minDays,
    maxDays: overrides?.maxDays !== undefined ? overrides.maxDays : maxDays,
    theme: overrides?.theme !== undefined ? overrides.theme : theme,
    textTerms: overrides?.textTerms !== undefined ? overrides.textTerms : textTerms,
  };
}

export function searchMultiDayPlans(
  plans: MultiDayPlan[],
  query: PlanSearchQuery,
  viewer: ViewerContextP01,
): PlanSearchResult {
  const criteria = parseMultiDaySearchQuery(query.rawQuery, query.correctedCriteria);
  let excludedPrivateCount = 0;

  const matched = plans.filter((plan) => {
    if (!isPlanVisibleToViewerP01(plan, viewer)) {
      excludedPrivateCount += 1;
      return false;
    }

    if (query.sportFilter && plan.sport !== query.sportFilter) {
      return false;
    }

    if (
      criteria.countryCode &&
      plan.countryCode.toUpperCase() !== criteria.countryCode.toUpperCase()
    ) {
      return false;
    }

    if (criteria.minDays !== null && plan.daysCount < criteria.minDays) {
      return false;
    }

    if (criteria.maxDays !== null && plan.daysCount > criteria.maxDays) {
      return false;
    }

    if (criteria.theme && plan.theme !== criteria.theme) {
      return false;
    }

    if (criteria.textTerms.length > 0) {
      const haystack = normalizeToken(`${plan.title} ${plan.countryCode} ${plan.theme}`);
      if (!criteria.textTerms.every((term) => haystack.includes(term))) {
        return false;
      }
    }

    return true;
  });

  // Tri déterministe : correspondance la plus récente puis titre alphabétique
  const sorted = [...matched].sort((a, b) => {
    if (a.daysCount !== b.daysCount) {
      return a.daysCount - b.daysCount;
    }
    return a.title.localeCompare(b.title);
  });

  return {
    query,
    understoodCriteria: criteria,
    items: sorted,
    excludedPrivateCount,
  };
}
