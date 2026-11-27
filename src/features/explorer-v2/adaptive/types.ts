/**
 * Contrats TypeScript du moteur adaptatif de performance Explorer v2.
 *
 * Règle zéro-mock : aucune métrique physiologique, d'équipement ou d'état de
 * forme n'est fabriquée lorsqu'aucune donnée réelle n'existe (`null` explicite
 * et statut `'cold_start'`).
 */

import type {
  ParticipantPerformanceStats,
  SortieActivityKind,
  SortieDifficultyLevel,
} from '@/features/community/v2/create/sortie/sortiePerformanceEngine';
import type { AutoPauseConfig } from '../activity/tracker';
import type { Sport } from '../state/types';

export type AdaptiveCalibrationStatus = 'calibrated' | 'partial' | 'cold_start';

export type ReadinessBand = 'peak' | 'ready' | 'moderate' | 'recover' | 'rehab_guarded';

export type LoadTier = 'power_tss' | 'hr_relative_effort' | 'srpe' | 'gps_mechanical_ke';

export interface SessionRecord {
  readonly id: string;
  readonly sport: Sport | SortieActivityKind;
  readonly startedAtMs: number;
  readonly endedAtMs: number;
  readonly movingS: number;
  readonly distanceKm?: number | null;
  readonly elevationGainM?: number | null;
  readonly elevationLossM?: number | null;
  readonly maxAltitudeM?: number | null;
  readonly meanAltitudeM?: number | null;
  readonly packWeightKg?: number | null;
  /** Tier 1 : puissance normalisée mesurée (W) + FTP (W). */
  readonly normalizedPowerW?: number | null;
  readonly ftpW?: number | null;
  /** Tier 2 : effort relatif cardio calculé depuis les zones FC. */
  readonly hrRelativeEffort?: number | null;
  /** Tier 3 : effort perçu RPE (1..10). */
  readonly rpe?: number | null;
  /** Douleur déclarée en mode rééducation (0..10). */
  readonly rehabPainLevel?: number | null;
  readonly rehabBodyZone?: string | null;
}

export interface SessionLoadResult {
  /** Charge normalisée sur une échelle homogène de type TSS (100 ≈ 1 h au seuil). */
  readonly loadUnits: number;
  readonly tier: LoadTier;
  /** Charge excentrique spécifique aux descentes (DOMS quadriceps). */
  readonly eccentricLoadUnits: number;
  /** Kilomètre-Effort mécanique si calculable depuis les métriques GPS. */
  readonly effortScoreKe: number | null;
}

export interface BiometricWellnessSnapshot {
  readonly recordedAtMs: number;
  readonly sleepHours?: number | null;
  /** Qualité de sommeil : 1..5 ou 0..100. */
  readonly sleepQuality?: number | null;
  readonly restingHrBpm?: number | null;
  readonly baselineRestingHrBpm?: number | null;
  readonly hrvMs?: number | null;
  readonly baselineHrvMs?: number | null;
  /** Courbatures / fatigue musculaire déclarées (0..10). */
  readonly sorenessLevel?: number | null;
  /** Énergie subjective (1..5). */
  readonly subjectiveEnergy?: number | null;
  /** Douleur en rééducation (0..10). */
  readonly rehabPainLevel?: number | null;
  readonly rehabBodyZone?: string | null;
}

export interface ReadinessInput {
  readonly sessions: readonly SessionRecord[];
  readonly wellness?: BiometricWellnessSnapshot | null;
  readonly participantStats?: ParticipantPerformanceStats | null;
  readonly homeAltitudeM?: number | null;
}

export type AcwrZone = 'undertrained' | 'sweet_spot' | 'caution' | 'spike' | 'insufficient_data';

export interface AcwrMetrics {
  readonly acuteLoad7d: number;
  readonly chronicLoad28d: number;
  readonly rawRatio: number | null;
  /** Ratio amorti vers 1.0 par crédibilité bayésienne de Bühlmann au démarrage à froid. */
  readonly dampedRatio: number | null;
  readonly credibilityWeight: number;
  readonly zone: AcwrZone;
}

