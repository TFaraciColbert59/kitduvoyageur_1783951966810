/**
 * Shared client handoff between Explorer post-activity summary and all
 * Community creation forms (`carnet`, `post`, `story`, `sortie`, `kit`, `club`).
 *
 * Persisted in `sessionStorage` with a 2-hour TTL so every harvested outing
 * metric (title, sport, GPS track, distance, duration, D+/D-, altitude, RPE,
 * weather, location, waypoints, notes) automatically adapts to whichever form
 * the user opens next.
 */

import type {
  CarnetDayV2,
  CarnetMomentV2,
  CreateKindV2,
  KitSeasonChoiceV2,
  KitSeasonV2,
  SortieActivityV2,
  SortieLevelV2,
} from '@/features/community/v2/create/engine/createSchemasV2';
import type { Sport } from './state/types';

export const OUTING_HANDOFF_STORAGE_KEY = 'lkdv.explorer.outingHandoff.v1';
const OUTING_HANDOFF_TTL_MS = 2 * 60 * 60_000;

export interface OutingHandoffWaypoint {
  id: string;
  kind: string;
  label: string;
  lat: number;
  lng: number;
  time?: string;
}

export interface ExplorerOutingHandoff {
  savedAt: number;
  sessionId: string | null;
  title: string;
  sport: Sport;
  sportLabel: string;
  startedAt: number;
  endedAt: number;
  distanceKm: number;
  movingS: number;
  elevGainM: number;
  elevLossM: number;
  maxAltitudeM: number | null;
  minAltitudeM: number | null;
  avgSpeedLabel: string | null;
  caloriesKcal: number;
  rpe: number;
  notes: string;
  locationLabel: string;
  center: [number, number] | null;
  weatherLabel: string | null;
  track: Array<[number, number]>;
  waypoints: OutingHandoffWaypoint[];
  photosCount: number;
}

export function decimateTrackLngLat(
  points: ReadonlyArray<{ lat: number; lng: number }>,
  maxPoints = 350,
): Array<[number, number]> {
  const valid: Array<[number, number]> = [];
  for (const pt of points) {
    if (
      Number.isFinite(pt.lng) &&
      Number.isFinite(pt.lat) &&
      Math.abs(pt.lat) <= 90 &&
      Math.abs(pt.lng) <= 180
    ) {
      valid.push([Math.round(pt.lng * 1e5) / 1e5, Math.round(pt.lat * 1e5) / 1e5]);
    }
  }
  if (valid.length <= maxPoints) return valid;
  const step = (valid.length - 1) / (maxPoints - 1);
  const out: Array<[number, number]> = [];
  for (let i = 0; i < maxPoints - 1; i += 1) {
    out.push(valid[Math.round(i * step)]);
  }
  out.push(valid[valid.length - 1]);
  return out;
}

export function saveExplorerOutingHandoff(handoff: ExplorerOutingHandoff): void {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.setItem(OUTING_HANDOFF_STORAGE_KEY, JSON.stringify(handoff));
  } catch {
    // Fallback without dense track if quota is tight
    try {
      const compact = { ...handoff, track: decimateTrackLngLat(handoff.track.map(([lng, lat]) => ({ lng, lat })), 80) };
      window.sessionStorage.setItem(OUTING_HANDOFF_STORAGE_KEY, JSON.stringify(compact));
    } catch {
      // ignore storage errors
    }
  }
}

