import type { ClubOutingData } from '../ClubDrawerTypes';

export interface OutingElevationSample {
  km: number;
  ele: number;
  slopePct: number;
  lat: number;
  lng: number;
}

export interface OutingRouteAnalysis {
  samples: OutingElevationSample[];
  hasRealTrace: boolean;
  isTraversal: boolean;
  startLat: number;
  startLng: number;
  endLat: number;
  endLng: number;
  minAlt: number;
  maxAlt: number;
  estimatedHoursP50: number;
  estimatedHoursP90: number;
  ibpScore: number;
}

/** Retire les métriques redondantes du titre ex. "Circuit de Leschaux (55.9 km · +865 m)". */
export function cleanOutingTitle(title: string): string {
  return title.replace(/\s*\([^)]*(?:km|\+\s*\d+\s*m)[^)]*\)\s*$/i, '').trim() || title;
}

export function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(a)));
}

export function formatDurationHours(hours: number): string {
  const safe = Math.max(0.5, hours);
  const h = Math.floor(safe);
  const m = Math.round((safe - h) * 60);
  if (m === 0) return `${h}h`;
  if (m === 60) return `${h + 1}h`;
  return `${h}h${String(m).padStart(2, '0')}`;
}

export function formatClockLabel(iso?: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return new Intl.DateTimeFormat('fr-FR', { hour: '2-digit', minute: '2-digit' })
    .format(d)
    .replace(':', 'h');
}

export function computeOutingRouteAnalysis(outing: ClubOutingData): OutingRouteAnalysis {
  const rawTrace = Array.isArray(outing.routeTrace) ? outing.routeTrace : [];
  const kmTotal = Math.max(1, Number(outing.km) || 10);
  const dplus = Math.max(0, Number(outing.dplus) || 400);
  const maxAltFallback = Math.max(600, Number(outing.maxAlt) || 1800);
  const minAltFallback = Math.max(200, maxAltFallback - Math.round(dplus * 0.82));

  // Naismith + Alpine Tobler estimation
  const baseHours = kmTotal / 4.2 + dplus / 480;
  const estimatedHoursP50 = Number(Math.max(0.75, baseHours).toFixed(2));
  const estimatedHoursP90 = Number(Math.max(estimatedHoursP50 + 0.5, baseHours * 1.22).toFixed(2));
  const ibpScore = Math.round(kmTotal * 1.65 + dplus * 0.048 + (maxAltFallback > 2500 ? 12 : 0));

  if (rawTrace.length >= 2) {
    const step = Math.max(1, Math.floor(rawTrace.length / 44));
    const sampled: OutingElevationSample[] = [];
    let accKm = 0;
    let prevLng = rawTrace[0][0];
    let prevLat = rawTrace[0][1];
    let prevEle = typeof rawTrace[0][2] === 'number' ? rawTrace[0][2] : minAltFallback;

    for (let i = 0; i < rawTrace.length; i += 1) {
      const pt = rawTrace[i];
      const lng = pt[0];
      const lat = pt[1];
      const progress = i / Math.max(1, rawTrace.length - 1);
      const syntheticEle = Math.round(
        minAltFallback + Math.sin(progress * Math.PI) * Math.max(120, maxAltFallback - minAltFallback),
      );
      const ele = typeof pt[2] === 'number' && Number.isFinite(pt[2]) ? Math.round(pt[2]) : syntheticEle;

      if (i > 0) {
        accKm += haversineKm(prevLat, prevLng, lat, lng);
      }

      const isEdge = i === 0 || i === rawTrace.length - 1;
      if (isEdge || i % step === 0) {
        const segKm = Math.max(0.08, haversineKm(prevLat, prevLng, lat, lng));
        const slopePct = i === 0 ? 0 : Math.max(-45, Math.min(45, Math.round(((ele - prevEle) / (segKm * 1000)) * 100)));
        sampled.push({
          km: Number(accKm.toFixed(1)),
          ele,
          slopePct,
          lat,
          lng,
        });
      }
      prevLng = lng;
      prevLat = lat;
      prevEle = ele;
    }

    const start = rawTrace[0];
    const end = rawTrace[rawTrace.length - 1];
    const startEndDistKm = haversineKm(start[1], start[0], end[1], end[0]);
    const eles = sampled.map((s) => s.ele);

    return {
      samples: sampled,
      hasRealTrace: true,
      isTraversal: startEndDistKm >= 0.45,
      startLat: start[1],
      startLng: start[0],
      endLat: end[1],
      endLng: end[0],
      minAlt: Math.min(...eles),
      maxAlt: Math.max(...eles),
      estimatedHoursP50,
      estimatedHoursP90,
      ibpScore,
    };
  }

  // Fallback smooth profile when routeTrace is not loaded yet
  const fallbackSamples: OutingElevationSample[] = Array.from({ length: 16 }, (_, i) => {
    const p = i / 15;
    const ele = Math.round(minAltFallback + Math.sin(p * Math.PI) * (maxAltFallback - minAltFallback));
    const prevE =
      i === 0
        ? ele
        : Math.round(minAltFallback + Math.sin(((i - 1) / 15) * Math.PI) * (maxAltFallback - minAltFallback));
    const slopePct = i === 0 ? 0 : Math.round(((ele - prevE) / ((kmTotal / 15) * 1000)) * 100);
    return {
      km: Number((p * kmTotal).toFixed(1)),
      ele,
      slopePct,
      lat: outing.lat,
      lng: outing.lng,
    };
  });

  return {
    samples: fallbackSamples,
    hasRealTrace: false,
    isTraversal: false,
    startLat: outing.lat,
    startLng: outing.lng,
    endLat: outing.lat,
    endLng: outing.lng,
    minAlt: minAltFallback,
    maxAlt: maxAltFallback,
    estimatedHoursP50,
    estimatedHoursP90,
    ibpScore,
  };
}

