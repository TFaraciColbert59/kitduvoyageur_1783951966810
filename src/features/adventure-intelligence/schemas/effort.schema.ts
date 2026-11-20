/**
 * Contrats Zod du moteur d'effort bioénergétique et de prédiction collective (Lot P0).
 *
 * Respecte strictement les contrats transversaux :
 * - A. Conventions d'unités physiques (kg, m/s, %, cm, °C, m, s) sans ambiguïté d'échelle.
 * - B. Provenance typée obligatoire (`Evidence<T>`).
 * - C. Immutabilité & Cache (`snapshotHash` SHA-256 déterministe sur 6 composantes).
 * - D. Vocabulaire descriptif non hiérarchique (`dataLevel: "socle" | "cardio" | "complet"`).
 * - E. Protection absolue de la vie privée dans `PublicGroupPredictionSchema` (zéro donnée biométrique
 *      ni vitesse individuelle nominative).
 */
import { z } from 'zod';
import { confidenceSchema, isoDateTimeSchema } from './adventurePlan.schema';

// ─────────────────────────────────────────────────────────────────────────────
// A. CONSTANTES & HELPERS D'UNITÉS PHYSIQUES (ZÉRO ERREUR D'ÉCHELLE)
// ─────────────────────────────────────────────────────────────────────────────

/** Ratio charge / masse corporelle L_Bp = packWeightKg / weightKg borné à [0, 0.70]. */
export const LOAD_TO_BODY_RATIO_MIN = 0;
export const LOAD_TO_BODY_RATIO_MAX = 0.70;

/** Domaine de vitesse LCDA validé en m/s : [0.45, 1.97]. Au-delà ⇒ warning `out_of_domain`. */
export const LCDA_SPEED_MIN_MS = 0.45;
export const LCDA_SPEED_MAX_MS = 1.97;
export const LCDA_SPEED_DOMAIN_MS = {
  min: LCDA_SPEED_MIN_MS,
  max: LCDA_SPEED_MAX_MS,
} as const;

/** Paramètres Pandolf 1976 pour l'enfoncement neige en cm : eta = min(5.0, 1.30 + 0.082 * snowSinkCm). */
export const PANDOLF_SNOW_BASE_ETA = 1.30;
export const PANDOLF_SNOW_SLOPE_PER_CM = 0.082;
export const PANDOLF_SNOW_MAX_ETA = 5.0;

/** Bornes physiologiques défensives (unités SI / métriques). */
export const BODY_WEIGHT_MIN_KG = 20;
export const BODY_WEIGHT_MAX_KG = 300;
export const PACK_WEIGHT_MAX_KG = 120;
export const ALTITUDE_MIN_M = -500;
export const ALTITUDE_MAX_M = 9000;
export const TEMP_MIN_C = -60;
export const TEMP_MAX_C = 60;
export const WIND_MAX_MS = 100;

/** Calcule L_Bp = packWeightKg / weightKg et vérifie l'appartenance à [0, 0.70]. */
export function computeLoadToBodyRatio(
  packWeightKg: number,
  weightKg: number
): { ratio: number; clampedRatio: number; isWithinBounds: boolean } {
  if (!Number.isFinite(packWeightKg) || !Number.isFinite(weightKg) || weightKg <= 0 || packWeightKg < 0) {
    return { ratio: 0, clampedRatio: 0, isWithinBounds: false };
  }
  const ratio = packWeightKg / weightKg;
  const clampedRatio = Math.min(LOAD_TO_BODY_RATIO_MAX, Math.max(LOAD_TO_BODY_RATIO_MIN, ratio));
  const isWithinBounds = ratio >= LOAD_TO_BODY_RATIO_MIN && ratio <= LOAD_TO_BODY_RATIO_MAX;
  return { ratio, clampedRatio, isWithinBounds };
}

/** Vérifie si la vitesse `speedMs` (en m/s) appartient au domaine LCDA validé [0.45, 1.97]. */
export function isSpeedInLcdaDomain(speedMs: number): boolean {
  return Number.isFinite(speedMs) && speedMs >= LCDA_SPEED_MIN_MS && speedMs <= LCDA_SPEED_MAX_MS;
}

/** Convertit une pente en pourcentage (`gradePct`, ex. +10) en pente décimale (`gradeDec`, ex. +0.10). */
export function gradePctToDec(gradePct: number): number {
  return gradePct / 100;
}

/** Convertit une pente décimale (`gradeDec`, ex. +0.10) en pourcentage (`gradePct`, ex. +10). */
export function gradeDecToPct(gradeDec: number): number {
  return gradeDec * 100;
}

/** Calcule le facteur terrain neige selon Pandolf 1976 (`snowSinkCm` en centimètres). */
export function computePandolfSnowEta(snowSinkCm: number): number {
  if (!Number.isFinite(snowSinkCm) || snowSinkCm <= 0) {
    return 1.0;
  }
  return Math.min(
    PANDOLF_SNOW_MAX_ETA,
    PANDOLF_SNOW_BASE_ETA + PANDOLF_SNOW_SLOPE_PER_CM * snowSinkCm
  );
}

/** Convertit le vent `windMs` (m/s) en km/h (`windMs * 3.6`) exclusivement pour la formule Wind Chill. */
export function windMsToKmhForWindChill(windMs: number): number {
  return windMs * 3.6;
}

