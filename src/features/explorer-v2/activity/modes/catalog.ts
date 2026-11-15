/**
 * Catalogue unifié et résolution des modes d'activité A01 (S1.08–S1.12).
 *
 * Ce module relie les nouvelles variantes (saisie manuelle, indoor/virtuel,
 * natation piscine & eau libre, ski alpin/snowboard/rando, rééducation) aux
 * identifiants `Sport` et `catalog_slug` existants du socle LKDV, sans
 * modifier `state/types.ts` ni les migrations verrouillées.
 */

import { SPORT_FAMILIES } from '../../sheet/sportSelection';
import type { Sport, SportMetricKey, SportSelection } from '../../state/types';
import type {
  ActivityModeAvailability,
  ActivityModeDefinition,
  ActivityModeKind,
  ActivityModeStartContext,
  ServerPersistenceMapping,
} from './types';

/**
 * Variantes actuellement inscrites dans la table SQL `explorer_sport_variants`
 * (migration `20261111120000_explorer_v2_activity_start.sql`).
 * Seules ces variantes peuvent être passées telles quelles dans `p_variant_id`
 * lors d'un appel RPC `start_activity_session`. Les nouvelles variantes A01
 * passent `p_variant_id = null` côté RPC (pour respecter le trigger SQL sans
 * migration supplémentaire) tout en conservant `SportSelection` complet dans
 * `LocalSessionRecord` et `ActivityState`.
 */
export const SQL_REGISTERED_VARIANTS: ReadonlySet<string> = new Set<string>([
  'course-route',
  'rando-journee',
  'rando-refuge',
  'rando-matin',
  'velo-route',
  'velo-gravel',
  'velo-bikepacking',
  'kayak-riviere',
  'kayak-mer',
  'trail-10k',
  'trail-ultra',
  'ski-rando',
  'escalade-voie',
  'famille-balade',
  'famille-poussette',
  'bivouac-1n',
  'bivouac-2n',
]);

/**
 * Slug `activity_catalog` par défaut pour chacun des 9 sports de `explorer_sport_map`.
 */
export const DEFAULT_CATALOG_SLUG_BY_SPORT: Readonly<Record<Sport, string>> = {
  course: 'course-5k',
  rando: 'rando-journee',
  velo: 'velo-route',
  kayak: 'canoe-journee',
  trail: 'trail-10k',
  ski: 'ski-randonnee',
  escalade: 'escalade-voie',
  famille: 'rando-famille',
  bivouac: 'bivouac-1n',
};

/**
 * Définitions des modes spécialisés A01 (S1.08 à S1.12).
 */