export function downloadRealOutingGpx(outing: ClubOutingData): boolean {
  if (typeof window === 'undefined' || typeof document === 'undefined') return false;
  const title = cleanOutingTitle(outing.title).replace(/[<>&"']/g, '');
  const trace =
    Array.isArray(outing.routeTrace) && outing.routeTrace.length >= 2
      ? outing.routeTrace
      : ([[outing.lng, outing.lat, outing.maxAlt || 1200]] as Array<[number, number, number]>);

  const trkpts = trace
    .map((pt) => {
      const eleTag = typeof pt[2] === 'number' && Number.isFinite(pt[2]) ? `<ele>${Math.round(pt[2])}</ele>` : '';
      return `      <trkpt lat="${pt[1].toFixed(6)}" lon="${pt[0].toFixed(6)}">${eleTag}</trkpt>`;
    })
    .join('\n');

  const gpx = `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="Le Kit du Voyageur" xmlns="http://www.topografix.com/GPX/1/1">
  <metadata><name>${title}</name></metadata>
  <trk>
    <name>${title}</name>
    <trkseg>
${trkpts}
    </trkseg>
  </trk>
</gpx>`;

  const blob = new Blob([gpx], { type: 'application/gpx+xml;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'sortie'}.gpx`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  return true;
}

export function downloadOutingIcs(outing: ClubOutingData): boolean {
  if (typeof window === 'undefined' || typeof document === 'undefined') return false;
  const start = outing.startsAtIso ? new Date(outing.startsAtIso) : new Date();
  const safeStart = Number.isNaN(start.getTime()) ? new Date() : start;
  const end = outing.endsAtIso
    ? new Date(outing.endsAtIso)
    : new Date(safeStart.getTime() + 6 * 3600 * 1000);
  const fmt = (d: Date) =>
    d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
  const title = cleanOutingTitle(outing.title);
  const ics = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Le Kit du Voyageur//Club Outing//FR',
    'BEGIN:VEVENT',
    `UID:lkdv-club-event-${outing.id}@lekitduvoyageur.fr`,
    `DTSTAMP:${fmt(new Date())}`,
    `DTSTART:${fmt(safeStart)}`,
    `DTEND:${fmt(Number.isNaN(end.getTime()) ? safeStart : end)}`,
    `SUMMARY:${title}`,
    `LOCATION:${outing.meetingPoint || outing.massif || ''}`,
    `DESCRIPTION:${(outing.description || `${outing.km} km · +${outing.dplus} m`).replace(/\n/g, '\\n')}`,
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n');

  const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${title.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 40) || 'sortie'}.ics`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  return true;
}
