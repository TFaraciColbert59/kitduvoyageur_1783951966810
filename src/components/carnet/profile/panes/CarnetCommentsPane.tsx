'use client';

import React, { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import { PostReplyComposer } from '@/features/posts/ui/PostReplyComposer';
import { CarnetSubCapsule } from '../CarnetSubCapsule';
import type { CarnetComment } from '@/features/carnet/detail/useCarnetComments';
import { groupsOfThree } from '../groups';

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

/**
 * Longueur maximale d'un commentaire, côté saisie. Même valeur que la réponse
 * privée d'une story (`StoriesViewer`, `maxLength={500}`) : un seul plafond
 * pour tous les commentaires de la maison. La colonne `carnet_comments.content`
 * est un `text` sans contrainte : le composer est donc la seule borne, et le
 * serveur n'en ajoute aucune.
 */
export const CARNET_COMMENT_MAX_LENGTH = 500;

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

interface CarnetCommentRowProps {
  comment: CarnetComment;
  /** Le commentaire vient d'arriver : fondu + 6 px, une seule fois. */
  isNew: boolean;
  /** Le lecteur est l'auteur : la ligne porte « supprimer ». */
  mine: boolean;
  onRemove: (commentId: string) => Promise<boolean>;
}

/**
 * Ligne de commentaire : même gabarit, même DOM que la ligne d'origine.
 * Mémoïsée, avec un handler stable par ligne : ajouter ou supprimer un
 * commentaire ne redessine pas les autres lignes.
 */
const CarnetCommentRow = React.memo(function CarnetCommentRow({
  comment,
  isNew,
  mine,
  onRemove,
}: CarnetCommentRowProps) {
  const remove = useCallback(() => void onRemove(comment.id), [comment.id, onRemove]);

  /* Même DOM, mêmes classes que la ligne du fil (`PostCommentsPanel`) : avatar
     30, nom 13/600, date relative, texte 13,5/19,575, actions 11/600. Le handle
     reste dans la ligne de nom — la fiche ne perd aucune donnée. */
  return (
    <div id={`comment-${comment.id}`} className={`lkdv-comment${isNew ? ' is-new' : ''}`}>
      {comment.authorAvatar ? (
        // eslint-disable-next-line @next/next/no-img-element -- avatar distant
        <img className="lkdv-comment-av" src={comment.authorAvatar} alt="" aria-hidden="true" />
      ) : (
        <span className="lkdv-comment-av pmi-author-initial" aria-hidden="true">
          {comment.authorName.charAt(0).toUpperCase()}
        </span>
      )}
      <div className="lkdv-comment-body">
        <div className="lkdv-comment-head">
          <span className="lkdv-comment-name">
            {comment.authorName}
            {comment.authorHandle ? <span className="lkdv-comment-handle">@{comment.authorHandle}</span> : null}
          </span>
          <span className="lkdv-comment-time">
            <time dateTime={comment.createdAt}>{timeAgo(comment.createdAt)}</time>
          </span>
        </div>
        <p className="lkdv-comment-text">{comment.content}</p>
        {mine ? (
          <div className="lkdv-comment-actions">
            <button type="button" onClick={remove}>
              supprimer
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
});

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

  /* Le tri est différé : la bascule Récents / Anciens reste immédiate, seule la
     liste se réordonne quand le fil est libre. Rendu final identique. */
  const deferredSort = useDeferredValue(sort);

  const sorted = useMemo(() => {
    const list = [...comments].sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
    );
    return deferredSort === 'recent' ? list.reverse() : list;
  }, [comments, deferredSort]);
  /* Trois commentaires par groupe, 20 px d'air entre deux groupes : la même
     densité que les listes de la feuille. */
  const groups = useMemo(() => groupsOfThree(sorted), [sorted]);

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

  const submit = useCallback(async () => {
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
  }, [busy, canWrite, draft, onRequireAuth, onSend]);

  return (
    <>
      <div ref={listRef} className="lkdv-post-panel-body">
        {/* Le tri est une donnée du carnet : il garde sa capsule, en tête de
            liste, sur la largeur du fil. */}
        {comments.length > 1 ? (
          <div className="lkdv-comments-sort">
            <CarnetSubCapsule items={SORTS} active={sort} onChange={setSort} ariaLabel="Tri des commentaires" />
          </div>
        ) : null}

        {loading ? <p className="py-6 text-center text-[12px] text-[#56665D]">Chargement…</p> : null}
        {!loading && sorted.length === 0 ? (
          <p className="py-6 text-center text-[12px] text-[#56665D]">Sois le premier à répondre.</p>
        ) : null}

        {sorted.length > 0
          ? groups.map((group) => (
              <div key={group[0]?.id ?? 'groupe'}>
                {group.map((comment) => (
                  <CarnetCommentRow
                    key={comment.id}
                    comment={comment}
                    isNew={entering === comment.id}
                    mine={Boolean(currentUserId) && comment.authorId === currentUserId}
                    onRemove={onRemove}
                  />
                ))}
              </div>
            ))
          : null}
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
            maxLength={CARNET_COMMENT_MAX_LENGTH}
          />
        </div>
      ) : (
        <div className="lkdv-comments-gate">
          <p>Connectez-vous pour commenter.</p>
          <button type="button" onClick={onRequireAuth} aria-label="Se connecter pour commenter">
            Se connecter
          </button>
        </div>
      )}
    </>
  );
}

export default CarnetCommentsPane;
