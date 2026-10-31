'use client';

import React, { useState } from 'react';
import { CommentItem, LikeIcon } from '@/components/social-kit';
import { PostReplyComposer } from '@/features/posts/ui/PostReplyComposer';
import type { OutingComment, OutingKudos } from '@/features/compte/server/sorties';
import { relativeTime } from './shared';

export interface OutingCommentsProps {
  kudos: OutingKudos;
  comments: OutingComment[];
  busy: boolean;
  onKudos: () => void;
  onComment: (body: string) => void;
  onDelete: (commentId: string) => void;
}

export function OutingComments({ kudos, comments, busy, onKudos, onComment, onDelete }: OutingCommentsProps) {
  const [body, setBody] = useState('');

  return (
    <div className="lkdv-sortie-pane">
      <section className={`lkdv-sortie-kudos ${kudos.mine ? 'mine' : ''}`}>
        <button type="button" className="lkdv-sortie-kudos-btn" onClick={onKudos} disabled={busy} aria-pressed={kudos.mine}>
          <LikeIcon active={kudos.mine} size={18} />
          <span>{kudos.count > 0 ? kudos.count : ''}</span>
        </button>
        <div>
          <b>{kudos.count === 0 ? 'Aucun kudos' : `${kudos.count} kudos`}</b>
          <small>
            {kudos.users.length > 0
              ? kudos.users.map((user) => user.name).slice(0, 4).join(', ')
              : null}
          </small>
        </div>
      </section>

      <div className="lkdv-sortie-comments-head">
        <b>{comments.length > 0 ? `${comments.length} commentaire${comments.length > 1 ? 's' : ''}` : 'Commentaires'}</b>
      </div>

      {comments.length === 0 ? null : (
        <div className="lkdv-comments-list">
          {comments.map((comment) => (
            <CommentItem
              key={comment.id}
              canInteract
              comment={{
                id: comment.id,
                authorName: comment.author.name,
                authorHandle: comment.author.handle,
                authorAvatarUrl: comment.author.avatarUrl,
                content: comment.body,
                timeLabel: relativeTime(comment.createdAt),
                likes: 0,
                liked: false,
                isOwner: comment.mine,
              }}
              onDelete={busy ? undefined : () => onDelete(comment.id)}
            />
          ))}
        </div>
      )}

      <PostReplyComposer
        value={body}
        onChange={setBody}
        onSend={() => {
          const value = body.trim();
          if (!value) return;
          onComment(value);
          setBody('');
        }}
        placeholder="Écrire un commentaire…"
        inputLabel="Ton commentaire"
        ariaLabel="Envoyer le commentaire"
        busy={busy}
        maxLength={1000}
      />
    </div>
  );
}

export default OutingComments;
