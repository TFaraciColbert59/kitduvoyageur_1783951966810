'use client';

import { useCallback } from 'react';
import type { CarnetCardVM, CarnetFilter, CarnetSort, GeoPoint } from '../shared/types';
import {
  FEED_PAGE_SIZE,
  fetchCarnetsPage,
  type FeedCursor,
} from './communityFeedRpc';
import { fetchCarnetExtras } from './communityDetails';
import { mapCarnetRow, nextFeedCursor } from './communityFeedMappers';
import { useCursorFeed, type CursorFeedResult, type FeedPageOutcome } from './useCursorFeed';

export interface CarnetsFeedParams {
  filter: CarnetFilter;
  sort: CarnetSort;
  /** Point « Près de moi » (null si refusé ou non demandé). */
  near: GeoPoint | null;
  /** `false` : volet inactif, aucune requête (mémoire de session). */
  enabled?: boolean;
}

/**
 * Volet Carnets — pagination par curseur, compteurs serveur, tri serveur.
 * Les extras de tuile (trace de couverture, badge GPS vérifiée) sont lus en lot
 * après la page : un échec de cette lecture optionnelle ne casse pas la liste.
 */
export function useCarnetsFeed({ filter, sort, near, enabled = true }: CarnetsFeedParams): CursorFeedResult<CarnetCardVM> {
  const nearLat = near?.lat ?? null;
  const nearLng = near?.lng ?? null;
  const resetKey = `carnets|${filter}|${sort}|${nearLat ?? ''}|${nearLng ?? ''}`;

  const loadPage = useCallback(
    async (cursor: FeedCursor | null): Promise<FeedPageOutcome<CarnetCardVM>> => {
      const page = await fetchCarnetsPage({
        filter,
        sort,
        lat: nearLat,
        lng: nearLng,
        cursor,
        limit: FEED_PAGE_SIZE,
      });
      if (page.error) {
        return { ok: false, items: [], nextCursor: null, message: 'Les carnets sont indisponibles.' };
      }
      const rows = Array.isArray(page.data) ? page.data : [];
      const extras = await fetchCarnetExtras(rows.map((row) => row.id));
      return {
        ok: true,
        items: rows.map((row) => mapCarnetRow(row, extras[row.id])),
        nextCursor: nextFeedCursor(rows, FEED_PAGE_SIZE),
      };
    },
    [filter, sort, nearLat, nearLng],
  );

  return useCursorFeed<CarnetCardVM>({ resetKey, enabled, loadPage });
}

export default useCarnetsFeed;
