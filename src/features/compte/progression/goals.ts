/**
 * Objectifs personnels chiffrés — calculs purs, sans réseau ni persistance.
 *
 * S2.19 : un objectif privé porte sur une période récurrente (semaine, mois ou
 * année), un sport facultatif et une seule grandeur réellement enregistrée par
 * les séances (`distance_km`, `duration_s`, `elevation_gain_m`, nombre de
 * séances). Il n'attribue ni XP, ni série, ni distinction : la progression est
 * une présentation, jamais une source de crédit.
 *
 * Règles de mesure :
 *   - seules les séances terminées sont comptées ;
 *   - une valeur absente reste absente (aucun zéro inventé) ;
 *   - un sport inconnu n'est jamais attribué à un objectif de sport ;
 *   - une période est découpée dans le fuseau choisi par la personne.
 *
 * La puissance et les segments ne figurent pas dans les grandeurs proposées :
 * aucune mesure de puissance n'est collectée, et les passages de segment ne
 * sont pas exposés au bootstrap du Compte. Voir
 * `docs/compte/A05-S2.19-OBJECTIFS.md`.
 */

import {
  addDaysToKey,
  formatDuration,
  isDone,
  localDateKey,
  monthLabel,
  shortDateLabel,
  sportLabel,
  startOfWeekKey,
  todayKey,
  type ProgressionSession,
} from './engine';

export type GoalPeriod = 'week' | 'month' | 'year';

export type GoalMetric = 'distance_km' | 'duration_s' | 'elevation_gain_m' | 'sessions';

export interface GoalPeriodOption {
  id: GoalPeriod;
  label: string;
}

export interface GoalMetricOption {
  id: GoalMetric;
  label: string;
  /** Unité canonique stockée en base. */
  unit: string;
  /** Unité saisie dans le formulaire (`h` pour une durée, sinon l'unité). */
  inputUnit: string;
  /** Pas de saisie dans l'unité du formulaire. */
  step: number;
  /** Cible proposée à la création, dans l'unité du formulaire. */
  suggestedTarget: Readonly<Record<GoalPeriod, number>>;
}

export interface ProgressionGoal {
  id: string;
  period: GoalPeriod;
  /** `null` = tous les sports. */
  sport: string | null;
  metric: GoalMetric;
  /** Cible canonique : km, secondes, mètres ou nombre de séances. */
  target: number;
  createdAt: string | null;
  updatedAt: string | null;
}

