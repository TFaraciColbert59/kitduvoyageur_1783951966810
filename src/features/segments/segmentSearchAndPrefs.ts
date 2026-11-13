/**
 * S4.03 — Recherche, découverte par sport, favoris et masquage personnel de segments.
 *
 * Responsabilités :
 * - Analyser une requête de recherche Explorer (`parseSegmentSearchQuery`) en extrayant
 *   les contraintes comprises et corrigeables (sport, pente/montée, longueur, favoris,
 *   vérifiés, mots-clés) sans panneau de filtres générique redondant.
 * - Exécuter la recherche (`searchSegments`) dans le respect strict de P01 :
 *   aucun segment privé d'autrui, supprimé ou absorbé par dédoublonnage n'est jamais retourné.
 * - Gérer les favoris (`toggleSegmentStar`) et le masquage personnel (`hideSegmentForUser`,
 *   `unhideSegmentForUser`) depuis le menu `⋯` du segment.
 * - Conserver l'état de recherche (requête, contraintes, position de défilement) lors de
 *   l'aller-retour vers le drawer de détail du segment.
 */

import { haversineM } from '@/features/adventure-intelligence/domain/geo';
import type { GeoPoint, SegmentDefinition, SegmentSport } from './types';

export interface UserSegmentPreferences {
  userId: string;
  starredSegmentIds: string[];
  hiddenSegmentIds: string[];
}

export interface ParsedSegmentSearchQuery {
  rawQuery: string;
  keywords: string[];
  sport: SegmentSport | null;
  minGradePct: number | null;
  minLengthM: number | null;
  maxLengthM: number | null;
  onlyStarred: boolean;
  onlyVerified: boolean;
}

const SPORT_SYNONYMS: ReadonlyArray<{ pattern: RegExp; sport: SegmentSport }> = [
  { pattern: /\b(v[eé]lo|cyclisme|cycling|route)\b/i, sport: 'cycling' },
  { pattern: /\b(course|running|run|footing)\b/i, sport: 'running' },
  { pattern: /\b(trail)\b/i, sport: 'trail' },
  { pattern: /\b(rando|randonn[eé]e|hiking|hike)\b/i, sport: 'hiking' },
  { pattern: /\b(marche|walking|walk)\b/i, sport: 'walking' },
  { pattern: /\b(vtt|mtb)\b/i, sport: 'mtb' },
  { pattern: /\b(gravel)\b/i, sport: 'gravel' },
  { pattern: /\b(ski|snowboard)\b/i, sport: 'ski' },
];

/**
 * Extrait les contraintes comprises depuis la barre de recherche Explorer.
 */
export function parseSegmentSearchQuery(rawQuery: string): ParsedSegmentSearchQuery {
  let working = rawQuery.trim();
  let sport: SegmentSport | null = null;
  let minGradePct: number | null = null;
  let minLengthM: number | null = null;
  let maxLengthM: number | null = null;
  let onlyStarred = false;
  let onlyVerified = false;

  for (const entry of SPORT_SYNONYMS) {
    if (entry.pattern.test(working)) {
      sport = entry.sport;
      working = working.replace(entry.pattern, ' ');
      break;
    }
  }

  if (/\b(favoris?|starred|[eé]toil[eé]s?)\b/i.test(working)) {
    onlyStarred = true;
    working = working.replace(/\b(favoris?|starred|[eé]toil[eé]s?)\b/gi, ' ');
  }

  if (/\b(v[eé]rifi[eé]s?|verified|officiels?)\b/i.test(working)) {
    onlyVerified = true;
    working = working.replace(/\b(v[eé]rifi[eé]s?|verified|officiels?)\b/gi, ' ');
  }

  const gradeMatch = working.match(/(?:pente\s*)?>\s*(\d+(?:[.,]\d+)?)\s*%/i);
  if (gradeMatch) {
    minGradePct = Number.parseFloat(gradeMatch[1].replace(',', '.'));
    working = working.replace(gradeMatch[0], ' ');
  } else if (/\b(mont[eé]e|grimpe|climb|col|raidard)\b/i.test(working)) {
    minGradePct = 4;
    // Si "col" fait partie du nom d'un segment (ex. "Col du Galibier"), on le garde dans les mots-clés
    if (!/\bcol\b/i.test(working)) {
      working = working.replace(/\b(mont[eé]e|grimpe|climb|raidard)\b/gi, ' ');
    }
  }

  const maxKmMatch = working.match(/<\s*(\d+(?:[.,]\d+)?)\s*km\b/i);
  if (maxKmMatch) {
    maxLengthM = Number.parseFloat(maxKmMatch[1].replace(',', '.')) * 1000;
    working = working.replace(maxKmMatch[0], ' ');
  }

  const minKmMatch = working.match(/>\s*(\d+(?:[.,]\d+)?)\s*km\b/i);
  if (minKmMatch) {
    minLengthM = Number.parseFloat(minKmMatch[1].replace(',', '.')) * 1000;
    working = working.replace(minKmMatch[0], ' ');
  }

  const keywords = working
    .toLowerCase()
    .split(/\s+/)
    .map((token) => token.trim())
    .filter((token) => token.length >= 2);

  return {
    rawQuery: rawQuery.trim(),
    keywords,
    sport,
    minGradePct,
    minLengthM,
    maxLengthM,
    onlyStarred,
    onlyVerified,
  };
}

