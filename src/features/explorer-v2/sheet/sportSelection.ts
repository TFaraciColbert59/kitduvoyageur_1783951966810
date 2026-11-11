/**
 * Taxonomie locale des sports de l’Explorer v2 (S1.02).
 *
 * Le contrat aval existant ne connaît que `Sport` (`course`, `rando`, …) et
 * `explorer_sport_map` (migration `20261101_explorer_v2_data.sql`). Cette
 * couche ajoute des variantes sans renommer ni remplacer ces identifiants :
 * `sport` reste la valeur transmise au tracker et à `activity_sessions`.
 *
 * Une variante n’est déclarée démarrable que si la pile de capture actuelle
 * peut réellement produire ses métriques requises (GPS + distance + durée +
 * dénivelé + vitesse/allure). Les variantes indoor, les métriques capteur et
 * les activités dont le D+ serait faussé restent explicitement indisponibles :
 * l’interface ne doit pas les présenter comme fonctionnelles.
 */

import type {
  Sport,
  SportEnvironment,
  SportMetricKey,
  SportSelection,
} from '../state/types';

export type { SportEnvironment, SportMetricKey, SportSelection } from '../state/types';

export const SPORT_METRIC_LABEL: Record<SportMetricKey, string> = {
  distance: 'distance',
  duration: 'durée',
  elevation: 'D+',
  speed: 'vitesse',
  pace: 'allure',
  cadence: 'cadence',
  power: 'puissance',
  heartRate: 'fréquence cardiaque',
  strokeRate: 'cadence de pagaie',
  verticalDrop: 'D−',
  grade: 'difficulté',
  laps: 'longueurs',
};

/**
 * Métriques réellement alimentées par `ActivityTracker` aujourd’hui :
 * distance, D+, temps en mouvement et vitesse dérivée. L’allure est calculable
 * depuis ces deux dernières. Aucun capteur (cardio, puissance, cadence) n’est
 * branché, et le mode indoor ne fournit aucun point GPS.
 */
export const TRACKER_METRICS: ReadonlySet<SportMetricKey> = new Set<SportMetricKey>([
  'distance',
  'duration',
  'elevation',
  'speed',
  'pace',
]);

export interface SportVariant {
  /** Identifiant stable de la variante, distinct des identifiants `Sport`. */
  id: string;
  /** Sport existant transmis au tracker et à `activity_sessions`. */
  sport: Sport;
  label: string;
  /** Type de séance du catalogue, ou `null` quand il n’existe pas. */
  catalogSlug: string | null;
  environment: SportEnvironment;
  requiresGps: boolean;
  requiredMetrics: readonly SportMetricKey[];
  /** Métriques propres au sport mais non captées sans capteur dédié. */
  optionalMetrics?: readonly SportMetricKey[];
  /** Motif statique d’indisponibilité (indoor, remontées, catalogue absent). */
  blockedReason?: string;
}

export interface SportFamily {
  sport: Sport;
  label: string;
  icon: string;
  description: string;
  variants: readonly SportVariant[];
}

const INDOOR_REASON =
  'Aucune capture indoor n’est branchée : sans GPS, distance, durée et métriques resteraient vides.';

/**
 * Taxonomie : chaque `Sport` existant garde son identifiant et gagne ses
 * variantes. Les variantes bloquées sont conservées pour être expliquées à
 * l’utilisateur, jamais pour être proposées comme un départ valide.
 */
