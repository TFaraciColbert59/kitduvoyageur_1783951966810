import type {
  BikeGoal,
  RunGoal,
  WorkoutGoal,
  WorkoutLevel,
  WorkoutSport,
} from './types';

const SPORTS: readonly WorkoutSport[] = ['course', 'velo'];
const LEVELS: readonly WorkoutLevel[] = [
  'debutant',
  'intermediaire',
  'avance',
];
const RUN_GOALS: readonly RunGoal[] = ['5k', '10k', 'semi', 'marathon'];
const BIKE_GOALS: readonly BikeGoal[] = ['endurance', 'puissance', 'reprise'];

export function isWorkoutSport(value: unknown): value is WorkoutSport {
  return typeof value === 'string' && (SPORTS as readonly string[]).includes(value);
}

export function isWorkoutLevel(value: unknown): value is WorkoutLevel {
  return typeof value === 'string' && (LEVELS as readonly string[]).includes(value);
}

export function isRunGoal(value: unknown): value is RunGoal {
  return typeof value === 'string' && (RUN_GOALS as readonly string[]).includes(value);
}

export function isBikeGoal(value: unknown): value is BikeGoal {
  return typeof value === 'string' && (BIKE_GOALS as readonly string[]).includes(value);
}

export function isGoalForSport(
  sport: WorkoutSport,
  goal: WorkoutGoal
): boolean {
  return sport === 'course' ? isRunGoal(goal) : isBikeGoal(goal);
}

export function runGoals(): readonly RunGoal[] {
  return RUN_GOALS;
}

export function bikeGoals(): readonly BikeGoal[] {
  return BIKE_GOALS;
}

export function workoutLevels(): readonly WorkoutLevel[] {
  return LEVELS;
}

export const LEVEL_LABELS: Record<WorkoutLevel, string> = {
  debutant: 'Débutant',
  intermediaire: 'Intermédiaire',
  avance: 'Avancé',
};

export const RUN_GOAL_LABELS: Record<RunGoal, string> = {
  '5k': '5 km',
  '10k': '10 km',
  semi: 'Semi-marathon',
  marathon: 'Marathon',
};

export const BIKE_GOAL_LABELS: Record<BikeGoal, string> = {
  endurance: 'Endurance',
  puissance: 'Puissance',
  reprise: 'Reprise',
};

export function goalLabel(goal: WorkoutGoal): string {
  if (isRunGoal(goal)) return RUN_GOAL_LABELS[goal];
  return BIKE_GOAL_LABELS[goal as BikeGoal];
}

export function assertPlanRequest(
  sport: unknown,
  goal: unknown,
  level: unknown
): asserts sport is WorkoutSport {
  if (!isWorkoutSport(sport)) {
    throw new Error(`Sport d'entraînement inconnu : ${String(sport)}`);
  }
  if (!isWorkoutLevel(level)) {
    throw new Error(`Niveau d'entraînement inconnu : ${String(level)}`);
  }
  if (typeof goal !== 'string' || !isGoalForSport(sport, goal as WorkoutGoal)) {
    throw new Error(
      `Objectif ${String(goal)} incompatible avec le sport ${sport}`
    );
  }
}
