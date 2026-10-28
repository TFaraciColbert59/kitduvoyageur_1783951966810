'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { motion, AnimatePresence } from 'framer-motion';
import { Badge, Button, Card, Divider, IconButton } from '@/components/ui';
import SmartImage from '@/components/ui/SmartImage';
import CommunityVideo from './CommunityVideo';
import { canShowCommunityReproduction, isCommunityVideoUrl, usableCommunityMedia } from '@/lib/community/media';
import ReportSheet from '@/components/social/ReportSheet';
import { createClient } from '@/lib/supabase/client';
import { reportPost } from '@/features/community/posts/mutations';
import { fetchPublicProfilesWith } from '@/lib/queries/publicProfilesCore';
import { useHapticFeedback } from '@/hooks/useHapticFeedback';
import { useDoubleTap, useLongPress } from '@/hooks/gestures';
import { presentNativeActions, shareNativeURL } from '@/lib/native/ui';
import { LKDVIcon } from '@/components/ui/LKDVIcon';

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
  media_urls?: string[] | null;
  linked_kit_id?: string | null;
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
      <LKDVIcon name="favoris" size={14} className={`size-3.5 scale-125 transition-transform duration-200 ${className}`} />
    );
  }
  return (
    <LKDVIcon name="favoris" size={14} className={`size-3.5 opacity-60 transition-opacity hover:opacity-100 ${className}`} />
  );
}

