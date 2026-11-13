/**
 * Lot N01 — Démarrer depuis sa position ou rejoindre le départ (K4.03)
 * & Itinéraire routier jusqu'au point de départ (S3.12).
 *
 * Responsabilités :
 * - Évaluer la position de l'utilisateur par rapport au point de départ officiel
 *   du tracé et à l'ensemble des segments (`evaluateDepartureState`).
 * - Proposer les actions pertinentes dans le drawer « Démarrer » :
 *   - `start_at_origin` quand l'utilisateur est au départ (≤ 35 m) ;
 *   - `start_here_on_route` ou `guide_to_start` quand l'utilisateur est déjà
 *     engagé plus loin sur le tracé ;
 *   - `guide_to_start`, `guide_to_nearest_point` et `open_external_road_nav`
 *     quand l'utilisateur est éloigné du tracé.
 * - Générer les liens profonds vers les applications de navigation routière du
 *   téléphone (`buildExternalNavigationLinks` : Apple Plans, Google Maps, Waze,
 *   URI `geo:`) en refusant proprement toute coordonnée invalide ou absente.
 */

import {
  bearingDegrees,
  haversineM,
  isValidLngLat,
  routeLines,
  type LngLat,
  type RouteLine,
} from '../explorer-v2/geo/track';
import { projectPositionOnRoute } from './turnByTurn';
import type {
  DepartureActionKind,
  DepartureEvaluation,
  ExternalNavTravelMode,
  ExternalNavigationBundle,
  ExternalNavigationLink,
  ExternalNavigationTarget,
  RerouteProviderAdapter,
  Sport,
} from './types';

/** Rayon en mètres dans lequel l'utilisateur est considéré au point de départ. */
export const AT_START_RADIUS_M = 35;
/** Rayon en mètres dans lequel l'utilisateur est considéré sur le tracé (au-delà du départ). */
export const ON_ROUTE_AHEAD_RADIUS_M = 30;

export interface EvaluateDepartureOptions {
  atStartRadiusM?: number;
  onRouteRadiusM?: number;
}

/** Extrait le premier sommet valide d'un ensemble de lignes. */
export function getRouteOriginPoint(lines: readonly RouteLine[]): [number, number] | null {
  for (const line of lines) {
    for (const pt of line) {
      if (isValidLngLat(pt)) {
        return [pt[0], pt[1]];
      }
    }
  }
  return null;
}

/**
 * Évalue la situation de départ (`K4.03`) à partir de la position utilisateur
 * et de la géométrie du parcours.
 */