/** Convertit une durée interne `durationS` (secondes) en heures (`durationS / 3600`) pour la dose D_eff. */
export function durationSecondsToHours(durationS: number): number {
  return durationS / 3600;
}

// ─────────────────────────────────────────────────────────────────────────────
// B. PROVENANCE OBLIGATOIRE (`Evidence<T>`)
// ─────────────────────────────────────────────────────────────────────────────

export const EVIDENCE_KINDS = ['measured', 'derived', 'imputed', 'declared'] as const;

export type EvidenceKind = (typeof EVIDENCE_KINDS)[number];

export const EvidenceKindSchema = z.enum(EVIDENCE_KINDS);
export const evidenceKindSchema = EvidenceKindSchema;

export interface Evidence<T> {
  value: T;
  unit: string;
  source: string;
  kind: EvidenceKind;
  /** Qualité normalisée dans [0, 1]. */
  quality: number;
  uncertainty?: number;
  /** Horodatage ISO-8601 complet. */
  capturedAt: string;
  licenceSnapshot?: string;
  modelVersion?: string;
}

/**
 * Fabrique générique de schéma Zod pour `Evidence<T>`.
 * Garantit que chaque donnée exposée ou consommée embarque son unité, sa source,
 * sa nature (`measured | derived | imputed | declared`), sa qualité `[0, 1]` et sa date ISO-8601.
 */
export function createEvidenceSchema<T extends z.ZodType>(valueSchema: T) {
  return z.object({
    value: valueSchema,
    unit: z.string().min(1, 'evidence.unit est requis'),
    source: z.string().min(1, 'evidence.source est requis'),
    kind: EvidenceKindSchema,
    quality: z
      .number()
      .min(0, 'evidence.quality doit être compris entre 0 et 1')
      .max(1, 'evidence.quality doit être compris entre 0 et 1'),
    uncertainty: z.number().min(0, 'evidence.uncertainty doit être positif ou nul').optional(),
    capturedAt: isoDateTimeSchema,
    licenceSnapshot: z.string().min(1, 'evidence.licenceSnapshot ne peut pas être vide').optional(),
    modelVersion: z.string().min(1, 'evidence.modelVersion ne peut pas être vide').optional(),
  });
}

export const EvidenceSchema = createEvidenceSchema(z.unknown());
export const evidenceSchema = EvidenceSchema;

// ─────────────────────────────────────────────────────────────────────────────
// C. IMMUTABILITÉ & CACHE (`snapshotHash`)
// ─────────────────────────────────────────────────────────────────────────────

/** Empreinte SHA-256 hexadécimale (64 caractères) : identifiant immuable de snapshot. */
export const SnapshotHashSchema = z
  .string()
  .regex(
    /^[0-9a-f]{64}$/i,
    'snapshotHash doit être une empreinte SHA-256 hexadécimale de 64 caractères'
  );
export const snapshotHashSchema = SnapshotHashSchema;

/**
 * Composantes canoniques du hash de snapshot :
 * `snapshot_hash = sha256(model_version | profile_version | route_feature_version | equipment_snapshot | context_snapshot | scenario)`
 */
export const SnapshotHashComponentsSchema = z.object({
  modelVersion: z.string().min(1, 'modelVersion est requis'),
  profileVersion: z.string().min(1, 'profileVersion est requis'),
  routeFeatureVersion: z.string().min(1, 'routeFeatureVersion est requis'),
  equipmentSnapshot: z.string().min(1, 'equipmentSnapshot est requis'),
  contextSnapshot: z.string().min(1, 'contextSnapshot est requis'),
  scenario: z.string().min(1, 'scenario est requis'),
});
export const snapshotHashComponentsSchema = SnapshotHashComponentsSchema;

export type SnapshotHashComponents = z.infer<typeof SnapshotHashComponentsSchema>;

/** Formate la chaîne canonique déterministe avant hachage SHA-256. */
export function formatSnapshotHashPayload(components: SnapshotHashComponents): string {
  return [
    components.modelVersion,
    components.profileVersion,
    components.routeFeatureVersion,
    components.equipmentSnapshot,
    components.contextSnapshot,
    components.scenario,
  ].join('|');
}

/** Calcule `snapshot_hash = sha256(model_version | profile_version | route_feature_version | equipment_snapshot | context_snapshot | scenario)`. */
export async function computeSnapshotHash(components: SnapshotHashComponents): Promise<string> {
  const payload = formatSnapshotHashPayload(components);
  const subtle = globalThis.crypto?.subtle;
  if (typeof subtle?.digest !== 'function') {
    throw new Error('computeSnapshotHash : Web Crypto SHA-256 indisponible dans cet environnement.');
  }
  const digest = await subtle.digest('SHA-256', new TextEncoder().encode(payload));
  let hex = '';
  for (const byte of new Uint8Array(digest)) {
    hex += byte.toString(16).padStart(2, '0');
  }
  return hex;
}

// ─────────────────────────────────────────────────────────────────────────────
// D. NIVEAU DE RICHESSE DES DONNÉES (`DataLevelSchema`)
// ─────────────────────────────────────────────────────────────────────────────

