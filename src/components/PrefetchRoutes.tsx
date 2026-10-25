'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { evaluateCurrentPrefetchPolicy } from '@/lib/perf/networkPrefs';
import { getLikelyPrefetchRoute } from '@/lib/perf/prefetchCandidates';

/** Prefetch one likely destination after the current page has had time to paint. */
export default function PrefetchRoutes() {
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    const route = getLikelyPrefetchRoute(pathname);
    if (!route || !evaluateCurrentPrefetchPolicy().allow) return;

    if ('requestIdleCallback' in window) {
      const idleId = window.requestIdleCallback(() => router.prefetch(route), { timeout: 3_000 });
      return () => window.cancelIdleCallback(idleId);
    }

    const timer = globalThis.setTimeout(() => router.prefetch(route), 1_500);
    return () => globalThis.clearTimeout(timer);
  }, [pathname, router]);

  return null;
}
