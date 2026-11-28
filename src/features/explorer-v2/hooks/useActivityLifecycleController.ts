'use client';

import { useCallback, useMemo } from 'react';
import {
  discardServerSession,
  loadSessionForSync,
} from '../activity/sessionSync';
import { forgetFinishedSession } from '../activity/localSession';
import { resolveActivityProfile } from '../specs/resolveActivityProfile';
import type { ActivityProfileSpec } from '../specs/activityProfileSpec.types';
import { useExplorerStore } from '../state/store';

export interface ExplorerFeatureFlags {
  nativeTrackerV2: boolean;
  baseUiDrawersV2: boolean;
  expertSubDrawersLazy: boolean;
}

const DEFAULT_FLAGS: ExplorerFeatureFlags = {
  nativeTrackerV2: true,
  baseUiDrawersV2: true,
  expertSubDrawersLazy: true,
};

/**
 * Lot 06 — Contrôleur découplé extrait hors du monolithe `ExplorerV2.tsx` (6 687 LOC)
 * utilisant uniquement des sélecteurs Zustand atomiques (fin des 4–6 re-renders/fix).
 */
export function useActivityLifecycleController(flagsOverride?: Partial<ExplorerFeatureFlags>) {
  const activeSport = useExplorerStore((s) => s.activity?.sport ?? s.summary?.sport ?? null);
  const activeVariantId = useExplorerStore(
    (s) => s.activity?.selection?.variantId ?? s.summary?.selection?.variantId ?? null,
  );
  const isPaused = useExplorerStore((s) => s.activity?.paused ?? false);
  const distanceM = useExplorerStore((s) => s.activity?.distanceM ?? 0);
  const elevGainM = useExplorerStore((s) => s.activity?.elevGainM ?? 0);
  const movingS = useExplorerStore((s) => s.activity?.movingS ?? 0);

  const flags = useMemo<ExplorerFeatureFlags>(
    () => ({ ...DEFAULT_FLAGS, ...flagsOverride }),
    [flagsOverride],
  );

  const activeProfile = useMemo<ActivityProfileSpec>(
    () => resolveActivityProfile(activeVariantId ?? activeSport),
    [activeVariantId, activeSport],
  );

  const completeAndForgetSummary = useCallback(async (clientSessionId?: string | null) => {
    if (clientSessionId) {
      await forgetFinishedSession(clientSessionId).catch(() => undefined);
    }
    useExplorerStore.setState({ summary: null, sheet: 'level', detent: 'peek' });
  }, []);

  const discardAndPurgeSummary = useCallback(async (clientSessionId?: string | null) => {
    if (clientSessionId) {
      const rec = await loadSessionForSync(clientSessionId).catch(() => null);
      if (rec?.serverSessionId) {
        await discardServerSession(rec.serverSessionId).catch(() => false);
      }
      await forgetFinishedSession(clientSessionId).catch(() => undefined);
    }
    useExplorerStore.setState({ summary: null, sheet: 'level', detent: 'peek' });
  }, []);

  return {
    flags,
    activeProfile,
    liveMetrics: { distanceM, elevGainM, movingS, isPaused },
    completeAndForgetSummary,
    discardAndPurgeSummary,
  };
}
