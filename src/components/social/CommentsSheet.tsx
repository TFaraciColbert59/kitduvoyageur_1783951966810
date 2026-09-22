'use client';

import React, { useState, useMemo, useRef } from 'react';
import { Badge, Button, Card, EmptyState, IconButton, Sheet, Skeleton } from '@/components/ui';
import Icon from '@/components/ui/AppIcon';
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

  const commentForm = (
    <form onSubmit={handleSubmit} className="flex items-center gap-[var(--space-2)]">
      <input
        ref={inputRef}
        type="text"
        value={newComment}
        onChange={(e) => setNewComment(e.target.value)}
        placeholder={replyTarget ? `Répondre à @${replyTarget.authorName}...` : 'Ajouter un commentaire...'}
        className="min-h-[var(--control-height-md)] flex-1 rounded-full border border-[color:var(--lkv-border)] bg-[color:var(--lkv-field-bg)] px-[var(--space-4)] py-[var(--space-2)] text-[length:var(--lkv-text-footnote)] font-medium text-[color:var(--lkv-text-primary)] shadow-elevation-1 placeholder:text-[color:var(--lkv-text-muted)] focus:outline-none focus:ring-2 focus:ring-[color:var(--lkv-focus-ring)]"
      />
      <IconButton
        type="submit"
        variant="solid"
        size="md"
        disabled={!newComment.trim() || submitting}
        aria-label="Envoyer le commentaire"
        className="shrink-0 shadow-elevation-2"
      >
        {submitting ? (
          <span className="text-[length:var(--lkv-text-caption-2)] font-bold">...</span>
        ) : (
          <Icon name="PaperAirplaneIcon" size={16} aria-hidden="true" />
        )}
      </IconButton>
    </form>
  );

  return (
    <Sheet
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      title={title}
      hideTitle
      dragToDismiss
      footer={commentForm}
    >
      {/* Header */}
      <div className="flex items-center gap-[var(--space-2)] border-b border-[color:var(--lkv-border)] pb-[var(--space-3)]">
        <span className="text-base">💬</span>
        <h3 className="font-display text-[length:var(--lkv-text-subheadline)] font-bold tracking-wide text-[color:var(--lkv-text-primary)]">
          {title}
        </h3>
        <Badge tone="sage">{comments.length}</Badge>
      </div>

      {/* Comments List */}
      <div className="custom-scrollbar space-y-[var(--space-3)] py-[var(--space-3)] pr-[var(--space-1)]">
        {loading ? (
          <div className="space-y-[var(--space-2)] py-[var(--space-2)]">
            {[1, 2, 3].map((i) => (
              <Card key={i} variant="compact" className="flex gap-[var(--space-3)]">
                <Skeleton className="size-8 shrink-0 rounded-full" />
                <div className="flex-1 space-y-[var(--space-2)]">
                  <Skeleton className="h-3 w-24 rounded" />
                  <Skeleton className="h-3 w-full rounded" />
                </div>
              </Card>
            ))}
          </div>
        ) : comments.length === 0 ? (
          <EmptyState
            compact
            icon={<Icon name="ChatBubbleLeftIcon" size={28} aria-hidden="true" />}
            title="Aucun commentaire pour le moment"
            description="Soyez le premier à poser une question ou partager votre avis !"
          />
        ) : (
          threadedComments.rootComments.map((rootComment) => {
            const replies = threadedComments.repliesMap.get(rootComment.id) || [];
            const rootLikedState = localLikedMap[rootComment.id] ?? {
              liked: Boolean(rootComment.user_liked),
              count: rootComment.likes_count || 0,
            };

            return (
              <div key={rootComment.id} className="relative space-y-[var(--space-2)]">
                {/* Root Comment Card */}
                <Card variant="compact" className="relative z-10 flex items-start gap-[var(--space-3)]">
                  <a
                    href={rootComment.author_id ? `/profil/${rootComment.author_id}` : '#'}
                    className="mt-0.5 flex size-8 shrink-0 items-center justify-center overflow-hidden rounded-full border border-[color:var(--btn-glass-border)] bg-[color:var(--btn-tint)] backdrop-blur-[var(--btn-blur)] saturate-[var(--btn-saturate)] lkv-rim-btn text-[length:var(--lkv-text-footnote)] font-bold uppercase text-[color:var(--lkv-text-primary)] transition-opacity hover:opacity-80"
                  >
                    {rootComment.author_avatar ? (
                      <img src={rootComment.author_avatar} alt={rootComment.author_name} className="size-full object-cover" />
                    ) : (
                      rootComment.author_name?.charAt(0) || '👤'
                    )}
                  </a>
                  <div className="min-w-0 flex-1">
                    <div className="mb-[var(--space-1)] flex items-center justify-between gap-[var(--space-2)]">
                      <a
                        href={rootComment.author_id ? `/profil/${rootComment.author_id}` : '#'}
                        className="truncate text-[length:var(--lkv-text-footnote)] font-bold text-[color:var(--lkv-text-primary)] hover:underline"
                      >
                        {rootComment.author_name}
                      </a>
                      <span className="shrink-0 font-mono text-[length:var(--lkv-text-caption-2)] font-medium text-[color:var(--lkv-text-muted)]">
                        {formatCommentDate(rootComment.created_at)}
                      </span>
                    </div>

                    <p className="break-words font-sans text-[length:var(--lkv-text-footnote)] leading-relaxed text-[color:var(--lkv-text-secondary)]">
                      {rootComment.content}
                    </p>

                    {/* Actions : Répondre + Supprimer */}
                    <div className="mt-[var(--space-2)] flex items-center gap-[var(--space-2)] border-t border-[color:var(--lkv-border-subtle)] pt-[var(--space-1)]">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => startReply(rootComment.id, rootComment.author_name)}
                      >
                        ↩ Répondre
                      </Button>

                      {currentUserId && rootComment.author_id === currentUserId && onDeleteComment && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="ml-auto text-[color:var(--lkv-danger)] hover:bg-[color:var(--lkv-danger-bg)]"
                          onClick={() => {
                            triggerHaptic('warning');
                            onDeleteComment(rootComment.id);
                          }}
                        >
                          <Icon name="TrashIcon" size={14} aria-hidden="true" />
                          Supprimer
                        </Button>
                      )}
                    </div>
                  </div>

                  {/* Like button */}
                  <div className="flex shrink-0 flex-col items-center pt-0.5">
                    <IconButton
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => handleLikeToggle(rootComment)}
                      aria-label="Aimer le commentaire"
                    >
                      <Icon
                        name={rootLikedState.liked ? 'HeartIconSolid' : 'HeartIcon'}
                        size={16}
                        color={rootLikedState.liked ? 'var(--lkv-danger)' : 'var(--lkv-text-muted)'}
                        aria-hidden="true"
                      />
                    </IconButton>
                    <span className="font-mono text-[length:var(--lkv-text-caption-2)] font-bold leading-none text-[color:var(--lkv-text-muted)]">
                      {rootLikedState.count > 0 ? rootLikedState.count : ''}
                    </span>
                  </div>
                </Card>

                {/* Replies */}
                {replies.length > 0 && (
                  <div className="relative space-y-[var(--space-2)] pl-[var(--space-6)]">
                    {/* Vertical line */}
                    <div className="absolute bottom-4 left-[var(--space-3)] top-[-6px] w-0.5 rounded-full bg-[color:var(--lkv-border)]" />

                    {replies.map((reply) => {
                      const replyLikedState = localLikedMap[reply.id] ?? {
                        liked: Boolean(reply.user_liked),
                        count: reply.likes_count || 0,
                      };

                      return (
                        <Card
                          key={reply.id}
                          variant="compact"
                          className="relative z-10 flex items-start gap-[var(--space-2)]"
                        >
                          <a
                            href={reply.author_id ? `/profil/${reply.author_id}` : '#'}
                            className="mt-0.5 flex size-7 shrink-0 items-center justify-center overflow-hidden rounded-full border border-[color:var(--btn-glass-border)] bg-[color:var(--btn-tint)] backdrop-blur-[var(--btn-blur)] saturate-[var(--btn-saturate)] lkv-rim-btn text-[length:var(--lkv-text-caption-2)] font-bold uppercase text-[color:var(--lkv-text-primary)] transition-opacity hover:opacity-80"
                          >
                            {reply.author_avatar ? (
                              <img src={reply.author_avatar} alt={reply.author_name} className="size-full object-cover" />
                            ) : (
                              reply.author_name?.charAt(0) || '👤'
                            )}
                          </a>
                          <div className="min-w-0 flex-1">
                            <div className="mb-0.5 flex items-center justify-between gap-[var(--space-2)]">
                              <a
                                href={reply.author_id ? `/profil/${reply.author_id}` : '#'}
                                className="truncate text-[length:var(--lkv-text-footnote)] font-bold text-[color:var(--lkv-text-primary)] hover:underline"
                              >
                                {reply.author_name}
                              </a>
                              <span className="shrink-0 font-mono text-[length:var(--lkv-text-caption-2)] font-medium text-[color:var(--lkv-text-muted)]">
                                {formatCommentDate(reply.created_at)}
                              </span>
                            </div>

                            <p className="break-words font-sans text-[length:var(--lkv-text-footnote)] leading-relaxed text-[color:var(--lkv-text-secondary)]">
                              {reply.content}
                            </p>

                            {/* Actions for reply */}
                            <div className="mt-[var(--space-1)] flex items-center gap-[var(--space-1)] border-t border-[color:var(--lkv-border-subtle)] pt-[var(--space-1)]">
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => startReply(rootComment.id, reply.author_name)}
                              >
                                ↩ Répondre
                              </Button>

                              {currentUserId && reply.author_id === currentUserId && onDeleteComment && (
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  className="ml-auto text-[color:var(--lkv-danger)] hover:bg-[color:var(--lkv-danger-bg)]"
                                  onClick={() => {
                                    triggerHaptic('warning');
                                    onDeleteComment(reply.id);
                                  }}
                                >
                                  <Icon name="TrashIcon" size={13} aria-hidden="true" />
                                  Supprimer
                                </Button>
                              )}
                            </div>
                          </div>

                          {/* Like on reply */}
                          <div className="flex shrink-0 flex-col items-center pt-0.5">
                            <IconButton
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => handleLikeToggle(reply)}
                              aria-label="Aimer la réponse"
                            >
                              <Icon
                                name={replyLikedState.liked ? 'HeartIconSolid' : 'HeartIcon'}
                                size={14}
                                color={replyLikedState.liked ? 'var(--lkv-danger)' : 'var(--lkv-text-muted)'}
                                aria-hidden="true"
                              />
                            </IconButton>
                            <span className="font-mono text-[length:var(--lkv-text-caption-2)] font-bold leading-none text-[color:var(--lkv-text-muted)]">
                              {replyLikedState.count > 0 ? replyLikedState.count : ''}
                            </span>
                          </div>
                        </Card>
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
        <div className="mb-[var(--space-2)] flex shrink-0 items-center justify-between rounded-[var(--lkv-radius-md)] border border-[color:var(--glass-border)] bg-[color:var(--glass-bg-medium)] backdrop-blur-[var(--glass-blur-sm)] saturate-[var(--glass-sat)] lkv-rim-inset px-[var(--space-3)] py-[var(--space-1)] text-[length:var(--lkv-text-footnote)] text-[color:var(--lkv-text-primary)]">
          <span className="truncate">
            En réponse à <strong className="underline">@{replyTarget.authorName}</strong>
          </span>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => {
              setReplyTarget(null);
              setNewComment('');
            }}
          >
            ✕ Annuler
          </Button>
        </div>
      )}
    </Sheet>
  );
}
