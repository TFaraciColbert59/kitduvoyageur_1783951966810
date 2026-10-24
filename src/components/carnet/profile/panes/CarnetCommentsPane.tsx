'use client';

import React, { useMemo, useState } from 'react';
import Icon from '@/components/ui/Icon';
import { CarnetSubCapsule } from '../CarnetSubCapsule';
import type { CarnetComment } from '@/features/carnet/detail/useCarnetComments';

export interface CarnetCommentsPaneProps {
  comments: CarnetComment[];
  loading: boolean;
  canWrite: boolean;
  currentUserId: string | null;
  onSend: (content: string) => Promise<boolean>;
  onRemove: (commentId: string) => Promise<boolean>;
  onRequireAuth: () => void;
}

const SORTS = [
  { id: 'recent', label: 'Récents' },
  { id: 'old', label: 'Anciens' },
];

export function CarnetCommentsPane({
  comments,
  loading,
  canWrite,
  currentUserId,
  onSend,
  onRemove,
  onRequireAuth,
}: CarnetCommentsPaneProps) {
  const [sort, setSort] = useState('recent');
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);

  const sorted = useMemo(() => {
    const list = [...comments].sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
    );
    return sort === 'recent' ? list.reverse() : list;
  }, [comments, sort]);

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
    <div className="ckp-pane">
      {loading ? (
        <p className="ckp-pane-empty">Chargement…</p>
      ) : sorted.length === 0 ? (
        <div className="ckp-pane-empty">
          <b>Sois le premier à répondre.</b>
          <p>Aucun commentaire pour l’instant.</p>
        </div>
      ) : (
        <div className="ckp-pane-list">
          {sorted.map((comment) => (
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
          ))}
        </div>
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

      {sorted.length > 0 ? (
        <CarnetSubCapsule
          items={SORTS}
          active={sort}
          onChange={setSort}
          ariaLabel="Tri des commentaires"
        />
      ) : null}
    </div>
  );
}

export default CarnetCommentsPane;
