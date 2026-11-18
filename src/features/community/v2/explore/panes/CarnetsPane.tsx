'use client';

import React from 'react';
import type { CarnetCardVM, CarnetFilter, CarnetSort, GeoPermissionState } from '../../shared/types';
import type { CursorFeedResult } from '../../data/useCursorFeed';
import { formatCountFr } from '../../shared/format';
import { CarnetTileV2 } from '../tiles/CarnetTileV2';
import {
  ExploreEmpty,
  ExploreError,
  ExploreGeoPrompt,
  ExploreListFoot,
  ExploreOfflineBanner,
  ExplorePaneFoot,
  ExploreSkeleton,
} from '../ExploreStates';
import { usePaneNearBottom, usePaneScrollMemory } from '../usePaneScrollMemory';
import { ExploreWorldMap } from '../details/ExploreWorldMap';

export interface CarnetsPaneProps {
  feed: CursorFeedResult<CarnetCardVM>;
  filter: CarnetFilter;
  sort: CarnetSort;
  nearState: GeoPermissionState;
  nearPointKnown: boolean;
  online: boolean;
  likeBusyId: string | null;
  onLike: (carnet: CarnetCardVM) => void;
  onPeek: (carnet: CarnetCardVM, opener: HTMLElement) => void;
  onCreateCarnet: () => void;
  onDiscover: () => void;
  onRequestGeo: () => void;
  /**
   * « Tout voir » (Carnets#19) : élargit au flux complet. Le hub `/carnets`
   * n'existe pas côté produit (la route `/carnets/[id]` est hors périmètre) ;
   * le geste reste donc dans le tiroir et ne ramène jamais à la page courante.
   */
  onSeeAll?: () => void;
}

/**
 * Volet Carnets (Carnets#1-20) — mosaïque éditoriale : carnet en vedette en
 * pleine largeur puis grille de 2 colonnes, filtres en mini-capsule (coque),
 * tri en menu (coque), pagination par curseur au défilement, états distincts.
 */
export function CarnetsPane({
  feed,
  filter,
  sort,
  nearState,
  nearPointKnown,
  online,
  likeBusyId,
  onLike,
  onPeek,
  onCreateCarnet,
  onDiscover,
  onRequestGeo,
  onSeeAll,
}: CarnetsPaneProps) {
  const scrollRef = usePaneScrollMemory<HTMLDivElement>(`cv2:explore:scroll:carnets:${filter}`);
  const nearBottomRef = usePaneNearBottom<HTMLDivElement>(
    feed.hasMore && !feed.loadingMore && !feed.loading,
    feed.loadMore,
  );

  if (filter === 'map') {
    return (
      <div className="lkdv-cv2x-pane lkdv-cv2x-pane--map">
        <ExploreWorldMap kind="carnets" />
      </div>
    );
  }

  if (filter === 'near' && !nearPointKnown) {
    return (
      <div ref={scrollRef} className="lkdv-cv2x-pane">
        <ExploreGeoPrompt state={nearState} onRequest={onRequestGeo} />
      </div>
    );
  }

  if (feed.error && feed.items.length === 0) {
    return (
      <div ref={scrollRef} className="lkdv-cv2x-pane">
        <ExploreError title="Carnets indisponibles" onRetry={feed.refresh} />
      </div>
    );
  }

  if (feed.loading && feed.items.length === 0) {
    return (
      <div ref={scrollRef} className="lkdv-cv2x-pane">
        <ExploreSkeleton variant="tiles" />
      </div>
    );
  }

  if (!feed.loading && feed.items.length === 0) {
    if (filter === 'mine') {
      return (
        <div ref={scrollRef} className="lkdv-cv2x-pane">
          <ExploreEmpty
            icon="book"
            title="Aucun carnet pour l’instant"
            description="Raconte ton premier voyage : trace, jours, moments et photos au même endroit."
          >
            <button type="button" className="lkdv-cv2-pill lkdv-cv2-pill--primary" onClick={onCreateCarnet}>
              Créer mon premier carnet
            </button>
          </ExploreEmpty>
        </div>
      );
    }
    if (filter === 'followed') {
      return (
        <div ref={scrollRef} className="lkdv-cv2x-pane">
          <ExploreEmpty
            icon="book"
            title="Rien ici pour l’instant"
            description="Suis des voyageurs pour retrouver leurs carnets au même endroit."
          >
            <button type="button" className="lkdv-cv2-pill lkdv-cv2-pill--secondary" onClick={onDiscover}>
              Découvrir
            </button>
          </ExploreEmpty>
        </div>
      );
    }
    return (
      <div ref={scrollRef} className="lkdv-cv2x-pane">
        <ExploreEmpty
          icon="book"
          illustration={filter === 'discover' ? 'mountain' : undefined}
          title={filter === 'near' ? 'Aucun carnet près de toi' : 'Aucun carnet à découvrir'}
          description={
            filter === 'near'
              ? 'Aucun carnet n’a de point de départ dans les 100 km. Élargis ta recherche ou explore les carnets de la communauté.'
              : 'Raconte ton premier voyage : trace, jours, moments et photos au même endroit.'
          }
        >
          <button type="button" className="lkdv-cv2-pill lkdv-cv2-pill--primary" onClick={onCreateCarnet}>
            Créer mon premier carnet
          </button>
        </ExploreEmpty>
      </div>
    );
  }

  return (
    <div ref={scrollRef} className="lkdv-cv2x-pane">
      {!online ? <ExploreOfflineBanner /> : null}
      <div className="lkdv-cv2x-hrail" data-hscroll="" role="list" aria-label="Carnets">
        {feed.items.map((carnet) => (
          <div key={carnet.id} className="lkdv-cv2x-hrail-item lkdv-cv2x-hrail-item--wide" role="listitem">
            <CarnetTileV2
              carnet={carnet}
              showDistance={filter === 'near'}
              likeBusy={likeBusyId === carnet.id}
              onLike={onLike}
              onPeek={onPeek}
            />
          </div>
        ))}
        <div ref={nearBottomRef} className="lkdv-cv2x-hrail-sentinel" aria-hidden="true" />
      </div>
    </div>
  );
}

export default CarnetsPane;
