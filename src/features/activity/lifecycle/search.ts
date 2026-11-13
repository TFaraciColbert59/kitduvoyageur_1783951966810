/**
 * Lot A02 — Recherche de séances par sport, date, lieu, tags et provenance,
 * et conservation du contexte de navigation des drawers (S2.16, K5.04..S1.24).
 *
 * Conforme à la recherche 02 (Recherche) et 14 (Drawers) :
 * - Sépare l'analyse des critères compris (`ParsedSearchCriteria`), le contrôle
 *   d'autorisation (`viewerUserId`, visibilité, suppression logique) et le classement.
 * - Permet de retirer ou corriger individuellement chaque critère compris sans
 *   panneau de filtres standard.
 * - Préserve la saisie, les critères et la position de défilement à l'ouverture
 *   et à la fermeture du drawer de détail ou d'un sous-drawer d'action.
 */

import { SPORT_FAMILIES } from '@/features/explorer-v2/sheet/sportSelection';
import type { Sport } from '@/features/explorer-v2/state/types';
import { parseTimestampMs } from './metrics';
import {
  ACTIVITY_TAG_LABELS,
  PROVENANCE_ORIGIN_LABELS,
  type ActivityProvenanceOrigin,
  type ActivitySearchResult,
  type ActivityTag,
  type DrawerNavigationContext,
  type LifecycleActivityRecord,
  type ParsedSearchCriteria,
  type SearchCriterionChip,
} from './types';

