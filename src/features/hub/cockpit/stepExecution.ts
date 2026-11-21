export const stepStatuses = ['started', 'arrived', 'completed', 'skipped', 'postponed', 'cancelled'] as const;

export type StepStatus = typeof stepStatuses[number];

export interface StepExecution {
  step_id: string;
  status: StepStatus;
  version: number;
  occurred_at: string;
  actual_started_at: string | null;
  actual_arrived_at: string | null;
  actual_completed_at: string | null;
  note: string | null;
  archived: boolean;
  planned_title: string;
  planned_day_number: number;
  planned_start_time: string | null;
}

export const stepStatusLabels: Record<StepStatus, string> = {
  started: 'Démarrée',
  arrived: 'Atteinte',
  completed: 'Terminée',
  skipped: 'Ignorée',
  postponed: 'Reportée',
  cancelled: 'Annulée',
};

export const stepActionLabels: Record<StepStatus, string> = {
  started: 'Démarrer',
  arrived: 'Marquer atteinte',
  completed: 'Terminer',
  skipped: 'Ignorer',
  postponed: 'Reporter',
  cancelled: 'Annuler l’étape',
};

export const stepTransitions: Record<StepStatus | 'planned', readonly StepStatus[]> = {
  planned: ['started', 'arrived', 'postponed', 'skipped', 'cancelled'],
  started: ['arrived', 'completed', 'postponed', 'skipped', 'cancelled'],
  arrived: ['completed', 'postponed', 'skipped', 'cancelled'],
  postponed: ['started', 'arrived', 'skipped', 'cancelled'],
  completed: [],
  skipped: [],
  cancelled: [],
};
