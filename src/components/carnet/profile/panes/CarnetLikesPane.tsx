'use client';

import React, { useMemo, useState } from 'react';
import Icon from '@/components/ui/Icon';
import type { CarnetDetail } from '@/features/carnet/detail/types';

export interface CarnetLikesPaneProps {
  detail: CarnetDetail;
  currentUserId: string | null;
  /**
   * Bascule J’aime du carnet. Le ♥ du sélecteur ouvre désormais cette page :
   * la bascule réelle vit ici, en tête de liste, pour ne pas perdre le geste.
   */
  like?: {
    liked: boolean;
    count: number;
    onToggle: () => void;
  };
}

const REACTION_LABEL: Record<string, string> = {
  like: 'J’aime',
  bravo: 'Bravo',
  useful: 'Utile',
};

const REACTION_ORDER = ['like', 'bravo', 'useful'];

/**
 * Trois pastilles de tri par réaction, contour 1 px, 28 px de haut.
 * Aucune n'est active par défaut : la liste montre alors toutes les réactions
 * réelles. Un second appui sur la pastille active la relâche.
 */
function reactionFilters(detail: CarnetDetail) {
  const present = new Set(detail.likers.map((liker) => liker.reaction));
  return REACTION_ORDER.filter((reaction) => present.has(reaction)).map((reaction) => ({
    id: reaction,
    label: REACTION_LABEL[reaction] ?? reaction,
  }));
}

/** Réactions réelles du carnet, profils joints (plafond 50). */
export function CarnetLikesPane({ detail, currentUserId, like }: CarnetLikesPaneProps) {
  const [filter, setFilter] = useState<string | null>(null);
  const filters = useMemo(() => reactionFilters(detail), [detail]);
  const likers = filter ? detail.likers.filter((liker) => liker.reaction === filter) : detail.likers;

  return (
    <div className="ckp-pane ckp-likes">
      <p className="ckp-likes-count">
        {detail.likers.length.toLocaleString('fr-FR')}{' '}
        {detail.likers.length > 1 ? 'réactions' : 'réaction'}
      </p>

      {filters.length > 0 ? (
        <div className="ckp-like-filters" role="group" aria-label="Filtre des j’aime">
          {filters.map((item) => (
            <button
              key={item.id}
              type="button"
              className="ckp-like-filter"
              aria-pressed={filter === item.id}
              onClick={() => setFilter((current) => (current === item.id ? null : item.id))}
            >
              {item.label}
            </button>
          ))}
        </div>
      ) : null}

      {like ? (
        <button
          type="button"
          className="ckp-row ckp-row--like"
          onClick={like.onToggle}
          aria-pressed={like.liked}
          aria-label={like.liked ? 'Retirer mon j’aime' : 'J’aime ce carnet'}
        >
          <span>
            <b>{like.liked ? 'Vous aimez ce carnet' : 'J’aime ce carnet'}</b>
            <small>{like.count} j’aime</small>
          </span>
          <Icon name="heart" size={17} aria-hidden="true" />
        </button>
      ) : null}

      {likers.length === 0 ? (
        <p className="ckp-pane-empty">
          {detail.likers.length === 0 ? 'Aucun j’aime pour l’instant.' : 'Aucune réaction de ce type.'}
        </p>
      ) : (
        <div className="ckp-pane-list">
          {likers.map((liker) => (
            <div className="ckp-liker" key={liker.id}>
              {liker.avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element -- avatar distant
                <img className="ckp-avatar" src={liker.avatarUrl} alt="" />
              ) : (
                <span className="ckp-avatar ckp-avatar--initial" aria-hidden="true">
                  {liker.name.charAt(0).toUpperCase()}
                </span>
              )}
              <span className="ckp-liker-txt">
                <b>{liker.name}</b>
                <small>{liker.handle ? `@${liker.handle}` : 'Voyageur'}</small>
              </span>
              <span className="ckp-liker-badge">{REACTION_LABEL[liker.reaction] ?? liker.reaction}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default CarnetLikesPane;