export default function CommunityPostCard({
  post,
  user,
  highlight = false,
  focusCommentId,
}: {
  post: CommunityPostItem;
  user?: any;
  highlight?: boolean;
  focusCommentId?: string | null;
}) {
  const [avatarError, setAvatarError] = useState(false);
  const [isLiked, setIsLiked] = useState(Boolean(post.user_liked));
  const [likesCount, setLikesCount] = useState<number>(post.likes_count ?? 0);
  const [commentsCount, setCommentsCount] = useState<number>(post.comments_count ?? 0);
  const [showComments, setShowComments] = useState(false);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [commentsLoaded, setCommentsLoaded] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [isSaved, setIsSaved] = useState(Boolean(post.user_saved));
  const [isHidden, setIsHidden] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    try {
      const list = JSON.parse(window.localStorage.getItem('lkdv:hidden_posts') || '[]') as string[];
      return list.includes(post.id);
    } catch {
      return false;
    }
  });
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
  const [activeMediaIndex, setActiveMediaIndex] = useState(0);
  const [verifiedKitId, setVerifiedKitId] = useState<string | null>(null);
  const [reproduceOpen, setReproduceOpen] = useState(false);
  const [reproduceBusy, setReproduceBusy] = useState(false);
  const [reproduceDone, setReproduceDone] = useState(false);

  useEffect(() => {
    let alive = true;
    const id = post.linked_kit_id;
    setVerifiedKitId(null);
    setReproduceOpen(false);
    if (!canShowCommunityReproduction(id)) return () => { alive = false; };
    void createClient().from('materiel_kits').select('id')
      .eq('id', id!).eq('is_public', true).limit(1).maybeSingle()
      .then(({ data, error }) => { if (alive && !error && data?.id === id) setVerifiedKitId(id!); });
    return () => { alive = false; };
  }, [post.linked_kit_id]);

  const forkVisibleKit = async () => {
    if (!verifiedKitId || reproduceBusy) return;
    if (!user?.id) { showToast('Connectez-vous pour importer un kit.'); return; }
    setReproduceBusy(true);
    try {
      const response = await fetch('/api/materiel/fork', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kit_id: verifiedKitId }),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(typeof body?.error === 'string' ? body.error : 'Import impossible');
      }
      setReproduceDone(true);
      setReproduceOpen(false);
      showToast('Kit importé dans votre matériel.');
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Import impossible');
    } finally {
      setReproduceBusy(false);
    }
  };

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
  // A-044 : pagination des commentaires (racines par page, réponses incluses).
  const [commentsLimit, setCommentsLimit] = useState(30);
  const [hasMoreComments, setHasMoreComments] = useState(false);

  const loadComments = useCallback(async () => {
    setCommentsLoading(true);
    try {
      const supabase = createClient();
      const { data: rootRows, error } = await supabase
        .from('post_comments')
        .select('id, post_id, author_id, content, parent_id, created_at')
        .eq('post_id', post.id)
        .is('parent_id', null)
        .order('created_at', { ascending: true })
        .limit(commentsLimit);
      if (error) throw error;

      type CommentRow = {
        id: string;
        author_id: string | null;
        content: string;
        parent_id: string | null;
        created_at: string;
      };
      const roots = (rootRows ?? []) as CommentRow[];
      const rootIds = roots.map((row) => row.id);

      let replyRows: CommentRow[] = [];
      if (rootIds.length > 0) {
        const { data: repliesData } = await supabase
          .from('post_comments')
          .select('id, post_id, author_id, content, parent_id, created_at')
          .in('parent_id', rootIds)
          .order('created_at', { ascending: true });
        replyRows = (repliesData ?? []) as CommentRow[];
      }

      setHasMoreComments(roots.length >= commentsLimit);

      const rows = [...roots, ...replyRows];
      const profiles = await fetchPublicProfilesWith(
        supabase,
        rows.map((row) => row.author_id).filter(Boolean) as string[]
      );

      // F-012 : likes de commentaires — compteurs + état personnel réels.
      let likeRows: Array<{ comment_id: string; user_id: string }> = [];
      if (rows.length > 0) {
        const { data: likesData } = await supabase
          .from('post_comment_likes')
          .select('comment_id, user_id')
          .in('comment_id', rows.map((row) => row.id));
        likeRows = (likesData ?? []) as Array<{ comment_id: string; user_id: string }>;
      }
      const likesByComment = new Map<string, { count: number; userLiked: boolean }>();
      for (const like of likeRows) {
        const entry = likesByComment.get(like.comment_id) ?? { count: 0, userLiked: false };
        entry.count += 1;
        if (user?.id && like.user_id === user.id) entry.userLiked = true;
        likesByComment.set(like.comment_id, entry);
      }

      setComments(
        rows.map((row) => {
          const profile = row.author_id ? profiles[row.author_id] : undefined;
          const likeState = likesByComment.get(row.id);
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
            likes: likeState?.count ?? 0,
            userLiked: likeState?.userLiked ?? false,
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
  }, [post.id, user?.id, commentsLimit]);

  useEffect(() => {
    if (showComments && !commentsLoading) {
      loadComments();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- rechargement voulu à l'ouverture et au changement de page de commentaires
  }, [showComments, commentsLimit]);

  // A-048 : permalien `?comment=<id>` — ouvre la discussion et met le
  // commentaire visé en évidence dès qu'il est chargé.
  useEffect(() => {
    if (focusCommentId) setShowComments(true);
  }, [focusCommentId]);

  useEffect(() => {
    if (!focusCommentId || !commentsLoaded) return;
    const timer = window.setTimeout(() => {
      const el = document.getElementById(`comment-${focusCommentId}`);
      if (!el) return;
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el.classList.add('ring-2', 'ring-[color:var(--lkv-secondary)]', 'ring-offset-2', 'rounded-[var(--lkv-radius-md)]');
      window.setTimeout(() => {
        el.classList.remove('ring-2', 'ring-[color:var(--lkv-secondary)]', 'ring-offset-2', 'rounded-[var(--lkv-radius-md)]');
      }, 1800);
    }, 250);
    return () => window.clearTimeout(timer);
  }, [focusCommentId, commentsLoaded, comments]);

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
    if (!user) {
      showToast('Connectez-vous pour aimer une publication.');
      return;
    }
    const previousLiked = isLiked;
    const previousCount = likesCount;
    const newLiked = !previousLiked;
    setIsLiked(newLiked);
    setLikesCount(newLiked ? previousCount + 1 : Math.max(0, previousCount - 1));

    // F-024 : le résultat de la RPC fait autorité — rollback si refus.
    const supabase = createClient();
    const { error } = await supabase.rpc('toggle_community_post_like', { p_post_id: post.id });
    if (error) {
      console.error('toggle_community_post_like refusé:', error.message);
      setIsLiked(previousLiked);
      setLikesCount(previousCount);
      showToast('Like non enregistré. Réessayez.');
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
      if (displayableImage && !isVideo) setViewerOpen(true);
    },
  });

  // URLs http(s) persistables ou chemins locaux (/assets/...) : jamais blob:/data:.
  const mediaItems = usableCommunityMedia(post.media_urls, post.image_url);
  const displayableImage = mediaItems[activeMediaIndex] ?? mediaItems[0] ?? null;
  const isVideo = isCommunityVideoUrl(displayableImage);

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
    void openPostActions(true);
  });

  const handleToggleComments = () => {
    setShowComments(!showComments);
    if (!showComments) {
      setTimeout(() => commentInputRef.current?.focus(), 150);
    }
  };

  const handleLikeComment = async (commentId: string) => {
    if (!user) {
      showToast('Connectez-vous pour aimer un commentaire.');
      return;
    }
    const target = comments.find((c) => c.id === commentId);
    const nextLiked = !(target?.userLiked ?? false);

    // Optimiste immédiat, puis mutation durable (F-012).
    setComments(prev =>
      prev.map(c => {
        if (c.id !== commentId) return c;
        return {
          ...c,
          userLiked: nextLiked,
          likes: nextLiked ? (c.likes || 0) + 1 : Math.max(0, (c.likes || 0) - 1),
        };
      })
    );

    const supabase = createClient();
    const { error } = nextLiked
      ? await supabase
          .from('post_comment_likes')
          .upsert(
            { user_id: user.id, comment_id: commentId },
            { onConflict: 'user_id,comment_id', ignoreDuplicates: true }
          )
      : await supabase
          .from('post_comment_likes')
          .delete()
          .eq('comment_id', commentId)
          .eq('user_id', user.id);

    if (error) {
      setComments(prev =>
        prev.map(c => {
          if (c.id !== commentId) return c;
          return {
            ...c,
            userLiked: !nextLiked,
            likes: Math.max(0, (c.likes || 0) + (nextLiked ? -1 : 1)),
          };
        })
      );
      showToast('Like non enregistré. Réessayez.');
    }
  };

  const handleStartEditComment = (comment: PostCommentItem) => {
    setEditingCommentId(comment.id);
    setEditingText(comment.content);
  };

  const handleSaveEditComment = async (commentId: string) => {
    if (!editingText.trim() || !user) return;
    const previousContent = comments.find((c) => c.id === commentId)?.content;
    const nextContent = editingText.trim();

    setComments(prev =>
      prev.map(c => (c.id === commentId ? { ...c, content: nextContent, edited: true } : c))
    );
    setEditingCommentId(null);
    setEditingText('');

    // F-010 : la modification doit survivre au rechargement.
    const supabase = createClient();
    const { error } = await supabase
      .from('post_comments')
      .update({ content: nextContent })
      .eq('id', commentId)
      .eq('author_id', user.id);

    if (error) {
      setComments(prev =>
        prev.map(c => (c.id === commentId ? { ...c, content: previousContent ?? c.content } : c))
      );
      showToast('Modification non enregistrée. Réessayez.');
    } else {
      showToast('Commentaire mis à jour !');
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    if (!user) return;
    const snapshot = comments;
    const removed = snapshot.filter(c => c.id === commentId || c.parentId === commentId);

    setComments(prev => prev.filter(c => c.id !== commentId && c.parentId !== commentId));
    setCommentsCount((prev: number) => Math.max(0, prev - removed.length));

    // F-011 : suppression durable (les réponses suivent la cascade serveur).
    const supabase = createClient();
    const { error } = await supabase
      .from('post_comments')
      .delete()
      .eq('id', commentId)
      .eq('author_id', user.id);

    if (error) {
      setComments(snapshot);
      setCommentsCount((prev: number) => prev + removed.length);
      showToast('Suppression non enregistrée. Réessayez.');
    } else {
      showToast('Commentaire supprimé');
    }
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

  const handleShare = async () => {
    // F-025 : permalien réel de la publication (pas l'URL du hub).
    const permalink =
      typeof window !== 'undefined'
        ? `${window.location.origin}/communaute/post/${post.id}`
        : `/communaute/post/${post.id}`;
    if (await shareNativeURL(permalink)) return;
    try {
      if (!navigator.clipboard?.writeText) throw new Error('presse-papier indisponible');
      await navigator.clipboard.writeText(permalink);
      showToast('Lien copié dans le presse-papier !');
    } catch {
      showToast(`Lien : ${permalink}`);
    }
  };

  const handleToggleSave = async () => {
    setShowMoreMenu(false);
    if (!user) {
      showToast('Connectez-vous pour enregistrer une publication.');
      return;
    }
    const nextSaved = !isSaved;
    setIsSaved(nextSaved);

    // F-012 : favori durable (privé), rollback si le serveur refuse.
    const supabase = createClient();
    const { error } = nextSaved
      ? await supabase
          .from('post_saves')
          .upsert(
            { user_id: user.id, post_id: post.id },
            { onConflict: 'user_id,post_id', ignoreDuplicates: true }
          )
      : await supabase.from('post_saves').delete().eq('user_id', user.id).eq('post_id', post.id);

    if (error) {
      setIsSaved(!nextSaved);
      showToast('Favori non enregistré. Réessayez.');
    } else {
      showToast(nextSaved ? 'Enregistré dans vos favoris ' : 'Retiré de vos favoris');
    }
  };

  const handleHidePost = () => {
    setIsHidden(true);
    setShowMoreMenu(false);
    // Préférence d'appareil : survit au rechargement (le fil reste inchangé
    // côté serveur — pas de règle de filtrage serveur dédiée à ce stade).
    try {
      const key = 'lkdv:hidden_posts';
      const list = JSON.parse(window.localStorage.getItem(key) || '[]') as string[];
      if (!list.includes(post.id)) list.push(post.id);
      window.localStorage.setItem(key, JSON.stringify(list.slice(-200)));
    } catch {
      // préférence locale : une erreur de stockage ne bloque pas le masquage
    }
    showToast('Publication masquée de votre fil (sur cet appareil).');
  };

  const handleReport = () => {
    setShowMoreMenu(false);
    setReportOpen(true);
  };

  // SwiftUI owns the iOS sheet; the HTML menu remains the only fallback on
  // browsers/Android/older iOS builds. Actions still execute existing RLS paths.
  const openPostActions = async (fromLongPress = false) => {
    const choice = await presentNativeActions({
      title: 'Publication',
      actions: [
        { id: 'save', title: isSaved ? 'Retirer des favoris' : 'Enregistrer' },
        { id: 'share', title: 'Partager' },
        { id: 'hide', title: 'Masquer cette publication' },
        { id: 'report', title: 'Signaler cette publication', destructive: true },
      ],
    });
    if (choice === undefined) {
      if (fromLongPress) setShowQuickMenu(true);
      else setShowMoreMenu((prev) => !prev);
      return;
    }
    if (choice === 'save') void handleToggleSave();
    if (choice === 'share') void handleShare();
    if (choice === 'hide') handleHidePost();
    if (choice === 'report') handleReport();
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
    // F-013 : réconcilier l'ID temporaire avec l'ID réel de la base.
    const { data: inserted, error } = await supabase
      .from('post_comments')
      .insert({
        post_id: post.id,
        author_id: user?.id,
        content: newComment.content,
        parent_id: newComment.parentId,
      })
      .select('id')
      .single();

    if (error || !inserted) {
      setComments(prev => prev.filter(c => c.id !== newComment.id));
      setCommentsCount((prev: number) => Math.max(0, prev - 1));
      showToast('Commentaire non enregistré. Réessayez.');
    } else if (inserted.id !== newComment.id) {
      // Répondre ou signaler ce commentaire doit viser un parent réel.
      setComments(prev =>
        prev.map(c => (c.id === newComment.id ? { ...c, id: inserted.id } : c))
      );
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    // Le schéma `post_comments` ne stocke pas de média : on ne promet pas une
    // photo qui ne survivrait pas au rechargement — seule la mention reste.
    handleSendComment(commentText ? `${commentText} (📎 ${file.name})` : `📎 Pièce partagée : ${file.name}`);
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
              icon={<LKDVIcon name="signet" size={14} className={isSaved ? 'text-[color:var(--lkv-warning)]' : 'text-[color:var(--lkv-text-secondary)]'} aria-hidden="true" />}
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
              icon={<LKDVIcon name="lien" size={14} className="text-[color:var(--lkv-text-secondary)]" aria-hidden="true" />}
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
              icon={<LKDVIcon name="vue" size={14} className="text-[color:var(--lkv-text-secondary)]" aria-hidden="true" />}
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
              icon={<LKDVIcon name="signalement" size={14} aria-hidden="true" />}
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
          <LKDVIcon
            name="messages"
            size={15}
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
          <LKDVIcon
            name="partager"
            size={15}
            aria-hidden="true"
          />
        </IconButton>

        <div className="relative" ref={menuRef}>
          <IconButton
            type="button"
            variant="glass"
            onClick={() => { void openPostActions(); }}
            aria-label="Options de la publication"
            className={onImage ? 'border-[color:var(--glass-border)] bg-[color:var(--card-tint-strong)] backdrop-blur-[var(--blur-md)]' : ''}
          >
            <LKDVIcon
              name="plus_options"
              size={16}
              aria-hidden="true"
            />
          </IconButton>
          {moreMenuNode}
        </div>
      </div>
    </>
  );

  return (
    <Card
      id={`post-${post.id}`}
      className={`community-post lkdv-social-post relative space-y-0 overflow-hidden p-0 ${
        highlight ? 'ring-2 ring-[color:var(--lkv-primary)] ring-offset-2 ring-offset-[color:var(--glass-bg-base)]' : ''
      }`}
    >
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
              <LKDVIcon name="favoris" size="1em" className="lkdv-icon-inline" />
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
              {isSaved ? <><LKDVIcon name="points" size="1em" className="lkdv-icon-inline" /></> : <><LKDVIcon name="signet" size="1em" className="lkdv-icon-inline" /></>}
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
              <LKDVIcon name="vue" size="1em" className="lkdv-icon-inline" />
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
              <LKDVIcon name="signalement" size="1em" className="lkdv-icon-inline" />
            </IconButton>
          </Card>
        </div>
      )}

      {/* Zone geste : header + contenu + média (long-press menu rapide) */}
      <div {...longPress}>
      {/* Header author & Badge */}
      <div className="lkdv-social-post-author flex items-center justify-between">
        <Link
          href={post.author?.id ? `/profil/${post.author.id}` : post.user_id ? `/profil/${post.user_id}` : '/communaute'}
          className="group/author flex cursor-pointer items-center gap-[var(--space-3)]"
        >
          {post.author?.avatar_url && !avatarError ? (
            <img
              src={post.author.avatar_url}
              alt={post.author?.full_name || 'Auteur'}
              onError={() => setAvatarError(true)}
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
                <Badge tone="sage" className="lkdv-post-role font-mono uppercase">
                  {post.author.loyalty_level}
                </Badge>
              )}
            </div>
            <span className="mt-0.5 block font-mono text-[length:var(--lkv-text-caption)] text-[color:var(--lkv-text-muted)]">
              {timeAgo(post.created_at || new Date().toISOString())}
            </span>
          </div>
        </Link>

        <span className="lkdv-social-post-type" aria-label="Publication du fil">Publication</span>
      </div>

      {/* Attached Media — plein-bord, haute (jusque sous le texte), collée au bas de la card */}
      {displayableImage && (
        <div className="lkdv-social-post-media relative">
          <div
            {...doubleTap}
            className="relative z-10 aspect-[4/5] select-none overflow-hidden bg-[color:var(--glass-bg-medium)] cursor-zoom-in"
          >
            {isVideo ? (
              <CommunityVideo key={displayableImage} src={displayableImage} />
            ) : (
              <SmartImage src={displayableImage} alt="Photo de l'expédition" className="size-full object-cover" />
            )}
            {mediaItems.length > 1 && (
              <>
                <span className="lkdv-social-media-index" aria-label={'Média ' + (activeMediaIndex + 1) + ' sur ' + mediaItems.length}>
                  {activeMediaIndex + 1}/{mediaItems.length}
                </span>
                {activeMediaIndex > 0 && (
                  <button type="button" className="lkdv-social-media-arrow left-3" aria-label="Média précédent"
                    onClick={(event) => { event.stopPropagation(); setActiveMediaIndex((i) => Math.max(0, i - 1)); }}><LKDVIcon name="retour" size="1em" className="lkdv-icon-inline" /></button>
                )}
                {activeMediaIndex < mediaItems.length - 1 && (
                  <button type="button" className="lkdv-social-media-arrow right-3" aria-label="Média suivant"
                    onClick={(event) => { event.stopPropagation(); setActiveMediaIndex((i) => Math.min(mediaItems.length - 1, i + 1)); }}><LKDVIcon name="suivant" size="1em" className="lkdv-icon-inline" /></button>
                )}
              </>
            )}
            {verifiedKitId && (
              <div className="lkdv-social-reproduce absolute bottom-3 left-3 z-20">
                <button type="button" className="lkdv-social-reproduce-trigger"
                  aria-label="Reproduire le kit de cette publication" aria-expanded={reproduceOpen}
                  onClick={(event) => { event.stopPropagation(); setReproduceOpen((v) => !v); }}>
                  <LKDVIcon name="dupliquer" size={18} aria-hidden="true" />
                </button>
                {reproduceOpen && (
                  <div className="lkdv-social-reproduce-menu">
                    <p>Kit public partagé</p>
                    <button type="button" disabled={reproduceBusy || reproduceDone}
                      onClick={(event) => { event.stopPropagation(); void forkVisibleKit(); }}>
                      {reproduceDone ? 'Déjà importé' : reproduceBusy ? 'Import en cours…' : 'Importer dans mon matériel'}
                    </button>
                  </div>
                )}
              </div>
            )}

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
                <LKDVIcon name="favoris" size={80} className="size-20 drop-shadow-lg" />
              </motion.div>
            )}
          </AnimatePresence>

          </div>
        </div>
      )}
      </div>
      {/* Fin zone geste */}

      {/* Instagram-like action placement; LKDV interactions are unchanged. */}
      <div className="lkdv-social-post-actions flex items-center justify-between">
        {actionsNode(false)}
        <IconButton
          type="button"
          variant="ghost"
          onClick={handleToggleSave}
          aria-label={isSaved ? 'Retirer des favoris' : 'Enregistrer la publication'}
          aria-pressed={isSaved}
        >
          <LKDVIcon name="signet" size={23} aria-hidden="true" />
        </IconButton>
      </div>

      <div className="lkdv-social-post-caption">
      {/* Content — 200 caractères max, expansion façon Twitter ; respiration haut/bas */}
      <p className="whitespace-pre-line py-[var(--space-2)] text-[length:var(--lkv-text-subheadline)] leading-[1.7] text-[color:var(--lkv-text-primary)]">
        {displayContent}
        {contentTruncated && !isContentExpanded && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="ml-[var(--space-1)] text-[length:var(--lkv-text-subheadline)] font-semibold text-[color:var(--lkv-text-primary)]"
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
            className="ml-[var(--space-1)] text-[length:var(--lkv-text-subheadline)] font-semibold text-[color:var(--lkv-text-primary)]"
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
                <LKDVIcon name="point_interet" size="1em" className="lkdv-icon-inline" /> {post.snapshot_payload.destination}
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

      </div>

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
                    <div key={rootComment.id} id={`comment-${rootComment.id}`} className="space-y-[var(--space-2)] scroll-mt-24">
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
                                  <LKDVIcon name="modifier" size={11} aria-hidden="true" />
                                </IconButton>
                                <IconButton
                                  size="sm"
                                  title="Supprimer"
                                  onClick={() => handleDeleteComment(rootComment.id)}
                                  aria-label="Supprimer"
                                >
                                  <LKDVIcon name="supprimer" size={11} className="text-[color:var(--lkv-danger)]" aria-hidden="true" />
                                </IconButton>
                              </>
                            ) : (
                              <IconButton
                                size="sm"
                                title="Signaler"
                                onClick={() => handleReportComment(rootComment.id)}
                                aria-label="Signaler"
                              >
                                <LKDVIcon name="signalement" size={11} aria-hidden="true" />
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
                            <LKDVIcon name="retour" size={12} aria-hidden="true" />
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
                            <div key={reply.id} id={`comment-${reply.id}`} className="relative scroll-mt-24">
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
                                        <LKDVIcon name="supprimer" size={11} className="text-[color:var(--lkv-danger)]" aria-hidden="true" />
                                      </IconButton>
                                    ) : (
                                      <IconButton
                                        size="sm"
                                        title="Signaler"
                                        onClick={() => handleReportComment(reply.id)}
                                        aria-label="Signaler"
                                      >
                                        <LKDVIcon name="signalement" size={11} aria-hidden="true" />
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
              {hasMoreComments && (
                <div className="flex justify-center pt-[var(--space-1)]">
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() => setCommentsLimit((limit) => limit + 30)}
                    disabled={commentsLoading}
                  >
                    {commentsLoading ? 'Chargement…' : 'Charger plus de commentaires'}
                  </Button>
                </div>
              )}
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
                    <LKDVIcon name="fermer" size="1em" className="lkdv-icon-inline" /></IconButton>
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
                  <LKDVIcon name="photo" size={13} aria-hidden="true" />
                </IconButton>
                <IconButton
                  size="sm"
                  title="Partager un GPX"
                  onClick={() => gpxInputRef.current?.click()}
                  aria-label="Partager un GPX"
                >
                  <span className="text-[length:var(--lkv-text-caption)] leading-none"><LKDVIcon name="carte" size="1em" className="lkdv-icon-inline" /></span>
                </IconButton>
                <IconButton
                  size="sm"
                  title="Partager ma position"
                  onClick={handleShareLocation}
                  aria-label="Partager ma position"
                >
                  <LKDVIcon name="point_interet" size={13} aria-hidden="true" />
                </IconButton>

                <IconButton
                  size="md"
                  title="Publier le commentaire"
                  onClick={() => handleSendComment()}
                  aria-label="Publier le commentaire"
                  variant="solid"
                >
                  <LKDVIcon name="partager" size={13} aria-hidden="true" />
                </IconButton>
              </Card>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Visionneuse plein écran (mission gestes, Phase 6) — pinch, double-tap-zoom,
          swipe-down close, swipe horizontal. Dynamic import (First Load JS). */}
      {viewerOpen && displayableImage && !isVideo && (
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
          await reportPost(post.id, reason, details);
        }}
      />
    </Card>
  );
}
