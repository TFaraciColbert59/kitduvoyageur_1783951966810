'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { CommunityAuthReason } from './usePostInteractions';
import { isAuthDenied } from './feed-utils';
import { fetchPublicProfilesWith } from '@/lib/queries/publicProfilesCore';

export interface FeedComment {
  id: string;
  parentId: string | null;
  content: string;
  created_at: string;
  author?: { id: string; full_name: string | null; avatar_url: string | null };
  likes: number;
  userLiked: boolean;
  isOwner: boolean;
  replies: FeedComment[];
}

interface CommentRow {
  id: string;
  post_id: string;
  author_id: string | null;
  content: string;
  parent_id: string | null;
  created_at: string;
}

const PAGE_SIZE = 30;

function toNode(
  row: CommentRow,
  profiles: Record<string, { id: string; full_name: string | null; avatar_url: string | null }>,
  likeCounts: Map<string, number>,
  liked: Set<string>,
  userId?: string,
): FeedComment {
  const profile = row.author_id ? profiles[row.author_id] : undefined;
  return {
    id: row.id,
    parentId: row.parent_id,
    content: row.content,
    created_at: row.created_at,
    author: profile
      ? { id: profile.id, full_name: profile.full_name, avatar_url: profile.avatar_url }
      : row.author_id
        ? { id: row.author_id, full_name: null, avatar_url: null }
        : undefined,
    likes: likeCounts.get(row.id) ?? 0,
    userLiked: liked.has(row.id),
    isOwner: Boolean(userId && row.author_id === userId),
    replies: [],
  };
}

/**
 * Commentaires du fil : mêmes données et mêmes actions que l'ancienne carte
 * (racines, réponses, likes, édition, suppression, signalement), sans le
 * rendu de la carte.
 */
