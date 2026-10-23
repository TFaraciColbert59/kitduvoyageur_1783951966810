'use client';

import { useCallback, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { shareNativeURL } from '@/lib/native/ui';
import { useHapticFeedback } from '@/hooks/useHapticFeedback';
import type { FeedPost } from './useCommunityFeed';

/**
 * Actions du post Compte : like, favori, republier, copier, signaler.
 * La capsule n'affiche pas de compteurs (comme le Compte) ; les valeurs
 * restent disponibles pour les feuilles.
 */
export function usePostInteractions(post: FeedPost, user: { id?: string } | null | undefined) {
  const { triggerHaptic } = useHapticFeedback();
  const [liked, setLiked] = useState(Boolean(post.user_liked));
  const [saved, setSaved] = useState(Boolean(post.user_saved));
  const [likesCount, setLikesCount] = useState(Number(post.likes_count ?? 0));
  const [busy, setBusy] = useState(false);

  const permalink = `/communaute?post=${post.id}`;

  const toggleLike = useCallback(async () => {
    if (!user?.id) {
      triggerHaptic('warning');
      return;
    }
    if (busy) return;
    setBusy(true);
    const previous = liked;
    const previousCount = likesCount;
    setLiked(!previous);
    setLikesCount(Math.max(0, previousCount + (previous ? -1 : 1)));
    triggerHaptic('light');
    const { error } = await createClient().rpc('toggle_community_post_like', { p_post_id: post.id });
    if (error) {
      setLiked(previous);
      setLikesCount(previousCount);
      triggerHaptic('error');
    }
    setBusy(false);
  }, [busy, liked, likesCount, post.id, triggerHaptic, user?.id]);

  const toggleSave = useCallback(async () => {
    if (!user?.id) return;
    const next = !saved;
    setSaved(next);
    const supabase = createClient();
    const { error } = next
      ? await supabase.from('post_saves').upsert(
          { user_id: user.id, post_id: post.id },
          { onConflict: 'user_id,post_id', ignoreDuplicates: true },
        )
      : await supabase.from('post_saves').delete().eq('user_id', user.id).eq('post_id', post.id);
    if (error) setSaved(!next);
  }, [post.id, saved, user?.id]);

  const share = useCallback(async () => {
    const url = `${window.location.origin}${permalink}`;
    if (await shareNativeURL(url)) return;
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      /* le partage natif a déjà été tenté */
    }
  }, [permalink]);

  const copyLink = useCallback(async () => {
    const url = `${window.location.origin}${permalink}`;
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      /* presse-papier indisponible */
    }
  }, [permalink]);

  const report = useCallback(
    async (reason: string, details?: string) => {
      if (!user?.id) return;
      await createClient().from('comment_reports').insert({
        comment_id: post.id,
        reporter_id: user.id,
        reason: details ? `${reason} — ${details}` : reason,
        table_name: 'community_posts',
      });
    },
    [post.id, user?.id],
  );

  return {
    liked,
    saved,
    likesCount,
    busy,
    toggleLike,
    toggleSave,
    share,
    copyLink,
    report,
    permalink,
  };
}

export default usePostInteractions;