export interface SearchSegmentsOptions {
  query?: string;
  sportFilter?: SegmentSport | null;
  viewerUserId: string | null;
  preferences?: UserSegmentPreferences;
  nearCenter?: GeoPoint | null;
  maxRadiusM?: number;
  includeHidden?: boolean;
  limit?: number;
}

export interface SegmentSearchHit {
  segment: SegmentDefinition;
  isStarred: boolean;
  isHidden: boolean;
  distanceFromCenterM: number | null;
  score: number;
}

export interface SearchSegmentsResult {
  parsedQuery: ParsedSegmentSearchQuery;
  hits: SegmentSearchHit[];
  totalMatched: number;
}

/**
 * Recherche des segments selon la requête, le sport, la proximité et les préférences personnelles.
 * Garantit l'exclusion des segments privés d'autrui (P01), des doublons fusionnés et des segments masqués.
 */
export function searchSegments(
  segments: SegmentDefinition[],
  options: SearchSegmentsOptions
): SearchSegmentsResult {
  const parsed = parseSegmentSearchQuery(options.query ?? '');
  const effectiveSport = options.sportFilter ?? parsed.sport;
  const starredSet = new Set(options.preferences?.starredSegmentIds ?? []);
  const hiddenSet = new Set(options.preferences?.hiddenSegmentIds ?? []);
  const maxRadiusM = options.maxRadiusM ?? 25_000;
  const limit = options.limit ?? 50;

  const hits: SegmentSearchHit[] = [];

  for (const segment of segments) {
    // 1. Exclure les segments supprimés ou absorbés comme doublons
    if (segment.deletedAt || segment.canonicalSegmentId !== null) continue;

    // 2. Invariant P01 : un segment privé n'est visible QUE par son propriétaire
    if (segment.visibility === 'private' && segment.createdByUserId !== options.viewerUserId) {
      continue;
    }

    // 3. Masquage personnel S4.03 : exclu par défaut sauf demande explicite
    const isHidden = hiddenSet.has(segment.id);
    if (isHidden && !options.includeHidden) {
      continue;
    }

    // 4. Filtre sport
    if (effectiveSport && segment.sport !== effectiveSport) {
      continue;
    }

    // 5. Contraintes comprises dans la recherche
    const isStarred = starredSet.has(segment.id);
    if (parsed.onlyStarred && !isStarred) continue;
    if (parsed.onlyVerified && !segment.verified) continue;
    if (parsed.minGradePct !== null && segment.meanGradePct < parsed.minGradePct) continue;
    if (parsed.minLengthM !== null && segment.lengthM < parsed.minLengthM) continue;
    if (parsed.maxLengthM !== null && segment.lengthM > parsed.maxLengthM) continue;

    // 6. Proximité géographique éventuelle
    let distanceFromCenterM: number | null = null;
    if (options.nearCenter) {
      distanceFromCenterM = Math.round(haversineM(options.nearCenter, segment.startPoint));
      if (distanceFromCenterM > maxRadiusM) continue;
    }

    // 7. Correspondance textuelle sur les mots-clés
    const normalizedName = segment.name.toLowerCase();
    const normalizedSurface = (segment.surface ?? '').toLowerCase();
    let keywordMatched = true;
    let textScore = 0;

    for (const kw of parsed.keywords) {
      if (normalizedName.includes(kw)) {
        textScore += normalizedName.startsWith(kw) ? 30 : 20;
      } else if (normalizedSurface.includes(kw)) {
        textScore += 10;
      } else {
        keywordMatched = false;
        break;
      }
    }

    if (!keywordMatched) continue;

    let score = textScore;
    if (isStarred) score += 25;
    if (segment.verified) score += 15;
    if (!segment.hazardous) score += 5;
    if (distanceFromCenterM !== null) {
      score += Math.max(0, 20 * (1 - distanceFromCenterM / Math.max(1, maxRadiusM)));
    }

    hits.push({
      segment,
      isStarred,
      isHidden,
      distanceFromCenterM,
      score: Math.round(score * 100) / 100,
    });
  }

  hits.sort((a, b) => b.score - a.score || a.segment.name.localeCompare(b.segment.name));

  return {
    parsedQuery: parsed,
    hits: hits.slice(0, limit),
    totalMatched: hits.length,
  };
}

