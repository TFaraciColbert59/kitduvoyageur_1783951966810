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
import { fetchPublicProfilesWith } from '@/lib/queries/publicProfilesCore';
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

  const CONTENT_LIMIT = 200;
  const shouldTruncate = post.content && post.content.length > CONTENT_LIMIT;
  const displayContent = shouldTruncate && !isExpanded
    ? post.content.slice(0, CONTENT_LIMIT).trimEnd() + '…'
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
        .select('id, content, created_at, author_id, parent_id')
        .eq('post_id', post.id)
        .order('created_at', { ascending: true });

      if (!error && data) {
        // F1 — auteurs via la vue `public_profiles` (deux étapes, sans embed).
        const profiles = await fetchPublicProfilesWith(
          supabase,
          data.map((c: any) => c.author_id as string)
        );
        setComments(
          data.map((c: any) => ({
            id: c.id,
            author_id: c.author_id,
            author_name: profiles[c.author_id]?.full_name || 'Voyageur LKDV',
            author_avatar: profiles[c.author_id]?.avatar_url ?? undefined,
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
        .select('id, content, created_at, author_id, parent_id')
        .single();

      if (!error && data) {
        // F1 — auteur via la vue `public_profiles` (deux étapes, sans embed).
        const profiles = await fetchPublicProfilesWith(supabase, [currentUserId]);
        const ownProfile = profiles[currentUserId];
        setComments(prev =>
          prev.map(c =>
            c.id === tempId
              ? {
                  id: (data as any).id,
                  author_id: (data as any).author_id,
                  author_name: ownProfile?.full_name || 'Moi',
                  author_avatar: ownProfile?.avatar_url ?? undefined,
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
        <span className="px-2 py-0.5 bg-sand-500/10 text-sand-800 rounded-full text-[9px] font-bold font-mono uppercase tracking-wider flex items-center gap-1">
          <span>🏕️</span>
          <span>{post.origin_name || 'Club'}</span>
        </span>
      );
    }
    if (post.origin === 'carnet') {
      return (
        <span className="px-2 py-0.5 bg-forest-500/10 text-forest-800 rounded-full text-[9px] font-bold font-mono uppercase tracking-wider flex items-center gap-1">
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
      className={`glass rounded-xl overflow-hidden transition-shadow duration-200 flex flex-col ${className}`}
    >
      {/* Header : Author info, Origin/Time & context menu */}
      <div className="flex items-center justify-between px-4 pt-4 pb-3">
        <div className="flex items-center gap-3 min-w-0">
          <a
            href={post.author_id ? `/profil/${post.author_id}` : '#'}
            className="w-10 h-10 rounded-full bg-[#EDF3ED] text-[#17402C] border border-[#A6C1A0] flex items-center justify-center font-serif italic text-lg overflow-hidden shrink-0 hover:opacity-90 transition-opacity"
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
                className="font-medium text-sm text-[#17402C] hover:text-[#17402C] tracking-tight truncate"
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
          className="w-9 h-9 rounded-full glass-capsule-btn flex items-center justify-center text-[#17402C] hover:text-[#17402C] p-0 shrink-0 cursor-pointer transition-all duration-200 hover:scale-110 hover:border-white hover:bg-white/90"
          aria-label="Options"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18" strokeLinecap="round">
            <circle cx="5" cy="12" r="1" fill="currentColor" />
            <circle cx="12" cy="12" r="1" fill="currentColor" />
            <circle cx="19" cy="12" r="1" fill="currentColor" />
          </svg>
        </button>
      </div>

      {/* Body content — 200 caractères max, expansion façon Twitter */}
      <div className="text-sm text-[#17402C] leading-relaxed break-words font-sans px-4 pb-3">
        <p className="whitespace-pre-line">
          {displayContent}
          {shouldTruncate && !isExpanded && (
            <button
              type="button"
              onClick={() => setIsExpanded(true)}
              className="text-[13px] font-medium text-[#17402C]/70 hover:text-[#17402C] ml-1 inline"
            >
              Afficher plus
            </button>
          )}
          {shouldTruncate && isExpanded && (
            <button
              type="button"
              onClick={() => setIsExpanded(false)}
              className="text-[13px] font-medium text-[#17402C]/70 hover:text-[#17402C] ml-1 inline"
            >
              Afficher moins
            </button>
          )}
        </p>
      </div>

      {/* Tags rendered inline or attached */}
      {post.tags && post.tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5 px-4 pb-3 -mt-1">
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

      {/* Media plein-bord (collé aux bords de la card) + boutons en verre par-dessus */}
      {post.media_url && (
        <div className="relative w-full">
          {/* Ambilight — les couleurs du média remontent dans la card jusqu'à ~30% sous le texte */}
          <div
            aria-hidden="true"
            className="lkdv-ambilight pointer-events-none absolute -top-24 inset-x-0 h-60"
            style={{
              backgroundImage: `url(${post.media_url})`,
              backgroundSize: 'cover',
              backgroundPosition: 'center 30%',
              filter: 'blur(50px) saturate(1.7)',
              transform: 'scale(1.25)',
              opacity: 0.45,
              WebkitMaskImage: 'linear-gradient(to top, rgba(0,0,0,1) 0%, rgba(0,0,0,0.35) 55%, rgba(0,0,0,0) 100%)',
              maskImage: 'linear-gradient(to top, rgba(0,0,0,1) 0%, rgba(0,0,0,0.35) 55%, rgba(0,0,0,0) 100%)',
            }}
          />
          <div className="relative z-10">
          {post.media_type === 'video' ? (
            <video
              src={post.media_url}
              controls
              className="w-full h-auto max-h-[540px] sm:max-h-[420px] object-cover"
              preload="metadata"
            />
          ) : (
            <img
              src={post.media_url}
              alt="Média publication"
              className="w-full h-auto max-h-[540px] sm:max-h-[420px] object-cover"
              loading="lazy"
            />
          )}

          {/* Fusion givrée : le média se dissout dans le verre de la card (sans ligne dure) */}
          <div aria-hidden="true" className="lkdv-photo-melt" />

          {/* Geo Location Capsule Overlay */}
          {post.location && (
            <div className="absolute bottom-16 left-3 px-3 py-1.5 glass-pill rounded-full flex items-center gap-1.5 text-[10px] font-bold text-[#17402C] tracking-wider uppercase border border-white/40">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#17402C" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="10" r="3" />
                <path d="M12 2a8 8 0 0 1 8 8c0 6-8 12-8 12S4 16 4 10a8 8 0 0 1 8-8z" />
              </svg>
              <span>{post.location}</span>
            </div>
          )}

          {/* Date — pill verre en haut à droite */}
          <div className="absolute top-3 right-3 px-2.5 py-1 rounded-full text-[10px] font-mono text-[#17402C] tracking-wider border border-white/50"
            style={{ background: 'rgba(255,255,255,0.62)', backdropFilter: 'blur(8px) saturate(160%)', WebkitBackdropFilter: 'blur(8px) saturate(160%)' }}>
            {dateFormatted}
          </div>

          {/* Actions sociales en verre, par-dessus l'image */}
          <div className="lkdv-photo-actions absolute inset-x-3 bottom-3">
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
              overlay
            />
          </div>
          </div>
        </div>
      )}

      {/* Actions sociales sous le texte (posts sans image) */}
      {!post.media_url && (
        <div className="px-4 pb-3">
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
        </div>
      )}

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
