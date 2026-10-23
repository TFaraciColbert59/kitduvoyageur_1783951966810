'use client';

import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import Icon from '@/components/ui/Icon';
import { usePostComments, type FeedComment } from './usePostComments';
import { MentionPicker } from './MentionPicker';
import { encodeMention, renderMentions } from './mention-utils';
import { timeAgo } from './feed-utils';
import type { FeedPost } from './useCommunityFeed';
import type { CommunityAuthReason } from './usePostInteractions';

export interface PostCommentsPanelProps {
  post: FeedPost;
  user: any;
  onClose: () => void;
  onRequireAuth?: (reason: CommunityAuthReason) => void;
  focusCommentId?: string | null;
}

function Avatar({ url, name }: { url?: string | null; name?: string | null }) {
  if (url) {
    // eslint-disable-next-line @next/next/no-img-element -- avatar distant
    return <img className="lkdv-comment-av" src={url} alt="" />;
  }
  return (
    <span className="lkdv-comment-av pmi-author-initial" aria-hidden="true">
      {(name || 'V').charAt(0).toUpperCase()}
    </span>
  );
}

export function PostCommentsPanel({ post, user, onClose, onRequireAuth, focusCommentId = null }: PostCommentsPanelProps) {
  const { comments, loading, error, send, edit, remove, report, toggleLike, loadMore } = usePostComments(
    post.id,
    user,
    onRequireAuth,
  );
  const [draft, setDraft] = useState('');
  const [replyTo, setReplyTo] = useState<{ id: string; name: string } | null>(null);
  const [editing, setEditing] = useState<{ id: string; text: string } | null>(null);
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);
  const canWrite = Boolean(user?.id) && !user?.is_anonymous;

  useEffect(() => {
    if (!focusCommentId || loading) return;
    const timer = window.setTimeout(() => {
      document.getElementById(`comment-${focusCommentId}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 200);
    return () => window.clearTimeout(timer);
  }, [comments, focusCommentId, loading]);

  const syncMention = (value: string, caret: number | null) => {
    const before = value.slice(0, caret ?? value.length);
    const match = before.match(/@([^\s@]*)$/);
    setMentionQuery(match ? match[1] : null);
  };

  const insertMention = (profile: { id: string; full_name: string | null; handle: string | null }) => {
    const token = encodeMention({ id: profile.id, name: profile.full_name || profile.handle || 'Voyageur' });
    const caret = inputRef.current?.selectionStart ?? draft.length;
    const before = draft.slice(0, caret);
    const after = draft.slice(caret);
    const next = before.replace(/@([^\s@]*)$/, `${token} `) + after;
    setDraft(next);
    setMentionQuery(null);
    window.requestAnimationFrame(() => inputRef.current?.focus());
  };

  const submit = async () => {
    if (!draft.trim() || busy || !canWrite) {
      if (!canWrite) onRequireAuth?.('comment');
      return;
    }
    setBusy(true);
    const ok = await send(draft, replyTo?.id ?? null);
    if (ok) {
      setDraft('');
      setReplyTo(null);
      window.requestAnimationFrame(() => listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' }));
    }
    setBusy(false);
  };

  const renderComment = (comment: FeedComment) => (
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
              className="min-h-8 flex-1 rounded-full border border-[rgba(23,43,36,.2)] px-3 text-[12px]"
              aria-label="Modifier le commentaire"
            />
            <button type="button" className="text-[10px] font-bold text-[#17402C]" onClick={() => { void edit(comment.id, editing.text); setEditing(null); }}>
              OK
            </button>
            <button type="button" className="text-[10px] text-[#56665D]" onClick={() => setEditing(null)}>Annuler</button>
          </div>
        ) : (
          <p className="lkdv-comment-text">{renderMentions(comment.content)}</p>
        )}
        <div className="lkdv-comment-actions">
          {canWrite ? (
            <>
              <button
                type="button"
                className={comment.userLiked ? 'liked' : ''}
                onClick={() => void toggleLike(comment.id)}
                aria-label="J'aime ce commentaire"
                aria-pressed={comment.userLiked}
              >
                ♥ {comment.likes > 0 ? comment.likes : ''}
              </button>
              <button type="button" onClick={() => { setReplyTo({ id: comment.id, name: comment.author?.full_name || 'Voyageur' }); inputRef.current?.focus(); }}>
                Répondre
              </button>
              {comment.isOwner ? (
                <>
                  <button type="button" onClick={() => setEditing({ id: comment.id, text: comment.content })}>Modifier</button>
                  <button type="button" onClick={() => void remove(comment.id)}>Supprimer</button>
                </>
              ) : (
                <button type="button" onClick={() => void report(comment.id, 'Signalement commentaire')}>Signaler</button>
              )}
            </>
          ) : (
            <span className="text-[10px] text-[#56665D]">{comment.likes > 0 ? `♥ ${comment.likes}` : ''}</span>
          )}
        </div>
        {comment.replies.length > 0 ? (
          <div className="lkdv-comment-replies">{comment.replies.map((reply) => renderComment(reply))}</div>
        ) : null}
      </div>
    </div>
  );

  return (
    <div className="lkdv-post-panel" role="dialog" aria-modal="true" aria-label="Commentaires de la publication">
      <div className="lkdv-post-panel-head">
        <b className="inline-flex items-center gap-1">
          <Icon name="message-circle" size={15} aria-hidden="true" /> Commentaires
        </b>
        <button type="button" aria-label="Fermer les commentaires" onClick={onClose}>
          <Icon name="x" size={15} aria-hidden="true" />
        </button>
      </div>

      <div ref={listRef} className="lkdv-post-panel-body">
        {post.content ? <p className="mb-3 border-b border-[rgba(23,43,36,.08)] pb-2 text-[11px] leading-[1.4] text-[#56665D]">{post.content}</p> : null}
        {loading ? <p className="py-6 text-center text-[12px] text-[#56665D]">Chargement…</p> : null}
        {error ? <p className="py-6 text-center text-[12px] text-[#7A241C]" role="alert">{error}</p> : null}
        {!loading && !error && comments.length === 0 ? <p className="py-6 text-center text-[12px] text-[#56665D]">Sois le premier à répondre.</p> : null}
        {comments.map((comment) => renderComment(comment))}
        {comments.length >= 30 ? (
          <button type="button" className="text-[11px] font-semibold text-[#17402C]" onClick={loadMore}>Voir plus</button>
        ) : null}
      </div>

      {replyTo ? (
        <div className="lkdv-comments-replying mx-2 mb-1">
          <span>En réponse à {replyTo.name}</span>
          <button type="button" onClick={() => setReplyTo(null)}>Annuler</button>
        </div>
      ) : null}

      {canWrite ? (
        <div className="lkdv-post-panel-foot relative">
          {mentionQuery !== null ? (
            <MentionPicker
              query={mentionQuery}
              className="absolute bottom-full left-0 z-[80] mb-1"
              onSelect={insertMention}
              onClose={() => setMentionQuery(null)}
            />
          ) : null}
          <div className="lkdv-comments-composer">
            <input
              ref={inputRef}
              value={draft}
              onChange={(event) => {
                setDraft(event.target.value);
                syncMention(event.target.value, event.target.selectionStart);
              }}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && !event.shiftKey) {
                  event.preventDefault();
                  void submit();
                }
              }}
              placeholder={replyTo ? `Répondre à ${replyTo.name}…` : 'Ajouter un commentaire…'}
              aria-label="Ajouter un commentaire"
            />
            <button type="button" className="lkdv-comments-send" disabled={!draft.trim() || busy} onClick={() => void submit()} aria-label="Publier le commentaire">
              <Icon name="send" size={15} aria-hidden="true" />
            </button>
          </div>
        </div>
      ) : (
        <div className="lkdv-comments-gate">
          <p>{user?.id ? 'Créez un compte pour commenter.' : 'Connectez-vous pour commenter.'}</p>
          <Link href={user?.id ? '/inscription?next=/communaute' : '/connexion?next=/communaute'}>
            {user?.id ? 'Créer un compte' : 'Se connecter'}
          </Link>
        </div>
      )}
    </div>
  );
}

export default PostCommentsPanel;
