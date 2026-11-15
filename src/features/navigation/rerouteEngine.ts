/**
 * Lot N01 — Recalcul automatique en ligne après déviation & retour hors ligne (K4.05).
 *
 * Invariants :
 * - Séparation stricte entre le recalcul connecté (via un `RerouteProviderAdapter`
 *   explicite) et l'indication de retour hors réseau (`offline_return_only`).
 * - Aucun routage ni géométrie de détour n'est inventé quand le réseau ou le
 *   service est absent/indisponible.
 * - Recherche d'un point de jonction **en avant** sur le tracé (`findForwardJunctionPoint`)
 *   pour éviter de ramener l'utilisateur en arrière.
 * - Protection des coûts API : anti-rebond temporel (`REROUTE_COOLDOWN_MS`) et
 *   spatial (`MIN_REROUTE_DISPLACEMENT_M`).
 * - Retrait automatique de l'état temporaire dès le retour sur la trace (`!offRoute`).
 */

import { bearingLabel, offRouteLabel, screenBearingDeg } from '../explorer-v2/activity/offRoute';
import {
  bearingDegrees,
  haversineM,
  isValidLngLat,
  type LngLat,
  type RouteLine,
} from '../explorer-v2/geo/track';
import { flattenRouteVertices, projectPositionOnRoute } from './turnByTurn';
import type {
  NavigationUnits,
  RerouteFailureReason,
  RerouteProviderAdapter,
  RerouteState,
  Sport,
} from './types';
import { formatNavigationDistance } from './unitsAndOrientation';

/** Distance d'anticipation en avant sur la trace pour le point de jonction (m). */
export const DEFAULT_JUNCTION_LOOKAHEAD_M = 160;
/** Délai minimal entre deux requêtes de recalcul en ligne (ms). */
export const REROUTE_COOLDOWN_MS = 15_000;
/** Déplacement minimal depuis le dernier recalcul pour relancer un appel réseau (m). */
export const MIN_REROUTE_DISPLACEMENT_M = 25;
/** Tolérance maximale d'accrochage à la jonction (m), alignée sur `routingService.ts`. */
export const JUNCTION_ARRIVAL_TOLERANCE_M = 500;

export function createInitialRerouteState(): RerouteState {
  return {
    status: 'on_route',
    deviationDistanceM: 0,
    returnBearingDeg: null,
    screenBearingDeg: null,
    junctionPoint: null,
    junctionAlongTrackM: null,
    detourGeometry: null,
    mergedRouteGeometry: null,
    provider: null,
    failureReason: null,
    lastAttemptAtMs: null,
    bannerLabel: '',
  };
}

export interface ForwardJunctionResult {
  junctionPoint: [number, number];
  junctionAlongTrackM: number;
  nearestPoint: [number, number];
  nearestAlongTrackM: number;
  crossTrackM: number;
}

/**
 * Trouve un point de jonction en avant sur le tracé à partir de la projection
 * courante de l'utilisateur (`lookaheadM` mètres en aval du point projeté,
 * plafonné à l'arrivée du parcours).
 */
export function findForwardJunctionPoint(
  userPosition: LngLat,
  lines: readonly RouteLine[],
  options: {
    previousAlongTrackM?: number | null;
    lookaheadM?: number;
  } = {},
): ForwardJunctionResult | null {
  const projection = projectPositionOnRoute(
    userPosition,
    lines,
    options.previousAlongTrackM ?? null,
  );
  if (!projection) return null;

  const vertices = flattenRouteVertices(lines);
  if (vertices.length < 2) return null;

  const totalLengthM = vertices[vertices.length - 1].alongTrackM;
  const lookaheadM =
    typeof options.lookaheadM === 'number' && Number.isFinite(options.lookaheadM) && options.lookaheadM >= 0
      ? options.lookaheadM
      : DEFAULT_JUNCTION_LOOKAHEAD_M;

  const targetAlongM = Math.min(totalLengthM, projection.alongTrackM + lookaheadM);

  // Interpoler la position exacte à `targetAlongM`
  let junctionPoint: [number, number] = vertices[vertices.length - 1].position;
  for (let i = 1; i < vertices.length; i += 1) {
    const a = vertices[i - 1];
    const b = vertices[i];
    if (targetAlongM <= b.alongTrackM + 1e-6) {
      const span = b.alongTrackM - a.alongTrackM;
      const ratio = span > 0 ? Math.max(0, Math.min(1, (targetAlongM - a.alongTrackM) / span)) : 0;
      junctionPoint = [
        a.position[0] + (b.position[0] - a.position[0]) * ratio,
        a.position[1] + (b.position[1] - a.position[1]) * ratio,
      ];
      break;
    }
  }

  return {
    junctionPoint,
    junctionAlongTrackM: Math.round(targetAlongM * 10) / 10,
    nearestPoint: projection.pointOnRoute,
    nearestAlongTrackM: Math.round(projection.alongTrackM * 10) / 10,
    crossTrackM: projection.crossTrackM,
  };
}

