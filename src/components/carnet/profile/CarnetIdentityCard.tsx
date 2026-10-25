'use client';

import React from 'react';
import dynamic from 'next/dynamic';
import Icon from '@/components/ui/Icon';
import { CarnetMomentGrid } from './CarnetMomentGrid';
import type { CarnetDetail } from '@/features/carnet/detail/types';

const CarnetTraceMap = dynamic(
  () => import('./CarnetTraceMap').then((mod) => mod.CarnetTraceMap),
  { ssr: false, loading: () => <div className="ckp-map-canvas" aria-hidden="true" /> },
);

export type CarnetMediaMode = 'grid' | 'map';

export interface CarnetIdentityCardProps {
  detail: CarnetDetail;
  /** Mode contrôlé par le parent ; sinon la carte gère son propre état. */
  mediaMode?: CarnetMediaMode;
  onMediaModeChange?: (mode: CarnetMediaMode) => void;
  onOpenViewer: (index: number) => void;
  onOpenAuthor: () => void;
  onLike: () => void;
  onOpenComments: () => void;
  onOpenParcours: () => void;
  onOpenManage: () => void;
  onExpandDescription: () => void;
  onDownloadGpx: () => void;
}

function Action({
  icon,
  label,
  count,
  onClick,
  pressed,
}: {
  icon: string;
  label: string;
  count?: number;
  onClick: () => void;
  pressed?: boolean;
}) {
  return (
    <button
      type="button"
      className="ckp-action"
      onClick={onClick}
      aria-pressed={pressed}
      aria-label={typeof count === 'number' ? `${label}, ${count}` : label}
    >
      <span className="ckp-action-btn">
        <span className="ckp-action-in">
          <Icon name={icon} size={18} aria-hidden="true" />
        </span>
        {typeof count === 'number' && count > 0 ? (
          <span className="ckp-action-count" aria-hidden="true">
            {count}
          </span>
        ) : null}
      </span>
      <span className="ckp-action-lbl">{label}</span>
    </button>
  );
}

/**
 * Carte d'identité — la carte profil du Compte : visuel en anneau 66, trois
 * statistiques, une ligne de contexte, la bio, trois actions en anneaux, puis
 * la grille (ou la carte) avec son toggle 30. Aucun titre dans la carte :
 * l'identité est portée par la pilule de la barre du haut.
 */
export function CarnetIdentityCard({
  detail,
  mediaMode,
  onMediaModeChange,
  onOpenViewer,
  onOpenAuthor,
  onLike,
  onOpenComments,
  onOpenParcours,
  onOpenManage,
  onExpandDescription,
  onDownloadGpx,
}: CarnetIdentityCardProps) {
  const [internalMode, setInternalMode] = React.useState<CarnetMediaMode>('grid');
  const mode: CarnetMediaMode = mediaMode ?? internalMode;
  const setMode = (next: CarnetMediaMode) => {
    if (onMediaModeChange) onMediaModeChange(next);
    else setInternalMode(next);
  };
  const context = [detail.destination, detail.dateRange].filter(Boolean).join(' · ');
  const showMore = Boolean(detail.description && detail.description.length > 120);
  const hasTrace =
    Array.isArray((detail.trace as any)?.coordinates) ||
    Array.isArray((detail.trace as any)?.geometry?.coordinates);
  const km = detail.distanceKm
    ? `${detail.distanceKm.toLocaleString('fr-FR', { maximumFractionDigits: 1 })} km`
    : null;
  const elevation = detail.elevationM ? `${detail.elevationM.toLocaleString('fr-FR')} m D+` : null;

  return (
    <section className="ckp-card" aria-label="Identité du carnet">
      <div className="ckp-head">
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
          <div className="ckp-cover--empty" aria-label="Sans couverture">
            <b aria-hidden="true">{(detail.destination ?? detail.title).charAt(0).toUpperCase()}</b>
          </div>
        )}

        <div className="ckp-id-stats">
          {detail.stats.map((stat) => (
            <div className="ckp-stat" key={stat.key}>
              <b className="ckp-stat-v">{stat.value}</b>
              <span className="ckp-stat-l">{stat.label}</span>
            </div>
          ))}
        </div>
      </div>

      <p className="ckp-bio-line">{context}</p>

      {detail.author ? (
        <button
          type="button"
          className="ckp-author-line"
          onClick={onOpenAuthor}
          aria-label={detail.author.name}
        >
          <b>{detail.author.name}</b>
          {detail.author.trustScore > 0 ? <span aria-hidden="true">·</span> : null}
          {detail.author.trustScore > 0 ? <span className="ckp-author-score">{detail.author.trustScore}</span> : null}
          {detail.verified ? <span aria-hidden="true">·</span> : null}
          {detail.verified ? <span className="ckp-badge">Vérifié</span> : null}
        </button>
      ) : (
        <p className="ckp-author-line" aria-label="Auteur non renseigné">
          Auteur non renseigné
        </p>
      )}

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
        <Action
          icon="heart"
          label="J’aime"
          count={detail.engagement.likes}
          onClick={onLike}
          pressed={detail.engagement.liked}
        />
        <Action
          icon="message-square"
          label="Commenter"
          count={detail.engagement.comments}
          onClick={onOpenComments}
        />
        {detail.isOwner ? (
          <Action icon="pencil" label="Gérer" onClick={onOpenManage} />
        ) : (
          <Action icon="map" label="Parcours" onClick={onOpenParcours} />
        )}
      </div>

      <div className="ckp-media">
        {mode === 'grid' ? (
          <CarnetMomentGrid
            moments={detail.photoMoments}
            onOpenViewer={onOpenViewer}
            isOwner={detail.isOwner}
          />
        ) : (
          <div className="ckp-map-card">
            {hasTrace ? (
              <CarnetTraceMap
                trace={detail.trace}
                distanceKm={detail.distanceKm}
                elevationM={detail.elevationM}
              />
            ) : (
              <div className="ckp-empty" style={{ height: '100%', borderRadius: 22 }}>
                <Icon name="route" size={24} aria-hidden="true" />
                <b>Aucune trace GPS.</b>
                <p>Ce carnet n’a pas de trace enregistrée.</p>
              </div>
            )}
            <div className="ckp-map-foot">
              <span className="ckp-day-meta">
                {km ? <span>{km}</span> : null}
                {elevation ? <span>{elevation}</span> : null}
              </span>
              <button
                type="button"
                className="ckp-pill ckp-pill--primary"
                onClick={onDownloadGpx}
                disabled={!hasTrace}
              >
                <Icon name="download" size={16} aria-hidden="true" />
                Télécharger le GPX
              </button>
            </div>
          </div>
        )}

        <div className="ckp-toggle" role="group" aria-label="Affichage des médias">
          <button
            type="button"
            aria-pressed={mode === 'grid'}
            aria-label="Grille des moments"
            onClick={() => setMode('grid')}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <rect x="3" y="3" width="7" height="7" rx="1.6" />
              <rect x="14" y="3" width="7" height="7" rx="1.6" />
              <rect x="3" y="14" width="7" height="7" rx="1.6" />
              <rect x="14" y="14" width="7" height="7" rx="1.6" />
            </svg>
          </button>
          <button
            type="button"
            aria-pressed={mode === 'map'}
            aria-label="Carte du parcours"
            onClick={() => setMode('map')}
          >
            <Icon name="map" size={14} aria-hidden="true" />
          </button>
        </div>
      </div>
    </section>
  );
}

export default CarnetIdentityCard;
