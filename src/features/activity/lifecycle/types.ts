/**
 * Lot A02 — Contrat TypeScript du cycle de vie des activités
 * (K5.04, K5.07, K5.10, S1.17, S1.18, S1.20, S1.22, S1.23, S1.24, S2.01, S2.16).
 *
 * Ce module définit les structures de données pures, immuables et versionnées
 * permettant :
 *  - d'unifier l'historique des anciennes randonnées (`hike_sessions`) et des
 *    nouvelles séances (`activity_sessions`) avec leur provenance (S1.17, S2.16) ;
 *  - de calculer de façon déterministe temps écoulé, temps en mouvement, pauses,
 *    distance, D+/D- et splits sans jamais inventer de donnée capteur (S2.01) ;
 *  - de lisser les pics GPS de vitesse par sport tout en conservant la trace
 *    d'origine privée intacte (K5.10) ;
 *  - de modifier nom, sport, variante, tags et médias de façon homogène (K5.04, S1.20) ;
 *  - de gérer l'état temporaire d'édition rapide après synchronisation (S1.18) ;
 *  - de recadrer (crop) et fractionner (split) une activité de façon idempotente
 *    et réversible (K5.07, S1.22) ;
 *  - de corriger la distance et le dénivelé avec méthode explicite et annulation (S1.23) ;
 *  - de supprimer logiquement (soft-delete) et restaurer pendant 30 jours (S1.24) ;
 *  - d'indexer et rechercher par sport, date, lieu et tags avec conservation du
 *    contexte de navigation du drawer parent (S2.16).
 */

import type { OutingVisibility } from '@/features/compte/server/sorties';
import type { ActivitySplit, Sport } from '@/features/explorer-v2/state/types';

export type { OutingVisibility, ActivitySplit, Sport };

/** Version courante de l'algorithme de calcul des métriques dérivées (recherche 06). */
export const LIFECYCLE_ALGORITHM_VERSION = 'lkdv-a02-v1';

/** Durée de rétention d'une activité supprimée avant purge définitive (S1.24). */
export const SOFT_DELETE_RETENTION_DAYS = 30;
export const SOFT_DELETE_RETENTION_MS = SOFT_DELETE_RETENTION_DAYS * 86_400_000;

/** Fenêtre par défaut d'éligibilité à l'édition rapide après synchronisation (S1.18). */
export const QUICK_EDIT_SYNC_WINDOW_MS = 24 * 3_600_000;

/** Tags normalisés d'activité (S1.20). */
export type ActivityTag = 'course' | 'sortie_longue' | 'trajet' | 'cause';

export const ACTIVITY_TAGS: readonly ActivityTag[] = [
  'course',
  'sortie_longue',
  'trajet',
  'cause',
];

export const ACTIVITY_TAG_LABELS: Readonly<Record<ActivityTag, string>> = {
  course: 'Course',
  sortie_longue: 'Sortie longue',
  trajet: 'Trajet',
  cause: 'Cause',
};

/** Origine / provenance d'une séance dans l'historique unifié (S1.17, S2.16). */
export type ActivityProvenanceOrigin =
  | 'hike_session'
  | 'activity_session'
  | 'device_import'
  | 'gpx_import'
  | 'manual';

export const PROVENANCE_ORIGIN_LABELS: Readonly<Record<ActivityProvenanceOrigin, string>> = {
  hike_session: 'Randonnée historique',
  activity_session: 'Séance Explorer',
  device_import: 'Import appareil',
  gpx_import: 'Import GPX',
  manual: 'Saisie manuelle',
};

export interface ActivityProvenance {
  origin: ActivityProvenanceOrigin;
  /** Identifiant dans la table source (`hike_sessions.id` ou `activity_sessions.id`). */
  sourceId: string;
  /** Identifiant client idempotent éventuel (`client_session_id`). */
  clientSessionId: string | null;
  /** Nom de l'appareil ou du service d'import si connu (jamais inventé). */
  deviceName: string | null;
  /** Horodatage ISO de synchronisation / import. */
  syncedAt: string | null;
  /** Libellé lisible pour la fiche Sortie (S2.16). */
  label: string;
}

