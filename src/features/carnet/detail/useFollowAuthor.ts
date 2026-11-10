'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

export interface UseFollowAuthorOptions {
  /** Auteur du carnet : « suivre le carnet » abonne à son auteur. */
  authorId: string | null;
  userId: string | null;
  onRequireAuth?: () => void;
  onIsland?: (message: string, undo?: () => void, subtitle?: string) => void;
}

/**
 * Suivre le carnet (menu visiteur) = suivre son auteur dans `user_follows`
 * (RLS : `follower_id = auth.uid()`). Aucune table de suivi propre au carnet.
 */
export function useFollowAuthor({ authorId, userId, onRequireAuth, onIsland }: UseFollowAuthorOptions) {
  const supabase = useMemo(() => createClient(), []);
  const [following, setFollowing] = useState(false);
  const busy = useRef(false);

  useEffect(() => {
    if (!userId || !authorId || userId === authorId) return;
    let cancelled = false;
    void Promise.resolve(
      supabase
        .from('user_follows')
        .select('following_id')
        .eq('follower_id', userId)
        .eq('following_id', authorId)
        .maybeSingle()
    ).then((res: { data?: unknown }) => {
      if (!cancelled) setFollowing(Boolean(res?.data));
    });
    return () => {
      cancelled = true;
    };
  }, [authorId, supabase, userId]);

  const write = useCallback(
    async (next: boolean): Promise<boolean> => {
      if (!userId || !authorId) return false;
      const { error } = next
        ? await supabase
            .from('user_follows')
            .upsert(
              { follower_id: userId, following_id: authorId },
              { onConflict: 'follower_id,following_id', ignoreDuplicates: true }
            )
        : await supabase
            .from('user_follows')
            .delete()
            .eq('follower_id', userId)
            .eq('following_id', authorId);
      return !error;
    },
    [authorId, supabase, userId]
  );

  const toggle = useCallback(async () => {
    if (!userId) {
      onRequireAuth?.();
      return;
    }
    if (!authorId || userId === authorId || busy.current) return;
    busy.current = true;
    const next = !following;
    setFollowing(next);
    const ok = await write(next);
    busy.current = false;
    if (!ok) {
      setFollowing(!next);
      onIsland?.('L’abonnement n’a pas été enregistré');
      return;
    }
    onIsland?.(
      next ? 'Carnet suivi' : 'Carnet non suivi',
      () => {
        setFollowing(!next);
        void write(!next);
      },
      next ? 'Tu seras prévenu des nouveaux moments.' : undefined
    );
  }, [authorId, following, onIsland, onRequireAuth, userId, write]);

  return { following, toggle };
}
