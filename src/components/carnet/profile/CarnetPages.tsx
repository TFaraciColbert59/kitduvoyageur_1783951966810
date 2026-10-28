'use client';

import React, { startTransition, useCallback, useMemo, useState } from 'react';
import Icon from '@/components/ui/Icon';
import { SfIcon } from './sfIcons';
import type { CarnetDetail, CarnetMomentItem } from '@/features/carnet/detail/types';
import { CarnetEmpty } from './CarnetStates';
import { CarnetEtapesPane } from './panes/CarnetEtapesPane';
import { CarnetKitPane } from './panes/CarnetKitPane';
import { CarnetNaturePane } from './panes/CarnetNaturePane';
import { formatElevation, formatKm } from '@/features/carnet/detail/format';

/**
 * Pages du carrousel : les quatre volets du carnet, puis les trois volets
 * sortis du drawer (J’aime, Commentaires, Gérer) qui vivent désormais ici, dans
 * le même conteneur `.ckp-pages`. La page « Parcours » a disparu : la seule
 * carte de la fiche est celle du bas (`40dvh`), et le téléchargement GPX est
 * passé dans le pied de la page Étapes. Le carrousel ne se pilote que par la
 * barre du haut, le menu `···` et son clavier : le glissement horizontal de la
 * carte appartient aux jours.
 */
export type CarnetPageId =
  | 'posts'
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
  /**
   * Moments de la grille Posts, dans l'ordre d'ouverture du post : ceux du
   * jour affiché sur la carte, tous les moments sur le Résumé. Absent, la
   * grille garde `detail.photoMoments`.
   */
  moments?: CarnetMomentItem[];
  /** État vide de la grille quand la page n'a aucun moment (jour sans photo). */
  emptyGrid?: React.ReactNode;
  /** Contenus réels des volets sortis du drawer, rendus en pages. */
  likesPage?: React.ReactNode;
  commentsPage?: React.ReactNode;
  managePage?: React.ReactNode;
}

/** Neuf tuiles au plus : la grille du Compte s'arrête au troisième rang. */
const TILE_COUNT = 9;

/**
 * Une trace est téléchargeable quand elle porte réellement des coordonnées :
 * `LineString` brute, ou géométrie GeoJSON encapsulée. Aucun GPX n'est fabriqué
 * à partir d'une trace absente.
 */
export function hasTrace(trace: unknown): boolean {
  const value = trace as { coordinates?: unknown; geometry?: { coordinates?: unknown } } | null;
  return Array.isArray(value?.coordinates) || Array.isArray(value?.geometry?.coordinates);
}

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

/**
 * Zone média de la carte, en pages : Posts, Parcours, Étapes, Matériel, Nature,
 * J’aime, Commentaires, Gérer. Les segments du bas et les flèches du clavier
 * changent la page ; le geste horizontal de la carte n'est pas écouté ici, il
 * change de jour (voir `CarnetDaySwipe`).
 */
export function CarnetPages({
  detail,
  page,
  onPageChange,
  canWrite,
  onRequireAuth,
  onOpenPost,
  onDownloadGpx,
  moments,
  emptyGrid = null,
  likesPage = null,
  commentsPage = null,
  managePage = null,
}: CarnetPagesProps) {
  const [direction, setDirection] = useState<'next' | 'prev'>('next');

  const pages = useMemo(() => carnetPageTabs(detail.isOwner), [detail.isOwner]);
  const index = Math.max(0, pages.findIndex((tab) => tab.id === page));

  /* Dérivés stables : la liste des tuiles ne se recalcule pas à chaque frappe
     ou à chaque bascule d'engagement, et les props des tuiles restent égales. */
  const photos = moments ?? detail.photoMoments;
  const tiles = useMemo(() => photos.slice(0, TILE_COUNT), [photos]);
  const more = photos.length > TILE_COUNT ? photos.length - TILE_COUNT : 0;

  /* Le changement de page est une transition : il reste interruptible sans
     jamais bloquer le clic, et le rendu visible est le même. */
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

  const activeTab = pages.find((tab) => tab.id === page) ?? CARNET_PAGE_TABS[carnetPageIndex(page)];

  return (
    <div
      className="ckp-pages"
      id={`carnet-page-${page}`}
      role="tabpanel"
      aria-label={activeTab.label}
      tabIndex={0}
      onKeyDown={onKeyDown}
      onDragStart={(event) => event.preventDefault()}
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
          ) : emptyGrid ? (
            emptyGrid
          ) : (
            <CarnetEmpty
              icon={<Icon name="image-plus" size={32} aria-hidden="true" />}
              label="Aucun moment"
            />
          )
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
                <Icon name="route" size={13} aria-hidden="true" /> {detail.etapes.length} étape
                {detail.etapes.length > 1 ? 's' : ''}
              </span>
              <span>
                <Icon name="image-plus" size={13} aria-hidden="true" /> {detail.photoMoments.length}{' '}
                moment{detail.photoMoments.length > 1 ? 's' : ''}
              </span>
            </div>
            <CarnetEtapesPane detail={detail} />
            {/* Le pied de la page Parcours supprimée : le GPX reste
                téléchargeable, avec les deux chiffres réels du carnet. Le
                bouton est le seul élément conservé de ce volet. */}
            <div className="ckp-pane-foot">
              <span className="ckp-day-meta">
                {formatKm(detail.distanceKm) ? <span>{formatKm(detail.distanceKm)}</span> : null}
                {formatElevation(detail.elevationM) ? (
                  <span>{formatElevation(detail.elevationM)} D+</span>
                ) : null}
              </span>
              <button
                type="button"
                className="ckp-pill ckp-pill--primary"
                onClick={onDownloadGpx}
                disabled={!hasTrace(detail.trace)}
              >
                <Icon name="download" size={16} aria-hidden="true" />
                Télécharger le GPX
              </button>
            </div>
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