/**
 * Échantillon géolocalisé et capteur d'une trace d'activité.
 *
 * Invariant (recherche 06) :
 * - `null` signifie « non mesuré / absent » ;
 * - `0` est une mesure explicite (altitude niveau de la mer, vitesse nulle).
 * Aucune valeur capteur n'est extrapolée ou inventée.
 */
export interface LifecyclePoint {
  lat: number;
  lng: number;
  elevationM: number | null;
  timestamp: string | null;
  /** Vitesse instantanée rapportée par le GPS (m/s), ou `null` si absente. */
  speedMs?: number | null;
  /** Précision horizontale (m), ou `null` si absente. */
  accuracyM?: number | null;
  /** Fréquence cardiaque mesurée (bpm), ou `null` si absente. `0` est traité comme lacune capteur. */
  heartRateBpm?: number | null;
  /** Cadence mesurée (rpm / spm), ou `null` si absente. */
  cadenceRpm?: number | null;
  /** Puissance mesurée (W), ou `null` si absente. */
  powerWatts?: number | null;
  /** Indique une reprise après pause manuelle (rupture de continuité). */
  discontinuity?: boolean;
}

/**
 * Synthèse d'un canal capteur (cardio, cadence, puissance).
 * `status: 'unavailable'` lorsque aucun échantillon valide n'existe.
 * `status: 'partial'` lorsque des lacunes (trous / zéros capteur) ont été détectées.
 */
export interface SensorChannelSummary {
  status: 'measured' | 'partial' | 'unavailable';
  avg: number | null;
  max: number | null;
  min: number | null;
  sampleCount: number;
  gapCount: number;
}

/** Raison du rejet ou du lissage d'un point GPS (K5.10). */
export type GpsSpikeReason =
  | 'invalid_coordinates'
  | 'accuracy_exceeded'
  | 'short_window_jump'
  | 'exceeds_sport_max_speed'
  | 'isolated_acceleration_spike'
  | 'non_monotonic_timestamp';

export interface GpsSpikeDetection {
  pointIndex: number;
  timestamp: string | null;
  impliedSpeedMs: number;
  maxAllowedSpeedMs: number;
  distanceDeltaM: number;
  timeDeltaS: number;
  reason: GpsSpikeReason;
}

export interface GpsSpikeSmoothingResult {
  /** Points valides retenus pour le calcul (sans les pics). */
  cleanedPoints: LifecyclePoint[];
  /** Trace d'origine conservée intacte (aucune perte silencieuse). */
  originalPoints: LifecyclePoint[];
  /** Détail des pics identifiés et écartés du calcul. */
  spikes: GpsSpikeDetection[];
  /** Vitesse maximale brute avant lissage (km/h), ou `null`. */
  rawMaxSpeedKmh: number | null;
  /** Vitesse maximale corrigée après lissage (km/h), ou `null`. */
  correctedMaxSpeedKmh: number | null;
  sport: Sport;
}

/**
 * Statistiques dérivées déterministes d'une activité (S2.01, K5.10, S1.17).
 */
