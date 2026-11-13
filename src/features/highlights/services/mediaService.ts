import type {
  GeoPoint,
  RouteActivity,
  RouteCommunityMedia,
  RouteCommunitySummary,
  RouteObservation,
  RoutePhoto,
  StreetViewProvider,
  StreetViewResult,
  TrailPhotoMarker,
  Viewer,
} from '../types';
import {
  indexTrailPhotos,
  routeCommunityMedia,
  type IndexTrailPhotosOptions,
  type RouteMediaOptions,
} from '../engine/trailView';
import { synthesizeRouteCommunity, type SynthesizeOptions } from '../engine/communityRoute';
import { resolveStreetView } from '../engine/streetView';

/**
 * K2.26 / S3.05 / S3.24 / K2.25 — façade médias et terrain.
 * Toutes les méthodes retournent des projections sans coordonnée source.
 */
export class TrailMediaService {
  trailPhotos(
    route: { id: string; points: readonly GeoPoint[] },
    photos: readonly RoutePhoto[],
    options: IndexTrailPhotosOptions = {}
  ): TrailPhotoMarker[] {
    return indexTrailPhotos(route, photos, options);
  }

  media(
    routeId: string,
    photos: readonly RoutePhoto[],
    activities: readonly RouteActivity[],
    viewer: Viewer,
    options: RouteMediaOptions = {}
  ): RouteCommunityMedia {
    return routeCommunityMedia(routeId, photos, activities, viewer, options);
  }

  summary(
    routeId: string,
    observations: readonly RouteObservation[],
    options: SynthesizeOptions = {}
  ): RouteCommunitySummary {
    return synthesizeRouteCommunity(routeId, observations, options);
  }

  streetView(
    point: GeoPoint,
    travelHeadingDeg: number,
    provider: StreetViewProvider | null,
    maxDistanceM = 50
  ): StreetViewResult {
    return resolveStreetView(point, travelHeadingDeg, provider, maxDistanceM);
  }
}
