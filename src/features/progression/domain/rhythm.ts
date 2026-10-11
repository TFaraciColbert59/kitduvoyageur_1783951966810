/**
 * T16 — Rythme choisi (économie §Constance).
 *
 * Un objectif hebdomadaire FACULTATIF, en nombre de réalisations vérifiées,
 * et une pause libre. Règles :
 *   • aucune obligation quotidienne, aucune série, aucune pénalité ;
 *   • la pause ne retire ni XP, ni mission, ni distinction ;
 *   • la progression d'objectif est une présentation, jamais une source de
 *     crédit (0 XP de fin d'objectif) ;
 *   • semaine = ISO UTC, comme le moteur d'attribution.
 */

export type WeeklyRhythmId = 'leger' | 'regulier' | 'intense';

export interface WeeklyRhythmOption {
  id: WeeklyRhythmId;
  label: string;
  description: string;
  weeklyTarget: number;
}

export const WEEKLY_RHYTHM_OPTIONS: readonly WeeklyRhythmOption[] = [
  {
    id: 'leger',
    label: 'Rythme léger',
    description: 'Une réalisation par semaine, sans pression.',
    weeklyTarget: 1,
  },
  {
    id: 'regulier',
    label: 'Rythme régulier',
    description: 'Deux réalisations par semaine.',
    weeklyTarget: 2,
  },
  {
    id: 'intense',
    label: 'Rythme soutenu',
    description: 'Trois réalisations par semaine, jamais une obligation.',
    weeklyTarget: 3,
  },
] as const;

export interface ProgressionRhythmPreference {
  rhythmId: WeeklyRhythmId | null;
  paused: boolean;
}

export const RHYTHM_DEFAULT: ProgressionRhythmPreference = { rhythmId: null, paused: false };

export function rhythmTarget(rhythmId: WeeklyRhythmId | null): number | null {
  if (rhythmId === null) return null;
  return WEEKLY_RHYTHM_OPTIONS.find((option) => option.id === rhythmId)?.weeklyTarget ?? null;
}

/** Clé de semaine ISO UTC (ex. « 2026-W41 ») — même base que le moteur. */
export function isoWeekKeyUtc(date: Date): string {
  const target = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const dayNumber = (target.getUTCDay() + 6) % 7; // lundi = 0
  target.setUTCDate(target.getUTCDate() - dayNumber + 3); // jeudi ISO
  const firstThursday = new Date(Date.UTC(target.getUTCFullYear(), 0, 4));
  const firstDayNumber = (firstThursday.getUTCDay() + 6) % 7;
  firstThursday.setUTCDate(firstThursday.getUTCDate() - firstDayNumber + 3);
  const week = 1 + Math.round((target.getTime() - firstThursday.getTime()) / (7 * 24 * 3600 * 1000));
  return `${target.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}

export interface WeeklyRhythmProgress {
  target: number | null;
  done: number;
  atGoal: boolean;
  /** Pause : l'objectif est simplement masqué, jamais sanctionné. */
  paused: boolean;
}

/**
 * Progression hebdomadaire de l'objectif personnel : les réalisations de la
 * semaine ISO UTC courante, bornées visuellement à la cible. Aucun crédit,
 * aucune série, aucune pénalité quand la cible n'est pas atteinte.
 */
export function computeWeeklyRhythmProgress(
  preference: ProgressionRhythmPreference,
  realizationDates: readonly string[],
  now: Date = new Date()
): WeeklyRhythmProgress {
  const target = rhythmTarget(preference.rhythmId);
  if (preference.paused || target === null) {
    return { target, done: 0, atGoal: false, paused: preference.paused };
  }
  const currentWeek = isoWeekKeyUtc(now);
  let done = 0;
  for (const value of realizationDates) {
    const parsed = new Date(value);
    if (!Number.isFinite(parsed.getTime())) continue;
    if (isoWeekKeyUtc(parsed) === currentWeek) done += 1;
  }
  return { target, done: Math.min(done, target), atGoal: done >= target, paused: false };
}
