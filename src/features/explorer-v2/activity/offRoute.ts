/**
 * Hors-itinéraire (04_CARTE.md §4).
 *
 * Règle produit : distance à la trace > 40 m **pendant plus de 15 s** →
 * « hors itinéraire » ; retour sous 25 m → « revenu sur la trace ».
 * L'écart d'hystérésis (40 / 25) évite le clignotement quand on longe la trace.
 *
 * Fonction pure et testable : aucun accès GPS ici, seulement des mesures.
 */

export const OFF_ROUTE_M = 40;
export const OFF_ROUTE_SECONDS = 15;
export const BACK_ON_ROUTE_M = 25;

export interface OffRouteSample {
  /** Horodatage en millisecondes. */
  t: number;
  /** Distance signée à la trace, en mètres (valeur absolue utilisée). */
  distanceM: number;
}

export interface OffRouteState {
  offRoute: boolean;
  /** Distance courante à la trace (m). */
  distanceM: number;
  /** Depuis combien de secondes on est au-delà du seuil. */
  outSinceS: number;
}

/** Évalue la règle sur l'historique (ordre chronologique attendu). */
export function evaluateOffRoute(
  samples: OffRouteSample[],
  previous: OffRouteState = { offRoute: false, distanceM: 0, outSinceS: 0 },
): OffRouteState {
  if (samples.length === 0) return previous;
  const last = samples[samples.length - 1];
  const distance = Math.abs(last.distanceM);

  if (previous.offRoute) {
    if (distance <= BACK_ON_ROUTE_M) {
      return { offRoute: false, distanceM: distance, outSinceS: 0 };
    }
    return { ...previous, distanceM: distance };
  }

  if (distance <= OFF_ROUTE_M) {
    return { offRoute: false, distanceM: distance, outSinceS: 0 };
  }

  // On cherche depuis quand on est sorti sans discontinuer.
  let startedAt = last.t;
  for (let i = samples.length - 1; i >= 0; i -= 1) {
    if (Math.abs(samples[i].distanceM) <= OFF_ROUTE_M) break;
    startedAt = samples[i].t;
  }
  const outSinceS = (last.t - startedAt) / 1000;
  return {
    offRoute: outSinceS >= OFF_ROUTE_SECONDS,
    distanceM: distance,
    outSinceS,
  };
}

/** Libellé de la carte du haut quand on est hors trace. */
export function offRouteLabel(distanceM: number): string {
  return `Hors itinéraire · ${Math.round(distanceM)} m`;
}
