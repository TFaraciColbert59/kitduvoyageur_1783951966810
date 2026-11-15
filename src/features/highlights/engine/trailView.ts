import type {
  GeoPoint,
  PublicRouteActivity,
  RouteActivity,
  RouteCommunityMedia,
  RoutePhoto,
  TrailPhotoMarker,
  Viewer,
} from '../types';
import { isValidPoint } from '../privacy';
import { bearingDeg, projectOnPolyline } from './geometry';

function isSafeMediaUrl(url: string): boolean {
  if (url.startsWith('/')) return !url.startsWith('//');
  try {
    return new URL(url).protocol === 'https:';
  } catch {
    return false;
  }
}

function canPublishRoutePhoto(photo: RoutePhoto): boolean {
  return (
    photo.audience === 'public' &&
    photo.consentPublic &&
    photo.exifStripped &&
    !photo.masked &&
    isSafeMediaUrl(photo.url)
  );
}

function tangentBearing(
  points: readonly GeoPoint[],
  segmentIndex: number,
  fallback: GeoPoint
): number {
  const from = points[segmentIndex];
  const to = points[segmentIndex + 1] ?? points[segmentIndex - 1] ?? fallback;
  return bearingDeg(from, to);
}

export interface IndexTrailPhotosOptions {
  maxOffsetM?: number;
  limit?: number;
}

/**
 * K2.26 — indexe les photos éligibles sur la géométrie du parcours.
 * La sortie ne contient AUCUNE coordonnée : seulement la distance parcourue
 * et le cap, pour que la galerie s'ouvre au bon endroit sans exposer le point.
 */
export function indexTrailPhotos(
  route: { id: string; points: readonly GeoPoint[] },
  photos: readonly RoutePhoto[],
  options: IndexTrailPhotosOptions = {}
): TrailPhotoMarker[] {
  const maxOffsetM = options.maxOffsetM ?? 150;
  const limit = options.limit ?? 60;
  if (route.points.length === 0) return [];

  const markers: TrailPhotoMarker[] = [];
  const seen = new Set<string>();
  for (const photo of photos) {
    if (photo.routeId !== route.id || seen.has(photo.id)) continue;
    if (!canPublishRoutePhoto(photo)) continue;
    const location = photo.location;
    if (!isValidPoint(location)) continue;
    const projection = projectOnPolyline(location, route.points);
    if (!projection || projection.distanceM > maxOffsetM) continue;
    seen.add(photo.id);
    markers.push({
      photoId: photo.id,
      url: photo.url,
      caption: photo.caption,
      authorName: photo.authorName,
      distanceAlongM: Math.round(projection.alongM * 10) / 10,
      offsetM: Math.round(projection.distanceM * 10) / 10,
      bearingDeg: Math.round(
        tangentBearing(route.points, projection.segmentIndex, projection.point)
      ),
    });
  }

  markers.sort((a, b) => a.distanceAlongM - b.distanceAlongM || a.photoId.localeCompare(b.photoId));
  return markers.slice(0, limit);
}

function canPublishActivity(activity: RouteActivity, viewer: Viewer): boolean {
  if (activity.audience === 'public') return true;
  if (activity.audience === 'followers') return viewer.relation === 'follower';
  return viewer.id != null && viewer.id === activity.userId;
}

export interface RouteMediaOptions {
  photosLimit?: number;
  activitiesLimit?: number;
}

/**
 * S3.05 — photos publiques et activités récentes d'une fiche parcours.
 * Une activité qui masque ses statistiques garde sa date et son sport, mais
 * distance et durée sortent à `null`. Jamais de trace ni de coordonnée.
 */
export function routeCommunityMedia(
  routeId: string,
  photos: readonly RoutePhoto[],
  activities: readonly RouteActivity[],
  viewer: Viewer,
  options: RouteMediaOptions = {}
): RouteCommunityMedia {
  const publicPhotos = photos
    .filter((photo) => photo.routeId === routeId && canPublishRoutePhoto(photo))
    .slice()
    .sort((a, b) => b.takenAt.localeCompare(a.takenAt) || a.id.localeCompare(b.id))
    .slice(0, options.photosLimit ?? 12)
    .map((photo) => ({
      id: photo.id,
      url: photo.url,
      caption: photo.caption,
      authorName: photo.authorName,
    }));

  const publicActivities: PublicRouteActivity[] = activities
    .filter((activity) => activity.routeId === routeId && canPublishActivity(activity, viewer))
    .slice()
    .sort((a, b) => b.date.localeCompare(a.date) || a.id.localeCompare(b.id))
    .slice(0, options.activitiesLimit ?? 8)
    .map((activity) => ({
      id: activity.id,
      displayName: activity.displayName,
      date: activity.date,
      sport: activity.sport,
      distanceKm: activity.hideStats ? null : activity.distanceKm,
      durationS: activity.hideStats ? null : activity.durationS,
    }));

  return { photos: publicPhotos, activities: publicActivities };
}
