'use client';

import React, { useMemo, useRef, useState } from 'react';
import { PostReplyComposer } from '@/features/posts/ui/PostReplyComposer';
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

/** Même date relative que le fil et le post du Compte. */
function timeAgo(iso: string): string {
  const then = new Date(iso).getTime();
  if (!Number.isFinite(then)) return '';
  const diff = Math.max(0, Date.now() - then);
  const minutes = Math.round(diff / 60000);
  if (minutes < 1) return "à l'instant";
  if (minutes < 60) return `il y a ${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `il y a ${hours} h`;
  const days = Math.round(hours / 24);
  if (days < 7) return `il y a ${days} j`;
  return new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
}

/**
 * Commentaires du carnet, dans l'anatomie exacte du post du Compte :
 * `.lkdv-post-panel-body` (liste qui défile, padding `2px 12px 4px` du Compte),
 * lignes `.lkdv-comment*` (avatar 28, nom, date relative, texte, actions),
 * et le composer du Compte (`PostReplyComposer`) dans `.lkdv-post-panel-foot`.
 * Le tri Récents / Anciens reste, en haut de la liste : c'est une donnée propre
 * au carnet, il ne remplace aucun bloc du Compte.
 */
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
  const listRef = useRef<HTMLDivElement | null>(null);

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
    if (!draft.trim() || busy) return;
    setBusy(true);
    if (await onSend(draft)) {
      setDraft('');
      window.requestAnimationFrame(() =>
        listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' }),
      );
    }
    setBusy(false);
  };

  return (
    <>
      <div ref={listRef} className="lkdv-post-panel-body">
        {sorted.length > 1 ? (
          <CarnetSubCapsule items={SORTS} active={sort} onChange={setSort} ariaLabel="Tri des commentaires" />
        ) : null}
        {loading ? (
          <p className="py-6 text-center text-[12px] text-[#56665D]">Chargement…</p>
        ) : null}
        {!loading && sorted.length === 0 ? (
          <p className="py-6 text-center text-[12px] text-[#56665D]">Sois le premier à répondre.</p>
        ) : null}
        {sorted.map((comment) => (
          <div key={comment.id} id={`comment-${comment.id}`} className="lkdv-comment">
            {comment.authorAvatar ? (
              // eslint-disable-next-line @next/next/no-img-element -- avatar distant
              <img className="lkdv-comment-av" src={comment.authorAvatar} alt="" />
            ) : (
              <span className="lkdv-comment-av pmi-author-initial" aria-hidden="true">
                {comment.authorName.charAt(0).toUpperCase()}
              </span>
            )}
            <div className="lkdv-comment-body">
              <div className="lkdv-comment-head">
                <span className="lkdv-comment-name">{comment.authorName}</span>
                <span className="lkdv-comment-time">{timeAgo(comment.createdAt)}</span>
              </div>
              <p className="lkdv-comment-text">{comment.content}</p>
              {currentUserId && comment.authorId === currentUserId ? (
                <div className="lkdv-comment-actions">
                  <button type="button" onClick={() => void onRemove(comment.id)}>
                    Supprimer
                  </button>
                </div>
              ) : null}
            </div>
          </div>
        ))}
      </div>

      {canWrite ? (
        <div className="lkdv-post-panel-foot relative">
          <PostReplyComposer
            value={draft}
            onChange={setDraft}
            onSend={() => void submit()}
            placeholder="Ajouter un commentaire…"
            inputLabel="Ajouter un commentaire"
            ariaLabel="Publier le commentaire"
            busy={busy}
          />
        </div>
      ) : (
        <div className="lkdv-comments-gate">
          <p>Connectez-vous pour commenter.</p>
          <button type="button" onClick={onRequireAuth}>
            Se connecter
          </button>
        </div>
      )}
    </>
  );
}

export default CarnetCommentsPane;
