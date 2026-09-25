export interface ExperienceMetric {
  name: 'LKDV_NAVIGATION';
  value: number;
  route: string;
}

interface PendingNavigation {
  target: string;
  from: string;
  startedAt: number;
  committed: boolean;
}

/** Times a tab press through the first painted frame of a different route. */
export function createNavigationTracker() {
  let pending: PendingNavigation | null = null;

  return {
    start(target: string, from: string, startedAt: number): void {
      pending = target === from || !Number.isFinite(startedAt)
        ? null
        : { target, from, startedAt, committed: false };
    },
    commit(target: string): void {
      if (pending?.target === target) pending = { ...pending, committed: true };
    },
    cancel(): void {
      pending = null;
    },
    finish(route: string, finishedAt: number): ExperienceMetric | null {
      if (!pending || route === pending.from) return null;

      const navigation = pending;
      pending = null;
      if (!navigation.committed) return null;
      if (route !== navigation.target && !route.startsWith(`${navigation.target}/`)) return null;
      const duration = finishedAt - navigation.startedAt;
      if (!Number.isFinite(duration) || duration < 0 || duration > 30_000) return null;

      return {
        name: 'LKDV_NAVIGATION',
        value: Math.round(duration),
        route,
      };
    },
  };
}
