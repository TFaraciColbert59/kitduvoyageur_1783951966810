'use client';

import { useCallback, useMemo, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { CarnetEngagement } from './types';

export interface UseCarnetEngagementArgs {
  carnetId: string;
  initial: CarnetEngagement;
  userId: string | null;
  onRequireAuth?: () => void;
}

/** Like et favori optimistes, avec retour arrière si l'écriture échoue. */
export function useCarnetEngagement({
  carnetId,
  initial,
  userId,
  onRequireAuth,
}: UseCarnetEngagementArgs) {
  const supabase = useMemo(() => createClient(), []);
  const [liked, setLiked] = useState(initial.liked);
  const [likes, setLikes] = useState(initial.likes);
  const [favorited, setFavorited] = useState(initial.favorited);
  const [favorites, setFavorites] = useState(0);
  const viewSent = useRef(false);

  const toggleLike = useCallback(async () => {
    if (!userId) {
      onRequireAuth?.();
      return;
    }
    const next = !liked;
    setLiked(next);
    setLikes((value) => Math.max(0, value + (next ? 1 : -1)));
    try {
      if (next) {
        const { error } = await supabase
          .from('carnet_likes')
          .upsert(
            { carnet_id: carnetId, user_id: userId, reaction: 'like' },
            { onConflict: 'carnet_id,user_id' },
          );
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('carnet_likes')
          .delete()
          .eq('carnet_id', carnetId)
          .eq('user_id', userId);
        if (error) throw error;
      }
    } catch {
      setLiked(!next);
      setLikes((value) => Math.max(0, value + (next ? -1 : 1)));
    }
  }, [carnetId, liked, onRequireAuth, supabase, userId]);

  const toggleFavorite = useCallback(async () => {
    if (!userId) {
      onRequireAuth?.();
      return;
    }
    const next = !favorited;
    setFavorited(next);
    setFavorites((value) => Math.max(0, value + (next ? 1 : -1)));
    try {
      if (next) {
        const { error } = await supabase
          .from('carnet_favorites')
          .insert({ carnet_id: carnetId, user_id: userId });
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('carnet_favorites')
          .delete()
          .eq('carnet_id', carnetId)
          .eq('user_id', userId);
        if (error) throw error;
      }
    } catch {
      setFavorited(!next);
      setFavorites((value) => Math.max(0, value + (next ? -1 : 1)));
    }
  }, [carnetId, favorited, onRequireAuth, supabase, userId]);

  /** Une vue par montage : `carnet_views` accepte l'insertion publique. */
  const registerView = useCallback(async () => {
    if (viewSent.current) return;
    viewSent.current = true;
    try {
      await supabase.from('carnet_views').insert({ carnet_id: carnetId, user_id: userId });
    } catch {
      viewSent.current = false;
    }
  }, [carnetId, supabase, userId]);

  return { liked, likes, favorited, favorites, toggleLike, toggleFavorite, registerView };
}

export default useCarnetEngagement;