export function readExplorerOutingHandoff(): ExplorerOutingHandoff | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.sessionStorage.getItem(OUTING_HANDOFF_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ExplorerOutingHandoff;
    if (!parsed || typeof parsed !== 'object' || typeof parsed.savedAt !== 'number') return null;
    if (Date.now() - parsed.savedAt > OUTING_HANDOFF_TTL_MS) {
      window.sessionStorage.removeItem(OUTING_HANDOFF_STORAGE_KEY);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function clearExplorerOutingHandoff(): void {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.removeItem(OUTING_HANDOFF_STORAGE_KEY);
  } catch {
    // ignore
  }
}

function isoDateFromMs(ms: number): string {
  const d = new Date(Number.isFinite(ms) ? ms : Date.now());
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function clockFromMs(ms: number): string {
  const d = new Date(Number.isFinite(ms) ? ms : Date.now());
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function formatDurationShort(totalSeconds: number): string {
  const safe = Math.max(0, Math.round(totalSeconds));
  const h = Math.floor(safe / 3600);
  const m = Math.floor((safe % 3600) / 60);
  if (h > 0) return `${h}h${String(m).padStart(2, '0')}`;
  return `${Math.max(1, m)} min`;
}

function sanitizeHashtag(raw: string): string {
  return raw
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '')
    .slice(0, 22);
}

function buildSmartTags(handoff: ExplorerOutingHandoff): string[] {
  const raw = [handoff.sportLabel, handoff.locationLabel.split(',')[0] ?? '', 'explorer'];
  const out: string[] = [];
  for (const item of raw) {
    const clean = sanitizeHashtag(item);
    if (clean.length >= 2 && !out.includes(clean)) out.push(clean);
  }
  return out.slice(0, 6);
}

function mapSportToSortieActivity(sport: Sport): SortieActivityV2 {
  switch (sport) {
    case 'rando':
    case 'bivouac':
    case 'famille':
      return 'rando';
    case 'trail':
    case 'course':
      return 'trail';
    case 'ski':
      return 'ski';
    case 'velo':
      return 'velo';
    case 'escalade':
      return 'escalade';
    default:
      return 'autre';
  }
}

function inferSortieLevel(handoff: ExplorerOutingHandoff): SortieLevelV2 {
  const score =
    (handoff.distanceKm >= 25 ? 2 : handoff.distanceKm >= 12 ? 1 : 0) +
    (handoff.elevGainM >= 1000 ? 2 : handoff.elevGainM >= 450 ? 1 : 0) +
    (handoff.rpe >= 8 ? 2 : handoff.rpe >= 6 ? 1 : 0);
  if (score >= 5) return 'expert';
  if (score >= 4) return 'difficile';
  if (score >= 2) return 'moyen';
  if (score >= 1) return 'facile';
  return 'tres_facile';
}

function inferSeasonFromMs(ms: number): { season: KitSeasonV2; seasons: KitSeasonChoiceV2[] } {
  const month = new Date(ms).getMonth() + 1;
  if (month === 12 || month <= 2) return { season: 'hiver', seasons: ['hiver'] };
  if (month >= 3 && month <= 5) return { season: 'printemps', seasons: ['printemps'] };
  if (month >= 6 && month <= 8) return { season: 'ete', seasons: ['ete'] };
  return { season: 'automne', seasons: ['automne'] };
}

function buildMetricsSummaryLine(handoff: ExplorerOutingHandoff): string {
  const parts: string[] = [];
  if (handoff.distanceKm > 0) parts.push(`${handoff.distanceKm.toFixed(1)} km`);
  if (handoff.movingS > 0) parts.push(formatDurationShort(handoff.movingS));
  if (handoff.elevGainM > 0) parts.push(`+${handoff.elevGainM} m D+`);
  if (handoff.avgSpeedLabel) parts.push(handoff.avgSpeedLabel);
  if (handoff.weatherLabel) parts.push(handoff.weatherLabel);
  return parts.join(' · ');
}

function buildCarnetDays(handoff: ExplorerOutingHandoff): CarnetDayV2[] {
  const dateIso = isoDateFromMs(handoff.startedAt);
  const moments: CarnetMomentV2[] = [];

  // Convert every GPS waypoint dropped during the outing into a real Carnet moment
  handoff.waypoints.forEach((wp, idx) => {
    const kind =
      wp.kind === 'bivouac'
        ? 'nuit'
        : wp.kind === 'fauna' || wp.kind === 'flora'
          ? 'espece'
          : 'photo';
    moments.push({
      id: `outing-wp-${idx + 1}-${wp.id}`,
      kind,
      title: wp.label || `Repère ${idx + 1}`,
      time: wp.time && /^([01]\d|2[0-3]):[0-5]\d$/.test(wp.time) ? wp.time : clockFromMs(handoff.startedAt),
      text: `${wp.label} (${wp.kind})`,
      place: handoff.locationLabel || '',
      lat: wp.lat,
      lng: wp.lng,
      photo: null,
      media: [],
      encounters: [],
    });
  });

  // Add field notes as a narrative moment if present
  if (handoff.notes.trim()) {
    moments.push({
      id: `outing-notes-${handoff.startedAt}`,
      kind: 'rencontre',
      title: 'Notes de terrain',
      time: clockFromMs(handoff.endedAt),
      text: handoff.notes.trim().slice(0, 500),
      place: handoff.locationLabel || '',
      lat: handoff.center ? handoff.center[1] : null,
      lng: handoff.center ? handoff.center[0] : null,
      photo: null,
      media: [],
      encounters: [],
    });
  }

  return [
    {
      id: `outing-day-1-${handoff.startedAt}`,
      dayNumber: 1,
      title: handoff.title.slice(0, 120) || 'Jour 1',
      date: dateIso,
      night: null,
      trace: handoff.track.length >= 2 ? handoff.track : undefined,
      moments,
    },
  ];
}

/**
 * Adapts a single Explorer outing snapshot into tailored prefill payloads for
 * ALL 6 Community V2 creation forms (`carnet`, `post`, `story`, `sortie`, `kit`, `club`).
 */
export function buildAllFormPrefillsFromOuting(
  handoff: ExplorerOutingHandoff,
): Partial<Record<CreateKindV2, Record<string, unknown>>> {
  const dateIso = isoDateFromMs(handoff.startedAt);
  const startClock = clockFromMs(handoff.startedAt);
  const endClock = clockFromMs(handoff.endedAt);
  const metricsLine = buildMetricsSummaryLine(handoff);
  const tags = buildSmartTags(handoff);
  const safeLocation = handoff.locationLabel?.trim() || 'Secteur Explorer';
  const safeTitle = handoff.title?.trim() || `Sortie ${handoff.sportLabel}`;
  const startPoint = handoff.track[0] ?? handoff.center;

  const narrativeParts = [
    `${handoff.sportLabel} à ${safeLocation}`,
    metricsLine,
    `Effort ressenti : ${handoff.rpe}/10`,
    handoff.notes.trim(),
  ].filter((part) => part.length > 0);
  const richDescription = narrativeParts.join('\n');

  const sortieActivity = mapSportToSortieActivity(handoff.sport);
  const safetyChecklist: string[] =
    sortieActivity === 'ski'
      ? ['DVA', 'Pelle', 'Sonde', 'Eau']
      : sortieActivity === 'rando' || sortieActivity === 'trail'
        ? ['Eau', 'Couverture de survie']
        : ['Eau'];

  const seasonInfo = inferSeasonFromMs(handoff.startedAt);
  const todayIso = isoDateFromMs(Date.now());
  const sortieDate = dateIso >= todayIso ? dateIso : todayIso;

  return {
    carnet: {
      title: safeTitle.slice(0, 100),
      destination: safeLocation.slice(0, 120),
      startDate: dateIso,
      endDate: dateIso,
      nbJours: 1,
      description: richDescription.slice(0, 1000),
      tags,
      ...(handoff.track.length >= 2 ? { trace: handoff.track } : {}),
      distanceKm: Math.max(0, Number(handoff.distanceKm.toFixed(1))),
      deniveleM: Math.max(0, Math.round(handoff.elevGainM)),
      ...(startPoint ? { startLng: startPoint[0], startLat: startPoint[1] } : {}),
      days: buildCarnetDays(handoff),
      postEnabled: true,
      postContent: `${safeTitle} — ${metricsLine}`.slice(0, 500),
    },

    post: {
      format: 'billet',
      title: safeTitle.slice(0, 120),
      content: richDescription.slice(0, 600),
      location: safeLocation.slice(0, 120),
      ...(startPoint ? { locationLng: startPoint[0], locationLat: startPoint[1] } : {}),
      tags,
    },

    story: {
      caption: `${safeTitle}${metricsLine ? ` · ${metricsLine}` : ''}`.slice(0, 280),
      stickers: {
        place: startPoint
          ? { label: safeLocation.slice(0, 120), lat: startPoint[1], lng: startPoint[0] }
          : { label: safeLocation.slice(0, 120), lat: null, lng: null },
        altitudeM: handoff.maxAltitudeM,
        weatherLabel: (handoff.weatherLabel ?? '').slice(0, 60),
        distanceKm: handoff.distanceKm > 0 ? Math.min(500, Number(handoff.distanceKm.toFixed(1))) : null,
        link: null,
        carnetId: '',
        carnetTitle: '',
        carnetDay: null,
      },
      textLayers: metricsLine
        ? [
            {
              id: `outing-layer-${handoff.startedAt}`,
              text: `${handoff.sportLabel} · ${metricsLine}`.slice(0, 120),
              x: 0.5,
              y: 0.82,
              scale: 1,
              rotation: 0,
              style: 'clair',
            },
          ]
        : [],
    },

    sortie: {
      activity: sortieActivity,
      title: safeTitle.slice(0, 120),
      location: safeLocation.slice(0, 120),
      destination: safeLocation.slice(0, 120),
      meetingPoint: safeLocation.slice(0, 120),
      ...(startPoint
        ? {
            meetingLat: startPoint[1],
            meetingLng: startPoint[0],
            startLat: startPoint[1],
            startLng: startPoint[0],
          }
        : {}),
      date: sortieDate,
      nbJours: 1,
      startTime: startClock,
      ...(endClock > startClock ? { endTime: endClock } : {}),
      ...(handoff.track.length >= 2 ? { trace: handoff.track } : {}),
      level: inferSortieLevel(handoff),
      distanceKm: Math.min(500, Math.max(0, Number(handoff.distanceKm.toFixed(1)))),
      elevationGainM: Math.max(0, Math.round(handoff.elevGainM)),
      deniveleM: Math.max(0, Math.round(handoff.elevGainM)),
      elevationLossM: Math.max(0, Math.round(handoff.elevLossM)),
      ...(handoff.maxAltitudeM != null ? { maxAltitudeM: Math.round(handoff.maxAltitudeM) } : {}),
      duration: handoff.movingS > 0 ? formatDurationShort(handoff.movingS) : '',
      safetyChecklist,
      description: richDescription.slice(0, 1500),
    },

    kit: {
      name: `Kit ${handoff.sportLabel} · ${safeLocation}`.slice(0, 100),
      description: `Équipement utilisé pour « ${safeTitle} » (${metricsLine || handoff.sportLabel}). ${handoff.notes.trim()}`.slice(
        0,
        1000,
      ),
      season: seasonInfo.season,
      seasons: seasonInfo.seasons,
    },

    club: {
      name: `${handoff.sportLabel} · ${safeLocation}`.slice(0, 80),
      activities: [handoff.sportLabel.slice(0, 40)],
      locationLabel: safeLocation.slice(0, 120),
      ...(startPoint ? { zoneLat: startPoint[1], zoneLng: startPoint[0], zoneRadiusKm: 25 } : {}),
      description: `Communauté ${handoff.sportLabel.toLowerCase()} autour de ${safeLocation}.`.slice(
        0,
        1500,
      ),
      welcomeContent: `Bienvenue ! Première sortie partagée : ${safeTitle}${metricsLine ? ` (${metricsLine})` : ''}.`.slice(
        0,
        2000,
      ),
    },
  };
}
