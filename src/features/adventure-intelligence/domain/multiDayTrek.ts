/**
 * A8 — Trek multi-jours (moteur pur).
 *
 * Capacité J1 = 100 % ; chaque journée consomme une part de la capacité
 * (charge A3 : durée estimée, D+, D−, technicité, portage) puis une
 * récupération nocturne paramétrique la restaure. Une nuit courte réduit
 * la récupération, une journée courte l'améliore. La dérive est la baisse
 * cumulée non récupérée ; au-delà des seuils, des ajustements explicables
 * sont proposés.
 *
 * Aucune I/O, aucune donnée de santé connectée.
 */
import { clamp01 } from './confidence';
import { computeFatigue } from './fatigue';

export interface TrekDayInput {
  dayNumber: number;
  distanceM: number;
  gainM: number;
  lossM: number;
  packWeightKg: number | null;
  technicalClass?: number | null;
  sleepQuality?: number | null;
}

export interface TrekAdjustment {
  kind: 'shorten' | 'move_km' | 'change_refuge' | 'add_night' | 'transfer_gear' | 'recovery_day';
  label: string;
  reason: string;
}

export interface TrekDayResult {
  dayNumber: number;
  capacityPct: number;
  loadScore: number;
  difficulty: number;
  driftRisk: number;
  adjustments: TrekAdjustment[];
}

export interface MultiDayTrekResult {
  daily: TrekDayResult[];
  worstDay: number;
  totalDriftRisk: number;
}

export interface MultiDayTrekOptions {
  initialCapacityPct?: number;
  recoveryPerNight?: number;
  heavyPackKg?: number;
}

/** Vitesses de repli pour estimer la durée active d'une journée. */
export const TREK_FLAT_SPEED_KMH = 4;
export const TREK_ASCENT_SPEED_M_PER_HOUR = 300;
export const TREK_DESCENT_SPEED_M_PER_HOUR = 500;

export const DEFAULT_INITIAL_CAPACITY_PCT = 100;
export const DEFAULT_RECOVERY_PER_NIGHT = 20;
export const DEFAULT_HEAVY_PACK_KG = 8;

/** Part de la charge consommée dans la journée. */
export const DEPLETION_RATE = 0.5;
/** Nuit courte : seuil de qualité et facteur de récupération associé. */
export const SHORT_SLEEP_QUALITY_THRESHOLD = 0.5;
export const SHORT_SLEEP_RECOVERY_FACTOR = 0.5;
/** Journée courte : ratio à la médiane des distances et bonus de récupération. */
export const SHORT_DAY_MEDIAN_RATIO = 0.6;
export const SHORT_DAY_RECOVERY_BONUS = 1.5;
/** Seuils d'alerte déclenchant les ajustements. */
export const DIFFICULTY_ALERT_THRESHOLD = 75;
export const DRIFT_ALERT_THRESHOLD = 0.5;

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}

function positive(value: number | null | undefined): number {
  if (value == null || !Number.isFinite(value) || value <= 0) return 0;
  return value;
}

function round(value: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) return sorted[middle];
  return (sorted[middle - 1] + sorted[middle]) / 2;
}

function estimatedActiveSeconds(day: TrekDayInput): number {
  const distanceKm = positive(day.distanceM) / 1000;
  return Math.max(
    1,
    Math.round(
      (distanceKm / TREK_FLAT_SPEED_KMH +
        positive(day.gainM) / TREK_ASCENT_SPEED_M_PER_HOUR +
        positive(day.lossM) / TREK_DESCENT_SPEED_M_PER_HOUR) *
        3600
    )
  );
}

function loadScoreFor(day: TrekDayInput): number {
  const fatigue = computeFatigue({
    activeDurationS: estimatedActiveSeconds(day),
    gainM: positive(day.gainM),
    lossM: positive(day.lossM),
    technicalClass: day.technicalClass ?? null,
    packWeightKg: day.packWeightKg,
  });
  return round(fatigue.score, 2);
}

function isShortDay(day: TrekDayInput, medianDistanceM: number): boolean {
  if (!(medianDistanceM > 0)) return false;
  return positive(day.distanceM) < medianDistanceM * SHORT_DAY_MEDIAN_RATIO;
}

function nextCapacity(
  capacityPct: number,
  loadScore: number,
  day: TrekDayInput,
  isShort: boolean,
  recoveryPerNight: number
): number {
  let recovery = recoveryPerNight;
  const sleepQuality = day.sleepQuality;
  if (
    sleepQuality != null &&
    Number.isFinite(sleepQuality) &&
    sleepQuality < SHORT_SLEEP_QUALITY_THRESHOLD
  ) {
    recovery *= SHORT_SLEEP_RECOVERY_FACTOR;
  }
  if (isShort) recovery *= SHORT_DAY_RECOVERY_BONUS;

  const depletion = loadScore * DEPLETION_RATE;
  return clamp(capacityPct - depletion + recovery, 0, 100);
}

