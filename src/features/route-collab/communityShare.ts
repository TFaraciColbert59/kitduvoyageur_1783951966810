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