export interface ActivityDerivedStats {
  /** Temps total écoulé entre le début et la fin de la séance (s). */
  elapsedTimeS: number;
  /** Temps en mouvement effectif hors pauses et hors trous GPS (s). */
  movingTimeS: number;
  /** Temps de pause cumulé (`elapsedTimeS - movingTimeS`) (s). */
  pauseTimeS: number;
  /** Distance totale parcourue (m). */
  distanceM: number;
  /** Distance totale parcourue (km, arrondie à 3 décimales). */
  distanceKm: number;
  /** Dénivelé positif cumulé D+ (m). */
  elevationGainM: number;
  /** Dénivelé négatif cumulé D- (m). */
  elevationLossM: number;
  /** Altitude minimale mesurée (m), ou `null` si aucune altitude. */
  minAltitudeM: number | null;
  /** Altitude maximale mesurée (m), ou `null` si aucune altitude. */
  maxAltitudeM: number | null;
  /** Vitesse moyenne en mouvement (km/h), ou `null` si `movingTimeS <= 0`. */
  avgSpeedKmh: number | null;
  /** Vitesse moyenne sur le temps écoulé total (km/h), ou `null` si `elapsedTimeS <= 0`. */
  elapsedSpeedKmh: number | null;
  /** Vitesse maximale corrigée des pics GPS (km/h), ou `null`. */
  maxSpeedKmh: number | null;
  /** Allure moyenne en mouvement (s/km), ou `null` si `distanceM <= 0` ou `movingTimeS <= 0`. */
  avgPaceSecondsPerKm: number | null;
  /** Découpe kilométrique recalculée sur les intervalles en mouvement. */
  splitsKm: ActivitySplit[];
  /** Découpe par mile recalculée en parallèle. */
  splitsMi: ActivitySplit[];
  /** Synthèse fréquence cardiaque (jamais inventée). */
  heartRate: SensorChannelSummary;
  /** Synthèse cadence (jamais inventée). */
  cadence: SensorChannelSummary;
  /** Synthèse puissance (jamais inventée). */
  power: SensorChannelSummary;
  /** Nombre de pics GPS écartés par le lissage K5.10. */
  spikeCount: number;
  /** Nombre d'intervalles de pause / coupure détectés. */
  pauseCount: number;
  /** Version de l'algorithme ayant produit ces statistiques. */
  algorithmVersion: string;
}

/** Média attaché à une activité (K5.04). */
export interface LifecycleMediaItem {
  id: string;
  kind: 'photo' | 'video';
  storagePath: string;
  url: string | null;
  caption: string | null;
  position: number;
}

/** Méthode de correction de la distance (S1.23). */
export type DistanceCorrectionMethod = 'raw' | 'recompute_from_trace' | 'manual_override';

/** Méthode de correction du dénivelé (S1.23). */
export type ElevationCorrectionMethod =
  | 'raw'
  | 'dem_projection'
  | 'threshold_smoothing'
  | 'manual_override';

/** État de correction distance/dénivelé avec sauvegarde pour annulation (S1.23). */
export interface DistanceElevationCorrectionState {
  distanceMethod: DistanceCorrectionMethod;
  elevationMethod: ElevationCorrectionMethod;
  appliedAt: string | null;
  /** Valeurs avant la dernière correction pour permettre l'annulation exacte. */
  previousSnapshot: {
    points: LifecyclePoint[];
    distanceM: number;
    elevationGainM: number;
    elevationLossM: number;
    minAltitudeM: number | null;
    maxAltitudeM: number | null;
    distanceMethod: DistanceCorrectionMethod;
    elevationMethod: ElevationCorrectionMethod;
  } | null;
}

/** Type d'opération enregistrée dans le journal de révisions. */
export type LifecycleRevisionKind =
  | 'initial'
  | 'metadata_edit'
  | 'sport_and_tags_edit'
  | 'quick_edit_sync'
  | 'media_edit'
  | 'crop'
  | 'split'
  | 'gps_spike_smoothing'
  | 'distance_elevation_correction'
  | 'revert_transformation'
  | 'soft_delete'
  | 'restore';

/** Entrée de révision permettant l'auditabilité, l'idempotence et la réversibilité. */
export interface LifecycleRevision {
  revision: number;
  kind: LifecycleRevisionKind;
  operationId: string | null;
  createdAt: string;
  summary: string;
  /** Snapshot géométrique et statistique avant la transformation (si géométrie/stats touchées). */
  snapshotBefore?: {
    points: LifecyclePoint[];
    startedAt: string | null;
    endedAt: string | null;
    sport: Sport;
    variantId: string | null;
    stats: ActivityDerivedStats;
  };
}

/**
 * Événement de recalcul des projections (totaux Compte, records, classements).
 * Garantit que chaque opération (recadrage, suppression, restauration, changement
 * de sport) met à jour les projections exactement une fois.
 */
export interface ProjectionRecalculationEvent {
  eventId: string;
  activityId: string;
  userId: string;
  revision: number;
  kind:
    | 'recalculate_totals'
    | 'exclude_from_projections'
    | 'include_in_projections'
    | 'invalidate_sport_records'
    | 'split_replace_projections';
  previousSport: Sport | null;
  currentSport: Sport;
  invalidatedRecords: boolean;
  invalidatedReason: string | null;
  deltaDistanceM: number;
  deltaElevationGainM: number;
  deltaMovingTimeS: number;
  createdAt: string;
}

