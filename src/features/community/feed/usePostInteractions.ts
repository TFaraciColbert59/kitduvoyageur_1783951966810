'use client';

import { useCallback, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { shareNativeURL } from '@/lib/native/ui';
import { useHapticFeedback } from '@/hooks/useHapticFeedback';
import type { FeedPost } from './useCommunityFeed';
import { isAuthDenied } from './feed-utils';

export type CommunityAuthReason = 'like' | 'save' | 'report' | 'comment' | 'story';
export type CommunityActionResult = 'ok' | 'error' | 'auth';
export type CommunityShareResult = 'shared' | 'copied' | 'failed';

/**
 * Actions du post Compte : like, favori, republier, copier, signaler.
 *
 * - Invité : like/favori/signalement passent par `onRequireAuth`.
 * - Essai anonyme : le like est autorisé ; le favori et le signalement
 *   demandent un compte (RLS `post_saves` / `comment_reports`).
 * - Authentifié : appels Supabase et retours explicites pour les toasts.
 */
export function usePostInteractions(
  post: FeedPost,
  user: { id?: string; is_anonymous?: boolean } | null | undefined,
  onRequireAuth?: (reason: CommunityAuthReason) => void,
) {
  const { triggerHaptic } = useHapticFeedback();
  const [liked, setLiked] = useState(Boolean(post.user_liked));
  const [saved, setSaved] = useState(Boolean(post.user_saved));
  const [likesCount, setLikesCount] = useState(Number(post.likes_count ?? 0));
  const [busy, setBusy] = useState(false);

  const permalink = `/communaute?post=${post.id}`;
  const isGuest = !user?.id;
  const isAnonymous = Boolean(user?.is_anonymous);

  const toggleLike = useCallback(async (): Promise<CommunityActionResult> => {
    if (isGuest) {
      onRequireAuth?.('like');
      return 'auth';
    }
    if (busy) return 'error';
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
      setBusy(false);
      if (isAuthDenied(error)) {
        onRequireAuth?.('like');
        return 'auth';
      }
      return 'error';
    }
    setBusy(false);
    return 'ok';
  }, [busy, isGuest, liked, likesCount, onRequireAuth, post.id, triggerHaptic]);

  const toggleSave = useCallback(async (): Promise<CommunityActionResult> => {
    if (isGuest || isAnonymous) {
      onRequireAuth?.('save');
      return 'auth';
    }
    const next = !saved;
    setSaved(next);
    const supabase = createClient();
    const { error } = next
      ? await supabase.from('post_saves').upsert(
          { user_id: user!.id, post_id: post.id },
          { onConflict: 'user_id,post_id', ignoreDuplicates: true },
        )
      : await supabase.from('post_saves').delete().eq('user_id', user!.id).eq('post_id', post.id);
    if (error) {
      setSaved(!next);
      if (isAuthDenied(error)) {
        onRequireAuth?.('save');
        return 'auth';
      }
      return 'error';
    }
    return 'ok';
  }, [isAnonymous, isGuest, onRequireAuth, post.id, saved, user]);

  const share = useCallback(async (): Promise<CommunityShareResult> => {
    const url = `${window.location.origin}${permalink}`;
    if (await shareNativeURL(url)) return 'shared';
    try {
      await navigator.clipboard.writeText(url);
      return 'copied';
    } catch {
      try {
        const input = document.createElement('textarea');
        input.value = url;
        input.style.position = 'fixed';
        input.style.opacity = '0';
        document.body.appendChild(input);
        input.select();
        const ok = document.execCommand('copy');
        document.body.removeChild(input);
        return ok ? 'copied' : 'failed';
      } catch {
        return 'failed';
      }
    }
  }, [permalink]);

  const copyLink = useCallback(async (): Promise<boolean> => {
    const url = `${window.location.origin}${permalink}`;
    try {
      await navigator.clipboard.writeText(url);
      return true;
    } catch {
      try {
        const input = document.createElement('textarea');
        input.value = url;
        input.style.position = 'fixed';
        input.style.opacity = '0';
        document.body.appendChild(input);
        input.select();
        const ok = document.execCommand('copy');
        document.body.removeChild(input);
        return ok;
      } catch {
        return false;
      }
    }
  }, [permalink]);

  const report = useCallback(
    async (reason: string, details?: string): Promise<CommunityActionResult> => {
      if (isGuest || isAnonymous) {
        onRequireAuth?.('report');
        return 'auth';
      }
      const { error } = await createClient().from('comment_reports').insert({
        comment_id: post.id,
        reporter_id: user!.id,
        reason: details ? `${reason} — ${details}` : reason,
        table_name: 'community_posts',
      });
      if (error) {
        if (isAuthDenied(error)) {
          onRequireAuth?.('report');
          return 'auth';
        }
        return 'error';
      }
      return 'ok';
    },
    [isAnonymous, isGuest, onRequireAuth, post.id, user],
  );

  return {
    liked,
    saved,
    likesCount,
    busy,
    isGuest,
    isAnonymous,
    toggleLike,
    toggleSave,
    share,
    copyLink,
    report,
    permalink,
  };
}

export default usePostInteractions;
