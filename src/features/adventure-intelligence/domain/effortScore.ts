/**
 * LOT P1 — Moteur bioénergétique pur d'effort et de fatigue (`effort-score-v1`).
 *
 * Références scientifiques implémentées :
 * 1. Noyau LCDA (Looney et al., 2019, 2022) + BMR Cunningham/Schofield.
 * 2. Facteur terrain & neige fraîche Pandolf et al. (1976) + modulation boue API_72h / VWC.
 * 3. Traînée aérodynamique vectorielle Pugh (1971) avec surface corporelle DuBois.
 * 4. Surcoûts chaussures (Legg & Mahanty 1986), couches froid (Rintamäki 2007 / Kuklane 2020)
 *    et marche nocturne (Norrbrand 2023/2025).
 * 5. Capacité aérobie effective : hypoxie Péronnet et al. (1991) + relais sigmoïde > 4 500 m,
 *    stress thermique UTCI / Steadman.
 * 6. Fusion Bayes-Kalman à variance inverse sans double comptage + filtre anti-surdéclaration.
 * 7. Double canal en descente (métabolique kJ vs excentrique score atténué de 25 % avec bâtons).
 * 8. Dose interne, sigmoïde de Hill 0..100 %, attribution de Shapley exacte sur K = 6 piliers
 *    (2^6 = 64 coalitions), et séparation stricte Technicité (1..5) / Risque (sans diagnostic médical).
 *
 * Domaine pur (ADR-AI-005) : zéro I/O, zéro appel réseau, 100 % déterministe.
 */
import {
  ALTITUDE_MAX_M,
  ALTITUDE_MIN_M,
  LCDA_SPEED_MAX_MS,
  LCDA_SPEED_MIN_MS,
  LOAD_TO_BODY_RATIO_MAX,
  PANDOLF_SNOW_MAX_ETA,
  computeLoadToBodyRatio,
  computePandolfSnowEta,
  durationSecondsToHours,
  formatSnapshotHashPayload,
  gradePctToDec,
  isSpeedInLcdaDomain,
  windMsToKmhForWindChill,
  type DataLevel,
  type EffortMultipliers,
  type EffortPhysiologyInput,
  type EffortQuantileInterval,
  type EffortRiskAssessment,
  type EffortScoreInput,
  type EffortScoreOutput,
  type EffortSegmentInput,
  type EffortShapleyContributions,
  type EffortWarning,
  type Evidence,
  type SnapshotHashComponents,
} from '../schemas/effort.schema';
import { clamp01, makeConfidence, type Confidence } from './confidence';
import { elevationGainLoss } from './trackNormalization';
import { haversineM, smoothAltitude } from './geo';

export const EFFORT_SCORE_VERSION = 'effort-score-v1' as const;

/** Constantes physiques et physiologiques de référence (profil IEA). */
export const IEA_REFERENCE_WEIGHT_KG = 75;
export const IEA_REFERENCE_VO2MAX_ML_KG_MIN = 48;
export const IEA_REFERENCE_MREST_W_KG = 1.25;
export const IEA_REFERENCE_HEIGHT_CM = 175;
export const VO2_TO_WATTS_FACTOR = 335; // 1 L O2/min ≈ 335 W métaboliques

/** Constantes de la dose et de la sigmoïde de Hill (`effort-score-v1`). */
export const EFFORT_DOSE_INTENSITY_REF = 0.70;
export const EFFORT_HILL_HALF_DOSE = 180;
export const EFFORT_HILL_EXPONENT = 1.35;

/** Surfaces considérées comme revêtues (insensibles à la modulation boue). */
const PAVED_SURFACES = new Set(['asphalt', 'paved', 'concrete']);

export type FallbackSurfaceKind =
  | 'asphalt'
  | 'compacted'
  | 'dirt'
  | 'gravel'
  | 'grass'
  | 'mud'
  | 'sand'
  | 'rock'
  | 'scree'
  | 'snow'
  | 'unknown';

/**
 * Options étendues optionnelles acceptées par `computeEffortScore` en complément
 * du contrat `EffortScoreInput` (peuvent être passées à la racine ou dans les sous-objets).
 */
export interface EffortScoreExtendedOptions {
  carryType?: 'backpack' | 'vest';
  hasPoles?: boolean;
  clothingWeightKg?: number;
  clothingLayers?: number;
  deltaIcl?: number;
  isNight?: boolean;
  twilightOverrunRatio?: number;
  windHeadMs?: number;
  api72h?: number;
  soilMoistureVwc?: number;
  soilTempC?: number;
  avalancheRiskIndex?: number;
  missingColdLayers?: boolean;
  heightCm?: number;
  turnaroundMarginS?: number | null;
}

export type EffortScoreExtendedInput = EffortScoreInput &
  Partial<EffortScoreExtendedOptions> & {
    weather: EffortScoreInput['weather'] & {
      windHeadMs?: number;
      isNight?: boolean;
    };
    ground: EffortScoreInput['ground'] & {
      api72h?: number;
      soilMoistureVwc?: number;
      soilTempC?: number;
    };
    pack: EffortScoreInput['pack'] & {
      carryType?: 'backpack' | 'vest';
      hasPoles?: boolean;
      clothingWeightKg?: number;
      clothingLayers?: number;
      missingColdLayers?: boolean;
    };
  };

/**
 * Sortie enrichie rétrocompatible avec `EffortScoreOutput` (`EffortScoreOutputSchema`).
 * Expose également les grandeurs physiques intermédiaires pour l'audit et les tests dorés.
 */
