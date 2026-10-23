'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

/**
 * Totaux réels de la Communauté.
 *
 * Un total n'est **jamais** une longueur de page (`posts.length`) : c'est un
 * `count` SQL. Si une requête échoue, le total vaut `null` et l'UI affiche
 * « — » au lieu d'un chiffre faux.
 */
export interface CommunityTotals {
  posts: number | null;
  clubs: number | null;
  events: number | null;
}

export const EMPTY_COMMUNITY_TOTALS: CommunityTotals = {
  posts: null,
  clubs: null,
  events: null,
};

function countOf(result: { count: number | null; error: unknown }): number | null {
  if (result.error) return null;
  return typeof result.count === 'number' ? result.count : null;
}

export function useCommunityTotals(): CommunityTotals {
  const [totals, setTotals] = useState<CommunityTotals>(EMPTY_COMMUNITY_TOTALS);

  useEffect(() => {
    let active = true;
    const supabase = createClient();
    const today = new Date().toISOString().slice(0, 10);

    Promise.all([
      supabase.from('community_posts').select('*', { count: 'exact', head: true }),
      supabase.from('clubs').select('*', { count: 'exact', head: true }),
      supabase
        .from('events')
        .select('*', { count: 'exact', head: true })
        .gte('event_date', today)
        .neq('status', 'past'),
    ])
      .then(([posts, clubs, events]) => {
        if (!active) return;
        setTotals({
          posts: countOf(posts),
          clubs: countOf(clubs),
          events: countOf(events),
        });
      })
      .catch(() => {
        if (active) setTotals(EMPTY_COMMUNITY_TOTALS);
      });

    return () => {
      active = false;
    };
  }, []);

  return totals;
}

export default useCommunityTotals;