export const DATA_LEVELS = ['socle', 'cardio', 'complet'] as const;

export type DataLevel = (typeof DATA_LEVELS)[number];

/** Niveau de richesse des données d'entrée : exclusivement `"socle" | "cardio" | "complet"`. */
export const DataLevelSchema = z.enum(DATA_LEVELS);
export const dataLevelSchema = DataLevelSchema;

// ─────────────────────────────────────────────────────────────────────────────
// E. ENTRÉES DU MOTEUR D'EFFORT (`EffortScoreInputSchema`)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Segment d'entrée pour le calcul d'effort :
 * - `durationS` en secondes (interne)
 * - `speedMs` en m/s (domaine LCDA [0.45, 1.97], au-delà flag `out_of_domain`)
 * - `gradePct` en pourcentage (-100..100), `gradeDec = gradePct / 100`
 * - `altitudeM` en mètres, `snowSinkCm` en centimètres
 */
export const EffortSegmentInputSchema = z
  .object({
    segmentId: z
      .number()
      .int('segmentId doit être un entier')
      .positive('segmentId doit être strictement positif'),
    distanceM: z.number().positive('distanceM doit être strictement positif'),
    durationS: z.number().positive('durationS (secondes) doit être strictement positif'),
    speedMs: z.number().positive('speedMs (m/s) doit être strictement positif'),
    gradePct: z
      .number()
      .min(-100, 'gradePct (%) doit être compris entre -100 et 100')
      .max(100, 'gradePct (%) doit être compris entre -100 et 100'),
    gradeDec: z
      .number()
      .min(-1, 'gradeDec doit être compris entre -1 et 1')
      .max(1, 'gradeDec doit être compris entre -1 et 1')
      .optional(),
    gainM: z.number().min(0, 'gainM (m) doit être positif ou nul').default(0),
    lossM: z.number().min(0, 'lossM (m) doit être positif ou nul').default(0),
    altitudeM: z
      .number()
      .min(ALTITUDE_MIN_M, `altitudeM (m) doit être >= ${ALTITUDE_MIN_M}`)
      .max(ALTITUDE_MAX_M, `altitudeM (m) doit être <= ${ALTITUDE_MAX_M}`)
      .default(0),
    surface: z.string().min(1, 'surface ne peut pas être vide').default('trail'),
    snowSinkCm: z.number().min(0, 'snowSinkCm (cm) doit être positif ou nul').default(0),
    technicalClass: z
      .number()
      .int('technicalClass doit être un entier')
      .min(0, 'technicalClass doit être compris entre 0 et 5')
      .max(5, 'technicalClass doit être compris entre 0 et 5')
      .default(1),
    exposureClass: z
      .number()
      .int('exposureClass doit être un entier')
      .min(0, 'exposureClass doit être compris entre 0 et 5')
      .max(5, 'exposureClass doit être compris entre 0 et 5')
      .default(0),
    isolationClass: z
      .number()
      .int('isolationClass doit être un entier')
      .min(0, 'isolationClass doit être compris entre 0 et 5')
      .max(5, 'isolationClass doit être compris entre 0 et 5')
      .default(0),
    outOfDomain: z.boolean().optional(),
    isRegroupPoint: z.boolean().default(false),
  })
  .refine(
    (seg) =>
      seg.gradeDec === undefined || Math.abs(seg.gradeDec - seg.gradePct / 100) <= 1e-6,
    {
      message: 'gradeDec doit être exactement égal à gradePct / 100 (zéro erreur d’échelle)',
      path: ['gradeDec'],
    }
  )
  .refine(
    (seg) =>
      seg.outOfDomain === undefined ||
      seg.outOfDomain === !isSpeedInLcdaDomain(seg.speedMs),
    {
      message:
        'outOfDomain doit refléter exactement l’appartenance de speedMs au domaine LCDA [0.45, 1.97] m/s',
      path: ['outOfDomain'],
    }
  );
export const effortSegmentInputSchema = EffortSegmentInputSchema;

/** Contexte météorologique : `tempC` en °C, `windMs` en m/s (`windKmh = windMs * 3.6` uniquement dans Wind Chill). */
export const EffortWeatherInputSchema = z.object({
  tempC: z
    .number()
    .min(TEMP_MIN_C, `tempC (°C) doit être >= ${TEMP_MIN_C}`)
    .max(TEMP_MAX_C, `tempC (°C) doit être <= ${TEMP_MAX_C}`),
  windMs: z
    .number()
    .min(0, 'windMs (m/s) doit être positif ou nul')
    .max(WIND_MAX_MS, `windMs (m/s) doit être <= ${WIND_MAX_MS}`),
  humidityPct: z
    .number()
    .min(0, 'humidityPct (%) doit être compris entre 0 et 100')
    .max(100, 'humidityPct (%) doit être compris entre 0 et 100')
    .optional(),
  precipMmPerH: z.number().min(0, 'precipMmPerH doit être positif ou nul').default(0),
  solarRadiationWm2: z.number().min(0, 'solarRadiationWm2 doit être positif ou nul').optional(),
});
export const effortWeatherInputSchema = EffortWeatherInputSchema;

