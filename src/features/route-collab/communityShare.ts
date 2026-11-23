import { simplifyRouteGeometry } from '@/features/adventure-prep/routeRevision';
import { publishedRevisionOf } from './integrations';
import { DEFAULT_PRIVATE_START_RADIUS_M, sanitizeWorkspaceForShareLink } from './shareSanitize';
import type { RouteWorkspaceState } from './types';

/**
 * Publier le tracé dans la communauté (post, story, carnet lié), 10.9. Module pur, testé.
 *
 * RGPD (CLAUDE.md §2 : aucune coordonnée exposée par un kit ou une empreinte partagés) : on ne publie JAMAIS le
 * tracé brut. La VERSION PUBLIÉE de l'espace passe par `sanitizeWorkspaceForShareLink` (même règle que le lien
 * partagé : zone de départ, et d'arrivée d'une boucle, masquée sur 200 m minimum — 500 m par défaut —, nuits,
 * notes, sac, membres et jetons absents), puis la ligne est décimée. Le départ et l'arrivée exacts, le lieu de
 * nuit, le voyage (`tripId`) et la position (`place_lat/lng`) ne sortent jamais. Sans version publiée, rien
 * n'est publié.
 */
export const COMMUNITY_SHARE_MAX_POINTS = 150;

export interface PublicRouteShare {
  readonly title: string;
  readonly sport: RouteWorkspaceState['sport'];
  readonly distanceKm: number;
  readonly ascentM: number | null;
  readonly stagesCount: number;
  readonly revisionNo: number;
  readonly startMasked: true;
  readonly radiusM: number;
  /** Ligne assainie et décimée, [lon, lat] ; vide si tout le tracé est dans la zone privée. */
  readonly line: ReadonlyArray<readonly [number, number]>;
}

export function buildPublicRouteShare(
  workspace: RouteWorkspaceState,
  radiusM: number = DEFAULT_PRIVATE_START_RADIUS_M,
): PublicRouteShare | null {
  const rev = publishedRevisionOf(workspace);
  if (!rev) return null;
  // L'état partagé est celui de la version publiée (pas du brouillon en cours).
  const safe = sanitizeWorkspaceForShareLink(
    { ...workspace, points: rev.points, sections: rev.sections, stages: rev.stages, shareLink: null },
    radiusM,
  );
  const coords = safe.sections.flatMap((s) => s.geometry.coordinates);
  const line = coords.length >= 2 ? simplifyRouteGeometry({ type: 'LineString', coordinates: coords }, COMMUNITY_SHARE_MAX_POINTS).coordinates : [];
  const ascent = safe.sections.map((s) => s.ascentM);
  return {
    title: safe.title || 'Itinéraire',
    sport: safe.sport,
    distanceKm: Number(safe.sections.reduce((acc, s) => acc + s.distanceKm, 0).toFixed(1)),
    ascentM: ascent.length > 0 && ascent.every((a) => a != null) ? Math.round(ascent.reduce<number>((a, v) => a + (v ?? 0), 0)) : null,
    stagesCount: safe.stages.length,
    revisionNo: rev.revisionNo,
    startMasked: true,
    radiusM: Math.max(200, radiusM),
    line: line.map(([lon, lat]) => [Number(lon.toFixed(5)), Number(lat.toFixed(5))] as const),
  };
}

export interface CommunityPostOptions {
  readonly audience: 'public' | 'abonnies' | 'club';
  readonly clubId?: string | null;
  readonly caption?: string;
  readonly linkedCarnetId?: string | null;
  readonly clientRequestId?: string | null;
}

/** Charge utile de la RPC `create_community_post` (`p`). Jamais de `place_lat` / `place_lng`. */
export function toCommunityPostPayload(share: PublicRouteShare, options: CommunityPostOptions): Record<string, unknown> {
  const km = share.distanceKm.toLocaleString('fr-FR', { maximumFractionDigits: 1 });
  const facts = [`${km} km`, share.ascentM != null ? `${share.ascentM} m D+` : null, share.stagesCount > 0 ? `${share.stagesCount} étape${share.stagesCount > 1 ? 's' : ''}` : null]
    .filter(Boolean)
    .join(' · ');
  const caption = (options.caption ?? '').trim().slice(0, 2000);
  const content = [`**${share.title}**`, facts, caption].filter(Boolean).join('\n\n');
  return {
    content,
    post_type: 'share',
    audience: options.audience,
    ...(options.audience === 'club' && options.clubId ? { club_id: options.clubId } : {}),
    ...(options.linkedCarnetId ? { linked_carnet_id: options.linkedCarnetId } : {}),
    ...(options.clientRequestId ? { client_request_id: options.clientRequestId } : {}),
    media_urls: [],
    creation_meta: {
      created_from: 'route_collab',
      format: 'billet',
      title: share.title,
      route: {
        sport: share.sport,
        distance_km: share.distanceKm,
        ascent_m: share.ascentM,
        stages: share.stagesCount,
        revision: share.revisionNo,
        start_masked: true,
        radius_m: share.radiusM,
        line: share.line,
      },
    },
  };
}

