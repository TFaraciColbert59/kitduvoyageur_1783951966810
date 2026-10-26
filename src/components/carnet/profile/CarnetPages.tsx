'use client';

import React, { useCallback, useRef, useState } from 'react';
import Icon from '@/components/ui/Icon';
import { SfIcon } from './sfIcons';
import type { CarnetDetail } from '@/features/carnet/detail/types';
import { CarnetEtapesPane } from './panes/CarnetEtapesPane';
import { CarnetKitPane } from './panes/CarnetKitPane';
import { CarnetNaturePane } from './panes/CarnetNaturePane';
import { CarnetParcoursPane } from './panes/CarnetParcoursPane';

export type CarnetPageId = 'posts' | 'parcours' | 'etapes' | 'materiel' | 'nature';

export interface CarnetPageTab {
  id: CarnetPageId;
  label: string;
  icon: React.ReactNode;
}

/** Ordre imposé par le contrat : Posts, Parcours, Étapes, Matériel, Nature. */
export const CARNET_PAGE_TABS: CarnetPageTab[] = [
  {
    id: 'posts',
    label: 'Posts',
    icon: <SfIcon name="grid" size={17} />,
  },
  { id: 'parcours', label: 'Parcours', icon: <SfIcon name="map" size={17} /> },
  { id: 'etapes', label: 'Étapes', icon: <Icon name="route" size={15} aria-hidden="true" /> },
  { id: 'materiel', label: 'Matériel', icon: <Icon name="backpack" size={15} aria-hidden="true" /> },
  { id: 'nature', label: 'Nature', icon: <Icon name="leaf" size={15} aria-hidden="true" /> },
];

export function carnetPageIndex(page: CarnetPageId): number {
  const index = CARNET_PAGE_TABS.findIndex((tab) => tab.id === page);
  return index < 0 ? 0 : index;
}

export interface CarnetPagesProps {
  detail: CarnetDetail;
  page: CarnetPageId;
  onPageChange: (page: CarnetPageId) => void;
  canWrite: boolean;
  onRequireAuth: () => void;
  onOpenPost: (index: number) => void;
  onDownloadGpx: () => void;
}

const SWIPE_MIN_PX = 40;

/** Pas de page pour un geste horizontal : 1 (page suivante), -1, ou 0 (rien). */
export function swipeStep(dx: number, dy: number): -1 | 0 | 1 {
  if (!Number.isFinite(dx) || !Number.isFinite(dy)) return 0;
  if (Math.abs(dx) < SWIPE_MIN_PX || Math.abs(dx) <= Math.abs(dy) * 1.2) return 0;
  return dx < 0 ? 1 : -1;
}

/**
 * Zone média de la carte, en pages qui swipent : Posts (grille de moments),
 * Parcours, Étapes, Matériel, Nature. Le geste horizontal (doigt ou souris),
 * les flèches du clavier et les pastilles du bas changent la page.
 */
export function CarnetPages({
  detail,
  page,
  onPageChange,
  canWrite,
  onRequireAuth,
  onOpenPost,
  onDownloadGpx,
}: CarnetPagesProps) {
  const [direction, setDirection] = useState<'next' | 'prev'>('next');
  const start = useRef<{ x: number; y: number } | null>(null);
  const swiped = useRef(false);

  const go = useCallback(
    (delta: number) => {
      const index = carnetPageIndex(page);
      const target = Math.max(0, Math.min(CARNET_PAGE_TABS.length - 1, index + delta));
      if (target === index) return;
      setDirection(delta > 0 ? 'next' : 'prev');
      onPageChange(CARNET_PAGE_TABS[target].id);
    },
    [onPageChange, page],
  );

  const onKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'ArrowRight') {
      event.preventDefault();
      go(1);
    } else if (event.key === 'ArrowLeft') {
      event.preventDefault();
      go(-1);
    } else if (event.key === 'Home') {
      event.preventDefault();
      onPageChange(CARNET_PAGE_TABS[0].id);
      setDirection('prev');
    } else if (event.key === 'End') {
      event.preventDefault();
      onPageChange(CARNET_PAGE_TABS[CARNET_PAGE_TABS.length - 1].id);
      setDirection('next');
    }
  };

  const onPointerDown = (event: React.PointerEvent) => {
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    start.current = { x: event.clientX, y: event.clientY };
    swiped.current = false;
  };

  const onPointerUp = (event: React.PointerEvent) => {
    const origin = start.current;
    start.current = null;
    if (!origin) return;
    const step = swipeStep(event.clientX - origin.x, event.clientY - origin.y);
    if (step === 0) return;
    swiped.current = true;
    go(step);
  };

  const activeTab = CARNET_PAGE_TABS[carnetPageIndex(page)];

  return (
    <div
      className="ckp-pages"
      id={`carnet-page-${page}`}
      role="tabpanel"
      aria-label={activeTab.label}
      tabIndex={0}
      onKeyDown={onKeyDown}
      onPointerDown={onPointerDown}
      onPointerUp={onPointerUp}
      onPointerCancel={() => {
        start.current = null;
      }}
      onDragStart={(event) => event.preventDefault()}
      onClickCapture={(event) => {
        if (!swiped.current) return;
        swiped.current = false;
        event.preventDefault();
        event.stopPropagation();
      }}
    >
      <div key={page} className={`ckp-page ckp-page--${direction}`}>
        {page === 'posts' ? (
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
        ) : null}

        {page === 'parcours' ? (
          <div className="ckp-page-pad">
            <CarnetParcoursPane detail={detail} onDownloadGpx={onDownloadGpx} />
          </div>
        ) : null}

        {page === 'etapes' ? (
          <div className="ckp-page-pad">
            {/* Le volet Récit sort du drawer : sa donnée propre (auteur vérifié,
                compteurs réels) est rendue ici, sans répéter le titre, la bio ni
                les dates que la carte affiche déjà. */}
            <div className="ckp-pane-meta ckp-page-meta">
              {detail.author ? (
                <span>
                  <Icon name="user" size={13} aria-hidden="true" /> {detail.author.name}
                  {detail.verified ? ' · Vérifié' : ''}
                </span>
              ) : null}
              <span>
                <Icon name="route" size={13} aria-hidden="true" /> {detail.days.length} étape
                {detail.days.length > 1 ? 's' : ''}
              </span>
              <span>
                <Icon name="image-plus" size={13} aria-hidden="true" /> {detail.photoMoments.length}{' '}
                moment{detail.photoMoments.length > 1 ? 's' : ''}
              </span>
            </div>
            <CarnetEtapesPane detail={detail} />
          </div>
        ) : null}

        {page === 'materiel' ? (
          <div className="ckp-page-pad">
            <CarnetKitPane detail={detail} />
          </div>
        ) : null}

        {page === 'nature' ? (
          <div className="ckp-page-pad">
            <CarnetNaturePane canWrite={canWrite} onRequireAuth={onRequireAuth} />
          </div>
        ) : null}
      </div>
    </div>
  );
}

export default CarnetPages;