export const SPORT_FAMILIES: readonly SportFamily[] = [
  {
    sport: 'course',
    label: 'Course',
    icon: 'run',
    description: 'Route, tapis',
    variants: [
      {
        id: 'course-route',
        sport: 'course',
        label: 'Course sur route',
        catalogSlug: 'course-5k',
        environment: 'outdoor',
        requiresGps: true,
        requiredMetrics: ['distance', 'duration', 'pace'],
        optionalMetrics: ['cadence', 'heartRate'],
      },
      {
        id: 'course-tapis',
        sport: 'course',
        label: 'Course sur tapis',
        catalogSlug: null,
        environment: 'indoor',
        requiresGps: false,
        requiredMetrics: ['duration', 'pace', 'heartRate'],
        optionalMetrics: ['cadence', 'power'],
        blockedReason: INDOOR_REASON,
      },
    ],
  },
  {
    sport: 'rando',
    label: 'Randonnée',
    icon: 'hike',
    description: 'Journée, refuge, sortie matinale',
    variants: [
      {
        id: 'rando-journee',
        sport: 'rando',
        label: 'Randonnée à la journée',
        catalogSlug: 'rando-journee',
        environment: 'outdoor',
        requiresGps: true,
        requiredMetrics: ['distance', 'duration', 'elevation'],
        optionalMetrics: ['heartRate'],
      },
      {
        id: 'rando-refuge',
        sport: 'rando',
        label: 'Randonnée avec nuit en refuge',
        catalogSlug: 'rando-refuge',
        environment: 'outdoor',
        requiresGps: true,
        requiredMetrics: ['distance', 'duration', 'elevation'],
        optionalMetrics: ['heartRate'],
      },
      {
        id: 'rando-matin',
        sport: 'rando',
        label: 'Randonnée matinale',
        catalogSlug: 'rando-matin',
        environment: 'outdoor',
        requiresGps: true,
        requiredMetrics: ['distance', 'duration', 'elevation'],
      },
    ],
  },
  {
    sport: 'velo',
    label: 'Vélo',
    icon: 'bike',
    description: 'Route, gravel, bikepacking, home trainer',
    variants: [
      {
        id: 'velo-route',
        sport: 'velo',
        label: 'Vélo route',
        catalogSlug: 'velo-route',
        environment: 'outdoor',
        requiresGps: true,
        requiredMetrics: ['distance', 'duration', 'elevation', 'speed'],
        optionalMetrics: ['cadence', 'power', 'heartRate'],
      },
      {
        id: 'velo-gravel',
        sport: 'velo',
        label: 'Gravel',
        catalogSlug: 'gravel-bivouac',
        environment: 'outdoor',
        requiresGps: true,
        requiredMetrics: ['distance', 'duration', 'elevation', 'speed'],
        optionalMetrics: ['power'],
      },
      {
        id: 'velo-bikepacking',
        sport: 'velo',
        label: 'Bikepacking',
        catalogSlug: 'bikepacking-3j',
        environment: 'outdoor',
        requiresGps: true,
        requiredMetrics: ['distance', 'duration', 'elevation'],
        optionalMetrics: ['power'],
      },
      {
        id: 'velo-home-trainer',
        sport: 'velo',
        label: 'Home trainer',
        catalogSlug: null,
        environment: 'indoor',
        requiresGps: false,
        requiredMetrics: ['duration', 'power', 'cadence', 'heartRate'],
        blockedReason: INDOOR_REASON,
      },
    ],
  },
  {
    sport: 'kayak',
    label: 'Kayak',
    icon: 'kayak',
    description: 'Mer, rivière',
    variants: [
      {
        id: 'kayak-riviere',
        sport: 'kayak',
        label: 'Kayak en rivière',
        catalogSlug: 'canoe-journee',
        environment: 'outdoor',
        requiresGps: true,
        requiredMetrics: ['distance', 'duration', 'speed'],
        optionalMetrics: ['strokeRate'],
      },
      {
        id: 'kayak-mer',
        sport: 'kayak',
        label: 'Kayak en mer',
        catalogSlug: 'kayak-sea',
        environment: 'outdoor',
        requiresGps: true,
        requiredMetrics: ['distance', 'duration', 'speed'],
        optionalMetrics: ['strokeRate'],
      },
    ],
  },
  {
    sport: 'trail',
    label: 'Trail',
    icon: 'run',
    description: '10 km, ultra',
    variants: [
      {
        id: 'trail-10k',
        sport: 'trail',
        label: 'Trail 10 km',
        catalogSlug: 'trail-10k',
        environment: 'outdoor',
        requiresGps: true,
        requiredMetrics: ['distance', 'duration', 'elevation', 'pace'],
        optionalMetrics: ['cadence', 'heartRate'],
      },
      {
        id: 'trail-ultra',
        sport: 'trail',
        label: 'Trail ultra',
        catalogSlug: 'trail-ultra-65k',
        environment: 'outdoor',
        requiresGps: true,
        requiredMetrics: ['distance', 'duration', 'elevation', 'pace'],
        optionalMetrics: ['heartRate', 'laps'],
      },
    ],
  },
  {
    sport: 'ski',
    label: 'Ski de rando',
    icon: 'ski',
    description: 'Randonnée à ski, alpin, fond',
    variants: [
      {
        id: 'ski-rando',
        sport: 'ski',
        label: 'Ski de randonnée',
        catalogSlug: 'ski-randonnee',
        environment: 'outdoor',
        requiresGps: true,
        requiredMetrics: ['distance', 'duration', 'elevation'],
        optionalMetrics: ['verticalDrop', 'heartRate'],
      },
      {
        id: 'ski-alpin',
        sport: 'ski',
        label: 'Ski alpin',
        catalogSlug: null,
        environment: 'outdoor',
        requiresGps: true,
        requiredMetrics: ['distance', 'duration', 'verticalDrop'],
        blockedReason:
          'Remontées mécaniques : le D+ GPS compterait les montées. Une capture spécifique est requise.',
      },
      {
        id: 'ski-fond',
        sport: 'ski',
        label: 'Ski de fond',
        catalogSlug: null,
        environment: 'outdoor',
        requiresGps: true,
        requiredMetrics: ['distance', 'duration', 'speed'],
        blockedReason: 'Aucun type de séance ni métrique de glisse au catalogue actuel.',
      },
    ],
  },
  {
    sport: 'escalade',
    label: 'Escalade',
    icon: 'climb',
    description: 'Voie, bloc, salle',
    variants: [
      {
        id: 'escalade-voie',
        sport: 'escalade',
        label: 'Escalade en voie',
        catalogSlug: 'escalade-voie',
        environment: 'outdoor',
        requiresGps: true,
        requiredMetrics: ['distance', 'duration', 'elevation'],
        optionalMetrics: ['grade', 'laps'],
      },
      {
        id: 'escalade-bloc',
        sport: 'escalade',
        label: 'Escalade de bloc',
        catalogSlug: null,
        environment: 'outdoor',
        requiresGps: true,
        requiredMetrics: ['duration', 'grade', 'laps'],
        blockedReason: 'Pas de capture des longueurs ni de la difficulté ; aucun type de séance bloc.',
      },
      {
        id: 'escalade-salle',
        sport: 'escalade',
        label: 'Escalade en salle',
        catalogSlug: null,
        environment: 'indoor',
        requiresGps: false,
        requiredMetrics: ['duration', 'grade', 'laps'],
        blockedReason: INDOOR_REASON,
      },
    ],
  },
  {
    sport: 'famille',
    label: 'Balade en famille',
    icon: 'walk',
    description: 'Balade, poussette',
    variants: [
      {
        id: 'famille-balade',
        sport: 'famille',
        label: 'Balade en famille',
        catalogSlug: 'rando-famille',
        environment: 'outdoor',
        requiresGps: true,
        requiredMetrics: ['distance', 'duration', 'elevation'],
      },
      {
        id: 'famille-poussette',
        sport: 'famille',
        label: 'Balade avec poussette',
        catalogSlug: 'rando-famille',
        environment: 'outdoor',
        requiresGps: true,
        requiredMetrics: ['distance', 'duration'],
        optionalMetrics: ['elevation'],
      },
    ],
  },
  {
    sport: 'bivouac',
    label: 'Bivouac',
    icon: 'tent',
    description: 'Une nuit, deux nuits',
    variants: [
      {
        id: 'bivouac-1n',
        sport: 'bivouac',
        label: 'Bivouac 1 nuit',
        catalogSlug: 'bivouac-1n',
        environment: 'outdoor',
        requiresGps: true,
        requiredMetrics: ['distance', 'duration', 'elevation'],
      },
      {
        id: 'bivouac-2n',
        sport: 'bivouac',
        label: 'Bivouac 2 nuits',
        catalogSlug: 'bivouac-2n',
        environment: 'outdoor',
        requiresGps: true,
        requiredMetrics: ['distance', 'duration', 'elevation'],
      },
    ],
  },
];

