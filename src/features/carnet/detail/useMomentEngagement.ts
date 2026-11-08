'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { fetchPublicProfilesWith } from '@/lib/queries/publicProfilesCore';
import type { CarnetComment } from './useCarnetComments';

export interface UseMomentEngagementArgs {
  carnetId: string;
  momentId: string;
  initialLikes?: number;
  initialLiked?: boolean;
  initialSaves?: number;
  initialSaved?: boolean;
  userId: string | null;
  onRequireAuth?: () => void;
  onIsland?: (message: string, undo?: () => void) => void;
}

export function useMomentEngagement({
  momentId,
  initialLikes = 0,
  initialLiked = false,
  initialSaves = 0,
  initialSaved = false,
  userId,
  onRequireAuth,
  onIsland,
}: UseMomentEngagementArgs) {
  const supabase = useMemo(() => createClient(), []);
  const [liked, setLiked] = useState(initialLiked);
  const [likesCount, setLikesCount] = useState(initialLikes);
  const [saved, setSaved] = useState(initialSaved);
  const [savesCount, setSavesCount] = useState(initialSaves);
  const [comments, setComments] = useState<CarnetComment[]>([]);
  const [loadingComments, setLoadingComments] = useState(false);
  const [commentsLoaded, setCommentsLoaded] = useState(false);

  useEffect(() => {
    setLiked(initialLiked);
    setLikesCount(initialLikes);
    setSaved(initialSaved);
    setSavesCount(initialSaves);
  }, [initialLiked, initialLikes, initialSaved, initialSaves]);

  const loadComments = useCallback(async () => {
    if (!momentId) return;
    setLoadingComments(true);
    try {
      const { data, error } = await supabase
        .from('carnet_moment_comments')
        .select('id, moment_id, author_id, content, created_at, deleted_at')
        .eq('moment_id', momentId)
        .is('deleted_at', null)
        .order('created_at', { ascending: true });

      if (error) throw error;
      const rows = data ?? [];
      const profiles = await fetchPublicProfilesWith(
        supabase as never,
        rows.map((r) => r.author_id)
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
      setCommentsLoaded(true);
    } catch {
      // keep previous
    } finally {
      setLoadingComments(false);
    }
  }, [momentId, supabase]);

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
        const { error } = await supabase.from('carnet_moment_likes').insert({
          moment_id: momentId,
          user_id: userId,
        });
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('carnet_moment_likes')
          .delete()
            .eq('moment_id', momentId)
          .eq('user_id', userId);
        if (error) throw error;
      }
    } catch {
      setLiked(!next);
      setLikesCount((prev) => Math.max(0, prev + (next ? -1 : 1)));
    }
  }, [liked, momentId, onRequireAuth, supabase, userId]);

  const toggleSave = useCallback(async () => {
    if (!userId) {
      onRequireAuth?.();
      return;
    }
    const next = !saved;
    setSaved(next);
    setSavesCount((prev) => Math.max(0, prev + (next ? 1 : -1)));

    try {
      if (next) {
        const { error } = await supabase.from('carnet_moment_saves').insert({
          moment_id: momentId,
          user_id: userId,
        });
        if (error) throw error;
        onIsland?.('Moment enregistré dans ta sélection');
      } else {
        const { error } = await supabase
          .from('carnet_moment_saves')
          .delete()
            .eq('moment_id', momentId)
          .eq('user_id', userId);
        if (error) throw error;
      }
    } catch {
      setSaved(!next);
      setSavesCount((prev) => Math.max(0, prev + (next ? -1 : 1)));
    }
  }, [momentId, onIsland, onRequireAuth, saved, supabase, userId]);

  const addComment = useCallback(
    async (content: string) => {
      const trimmed = content.trim();
      if (!trimmed || !userId) {
        if (!userId) onRequireAuth?.();
        return false;
      }

      const tempId = `temp-m-${Date.now()}`;
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
        const { data, error } = await supabase
          .from('carnet_moment_comments')
          .insert({
              moment_id: momentId,
            author_id: userId,
            content: trimmed,
          })
          .select('id, created_at')
          .single();

        if (error || !data) throw error;

        setComments((prev) =>
          prev.map((c) => (c.id === tempId ? { ...c, id: data.id, createdAt: data.created_at } : c))
        );

        onIsland?.('Commentaire ajouté', () => {
          void deleteComment(data.id);
        });
        return true;
      } catch {
        setComments((prev) => prev.filter((c) => c.id !== tempId));
        onIsland?.('Échec de la publication');
        return false;
      }
    },
    [momentId, onIsland, onRequireAuth, supabase, userId]
  );

  const deleteComment = useCallback(
    async (commentId: string) => {
      const removed = comments.find((c) => c.id === commentId);
      if (!removed) return;

      setComments((prev) => prev.filter((c) => c.id !== commentId));

      try {
        const { error } = await supabase
          .from('carnet_moment_comments')
          .update({ deleted_at: new Date().toISOString() })
          .eq('id', commentId);

        if (error) throw error;

        onIsland?.('Commentaire supprimé', () => {
          setComments((prev) => [...prev, removed]);
          void supabase.from('carnet_moment_comments').update({ deleted_at: null }).eq('id', commentId);
        });
      } catch {
        setComments((prev) => [...prev, removed]);
        onIsland?.('Impossible de supprimer');
      }
    },
    [comments, onIsland, supabase]
  );

  return {
    liked,
    likesCount,
    saved,
    savesCount,
    comments,
    loadingComments,
    commentsLoaded,
    toggleLike,
    toggleSave,
    loadComments,
    addComment,
    deleteComment,
  };
}