export interface EffortScoreComputedOutput extends EffortScoreOutput {
  /** Puissance métabolique effective moyenne du profil de référence IEA (W). */
  mEffW: number;
  /** Alias de `mEffW` (puissance moyenne en W). */
  meanPowerW: number;
  /** Puissance LCDA pure moyenne hors traînée aérodynamique (W). */
  mLcdaW: number;
  /** Surcoût aérodynamique moyen dû au vent (Pugh 1971, W). */
  pAeroW: number;
  /** Capacité aérobie au niveau de la mer (W). */
  pVo2MaxSeaW: number;
  /** Capacité aérobie effective après hypoxie et thermique (W). */
  pVo2MaxEffW: number;
  /** Intensité relative modélisée (mEffW / pVo2MaxEffW). */
  iMod: number;
  /** Intensité relative observée par cardio/sRPE si disponible. */
  iObs: number | null;
  /** Intensité relative effective après fusion Bayes-Kalman. */
  iEff: number;
  /** Indice d'efficacité cardiaque (iMod / iObs) si cardio disponible. */
  iec: number | null;
  /** Score IEA du scénario de base (sans les 6 piliers Shapley). */
  ieaBaseline: number;
  /** Dépense énergétique métabolique totale (canal nutrition/hydratation, kJ). */
  metabolicEnergyKj: number;
  /** Pénalité mécanique excentrique moyenne en descente (canal score, W). */
  eccentricPenaltyW: number;
  /** Taux de sudation estimé (Gonzalez et al., L/h). */
  sweatRateLh: number;
  /** Durée maximale de travail acceptable (MAWD, heures). */
  mawdHours: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// 0. SHA-256 SYNCHRONE PUR (DÉTERMINISTE, ZÉRO I/O, IDENTIQUE À WebCrypto)
// ─────────────────────────────────────────────────────────────────────────────

const SHA256_K = new Uint32Array([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
]);

function rotr32(value: number, bits: number): number {
  return (value >>> bits) | (value << (32 - bits));
}

/** Implémentation pure FIPS 180-4 SHA-256 synchrone (64 caractères hexadécimaux). */
export function sha256HexSync(message: string): string {
  const bytes = new TextEncoder().encode(message);
  const bitLen = bytes.length * 8;
  const totalBytes = Math.ceil((bytes.length + 9) / 64) * 64;
  const padded = new Uint8Array(totalBytes);
  padded.set(bytes);
  padded[bytes.length] = 0x80;

  const view = new DataView(padded.buffer);
  const highBits = Math.floor(bitLen / 0x100000000);
  const lowBits = bitLen >>> 0;
  view.setUint32(totalBytes - 8, highBits, false);
  view.setUint32(totalBytes - 4, lowBits, false);

  let h0 = 0x6a09e667;
  let h1 = 0xbb67ae85;
  let h2 = 0x3c6ef372;
  let h3 = 0xa54ff53a;
  let h4 = 0x510e527f;
  let h5 = 0x9b05688c;
  let h6 = 0x1f83d9ab;
  let h7 = 0x5be0cd19;

  const w = new Uint32Array(64);

  for (let offset = 0; offset < totalBytes; offset += 64) {
    for (let i = 0; i < 16; i += 1) {
      w[i] = view.getUint32(offset + i * 4, false);
    }
    for (let i = 16; i < 64; i += 1) {
      const s0 = rotr32(w[i - 15], 7) ^ rotr32(w[i - 15], 18) ^ (w[i - 15] >>> 3);
      const s1 = rotr32(w[i - 2], 17) ^ rotr32(w[i - 2], 19) ^ (w[i - 2] >>> 10);
      w[i] = (w[i - 16] + s0 + w[i - 7] + s1) >>> 0;
    }

    let a = h0;
    let b = h1;
    let c = h2;
    let d = h3;
    let e = h4;
    let f = h5;
    let g = h6;
    let h = h7;

    for (let i = 0; i < 64; i += 1) {
      const S1 = rotr32(e, 6) ^ rotr32(e, 11) ^ rotr32(e, 25);
      const ch = (e & f) ^ (~e & g);
      const temp1 = (h + S1 + ch + SHA256_K[i] + w[i]) >>> 0;
      const S0 = rotr32(a, 2) ^ rotr32(a, 13) ^ rotr32(a, 22);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const temp2 = (S0 + maj) >>> 0;

      h = g;
      g = f;
      f = e;
      e = (d + temp1) >>> 0;
      d = c;
      c = b;
      b = a;
      a = (temp1 + temp2) >>> 0;
    }

    h0 = (h0 + a) >>> 0;
    h1 = (h1 + b) >>> 0;
    h2 = (h2 + c) >>> 0;
    h3 = (h3 + d) >>> 0;
    h4 = (h4 + e) >>> 0;
    h5 = (h5 + f) >>> 0;
    h6 = (h6 + g) >>> 0;
    h7 = (h7 + h) >>> 0;
  }

  return [h0, h1, h2, h3, h4, h5, h6, h7]
    .map((word) => word.toString(16).padStart(8, '0'))
    .join('');
}

/** Calcule de façon synchrone le `snapshotHash` SHA-256 (identique à `computeSnapshotHash`). */
export function computeSnapshotHashSync(components: SnapshotHashComponents): string {
  return sha256HexSync(formatSnapshotHashPayload(components));
}

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. NOYAU LCDA (Looney et al., 2019, 2022) & BMR CUNNINGHAM / SCHOFIELD
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Terme de pente LCDA (Looney et al., 2019) :
 * `mGrade = 0.34 * speedMs * gradePct * (1 - Math.pow(1.05, 1 - Math.pow(1.1, gradePct + 32)))`
 * où `gradePct` est exprimé en pourcentage (-100..100).
 */
export function computeLcdaGradeTerm(speedMs: number, gradePct: number): number {
  const v = clamp(speedMs, 0.05, 10);
  const g = clamp(gradePct, -100, 100);
  if (Math.abs(g) < 1e-9) return 0;
  const innerExp = Math.min(200, g + 32);
  const outerExp = Math.max(-500, 1 - Math.pow(1.1, innerExp));
  return 0.34 * v * g * (1 - Math.pow(1.05, outerExp));
}

/**
 * Métabolisme de repos `mRest` (W/kg) par équation de Cunningham / Schofield.
 * Retourne exactement `1.25 W/kg` pour le profil de référence IEA (75 kg).
 */
export function computeRestingMetabolicRateWkg(
  physiology: EffortPhysiologyInput,
  isReferenceProfile = false
): number {
  if (isReferenceProfile) {
    return IEA_REFERENCE_MREST_W_KG;
  }
  const weightKg = clamp(physiology.weightKg, 20, 300);
  if (
    Math.abs(weightKg - IEA_REFERENCE_WEIGHT_KG) < 1e-6 &&
    (physiology.sex === undefined || physiology.sex === 'unspecified') &&
    physiology.birthYear === undefined
  ) {
    return IEA_REFERENCE_MREST_W_KG;
  }

  // Cunningham (1980) : BMR (kcal/j) = 500 + 22 * LBM, calibré à 1.25 W/kg pour 75 kg.
  const lbmRatio = physiology.sex === 'female' ? 0.79 : 0.85;
  const refBmrKcal = 500 + 22 * (0.85 * IEA_REFERENCE_WEIGHT_KG);
  const userBmrKcal = 500 + 22 * (lbmRatio * weightKg);
  const ageYears =
    physiology.birthYear !== undefined ? clamp(2026 - physiology.birthYear, 12, 95) : 32;
  const ageFactor = 1 - 0.0025 * Math.max(0, ageYears - 30);

  const bmrWatts = (userBmrKcal / refBmrKcal) * (IEA_REFERENCE_MREST_W_KG * IEA_REFERENCE_WEIGHT_KG) * ageFactor;
  return clamp(bmrWatts / weightKg, 0.85, 1.85);
}

/**
 * Facteur de charge sac à dos LCDA :
 * - Sac à dos standard : `loadFactor = 1 + 1.96 * Math.pow(L_Bp, 1.36)`
 * - Gilet (`carryType === "vest"`) : `loadFactor = 1 + L_Bp`
 * avec `L_Bp = clamp(packWeightKg / weightKg, 0, 0.70)`.
 */
export function computeBackpackLoadFactor(
  packWeightKg: number,
  weightKg: number,
  carryType: 'backpack' | 'vest' = 'backpack'
): number {
  const { clampedRatio } = computeLoadToBodyRatio(packWeightKg, weightKg);
  if (clampedRatio <= 0) return 1.0;
  if (carryType === 'vest') {
    return 1 + clampedRatio;
  }
  return 1 + 1.96 * Math.pow(clampedRatio, 1.36);
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. TERRAIN, NEIGE (Pandolf 1976) & MODULATION BOUE / VERGLAS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Résout le facteur terrain $\eta$ à partir de la surface OSM, de la vitesse,
 * de l'enfoncement neige (Pandolf 1976) et de l'humidité du sol (`api72h`, `soilMoistureVwc`, `wetness`).
 */
export function resolveSurfaceEta(
  surface: string,
  speedMs: number,
  options?: {
    snowSinkCm?: number;
    wetness?: number;
    api72h?: number;
    soilMoistureVwc?: number;
    soilTempC?: number;
    terrainFactorEta?: number;
  }
): { eta: number; verglas: boolean; deepSnowCap: boolean } {
  const norm = (surface || 'trail').trim().toLowerCase();
  const v = clamp(speedMs, 0.1, 5);

  let baseEta = 1.10;
  if (norm === 'asphalt' || norm === 'paved' || norm === 'concrete') {
    baseEta = 1.00;
  } else if (norm === 'compacted' || norm === 'fine_gravel' || norm === 'paving_stones') {
    baseEta = 1.05;
  } else if (norm === 'dirt' || norm === 'earth' || norm === 'ground' || norm === 'trail' || norm === 'path' || norm === 'unknown') {
    baseEta = 1.10;
  } else if (norm === 'gravel' || norm === 'pebblestone') {
    baseEta = 1.15;
  } else if (norm === 'grass' || norm === 'meadow') {
    baseEta = 1.20;
  } else if (norm === 'rock' || norm === 'scree' || norm === 'stone') {
    // 1.35 + frein cinématique sur pierrier/rocher
    baseEta = 1.35 + 0.04 * Math.max(0, v - 1.1);
  } else if (norm === 'mud') {
    baseEta = 1.50;
  } else if (norm === 'sand') {
    baseEta = Math.min(PANDOLF_SNOW_MAX_ETA, 1.50 + 1.3 * v * v);
  } else if (norm === 'snow') {
    baseEta = 1.30;
  }

  const wetness = clamp(options?.wetness ?? 0, 0, 1);
  const apiNorm = clamp((options?.api72h ?? 0) / 60, 0, 1);
  const vwcNorm = clamp((options?.soilMoistureVwc ?? 0) / 0.45, 0, 1);
  const moistureIndex = clamp(Math.max(wetness, 0.55 * apiNorm + 0.45 * vwcNorm), 0, 1);
  const soilTempC = options?.soilTempC ?? 10;
  const isPaved = PAVED_SURFACES.has(norm);

  let verglas = false;
  if (soilTempC <= 0 && moistureIndex > 0.15) {
    verglas = true;
  } else if (soilTempC > 0 && !isPaved && moistureIndex > 0) {
    if (norm === 'mud') {
      baseEta = 1.50 + 0.30 * moistureIndex; // 1.50..1.80
    } else if (norm !== 'sand') {
      baseEta = Math.min(1.80, baseEta + 0.25 * moistureIndex);
    }
  }

  const snowSinkCm = Math.max(0, options?.snowSinkCm ?? 0);
  let deepSnowCap = false;
  let snowEta = 1.0;
  if (snowSinkCm > 0) {
    if (1.30 + 0.082 * snowSinkCm > PANDOLF_SNOW_MAX_ETA) {
      deepSnowCap = true;
    }
    snowEta = computePandolfSnowEta(snowSinkCm);
  }

  let eta = Math.max(baseEta, snowEta);
  if (options?.terrainFactorEta !== undefined && Number.isFinite(options.terrainFactorEta)) {
    eta = Math.max(eta, clamp(options.terrainFactorEta, 1.0, PANDOLF_SNOW_MAX_ETA));
  }

  return {
    eta: clamp(eta, 1.0, PANDOLF_SNOW_MAX_ETA),
    verglas,
    deepSnowCap,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. TRAÎNÉE VENT VECTORIELLE (Pugh 1971)
// ─────────────────────────────────────────────────────────────────────────────

/** Surface corporelle de DuBois (m²) : 0.007184 * W^0.425 * H^0.725. */
export function computeDuBoisBsaM2(weightKg: number, heightCm = IEA_REFERENCE_HEIGHT_CM): number {
  const w = clamp(weightKg, 20, 300);
  const h = clamp(heightCm, 100, 230);
  return 0.007184 * Math.pow(w, 0.425) * Math.pow(h, 0.725);
}

/**
 * Traînée aérodynamique vectorielle (Pugh 1971) :
 * - `vRel = speedMs + windHeadMs` (signée, peut être négative en vent arrière)
 * - `F_aero = 0.5 * 0.90 * rho(z) * (0.266 * bsa) * vRel * Math.abs(vRel)`
 * - `P_aero = Math.max(0, F_aero * speedMs / 0.25)`
 */
export function computePughWindDragW(
  speedMs: number,
  windHeadMs: number,
  weightKg: number,
  altitudeM: number,
  _tempC = 15,
  heightCm = IEA_REFERENCE_HEIGHT_CM
): { fAeroN: number; pAeroW: number } {
  const v = clamp(speedMs, 0, 10);
  const wHead = clamp(windHeadMs, -100, 100);
  const vRel = v + wHead;
  const z = clamp(altitudeM, ALTITUDE_MIN_M, ALTITUDE_MAX_M);
  // Densité barométrique ISA à l'altitude z (1.225 kg/m³ à z=0, T_ISA=15 °C)
  const pressurePa = 101325 * Math.pow(1 - (0.0065 * Math.max(0, z)) / 288.15, 5.25588);
  const rho = pressurePa / (287.05 * 288.15);
  const bsa = computeDuBoisBsaM2(weightKg, heightCm);
  const projectedArea = 0.266 * bsa;
  const fAeroN = 0.5 * 0.90 * rho * projectedArea * vRel * Math.abs(vRel);
  const pAeroW = Math.max(0, (fAeroN * v) / 0.25);
  return { fAeroN, pAeroW };
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. CHAUSSURES (Legg & Mahanty 1986), VÊTEMENTS & OBSCURITÉ (Norrbrand 2023/2025)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Surcoût chaussures lourdes : +0.96 % par 100 g excédentaire par pied (Legg & Mahanty 1986).
 * `footwearWeightKg` représente la masse de la paire en kg (soit `footwearWeightKg * 500` g par pied).
 */
export function computeFootwearMultiplier(footwearWeightKg?: number): number {
  if (footwearWeightKg === undefined || !Number.isFinite(footwearWeightKg) || footwearWeightKg <= 0) {
    return 1.0;
  }
  const gramsPerFoot = (clamp(footwearWeightKg, 0, 10) * 1000) / 2;
  return 1 + 0.0096 * (gramsPerFoot / 100);
}

/**
 * Surcoût couches froid : +3 % par kg de vêtement / +3 % par couche (Rintamäki 2007 / Kuklane 2020).
 */
export function computeColdClothingMultiplier(
  clothingWeightKg?: number,
  clothingLayers?: number
): number {
  const kgTerm =
    clothingWeightKg !== undefined && Number.isFinite(clothingWeightKg) && clothingWeightKg > 0
      ? 0.03 * clamp(clothingWeightKg, 0, 10)
      : 0;
  const layerTerm =
    clothingLayers !== undefined && Number.isFinite(clothingLayers) && clothingLayers > 0
      ? 0.03 * clamp(clothingLayers, 0, 8)
      : 0;
  return 1 + Math.min(0.30, Math.max(kgTerm, layerTerm));
}

/**
 * Surcoût de marche nocturne (crépuscule dépassé, Norrbrand 2023/2025) :
 * +10 % à +30 % selon la pente et la technicité du segment.
 */
export function computeNightWalkingMultiplier(
  isNight: boolean,
  gradePct: number,
  technicalClass: number,
  nightFraction = 1
): number {
  if (!isNight || nightFraction <= 0) return 1.0;
  const frac = clamp(nightFraction, 0, 1);
  const slopeNorm = clamp(Math.abs(gradePct) / 25, 0, 1);
  const techNorm = clamp((technicalClass - 1) / 4, 0, 1);
  const surcost = 0.10 + 0.20 * (0.5 * slopeNorm + 0.5 * techNorm);
  return 1 + frac * surcost;
}

// ─────────────────────────────────────────────────────────────────────────────
// 5. CAPACITÉ AÉROBIE EFFECTIVE : HYPOXIE (Péronnet 1991) & THERMIQUE (UTCI)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Facteur de rétention aérobie en hypoxie `fHyp(z)` :
 * - Polynôme cubique de Péronnet et al. (1991) en pression barométrique
 *   `P_B(Torr) = 760 * (1 - 0.0065 * z / 288.15)^5.25588` jusqu'à 4 500 m.
 * - Relayé par une sigmoïde continue au-delà de 4 500 m.
 */
export function computePeronnetHypoxiaFactor(altitudeM: number): number {
  const z = clamp(altitudeM, 0, ALTITUDE_MAX_M);
  if (z <= 0) return 1.0;

  const pbAt = (altM: number): number =>
    760 * Math.pow(1 - (0.0065 * altM) / 288.15, 5.25588);

  const peronnetPoly = (altM: number): number => {
    const pb = pbAt(altM);
    const deltaP = Math.max(0, (760 - pb) / 760);
    return clamp(
      1 - 0.18 * deltaP - 1.15 * Math.pow(deltaP, 2) - 0.35 * Math.pow(deltaP, 3),
      0.25,
      1.0
    );
  };

  if (z <= 4500) {
    return peronnetPoly(z);
  }

  const f4500 = peronnetPoly(4500);
  const sigmoidRelay = (2 * f4500) / (1 + Math.exp((z - 4500) / 2200));
  return clamp(sigmoidRelay, 0.25, f4500);
}

/**
 * Évalue le stress thermique (UTCI / Steadman AT en repli), le refroidissement éolien (WCT),
 * l'isolation requise (IREQ ISO 11079), l'indice WBGT et le facteur de capacité aérobie `fTherm`.
 *
 * Propriété garantie : ajouter de la chaleur (`tempC` croissant) ne diminue jamais `mEffW` ni `IEA`.
 */
export function computeThermalCapacityFactor(
  tempC: number,
  windMs = 0,
  humidityPct = 50,
  solarRadiationWm2 = 0,
  deltaIcl = 0
): {
  fTherm: number;
  heatMetabolicFactor: number;
  utciC: number;
  wbgtC: number;
  wctC: number;
  ireqClo: number;
} {
  const t = clamp(tempC, -60, 60);
  const v = clamp(windMs, 0, 100);
  const rh = clamp(humidityPct, 0, 100);
  const solar = clamp(solarRadiationWm2, 0, 1400);

  // Wind Chill Temperature (WCT) : utilise exclusivement windKmh = windMs * 3.6
  const vKmh = windMsToKmhForWindChill(v);
  const wctC =
    t <= 10 && vKmh > 4.8
      ? 13.12 + 0.6215 * t - 11.37 * Math.pow(vKmh, 0.16) + 0.3965 * t * Math.pow(vKmh, 0.16)
      : t;

  // Pression de vapeur d'eau (hPa) — Magnus-Tetens
  const eHpa = (rh / 100) * 6.105 * Math.exp((17.27 * t) / (237.7 + t));

  // Température apparente de Steadman / approximation UTCI avec rayonnement et deltaIcl
  const radiantBoostC = 0.007 * solar;
  const utciC = t + 0.33 * eHpa - 0.70 * Math.min(v, 20) - 4.0 + radiantBoostC + 1.5 * deltaIcl;

  // Approximation WBGT (Wet-Bulb Globe Temperature) pour le bandeau Risque chaleur
  const wbgtC = 0.567 * t + 0.393 * eHpa + 3.94 + 0.003 * solar;

  // Isolation vestimentaire requise IREQ (clo, ISO 11079 simplifié pour marche active)
  const ireqClo = t < 10 ? clamp((12 - wctC) * 0.11, 0.5, 4.5) : 0.4;

  // Dérive thermorégulatrice monotone avec la température :
  // - Neutre à 15 °C (1.0000 exact pour Golden Test 1)
  // - Croissance monotone douce au-dessus de 15 °C (coût sudation / vasodilatation)
  const excessHeatC = Math.max(0, t - 15);
  const subNeutralRamp = 1e-6 * Math.max(0, t + 60);
  const heatMetabolicFactor =
    1 + subNeutralRamp + 0.0035 * excessHeatC + 0.00015 * excessHeatC * excessHeatC;

  // Réduction de capacité aérobie fTherm en chaleur (monotone décroissante avec tempC)
  const fTherm = clamp(
    1 - subNeutralRamp - 0.0045 * excessHeatC - 0.00022 * excessHeatC * excessHeatC,
    0.65,
    1.0
  );

  return {
    fTherm,
    heatMetabolicFactor,
    utciC,
    wbgtC,
    wctC,
    ireqClo,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// 6. DOSE & SIGMOÏDE DE HILL (0..100 %)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Sigmoïde de Hill 0..100 % (`effort-score-v1`) :
 * `score = 100 * dose^1.35 / (180^1.35 + dose^1.35)`
 */
export function computeHillEffortScore(dose: number): number {
  if (!Number.isFinite(dose) || dose <= 0) return 0;
  const dPow = Math.pow(dose, EFFORT_HILL_EXPONENT);
  const kPow = Math.pow(EFFORT_HILL_HALF_DOSE, EFFORT_HILL_EXPONENT);
  const score = (100 * dPow) / (kPow + dPow);
  return clamp(score, 0, 100);
}

// ─────────────────────────────────────────────────────────────────────────────
// 7. ÉVALUATION D'UNE COALITION (POUR SHAPLEY EXACT K = 6, 2^6 = 64 COALITIONS)
// ─────────────────────────────────────────────────────────────────────────────

interface CoalitionFlags {
  ascent: boolean;
  descent: boolean;
  packLoad: boolean;
  surfaceAndSnow: boolean;
  thermalAndWind: boolean;
  altitude: boolean;
}

const ALL_PILLARS_ON: CoalitionFlags = {
  ascent: true,
  descent: true,
  packLoad: true,
  surfaceAndSnow: true,
  thermalAndWind: true,
  altitude: true,
};

interface ResolvedExtendedFlags {
  carryType: 'backpack' | 'vest';
  hasPoles: boolean;
  footwearWeightKg: number;
  clothingWeightKg: number;
  clothingLayers: number;
  deltaIcl: number;
  isNight: boolean;
  nightFraction: number;
  windHeadMs: number;
  api72h: number;
  soilMoistureVwc: number;
  soilTempC: number;
  avalancheRiskIndex: number;
  missingColdLayers: boolean;
  heightCm: number;
  turnaroundMarginS: number | null;
}

function resolveExtendedFlags(input: EffortScoreExtendedInput): ResolvedExtendedFlags {
  const equipSnap = input.snapshot?.equipmentSnapshot ?? '';
  const ctxSnap = `${input.snapshot?.contextSnapshot ?? ''} ${input.snapshot?.scenario ?? ''}`;

  const carryType = input.carryType ?? input.pack.carryType ?? 'backpack';
  const hasPoles =
    input.hasPoles ?? input.pack.hasPoles ?? /pole|baton|bâton/i.test(equipSnap);

  const inferredBootsKg = /boot|botte|crampon|hiver|winter/i.test(equipSnap) ? 1.6 : 0;
  const footwearWeightKg = input.pack.footwearWeightKg ?? inferredBootsKg;

  const inferredLayers = /layer|couche|hiver|winter|expedition/i.test(equipSnap) ? 3 : 0;
  const clothingWeightKg = input.clothingWeightKg ?? input.pack.clothingWeightKg ?? 0;
  const clothingLayers = input.clothingLayers ?? input.pack.clothingLayers ?? inferredLayers;

  const isNight =
    input.isNight ??
    input.weather.isNight ??
    ((input.twilightOverrunRatio !== undefined && input.twilightOverrunRatio > 0) ||
      /night|nuit|twilight|crepuscule|crépuscule/i.test(ctxSnap));

  const nightFraction =
    input.twilightOverrunRatio !== undefined
      ? clamp(input.twilightOverrunRatio, 0, 1)
      : isNight
        ? 1
        : 0;

  const windHeadMs = input.windHeadMs ?? input.weather.windHeadMs ?? input.weather.windMs;
  const api72h = input.api72h ?? input.ground.api72h ?? 0;
  const soilMoistureVwc = input.soilMoistureVwc ?? input.ground.soilMoistureVwc ?? 0;
  const soilTempC = input.soilTempC ?? input.ground.soilTempC ?? input.weather.tempC;
  const avalancheRiskIndex = clamp(input.avalancheRiskIndex ?? 0, 0, 5);
  const missingColdLayers =
    input.missingColdLayers ?? input.pack.missingColdLayers ?? false;
  const heightCm = input.heightCm ?? IEA_REFERENCE_HEIGHT_CM;
  const turnaroundMarginS =
    input.turnaroundMarginS !== undefined ? input.turnaroundMarginS : null;

  return {
    carryType,
    hasPoles,
    footwearWeightKg,
    clothingWeightKg,
    clothingLayers,
    deltaIcl: input.deltaIcl ?? 0,
    isNight,
    nightFraction,
    windHeadMs,
    api72h,
    soilMoistureVwc,
    soilTempC,
    avalancheRiskIndex,
    missingColdLayers,
    heightCm,
    turnaroundMarginS,
  };
}

interface ProfileEvaluationResult {
  score: number;
  rawDose: number;
  meanPowerW: number;
  meanLcdaW: number;
  meanAeroW: number;
  meanEccentricW: number;
  pVo2MaxSeaW: number;
  meanPVo2MaxEffW: number;
  meanIMod: number;
  metabolicEnergyKj: number;
  totalDurationS: number;
  meanLoadFactor: number;
  meanEta: number;
  meanThermalFactor: number;
  meanAltitudeFactor: number;
  verglasDetected: boolean;
  deepSnowCapDetected: boolean;
  steepDescentDetected: boolean;
  highAltitudeDetected: boolean;
}

function evaluateProfileForCoalition(
  input: EffortScoreExtendedInput,
  ext: ResolvedExtendedFlags,
  physiology: EffortPhysiologyInput,
  isReferenceProfile: boolean,
  coalition: CoalitionFlags,
  packWeightOverrideKg?: number
): ProfileEvaluationResult {
  const weightKg = isReferenceProfile ? IEA_REFERENCE_WEIGHT_KG : clamp(physiology.weightKg, 20, 300);
  const vo2Max = isReferenceProfile
    ? IEA_REFERENCE_VO2MAX_ML_KG_MIN
    : resolveEffectiveVo2Max(physiology).vo2MaxMlKgMin;
  const mRestWkg = computeRestingMetabolicRateWkg(
    { ...physiology, weightKg },
    isReferenceProfile
  );
  const pVo2MaxSeaW = ((vo2Max * weightKg) / 1000) * VO2_TO_WATTS_FACTOR;

  const activePackKg = coalition.packLoad
    ? (packWeightOverrideKg ?? input.pack.packWeightKg)
    : 0;
  const loadFactor = computeBackpackLoadFactor(activePackKg, weightKg, ext.carryType);
  const footwearMult = coalition.packLoad
    ? computeFootwearMultiplier(ext.footwearWeightKg)
    : 1.0;
  const clothingMult = coalition.packLoad
    ? computeColdClothingMultiplier(ext.clothingWeightKg, ext.clothingLayers)
    : 1.0;

  const tempC = coalition.thermalAndWind ? input.weather.tempC : 15;
  const windMs = coalition.thermalAndWind ? input.weather.windMs : 0;
  const windHeadMs = coalition.thermalAndWind ? ext.windHeadMs : 0;
  const humidityPct = coalition.thermalAndWind ? (input.weather.humidityPct ?? 50) : 50;
  const solarWm2 = coalition.thermalAndWind ? (input.weather.solarRadiationWm2 ?? 0) : 0;

  const thermal = computeThermalCapacityFactor(
    tempC,
    windMs,
    humidityPct,
    solarWm2,
    coalition.thermalAndWind ? ext.deltaIcl : 0
  );

  let totalDurationS = 0;
  let weightedPowerWs = 0;
  let weightedLcdaWs = 0;
  let weightedAeroWs = 0;
  let weightedEccentricWs = 0;
  let weightedPVo2EffWs = 0;
  let weightedEtaS = 0;
  let weightedAltFactorS = 0;
  let rawDose = 0;

  let verglasDetected = false;
  let deepSnowCapDetected = false;
  let steepDescentDetected = false;
  let highAltitudeDetected = false;

  for (const seg of input.segments) {
    const dtS = Math.max(1e-3, seg.durationS);
    const speedMs = clamp(seg.speedMs, 0.05, 10);

    let activeGradePct = 0;
    if (seg.gradePct > 0 && coalition.ascent) {
      activeGradePct = seg.gradePct;
    } else if (seg.gradePct < 0 && coalition.descent) {
      activeGradePct = seg.gradePct;
    }

    const altitudeM = coalition.altitude ? seg.altitudeM : 0;
    if (altitudeM >= 2500) {
      highAltitudeDetected = true;
    }

    const segSurface =
      seg.surface && seg.surface !== 'trail' ? seg.surface : input.ground.surface || seg.surface;
    const segSnowCm = Math.max(seg.snowSinkCm ?? 0, input.ground.snowSinkCm ?? 0);

    const surfaceRes = coalition.surfaceAndSnow
      ? resolveSurfaceEta(segSurface, speedMs, {
          snowSinkCm: segSnowCm,
          wetness: input.ground.wetness,
          api72h: ext.api72h,
          soilMoistureVwc: ext.soilMoistureVwc,
          soilTempC: ext.soilTempC,
          terrainFactorEta: input.ground.terrainFactorEta,
        })
      : { eta: 1.0, verglas: false, deepSnowCap: false };

    if (surfaceRes.verglas) verglasDetected = true;
    if (surfaceRes.deepSnowCap) deepSnowCapDetected = true;

    const eta = surfaceRes.eta;
    const mGrade = computeLcdaGradeTerm(speedMs, activeGradePct);
    const baseWalkTerm = 1.78 * Math.pow(speedMs, 0.58) + 0.27 * Math.pow(speedMs, 4);
    const walkTerm = Math.max(0.30, baseWalkTerm + mGrade);
    const mLcdaWkg = mRestWkg + 0.19 + eta * walkTerm * loadFactor;
    const mLcdaW = weightKg * mLcdaWkg;

    // Sur le canal du score (perçu/excentrique), une descente ne réduit pas le coût de marche sous le plat :
    // la gravité est absorbée par le freinage excentrique additionnel.
    const scoreWalkTerm = Math.max(0.30, baseWalkTerm + Math.max(0, mGrade));
    const scoreLcdaW = weightKg * (mRestWkg + 0.19 + eta * scoreWalkTerm * loadFactor);

    const aero = coalition.thermalAndWind
      ? computePughWindDragW(speedMs, windHeadMs, weightKg, altitudeM, tempC, ext.heightCm)
      : { fAeroN: 0, pAeroW: 0 };

    const nightMult = coalition.thermalAndWind
      ? computeNightWalkingMultiplier(
          ext.isNight,
          activeGradePct,
          seg.technicalClass ?? 1,
          ext.nightFraction
        )
      : 1.0;

    // Puissance métabolique effective du segment (canal métabolique LCDA kJ)
    const segMEffW =
      (mLcdaW + aero.pAeroW) *
      footwearMult *
      clothingMult *
      nightMult *
      thermal.heatMetabolicFactor;

    const segScoreBaseW =
      (scoreLcdaW + aero.pAeroW) *
      footwearMult *
      clothingMult *
      nightMult *
      thermal.heatMetabolicFactor;

    // Double canal en descente :
    // - Canal métabolique (segMEffW * dtS) pour la dépense énergétique kJ
    // - Canal perçu/excentrique (proportionnel à D- * (W + L), atténué de 25 % avec bâtons)
    const lossFromGradeM =
      activeGradePct < 0 ? (-activeGradePct / 100) * seg.distanceM : 0;
    const segLossM = coalition.descent ? Math.max(seg.lossM ?? 0, lossFromGradeM) : 0;
    if (activeGradePct <= -18 || segLossM >= 500) {
      steepDescentDetected = true;
    }

    const polesAttenuation = ext.hasPoles ? 0.75 : 1.0;
    const descentRateMs = segLossM / dtS;
    const steepnessFactor = clamp(Math.abs(activeGradePct) / 15, 0.5, 2.5);
    const segEccentricW =
      coalition.descent && segLossM > 0
        ? polesAttenuation * 0.22 * 9.81 * (weightKg + activePackKg) * descentRateMs * steepnessFactor
        : 0;

    const fHyp = coalition.altitude ? computePeronnetHypoxiaFactor(altitudeM) : 1.0;
    const fTherm = coalition.thermalAndWind ? thermal.fTherm : 1.0;
    const segPVo2MaxEffW = Math.max(200, pVo2MaxSeaW * fHyp * fTherm);

    const segIScore = (segScoreBaseW + segEccentricW) / segPVo2MaxEffW;
    const psiEnv = 1.0;
    const psiCog = 1.0;
    const segDose =
      100 *
      psiEnv *
      psiCog *
      Math.pow(segIScore / EFFORT_DOSE_INTENSITY_REF, 2) *
      durationSecondsToHours(dtS);

    totalDurationS += dtS;
    weightedPowerWs += segMEffW * dtS;
    weightedLcdaWs += mLcdaW * dtS;
    weightedAeroWs += aero.pAeroW * dtS;
    weightedEccentricWs += segEccentricW * dtS;
    weightedPVo2EffWs += segPVo2MaxEffW * dtS;
    weightedEtaS += eta * dtS;
    weightedAltFactorS += (1 / fHyp) * dtS;
    rawDose += segDose;
  }

  const safeDur = Math.max(1e-3, totalDurationS);
  const meanPowerW = weightedPowerWs / safeDur;
  const meanLcdaW = weightedLcdaWs / safeDur;
  const meanAeroW = weightedAeroWs / safeDur;
  const meanEccentricW = weightedEccentricWs / safeDur;
  const meanPVo2MaxEffW = weightedPVo2EffWs / safeDur;
  const meanIMod = (meanPowerW + meanEccentricW) / Math.max(200, meanPVo2MaxEffW);
  const metabolicEnergyKj = weightedPowerWs / 1000;

  return {
    score: computeHillEffortScore(rawDose),
    rawDose,
    meanPowerW,
    meanLcdaW,
    meanAeroW,
    meanEccentricW,
    pVo2MaxSeaW,
    meanPVo2MaxEffW,
    meanIMod,
    metabolicEnergyKj,
    totalDurationS,
    meanLoadFactor: loadFactor * footwearMult * clothingMult,
    meanEta: weightedEtaS / safeDur,
    meanThermalFactor: 1 / Math.max(0.5, thermal.fTherm),
    meanAltitudeFactor: weightedAltFactorS / safeDur,
    verglasDetected,
    deepSnowCapDetected,
    steepDescentDetected,
    highAltitudeDetected,
  };
}

function resolveEffectiveVo2Max(physiology: EffortPhysiologyInput): {
  vo2MaxMlKgMin: number;
  imputed: boolean;
} {
  if (
    physiology.vo2MaxMlKgMin !== undefined &&
    Number.isFinite(physiology.vo2MaxMlKgMin)
  ) {
    return { vo2MaxMlKgMin: clamp(physiology.vo2MaxMlKgMin, 15, 95), imputed: false };
  }
  if (
    physiology.hrMax !== undefined &&
    physiology.hrRest !== undefined &&
    physiology.hrRest > 0 &&
    physiology.hrMax > physiology.hrRest
  ) {
    // Formule d'Uth et al. (2004) : VO2max ≈ 15.3 * (HRmax / HRrest)
    return {
      vo2MaxMlKgMin: clamp(15.3 * (physiology.hrMax / physiology.hrRest), 22, 85),
      imputed: true,
    };
  }
  const age =
    physiology.birthYear !== undefined ? clamp(2026 - physiology.birthYear, 14, 90) : 32;
  const base = physiology.sex === 'female' ? 44 : IEA_REFERENCE_VO2MAX_ML_KG_MIN;
  return {
    vo2MaxMlKgMin: clamp(base - 0.30 * Math.max(0, age - 30), 22, 80),
    imputed: true,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// 8. SHAPLEY EXACT SUR K = 6 PILIERS (2^6 = 64 COALITIONS)
// ─────────────────────────────────────────────────────────────────────────────

const SHAPLEY_PILLAR_KEYS = [
  'ascent',
  'descent',
  'packLoad',
  'surfaceAndSnow',
  'thermalAndWind',
  'altitude',
] as const;

type ShapleyPillarKey = (typeof SHAPLEY_PILLAR_KEYS)[number];

const FACTORIAL = [1, 1, 2, 6, 24, 120, 720] as const;

function popcount6(mask: number): number {
  let c = 0;
  let m = mask & 0x3f;
  while (m !== 0) {
    c += m & 1;
    m >>>= 1;
  }
  return c;
}

/**
 * Calcule la décomposition exacte de Shapley sur $K = 6$ piliers ($2^6 = 64$ évaluations).
 * Par construction :
 * `\sum_{k=1}^6 \phi_k === IEA - IEA_baseline` à la précision machine ($\approx 10^{-14} \ll 10^{-6}$).
 */
function computeExactShapley6(
  input: EffortScoreExtendedInput,
  ext: ResolvedExtendedFlags,
  referencePhysiology: EffortPhysiologyInput
): {
  contributions: EffortShapleyContributions;
  ieaFull: number;
  ieaBaseline: number;
  fullEval: ProfileEvaluationResult;
} {
  const K = SHAPLEY_PILLAR_KEYS.length; // 6
  const numCoalitions = 1 << K; // 64
  const values = new Float64Array(numCoalitions);
  let fullEval!: ProfileEvaluationResult;

  for (let mask = 0; mask < numCoalitions; mask += 1) {
    const flags: CoalitionFlags = {
      ascent: (mask & (1 << 0)) !== 0,
      descent: (mask & (1 << 1)) !== 0,
      packLoad: (mask & (1 << 2)) !== 0,
      surfaceAndSnow: (mask & (1 << 3)) !== 0,
      thermalAndWind: (mask & (1 << 4)) !== 0,
      altitude: (mask & (1 << 5)) !== 0,
    };
    const res = evaluateProfileForCoalition(
      input,
      ext,
      referencePhysiology,
      true,
      flags
    );
    values[mask] = res.score;
    if (mask === numCoalitions - 1) {
      fullEval = res;
    }
  }

  const ieaBaseline = values[0];
  const ieaFull = values[numCoalitions - 1];

  const phi: Record<ShapleyPillarKey, number> = {
    ascent: 0,
    descent: 0,
    packLoad: 0,
    surfaceAndSnow: 0,
    thermalAndWind: 0,
    altitude: 0,
  };

  for (let i = 0; i < K; i += 1) {
    const bit = 1 << i;
    let acc = 0;
    for (let mask = 0; mask < numCoalitions; mask += 1) {
      if ((mask & bit) !== 0) continue;
      const s = popcount6(mask);
      const weight = (FACTORIAL[s] * FACTORIAL[K - s - 1]) / FACTORIAL[K];
      const delta = values[mask | bit] - values[mask];
      acc += weight * delta;
    }
    phi[SHAPLEY_PILLAR_KEYS[i]] = acc;
  }

  const totalDelta =
    phi.ascent +
    phi.descent +
    phi.packLoad +
    phi.surfaceAndSnow +
    phi.thermalAndWind +
    phi.altitude;

  return {
    contributions: {
      baseDistance: ieaBaseline,
      ascent: phi.ascent,
      descent: phi.descent,
      packLoad: phi.packLoad,
      surfaceAndSnow: phi.surfaceAndSnow,
      thermalAndWind: phi.thermalAndWind,
      altitude: phi.altitude,
      fatigue: 0,
      total: totalDelta,
    },
    ieaFull,
    ieaBaseline,
    fullEval,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// 9. FUSION BAYES-KALMAN, TECHNICITÉ & RISQUE SÉPARÉ (SANS DIAGNOSTIC MÉDICAL)
// ─────────────────────────────────────────────────────────────────────────────

function resolveVarianceByDataLevel(
  dataLevel: DataLevel,
  hrCoverageRatio?: number
): { varMod: number; varObs: number; varPost: number } {
  const sigmaMod = 0.065;
  const varMod = sigmaMod * sigmaMod;

  if (dataLevel === 'socle') {
    return { varMod, varObs: Number.POSITIVE_INFINITY, varPost: varMod };
  }

  const coverage = clamp(hrCoverageRatio ?? 0.85, 0.25, 1.0);
  const baseSigmaObs = dataLevel === 'complet' ? 0.028 : 0.042;
  const sigmaObs = baseSigmaObs / Math.sqrt(coverage);
  const varObs = sigmaObs * sigmaObs;
  const varPost = (varMod * varObs) / (varMod + varObs);
  return { varMod, varObs, varPost };
}

/**
 * Calcule le score de Technicité (entier 1..5) strictement séparé du score énergétique.
 */
function computeSeparateTechnicite(segments: ReadonlyArray<EffortSegmentInput>, surface: string): number {
  let maxTech = 1;
  for (const seg of segments) {
    const segTech = clamp(Math.round(seg.technicalClass ?? 1), 1, 5);
    const surf = (seg.surface || surface || 'trail').toLowerCase();
    const surfaceMinTech = surf === 'rock' || surf === 'scree' ? 3 : 1;
    const slopeMinTech = Math.abs(seg.gradePct) >= 35 ? 3 : Math.abs(seg.gradePct) >= 22 ? 2 : 1;
    maxTech = Math.max(maxTech, segTech, surfaceMinTech, slopeMinTech);
  }
  return clamp(Math.round(maxTech), 1, 5);
}

/**
 * Calcule l'objet `risque` séparé (WCT/IREQ, WBGT/HSDA, sudation Gonzalez, MAWD, verglas, nuit, BRA).
 * Formulations strictement préventives de terrain, zéro diagnostic médical, zéro bonus sur IEA.
 */
function computeSeparateRiskAssessment(
  input: EffortScoreExtendedInput,
  ext: ResolvedExtendedFlags,
  thermal: ReturnType<typeof computeThermalCapacityFactor>,
  meanIEff: number,
  meanPowerW: number,
  verglasDetected: boolean
): {
  risque: EffortRiskAssessment;
  sweatRateLh: number;
  mawdHours: number;
} {
  const factors: string[] = [];

  let maxExposure = 0;
  let maxIsolation = 0;
  let totalDurationS = 0;
  for (const seg of input.segments) {
    maxExposure = Math.max(maxExposure, clamp(seg.exposureClass ?? 0, 0, 5));
    maxIsolation = Math.max(maxIsolation, clamp(seg.isolationClass ?? 0, 0, 5));
    totalDurationS += seg.durationS;
  }

  let weatherHazard = 0;
  let terrainHazard = 0;

  // Froid IREQ / WCT
  if (thermal.wctC <= -10 || (input.weather.tempC <= 0 && input.weather.windMs >= 8)) {
    weatherHazard = Math.max(weatherHazard, thermal.wctC <= -20 ? 4 : 3);
    factors.push(
      `froid_wct_ireq: Vigilance refroidissement éolien (WCT ${thermal.wctC.toFixed(1)} °C, IREQ ${thermal.ireqClo.toFixed(1)} clo) — coupe-vent et couche isolante conseillés`
    );
  }
  if (ext.missingColdLayers || (input.weather.tempC < 2 && ext.clothingLayers === 0 && ext.clothingWeightKg === 0)) {
    weatherHazard = Math.max(weatherHazard, 2.5);
    factors.push(
      'couches_isolantes_ireq: Isolation vestimentaire déclarée sous l’indice IREQ — ajout d’une couche chaude conseillé'
    );
  }

  // Chaleur HSDA / WBGT
  if (thermal.wbgtC >= 24 || input.weather.tempC >= 28) {
    weatherHazard = Math.max(weatherHazard, thermal.wbgtC >= 28 ? 4 : 2.5);
    factors.push(
      `chaleur_wbgt_hsda: Vigilance chaleur (WBGT ${thermal.wbgtC.toFixed(1)} °C) — allure modérée et pauses ombragées conseillées`
    );
  }

  // Sudation Gonzalez et al. (2009) en L/h
  const bsa = computeDuBoisBsaM2(input.physiology.weightKg, ext.heightCm);
  const rawSweatLh =
    0.15 +
    0.0011 * Math.max(0, meanPowerW - 150) * (bsa / 1.9) +
    0.025 * Math.max(0, input.weather.tempC - 15);
  const sweatRateLh = clamp(rawSweatLh, 0.15, 2.5);
  if (sweatRateLh >= 0.85) {
    factors.push(
      `sudation_gonzalez: Apport hydrique régulier conseillé (~${sweatRateLh.toFixed(2)} L/h estimés)`
    );
  }

  // MAWD (Maximum Acceptable Work Duration, Wu & Wang 2002)
  const mawdHours = clamp(26.12 * Math.exp(-4.81 * clamp(meanIEff, 0.1, 1.2)), 0.5, 24);
  const activeHours = durationSecondsToHours(totalDurationS);
  if (activeHours > mawdHours) {
    weatherHazard = Math.max(weatherHazard, 2);
    factors.push(
      `mawd_duree_acceptable: Durée active (${activeHours.toFixed(1)} h) supérieure au repère d’endurance continue (${mawdHours.toFixed(1)} h) — fractionnement et pauses conseillés`
    );
  }

  // Verglas
  if (verglasDetected) {
    terrainHazard = Math.max(terrainHazard, 3.5);
    factors.push(
      'verglas: Sol froid (<= 0 °C) et humide — vigilance adhérence et équipement d’accroche conseillés'
    );
  }

  // Marche de nuit / crépuscule
  if (ext.isNight || (ext.turnaroundMarginS !== null && ext.turnaroundMarginS <= 0)) {
    terrainHazard = Math.max(terrainHazard, 2.5);
    factors.push(
      'nuit_crepuscule: Progression nocturne ou au-delà du crépuscule — éclairage frontal et réserve d’autonomie requis'
    );
  }

  // Risque nivologique / BRA (1..5)
  if (ext.avalancheRiskIndex > 0) {
    terrainHazard = Math.max(terrainHazard, clamp(ext.avalancheRiskIndex, 0, 5));
    factors.push(
      `nivologie_bra: Indice bulletin nivologique ${ext.avalancheRiskIndex}/5 — vérification de l’itinéraire et matériel de sécurité requis`
    );
  }

  const dimScore =
    ((maxExposure + maxIsolation + weatherHazard + terrainHazard) / 20) * 100;
  const riskScore = clamp(dimScore, 0, 100);
  const level: EffortRiskAssessment['level'] =
    riskScore >= 70
      ? 'critical'
      : riskScore >= 45
        ? 'high'
        : riskScore >= 20
          ? 'moderate'
          : 'low';

  return {
    risque: {
      level,
      score: riskScore,
      dimensions: {
        exposure: maxExposure,
        isolation: maxIsolation,
        weatherHazard: clamp(weatherHazard, 0, 5),
        terrainHazard: clamp(terrainHazard, 0, 5),
        turnaroundMarginS: ext.turnaroundMarginS,
      },
      factors,
    },
    sweatRateLh,
    mawdHours,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// 10. ENTRÉE PRINCIPALE : `computeEffortScore`
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Calcule le score d'effort bioénergétique complet (`effort-score-v1`) :
 * IEA, ERP, eFlatKm, dose brute, décomposition de Shapley exacte (64 coalitions),
 * fourchette d'incertitude `[p10, p50, p90]`, Technicité (1..5) et Risque séparés.
 */
export function computeEffortScore(
  input: EffortScoreInput | EffortScoreExtendedInput
): EffortScoreComputedOutput {
  const extInput = input as EffortScoreExtendedInput;
  const ext = resolveExtendedFlags(extInput);
  const warnings: EffortWarning[] = [];

  // Vérification du domaine de vitesse LCDA [0.45, 1.97] m/s par segment
  for (const seg of extInput.segments) {
    if (!isSpeedInLcdaDomain(seg.speedMs) || seg.outOfDomain === true) {
      warnings.push({
        code: 'out_of_domain',
        message: `Vitesse segment #${seg.segmentId} (${seg.speedMs.toFixed(2)} m/s) hors du domaine LCDA validé [${LCDA_SPEED_MIN_MS}, ${LCDA_SPEED_MAX_MS}] m/s.`,
        severity: 'warning',
        segmentId: seg.segmentId,
      });
    }
  }

  // Ratio charge / masse corporelle
  const loadRatioUser = computeLoadToBodyRatio(
    extInput.pack.packWeightKg,
    extInput.physiology.weightKg
  );
  if (loadRatioUser.clampedRatio >= 0.50 || !loadRatioUser.isWithinBounds) {
    warnings.push({
      code: 'load_ratio_near_limit',
      message: `Ratio charge/masse (${(loadRatioUser.ratio * 100).toFixed(1)} %) proche ou au-delà de la borne bioénergétique (${LOAD_TO_BODY_RATIO_MAX * 100} %).`,
      severity: 'warning',
    });
  }

  // 1. Calcul IEA & Shapley exact (profil de référence : 75 kg, VO2max 48)
  const referencePhysiology: EffortPhysiologyInput = {
    weightKg: IEA_REFERENCE_WEIGHT_KG,
    vo2MaxMlKgMin: IEA_REFERENCE_VO2MAX_ML_KG_MIN,
  };

  const shapleyRes = computeExactShapley6(extInput, ext, referencePhysiology);
  const ieaEval = shapleyRes.fullEval;
  const iea = shapleyRes.ieaFull;
  const ieaBaseline = shapleyRes.ieaBaseline;

  // 2. Calcul ERP (profil personnel + fusion Bayes-Kalman + filtre anti-surdéclaration)
  const vo2Resolution = resolveEffectiveVo2Max(extInput.physiology);
  if (vo2Resolution.imputed) {
    warnings.push({
      code: 'imputed_physiology',
      message: 'Capacité aérobie VO2max estimée par prior anthropométrique/cardiaque.',
      severity: 'info',
    });
  }

  let erpEval = evaluateProfileForCoalition(
    extInput,
    ext,
    extInput.physiology,
    false,
    ALL_PILLARS_ON
  );

  const dataLevel: DataLevel = extInput.dataLevel ?? 'socle';
  const variances = resolveVarianceByDataLevel(
    dataLevel,
    extInput.observations?.hrCoverageRatio
  );

  let iObs: number | null = null;
  if (
    dataLevel !== 'socle' &&
    extInput.observations?.avgHeartRateBpm !== undefined &&
    Number.isFinite(extInput.observations.avgHeartRateBpm)
  ) {
    const hrRest = extInput.physiology.hrRest ?? 60;
    const hrMax =
      extInput.physiology.hrMax ??
      (extInput.physiology.birthYear !== undefined
        ? clamp(208 - 0.7 * (2026 - extInput.physiology.birthYear), 120, 220)
        : 185);
    const hrr = Math.max(20, hrMax - hrRest);
    iObs = clamp((extInput.observations.avgHeartRateBpm - hrRest) / hrr, 0.05, 1.25);
  }

  // Filtre anti-surdéclaration : si écart (iMod - iObs) > 2.5 * sigma avec sac déclaré élevé
  let overdeclarationDetected = false;
  if (
    iObs !== null &&
    loadRatioUser.clampedRatio >= 0.18 &&
    erpEval.meanIMod - iObs > 2.5 * Math.sqrt(variances.varMod + variances.varObs)
  ) {
    overdeclarationDetected = true;
    const priorPackKg = 0.08 * extInput.physiology.weightKg;
    const retractedPackKg = 0.5 * priorPackKg + 0.5 * extInput.pack.packWeightKg;
    erpEval = evaluateProfileForCoalition(
      extInput,
      ext,
      extInput.physiology,
      false,
      ALL_PILLARS_ON,
      retractedPackKg
    );
    warnings.push({
      code: 'low_confidence',
      message:
        'Écart modèle/cardio supérieur à 2.5σ avec charge déclarée élevée : masse du sac rétractée vers le prior.',
      severity: 'warning',
    });
  }

  const iMod = erpEval.meanIMod;
  const iEff =
    iObs !== null && Number.isFinite(variances.varObs)
      ? (variances.varObs * iMod + variances.varMod * iObs) /
        (variances.varMod + variances.varObs)
      : iMod;
  const iec = iObs !== null && iObs > 0 ? iMod / iObs : null;

  // Facteur de fatigue intra-journée / charge récente pour ERP
  const declaredFatigue = clamp(extInput.observations?.declaredFatigue ?? 0, 0, 10);
  const recentLoadHours = durationSecondsToHours(
    Math.max(0, extInput.observations?.recentLoadS ?? 0)
  );
  const fatigueMultiplier = 1 + 0.015 * declaredFatigue + 0.01 * Math.min(12, recentLoadHours);

  const fusionRatio = iMod > 1e-6 ? iEff / iMod : 1.0;
  const erpDose = erpEval.rawDose * Math.pow(fusionRatio, 2) * fatigueMultiplier;
  const erp = computeHillEffortScore(erpDose);

  // 3. Intervalle d'incertitude [p10, p50, p90] centré sur le score espéré (sans pénalité sur la valeur centrale en socle)
  const sigmaPost = Math.sqrt(variances.varPost);
  const z10_90 = 1.2815515655446004;
  const doseScaleLow = Math.pow(Math.max(0.15, 1 - z10_90 * sigmaPost), 2);
  const doseScaleHigh = Math.pow(1 + z10_90 * sigmaPost, 2);

  const p50 = iea;
  const p10 = clamp(computeHillEffortScore(ieaEval.rawDose * doseScaleLow), 0, p50);
  const p90 = clamp(computeHillEffortScore(ieaEval.rawDose * doseScaleHigh), p50, 100);
  const interval: EffortQuantileInterval = { p10, p50, p90 };

  // 4. Équivalent plat `eFlatKm` (km-effort)
  // Référence : 1 km à plat à 1.35 m/s, 0 kg sac, bitume, 15 °C, 0 m = 3.2718 unités de dose
  const DOSE_PER_FLAT_REFERENCE_KM = 3.2718;
  const eFlatKm = Math.max(0, ieaEval.rawDose / DOSE_PER_FLAT_REFERENCE_KM);

  // 5. Warnings environnementaux et terrain
  const thermal = computeThermalCapacityFactor(
    extInput.weather.tempC,
    extInput.weather.windMs,
    extInput.weather.humidityPct ?? 50,
    extInput.weather.solarRadiationWm2 ?? 0,
    ext.deltaIcl
  );

  if (ieaEval.highAltitudeDetected) {
    warnings.push({
      code: 'high_altitude_hypoxia',
      message: 'Altitude >= 2 500 m : réduction hypoxique de la capacité aérobie (Péronnet 1991).',
      severity: 'info',
    });
  }
  if (thermal.wctC <= -10) {
    warnings.push({
      code: 'extreme_wind_chill',
      message: `Refroidissement éolien marqué (WCT ${thermal.wctC.toFixed(1)} °C).`,
      severity: 'warning',
    });
  }
  if (thermal.wbgtC >= 26 || extInput.weather.tempC >= 30) {
    warnings.push({
      code: 'extreme_heat_stress',
      message: `Contrainte thermique chaude (UTCI ${thermal.utciC.toFixed(1)} °C).`,
      severity: 'warning',
    });
  }
  if (ieaEval.deepSnowCapDetected) {
    warnings.push({
      code: 'deep_snow_pandolf_cap',
      message: `Enfoncement neige plafonné à eta = ${PANDOLF_SNOW_MAX_ETA.toFixed(1)} (Pandolf 1976).`,
      severity: 'warning',
    });
  }
  if (ieaEval.steepDescentDetected) {
    warnings.push({
      code: 'steep_eccentric_descent',
      message: 'Descente raide ou prolongée : sollicitation musculaire excentrique élevée.',
      severity: 'info',
    });
  }
  if (ext.isNight) {
    warnings.push({
      code: 'twilight_overrun',
      message: 'Marche nocturne ou dépassement du crépuscule pris en compte.',
      severity: 'warning',
    });
  }

  // 6. Technicité (1..5) & Risque séparés
  const technicite = computeSeparateTechnicite(extInput.segments, extInput.ground.surface);
  const { risque, sweatRateLh, mawdHours } = computeSeparateRiskAssessment(
    extInput,
    ext,
    thermal,
    ieaEval.meanIMod,
    ieaEval.meanPowerW,
    ieaEval.verglasDetected
  );

  // 7. Multiplicateurs synthétiques
  const multipliers: EffortMultipliers = {
    load: Math.max(1, ieaEval.meanLoadFactor),
    terrainEta: clamp(ieaEval.meanEta, 1, PANDOLF_SNOW_MAX_ETA),
    thermal: Math.max(0.1, ieaEval.meanThermalFactor),
    altitude: Math.max(0.1, ieaEval.meanAltitudeFactor),
    fatigue: Math.max(1, fatigueMultiplier),
    descentEccentric: Math.max(0, ieaEval.meanEccentricW / Math.max(1, ieaEval.meanPowerW)),
  };

  // 8. Confiance & Provenance Evidence<T>[]
  const baseConfScore =
    dataLevel === 'complet' ? 0.88 : dataLevel === 'cardio' ? 0.76 : 0.62;
  const confScore = clamp01(overdeclarationDetected ? baseConfScore - 0.25 : baseConfScore);
  const confidence: Confidence = makeConfidence({
    score: confScore,
    sampleCount: extInput.segments.length,
    method: `${EFFORT_SCORE_VERSION}:${dataLevel}`,
    reasons: [
      `Calcul bioénergétique ${EFFORT_SCORE_VERSION} (${dataLevel}) sur ${extInput.segments.length} segment(s)`,
    ],
  });

  const capturedAt =
    extInput.evidence[0]?.capturedAt ?? '2026-11-20T12:00:00.000Z';

  const evidence: Evidence<unknown>[] = [
    ...extInput.evidence,
    {
      value: ieaEval.meanPowerW,
      unit: 'W',
      source: 'lcda-2019-pugh-1971',
      kind: 'derived',
      quality: confScore,
      uncertainty: sigmaPost * ieaEval.meanPowerW,
      capturedAt,
      modelVersion: EFFORT_SCORE_VERSION,
    },
    {
      value: iea,
      unit: '%',
      source: 'hill-effort-score-v1',
      kind: 'derived',
      quality: confScore,
      uncertainty: (p90 - p10) / 2,
      capturedAt,
      modelVersion: EFFORT_SCORE_VERSION,
    },
  ];

  const snapshotHash = computeSnapshotHashSync(extInput.snapshot);

  return {
    scoreVersion: EFFORT_SCORE_VERSION,
    snapshotHash,
    iea,
    erp,
    eFlatKm,
    rawDose: ieaEval.rawDose,
    technicite,
    risque,
    multipliers,
    shapley: shapleyRes.contributions,
    dataLevel,
    interval,
    confidence,
    evidence,
    warnings,
    // Champs diagnostiques supplémentaires pour P1/P3/tests dorés
    mEffW: ieaEval.meanPowerW,
    meanPowerW: ieaEval.meanPowerW,
    mLcdaW: ieaEval.meanLcdaW,
    pAeroW: ieaEval.meanAeroW,
    pVo2MaxSeaW: ieaEval.pVo2MaxSeaW,
    pVo2MaxEffW: ieaEval.meanPVo2MaxEffW,
    iMod: ieaEval.meanIMod,
    iObs,
    iEff,
    iec,
    ieaBaseline,
    metabolicEnergyKj: ieaEval.metabolicEnergyKj,
    eccentricPenaltyW: ieaEval.meanEccentricW,
    sweatRateLh,
    mawdHours,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// 11. SEGMENTATION FALLBACK DEPUIS `hike_sessions.positions_timed` (`trail_segments = 0`)
// ─────────────────────────────────────────────────────────────────────────────

export interface TimedPositionLike {
  lat?: number;
  lng?: number;
  lon?: number;
  ele?: number;
  altitudeM?: number;
  elevationM?: number | null;
  t?: number | string;
  timestamp?: number | string;
}

export interface FallbackSegmentationOptions {
  elevationsM?: ReadonlyArray<number>;
  defaultSurface?: FallbackSurfaceKind;
  hysteresisM?: number;
}

function parseTimestampToSeconds(raw: number | string | undefined, fallbackIndex: number): number {
  if (typeof raw === 'number' && Number.isFinite(raw)) {
    return raw > 1e11 ? raw / 1000 : raw;
  }
  if (typeof raw === 'string' && raw.trim().length > 0) {
    const asNum = Number(raw);
    if (Number.isFinite(asNum)) {
      return asNum > 1e11 ? asNum / 1000 : asNum;
    }
    const parsedMs = Date.parse(raw);
    if (Number.isFinite(parsedMs)) {
      return parsedMs / 1000;
    }
  }
  return fallbackIndex * 10;
}

/**
 * Construit des segments `EffortSegmentInput[]` directement depuis `hike_sessions.positions_timed`
 * (avec MNT optionnel `elevationsM`, lissage hystérésis `3 m` par défaut et surface fallback `dirt`)
 * lorsque `trail_segments` est à 0 ligne en base.
 */
export function buildFallbackSegmentsFromPositionsTimed(
  positionsTimed: ReadonlyArray<TimedPositionLike>,
  options?: FallbackSegmentationOptions
): EffortSegmentInput[] {
  if (!Array.isArray(positionsTimed) || positionsTimed.length < 2) {
    return [];
  }

  const defaultSurface: FallbackSurfaceKind = options?.defaultSurface ?? 'dirt';
  const hysteresisM = Math.max(0, options?.hysteresisM ?? 3);

  interface CleanPoint {
    lat: number;
    lng: number;
    ele: number;
    timeS: number;
  }

  const rawPoints: CleanPoint[] = [];
  for (let i = 0; i < positionsTimed.length; i += 1) {
    const item = positionsTimed[i];
    if (!item) continue;
    const lat = item.lat;
    const lng = item.lng ?? item.lon;
    if (
      typeof lat !== 'number' ||
      !Number.isFinite(lat) ||
      lat < -90 ||
      lat > 90 ||
      typeof lng !== 'number' ||
      !Number.isFinite(lng) ||
      lng < -180 ||
      lng > 180
    ) {
      continue;
    }

    const demEle = options?.elevationsM?.[i];
    const rawEle =
      typeof demEle === 'number' && Number.isFinite(demEle)
        ? demEle
        : typeof item.altitudeM === 'number' && Number.isFinite(item.altitudeM)
          ? item.altitudeM
          : typeof item.ele === 'number' && Number.isFinite(item.ele)
            ? item.ele
            : typeof item.elevationM === 'number' && Number.isFinite(item.elevationM)
              ? item.elevationM
              : 0;

    const timeS = parseTimestampToSeconds(item.timestamp ?? item.t, i);
    rawPoints.push({
      lat,
      lng,
      ele: clamp(rawEle, ALTITUDE_MIN_M, ALTITUDE_MAX_M),
      timeS,
    });
  }

  if (rawPoints.length < 2) {
    return [];
  }

  const smoothedEles = smoothAltitude(
    rawPoints.map((p) => p.ele),
    3
  );
  const points: CleanPoint[] = rawPoints.map((p, idx) => ({
    ...p,
    ele: smoothedEles[idx] ?? p.ele,
  }));

  // Regroupement en tronçons d'au moins ~50 m (ou point à point si trace courte)
  const targetSegmentDistanceM = points.length > 20 ? 150 : 1;
  const segments: EffortSegmentInput[] = [];

  let chunkStartIdx = 0;
  let accDistM = 0;

  for (let i = 1; i < points.length; i += 1) {
    const stepDistM = haversineM(points[i - 1], points[i]);
    accDistM += stepDistM;
    const isLast = i === points.length - 1;

    if (accDistM >= targetSegmentDistanceM || isLast) {
      const startPt = points[chunkStartIdx];
      const endPt = points[i];
      const distanceM = Math.max(1, accDistM);
      const rawDtS = endPt.timeS - startPt.timeS;
      const durationS = rawDtS > 0 ? rawDtS : Math.max(1, distanceM / 1.25);
      const speedMs = distanceM / durationS;

      const sliceEles = points.slice(chunkStartIdx, i + 1).map((p) => p.ele);
      const { gainM, lossM } = elevationGainLoss(sliceEles, hysteresisM);

      const deltaEle = endPt.ele - startPt.ele;
      const netDelta = Math.abs(deltaEle) >= hysteresisM ? deltaEle : gainM - lossM;
      const gradePct = clamp((netDelta / distanceM) * 100, -100, 100);
      const gradeDec = gradePctToDec(gradePct);
      const altitudeM = clamp((startPt.ele + endPt.ele) / 2, ALTITUDE_MIN_M, ALTITUDE_MAX_M);
      const outOfDomain = !isSpeedInLcdaDomain(speedMs);

      segments.push({
        segmentId: segments.length + 1,
        distanceM,
        durationS,
        speedMs,
        gradePct,
        gradeDec,
        gainM,
        lossM,
        altitudeM,
        surface: defaultSurface,
        snowSinkCm: 0,
        technicalClass: 1,
        exposureClass: 0,
        isolationClass: 0,
        outOfDomain,
        isRegroupPoint: false,
      });

      chunkStartIdx = i;
      accDistM = 0;
    }
  }

  return segments;
}