/**
 * Assemble le tracé de détour recalculé avec la portion restante du tracé
 * d'origine au-delà de `junctionAlongTrackM`.
 */
export function spliceDetourWithRemainingRoute(
  detourGeometry: readonly [number, number][],
  originalLines: readonly RouteLine[],
  junctionAlongTrackM: number,
): [number, number][] {
  const out: [number, number][] = detourGeometry
    .filter((pt) => isValidLngLat(pt))
    .map((pt) => [pt[0], pt[1]]);

  const vertices = flattenRouteVertices(originalLines);
  for (const v of vertices) {
    if (v.alongTrackM > junctionAlongTrackM + 2) {
      out.push([v.position[0], v.position[1]]);
    }
  }
  return out;
}

/** Construit le libellé de bandeau hors-itinéraire / recalcul selon l'état et les unités. */
export function formatRerouteBannerLabel(
  status: RerouteState['status'],
  deviationM: number,
  returnBearingDeg: number | null,
  units: NavigationUnits = 'metric',
): string {
  if (status === 'on_route') return '';
  const distStr =
    units === 'imperial'
      ? formatNavigationDistance(deviationM, 'imperial')
      : `${Math.round(deviationM)} m`;
  const cardinal = bearingLabel(returnBearingDeg);
  const capSuffix = cardinal ? ` · cap ${cardinal}` : '';

  switch (status) {
    case 'recalculating_online':
      return `Hors itinéraire (${distStr}) · Recalcul en cours…`;
    case 'recalculated':
      return `Itinéraire recalculé · retour au tracé`;
    case 'offline_return_only':
      return `${offRouteLabel(deviationM)}${capSuffix} (hors ligne)`;
    case 'reroute_failed':
      return `${offRouteLabel(deviationM)}${capSuffix}`;
    case 'off_route_pending':
    default:
      return `${offRouteLabel(deviationM)}${capSuffix}`;
  }
}

export interface RerouteEvaluationInput {
  userPosition: LngLat;
  offRoute: boolean;
  lines: readonly RouteLine[];
  sport: Sport;
  online: boolean;
  nowMs?: number;
  mapBearingDeg?: number | null;
  units?: NavigationUnits;
  lookaheadM?: number;
  cooldownMs?: number;
  providerAdapter?: RerouteProviderAdapter;
  signal?: AbortSignal;
}

/**
 * Contrôleur de recalcul hors-itinéraire (`K4.05`) :
 * - Réinitialise immédiatement l'état à `'on_route'` quand `offRoute === false`.
 * - En mode hors ligne ou sans `providerAdapter`, fournit un état `'offline_return_only'`
 *   avec le cap de retour compensé pour l'écran (`screenBearingDeg`) et la jonction.
 * - En mode connecté, appelle le routeur vers le point de jonction en avant
 *   en respectant le cooldown et la tolérance d'accrochage.
 */
export class RerouteController {
  private state: RerouteState = createInitialRerouteState();
  private lastAttemptPosition: [number, number] | null = null;
  private activeAbortController: AbortController | null = null;

  public get currentState(): RerouteState {
    return { ...this.state };
  }