/** État du sol et enneigement : `snowSinkCm` en centimètres (Pandolf 1976). */
export const EffortGroundInputSchema = z.object({
  surface: z.string().min(1, 'ground.surface est requis').default('trail'),
  snowSinkCm: z.number().min(0, 'ground.snowSinkCm (cm) doit être positif ou nul').default(0),
  terrainFactorEta: z
    .number()
    .min(1, 'terrainFactorEta doit être >= 1.0')
    .max(PANDOLF_SNOW_MAX_ETA, `terrainFactorEta doit être <= ${PANDOLF_SNOW_MAX_ETA}`)
    .optional(),
  wetness: z
    .number()
    .min(0, 'ground.wetness doit être compris entre 0 et 1')
    .max(1, 'ground.wetness doit être compris entre 0 et 1')
    .default(0),
});
export const effortGroundInputSchema = EffortGroundInputSchema;

/** Kit / sac porté : `packWeightKg` en kilogrammes. */
export const EffortPackInputSchema = z.object({
  packWeightKg: z
    .number()
    .min(0, 'packWeightKg (kg) doit être positif ou nul')
    .max(PACK_WEIGHT_MAX_KG, `packWeightKg (kg) doit être <= ${PACK_WEIGHT_MAX_KG}`),
  waterLiters: z.number().min(0, 'waterLiters doit être positif ou nul').optional(),
  footwearWeightKg: z.number().min(0, 'footwearWeightKg (kg) doit être positif ou nul').optional(),
  kitId: z.string().uuid('kitId doit être un UUID').optional(),
});
export const effortPackInputSchema = EffortPackInputSchema;

/**
 * Paramètres physiologiques privés :
 * `weightKg` en kg ; optionnels `sex`, `birthYear`, `hrRest`, `hrMax`, `vo2MaxMlKgMin`.
 */
export const EffortPhysiologyInputSchema = z
  .object({
    weightKg: z
      .number()
      .min(BODY_WEIGHT_MIN_KG, `weightKg (kg) doit être >= ${BODY_WEIGHT_MIN_KG}`)
      .max(BODY_WEIGHT_MAX_KG, `weightKg (kg) doit être <= ${BODY_WEIGHT_MAX_KG}`),
    sex: z.enum(['female', 'male', 'unspecified']).optional(),
    birthYear: z
      .number()
      .int('birthYear doit être un entier')
      .min(1900, 'birthYear doit être >= 1900')
      .max(2100, 'birthYear doit être <= 2100')
      .optional(),
    hrRest: z
      .number()
      .min(25, 'hrRest (bpm) doit être >= 25')
      .max(140, 'hrRest (bpm) doit être <= 140')
      .optional(),
    hrMax: z
      .number()
      .min(90, 'hrMax (bpm) doit être >= 90')
      .max(240, 'hrMax (bpm) doit être <= 240')
      .optional(),
    vo2MaxMlKgMin: z
      .number()
      .min(10, 'vo2MaxMlKgMin doit être >= 10')
      .max(100, 'vo2MaxMlKgMin doit être <= 100')
      .optional(),
  })
  .refine(
    (phys) =>
      phys.hrRest === undefined || phys.hrMax === undefined || phys.hrRest < phys.hrMax,
    {
      message: 'hrRest doit être strictement inférieur à hrMax',
      path: ['hrRest'],
    }
  );
export const effortPhysiologyInputSchema = EffortPhysiologyInputSchema;

/** Observations cardio et sRPE optionnelles (activent les niveaux `"cardio"` et `"complet"`). */
export const EffortObservationsInputSchema = z
  .object({
    avgHeartRateBpm: z
      .number()
      .min(30, 'avgHeartRateBpm doit être >= 30')
      .max(240, 'avgHeartRateBpm doit être <= 240')
      .optional(),
    maxHeartRateBpm: z
      .number()
      .min(30, 'maxHeartRateBpm doit être >= 30')
      .max(250, 'maxHeartRateBpm doit être <= 250')
      .optional(),
    hrCoverageRatio: z
      .number()
      .min(0, 'hrCoverageRatio doit être compris entre 0 et 1')
      .max(1, 'hrCoverageRatio doit être compris entre 0 et 1')
      .optional(),
    sessionRpe: z
      .number()
      .min(0, 'sessionRpe (sRPE Borg CR10) doit être compris entre 0 et 10')
      .max(10, 'sessionRpe (sRPE Borg CR10) doit être compris entre 0 et 10')
      .optional(),
    declaredFatigue: z
      .number()
      .min(0, 'declaredFatigue doit être compris entre 0 et 10')
      .max(10, 'declaredFatigue doit être compris entre 0 et 10')
      .optional(),
    perceivedDifficulty: z
      .number()
      .min(0, 'perceivedDifficulty doit être compris entre 0 et 10')
      .max(10, 'perceivedDifficulty doit être compris entre 0 et 10')
      .optional(),
    recentLoadS: z.number().min(0, 'recentLoadS (secondes) doit être positif ou nul').optional(),
  })
  .refine(
    (obs) =>
      obs.avgHeartRateBpm === undefined ||
      obs.maxHeartRateBpm === undefined ||
      obs.avgHeartRateBpm <= obs.maxHeartRateBpm,
    {
      message: 'avgHeartRateBpm doit être inférieur ou égal à maxHeartRateBpm',
      path: ['avgHeartRateBpm'],
    }
  );
