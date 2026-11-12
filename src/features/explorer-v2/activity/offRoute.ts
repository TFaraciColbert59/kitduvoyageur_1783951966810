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

/**
 * Fenêtre d'historique du hors-trace, en millisecondes.
 *
 * Elle est **temporelle**, pas un nombre d'échantillons : à 4 Hz, 40 fixes ne
 * couvrent que 9,75 s et ne peuvent jamais atteindre les 15 s requises. 60 s
 * laissent deux fois la marge nécessaire, quelle que soit la fréquence GPS.
 */
export const OFF_ROUTE_WINDOW_MS = 60_000;

/**
 * Élague l'historique par temps autour du dernier point. Le tri est garanti
 * par l'appelant (instants effectifs monotones du tracker).
 */
export function pruneOffRouteSamples<T extends { t: number }>(
  samples: T[],
  windowMs: number = OFF_ROUTE_WINDOW_MS,
): T[] {
  if (samples.length === 0) return samples;
  const latest = samples[samples.length - 1].t;
  const oldest = latest - Math.max(0, windowMs);
  let firstKept = 0;
  while (firstKept < samples.length - 1 && samples[firstKept].t < oldest) {
    firstKept += 1;
  }
  return firstKept > 0 ? samples.slice(firstKept) : samples;
}

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
    // La fiche exige « plus de 15 s » : à 15 s exactement, l'alerte n'est pas
    // encore levée.
    offRoute: outSinceS > OFF_ROUTE_SECONDS,
    distanceM: distance,
    outSinceS,
  };
}

/**
 * Libellé de la carte du haut quand on est hors trace.
 *
 * `offRouteM` (distance à la trace) est distinct de `distanceM` (distance
 * parcourue). Une valeur absente ou non finie ne doit pas afficher « 0 m ».
 */
export function offRouteLabel(distanceM?: number | null): string {
  if (typeof distanceM !== 'number' || !Number.isFinite(distanceM)) {
    return 'Hors itinéraire';
  }
  return `Hors itinéraire · ${Math.round(distanceM)} m`;
}
