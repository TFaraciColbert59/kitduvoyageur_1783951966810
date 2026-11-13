/**
 * Contrats d'entraînement LKDV — version 1.
 *
 * Ce module ne dépend d'aucune API partenaire. Les plans et séances sont des
 * prescriptions LKDV déterministes ; Runna, CTS et Garmin restent des
 * fournisseurs *déclarés indisponibles* tant qu'aucune licence ou aucun
 * connecteur n'est présent dans le dépôt (voir `availability.ts`).
 *
 * Règles de contrat :
 *   - une cible absente reste `null`, jamais 0 ;
 *   - une durée est en secondes entières ;
 *   - une allure est en secondes par kilomètre ;
 *   - une puissance n'est jamais prescrite sans FTP mesuré : les plans vélo
 *     utilisent RPE + cadence, pas des watts inventés ;
 *   - `version` est estampillée sur chaque plan, séance, exécution et envoi.
 */

export const WORKOUT_CONTRACT_VERSION = 1 as const;

export type WorkoutSport = 'course' | 'velo';

export type WorkoutLevel = 'debutant' | 'intermediaire' | 'avance';

/** Objectifs course. */
export type RunGoal = '5k' | '10k' | 'semi' | 'marathon';

/** Objectifs vélo. */
export type BikeGoal = 'endurance' | 'puissance' | 'reprise';

export type WorkoutGoal = RunGoal | BikeGoal;

export type SessionIntent =
  | 'endurance'
  | 'interval'
  | 'tempo'
  | 'recovery'
  | 'test';

export type StepKind =
  | 'warmup'
  | 'interval'
  | 'recovery'
  | 'steady'
  | 'cooldown';

export type TargetKind =
  | 'pace'
  | 'power'
  | 'heart_rate'
  | 'rpe'
  | 'cadence';

export type TargetUnit = 's_per_km' | 'w' | 'bpm' | 'rpe' | 'rpm';

/**
 * Cible prescrite. `min`/`max` sont dans `unit` ; `null` signifie « borne non
 * prescrite », pas « zéro ». `label` est déjà formaté pour l'affichage.
 */
export interface WorkoutTarget {
  kind: TargetKind;
  unit: TargetUnit;
  min: number | null;
  max: number | null;
  label: string;
  /** Toutes les cibles de ce contrat sont prescrites par LKDV. */
  basis: 'lkdv_prescription';
}

export interface SessionStep {
  id: string;
  kind: StepKind;
  label: string;
  durationS: number;
  targets: WorkoutTarget[];
  instruction: string | null;
}

export interface StructuredSession {
  version: typeof WORKOUT_CONTRACT_VERSION;
  id: string;
  /** `null` pour une séance instantanée hors plan. */
  planId: string | null;
  sport: WorkoutSport;
  goal: WorkoutGoal;
  level: WorkoutLevel;
  /** Semaine 1-based dans le plan, `null` pour une séance instantanée. */
  week: number | null;
  title: string;
  intent: SessionIntent;
  steps: SessionStep[];
  totalDurationS: number;
  /** Aucune séance intégrée ne prétend venir d'un partenaire. */
  provider: 'lkdv';
}

export interface PlanWeek {
  /** 1-based. */
  index: number;
  label: string;
  focus: string;
  sessions: StructuredSession[];
  totalDurationS: number;
  isRecoveryWeek: boolean;
}

export interface TrainingPlan {
  version: typeof WORKOUT_CONTRACT_VERSION;
  id: string;
  sport: WorkoutSport;
  goal: WorkoutGoal;
  level: WorkoutLevel;
  title: string;
  summary: string;
  weeks: PlanWeek[];
  sessionsPerWeek: number;
  totalDurationS: number;
  provider: 'lkdv';
  disclaimer: string;
}

export type SessionExecutionStatus = 'running' | 'paused' | 'completed';

/**
 * Exécution locale d'une séance. `elapsedS` ne compte que le temps actif :
 * une pause est exclue. Aucun résultat physiologique n'est inventé.
 */
export interface SessionExecution {
  version: typeof WORKOUT_CONTRACT_VERSION;
  executionId: string;
  sessionId: string;
  sport: WorkoutSport;
  status: SessionExecutionStatus;
  elapsedS: number;
  startedAt: number;
  runningSince: number | null;
  pausedAt: number | null;
  completedAt: number | null;
  updatedAt: number;
}

export type DeviceConnectorStatus = 'connected' | 'disconnected' | 'unavailable';

