'use client';

import { useCallback, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

export interface MyClubV2 {
  id: string;
  name: string;
  slug: string;
  avatarUrl?: string | null;
  activity?: string | null;
}

/**
 * Clubs dont l'utilisateur est membre actif — sert à l'audience « Un club »
 * d'une publication et au rattachement d'une sortie, sans saisir d'identifiant.
 * Chargement paresseux, une seule requête.
 */
export function useMyClubsV2(userId: string | null | undefined) {
  const [clubs, setClubs] = useState<MyClubV2[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requested = useRef(false);

  const load = useCallback(async () => {
    if (!userId || requested.current) return;
    requested.current = true;
    setLoading(true);
    setError(null);
    try {
      const supabase = createClient();
      const { data } = await supabase
        .from('club_members')
        .select('club_id, clubs(id, name, slug, avatar_url, activity)')
        .eq('user_id', userId)
        .eq('status', 'active')
        .limit(20);
      const rows = Array.isArray(data) ? data : [];
      setClubs(
        rows
          .map((row) => {
            const raw = (row as { clubs?: unknown }).clubs;
            const club = Array.isArray(raw) ? raw[0] : raw;
            if (!club || typeof club !== 'object') return null;
            const record = club as Record<string, unknown>;
            if (typeof record.id !== 'string') return null;
            return {
              id: record.id,
              name: String(record.name ?? 'Club'),
              slug: String(record.slug ?? ''),
              avatarUrl: typeof record.avatar_url === 'string' ? record.avatar_url : null,
              activity: typeof record.activity === 'string' ? record.activity : null,
            };
          })
          .filter((entry) => entry !== null),
      );
    } catch {
      setClubs([]);
      setError('Liste des clubs indisponible.');
    } finally {
      setLoading(false);
    }
  }, [userId]);

  return { clubs, loading, error, load };
}