const FAMILY_BY_SPORT = new Map<Sport, SportFamily>(
  SPORT_FAMILIES.map((family) => [family.sport, family]),
);

const VARIANT_BY_ID = new Map<string, SportVariant>(
  SPORT_FAMILIES.flatMap((family) => family.variants.map((variant) => [variant.id, variant] as const)),
);

export function getSportFamily(sport: Sport): SportFamily | null {
  return FAMILY_BY_SPORT.get(sport) ?? null;
}

export function getSportVariant(id: string): SportVariant | null {
  return VARIANT_BY_ID.get(id) ?? null;
}

export interface SportStartContext {
  locationPermission: 'granted' | 'denied' | 'prompt';
  /** `navigator.geolocation` est disponible dans l’environnement courant. */
  gpsAvailable: boolean;
}

export type SportStartStatus = 'ready' | 'needs-permission' | 'blocked';

export interface SportStartAvailability {
  status: SportStartStatus;
  startable: boolean;
  reason: string | null;
  missingMetrics: readonly SportMetricKey[];
}

function blocked(reason: string, missingMetrics: readonly SportMetricKey[] = []): SportStartAvailability {
  return { status: 'blocked', startable: false, reason, missingMetrics };
}

/**
 * Décide si une variante peut réellement démarrer avec la pile actuelle.
 * Aucun repli silencieux : une variante bloquée ne reçoit jamais d’action.
 */