export type DeviceCapability = 'structured_workout';

/**
 * Connecteur fourni par l'appelant. LKDV n'enregistre aujourd'hui aucun
 * connecteur montre : la liste réelle est vide et l'envoi est indisponible.
 */
export interface DeviceConnector {
  id: string;
  label: string;
  provider: 'garmin' | 'other';
  status: DeviceConnectorStatus;
  capabilities: DeviceCapability[];
}

export type WatchTransferStatus = 'ready' | 'unavailable' | 'unsupported' | 'invalid';

export type WatchTransferReason =
  | 'ready'
  | 'connector_absent'
  | 'connector_disconnected'
  | 'capability_absent'
  | 'invalid_session';

/**
 * Payload neutre, encodé JSON LKDV. Ce n'est ni du FIT ni un appel Garmin :
 * un adaptateur réel devra être ajouté avant tout envoi effectif.
 */
export interface DeviceWorkoutPayload {
  version: typeof WORKOUT_CONTRACT_VERSION;
  encoding: 'lkdv_json';
  sessionId: string;
  sport: WorkoutSport;
  steps: Array<{
    id: string;
    kind: StepKind;
    label: string;
    durationS: number;
    targets: WorkoutTarget[];
  }>;
}

export interface WatchTransferPlan {
  version: typeof WORKOUT_CONTRACT_VERSION;
  status: WatchTransferStatus;
  reason: WatchTransferReason;
  connectorId: string | null;
  detail: string;
  /** L'exécution sur le téléphone reste toujours possible. */
  localExecution: 'available';
  payload: DeviceWorkoutPayload | null;
}

export type RecoveryStatus = 'ready' | 'rest' | 'absent';

export type RecoveryReason =
  | 'practice_recent'
  | 'practice_absent'
  | 'practice_old'
  | 'high_soreness'
  | 'invalid_practice';

export type Soreness = 'none' | 'light' | 'high';

export interface RecoveryExercise {
  id: string;
  title: string;
  area: string;
  /** Durée en secondes, `null` si l'exercice se compte en répétitions. */
  durationS: number | null;
  /** Répétitions, `null` si l'exercice se compte en durée. */
  reps: number | null;
  instructions: string;
}

export interface RecoveryProgram {
  version: typeof WORKOUT_CONTRACT_VERSION;
  status: RecoveryStatus;
  reason: RecoveryReason;
  title: string;
  summary: string;
  basedOn: {
    lastPracticeAt: string | null;
    hoursSincePractice: number | null;
    sport: WorkoutSport | null;
    sportStatus: 'known' | 'unknown' | 'absent';
  };
  exercises: RecoveryExercise[];
  disclaimer: string;
  nextPracticeHint: string | null;
}

export type HistoryStatus = 'complete' | 'partial' | 'absent';

/**
 * Historique réellement lisible. `sessionsLast7d` est un compte objectif ;
 * `sport` reste `null` quand la source ne le porte pas (cas du bootstrap
 * Compte actuel), et `sportStatus` l'annonce explicitement.
 */
export interface PracticeHistory {
  sessionsLast7d: number | null;
  lastPracticeAt: string | null;
  sport: WorkoutSport | null;
  sportStatus: 'known' | 'unknown' | 'absent';
}

export interface WeeklyProposalInput {
  sport: WorkoutSport;
  goal: WorkoutGoal;
  level: WorkoutLevel;
  /** Jours réellement disponibles dans la semaine, 1 à 7. */
  availableDays: number;
  history?: PracticeHistory | null;
}

export interface WeeklyProposal {
  version: typeof WORKOUT_CONTRACT_VERSION;
  sport: WorkoutSport;
  goal: WorkoutGoal;
  level: WorkoutLevel;
  sessions: StructuredSession[];
  historyStatus: HistoryStatus;
  rationale: string[];
  warnings: string[];
  provider: 'lkdv';
}

export type WorkoutProviderId = 'lkdv' | 'runna' | 'cts' | 'garmin';

export type ProviderKind = 'plan' | 'device';

export type ProviderStatus = 'available' | 'unavailable';

export type ProviderUnavailableReason =
  | 'no_license'
  | 'connector_absent'
  | 'not_configured';

export interface ProviderAvailability {
  id: WorkoutProviderId;
  label: string;
  kind: ProviderKind;
  status: ProviderStatus;
  reason: ProviderUnavailableReason | null;
  detail: string;
}
