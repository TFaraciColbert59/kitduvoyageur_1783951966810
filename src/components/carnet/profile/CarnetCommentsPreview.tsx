'use client';

import React, { useState } from 'react';
import Icon from '@/components/ui/Icon';
import type { CarnetComment } from '@/features/carnet/detail/useCarnetComments';

export interface CarnetCommentsPreviewProps {
  comments: CarnetComment[];
  loading: boolean;
  canWrite: boolean;
  total: number;
  onSend: (content: string) => Promise<boolean>;
  onOpenAll: () => void;
  onRequireAuth: () => void;
}

/** Aperçu : deux vrais commentaires, puis le composer 36 + envoi 34. */
export function CarnetCommentsPreview({
  comments,
  loading,
  canWrite,
  total,
  onSend,
  onOpenAll,
  onRequireAuth,
}: CarnetCommentsPreviewProps) {
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const visible = comments.slice(-2);

  const submit = async () => {
    if (!canWrite) {
      onRequireAuth();
      return;
    }
    setBusy(true);
    const ok = await onSend(draft);
    if (ok) setDraft('');
    setBusy(false);
  };

  return (
    <section id="ckp-commentaires" className="ckp-section" aria-labelledby="ckp-commentaires-title">
      <div className="ckp-section-head">
        <h2 className="ckp-h2" id="ckp-commentaires-title">
          Commentaires
          <small>
            {total} au total
          </small>
        </h2>
        <button type="button" className="ckp-link" onClick={onOpenAll}>
          Voir tout
        </button>
      </div>

      {loading ? (
        <p className="ckp-text" aria-busy="true">
          Chargement…
        </p>
      ) : visible.length === 0 ? (
        <p className="ckp-text">Aucun commentaire pour l’instant.</p>
      ) : (
        visible.map((comment) => (
          <div className="ckp-comment" key={comment.id}>
            {comment.authorAvatar ? (
              // eslint-disable-next-line @next/next/no-img-element -- avatar distant
              <img className="ckp-avatar" src={comment.authorAvatar} alt="" />
            ) : (
              <span className="ckp-avatar ckp-avatar--initial" aria-hidden="true">
                {comment.authorName.charAt(0).toUpperCase()}
              </span>
            )}
            <div className="ckp-comment-body">
              <span className="ckp-comment-name">{comment.authorName}</span>
              <span className="ckp-comment-time">
                {new Date(comment.createdAt).toLocaleDateString('fr-FR', {
                  day: 'numeric',
                  month: 'short',
                })}
              </span>
              <p className="ckp-comment-text">{comment.content}</p>
            </div>
          </div>
        ))
      )}

      <div className="ckp-composer">
        <input
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.shiftKey) {
              event.preventDefault();
              void submit();
            }
          }}
          placeholder={canWrite ? 'Ajouter un commentaire…' : 'Connectez-vous pour commenter'}
          aria-label="Ajouter un commentaire"
        />
        <button
          type="button"
          className="ckp-send"
          onClick={() => void submit()}
          disabled={busy || !draft.trim()}
          aria-label="Envoyer le commentaire"
        >
          <Icon name="send" size={16} aria-hidden="true" />
        </button>
      </div>
    </section>
  );
}

export default CarnetCommentsPreview;
