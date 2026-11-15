import {
  makeStep,
  makeTarget,
  finalizeSession,
  type SessionDraft,
} from './sessionFactory';
import {
  assertPlanRequest,
  BIKE_GOAL_LABELS,
  LEVEL_LABELS,
  RUN_GOAL_LABELS,
  isRunGoal,
  isBikeGoal,
} from './validation';
import {
  WORKOUT_CONTRACT_VERSION,
  type BikeGoal,
  type PlanWeek,
  type RunGoal,
  type SessionStep,
  type StructuredSession,
  type TrainingPlan,
  type WorkoutGoal,
  type WorkoutLevel,
  type WorkoutSport,
  type WorkoutTarget,
} from './types';

const MINUTE = 60;

interface RunGoalSpec {
  weeks: number;
  longRunS: number;
  easyS: number;
  intervalWorkS: number;
  intervalRecoveryS: number;
  tempoS: number;
  /** Allure facile de référence, en secondes par kilomètre. */
  easyPace: Record<WorkoutLevel, number>;
}

const RUN_SPECS: Record<RunGoal, RunGoalSpec> = {
  '5k': {
    weeks: 6,
    longRunS: 30 * MINUTE,
    easyS: 25 * MINUTE,
    intervalWorkS: 2 * MINUTE,
    intervalRecoveryS: 90,
    tempoS: 12 * MINUTE,
    easyPace: { debutant: 420, intermediaire: 390, avance: 360 },
  },
  '10k': {
    weeks: 8,
    longRunS: 45 * MINUTE,
    easyS: 30 * MINUTE,
    intervalWorkS: 3 * MINUTE,
    intervalRecoveryS: 2 * MINUTE,
    tempoS: 18 * MINUTE,
    easyPace: { debutant: 435, intermediaire: 405, avance: 375 },
  },
  semi: {
    weeks: 10,
    longRunS: 70 * MINUTE,
    easyS: 35 * MINUTE,
    intervalWorkS: 4 * MINUTE,
    intervalRecoveryS: 2 * MINUTE,
    tempoS: 24 * MINUTE,
    easyPace: { debutant: 450, intermediaire: 420, avance: 390 },
  },
  marathon: {
    weeks: 12,
    longRunS: 90 * MINUTE,
    easyS: 40 * MINUTE,
    intervalWorkS: 5 * MINUTE,
    intervalRecoveryS: 2 * MINUTE,
    tempoS: 30 * MINUTE,
    easyPace: { debutant: 465, intermediaire: 435, avance: 405 },
  },
};

interface BikeGoalSpec {
  weeks: number;
  baseS: number;
  longS: number;
}

const BIKE_SPECS: Record<BikeGoal, BikeGoalSpec> = {
  endurance: { weeks: 8, baseS: 60 * MINUTE, longS: 90 * MINUTE },
  puissance: { weeks: 8, baseS: 55 * MINUTE, longS: 75 * MINUTE },
  reprise: { weeks: 6, baseS: 35 * MINUTE, longS: 45 * MINUTE },
};

const LEVEL_FACTOR: Record<WorkoutLevel, number> = {
  debutant: 0.8,
  intermediaire: 1,
  avance: 1.2,
};

const SESSIONS_PER_WEEK: Record<WorkoutLevel, number> = {
  debutant: 3,
  intermediaire: 4,
  avance: 5,
};

function roundToFiveMinutes(seconds: number): number {
  const rounded = Math.ceil(seconds / 300) * 300;
  return Math.max(300, rounded);
}

/**
 * Progression douce : +5 % par semaine, semaine allégée toutes les 4 semaines
 * (hors dernière), affûtage sur la dernière semaine. Le facteur ne dépend que
 * de la semaine et du niveau, jamais d'une donnée physiologique absente.
 */
export function weekLoadFactor(week: number, totalWeeks: number): number {
  const progress = 1 + 0.05 * (week - 1);
  if (week === totalWeeks) return progress * 0.62;
  if (week % 4 === 0) return progress * 0.72;
  return progress;
}

function isRecoveryWeek(week: number, totalWeeks: number): boolean {
  return week % 4 === 0 && week !== totalWeeks;
}

function weekFocus(week: number, totalWeeks: number): string {
  if (week === totalWeeks) return 'Affûtage';
  if (isRecoveryWeek(week, totalWeeks)) return 'Semaine allégée';
  if (week === 1) return 'Mise en route';
  return 'Progression';
}