/**
 * Ajoute ou retire un segment des favoris de l'utilisateur.
 * Mettre un segment en favori le retire automatiquement des segments masqués.
 */
export function toggleSegmentStar(
  prefs: UserSegmentPreferences,
  segmentId: string
): UserSegmentPreferences {
  const isAlreadyStarred = prefs.starredSegmentIds.includes(segmentId);
  if (isAlreadyStarred) {
    return {
      ...prefs,
      starredSegmentIds: prefs.starredSegmentIds.filter((id) => id !== segmentId),
    };
  }
  return {
    ...prefs,
    starredSegmentIds: [...prefs.starredSegmentIds, segmentId],
    hiddenSegmentIds: prefs.hiddenSegmentIds.filter((id) => id !== segmentId),
  };
}

/**
 * Masque personnellement un segment pour l'utilisateur (et le retire de ses favoris).
 */
export function hideSegmentForUser(
  prefs: UserSegmentPreferences,
  segmentId: string
): UserSegmentPreferences {
  if (prefs.hiddenSegmentIds.includes(segmentId)) {
    return {
      ...prefs,
      starredSegmentIds: prefs.starredSegmentIds.filter((id) => id !== segmentId),
    };
  }
  return {
    ...prefs,
    hiddenSegmentIds: [...prefs.hiddenSegmentIds, segmentId],
    starredSegmentIds: prefs.starredSegmentIds.filter((id) => id !== segmentId),
  };
}

export function unhideSegmentForUser(
  prefs: UserSegmentPreferences,
  segmentId: string
): UserSegmentPreferences {
  return {
    ...prefs,
    hiddenSegmentIds: prefs.hiddenSegmentIds.filter((id) => id !== segmentId),
  };
}

/**
 * État de navigation de la recherche de segments (S4.03) permettant d'ouvrir
 * le drawer détail d'un segment et d'y revenir sans perdre la saisie ni la position.
 */
export interface SegmentSearchNavigationState {
  query: string;
  sportFilter: SegmentSport | null;
  scrollOffsetPx: number;
  activeSegmentDetailId: string | null;
}

export function openSegmentDetailFromSearch(
  state: SegmentSearchNavigationState,
  segmentId: string,
  scrollOffsetPx: number
): SegmentSearchNavigationState {
  return {
    ...state,
    scrollOffsetPx,
    activeSegmentDetailId: segmentId,
  };
}

export function returnToSearchFromSegmentDetail(
  state: SegmentSearchNavigationState
): SegmentSearchNavigationState {
  return {
    ...state,
    activeSegmentDetailId: null,
  };
}
