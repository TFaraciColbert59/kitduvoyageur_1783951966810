'use client';

import React, { useState, useMemo } from 'react';
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
  onAddComment: (content: string, replyToId?: string) => Promise<void>;
  onLikeComment?: (commentId: string, liked?: boolean) => void;
  onDeleteComment?: (commentId: string) => void;
}

export default function CommentsSheet({
  isOpen,
  onClose,
  title = 'Discussions',
  comments,
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

  // Group top-level and direct replies (must run on every render)
  const threadedComments = useMemo(() => {
    const rootComments: CommentData[] = [];
    const repliesMap = new Map<string, CommentData[]>();

    if (comments && comments.length > 0) {
      comments.forEach(c => {
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

  if (!isOpen) return null;

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
    setLocalLikedMap(prev => ({
      ...prev,
      [c.id]: { liked: nextLiked, count: nextCount },
    }));
    onLikeComment?.(c.id, nextLiked);
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[150] flex items-end justify-center">
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
          className="relative z-10 w-full max-w-lg bg-white/25 backdrop-blur-3xl saturate-200 text-white rounded-t-[32px] p-5 pb-7 shadow-[0_-25px_60px_rgba(0,0,0,0.25)] border-t border-white/80 border-x border-white/50 flex flex-col h-[78vh] max-h-[640px]"
        >
          {/* Drag handle */}
          <div className="w-12 h-1.5 bg-white/60 rounded-full mx-auto mb-3 shrink-0 shadow-sm" />

          {/* Header */}
          <div className="flex items-center justify-between pb-3 border-b border-white/30 shrink-0">
            <div className="flex items-center gap-2">
              <span className="text-base">💬</span>
              <h3 className="font-display font-bold text-base text-white tracking-wide drop-shadow-sm">
                {title}
              </h3>
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-white/30 border border-white/40 text-white font-mono font-bold shadow-sm">
                {comments.length}
              </span>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-white/25 hover:bg-white/40 border border-white/40 flex items-center justify-center text-white active:scale-90 transition-all shadow-sm"
              aria-label="Fermer"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>

          {/* Comments List - Scrollbar removed */}
          <div className="flex-1 overflow-y-auto py-2 space-y-3.5 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
            {loading ? (
              <div className="space-y-2.5 py-2">
                {[1, 2, 3].map(i => (
                  <div key={i} className="flex gap-3 p-3.5 bg-white/20 rounded-2xl border border-white/30 animate-pulse">
                    <div className="w-8 h-8 rounded-full bg-white/30 shrink-0" />
                    <div className="flex-1 space-y-2">
                      <div className="w-24 h-3 bg-white/40 rounded" />
                      <div className="w-full h-3 bg-white/25 rounded" />
                    </div>
                  </div>
                ))}
              </div>
            ) : comments.length === 0 ? (
              <div className="py-16 text-center text-white space-y-2">
                <span className="text-3xl block">💬</span>
                <p className="text-sm font-bold text-white drop-shadow-sm">Aucun commentaire pour le moment</p>
                <p className="text-xs text-white/80 font-medium">Soyez le premier à lancer la conversation !</p>
              </div>
            ) : (
              threadedComments.rootComments.map(rootComment => {
                const replies = threadedComments.repliesMap.get(rootComment.id) || [];
                const rootLikedState = localLikedMap[rootComment.id] ?? {
                  liked: Boolean(rootComment.user_liked),
                  count: rootComment.likes_count || 0,
                };

                return (
                  <div key={rootComment.id} className="space-y-2 relative">
                    {/* Root Comment Pill */}
                    <div className="p-3.5 bg-white/30 hover:bg-white/40 transition-all backdrop-blur-xl rounded-2xl border border-white/50 flex items-start gap-3 shadow-[0_4px_16px_rgba(0,0,0,0.06)] relative z-10">
                      <a
                        href={rootComment.author_id ? `/profil/${rootComment.author_id}` : '#'}
                        className="w-8 h-8 rounded-full bg-white/50 text-[#17402C] border border-white/70 flex items-center justify-center text-xs font-bold shrink-0 uppercase overflow-hidden hover:opacity-80 transition-opacity shadow-sm mt-0.5"
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
                            className="text-xs font-bold text-white hover:text-white/85 hover:underline truncate drop-shadow-[0_1px_2px_rgba(0,0,0,0.3)]"
                          >
                            {rootComment.author_name}
                          </a>
                          <span className="text-[10px] text-white/75 shrink-0 font-mono font-medium drop-shadow-[0_1px_1px_rgba(0,0,0,0.2)]">
                            {new Date(rootComment.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
                          </span>
                        </div>

                        <p className="text-xs text-white leading-relaxed break-words font-medium drop-shadow-[0_1px_2px_rgba(0,0,0,0.25)]">
                          {rootComment.content}
                        </p>

                        {/* Actions : Répondre + Supprimer si propriétaire */}
                        <div className="flex items-center gap-4 mt-2 pt-1 border-t border-white/15 text-[11px] text-white/80 font-medium">
                          <button
                            type="button"
                            onClick={() => {
                              triggerHaptic('selection');
                              setReplyTarget({ id: rootComment.id, authorName: rootComment.author_name });
                              setNewComment(`@${rootComment.author_name} `);
                            }}
                            className="hover:text-white transition-colors flex items-center gap-1 active:scale-95 text-white/90"
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
                              className="hover:text-red-300 text-red-200 transition-colors ml-auto text-[10px] font-semibold flex items-center gap-1"
                            >
                              <span>🗑️ Supprimer</span>
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Modern Like button with Heart icon and live counter */}
                      <button
                        type="button"
                        onClick={() => handleLikeToggle(rootComment)}
                        className="flex flex-col items-center gap-0.5 pt-0.5 text-white/70 hover:text-white active:scale-80 transition-all shrink-0"
                        aria-label="Aimer le commentaire"
                      >
                        <svg
                          width="16"
                          height="16"
                          viewBox="0 0 24 24"
                          fill={rootLikedState.liked ? '#F43F5E' : 'none'}
                          stroke={rootLikedState.liked ? '#F43F5E' : 'currentColor'}
                          strokeWidth="2.2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          className={rootLikedState.liked ? 'scale-115' : ''}
                        >
                          <path d="M19.5 12.572l-7.5 7.428l-7.5 -7.428a5 5 0 1 1 7.5 -6.566a5 5 0 1 1 7.5 6.572" />
                        </svg>
                        <span className="text-[10px] font-mono font-bold leading-none">
                          {rootLikedState.count > 0 ? rootLikedState.count : ''}
                        </span>
                      </button>
                    </div>

                    {/* Replies with Twitter/X Style Thread Line */}
                    {replies.length > 0 && (
                      <div className="pl-6 sm:pl-8 space-y-2 relative">
                        {/* Vertical connective thread line */}
                        <div className="absolute left-3 top-[-8px] bottom-4 w-0.5 bg-gradient-to-b from-white/60 via-white/40 to-white/10 rounded-full" />

                        {replies.map(reply => {
                          const replyLikedState = localLikedMap[reply.id] ?? {
                            liked: Boolean(reply.user_liked),
                            count: reply.likes_count || 0,
                          };

                          return (
                            <div
                              key={reply.id}
                              className="p-3 bg-white/20 hover:bg-white/30 transition-all backdrop-blur-xl rounded-2xl border border-white/35 flex items-start gap-2.5 shadow-[0_2px_12px_rgba(0,0,0,0.04)] relative z-10"
                            >
                              <a
                                href={reply.author_id ? `/profil/${reply.author_id}` : '#'}
                                className="w-7 h-7 rounded-full bg-white/50 text-[#17402C] border border-white/70 flex items-center justify-center text-[10px] font-bold shrink-0 uppercase overflow-hidden hover:opacity-80 transition-opacity shadow-sm mt-0.5"
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
                                    className="text-xs font-bold text-white hover:text-white/85 hover:underline truncate drop-shadow-[0_1px_2px_rgba(0,0,0,0.3)]"
                                  >
                                    {reply.author_name}
                                  </a>
                                  <span className="text-[9px] text-white/70 shrink-0 font-mono font-medium drop-shadow-[0_1px_1px_rgba(0,0,0,0.2)]">
                                    {new Date(reply.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
                                  </span>
                                </div>

                                <p className="text-xs text-white leading-relaxed break-words font-medium drop-shadow-[0_1px_2px_rgba(0,0,0,0.25)]">
                                  {reply.content}
                                </p>

                                {/* Actions for reply */}
                                <div className="flex items-center gap-3 mt-1.5 pt-1 border-t border-white/10 text-[10px] text-white/80">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      triggerHaptic('selection');
                                      setReplyTarget({ id: rootComment.id, authorName: reply.author_name });
                                      setNewComment(`@${reply.author_name} `);
                                    }}
                                    className="hover:text-white transition-colors"
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
                                      className="hover:text-red-300 text-red-200 transition-colors ml-auto font-semibold"
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
                                className="flex flex-col items-center gap-0.5 text-white/70 hover:text-white active:scale-80 transition-all shrink-0 pt-0.5"
                                aria-label="Aimer la réponse"
                              >
                                <svg
                                  width="14"
                                  height="14"
                                  viewBox="0 0 24 24"
                                  fill={replyLikedState.liked ? '#F43F5E' : 'none'}
                                  stroke={replyLikedState.liked ? '#F43F5E' : 'currentColor'}
                                  strokeWidth="2.2"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  className={replyLikedState.liked ? 'scale-115' : ''}
                                >
                                  <path d="M19.5 12.572l-7.5 7.428l-7.5 -7.428a5 5 0 1 1 7.5 -6.566a5 5 0 1 1 7.5 6.572" />
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
            <div className="flex items-center justify-between px-3 py-1.5 bg-white/20 backdrop-blur-md rounded-xl border border-white/30 text-xs text-white mb-2 shrink-0">
              <span className="truncate">En réponse à <strong className="underline">@{replyTarget.authorName}</strong></span>
              <button
                type="button"
                onClick={() => {
                  setReplyTarget(null);
                  setNewComment('');
                }}
                className="text-white/80 hover:text-white ml-2 text-xs font-bold"
              >
                ✕ Annuler
              </button>
            </div>
          )}

          {/* Comment Form Input Bar */}
          <form onSubmit={handleSubmit} className="pt-2.5 border-t border-white/30 shrink-0 flex items-center gap-2">
            <input
              type="text"
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              placeholder={replyTarget ? `Répondre à @${replyTarget.authorName}...` : "Ajouter un commentaire..."}
              className="flex-1 bg-white/30 backdrop-blur-2xl border border-white/60 rounded-full px-4 py-2.5 text-xs text-white placeholder-white/80 focus:outline-none focus:ring-2 focus:ring-white shadow-inner font-medium"
            />
            <button
              type="submit"
              disabled={!newComment.trim() || submitting}
              className="w-10 h-10 bg-white hover:bg-white/90 text-[#17402C] rounded-full flex items-center justify-center transition-all disabled:opacity-40 shrink-0 shadow-lg active:scale-90"
              aria-label="Envoyer le commentaire"
            >
              {submitting ? (
                <span className="text-xs font-bold">...</span>
              ) : (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="5" y1="12" x2="19" y2="12" />
                  <polyline points="12 5 19 12 12 19" />
                </svg>
              )}
            </button>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