export const effortObservationsInputSchema = EffortObservationsInputSchema;

/**
 * Schéma complet d'entrée du score d'effort (`EffortScoreInputSchema`).
 * Vérifie la borne physique `L_Bp = packWeightKg / weightKg <= 0.70`.
 */
export const EffortScoreInputSchema = z
  .object({
    segments: z
      .array(EffortSegmentInputSchema)
      .min(1, 'Au moins un segment est requis pour calculer le score d’effort'),
    weather: EffortWeatherInputSchema,
    ground: EffortGroundInputSchema,
    pack: EffortPackInputSchema,
    physiology: EffortPhysiologyInputSchema,
    observations: EffortObservationsInputSchema.optional(),
    dataLevel: DataLevelSchema.default('socle'),
    snapshot: SnapshotHashComponentsSchema,
    evidence: z.array(EvidenceSchema).default([]),
  })
  .refine(
    (input) => {
      const { isWithinBounds } = computeLoadToBodyRatio(
        input.pack.packWeightKg,
        input.physiology.weightKg
      );
      return isWithinBounds;
    },
    {
      message: `Le ratio charge / masse corporelle L_Bp (packWeightKg / weightKg) doit rester dans [${LOAD_TO_BODY_RATIO_MIN}, ${LOAD_TO_BODY_RATIO_MAX}]`,
      path: ['pack', 'packWeightKg'],
    }
  );
export const effortScoreInputSchema = EffortScoreInputSchema;

// ─────────────────────────────────────────────────────────────────────────────
// F. SORTIES DU MOTEUR D'EFFORT (`EffortScoreOutputSchema`)
// ─────────────────────────────────────────────────────────────────────────────

/** Fourchette d'incertitude obligatoire { p10, p50, p90 } ordonnée. */
export const EffortQuantileIntervalSchema = z
  .object({
    p10: z.number().min(0, 'p10 doit être positif ou nul'),
    p50: z.number().min(0, 'p50 doit être positif ou nul'),
    p90: z.number().min(0, 'p90 doit être positif ou nul'),
  })
  .refine((interval) => interval.p10 <= interval.p50 && interval.p50 <= interval.p90, {
    message: 'L’intervalle de quantiles doit respecter p10 <= p50 <= p90',
    path: ['p90'],
  });
export const effortQuantileIntervalSchema = EffortQuantileIntervalSchema;

/** Axe Risque structuré et strictement séparé de la dépense énergétique et de la technicité. */
export const EffortRiskAssessmentSchema = z.object({
  level: z.enum(['low', 'moderate', 'high', 'critical']),
  score: z
    .number()
    .min(0, 'risque.score doit être compris entre 0 et 100')
    .max(100, 'risque.score doit être compris entre 0 et 100'),
  dimensions: z.object({
    exposure: z.number().min(0).max(5),
    isolation: z.number().min(0).max(5),
    weatherHazard: z.number().min(0).max(5),
    terrainHazard: z.number().min(0).max(5),
    turnaroundMarginS: z.number().nullable().optional(),
  }),
  factors: z.array(z.string()).default([]),
});
export const effortRiskAssessmentSchema = EffortRiskAssessmentSchema;

/** Multiplicateurs bioénergétiques explicites par facteur physique. */
export const EffortMultipliersSchema = z.object({
  load: z.number().min(1, 'multipliers.load doit être >= 1'),
  terrainEta: z
    .number()
    .min(1, 'multipliers.terrainEta doit être >= 1')
    .max(PANDOLF_SNOW_MAX_ETA, `multipliers.terrainEta doit être <= ${PANDOLF_SNOW_MAX_ETA}`),
  thermal: z.number().positive('multipliers.thermal doit être strictement positif'),
  altitude: z.number().positive('multipliers.altitude doit être strictement positif'),
  fatigue: z.number().min(1, 'multipliers.fatigue doit être >= 1'),
  descentEccentric: z.number().min(0, 'multipliers.descentEccentric doit être positif ou nul'),
});
export const effortMultipliersSchema = EffortMultipliersSchema;

/** Attribution additive exacte de type Shapley par composante d'effort. */
export const EffortShapleyContributionsSchema = z.object({
  baseDistance: z.number(),
  ascent: z.number(),
  descent: z.number(),
  packLoad: z.number(),
  surfaceAndSnow: z.number(),
  thermalAndWind: z.number(),
  altitude: z.number(),
  fatigue: z.number(),
  total: z.number(),
});
export const effortShapleyContributionsSchema = EffortShapleyContributionsSchema;

export const EFFORT_WARNING_CODES = [
  'out_of_domain',
  'load_ratio_near_limit',
  'high_altitude_hypoxia',
  'extreme_wind_chill',
  'extreme_heat_stress',
  'deep_snow_pandolf_cap',
  'steep_eccentric_descent',
  'cold_profile',
  'low_confidence',
  'imputed_physiology',
  'twilight_overrun',
] as const;

export const EffortWarningCodeSchema = z.union([
  z.enum(EFFORT_WARNING_CODES),
  z.string().min(1),
]);

