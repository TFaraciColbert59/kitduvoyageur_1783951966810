'use client';

import React, { useState } from 'react';
import { Heart, Send, Trash2 } from 'lucide-react';
import type { OutingComment, OutingKudos } from '@/features/compte/server/sorties';
import { initials, relativeTime } from './shared';

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
          <Heart size={18} aria-hidden="true" fill={kudos.mine ? 'currentColor' : 'none'} />
          <span>{kudos.count > 0 ? kudos.count : ''}</span>
        </button>
        <div>
          <b>{kudos.count === 0 ? 'Aucun kudos' : `${kudos.count} kudos`}</b>
          <small>
            {kudos.users.length > 0
              ? kudos.users.map((user) => user.name).slice(0, 4).join(', ')
              : 'Sois le premier à saluer cette sortie.'}
          </small>
        </div>
      </section>

      <div className="lkdv-sortie-comments-head">
        <b>{comments.length > 0 ? `${comments.length} commentaire${comments.length > 1 ? 's' : ''}` : 'Commentaires'}</b>
        <span>Le fil de cette sortie.</span>
      </div>

      {comments.length === 0 ? (
        <p className="lkdv-sortie-empty-line">Sois le premier à réagir à cette sortie.</p>
      ) : (
        <ul className="lkdv-sortie-comments">
          {comments.map((comment) => (
            <li key={comment.id}>
              <span className="lkdv-sortie-avatar small" aria-hidden="true">
                {comment.author.avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={comment.author.avatarUrl} alt="" loading="lazy" />
                ) : (
                  initials(comment.author.name)
                )}
              </span>
              <div>
                <div className="lkdv-sortie-comment-head">
                  <b>{comment.author.name}</b>
                  <small>@{comment.author.handle}</small>
                  <span>{relativeTime(comment.createdAt)}</span>
                </div>
                <p>{comment.body}</p>
              </div>
              {comment.mine ? (
                <button
                  type="button"
                  className="lkdv-sortie-comment-delete"
                  onClick={() => onDelete(comment.id)}
                  disabled={busy}
                  aria-label="Supprimer mon commentaire"
                >
                  <Trash2 size={13} aria-hidden="true" />
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      )}

      <form
        className="lkdv-sortie-composer"
        onSubmit={(event) => {
          event.preventDefault();
          const value = body.trim();
          if (!value) return;
          onComment(value);
          setBody('');
        }}
      >
        <textarea
          value={body}
          onChange={(event) => setBody(event.target.value)}
          rows={2}
          maxLength={1000}
          placeholder="Écrire un commentaire…"
          aria-label="Ton commentaire"
        />
        <button type="submit" className="lkdv-sortie-send" disabled={busy || !body.trim()} aria-label="Envoyer le commentaire">
          <Send size={16} aria-hidden="true" />
        </button>
      </form>
    </div>
  );
}

export default OutingComments;