export interface AltitudeAcclimatization {
  /** Plafond d'altitude acclimaté estimé sur les 21 derniers jours (m). */
  readonly ceilingM: number;
  readonly recentHighAltitudeSessions: number;
  readonly highestRecentAltitudeM: number | null;
  /** Facteur d'atténuation de la pénalité hypoxique [0..0.65]. */
  readonly attenuationFactor: number;
}

export interface ExplorerReadiness {
  readonly status: AdaptiveCalibrationStatus;
  /** 0..100 quand des données existent ; `null` en `cold_start` (zéro mock). */
  readonly score: number | null;
  readonly band: ReadinessBand | null;
  readonly confidence: number;
  readonly acwr: AcwrMetrics;
  /** Dette de récupération sur 96 h (0..100). */
  readonly recoveryDebt96h: number;
  /** Fatigue excentrique / DOMS issue des descentes récentes (0..100). */
  readonly eccentricDomsScore: number;
  /** Score biométrique/bien-être (0..100), ou `null` si aucune mesure fraîche. */
  readonly wellnessScore: number | null;
  readonly rehabPainCapApplied: boolean;
  readonly activeRehabPainLevel: number | null;
  readonly altitudeAcclimatization: AltitudeAcclimatization;
  /** Indice d'endurance aérobie (0..100) sur 28 j, ou `null` sans historique. */
  readonly aerobicEnduranceIndex: number | null;
  readonly daysWithData: number;
  readonly sessionCount28d: number;
  readonly summaryFr: string;
  readonly computedAtMs: number;
}

export type DaylightStatus = 'normal' | 'polar_day' | 'polar_night';

export interface OfflineDaylight {
  readonly status: DaylightStatus;
  readonly lat: number;
  readonly lng: number;
  readonly dateMs: number;
  readonly sunriseMs: number | null;
  readonly sunsetMs: number | null;
  readonly civilDawnMs: number | null;
  readonly civilDuskMs: number | null;
  readonly solarNoonMs: number;
  readonly daylightHours: number;
  readonly solarDeclinationDeg: number;
}

export interface WeatherSnapshot {
  readonly temperatureC: number | null;
  readonly humidityPct?: number | null;
  readonly windSpeedKmh?: number | null;
  readonly windGustKmh?: number | null;
  readonly precipitationMmH?: number | null;
  readonly visibilityM?: number | null;
  readonly cloudCoverPct?: number | null;
  readonly thunderstormRisk?: 'none' | 'moderate' | 'high' | null;
  readonly avalancheRiskLevel?: 1 | 2 | 3 | 4 | 5 | null;
  readonly wildfireAlert?: boolean | null;
  readonly floodAlert?: boolean | null;
  readonly fetchedAtMs?: number | null;
}

export type ThermalStressLevel =
  | 'cold_extreme'
  | 'cold'
  | 'comfortable'
  | 'warm'
  | 'heat_extreme'
  | 'unknown';

export interface ThermalStressResult {
  readonly level: ThermalStressLevel;
  readonly apparentTempC: number | null;
  readonly windChillC: number | null;
  readonly heatIndexC: number | null;
  readonly speedPenaltyFactor: number;
  readonly hydrationMultiplier: number;
  readonly advisoryFr: string | null;
}

export type WindHazardLevel = 'calm' | 'breezy' | 'strong' | 'gale' | 'storm';

export interface RidgeWindResult {
  readonly baseWindKmh: number;
  readonly effectiveWindKmh: number;
  readonly effectiveGustKmh: number;
  readonly exposureMultiplier: number;
  readonly hazardLevel: WindHazardLevel;
}

export type TechnicalSurface =
  | 'paved'
  | 'gravel'
  | 'trail'
  | 'rocky_alpine'
  | 'scree'
  | 'snow'
  | 'ice'
  | 'mud';

export type TechnicalGrade = 'T1' | 'T2' | 'T3' | 'T4' | 'T5' | 'T6';

export type SafeEtaFlag =
  | 'darkness_risk'
  | 'turnaround_imminent'
  | 'high_altitude_unacclimatized'
  | 'severe_weather'
  | 'fatigue_slowdown'
  | 'offline_uncertainty'
  | 'polar_night';

