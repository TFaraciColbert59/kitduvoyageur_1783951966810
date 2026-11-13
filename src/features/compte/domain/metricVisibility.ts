/**
 * S6.15 — visibilité indépendante des métriques d'effort d'une sortie.
 *
 * Contrat unique, pur et fail-closed. Les chemins qui exposent une sortie à un
 * tiers (fiche du drawer, export GPX, futur aperçu de partage) ne décident
 * jamais eux-mêmes qu'une métrique est publiable : ils passent la politique
 * résolue ici, puis projettent les valeurs.
 *
 * Règles :
 *  - le propriétaire et les participants inscrits voient toutes les métriques ;
 *  - un lecteur tiers ne reçoit que les métriques explicitement autorisées par
 *    la visibilité de la sortie et, si elle existe, par une politique persistée
 *    lue dans un stockage de confiance ;
 *  - une politique absente, partielle, inconnue ou mal typée retire tout ce
 *    qu'elle ne déclare pas `true` (aucune valeur « truthy » n'autorise) ;
 *  - une valeur non finie n'est jamais publiée : elle devient `null` ;
 *  - les métadonnées de trace (altitude, heure) ne sont conservées que si
 *    toutes les métriques qui permettraient de les déduire sont visibles.
 *
 * La politique persistée n'est pas encore branchée : la migration qui portera
 * le choix du propriétaire est à coordonner. Tant qu'elle n'existe pas, un
 * partage explicite (`public`, `collective_anonymized`) conserve le socle agrégé
 * déjà publié (distance, profil, dénivelé, altitude max, durée) et masque les
 * métriques d'effort dérivées ou biométriques (allure, temps en mouvement,
 * fréquence cardiaque, puissance, cadence, calories).
 */

export const OUTING_METRIC_KEYS = [
  'distance',
  'elevation',
  'elevationGain',
  'maxAltitude',
  'duration',
  'pace',
  'movingTime',
  'heartRate',
  'power',
  'cadence',
  'calories',
] as const;

export type OutingMetricKey = (typeof OUTING_METRIC_KEYS)[number];

export type OutingMetricVisibility = Readonly<Record<OutingMetricKey, boolean>>;

export const OUTING_METRIC_LABELS: Readonly<Record<OutingMetricKey, string>> = Object.freeze({
  distance: 'Distance',
  elevation: 'Profil altimétrique',
  elevationGain: 'Dénivelé positif',
  maxAltitude: 'Altitude maximale',
  duration: 'Durée',
  pace: 'Allure moyenne',
  movingTime: 'Temps en mouvement',
  heartRate: 'Fréquence cardiaque',
  power: 'Puissance',
  cadence: 'Cadence',
  calories: 'Calories',
});

export type OutingMetricViewer = 'owner' | 'participant' | 'follower' | 'visitor';

export interface OutingMetricAudience {
  viewer: OutingMetricViewer;
  /** `private`, `public`, `friends`, `followers`, `collective_anonymized`… */
  visibility?: string | null;
  /**
   * Choix persisté du propriétaire. Ne doit être fourni que par un appelant
   * qui l'a lu dans un stockage de confiance (colonne ou table dédiée, jamais
   * une valeur de requête brute). Absent, le socle agrégé s'applique.
   */
  policy?: unknown;
}

function buildVisibility(value: boolean): OutingMetricVisibility {
  const visibility = {} as Record<OutingMetricKey, boolean>;
  for (const key of OUTING_METRIC_KEYS) visibility[key] = value;
  return Object.freeze(visibility);
}

/** Aucune métrique : défaut de tout lecteur non autorisé. */
export const NO_OUTING_METRICS = buildVisibility(false);

/** Toutes les métriques : propriétaire et participant inscrit. */
export const ALL_OUTING_METRICS = buildVisibility(true);

/**
 * Socle agrégé déjà publié par une sortie explicitement partageable. Il ne
 * contient ni allure, ni temps en mouvement, ni donnée biométrique.
 */
export const SHARED_SUMMARY_METRICS: OutingMetricVisibility = Object.freeze({
  ...buildVisibility(false),
  distance: true,
  elevation: true,
  elevationGain: true,
  maxAltitude: true,
  duration: true,
});

/**
 * Lit une politique comme une liste fermée de booléens stricts. Toute clé
 * absente, toute valeur non booléenne et toute clé inconnue sont refusées.
 */
export function parseMetricVisibility(value: unknown): OutingMetricVisibility {
  const source: Record<string, unknown> =
    value !== null && typeof value === 'object' && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};
  const parsed = {} as Record<OutingMetricKey, boolean>;
  for (const key of OUTING_METRIC_KEYS) parsed[key] = source[key] === true;
  return Object.freeze(parsed);
}

