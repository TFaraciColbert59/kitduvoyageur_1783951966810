/**
 * Phase 4 — Étape 4 du pipeline : validation des géométries.
 *
 * Sans bibliothèque géométrique externe : on valide la séquence de points et
 * on détecte les ruptures (sauts anormaux). Une rupture est « injustifiée »
 * si le tag `break_reason` est absent — elle invalide alors le parcours.
 */
import type { LatLng, NormalizedRoute } from './types';
import { haversineMeters } from './metrics';

export interface RouteValidation {
  valid: boolean;
  errors: string[];
  warnings: string[];
  /** Nombre de sauts > maxJumpM. */
  breaks: number;
  /** Parmi eux, sauts sans justification (`break_reason`). */
  unjustifiedBreaks: number;
}

export interface RoutesValidationReport {
  validRoutes: NormalizedRoute[];
  invalidRoutes: NormalizedRoute[];
  results: Map<string, RouteValidation>;
  unjustifiedBreaks: number;
  totalBreaks: number;
}

const DEFAULT_MAX_JUMP_M = 50_000;
const DEGENERATE_DISTANCE_M = 0.5;

export function validateRoute(
  route: NormalizedRoute,
  options: { maxJumpM?: number } = {}
): RouteValidation {
  const maxJumpM = options.maxJumpM ?? DEFAULT_MAX_JUMP_M;
  const errors: string[] = [];
  const warnings: string[] = [];
  let breaks = 0;
  let unjustifiedBreaks = 0;

  if (!route.externalId) errors.push('Identifiant externe absent.');
  if (route.points.length < 2) {
    errors.push('Géométrie invalide : au moins 2 points requis.');
  }

  for (let index = 0; index < route.points.length; index += 1) {
    const point = route.points[index];
    if (
      !Number.isFinite(point.lat) ||
      !Number.isFinite(point.lng) ||
      point.lat < -90 ||
      point.lat > 90 ||
      point.lng < -180 ||
      point.lng > 180
    ) {
      errors.push(`Point #${index} hors bornes géographiques.`);
    }
  }

  let totalMeters = 0;
  for (let index = 1; index < route.points.length; index += 1) {
    const previous = route.points[index - 1];
    const current = route.points[index];
    const distance = haversineMeters(previous, current);
    totalMeters += distance;

    if (distance < DEGENERATE_DISTANCE_M) {
      warnings.push(`Point #${index} confondu avec le précédent (nettoyage/déduplication).`);
      continue;
    }
    if (distance > maxJumpM) {
      breaks += 1;
      const justified = Boolean(route.tags.break_reason);
      if (!justified) {
        unjustifiedBreaks += 1;
        errors.push(
          `Rupture injustifiée entre les points #${index - 1} et #${index} (${Math.round(distance / 1000)} km).`
        );
      } else {
        warnings.push(
          `Rupture justifiée (${route.tags.break_reason}) entre #${index - 1} et #${index}.`
        );
      }
    }
  }

  if (totalMeters === 0 && route.points.length >= 2) {
    errors.push('Géométrie dégénérée : distance totale nulle.');
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    breaks,
    unjustifiedBreaks,
  };
}

export function validateRoutes(
  routes: readonly NormalizedRoute[],
  options: { maxJumpM?: number } = {}
): RoutesValidationReport {
  const validRoutes: NormalizedRoute[] = [];
  const invalidRoutes: NormalizedRoute[] = [];
  const results = new Map<string, RouteValidation>();
  let unjustifiedBreaks = 0;
  let totalBreaks = 0;

  for (const route of routes) {
    const result = validateRoute(route, options);
    results.set(route.externalId, result);
    unjustifiedBreaks += result.unjustifiedBreaks;
    totalBreaks += result.breaks;
    if (result.valid) validRoutes.push(route);
    else invalidRoutes.push(route);
  }

  return { validRoutes, invalidRoutes, results, unjustifiedBreaks, totalBreaks };
}

/** Géométrie « valide » au sens de la couverture : séquence vérifiée. */
export function countValidGeometries(routes: readonly NormalizedRoute[]): number {
  return validateRoutes(routes).validRoutes.length;
}

export type { LatLng };