export const EffortWarningSchema = z.object({
  code: EffortWarningCodeSchema,
  message: z.string().min(1, 'warning.message est requis'),
  severity: z.enum(['info', 'warning', 'critical']),
  segmentId: z.number().int().positive().optional(),
});
export const effortWarningSchema = EffortWarningSchema;

/**
 * Schéma complet de sortie du score d'effort (`EffortScoreOutputSchema`) :
 * - `scoreVersion` & `snapshotHash` (immutabilité & cache)
 * - `iea` (Indice d'Effort Absolu 0..100), `erp` (Effort Relatif Personnel 0..100),
 *   `eFlatKm` (km-effort), `rawDose` (dose interne D_eff en heures pondérées)
 * - `technicite` (1..5, axe séparé) & `risque` (objet structuré séparé)
 * - `multipliers`, `shapley`, `dataLevel` (`"socle" | "cardio" | "complet"`),
 *   `interval: { p10, p50, p90 }`, `confidence`, `evidence[]`, `warnings[]`
 */
export const EffortScoreOutputSchema = z.object({
  scoreVersion: z.string().min(1, 'scoreVersion est requis'),
  snapshotHash: SnapshotHashSchema,
  iea: z
    .number()
    .min(0, 'iea doit être compris entre 0 et 100')
    .max(100, 'iea doit être compris entre 0 et 100'),
  erp: z
    .number()
    .min(0, 'erp doit être compris entre 0 et 100')
    .max(100, 'erp doit être compris entre 0 et 100'),
  eFlatKm: z.number().min(0, 'eFlatKm (km-effort) doit être positif ou nul'),
  rawDose: z.number().min(0, 'rawDose (D_eff) doit être positif ou nul'),
  technicite: z
    .number()
    .int('technicite doit être un entier')
    .min(1, 'technicite doit être compris entre 1 et 5')
    .max(5, 'technicite doit être compris entre 1 et 5'),
  risque: EffortRiskAssessmentSchema,
  multipliers: EffortMultipliersSchema,
  shapley: EffortShapleyContributionsSchema,
  dataLevel: DataLevelSchema,
  interval: EffortQuantileIntervalSchema,
  confidence: confidenceSchema,
  evidence: z
    .array(EvidenceSchema)
    .min(1, 'Au moins une entrée de provenance Evidence<T> est requise'),
  warnings: z.array(EffortWarningSchema).default([]),
});
export const effortScoreOutputSchema = EffortScoreOutputSchema;

// ─────────────────────────────────────────────────────────────────────────────
// G. PRÉDICTION COLLECTIVE & PROTECTION BIOMÉTRIQUE (`GroupPrediction*Schema`)
// ─────────────────────────────────────────────────────────────────────────────

export const GROUP_DISCIPLINE_MODES = ['compact', 'regroupement'] as const;
export type GroupDisciplineMode = (typeof GROUP_DISCIPLINE_MODES)[number];

export const GroupDisciplineModeSchema = z.enum(GROUP_DISCIPLINE_MODES);
export const groupDisciplineModeSchema = GroupDisciplineModeSchema;

/** Membre consenti en entrée du moteur collectif (côté serveur uniquement). */
export const GroupConsentedMemberInputSchema = z
  .object({
    memberId: z.string().uuid('memberId doit être un UUID'),
    consentedAt: isoDateTimeSchema,
    dataLevel: DataLevelSchema.default('socle'),
    physiology: EffortPhysiologyInputSchema,
    pack: EffortPackInputSchema,
    flatSpeedMs: z
      .number()
      .positive('flatSpeedMs (m/s) doit être strictement positif')
      .optional(),
    ascentSpeedMPerHour: z
      .number()
      .min(0, 'ascentSpeedMPerHour doit être positif ou nul')
      .optional(),
    descentSpeedMPerHour: z
      .number()
      .min(0, 'descentSpeedMPerHour doit être positif ou nul')
      .optional(),
    maxCarryKg: z.number().min(0, 'maxCarryKg (kg) doit être positif ou nul').optional(),
    isChild: z.boolean().default(false),
    observations: EffortObservationsInputSchema.optional(),
  })
  .refine(
    (member) =>
      computeLoadToBodyRatio(member.pack.packWeightKg, member.physiology.weightKg).isWithinBounds,
    {
      message: `Le ratio charge / masse corporelle L_Bp du membre doit rester dans [${LOAD_TO_BODY_RATIO_MIN}, ${LOAD_TO_BODY_RATIO_MAX}]`,
      path: ['pack', 'packWeightKg'],
    }
  );
export const groupConsentedMemberInputSchema = GroupConsentedMemberInputSchema;

/** Contexte partagé de la sortie collective. */
export const GroupContextInputSchema = z.object({
  weather: EffortWeatherInputSchema,
  ground: EffortGroundInputSchema,
  strategy: z.enum(['comfort', 'recommended', 'fast']).default('recommended'),
  regroupPauseMinS: z
    .number()
    .int('regroupPauseMinS doit être un entier')
    .min(0, 'regroupPauseMinS (secondes) doit être positif ou nul')
    .default(180),
  snapshot: SnapshotHashComponentsSchema,
});
export const groupContextInputSchema = GroupContextInputSchema;

/**
 * Schéma d'entrée de prédiction de groupe (`GroupPredictionInputSchema`) :
 * - `mode`: `"compact" | "regroupement"`
 * - `members`: membres ayant explicitement consenti
 * - `departureTime` & `twilightTime`: ISO-8601 (`departureTime <= twilightTime`)
 * - `segments` & `context`
 */
