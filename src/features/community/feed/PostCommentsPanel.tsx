'use client';

import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useToast } from '@/contexts/ToastContext';
import { CommentItem, type SocialComment } from '@/components/social-kit';
import { PostReplyComposer } from '@/features/posts/ui/PostReplyComposer';
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

export function PostCommentsPanel({ post, user, onClose, onRequireAuth, focusCommentId = null }: PostCommentsPanelProps) {
  const { toast } = useToast();
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

  const reportComment = async (commentId: string) => {
    const ok = await report(commentId, 'Signalement commentaire');
    toast(ok ? 'Commentaire signalé.' : 'Signalement impossible.', ok ? 'success' : 'error');
  };

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

  const toSocial = (comment: FeedComment): SocialComment => ({
    id: comment.id,
    authorName: comment.author?.full_name || 'Voyageur',
    authorAvatarUrl: comment.author?.avatar_url,
    content: renderMentions(comment.content),
    timeLabel: timeAgo(comment.created_at),
    likes: comment.likes,
    liked: Boolean(comment.userLiked),
    isOwner: Boolean(comment.isOwner),
    replies: comment.replies.map(toSocial),
  });

  const renderComment = (comment: FeedComment) => {
    const findRaw = (list: FeedComment[], id: string): FeedComment | undefined =>
      list.reduce<FeedComment | undefined>((found, c) => found ?? (c.id === id ? c : findRaw(c.replies, id)), undefined);
    const raw = (id: string) => findRaw(comments, id);
    return (
      <CommentItem
        key={comment.id}
        comment={toSocial(comment)}
        canInteract={canWrite}
        onLike={(c) => void toggleLike(c.id)}
        onReply={(c) => { setReplyTo({ id: c.id, name: c.authorName }); inputRef.current?.focus(); }}
        onEdit={(c) => setEditing({ id: c.id, text: raw(c.id)?.content ?? '' })}
        onDelete={(c) => void remove(c.id)}
        onReport={(c) => void reportComment(c.id)}
        editor={editing?.id === comment.id ? (
          <div className="mt-1 flex items-center gap-2">
            <input
              value={editing.text}
              onChange={(event) => setEditing({ id: comment.id, text: event.target.value })}
              className="lkdv-comment-edit-input"
              aria-label="Modifier le commentaire"
            />
            <button type="button" className="lkdv-comment-edit-action is-primary" onClick={() => { void edit(comment.id, editing.text); setEditing(null); }}>OK</button>
            <button type="button" className="lkdv-comment-edit-action" onClick={() => setEditing(null)}>Annuler</button>
          </div>
        ) : undefined}
      />
    );
  };

  return (
    <div className="lkdv-post-panel" role="dialog" aria-modal="true" aria-label="Commentaires de la publication">
      <div className="lkdv-panel-grab" aria-hidden="true"><span /></div>

      <div ref={listRef} className="lkdv-post-panel-body">
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
          <PostReplyComposer
            value={draft}
            onChange={(value) => {
              setDraft(value);
              syncMention(value, value.length);
            }}
            onSend={() => void submit()}
            placeholder={replyTo ? `Répondre à ${replyTo.name}…` : 'Ajouter un commentaire…'}
            inputLabel="Ajouter un commentaire"
            ariaLabel="Publier le commentaire"
            busy={busy}
          />
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