function buildAdjustments(
  day: TrekDayInput,
  difficulty: number,
  driftRisk: number,
  heavyPackKg: number
): TrekAdjustment[] {
  const adjustments: TrekAdjustment[] = [];

  if (difficulty > DIFFICULTY_ALERT_THRESHOLD) {
    adjustments.push({
      kind: 'shorten',
      label: 'Raccourcir l’étape',
      reason: `Difficulté estimée ${difficulty}/100 — réduire le kilométrage protège le rythme du groupe.`,
    });
    if (day.packWeightKg != null && day.packWeightKg > heavyPackKg) {
      adjustments.push({
        kind: 'transfer_gear',
        label: 'Répartir le portage',
        reason: `Portage de ${day.packWeightKg} kg supérieur au seuil de ${heavyPackKg} kg — alléger le sac réduit la charge.`,
      });
    }
    if (positive(day.gainM) >= 1000) {
      adjustments.push({
        kind: 'move_km',
        label: 'Déplacer des kilomètres',
        reason: `Dénivelé positif de ${positive(day.gainM)} m — basculer une partie de l’étape vers un terrain plus doux.`,
      });
    }
  }

  if (driftRisk > DRIFT_ALERT_THRESHOLD) {
    adjustments.push({
      kind: 'recovery_day',
      label: 'Insérer une journée de récupération',
      reason: `Dérive cumulée ${(driftRisk * 100).toFixed(0)} % — la capacité ne se reconstitue plus assez entre les étapes.`,
    });
    adjustments.push({
      kind: 'add_night',
      label: 'Ajouter une nuit',
      reason: 'Allonger le repos nocturne pour enrayer la dérive cumulée.',
    });
  }

  const sleepQuality = day.sleepQuality;
  if (
    sleepQuality != null &&
    Number.isFinite(sleepQuality) &&
    sleepQuality < SHORT_SLEEP_QUALITY_THRESHOLD
  ) {
    adjustments.push({
      kind: 'change_refuge',
      label: 'Changer de refuge',
      reason: `Qualité de nuit ${sleepQuality} — viser un hébergement plus calme pour restaurer la capacité.`,
    });
  }

  return adjustments;
}

/**
 * Simule un trek multi-jours : capacité au départ de chaque journée, charge,
 * difficulté, dérive cumulée et ajustements proposés. `worstDay` est la
 * journée de difficulté maximale (première en cas d'égalité).
 */
export function simulateMultiDayTrek(
  days: TrekDayInput[],
  options: MultiDayTrekOptions = {}
): MultiDayTrekResult {
  if (days.length === 0) {
    return { daily: [], worstDay: 0, totalDriftRisk: 0 };
  }

  const initialCapacityPct = clamp(
    options.initialCapacityPct ?? DEFAULT_INITIAL_CAPACITY_PCT,
    0,
    100
  );
  const recoveryPerNight = Math.max(0, options.recoveryPerNight ?? DEFAULT_RECOVERY_PER_NIGHT);
  const heavyPackKg = Math.max(0, options.heavyPackKg ?? DEFAULT_HEAVY_PACK_KG);
  const medianDistanceM = median(days.map((day) => positive(day.distanceM)));

  const daily: TrekDayResult[] = [];
  let capacityPct = initialCapacityPct;

  for (const day of days) {
    const loadScore = loadScoreFor(day);
    const difficulty = clamp(Math.round(loadScore * (2 - capacityPct / 100)), 0, 100);
    const driftRisk = round(clamp01((initialCapacityPct - capacityPct) / 100), 4);
    const adjustments = buildAdjustments(day, difficulty, driftRisk, heavyPackKg);

    daily.push({ dayNumber: day.dayNumber, capacityPct, loadScore, difficulty, driftRisk, adjustments });

    capacityPct = nextCapacity(
      capacityPct,
      loadScore,
      day,
      isShortDay(day, medianDistanceM),
      recoveryPerNight
    );
  }

  let worstDay = daily[0].dayNumber;
  let worstDifficulty = daily[0].difficulty;
  for (const entry of daily) {
    if (entry.difficulty > worstDifficulty) {
      worstDifficulty = entry.difficulty;
      worstDay = entry.dayNumber;
    }
  }

  const totalDriftRisk = Math.max(...daily.map((entry) => entry.driftRisk));

  return { daily, worstDay, totalDriftRisk };
}
