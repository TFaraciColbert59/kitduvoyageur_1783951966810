'use client';

import React from 'react';
import { CarnetSectionTabs } from './CarnetSectionTabs';
import { formatWeight } from '@/features/carnet/detail/format';
import type { CarnetDetail } from '@/features/carnet/detail/types';
import { LKDVIcon } from '@/components/ui/LKDVIcon';

export interface CarnetIdentityCardProps {
  detail: CarnetDetail;
  activeSection: number;
  onSectionChange: (index: number) => void;
  onOpenViewer: () => void;
  onOpenAuthor: () => void;
  onOpenComments: () => void;
  onLike: () => void;
  onOpenManage: () => void;
  onExpandDescription: () => void;
}

function StatCells({ stats }: { stats: CarnetDetail['stats'] }) {
  if (stats.length === 0) return null;
  return (
    <div className="ckp-stats">
      {stats.map((stat) => (
        <div className="ckp-stat" key={stat.key} data-stat={stat.key}>
          <span className="ckp-stat-v">{stat.value}</span>
          <span className="ckp-stat-l">{stat.label}</span>
        </div>
      ))}
    </div>
  );
}

function AuthorRow({
  author,
  onOpenAuthor,
}: {
  author: CarnetDetail['author'];
  onOpenAuthor: () => void;
}) {
  if (!author) {
    return (
      <div className="ckp-author-static">
        <span className="ckp-avatar ckp-avatar--initial" aria-hidden="true">
          ?
        </span>
        <span>
          <b className="ckp-author-name">Auteur non renseigné</b>
          <small className="ckp-author-meta">Ce carnet n’a pas d’auteur rattaché.</small>
        </span>
      </div>
    );
  }

  return (
    <button
      type="button"
      className="pmi-author ckp-author"
      onClick={onOpenAuthor}
      aria-label={`Profil de ${author.name}`}
    >
      {author.avatarUrl ? (
        // eslint-disable-next-line @next/next/no-img-element -- avatar distant, même source que le Compte
        <img className="pmi-author-av" src={author.avatarUrl} alt="" />
      ) : (
        <span className="pmi-author-av pmi-author-initial" aria-hidden="true">
          {author.name.charAt(0).toUpperCase()}
        </span>
      )}
      <span className="pmi-author-txt">
        <b className="ckp-author-name">{author.name}</b>
        <small className="ckp-author-meta">
          {author.handle ? `@${author.handle}` : 'Auteur du carnet'}
        </small>
      </span>
      {author.trustScore > 0 ? (
        <span className="ckp-trust" aria-label={`Score de confiance ${author.trustScore}`}>
          {author.trustScore}
        </span>
      ) : null}
    </button>
  );
}

/** Carte d'identité du carnet — la carte profil du Compte, transposée. */
export function CarnetIdentityCard({
  detail,
  activeSection,
  onSectionChange,
  onOpenViewer,
  onOpenAuthor,
  onOpenComments,
  onLike,
  onOpenManage,
  onExpandDescription,
}: CarnetIdentityCardProps) {
  const showMore = Boolean(detail.description && detail.description.length > 160);

  return (
    <section className="ckp-card" aria-label="Identité du carnet">
      <div className="ckp-head">
        {detail.coverImage ? (
          <button
            type="button"
            className="ckp-cover-wrap"
            onClick={onOpenViewer}
            aria-label="Agrandir la couverture"
            style={{ border: 0, padding: 0, background: 'none', cursor: 'zoom-in' }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element -- couverture distante */}
            <img className="ckp-cover" src={detail.coverImage} alt={detail.coverImageAlt ?? ''} />
            <span className="ckp-cover-expand" aria-hidden="true">
              <LKDVIcon name="lien" size={12} />
            </span>
          </button>
        ) : (
          <div className="ckp-cover-wrap">
            <div className="ckp-cover ckp-cover--empty">
              <b aria-hidden="true">{(detail.destination ?? detail.title).charAt(0).toUpperCase()}</b>
              <small>Sans couverture</small>
            </div>
          </div>
        )}

        <div className="ckp-id-col">
          <div className="ckp-title-row">
            <h2 className="ckp-title">{detail.title}</h2>
            {detail.verified ? (
              <span className="ckp-badge">
                <LKDVIcon name="securite" size={12} aria-hidden="true" />
                Vérifié
              </span>
            ) : null}
            {!detail.isPublic && detail.isOwner ? (
              <span className="ckp-badge ckp-badge--private">
                <LKDVIcon name="verrou" size={12} aria-hidden="true" />
                Privé
              </span>
            ) : null}
          </div>
          {detail.destination ? <p className="ckp-sub">{detail.destination}</p> : null}
          {detail.dateRange ? <p className="ckp-dates">{detail.dateRange}</p> : null}
          <StatCells stats={detail.stats} />
        </div>
      </div>

      <AuthorRow author={detail.author} onOpenAuthor={onOpenAuthor} />

      {detail.description ? (
        <>
          <p className="ckp-desc">{detail.description}</p>
          {showMore ? (
            <button type="button" className="ckp-desc-more" onClick={onExpandDescription}>
              Lire la suite
            </button>
          ) : null}
        </>
      ) : null}

      <div className="ckp-actions">
        <button
          type="button"
          className={`ckp-pill${detail.engagement.liked ? ' is-on' : ''}`}
          onClick={onLike}
          aria-pressed={detail.engagement.liked}
          aria-label={`J’aime, ${detail.engagement.likes} ${detail.engagement.likes > 1 ? 'mentions' : 'mention'}`}
        >
          <LKDVIcon name="favoris" size={16} aria-hidden="true" />
          {detail.engagement.likes}
        </button>
        <button
          type="button"
          className="ckp-pill"
          onClick={onOpenComments}
          aria-label={`Commentaires, ${detail.engagement.comments}`}
        >
          <LKDVIcon name="messages" size={16} aria-hidden="true" />
          {detail.engagement.comments}
        </button>
        {detail.isOwner ? (
          <button type="button" className="ckp-pill" onClick={onOpenManage} aria-label="Gérer le carnet">
            <LKDVIcon name="modifier" size={16} aria-hidden="true" />
            Gérer
          </button>
        ) : null}
        {!detail.isOwner && detail.kit.totalWeightG ? (
          <span className="ckp-pill">
            <LKDVIcon name="sac" size={16} aria-hidden="true" />
            {formatWeight(detail.kit.totalWeightG)}
          </span>
        ) : null}
      </div>

      <div className="ckp-sep" />
      <CarnetSectionTabs activeIndex={activeSection} onIndexChange={onSectionChange} />
    </section>
  );
}

export default CarnetIdentityCard;