function runWarmup(sessionId: string): SessionStep {
  return makeStep({
    id: `${sessionId}-warmup`,
    kind: 'warmup',
    label: 'Échauffement',
    durationS: 10 * MINUTE,
    targets: [makeTarget('rpe', 'rpe', 3, 4)],
    instruction: 'Démarre progressivement, sans forcer.',
  });
}

function runCooldown(sessionId: string): SessionStep {
  return makeStep({
    id: `${sessionId}-cooldown`,
    kind: 'cooldown',
    label: 'Retour au calme',
    durationS: 10 * MINUTE,
    targets: [makeTarget('rpe', 'rpe', 2, 3)],
    instruction: 'Réduis l’allure et respire calmement.',
  });
}

function easyRunTarget(pace: number): WorkoutTarget[] {
  return [
    makeTarget('pace', 's_per_km', pace - 5, pace + 10),
    makeTarget('rpe', 'rpe', 4, 5),
  ];
}

function longRunTarget(pace: number): WorkoutTarget[] {
  return [
    makeTarget('pace', 's_per_km', pace + 10, pace + 20),
    makeTarget('rpe', 'rpe', 4, 5),
  ];
}

function intervalRunTarget(pace: number): WorkoutTarget[] {
  return [
    makeTarget('pace', 's_per_km', pace - 5, pace + 5),
    makeTarget('rpe', 'rpe', 7, 8),
  ];
}

function tempoRunTarget(pace: number): WorkoutTarget[] {
  return [
    makeTarget('pace', 's_per_km', pace - 5, pace + 5),
    makeTarget('rpe', 'rpe', 6, 7),
  ];
}

function easyRunSession(
  planId: string,
  week: number,
  level: WorkoutLevel,
  spec: RunGoalSpec,
  factor: number
): StructuredSession {
  const id = `${planId}-w${week}-easy`;
  const duration = roundToFiveMinutes(spec.easyS * factor);
  return finalizeSession({
    id,
    planId,
    sport: 'course',
    goal: planGoalFromId(planId),
    level,
    week,
    title: 'Endurance fondamentale',
    intent: 'endurance',
    steps: [
      runWarmup(id),
      makeStep({
        id: `${id}-steady`,
        kind: 'steady',
        label: 'Bloc souple',
        durationS: duration,
        targets: easyRunTarget(spec.easyPace[level]),
        instruction: 'Allure conversationnelle, respiration régulière.',
      }),
      runCooldown(id),
    ],
  });
}

function longRunSession(
  planId: string,
  week: number,
  level: WorkoutLevel,
  spec: RunGoalSpec,
  factor: number
): StructuredSession {
  const id = `${planId}-w${week}-long`;
  const duration = roundToFiveMinutes(spec.longRunS * factor);
  return finalizeSession({
    id,
    planId,
    sport: 'course',
    goal: planGoalFromId(planId),
    level,
    week,
    title: 'Sortie longue',
    intent: 'endurance',
    steps: [
      runWarmup(id),
      makeStep({
        id: `${id}-steady`,
        kind: 'steady',
        label: 'Sortie longue',
        durationS: duration,
        targets: longRunTarget(spec.easyPace[level]),
        instruction: 'Reste souple ; marche si la forme baisse.',
      }),
      runCooldown(id),
    ],
  });
}

function intervalRunSession(
  planId: string,
  week: number,
  level: WorkoutLevel,
  spec: RunGoalSpec,
  _factor: number
): StructuredSession {
  const id = `${planId}-w${week}-interval`;
  const baseReps = level === 'debutant' ? 3 : level === 'intermediaire' ? 4 : 5;
  let reps = Math.min(8, baseReps + Math.floor((week - 1) / 3));
  if (isRecoveryWeek(week, spec.weeks)) reps = Math.max(2, reps - 1);
  if (week === spec.weeks) reps = Math.max(2, reps - 2);

  const steps: SessionStep[] = [runWarmup(id)];
  for (let rep = 1; rep <= reps; rep += 1) {
    steps.push(
      makeStep({
        id: `${id}-rep-${rep}`,
        kind: 'interval',
        label: `Répétition ${rep}/${reps}`,
        durationS: spec.intervalWorkS,
        targets: intervalRunTarget(spec.easyPace[level] - 55),
        instruction: 'Effort régulier, relâche les épaules.',
      })
    );
    steps.push(
      makeStep({
        id: `${id}-rec-${rep}`,
        kind: 'recovery',
        label: `Récupération ${rep}/${reps}`,
        durationS: spec.intervalRecoveryS,
        targets: [makeTarget('rpe', 'rpe', 2, 3)],
        instruction: 'Trotte très souple ou marche.',
      })
    );
  }
  steps.push(runCooldown(id));

  return finalizeSession({
    id,
    planId,
    sport: 'course',
    goal: planGoalFromId(planId),
    level,
    week,
    title: 'Fractionné',
    intent: 'interval',
    steps,
  });
}