/** Pastille de story : distance seulement, aucun lieu (`place` reste `null`, jamais le départ). */
export function toStoryRouteSticker(share: PublicRouteShare): { distanceKm: number; place: null; altitudeM: null } {
  return { distanceKm: share.distanceKm, place: null, altitudeM: null };
}

/* ---------- 10.9 : story et carnet, mêmes règles que le post ---------- */

export interface CommunityTargets {
  readonly post: boolean;
  readonly story: boolean;
  readonly carnet: boolean;
}

export const DEFAULT_COMMUNITY_TARGETS: CommunityTargets = { post: true, story: false, carnet: false };

/** Visibilité de `create_carnet_v2` : un carnet n'a pas d'audience club, il reste alors privé (jamais élargi au public). */
export function carnetVisibilityFor(audience: CommunityPostOptions['audience']): 'public' | 'friends' | 'private' {
  return audience === 'public' ? 'public' : audience === 'abonnies' ? 'friends' : 'private';
}

/** Visibilité de `post_stories` : `club` existe côté story (avec `club_id`), `abonnies` s'écrit `followers`. */
export function storyVisibilityFor(audience: CommunityPostOptions['audience']): 'public' | 'followers' | 'club' {
  return audience === 'public' ? 'public' : audience === 'abonnies' ? 'followers' : 'club';
}

function factsOf(share: PublicRouteShare): string {
  const km = share.distanceKm.toLocaleString('fr-FR', { maximumFractionDigits: 1 });
  return [`${km} km`, share.ascentM != null ? `${share.ascentM} m D+` : null, share.stagesCount > 0 ? `${share.stagesCount} étape${share.stagesCount > 1 ? 's' : ''}` : null]
    .filter(Boolean)
    .join(' · ');
}

/**
 * Charge utile de `create_carnet_v2` : le tracé assaini et décimé seulement (`map_points.trace`). Ni `start_lat` /
 * `start_lng`, ni lieu de départ ou d'arrivée, ni nuits, ni moments, ni médias, ni collaborateurs. La destination
 * (obligatoire) reprend le titre : aucun lieu n'est déduit du tracé.
 */
export function toCarnetPayload(share: PublicRouteShare, options: CommunityPostOptions): Record<string, unknown> {
  const caption = (options.caption ?? '').trim().slice(0, 2000);
  return {
    title: share.title.slice(0, 140),
    destination: share.title.slice(0, 120),
    description: [factsOf(share), caption].filter(Boolean).join('\n\n'),
    visibility: carnetVisibilityFor(options.audience),
    distance_km: share.distanceKm,
    denivele_m: share.ascentM,
    tags: ['itineraire'],
    map_points: { trace: share.line, days: [] },
    is_collaborative: false,
    collaborators: [],
    moments: [],
    media: [],
    nights: [],
    post: { enabled: false },
    ...(options.clientRequestId ? { client_request_id: `${options.clientRequestId}:carnet` } : {}),
  };
}

/**
 * Ligne `post_stories` d'une story texte (24 h) : titre posé et pastille de distance, rien d'autre. Pas de lieu
 * (`toStoryRouteSticker.place` reste `null`), pas de coordonnée, pas de média.
 */
export function toStoryRow(
  share: PublicRouteShare,
  options: CommunityPostOptions,
  authorId: string,
  storyId: string,
  carnetId: string | null,
): Record<string, unknown> {
  const sticker = toStoryRouteSticker(share);
  return {
    id: storyId,
    author_id: authorId,
    image_url: null,
    storage_bucket: null,
    storage_path: null,
    media_type: 'text',
    composition: [
      { type: 'text', text: share.title.slice(0, 120), x: 0.5, y: 0.4, scale: 1, rotation: 0, style: 'clair' },
      { type: 'sticker', kind: 'distance', value: sticker.distanceKm },
    ],
    composition_version: 2,
    status: 'ready',
    caption: null,
    visibility: storyVisibilityFor(options.audience),
    ...(options.audience === 'club' && options.clubId ? { club_id: options.clubId } : {}),
    reply_policy: 'everyone',
    allow_reshare: false,
    alt_text: null,
    linked_carnet_id: carnetId,
    linked_carnet_day: null,
    ...(options.clientRequestId ? { client_request_id: `${options.clientRequestId}:story` } : {}),
  };
}
