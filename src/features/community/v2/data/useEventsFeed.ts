'use client';

import { useCallback } from 'react';
import type { EventCardVM, EventFilter, GeoPoint } from '../shared/types';
import { FEED_PAGE_SIZE, fetchEventsPage, type FeedCursor } from './communityFeedRpc';
import { mapEventRow, nextFeedCursor } from './communityFeedMappers';
import { useCursorFeed, type CursorFeedResult, type FeedPageOutcome } from './useCursorFeed';

export interface EventsFeedParams {
  filter: EventFilter;
  /** Jour ISO sélectionné dans la bande agenda (ou `null`). */
  day: string | null;
  near: GeoPoint | null;
  enabled?: boolean;
}

/**
 * Volet Sorties — pagination chronologique par curseur (ordre serveur fixe),
 * filtre de jour de la bande agenda et « Près de moi ».
 */
export function useEventsFeed({ filter, day, near, enabled = true }: EventsFeedParams): CursorFeedResult<EventCardVM> {
  const nearLat = near?.lat ?? null;
  const nearLng = near?.lng ?? null;
  const resetKey = `events|${filter}|${day ?? ''}|${nearLat ?? ''}|${nearLng ?? ''}`;

  const loadPage = useCallback(
    async (cursor: FeedCursor | null): Promise<FeedPageOutcome<EventCardVM>> => {
      const page = await fetchEventsPage({
        filter,
        day,
        lat: nearLat,
        lng: nearLng,
        cursor,
        limit: FEED_PAGE_SIZE,
      });
      if (page.error) {
        return { ok: false, items: [], nextCursor: null, message: 'Les sorties sont indisponibles.' };
      }
      const rows = Array.isArray(page.data) ? page.data : [];
      return {
        ok: true,
        items: rows.map((row) => mapEventRow(row)),
        nextCursor: nextFeedCursor(rows, FEED_PAGE_SIZE),
      };
    },
    [filter, day, nearLat, nearLng],
  );

  return useCursorFeed<EventCardVM>({ resetKey, enabled, loadPage });
}

export default useEventsFeed;