/** État temporaire d'édition rapide après synchronisation (S1.18). */
export type QuickEditStatus = 'not_applicable' | 'pending' | 'resolved' | 'dismissed' | 'expired';

export interface QuickEditAfterSyncState {
  status: QuickEditStatus;
  visible: boolean;
  syncedAt: string | null;
  expiresAt: string | null;
  editableFields: readonly ('title' | 'visibility' | 'sport' | 'tags' | 'kitId' | 'gearIds')[];
}

/** Statut du cycle de vie d'une activité (S1.24). */
export type ActivityLifecycleStatus = 'active' | 'deleted';

/**
 * Fiche d'activité unifiée du lot A02.
 * Couvre les anciennes randonnées (`hike_sessions`) et les nouvelles séances
 * (`activity_sessions`) sans perte d'identifiant ni de liens.
 */
export interface LifecycleActivityRecord {
  /** Identifiant unique et stable de la séance. */
  id: string;
  userId: string;
  /** Révision monotone incrémentée à chaque écriture effective. */
  revision: number;
  lifecycleStatus: ActivityLifecycleStatus;
  deletedAt: string | null;
  purgeAfter: string | null;

  /** Métadonnées éditables (K5.04, S1.18, S1.20). */
  title: string;
  notes: string;
  sport: Sport;
  variantId: string | null;
  tags: ActivityTag[];
  visibility: OutingVisibility;

  /** Horodatages ISO de début et de fin de la tranche active. */
  startedAt: string | null;
  endedAt: string | null;

  /** Contexte géographique et liens (S1.17, S2.16). */
  routeId: string | null;
  routeName: string | null;
  massif: string | null;
  placeLabel: string | null;
  kitId: string | null;
  gearIds: string[];
  carnetIds: string[];
  groupIds: string[];

  /** Médias ordonnés et couverture (K5.04). */
  media: LifecycleMediaItem[];
  coverUrl: string | null;

  /** Provenance et traçabilité de filiation (S1.17, S1.22, S2.16). */
  provenance: ActivityProvenance;
  parentActivityId: string | null;
  parentRevision: number | null;
  splitPartIndex: number | null;

  /**
   * Trace active courante (après recadrage ou correction éventuelle).
   */
  points: LifecyclePoint[];
  /**
   * Trace brute d'origine, jamais écrasée silencieusement (Invariant A02, K5.07, K5.10, S1.22, S1.23).
   */
  originalPoints: LifecyclePoint[];

  /** Statistiques dérivées courantes, toujours synchronisées avec `points` et `correctionState`. */
  stats: ActivityDerivedStats;

  /** État des corrections de distance et de dénivelé (S1.23). */
  correctionState: DistanceElevationCorrectionState;

  /** Éligibilité aux records et motifs d'invalidation (K5.04, K5.07, S1.20, S1.22, S1.23). */
  recordsEligibility: {
    eligible: boolean;
    invalidatedRecords: boolean;
    reasons: string[];
  };

  /** État temporaire d'édition rapide après synchronisation (S1.18). */
  quickEditState: QuickEditAfterSyncState;

  /** Historique des révisions et opérations appliquées. */
  revisions: LifecycleRevision[];
  /** Dernier événement de recalcul de projection émis. */
  lastProjectionEvent: ProjectionRecalculationEvent | null;
}

/** Paramètres de recadrage (crop) d'une activité (K5.07, S1.22). */
export interface CropBounds {
  /** Identifiant d'opération optionnel pour garantir l'idempotence des rejeux. */
  operationId?: string;
  /** Indice de début inclusif (0-based) dans `record.points`. */
  startIndex?: number;
  /** Indice de fin inclusif (0-based) dans `record.points`. */
  endIndex?: number;
  /** Horodatage ISO minimal inclusif. */
  startTimeIso?: string;
  /** Horodatage ISO maximal inclusif. */
  endTimeIso?: string;
  /** Décalage en secondes depuis le début de la trace (>= 0). */
  startOffsetS?: number;
  /** Décalage en secondes depuis le début de la trace pour la fin. */
  endOffsetS?: number;
  /** Distance cumulée minimale depuis le début (m). */
  startDistanceM?: number;
  /** Distance cumulée maximale depuis le début (m). */
  endDistanceM?: number;
}

