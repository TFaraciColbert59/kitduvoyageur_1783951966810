'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import {
  Send,
  Plus,
  Image as ImageIcon,
  Heart,
  CornerDownRight,
  X,
  Route,
  Footprints,
} from 'lucide-react';
import { useHapticFeedback } from '@/hooks/useHapticFeedback';
import { useDragDismiss } from '@/hooks/gestures';
import { FreedomComposerMenuSheet } from './FreedomComposerMenuSheet';
import { fetchReelComments, postReelComment, setPostCommentLike } from './freedomReelsService';
import {
  getPreloadedReelComments,
  hasPreloadedReelComments,
  setPreloadedReelComments,
  preloadPublicProfile,
} from './reelsPreloadService';
import type { FreedomComment, FreedomCommentAttachment } from './freedom-types';
import './freedom.css';

export interface FreedomCommentsDrawerProps {
  isOpen: boolean;
  reelId: string;
  currentUser?: any;
  onClose: () => void;
  onCommentsCountChange?: (count: number) => void;
  onOpenKit?: (kitId: string, kitName?: string) => void;
  onNavigateToProfile?: (author: FreedomComment['author']) => void;
  /**
   * `drawer` : feuille plein écran de Freedom. `panel` : même liste, mêmes
   * fonctions et même composer, posés dans le panneau d'un post (fil,
   * Compte, Messages) sans feuille ni voile.
   */
  variant?: 'drawer' | 'panel';
  /** Visiteur sans compte : envoi refusé, on l'invite à se connecter. */
  onRequireAuth?: () => void;
  /** Commentaire à amener à l'écran à l'ouverture (lien profond). */
  focusCommentId?: string | null;
}

interface CommentThread {
  comment: FreedomComment;
  replies: FreedomComment[];
}

