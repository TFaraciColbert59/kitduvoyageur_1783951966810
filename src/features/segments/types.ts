/**
 * Contrat TypeScript du domaine Segments Sportifs & Validation des Efforts (Lot S01).
 *
 * Couvre les fiches :
 * - S4.01 : Détection automatique des passages (vélo, course, trail, randonnée, ski)
 * - S4.02 : Créer, modifier, rendre privé/public ou supprimer un segment
 * - S4.03 : Recherche, favoris et masquage personnel de segments
 * - S4.04 : Segments vérifiés et dédoublonnage en arrière-plan
 * - S4.07 : Historique d'efforts, records personnels (PR) et comparaison point par point
 * - S4.11 : Signalement de segment dangereux, exclusion du classement et arrêt des notifications
 * - S4.12 : Détection des temps invalides (anti-triche, sauts GPS, véhicule) et signalement/contestation
 *
 * Invariants :
 * - Moteur pur et déterministe, sans I/O réseau ni dépendance UI.
 * - Respect strict de P01 : aucun segment privé ni effort issu d'une activité privée/masquée
 *   ne fuite dans les classements ou recherches publics.
 * - Aucune métrique capteur inventée (`null` lorsque absente).
 */

export type SegmentSport =
  | 'running'
  | 'trail'
  | 'cycling'
  | 'gravel'
  | 'mtb'
  | 'hiking'
  | 'walking'
  | 'ski';

export type SegmentDirection = 'forward' | 'reverse';

export type SegmentVisibility = 'public' | 'private';

export type ActivityAudienceVisibility =
  | 'public'
  | 'communaute'
  | 'followers'
  | 'private'
  | 'collective_anonymized';

export interface GeoPoint {
  lat: number;
  lng: number;
  ele?: number | null;
}

export interface SegmentTrackPoint extends GeoPoint {
  timestamp: string;
  accuracyM?: number | null;
  speedMps?: number | null;
  heartRateBpm?: number | null;
  powerW?: number | null;
  cadenceRpm?: number | null;
  /** Indique si ce point se trouve dans une zone de confidentialité masquée (P01). */
  maskedByPrivacyZone?: boolean;
}

export interface SegmentTrackPause {
  startAt: string;
  endAt: string;
  durationS: number;
}

export interface PrivacyZoneCircle {
  id?: string;
  center: { lat: number; lng: number };
  radiusM: number;
}

export interface SegmentDefinition {
  id: string;
  version: number;
  name: string;
  sport: SegmentSport;
  direction: SegmentDirection;
  points: GeoPoint[];
  startPoint: GeoPoint;
  endPoint: GeoPoint;
  lengthM: number;
  elevationGainM: number;
  elevationLossM: number;
  meanGradePct: number;
  maxGradePct: number;
  surface?: string | null;
  visibility: SegmentVisibility;
  createdByUserId: string;
  sourceActivityId?: string | null;
  verified: boolean;
  verifiedReason?: string | null;
  /** Si ce segment a été fusionné dans un segment canonique (S4.04), pointe vers l'ID maître. */
  canonicalSegmentId: string | null;
  /** Liste des IDs de segments doublons absorbés par ce segment canonique. */
  mergedDuplicateIds: string[];
  /** Indique si le segment est marqué dangereux (S4.11). */
  hazardous: boolean;
  hazardCategory?: SegmentHazardCategory | null;
  hazardReportedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string | null;
}

export interface ActivityTraceForSegments {
  activityId: string;
  activityVersion: number;
  userId: string;
  sport: SegmentSport;
  points: SegmentTrackPoint[];
  pauses?: SegmentTrackPause[];
  visibility: ActivityAudienceVisibility;
  /** Zones masquées P01 (K7.05 / S6.14). */
  hiddenZones?: PrivacyZoneCircle[];
  /** Indices de points explicitement masqués par la projection P01. */
  maskedPointIndices?: number[];
  /** Activité saisie manuellement ou sur home-trainer/indoor (S1.08/S1.09). */
  isManualOrIndoor?: boolean;
  /** Activité assistée électriquement (VAE / e-bike) sur un sport non-VAE. */
  ebikeOrAssisted?: boolean;
  /** Opt-out explicite de l'utilisateur pour les classements publics / agrégats. */
  optOutPublicLeaderboards?: boolean;
}

export type EffortStatus =
  | 'valid'
  | 'incomplete'
  | 'reversed'
  | 'excluded'
  | 'under_review';

