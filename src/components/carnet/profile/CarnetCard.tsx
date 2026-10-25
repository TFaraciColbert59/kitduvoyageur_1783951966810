'use client';

import React from 'react';
import dynamic from 'next/dynamic';
import Icon from '@/components/ui/Icon';
import { CarnetMediaTabs } from './CarnetMediaTabs';
import type { CarnetDetail } from '@/features/carnet/detail/types';

const CarnetTraceMap = dynamic(
  () => import('./CarnetTraceMap').then((mod) => mod.CarnetTraceMap),
  { ssr: false, loading: () => <div className="ckp-map-canvas" aria-hidden="true" /> },
);

export type CarnetMediaMode = 'grid' | 'map';
export type CarnetStatDrawer = 'parcours' | 'etapes';

export interface CarnetCardProps {
  detail: CarnetDetail;
  mediaMode: CarnetMediaMode;
  onMediaModeChange: (mode: CarnetMediaMode) => void;
  onOpenCarnet: () => void;
  onOpenStat: (drawer: CarnetStatDrawer) => void;
  onOpenComments: () => void;
  onOpenLikes: () => void;
  onOpenParcours: () => void;
  onOpenManage: () => void;
  onLike: () => void;
  onSave: () => void;
  onOpenMenu: () => void;
  menu?: React.ReactNode;
  onOpenPost: (index: number) => void;
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

/** Carte du carnet : identité, statistiques boutons, actions, médias, sélecteur 31. */
export function CarnetCard({
  detail,
  mediaMode,
  onMediaModeChange,
  onOpenCarnet,
  onOpenStat,
  onOpenComments,
  onOpenLikes,
  onOpenParcours,
  onOpenManage,
  onLike,
  onSave,
  onOpenMenu,
  menu = null,
  onOpenPost,
  onDownloadGpx,
}: CarnetCardProps) {
  const context = [detail.destination, detail.dateRange].filter(Boolean).join(' · ');
  const hasTrace =
    Array.isArray((detail.trace as any)?.coordinates) ||
    Array.isArray((detail.trace as any)?.geometry?.coordinates);
  const km = detail.distanceKm
    ? `${detail.distanceKm.toLocaleString('fr-FR', { maximumFractionDigits: 1 })} km`
    : null;
  const elevation = detail.elevationM
    ? `${detail.elevationM.toLocaleString('fr-FR')} m D+`
    : null;
  const summaryLine = [
    detail.days.length > 0 ? `${detail.days.length} jour${detail.days.length > 1 ? 's' : ''}` : null,
    km,
    elevation,
    detail.photoMoments.length > 0 ? `${detail.photoMoments.length} moments` : null,
  ].filter(Boolean).join(' · ');

  return (
    <section className="ckp-card" aria-label="Carte du carnet">
      <div className="ckp-card-scroll">
        <div className="ckp-head">
          {detail.coverImage ? (
            <button
              type="button"
              className="ckp-cover-btn"
              onClick={onOpenCarnet}
              aria-label="Ouvrir le carnet"
            >
              {/* eslint-disable-next-line @next/next/no-img-element -- couverture distante */}
              <img className="ckp-cover" src={detail.coverImage} alt={detail.coverImageAlt ?? ''} />
            </button>
          ) : (
            <button
              type="button"
              className="ckp-cover-btn ckp-cover-btn--empty"
              onClick={onOpenCarnet}
              aria-label="Ouvrir le carnet"
            >
              <span aria-hidden="true">{(detail.destination ?? detail.title).charAt(0).toUpperCase()}</span>
            </button>
          )}

          <div className="ckp-id-stats">
            {detail.stats.map((stat) => (
              <button
                key={stat.key}
                type="button"
                className="ckp-stat"
                onClick={() => onOpenStat(stat.key === 'days' ? 'etapes' : 'parcours')}
                aria-label={`${stat.label} ${stat.value}`}
              >
                <b className="ckp-stat-v">{stat.value}</b>
                <span className="ckp-stat-l">{stat.label}</span>
              </button>
            ))}
          </div>
        </div>

        {summaryLine ? <p className="ckp-bio-line">{summaryLine}</p> : null}
        <p className="ckp-bio-line">
          {[context, detail.description].filter(Boolean).join(' · ')}
        </p>

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
          <Action
            icon="bookmark"
            label={detail.engagement.favorited ? 'Enregistré' : 'Enregistrer'}
            onClick={onSave}
            pressed={detail.engagement.favorited}
          />
          {detail.isOwner ? (
            <Action icon="pencil" label="Gérer" onClick={onOpenManage} />
          ) : (
            <Action icon="map" label="Parcours" onClick={onOpenParcours} />
          )}
          <span className="ckp-action ckp-more-anchor">
            <button type="button" className="ckp-action" onClick={onOpenMenu} aria-label="Plus d’options">
              <span className="ckp-action-btn">
                <span className="ckp-action-in">
                  <Icon name="more-horizontal" size={18} aria-hidden="true" />
                </span>
              </span>
              <span className="ckp-action-lbl">Plus</span>
            </button>
            {menu}
          </span>
        </div>

        <div className="ckp-media">
          {mediaMode === 'grid' ? (
            detail.photoMoments.length > 0 ? (
              <div className="ckp-grid-wrap">
                {detail.photoMoments.slice(0, 9).map((moment, index) => (
                  <button
                    key={moment.id}
                    type="button"
                    className="ckp-tile"
                    onClick={() => onOpenPost(index)}
                    aria-label={`Moment ${index + 1}`}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element -- image distante */}
                    <img src={moment.imageUrl ?? ''} alt="" loading={index < 3 ? 'eager' : 'lazy'} />
                    <span className="ckp-tile-expand" aria-hidden="true">
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                        <path d="M9 4H4v5M15 20h5v-5" />
                      </svg>
                    </span>
                    {index === 8 && detail.photoMoments.length > 9 ? (
                      <span className="ckp-tile-more">+{detail.photoMoments.length - 9}</span>
                    ) : null}
                  </button>
                ))}
              </div>
            ) : (
              <div className="ckp-grid-empty">
                <Icon name="image-plus" size={20} aria-hidden="true" />
                <b>Aucun moment pour l’instant.</b>
                <p>
                  {detail.isOwner
                    ? 'Ajoutez un moment depuis votre carnet.'
                    : 'L’auteur n’a pas encore ajouté de photo.'}
                </p>
              </div>
            )
          ) : (
            <div className="ckp-map-card">
              {hasTrace ? (
                <CarnetTraceMap
                  trace={detail.trace}
                  distanceKm={detail.distanceKm}
                  elevationM={detail.elevationM}
                />
              ) : (
                <div className="ckp-empty" style={{ height: '100%', borderRadius: 0 }}>
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
                  GPX
                </button>
              </div>
            </div>
          )}


        </div>
      </div>

      <CarnetMediaTabs
        items={[
          {
            id: 'grid',
            label: 'Grille des moments',
            icon: (
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="15" height="15" aria-hidden="true">
                <rect x="3" y="3" width="7" height="7" rx="1.6" />
                <rect x="14" y="3" width="7" height="7" rx="1.6" />
                <rect x="3" y="14" width="7" height="7" rx="1.6" />
                <rect x="14" y="14" width="7" height="7" rx="1.6" />
              </svg>
            ),
          },
          { id: 'map', label: 'Carte du parcours', icon: <Icon name="map" size={15} aria-hidden="true" /> },
        ]}
        activeIndex={mediaMode === 'grid' ? 0 : 1}
        onChange={(index) => onMediaModeChange(index === 0 ? 'grid' : 'map')}
        ariaLabel="Affichage des médias"
      />
    </section>
  );
}

export default CarnetCard;
