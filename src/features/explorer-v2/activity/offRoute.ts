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
 * Le hook l'étend à `maxFixGapS + 15 s` pour couvrir le trou GPS toléré par le
 * sport (sinon un trou de 61 à 120 s en randonnée élague le point de départ).
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
  /**
   * Précision horizontale du fix, en mètres. Elle est retirée de la distance
   * avant de comparer au seuil : un fix à 30 m de précision ne prouve pas un
   * écart de 45 m. Absente (anciens appels), la distance brute est utilisée.
   */
  accuracyM?: number | null;
}

export interface OffRouteState {
  offRoute: boolean;
  /** Distance courante à la trace (m). */
  distanceM: number;
  /** Depuis combien de secondes on est au-delà du seuil. */
  outSinceS: number;
}

/** Distance hors trace prouvée, une fois l'incertitude GPS retirée. */
function provenDistance(sample: OffRouteSample): number {
  const accuracy =
    typeof sample.accuracyM === 'number' && Number.isFinite(sample.accuracyM)
      ? Math.max(0, sample.accuracyM)
      : 0;
  return Math.max(0, Math.abs(sample.distanceM) - accuracy);
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
    // La fiche exige un retour **strictement** sous 25 m : à 25 m pile,
    // l'alerte reste affichée. On compare la distance brute au retour, pas la
    // distance prouvée : l'incertitude ne doit pas faire disparaître une alerte
    // alors que l'utilisateur est encore loin de la trace.
    if (distance < BACK_ON_ROUTE_M) {
      return { offRoute: false, distanceM: distance, outSinceS: 0 };
    }
    return { ...previous, distanceM: distance };
  }

  if (provenDistance(last) <= OFF_ROUTE_M) {
    return { offRoute: false, distanceM: distance, outSinceS: 0 };
  }

  // On cherche depuis quand on est sorti sans discontinuer, en retirant à
  // chaque mesure l'incertitude GPS annoncée.
  let startedAt = last.t;
  for (let i = samples.length - 1; i >= 0; i -= 1) {
    if (provenDistance(samples[i]) <= OFF_ROUTE_M) break;
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

const CARDINALS = [
  'nord',
  'nord-est',
  'est',
  'sud-est',
  'sud',
  'sud-ouest',
  'ouest',
  'nord-ouest',
] as const;

/**
 * Direction cardinale du cap de retour, pour l'accessibilité et le libellé
 * quand la carte n'est pas orientée au nord. `null` sans cap exploitable.
 */
export function bearingLabel(bearingDeg?: number | null): string | null {
  if (typeof bearingDeg !== 'number' || !Number.isFinite(bearingDeg)) return null;
  const normalized = ((bearingDeg % 360) + 360) % 360;
  return CARDINALS[Math.round(normalized / 45) % 8];
}

/**
 * Angle **écran** de la flèche de retour.
 *
 * `returnBearingDeg` est un cap monde (0 = nord géographique). MapLibre expose
 * le cap réel de la carte (`map.getBearing()`) : direction monde affichée en
 * haut. Quand l'utilisateur tourne la carte, une flèche dessinée avec le seul
 * cap monde désignerait la mauvaise direction à l'écran. On soustrait donc le
 * cap réel de la carte, et non le seul réglage « nord en haut ».
 *
 * Une rotation absente ou invalide vaut 0 (carte supposée au nord) ; un cap de
 * retour absent renvoie `null`, pour que l'appelant n'affiche aucune flèche.
 */
export function screenBearingDeg(
  returnBearingDeg?: number | null,
  mapBearingDeg?: number | null,
): number | null {
  if (typeof returnBearingDeg !== 'number' || !Number.isFinite(returnBearingDeg)) {
    return null;
  }
  const mapBearing =
    typeof mapBearingDeg === 'number' && Number.isFinite(mapBearingDeg)
      ? mapBearingDeg
      : 0;
  return ((returnBearingDeg - mapBearing) % 360 + 360) % 360;
}
