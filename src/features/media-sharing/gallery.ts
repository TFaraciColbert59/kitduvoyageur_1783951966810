import {
  canViewAudience,
  haversineDistanceM,
  isPointInPrivacyZone,
  isValidCoord,
} from './privacy';
import type {
  ActivityMediaItem,
  GeolocatedGalleryResult,
  MediaKind,
  PrivacyZone,
  PublishableTrackProjection,
  SanitizedMediaItem,
  TrackMediaMarker,
  ViewerContext,
} from './types';

export interface LiveTrackingSessionState {
  activityId: string;
  ownerId: string;
  gpsTrackingActive: boolean;
  lastKnownPoint: { lat: number; lng: number; elevationM?: number | null } | null;
  media: ActivityMediaItem[];
}

export interface CaptureMediaInput {
  id: string;
  kind: MediaKind;
  url: string;
  thumbnailUrl?: string | null;
  mimeType: string;
  caption?: string | null;
  capturedAtMs: number;
  location?: { lat: number; lng: number; elevationM?: number | null } | null;
  durationSec?: number | null;
}

/**
 * K5.05 — Ouvre la caméra / capture un média pendant le suivi sans interrompre le GPS.
 * Retourne le nouvel état de session avec `gpsTrackingActive` préservé.
 */
export function captureMediaDuringTracking(
  session: LiveTrackingSessionState,
  input: CaptureMediaInput,
): {
  session: LiveTrackingSessionState;
  capturedItem: ActivityMediaItem;
  gpsInterrupted: false;
} {
  const nextOrder =
    session.media.length > 0
      ? Math.max(...session.media.map((m) => m.orderIndex)) + 1
      : 0;

  const resolvedLocation = input.location ?? session.lastKnownPoint ?? null;

  const capturedItem: ActivityMediaItem = {
    id: input.id,
    activityId: session.activityId,
    ownerId: session.ownerId,
    kind: input.kind,
    url: input.url,
    thumbnailUrl: input.thumbnailUrl ?? null,
    mimeType: input.mimeType,
    caption: input.caption ?? null,
    orderIndex: nextOrder,
    capturedAtMs: input.capturedAtMs,
    location: resolvedLocation
      ? {
          lat: resolvedLocation.lat,
          lng: resolvedLocation.lng,
          elevationM: resolvedLocation.elevationM ?? null,
        }
      : null,
    durationSec: input.kind === 'video' ? (input.durationSec ?? 0) : null,
    exif: null,
  };

  return {
    session: {
      ...session,
      gpsTrackingActive: session.gpsTrackingActive,
      media: [...session.media, capturedItem],
    },
    capturedItem,
    gpsInterrupted: false,
  };
}

/**
 * S1.21 — Ajoute une photo ou une vidéo à la sortie en normalisant l'ordre.
 */
export function addActivityMedia(
  items: readonly ActivityMediaItem[],
  newItem: Omit<ActivityMediaItem, 'orderIndex'>,
): ActivityMediaItem[] {
  const sorted = [...items].sort((a, b) => a.orderIndex - b.orderIndex);
  const appended: ActivityMediaItem = {
    ...newItem,
    durationSec: newItem.kind === 'video' ? (newItem.durationSec ?? 0) : null,
    orderIndex: sorted.length,
  };
  return normalizeOrder([...sorted, appended]);
}

/**
 * S1.21 — Réordonne les médias selon la liste d'IDs fournie (les IDs absents conservent leur ordre relatif à la fin).
 */
export function reorderActivityMedia(
  items: readonly ActivityMediaItem[],
  orderedIds: readonly string[],
): ActivityMediaItem[] {
  const byId = new Map(items.map((item) => [item.id, item]));
  const result: ActivityMediaItem[] = [];
  const seen = new Set<string>();

  for (const id of orderedIds) {
    const item = byId.get(id);
    if (item && !seen.has(id)) {
      result.push(item);
      seen.add(id);
    }
  }
  for (const item of [...items].sort((a, b) => a.orderIndex - b.orderIndex)) {
    if (!seen.has(item.id)) {
      result.push(item);
    }
  }
  return normalizeOrder(result);
}

/**
 * S1.21 — Retire un média et renumérote l'ordre.
 */
export function removeActivityMedia(
  items: readonly ActivityMediaItem[],
  mediaId: string,
): ActivityMediaItem[] {
  return normalizeOrder(
    [...items]
      .filter((item) => item.id !== mediaId)
      .sort((a, b) => a.orderIndex - b.orderIndex),
  );
}

function normalizeOrder(items: ActivityMediaItem[]): ActivityMediaItem[] {
  return items.map((item, idx) => ({ ...item, orderIndex: idx }));
}

/**
 * Supprime toutes les métadonnées EXIF privées avant exposition publique.
 */
