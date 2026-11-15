import type { OutingDetail, OutingPoint } from '@/features/compte/server/sorties';
import { isOutingMetricVisible } from '@/features/compte/domain/metricVisibility';
import type {
  ActivityReplayManifest,
  AudienceLevel,
  CameraKeyframe,
  FlybyDetectionResult,
  FlyoverTimeline,
  GeoPoint,
  GeolocatedGalleryResult,
  PublishableTrackProjection,
  ReplayHighlight,
  SanitizedMediaItem,
  ShareCardSpec,
  SportKind,
  TrackMediaMarker,
  TransparentStickerSpec,
  WebEmbedPayload,
} from '@/features/media-sharing/types';

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

function haversineM(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6_371_000;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const sLat = Math.sin(dLat / 2);
  const sLng = Math.sin(dLng / 2);
  const h = sLat * sLat + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * sLng * sLng;
  return 2 * R * Math.atan2(Math.sqrt(h), Math.sqrt(Math.max(0, 1 - h)));
}

function bearingDeg(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const dLng = toRad(b.lng - a.lng);
  const y = Math.sin(dLng) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

function mapOutingSport(sport: string | null): SportKind {
  switch ((sport ?? '').toLowerCase()) {
    case 'trail':
    case 'trail_running':
    case 'running':
      return 'trail_running';
    case 'mtb':
    case 'vtt':
      return 'mtb';
    case 'gravel':
      return 'gravel';
    case 'cycling':
    case 'road':
    case 'road_cycling':
    case 'velo':
      return 'cycling';
    case 'ski':
    case 'ski_touring':
      return 'ski_touring';
    case 'alpinism':
    case 'mountaineering':
      return 'alpinism';
    case 'rando':
    case 'hike':
    case 'hiking':
    case 'walk':
      return 'hiking';
    default:
      return 'other';
  }
}

function mapOutingAudience(visibility: OutingDetail['visibility']): AudienceLevel {
  return visibility === 'collective_anonymized' ? 'public' : 'private';
}

function toGeoPoints(detail: OutingDetail): GeoPoint[] {
  if (detail.traceFullyMasked || detail.traceError) return [];
  const rawSegments = Array.isArray(detail.traceSegments) ? detail.traceSegments : [];
  const pts: OutingPoint[] = rawSegments.filter((s) => s.length >= 2).flat();
  return pts.map((pt) => ({
    lat: pt.lat,
    lng: pt.lng,
    elevationM: pt.elevationM,
    timestampMs: pt.timestamp ? Date.parse(pt.timestamp) || null : null,
  }));
}

function projectSvgPath(points: readonly Pick<GeoPoint, 'lat' | 'lng'>[], width = 240, height = 140): string {
  if (points.length === 0) return '';
  if (points.length === 1) return `M ${Math.round(width / 2)} ${Math.round(height / 2)} L ${Math.round(width / 2)} ${Math.round(height / 2)}`;
  let minLat = Infinity;
  let maxLat = -Infinity;
  let minLng = Infinity;
  let maxLng = -Infinity;
  for (const p of points) {
    if (p.lat < minLat) minLat = p.lat;
    if (p.lat > maxLat) maxLat = p.lat;
    if (p.lng < minLng) minLng = p.lng;
    if (p.lng > maxLng) maxLng = p.lng;
  }
  const spanLng = Math.max(1e-6, maxLng - minLng);
  const spanLat = Math.max(1e-6, maxLat - minLat);
  const pad = 12;
  const innerW = width - pad * 2;
  const innerH = height - pad * 2;
  return points
    .map((p, idx) => {
      const x = pad + ((p.lng - minLng) / spanLng) * innerW;
      const y = pad + (1 - (p.lat - minLat) / spanLat) * innerH;
      return `${idx === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(' ');
}

function formatDurShort(sec: number): string {
  const mTotal = Math.max(0, Math.round(sec / 60));
  const h = Math.floor(mTotal / 60);
  const m = mTotal % 60;
  return h > 0 ? `${h}h${String(m).padStart(2, '0')}` : `${m} min`;
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export interface OutingMediaSharingBundle {
  track: PublishableTrackProjection;
  gallery: GeolocatedGalleryResult;
  timeline: FlyoverTimeline;
  replay: ActivityReplayManifest;
  flyby: FlybyDetectionResult;
  externalShare: {
    embed: WebEmbedPayload;
    card: ShareCardSpec;
    sticker: TransparentStickerSpec;
  };
}

/**
 * Construit de manière déterministe et fail-closed les projections C04 depuis
 * un `OutingDetail` déjà projeté côté serveur (C-PRIV : aucune coordonnée
 * masquée réintroduite, EXIF toujours marqués retirés).
 */
export function buildOutingMediaSharingBundle(detail: OutingDetail): OutingMediaSharingBundle {
  const points = toGeoPoints(detail);
  const audience = mapOutingAudience(detail.visibility);
  const sport = mapOutingSport(detail.sport);
  const maskVersion = detail.traceMasked ? 'v1-masked' : 'v1-clear';

  const distVisible = isOutingMetricVisible(detail.metricVisibility, 'distance');
  const gainVisible = isOutingMetricVisible(detail.metricVisibility, 'elevationGain');
  const durVisible = isOutingMetricVisible(detail.metricVisibility, 'duration');

  let computedDistM = 0;
  for (let i = 1; i < points.length; i += 1) {
    computedDistM += haversineM(points[i - 1], points[i]);
  }
  const totalDistanceM =
    distVisible && typeof detail.km === 'number' && Number.isFinite(detail.km)
      ? Math.round(detail.km * 1000)
      : Math.round(computedDistM);
  const elevationGainM =
    gainVisible && typeof detail.dplus === 'number' && Number.isFinite(detail.dplus)
      ? Math.round(detail.dplus)
      : 0;
  const durationSec =
    durVisible && typeof detail.durationS === 'number' && Number.isFinite(detail.durationS)
      ? Math.round(detail.durationS)
      : 0;

  const track: PublishableTrackProjection = {
    trackId: detail.id,
    ownerId: 'owner',
    title: detail.title,
    sport,
    audience,
    maskVersion,
    points,
    maskedPointCount: detail.traceMasked ? 1 : 0,
    totalDistanceM,
    elevationGainM,
    durationSec,
    startedAtMs: detail.startedAt ? Date.parse(detail.startedAt) || null : null,
    endedAtMs: detail.endedAt ? Date.parse(detail.endedAt) || null : null,
  };

  // Médias assainis + marqueurs répartis sur les points visibles (sans EXIF brut)
  const items: SanitizedMediaItem[] = detail.photos.map((photo, index) => {
    const isVideo = /\.(mp4|mov|webm)(\?|$)/i.test(photo.url);
    const pointIdx =
      points.length > 0
        ? Math.min(
            points.length - 1,
            Math.round(((index + 0.5) / Math.max(1, detail.photos.length)) * (points.length - 1)),
          )
        : -1;
    const anchor = pointIdx >= 0 ? points[pointIdx] : null;
    return {
      id: photo.id,
      activityId: detail.id,
      kind: isVideo ? 'video' : 'photo',
      url: photo.url,
      thumbnailUrl: photo.url,
      mimeType: isVideo ? 'video/mp4' : 'image/jpeg',
      caption: photo.caption || null,
      orderIndex: index,
      capturedAtMs: photo.createdAt ? Date.parse(photo.createdAt) || null : null,
      location: anchor
        ? { lat: anchor.lat, lng: anchor.lng, elevationM: anchor.elevationM ?? null }
        : null,
      durationSec: null,
      exifStripped: true,
    };
  });

  const markers: TrackMediaMarker[] = items
    .filter((item): item is SanitizedMediaItem & { location: NonNullable<SanitizedMediaItem['location']> } => item.location !== null)
    .map((item, idx, arr) => ({
      mediaId: item.id,
      kind: item.kind,
      orderIndex: item.orderIndex,
      distanceAlongTrackM:
        totalDistanceM > 0 ? Math.round(((idx + 0.5) / Math.max(1, arr.length)) * totalDistanceM) : 0,
      elapsedSec:
        durationSec > 0 ? Math.round(((idx + 0.5) / Math.max(1, arr.length)) * durationSec) : null,
      location: item.location,
      thumbnailUrl: item.thumbnailUrl,
      caption: item.caption,
    }));

  const gallery: GeolocatedGalleryResult = {
    authorized: true,
    maskVersion,
    items,
    markers,
    filteredOutCount: 0,
  };

  // Timeline Flyover 3D (max 36 images clés déterministes)
  const keyframes: CameraKeyframe[] = [];
  const step = Math.max(1, Math.floor(points.length / 32));
  const flyoverDuration = points.length >= 2 ? 20 : 0;
  for (let i = 0; i < points.length; i += step) {
    const pt = points[i];
    const next = points[Math.min(points.length - 1, i + 1)];
    const progress = points.length > 1 ? i / (points.length - 1) : 0;
    keyframes.push({
      tSec: Number((progress * flyoverDuration).toFixed(2)),
      progress,
      lat: pt.lat,
      lng: pt.lng,
      elevationM: pt.elevationM ?? 0,
      bearingDeg: bearingDeg(pt, next),
      pitchDeg: 55,
      zoom: 14.5,
      speedMps: 4.5,
      statCallout: {
        distanceM: Math.round(progress * totalDistanceM),
        elevationGainM: Math.round(progress * elevationGainM),
      },
    });
  }

  const timeline: FlyoverTimeline = {
    trackId: detail.id,
    maskVersion,
    durationSec: flyoverDuration,
    fps: 30,
    keyframes,
    attachedMediaCount: markers.length,
    generatedAtMs: 0,
  };

  // Replay highlights
  const highlights: ReplayHighlight[] = [];
  if (points.length >= 2) {
    highlights.push({
      id: 'start',
      tSec: 0,
      progress: 0,
      kind: 'start',
      label: 'Départ',
      lat: points[0].lat,
      lng: points[0].lng,
      elevationM: points[0].elevationM ?? null,
    });
    let maxElePt = points[0];
    let maxEleIdx = 0;
    for (let i = 1; i < points.length; i += 1) {
      if ((points[i].elevationM ?? -Infinity) > (maxElePt.elevationM ?? -Infinity)) {
        maxElePt = points[i];
        maxEleIdx = i;
      }
    }
    if (maxElePt.elevationM !== null && maxElePt.elevationM !== undefined) {
      const p = maxEleIdx / (points.length - 1);
      highlights.push({
        id: 'peak',
        tSec: Number((p * flyoverDuration).toFixed(2)),
        progress: p,
        kind: 'peak',
        label: `Point haut ${Math.round(maxElePt.elevationM)} m`,
        lat: maxElePt.lat,
        lng: maxElePt.lng,
        elevationM: maxElePt.elevationM,
      });
    }
    const last = points[points.length - 1];
    highlights.push({
      id: 'finish',
      tSec: flyoverDuration,
      progress: 1,
      kind: 'finish',
      label: 'Arrivée',
      lat: last.lat,
      lng: last.lng,
      elevationM: last.elevationM ?? null,
    });
  }

  const replay: ActivityReplayManifest = {
    trackId: detail.id,
    maskVersion,
    audience,
    durationSec: flyoverDuration,
    points: points.map((p, idx) => ({
      lat: p.lat,
      lng: p.lng,
      elevationM: p.elevationM ?? null,
      progress: points.length > 1 ? idx / (points.length - 1) : 0,
    })),
    highlights,
    fallbackPreviewUrl: detail.coverUrl,
  };

  const flyby: FlybyDetectionResult =
    audience === 'private'
      ? { enabled: false, reason: 'primary_private', crossings: [], excludedCount: 0 }
      : { enabled: true, crossings: [], excludedCount: 0 };

  const simplified = points
    .filter((_, idx) => idx === 0 || idx === points.length - 1 || idx % Math.max(1, Math.floor(points.length / 48)) === 0)
    .map((p) => ({ lat: p.lat, lng: p.lng }));
  const routeSvgPath = projectSvgPath(simplified);
  const elevationProfile = points
    .filter((_, idx) => idx % Math.max(1, Math.floor(points.length / 32)) === 0)
    .map((p, idx, arr) => ({
      distanceM: Math.round((idx / Math.max(1, arr.length - 1)) * totalDistanceM),
      elevationM: p.elevationM ?? null,
    }));

  const isPublic = audience === 'public';
  const embed: WebEmbedPayload = isPublic
    ? {
        authorized: true,
        trackId: detail.id,
        maskVersion,
        title: detail.title,
        sport,
        totalDistanceM,
        elevationGainM,
        simplifiedPoints: simplified,
        elevationProfile,
        embedHtml: `<iframe src="/embed/activities/${encodeURIComponent(detail.id)}" width="640" height="400" loading="lazy" title="${escapeXml(detail.title)}"></iframe>`,
        noExif: true,
      }
    : {
        authorized: false,
        reason: 'audience_not_public',
        trackId: detail.id,
        maskVersion,
        title: detail.title,
        sport,
        totalDistanceM: 0,
        elevationGainM: 0,
        simplifiedPoints: [],
        elevationProfile: [],
        embedHtml: '',
        noExif: true,
      };

  const shareAllowed = audience !== 'private';
  const card: ShareCardSpec = shareAllowed
    ? {
        authorized: true,
        trackId: detail.id,
        maskVersion,
        theme: 'outdoor',
        title: detail.title,
        sport,
        stats: {
          distanceKm: Number((totalDistanceM / 1000).toFixed(1)),
          elevationGainM,
          durationFormatted: formatDurShort(durationSec),
        },
        routeSvgPath,
        heroPhotoUrl: detail.coverUrl,
        noExif: true,
      }
    : {
        authorized: false,
        reason: 'audience_not_shareable',
        trackId: detail.id,
        maskVersion,
        theme: 'outdoor',
        title: detail.title,
        sport,
        stats: { distanceKm: 0, elevationGainM: 0, durationFormatted: '0 min' },
        routeSvgPath: '',
        heroPhotoUrl: null,
        noExif: true,
      };

  const sticker: TransparentStickerSpec = shareAllowed
    ? {
        authorized: true,
        trackId: detail.id,
        maskVersion,
        width: 240,
        height: 140,
        routeSvgPath,
        svgMarkup: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 140" width="240" height="140"><path d="${escapeXml(routeSvgPath)}" fill="none" stroke="#10b981" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
        noExif: true,
      }
    : {
        authorized: false,
        reason: 'audience_not_shareable',
        trackId: detail.id,
        maskVersion,
        width: 240,
        height: 140,
        routeSvgPath: '',
        svgMarkup: '',
        noExif: true,
      };

  return {
    track,
    gallery,
    timeline,
    replay,
    flyby,
    externalShare: { embed, card, sticker },
  };
}
