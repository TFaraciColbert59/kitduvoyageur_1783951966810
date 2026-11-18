'use client';

import { useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { CarnetCardVM, CarnetFilter, CarnetSort, GeoPoint } from '../shared/types';
import {
  FEED_PAGE_SIZE,
  fetchCarnetsPage,
  type CarnetFeedRow,
  type FeedCursor,
} from './communityFeedRpc';
import { fetchCarnetExtras } from './communityDetails';
import { mapCarnetRow, nextFeedCursor } from './communityFeedMappers';
import { useCursorFeed, type CursorFeedResult, type FeedPageOutcome } from './useCursorFeed';

async function fetchUserCarnetList(mode: 'saved' | 'liked'): Promise<CarnetCardVM[]> {
  const supabase = createClient();
  const { data: sessionData } = await supabase.auth.getSession();
  const uid = sessionData?.session?.user?.id ?? null;
  if (!uid) return [];

  let ids: string[] = [];
  if (mode === 'liked') {
    const { data } = await supabase
      .from('carnet_likes')
      .select('carnet_id')
      .eq('user_id', uid)
      .order('created_at', { ascending: false })
      .limit(30);
    ids = Array.from(new Set((data ?? []).map((r: { carnet_id?: string }) => String(r.carnet_id ?? '')).filter(Boolean)));
  } else {
    const [{ data: savedPosts }, { data: savedMoments }] = await Promise.all([
      supabase.from('post_saves').select('post_id').eq('user_id', uid).limit(40),
      supabase.from('carnet_moment_saves').select('moment_id').eq('user_id', uid).limit(40),
    ]);
    const postIds = (savedPosts ?? []).map((r: { post_id?: string }) => r.post_id).filter(Boolean) as string[];
    const momentIds = (savedMoments ?? []).map((r: { moment_id?: string }) => r.moment_id).filter(Boolean) as string[];
    const [postsRes, momentsRes] = await Promise.all([
      postIds.length > 0
        ? supabase.from('community_posts').select('creation_meta, snapshot_payload').in('id', postIds)
        : Promise.resolve({ data: [] }),
      momentIds.length > 0
        ? supabase.from('carnet_moments').select('carnet_id').in('id', momentIds)
        : Promise.resolve({ data: [] }),
    ]);
    const collected = new Set<string>();
    for (const m of (momentsRes.data ?? []) as Array<{ carnet_id?: string }>) {
      if (m.carnet_id) collected.add(String(m.carnet_id));
    }
    for (const p of (postsRes.data ?? []) as Array<{ creation_meta?: Record<string, unknown>; snapshot_payload?: Record<string, unknown> }>) {
      const cid = p.creation_meta?.carnet_id ?? p.snapshot_payload?.carnet_id;
      if (typeof cid === 'string' && cid) collected.add(cid);
    }
    ids = Array.from(collected).slice(0, 30);
  }

  if (ids.length === 0) return [];
  const [{ data: carnetRows }, extras] = await Promise.all([
    supabase
      .from('carnets')
      .select('id, title, destination, cover_image, user_id, start_date, end_date, nb_nuits, distance_km, elevation_gain_m, likes_count, comments_count, is_live, visibility, country_iso, created_at')
      .in('id', ids)
      .order('created_at', { ascending: false }),
    fetchCarnetExtras(ids),
  ]);
  const rows: CarnetFeedRow[] = ((carnetRows ?? []) as Array<Record<string, unknown>>).map((r) => ({
    id: String(r.id),
    title: (r.title as string | null) ?? null,
    destination: (r.destination as string | null) ?? null,
    cover_image: (r.cover_image as string | null) ?? null,
    author_id: (r.user_id as string | null) ?? null,
    author_name: null,
    author_avatar: null,
    start_date: (r.start_date as string | null) ?? null,
    end_date: (r.end_date as string | null) ?? null,
    nb_nuits: (r.nb_nuits as number | null) ?? null,
    route_distance_km: (r.distance_km as number | null) ?? null,
    elevation_gain_m: (r.elevation_gain_m as number | null) ?? null,
    likes_count: (r.likes_count as number | null) ?? 0,
    comments_count: (r.comments_count as number | null) ?? 0,
    liked_by_me: mode === 'liked',
    travelers: null,
    is_live: Boolean(r.is_live),
    lat: null,
    lng: null,
    distance_km: (r.distance_km as number | null) ?? null,
    visibility: (r.visibility as string | null) ?? 'public',
    country_iso: (r.country_iso as string | null) ?? null,
    sort_key: 0,
  }));
  return rows.map((row) => mapCarnetRow(row, extras[row.id]));
}

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
      if (filter === 'map') {
        return { ok: true, items: [], nextCursor: null };
      }
      if (filter === 'saved' || filter === 'liked') {
        try {
          const items = await fetchUserCarnetList(filter);
          return { ok: true, items, nextCursor: null };
        } catch {
          return { ok: false, items: [], nextCursor: null, message: 'Les carnets sont indisponibles.' };
        }
      }
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
