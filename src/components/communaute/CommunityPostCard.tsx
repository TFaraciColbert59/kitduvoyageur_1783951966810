'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { motion, AnimatePresence } from 'framer-motion';
import Icon from '@/components/ui/AppIcon';
import { IconButton } from '@/components/ui';
import LiquidGlass from '@/components/glass/LiquidGlass';
import SmartImage from '@/components/ui/SmartImage';
import ReportSheet from '@/components/social/ReportSheet';
import { createClient } from '@/lib/supabase/client';
import { fetchPublicProfilesWith } from '@/lib/queries/publicProfilesCore';
import { useHapticFeedback } from '@/hooks/useHapticFeedback';
import { useDoubleTap, useLongPress } from '@/hooks/gestures';

// Visionneuse plein écran en dynamic import — protège le First Load JS
// (mission gestes, Phase 6 : budget ≤170 KB).
const ImageViewer = dynamic(() => import('@/components/ui/ImageViewer'), { ssr: false });

export interface PostAuthor {
  id?: string;
  full_name?: string;
  avatar_url?: string;
  loyalty_level?: string;
}

export interface PostCommentItem {
  id: string;
  parentId?: string | null;
  author?: PostAuthor;
  content: string;
  attachment?: string | null;
  location?: string | null;
  created_at?: string;
  likes?: number;
  userLiked?: boolean;
  isOwner?: boolean;
  edited?: boolean;
}

export interface CommunityPostItem {
  id: string;
  user_id?: string;
  author_id?: string;
  content: string;
  author?: PostAuthor;
  image_url?: string | null;
  likes_count?: number;
  comments_count?: number;
  created_at?: string;
  user_liked?: boolean;
  user_saved?: boolean;
  linked_carnet_id?: string | null;
  snapshot_payload?: Record<string, any> | null;
  snapshot_at?: string | null;
}

export const timeAgo = (dateStr: string) => {
  const diff = Date.now() - new Date(dateStr).getTime();
  const hours = Math.floor(diff / (1000 * 60 * 60));
  if (hours < 1) return 'À l’instant';
  if (hours < 24) return `Il y a ${hours}h`;
  return `Il y a ${Math.floor(hours / 24)} j`;
};

/** Pastille verre — pile LiquidGlass, style unique (référence section 4).
 *  Les valeurs viennent des tokens --btn-* (tokens.css) : une seule
 *  modification met à jour toutes les pastilles du site. */
function OverlayPill({ label, onClick, pillWidth, children }: {
  label: string;
  onClick?: () => void;
  /** Largeur fixe (px) pour aligner plusieurs pastilles sur la même taille. */
  pillWidth?: number;
  children: React.ReactNode;
}) {
  return (
    <LiquidGlass
      as="button"
      type="button"
      aria-label={label}
      onClick={onClick}
      displacementScale={70}
      blurAmount={6}
      saturation={160}
      aberrationIntensity={2}
      cornerRadius={999}
      priority="media"
      elasticity={0.3}
      glassTint="var(--btn-tint)"
      shadow="var(--btn-shadow)"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '8px',
        lineHeight: 1,
        minHeight: '44px',
        minWidth: pillWidth ? `${pillWidth}px` : '44px',
        width: pillWidth ? `${pillWidth}px` : undefined,
        padding: pillWidth ? '0' : '0 14px',
        border: 'none',
        color: 'var(--btn-content)',
        textShadow: 'var(--btn-text-shadow)',
        fontWeight: 900,
        fontSize: '13px',
        letterSpacing: '0.01em',
        fontVariantNumeric: 'tabular-nums',
        fontFamily: 'var(--font-sans), system-ui, sans-serif',
        cursor: 'pointer',
        WebkitTapHighlightColor: 'transparent',
        userSelect: 'none',
      }}
    >
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '8px',
          lineHeight: 1,
          width: '100%',
        }}
      >
        {children}
      </span>
    </LiquidGlass>
  );
}

// Heart SVG Icon helper for crisp rendering
export function HeartSvg({ filled = false, className = '' }: { filled?: boolean; className?: string }) {
  if (filled) {
    return (
      <svg
        viewBox="0 0 24 24"
        fill="currentColor"
        className={`w-3.5 h-3.5 text-rose-500 transition-transform duration-200 scale-110 ${className}`}
      >
        <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
      </svg>
    );
  }
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="3"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`w-3.5 h-3.5 text-[#17402C] hover:text-rose-600 transition-colors ${className}`}
    >
      <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />
    </svg>
  );
}

