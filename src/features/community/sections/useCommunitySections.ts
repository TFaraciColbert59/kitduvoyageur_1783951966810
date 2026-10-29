'use client';

import { useCallback, useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { fetchPublicProfilesWith } from '@/lib/queries/publicProfilesCore';

export interface CarnetRow {
  id: string;
  title: string;
  description?: string | null;
  cover_image?: string | null;
  author_id?: string | null;
  created_at?: string | null;
  author_name?: string;
  like_count?: number;
  comment_count?: number;
  liked?: boolean;
}

export interface ClubRow {
  id: string;
  name: string;
  slug?: string | null;
  description?: string | null;
  cover_image?: string | null;
  category?: string | null;
  members_count?: number | null;
  is_member?: boolean;
}

export interface EventRow {
  id: string;
  title: string;
  description?: string | null;
  event_date?: string | null;
  location?: string | null;
  cover_image?: string | null;
  current_participants?: number | null;
  max_participants?: number | null;
  is_registered?: boolean;
}

export interface SectionsData {
  carnets: CarnetRow[];
  clubs: ClubRow[];
  sorties: EventRow[];
  loading: boolean;
  error: string | null;
  reload: () => Promise<void>;
  joinClub: (club: ClubRow) => Promise<boolean>;
  leaveClub: (club: ClubRow) => Promise<boolean>;
  toggleEvent: (event: EventRow) => Promise<boolean>;
  toggleCarnetLike: (carnet: CarnetRow) => Promise<boolean>;
}

export function useCommunitySections(
  user: { id?: string } | null | undefined,
  enabled = true
): SectionsData {
  const [carnets, setCarnets] = useState<CarnetRow[]>([]);
  const [clubs, setClubs] = useState<ClubRow[]>([]);
  const [sorties, setSorties] = useState<EventRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!enabled) return;
    setLoading(true);
    setError(null);
    try {
      const supabase = createClient();
      const today = new Date().toISOString().slice(0, 10);

      let carnetQuery = supabase
        .from('carnets')
        .select('id,title,description,cover_image,author_id,created_at,visibility')
        .order('created_at', { ascending: false })
        .limit(12);
      if (user?.id) carnetQuery = carnetQuery.or(`visibility.eq.public,author_id.eq.${user.id}`);
      else carnetQuery = carnetQuery.eq('visibility', 'public');

      const [carnetsRes, clubsRes, eventsRes] = await Promise.all([
        carnetQuery,
        supabase.from('clubs').select('*').order('members_count', { ascending: false }).limit(12),
        supabase
          .from('events')
          .select('*')
          .gte('event_date', today)
          .neq('status', 'cancelled')
          .order('event_date', { ascending: true })
          .limit(12),
      ]);
      if (carnetsRes.error) throw carnetsRes.error;
      if (clubsRes.error) throw clubsRes.error;
      if (eventsRes.error) throw eventsRes.error;

      const carnetRows = (carnetsRes.data ?? []) as CarnetRow[];
      const clubRows = (clubsRes.data ?? []) as ClubRow[];
      const eventRows = (eventsRes.data ?? []) as EventRow[];
      const profiles = await fetchPublicProfilesWith(
        supabase,
        carnetRows.map((row) => row.author_id)
      );

      let memberIds = new Set<string>();
      let registeredIds = new Set<string>();
      if (user?.id) {
        const [memberships, registrations] = await Promise.all([
          supabase
            .from('club_members')
            .select('club_id')
            .eq('user_id', user.id)
            .eq('status', 'active'),
          supabase.from('event_participants').select('event_id').eq('user_id', user.id),
        ]);
        memberIds = new Set(
          (memberships.data ?? []).map((row: { club_id: string }) => row.club_id)
        );
        registeredIds = new Set(
          (registrations.data ?? []).map((row: { event_id: string }) => row.event_id)
        );
      }

      // Compteurs de la tuile : tolérés en échec (la tuile s'affiche alors sans chiffres).
      const carnetIds = carnetRows.map((row) => row.id);
      const likeCounts = new Map<string, number>();
      const commentCounts = new Map<string, number>();
      const likedByMe = new Set<string>();
      if (carnetIds.length > 0) {
        const [likesRes, commentsRes] = await Promise.all([
          supabase
            .from('carnet_likes')
            .select('carnet_id,user_id')
            .in('carnet_id', carnetIds)
            .limit(5000),
          supabase
            .from('carnet_comments')
            .select('carnet_id')
            .in('carnet_id', carnetIds)
            .limit(5000),
        ]);
        for (const row of (likesRes.data ?? []) as Array<{ carnet_id: string; user_id: string }>) {
          likeCounts.set(row.carnet_id, (likeCounts.get(row.carnet_id) ?? 0) + 1);
          if (user?.id && row.user_id === user.id) likedByMe.add(row.carnet_id);
        }
        for (const row of (commentsRes.data ?? []) as Array<{ carnet_id: string }>) {
          commentCounts.set(row.carnet_id, (commentCounts.get(row.carnet_id) ?? 0) + 1);
        }
      }

      setCarnets(
        carnetRows.map((row) => ({
          ...row,
          author_name: row.author_id
            ? (profiles[row.author_id]?.full_name ?? 'Voyageur')
            : 'Voyageur',
          like_count: likeCounts.get(row.id) ?? 0,
          comment_count: commentCounts.get(row.id) ?? 0,
          liked: likedByMe.has(row.id),
        }))
      );
      setClubs(clubRows.map((row) => ({ ...row, is_member: memberIds.has(row.id) })));
      setSorties(eventRows.map((row) => ({ ...row, is_registered: registeredIds.has(row.id) })));
    } catch {
      setError('Les sections n’ont pas pu être chargées.');
    } finally {
      setLoading(false);
    }
  }, [enabled, user?.id]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const joinClub = useCallback(
    async (club: ClubRow) => {
      if (!user?.id) return false;
      const supabase = createClient();
      const { error: joinError } = await supabase
        .from('club_members')
        .insert({ club_id: club.id, user_id: user.id, role: 'member', status: 'active' });
      if (joinError) return false;
      await supabase
        .from('clubs')
        .update({ members_count: Number(club.members_count ?? 0) + 1 })
        .eq('id', club.id);
      setClubs((prev) =>
        prev.map((row) =>
          row.id === club.id
            ? { ...row, is_member: true, members_count: Number(row.members_count ?? 0) + 1 }
            : row
        )
      );
      return true;
    },
    [user?.id]
  );

  const leaveClub = useCallback(
    async (club: ClubRow) => {
      if (!user?.id) return false;
      const supabase = createClient();
      const { error: leaveError } = await supabase
        .from('club_members')
        .delete()
        .eq('club_id', club.id)
        .eq('user_id', user.id);
      if (leaveError) return false;
      await supabase
        .from('clubs')
        .update({ members_count: Math.max(0, Number(club.members_count ?? 0) - 1) })
        .eq('id', club.id);
      setClubs((prev) =>
        prev.map((row) =>
          row.id === club.id
            ? {
                ...row,
                is_member: false,
                members_count: Math.max(0, Number(row.members_count ?? 0) - 1),
              }
            : row
        )
      );
      return true;
    },
    [user?.id]
  );

  const toggleCarnetLike = useCallback(
    async (carnet: CarnetRow) => {
      if (!user?.id) return false;
      const supabase = createClient();
      const next = !carnet.liked;
      const apply = (liked: boolean, delta: number) =>
        setCarnets((prev) =>
          prev.map((row) =>
            row.id === carnet.id
              ? { ...row, liked, like_count: Math.max(0, (row.like_count ?? 0) + delta) }
              : row
          )
        );
      apply(next, next ? 1 : -1);
      const { error: likeError } = next
        ? await supabase
            .from('carnet_likes')
            .upsert(
              { carnet_id: carnet.id, user_id: user.id, reaction: 'like' },
              { onConflict: 'carnet_id,user_id' }
            )
        : await supabase
            .from('carnet_likes')
            .delete()
            .eq('carnet_id', carnet.id)
            .eq('user_id', user.id);
      if (likeError) {
        apply(!next, next ? -1 : 1);
        return false;
      }
      return true;
    },
    [user?.id]
  );

  const toggleEvent = useCallback(
    async (event: EventRow) => {
      if (!user?.id) return false;
      const supabase = createClient();
      const { data, error: rpcError } = await supabase.rpc(
        event.is_registered ? 'leave_event' : 'join_event',
        {
          p_event_id: event.id,
        }
      );
      if (rpcError) return false;
      const result = (data ?? {}) as { current_participants?: number; status?: string };
      setSorties((prev) =>
        prev.map((row) =>
          row.id === event.id
            ? {
                ...row,
                is_registered: !row.is_registered,
                current_participants: result.current_participants ?? row.current_participants,
              }
            : row
        )
      );
      return true;
    },
    [user?.id]
  );

  return {
    carnets,
    clubs,
    sorties,
    loading,
    error,
    reload,
    joinClub,
    leaveClub,
    toggleEvent,
    toggleCarnetLike,
  };
}

export default useCommunitySections;
