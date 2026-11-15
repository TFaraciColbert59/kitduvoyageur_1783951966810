import { buildTrainingPlan } from './plans';
import { assertPlanRequest, goalLabel, LEVEL_LABELS } from './validation';
import {
  WORKOUT_CONTRACT_VERSION,
  type HistoryStatus,
  type PracticeHistory,
  type SessionIntent,
  type StructuredSession,
  type WeeklyProposal,
  type WeeklyProposalInput,
  type WorkoutGoal,
  type WorkoutSport,
} from './types';

const MAX_SESSIONS = 5;

function clampAvailableDays(value: number): number {
  if (!Number.isFinite(value)) return 1;
  return Math.max(1, Math.min(7, Math.round(value)));
}

function historyStatusOf(
  input: WeeklyProposalInput,
  history: PracticeHistory | null
): HistoryStatus {
  if (!history || history.sessionsLast7d === null) return 'absent';
  if (history.sportStatus === 'absent') return 'absent';
  if (history.sportStatus === 'unknown') return 'partial';
  if (history.sportStatus === 'known' && history.sport === null) return 'partial';
  if (history.sport && history.sport !== input.sport) return 'absent';
  return 'complete';
}

function isLongSession(session: StructuredSession): boolean {
  return session.title.toLocaleLowerCase('fr-FR').includes('longue');
}

function pickByIntent(
  sessions: StructuredSession[],
  intent: SessionIntent
): StructuredSession | undefined {
  return sessions.find((session) => session.intent === intent);
}

function prioritySession(
  sessions: StructuredSession[],
  goal: WorkoutGoal,
  sport: WorkoutSport
): StructuredSession | undefined {
  const wantsInterval =
    sport === 'course'
      ? goal === '5k' || goal === '10k'
      : goal === 'puissance';
  const wantsTempo =
    sport === 'course'
      ? goal === 'semi' || goal === 'marathon'
      : goal === 'endurance';

  if (wantsInterval) {
    return (
      pickByIntent(sessions, 'interval') ??
      pickByIntent(sessions, 'tempo') ??
      pickByIntent(sessions, 'endurance')
    );
  }
  if (wantsTempo) {
    return (
      pickByIntent(sessions, 'tempo') ??
      pickByIntent(sessions, 'interval') ??
      pickByIntent(sessions, 'endurance')
    );
  }
  return (
    pickByIntent(sessions, 'recovery') ??
    pickByIntent(sessions, 'endurance') ??
    sessions[0]
  );
}

function uniqueSessions(sessions: Array<StructuredSession | undefined>): StructuredSession[] {
  const seen = new Set<string>();
  const out: StructuredSession[] = [];
  for (const session of sessions) {
    if (!session || seen.has(session.id)) continue;
    seen.add(session.id);
    out.push(session);
  }
  return out;
}

function proposalKey(input: WeeklyProposalInput, status: HistoryStatus): string {
  const count = input.history?.sessionsLast7d ?? 'na';
  return [
    input.sport,
    input.goal,
    input.level,
    clampAvailableDays(input.availableDays),
    status,
    count,
  ].join('-');
}

function asInstant(
  session: StructuredSession,
  key: string,
  index: number
): StructuredSession {
  return {
    ...session,
    id: `instant-${key}-${index}`,
    planId: null,
    week: null,
  };
}

/**
 * Propose une semaine de séances à partir de l'objectif, du niveau et de
 * l'historique réellement disponible.
 *
 * L'historique du bootstrap Compte ne porte pas le sport : dans ce cas le
 * statut est `partial` et seul le nombre de sorties est utilisé. Aucune
 * séance n'est proposée pour un autre sport, et une donnée absente n'est
 * jamais remplacée par un zéro.
 */
export function proposeWeeklyWorkouts(
  input: WeeklyProposalInput
): WeeklyProposal {
  assertPlanRequest(input.sport, input.goal, input.level);

  const availableDays = clampAvailableDays(input.availableDays);
  const history = input.history ?? null;
  const historyStatus = historyStatusOf(input, history);
  const warnings: string[] = [];
  const rationale: string[] = [];

  if (historyStatus === 'absent') {
    if (history && history.sportStatus === 'known' && history.sport && history.sport !== input.sport) {
      warnings.push(
        `L’historique disponible concerne ${history.sport === 'course' ? 'la course' : 'le vélo'} : il n’est pas utilisé pour cette proposition.`
      );
    } else {
      warnings.push(
        'Historique indisponible : la proposition suit le niveau et l’objectif, sans ajustement de charge.'
      );
    }
  } else if (historyStatus === 'partial') {
    warnings.push(
      'Le sport de l’historique n’est pas renseigné : seul le nombre de sorties des 7 derniers jours est utilisé.'
    );
  }

  const sessionsLast7d = history?.sessionsLast7d ?? null;
  const highFrequency = sessionsLast7d !== null && sessionsLast7d >= 5;
  if (highFrequency) {
    rationale.push(
      `${sessionsLast7d} sorties sur 7 jours : semaine allégée, sans séance intense.`
    );
  } else if (sessionsLast7d === 0) {
    rationale.push('Aucune sortie sur 7 jours : reprise progressive.');
  } else if (sessionsLast7d !== null) {
    rationale.push(`${sessionsLast7d} sortie(s) sur 7 jours prise(s) en compte.`);
  }

  const plan = buildTrainingPlan({
    sport: input.sport,
    goal: input.goal,
    level: input.level,
  });
  const week = plan.weeks[0];
  const planSessions = week.sessions;

  const maxByLevel = plan.sessionsPerWeek;
  const count = Math.min(availableDays, maxByLevel, MAX_SESSIONS);
  if (availableDays < maxByLevel) {
    warnings.push(
      `Nombre de séances limité à ${availableDays} jour(s) disponible(s) cette semaine.`
    );
  }

  const priority = prioritySession(planSessions, input.goal, input.sport);
  const recovery = pickByIntent(planSessions, 'recovery');
  const easy =
    planSessions.find(
      (session) => session.intent === 'endurance' && !isLongSession(session)
    ) ?? pickByIntent(planSessions, 'endurance');
  const long = planSessions.find(isLongSession);

  let chosen: Array<StructuredSession | undefined>;
  if (highFrequency) {
    chosen = uniqueSessions([recovery, easy]).slice(0, Math.max(1, Math.min(2, count)));
  } else if (count === 1) {
    chosen = [priority];
  } else if (count === 2) {
    chosen = uniqueSessions([priority, easy]).slice(0, 2);
  } else {
    const nonLong = planSessions.filter((session) => !isLongSession(session));
    const pool = uniqueSessions([priority, ...nonLong]);
    chosen = pool.slice(0, Math.max(1, count - 1));
    chosen.push(long);
  }

  const finalSessions = uniqueSessions(chosen)
    .slice(0, count)
    .map((session, index) => asInstant(session, proposalKey(input, historyStatus), index));

  rationale.unshift(
    `${goalLabel(input.goal)} · ${LEVEL_LABELS[input.level]} · ${finalSessions.length} séance(s) proposée(s).`
  );

  return {
    version: WORKOUT_CONTRACT_VERSION,
    sport: input.sport,
    goal: input.goal,
    level: input.level,
    sessions: finalSessions,
    historyStatus,
    rationale,
    warnings,
    provider: 'lkdv',
  };
}
