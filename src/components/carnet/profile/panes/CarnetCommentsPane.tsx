'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { PostReplyComposer } from '@/features/posts/ui/PostReplyComposer';
import Icon from '@/components/ui/Icon';
import { CarnetSubCapsule } from '../CarnetSubCapsule';
import { CarnetEmpty, CarnetSkeleton } from '../CarnetStates';
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
  { id: 'recent', label: 'récents' },
  { id: 'old', label: 'anciens' },
];

/** Même date relative que le fil et le post du Compte. */
function timeAgo(iso: string): string {
  const then = new Date(iso).getTime();
  if (!Number.isFinite(then)) return '';
  const diff = Math.max(0, Date.now() - then);
  const minutes = Math.round(diff / 60000);
  if (minutes < 1) return 'à l’instant';
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} h`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days} j`;
  return new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
}

/**
 * Commentaires du carnet, dans le corps et le pied du post du Compte
 * (`.lkdv-post-panel-body`, `PostReplyComposer`). La ligne suit la fiche :
 * nom 12,5/600 + handle 11/500 sur la même ligne, texte 13/400 à 1,42,
 * métadonnées 11/500 `#6B7A70` sous le texte, jamais à droite du nom.
 *
 * Aucune phrase d'état : le chargement est un squelette (5 lignes de 48 px),
 * l'absence de commentaire un glyphe de 32 px à 30 % et un tiret. Le tri
 * Récents / Anciens reste, en tête de liste : c'est une donnée du carnet.
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
  const [entering, setEntering] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);
  const known = useRef<Set<string> | null>(null);

  const sorted = useMemo(() => {
    const list = [...comments].sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
    );
    return sort === 'recent' ? list.reverse() : list;
  }, [comments, sort]);

  /* Un commentaire qui arrive entre en fondu + 6 px, sans déplacer la liste.
     Le premier rendu n'anime rien : la liste existante reste immobile. */
  useEffect(() => {
    if (known.current === null) {
      known.current = new Set(comments.map((comment) => comment.id));
      return;
    }
    const fresh = comments.find((comment) => !known.current?.has(comment.id));
    comments.forEach((comment) => known.current?.add(comment.id));
    if (!fresh) return;
    setEntering(fresh.id);
    const timer = window.setTimeout(() => setEntering(null), 220);
    return () => window.clearTimeout(timer);
  }, [comments]);

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
      <div ref={listRef} className="lkdv-post-panel-body ckp-comments">
        {comments.length > 1 ? (
          <div className="ckp-comments-sort">
            <CarnetSubCapsule items={SORTS} active={sort} onChange={setSort} ariaLabel="Tri des commentaires" />
          </div>
        ) : null}

        {loading && sorted.length === 0 ? <CarnetSkeleton rows={5} hero={false} /> : null}

        {!loading && sorted.length === 0 ? (
          <CarnetEmpty
            icon={<Icon name="message-square" size={32} aria-hidden="true" />}
            label="Aucun commentaire"
          />
        ) : null}

        {sorted.length > 0 ? (
          <div className="ckp-comments-list" data-state={loading ? 'partial' : 'ready'}>
            {sorted.map((comment) => (
              <div
                key={comment.id}
                id={`comment-${comment.id}`}
                className={`ckp-comment${entering === comment.id ? ' is-new' : ''}`}
              >
                {comment.authorAvatar ? (
                  // eslint-disable-next-line @next/next/no-img-element -- avatar distant
                  <img className="ckp-avatar" src={comment.authorAvatar} alt="" />
                ) : (
                  <span className="ckp-avatar ckp-avatar--initial" aria-hidden="true">
                    {comment.authorName.charAt(0).toUpperCase()}
                  </span>
                )}
                <div className="ckp-comment-body">
                  <div className="ckp-comment-head">
                    <span className="ckp-comment-name">{comment.authorName}</span>
                    {comment.authorHandle ? (
                      <span className="ckp-comment-handle">@{comment.authorHandle}</span>
                    ) : null}
                  </div>
                  <p className="ckp-comment-text">{comment.content}</p>
                  <div className="ckp-comment-meta">
                    <time dateTime={comment.createdAt}>{timeAgo(comment.createdAt)}</time>
                    {currentUserId && comment.authorId === currentUserId ? (
                      <button type="button" onClick={() => void onRemove(comment.id)}>
                        supprimer
                      </button>
                    ) : null}
                  </div>
                </div>
              </div>
            ))}
            {/* Chargement partiel : les lignes connues restent, le reste attend. */}
            {loading ? <CarnetSkeleton rows={2} hero={false} /> : null}
          </div>
        ) : null}
      </div>

      {canWrite ? (
        <div className="lkdv-post-panel-foot relative">
          <PostReplyComposer
            value={draft}
            onChange={setDraft}
            onSend={() => void submit()}
            placeholder="ajouter un commentaire…"
            inputLabel="Ajouter un commentaire"
            ariaLabel="Publier le commentaire"
            busy={busy}
          />
        </div>
      ) : (
        <div className="lkdv-comments-gate ckp-comments-gate">
          <button type="button" className="ckp-field" onClick={onRequireAuth} aria-label="Se connecter pour commenter">
            <span className="ckp-field-icon" aria-hidden="true">
              <Icon name="user" size={16} aria-hidden="true" />
            </span>
            <span className="ckp-field-label">se connecter</span>
          </button>
        </div>
      )}
    </>
  );
}

export default CarnetCommentsPane;
