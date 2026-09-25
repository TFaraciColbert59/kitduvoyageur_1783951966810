import { describe, expect, it } from 'vitest';
import { createNavigationTracker } from '@/lib/perf/experienceMetrics';

describe('LKDV navigation timing', () => {
  it('measures a tab change from press until the destination is painted', () => {
    const tracker = createNavigationTracker();
    tracker.start('/communaute', '/hub', 100);

    expect(tracker.finish('/hub', 110)).toBeNull();
    tracker.commit('/communaute');
    expect(tracker.finish('/communaute', 176)).toEqual({
      name: 'LKDV_NAVIGATION',
      value: 76,
      route: '/communaute',
    });
    expect(tracker.finish('/communaute', 190)).toBeNull();
  });

  it('ignores the current tab and stale or invalid clocks', () => {
    const tracker = createNavigationTracker();
    tracker.start('/hub', '/hub', 100);
    expect(tracker.finish('/hub/kit-voyage', 130)).toBeNull();

    tracker.start('/explorer', '/hub', 200);
    tracker.commit('/explorer');
    expect(tracker.finish('/explorer', 199)).toBeNull();
    tracker.start('/explorer', '/hub', 300);
    tracker.commit('/explorer');
    expect(tracker.finish('/explorer', 30_301)).toBeNull();
  });

  it('does not attribute a canceled press or another route to the tab', () => {
    const tracker = createNavigationTracker();
    tracker.start('/explorer', '/hub', 100);
    expect(tracker.finish('/compte', 150)).toBeNull();

    tracker.start('/explorer', '/hub', 200);
    tracker.commit('/explorer');
    expect(tracker.finish('/compte', 250)).toBeNull();
    expect(tracker.finish('/explorer', 300)).toBeNull();

    tracker.start('/explorer', '/hub', 400);
    tracker.commit('/explorer');
    tracker.cancel();
    expect(tracker.finish('/explorer', 450)).toBeNull();
  });
});