export function evaluateDepartureState(
  userPosition: LngLat | null | undefined,
  routeInput: readonly RouteLine[] | unknown,
  options: EvaluateDepartureOptions = {},
): DepartureEvaluation {
  const lines: readonly RouteLine[] =
    Array.isArray(routeInput) &&
    routeInput.length > 0 &&
    Array.isArray(routeInput[0]) &&
    Array.isArray((routeInput[0] as unknown[])[0])
      ? (routeInput as readonly RouteLine[])
      : routeLines(routeInput);

  const origin = getRouteOriginPoint(lines);
  if (!origin) {
    return {
      kind: 'route_unavailable',
      distanceToStartM: null,
      distanceToNearestRoutePointM: null,
      entryAlongTrackM: null,
      startPosition: null,
      nearestRoutePosition: null,
      bearingToStartDeg: null,
      bearingToNearestDeg: null,
      availableActions: [],
      recommendedAction: null,
      unavailableReason: 'Géométrie du parcours absente ou invalide.',
    };
  }

  if (!userPosition || !isValidLngLat(userPosition)) {
    return {
      kind: 'location_unavailable',
      distanceToStartM: null,
      distanceToNearestRoutePointM: null,
      entryAlongTrackM: null,
      startPosition: origin,
      nearestRoutePosition: null,
      bearingToStartDeg: null,
      bearingToNearestDeg: null,
      // Sans position GPS locale, l'ouverture du point de départ dans l'app
      // routière du téléphone reste disponible (S3.12).
      availableActions: ['open_external_road_nav'],
      recommendedAction: 'open_external_road_nav',
      unavailableReason: 'Position GPS actuelle indisponible.',
    };
  }

  const startRadius = options.atStartRadiusM ?? AT_START_RADIUS_M;
  const onRouteRadius = options.onRouteRadiusM ?? ON_ROUTE_AHEAD_RADIUS_M;

  const distToStartM = haversineM(userPosition, origin);
  const bearingToStart =
    distToStartM < 0.5 ? 0 : bearingDegrees(userPosition, origin);
  const projection = projectPositionOnRoute(userPosition, lines);

  if (!projection) {
    return {
      kind: 'route_unavailable',
      distanceToStartM: distToStartM,
      distanceToNearestRoutePointM: null,
      entryAlongTrackM: null,
      startPosition: origin,
      nearestRoutePosition: null,
      bearingToStartDeg: Number.isFinite(bearingToStart) ? bearingToStart : null,
      bearingToNearestDeg: null,
      availableActions: ['open_external_road_nav'],
      recommendedAction: 'open_external_road_nav',
      unavailableReason: 'Projection sur le parcours impossible.',
    };
  }

  // Cas 1 : l'utilisateur est au point de départ
  if (distToStartM <= startRadius) {
    return {
      kind: 'at_start',
      distanceToStartM: Math.round(distToStartM),
      distanceToNearestRoutePointM: Math.round(projection.crossTrackM),
      entryAlongTrackM: 0,
      startPosition: origin,
      nearestRoutePosition: projection.pointOnRoute,
      bearingToStartDeg: Number.isFinite(bearingToStart) ? Math.round(bearingToStart) : 0,
      bearingToNearestDeg: Math.round(projection.returnBearingDeg),
      availableActions: ['start_at_origin'],
      recommendedAction: 'start_at_origin',
      unavailableReason: null,
    };
  }

  // Cas 2 : l'utilisateur est déjà sur le tracé plus loin que le départ
  if (projection.crossTrackM <= onRouteRadius && projection.alongTrackM > startRadius) {
    const actions: DepartureActionKind[] = [
      'start_here_on_route',
      'guide_to_start',
      'open_external_road_nav',
    ];
    return {
      kind: 'on_route_ahead',
      distanceToStartM: Math.round(distToStartM),
      distanceToNearestRoutePointM: Math.round(projection.crossTrackM),
      entryAlongTrackM: Math.round(projection.alongTrackM),
      startPosition: origin,
      nearestRoutePosition: projection.pointOnRoute,
      bearingToStartDeg: Number.isFinite(bearingToStart) ? Math.round(bearingToStart) : null,
      bearingToNearestDeg: Math.round(projection.returnBearingDeg),
      availableActions: actions,
      recommendedAction: 'start_here_on_route',
      unavailableReason: null,
    };
  }

  // Cas 3 : l'utilisateur est à distance du tracé
  const actions: DepartureActionKind[] = [
    'guide_to_start',
    'guide_to_nearest_point',
    'open_external_road_nav',
  ];
  return {
    kind: 'away_from_route',
    distanceToStartM: Math.round(distToStartM),
    distanceToNearestRoutePointM: Math.round(projection.crossTrackM),
    entryAlongTrackM: Math.round(projection.alongTrackM),
    startPosition: origin,
    nearestRoutePosition: projection.pointOnRoute,
    bearingToStartDeg: Number.isFinite(bearingToStart) ? Math.round(bearingToStart) : null,
    bearingToNearestDeg: Math.round(projection.returnBearingDeg),
    availableActions: actions,
    recommendedAction: 'guide_to_start',
    unavailableReason: null,
  };
}

export interface AccessGuidancePlan {
  status: 'routed_online' | 'offline_compass_only' | 'unavailable';
  targetKind: 'origin' | 'nearest_point';
  targetPosition: [number, number] | null;
  entryAlongTrackM: number;
  directDistanceM: number | null;
  directBearingDeg: number | null;
  routedGeometry: readonly [number, number][] | null;
  routedDistanceM: number | null;
  routedDurationS: number | null;
  provider: string | null;
  reason: string | null;
}

/**
 * Construit un plan de ralliement jusqu'au départ ou au point de reprise choisi (`K4.03`).
 *
 * Invariant :
 * - En ligne avec un `providerAdapter` valide, demande un itinéraire d'approche réel.
 * - Hors ligne ou si le fournisseur refuse, ne fabrique **aucune** géométrie routière
 *   inventée : renvoie `status: 'offline_compass_only'` avec le cap et la distance
 *   à vol d'oiseau vers le point choisi.
 */
