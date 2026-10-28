'use client';

import React, { startTransition, useCallback, useMemo, useRef, useState } from 'react';
import Icon from '@/components/ui/Icon';
import { SfIcon } from './sfIcons';
import type { CarnetDetail, CarnetMomentItem } from '@/features/carnet/detail/types';
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

/** Neuf tuiles au plus : la grille du Compte s'arrête au troisième rang. */
const TILE_COUNT = 9;

interface CarnetTileProps {
  moment: CarnetMomentItem;
  index: number;
  /** Reste à voir, affiché sur la 9e tuile seulement (`0` = aucun badge). */
  more: number;
  onOpen: (index: number) => void;
}

/**
 * Tuile de la grille : même bouton, même image, même badge. Mémoïsée et
 * alimentée par des props stables (identifiant réel, index, nombre) : ouvrir
 * une page ou changer un compteur ne redessine aucune image.
 *
 * La place de la tuile est réservée par `aspect-ratio: 1 / 1` (CSS) : aucun
 * attribut `width`/`height` ici, et pas de `decoding="async"` — mesurés au
 * pixel sur 12 états, ces deux attributs changent le crénelage des coutures de
 * la grille (jusqu'à 20/255 sur une poignée de pixels de bord) pour zéro saut
 * de mise en page gagné. Sans eux, l'écart avant/après est de 0 pixel.
 * La première tuile seulement est prioritaire au chargement.
 */
const CarnetTile = React.memo(function CarnetTile({ moment, index, more, onOpen }: CarnetTileProps) {
  const open = useCallback(() => onOpen(index), [index, onOpen]);

  return (
    <button
      type="button"
      className="ckp-tile"
      onClick={open}
      aria-label={`Moment ${index + 1}`}
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- image distante */}
      <img
        src={moment.imageUrl ?? ''}
        alt=""
        loading={index < 3 ? 'eager' : 'lazy'}
        fetchPriority={index === 0 ? 'high' : undefined}
      />
      {more > 0 ? <span className="ckp-tile-more">+{more}</span> : null}
    </button>
  );
});

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

  /* Dérivés stables : la liste des tuiles ne se recalcule pas à chaque frappe
     ou à chaque bascule d'engagement, et les props des tuiles restent égales. */
  const tiles = useMemo(() => detail.photoMoments.slice(0, TILE_COUNT), [detail.photoMoments]);
  const more = detail.photoMoments.length > TILE_COUNT ? detail.photoMoments.length - TILE_COUNT : 0;

  /* Le changement de page est une transition : il reste interruptible sans
     jamais bloquer le geste, et le rendu visible est le même. */
  const requestPage = useCallback(
    (next: CarnetPageId, nextDirection: 'next' | 'prev') => {
      startTransition(() => {
        setDirection(nextDirection);
        onPageChange(next);
      });
    },
    [onPageChange],
  );

  const go = useCallback(
    (delta: number) => {
      const target = Math.max(0, Math.min(pages.length - 1, index + delta));
      if (target === index) return;
      requestPage(pages[target].id, delta > 0 ? 'next' : 'prev');
    },
    [index, pages, requestPage],
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
      requestPage(pages[0].id, 'prev');
    } else if (event.key === 'End') {
      event.preventDefault();
      requestPage(pages[pages.length - 1].id, 'next');
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
          tiles.length > 0 ? (
            <div className="ckp-grid-wrap">
              {tiles.map((moment, index) => (
                <CarnetTile
                  key={moment.id}
                  moment={moment}
                  index={index}
                  more={index === TILE_COUNT - 1 ? more : 0}
                  onOpen={onOpenPost}
                />
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

        {/* Les trois pages sorties du drawer portent la gouttière dense de la
            feuille : contenu à 16 px du bord et 64 px de réserve sous la
            capsule, sans toucher aux autres volets du carrousel. */}
        {page === 'likes' && likesPage ? (
          <div className="ckp-page-pad ckp-page-pad--dense">{likesPage}</div>
        ) : null}

        {page === 'comments' && commentsPage ? (
          <div className="ckp-page-pad ckp-page-pad--dense">{commentsPage}</div>
        ) : null}

        {page === 'manage' && managePage ? (
          <div className="ckp-page-pad ckp-page-pad--dense">{managePage}</div>
        ) : null}
      </div>
    </div>
  );
}

export default CarnetPages;