interface ReplyingTarget {
  id: string;
  authorName: string;
  parentId: string;
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'à l’instant';
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} h`;
  return `${Math.floor(hours / 24)} j`;
}

export const FreedomCommentsDrawer: React.FC<FreedomCommentsDrawerProps> = ({
  isOpen,
  reelId,
  currentUser,
  onClose,
  onCommentsCountChange,
  onOpenKit,
  onNavigateToProfile,
  variant = 'drawer',
  onRequireAuth,
  focusCommentId = null,
}) => {
  const router = useRouter();
  const { haptic } = useHapticFeedback();
  const [comments, setComments] = useState<FreedomComment[]>(
    () => getPreloadedReelComments(reelId) ?? [],
  );
  const [loading, setLoading] = useState<boolean>(() => !hasPreloadedReelComments(reelId));
  const [inputText, setInputText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [pendingAttachment, setPendingAttachment] = useState<FreedomCommentAttachment | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [replyingTo, setReplyingTo] = useState<ReplyingTarget | null>(null);

  const listRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  // Le champ ne prend le focus qu'à un vrai appui, jamais à l'ouverture
  // (clic fantôme iOS sur le bouton qui a ouvert les commentaires).
  const [inputArmed, setInputArmed] = useState(false);
  useEffect(() => {
    if (!isOpen) return;
    setInputArmed(false);
    const timer = window.setTimeout(() => setInputArmed(true), 650);
    return () => window.clearTimeout(timer);
  }, [isOpen]);
  // Dans un post, le tiroir des pièces jointes (kit, GPX, équipement…) s'ouvre
  // par-dessus la carte du post et en épouse les bords.
  const [sheetHost, setSheetHost] = useState<HTMLElement | null>(null);
  useEffect(() => {
    if (variant !== 'panel') return;
    const host =
      panelRef.current?.closest<HTMLElement>('.lkdv-post-panel-slot, .lkdv-community-panel-slot, .lkdv-feed-post') ?? null;
    setSheetHost(host);
  }, [variant]);
  const inputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { dragProps, handleProps, y } = useDragDismiss({
    onDismiss: () => {
      haptic('light');
      onClose();
    },
    mode: 'handle',
    threshold: 75,
    velocityThreshold: 350,
  });

  // Navigation vers le profil d'un auteur de commentaire (clic sur photo ou pseudo)
  const handleNavigateToProfile = (author: FreedomComment['author']) => {
    haptic('light');
    if (onNavigateToProfile) {
      onNavigateToProfile(author);
      return;
    }
    onClose();
    const handleOrId =
      author.handle ||
      (author.id && !author.id.startsWith('u-') && !author.id.startsWith('author-')
        ? author.id
        : author.name
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/[^a-z0-9]/g, '.'));

    router.push(`/profil/${encodeURIComponent(handleOrId)}`);
  };

  // Load comments (with instant preloaded cache & background revalidation)
  useEffect(() => {
    if (!isOpen) return;
    let alive = true;

    const cached = getPreloadedReelComments(reelId);
    if (cached) {
      setComments(cached);
      setLoading(false);
    } else {
      setLoading(true);
    }

    fetchReelComments(reelId, currentUser)
      .then((data) => {
        if (!alive) return;
        setComments(data);
        setPreloadedReelComments(reelId, data);

        // Preload profiles in background for instant navigation
        for (const c of data) {
          const key = c.author.handle || c.author.id;
          if (key) {
            void preloadPublicProfile(key, {
              id: c.author.id,
              name: c.author.name,
              handle: c.author.handle || undefined,
              avatarUrl: c.author.avatarUrl || null,
            });
          }
        }
      })
      .catch((e) => {
        console.error('[Freedom] Error loading comments:', e);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });

    return () => {
      alive = false;
    };
  }, [isOpen, reelId, currentUser?.id]); // eslint-disable-line react-hooks/exhaustive-deps -- seul l’identifiant compte

  // Threads hierarchy memo: nests replies under their root comment
  const threads = useMemo<CommentThread[]>(() => {
    const threadMap = new Map<string, CommentThread>();
    const rootThreads: CommentThread[] = [];
    const directReplies = new Map<string, FreedomComment[]>();

    for (const c of comments) {
      if (!c.parentId) {
        const t: CommentThread = { comment: c, replies: [] };
        threadMap.set(c.id, t);
        rootThreads.push(t);
      } else {
        const list = directReplies.get(c.parentId) || [];
        list.push(c);
        directReplies.set(c.parentId, list);
      }
    }

    for (const [parentId, replyList] of directReplies.entries()) {
      const parentThread = threadMap.get(parentId);
      if (parentThread) {
        parentThread.replies.push(...replyList);
      } else {
        // If parentId belongs to a reply, attach to the root thread
        let attached = false;
        for (const t of rootThreads) {
          if (t.replies.some((r) => r.id === parentId)) {
            t.replies.push(...replyList);
            attached = true;
            break;
          }
        }
        if (!attached) {
          // Orphan comment promoted to root
          for (const orphan of replyList) {
            rootThreads.push({ comment: orphan, replies: [] });
          }
        }
      }
    }

    return rootThreads;
  }, [comments]);

  // Lien profond vers un commentaire : on l'amène au centre une fois la liste chargée.
  useEffect(() => {
    if (!focusCommentId || loading) return;
    const target = listRef.current?.querySelector<HTMLElement>(`[data-comment-id="${focusCommentId}"]`);
    target?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [focusCommentId, loading, comments]);

  // Keyboard navigation
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (menuOpen) setMenuOpen(false);
        else onClose();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, menuOpen, onClose]);

  const handleSend = async () => {
    const textToSend = inputText.trim();
    if ((!textToSend && !pendingAttachment) || submitting) return;
    if (!currentUser?.id && onRequireAuth) {
      onRequireAuth();
      return;
    }

    haptic('light');
    setSubmitting(true);

    const targetParentId = replyingTo?.parentId || null;

    try {
      const newComment = await postReelComment(
        reelId,
        currentUser,
        textToSend,
        pendingAttachment,
        targetParentId,
      );

      setComments((prev) => {
        const next = [...prev, newComment];
        setPreloadedReelComments(reelId, next);
        return next;
      });
      onCommentsCountChange?.(comments.length + 1);
      setInputText('');
      setPendingAttachment(null);
      setReplyingTo(null);

      // Scroll to bottom of comments list
      setTimeout(() => {
        listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' });
      }, 50);
    } catch (e) {
      console.error('[Freedom] Error posting comment:', e);
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleLike = (commentId: string) => {
    haptic('selection');
    const target = comments.find((c) => c.id === commentId);
    // Post réel : le « j'aime » est enregistré en base (annulé si refusé).
    if (reelId.startsWith('post-')) {
      if (!currentUser?.id) {
        onRequireAuth?.();
        return;
      }
      const nextLiked = !target?.isLiked;
      void setPostCommentLike(commentId, currentUser.id, nextLiked).then((ok) => {
        if (ok) return;
        setComments((prev) =>
          prev.map((c) =>
            c.id === commentId
              ? { ...c, isLiked: !nextLiked, likesCount: Math.max(0, c.likesCount + (nextLiked ? -1 : 1)) }
              : c,
          ),
        );
      });
    }
    setComments((prev) => {
      const next = prev.map((c) => {
        if (c.id !== commentId) return c;
        const nextLiked = !c.isLiked;
        return {
          ...c,
          isLiked: nextLiked,
          likesCount: nextLiked ? c.likesCount + 1 : Math.max(0, c.likesCount - 1),
        };
      });
      setPreloadedReelComments(reelId, next);
      return next;
    });
  };

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    haptic('medium');
    const localUrl = URL.createObjectURL(file);
    setPendingAttachment({
      type: 'photo',
      photoUrl: localUrl,
    });
  };

  // Render attachment in sleek opaque liquid glass card format with image/icon on the left, title on the right
  const ATTACHMENT_CARD_CLASS =
    'group mt-1 flex items-center gap-2.5 rounded-2xl border border-white/90 bg-white/85 p-1.5 pr-3 shadow-glass-inset-soft backdrop-blur-2xl backdrop-saturate-150 transition hover:border-[#17402C]/30 hover:bg-white/95 active:scale-[0.98] text-left max-w-[280px]';

  const renderAttachment = (att: FreedomCommentAttachment) => {
    // 1. Kit attachment: card liquid glass opaque, image à gauche, titre à droite
    if (att.type === 'kit' && att.kit) {
      const kitImage =
        att.kit.image_url ||
        (att.kit.kit_name.toLowerCase().includes('bivouac')
          ? '/assets/images/adventure-bivouac.jpg'
          : att.kit.kit_name.toLowerCase().includes('camille')
          ? '/assets/images/adventure-hiking.jpg'
          : '/assets/images/backpack.jpg');

      return (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            haptic('light');
            if (onOpenKit) {
              onOpenKit(att.kit!.kit_id, att.kit!.kit_name);
            } else {
              router.push(`/compte?tab=kits&kit=${encodeURIComponent(att.kit!.kit_id)}`);
            }
          }}
          className={ATTACHMENT_CARD_CLASS}
          aria-label={`Voir le kit ${att.kit.kit_name}`}
        >
          <div className="size-9 shrink-0 overflow-hidden rounded-xl bg-[#E8F0E6] border border-white/80 shadow-inner">
            <img
              src={kitImage}
              alt={att.kit.kit_name}
              className="size-full object-cover"
            />
          </div>
          <div className="min-w-0 flex-1">
            <span className="block truncate text-xs font-semibold text-[#172B24] group-hover:text-[#17402C]">
              {att.kit.kit_name}
            </span>
          </div>
        </button>
      );
    }

    // 2. GPX trace attachment: card liquid glass opaque, icone tracé/randonnée à gauche, nom à droite
    if (att.type === 'gpx' && att.gpx) {
      return (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            haptic('light');
            router.push(`/explorer?gpx=${encodeURIComponent(att.gpx!.name)}`);
          }}
          className={ATTACHMENT_CARD_CLASS}
          aria-label={`Voir le tracé ${att.gpx.name}`}
        >
          <div className="size-9 shrink-0 rounded-xl bg-[#E8F0E6]/90 flex items-center justify-center border border-white/80 text-[#17402C] shadow-inner">
            <Route size={18} strokeWidth={2.2} />
          </div>
          <div className="min-w-0 flex-1">
            <span className="block truncate text-xs font-semibold text-[#172B24] group-hover:text-[#17402C]">
              {att.gpx.name}
            </span>
          </div>
        </button>
      );
    }

    // 3. Product attachment: card liquid glass opaque, image à gauche, nom à droite
    if (att.type === 'product' && att.product) {
      const prodImg = att.product.photo_url || '/assets/images/gear-tent-small.jpg';
      return (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            haptic('light');
            router.push(`/materiel?product=${encodeURIComponent(att.product!.id || att.product!.name)}`);
          }}
          className={ATTACHMENT_CARD_CLASS}
          aria-label={`Voir le produit ${att.product.name}`}
        >
          <div className="size-9 shrink-0 overflow-hidden rounded-xl bg-[#E8F0E6] border border-white/80 shadow-inner">
            <img
              src={prodImg}
              alt={att.product.name}
              className="size-full object-cover"
            />
          </div>
          <div className="min-w-0 flex-1">
            <span className="block truncate text-xs font-semibold text-[#172B24] group-hover:text-[#17402C]">
              {att.product.name}
            </span>
          </div>
        </button>
      );
    }

    // 4. Trail attachment: card liquid glass opaque, icone sentier à gauche, nom à droite
    if (att.type === 'trail' && att.trail) {
      return (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            haptic('light');
            router.push(`/explorer?trail=${encodeURIComponent(att.trail!.id || att.trail!.name)}`);
          }}
          className={ATTACHMENT_CARD_CLASS}
          aria-label={`Voir la randonnée ${att.trail.name}`}
        >
          <div className="size-9 shrink-0 rounded-xl bg-[#E8F0E6]/90 flex items-center justify-center border border-white/80 text-[#17402C] shadow-inner">
            <Footprints size={18} strokeWidth={2.2} />
          </div>
          <div className="min-w-0 flex-1">
            <span className="block truncate text-xs font-semibold text-[#172B24] group-hover:text-[#17402C]">
              {att.trail.name}
            </span>
          </div>
        </button>
      );
    }

    // 5. User shared photo
    if (att.type === 'photo' && att.photoUrl) {
      return (
        <div className="mt-1 overflow-hidden rounded-xl border border-black/10">
          {/* eslint-disable-next-line @next/next/no-img-element -- user comment photo */}
          <img
            src={att.photoUrl}
            alt="Photo partagée"
            className="max-h-48 w-auto rounded-xl object-cover"
          />
        </div>
      );
    }

    return null;
  };

  if (!isOpen) return null;

  const body = (
    <>
        {/* Comments & Replies Threaded List */}
        <div ref={listRef} className="freedom-drawer-content space-y-4">
          {loading ? (
            <div className="flex h-36 items-center justify-center">
              <div className="size-6 animate-spin rounded-full border-2 border-[#17402C] border-t-transparent" />
            </div>
          ) : threads.length === 0 ? (
            <div className="flex h-44 flex-col items-center justify-center gap-2 text-center text-sm text-[#56665D]">
              <p className="font-semibold text-[#172B24]">Aucun commentaire pour l’instant.</p>
              <p className="text-xs">Soyez le premier voyageur à partager votre avis ou votre kit !</p>
            </div>
          ) : (
            threads.map((thread) => {
              const root = thread.comment;
              return (
                <div key={root.id} className="space-y-2.5" data-comment-id={root.id}>
                  {/* Root Comment Row */}
                  <div className="flex items-start gap-2.5">
                    {/* Avatar (cliquable vers le profil) */}
                    <button
                      type="button"
                      onClick={() => handleNavigateToProfile(root.author)}
                      className="size-8 shrink-0 overflow-hidden rounded-full bg-[#E5EAE3] border border-black/5 mt-0.5 transition-transform active:scale-95 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#17402C]"
                      aria-label={`Voir le profil de ${root.author.name}`}
                    >
                      {root.author.avatarUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element -- distant avatar
                        <img
                          src={root.author.avatarUrl}
                          alt={root.author.name}
                          className="size-full object-cover"
                        />
                      ) : (
                        <div className="grid size-full place-items-center text-xs font-bold text-[#17402C]">
                          {root.author.name.charAt(0).toUpperCase()}
                        </div>
                      )}
                    </button>

                    {/* Comment Body */}
                    <div className="flex-1 space-y-1 min-w-0">
                      <div className="flex items-baseline gap-2">
                        <button
                          type="button"
                          onClick={() => handleNavigateToProfile(root.author)}
                          className="text-left text-xs font-bold text-[#172B24] hover:text-[#17402C] hover:underline cursor-pointer focus-visible:outline-none truncate"
                        >
                          {root.author.name}
                        </button>
                        <span className="text-[10px] text-[#56665D] shrink-0">
                          {timeAgo(root.createdAt)}
                        </span>
                      </div>

                      {root.content && (
                        <p className="text-xs text-[#172B24] leading-relaxed">
                          {root.content}
                        </p>
                      )}

                      {/* Attachment (Kit fond blanc, GPX tracé, etc.) */}
                      {root.attachment && renderAttachment(root.attachment)}

                      {/* Reply Button */}
                      <div className="pt-0.5">
                        <button
                          type="button"
                          onClick={() => {
                            haptic('selection');
                            setReplyingTo({
                              id: root.id,
                              authorName: root.author.name,
                              parentId: root.id,
                            });
                            inputRef.current?.focus();
                          }}
                          className="text-[11px] font-semibold text-[#56665D] hover:text-[#17402C]"
                        >
                          Répondre
                        </button>
                      </div>
                    </div>

                    {/* Like Button on Root Comment */}
                    <button
                      type="button"
                      onClick={() => handleToggleLike(root.id)}
                      className="flex flex-col items-center gap-0.5 pt-1 text-[#56665D] hover:text-[#FF2D55]"
                      aria-label="Aimer le commentaire"
                    >
                      <Heart
                        size={14}
                        fill={root.isLiked ? '#FF2D55' : 'none'}
                        color={root.isLiked ? '#FF2D55' : 'currentColor'}
                        strokeWidth={root.isLiked ? 0 : 2}
                      />
                      {root.likesCount > 0 && (
                        <span className="text-[10px] font-medium">{root.likesCount}</span>
                      )}
                    </button>
                  </div>

                  {/* Nested Replies Thread (indented with left border) */}
                  {thread.replies.length > 0 && (
                    <div className="ml-7 space-y-2.5 border-l-2 border-[#17402C]/15 pl-3">
                      {thread.replies.map((reply) => (
                        <div key={reply.id} className="flex items-start gap-2">
                          {/* Reply Avatar (cliquable vers le profil) */}
                          <button
                            type="button"
                            onClick={() => handleNavigateToProfile(reply.author)}
                            className="size-6 shrink-0 overflow-hidden rounded-full bg-[#E5EAE3] border border-black/5 mt-0.5 transition-transform active:scale-95 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#17402C]"
                            aria-label={`Voir le profil de ${reply.author.name}`}
                          >
                            {reply.author.avatarUrl ? (
                              // eslint-disable-next-line @next/next/no-img-element -- distant avatar
                              <img
                                src={reply.author.avatarUrl}
                                alt={reply.author.name}
                                className="size-full object-cover"
                              />
                            ) : (
                              <div className="grid size-full place-items-center text-[10px] font-bold text-[#17402C]">
                                {reply.author.name.charAt(0).toUpperCase()}
                              </div>
                            )}
                          </button>

                          {/* Reply Body */}
                          <div className="flex-1 space-y-1 min-w-0">
                            <div className="flex items-baseline gap-2">
                              <button
                                type="button"
                                onClick={() => handleNavigateToProfile(reply.author)}
                                className="text-left text-[11px] font-bold text-[#172B24] hover:text-[#17402C] hover:underline cursor-pointer focus-visible:outline-none truncate"
                              >
                                {reply.author.name}
                              </button>
                              <span className="text-[9px] text-[#56665D] shrink-0">
                                {timeAgo(reply.createdAt)}
                              </span>
                            </div>

                            {reply.content && (
                              <p className="text-xs text-[#172B24] leading-relaxed">
                                {reply.content}
                              </p>
                            )}

                            {/* Reply Attachment */}
                            {reply.attachment && renderAttachment(reply.attachment)}

                            {/* Reply to this reply */}
                            <div className="pt-0.5">
                              <button
                                type="button"
                                onClick={() => {
                                  haptic('selection');
                                  setReplyingTo({
                                    id: reply.id,
                                    authorName: reply.author.name,
                                    parentId: root.id,
                                  });
                                  inputRef.current?.focus();
                                }}
                                className="text-[10px] font-semibold text-[#56665D] hover:text-[#17402C]"
                              >
                                Répondre
                              </button>
                            </div>
                          </div>

                          {/* Like Button on Reply */}
                          <button
                            type="button"
                            onClick={() => handleToggleLike(reply.id)}
                            className="flex flex-col items-center gap-0.5 pt-0.5 text-[#56665D] hover:text-[#FF2D55]"
                            aria-label="Aimer la réponse"
                          >
                            <Heart
                              size={12}
                              fill={reply.isLiked ? '#FF2D55' : 'none'}
                              color={reply.isLiked ? '#FF2D55' : 'currentColor'}
                              strokeWidth={reply.isLiked ? 0 : 2}
                            />
                            {reply.likesCount > 0 && (
                              <span className="text-[9px] font-medium">{reply.likesCount}</span>
                            )}
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Replying Banner */}
        {replyingTo && (
          <div className="flex items-center justify-between border-t border-black/5 bg-[#E8F0E6]/85 px-4 py-1.5 text-xs text-[#172B24]">
            <div className="flex items-center gap-1.5 truncate">
              <CornerDownRight size={13} className="text-[#17402C] shrink-0" />
              <span>
                En réponse à <strong className="text-[#17402C]">@{replyingTo.authorName}</strong>
              </span>
            </div>
            <button
              type="button"
              onClick={() => setReplyingTo(null)}
              className="text-xs font-semibold text-[#7A241C] hover:underline"
            >
              Annuler
            </button>
          </div>
        )}

        {/* Pending Attachment Preview Banner */}
        {pendingAttachment && (
          <div className="flex items-center justify-between border-t border-black/5 bg-[#E8F0E6] px-4 py-2 text-xs font-semibold text-[#17402C]">
            <div className="flex items-center gap-2 truncate">
              {pendingAttachment.type === 'kit' && (
                <span>Kit : {pendingAttachment.kit?.kit_name || 'Matériel'}</span>
              )}
              {pendingAttachment.type === 'gpx' && (
                <span>Tracé GPX : {pendingAttachment.gpx?.name || 'Tracé'}</span>
              )}
              {pendingAttachment.type === 'product' && (
                <span>Équipement : {pendingAttachment.product?.name}</span>
              )}
              {pendingAttachment.type === 'trail' && (
                <span>Randonnée : {pendingAttachment.trail?.name}</span>
              )}
              {pendingAttachment.type === 'photo' && (
                <span>Photo prête à l’envoi</span>
              )}
            </div>

            <button
              type="button"
              onClick={() => setPendingAttachment(null)}
              className="rounded-full p-1 text-[#7A241C] hover:bg-black/5"
              aria-label="Supprimer la pièce jointe"
            >
              <X size={14} />
            </button>
          </div>
        )}

        {/* Bottom Composer */}
        <div className="freedom-comments-composer">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            style={{ display: 'none' }}
            onChange={handlePhotoUpload}
          />

          <form
            onSubmit={(e) => {
              e.preventDefault();
              void handleSend();
            }}
            className="freedom-composer-form"
          >
            {/* Photo Picker */}
            <button
              type="button"
              className="freedom-composer-btn"
              onClick={() => fileInputRef.current?.click()}
              aria-label="Joindre une photo"
            >
              <ImageIcon size={19} />
            </button>

            {/* Rich Attachment Sheet Picker (+) */}
            <button
              type="button"
              className="freedom-composer-btn"
              onClick={() => setMenuOpen(true)}
              aria-label="Joindre un Kit, GPX ou Équipement"
            >
              <Plus size={20} strokeWidth={2.5} />
            </button>

            {/* Input field */}
            <input
              ref={inputRef}
              type="text"
              className="freedom-composer-input"
              placeholder={
                replyingTo
                  ? `Répondre à @${replyingTo.authorName}…`
                  : 'Ajouter un commentaire ou partager un kit…'
              }
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onFocus={(e) => {
                if (!inputArmed) e.currentTarget.blur();
              }}
              style={inputArmed ? undefined : { pointerEvents: 'none' }}
              aria-label="Votre commentaire"
            />

            {/* Send Button */}
            <button
              type="button"
              onClick={() => void handleSend()}
              disabled={(!inputText.trim() && !pendingAttachment) || submitting}
              className={`freedom-composer-btn is-send ${
                (!inputText.trim() && !pendingAttachment) || submitting ? 'opacity-40' : ''
              }`}
              aria-label="Publier le commentaire"
            >
              <Send size={18} />
            </button>
          </form>
        </div>
    </>
  );

  const menuSheet = (
    <>
      {/* Rich Attachments Sheet (GPX, Kit, Équipement, Rando) */}
      {menuOpen && (
        <FreedomComposerMenuSheet
          isOpen={menuOpen}
          currentUserId={currentUser?.id}
          onClose={() => setMenuOpen(false)}
          onSelectAttachment={(att) => {
            setPendingAttachment(att);
            setMenuOpen(false);
          }}
        />
      )}
    </>
  );

  if (variant === 'panel') {
    return (
      <div ref={panelRef} className="freedom-comments-panel" role="region" aria-label="Commentaires de la publication">
        {body}
        {menuOpen && sheetHost
          ? createPortal(<div className="freedom-sheet-host">{menuSheet}</div>, sheetHost)
          : menuOpen
            ? menuSheet
            : null}
      </div>
    );
  }

  return (
    <div
      className="freedom-drawer-backdrop"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Commentaires de la vidéo"
    >
      {/* Background Scrim */}
      <div className="freedom-drawer-scrim" onClick={onClose} />

      {/* Drawer Card (Liquid Glass, demi-hauteur 50% responsive) */}
      <motion.div
        {...dragProps}
        style={{ y }}
        className="freedom-drawer-sheet h-[68vh] max-h-[75dvh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Grab Handle (pour fermer en glissant vers le bas) */}
        <div
          className="freedom-drawer-grab cursor-grab active:cursor-grabbing"
          {...handleProps}
          onClick={onClose}
          aria-label="Fermer les commentaires"
        >
          <span />
        </div>

        {body}
      </motion.div>

      {menuSheet}
    </div>
  );
};

export default FreedomCommentsDrawer;
