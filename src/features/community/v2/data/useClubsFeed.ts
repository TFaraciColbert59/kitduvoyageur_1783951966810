'use client';

import { useCallback } from 'react';
import type { ClubCardVM, ClubFilter, ClubSort, GeoPoint } from '../shared/types';
import { FEED_PAGE_SIZE, fetchClubsPage, type FeedCursor } from './communityFeedRpc';
import { mapClubRow, nextFeedCursor } from './communityFeedMappers';
import { useCursorFeed, type CursorFeedResult, type FeedPageOutcome } from './useCursorFeed';

export interface ClubsFeedParams {
  filter: ClubFilter;
  sort: ClubSort;
  /** Chip d'activité (`null` = toutes). */
  activity: string | null;
  near: GeoPoint | null;
  enabled?: boolean;
}

/**
 * Volet Clubs — pagination par curseur, filtre d'activité, tri serveur.
 * Le club « secret » n'est jamais renvoyé à un non-membre par la RLS.
 */
export function useClubsFeed({
  filter,
  sort,
  activity,
  near,
  enabled = true,
}: ClubsFeedParams): CursorFeedResult<ClubCardVM> {
  const nearLat = near?.lat ?? null;
  const nearLng = near?.lng ?? null;
  const resetKey = `clubs|${filter}|${sort}|${activity ?? ''}|${nearLat ?? ''}|${nearLng ?? ''}`;

  const loadPage = useCallback(
    async (cursor: FeedCursor | null): Promise<FeedPageOutcome<ClubCardVM>> => {
      const page = await fetchClubsPage({
        filter,
        sort,
        activity,
        lat: nearLat,
        lng: nearLng,
        cursor,
        limit: FEED_PAGE_SIZE,
      });
      if (page.error) {
        return { ok: false, items: [], nextCursor: null, message: 'Les clubs sont indisponibles.' };
      }
      const rows = Array.isArray(page.data) ? page.data : [];
      return {
        ok: true,
        items: rows.map(mapClubRow),
        nextCursor: nextFeedCursor(rows, FEED_PAGE_SIZE),
      };
    },
    [filter, sort, activity, nearLat, nearLng],
  );

  return useCursorFeed<ClubCardVM>({ resetKey, enabled, loadPage });
}

export default useClubsFeed;
