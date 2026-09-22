'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { motion, AnimatePresence } from 'framer-motion';
import Icon from '@/components/ui/AppIcon';
import { Badge, Button, Card, Divider, IconButton } from '@/components/ui';
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

// Heart SVG Icon helper for crisp rendering
export function HeartSvg({ filled = false, className = '' }: { filled?: boolean; className?: string }) {
  if (filled) {
    return (
      <svg
        viewBox="0 0 24 24"
        fill="currentColor"
        className={`size-3.5 scale-110 text-[color:var(--lkv-danger)] transition-transform duration-200 ${className}`}
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
      className={`size-3.5 text-[color:var(--lkv-text-primary)] transition-colors hover:text-[color:var(--lkv-danger)] ${className}`}
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
          className="absolute bottom-full right-0 z-[var(--z-dropdown)] mb-[var(--space-2)] w-48"
        >
          <Card className="space-y-[var(--space-1)] p-[var(--space-1)]">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              fullWidth
              className="justify-start"
              onClick={handleToggleSave}
              icon={<Icon name="bookmark" size={14} className={isSaved ? 'text-[color:var(--lkv-warning)]' : 'text-[color:var(--lkv-text-secondary)]'} aria-hidden="true" />}
            >
              {isSaved ? 'Retirer des favoris' : 'Enregistrer'}
            </Button>

            <Button
              type="button"
              variant="ghost"
              size="sm"
              fullWidth
              className="justify-start"
              onClick={() => { handleShare(); setShowMoreMenu(false); }}
              icon={<Icon name="link" size={14} className="text-[color:var(--lkv-text-secondary)]" aria-hidden="true" />}
            >
              Copier le lien direct
            </Button>

            <Button
              type="button"
              variant="ghost"
              size="sm"
              fullWidth
              className="justify-start"
              onClick={handleHidePost}
              icon={<Icon name="eye-off" size={14} className="text-[color:var(--lkv-text-secondary)]" aria-hidden="true" />}
            >
              Masquer ce post
            </Button>

            <Divider spacing="sm" />

            <Button
              type="button"
              variant="ghost"
              size="sm"
              fullWidth
              className="justify-start text-[color:var(--lkv-danger)] hover:bg-[color:var(--lkv-danger-bg)]"
              onClick={handleReport}
              icon={<Icon name="flag" size={14} aria-hidden="true" />}
            >
              Signaler le post
            </Button>
          </Card>
        </motion.div>
      )}
    </AnimatePresence>
  );

  // Rangée d'actions : même contenu sur la carte claire et sur le média.
  // P2 — sur photo, les boutons portent déjà un verre clair (`card-tint-strong`) :
  // icônes sombres (`text-primary`) pour un contraste ≥4.5 (plus de blanc sur verre clair).
  const actionsNode = (onImage: boolean) => (
    <>
      <div className="flex items-center gap-[var(--space-2)]">
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={handleLike}
          aria-label="J'aime cette expédition"
          className={onImage ? 'min-w-[84px] border-[color:var(--glass-border)] bg-[color:var(--card-tint-strong)] backdrop-blur-[var(--blur-md)]' : 'min-w-[84px]'}
        >
          <HeartSvg filled={isLiked} className="" />
          {likesCount > 0 && <span className="tabular-nums">{likesCount}</span>}
        </Button>

        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={handleToggleComments}
          aria-label="Commenter la publication"
          className={onImage ? 'min-w-[84px] border-[color:var(--glass-border)] bg-[color:var(--card-tint-strong)] backdrop-blur-[var(--blur-md)]' : 'min-w-[84px]'}
        >
          <Icon
            name="message-square"
            size={15}
            color="var(--lkv-text-primary)"
            aria-hidden="true"
          />
          {commentsCount > 0 && <span className="tabular-nums">{commentsCount}</span>}
        </Button>
      </div>

      <div className="flex items-center gap-[var(--space-2)]">
        <IconButton
          type="button"
          variant="glass"
          onClick={handleShare}
          aria-label="Partager"
          className={onImage ? 'border-[color:var(--glass-border)] bg-[color:var(--card-tint-strong)] backdrop-blur-[var(--blur-md)]' : ''}
        >
          <Icon
            name="send"
            size={15}
            color="var(--lkv-text-primary)"
            aria-hidden="true"
          />
        </IconButton>

        <div className="relative" ref={menuRef}>
          <IconButton
            type="button"
            variant="glass"
            onClick={() => setShowMoreMenu(!showMoreMenu)}
            aria-label="Options de la publication"
            className={onImage ? 'border-[color:var(--glass-border)] bg-[color:var(--card-tint-strong)] backdrop-blur-[var(--blur-md)]' : ''}
          >
            <Icon
              name="ellipsis"
              size={16}
              color="var(--lkv-text-primary)"
              aria-hidden="true"
            />
          </IconButton>
          {moreMenuNode}
        </div>
      </div>
    </>
  );

  return (
    <Card className="community-post relative space-y-[var(--space-4)] overflow-hidden p-[var(--space-4)] sm:p-[var(--space-5)]">
      {/* Toast notification */}
      {toastMessage && (
        <div className="animate-fade-in absolute left-1/2 top-3 z-[var(--z-toast)] -translate-x-1/2 rounded-full bg-[color:var(--btn-tint)] border border-[color:var(--btn-glass-border)] backdrop-blur-[var(--btn-blur)] saturate-[var(--btn-saturate)] px-3 py-1 font-mono text-[length:var(--lkv-text-caption-2)] text-[color:var(--lkv-text-primary)] shadow-elevation-2">
          {toastMessage}
        </div>
      )}

      {/* Menu rapide long-press (mission gestes, Phase 4) — glass, palette LKDV */}
      {showQuickMenu && (
        <div className="animate-scale-in absolute left-1/2 top-10 z-[var(--z-dropdown)] -translate-x-1/2">
          <Card className="flex items-center gap-[var(--space-1)] p-[var(--space-1)] shadow-elevation-3">
            <IconButton
              type="button"
              variant="glass"
              size="lg"
              onClick={() => {
                haptic('light');
                if (!isLiked) handleLike();
                setHeartBurst((k) => k + 1);
                setShowQuickMenu(false);
              }}
              title="J'aime"
              aria-label="J'aime"
              className="text-xl active:scale-125"
            >
              ❤️
            </IconButton>
            <IconButton
              type="button"
              variant="glass"
              size="lg"
              onClick={() => { haptic('light'); handleToggleSave(); }}
              title={isSaved ? 'Retirer des favoris' : 'Enregistrer'}
              aria-label={isSaved ? 'Retirer des favoris' : 'Enregistrer'}
              className="text-xl active:scale-125"
            >
              {isSaved ? '⭐' : '🔖'}
            </IconButton>
            <div className="mx-0.5 h-5 w-px bg-[color:var(--lkv-border)]" />
            <IconButton
              type="button"
              variant="glass"
              size="lg"
              onClick={() => { haptic('light'); handleHidePost(); }}
              title="Masquer"
              aria-label="Masquer"
              className="text-base active:scale-125"
            >
              🙈
            </IconButton>
            <IconButton
              type="button"
              variant="glass"
              size="lg"
              onClick={() => { haptic('light'); handleReport(); }}
              title="Signaler"
              aria-label="Signaler"
              className="text-base active:scale-125"
            >
              🚩
            </IconButton>
          </Card>
        </div>
      )}

      {/* Zone geste : header + contenu + média (long-press menu rapide) */}
      <div {...longPress}>
      {/* Header author & Badge */}
      <div className="flex items-center justify-between">
        <Link
          href={post.author?.id ? `/profil/${post.author.id}` : post.user_id ? `/profil/${post.user_id}` : '/communaute'}
          className="group/author flex cursor-pointer items-center gap-[var(--space-3)]"
        >
          {post.author?.avatar_url ? (
            <img
              src={post.author.avatar_url}
              alt={post.author?.full_name || 'Auteur'}
              className="size-10 rounded-full border border-[color:var(--lkv-border)] object-cover transition-transform group-hover/author:scale-105"
            />
          ) : (
            <div className="flex size-10 items-center justify-center rounded-full border border-[color:var(--btn-glass-border)] bg-[color:var(--btn-tint)] backdrop-blur-[var(--btn-blur)] saturate-[var(--btn-saturate)] lkv-rim-btn text-[length:var(--lkv-text-footnote)] font-bold text-[color:var(--lkv-text-primary)] transition-transform group-hover/author:scale-105">
              {(post.author?.full_name?.charAt(0) || 'V').toUpperCase()}
            </div>
          )}
          <div>
            <div className="flex items-center gap-[var(--space-2)]">
              <span className="text-[length:var(--lkv-text-subheadline)] font-semibold tracking-[-0.01em] text-[color:var(--lkv-text-primary)] group-hover/author:underline">
                {post.author?.full_name || 'Voyageur LKDV'}
              </span>
              {post.author?.loyalty_level && (
                <Badge tone="sage" className="font-mono uppercase">
                  {post.author.loyalty_level}
                </Badge>
              )}
            </div>
            <span className="mt-0.5 block font-mono text-[length:var(--lkv-text-caption)] text-[color:var(--lkv-text-muted)]">
              {timeAgo(post.created_at || new Date().toISOString())}
            </span>
          </div>
        </Link>

        <Badge tone="stone" className="font-mono">FIL</Badge>
      </div>

      {/* Content — 200 caractères max, expansion façon Twitter ; respiration haut/bas */}
      <p className="whitespace-pre-line py-[var(--space-2)] text-[length:var(--lkv-text-subheadline)] leading-[1.7] text-[color:var(--lkv-text-primary)]">
        {displayContent}
        {contentTruncated && !isContentExpanded && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="ml-[var(--space-1)] text-[length:var(--lkv-text-subheadline)] font-semibold text-[color:var(--lkv-primary)]"
            onClick={() => setIsContentExpanded(true)}
          >
            Afficher plus
          </Button>
        )}
        {contentTruncated && isContentExpanded && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="ml-[var(--space-1)] text-[length:var(--lkv-text-subheadline)] font-semibold text-[color:var(--lkv-primary)]"
            onClick={() => setIsContentExpanded(false)}
          >
            Afficher moins
          </Button>
        )}
      </p>

      {/* Snapshot figé du carnet lié (Phase 7) — jamais de lecture live */}
      {post.snapshot_payload && (
        <Card variant="compact" className="overflow-hidden p-0">
          {post.snapshot_payload.cover_image && (
            <div className="aspect-[16/7] bg-[color:var(--glass-bg-medium)]">
              <SmartImage
                src={post.snapshot_payload.cover_image}
                alt={post.snapshot_payload.title || 'Carnet publié'}
                className="size-full object-cover"
              />
            </div>
          )}
          <div className="space-y-[var(--space-1)] p-[var(--space-3)]">
            <div className="flex items-center gap-[var(--space-2)]">
              <Badge tone="sage" className="font-mono">
                CARNET · INSTANTANÉ PUBLIÉ
              </Badge>
            </div>
            <h4 className="font-display text-[length:var(--lkv-text-footnote)] font-bold text-[color:var(--lkv-text-primary)]">
              {post.snapshot_payload.title || 'Carnet de voyage'}
            </h4>
            {post.snapshot_payload.destination && (
              <p className="text-[length:var(--lkv-text-caption)] text-[color:var(--lkv-text-muted)]">
                📍 {post.snapshot_payload.destination}
              </p>
            )}
            {post.snapshot_payload.description && (
              <p className="line-clamp-3 text-[length:var(--lkv-text-caption)] leading-relaxed text-[color:var(--lkv-text-muted)]">
                {post.snapshot_payload.description}
              </p>
            )}
          </div>
        </Card>
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
            className="relative z-10 aspect-[4/5] select-none overflow-hidden bg-[color:var(--glass-bg-medium)] cursor-zoom-in sm:aspect-[16/10]"
          >
            <SmartImage
              src={displayableImage}
              alt="Photo de l'expédition"
              className="size-full object-cover"
            />

            {/* Fusion givrée : la photo se dissout dans le verre de la card (sans ligne dure) */}
            <div aria-hidden="true" className="lkdv-photo-melt" />

          {/* Voile de lisibilité sous les contrôles (pattern iOS Photos) */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-[color:var(--lkv-forest-950)]/35 via-[color:var(--lkv-forest-950)]/10 to-transparent"
          />

          {/* Date — pill verre en haut à droite de l'image */}
          <div className="absolute right-3 top-3 rounded-full border border-[color:var(--glass-border)] bg-[color:var(--card-tint-strong)] px-3 py-1.5 font-mono text-[length:var(--lkv-text-caption)] tracking-wider text-[color:var(--lkv-text-primary)] backdrop-blur-[var(--blur-md)]">
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
                <svg viewBox="0 0 24 24" fill="currentColor" className="size-20 text-[color:var(--lkv-danger)] drop-shadow-lg">
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
            {actionsNode(true)}
          </div>
          </div>
        </div>
      )}
      </div>
      {/* Fin zone geste */}

      {/* Actions Row — sous le texte uniquement quand il n'y a pas d'image (sinon sur l'image) */}
      {!displayableImage && (
        <div className="flex items-center justify-between border-t border-[color:var(--lkv-border)] pt-[var(--space-2)]">
          {actionsNode(false)}
        </div>
      )}

      {/* Full Feature Threaded Comments Drawer (Pure Liquid Glass) */}
      <AnimatePresence>
        {showComments && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="space-y-[var(--space-3)] overflow-hidden border-t border-[color:var(--lkv-border)] pt-[var(--space-4)]"
          >
            {/* Header of comments drawer */}
            <div className="flex items-center justify-between px-[var(--space-1)] text-[length:var(--lkv-text-caption)] text-[color:var(--lkv-text-muted)]">
              <div className="flex items-center gap-[var(--space-2)]">
                <span className="size-2 animate-pulse rounded-full bg-[color:var(--lkv-secondary)]" />
                <span className="font-bold text-[color:var(--lkv-text-primary)]">Discussions ({comments.length})</span>
              </div>
              <span className="font-mono text-[length:var(--lkv-text-caption-2)] text-[color:var(--lkv-text-muted)]">Fil d&apos;échange en direct</span>
            </div>

            {/* List of comments (Root Comments with Nested Threaded Replies) */}
            <div className="custom-scrollbar max-h-80 space-y-[var(--space-3)] overflow-y-auto pr-[var(--space-1)]">
              {commentsLoading && comments.length === 0 && (
                <p className="px-[var(--space-1)] py-[var(--space-3)] text-[length:var(--lkv-text-caption)] text-[color:var(--lkv-text-muted)]">
                  Chargement des commentaires...
                </p>
              )}
              {!commentsLoading && commentsLoaded && comments.length === 0 && (
                <p className="px-[var(--space-1)] py-[var(--space-3)] text-[length:var(--lkv-text-caption)] text-[color:var(--lkv-text-muted)]">
                  Aucun commentaire pour le moment.
                </p>
              )}
              {comments
                .filter((c) => !c.parentId)
                .map((rootComment) => {
                  const replies = comments.filter((c) => c.parentId === rootComment.id);

                  return (
                    <div key={rootComment.id} className="space-y-[var(--space-2)]">
                      {/* Root Comment Card (Pure Liquid Glass) */}
                      <Card variant="compact" className="group relative space-y-[var(--space-2)]">
                        <div className="flex items-center justify-between text-[length:var(--lkv-text-caption-2)]">
                          <Link
                            href={rootComment.author?.id ? `/profil/${rootComment.author.id}` : '/communaute'}
                            className="group/cauthor flex cursor-pointer items-center gap-[var(--space-2)]"
                          >
                            <div className="flex size-7 items-center justify-center overflow-hidden rounded-full border border-[color:var(--btn-glass-border)] bg-[color:var(--btn-tint)] backdrop-blur-[var(--btn-blur)] saturate-[var(--btn-saturate)] text-[length:var(--lkv-text-caption)] font-bold text-[color:var(--lkv-text-primary)] shadow-elevation-1 transition-transform group-hover/cauthor:scale-105">
                              {rootComment.author?.avatar_url ? (
                                <img
                                  src={rootComment.author.avatar_url}
                                  alt={rootComment.author?.full_name || 'Voyageur'}
                                  className="size-full object-cover"
                                />
                              ) : (
                                (rootComment.author?.full_name?.charAt(0) || 'V').toUpperCase()
                              )}
                            </div>
                            <div>
                              <span className="block text-[length:var(--lkv-text-caption)] font-bold leading-tight text-[color:var(--lkv-text-primary)] group-hover/cauthor:underline">
                                {rootComment.author?.full_name || 'Voyageur'}
                              </span>
                              <span className="font-mono text-[length:var(--lkv-text-caption-2)] text-[color:var(--lkv-text-muted)]">
                                {timeAgo(rootComment.created_at || new Date().toISOString())}
                                {rootComment.edited && ' · modifié'}
                              </span>
                            </div>
                          </Link>

                          {/* Comment Options Buttons (Image 3 style) */}
                          <div className="flex items-center gap-[var(--space-1)] opacity-70 transition-opacity group-hover:opacity-100">
                            {rootComment.isOwner ? (
                              <>
                                <IconButton
                                  size="sm"
                                  title="Modifier"
                                  onClick={() => handleStartEditComment(rootComment)}
                                  aria-label="Modifier"
                                >
                                  <Icon name="pencil" size={11} aria-hidden="true" />
                                </IconButton>
                                <IconButton
                                  size="sm"
                                  title="Supprimer"
                                  onClick={() => handleDeleteComment(rootComment.id)}
                                  aria-label="Supprimer"
                                >
                                  <Icon name="trash2" size={11} className="text-[color:var(--lkv-danger)]" aria-hidden="true" />
                                </IconButton>
                              </>
                            ) : (
                              <IconButton
                                size="sm"
                                title="Signaler"
                                onClick={() => handleReportComment(rootComment.id)}
                                aria-label="Signaler"
                              >
                                <Icon name="flag" size={11} aria-hidden="true" />
                              </IconButton>
                            )}
                          </div>
                        </div>

                        {/* Comment Content or Edit Form */}
                        {editingCommentId === rootComment.id ? (
                          <div className="space-y-[var(--space-2)] pl-9 pt-[var(--space-1)]">
                            <textarea
                              rows={2}
                              value={editingText}
                              onChange={(e) => setEditingText(e.target.value)}
                              className="w-full rounded-[var(--lkv-radius-sm)] border border-[color:var(--lkv-border)] bg-[color:var(--lkv-field-bg)] p-[var(--space-2)] text-[length:var(--lkv-text-caption)] text-[color:var(--lkv-text-primary)] focus:outline-none focus:ring-2 focus:ring-[color:var(--lkv-focus-ring)]"
                            />
                            <div className="flex items-center justify-end gap-[var(--space-2)]">
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => setEditingCommentId(null)}
                              >
                                Annuler
                              </Button>
                              <Button
                                type="button"
                                variant="primary"
                                size="sm"
                                onClick={() => handleSaveEditComment(rootComment.id)}
                              >
                                Enregistrer
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <>
                            <p className="pl-9 text-[length:var(--lkv-text-caption)] leading-relaxed text-[color:var(--lkv-text-primary)]">
                              {rootComment.content}
                            </p>

                            {/* Image Attachment */}
                            {rootComment.attachment && (
                              <div className="pl-9 pt-[var(--space-1)]">
                                <img
                                  src={rootComment.attachment}
                                  alt="Pièce jointe"
                                  className="h-28 w-40 rounded-[var(--lkv-radius-sm)] border border-[color:var(--lkv-border)] object-cover shadow-elevation-1"
                                />
                              </div>
                            )}
                          </>
                        )}

                        {/* Footer Reply & Like Buttons */}
                        <div className="flex items-center justify-between pl-9 pt-[var(--space-1)] text-[length:var(--lkv-text-caption)]">
                          <IconButton
                            size="sm"
                            title={`Répondre à ${rootComment.author?.full_name || 'ce message'}`}
                            onClick={() => handleReplyTo(rootComment.author?.full_name || 'Voyageur', rootComment.id)}
                            aria-label={`Répondre à ${rootComment.author?.full_name || 'ce message'}`}
                          >
                            <Icon name="reply" size={12} aria-hidden="true" />
                          </IconButton>

                          <IconButton
                            size="sm"
                            onClick={() => handleLikeComment(rootComment.id)}
                            title="Aimer ce commentaire"
                            aria-label="Aimer ce commentaire"
                            variant={rootComment.userLiked ? 'solid' : 'glass'}
                            aria-pressed={rootComment.userLiked || undefined}
                            className="w-auto px-2.5"
                          >
                            <span className="inline-flex items-center gap-1.5"><HeartSvg filled={rootComment.userLiked} className="size-3" /><span className="tabular-nums">{rootComment.likes || 0}</span></span>
                          </IconButton>
                        </div>
                      </Card>

                      {/* Threaded Child Replies (Offset with Connecting Guide Line) */}
                      {replies.length > 0 && (
                        <div className="relative ml-5 space-y-[var(--space-2)] border-l-2 border-[color:var(--lkv-border)] pl-4 pt-[var(--space-1)] sm:ml-7 sm:pl-5">
                          {replies.map((reply) => (
                            <div key={reply.id} className="relative">
                              <Card variant="compact" className="group space-y-[var(--space-1)]">
                                <div className="flex items-center justify-between text-[length:var(--lkv-text-caption-2)]">
                                  <div className="flex items-center gap-[var(--space-2)]">
                                    <div className="flex size-5 items-center justify-center overflow-hidden rounded-full border border-[color:var(--btn-glass-border)] bg-[color:var(--btn-tint)] backdrop-blur-[var(--btn-blur)] saturate-[var(--btn-saturate)] lkv-rim-btn text-[length:var(--lkv-text-caption-2)] font-bold text-[color:var(--lkv-text-primary)]">
                                      {reply.author?.avatar_url ? (
                                        <img
                                          src={reply.author.avatar_url}
                                          alt={reply.author?.full_name || 'Voyageur'}
                                          className="size-full object-cover"
                                        />
                                      ) : (
                                        (reply.author?.full_name?.charAt(0) || 'V').toUpperCase()
                                      )}
                                    </div>
                                    <span className="text-[length:var(--lkv-text-caption)] font-bold text-[color:var(--lkv-text-primary)]">
                                      {reply.author?.full_name || 'Voyageur'}
                                    </span>
                                    <span className="font-mono text-[length:var(--lkv-text-caption-2)] text-[color:var(--lkv-text-muted)]">
                                      {timeAgo(reply.created_at || new Date().toISOString())}
                                    </span>
                                  </div>

                                  <div className="flex items-center gap-[var(--space-1)] opacity-70 transition-opacity group-hover:opacity-100">
                                    {reply.isOwner ? (
                                      <IconButton
                                        size="sm"
                                        title="Supprimer"
                                        onClick={() => handleDeleteComment(reply.id)}
                                        aria-label="Supprimer"
                                      >
                                        <Icon name="trash2" size={11} className="text-[color:var(--lkv-danger)]" aria-hidden="true" />
                                      </IconButton>
                                    ) : (
                                      <IconButton
                                        size="sm"
                                        title="Signaler"
                                        onClick={() => handleReportComment(reply.id)}
                                        aria-label="Signaler"
                                      >
                                        <Icon name="flag" size={11} aria-hidden="true" />
                                      </IconButton>
                                    )}
                                  </div>
                                </div>

                                <p className="pl-7 text-[length:var(--lkv-text-caption)] leading-relaxed text-[color:var(--lkv-text-primary)]">
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
                                    className="w-auto px-2.5"
                                  >
                                    <span className="inline-flex items-center gap-1.5"><HeartSvg filled={reply.userLiked} className="size-2.5" /><span className="tabular-nums">{reply.likes || 0}</span></span>
                                  </IconButton>
                                </div>
                              </Card>
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
            <div className="space-y-[var(--space-1)] pt-[var(--space-1)]">
              {replyingTo && (
                <Card variant="compact" tone="info" className="flex items-center justify-between text-[length:var(--lkv-text-caption)]">
                  <span>En réponse à <strong>@{replyingTo}</strong></span>
                  <IconButton
                    type="button"
                    size="sm"
                    onClick={() => { setReplyingTo(null); setParentCommentId(null); setCommentText(''); }}
                    aria-label="Annuler la réponse"
                  >
                    ✕
                  </IconButton>
                </Card>
              )}

              {/* Liquid Glass Input Capsule with Image 3 Glass Buttons */}
              <Card variant="compact" className="flex items-center gap-[var(--space-1)] rounded-full pl-[var(--space-3)]">
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
                  className="min-w-0 flex-1 border-none bg-transparent text-[length:var(--lkv-text-caption)] text-[color:var(--lkv-text-primary)] placeholder:text-[color:var(--lkv-text-muted)] focus:outline-none"
                />

                {/* Attachment & Action Buttons (Image 3 Style) */}
                <IconButton
                  size="sm"
                  title="Joindre une photo"
                  onClick={() => fileInputRef.current?.click()}
                  aria-label="Joindre une photo"
                >
                  <Icon name="image-plus" size={13} aria-hidden="true" />
                </IconButton>
                <IconButton
                  size="sm"
                  title="Partager un GPX"
                  onClick={() => gpxInputRef.current?.click()}
                  aria-label="Partager un GPX"
                >
                  <span className="text-[length:var(--lkv-text-caption)] leading-none">🗺️</span>
                </IconButton>
                <IconButton
                  size="sm"
                  title="Partager ma position"
                  onClick={handleShareLocation}
                  aria-label="Partager ma position"
                >
                  <Icon name="map-pin" size={13} aria-hidden="true" />
                </IconButton>

                <IconButton
                  size="md"
                  title="Publier le commentaire"
                  onClick={() => handleSendComment()}
                  aria-label="Publier le commentaire"
                  variant="solid"
                >
                  <Icon name="send" size={13} aria-hidden="true" />
                </IconButton>
              </Card>
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
    </Card>
  );
}