/** `public` et `collective_anonymized` sont les deux valeurs de partage explicite. */
export function isExplicitlySharedOutingVisibility(value: unknown): boolean {
  return value === 'public' || value === 'collective_anonymized';
}

/** `friends`/`followers` ne valent que pour un abonné réellement vérifié. */
export function isFollowerOutingVisibility(value: unknown): boolean {
  return value === 'friends' || value === 'followers';
}

/**
 * Politique effective d'un lecteur. Le rôle vient d'une autorisation vérifiée
 * par l'appelant (propriétaire, participant inscrit, relation de suivi lue en
 * base) : ce module ne devine jamais un droit à partir de la seule visibilité.
 */
export function resolveOutingMetricVisibility(
  audience: OutingMetricAudience
): OutingMetricVisibility {
  if (audience.viewer === 'owner' || audience.viewer === 'participant') {
    return ALL_OUTING_METRICS;
  }

  const explicitlyShared = isExplicitlySharedOutingVisibility(audience.visibility);
  const followerShared =
    audience.viewer === 'follower' && isFollowerOutingVisibility(audience.visibility);
  if (!explicitlyShared && !followerShared) return NO_OUTING_METRICS;

  /* Une politique fournie remplace le socle : partielle, elle ferme le reste. */
  if (audience.policy !== undefined && audience.policy !== null) {
    return parseMetricVisibility(audience.policy);
  }
  return SHARED_SUMMARY_METRICS;
}

/** Vrai uniquement si la clé est connue et explicitement autorisée. */
export function isOutingMetricVisible(
  visibility: unknown,
  key: OutingMetricKey
): boolean {
  if (!(OUTING_METRIC_KEYS as readonly string[]).includes(key)) return false;
  return parseMetricVisibility(visibility)[key] === true;
}

/** Construit une politique depuis une liste de clés (sélection UI). */
export function metricVisibilityFromKeys(keys: readonly unknown[]): OutingMetricVisibility {
  const allowed = new Set(
    keys.filter(
      (key): key is OutingMetricKey =>
        typeof key === 'string' && (OUTING_METRIC_KEYS as readonly string[]).includes(key)
    )
  );
  const parsed = {} as Record<OutingMetricKey, boolean>;
  for (const key of OUTING_METRIC_KEYS) parsed[key] = allowed.has(key);
  return Object.freeze(parsed);
}

/** Liste stable des clés autorisées, pour un aperçu ou un journal. */
export function metricVisibilityKeys(
  visibility: unknown
): OutingMetricKey[] {
  const parsed = parseMetricVisibility(visibility);
  return OUTING_METRIC_KEYS.filter((key) => parsed[key]);
}

export interface OutingMetricValues {
  distanceKm: number | null;
  elevationGainM: number | null;
  maxAltitudeM: number | null;
  durationS: number | null;
  paceMinPerKm: number | null;
  movingTimeS: number | null;
  heartRateBpm: number | null;
  powerW: number | null;
  cadenceRpm: number | null;
  caloriesKcal: number | null;
}

export interface ProjectedOutingMetrics {
  distanceKm: number | null;
  elevationGainM: number | null;
  maxAltitudeM: number | null;
  durationS: number | null;
  paceMinPerKm: number | null;
  movingTimeS: number | null;
  heartRateBpm: number | null;
  powerW: number | null;
  cadenceRpm: number | null;
  caloriesKcal: number | null;
  visibility: OutingMetricVisibility;
  hidden: OutingMetricKey[];
  masked: boolean;
}

function finiteOrNull(value: number | null | undefined): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

/**
 * Projette les valeurs scalaires. Une métrique masquée devient `null`, jamais
 * zéro : l'UI doit afficher « — » ou « masqué », pas une valeur inventée.
 */
export function projectOutingMetrics(
  values: OutingMetricValues,
  visibility: unknown
): ProjectedOutingMetrics {
  const safe = parseMetricVisibility(visibility);
  const hidden = OUTING_METRIC_KEYS.filter((key) => !safe[key]);

  return {
    distanceKm: safe.distance ? finiteOrNull(values.distanceKm) : null,
    elevationGainM: safe.elevationGain ? finiteOrNull(values.elevationGainM) : null,
    maxAltitudeM: safe.maxAltitude ? finiteOrNull(values.maxAltitudeM) : null,
    durationS: safe.duration ? finiteOrNull(values.durationS) : null,
    paceMinPerKm: safe.pace ? finiteOrNull(values.paceMinPerKm) : null,
    movingTimeS: safe.movingTime ? finiteOrNull(values.movingTimeS) : null,
    heartRateBpm: safe.heartRate ? finiteOrNull(values.heartRateBpm) : null,
    powerW: safe.power ? finiteOrNull(values.powerW) : null,
    cadenceRpm: safe.cadence ? finiteOrNull(values.cadenceRpm) : null,
    caloriesKcal: safe.calories ? finiteOrNull(values.caloriesKcal) : null,
    visibility: safe,
    hidden,
    masked: hidden.length > 0,
  };
}