export type CropRejectionCode =
  | 'empty_trace'
  | 'invalid_bounds'
  | 'too_few_points_remaining'
  | 'activity_deleted';

export interface CropPreviewResult {
  ok: true;
  resolvedStartIndex: number;
  resolvedEndIndex: number;
  croppedPoints: LifecyclePoint[];
  removedStartPoints: number;
  removedEndPoints: number;
  beforeStats: ActivityDerivedStats;
  afterStats: ActivityDerivedStats;
   trimmedDistanceM: number;
  trimmedDurationS: number;
  invalidatesRecords: boolean;
}

export type CropActivityOutcome =
  | {
      ok: true;
      idempotentReplay: boolean;
      record: LifecycleActivityRecord;
      preview: CropPreviewResult;
      projectionEvent: ProjectionRecalculationEvent;
    }
  | {
      ok: false;
      code: CropRejectionCode;
      error: string;
    };

/** Spécification d'un point de coupure pour fractionner (split) une activité (S1.22). */
export interface SplitActivitySpec {
  operationId?: string;
  /** Indice(s) de point où scinder la trace (le point d'indice `k` est la fin de la partie 1 et le début de la partie 2). */
  splitIndices?: number[];
  /** Ou horodatage(s) ISO de coupure. */
  splitTimestampsIso?: string[];
  /** Ou distance(s) cumulée(s) en mètres depuis le départ. */
  splitDistancesM?: number[];
  /** Titres personnalisés optionnels pour les parties créées. */
  partTitles?: string[];
}

export type SplitRejectionCode =
  | 'empty_trace'
  | 'invalid_split_point'
  | 'part_too_short'
  | 'activity_deleted';

export type SplitActivityOutcome =
  | {
      ok: true;
      idempotentReplay: boolean;
      parentRecord: LifecycleActivityRecord;
      parts: LifecycleActivityRecord[];
      projectionEvent: ProjectionRecalculationEvent;
    }
  | {
      ok: false;
      code: SplitRejectionCode;
      error: string;
    };

/** Paramètres de correction de distance et de dénivelé (S1.23). */
export interface DistanceElevationCorrectionInput {
  operationId?: string;
  distanceMethod?: DistanceCorrectionMethod;
  /** Distance corrigée manuellement en mètres (requis si `distanceMethod === 'manual_override'`). */
  manualDistanceM?: number;
  elevationMethod?: ElevationCorrectionMethod;
  /** Altitudes DEM en mètres alignées sur `record.points` (requis si `elevationMethod === 'dem_projection'`). */
  demElevationsM?: Array<number | null>;
  /** D+ corrigé manuellement en mètres (requis si `elevationMethod === 'manual_override'`). */
  manualElevationGainM?: number;
  /** D- corrigé manuellement en mètres (optionnel avec `manual_override`). */
  manualElevationLossM?: number;
  /** Seuil d'hystérésis en mètres pour `threshold_smoothing` (défaut : 2 m). */
  smoothingThresholdM?: number;
}

export type CorrectionRejectionCode =
  | 'invalid_distance'
  | 'invalid_elevation'
  | 'missing_dem_samples'
  | 'nothing_to_correct'
  | 'nothing_to_revert'
  | 'activity_deleted';

export type DistanceElevationCorrectionOutcome =
  | {
      ok: true;
      record: LifecycleActivityRecord;
      projectionEvent: ProjectionRecalculationEvent;
    }
  | {
      ok: false;
      code: CorrectionRejectionCode;
      error: string;
    };

/** Patch d'édition des métadonnées, du sport et des tags (K5.04, S1.18, S1.20). */
export interface ActivityMetadataPatch {
  operationId?: string;
  title?: string;
  notes?: string;
  sport?: Sport;
  variantId?: string | null;
  tags?: readonly string[];
  visibility?: OutingVisibility;
  kitId?: string | null;
  gearIds?: readonly string[];
}

