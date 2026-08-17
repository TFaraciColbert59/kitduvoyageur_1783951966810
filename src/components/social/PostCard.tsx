'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Icon from '@/components/ui/AppIcon';
import SocialActions from './SocialActions';
import MoreMenuSheet from './MoreMenuSheet';
import ReportSheet from './ReportSheet';
import CommentsSheet, { CommentData } from './CommentsSheet';
import ShareSheet from './ShareSheet';
import { createClient } from '@/lib/supabase/client';
import { useHapticFeedback } from '@/hooks/useHapticFeedback';

export interface PostItem {
  id: string;
  author_id: string;
  author_name: string;
  author_avatar?: string;
  author_trust_score?: number;
  created_at: string;
  content: string;
  media_url?: string;
  media_type?: string;
  tags?: string[];
  location?: string;
  origin?: 'carnet' | 'group' | 'club' | 'communaute';
  origin_name?: string;
  likes_count: number;
  comments_count: number;
  user_liked?: boolean;
  user_saved?: boolean;
}

export interface PostCardProps {
  post: PostItem;
  currentUserId?: string;
  onLike?: (liked: boolean) => void;
  onSave?: (saved: boolean) => void;
  onDelete?: () => void;
  onReport?: (reason: string, details?: string) => Promise<void>;
  className?: string;
}

