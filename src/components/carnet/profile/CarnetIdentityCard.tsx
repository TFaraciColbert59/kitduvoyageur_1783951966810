'use client';

import React from 'react';
import Icon from '@/components/ui/Icon';
import { CarnetMomentGrid } from './CarnetMomentGrid';
import type { CarnetDetail } from '@/features/carnet/detail/types';

export interface CarnetIdentityCardProps {
  detail: CarnetDetail;
  onOpenViewer: (index: number) => void;
  onOpenAuthor: () => void;
  onLike: () => void;
  onOpenComments: () => void;
  onOpenParcours: () => void;
  onOpenManage: () => void;
  onExpandDescription: () => void;
}

function Action({
  icon,
  label,
  onClick,
  pressed,
}: {
  icon: string;
  label: string;
  onClick: () => void;
  pressed?: boolean;
}) {
  return (
    <button type="button" className="ckp-action" onClick={onClick} aria-pressed={pressed} aria-label={label}>
      <span className="ckp-action-btn">
        <Icon name={icon} size={20} aria-hidden="true" />
      </span>
      <span className="ckp-action-lbl">{label}</span>
    </button>
  );
}

/**
 * Carte d'identité — la carte profil du Compte : couverture 66, trois
 * statistiques 19/700, bio 12, trois actions 44 et la grille DANS la carte.
 */
export function CarnetIdentityCard({
  detail,
  onOpenViewer,
  onOpenAuthor,
  onLike,
  onOpenComments,
  onOpenParcours,
  onOpenManage,
  onExpandDescription,
}: CarnetIdentityCardProps) {
  const likes = detail.engagement.likes;
  const comments = detail.engagement.comments;
  const likesLabel = `${likes} j’aime`;
  const commentsLabel = comments > 1 ? `${comments} commentaires` : `${comments} commentaire`;
  const showMore = Boolean(detail.description && detail.description.length > 160);

  return (
    <section className="ckp-card" aria-label="Identité du carnet">
      <div className="ckp-head">
        <div className="ckp-cover-wrap">
          {detail.coverImage ? (
            <button
              type="button"
              className="ckp-cover-btn"
              onClick={() => onOpenViewer(0)}
              aria-label="Agrandir la couverture"
            >
              {/* eslint-disable-next-line @next/next/no-img-element -- couverture distante */}
              <img className="ckp-cover" src={detail.coverImage} alt={detail.coverImageAlt ?? ''} />
            </button>
          ) : (
            <div className="ckp-cover ckp-cover--empty" aria-label="Sans couverture">
              <b aria-hidden="true">{(detail.destination ?? detail.title).charAt(0).toUpperCase()}</b>
            </div>
          )}
        </div>

        <div className="ckp-id-stats">
          {detail.stats.map((stat) => (
            <div className="ckp-stat" key={stat.key}>
              <b className="ckp-stat-v">{stat.value}</b>
              <span className="ckp-stat-l">{stat.label}</span>
            </div>
          ))}
        </div>
      </div>

      <h2 className="ckp-title">{detail.title}</h2>
      <p className="ckp-meta">
        {[detail.destination, detail.dateRange].filter(Boolean).join(' · ')}
      </p>

      <button
        type="button"
        className="pmi-author ckp-author"
        onClick={onOpenAuthor}
        aria-label={detail.author ? `Profil de ${detail.author.name}` : 'Auteur non renseigné'}
      >
        {detail.author?.avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- avatar distant
          <img className="pmi-author-av" src={detail.author.avatarUrl} alt="" />
        ) : (
          <span className="pmi-author-av pmi-author-initial" aria-hidden="true">
            {(detail.author?.name ?? '?').charAt(0).toUpperCase()}
          </span>
        )}
        <span className="pmi-author-txt">
          <b>{detail.author?.name ?? 'Auteur non renseigné'}</b>
          <small>{detail.author?.handle ? `@${detail.author.handle}` : 'Auteur du carnet'}</small>
        </span>
        {detail.author && detail.author.trustScore > 0 ? (
          <span className="ckp-trust">{detail.author.trustScore}</span>
        ) : null}
        {detail.verified ? <span className="ckp-badge">Vérifié</span> : null}
      </button>

      {detail.description ? (
        <>
          <p className="ckp-bio">{detail.description}</p>
          {showMore ? (
            <button type="button" className="ckp-desc-more" onClick={onExpandDescription}>
              Lire la suite
            </button>
          ) : null}
        </>
      ) : null}

      <div className="ckp-actions">
        <Action icon="heart" label={likesLabel} onClick={onLike} pressed={detail.engagement.liked} />
        <Action icon="message-square" label={commentsLabel} onClick={onOpenComments} />
        {detail.isOwner ? (
          <Action icon="pencil" label="Gérer" onClick={onOpenManage} />
        ) : (
          <Action icon="map" label="Parcours" onClick={onOpenParcours} />
        )}
      </div>

      <CarnetMomentGrid moments={detail.photoMoments} onOpenViewer={onOpenViewer} isOwner={detail.isOwner} />
    </section>
  );
}

export default CarnetIdentityCard;