export async function buildAccessGuidancePlan(
  evaluation: DepartureEvaluation,
  userPosition: LngLat,
  choice: 'guide_to_start' | 'guide_to_nearest_point',
  options: {
    online: boolean;
    sport: Sport;
    providerAdapter?: RerouteProviderAdapter;
    signal?: AbortSignal;
  },
): Promise<AccessGuidancePlan> {
  const targetKind = choice === 'guide_to_start' ? 'origin' : 'nearest_point';
  const targetPosition =
    choice === 'guide_to_start' ? evaluation.startPosition : evaluation.nearestRoutePosition;
  const entryAlongTrackM =
    choice === 'guide_to_start' ? 0 : evaluation.entryAlongTrackM ?? 0;

  if (!targetPosition || !isValidLngLat(userPosition) || !isValidLngLat(targetPosition)) {
    return {
      status: 'unavailable',
      targetKind,
      targetPosition: null,
      entryAlongTrackM: 0,
      directDistanceM: null,
      directBearingDeg: null,
      routedGeometry: null,
      routedDistanceM: null,
      routedDurationS: null,
      provider: null,
      reason: 'Position de départ ou cible invalide.',
    };
  }

  const directDistanceM = Math.round(haversineM(userPosition, targetPosition));
  const rawBearing = bearingDegrees(userPosition, targetPosition);
  const directBearingDeg = Number.isFinite(rawBearing) ? Math.round(rawBearing) : 0;

  if (!options.online || !options.providerAdapter) {
    return {
      status: 'offline_compass_only',
      targetKind,
      targetPosition,
      entryAlongTrackM,
      directDistanceM,
      directBearingDeg,
      routedGeometry: null,
      routedDistanceM: null,
      routedDurationS: null,
      provider: null,
      reason: options.online ? 'provider_unavailable' : 'offline',
    };
  }

  try {
    const attempt = await options.providerAdapter(
      { lat: userPosition[1], lng: userPosition[0] },
      { lat: targetPosition[1], lng: targetPosition[0] },
      options.sport,
      options.signal,
    );

    if (!attempt.leg || attempt.leg.geometry.length < 2) {
      return {
        status: 'offline_compass_only',
        targetKind,
        targetPosition,
        entryAlongTrackM,
        directDistanceM,
        directBearingDeg,
        routedGeometry: null,
        routedDistanceM: null,
        routedDurationS: null,
        provider: null,
        reason: attempt.reason ?? 'provider_unavailable',
      };
    }

    return {
      status: 'routed_online',
      targetKind,
      targetPosition,
      entryAlongTrackM,
      directDistanceM,
      directBearingDeg,
      routedGeometry: attempt.leg.geometry,
      routedDistanceM: Math.round(attempt.leg.distanceM),
      routedDurationS: Math.round(attempt.leg.durationS),
      provider: attempt.leg.provider ?? null,
      reason: null,
    };
  } catch {
    return {
      status: 'offline_compass_only',
      targetKind,
      targetPosition,
      entryAlongTrackM,
      directDistanceM,
      directBearingDeg,
      routedGeometry: null,
      routedDistanceM: null,
      routedDurationS: null,
      provider: null,
      reason: 'provider_unavailable',
    };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// S3.12 — Itinéraire routier jusqu'au point de départ (applications du téléphone)
// ─────────────────────────────────────────────────────────────────────────────

function isValidLatLng(lat: unknown, lng: unknown): boolean {
  return (
    typeof lat === 'number' &&
    typeof lng === 'number' &&
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    lat >= -90 &&
    lat <= 90 &&
    lng >= -180 &&
    lng <= 180
  );
}

const APPLE_DIRFLG: Record<ExternalNavTravelMode, string> = {
  driving: 'd',
  walking: 'w',
  bicycling: 'r',
};

/**
 * Génère les liens profonds permettant d'ouvrir le point de départ dans
 * l'application de navigation du téléphone (`S3.12` : Apple Plans, Google Maps,
 * Waze, URI `geo:`).
 *
 * Renvoie `status: 'unavailable'` si les coordonnées sont absentes ou hors bornes.
 */
export function buildExternalNavigationLinks(
  target: ExternalNavigationTarget | null | undefined,
): ExternalNavigationBundle {
  if (!target || !isValidLatLng(target.lat, target.lng)) {
    return {
      status: 'unavailable',
      reason: 'Coordonnées du point de départ absentes ou invalides.',
      target: null,
      links: [],
    };
  }

  const lat = Math.round(target.lat * 1e6) / 1e6;
  const lng = Math.round(target.lng * 1e6) / 1e6;
  const mode: ExternalNavTravelMode = target.mode ?? 'driving';
  const cleanLabel = target.label?.trim() || 'Départ du parcours';
  const encodedLabel = encodeURIComponent(cleanLabel);

  const links: ExternalNavigationLink[] = [
    {
      provider: 'apple-maps',
      label: 'Plans (Apple)',
      url: `https://maps.apple.com/?daddr=${lat},${lng}&dirflg=${APPLE_DIRFLG[mode]}&q=${encodedLabel}`,
      universal: true,
    },
    {
      provider: 'google-maps',
      label: 'Google Maps',
      url: `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=${mode}`,
      universal: true,
    },
    {
      provider: 'waze',
      label: 'Waze',
      url: `https://waze.com/ul?ll=${lat},${lng}&navigate=yes`,
      universal: true,
    },
    {
      provider: 'geo-uri',
      label: 'Application GPS du téléphone',
      url: `geo:${lat},${lng}?q=${lat},${lng}(${encodedLabel})`,
      universal: false,
    },
  ];

  return {
    status: 'ready',
    reason: null,
    target: {
      lat,
      lng,
      label: cleanLabel,
      mode,
    },
    links,
  };
}
