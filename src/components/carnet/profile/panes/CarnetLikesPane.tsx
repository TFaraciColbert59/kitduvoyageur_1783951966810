'use client';

import React, { useCallback, useMemo, useState } from 'react';
import Icon from '@/components/ui/Icon';
import type { CarnetDetail } from '@/features/carnet/detail/types';
import { CarnetField } from '../CarnetField';
import { CarnetEmpty } from '../CarnetStates';
import { CarnetSubCapsule } from '../CarnetSubCapsule';

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
  like: 'j’aime',
  bravo: 'bravo',
  useful: 'utile',
};

const REACTION_ORDER = ['like', 'bravo', 'useful'];

/**
 * Filtres de réaction : mêmes 30 px que le sous-sélecteur des statistiques,
 * mêmes cellules, même lentille ; un second appui relâche le filtre (`''`).
 */
function reactionFilters(detail: CarnetDetail) {
  const present = new Set(detail.likers.map((liker) => liker.reaction));
  return REACTION_ORDER.filter((reaction) => present.has(reaction)).map((reaction) => ({
    id: reaction,
    label: REACTION_LABEL[reaction] ?? reaction,
  }));
}

/** Réactions réelles du carnet, profils joints (plafond 50). */
export function CarnetLikesPane({ detail, currentUserId: _currentUserId, like }: CarnetLikesPaneProps) {
  const [filter, setFilter] = useState('');
  const filters = useMemo(() => reactionFilters(detail), [detail]);
  const likers = useMemo(
    () => (filter ? detail.likers.filter((liker) => liker.reaction === filter) : detail.likers),
    [detail.likers, filter],
  );
  const onFilterChange = useCallback(
    (id: string) => setFilter((current) => (current === id ? '' : id)),
    [],
  );

  return (
    <div className="ckp-pane ckp-likes">
      <div className="ckp-group">
        <CarnetField
          icon={<Icon name="heart" size={16} aria-hidden="true" />}
          label="réactions"
          value={detail.likers.length.toLocaleString('fr-FR')}
          ariaLabel={`${detail.likers.length} réactions`}
        />
        {like ? (
          <CarnetField
            icon={<Icon name="heart" size={16} aria-hidden="true" />}
            label="mon j’aime"
            value={like.count.toLocaleString('fr-FR')}
            pressed={like.liked}
            onClick={like.onToggle}
            ariaLabel={like.liked ? 'Retirer mon j’aime' : 'J’aime ce carnet'}
          />
        ) : null}
      </div>

      {filters.length > 1 ? (
        <div className="ckp-likes-filters">
          <CarnetSubCapsule
            items={filters}
            active={filter}
            onChange={onFilterChange}
            ariaLabel="Filtre des réactions"
          />
        </div>
      ) : null}

      {likers.length === 0 ? (
        <CarnetEmpty icon={<Icon name="heart" size={32} aria-hidden="true" />} label="Aucune réaction" />
      ) : (
        <div className="ckp-likers">
          {likers.map((liker) => (
            <div className="ckp-liker" key={liker.id}>
              {liker.avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element -- avatar distant
                <img className="ckp-avatar" src={liker.avatarUrl} alt="" width={28} height={28} decoding="async" />
              ) : (
                <span className="ckp-avatar ckp-avatar--initial" aria-hidden="true">
                  {liker.name.charAt(0).toUpperCase()}
                </span>
              )}
              <span className="ckp-liker-txt">
                <b>{liker.name}</b>
                <small>{liker.handle ? `@${liker.handle}` : '—'}</small>
              </span>
              <span className="ckp-liker-value">{REACTION_LABEL[liker.reaction] ?? liker.reaction}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default CarnetLikesPane;