export type MetadataEditRejectionCode =
  | 'invalid_sport'
  | 'invalid_variant'
  | 'variant_sport_mismatch'
  | 'invalid_tag'
  | 'activity_deleted'
  | 'forbidden';

export type ActivityMetadataEditOutcome =
  | {
      ok: true;
      record: LifecycleActivityRecord;
      sportChanged: boolean;
      projectionEvent: ProjectionRecalculationEvent | null;
    }
  | {
      ok: false;
      code: MetadataEditRejectionCode;
      error: string;
    };

/** Action de gestion homogène des médias (K5.04). */
export type LifecycleMediaAction =
  | {
      type: 'add';
      id: string;
      kind?: 'photo' | 'video';
      storagePath: string;
      url?: string | null;
      caption?: string | null;
    }
  | {
      type: 'remove';
      id: string;
    }
  | {
      type: 'reorder';
      orderedIds: readonly string[];
    }
  | {
      type: 'update_caption';
      id: string;
      caption: string | null;
    }
  | {
      type: 'set_cover';
      id: string;
    };

export type MediaEditRejectionCode =
  | 'invalid_storage_path'
  | 'media_not_found'
  | 'duplicate_media_id'
  | 'activity_deleted'
  | 'forbidden';

export type LifecycleMediaEditOutcome =
  | {
      ok: true;
      record: LifecycleActivityRecord;
    }
  | {
      ok: false;
      code: MediaEditRejectionCode;
      error: string;
    };

/** Résultat d'éligibilité à la restauration (S1.24). */
export interface RestoreEligibility {
  eligible: boolean;
  reason: 'ok' | 'not_deleted' | 'retention_expired' | 'forbidden';
  remainingMs: number;
  remainingDays: number;
  deletedAt: string | null;
  purgeAfter: string | null;
}

export type SoftDeleteOutcome =
  | {
      ok: true;
      alreadyDeleted: boolean;
      record: LifecycleActivityRecord;
      projectionEvent: ProjectionRecalculationEvent | null;
    }
  | {
      ok: false;
      code: 'forbidden';
      error: string;
    };

export type RestoreActivityOutcome =
  | {
      ok: true;
      record: LifecycleActivityRecord;
      projectionEvent: ProjectionRecalculationEvent;
    }
  | {
      ok: false;
      code: 'not_deleted' | 'retention_expired' | 'forbidden';
      error: string;
    };

/** Critères compris et corrigeables par l'utilisateur dans la recherche (S2.16). */
export interface ParsedSearchCriteria {
  rawQuery: string;
  sports: Sport[];
  tags: ActivityTag[];
  dateRange: {
    fromIso: string | null;
    toIso: string | null;
    label: string | null;
  };
  placeTerms: string[];
  provenanceOrigins: ActivityProvenanceOrigin[];
  textTerms: string[];
}

export interface SearchCriterionChip {
  kind: 'sport' | 'tag' | 'date' | 'place' | 'provenance' | 'text';
  value: string;
  label: string;
}

export interface ActivitySearchResult {
  query: string;
  criteria: ParsedSearchCriteria;
  chips: SearchCriterionChip[];
  items: LifecycleActivityRecord[];
  totalMatched: number;
  requestSeq: number;
}

/**
 * Contexte de navigation conservé à l'ouverture d'un drawer ou sous-drawer
 * (K5.04, K5.07, S1.17, S1.20, S1.22, S1.23, S1.24, S2.16).
 */
export interface DrawerNavigationContext {
  parentSurface: 'sorties_list' | 'sortie_detail' | 'search_results';
  activeActivityId: string | null;
  activeSubDrawer:
    | null
    | 'edit_metadata_media'
    | 'edit_sport_tags'
    | 'crop_split'
    | 'correct_distance_elevation'
    | 'delete_restore'
    | 'quick_edit_sync';
  scrollOffsetPx: number;
  searchQuery: string;
  searchCriteria: ParsedSearchCriteria | null;
  latestRequestSeq: number;
}
