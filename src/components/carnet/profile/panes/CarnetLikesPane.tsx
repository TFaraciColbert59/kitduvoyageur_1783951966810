'use client';

import React, { useState } from 'react';
import Icon from '@/components/ui/Icon';
import { CarnetSubCapsule } from '../CarnetSubCapsule';
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

const FILTERS = [
  { id: 'all', label: 'Tous' },
  { id: 'mine', label: 'Mutuels' },
];

const REACTION_LABEL: Record<string, string> = {
  like: 'J’aime',
  bravo: 'Bravo',
  useful: 'Utile',
};

/** Réactions réelles du carnet, profils joints (plafond 50). */
export function CarnetLikesPane({ detail, currentUserId, like }: CarnetLikesPaneProps) {
  const [filter, setFilter] = useState('all');
  const likers = filter === 'mine'
    ? detail.likers.filter((liker) => liker.id !== currentUserId)
    : detail.likers;

  return (
    <div className="ckp-pane">
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
            <small>
              {like.count} j’aime
            </small>
          </span>
          <Icon name="heart" size={17} aria-hidden="true" />
        </button>
      ) : null}

      {likers.length === 0 ? (
        <p className="ckp-pane-empty">Aucun j’aime pour l’instant.</p>
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

      {detail.likers.length > 1 ? (
        <CarnetSubCapsule items={FILTERS} active={filter} onChange={setFilter} ariaLabel="Filtre des j’aime" />
      ) : null}
    </div>
  );
}

export default CarnetLikesPane;
