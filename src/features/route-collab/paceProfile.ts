import type { PaceMember } from './insights/pace';

/**
 * Profil de performance → allure de l'itinéraire (10.8). Module pur, testé.
 *
 * Source : `user_performance_profiles` (profil terrain appris des sorties terminées, avec consentement,
 * lecture propriétaire seulement). Règle « rien d'inventé » : un profil « à froid » (`calibration_level =
 * cold`) ou sans échantillon est le profil neutre par défaut, PAS une mesure : il n'est pas utilisé et
 * l'itinéraire garde l'allure par défaut (ou celle que la personne renseigne).
 */
export interface PaceProfileRow {
  readonly flat_speed_kmh: number | string | null;
  readonly ascent_speed_m_per_h: number | string | null;
  readonly calibration_level: string | null;
  readonly sample_count: number | string | null;
}

export interface UserPaceProfile {
  readonly flatSpeedKmh: number;
  readonly ascentMPerHour: number | null;
  readonly calibrationLevel: 'calibration' | 'personalization' | 'contextualization';
  readonly sampleCount: number;
}

const num = (v: unknown): number | null => {
  const n = typeof v === 'string' && v.trim() === '' ? NaN : Number(v);
  return Number.isFinite(n) ? n : null;
};

export function paceProfileFromRow(row: PaceProfileRow | null | undefined): UserPaceProfile | null {
  if (!row) return null;
  const level = row.calibration_level;
  if (level !== 'calibration' && level !== 'personalization' && level !== 'contextualization') return null;
  const samples = num(row.sample_count);
  const flat = num(row.flat_speed_kmh);
  if (samples == null || samples < 1 || flat == null || flat <= 0 || flat > 30) return null;
  const ascent = num(row.ascent_speed_m_per_h);
  return {
    flatSpeedKmh: Math.round(flat * 10) / 10,
    ascentMPerHour: ascent != null && ascent > 0 && ascent <= 2000 ? Math.round(ascent) : null,
    calibrationLevel: level,
    sampleCount: Math.trunc(samples),
  };
}

/** Membre d'allure pour `paceOf` / `groupPace` (la vitesse en plat et la montée apprises). */
export function paceMemberFromProfile(id: string, name: string, profile: UserPaceProfile): PaceMember {
  return { id, name, speedKmh: profile.flatSpeedKmh, ascentMPerHour: profile.ascentMPerHour, origin: 'profile', sampleCount: profile.sampleCount };
}
