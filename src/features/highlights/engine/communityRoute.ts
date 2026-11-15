import type {
  GeoPoint,
  RouteCommunitySummary,
  RouteCommunityTag,
  RouteObservation,
} from '../types';
import { normalizeKey, plainText } from './result';

const TAG_PATTERN = /^[a-z0-9][a-z0-9-]{1,29}$/;

export function normalizeRouteTag(tag: string): string | null {
  const normalized = normalizeKey(tag)
    .replace(/^#+/, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  if (!normalized || !TAG_PATTERN.test(normalized)) return null;
  return normalized;
}

export interface SynthesizeOptions {
  minSources?: number;
  descriptionLimit?: number;
}

/**
 * S3.24 — transforme des observations terrain en informations synthétiques.
 * Seules les observations publiées, consenties et publiques comptent. Un tag
 * n'apparaît qu'avec plusieurs sources distinctes ; aucune identité ni
 * coordonnée ne sort.
 */
export function synthesizeRouteCommunity(
  routeId: string,
  observations: readonly RouteObservation[],
  options: SynthesizeOptions = {}
): RouteCommunitySummary {
  const minSources = Math.max(1, options.minSources ?? 2);
  const eligible = observations.filter(
    (observation) =>
      observation.routeId === routeId &&
      observation.status === 'published' &&
      observation.consentAggregate &&
      observation.audience === 'public'
  );

  const byTag = new Map<string, { count: number; users: Set<string> }>();
  for (const observation of eligible) {
    for (const raw of observation.tags) {
      const tag = normalizeRouteTag(raw);
      if (!tag) continue;
      const entry = byTag.get(tag) ?? { count: 0, users: new Set<string>() };
      entry.count += 1;
      entry.users.add(observation.userId);
      byTag.set(tag, entry);
    }
  }

  const tags: RouteCommunityTag[] = [...byTag.entries()]
    .filter(([, entry]) => entry.users.size >= minSources)
    .map(([tag, entry]) => ({ tag, count: entry.count, sources: entry.users.size }))
    .sort((a, b) => b.sources - a.sources || b.count - a.count || a.tag.localeCompare(b.tag));

  const latestTexts = eligible
    .slice()
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .map((observation) => plainText(observation.text, 220))
    .filter((text) => text.length >= 10)
    .filter((text, index, list) => list.indexOf(text) === index)
    .slice(0, 3);

  const description = latestTexts.length > 0 ? latestTexts.join(' · ').slice(0, 600) : null;
  const updatedAt =
    eligible.length > 0
      ? eligible.reduce(
          (latest, observation) =>
            observation.createdAt > latest ? observation.createdAt : latest,
          eligible[0].createdAt
        )
      : null;

  return {
    routeId,
    tags,
    description,
    updatedAt,
    sourceCount: new Set(eligible.map((observation) => observation.userId)).size,
  };
}

/** Arrondi grossier pour un affichage public qui n'a pas besoin du point exact. */
export function coarseArea(point: GeoPoint, decimals = 2): GeoPoint {
  const factor = 10 ** decimals;
  return {
    lat: Math.round(point.lat * factor) / factor,
    lng: Math.round(point.lng * factor) / factor,
  };
}
