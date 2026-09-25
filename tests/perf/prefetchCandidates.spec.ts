import { describe, expect, it } from 'vitest';
import { getLikelyPrefetchRoute } from '@/lib/perf/prefetchCandidates';

describe('likely route prefetch', () => {
  it('selects at most one likely destination for a known route', () => {
    expect(getLikelyPrefetchRoute('/hub')).toBe('/hub/itineraire');
    expect(getLikelyPrefetchRoute('/')).toBe('/explorer');
  });

  it('does not prefetch unknown or already selected routes', () => {
    expect(getLikelyPrefetchRoute('/unlisted')).toBeNull();
    expect(getLikelyPrefetchRoute('/hub/itineraire')).toBeNull();
  });
});
