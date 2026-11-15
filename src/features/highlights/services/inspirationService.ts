import type {
  Collection,
  CollectionView,
  EditorialGuide,
  InspirationCandidate,
  InspirationHistory,
  InspirationRecommendation,
  ParkPerimeter,
  PoiRef,
  RouteRef,
  Viewer,
} from '../types';
import { recommendInspiration } from '../engine/recommendations';
import {
  buildEditorialGuide,
  publicEditorialCollections,
  searchParkRoutes,
  type GuideSource,
} from '../engine/guides';

export interface InspirationSource {
  candidates: InspirationCandidate[];
  guides: GuideSource[];
  routes: RouteRef[];
  pois: PoiRef[];
}

/**
 * K1.10 / K1.11 / K1.12 / K5.17 — façade de découverte.
 * Les cartes du fil, les guides et la recherche de parc lisent la même source.
 */
export class InspirationService {
  constructor(private readonly source: InspirationSource) {}

  feed(
    history: InspirationHistory,
    viewer: Viewer,
    now: string,
    limit = 6
  ): InspirationRecommendation[] {
    return recommendInspiration(history, this.source.candidates, viewer, now, limit);
  }

  guide(idOrSlug: string, viewer: Viewer, now?: string): EditorialGuide | null {
    const guide = this.source.guides.find((item) => item.id === idOrSlug || item.slug === idOrSlug);
    if (!guide) return null;
    return buildEditorialGuide(guide, viewer, now);
  }

  guides(viewer: Viewer, now?: string): EditorialGuide[] {
    return this.source.guides.map((guide) => buildEditorialGuide(guide, viewer, now));
  }

  park(park: ParkPerimeter, query: string, limit = 20): RouteRef[] {
    return searchParkRoutes(park, this.source.routes, query, limit);
  }

  editorialCollections(collections: readonly Collection[], viewer: Viewer): CollectionView[] {
    return publicEditorialCollections(collections, viewer);
  }
}