  /** Réinitialise complètement l'état (retour sur trace ou changement de parcours K4.10). */
  public reset(): RerouteState {
    if (this.activeAbortController) {
      this.activeAbortController.abort();
      this.activeAbortController = null;
    }
    this.lastAttemptPosition = null;
    this.state = createInitialRerouteState();
    return this.currentState;
  }

  public async evaluate(input: RerouteEvaluationInput): Promise<RerouteState> {
    const units = input.units ?? 'metric';
    const nowMs = input.nowMs ?? Date.now();

    if (!input.offRoute) {
      if (this.state.status !== 'on_route') {
        return this.reset();
      }
      return this.currentState;
    }

    const junction = findForwardJunctionPoint(input.userPosition, input.lines, {
      lookaheadM: input.lookaheadM,
    });

    if (!junction) {
      this.state = {
        status: 'reroute_failed',
        deviationDistanceM: 0,
        returnBearingDeg: null,
        screenBearingDeg: null,
        junctionPoint: null,
        junctionAlongTrackM: null,
        detourGeometry: null,
        mergedRouteGeometry: null,
        provider: null,
        failureReason: 'no_forward_junction',
        lastAttemptAtMs: nowMs,
        bannerLabel: 'Hors itinéraire',
      };
      return this.currentState;
    }

    const rawBearing = bearingDegrees(input.userPosition, junction.nearestPoint);
    const returnBearingDeg = Number.isFinite(rawBearing) ? Math.round(rawBearing) : null;
    const compensatedBearing = screenBearingDeg(returnBearingDeg, input.mapBearingDeg ?? 0);
    const deviationM = Math.round(junction.crossTrackM);

    // Hors ligne ou sans adaptateur : indication de retour pure, aucun routage inventé
    if (!input.online || !input.providerAdapter) {
      const reason: RerouteFailureReason = !input.online ? 'offline' : 'provider_unavailable';
      this.state = {
        status: 'offline_return_only',
        deviationDistanceM: deviationM,
        returnBearingDeg,
        screenBearingDeg: compensatedBearing !== null ? Math.round(compensatedBearing) : null,
        junctionPoint: junction.junctionPoint,
        junctionAlongTrackM: junction.junctionAlongTrackM,
        detourGeometry: null,
        mergedRouteGeometry: null,
        provider: null,
        failureReason: reason,
        lastAttemptAtMs: this.state.lastAttemptAtMs,
        bannerLabel: formatRerouteBannerLabel(
          'offline_return_only',
          deviationM,
          returnBearingDeg,
          units,
        ),
      };
      return this.currentState;
    }

    // Cooldown et déplacement minimal si un recalcul a déjà été tenté récemment
    const cooldownMs = input.cooldownMs ?? REROUTE_COOLDOWN_MS;
    if (
      this.state.lastAttemptAtMs !== null &&
      nowMs - this.state.lastAttemptAtMs < cooldownMs &&
      this.lastAttemptPosition !== null &&
      haversineM(this.lastAttemptPosition, input.userPosition) < MIN_REROUTE_DISPLACEMENT_M
    ) {
      // Conserver le résultat déjà recalculé s'il existe, en mettant à jour les caps/distances
      const keptStatus =
        this.state.status === 'recalculated' ? 'recalculated' : 'off_route_pending';
      this.state = {
        ...this.state,
        status: keptStatus,
        deviationDistanceM: deviationM,
        returnBearingDeg,
        screenBearingDeg: compensatedBearing !== null ? Math.round(compensatedBearing) : null,
        failureReason:
          keptStatus === 'recalculated' ? null : this.state.failureReason ?? 'cooldown_active',
        bannerLabel: formatRerouteBannerLabel(keptStatus, deviationM, returnBearingDeg, units),
      };
      return this.currentState;
    }

    if (this.activeAbortController) {
      this.activeAbortController.abort();
    }
    const controller = new AbortController();
    this.activeAbortController = controller;
    if (input.signal) {
      input.signal.addEventListener('abort', () => controller.abort(), { once: true });
    }

    this.lastAttemptPosition = [input.userPosition[0], input.userPosition[1]];
    this.state = {
      ...this.state,
      status: 'recalculating_online',
      deviationDistanceM: deviationM,
      returnBearingDeg,
      screenBearingDeg: compensatedBearing !== null ? Math.round(compensatedBearing) : null,
      junctionPoint: junction.junctionPoint,
      junctionAlongTrackM: junction.junctionAlongTrackM,
      lastAttemptAtMs: nowMs,
      bannerLabel: formatRerouteBannerLabel(
        'recalculating_online',
        deviationM,
        returnBearingDeg,
        units,
      ),
    };

    try {
      const attempt = await input.providerAdapter(
        { lat: input.userPosition[1], lng: input.userPosition[0] },
        { lat: junction.junctionPoint[1], lng: junction.junctionPoint[0] },
        input.sport,
        controller.signal,
      );

      if (controller.signal.aborted) {
        this.state = {
          ...this.state,
          status: 'reroute_failed',
          failureReason: 'aborted',
          bannerLabel: formatRerouteBannerLabel('reroute_failed', deviationM, returnBearingDeg, units),
        };
        return this.currentState;
      }

      if (!attempt.leg || attempt.leg.geometry.length < 2) {
        const failureReason: RerouteFailureReason = attempt.reason ?? 'provider_unavailable';
        this.state = {
          ...this.state,
          status: 'reroute_failed',
          detourGeometry: null,
          mergedRouteGeometry: null,
          provider: null,
          failureReason,
          bannerLabel: formatRerouteBannerLabel('reroute_failed', deviationM, returnBearingDeg, units),
        };
        return this.currentState;
      }

      // Vérifier que l'extrémité du détour rejoint bien la jonction à <= JUNCTION_ARRIVAL_TOLERANCE_M
      const detourEnd = attempt.leg.geometry[attempt.leg.geometry.length - 1];
      const arrivalGapM = haversineM(detourEnd, junction.junctionPoint);
      if (!Number.isFinite(arrivalGapM) || arrivalGapM > JUNCTION_ARRIVAL_TOLERANCE_M) {
        this.state = {
          ...this.state,
          status: 'reroute_failed',
          detourGeometry: null,
          mergedRouteGeometry: null,
          provider: null,
          failureReason: 'off_network',
          bannerLabel: formatRerouteBannerLabel('reroute_failed', deviationM, returnBearingDeg, units),
        };
        return this.currentState;
      }

      const merged = spliceDetourWithRemainingRoute(
        attempt.leg.geometry,
        input.lines,
        junction.junctionAlongTrackM,
      );
      const detourFirstNext = attempt.leg.geometry[1];
      const detourBearing = bearingDegrees(input.userPosition, detourFirstNext);
      const effectiveBearing = Number.isFinite(detourBearing)
        ? Math.round(detourBearing)
        : returnBearingDeg;
      const effectiveScreenBearing = screenBearingDeg(
        effectiveBearing,
        input.mapBearingDeg ?? 0,
      );

      this.state = {
        status: 'recalculated',
        deviationDistanceM: deviationM,
        returnBearingDeg: effectiveBearing,
        screenBearingDeg:
          effectiveScreenBearing !== null ? Math.round(effectiveScreenBearing) : null,
        junctionPoint: junction.junctionPoint,
        junctionAlongTrackM: junction.junctionAlongTrackM,
        detourGeometry: attempt.leg.geometry,
        mergedRouteGeometry: merged,
        provider: attempt.leg.provider ?? 'online',
        failureReason: null,
        lastAttemptAtMs: nowMs,
        bannerLabel: formatRerouteBannerLabel('recalculated', deviationM, effectiveBearing, units),
      };
      return this.currentState;
    } catch {
      this.state = {
        ...this.state,
        status: 'reroute_failed',
        detourGeometry: null,
        mergedRouteGeometry: null,
        provider: null,
        failureReason: 'provider_unavailable',
        bannerLabel: formatRerouteBannerLabel('reroute_failed', deviationM, returnBearingDeg, units),
      };
      return this.currentState;
    } finally {
      if (this.activeAbortController === controller) {
        this.activeAbortController = null;
      }
    }
  }
}
