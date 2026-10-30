'use client';

import React from 'react';
import Link from 'next/link';
import { Heart, MessageCircle } from 'lucide-react';
import type { CarnetRow } from '@/features/community/sections/useCommunitySections';

/**
 * Tuile de carnet : l'image remplit tout le bloc, le titre se pose en bas à droite et, dessous,
 * les petits compteurs j'aime / commentaires (boutons). Toute la tuile mène au carnet ; les deux
 * compteurs sont des frères du lien (jamais imbriqués) : j'aime bascule, commentaires ouvre la fiche
 * sur ses commentaires.
 */
export function CarnetTile({
  carnet,
  onLike,
  onNavigate,
}: {
  carnet: CarnetRow;
  onLike: (carnet: CarnetRow) => void;
  onNavigate: () => void;
}) {
  const likes = carnet.like_count ?? 0;
  const comments = carnet.comment_count ?? 0;
  return (
    <div className="lkdv-ct">
      <Link
        href={`/carnets/${carnet.id}`}
        className="lkdv-ct-link"
        onClick={onNavigate}
        aria-label={`Ouvrir le carnet ${carnet.title}`}
      >
        {carnet.cover_image ? (
          // eslint-disable-next-line @next/next/no-img-element -- couvertures distantes
          <img src={carnet.cover_image} alt="" loading="lazy" decoding="async" />
        ) : (
          <b aria-hidden="true">{carnet.title.charAt(0).toUpperCase()}</b>
        )}
      </Link>
      <div className="lkdv-ct-foot">
        <span className="lkdv-ct-title">{carnet.title}</span>
        <span className="lkdv-ct-counts">
          <button
            type="button"
            aria-pressed={Boolean(carnet.liked)}
            aria-label={`${carnet.liked ? 'Retirer mon j’aime' : 'J’aime'} : ${likes}`}
            data-on={carnet.liked ? 'true' : 'false'}
            onClick={() => onLike(carnet)}
          >
            <Heart size={13} aria-hidden="true" />
            {likes}
          </button>
          <Link
            href={`/carnets/${carnet.id}?commentaires=1`}
            aria-label={`Commentaires : ${comments}`}
            onClick={onNavigate}
          >
            <MessageCircle size={13} aria-hidden="true" />
            {comments}
          </Link>
        </span>
      </div>
    </div>
  );
}

export default CarnetTile;
