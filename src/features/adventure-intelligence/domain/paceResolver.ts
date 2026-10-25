/**
 * A3 — Résolution d'allure : profil → générique → standard (moteur pur).
 *
 * Cascade explicite et sûre :
 * - `profile` : flag actif + profil non froid + confiance ≥ 0.5 ;
 * - `generic` : des données de profil existent (même froides/incertaines) ;
 * - `standard` : aucun profil, allure historique 15 min/km.
 * Le flag désactivé interdit le niveau personnalisé mais conserve le repli sûr.
 */
import {
  COLD_CONFIDENCE,
  MEDIUM_CONFIDENCE_THRESHOLD,
  type Confidence,
} from './confidence';
import type { PerformanceProfile } from '../schemas/performance.schema';

/** Allure standard historique (15 min/km) — défaut rétrocompatible. */
export const STANDARD_PACE_MIN_PER_KM = 15;
/** Allure générique (population) utilisée quand un profil existe mais reste froid. */
export const GENERIC_PACE_MIN_PER_KM = 13.5;

/** Majoration de pente : min/km par 100 m de D+ par km. */
export const PROFILE_ASCENT_MIN_PER_100M_PER_KM = 1;
export const GENERIC_ASCENT_MIN_PER_100M_PER_KM = 0.8;
/** Majoration d'une descente technique (surface rocheuse/raide). */
export const TECHNICAL_DESCENT_MIN_PER_KM = 0.4;

const TECHNICAL_DESCENT_SURFACES = [
  'rock',
  'scree',
  'stone',
  'boulder',
  'steps',
  'via',
  'cable',
] as const;

export interface ResolvedPace {
  paceMinPerKm: number;
  source: 'profile' | 'generic' | 'standard';
  personalized: boolean;
  confidence: Confidence;
}

export interface ResolvePaceInput {
  distanceM: number;
  gainM: number;
  lossM: number;
  surface?: string | null;
  profile?: PerformanceProfile | null;
  confidence?: Confidence | null;
  flagEnabled: boolean;
}

function isTechnicalDescentSurface(surface: string | null | undefined): boolean {
  if (!surface) return false;
  const key = surface.toLowerCase();
  return TECHNICAL_DESCENT_SURFACES.some((token) => key.includes(token));
}

export function resolvePace(input: ResolvePaceInput): ResolvedPace {
  const profile = input.profile ?? null;
  const confidence = input.confidence ?? profile?.confidence ?? COLD_CONFIDENCE;

  const usableProfile =
    input.flagEnabled &&
    profile !== null &&
    profile.calibrationLevel !== 'cold' &&
    confidence.score >= MEDIUM_CONFIDENCE_THRESHOLD;

  let source: ResolvedPace['source'];
  let basePaceMinPerKm: number;
  let ascentFactor: number;

  if (usableProfile && profile) {
    source = 'profile';
    basePaceMinPerKm =
      profile.flatSpeedKmH > 0 ? 60 / profile.flatSpeedKmH : STANDARD_PACE_MIN_PER_KM;
    ascentFactor = PROFILE_ASCENT_MIN_PER_100M_PER_KM;
  } else if (profile !== null) {
    source = 'generic';
    basePaceMinPerKm = GENERIC_PACE_MIN_PER_KM;
    ascentFactor = GENERIC_ASCENT_MIN_PER_100M_PER_KM;
  } else {
    source = 'standard';
    basePaceMinPerKm = STANDARD_PACE_MIN_PER_KM;
    ascentFactor = GENERIC_ASCENT_MIN_PER_100M_PER_KM;
  }

  const distanceKm = Math.max(0, Number.isFinite(input.distanceM) ? input.distanceM : 0) / 1000;
  const gainM = Math.max(0, Number.isFinite(input.gainM) ? input.gainM : 0);
  const lossM = Math.max(0, Number.isFinite(input.lossM) ? input.lossM : 0);
  const ascentPer100mPerKm = distanceKm > 0 ? gainM / distanceKm / 100 : 0;
  const technicalDescent = lossM > 0 && isTechnicalDescentSurface(input.surface);

  const paceMinPerKm =
    basePaceMinPerKm +
    ascentPer100mPerKm * ascentFactor +
    (technicalDescent ? TECHNICAL_DESCENT_MIN_PER_KM : 0);

  return {
    paceMinPerKm: Math.round(paceMinPerKm * 1000) / 1000,
    source,
    personalized: source === 'profile',
    confidence,
  };
}
