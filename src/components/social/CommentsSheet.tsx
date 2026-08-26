'use client';

import React, { useState, useMemo, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useHapticFeedback } from '@/hooks/useHapticFeedback';

export interface CommentData {
  id: string;
  author_id?: string;
  author_name: string;
  author_avatar?: string;
  created_at: string;
  content: string;
  reply_to_id?: string;
  reply_to_author?: string;
  likes_count?: number;
  user_liked?: boolean;
}

export interface CommentsSheetProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  comments: CommentData[];
  loading?: boolean;
  currentUserId?: string;
  onAddComment: (content: string, replyToId?: string) => Promise<void> | void;
  onLikeComment?: (commentId: string, liked?: boolean) => void;
  onDeleteComment?: (commentId: string) => void;
}

function formatCommentDate(dateStr?: string): string {
  if (!dateStr) return '';
  if (dateStr.includes('Il y a') || dateStr.includes("À l'instant") || dateStr.includes('Hier')) {
    return dateStr;
  }
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
}

export default function CommentsSheet({
  isOpen,
  onClose,
  title = 'Commentaires & Discussions',
  comments = [],
  loading = false,
  currentUserId,
  onAddComment,
  onLikeComment,
  onDeleteComment,
}: CommentsSheetProps) {
  const { triggerHaptic } = useHapticFeedback();
  const [newComment, setNewComment] = useState('');
  const [replyTarget, setReplyTarget] = useState<{ id: string; authorName: string } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [localLikedMap, setLocalLikedMap] = useState<Record<string, { liked: boolean; count: number }>>({});
  const inputRef = useRef<HTMLInputElement>(null);

  // Group top-level and direct replies (must run on every render)
  const threadedComments = useMemo(() => {
    const rootComments: CommentData[] = [];
    const repliesMap = new Map<string, CommentData[]>();

    if (comments && comments.length > 0) {
      comments.forEach((c) => {
        if (c.reply_to_id) {
          const existing = repliesMap.get(c.reply_to_id) || [];
          repliesMap.set(c.reply_to_id, [...existing, c]);
        } else {
          rootComments.push(c);
        }
      });
    }

    return { rootComments, repliesMap };
  }, [comments]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim() || submitting) return;
    triggerHaptic('selection');
    setSubmitting(true);
    try {
      await onAddComment(newComment.trim(), replyTarget?.id);
      setNewComment('');
      setReplyTarget(null);
    } catch (err) {
      console.error('Error posting comment:', err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleLikeToggle = (c: CommentData) => {
    triggerHaptic('selection');
    const current = localLikedMap[c.id] ?? { liked: Boolean(c.user_liked), count: c.likes_count || 0 };
    const nextLiked = !current.liked;
    const nextCount = nextLiked ? current.count + 1 : Math.max(0, current.count - 1);
    setLocalLikedMap((prev) => ({
      ...prev,
      [c.id]: { liked: nextLiked, count: nextCount },
    }));
    onLikeComment?.(c.id, nextLiked);
  };

  const startReply = (targetId: string, authorName: string) => {
    triggerHaptic('selection');
    setReplyTarget({ id: targetId, authorName });
    setNewComment(`@${authorName} `);
    setTimeout(() => {
      inputRef.current?.focus();
    }, 60);
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[999] flex items-end justify-center">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/60 backdrop-blur-md"
          onClick={onClose}
        />

        {/* Liquid Glass Sheet Content */}
        <motion.div
          initial={{ y: '100%' }}
          animate={{ y: 0 }}
          exit={{ y: '100%' }}
          transition={{ type: 'spring', damping: 28, stiffness: 350 }}
          onClick={(e) => e.stopPropagation()}
          className="relative z-10 w-full max-w-lg glass bg-white/95 backdrop-blur-2xl text-[#17402C] rounded-t-[32px] p-4 sm:p-5 pb-8 sm:pb-6 flex flex-col h-[82vh] max-h-[680px] border-t border-white shadow-2xl"
        >
          {/* Drag handle */}
          <div className="w-12 h-1.5 bg-[#17402C]/20 rounded-full mx-auto mb-3 shrink-0 cursor-grab" onClick={onClose} />

          {/* Header */}
          <div className="flex items-center justify-between pb-3 border-b border-[#17402C]/10 shrink-0">
            <div className="flex items-center gap-2">
              <span className="text-base">💬</span>
              <h3 className="font-display font-bold text-sm sm:text-base text-[#17402C] tracking-wide">
                {title}
              </h3>
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-[#17402C]/10 text-[#17402C] font-mono font-bold">
                {comments.length}
              </span>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="w-8 h-8 rounded-full glass-circle-btn !bg-black/5 hover:!bg-black/10 flex items-center justify-center text-[#17402C] p-0 shrink-0 font-bold text-xs"
              aria-label="Fermer"
            >
              ✕
            </button>
          </div>

          {/* Comments List */}
          <div className="flex-1 overflow-y-auto py-3 space-y-3 custom-scrollbar pr-1">
            {loading ? (
              <div className="space-y-2.5 py-2">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="flex gap-3 p-3.5 bg-white/60 rounded-2xl border border-white animate-pulse">
                    <div className="w-8 h-8 rounded-full bg-[#17402C]/10 shrink-0" />
                    <div className="flex-1 space-y-2">
                      <div className="w-24 h-3 bg-[#17402C]/10 rounded" />
                      <div className="w-full h-3 bg-[#17402C]/5 rounded" />
                    </div>
                  </div>
                ))}
              </div>
            ) : comments.length === 0 ? (
              <div className="py-16 text-center text-[#5C6B5E] space-y-2">
                <span className="text-3xl block">💬</span>
                <p className="text-sm font-bold text-[#17402C]">Aucun commentaire pour le moment</p>
                <p className="text-xs text-[#5C6B5E]">Soyez le premier à poser une question ou partager votre avis !</p>
              </div>
            ) : (
              threadedComments.rootComments.map((rootComment) => {
                const replies = threadedComments.repliesMap.get(rootComment.id) || [];
                const rootLikedState = localLikedMap[rootComment.id] ?? {
                  liked: Boolean(rootComment.user_liked),
                  count: rootComment.likes_count || 0,
                };

                return (
                  <div key={rootComment.id} className="space-y-2 relative">
                    {/* Root Comment Card */}
                    <div className="p-3.5 bg-white/85 hover:bg-white transition-all backdrop-blur-xl rounded-2xl border border-white flex items-start gap-3 shadow-2xs relative z-10">
                      <a
                        href={rootComment.author_id ? `/profil/${rootComment.author_id}` : '#'}
                        className="w-8 h-8 rounded-full bg-[#17402C] text-white border border-white flex items-center justify-center text-xs font-bold shrink-0 uppercase overflow-hidden hover:opacity-80 transition-opacity mt-0.5"
                      >
                        {rootComment.author_avatar ? (
                          <img src={rootComment.author_avatar} alt={rootComment.author_name} className="w-full h-full object-cover" />
                        ) : (
                          rootComment.author_name?.charAt(0) || '👤'
                        )}
                      </a>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <a
                            href={rootComment.author_id ? `/profil/${rootComment.author_id}` : '#'}
                            className="text-xs font-bold text-[#17402C] hover:underline truncate"
                          >
                            {rootComment.author_name}
                          </a>
                          <span className="text-[10px] text-[#5C6B5E] shrink-0 font-mono font-medium">
                            {formatCommentDate(rootComment.created_at)}
                          </span>
                        </div>

                        <p className="text-xs text-[#2D4536] leading-relaxed break-words font-sans">
                          {rootComment.content}
                        </p>

                        {/* Actions : Répondre + Supprimer */}
                        <div className="flex items-center gap-4 mt-2 pt-1 border-t border-[#17402C]/10 text-[11px] text-[#5C6B5E] font-medium">
                          <button
                            type="button"
                            onClick={() => startReply(rootComment.id, rootComment.author_name)}
                            className="hover:text-[#17402C] transition-colors flex items-center gap-1 active:scale-95 text-[#17402C] font-semibold cursor-pointer"
                          >
                            <span>↩ Répondre</span>
                          </button>

                          {currentUserId && rootComment.author_id === currentUserId && onDeleteComment && (
                            <button
                              type="button"
                              onClick={() => {
                                triggerHaptic('warning');
                                onDeleteComment(rootComment.id);
                              }}
                              className="hover:text-rose-700 text-rose-600 transition-colors ml-auto text-[10px] font-semibold flex items-center gap-1 cursor-pointer"
                            >
                              <span>🗑️ Supprimer</span>
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Like button */}
                      <button
                        type="button"
                        onClick={() => handleLikeToggle(rootComment)}
                        className="flex flex-col items-center gap-0.5 pt-0.5 text-[#5C6B5E] hover:text-[#17402C] active:scale-80 transition-all shrink-0 cursor-pointer"
                        aria-label="Aimer le commentaire"
                      >
                        <motion.svg
                          whileTap={{ scale: 1.3 }}
                          width="16"
                          height="16"
                          viewBox="0 0 24 24"
                          fill={rootLikedState.liked ? '#E11D48' : 'none'}
                          stroke={rootLikedState.liked ? '#E11D48' : 'currentColor'}
                          strokeWidth="2.2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          className={rootLikedState.liked ? 'scale-110 text-rose-600' : ''}
                        >
                          <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />
                        </motion.svg>
                        <span className="text-[10px] font-mono font-bold leading-none">
                          {rootLikedState.count > 0 ? rootLikedState.count : ''}
                        </span>
                      </button>
                    </div>

                    {/* Replies */}
                    {replies.length > 0 && (
                      <div className="pl-6 sm:pl-8 space-y-2 relative">
                        {/* Vertical line */}
                        <div className="absolute left-3 top-[-6px] bottom-4 w-0.5 bg-[#17402C]/15 rounded-full" />

                        {replies.map((reply) => {
                          const replyLikedState = localLikedMap[reply.id] ?? {
                            liked: Boolean(reply.user_liked),
                            count: reply.likes_count || 0,
                          };

                          return (
                            <div
                              key={reply.id}
                              className="p-3 bg-white/80 hover:bg-white transition-all backdrop-blur-xl rounded-2xl border border-white flex items-start gap-2.5 shadow-2xs relative z-10"
                            >
                              <a
                                href={reply.author_id ? `/profil/${reply.author_id}` : '#'}
                                className="w-7 h-7 rounded-full bg-[#17402C] text-white border border-white flex items-center justify-center text-[10px] font-bold shrink-0 uppercase overflow-hidden hover:opacity-80 transition-opacity mt-0.5"
                              >
                                {reply.author_avatar ? (
                                  <img src={reply.author_avatar} alt={reply.author_name} className="w-full h-full object-cover" />
                                ) : (
                                  reply.author_name?.charAt(0) || '👤'
                                )}
                              </a>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between gap-2 mb-0.5">
                                  <a
                                    href={reply.author_id ? `/profil/${reply.author_id}` : '#'}
                                    className="text-xs font-bold text-[#17402C] hover:underline truncate"
                                  >
                                    {reply.author_name}
                                  </a>
                                  <span className="text-[9px] text-[#5C6B5E] shrink-0 font-mono font-medium">
                                    {formatCommentDate(reply.created_at)}
                                  </span>
                                </div>

                                <p className="text-xs text-[#2D4536] leading-relaxed break-words font-sans">
                                  {reply.content}
                                </p>

                                {/* Actions for reply */}
                                <div className="flex items-center gap-3 mt-1.5 pt-1 border-t border-[#17402C]/10 text-[10px] text-[#5C6B5E]">
                                  <button
                                    type="button"
                                    onClick={() => startReply(rootComment.id, reply.author_name)}
                                    className="hover:text-[#17402C] text-[#17402C] font-semibold transition-colors cursor-pointer"
                                  >
                                    ↩ Répondre
                                  </button>

                                  {currentUserId && reply.author_id === currentUserId && onDeleteComment && (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        triggerHaptic('warning');
                                        onDeleteComment(reply.id);
                                      }}
                                      className="hover:text-rose-700 text-rose-600 transition-colors ml-auto font-semibold cursor-pointer"
                                    >
                                      🗑️ Supprimer
                                    </button>
                                  )}
                                </div>
                              </div>

                              {/* Like on reply */}
                              <button
                                type="button"
                                onClick={() => handleLikeToggle(reply)}
                                className="flex flex-col items-center gap-0.5 text-[#5C6B5E] hover:text-[#17402C] active:scale-80 transition-all shrink-0 pt-0.5 cursor-pointer"
                                aria-label="Aimer la réponse"
                              >
                                <svg
                                  width="14"
                                  height="14"
                                  viewBox="0 0 24 24"
                                  fill={replyLikedState.liked ? '#E11D48' : 'none'}
                                  stroke={replyLikedState.liked ? '#E11D48' : 'currentColor'}
                                  strokeWidth="2.2"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  className={replyLikedState.liked ? 'scale-110 text-rose-600' : ''}
                                >
                                  <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />
                                </svg>
                                <span className="text-[9px] font-mono font-bold leading-none">
                                  {replyLikedState.count > 0 ? replyLikedState.count : ''}
                                </span>
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>

          {/* Active Reply Banner */}
          {replyTarget && (
            <div className="flex items-center justify-between px-3 py-1.5 bg-emerald-50 rounded-xl border border-emerald-200 text-xs text-emerald-900 mb-2 shrink-0">
              <span className="truncate">
                En réponse à <strong className="underline">@{replyTarget.authorName}</strong>
              </span>
              <button
                type="button"
                onClick={() => {
                  setReplyTarget(null);
                  setNewComment('');
                }}
                className="text-emerald-800 hover:opacity-80 ml-2 text-xs font-bold cursor-pointer"
              >
                ✕ Annuler
              </button>
            </div>
          )}

          {/* Comment Form Input Bar */}
          <form onSubmit={handleSubmit} className="pt-3 border-t border-[#17402C]/10 shrink-0 flex items-center gap-2">
            <input
              ref={inputRef}
              type="text"
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              placeholder={replyTarget ? `Répondre à @${replyTarget.authorName}...` : 'Ajouter un commentaire...'}
              className="flex-1 glass bg-white/90 border border-white/80 rounded-full px-4 py-2.5 text-xs text-[#17402C] placeholder-[#5C6B5E] focus:outline-none focus:ring-1 focus:ring-[#17402C] font-medium shadow-2xs"
            />
            <button
              type="submit"
              disabled={!newComment.trim() || submitting}
              className="glass-capsule-btn primary !w-10 !h-10 !p-0 !min-h-[40px] flex items-center justify-center text-white disabled:opacity-40 shrink-0 cursor-pointer shadow-md active:scale-95 transition-all"
              aria-label="Envoyer le commentaire"
            >
              {submitting ? (
                <span className="text-xs font-bold">...</span>
              ) : (
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="22" y1="2" x2="11" y2="13" />
                  <polygon points="22 2 15 22 11 13 2 9 22 2" />
                </svg>
              )}
            </button>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