export const GroupPredictionInputSchema = z
  .object({
    mode: GroupDisciplineModeSchema,
    members: z
      .array(GroupConsentedMemberInputSchema)
      .min(1, 'Au moins un membre consenti est requis'),
    departureTime: isoDateTimeSchema,
    twilightTime: isoDateTimeSchema,
    segments: z
      .array(EffortSegmentInputSchema)
      .min(1, 'Au moins un segment est requis pour la prédiction de groupe'),
    context: GroupContextInputSchema,
  })
  .refine((input) => Date.parse(input.departureTime) <= Date.parse(input.twilightTime), {
    message: 'departureTime doit être antérieur ou égal à twilightTime',
    path: ['twilightTime'],
  });
export const groupPredictionInputSchema = GroupPredictionInputSchema;

/** Intervalle d'horodatages ISO-8601 { p10, p50, p90 } ordonnés chronologiquement. */
export const EtaQuantileIntervalSchema = z
  .object({
    p10: isoDateTimeSchema,
    p50: isoDateTimeSchema,
    p90: isoDateTimeSchema,
  })
  .refine(
    (eta) =>
      Date.parse(eta.p10) <= Date.parse(eta.p50) && Date.parse(eta.p50) <= Date.parse(eta.p90),
    {
      message: 'Les ETA doivent respecter l’ordre chronologique p10 <= p50 <= p90',
      path: ['p90'],
    }
  );
export const etaQuantileIntervalSchema = EtaQuantileIntervalSchema;

/** Intervalle de marges temporelles signées (secondes avant crépuscule : p90 <= p50 <= p10). */
export const SignedSecondsQuantileIntervalSchema = z
  .object({
    p10: z.number(),
    p50: z.number(),
    p90: z.number(),
  })
  .refine((margin) => margin.p90 <= margin.p50 && margin.p50 <= margin.p10, {
    message:
      'La marge avant crépuscule (secondes) doit décroître quand la durée augmente (p90 <= p50 <= p10)',
    path: ['p90'],
  });

/**
 * Clés biométriques et vitesses individuelles nominatives strictement interdites
 * dans toute surface publique de groupe (`PublicGroupPredictionSchema`).
 */
export const FORBIDDEN_PUBLIC_BIOMETRIC_AND_INDIVIDUAL_KEYS = [
  'weightKg',
  'weight_kg',
  'bodyWeightKg',
  'body_weight_kg',
  'vo2Max',
  'vo2_max',
  'vo2MaxMlKgMin',
  'hrRest',
  'hr_rest',
  'hrMax',
  'hr_max',
  'hrv',
  'sleep',
  'birthYear',
  'birth_year',
  'sex',
  'memberId',
  'userId',
  'user_id',
  'displayName',
  'flatSpeedKmH',
  'flat_speed_kmh',
  'flatSpeedMs',
  'ascentSpeedMPerHour',
  'ascent_speed_m_per_h',
  'descentSpeedMPerHour',
  'descent_speed_m_per_h',
  'memberPacesKmH',
  'memberSpeedsMs',
  'individualSpeedMs',
] as const;

const FORBIDDEN_PUBLIC_KEY_SET = new Set<string>(
  FORBIDDEN_PUBLIC_BIOMETRIC_AND_INDIVIDUAL_KEYS.map((k) => k.toLowerCase())
);

function findForbiddenPublicKeys(value: unknown, currentPath: string[] = []): string[][] {
  if (value === null || typeof value !== 'object') {
    return [];
  }
  if (Array.isArray(value)) {
    return value.flatMap((item, idx) => findForbiddenPublicKeys(item, [...currentPath, String(idx)]));
  }
  const hits: string[][] = [];
  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    const nextPath = [...currentPath, key];
    if (FORBIDDEN_PUBLIC_KEY_SET.has(key.toLowerCase())) {
      hits.push(nextPath);
    }
    hits.push(...findForbiddenPublicKeys(child, nextPath));
  }
  return hits;
}

/**
 * Projection publique d'une prédiction de groupe (`PublicGroupPredictionSchema`).
 *
 * GARDE-FOU VIE PRIVÉE (ADR-AI-003) :
 * - `.strict()` refuse toute clé supplémentaire au premier niveau.
 * - `superRefine` inspecte récursivement l'arbre entier (y compris `evidence` et `warnings`)
 *   pour interdire toute clé biométrique (`weightKg`, `vo2Max`, `hrRest`, `hrMax`, `hrv`, `sleep`,
 *   `sex`, `birthYear`) ou vitesse individuelle nominative (`memberId`, `flatSpeedKmH`, `memberPacesKmH`).
 */