function tempoRunSession(
  planId: string,
  week: number,
  level: WorkoutLevel,
  spec: RunGoalSpec,
  factor: number
): StructuredSession {
  const id = `${planId}-w${week}-tempo`;
  const duration = roundToFiveMinutes(spec.tempoS * factor);
  return finalizeSession({
    id,
    planId,
    sport: 'course',
    goal: planGoalFromId(planId),
    level,
    week,
    title: 'Tempo',
    intent: 'tempo',
    steps: [
      runWarmup(id),
      makeStep({
        id: `${id}-steady`,
        kind: 'steady',
        label: 'Bloc tempo',
        durationS: duration,
        targets: tempoRunTarget(spec.easyPace[level] - 30),
        instruction: 'Allure soutenue mais contrôlée, sans sprint.',
      }),
      runCooldown(id),
    ],
  });
}

function recoveryRunSession(
  planId: string,
  week: number,
  level: WorkoutLevel,
  spec: RunGoalSpec,
  factor: number
): StructuredSession {
  const id = `${planId}-w${week}-recovery`;
  const duration = roundToFiveMinutes(spec.easyS * 0.7 * factor);
  return finalizeSession({
    id,
    planId,
    sport: 'course',
    goal: planGoalFromId(planId),
    level,
    week,
    title: 'Récupération active',
    intent: 'recovery',
    steps: [
      makeStep({
        id: `${id}-steady`,
        kind: 'steady',
        label: 'Footing très souple',
        durationS: duration,
        targets: [makeTarget('rpe', 'rpe', 2, 3)],
        instruction: 'Aucune recherche de performance.',
      }),
    ],
  });
}

function planGoalFromId(planId: string): WorkoutGoal {
  const parts = planId.split('-');
  // `run-10k-avance` ou `bike-endurance-debutant`.
  const goal = parts[1];
  if (goal === '5k' || goal === '10k' || goal === 'semi' || goal === 'marathon') {
    return goal;
  }
  if (goal === 'endurance' || goal === 'puissance' || goal === 'reprise') {
    return goal;
  }
  throw new Error(`Objectif illisible dans le plan ${planId}`);
}

function buildRunWeek(
  planId: string,
  week: number,
  level: WorkoutLevel,
  spec: RunGoalSpec,
  factor: number
): PlanWeek {
  const sessions: StructuredSession[] = [];
  const count = SESSIONS_PER_WEEK[level];

  sessions.push(intervalRunSession(planId, week, level, spec, factor));
  if (count >= 4) {
    sessions.push(tempoRunSession(planId, week, level, spec, factor));
  }
  sessions.push(easyRunSession(planId, week, level, spec, factor));
  if (count >= 5) {
    sessions.push(recoveryRunSession(planId, week, level, spec, factor));
  }
  sessions.push(longRunSession(planId, week, level, spec, factor));

  return {
    index: week,
    label: `Semaine ${week}`,
    focus: weekFocus(week, spec.weeks),
    sessions,
    totalDurationS: sessions.reduce((sum, s) => sum + s.totalDurationS, 0),
    isRecoveryWeek: isRecoveryWeek(week, spec.weeks),
  };
}