/** Normalise une chaîne pour comparaison insensible à la casse et aux accents. */
export function normalizeSearchToken(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

const SPORT_KEYWORDS: Readonly<Record<string, Sport>> = {
  rando: 'rando',
  randonnee: 'rando',
  randonnees: 'rando',
  marche: 'rando',
  trek: 'rando',
  course: 'course',
  running: 'course',
  footing: 'course',
  jogging: 'course',
  trail: 'trail',
  ultra: 'trail',
  velo: 'velo',
  cyclisme: 'velo',
  gravel: 'velo',
  vtt: 'velo',
  bikepacking: 'velo',
  kayak: 'kayak',
  canoe: 'kayak',
  pagaie: 'kayak',
  ski: 'ski',
  snowboard: 'ski',
  alpin: 'ski',
  escalade: 'escalade',
  grimpe: 'escalade',
  bloc: 'escalade',
  famille: 'famille',
  poussette: 'famille',
  balade: 'famille',
  bivouac: 'bivouac',
  campement: 'bivouac',
};

const TAG_PHRASES: ReadonlyArray<{ pattern: RegExp; tag: ActivityTag }> = [
  { pattern: /\bsortie[_\s-]+longue\b/i, tag: 'sortie_longue' },
  { pattern: /\b(trajet|velotaf|commute)\b/i, tag: 'trajet' },
  { pattern: /\b(cause|caritatif|solidarite)\b/i, tag: 'cause' },
  { pattern: /\b(competition|dossard|tag:course)\b/i, tag: 'course' },
];

const PROVENANCE_KEYWORDS: Readonly<Record<string, ActivityProvenanceOrigin>> = {
  historique: 'hike_session',
  explorer: 'activity_session',
  appareil: 'device_import',
  garmin: 'device_import',
  coros: 'device_import',
  suunto: 'device_import',
  gpx: 'gpx_import',
  manuelle: 'manual',
  manuel: 'manual',
};

const FRENCH_MONTHS: Readonly<Record<string, number>> = {
  janvier: 1,
  fevrier: 2,
  mars: 3,
  avril: 4,
  mai: 5,
  juin: 6,
  juillet: 7,
  aout: 8,
  septembre: 9,
  octobre: 10,
  novembre: 11,
  decembre: 12,
};

const STOP_WORDS: ReadonlySet<string> = new Set([
  'de',
  'du',
  'des',
  'le',
  'la',
  'les',
  'au',
  'aux',
  'en',
  'dans',
  'sur',
  'vers',
  'par',
  'pour',
  'avec',
  'et',
  'ou',
  'a',
  'seance',
  'seances',
  'sortie',
  'sorties',
]);

function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

function lastDayOfMonth(year: number, month1Based: number): number {
  return new Date(Date.UTC(year, month1Based, 0)).getUTCDate();
}

/**
 * Analyse une requête de recherche libre pour en extraire les critères compris :
 * sport, tags, plage de dates, provenance et termes de lieu/texte (S2.16).
 */
export function parseActivitySearchQuery(rawQuery: string): ParsedSearchCriteria {
  let working = normalizeSearchToken(rawQuery);
  const sports: Sport[] = [];
  const tags: ActivityTag[] = [];
  const provenanceOrigins: ActivityProvenanceOrigin[] = [];
  let dateFromIso: string | null = null;
  let dateToIso: string | null = null;
  let dateLabel: string | null = null;

  // 1. Extraction des expressions de tags multi-mots
  for (const { pattern, tag } of TAG_PHRASES) {
    if (pattern.test(working)) {
      if (!tags.includes(tag)) tags.push(tag);
      working = working.replace(pattern, ' ');
    }
  }

  // 2. Extraction d'une date exacte YYYY-MM-DD
  const exactDateMatch = working.match(/\b(20\d{2})-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])\b/);
  if (exactDateMatch) {
    const [fullDate] = exactDateMatch;
    dateFromIso = `${fullDate}T00:00:00.000Z`;
    dateToIso = `${fullDate}T23:59:59.999Z`;
    dateLabel = fullDate;
    working = working.replace(fullDate, ' ');
  }

  // 3. Extraction d'un mois YYYY-MM
  if (!dateFromIso) {
    const yearMonthMatch = working.match(/\b(20\d{2})-(0[1-9]|1[0-2])\b/);
    if (yearMonthMatch) {
      const [token, yearStr, monthStr] = yearMonthMatch;
      const year = Number(yearStr);
      const month = Number(monthStr);
      const endDay = lastDayOfMonth(year, month);
      dateFromIso = `${yearStr}-${monthStr}-01T00:00:00.000Z`;
      dateToIso = `${yearStr}-${monthStr}-${pad2(endDay)}T23:59:59.999Z`;
      dateLabel = `${yearStr}-${monthStr}`;
      working = working.replace(token, ' ');
    }
  }

  // 4. Extraction d'un mois en français + année (ex: "septembre 2026")
  if (!dateFromIso) {
    for (const [monthName, monthNum] of Object.entries(FRENCH_MONTHS)) {
      const regex = new RegExp(`\\b${monthName}\\s+(20\\d{2})\\b`, 'i');
      const match = working.match(regex);
      if (match) {
        const year = Number(match[1]);
        const monthStr = pad2(monthNum);
        const endDay = lastDayOfMonth(year, monthNum);
        dateFromIso = `${year}-${monthStr}-01T00:00:00.000Z`;
        dateToIso = `${year}-${monthStr}-${pad2(endDay)}T23:59:59.999Z`;
        dateLabel = `${monthName} ${year}`;
        working = working.replace(match[0], ' ');
        break;
      }
    }
  }

  // 5. Extraction d'une année isolée (ex: "2026")
  if (!dateFromIso) {
    const yearMatch = working.match(/\b(20\d{2})\b/);
    if (yearMatch) {
      const yearStr = yearMatch[1];
      dateFromIso = `${yearStr}-01-01T00:00:00.000Z`;
      dateToIso = `${yearStr}-12-31T23:59:59.999Z`;
      dateLabel = yearStr;
      working = working.replace(yearStr, ' ');
    }
  }

  // 6. Analyse des jetons restants (sports, provenance, lieux/texte)
  const rawTokens = working
    .split(/[\s,;]+/)
    .map((t) => t.trim())
    .filter(Boolean);

  const placeTerms: string[] = [];
  const textTerms: string[] = [];

  for (const token of rawTokens) {
    if (STOP_WORDS.has(token)) continue;

    const mappedSport = SPORT_KEYWORDS[token];
    if (mappedSport) {
      if (!sports.includes(mappedSport)) sports.push(mappedSport);
      continue;
    }

    const mappedOrigin = PROVENANCE_KEYWORDS[token];
    if (mappedOrigin) {
      if (!provenanceOrigins.includes(mappedOrigin)) {
        provenanceOrigins.push(mappedOrigin);
      }
      continue;
    }

    placeTerms.push(token);
    textTerms.push(token);
  }

  return {
    rawQuery: rawQuery.trim(),
    sports,
    tags,
    dateRange: {
      fromIso: dateFromIso,
      toIso: dateToIso,
      label: dateLabel,
    },
    placeTerms,
    provenanceOrigins,
    textTerms,
  };
}

const SPORT_LABELS: Readonly<Record<Sport, string>> = Object.fromEntries(
  SPORT_FAMILIES.map((f) => [f.sport, f.label]),
) as Record<Sport, string>;

/**
 * Construit les pastilles (chips) des critères compris pour affichage et
 * correction directe dans la barre de recherche (S2.16).
 */
