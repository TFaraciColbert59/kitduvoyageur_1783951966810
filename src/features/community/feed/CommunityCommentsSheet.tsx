'use client';

import React, { useEffect, useRef, useState } from 'react';
import Icon from '@/components/ui/Icon';
import { Sheet } from '@/components/ui';
import { usePostComments, type FeedComment } from './usePostComments';
import { authorName, timeAgo } from './feed-utils';
import type { FeedPost } from './useCommunityFeed';

export interface CommunityCommentsSheetProps {
  post: FeedPost | null;
  user: any;
  open: boolean;
  onClose: () => void;
  focusCommentId?: string | null;
}

function Avatar({ url, name, size = 30 }: { url?: string | null; name?: string | null; size?: number }) {
  if (url) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- avatars distants
      <img className="lkdv-comment-av" src={url} alt="" style={{ width: size, height: size }} />
    );
  }
  return (
    <span
      className="lkdv-comment-av pmi-author-initial"
      aria-hidden="true"
      style={{ width: size, height: size }}
    >
      {(name || 'V').charAt(0).toUpperCase()}
    </span>
  );
}

export function CommunityCommentsSheet({
  post,
  user,
  open,
  onClose,
  focusCommentId = null,
}: CommunityCommentsSheetProps) {
  const { comments, loading, error, send, edit, remove, report, toggleLike, loadMore } =
    usePostComments(post?.id ?? '', user);
  const [draft, setDraft] = useState('');
  const [replyTo, setReplyTo] = useState<{ id: string; name: string } | null>(null);
  const [editing, setEditing] = useState<{ id: string; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!focusCommentId || loading) return;
    const timer = window.setTimeout(() => {
      document.getElementById(`comment-${focusCommentId}`)?.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      });
    }, 200);
    return () => window.clearTimeout(timer);
  }, [focusCommentId, loading, comments]);

  const submit = async () => {
    if (!draft.trim() || busy) return;
    setBusy(true);
    const ok = await send(draft, replyTo?.id ?? null);
    if (ok) {
      setDraft('');
      setReplyTo(null);
      window.requestAnimationFrame(() => {
        listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' });
      });
    }
    setBusy(false);
  };

  const renderComment = (comment: FeedComment, depth = 0) => (
    <div key={comment.id} id={`comment-${comment.id}`} className="lkdv-comment">
      <Avatar url={comment.author?.avatar_url} name={comment.author?.full_name} />
      <div className="lkdv-comment-body">
        <div className="lkdv-comment-head">
          <span className="lkdv-comment-name">{comment.author?.full_name || 'Voyageur'}</span>
          <span className="lkdv-comment-time">{timeAgo(comment.created_at)}</span>
        </div>

        {editing?.id === comment.id ? (
          <div className="mt-1 flex items-center gap-2">
            <input
              value={editing.text}
              onChange={(event) => setEditing({ id: comment.id, text: event.target.value })}
              className="min-h-9 flex-1 rounded-full border border-[rgba(23,43,36,.2)] px-3 text-[13px]"
              aria-label="Modifier le commentaire"
            />
            <button
              type="button"
              className="text-[11px] font-bold text-[#17402C]"
              onClick={() => {
                void edit(comment.id, editing.text);
                setEditing(null);
              }}
            >
              Enregistrer
            </button>
            <button type="button" className="text-[11px] text-[#56665D]" onClick={() => setEditing(null)}>
              Annuler
            </button>
          </div>
        ) : (
          <p className="lkdv-comment-text">{comment.content}</p>
        )}

        <div className="lkdv-comment-actions">
          <button
            type="button"
            className={comment.userLiked ? 'liked' : ''}
            onClick={() => void toggleLike(comment.id)}
            aria-label="J'aime ce commentaire"
            aria-pressed={comment.userLiked}
          >
            ♥ {comment.likes > 0 ? comment.likes : ''}
          </button>
          <button
            type="button"
            onClick={() => setReplyTo({ id: comment.id, name: comment.author?.full_name || 'Voyageur' })}
          >
            Répondre
          </button>
          {comment.isOwner ? (
            <>
              <button type="button" onClick={() => setEditing({ id: comment.id, text: comment.content })}>
                Modifier
              </button>
              <button type="button" onClick={() => void remove(comment.id)}>
                Supprimer
              </button>
            </>
          ) : (
            <button type="button" onClick={() => void report(comment.id, 'Signalement commentaire')}>
              Signaler
            </button>
          )}
        </div>

        {comment.replies.length > 0 ? (
          <div className="lkdv-comment-replies">
            {comment.replies.map((reply) => renderComment(reply, depth + 1))}
          </div>
        ) : null}
      </div>
    </div>
  );

  return (
    <Sheet
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
      hideTitle
      title="Commentaires"
      detent="large"
      dragToDismiss
      panelClassName="lkdv-feed-sheet"
      contentClassName="lkdv-feed-sheet-content"
    >
      <div className="lkdv-comments-sheet">
        {post ? (
          <div className="lkdv-comments-excerpt">
            <Avatar url={post.author?.avatar_url} name={post.author?.full_name} />
            <div className="min-w-0">
              <div className="lkdv-comment-head">
                <span className="lkdv-comment-name">{authorName(post)}</span>
                <span className="lkdv-comment-time">{timeAgo(post.created_at)}</span>
              </div>
              <p>{post.content || 'Publication'}</p>
            </div>
          </div>
        ) : null}

        <div className="lkdv-comments-list" ref={listRef}>
          {loading ? <p className="py-6 text-center text-[12px] text-[#56665D]">Chargement…</p> : null}
          {error ? (
            <p className="py-6 text-center text-[12px] text-[#7A241C]" role="alert">{error}</p>
          ) : null}
          {!loading && !error && comments.length === 0 ? (
            <p className="py-6 text-center text-[12px] text-[#56665D]">
              Sois le premier à répondre.
            </p>
          ) : null}
          {comments.map((comment) => renderComment(comment))}
          {comments.length >= 30 ? (
            <button type="button" className="text-[11px] font-semibold text-[#17402C]" onClick={loadMore}>
              Voir plus de commentaires
            </button>
          ) : null}
        </div>

        {replyTo ? (
          <div className="lkdv-comments-replying">
            <span>En réponse à @{replyTo.name}</span>
            <button type="button" onClick={() => setReplyTo(null)}>Annuler</button>
          </div>
        ) : null}

        <div className="lkdv-comments-composer">
          <input
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault();
                void submit();
              }
            }}
            placeholder={replyTo ? `Répondre à ${replyTo.name}…` : 'Ajouter un commentaire…'}
            aria-label="Ajouter un commentaire"
          />
          <button
            type="button"
            className="lkdv-comments-send"
            onClick={() => void submit()}
            disabled={!draft.trim() || busy}
            aria-label="Publier le commentaire"
          >
            <Icon name="send" size={16} aria-hidden="true" />
          </button>
        </div>
      </div>
    </Sheet>
  );
}

export default CommunityCommentsSheet;
