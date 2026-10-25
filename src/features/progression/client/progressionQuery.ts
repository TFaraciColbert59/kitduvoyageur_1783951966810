'use client';

import { queryOptions, type QueryClient } from '@tanstack/react-query';
import type { TerritorialLeaderboard, UserProgressionProfile } from '../domain/types';

export const PROGRESSION_REFRESH_MS = 30_000;
export const progressionQueryKey = (userId: string) => ['progression-private', userId] as const;

async function fetchJson(url: string, signal: AbortSignal): Promise<unknown> {
  const response = await fetch(url, { cache: 'no-store', signal });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
}

export function progressionProfileQuery(userId: string) {
  return queryOptions({
    queryKey: [...progressionQueryKey(userId), 'profile'],
    queryFn: async ({ signal }): Promise<UserProgressionProfile> => {
      if (!userId) throw new Error('Progression requires a user');
      const payload = await fetchJson('/api/progression', signal) as {
        success?: boolean; profile?: UserProgressionProfile;
      } | null;
      if (!payload?.success || !payload.profile || payload.profile.userId !== userId) {
        throw new Error('Invalid progression owner or payload');
      }
      return payload.profile;
    },
    staleTime: PROGRESSION_REFRESH_MS,
    gcTime: 5 * 60_000,
    retry: false,
    // Delayed server producers have no browser acknowledgement. Refresh their
    // canonical projection while visible; never estimate or optimistically add XP.
    refetchInterval: PROGRESSION_REFRESH_MS,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    networkMode: 'always',
  });
}

export function progressionCityRankQuery(userId: string) {
  return queryOptions({
    queryKey: [...progressionQueryKey(userId), 'city-rank'],
    queryFn: async ({ signal }): Promise<number | null> => {
      if (!userId) throw new Error('Progression requires a user');
      const payload = await fetchJson('/api/progression/leaderboard?filter=city&limit=1', signal) as {
        success?: boolean; leaderboard?: TerritorialLeaderboard;
      } | null;
      if (!payload?.success || !payload.leaderboard) throw new Error('Invalid leaderboard payload');
      const rank = payload.leaderboard.rank;
      return typeof rank === 'number' && Number.isFinite(rank) && rank > 0 ? rank : null;
    },
    staleTime: PROGRESSION_REFRESH_MS,
    retry: false,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    networkMode: 'always',
  });
}

/** Call only after a confirmed server attribution, including idempotent replay. */
export async function invalidateProgressionQueries(client: QueryClient, userId: string): Promise<void> {
  if (!userId) return;
  await client.invalidateQueries({ queryKey: progressionQueryKey(userId) });
}
