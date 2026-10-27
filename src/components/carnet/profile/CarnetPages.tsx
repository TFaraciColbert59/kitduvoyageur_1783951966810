'use client';

import React, { useCallback, useMemo, useRef, useState } from 'react';
import Icon from '@/components/ui/Icon';
import { SfIcon } from './sfIcons';
import type { CarnetDetail } from '@/features/carnet/detail/types';
import { CarnetEtapesPane } from './panes/CarnetEtapesPane';
import { CarnetKitPane } from './panes/CarnetKitPane';
import { CarnetNaturePane } from './panes/CarnetNaturePane';
import { CarnetParcoursPane } from './panes/CarnetParcoursPane';

/**
 * Pages du carrousel : les cinq volets du carnet, puis les trois volets sortis
 * du drawer (J’aime, Commentaires, Gérer) qui vivent désormais ici, dans le
 * même conteneur `.ckp-pages` — donc swipables et animés comme les autres.
 */
export type CarnetPageId =
  | 'posts'
  | 'parcours'
  | 'etapes'
  | 'materiel'
  | 'nature'
  | 'likes'
  | 'comments'
  | 'manage';

export interface CarnetPageTab {
  id: CarnetPageId;
  label: string;
  icon: React.ReactNode;
}

/** Ordre imposé par le contrat : Posts → Gérer (Gérer en dernier, propriétaire). */
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
  { id: 'likes', label: 'J’aime', icon: <SfIcon name="heart" size={17} /> },
  { id: 'comments', label: 'Commentaires', icon: <SfIcon name="bubble" size={17} /> },
  { id: 'manage', label: 'Gérer', icon: <SfIcon name="pencil" size={17} /> },
];

/** Pages disponibles pour ce lecteur : Gérer n’existe que pour le propriétaire. */
export function carnetPageTabs(isOwner: boolean): CarnetPageTab[] {
  return isOwner ? CARNET_PAGE_TABS : CARNET_PAGE_TABS.filter((tab) => tab.id !== 'manage');
}

/** Index de la page dans le carrousel complet (sert au sélecteur de vues). */
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
  /** Contenus réels des volets sortis du drawer, rendus en pages. */
  likesPage?: React.ReactNode;
  commentsPage?: React.ReactNode;
  managePage?: React.ReactNode;
}

const SWIPE_MIN_PX = 40;

/** Pas de page pour un geste horizontal : 1 (page suivante), -1, ou 0 (rien). */
export function swipeStep(dx: number, dy: number): -1 | 0 | 1 {
  if (!Number.isFinite(dx) || !Number.isFinite(dy)) return 0;
  if (Math.abs(dx) < SWIPE_MIN_PX || Math.abs(dx) <= Math.abs(dy) * 1.2) return 0;
  return dx < 0 ? 1 : -1;
}

/**
 * Zone média de la carte, en pages qui swipent : Posts, Parcours, Étapes,
 * Matériel, Nature, J’aime, Commentaires, Gérer. Le geste horizontal (doigt ou
 * souris), les flèches du clavier et les segments du bas changent la page.
 */
export function CarnetPages({
  detail,
  page,
  onPageChange,
  canWrite,
  onRequireAuth,
  onOpenPost,
  onDownloadGpx,
  likesPage = null,
  commentsPage = null,
  managePage = null,
}: CarnetPagesProps) {
  const [direction, setDirection] = useState<'next' | 'prev'>('next');
  const start = useRef<{ x: number; y: number } | null>(null);
  const swiped = useRef(false);

  const pages = useMemo(() => carnetPageTabs(detail.isOwner), [detail.isOwner]);
  const index = Math.max(0, pages.findIndex((tab) => tab.id === page));

  const go = useCallback(
    (delta: number) => {
      const target = Math.max(0, Math.min(pages.length - 1, index + delta));
      if (target === index) return;
      setDirection(delta > 0 ? 'next' : 'prev');
      onPageChange(pages[target].id);
    },
    [index, onPageChange, pages],
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
      onPageChange(pages[0].id);
      setDirection('prev');
    } else if (event.key === 'End') {
      event.preventDefault();
      onPageChange(pages[pages.length - 1].id);
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

  const activeTab = pages.find((tab) => tab.id === page) ?? CARNET_PAGE_TABS[carnetPageIndex(page)];

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

        {page === 'likes' && likesPage ? <div className="ckp-page-pad">{likesPage}</div> : null}

        {page === 'comments' && commentsPage ? <div className="ckp-page-pad">{commentsPage}</div> : null}

        {page === 'manage' && managePage ? <div className="ckp-page-pad">{managePage}</div> : null}
      </div>
    </div>
  );
}

export default CarnetPages;