export const PublicGroupPredictionSchema = z
  .object({
    mode: GroupDisciplineModeSchema,
    memberCount: z
      .number()
      .int('memberCount doit être un entier')
      .min(1, 'memberCount doit être >= 1'),
    groupPaceMs: z.number().positive('groupPaceMs (m/s) doit être strictement positif'),
    totalDurationIntervalS: EffortQuantileIntervalSchema,
    groupEtaInterval: EtaQuantileIntervalSchema,
    regroupWaitTotalS: z
      .number()
      .min(0, 'regroupWaitTotalS (secondes) doit être positif ou nul')
      .default(0),
    twilightMarginS: SignedSecondsQuantileIntervalSchema,
    overtakesTwilightRisk: z.boolean(),
    collectiveIea: z
      .number()
      .min(0, 'collectiveIea doit être compris entre 0 et 100')
      .max(100, 'collectiveIea doit être compris entre 0 et 100'),
    collectiveTechnicite: z
      .number()
      .int('collectiveTechnicite doit être un entier')
      .min(1, 'collectiveTechnicite doit être compris entre 1 et 5')
      .max(5, 'collectiveTechnicite doit être compris entre 1 et 5'),
    collectiveRisque: EffortRiskAssessmentSchema,
    separationRisk: z
      .object({
        level: z.enum(['low', 'medium', 'high']),
        reasons: z.array(z.string()),
      })
      .strict(),
    pauseEveryMinutes: z
      .number()
      .int('pauseEveryMinutes doit être un entier')
      .min(0, 'pauseEveryMinutes doit être positif ou nul'),
    gearRedistributionSummary: z
      .object({
        transfers: z.number().int().min(0),
        totalWeightKg: z.number().min(0),
        maxPerReceiverKg: z.number().min(0),
      })
      .strict(),
    snapshotHash: SnapshotHashSchema,
    confidence: confidenceSchema,
    evidence: z
      .array(EvidenceSchema)
      .min(1, 'Au moins une entrée Evidence<T> est requise dans la projection publique'),
    warnings: z.array(EffortWarningSchema).default([]),
  })
  .strict()
  .superRefine((val, ctx) => {
    const forbiddenPaths = findForbiddenPublicKeys(val);
    for (const path of forbiddenPaths) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Fuite biométrique ou vitesse individuelle nominative interdite dans PublicGroupPredictionSchema : clé "${path[path.length - 1]}"`,
        path,
      });
    }
  });
export const publicGroupPredictionSchema = PublicGroupPredictionSchema;

/** Sortie privée individuelle d'un membre du groupe (strictement confinée au serveur / RLS own). */
export const PrivateMemberGroupPredictionSchema = z.object({
  memberId: z.string().uuid('memberId doit être un UUID'),
  effortScore: EffortScoreOutputSchema,
  durationIntervalS: EffortQuantileIntervalSchema,
  etaInterval: EtaQuantileIntervalSchema,
  waitDurationS: z.number().min(0, 'waitDurationS (secondes) doit être positif ou nul').default(0),
  recommendedLoadDeltaKg: z.number().default(0),
});
export const privateMemberGroupPredictionSchema = PrivateMemberGroupPredictionSchema;

/**
 * Sortie complète du moteur de prédiction de groupe (`GroupPredictionOutputSchema`) :
 * - `privateByMember`: sorties privées par membre (jamais exposées aux autres membres)
 * - `publicProjection`: projection publique garantie sans aucune donnée biométrique ni vitesse nominative
 */
export const GroupPredictionOutputSchema = z.object({
  privateByMember: z
    .array(PrivateMemberGroupPredictionSchema)
    .min(1, 'Au moins une sortie privée de membre est requise'),
  publicProjection: PublicGroupPredictionSchema,
});
export const groupPredictionOutputSchema = GroupPredictionOutputSchema;

// ─────────────────────────────────────────────────────────────────────────────
// H. TYPES INFÉRÉS EXPORTÉS
// ─────────────────────────────────────────────────────────────────────────────

export type EffortSegmentInput = z.infer<typeof EffortSegmentInputSchema>;
export type EffortWeatherInput = z.infer<typeof EffortWeatherInputSchema>;
export type EffortGroundInput = z.infer<typeof EffortGroundInputSchema>;
export type EffortPackInput = z.infer<typeof EffortPackInputSchema>;
export type EffortPhysiologyInput = z.infer<typeof EffortPhysiologyInputSchema>;
export type EffortObservationsInput = z.infer<typeof EffortObservationsInputSchema>;
export type EffortScoreInput = z.infer<typeof EffortScoreInputSchema>;

export type EffortQuantileInterval = z.infer<typeof EffortQuantileIntervalSchema>;
export type EffortRiskAssessment = z.infer<typeof EffortRiskAssessmentSchema>;
export type EffortMultipliers = z.infer<typeof EffortMultipliersSchema>;
export type EffortShapleyContributions = z.infer<typeof EffortShapleyContributionsSchema>;
export type EffortWarning = z.infer<typeof EffortWarningSchema>;
export type EffortScoreOutput = z.infer<typeof EffortScoreOutputSchema>;

export type GroupConsentedMemberInput = z.infer<typeof GroupConsentedMemberInputSchema>;
export type GroupContextInput = z.infer<typeof GroupContextInputSchema>;
export type GroupPredictionInput = z.infer<typeof GroupPredictionInputSchema>;
export type PublicGroupPrediction = z.infer<typeof PublicGroupPredictionSchema>;
export type PrivateMemberGroupPrediction = z.infer<typeof PrivateMemberGroupPredictionSchema>;
export type GroupPredictionOutput = z.infer<typeof GroupPredictionOutputSchema>;