export function sanitizeMediaItem(item: ActivityMediaItem): SanitizedMediaItem {
  return {
    id: item.id,
    activityId: item.activityId,
    kind: item.kind,
    url: item.url,
    thumbnailUrl: item.thumbnailUrl ?? null,
    mimeType: item.mimeType,
    caption: item.caption ?? null,
    orderIndex: item.orderIndex,
    capturedAtMs: item.capturedAtMs,
    location:
      item.location && isValidCoord(item.location.lat, item.location.lng)
        ? {
            lat: item.location.lat,
            lng: item.location.lng,
            elevationM: item.location.elevationM ?? null,
          }
        : null,
    durationSec: item.kind === 'video' ? (item.durationSec ?? null) : null,
    exifStripped: true,
  };
}

/**
 * Calcule les distances cumulées le long de la trace publiable.
 */
function computeCumulativeDistances(track: PublishableTrackProjection): number[] {
  const distances: number[] = [];
  let acc = 0;
  for (let i = 0; i < track.points.length; i += 1) {
    if (i > 0) {
      acc += haversineDistanceM(track.points[i - 1], track.points[i]);
    }
    distances.push(acc);
  }
  return distances;
}

/**
 * K5.06 — Construit la galerie géolocalisée et les repères chronologiques sur la trace.
 * Invariant fail-closed :
 * 1. Vérifie l'audience du lecteur avant toute exposition.
 * 2. Exclut tout média situé dans une zone masquée (K7.05 / S6.14).
 * 3. Supprime les EXIF privés de chaque média retourné.
 */
export function buildGeolocatedMediaGallery(input: {
  mediaItems: readonly ActivityMediaItem[];
  track: PublishableTrackProjection;
  privacyZones: readonly PrivacyZone[];
  viewer: ViewerContext;
}): GeolocatedGalleryResult {
  const auth = canViewAudience(input.track.ownerId, input.track.audience, input.viewer);
  if (!auth.authorized) {
    return {
      authorized: false,
      reason: auth.reason,
      maskVersion: input.track.maskVersion,
      items: [],
      markers: [],
      filteredOutCount: input.mediaItems.length,
    };
  }

  const cumulativeDistances = computeCumulativeDistances(input.track);
  const visibleItems: SanitizedMediaItem[] = [];
  const markers: TrackMediaMarker[] = [];
  let filteredOutCount = 0;

  const sortedMedia = [...input.mediaItems].sort((a, b) => a.orderIndex - b.orderIndex);

  for (const raw of sortedMedia) {
    const loc =
      raw.location ??
      (raw.exif?.gpsLat !== null &&
      raw.exif?.gpsLat !== undefined &&
      raw.exif?.gpsLng !== null &&
      raw.exif?.gpsLng !== undefined
        ? {
            lat: raw.exif.gpsLat,
            lng: raw.exif.gpsLng,
            elevationM: raw.exif.gpsAltitudeM ?? null,
          }
        : null);

    // Fail-closed : si le média est géolocalisé dans une zone masquée, il est exclu.
    if (loc && isPointInPrivacyZone(loc, input.privacyZones)) {
      filteredOutCount += 1;
      continue;
    }

    const sanitized = sanitizeMediaItem({
      ...raw,
      location: loc,
      exif: null,
    });
    visibleItems.push(sanitized);

    if (sanitized.location && input.track.points.length > 0) {
      let bestIdx = 0;
      let bestDist = Number.POSITIVE_INFINITY;
      for (let i = 0; i < input.track.points.length; i += 1) {
        const d = haversineDistanceM(sanitized.location, input.track.points[i]);
        if (d < bestDist) {
          bestDist = d;
          bestIdx = i;
        }
      }
      const matchedPt = input.track.points[bestIdx];
      const elapsedSec =
        sanitized.capturedAtMs !== null && input.track.startedAtMs !== null
          ? Math.max(0, Math.round((sanitized.capturedAtMs - input.track.startedAtMs) / 1000))
          : matchedPt.timestampMs !== null &&
              matchedPt.timestampMs !== undefined &&
              input.track.startedAtMs !== null
            ? Math.max(0, Math.round((matchedPt.timestampMs - input.track.startedAtMs) / 1000))
            : null;

      markers.push({
        mediaId: sanitized.id,
        kind: sanitized.kind,
        orderIndex: sanitized.orderIndex,
        distanceAlongTrackM: Math.round(cumulativeDistances[bestIdx] ?? 0),
        elapsedSec,
        location: sanitized.location,
        thumbnailUrl: sanitized.thumbnailUrl,
        caption: sanitized.caption,
      });
    }
  }

  markers.sort((a, b) => {
    if (a.distanceAlongTrackM !== b.distanceAlongTrackM) {
      return a.distanceAlongTrackM - b.distanceAlongTrackM;
    }
    return a.orderIndex - b.orderIndex;
  });

  return {
    authorized: true,
    maskVersion: input.track.maskVersion,
    items: visibleItems,
    markers,
    filteredOutCount,
  };
}