export function buildRunningPlan(
  goal: RunGoal,
  level: WorkoutLevel
): TrainingPlan {
  assertPlanRequest('course', goal, level);
  const spec = RUN_SPECS[goal];
  const planId = `run-${goal}-${level}`;
  const weeks: PlanWeek[] = [];
  for (let week = 1; week <= spec.weeks; week += 1) {
    weeks.push(
      buildRunWeek(planId, week, level, spec, weekLoadFactor(week, spec.weeks))
    );
  }
  return {
    version: WORKOUT_CONTRACT_VERSION,
    id: planId,
    sport: 'course',
    goal,
    level,
    title: `Plan ${RUN_GOAL_LABELS[goal]} · ${LEVEL_LABELS[level]}`,
    summary: `${spec.weeks} semaines · ${SESSIONS_PER_WEEK[level]} séances/semaine · semaine allégée toutes les 4 semaines.`,
    weeks,
    sessionsPerWeek: SESSIONS_PER_WEEK[level],
    totalDurationS: weeks.reduce((sum, week) => sum + week.totalDurationS, 0),
    provider: 'lkdv',
    disclaimer:
      'Plan indicatif LKDV, sans validation médicale individuelle. Adapte l’allure et le volume à ta forme réelle.',
  };
}

function bikeWarmup(sessionId: string): SessionStep {
  return makeStep({
    id: `${sessionId}-warmup`,
    kind: 'warmup',
    label: 'Échauffement',
    durationS: 10 * MINUTE,
    targets: [
      makeTarget('rpe', 'rpe', 3, 4),
      makeTarget('cadence', 'rpm', 80, 90),
    ],
    instruction: 'Mouline souplement, sans chercher la puissance.',
  });
}

function bikeCooldown(sessionId: string): SessionStep {
  return makeStep({
    id: `${sessionId}-cooldown`,
    kind: 'cooldown',
    label: 'Retour au calme',
    durationS: 10 * MINUTE,
    targets: [makeTarget('rpe', 'rpe', 2, 3)],
    instruction: 'Réduis l’effort et mouline léger.',
  });
}

function bikeEasyTarget(): WorkoutTarget[] {
  return [
    makeTarget('rpe', 'rpe', 4, 5),
    makeTarget('cadence', 'rpm', 80, 90),
  ];
}

function bikeLongTarget(): WorkoutTarget[] {
  return [
    makeTarget('rpe', 'rpe', 4, 5),
    makeTarget('cadence', 'rpm', 75, 85),
  ];
}

function bikeIntervalTarget(): WorkoutTarget[] {
  return [
    makeTarget('rpe', 'rpe', 7, 8),
    makeTarget('cadence', 'rpm', 85, 95),
  ];
}

function bikeTempoTarget(): WorkoutTarget[] {
  return [
    makeTarget('rpe', 'rpe', 6, 7),
    makeTarget('cadence', 'rpm', 80, 90),
  ];
}

function bikeEasySession(
  planId: string,
  week: number,
  level: WorkoutLevel,
  spec: BikeGoalSpec,
  factor: number,
  variant: 'base' | 'second' | 'third' | 'recovery' = 'base'
): StructuredSession {
  const suffix =
    variant === 'base'
      ? 'easy'
      : variant === 'second'
        ? 'easy-2'
        : variant === 'third'
          ? 'easy-3'
          : 'recovery';
  const id = `${planId}-w${week}-${suffix}`;
  const ratio = variant === 'recovery' ? 0.7 : 1;
  const duration = roundToFiveMinutes(
    spec.baseS * LEVEL_FACTOR[level] * factor * ratio
  );
  return finalizeSession({
    id,
    planId,
    sport: 'velo',
    goal: planGoalFromId(planId),
    level,
    week,
    title:
      variant === 'recovery'
        ? 'Récupération active vélo'
        : variant === 'second'
          ? 'Endurance vélo (2)'
          : variant === 'third'
            ? 'Endurance vélo (3)'
            : 'Endurance vélo',
    intent: variant === 'recovery' ? 'recovery' : 'endurance',
    steps: [
      bikeWarmup(id),
      makeStep({
        id: `${id}-steady`,
        kind: 'steady',
        label:
          variant === 'recovery' ? 'Moulinage très souple' : 'Bloc endurance',
        durationS: duration,
        targets:
          variant === 'recovery'
            ? [makeTarget('rpe', 'rpe', 2, 3)]
            : bikeEasyTarget(),
        instruction:
          variant === 'recovery'
            ? 'Aucune recherche de performance.'
            : 'Rythme régulier, respiration maîtrisée.',
      }),
      bikeCooldown(id),
    ],
  });
}