export default function PostCard({
  post,
  currentUserId,
  onLike,
  onSave,
  onDelete,
  onReport,
  className = '',
}: PostCardProps) {
  const { triggerHaptic } = useHapticFeedback();
  const [isMoreOpen, setIsMoreOpen] = useState(false);
  const [isReportOpen, setIsReportOpen] = useState(false);
  const [isCommentsOpen, setIsCommentsOpen] = useState(false);
  const [isShareOpen, setIsShareOpen] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [comments, setComments] = useState<CommentData[]>([]);
  const [commentsCount, setCommentsCount] = useState<number>(post.comments_count || 0);
  const [loadingComments, setLoadingComments] = useState(false);

  useEffect(() => {
    setCommentsCount(post.comments_count || 0);
  }, [post.comments_count]);

  const isOwner = currentUserId ? post.author_id === currentUserId : false;

  const dateFormatted = new Date(post.created_at).toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'short',
  });

  const shouldTruncate = post.content && post.content.length > 220;
  const displayContent = shouldTruncate && !isExpanded
    ? post.content.slice(0, 220) + '...'
    : post.content;

  const postUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/communaute#post-${post.id}`
    : `https://lekitduvoyageur.fr/communaute#post-${post.id}`;

  const loadComments = async () => {
    setLoadingComments(true);
    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('post_comments')
        .select('id, content, created_at, author_id, parent_id, author:user_profiles(full_name, avatar_url)')
        .eq('post_id', post.id)
        .order('created_at', { ascending: true });

      if (!error && data) {
        setComments(
          data.map((c: any) => ({
            id: c.id,
            author_id: c.author_id,
            author_name: c.author?.full_name || 'Voyageur LKDV',
            author_avatar: c.author?.avatar_url,
            created_at: c.created_at,
            content: c.content,
            reply_to_id: c.parent_id || undefined,
            likes_count: 0,
            user_liked: false,
          }))
        );
      } else {
        const { data: simpleData } = await supabase
          .from('post_comments')
          .select('id, content, created_at, author_id, parent_id')
          .eq('post_id', post.id)
          .order('created_at', { ascending: true });

        if (simpleData) {
          setComments(
            simpleData.map((c: any) => ({
              id: c.id,
              author_id: c.author_id,
              author_name: 'Voyageur LKDV',
              created_at: c.created_at,
              content: c.content,
              reply_to_id: c.parent_id || undefined,
              likes_count: 0,
              user_liked: false,
            }))
          );
        }
      }
    } catch (err) {
      console.error('Error fetching comments:', err);
    } finally {
      setLoadingComments(false);
    }
  };

  const handleAddComment = async (content: string, replyToId?: string) => {
    if (!currentUserId) return;
    const tempId = `temp-${Date.now()}`;
    const optimisticComment: CommentData = {
      id: tempId,
      author_id: currentUserId,
      author_name: 'Moi',
      created_at: new Date().toISOString(),
      content,
      reply_to_id: replyToId,
      likes_count: 0,
      user_liked: false,
    };

    // Optimistic UI insertion
    setComments(prev => [...prev, optimisticComment]);
    setCommentsCount(prev => prev + 1);

    const supabase = createClient();
    const payload: any = {
      post_id: post.id,
      author_id: currentUserId,
      content,
    };
    if (replyToId && !replyToId.startsWith('temp-')) {
      payload.parent_id = replyToId;
    }

    try {
      const { data, error } = await supabase
        .from('post_comments')
        .insert(payload)
        .select('id, content, created_at, author_id, parent_id, author:user_profiles(full_name, avatar_url)')
        .single();

      if (!error && data) {
        setComments(prev =>
          prev.map(c =>
            c.id === tempId
              ? {
                  id: (data as any).id,
                  author_id: (data as any).author_id,
                  author_name: (data as any).author?.full_name || 'Moi',
                  author_avatar: (data as any).author?.avatar_url,
                  created_at: (data as any).created_at,
                  content: (data as any).content,
                  reply_to_id: (data as any).parent_id || replyToId,
                  likes_count: 0,
                  user_liked: false,
                }
              : c
          )
        );
      } else {
        const { data: fallbackData } = await supabase
          .from('post_comments')
          .insert(payload)
          .select('id, content, created_at, author_id, parent_id')
          .single();

        if (fallbackData) {
          setComments(prev =>
            prev.map(c =>
              c.id === tempId
                ? {
                    id: (fallbackData as any).id,
                    author_id: (fallbackData as any).author_id,
                    author_name: 'Moi',
                    created_at: (fallbackData as any).created_at,
                    content: (fallbackData as any).content,
                    reply_to_id: (fallbackData as any).parent_id || replyToId,
                    likes_count: 0,
                    user_liked: false,
                  }
                : c
            )
          );
        }
      }
    } catch (err) {
      console.warn('Comment insert error:', err);
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    const supabase = createClient();
    await supabase.from('post_comments').delete().eq('id', commentId);
    setComments(prev => {
      const toRemove = prev.filter(c => c.id === commentId || c.reply_to_id === commentId);
      setCommentsCount(c => Math.max(0, c - toRemove.length));
      return prev.filter(c => c.id !== commentId && c.reply_to_id !== commentId);
    });
  };

  const handleLikeComment = async (commentId: string, liked?: boolean) => {
    if (!currentUserId) return;
    const supabase = createClient();
    if (liked) {
      await supabase.from('community_likes').insert({ post_id: commentId, user_id: currentUserId }).select();
    } else {
      await supabase.from('community_likes').delete().eq('post_id', commentId).eq('user_id', currentUserId);
    }
  };

  const getOriginBadge = () => {
    if (post.origin === 'group') {
      return (
        <span className="px-2 py-0.5 bg-[#17402C]/10 text-[#17402C] rounded-full text-[9px] font-bold font-mono uppercase tracking-wider flex items-center gap-1">
          <span>👥</span>
          <span>{post.origin_name || 'Groupe'}</span>
        </span>
      );
    }
    if (post.origin === 'club') {
      return (
        <span className="px-2 py-0.5 bg-amber-500/10 text-amber-800 rounded-full text-[9px] font-bold font-mono uppercase tracking-wider flex items-center gap-1">
          <span>🏕️</span>
          <span>{post.origin_name || 'Club'}</span>
        </span>
      );
    }
    if (post.origin === 'carnet') {
      return (
        <span className="px-2 py-0.5 bg-emerald-500/10 text-emerald-800 rounded-full text-[9px] font-bold font-mono uppercase tracking-wider flex items-center gap-1">
          <span>📖</span>
          <span>{post.origin_name || 'Carnet'}</span>
        </span>
      );
    }
    return (
      <span className="px-2 py-0.5 bg-black/5 text-[#5C6B5E] rounded-full text-[9px] font-bold font-mono uppercase tracking-wider flex items-center gap-1">
        <span>✨</span>
        <span>Fil Général</span>
      </span>
    );
  };

  return (
    <article
      id={`post-${post.id}`}
      className={`bg-white rounded-[24px] p-4 sm:p-5 border border-[#1C2620]/8 shadow-[0_2px_12px_rgba(11,31,23,0.03)] hover:shadow-md transition-shadow duration-200 flex flex-col gap-3.5 ${className}`}
    >
      {/* Header : Author info, Origin/Time & context menu */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3 min-w-0">
          <a
            href={post.author_id ? `/profil/${post.author_id}` : '#'}
            className="w-10 h-10 rounded-full bg-[#EDF3ED] text-[#17402C] border border-[#A8C4A2] flex items-center justify-center font-serif italic text-lg overflow-hidden shrink-0 hover:opacity-90 transition-opacity shadow-sm"
          >
            {post.author_avatar ? (
              <img
                src={post.author_avatar}
                alt={post.author_name}
                className="w-full h-full object-cover"
                loading="lazy"
              />
            ) : (
              <span>{post.author_name?.charAt(0)?.toUpperCase() || 'P'}</span>
            )}
          </a>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <a
                href={post.author_id ? `/profil/${post.author_id}` : '#'}
                className="font-medium text-sm text-[#1C2620] hover:text-[#17402C] tracking-tight truncate"
              >
                {post.author_name}
              </a>
            </div>
            <div className="flex items-center gap-1.5 text-[11px] text-[#5C6B5E] font-mono mt-0.5">
              <span>{dateFormatted}</span>
              <span>·</span>
              <span className="text-[#17402C] font-medium truncate">
                {post.origin_name || (post.origin === 'club' ? 'Club' : post.origin === 'group' ? 'Groupe' : post.origin === 'carnet' ? 'Carnet' : 'Communauté')}
                {post.location ? ` · ${post.location}` : ''}
              </span>
            </div>
          </div>
        </div>

        {/* 3 Dots at top right */}
        <button
          type="button"
          onClick={() => {
            triggerHaptic('light');
            setIsMoreOpen(true);
          }}
          className="w-8 h-8 rounded-full flex items-center justify-center text-[#5C6B5E]/60 hover:text-[#1C2620] hover:bg-[#F5F2E8] transition-colors"
          aria-label="Options"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18" strokeLinecap="round">
            <circle cx="5" cy="12" r="1" fill="currentColor" />
            <circle cx="12" cy="12" r="1" fill="currentColor" />
            <circle cx="19" cy="12" r="1" fill="currentColor" />
          </svg>
        </button>
      </div>

      {/* Body content */}
      <div className="text-sm text-[#1C2620] leading-relaxed break-words font-sans">
        <p className="whitespace-pre-line">
          {displayContent}
        </p>
        {shouldTruncate && (
          <button
            type="button"
            onClick={() => setIsExpanded(!isExpanded)}
            className="text-[11px] font-bold text-[#17402C] hover:underline mt-1 block"
          >
            {isExpanded ? 'Moins' : 'Lire la suite...'}
          </button>
        )}
      </div>

      {/* Tags rendered inline or attached */}
      {post.tags && post.tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5 -mt-1">
          {post.tags.map((tag, idx) => (
            <span
              key={idx}
              className="text-xs font-mono font-medium text-[#17402C] hover:underline cursor-pointer"
            >
              #{tag}
            </span>
          ))}
        </div>
      )}

      {/* Media attachment with top-right date mono badge & bottom-left geo badge ONLY if media_url exists */}
      {post.media_url && (
        <div className="relative w-full rounded-2xl overflow-hidden bg-black/5 max-h-80 flex items-center justify-center border border-[#1C2620]/5 group">
          {post.media_type === 'video' ? (
            <video
              src={post.media_url}
              controls
              className="w-full h-auto max-h-80 object-cover rounded-2xl"
              preload="metadata"
            />
          ) : (
            <img
              src={post.media_url}
              alt="Média publication"
              className="w-full h-auto max-h-80 object-cover rounded-2xl"
              loading="lazy"
            />
          )}

          {/* Geo Location Capsule Overlay */}
          {post.location && (
            <div className="absolute bottom-2.5 left-2.5 px-3 py-1.5 bg-white/90 backdrop-blur-md rounded-full flex items-center gap-1.5 text-[10px] font-bold text-[#1C2620] tracking-wider uppercase shadow-sm border border-white/40">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#17402C" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="10" r="3" />
                <path d="M12 2a8 8 0 0 1 8 8c0 6-8 12-8 12S4 16 4 10a8 8 0 0 1 8-8z" />
              </svg>
              <span>{post.location}</span>
            </div>
          )}

          {/* Date Mono Badge Top Right */}
          <div className="absolute top-2.5 right-2.5 px-2.5 py-1 bg-black/60 backdrop-blur-md rounded-full text-[10px] font-mono text-white tracking-wider">
            {dateFormatted}
          </div>
        </div>
      )}

      {/* Standardized Social Actions */}
      <SocialActions
        contentId={post.id}
        contentType="post"
        likesCount={post.likes_count}
        commentsCount={commentsCount}
        isLiked={post.user_liked}
        isSaved={post.user_saved}
        onLike={onLike}
        onSave={onSave}
        onOpenComments={() => {
          setIsCommentsOpen(true);
          loadComments();
        }}
        onShare={() => setIsShareOpen(true)}
      />

      {/* Context Menu Sheet */}
      <MoreMenuSheet
        isOpen={isMoreOpen}
        onClose={() => setIsMoreOpen(false)}
        title={`Publication de ${post.author_name}`}
        isOwner={isOwner}
        onShare={() => setIsShareOpen(true)}
        onCopyLink={() => {
          navigator.clipboard.writeText(postUrl);
        }}
        onDelete={onDelete}
        onReport={() => setIsReportOpen(true)}
      />

      {/* Share / Messenger Reply Sheet */}
      <ShareSheet
        isOpen={isShareOpen}
        onClose={() => setIsShareOpen(false)}
        title={`Publication de ${post.author_name}`}
        url={postUrl}
        contentId={post.id}
        contentType="post"
        currentUserId={currentUserId}
      />

      {/* Report Sheet */}
      <ReportSheet
        isOpen={isReportOpen}
        onClose={() => setIsReportOpen(false)}
        contentId={post.id}
        contentType="post"
        onSubmitReport={async (reason, details) => {
          if (onReport) await onReport(reason, details);
        }}
      />

      {/* Liquid Glass Comments Sheet */}
      <CommentsSheet
        isOpen={isCommentsOpen}
        onClose={() => setIsCommentsOpen(false)}
        title="Discussions"
        comments={comments}
        loading={loadingComments}
        currentUserId={currentUserId}
        onAddComment={handleAddComment}
        onLikeComment={handleLikeComment}
        onDeleteComment={handleDeleteComment}
      />
    </article>
  );
}