export type EffortExclusionReason =
  | 'wrong_direction'
  | 'incomplete_coverage'
  | 'corridor_deviation'
  | 'uturn_detected'
  | 'gps_jump_or_teleport'
  | 'interpolated_finish_gap'
  | 'low_gps_quality'
  | 'speed_exceeded_for_sport'
  | 'acceleration_anomaly'
  | 'motorized_vehicle_suspected'
  | 'sport_mismatch'
  | 'ebike_on_non_ebike_segment'
  | 'manual_or_indoor_activity'
  | 'flagged_by_community'
  | 'segment_hazardous';

export interface SegmentEffort {
  effortId: string;
  /** Clé d'unicité idempotente : `${activityId}:${segmentId}:v${segmentVersion}:occ${occurrenceIndex}` */
  uniquenessKey: string;
  segmentId: string;
  segmentVersion: number;
  activityId: string;
  activityVersion: number;
  userId: string;
  sport: SegmentSport;
  direction: SegmentDirection;
  occurrenceIndex: number;
  status: EffortStatus;
  exclusionReasons: EffortExclusionReason[];
  startPointIndex: number;
  endPointIndex: number;
  enteredAt: string;
  exitedAt: string;
  /** Temps total écoulé entre le franchissement interpolé du départ et de l'arrivée (secondes). */
  elapsedDurationS: number;
  /** Temps en mouvement (hors pauses, secondes). */
  movingDurationS: number;
  /** Temps de pause cumulé pendant l'effort (secondes). */
  pausedDurationS: number;
  coveredDistanceM: number;
  coverageRatio: number;
  maxCorridorDeviationM: number;
  elevationGainM: number;
  elevationLossM: number;
  avgSpeedKmh: number;
  maxSpeedKmh: number;
  /** Capteurs optionnels : toujours `null` si absents de la trace (aucune donnée inventée). */
  avgHeartRateBpm: number | null;
  maxHeartRateBpm: number | null;
  avgPowerW: number | null;
  avgCadenceRpm: number | null;
  mapMatchQuality: number;
  gpsQuality: number;
  visibility: SegmentVisibility;
  /** `true` uniquement si effort `valid`, activité publique, hors zone masquée P01, segment public non dangereux. */
  eligibleForPublicLeaderboard: boolean;
  /** Rang personnel de cet effort pour l'utilisateur sur ce segment (1 = PR, 2 = 2e, 3 = 3e). */
  personalRank?: number | null;
  isPersonalRecord?: boolean;
}

export interface SegmentMatchingOptions {
  /** Rayon de franchissement du départ/arrivée en mètres (défaut selon sport : 25–35 m). */
  gateRadiusM?: number;
  /** Tolérance latérale maximale du couloir en mètres (défaut selon sport : 30–40 m). */
  corridorToleranceM?: number;
  /** Écart angulaire maximal toléré en degrés par rapport au cap du segment (défaut 65°). */
  maxBearingDeltaDeg?: number;
  /** Ratio minimal de jalons du segment devant être couverts dans l'ordre (défaut 0.85). */
  minCoverageRatio?: number;
  /** Saut maximal autorisé entre deux points consécutifs sur le segment en mètres (défaut 250 m). */
  maxPointGapM?: number;
  /** Trou temporel maximal autorisé entre deux points consécutifs (secondes, défaut 25 s). */
  maxTimeGapS?: number;
  /** Précision GPS maximale tolérée en mètres (défaut 50 m). */
  maxGpsAccuracyM?: number;
}

export type SegmentHazardCategory =
  | 'dangerous_road_or_traffic'
  | 'blind_intersection'
  | 'steep_technical_descent'
  | 'trail_closed_or_collapsed'
  | 'private_property'
  | 'other_safety_hazard';

export interface SegmentHazardReport {
  reportId: string;
  segmentId: string;
  reporterUserId: string;
  category: SegmentHazardCategory;
  description: string;
  createdAt: string;
  officialSource?: boolean;
  status: 'pending' | 'active' | 'resolved' | 'rejected';
}

export interface DrawerParentContext {
  drawerId: string;
  view: 'activity_trace' | 'segment_detail' | 'explorer_search' | 'my_efforts';
  scrollOffsetPx: number;
  selectedSegmentId?: string | null;
  selectedActivityId?: string | null;
  searchQuery?: string;
}