export const SPECIALIZED_MODE_DEFINITIONS: readonly ActivityModeDefinition[] = [
  // ── S1.09 · Enregistrement indoor et entraînements virtuels ──────────────
  {
    id: 'course-tapis',
    modeKind: 'indoor',
    label: 'Course sur tapis',
    description: 'Séance course indoor sans GPS, avec saisie ou import console tapis.',
    baseSport: 'course',
    catalogSlug: 'course-5k',
    serverVariantId: null,
    environment: 'indoor',
    requiresGps: false,
    supportsManualEntry: true,
    requiredMetrics: ['duration'],
    optionalSensorMetrics: ['distance', 'pace', 'speed', 'cadence', 'heartRate', 'power'],
  },
  {
    id: 'velo-home-trainer',
    modeKind: 'indoor',
    label: 'Home trainer',
    description: 'Séance vélo indoor sans GPS, avec durée et import home-trainer.',
    baseSport: 'velo',
    catalogSlug: 'velo-route',
    serverVariantId: null,
    environment: 'indoor',
    requiresGps: false,
    supportsManualEntry: true,
    requiredMetrics: ['duration'],
    optionalSensorMetrics: ['distance', 'speed', 'power', 'cadence', 'heartRate'],
  },
  {
    id: 'velo-virtuel',
    modeKind: 'indoor',
    label: 'Entraînement vélo virtuel',
    description: 'Séance virtuelle connectée (home-trainer / plateforme virtuelle) sans GPS.',
    baseSport: 'velo',
    catalogSlug: 'velo-route',
    serverVariantId: null,
    environment: 'indoor',
    requiresGps: false,
    supportsManualEntry: true,
    requiredMetrics: ['duration'],
    optionalSensorMetrics: ['distance', 'elevation', 'speed', 'power', 'cadence', 'heartRate'],
  },
  {
    id: 'rameur-indoor',
    modeKind: 'indoor',
    label: 'Rameur indoor',
    description: 'Séance ergomètre / rameur sans GPS, cadence de rame et allure /500 m.',
    baseSport: 'kayak',
    catalogSlug: 'canoe-journee',
    serverVariantId: null,
    environment: 'indoor',
    requiresGps: false,
    supportsManualEntry: true,
    requiredMetrics: ['duration'],
    optionalSensorMetrics: ['distance', 'pace', 'strokeRate', 'power', 'heartRate'],
  },
  {
    id: 'escalade-salle',
    modeKind: 'indoor',
    label: 'Escalade en salle',
    description: 'Séance d’escalade indoor sans GPS (voies ou bloc en salle).',
    baseSport: 'escalade',
    catalogSlug: 'escalade-voie',
    serverVariantId: null,
    environment: 'indoor',
    requiresGps: false,
    supportsManualEntry: true,
    requiredMetrics: ['duration'],
    optionalSensorMetrics: ['grade', 'laps', 'heartRate'],
  },

  // ── S1.10 · Natation piscine et eau libre ────────────────────────────────
  {
    id: 'natation-piscine',
    modeKind: 'swim-pool',
    label: 'Natation en piscine',
    description: 'Comptage des longueurs, distance selon la taille du bassin et allure /100 m.',
    baseSport: 'kayak',
    catalogSlug: 'canoe-journee',
    serverVariantId: null,
    environment: 'indoor',
    requiresGps: false,
    supportsManualEntry: true,
    requiredMetrics: ['duration', 'distance', 'pace', 'laps'],
    optionalSensorMetrics: ['strokeRate', 'heartRate'],
  },
  {
    id: 'natation-eau-libre',
    modeKind: 'swim-open-water',
    label: 'Natation en eau libre',
    description: 'Suivi GPS en mer ou lac, distance, allure /100 m et D+ neutralisé.',
    baseSport: 'kayak',
    catalogSlug: 'kayak-sea',
    serverVariantId: 'kayak-mer',
    environment: 'outdoor',
    requiresGps: true,
    supportsManualEntry: true,
    requiredMetrics: ['distance', 'duration', 'pace'],
    optionalSensorMetrics: ['strokeRate', 'heartRate'],
  },

  // ── S1.11 · Ski et snowboard avec détection des descentes ────────────────
  {
    id: 'ski-alpin',
    modeKind: 'ski-alpine',
    label: 'Ski alpin',
    description: 'Détection automatique des descentes (runs) et exclusion des remontées mécaniques.',
    baseSport: 'ski',
    catalogSlug: 'ski-randonnee',
    serverVariantId: null,
    environment: 'outdoor',
    requiresGps: true,
    supportsManualEntry: true,
    requiredMetrics: ['distance', 'duration', 'verticalDrop', 'speed'],
    optionalSensorMetrics: ['heartRate'],
  },
  {
    id: 'snowboard',
    modeKind: 'snowboard',
    label: 'Snowboard',
    description: 'Détection des descentes (runs), D- et vitesse par run hors remontées.',
    baseSport: 'ski',
    catalogSlug: 'snowboard-sejour',
    serverVariantId: null,
    environment: 'outdoor',
    requiresGps: true,
    supportsManualEntry: true,
    requiredMetrics: ['distance', 'duration', 'verticalDrop', 'speed'],
    optionalSensorMetrics: ['heartRate'],
  },
  {
    id: 'ski-rando',
    modeKind: 'ski-rando',
    label: 'Ski de randonnée',
    description: 'Montée active (D+) et détection des descentes (runs et D-).',
    baseSport: 'ski',
    catalogSlug: 'ski-randonnee',
    serverVariantId: 'ski-rando',
    environment: 'outdoor',
    requiresGps: true,
    supportsManualEntry: true,
    requiredMetrics: ['distance', 'duration', 'elevation', 'verticalDrop'],
    optionalSensorMetrics: ['heartRate'],
  },
  {
    id: 'ski-fond',
    modeKind: 'gps-outdoor',
    label: 'Ski de fond',
    description: 'Glisse nordique sur trace GPS avec distance, durée, D+ et vitesse.',
    baseSport: 'ski',
    catalogSlug: 'ski-randonnee',
    serverVariantId: null,
    environment: 'outdoor',
    requiresGps: true,
    supportsManualEntry: true,
    requiredMetrics: ['distance', 'duration', 'elevation', 'speed'],
    optionalSensorMetrics: ['heartRate', 'cadence'],
  },

  // ── S1.12 · Rééducation comme type d'activité ────────────────────────────
  {
    id: 'rehab-mobilite',
    modeKind: 'rehab',
    label: 'Rééducation · Mobilité & kiné',
    description: 'Séance de rééducation articulaire ou musculaire en intérieur sans GPS.',
    baseSport: 'famille',
    catalogSlug: 'rando-famille',
    serverVariantId: null,
    environment: 'indoor',
    requiresGps: false,
    supportsManualEntry: true,
    requiredMetrics: ['duration'],
    optionalSensorMetrics: ['heartRate'],
  },
  {
    id: 'rehab-marche',
    modeKind: 'rehab',
    label: 'Rééducation · Marche thérapeutique',
    description: 'Reprise de marche douce (outdoor avec GPS tolérant aux pauses ou indoor).',
    baseSport: 'famille',
    catalogSlug: 'rando-famille',
    serverVariantId: 'famille-balade',
    environment: 'outdoor',
    requiresGps: false,
    supportsManualEntry: true,
    requiredMetrics: ['duration'],
    optionalSensorMetrics: ['distance', 'pace', 'heartRate'],
  },
  {
    id: 'rehab-velo-doux',
    modeKind: 'rehab',
    label: 'Rééducation · Vélo ergonomique',
    description: 'Mobilité cycliste douce sur ergomètre sans GPS.',
    baseSport: 'velo',
    catalogSlug: 'velo-route',
    serverVariantId: null,
    environment: 'indoor',
    requiresGps: false,
    supportsManualEntry: true,
    requiredMetrics: ['duration'],
    optionalSensorMetrics: ['distance', 'cadence', 'power', 'heartRate'],
  },
  {
    id: 'rehab-aquatique',
    modeKind: 'rehab',
    label: 'Rééducation · Balnéothérapie',
    description: 'Rééducation fonctionnelle en bassin / aquagym douce sans GPS.',
    baseSport: 'kayak',
    catalogSlug: 'canoe-journee',
    serverVariantId: null,
    environment: 'indoor',
    requiresGps: false,
    supportsManualEntry: true,
    requiredMetrics: ['duration'],
    optionalSensorMetrics: ['distance', 'heartRate'],
  },
];