export function buildSearchCriterionChips(
  criteria: ParsedSearchCriteria,
): SearchCriterionChip[] {
  const chips: SearchCriterionChip[] = [];

  for (const sport of criteria.sports) {
    chips.push({
      kind: 'sport',
      value: sport,
      label: SPORT_LABELS[sport] ?? sport,
    });
  }

  for (const tag of criteria.tags) {
    chips.push({
      kind: 'tag',
      value: tag,
      label: ACTIVITY_TAG_LABELS[tag],
    });
  }

  if (criteria.dateRange.label) {
    chips.push({
      kind: 'date',
      value: criteria.dateRange.label,
      label: `Date : ${criteria.dateRange.label}`,
    });
  }

  for (const origin of criteria.provenanceOrigins) {
    chips.push({
      kind: 'provenance',
      value: origin,
      label: PROVENANCE_ORIGIN_LABELS[origin],
    });
  }

  for (const place of criteria.placeTerms) {
    chips.push({
      kind: 'place',
      value: place,
      label: place,
    });
  }

  return chips;
}

/**
 * Permet à l'utilisateur de retirer ou corriger un critère compris sans
 * réécrire toute sa recherche (S2.16).
 */
export function removeSearchCriterion(
  criteria: ParsedSearchCriteria,
  chipToRemove: Pick<SearchCriterionChip, 'kind' | 'value'>,
): ParsedSearchCriteria {
  if (chipToRemove.kind === 'sport') {
    return {
      ...criteria,
      sports: criteria.sports.filter((s) => s !== chipToRemove.value),
    };
  }
  if (chipToRemove.kind === 'tag') {
    return {
      ...criteria,
      tags: criteria.tags.filter((t) => t !== chipToRemove.value),
    };
  }
  if (chipToRemove.kind === 'date') {
    return {
      ...criteria,
      dateRange: { fromIso: null, toIso: null, label: null },
    };
  }
  if (chipToRemove.kind === 'provenance') {
    return {
      ...criteria,
      provenanceOrigins: criteria.provenanceOrigins.filter(
        (o) => o !== chipToRemove.value,
      ),
    };
  }
  if (chipToRemove.kind === 'place' || chipToRemove.kind === 'text') {
    return {
      ...criteria,
      placeTerms: criteria.placeTerms.filter((p) => p !== chipToRemove.value),
      textTerms: criteria.textTerms.filter((t) => t !== chipToRemove.value),
    };
  }
  return criteria;
}

export interface SearchActivitiesOptions {
  /** Identifiant de l'utilisateur qui consulte (contrôle de visibilité P01/A02). */
  viewerUserId: string;
  /** Inclure les activités supprimées logiquement (uniquement pour le propriétaire, ex: corbeille 30j). */
  includeDeleted?: boolean;
  /** Numéro de séquence de requête pour écarter les réponses obsolètes (recherche 02). */
  requestSeq?: number;
  /** Limite maximale de résultats retournés (défaut : 100). */
  limit?: number;
}

/**
 * Exécute la recherche dans l'historique unifié des séances par sport, date,
 * lieu, tags et provenance (S2.16).
 */
export function searchActivities(
  records: readonly LifecycleActivityRecord[],
  queryOrCriteria: string | ParsedSearchCriteria,
  options: SearchActivitiesOptions,
): ActivitySearchResult {
  const criteria =
    typeof queryOrCriteria === 'string'
      ? parseActivitySearchQuery(queryOrCriteria)
      : queryOrCriteria;

  const requestSeq = options.requestSeq ?? 1;
  const limit =
    typeof options.limit === 'number' && options.limit > 0 ? options.limit : 100;

  const fromMs = parseTimestampMs(criteria.dateRange.fromIso);
  const toMs = parseTimestampMs(criteria.dateRange.toIso);

  const scored: Array<{ record: LifecycleActivityRecord; score: number; startedMs: number }> = [];

  for (const record of records) {
    const isOwner = record.userId === options.viewerUserId;

    // 1. Contrôle de suppression logique
    if (record.lifecycleStatus === 'deleted') {
      if (!options.includeDeleted || !isOwner) continue;
    }

    // 2. Contrôle d'autorisation / visibilité (une séance privée n'est jamais visible par un tiers)
    if (!isOwner && record.visibility === 'private') {
      continue;
    }

    // 3. Filtre Sport
    if (criteria.sports.length > 0 && !criteria.sports.includes(record.sport)) {
      continue;
    }

    // 4. Filtre Tags
    if (
      criteria.tags.length > 0 &&
      !criteria.tags.every((tag) => record.tags.includes(tag))
    ) {
      continue;
    }

    // 5. Filtre Provenance
    if (
      criteria.provenanceOrigins.length > 0 &&
      !criteria.provenanceOrigins.includes(record.provenance.origin)
    ) {
      continue;
    }

    // 6. Filtre Date
    const startedMs = parseTimestampMs(record.startedAt) ?? 0;
    if (fromMs !== null && (record.startedAt === null || startedMs < fromMs)) {
      continue;
    }
    if (toMs !== null && (record.startedAt === null || startedMs > toMs)) {
      continue;
    }

    // 7. Filtre Lieu / Texte (massif, routeName, placeLabel, title, notes)
    let score = 0;
    if (criteria.placeTerms.length > 0) {
      const searchablePlace = normalizeSearchToken(
        [record.placeLabel, record.massif, record.routeName]
          .filter(Boolean)
          .join(' '),
      );
      const searchableText = normalizeSearchToken(
        [record.title, record.notes, record.provenance.label]
          .filter(Boolean)
          .join(' '),
      );

      let allTermsMatched = true;
      for (const term of criteria.placeTerms) {
        const inPlace = searchablePlace.includes(term);
        const inText = searchableText.includes(term);
        if (!inPlace && !inText) {
          allTermsMatched = false;
          break;
        }
        if (inPlace) score += 20;
        if (inText) score += 10;
      }

      if (!allTermsMatched) continue;
    }

    if (criteria.sports.includes(record.sport)) score += 15;
    if (criteria.tags.length > 0) score += 10;
    if (fromMs !== null || toMs !== null) score += 10;

    scored.push({ record, score, startedMs });
  }

  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    if (b.startedMs !== a.startedMs) return b.startedMs - a.startedMs;
    return a.record.id.localeCompare(b.record.id);
  });

  const matched = scored.map((entry) => entry.record);

  return {
    query: criteria.rawQuery,
    criteria,
    chips: buildSearchCriterionChips(criteria),
    items: matched.slice(0, limit),
    totalMatched: matched.length,
    requestSeq,
  };
}

