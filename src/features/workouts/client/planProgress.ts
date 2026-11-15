import type { TrainingPlan } from '../domain/types';

export interface PlanProgressState {
  enrolledPlanIds: string[];
  /** Clé `<planId>::<sessionId>` -> ISO timestamp de complétion. */
  completedSessionKeys: Record<string, string>;
  updatedAt: string;
}

const STORAGE_KEY = 'lkdv.workouts.plan-progress.v1';

function resolveStorage(storage?: Storage | null): Storage | null {
  if (storage !== undefined) return storage;
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      return window.localStorage;
    }
  } catch {
    return null;
  }
  return null;
}

export function emptyPlanProgress(): PlanProgressState {
  return {
    enrolledPlanIds: [],
    completedSessionKeys: {},
    updatedAt: '',
  };
}

export function planSessionKey(planId: string, sessionId: string): string {
  return `${planId}::${sessionId}`;
}

export function readPlanProgress(storage?: Storage | null): PlanProgressState {
  const store = resolveStorage(storage);
  if (!store) return emptyPlanProgress();
  try {
    const raw = store.getItem(STORAGE_KEY);
    if (!raw) return emptyPlanProgress();
    const parsed = JSON.parse(raw) as Partial<PlanProgressState>;
    return {
      enrolledPlanIds: Array.isArray(parsed.enrolledPlanIds)
        ? parsed.enrolledPlanIds.filter((id): id is string => typeof id === 'string')
        : [],
      completedSessionKeys:
        parsed.completedSessionKeys && typeof parsed.completedSessionKeys === 'object'
          ? { ...parsed.completedSessionKeys }
          : {},
      updatedAt: typeof parsed.updatedAt === 'string' ? parsed.updatedAt : '',
    };
  } catch {
    return emptyPlanProgress();
  }
}

function writePlanProgress(
  state: PlanProgressState,
  storage?: Storage | null
): PlanProgressState {
  const next: PlanProgressState = {
    ...state,
    updatedAt: new Date().toISOString(),
  };
  const store = resolveStorage(storage);
  if (store) {
    try {
      store.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      /* ignore quota errors */
    }
  }
  return next;
}

export function togglePlanEnrollment(
  planId: string,
  storage?: Storage | null
): PlanProgressState {
  const current = readPlanProgress(storage);
  const exists = current.enrolledPlanIds.includes(planId);
  return writePlanProgress(
    {
      ...current,
      enrolledPlanIds: exists
        ? current.enrolledPlanIds.filter((id) => id !== planId)
        : [...current.enrolledPlanIds, planId],
    },
    storage
  );
}

export function togglePlanSessionCompleted(
  planId: string,
  sessionId: string,
  storage?: Storage | null
): PlanProgressState {
  const current = readPlanProgress(storage);
  const key = planSessionKey(planId, sessionId);
  const nextCompleted = { ...current.completedSessionKeys };
  if (key in nextCompleted) {
    delete nextCompleted[key];
  } else {
    nextCompleted[key] = new Date().toISOString();
  }
  return writePlanProgress(
    {
      ...current,
      completedSessionKeys: nextCompleted,
    },
    storage
  );
}

export function countPlanCompletion(
  plan: TrainingPlan,
  progress: PlanProgressState
): { completed: number; total: number; percent: number } {
  let total = 0;
  let completed = 0;
  for (const week of plan.weeks) {
    for (const session of week.sessions) {
      total += 1;
      if (planSessionKey(plan.id, session.id) in progress.completedSessionKeys) {
        completed += 1;
      }
    }
  }
  const percent = total > 0 ? Math.round((completed / total) * 100) : 0;
  return { completed, total, percent };
}