function buildAllDefinitions(): ReadonlyMap<string, ActivityModeDefinition> {
  const map = new Map<string, ActivityModeDefinition>();

  // 1. Dériver d'abord les variantes existantes de `SPORT_FAMILIES`
  for (const family of SPORT_FAMILIES) {
    for (const variant of family.variants) {
      map.set(variant.id, {
        id: variant.id,
        modeKind: variant.environment === 'indoor' ? 'indoor' : 'gps-outdoor',
        label: variant.label,
        description: family.description,
        baseSport: variant.sport,
        catalogSlug: variant.catalogSlug ?? DEFAULT_CATALOG_SLUG_BY_SPORT[variant.sport],
        serverVariantId: SQL_REGISTERED_VARIANTS.has(variant.id) ? variant.id : null,
        environment: variant.environment,
        requiresGps: variant.requiresGps,
        supportsManualEntry: true,
        requiredMetrics: variant.requiredMetrics,
        optionalSensorMetrics: variant.optionalMetrics ?? [],
      });
    }
  }

  // 2. Appliquer par-dessus les définitions enrichies A01 (S1.08–S1.12)
  for (const specialized of SPECIALIZED_MODE_DEFINITIONS) {
    map.set(specialized.id, specialized);
  }

  return map;
}

export const ACTIVITY_MODE_DEFINITIONS_BY_ID: ReadonlyMap<string, ActivityModeDefinition> =
  buildAllDefinitions();

export function getActivityModeDefinition(idOrSport: string): ActivityModeDefinition | null {
  const direct = ACTIVITY_MODE_DEFINITIONS_BY_ID.get(idOrSport);
  if (direct) return direct;

  // Fallback si un appelant passe l'un des 9 sports de base ('course', 'rando', ...)
  const family = SPORT_FAMILIES.find((f) => f.sport === idOrSport);
  if (!family) return null;
  const firstOutdoor = family.variants.find((v) => v.environment === 'outdoor') ?? family.variants[0];
  if (firstOutdoor) {
    return ACTIVITY_MODE_DEFINITIONS_BY_ID.get(firstOutdoor.id) ?? null;
  }
  return null;
}

export function listActivityModesByKind(modeKind: ActivityModeKind): ActivityModeDefinition[] {
  return Array.from(ACTIVITY_MODE_DEFINITIONS_BY_ID.values()).filter(
    (def) => def.modeKind === modeKind,
  );
}

