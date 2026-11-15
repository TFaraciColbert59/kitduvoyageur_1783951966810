/**
 * Contrats TypeScript unifiés des modes d'activité A01 (S1.08 à S1.12).
 *
 * Ce module définit les types partagés entre :
 *   - S1.08 : Saisie manuelle d'activité (sans GPS ni import)
 *   - S1.09 : Enregistrement indoor et entraînements virtuels (tapis, home-trainer, rameur)
 *   - S1.10 : Natation piscine (longueurs, bassin, SWOLF) et eau libre (GPS, allure /100m)
 *   - S1.11 : Ski et snowboard avec détection automatique des descentes (runs vs remontées)
 *   - S1.12 : Rééducation comme type d'activité (saisie manuelle, direct doux et mapping catalogue)
 *
 * Invariants :
 *   1. Aucune modification des types verrouillés (`state/types.ts`). Les
 *      structures produites (`ActivityState`, `SportSelection`,
 *      `LocalSessionRecord`) sont 100 % compatibles avec le store et la
 *      persistance existante (`localSession.ts`, `sessionSync.ts`).
 *   2. Aucune métrique capteur inventée : toute métrique dépendante d'un
 *      capteur absent (FC, puissance, cadence, coups de bras/rame, GPS en
 *      mode indoor/manuel) porte un statut explicite `'unavailable'`.
 *   3. Séparation horloge murale UTC (`startedAt`, `endedAt`) et durée
 *      monotone en mouvement (`movingS`).
 */

import type {
  ActivitySplit,
  ActivityState,
  Sport,
  SportEnvironment,
  SportMetricKey,
  SportSelection,
} from '../../state/types';
import type { LocalSessionRecord } from '../localSession';

export type UnitSystem = 'metric' | 'imperial';

export type DistanceUnit = 'm' | 'km' | 'mi' | 'yd';

export type ElevationUnit = 'm' | 'ft';

export type PoolLengthUnit = 'm' | 'yd';

/**
 * Identifiants des modes spécialisés du lot A01, en complément du suivi GPS
 * standard (`gps-outdoor`).
 */
export type ActivityModeKind =
  | 'gps-outdoor'
  | 'manual'
  | 'indoor'
  | 'swim-pool'
  | 'swim-open-water'
  | 'ski-alpine'
  | 'snowboard'
  | 'ski-rando'
  | 'rehab';

/**
 * Statut explicite d'une métrique :
 *   - `measured` : captée ou calculée à partir de mesures réelles ;
 *   - `manual` : déclarée par l'utilisateur (saisie manuelle ou console indoor) ;
 *   - `unavailable` : capteur/GPS absent ou non applicable.
 */
export type MetricAvailabilityStatus = 'measured' | 'manual' | 'unavailable';

export type MetricUnavailableReason =
  | 'no_gps_in_mode'
  | 'no_sensor_connected'
  | 'elevation_missing'
  | 'stroke_count_missing'
  | 'insufficient_distance_or_time'
  | 'not_applicable_for_sport';

export interface ExplicitMetricValue<T = number> {
  status: MetricAvailabilityStatus;
  value: T | null;
  unit: string;
  formatted: string;
  unavailableReason?: MetricUnavailableReason;
}

/**
 * Contexte d'éligibilité au démarrage d'un mode d'activité.
 * Étend `SportStartContext` sans modifier `sportSelection.ts`.
 */
export interface ActivityModeStartContext {
  locationPermission: 'granted' | 'denied' | 'prompt';
  gpsAvailable: boolean;
  /** S1.12 : le mode rééducation n'est visible/démarrable que s'il est activé. */
  rehabEnabled?: boolean;
  /** S1.10 : longueur de bassin valide fournie pour la natation en piscine. */
  poolLengthM?: number | null;
}

export type ActivityModeStartStatus = 'ready' | 'needs-permission' | 'needs-config' | 'blocked';

export interface ActivityModeAvailability {
  status: ActivityModeStartStatus;
  startable: boolean;
  visible: boolean;
  requiresGps: boolean;
  reason: string | null;
  missingSensorMetrics: readonly SportMetricKey[];
}

/**
 * Mapping de persistance vers le contrat serveur existant
 * (`/api/explorer/v2/activity/start` et `activity_sessions`).
 *
 * `serverSport` appartient toujours aux 9 sports de `explorer_sport_map`.
 * `serverVariantId` n'est renseigné que si la variante figure dans la table SQL
 * `explorer_sport_variants` ; sinon il vaut `null` côté RPC tout en conservant
 * `selection` complet dans `LocalSessionRecord` et `ActivityState`.
 */
export interface ServerPersistenceMapping {
  serverSport: Sport;
  serverVariantId: string | null;
  catalogSlug: string;
  selection: SportSelection;
}

/**
 * Définition statique d'une variante/mode d'activité A01.
 */
export interface ActivityModeDefinition {
  id: string;
  modeKind: ActivityModeKind;
  label: string;
  description: string;
  baseSport: Sport;
  catalogSlug: string;
  /**
   * `variant_id` autorisé par `explorer_sport_variants` côté SQL, ou `null`
   * lorsque la variante est persistée sur le sport parent sans nouvelle
   * migration SQL.
   */
  serverVariantId: string | null;
  environment: SportEnvironment;
  requiresGps: boolean;
  supportsManualEntry: boolean;
  requiredMetrics: readonly SportMetricKey[];
  optionalSensorMetrics: readonly SportMetricKey[];
}

/**
 * Bilan unifié produit par n'importe quel mode d'activité A01, prêt pour
 * l'affichage dans l'écran Bilan (`ExplorerState.summary`) et la
 * synchronisation (`localSession.ts` / `sessionSync.ts`).
 */
export interface ActivityModeSummary<TDetails = unknown> {
  modeKind: ActivityModeKind;
  variantId: string;
  variantLabel: string;
  units: UnitSystem;
  /** État compatible avec `ExplorerState.summary`. */
  activity: ActivityState & { endedAt: number };
  /** Fiche locale prête pour IndexedDB et `finishSession()`. */
  localRecord: LocalSessionRecord;
  /** Durée totale écoulée (horloge murale ou monotone pauses incluses), en s. */
  elapsedS: number;
  /** Durée en mouvement, en s. */
  movingS: number;
  metrics: {
    distance: ExplicitMetricValue<number>;
    duration: ExplicitMetricValue<number>;
    elevationGain: ExplicitMetricValue<number>;
    verticalDrop: ExplicitMetricValue<number>;
    speed: ExplicitMetricValue<number>;
    pace: ExplicitMetricValue<number>;
    heartRate: ExplicitMetricValue<number>;
    power: ExplicitMetricValue<number>;
    cadence: ExplicitMetricValue<number>;
  };
  splits: ActivitySplit[];
  mileSplits: ActivitySplit[];
  laps: ActivitySplit[];
  details: TDetails;
}