export default function CommunityPostCard({
  post,
  user,
}: {
  post: CommunityPostItem;
  user?: any;
}) {
  const [isLiked, setIsLiked] = useState(Boolean(post.user_liked));
  const [likesCount, setLikesCount] = useState<number>(post.likes_count ?? 0);
  const [commentsCount, setCommentsCount] = useState<number>(post.comments_count ?? 0);
  const [showComments, setShowComments] = useState(false);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [commentsLoaded, setCommentsLoaded] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [isSaved, setIsSaved] = useState(Boolean(post.user_saved));
  const [isHidden, setIsHidden] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [parentCommentId, setParentCommentId] = useState<string | null>(null);
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState('');
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const commentInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const gpxInputRef = useRef<HTMLInputElement>(null);
  const { haptic } = useHapticFeedback();

  // ── Gestes feed niveau Instagram (mission gestes, Phase 4) ──
  const [heartBurst, setHeartBurst] = useState(0);
  const [showQuickMenu, setShowQuickMenu] = useState(false);
  const [viewerOpen, setViewerOpen] = useState(false);

  // Fermeture du menu rapide au clic extérieur et au scroll.
  useEffect(() => {
    if (!showQuickMenu) return;
    const close = () => setShowQuickMenu(false);
    const t = window.setTimeout(() => {
      document.addEventListener('pointerdown', close);
      window.addEventListener('scroll', close, true);
    }, 0);
    return () => {
      window.clearTimeout(t);
      document.removeEventListener('pointerdown', close);
      window.removeEventListener('scroll', close, true);
    };
  }, [showQuickMenu]);

  const [comments, setComments] = useState<PostCommentItem[]>([]);

  const loadComments = useCallback(async () => {
    setCommentsLoading(true);
    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('post_comments')
        .select('id, post_id, author_id, content, parent_id, created_at')
        .eq('post_id', post.id)
        .order('created_at', { ascending: true })
        .limit(100);
      if (error) throw error;

      const rows = (data ?? []) as Array<{
        id: string;
        author_id: string | null;
        content: string;
        parent_id: string | null;
        created_at: string;
      }>;
      const profiles = await fetchPublicProfilesWith(
        supabase,
        rows.map((row) => row.author_id).filter(Boolean) as string[]
      );

      setComments(
        rows.map((row) => {
          const profile = row.author_id ? profiles[row.author_id] : undefined;
          return {
            id: row.id,
            parentId: row.parent_id,
            author: profile
              ? {
                  id: profile.id,
                  full_name: profile.full_name ?? undefined,
                  avatar_url: profile.avatar_url ?? undefined,
                }
              : undefined,
            content: row.content,
            created_at: row.created_at,
            likes: 0,
            userLiked: false,
            isOwner: Boolean(user?.id && row.author_id === user.id),
          };
        })
      );
      setCommentsLoaded(true);
    } catch (err) {
      console.error('[CommunityPostCard] Erreur chargement commentaires:', err);
    } finally {
      setCommentsLoading(false);
    }
  }, [post.id, user?.id]);

  useEffect(() => {
    if (showComments && !commentsLoaded && !commentsLoading) {
      loadComments();
    }
  }, [showComments, commentsLoaded, commentsLoading, loadComments]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowMoreMenu(false);
      }
    }
    if (showMoreMenu) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showMoreMenu]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const handleLike = async () => {
    const newLiked = !isLiked;
    setIsLiked(newLiked);
    setLikesCount((prev: number) => (newLiked ? prev + 1 : Math.max(0, prev - 1)));

    const supabase = createClient();
    try {
      await supabase.rpc('toggle_community_post_like', { p_post_id: post.id });
    } catch (err) {
      console.error(err);
    }
  };

  // Double-tap sur le média → like + cœur animé (jamais d'unlike, comme IG).
  // Tap isolé (différé par le hook) → ouverture de la visionneuse plein écran.
  const doubleTap = useDoubleTap(() => {
    haptic('light');
    if (!isLiked) {
      handleLike();
    }
    setHeartBurst((k) => k + 1);
  }, {
    onSingleTap: () => {
      if (displayableImage) setViewerOpen(true);
    },
  });

  // URLs http(s) persistables ou chemins locaux (/assets/...) : jamais blob:/data:.
  const displayableImage =
    !!post.image_url && /^(https?:\/\/|\/)/i.test(post.image_url) ? post.image_url : null;

  // Troncature façon Twitter : 200 caractères max, « Afficher plus » pour étendre.
  const CONTENT_LIMIT = 200;
  const [isContentExpanded, setIsContentExpanded] = useState(false);
  const contentTruncated = (post.content || '').length > CONTENT_LIMIT;
  const displayContent = contentTruncated && !isContentExpanded
    ? post.content.slice(0, CONTENT_LIMIT).trimEnd() + '…'
    : post.content;

  // Long-press sur le corps du post → menu rapide (réaction, enregistrer, masquer, signaler).
  const longPress = useLongPress(() => {
    haptic('medium');
    setShowQuickMenu(true);
  });

  const handleToggleComments = () => {
    setShowComments(!showComments);
    if (!showComments) {
      setTimeout(() => commentInputRef.current?.focus(), 150);
    }
  };

  const handleLikeComment = (commentId: string) => {
    setComments(prev =>
      prev.map(c => {
        if (c.id === commentId) {
          const nextLiked = !c.userLiked;
          return {
            ...c,
            userLiked: nextLiked,
            likes: nextLiked ? (c.likes || 0) + 1 : Math.max(0, (c.likes || 0) - 1),
          };
        }
        return c;
      })
    );
  };

  const handleStartEditComment = (comment: PostCommentItem) => {
    setEditingCommentId(comment.id);
    setEditingText(comment.content);
  };

  const handleSaveEditComment = (commentId: string) => {
    if (!editingText.trim()) return;
    setComments(prev =>
      prev.map(c => (c.id === commentId ? { ...c, content: editingText.trim(), edited: true } : c))
    );
    setEditingCommentId(null);
    setEditingText('');
    showToast('Commentaire mis à jour !');
  };

  const handleDeleteComment = (commentId: string) => {
    setComments(prev => prev.filter(c => c.id !== commentId && c.parentId !== commentId));
    setCommentsCount((prev: number) => Math.max(0, prev - 1));
    showToast('Commentaire supprimé');
  };

  const handleReportComment = async (commentId: string) => {
    if (!user) {
      showToast('Connectez-vous pour signaler un commentaire.');
      return;
    }
    const supabase = createClient();
    const { error } = await supabase.from('comment_reports').insert({
      comment_id: commentId,
      reporter_id: user.id,
      reason: 'Signalement depuis le fil communauté',
      table_name: 'post_comments',
    });
    showToast(
      error
        ? 'Le signalement n’a pas pu être enregistré.'
        : 'Merci, ce commentaire a été signalé à la modération.'
    );
  };

  const handleReplyTo = (authorName: string, parentId?: string) => {
    setReplyingTo(authorName);
    if (parentId) setParentCommentId(parentId);
    setCommentText(`@${authorName} `);
    setShowComments(true);
    setTimeout(() => commentInputRef.current?.focus(), 150);
  };

  const handleShare = () => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(window.location.href);
      showToast('Lien copié dans le presse-papier !');
    }
  };

  const handleToggleSave = () => {
    setIsSaved(!isSaved);
    setShowMoreMenu(false);
    showToast(isSaved ? 'Retiré de vos favoris' : 'Enregistré dans vos favoris ⭐');
  };

  const handleHidePost = () => {
    setIsHidden(true);
    setShowMoreMenu(false);
    showToast('Publication masquée de votre fil.');
  };

  const handleReport = () => {
    setShowMoreMenu(false);
    setReportOpen(true);
  };

  const handleSendComment = async (
    customText?: string,
    attachmentUrl?: string,
    locationData?: string
  ) => {
    const textToSend = customText || commentText.trim();
    if (!textToSend && !attachmentUrl && !locationData) return;

    const newComment: PostCommentItem = {
      id: `c-${Date.now()}`,
      parentId: parentCommentId || null,
      content: textToSend || (locationData ? `📍 ${locationData}` : '📎 Photo partagée'),
      attachment: attachmentUrl || null,
      location: locationData || null,
      created_at: new Date().toISOString(),
      likes: 0,
      userLiked: false,
      isOwner: true,
      author: {
        full_name: user?.user_metadata?.full_name || 'Moi',
        avatar_url: user?.user_metadata?.avatar_url || undefined,
      },
    };

    setComments(prev => [...prev, newComment]);
    setCommentsCount((prev: number) => prev + 1);
    setCommentText('');
    setReplyingTo(null);
    setParentCommentId(null);

    const supabase = createClient();
    const { error } = await supabase.from('post_comments').insert({
      post_id: post.id,
      author_id: user?.id,
      content: newComment.content,
      parent_id: newComment.parentId,
    });

    if (error) {
      setComments(prev => prev.filter(c => c.id !== newComment.id));
      setCommentsCount((prev: number) => Math.max(0, prev - 1));
      showToast('Commentaire non enregistré. Réessayez.');
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const fakeUrl = URL.createObjectURL(file);
    handleSendComment(commentText || `Photo partagée : ${file.name}`, fakeUrl);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleGpxUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    handleSendComment(`🗺️ Trace GPX partagée : ${file.name}`);
    if (gpxInputRef.current) gpxInputRef.current.value = '';
  };

  const handleShareLocation = () => {
    if (typeof window === 'undefined' || !navigator?.geolocation) {
      showToast('Géolocalisation indisponible.');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const loc = `${pos.coords.latitude.toFixed(4)}, ${pos.coords.longitude.toFixed(4)}`;
        handleSendComment(`📍 Position terrain partagée : ${loc}`, undefined, loc);
      },
      () => {
        showToast('Impossible d’obtenir votre position.');
      }
    );
  };

  if (isHidden) return null;

  // Menu contextuel partagé (rangée sous le texte et overlay média).
  const moreMenuNode = (
    <AnimatePresence>
      {showMoreMenu && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: -4 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: -4 }}
          className="absolute right-0 bottom-full mb-2 w-48 bg-white/95 backdrop-blur-xl border border-white/90 rounded-2xl p-1.5 shadow-xl z-40 space-y-1 text-xs text-[#17402C]"
        >
          <button
            type="button"
            onClick={handleToggleSave}
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl hover:bg-black/5 transition-colors text-left"
          >
            <Icon name="bookmark" size={14} className={isSaved ? "text-amber-600" : "text-[#5C6B5E]"} />
            <span>{isSaved ? "Retirer des favoris" : "Enregistrer"}</span>
          </button>

          <button
            type="button"
            onClick={() => { handleShare(); setShowMoreMenu(false); }}
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl hover:bg-black/5 transition-colors text-left"
          >
            <Icon name="link" size={14} className="text-[#5C6B5E]" />
            <span>Copier le lien direct</span>
          </button>

          <button
            type="button"
            onClick={handleHidePost}
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl hover:bg-black/5 transition-colors text-left"
          >
            <Icon name="eye-off" size={14} className="text-[#5C6B5E]" />
            <span>Masquer ce post</span>
          </button>

          <div className="border-t border-[#17402C]/10 my-1" />

          <button
            type="button"
            onClick={handleReport}
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl hover:bg-red-50 text-red-600 transition-colors text-left font-semibold"
          >
            <Icon name="flag" size={14} />
            <span>Signaler le post</span>
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );

  // Rangée d'actions sous le texte (posts sans image) — même design, ton carte claire.
  const actionsContent = (
    <>
      <div className="flex items-center gap-2.5">
        <OverlayPill label="J'aime cette expédition" onClick={handleLike} pillWidth={84}>
          <span style={{ width: '15px', height: '15px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <HeartSvg filled={isLiked} />
          </span>
          {likesCount > 0 && <span style={{ lineHeight: 1 }}>{likesCount}</span>}
        </OverlayPill>

        <OverlayPill label="Commenter la publication" onClick={handleToggleComments} pillWidth={84}>
          <Icon name="message-square" size={15} color="#ffffff" />
          {commentsCount > 0 && <span style={{ lineHeight: 1 }}>{commentsCount}</span>}
        </OverlayPill>
      </div>

      <div className="flex items-center gap-2.5">
        <OverlayPill label="Partager" onClick={handleShare}>
          <Icon name="send" size={15} color="#ffffff" />
        </OverlayPill>

        <div className="relative" ref={menuRef}>
          <OverlayPill label="Options de la publication" onClick={() => setShowMoreMenu(!showMoreMenu)}>
            <Icon name="ellipsis" size={16} color="#ffffff" />
          </OverlayPill>
          {moreMenuNode}
        </div>
      </div>
    </>
  );

  // Rangée d'actions en verre posée sur la photo (pile LiquidGlass, référence rdev).
  const overlayActionsContent = (
    <>
      <div className="flex items-center gap-2.5">
        <OverlayPill label="J'aime cette expédition" onClick={handleLike} pillWidth={84}>
          <span style={{ width: '15px', height: '15px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <HeartSvg filled={isLiked} className={isLiked ? '' : '!text-white'} />
          </span>
          {likesCount > 0 && <span style={{ lineHeight: 1 }}>{likesCount}</span>}
        </OverlayPill>

        <OverlayPill label="Commenter la publication" onClick={handleToggleComments} pillWidth={84}>
          <Icon name="message-square" size={15} color="#ffffff" />
          {commentsCount > 0 && <span style={{ lineHeight: 1 }}>{commentsCount}</span>}
        </OverlayPill>
      </div>

      <div className="flex items-center gap-2.5">
        <OverlayPill label="Partager" onClick={handleShare}>
          <Icon name="send" size={15} color="#ffffff" />
        </OverlayPill>

        <div className="relative" ref={menuRef}>
          <OverlayPill label="Options de la publication" onClick={() => setShowMoreMenu(!showMoreMenu)}>
            <Icon name="ellipsis" size={16} color="#ffffff" />
          </OverlayPill>
          {moreMenuNode}
        </div>
      </div>
    </>
  );

  return (
    <div className="community-post glass rounded-2xl overflow-hidden p-4 sm:p-5 relative space-y-4">
      {/* Toast notification */}
      {toastMessage && (
        <div className="absolute top-3 left-1/2 -translate-x-1/2 z-30 bg-[#17402C] text-white text-[11px] font-mono px-3 py-1 rounded-full shadow-md animate-fade-in">
          {toastMessage}
        </div>
      )}

      {/* Menu rapide long-press (mission gestes, Phase 4) — glass, palette LKDV */}
      {showQuickMenu && (
        <div className="absolute top-10 left-1/2 -translate-x-1/2 z-40 p-1.5 glass rounded-2xl shadow-lg flex items-center gap-1 animate-scale-in">
          <button
            type="button"
            onClick={() => {
              haptic('light');
              if (!isLiked) handleLike();
              setHeartBurst((k) => k + 1);
              setShowQuickMenu(false);
            }}
            className="glass-circle-btn w-11 h-11 rounded-full flex items-center justify-center text-xl active:scale-125 transition-transform"
            title="J'aime"
          >
            ❤️
          </button>
          <button
            type="button"
            onClick={() => { haptic('light'); handleToggleSave(); }}
            className="glass-circle-btn w-11 h-11 rounded-full flex items-center justify-center text-xl active:scale-125 transition-transform"
            title={isSaved ? 'Retirer des favoris' : 'Enregistrer'}
          >
            {isSaved ? '⭐' : '🔖'}
          </button>
          <div className="w-px h-5 bg-stone-200/80 mx-0.5" />
          <button
            type="button"
            onClick={() => { haptic('light'); handleHidePost(); }}
            className="glass-circle-btn w-11 h-11 rounded-full flex items-center justify-center text-base active:scale-125 transition-transform"
            title="Masquer"
          >
            🙈
          </button>
          <button
            type="button"
            onClick={() => { haptic('light'); handleReport(); }}
            className="glass-circle-btn w-11 h-11 rounded-full flex items-center justify-center text-base active:scale-125 transition-transform"
            title="Signaler"
          >
            🚩
          </button>
        </div>
      )}

      {/* Zone geste : header + contenu + média (long-press menu rapide) */}
      <div {...longPress}>
      {/* Header author & Badge */}
      <div className="flex items-center justify-between">
        <Link
          href={post.author?.id ? `/profil/${post.author.id}` : post.user_id ? `/profil/${post.user_id}` : '/communaute'}
          className="flex items-center gap-3 group/author cursor-pointer"
        >
          {post.author?.avatar_url ? (
            <img
              src={post.author.avatar_url}
              alt={post.author?.full_name || 'Auteur'}
              className="w-10 h-10 rounded-full object-cover border border-[#17402C]/10 group-hover/author:scale-105 transition-transform"
            />
          ) : (
            <div className="w-10 h-10 rounded-full bg-[#17402C] text-white flex items-center justify-center text-sm font-bold border border-[#17402C]/10 group-hover/author:scale-105 transition-transform">
              {(post.author?.full_name?.charAt(0) || 'V').toUpperCase()}
            </div>
          )}
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[15px] font-semibold tracking-[-0.01em] text-[#17402C] group-hover/author:underline">{post.author?.full_name || 'Voyageur LKDV'}</span>
              {post.author?.loyalty_level && (
                <span className="bg-[#17402C]/10 text-[#17402C] text-[10px] font-mono font-bold px-2 py-0.5 rounded-full uppercase">
                  {post.author.loyalty_level}
                </span>
              )}
            </div>
            <span className="text-[12px] text-[#5C6B5E] font-mono mt-0.5 block">{timeAgo(post.created_at || new Date().toISOString())}</span>
          </div>
        </Link>

        <span className="glass-pill text-[10px] font-mono font-bold text-[#17402C]">FIL</span>
      </div>

      {/* Content — 200 caractères max, expansion façon Twitter ; respiration haut/bas */}
      <p className="text-[15px] text-[#17402C] leading-[1.7] whitespace-pre-line py-2">
        {displayContent}
        {contentTruncated && !isContentExpanded && (
          <button
            type="button"
            onClick={() => setIsContentExpanded(true)}
            className="text-[15px] font-semibold text-[#17402C]/75 hover:text-[#17402C] ml-1 py-0.5 inline"
          >
            Afficher plus
          </button>
        )}
        {contentTruncated && isContentExpanded && (
          <button
            type="button"
            onClick={() => setIsContentExpanded(false)}
            className="text-[15px] font-semibold text-[#17402C]/75 hover:text-[#17402C] ml-1 py-0.5 inline"
          >
            Afficher moins
          </button>
        )}
      </p>

      {/* Snapshot figé du carnet lié (Phase 7) — jamais de lecture live */}
      {post.snapshot_payload && (
        <div className="glass-sub-card rounded-2xl overflow-hidden">
          {post.snapshot_payload.cover_image && (
            <div className="aspect-[16/7] bg-[#EEF3EC]">
              <SmartImage
                src={post.snapshot_payload.cover_image}
                alt={post.snapshot_payload.title || 'Carnet publié'}
                className="w-full h-full object-cover"
              />
            </div>
          )}
          <div className="p-3 space-y-1">
            <div className="flex items-center gap-2">
              <span className="glass-pill text-[8.5px] font-mono font-bold text-[#17402C]">
                CARNET · INSTANTANÉ PUBLIÉ
              </span>
            </div>
            <h4 className="font-display font-bold text-sm text-[#17402C]">
              {post.snapshot_payload.title || 'Carnet de voyage'}
            </h4>
            {post.snapshot_payload.destination && (
              <p className="text-[11px] text-[#5C6B5E]">📍 {post.snapshot_payload.destination}</p>
            )}
            {post.snapshot_payload.description && (
              <p className="text-xs text-[#5C6B5E] leading-relaxed line-clamp-3">
                {post.snapshot_payload.description}
              </p>
            )}
          </div>
        </div>
      )}

      {/* Attached Media — plein-bord, haute (jusque sous le texte), collée au bas de la card */}
      {displayableImage && (
        <div className={`relative -mx-4 sm:-mx-5 ${showComments ? '' : '-mb-4 sm:-mb-5'}`}>
          {/* Ambilight — les couleurs de la photo remontent dans la card jusqu'à ~30% sous le texte */}
          <div
            aria-hidden="true"
            className="lkdv-ambilight pointer-events-none absolute -top-24 inset-x-0 h-60"
            style={{
              backgroundImage: `url(${displayableImage})`,
              backgroundSize: 'cover',
              backgroundPosition: 'center 30%',
              filter: 'blur(50px) saturate(1.7)',
              transform: 'scale(1.25)',
              opacity: 0.45,
              WebkitMaskImage: 'linear-gradient(to top, rgba(0,0,0,1) 0%, rgba(0,0,0,0.35) 55%, rgba(0,0,0,0) 100%)',
              maskImage: 'linear-gradient(to top, rgba(0,0,0,1) 0%, rgba(0,0,0,0.35) 55%, rgba(0,0,0,0) 100%)',
            }}
          />
          <div
            {...doubleTap}
            className="relative z-10 overflow-hidden aspect-[4/5] sm:aspect-[16/10] bg-[#EEF3EC] select-none cursor-zoom-in"
          >
            <SmartImage
              src={displayableImage}
              alt="Photo de l'expédition"
              className="w-full h-full object-cover"
            />

            {/* Fusion givrée : la photo se dissout dans le verre de la card (sans ligne dure) */}
            <div aria-hidden="true" className="lkdv-photo-melt" />

          {/* Voile de lisibilité sous les contrôles (pattern iOS Photos) */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-[#0B1F17]/35 via-[#0B1F17]/10 to-transparent"
          />

          {/* Date — pill verre en haut à droite de l'image */}
          <div
            className="absolute top-3 right-3 px-3 py-1.5 rounded-full text-[11px] font-mono text-[#17402C] tracking-wider border border-white/50"
            style={{
              background: 'rgba(255,255,255,0.62)',
              backdropFilter: 'blur(8px) saturate(160%)',
              WebkitBackdropFilter: 'blur(8px) saturate(160%)',
            }}
          >
            {timeAgo(post.created_at || new Date().toISOString())}
          </div>

          {/* Cœur animé du double-tap — transform/opacity uniquement, 60fps */}
          <AnimatePresence>
            {heartBurst > 0 && (
              <motion.div
                key={heartBurst}
                className="pointer-events-none absolute inset-0 flex items-center justify-center"
                initial={{ opacity: 0, scale: 0.3 }}
                animate={{
                  opacity: [0, 1, 1, 0],
                  scale: [0.3, 1.25, 1, 1.15],
                  rotate: [-8, 0, 0, 8],
                }}
                transition={{ duration: 0.7, times: [0, 0.25, 0.6, 1], ease: 'easeOut' }}
                onAnimationComplete={() => setHeartBurst(0)}
              >
                <svg viewBox="0 0 24 24" fill="currentColor" className="w-20 h-20 text-rose-500 drop-shadow-lg">
                  <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
                </svg>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Actions sociales en verre posées sur la photo — pile LiquidGlass (référence rdev) */}
          <div
            className="lkdv-photo-actions absolute inset-x-3.5 bottom-3.5 flex items-center justify-between"
            onClick={(e) => e.stopPropagation()}
            onPointerDown={(e) => e.stopPropagation()}
          >
            {overlayActionsContent}
          </div>
          </div>
        </div>
      )}
      </div>
      {/* Fin zone geste */}

      {/* Actions Row — sous le texte uniquement quand il n'y a pas d'image (sinon sur l'image) */}
      {!displayableImage && (
        <div className="pt-2.5 border-t border-[#17402C]/10 flex items-center justify-between">
          {actionsContent}
        </div>
      )}

      {/* Full Feature Threaded Comments Drawer (Pure Liquid Glass) */}
      <AnimatePresence>
        {showComments && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden pt-4 border-t border-[#17402C]/10 space-y-3.5"
          >
            {/* Header of comments drawer */}
            <div className="flex items-center justify-between text-xs text-[#5C6B5E] px-1">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-forest-600 animate-pulse" />
                <span className="font-bold text-[#17402C]">Discussions ({comments.length})</span>
              </div>
              <span className="text-[10px] font-mono text-[#5C6B5E]">Fil d'échange en direct</span>
            </div>

            {/* List of comments (Root Comments with Nested Threaded Replies) */}
            <div className="space-y-3 max-h-80 overflow-y-auto custom-scrollbar pr-1">
              {commentsLoading && comments.length === 0 && (
                <p className="text-[11px] text-[#5C6B5E] px-1 py-3">Chargement des commentaires...</p>
              )}
              {!commentsLoading && commentsLoaded && comments.length === 0 && (
                <p className="text-[11px] text-[#5C6B5E] px-1 py-3">
                  Aucun commentaire pour le moment.
                </p>
              )}
              {comments
                .filter((c) => !c.parentId)
                .map((rootComment) => {
                  const replies = comments.filter((c) => c.parentId === rootComment.id);

                  return (
                    <div key={rootComment.id} className="space-y-2">
                      {/* Root Comment Card (Pure Liquid Glass) */}
                      <div className="glass p-3.5 rounded-2xl border border-white/60 shadow-2xs space-y-2 group relative">
                        <div className="flex items-center justify-between text-[10px]">
                          <Link
                            href={rootComment.author?.id ? `/profil/${rootComment.author.id}` : '/communaute'}
                            className="flex items-center gap-2.5 group/cauthor cursor-pointer"
                          >
                            <div className="w-7 h-7 rounded-full bg-[#17402C] text-white flex items-center justify-center font-bold text-xs overflow-hidden border border-white/40 shadow-xs group-hover/cauthor:scale-105 transition-transform">
                              {rootComment.author?.avatar_url ? (
                                <img
                                  src={rootComment.author.avatar_url}
                                  alt={rootComment.author?.full_name || 'Voyageur'}
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                (rootComment.author?.full_name?.charAt(0) || 'V').toUpperCase()
                              )}
                            </div>
                            <div>
                              <span className="font-bold text-xs text-[#17402C] block leading-tight group-hover/cauthor:underline">
                                {rootComment.author?.full_name || 'Voyageur'}
                              </span>
                              <span className="text-[9.5px] text-[#5C6B5E] font-mono">
                                {timeAgo(rootComment.created_at || new Date().toISOString())}
                                {rootComment.edited && ' · modifié'}
                              </span>
                            </div>
                          </Link>

                          {/* Comment Options Buttons (Image 3 style) */}
                          <div className="flex items-center gap-1 opacity-70 group-hover:opacity-100 transition-opacity">
                            {rootComment.isOwner ? (
                              <>
                                <IconButton
                                  size="sm"
                                  title="Modifier"
                                  onClick={() => handleStartEditComment(rootComment)}
                                  aria-label="Modifier"
                                >
                                  <Icon name="pencil" size={11} />
                                </IconButton>
                                <IconButton
                                  size="sm"
                                  title="Supprimer"
                                  onClick={() => handleDeleteComment(rootComment.id)}
                                  aria-label="Supprimer"
                                >
                                  <Icon name="trash2" size={11} className="text-red-600" />
                                </IconButton>
                              </>
                            ) : (
                              <IconButton
                                size="sm"
                                title="Signaler"
                                onClick={() => handleReportComment(rootComment.id)}
                                aria-label="Signaler"
                              >
                                <Icon name="flag" size={11} />
                              </IconButton>
                            )}
                          </div>
                        </div>

                        {/* Comment Content or Edit Form */}
                        {editingCommentId === rootComment.id ? (
                          <div className="pl-9 space-y-2 pt-1">
                            <textarea
                              rows={2}
                              value={editingText}
                              onChange={(e) => setEditingText(e.target.value)}
                              className="glass w-full rounded-xl p-2.5 text-xs text-[#17402C] focus:outline-none focus:ring-1 focus:ring-[#17402C]"
                            />
                            <div className="flex items-center gap-2 justify-end">
                              <button
                                type="button"
                                onClick={() => setEditingCommentId(null)}
                                className="glass-capsule-btn !min-w-0 !min-h-0 px-3.5 py-1 text-[11px] font-bold !text-[#5C6B5E]"
                              >
                                Annuler
                              </button>
                              <button
                                type="button"
                                onClick={() => handleSaveEditComment(rootComment.id)}
                                className="glass-capsule-btn primary text-[11px] font-bold !py-1 !px-3.5"
                              >
                                Enregistrer
                              </button>
                            </div>
                          </div>
                        ) : (
                          <>
                            <p className="text-xs text-[#17402C] pl-9 leading-relaxed">
                              {rootComment.content}
                            </p>

                            {/* Image Attachment */}
                            {rootComment.attachment && (
                              <div className="pl-9 pt-1">
                                <img
                                  src={rootComment.attachment}
                                  alt="Pièce jointe"
                                  className="w-40 h-28 object-cover rounded-xl border border-white/60 shadow-xs"
                                />
                              </div>
                            )}
                          </>
                        )}

                        {/* Footer Reply & Like Buttons */}
                        <div className="flex items-center justify-between pl-9 pt-1 text-[11px]">
                          <IconButton
                            size="sm"
                            title={`Répondre à ${rootComment.author?.full_name || 'ce message'}`}
                            onClick={() => handleReplyTo(rootComment.author?.full_name || 'Voyageur', rootComment.id)}
                            aria-label={`Répondre à ${rootComment.author?.full_name || 'ce message'}`}
                          >
                            <Icon name="reply" size={12} />
                          </IconButton>

                          <IconButton
                            size="sm"
                            onClick={() => handleLikeComment(rootComment.id)}
                            title="Aimer ce commentaire"
                            aria-label="Aimer ce commentaire"
                            variant={rootComment.userLiked ? 'solid' : 'glass'}
                            aria-pressed={rootComment.userLiked || undefined}
                            style={{ width: 'auto', paddingInline: '10px' }}
                          >
                            <span className="inline-flex items-center gap-1.5"><HeartSvg filled={rootComment.userLiked} className="w-3 h-3" /><span className="tabular-nums">{rootComment.likes || 0}</span></span>
                          </IconButton>
                        </div>
                      </div>

                      {/* Threaded Child Replies (Offset with Connecting Guide Line) */}
                      {replies.length > 0 && (
                        <div className="relative ml-5 sm:ml-7 pl-4 sm:pl-5 border-l-2 border-[#17402C]/20 space-y-2 pt-1">
                          {replies.map((reply) => (
                            <div
                              key={reply.id}
                              className="relative before:absolute before:-left-4 sm:before:-left-5 before:top-4 before:w-3 sm:before:w-4 before:h-[2px] before:bg-[#17402C]/20 before:rounded-full"
                            >
                              <div className="glass p-3 rounded-2xl border border-white/60 shadow-2xs space-y-1.5 group">
                                <div className="flex items-center justify-between text-[10px]">
                                  <div className="flex items-center gap-2">
                                    <div className="w-5 h-5 rounded-full bg-[#17402C] text-white flex items-center justify-center font-bold text-[10px] overflow-hidden border border-white/30">
                                      {reply.author?.avatar_url ? (
                                        <img
                                          src={reply.author.avatar_url}
                                          alt={reply.author?.full_name || 'Voyageur'}
                                          className="w-full h-full object-cover"
                                        />
                                      ) : (
                                        (reply.author?.full_name?.charAt(0) || 'V').toUpperCase()
                                      )}
                                    </div>
                                    <span className="font-bold text-[11px] text-[#17402C]">
                                      {reply.author?.full_name || 'Voyageur'}
                                    </span>
                                    <span className="text-[9px] text-[#5C6B5E] font-mono">
                                      {timeAgo(reply.created_at || new Date().toISOString())}
                                    </span>
                                  </div>

                                  <div className="flex items-center gap-1 opacity-70 group-hover:opacity-100 transition-opacity">
                                    {reply.isOwner ? (
                                      <IconButton
                                        size="sm"
                                        title="Supprimer"
                                        onClick={() => handleDeleteComment(reply.id)}
                                        aria-label="Supprimer"
                                      >
                                        <Icon name="trash2" size={11} className="text-red-600" />
                                      </IconButton>
                                    ) : (
                                      <IconButton
                                        size="sm"
                                        title="Signaler"
                                        onClick={() => handleReportComment(reply.id)}
                                        aria-label="Signaler"
                                      >
                                        <Icon name="flag" size={11} />
                                      </IconButton>
                                    )}
                                  </div>
                                </div>

                                <p className="text-xs text-[#17402C] pl-7 leading-relaxed">
                                  {reply.content}
                                </p>

                                <div className="flex items-center justify-end pl-7 pt-0.5">
                                  <IconButton
                                    size="sm"
                                    onClick={() => handleLikeComment(reply.id)}
                                    title="Aimer cette réponse"
                                    aria-label="Aimer cette réponse"
                                    variant={reply.userLiked ? 'solid' : 'glass'}
                                    aria-pressed={reply.userLiked || undefined}
                                    style={{ width: 'auto', paddingInline: '10px' }}
                                  >
                                    <span className="inline-flex items-center gap-1.5"><HeartSvg filled={reply.userLiked} className="w-2.5 h-2.5" /><span className="tabular-nums">{reply.likes || 0}</span></span>
                                  </IconButton>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
            </div>

            {/* Hidden Inputs for Attachments */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleFileUpload}
            />
            <input
              ref={gpxInputRef}
              type="file"
              accept=".gpx"
              className="hidden"
              onChange={handleGpxUpload}
            />

            {/* Liquid Glass Composer Bar */}
            <div className="space-y-1.5 pt-1">
              {replyingTo && (
                <div className="glass px-3 py-1.5 rounded-xl border border-forest-300/60 flex items-center justify-between text-[11px] text-forest-900 shadow-2xs">
                  <span>En réponse à <strong>@{replyingTo}</strong></span>
                  <button
                    type="button"
                    onClick={() => { setReplyingTo(null); setParentCommentId(null); setCommentText(''); }}
                    className="glass-circle-btn !w-9 !h-9 !min-w-9 !min-h-9 font-bold"
                  >
                    ✕
                  </button>
                </div>
              )}

              {/* Liquid Glass Input Capsule with Image 3 Glass Buttons */}
              <div className="glass p-1.5 pl-3 rounded-full border border-white/70 flex items-center gap-1.5 shadow-xs">
                <input
                  ref={commentInputRef}
                  type="text"
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSendComment();
                    }
                  }}
                  placeholder={replyingTo ? `Répondre à @${replyingTo}...` : "Ajouter une réponse ou un retour terrain..."}
                  className="flex-1 bg-transparent border-none text-xs text-[#17402C] focus:outline-none placeholder-[#5C6B5E]"
                />

                {/* Attachment & Action Buttons (Image 3 Style) */}
                <IconButton
                  size="sm"
                  title="Joindre une photo"
                  onClick={() => fileInputRef.current?.click()}
                  aria-label="Joindre une photo"
                >
                  <Icon name="image-plus" size={13} />
                </IconButton>
                <IconButton
                  size="sm"
                  title="Partager un GPX"
                  onClick={() => gpxInputRef.current?.click()}
                  aria-label="Partager un GPX"
                >
                  <span className="text-[11px] leading-none">🗺️</span>
                </IconButton>
                <IconButton
                  size="sm"
                  title="Partager ma position"
                  onClick={handleShareLocation}
                  aria-label="Partager ma position"
                >
                  <Icon name="map-pin" size={13} />
                </IconButton>

                <IconButton
                  size="md"
                  title="Publier le commentaire"
                  onClick={() => handleSendComment()}
                  aria-label="Publier le commentaire"
                >
                  <Icon name="send" size={13} />
                </IconButton>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Visionneuse plein écran (mission gestes, Phase 6) — pinch, double-tap-zoom,
          swipe-down close, swipe horizontal. Dynamic import (First Load JS). */}
      {viewerOpen && displayableImage && (
        <ImageViewer
          images={[displayableImage]}
          index={0}
          alt="Photo de l'expédition — vue plein écran"
          onClose={() => setViewerOpen(false)}
        />
      )}

      <ReportSheet
        isOpen={reportOpen}
        onClose={() => setReportOpen(false)}
        contentId={post.id}
        contentType="post"
        onSubmitReport={async (reason, details) => {
          if (!user) throw new Error('Authentification requise');
          const supabase = createClient();
          const { error } = await supabase.from('comment_reports').insert({
            comment_id: post.id,
            reporter_id: user.id,
            reason: details ? `${reason} — ${details}` : reason,
            table_name: 'community_posts',
          });
          if (error) throw error;
        }}
      />
    </div>
  );
}