/**
 * Construit le `SportSelection` et les identifiants serveur compatibles avec
 * `ExplorerState`, `localSession.ts` et `/api/explorer/v2/activity/start`.
 */
export function toServerPersistenceMapping(
  definitionOrId: ActivityModeDefinition | string,
): ServerPersistenceMapping | null {
  const def =
    typeof definitionOrId === 'string'
      ? getActivityModeDefinition(definitionOrId)
      : definitionOrId;
  if (!def) return null;

  const metrics: SportMetricKey[] = [...def.requiredMetrics];
  const selection: SportSelection = {
    sport: def.baseSport,
    variantId: def.id,
    variantLabel: def.label,
    catalogSlug: def.catalogSlug,
    environment: def.environment,
    metrics,
  };

  return {
    serverSport: def.baseSport,
    serverVariantId:
      def.serverVariantId && SQL_REGISTERED_VARIANTS.has(def.serverVariantId)
        ? def.serverVariantId
        : null,
    catalogSlug: def.catalogSlug,
    selection,
  };
}

/**
 * Évalue si un mode d'activité est visible et démarrable dans le contexte
 * courant (S1.08–S1.12).
 *
 * Points clés :
 *   - S1.09 (indoor) et S1.10 (piscine) démarrent **sans permission GPS**.
 *   - S1.12 (rééducation) n'est visible et démarrable en direct que lorsque
 *     `context.rehabEnabled === true`.
 *   - S1.10 (piscine) requiert une longueur de bassin valide (`poolLengthM`
 *     entre 10 m et 100 m) ou signale `needs-config`.
 */
export function getActivityModeAvailability(
  definitionOrId: ActivityModeDefinition | string,
  context: ActivityModeStartContext,
): ActivityModeAvailability {
  const def =
    typeof definitionOrId === 'string'
      ? getActivityModeDefinition(definitionOrId)
      : definitionOrId;

  if (!def) {
    return {
      status: 'blocked',
      startable: false,
      visible: false,
      requiresGps: false,
      reason: 'Mode d’activité inconnu.',
      missingSensorMetrics: [],
    };
  }

  if (def.modeKind === 'rehab' && !context.rehabEnabled) {
    return {
      status: 'blocked',
      startable: false,
      visible: false,
      requiresGps: def.requiresGps,
      reason: 'Active le mode rééducation dans les préférences de sport pour afficher cette activité.',
      missingSensorMetrics: def.optionalSensorMetrics,
    };
  }

  if (def.modeKind === 'swim-pool') {
    const poolLength = context.poolLengthM;
    if (
      poolLength !== undefined &&
      poolLength !== null &&
      (!Number.isFinite(poolLength) || poolLength < 10 || poolLength > 100)
    ) {
      return {
        status: 'needs-config',
        startable: false,
        visible: true,
        requiresGps: false,
        reason: 'Renseigne une longueur de bassin valide (entre 10 m et 100 m) avant de démarrer.',
        missingSensorMetrics: def.optionalSensorMetrics,
      };
    }
    return {
      status: 'ready',
      startable: true,
      visible: true,
      requiresGps: false,
      reason: null,
      missingSensorMetrics: def.optionalSensorMetrics,
    };
  }

  if (!def.requiresGps || def.environment === 'indoor') {
    return {
      status: 'ready',
      startable: true,
      visible: true,
      requiresGps: false,
      reason: null,
      missingSensorMetrics: def.optionalSensorMetrics,
    };
  }

  // Modes nécessitant le GPS (eau libre, ski alpin/snowboard/rando, outdoor)
  if (!context.gpsAvailable) {
    return {
      status: 'blocked',
      startable: false,
      visible: true,
      requiresGps: true,
      reason: 'Géolocalisation indisponible sur cet appareil.',
      missingSensorMetrics: def.optionalSensorMetrics,
    };
  }

  if (context.locationPermission === 'denied') {
    return {
      status: 'blocked',
      startable: false,
      visible: true,
      requiresGps: true,
      reason: 'Position refusée : autorise la géolocalisation pour démarrer.',
      missingSensorMetrics: def.optionalSensorMetrics,
    };
  }

  if (context.locationPermission === 'prompt') {
    return {
      status: 'needs-permission',
      startable: true,
      visible: true,
      requiresGps: true,
      reason: 'La position GPS sera demandée au démarrage.',
      missingSensorMetrics: def.optionalSensorMetrics,
    };
  }

  return {
    status: 'ready',
    startable: true,
    visible: true,
    requiresGps: true,
    reason: null,
    missingSensorMetrics: def.optionalSensorMetrics,
  };
}