function bikeLongSession(
  planId: string,
  week: number,
  level: WorkoutLevel,
  spec: BikeGoalSpec,
  factor: number
): StructuredSession {
  const id = `${planId}-w${week}-long`;
  const duration = roundToFiveMinutes(
    spec.longS * LEVEL_FACTOR[level] * factor
  );
  return finalizeSession({
    id,
    planId,
    sport: 'velo',
    goal: planGoalFromId(planId),
    level,
    week,
    title: 'Sortie longue vélo',
    intent: 'endurance',
    steps: [
      bikeWarmup(id),
      makeStep({
        id: `${id}-steady`,
        kind: 'steady',
        label: 'Sortie longue',
        durationS: duration,
        targets: bikeLongTarget(),
        instruction: 'Reste en endurance ; bois et mange régulièrement.',
      }),
      bikeCooldown(id),
    ],
  });
}

function bikeIntervalSession(
  planId: string,
  week: number,
  level: WorkoutLevel,
  spec: BikeGoalSpec,
  _factor: number
): StructuredSession {
  const id = `${planId}-w${week}-interval`;
  const baseReps = level === 'debutant' ? 3 : level === 'intermediaire' ? 4 : 5;
  let reps = Math.min(8, baseReps + Math.floor((week - 1) / 3));
  if (isRecoveryWeek(week, spec.weeks)) reps = Math.max(2, reps - 1);
  if (week === spec.weeks) reps = Math.max(2, reps - 2);

  const steps: SessionStep[] = [bikeWarmup(id)];
  for (let rep = 1; rep <= reps; rep += 1) {
    steps.push(
      makeStep({
        id: `${id}-rep-${rep}`,
        kind: 'interval',
        label: `Effort ${rep}/${reps}`,
        durationS: 3 * MINUTE,
        targets: bikeIntervalTarget(),
        instruction: 'Effort soutenu, reste assis et régulier.',
      })
    );
    steps.push(
      makeStep({
        id: `${id}-rec-${rep}`,
        kind: 'recovery',
        label: `Récupération ${rep}/${reps}`,
        durationS: 2 * MINUTE,
        targets: [
          makeTarget('rpe', 'rpe', 3, 4),
          makeTarget('cadence', 'rpm', 70, 80),
        ],
        instruction: 'Mouline léger.',
      })
    );
  }
  steps.push(bikeCooldown(id));

  return finalizeSession({
    id,
    planId,
    sport: 'velo',
    goal: planGoalFromId(planId),
    level,
    week,
    title: 'Fractionné vélo',
    intent: 'interval',
    steps,
  });
}

function bikeTempoSession(
  planId: string,
  week: number,
  level: WorkoutLevel,
  spec: BikeGoalSpec,
  factor: number
): StructuredSession {
  const id = `${planId}-w${week}-tempo`;
  const duration = roundToFiveMinutes(
    spec.baseS * 0.75 * LEVEL_FACTOR[level] * factor
  );
  return finalizeSession({
    id,
    planId,
    sport: 'velo',
    goal: planGoalFromId(planId),
    level,
    week,
    title: 'Tempo vélo',
    intent: 'tempo',
    steps: [
      bikeWarmup(id),
      makeStep({
        id: `${id}-steady`,
        kind: 'steady',
        label: 'Bloc tempo',
        durationS: duration,
        targets: bikeTempoTarget(),
        instruction: 'Allure soutenue, sans à-coups.',
      }),
      bikeCooldown(id),
    ],
  });
}