/**
 * Indique si une réponse de recherche est obsolète par rapport à la dernière
 * requête lancée (recherche 02).
 */
export function isSearchResponseStale(
  result: Pick<ActivitySearchResult, 'requestSeq'>,
  latestRequestSeq: number,
): boolean {
  return result.requestSeq < latestRequestSeq;
}

/**
 * Crée un contexte de navigation initial pour la liste / recherche des sorties
 * et le drawer de détail (recherche 14 & K5.04..S2.16).
 */
export function createDrawerNavigationContext(
  initialQuery = '',
): DrawerNavigationContext {
  const trimmed = initialQuery.trim();
  return {
    parentSurface: trimmed.length > 0 ? 'search_results' : 'sorties_list',
    activeActivityId: null,
    activeSubDrawer: null,
    scrollOffsetPx: 0,
    searchQuery: trimmed,
    searchCriteria: trimmed.length > 0 ? parseActivitySearchQuery(trimmed) : null,
    latestRequestSeq: 0,
  };
}

/**
 * Ouvre le drawer de détail d'une sortie en mémorisant la requête de recherche
 * et la position de défilement de la liste parente (S1.17, S2.16).
 */
export function openActivityDetailDrawer(
  ctx: DrawerNavigationContext,
  activityId: string,
  scrollOffsetPx = ctx.scrollOffsetPx,
): DrawerNavigationContext {
  return {
    ...ctx,
    parentSurface: ctx.searchQuery.trim().length > 0 ? 'search_results' : 'sorties_list',
    activeActivityId: activityId,
    activeSubDrawer: null,
    scrollOffsetPx: Math.max(0, scrollOffsetPx),
  };
}

/**
 * Ouvre un sous-drawer d'action (édition, recadrage, correction D+, suppression)
 * depuis la fiche de sortie (K5.04, K5.07, S1.20, S1.22, S1.23, S1.24).
 */
export function openActivitySubDrawer(
  ctx: DrawerNavigationContext,
  subDrawer: NonNullable<DrawerNavigationContext['activeSubDrawer']>,
): DrawerNavigationContext {
  if (!ctx.activeActivityId) return ctx;
  return {
    ...ctx,
    activeSubDrawer: subDrawer,
  };
}

/**
 * Ferme le sous-drawer courant et restaure exactement le contexte du drawer
 * parent de la fiche Sortie (K5.04, K5.07, S1.20, S1.22, S1.23, S1.24).
 */
export function closeSubDrawerAndRestoreParent(
  ctx: DrawerNavigationContext,
): DrawerNavigationContext {
  return {
    ...ctx,
    activeSubDrawer: null,
  };
}

/**
 * Ferme le drawer de détail de la sortie et restaure la recherche et la
 * position de défilement dans la liste parente (S1.17, S2.16).
 */
export function closeDetailDrawerAndRestoreList(
  ctx: DrawerNavigationContext,
): DrawerNavigationContext {
  return {
    ...ctx,
    activeActivityId: null,
    activeSubDrawer: null,
  };
}
