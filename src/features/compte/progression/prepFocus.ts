/**
 * Focus d'entraînement & préparation d'échéance (A05 · S2.20, relié à A06).
 */

export type PrepDiscipline = 'course' | 'trail' | 'velo' | 'rando' | 'all';

export type PrepFocusObjective =
  | 'endurance'
  | 'vitesse'
  | 'denivele'
  | 'recuperation'
  | 'polyvalent';

export interface PrepFocusConfig {
  title: string;
  discipline: PrepDiscipline;
  focus: PrepFocusObjective;
  targetDate: string | null;
  weeklySessionsTarget: number;
  updatedAt: string;
}

const STORAGE_PREFIX = 'lkdv.progression.prepFocus.v1:';

export const PREP_FOCUS_OPTIONS: ReadonlyArray<{
  id: PrepFocusObjective;
  label: string;
  hint: string;
}> = [
  { id: 'endurance', label: 'Endurance & volume', hint: 'Privilégie les sorties longues en Z2' },
  { id: 'vitesse', label: 'Seuil & vitesse', hint: 'Met l’accent sur les intervalles et le tempo' },
  { id: 'denivele', label: 'Dénivelé & montagne', hint: 'Priorise côtes, force et gestion de pente' },
  { id: 'recuperation', label: 'Récupération & régularité', hint: 'Allège la charge et favorise la fraîcheur' },
  { id: 'polyvalent', label: 'Équilibre général', hint: 'Alternance endurance, intensité et renfo' },
];

export function readPrepFocus(accountKey = 'anonymous'): PrepFocusConfig | null {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return null;
    const raw = window.localStorage.getItem(`${STORAGE_PREFIX}${accountKey}`);
    if (!raw) return null;
    return JSON.parse(raw) as PrepFocusConfig;
  } catch {
    return null;
  }
}

export function savePrepFocus(
  accountKey: string,
  config: Omit<PrepFocusConfig, 'updatedAt'>
): PrepFocusConfig {
  const next: PrepFocusConfig = {
    ...config,
    updatedAt: new Date().toISOString(),
  };
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(`${STORAGE_PREFIX}${accountKey}`, JSON.stringify(next));
    }
  } catch {
    /* ignore */
  }
  return next;
}

export function clearPrepFocus(accountKey = 'anonymous'): void {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.removeItem(`${STORAGE_PREFIX}${accountKey}`);
    }
  } catch {
    /* ignore */
  }
}

export function daysUntilTargetDate(targetDate: string | null, now = new Date()): number | null {
  if (!targetDate) return null;
  const targetMs = Date.parse(`${targetDate}T12:00:00Z`);
  if (Number.isNaN(targetMs)) return null;
  return Math.ceil((targetMs - now.getTime()) / 86_400_000);
}
