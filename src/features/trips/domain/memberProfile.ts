/**
 * Dérivation du profil membre par activité (Task 16) — moteur pur, sans I/O.
 *
 * Hiérarchie de provenance : `learned` (profil performance calibré au moins
 * `contextualization`) > `estimated` (orientation déclarée, portage dérivé
 * d'une base poids moyenne) > `average` (défauts population).
 *
 * Contraintes dures :
 *  - Rien n'est `learned` hors du profil performance calibré.
 *  - Aucune donnée de santé ni poids réel : la base de portage est une moyenne
 *    population (70 kg), jamais un poids personnel.
 *  - `sources` couvre chaque champ dérivé.
 */
import { CALIBRATION_LEVELS } from '@/features/adventure-intelligence/schemas/performance.schema';

export type FieldSource = 'learned' | 'estimated' | 'average';

export type ExperienceLevel = 'beginner' | 'intermediate' | 'advanced' | 'expert';

export interface MemberPerformanceProfileRaw {
  flat_speed_kmh?: number | null;
  ascent_speed_m_per_h?: number | null;
  descent_speed_m_per_h?: number | null;
  calibration_level?: string | null;
  sample_count?: number | null;
}

export interface MemberOrientationRaw {
  experience?: string | null;
  terrain?: string | null;
  autonomy?: string | null;
}

export interface MemberRawData {
  performanceProfile?: MemberPerformanceProfileRaw | null;
  orientation?: MemberOrientationRaw | null;
  isChild?: boolean;
}

export interface DerivedMemberInput {
  flatSpeedKmH: number;
  ascentSpeedMPerHour: number;
  descentSpeedMPerHour: number;
  packWeightKg: number | null;
  maxCarryKg: number | null;
  experienceLevel: ExperienceLevel;
  limitations: string | null;
  isChild: boolean;
  sources: Record<string, FieldSource>;
}

/** Défauts population (randonnée) quand aucune donnée exploitable. */
export const DEFAULT_FLAT_SPEED_KMH = 4;
export const DEFAULT_ASCENT_SPEED_M_PER_HOUR = 300;
export const DEFAULT_DESCENT_SPEED_M_PER_HOUR = 500;
export const DEFAULT_EXPERIENCE_LEVEL: ExperienceLevel = 'intermediate';

/** Base de portage : poids corporel moyen de référence, jamais un poids réel. */
export const AVERAGE_BODY_WEIGHT_KG = 70;
export const PACK_WEIGHT_RATIO = 0.18;
export const MAX_CARRY_RATIO = 0.2;

/**
 * Niveau de calibration minimal pour exploiter le profil appris (cf.
 * `performanceProfile.ts` : seuils cold < calibration < personalization ≤ 20
 * < contextualization).
 */
export const LEARNED_MIN_CALIBRATION_LEVEL = 'contextualization';

const EXPERIENCE_MAP: Record<string, ExperienceLevel> = {
  debut: 'beginner',
  debutant: 'beginner',
  beginner: 'beginner',
  regulier: 'intermediate',
  intermediaire: 'intermediate',
  intermediate: 'intermediate',
  aguerri: 'advanced',
  avance: 'advanced',
  advanced: 'advanced',
  expert: 'expert',
};

/** Nombre fini strictement positif, sinon `null` (vitesse apprise exploitable). */
function learnedPositive(value: number | null | undefined): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : null;
}

/** Nombre fini positif ou nul, sinon `null` (vitesse ascension/descente). */
function learnedNonNegative(value: number | null | undefined): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null;
}

/** Le profil appris n'est utilisable qu'à partir de `contextualization`. */
function isLearnedCalibration(level: string | null | undefined): boolean {
  if (typeof level !== 'string') return false;
  const normalized = level.trim().toLowerCase();
  const rank = CALIBRATION_LEVELS.indexOf(normalized as (typeof CALIBRATION_LEVELS)[number]);
  return rank >= CALIBRATION_LEVELS.indexOf(LEARNED_MIN_CALIBRATION_LEVEL);
}

/** Normalise une valeur d'orientation (accents/espaces/casse) pour le mapping. */
function normalizeToken(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

/** Expérience déclarée → niveau, sinon `null` (défaut moyenne appliqué plus loin). */
function mapExperience(value: string | null | undefined): ExperienceLevel | null {
  if (typeof value !== 'string') return null;
  const normalized = normalizeToken(value);
  if (normalized === '') return null;
  return EXPERIENCE_MAP[normalized] ?? null;
}

/** L'orientation porte un signal exploitable (au moins une valeur non vide). */
function hasOrientationSignal(orientation: MemberOrientationRaw | null): boolean {
  if (!orientation) return false;
  return [orientation.experience, orientation.terrain, orientation.autonomy].some(
    (value) => typeof value === 'string' && value.trim() !== ''
  );
}

function roundToOneDecimal(value: number): number {
  return Math.round(value * 10) / 10;
}

/**
 * Dérive l'entrée membre depuis des données brutes (profil appris + orientation).
 * Le portage n'est pas inversible depuis `pack_response` (courbe de vitesse
 * relative, pas un poids) : on retombe sur 18 % / 20 % d'une base moyenne 70 kg.
 */
export function deriveMemberInput(raw: MemberRawData): DerivedMemberInput {
  const profile = raw.performanceProfile ?? null;
  const calibrated = isLearnedCalibration(profile?.calibration_level);

  const learnedFlat = calibrated ? learnedPositive(profile?.flat_speed_kmh) : null;
  const learnedAscent = calibrated ? learnedNonNegative(profile?.ascent_speed_m_per_h) : null;
  const learnedDescent = calibrated ? learnedNonNegative(profile?.descent_speed_m_per_h) : null;

  const flatSpeedKmH = learnedFlat ?? DEFAULT_FLAT_SPEED_KMH;
  const ascentSpeedMPerHour = learnedAscent ?? DEFAULT_ASCENT_SPEED_M_PER_HOUR;
  const descentSpeedMPerHour = learnedDescent ?? DEFAULT_DESCENT_SPEED_M_PER_HOUR;

  const orientation = raw.orientation ?? null;
  const orientationSignal = hasOrientationSignal(orientation);
  const mappedExperience = mapExperience(orientation?.experience);
  const experienceLevel = mappedExperience ?? DEFAULT_EXPERIENCE_LEVEL;

  const packWeightKg = roundToOneDecimal(AVERAGE_BODY_WEIGHT_KG * PACK_WEIGHT_RATIO);
  const maxCarryKg = roundToOneDecimal(AVERAGE_BODY_WEIGHT_KG * MAX_CARRY_RATIO);

  const isChild = raw.isChild === true;

  const sources: Record<string, FieldSource> = {
    flatSpeedKmH: learnedFlat !== null ? 'learned' : 'average',
    ascentSpeedMPerHour: learnedAscent !== null ? 'learned' : 'average',
    descentSpeedMPerHour: learnedDescent !== null ? 'learned' : 'average',
    packWeightKg: orientationSignal ? 'estimated' : 'average',
    maxCarryKg: orientationSignal ? 'estimated' : 'average',
    experienceLevel: mappedExperience !== null ? 'estimated' : 'average',
    limitations: 'average',
    isChild: typeof raw.isChild === 'boolean' ? 'estimated' : 'average',
  };

  return {
    flatSpeedKmH,
    ascentSpeedMPerHour,
    descentSpeedMPerHour,
    packWeightKg,
    maxCarryKg,
    experienceLevel,
    limitations: null,
    isChild,
    sources,
  };
}
