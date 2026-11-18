'use client';

import { useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { EventCardVM, EventFilter, GeoPoint } from '../shared/types';
import { FEED_PAGE_SIZE, fetchEventsPage, type FeedCursor } from './communityFeedRpc';
import { mapEventRow, nextFeedCursor, normalizeRouteTrace } from './communityFeedMappers';
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
      const traceByEvent = new Map<string, Array<[number, number]>>();
      if (rows.length > 0) {
        try {
          const supabase = createClient();
          const { data: postRows } = await supabase
            .from('community_posts')
            .select('creation_meta, snapshot_payload')
            .not('creation_meta', 'is', null)
            .order('created_at', { ascending: false })
            .limit(60);
          for (const pr of (postRows ?? []) as Array<Record<string, unknown>>) {
            const meta = (pr.creation_meta ?? pr.snapshot_payload ?? {}) as Record<string, unknown>;
            const evId = typeof meta.event_id === 'string' ? meta.event_id : null;
            if (!evId || traceByEvent.has(evId)) continue;
            const pts = normalizeRouteTrace(
              meta.trace ?? meta.route ?? (meta.map_points as { trace?: unknown } | undefined)?.trace,
            );
            if (pts && pts.length >= 2) traceByEvent.set(evId, pts);
          }
        } catch {
          /* repli sans tracé */
        }
      }
      return {
        ok: true,
        items: rows.map((row) => ({
          ...mapEventRow(row),
          routeTrace: traceByEvent.get(row.id) ?? null,
        })),
        nextCursor: nextFeedCursor(rows, FEED_PAGE_SIZE),
      };
    },
    [filter, day, nearLat, nearLng],
  );

  return useCursorFeed<EventCardVM>({ resetKey, enabled, loadPage });
}

export default useEventsFeed;