export interface SafeEtaInput {
  readonly activity: SortieActivityKind;
  readonly distanceKm: number;
  readonly elevationGainM: number;
  readonly elevationLossM?: number | null;
  readonly maxAltitudeM?: number | null;
  readonly meanAltitudeM?: number | null;
  readonly nbJours?: number | null;
  readonly packWeightKg?: number | null;
  readonly lat: number;
  readonly lng: number;
  readonly departureAtMs: number;
  readonly participants?: ReadonlyArray<ParticipantPerformanceStats | null | undefined>;
  readonly readiness?: ExplorerReadiness | null;
  readonly weather?: WeatherSnapshot | null;
  readonly surface?: TechnicalSurface | null;
  readonly technicalGrade?: TechnicalGrade | null;
  readonly ridgeExposed?: boolean;
  readonly offline?: boolean;
  /** Marge de sécurité avant la fin du crépuscule civil (min, défaut 30). */
  readonly safetyMarginMinutes?: number;
}

export interface SafeEtaMultipliers {
  readonly altitudeAttenuated: number;
  readonly technicalSurface: number;
  readonly weatherWind: number;
  readonly readiness: number;
  readonly offlineP90Spread: number;
}

export interface SafeEtaResult {
  readonly baseDurationHoursP50: number;
  readonly baseDurationHoursP90: number;
  readonly adjustedDurationHoursP50: number;
  readonly adjustedDurationHoursP90: number;
  readonly formattedP50: string;
  readonly formattedRange: string;
  readonly estimatedArrivalP50Ms: number;
  readonly estimatedArrivalP90Ms: number;
  readonly turnaroundAtMs: number | null;
  readonly daylight: OfflineDaylight;
  readonly finishesBeforeCivilDuskP50: boolean;
  readonly finishesBeforeCivilDuskP90: boolean;
  readonly hydrationLiters: number;
  readonly recommendedLevel: SortieDifficultyLevel;
  readonly effortScoreKe: number;
  readonly multipliers: SafeEtaMultipliers;
  readonly flags: readonly SafeEtaFlag[];
}

export interface GearInventory {
  readonly hasHeadlamp?: boolean;
  readonly hasAvalancheKit?: boolean;
  readonly hasWaterFilterOrCapacityL?: number | null;
  readonly hasThermalLayer?: boolean;
  readonly hasRainShell?: boolean;
  readonly hasCramponsIceAxe?: boolean;
  readonly hasFirstAidKit?: boolean;
  readonly hasOfflineMap?: boolean;
  readonly hasHelmet?: boolean;
  readonly hasBivouacKit?: boolean;
}

export interface GearDelta {
  readonly itemId: string;
  readonly labelFr: string;
  readonly severity: 'critical' | 'recommended';
  readonly reasonFr: string;
}

export type OutingFitVerdict = 'ideal' | 'good' | 'caution' | 'not_recommended';

export type SafetyVetoCode =
  | 'darkness_no_headlamp'
  | 'avalanche_no_kit'
  | 'rehab_pain_high'
  | 'thunderstorm_ridge'
  | 'wildfire_active'
  | 'extreme_wind_storm'
  | 'glacier_no_crampons';

export interface OutingFitInput {
  readonly safeEta: SafeEtaResult;
  readonly readiness: ExplorerReadiness;
  readonly weather?: WeatherSnapshot | null;
  readonly gear?: GearInventory | null;
  readonly technicalGrade?: TechnicalGrade | null;
  readonly surface?: TechnicalSurface | null;
  readonly maxAltitudeM?: number | null;
  readonly ridgeExposed?: boolean;
  readonly requiresGlacierGear?: boolean;
  readonly requiresAvalancheKit?: boolean;
  readonly userTechnicalExperience?: 'beginner' | 'intermediate' | 'advanced' | 'expert' | null;
}

export interface OutingFitSubScores {
  readonly physiological: number;
  readonly technical: number;
  readonly environmental: number;
  readonly equipment: number | null;
}

export interface OutingFitResult {
  readonly fitScore: number;
  readonly verdict: OutingFitVerdict;
  readonly subScores: OutingFitSubScores;
  readonly vetoes: readonly SafetyVetoCode[];
  readonly vetoed: boolean;
  readonly reasons: readonly string[];
  readonly gearDeltas: readonly GearDelta[];
}

