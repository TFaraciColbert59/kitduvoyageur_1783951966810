'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { fetchPublicProfilesWith } from '@/lib/queries/publicProfilesCore';

export interface CarnetComment {
  id: string;
  authorId: string | null;
  authorName: string;
  /** Handle public réel, `null` quand le profil n'en porte pas. */
  authorHandle?: string | null;
  authorAvatar: string | null;
  content: string;
  createdAt: string;
}

export interface UseCarnetCommentsArgs {
  carnetId: string;
  user: { id: string; is_anonymous?: boolean } | null | undefined;
}

type CommentRow = {
  id: string;
  carnet_id: string;
  author_id: string | null;
  content: string;
  created_at: string;
};

async function toComments(
  supabase: ReturnType<typeof createClient>,
  rows: CommentRow[],
): Promise<CarnetComment[]> {
  const profiles = await fetchPublicProfilesWith(
    supabase as never,
    rows.map((row) => row.author_id),
  );
  return rows.map((row) => {
    const profile = row.author_id ? profiles[row.author_id] : undefined;
    return {
      id: row.id,
      authorId: row.author_id,
      authorName: profile?.full_name?.trim() || profile?.handle?.trim() || 'Auteur',
      authorHandle: profile?.handle?.trim() || null,
      authorAvatar: profile?.avatar_url ?? null,
      content: row.content,
      createdAt: row.created_at,
    };
  });
}

/** Commentaires réels du carnet : lecture, envoi, suppression du sien. */
export function useCarnetComments({ carnetId, user }: UseCarnetCommentsArgs) {
  const supabase = useMemo(() => createClient(), []);
  const [comments, setComments] = useState<CarnetComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    supabase
      .from('carnet_comments')
      .select('id, carnet_id, author_id, content, created_at')
      .eq('carnet_id', carnetId)
      .order('created_at', { ascending: true })
      .then(async ({ data, error: queryError }) => {
        if (!active) return;
        if (queryError) {
          setError(queryError.message);
          setLoading(false);
          return;
        }
        setComments(await toComments(supabase, (data ?? []) as CommentRow[]));
        setError(null);
        setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [carnetId, supabase]);

  const send = useCallback(
    async (raw: string) => {
      const content = raw.trim();
      if (!content || !user?.id || user.is_anonymous) return false;
      const { data, error: insertError } = await supabase
        .from('carnet_comments')
        .insert({ carnet_id: carnetId, author_id: user.id, content })
        .select('id, carnet_id, author_id, content, created_at')
        .single();
      if (insertError || !data) return false;
      const [comment] = await toComments(supabase, [data as CommentRow]);
      setComments((current) => [...current, comment]);
      return true;
    },
    [carnetId, supabase, user?.id, user?.is_anonymous],
  );

  const remove = useCallback(
    async (commentId: string) => {
      if (!user?.id) return false;
      const target = comments.find((comment) => comment.id === commentId);
      if (!target || target.authorId !== user.id) return false;
      const { error: deleteError } = await supabase
        .from('carnet_comments')
        .delete()
        .eq('id', commentId)
        .eq('author_id', user.id);
      if (deleteError) return false;
      setComments((current) => current.filter((comment) => comment.id !== commentId));
      return true;
    },
    [comments, supabase, user?.id],
  );

  return { comments, loading, error, send, remove };
}

export default useCarnetComments;
