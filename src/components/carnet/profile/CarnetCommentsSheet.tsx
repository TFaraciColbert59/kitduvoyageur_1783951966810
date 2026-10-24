'use client';

import React, { useState } from 'react';
import Icon from '@/components/ui/Icon';
import { OverlaySheet } from '@/components/compte/overlay/OverlaySheet';
import type { CarnetComment } from '@/features/carnet/detail/useCarnetComments';
import { useSheetEscape } from './useSheetEscape';

export interface CarnetCommentsSheetProps {
  open: boolean;
  comments: CarnetComment[];
  loading: boolean;
  canWrite: boolean;
  currentUserId: string | null;
  onSend: (content: string) => Promise<boolean>;
  onRemove: (commentId: string) => Promise<boolean>;
  onClose: () => void;
  onRequireAuth: () => void;
}

/** Feuille 92 dvh du Compte : liste à plat, suppression de son commentaire. */
export function CarnetCommentsSheet({
  open,
  comments,
  loading,
  canWrite,
  currentUserId,
  onSend,
  onRemove,
  onClose,
  onRequireAuth,
}: CarnetCommentsSheetProps) {
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  useSheetEscape(open, onClose);
  if (!open) return null;

  const submit = async () => {
    if (!canWrite) {
      onRequireAuth();
      return;
    }
    setBusy(true);
    if (await onSend(draft)) setDraft('');
    setBusy(false);
  };

  return (
    <OverlaySheet
      title="Commentaires"
      subtitle={`${comments.length} commentaire${comments.length > 1 ? 's' : ''}`}
      onClose={onClose}
      footer={
        <div className="ckp-composer" style={{ marginTop: 0 }}>
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
      }
    >
      {loading ? (
        <p className="ckp-text" aria-busy="true">
          Chargement…
        </p>
      ) : comments.length === 0 ? (
        <div className="lkdv-overlay-empty">
          <b>Aucun commentaire</b>
          <p>Soyez la première personne à réagir à ce carnet.</p>
        </div>
      ) : (
        comments.map((comment) => (
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
            {currentUserId && comment.authorId === currentUserId ? (
              <button
                type="button"
                className="ckp-link"
                onClick={() => void onRemove(comment.id)}
                aria-label="Supprimer mon commentaire"
              >
                <Icon name="trash2" size={15} aria-hidden="true" />
              </button>
            ) : null}
          </div>
        ))
      )}
    </OverlaySheet>
  );
}

export default CarnetCommentsSheet;