export interface ProgressionGoalRow {
  id: string;
  period: string;
  sport?: string | null;
  metric: string;
  target: number | string;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface GoalPeriodRange {
  startKey: string;
  endKey: string;
  label: string;
}

export interface GoalProgress {
  goal: ProgressionGoal;
  range: GoalPeriodRange;
  /** Valeur mesurée sur la période, dans l'unité canonique. */
  value: number;
  /** Nombre de séances éligibles portant une valeur exploitable. */
  measuredSessions: number;
  /** Nombre de séances éligibles sans la valeur demandée. */
  missingSessions: number;
  /** Séances éligibles sans sport connu, exclues d'un objectif de sport. */
  unknownSportSessions: number;
  /** Faux si la grandeur n'a aucune mesure : l'UI affiche « — ». */
  available: boolean;
  target: number;
  ratio: number;
  atGoal: boolean;
  remaining: number | null;
}

export const GOAL_PERIODS: readonly GoalPeriodOption[] = [
  { id: 'week', label: 'Semaine' },
  { id: 'month', label: 'Mois' },
  { id: 'year', label: 'Année' },
] as const;

export const GOAL_METRICS: readonly GoalMetricOption[] = [
  {
    id: 'distance_km',
    label: 'Distance',
    unit: 'km',
    inputUnit: 'km',
    step: 0.1,
    suggestedTarget: { week: 10, month: 40, year: 400 },
  },
  {
    id: 'elevation_gain_m',
    label: 'Dénivelé positif',
    unit: 'm',
    inputUnit: 'm',
    step: 10,
    suggestedTarget: { week: 500, month: 2_000, year: 15_000 },
  },
  {
    id: 'duration_s',
    label: 'Temps enregistré',
    unit: 's',
    inputUnit: 'h',
    step: 0.1,
    suggestedTarget: { week: 2, month: 8, year: 80 },
  },
  {
    id: 'sessions',
    label: 'Séances',
    unit: 'sorties',
    inputUnit: 'sorties',
    step: 1,
    suggestedTarget: { week: 1, month: 4, year: 30 },
  },
] as const;

const GOAL_PERIOD_IDS = new Set<GoalPeriod>(GOAL_PERIODS.map((option) => option.id));
const GOAL_METRIC_IDS = new Set<GoalMetric>(GOAL_METRICS.map((option) => option.id));

export function isGoalPeriod(value: unknown): value is GoalPeriod {
  return typeof value === 'string' && GOAL_PERIOD_IDS.has(value as GoalPeriod);
}

export function isGoalMetric(value: unknown): value is GoalMetric {
  return typeof value === 'string' && GOAL_METRIC_IDS.has(value as GoalMetric);
}

export function goalPeriodOption(period: GoalPeriod): GoalPeriodOption {
  return GOAL_PERIODS.find((option) => option.id === period) ?? GOAL_PERIODS[0];
}

export function goalMetricOption(metric: GoalMetric): GoalMetricOption {
  return GOAL_METRICS.find((option) => option.id === metric) ?? GOAL_METRICS[0];
}

/**
 * Bornes civiles de la période courante, dans le fuseau demandé. Une semaine
 * commence le lundi, comme le calendrier S2.17 ; le mois et l'année sont des
 * périodes calendaires, pas des fenêtres glissantes.
 */
export function goalPeriodRange(
  period: GoalPeriod,
  timeZone: string,
  now: Date = new Date()
): GoalPeriodRange {
  const today = todayKey(timeZone, now);
  if (period === 'week') {
    const startKey = startOfWeekKey(today);
    const endKey = addDaysToKey(startKey, 6);
    return {
      startKey,
      endKey,
      label: `Semaine du ${shortDateLabel(startKey)} au ${shortDateLabel(endKey)}`,
    };
  }
  if (period === 'month') {
    const monthKey = today.slice(0, 7);
    const [year, month] = monthKey.split('-').map(Number);
    const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
    const startKey = `${monthKey}-01`;
    const endKey = `${monthKey}-${String(lastDay).padStart(2, '0')}`;
    return {
      startKey,
      endKey,
      label: monthLabel(monthKey),
    };
  }
  const year = today.slice(0, 4);
  return {
    startKey: `${year}-01-01`,
    endKey: `${year}-12-31`,
    label: `Année ${year}`,
  };
}

function metricValue(session: ProgressionSession, metric: GoalMetric): number | null {
  if (metric === 'distance_km') return session.km;
  if (metric === 'duration_s') return session.durationS;
  return session.dplus;
}

/**
 * Progression d'un objectif sur sa période courante. Une séance non terminée
 * est exclue ; une valeur absente est comptée comme manquante et n'entre pas
 * dans la somme. Pour « séances », zéro est une mesure réelle : aucune séance
 * terminée n'est pas une donnée indisponible.
 */
export function computeGoalProgress(
  goal: ProgressionGoal,
  sessions: readonly ProgressionSession[],
  timeZone: string,
  now: Date = new Date()
): GoalProgress {
  const range = goalPeriodRange(goal.period, timeZone, now);
  const nowMs = now.getTime();
  const eligible = sessions.filter((session) => {
    if (!isDone(session, nowMs)) return false;
    const key = localDateKey(session.startedAt, timeZone);
    return key !== null && key >= range.startKey && key <= range.endKey;
  });
  const matching =
    goal.sport === null ? eligible : eligible.filter((session) => session.sport === goal.sport);
  const unknownSportSessions =
    goal.sport === null
      ? 0
      : eligible.filter((session) => session.sport === null).length;

  let value = 0;
  let measuredSessions = 0;
  let missingSessions = 0;

  if (goal.metric === 'sessions') {
    value = matching.length;
    measuredSessions = matching.length;
  } else {
    for (const session of matching) {
      const candidate = metricValue(session, goal.metric);
      if (candidate === null || !Number.isFinite(candidate)) {
        missingSessions += 1;
        continue;
      }
      value += candidate;
      measuredSessions += 1;
    }
  }

  const available = goal.metric === 'sessions' || measuredSessions > 0;
  const target = goal.target;
  const ratio = available && target > 0 ? Math.min(1, Math.max(0, value / target)) : 0;
  const atGoal = available && target > 0 && value >= target;
  return {
    goal,
    range,
    value,
    measuredSessions,
    missingSessions,
    unknownSportSessions,
    available,
    target,
    ratio,
    atGoal,
    remaining: available ? Math.max(0, Math.round((target - value) * 100) / 100) : null,
  };
}

/** Cible formatée dans l'unité de la grandeur, sans jamais inventer de valeur. */
export function formatGoalTarget(target: number, metric: GoalMetric): string {
  if (!Number.isFinite(target) || target < 0) return '—';
  if (metric === 'duration_s') return formatDuration(target);
  if (metric === 'sessions') {
    return `${Math.round(target).toLocaleString('fr-FR')} sortie${Math.round(target) > 1 ? 's' : ''}`;
  }
  if (metric === 'elevation_gain_m') {
    return `+${Math.round(target).toLocaleString('fr-FR')} m`;
  }
  return `${new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 1 }).format(target)} km`;
}

/** Valeur réellement mesurée, formatée ; `null` affiche « — ». */
export function formatGoalValue(
  value: number | null,
  metric: GoalMetric,
  available: boolean
): string {
  if (!available || value === null || !Number.isFinite(value)) return '—';
  if (metric === 'duration_s') return formatDuration(value);
  if (metric === 'sessions') {
    return `${Math.round(value).toLocaleString('fr-FR')} sortie${Math.round(value) > 1 ? 's' : ''}`;
  }
  if (metric === 'elevation_gain_m') {
    return `+${Math.round(value).toLocaleString('fr-FR')} m`;
  }
  return `${new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 1 }).format(value)} km`;
}

export function goalSportLabel(goal: ProgressionGoal): string {
  return goal.sport === null ? 'Tous sports' : sportLabel(goal.sport);
}

/**
 * Convertit la saisie du formulaire vers l'unité canonique. La durée est
 * saisie en heures et stockée en secondes. Une saisie invalide reste `null` :
 * aucune cible par défaut n'est substituée.
 */
export function parseGoalTargetInput(metric: GoalMetric, raw: string): number | null {
  const normalized = raw.trim().replace(',', '.');
  if (!normalized) return null;
  const input = Number(normalized);
  if (!Number.isFinite(input) || input <= 0) return null;

  let canonical = input;
  if (metric === 'duration_s') canonical = Math.round(input * 3_600);
  if (metric === 'sessions') {
    if (!Number.isInteger(input)) return null;
    canonical = input;
  }
  if (!Number.isFinite(canonical) || canonical <= 0) return null;
  if (canonical > 10_000_000) return null;
  return canonical;
}

/** Valeur à préremplir dans le formulaire de modification. */
export function goalTargetInput(goal: ProgressionGoal): string {
  if (goal.metric === 'duration_s') {
    return String(Math.round((goal.target / 3_600) * 100) / 100);
  }
  return String(goal.target);
}

export function suggestedGoalTarget(period: GoalPeriod, metric: GoalMetric): string {
  return String(goalMetricOption(metric).suggestedTarget[period]);
}

/**
 * Normalise une ligne PostgREST. Une ligne illisible est ignorée, jamais
 * convertie en objectif par défaut.
 */
export function mapProgressionGoalRow(row: ProgressionGoalRow): ProgressionGoal | null {
  if (!row || typeof row.id !== 'string' || !row.id) return null;
  if (!isGoalPeriod(row.period) || !isGoalMetric(row.metric)) return null;
  const target = Number(row.target);
  if (!Number.isFinite(target) || target <= 0) return null;
  const sport =
    typeof row.sport === 'string' && row.sport.trim() ? row.sport.trim() : null;
  return {
    id: row.id,
    period: row.period,
    sport,
    metric: row.metric,
    target,
    createdAt: row.created_at ?? null,
    updatedAt: row.updated_at ?? null,
  };
}

const PERIOD_ORDER: Record<GoalPeriod, number> = { week: 0, month: 1, year: 2 };

export function sortProgressionGoals(goals: readonly ProgressionGoal[]): ProgressionGoal[] {
  return [...goals].sort((left, right) => {
    const byPeriod = PERIOD_ORDER[left.period] - PERIOD_ORDER[right.period];
    if (byPeriod !== 0) return byPeriod;
    const bySport = (left.sport ?? '').localeCompare(right.sport ?? '');
    if (bySport !== 0) return bySport;
    return left.metric.localeCompare(right.metric);
  });
}

export function mapProgressionGoalRows(rows: readonly ProgressionGoalRow[]): ProgressionGoal[] {
  return sortProgressionGoals(
    rows.map(mapProgressionGoalRow).filter((goal): goal is ProgressionGoal => goal !== null)
  );
}