function buildBikeWeek(
  planId: string,
  week: number,
  level: WorkoutLevel,
  spec: BikeGoalSpec,
  factor: number
): PlanWeek {
  const sessions: StructuredSession[] = [];
  const count = SESSIONS_PER_WEEK[level];

  if (spec === BIKE_SPECS.puissance) {
    sessions.push(bikeIntervalSession(planId, week, level, spec, factor));
    if (count >= 4) {
      sessions.push(bikeTempoSession(planId, week, level, spec, factor));
    }
  } else if (spec === BIKE_SPECS.endurance) {
    sessions.push(bikeTempoSession(planId, week, level, spec, factor));
    if (count >= 4) {
      sessions.push(bikeEasySession(planId, week, level, spec, factor, 'second'));
    }
  } else {
    // Reprise : aucune séance intense, uniquement du volume souple.
    const variants = ['base', 'second', 'third', 'recovery'] as const;
    for (let index = 0; index < count - 1; index += 1) {
      sessions.push(
        bikeEasySession(planId, week, level, spec, factor, variants[index])
      );
    }
  }

  if (spec !== BIKE_SPECS.reprise) {
    sessions.push(bikeEasySession(planId, week, level, spec, factor));
  }
  if (count >= 5 && spec !== BIKE_SPECS.reprise) {
    sessions.push(
      bikeEasySession(planId, week, level, spec, factor, 'recovery')
    );
  }
  sessions.push(bikeLongSession(planId, week, level, spec, factor));

  return {
    index: week,
    label: `Semaine ${week}`,
    focus: weekFocus(week, spec.weeks),
    sessions,
    totalDurationS: sessions.reduce((sum, s) => sum + s.totalDurationS, 0),
    isRecoveryWeek: isRecoveryWeek(week, spec.weeks),
  };
}

export function buildCyclingPlan(
  goal: BikeGoal,
  level: WorkoutLevel
): TrainingPlan {
  assertPlanRequest('velo', goal, level);
  const spec = BIKE_SPECS[goal];
  const planId = `bike-${goal}-${level}`;
  const weeks: PlanWeek[] = [];
  for (let week = 1; week <= spec.weeks; week += 1) {
    weeks.push(
      buildBikeWeek(planId, week, level, spec, weekLoadFactor(week, spec.weeks))
    );
  }
  return {
    version: WORKOUT_CONTRACT_VERSION,
    id: planId,
    sport: 'velo',
    goal,
    level,
    title: `Plan vélo ${BIKE_GOAL_LABELS[goal]} · ${LEVEL_LABELS[level]}`,
    summary: `${spec.weeks} semaines · ${SESSIONS_PER_WEEK[level]} séances/semaine · cibles RPE et cadence, sans puissance inventée.`,
    weeks,
    sessionsPerWeek: SESSIONS_PER_WEEK[level],
    totalDurationS: weeks.reduce((sum, week) => sum + week.totalDurationS, 0),
    provider: 'lkdv',
    disclaimer:
      'Plan indicatif LKDV. Aucune puissance en watts n’est prescrite sans FTP mesuré ; les cibles sont des ressentis (RPE) et des cadences.',
  };
}

export interface PlanRequest {
  sport: WorkoutSport;
  goal: WorkoutGoal;
  level: WorkoutLevel;
}

export function buildTrainingPlan(request: PlanRequest): TrainingPlan {
  if (request.sport === 'course') {
    if (!isRunGoal(request.goal)) {
      throw new Error(`Objectif ${request.goal} incompatible avec la course`);
    }
    return buildRunningPlan(request.goal, request.level);
  }
  if (!isBikeGoal(request.goal)) {
    throw new Error(`Objectif ${request.goal} incompatible avec le vélo`);
  }
  return buildCyclingPlan(request.goal, request.level);
}

/** Toutes les combinaisons valides, pour les sélecteurs de l'UI. */
export function availablePlans(): TrainingPlan[] {
  const plans: TrainingPlan[] = [];
  for (const goal of ['5k', '10k', 'semi', 'marathon'] as RunGoal[]) {
    for (const level of ['debutant', 'intermediaire', 'avance'] as WorkoutLevel[]) {
      plans.push(buildRunningPlan(goal, level));
    }
  }
  for (const goal of ['endurance', 'puissance', 'reprise'] as BikeGoal[]) {
    for (const level of ['debutant', 'intermediaire', 'avance'] as WorkoutLevel[]) {
      plans.push(buildCyclingPlan(goal, level));
    }
  }
  return plans;
}

let sessionIndex: Map<string, StructuredSession> | null = null;

/** Retrouve une séance de plan par son identifiant stable (reprise locale). */
export function findBuiltInSession(
  sessionId: string
): StructuredSession | null {
  if (!sessionIndex) {
    sessionIndex = new Map();
    for (const plan of availablePlans()) {
      for (const week of plan.weeks) {
        for (const session of week.sessions) {
          sessionIndex.set(session.id, session);
        }
      }
    }
  }
  return sessionIndex.get(sessionId) ?? null;
}

/** Réinitialise l'index (tests uniquement). */
export function resetBuiltInSessionIndex(): void {
  sessionIndex = null;
}

export type { SessionDraft };