export interface TraceMetricPoint {
  elevationM?: number | null;
  timestamp?: string | null;
  /** Champs optionnels : aucune source actuelle ne les porte, le contrat les ferme déjà. */
  heartRateBpm?: number | null;
  powerW?: number | null;
  cadenceRpm?: number | null;
  caloriesKcal?: number | null;
}

export interface ProjectedTraceMetrics<T extends TraceMetricPoint> {
  segments: T[][];
  /** Altitude publiable seulement si profil, dénivelé et altitude max sont visibles. */
  elevationExposed: boolean;
  /** Heure publiable seulement si durée, allure et temps en mouvement sont visibles. */
  timingExposed: boolean;
  masked: boolean;
}

/**
 * Retire des points les métadonnées qui permettraient de déduire une métrique
 * masquée. Les coordonnées ne sont jamais modifiées ici : le masquage
 * géométrique reste la responsabilité de `tracePrivacy`.
 */
export function projectTraceMetrics<T extends TraceMetricPoint>(
  segments: readonly (readonly T[])[],
  visibility: unknown
): ProjectedTraceMetrics<T> {
  const safe = parseMetricVisibility(visibility);
  const elevationExposed =
    safe.elevation && safe.elevationGain && safe.maxAltitude;
  const timingExposed = safe.duration && safe.pace && safe.movingTime;
  const masked =
    !elevationExposed ||
    !timingExposed ||
    !safe.heartRate ||
    !safe.power ||
    !safe.cadence ||
    !safe.calories;

  const projected = segments.map((segment) =>
    segment.map((point) => {
      const next = { ...point } as T & {
        elevationM?: number | null;
        timestamp?: string | null;
        heartRateBpm?: number | null;
        powerW?: number | null;
        cadenceRpm?: number | null;
        caloriesKcal?: number | null;
      };
      if (!elevationExposed) next.elevationM = null;
      if (!timingExposed) next.timestamp = null;
      if (!safe.heartRate) next.heartRateBpm = null;
      if (!safe.power) next.powerW = null;
      if (!safe.cadence) next.cadenceRpm = null;
      if (!safe.calories) next.caloriesKcal = null;
      return next as T;
    })
  );

  return { segments: projected, elevationExposed, timingExposed, masked };
}

/**
 * Temps en mouvement : somme des intervalles positifs de moins de dix minutes.
 * Une pause plus longue n'est pas comptée. Sans au moins deux heures valides,
 * la valeur reste `null` ; aucune durée n'est inventée.
 */
export function movingTimeSeconds(
  points: readonly TraceMetricPoint[],
  maxPauseSeconds = 600
): number | null {
  const pauseLimit =
    Number.isFinite(maxPauseSeconds) && maxPauseSeconds > 0 ? maxPauseSeconds : 600;
  const timed = points.filter(
    (point): point is TraceMetricPoint & { timestamp: string } =>
      typeof point.timestamp === 'string' && point.timestamp.length > 0
  );
  if (timed.length < 2) return null;

  let total = 0;
  for (let index = 1; index < timed.length; index += 1) {
    const previous = Date.parse(timed[index - 1].timestamp);
    const current = Date.parse(timed[index].timestamp);
    if (!Number.isFinite(previous) || !Number.isFinite(current)) continue;
    const delta = (current - previous) / 1000;
    if (delta > 0 && delta < pauseLimit) total += delta;
  }
  return total > 0 ? Math.round(total) : null;
}

/** Allure moyenne en min/km, calculée uniquement depuis des valeurs finies positives. */
export function averagePaceMinPerKm(
  durationS: number | null | undefined,
  distanceKm: number | null | undefined
): number | null {
  const duration = finiteOrNull(durationS);
  const distance = finiteOrNull(distanceKm);
  if (duration === null || distance === null || duration <= 0 || distance <= 0) {
    return null;
  }
  const pace = duration / 60 / distance;
  return Number.isFinite(pace) ? pace : null;
}

/** Altitude maximale observée sur des points, sans jamais inventer de valeur. */
export function observedMaxAltitudeM(
  points: readonly TraceMetricPoint[]
): number | null {
  let max: number | null = null;
  for (const point of points) {
    const elevation = finiteOrNull(point.elevationM);
    if (elevation === null) continue;
    max = max === null ? elevation : Math.max(max, elevation);
  }
  return max;
}