export function usePostComments(
  postId: string,
  user: { id?: string; is_anonymous?: boolean; user_metadata?: Record<string, any> } | null | undefined,
  onRequireAuth?: (reason: CommunityAuthReason) => void,
) {
  const [comments, setComments] = useState<FeedComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [limit, setLimit] = useState(PAGE_SIZE);
  const requestRef = useRef(0);

  const load = useCallback(async () => {
    if (!postId) {
      setComments([]);
      setLoading(false);
      setError(null);
      return;
    }
    const requestId = ++requestRef.current;
    setLoading(true);
    setError(null);
    try {
      const supabase = createClient();
      const { data: roots, error: rootError } = await supabase
        .from('post_comments')
        .select('id, post_id, author_id, content, parent_id, created_at')
        .eq('post_id', postId)
        .is('parent_id', null)
        .order('created_at', { ascending: true })
        .limit(limit);

      if (requestId !== requestRef.current) return;
      if (rootError) throw rootError;
      const rootRows = (roots ?? []) as CommentRow[];
      const rootIds = rootRows.map((row) => row.id);

      let replyRows: CommentRow[] = [];
      if (rootIds.length > 0) {
        const { data: replies, error: replyError } = await supabase
          .from('post_comments')
          .select('id, post_id, author_id, content, parent_id, created_at')
          .in('parent_id', rootIds)
          .order('created_at', { ascending: true });
        if (replyError) throw replyError;
        replyRows = (replies ?? []) as CommentRow[];
      }

      const allRows = [...rootRows, ...replyRows];
      const profiles = await fetchPublicProfilesWith(
        supabase,
        allRows.map((row) => row.author_id),
      );

      const likeCounts = new Map<string, number>();
      const liked = new Set<string>();
      if (allRows.length > 0) {
        const { data: allLikes } = await supabase
          .from('post_comment_likes')
          .select('comment_id, user_id')
          .in('comment_id', allRows.map((row) => row.id));
        for (const like of (allLikes ?? []) as Array<{ comment_id: string; user_id: string }>) {
          likeCounts.set(like.comment_id, (likeCounts.get(like.comment_id) ?? 0) + 1);
          if (user?.id && like.user_id === user.id) liked.add(like.comment_id);
        }
      }

      if (requestId !== requestRef.current) return;

      const nodes = new Map<string, FeedComment>();
      for (const row of allRows) {
        nodes.set(row.id, toNode(row, profiles, likeCounts, liked, user?.id));
      }
      const tree: FeedComment[] = [];
      for (const row of rootRows) {
        const node = nodes.get(row.id);
        if (!node) continue;
        tree.push(node);
      }
      for (const row of replyRows) {
        const node = nodes.get(row.id);
        const parent = row.parent_id ? nodes.get(row.parent_id) : null;
        if (node && parent) parent.replies.push(node);
      }

      setComments(tree);
      setLoading(false);
    } catch {
      if (requestId !== requestRef.current) return;
      setLoading(false);
      setError('Les commentaires n’ont pas pu être chargés.');
    }
  }, [limit, postId, user?.id]);

  useEffect(() => {
    void load();
  }, [load]);

  const send = useCallback(
    async (content: string, parentId: string | null = null) => {
      const text = content.trim();
      if (!text) return false;
      if (!user?.id || user.is_anonymous) {
        onRequireAuth?.('comment');
        return false;
      }
      const supabase = createClient();
      const { data, error: insertError } = await supabase
        .from('post_comments')
        .insert({ post_id: postId, author_id: user.id, content: text, parent_id: parentId })
        .select('id, created_at')
        .single();
      if (insertError || !data) {
        if (isAuthDenied(insertError)) onRequireAuth?.('comment');
        return false;
      }

      const node: FeedComment = {
        id: data.id,
        parentId,
        content: text,
        created_at: data.created_at,
        author: {
          id: user.id,
          full_name: (user.user_metadata?.full_name as string) || 'Moi',
          avatar_url: (user.user_metadata?.avatar_url as string) || null,
        },
        likes: 0,
        userLiked: false,
        isOwner: true,
        replies: [],
      };

      setComments((prev) => {
        if (!parentId) return [...prev, node];
        return prev.map((comment) =>
          comment.id === parentId
            ? { ...comment, replies: [...comment.replies, node] }
            : comment,
        );
      });
      return true;
    },
    [onRequireAuth, postId, user?.id, user?.is_anonymous, user?.user_metadata],
  );

  const toggleLike = useCallback(
    async (commentId: string) => {
      if (!user?.id || user.is_anonymous) {
        onRequireAuth?.('comment');
        return;
      }
      const findComment = (items: FeedComment[]): FeedComment | null => {
        for (const comment of items) {
          if (comment.id === commentId) return comment;
          const reply = findComment(comment.replies);
          if (reply) return reply;
        }
        return null;
      };
      const target = findComment(comments);
      const nextLiked = !target?.userLiked;

      setComments((prev) => {
        const update = (items: FeedComment[]): FeedComment[] =>
          items.map((comment) => {
            if (comment.id === commentId) {
              return {
                ...comment,
                userLiked: nextLiked,
                likes: Math.max(0, comment.likes + (nextLiked ? 1 : -1)),
              };
            }
            return comment.replies.length ? { ...comment, replies: update(comment.replies) } : comment;
          });
        return update(prev);
      });

      const supabase = createClient();
      const { error: likeError } = nextLiked
        ? await supabase.from('post_comment_likes').upsert(
            { user_id: user.id, comment_id: commentId },
            { onConflict: 'user_id,comment_id', ignoreDuplicates: true },
          )
        : await supabase
            .from('post_comment_likes')
            .delete()
            .eq('user_id', user.id)
            .eq('comment_id', commentId);

      if (likeError) {
        if (isAuthDenied(likeError)) onRequireAuth?.('comment');
        await load();
      }
    },
    [comments, load, onRequireAuth, user?.id, user?.is_anonymous],
  );

  const edit = useCallback(
    async (commentId: string, content: string) => {
      const text = content.trim();
      if (!text) return;
      if (!user?.id || user.is_anonymous) {
        onRequireAuth?.('comment');
        return;
      }
      const { error: updateError } = await createClient()
        .from('post_comments')
        .update({ content: text })
        .eq('id', commentId);
      if (updateError) {
        if (isAuthDenied(updateError)) onRequireAuth?.('comment');
        return;
      }
      setComments((prev) => {
        const update = (items: FeedComment[]): FeedComment[] =>
          items.map((comment) =>
            comment.id === commentId
              ? { ...comment, content: text }
              : comment.replies.length
                ? { ...comment, replies: update(comment.replies) }
                : comment,
          );
        return update(prev);
      });
    },
    [onRequireAuth, user?.id, user?.is_anonymous],
  );

  const remove = useCallback(async (commentId: string) => {
    if (!user?.id || user.is_anonymous) {
      onRequireAuth?.('comment');
      return;
    }
    const { error: deleteError } = await createClient()
      .from('post_comments')
      .delete()
      .eq('id', commentId);
    if (deleteError) {
      if (isAuthDenied(deleteError)) onRequireAuth?.('comment');
      return;
    }
    setComments((prev) =>
      prev
        .filter((comment) => comment.id !== commentId)
        .map((comment) =>
          comment.replies.length
            ? { ...comment, replies: comment.replies.filter((reply) => reply.id !== commentId) }
            : comment,
        ),
    );
  }, [onRequireAuth, user?.id, user?.is_anonymous]);

  const report = useCallback(
    async (commentId: string, reason: string) => {
      if (!user?.id || user.is_anonymous) {
        onRequireAuth?.('report');
        return;
      }
      await createClient().from('comment_reports').insert({
        comment_id: commentId,
        reporter_id: user.id,
        reason,
        table_name: 'post_comments',
      });
    },
    [onRequireAuth, user?.id, user?.is_anonymous],
  );

  const loadMore = useCallback(() => {
    setLimit((current) => current + PAGE_SIZE);
  }, []);

  return {
    comments,
    loading,
    error,
    send,
    edit,
    remove,
    report,
    toggleLike,
    loadMore,
    reload: load,
  };
}

export default usePostComments;