export type AdaptiveHudProfile =
  | 'minimal_high_speed'
  | 'tactical_technical'
  | 'standard'
  | 'expedition_rich';

export type ExplorerPresetId =
  | 'epure'
  | 'rando_montagne'
  | 'trail_run'
  | 'vtt_gravel'
  | 'bivouac_astro'
  | 'nautique'
  | 'securite_risques'
  | 'pokedex'
  | 'communaute';

export interface ActivityPresetInput {
  readonly readiness: ExplorerReadiness;
  readonly weather?: WeatherSnapshot | null;
  readonly recentSports?: readonly Sport[];
  readonly preferredSport?: Sport | null;
  readonly terrain?: 'urban' | 'forest' | 'mountain' | 'coastal' | 'snow' | 'water' | null;
  readonly daylight?: OfflineDaylight | null;
  readonly nowMs?: number;
  readonly isNight?: boolean;
  readonly activeHazardCount?: number;
  readonly technicalGrade?: TechnicalGrade | null;
  readonly expectedSpeedKmh?: number | null;
  readonly offline?: boolean;
  readonly autoPauseEnabled?: boolean;
}

export interface EffortEnvelope {
  readonly maxDurationMin: number;
  readonly maxElevationGainM: number;
  readonly targetRpeRange: readonly [number, number];
  readonly labelFr: string;
}

export interface AdaptiveHudRecommendation {
  readonly profile: AdaptiveHudProfile;
  readonly cognitiveLoadScore: number;
  readonly maxPrimaryMetrics: number;
  readonly showMiniProfile: boolean;
  readonly showHazardBanner: boolean;
  readonly showCompass: boolean;
  readonly labelFr: string;
  readonly rationaleFr: string;
}

export interface ActivityPresetRecommendation {
  readonly sport: Sport;
  readonly presetId: ExplorerPresetId;
  readonly autoPauseConfig: AutoPauseConfig;
  readonly effortEnvelope: EffortEnvelope;
  readonly hud: AdaptiveHudRecommendation;
  readonly rationaleFr: string;
}

export type ContextualItemKind =
  | 'route'
  | 'poi'
  | 'club_outing'
  | 'carnet'
  | 'pokedex_species';

export interface ContextualItem {
  readonly id: string;
  readonly kind: ContextualItemKind;
  readonly title: string;
  readonly sport?: Sport | null;
  readonly lat: number;
  readonly lng: number;
  readonly fitScore?: number | null;
  readonly vetoed?: boolean;
  readonly fogOfWarUnvisited?: boolean;
  readonly matchesRoutineTime?: boolean;
  readonly fromJoinedClub?: boolean;
  readonly friendsCount?: number;
  readonly hasCarnetEntry?: boolean;
  readonly pokedexNovelty?: boolean;
  readonly pokedexRarity?: 'common' | 'uncommon' | 'rare' | 'threatened' | null;
  readonly freshnessHours?: number | null;
}

export interface ContextualRankerWeights {
  readonly athleticSafety?: number;
  readonly spatialFogRoutine?: number;
  readonly socialClubs?: number;
  readonly discoveryPokedex?: number;
}

export interface ContextualRankerInput {
  readonly items: readonly ContextualItem[];
  readonly userLat: number;
  readonly userLng: number;
  readonly requestedSport?: Sport | null;
  readonly readiness?: ExplorerReadiness | null;
  readonly maxRadiusKm?: number;
  readonly weights?: ContextualRankerWeights;
}

export interface ContextualPillarScores {
  readonly athleticSafety: number;
  readonly spatialFogRoutine: number;
  readonly socialClubs: number;
  readonly discoveryPokedex: number;
}

export interface RankedContextualItem {
  readonly item: ContextualItem;
  readonly totalScore: number;
  readonly distanceKm: number;
  readonly pillarScores: ContextualPillarScores;
  readonly reasonsFr: readonly string[];
}

export interface ContextualRankerResult {
  readonly ranked: readonly RankedContextualItem[];
  readonly filteredOutRoutesCount: number;
  readonly routeCatalogNoteFr: string | null;
}
