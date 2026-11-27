/**
 * Abort registry for Explorer v2 data layers.
 *
 * Ensures that rapid viewport pans cancel superseded in-flight requests per
 * logical layer group, and that entering live GPS tracking (`GPS_ACTIVE`)
 * immediately aborts all non-safety background fetches to preserve mobile
 * radio, CPU, and 60 FPS GPU headroom.
 */

export type ExplorerAbortGroup =
  | 'hazards'
  | 'radar'
  | 'airspace'
  | 'pokedex'
  | 'social'
  | 'territory'
  | 'sos'
  | 'navigation'
  | 'poi'
  | 'search'
  | (string & {});

export const CRITICAL_ABORT_GROUPS: ReadonlySet<string> = new Set([
  'hazards',
  'radar',
  'sos',
  'navigation',
]);

export class FetchAbortRegistry {
  private readonly controllers = new Map<string, AbortController>();
  private readonly criticalGroups: ReadonlySet<string>;

  constructor(criticalGroups: ReadonlySet<string> = CRITICAL_ABORT_GROUPS) {
    this.criticalGroups = criticalGroups;
  }

  /**
   * Returns a fresh `AbortSignal` for `group`, automatically aborting any
   * previous in-flight controller registered under the same `group`.
   * If `parentSignal` is provided (e.g. TanStack Query signal), its abort is
   * forwarded to this controller without leaking listeners.
   */
  getSignal(group: ExplorerAbortGroup, parentSignal?: AbortSignal): AbortSignal {
    this.abortGroup(group, 'superseded');

    const controller = new AbortController();
    this.controllers.set(group, controller);

    const cleanupIfCurrent = () => {
      if (this.controllers.get(group) === controller) {
        this.controllers.delete(group);
      }
    };

    if (parentSignal) {
      if (parentSignal.aborted) {
        controller.abort(parentSignal.reason ?? 'parent-aborted');
        cleanupIfCurrent();
        return controller.signal;
      }

      const onParentAbort = () => {
        controller.abort(parentSignal.reason ?? 'parent-aborted');
        cleanupIfCurrent();
      };

      parentSignal.addEventListener('abort', onParentAbort, { once: true });
      controller.signal.addEventListener(
        'abort',
        () => {
          parentSignal.removeEventListener('abort', onParentAbort);
          cleanupIfCurrent();
        },
        { once: true },
      );
    } else {
      controller.signal.addEventListener('abort', cleanupIfCurrent, { once: true });
    }

    return controller.signal;
  }

  abortGroup(group: ExplorerAbortGroup, reason = 'aborted'): boolean {
    const existing = this.controllers.get(group);
    if (!existing) return false;
    this.controllers.delete(group);
    if (!existing.signal.aborted) {
      existing.abort(reason);
    }
    return true;
  }

  /**
   * Aborts every active group that is not marked safety-critical
   * (`hazards`, `radar`, `sos`, `navigation`).
   * Returns the number of groups aborted.
   */
  abortAllNonCritical(reason = 'gps-active-throttle'): number {
    let abortedCount = 0;
    for (const [group, controller] of Array.from(this.controllers.entries())) {
      if (this.criticalGroups.has(group)) continue;
      this.controllers.delete(group);
      if (!controller.signal.aborted) {
        controller.abort(reason);
      }
      abortedCount += 1;
    }
    return abortedCount;
  }

  abortAll(reason = 'reset'): number {
    let abortedCount = 0;
    for (const [group, controller] of Array.from(this.controllers.entries())) {
      this.controllers.delete(group);
      if (!controller.signal.aborted) {
        controller.abort(reason);
      }
      abortedCount += 1;
    }
    return abortedCount;
  }

  hasActive(group: ExplorerAbortGroup): boolean {
    const controller = this.controllers.get(group);
    return Boolean(controller && !controller.signal.aborted);
  }

  activeGroups(): string[] {
    return Array.from(this.controllers.entries())
      .filter(([, ctrl]) => !ctrl.signal.aborted)
      .map(([group]) => group);
  }
}

export const explorerAbortRegistry = new FetchAbortRegistry();