export function startAvailability(
  variant: SportVariant,
  context: SportStartContext,
): SportStartAvailability {
  const missingMetrics = variant.requiredMetrics.filter((metric) => !TRACKER_METRICS.has(metric));

  if (variant.blockedReason) return blocked(variant.blockedReason, missingMetrics);
  if (variant.environment === 'indoor' || !variant.requiresGps) {
    return blocked(INDOOR_REASON, missingMetrics);
  }
  if (!variant.catalogSlug) {
    return blocked('Aucun type de séance correspondant dans activity_catalog.', missingMetrics);
  }
  if (!context.gpsAvailable) {
    return blocked('Géolocalisation indisponible sur cet appareil.', missingMetrics);
  }
  if (context.locationPermission === 'denied') {
    return blocked('Position refusée : autorise la géolocalisation pour démarrer.', missingMetrics);
  }
  if (missingMetrics.length > 0) {
    return blocked(
      `Métrique non captée : ${missingMetrics.map((metric) => SPORT_METRIC_LABEL[metric]).join(', ')}.`,
      missingMetrics,
    );
  }
  if (context.locationPermission === 'prompt') {
    return {
      status: 'needs-permission',
      startable: true,
      reason: 'La position sera demandée au démarrage.',
      missingMetrics,
    };
  }
  return { status: 'ready', startable: true, reason: null, missingMetrics };
}

export function availabilityLabel(availability: SportStartAvailability): string {
  if (availability.status === 'blocked') return 'Indisponible';
  if (availability.status === 'needs-permission') return 'GPS à autoriser';
  return 'Prêt';
}

export function metricsLabel(metrics: readonly SportMetricKey[]): string {
  return metrics.map((metric) => SPORT_METRIC_LABEL[metric]).join(', ');
}

/** Métrique de rythme affichée en Direct : allure ou vitesse. */
export type RhythmMetric = Extract<SportMetricKey, 'pace' | 'speed'>;

/**
 * La sélection locale fait foi quand elle porte une métrique de rythme.
 * Sinon Course et Trail se lisent en allure (min/km) ; les autres sports
 * gardent la vitesse (km/h) déjà affichée.
 */
export function rhythmMetric(sport: Sport, selection?: SportSelection): RhythmMetric {
  if (selection?.metrics.includes('pace')) return 'pace';
  if (selection?.metrics.includes('speed')) return 'speed';
  return sport === 'course' || sport === 'trail' ? 'pace' : 'speed';
}

/** Métriques propres au sport qu’aucun capteur ne fournit aujourd’hui. */
export function missingOptionalMetrics(variant: SportVariant): readonly SportMetricKey[] {
  return (variant.optionalMetrics ?? []).filter((metric) => !TRACKER_METRICS.has(metric));
}

export function familySummary(family: SportFamily): string {
  const indoor = family.variants.filter((variant) => variant.environment === 'indoor').length;
  return `${family.variants.length} variantes${indoor > 0 ? ` · ${indoor} indoor` : ''}`;
}

/** Première variante réellement démarrable, pour les suggestions. */
export function defaultVariantForSport(
  sport: Sport,
  context: SportStartContext,
): SportVariant | null {
  const family = getSportFamily(sport);
  if (!family) return null;
  return family.variants.find((variant) => startAvailability(variant, context).startable) ?? null;
}

/**
 * Convertit une variante de la taxonomie en sélection transportable par
 * `PendingStart` puis `ActivityState`. Le `sport` reste l’identifiant
 * historique ; la variante ne quitte pas la mémoire tant que l’API start
 * n’existe pas.
 */
export function toSportSelection(family: SportFamily, variant: SportVariant): SportSelection {
  return {
    sport: variant.sport,
    variantId: variant.id,
    variantLabel: variant.label,
    catalogSlug: variant.catalogSlug,
    environment: variant.environment,
    metrics: variant.requiredMetrics,
  };
}
