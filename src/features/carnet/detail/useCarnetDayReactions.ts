'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { fetchPublicProfilesWith } from '@/lib/queries/publicProfilesCore';
import type { CarnetComment } from './useCarnetComments';

export interface UseCarnetDayReactionsArgs {
  carnetId: string;
  dayNumber: number;
  initialLikes?: number;
  initialLiked?: boolean;
  userId: string | null;
  onRequireAuth?: () => void;
  onIsland?: (message: string, undo?: () => void) => void;
}

export function useCarnetDayReactions({
  carnetId,
  dayNumber,
  initialLikes = 0,
  initialLiked = false,
  userId,
  onRequireAuth,
  onIsland,
}: UseCarnetDayReactionsArgs) {
  const supabase = useMemo(() => createClient(), []);
  const [liked, setLiked] = useState(initialLiked);
  const [likesCount, setLikesCount] = useState(initialLikes);
  const [comments, setComments] = useState<CarnetComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLiked(initialLiked);
    setLikesCount(initialLikes);
  }, [initialLiked, initialLikes]);

  const loadComments = useCallback(async () => {
    if (!carnetId || dayNumber < 1) return;
    setLoading(true);
    setError(null);
    try {
      const { data, error: err } = await supabase
        .from('carnet_day_comments')
        .select('id, carnet_id, jour_numero, author_id, content, created_at, deleted_at')
        .eq('carnet_id', carnetId)
        .eq('jour_numero', dayNumber)
        .is('deleted_at', null)
        .order('created_at', { ascending: true });

      if (err) throw err;
      const rows = data ?? [];
      const profiles = await fetchPublicProfilesWith(
        supabase as never,
        rows.map((r) => r.author_id),
      );

      const items: CarnetComment[] = rows.map((r) => {
        const p = r.author_id ? profiles[r.author_id] : undefined;
        return {
          id: r.id,
          authorId: r.author_id,
          authorName: p?.full_name?.trim() || p?.handle?.trim() || 'Auteur',
          authorHandle: p?.handle?.trim() || null,
          authorAvatar: p?.avatar_url ?? null,
          content: r.content,
          createdAt: r.created_at,
        };
      });
      setComments(items);
    } catch {
      setError('Impossible de charger les commentaires du jour.');
    } finally {
      setLoading(false);
    }
  }, [carnetId, dayNumber, supabase]);

  useEffect(() => {
    void loadComments();
  }, [loadComments]);

  const toggleLike = useCallback(async () => {
    if (!userId) {
      onRequireAuth?.();
      return;
    }
    const next = !liked;
    setLiked(next);
    setLikesCount((prev) => Math.max(0, prev + (next ? 1 : -1)));

    try {
      if (next) {
        const { error: err } = await supabase
          .from('carnet_day_likes')
          .insert({
            carnet_id: carnetId,
            jour_numero: dayNumber,
            user_id: userId,
          });
        if (err) throw err;
      } else {
        const { error: err } = await supabase
          .from('carnet_day_likes')
          .delete()
          .eq('carnet_id', carnetId)
          .eq('jour_numero', dayNumber)
          .eq('user_id', userId);
        if (err) throw err;
      }
    } catch {
      // Rollback
      setLiked(!next);
      setLikesCount((prev) => Math.max(0, prev + (next ? -1 : 1)));
    }
  }, [carnetId, dayNumber, liked, onRequireAuth, supabase, userId]);

  const addComment = useCallback(
    async (content: string) => {
      const trimmed = content.trim();
      if (!trimmed || !userId) {
        if (!userId) onRequireAuth?.();
        return false;
      }

      const tempId = `temp-${Date.now()}`;
      const optimistic: CarnetComment = {
        id: tempId,
        authorId: userId,
        authorName: 'Moi',
        authorAvatar: null,
        content: trimmed,
        createdAt: new Date().toISOString(),
      };

      setComments((prev) => [...prev, optimistic]);

      try {
        const { data, error: err } = await supabase
          .from('carnet_day_comments')
          .insert({
            carnet_id: carnetId,
            jour_numero: dayNumber,
            author_id: userId,
            content: trimmed,
          })
          .select('id, created_at')
          .single();

        if (err || !data) throw err;

        setComments((prev) =>
          prev.map((c) => (c.id === tempId ? { ...c, id: data.id, createdAt: data.created_at } : c)),
        );

        onIsland?.('Commentaire publié', () => {
          void deleteComment(data.id);
        });
        return true;
      } catch {
        setComments((prev) => prev.filter((c) => c.id !== tempId));
        onIsland?.('Échec de la publication');
        return false;
      }
    },
    [carnetId, dayNumber, onIsland, onRequireAuth, supabase, userId],
  );

  const deleteComment = useCallback(
    async (commentId: string) => {
      const removed = comments.find((c) => c.id === commentId);
      if (!removed) return;

      setComments((prev) => prev.filter((c) => c.id !== commentId));

      try {
        const { error: err } = await supabase
          .from('carnet_day_comments')
          .update({ deleted_at: new Date().toISOString() })
          .eq('id', commentId);

        if (err) throw err;

        onIsland?.('Commentaire supprimé', () => {
          setComments((prev) => [...prev, removed]);
          void supabase.from('carnet_day_comments').update({ deleted_at: null }).eq('id', commentId);
        });
      } catch {
        // Rollback
        setComments((prev) => [...prev, removed]);
        onIsland?.('Impossible de supprimer');
      }
    },
    [comments, onIsland, supabase],
  );

  return {
    liked,
    likesCount,
    comments,
    loading,
    error,
    toggleLike,
    addComment,
    deleteComment,
    reloadComments: loadComments,
  };
}
