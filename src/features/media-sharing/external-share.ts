import { haversineDistanceM } from './privacy';
import { simplifyTrackGeometry } from './protected-preview';
import type {
  GeoPoint,
  PublishableTrackProjection,
  SanitizedMediaItem,
  ShareCardSpec,
  TransparentStickerSpec,
  WebEmbedPayload,
} from './types';

function escapeHtmlAttr(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function formatDuration(durationSec: number): string {
  const totalMin = Math.max(0, Math.round(durationSec / 60));
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return h > 0 ? `${h}h${String(m).padStart(2, '0')}` : `${m} min`;
}

/**
 * Projette des points GPS normalisés en chemin SVG `<path d="...">` dans un viewBox donné.
 */
export function projectTrackToSvgPath(
  points: readonly Pick<GeoPoint, 'lat' | 'lng'>[],
  width = 240,
  height = 140,
  padding = 12,
): string {
  if (points.length === 0) return '';
  if (points.length === 1) {
    const cx = Math.round(width / 2);
    const cy = Math.round(height / 2);
    return `M ${cx} ${cy} L ${cx} ${cy}`;
  }

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
  const innerW = Math.max(1, width - padding * 2);
  const innerH = Math.max(1, height - padding * 2);

  return points
    .map((p, idx) => {
      const x = padding + ((p.lng - minLng) / spanLng) * innerW;
      const y = padding + (1 - (p.lat - minLat) / spanLat) * innerH;
      return `${idx === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(' ');
}

/**
 * K5.27 — Génère la charge d'intégration publique web (tracé simplifié + profil altimétrique + snippet iframe).
 * Fail-closed : refuse toute trace non publique (`audience !== 'public'`).
 */
export function buildWebEmbedPayload(
  track: PublishableTrackProjection,
  options: { baseUrl?: string; widthPx?: number; heightPx?: number } = {},
): WebEmbedPayload {
  if (track.audience !== 'public') {
    return {
      authorized: false,
      reason: 'audience_not_public',
      trackId: track.trackId,
      maskVersion: track.maskVersion,
      title: '',
      sport: track.sport,
      totalDistanceM: 0,
      elevationGainM: 0,
      simplifiedPoints: [],
      elevationProfile: [],
      embedHtml: '',
      noExif: true,
    };
  }

  const simplifiedPoints = simplifyTrackGeometry(track.points, 25);
  const elevationProfile: Array<{ distanceM: number; elevationM: number | null }> = [];
  let acc = 0;
  for (let i = 0; i < track.points.length; i += 1) {
    if (i > 0) {
      acc += haversineDistanceM(track.points[i - 1], track.points[i]);
    }
    elevationProfile.push({
      distanceM: Math.round(acc),
      elevationM: track.points[i].elevationM ?? null,
    });
  }

  const baseUrl = (options.baseUrl ?? 'https://kitduvoyageur.fr').replace(/\/+$/, '');
  const src = `${baseUrl}/embed/track/${encodeURIComponent(track.trackId)}?mv=${encodeURIComponent(track.maskVersion)}`;
  const widthPx = options.widthPx ?? 640;
  const heightPx = options.heightPx ?? 420;
  const embedHtml = `<iframe src="${escapeHtmlAttr(src)}" title="${escapeHtmlAttr(track.title)}" width="${widthPx}" height="${heightPx}" loading="lazy" sandbox="allow-scripts allow-same-origin" referrerpolicy="no-referrer"></iframe>`;

  return {
    authorized: true,
    trackId: track.trackId,
    maskVersion: track.maskVersion,
    title: track.title,
    sport: track.sport,
    totalDistanceM: track.totalDistanceM,
    elevationGainM: track.elevationGainM,
    simplifiedPoints,
    elevationProfile,
    embedHtml,
    noExif: true,
  };
}

/**
 * S5.25 — Génère une carte sportive visuelle partageable (sans EXIF).
 * Fail-closed : refuse les traces `private`.
 */
export function buildShareCard(
  track: PublishableTrackProjection,
  sanitizedGallery: readonly SanitizedMediaItem[],
  options: { theme?: ShareCardSpec['theme'] } = {},
): ShareCardSpec {
  if (track.audience === 'private') {
    return {
      authorized: false,
      reason: 'audience_not_shareable',
      trackId: track.trackId,
      maskVersion: track.maskVersion,
      theme: options.theme ?? 'outdoor',
      title: '',
      sport: track.sport,
      stats: { distanceKm: 0, elevationGainM: 0, durationFormatted: '0 min' },
      routeSvgPath: '',
      heroPhotoUrl: null,
      noExif: true,
    };
  }

  const simplified = simplifyTrackGeometry(track.points, 25);
  const routeSvgPath = projectTrackToSvgPath(simplified, 280, 140, 12);
  const heroPhoto = sanitizedGallery.find((m) => m.kind === 'photo') ?? null;

  return {
    authorized: true,
    trackId: track.trackId,
    maskVersion: track.maskVersion,
    theme: options.theme ?? 'outdoor',
    title: track.title,
    sport: track.sport,
    stats: {
      distanceKm: Number((track.totalDistanceM / 1000).toFixed(2)),
      elevationGainM: track.elevationGainM,
      durationFormatted: formatDuration(track.durationSec),
    },
    routeSvgPath,
    heroPhotoUrl: heroPhoto ? heroPhoto.url : null,
    noExif: true,
  };
}

/**
 * S5.25 — Génère un sticker transparent SVG (Instagram Stories / réseaux externes).
 * Fail-closed : refuse les traces `private`.
 */
export function buildTransparentSticker(
  track: PublishableTrackProjection,
  options: { width?: number; height?: number; strokeColor?: string } = {},
): TransparentStickerSpec {
  const width = options.width ?? 360;
  const height = options.height ?? 260;

  if (track.audience === 'private') {
    return {
      authorized: false,
      reason: 'audience_not_shareable',
      trackId: track.trackId,
      maskVersion: track.maskVersion,
      width,
      height,
      routeSvgPath: '',
      svgMarkup: '',
      noExif: true,
    };
  }

  const simplified = simplifyTrackGeometry(track.points, 25);
  const routeSvgPath = projectTrackToSvgPath(simplified, width, height - 80, 20);
  const strokeColor = options.strokeColor ?? '#FFFFFF';
  const distKm = (track.totalDistanceM / 1000).toFixed(1);
  const eleM = Math.round(track.elevationGainM);
  const dur = formatDuration(track.durationSec);

  const svgMarkup = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" fill="none">`,
    routeSvgPath
      ? `<path d="${escapeXml(routeSvgPath)}" stroke="${escapeXml(strokeColor)}" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" fill="none" />`
      : '',
    `<text x="20" y="${height - 44}" fill="${escapeXml(strokeColor)}" font-family="sans-serif" font-size="18" font-weight="700">${escapeXml(distKm)} km · +${eleM} m · ${escapeXml(dur)}</text>`,
    `<text x="20" y="${height - 20}" fill="${escapeXml(strokeColor)}" fill-opacity="0.8" font-family="sans-serif" font-size="13">${escapeXml(track.title)}</text>`,
    `</svg>`,
  ]
    .filter(Boolean)
    .join('');

  return {
    authorized: true,
    trackId: track.trackId,
    maskVersion: track.maskVersion,
    width,
    height,
    routeSvgPath,
    svgMarkup,
    noExif: true,
  };
}
