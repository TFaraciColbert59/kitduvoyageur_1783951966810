import { haversineKm } from '@/features/adventure-prep/engine/routing';
import type { RouteWorkspaceState } from './types';

export type RoutePoiCategory =
  | 'water'
  | 'shelter'
  | 'summit'
  | 'food_lodging'
  | 'access'
  | 'other';

export interface RouteCorridorPoi {
  readonly id: string;
  readonly name: string;
  readonly category: RoutePoiCategory;
  readonly rawCategory: string;
  readonly lat: number;
  readonly lon: number;
  readonly altitudeM: number | null;
  readonly distanceToTrackM: number;
  readonly details: string | null;
  readonly source: string;
}

export interface LiveWeatherInfo {
  readonly temperatureC: number | null;
  readonly windKph: number | null;
  readonly humidityPct: number | null;
  readonly weatherCode: number | null;
  readonly windChillC: number | null;
  readonly conditionLabel: string;
  readonly fetchedAt: string;
  readonly source: string;
  readonly hourlyPreview: readonly {
    readonly time: string;
    readonly tempC: number | null;
    readonly rainProbPct: number | null;
    readonly windKph: number | null;
  }[];
}

export interface TechnicalTerrainStats {
  readonly distanceKm: number;
  readonly ascentM: number | null;
  readonly descentM: number | null;
  readonly minAltitudeM: number | null;
  readonly maxAltitudeM: number | null;
  readonly avgAltitudeM: number | null;
  readonly estimatedDurationMin: number | null;
  readonly estimatedCaloriesKcal: number | null;
  readonly avgSpeedKmh: number | null;
  readonly ibpEstimate: number | null;
  readonly effortLevel: 'Facile (1/5)' | 'Assez facile (2/5)' | 'Peu difficile (3/5)' | 'Assez difficile (4/5)' | 'Difficile (5/5)';
  readonly maxClimbSlopePct: number | null;
  readonly maxDescentSlopePct: number | null;
  readonly slopeBuckets: {
    readonly flatPct: number;
    readonly moderatePct: number;
    readonly sustainedPct: number;
    readonly steepPct: number;
    readonly hasSlopeData: boolean;
  };
  readonly surfaces: readonly {
    readonly key: 'trail' | 'unpaved' | 'paved' | 'rock' | 'unknown';
    readonly label: string;
    readonly pct: number;
  }[];
  readonly ecologicalZone: string;
  readonly sunriseLocal: string;
  readonly sunsetLocal: string;
  readonly daylightLabel: string;
  readonly centerLat: number;
  readonly centerLon: number;
  readonly bbox: {
    readonly minLat: number;
    readonly maxLat: number;
    readonly minLon: number;
    readonly maxLon: number;
  };
}

function weatherCodeLabel(code: number | null): string {
  if (code == null) return 'Conditions inconnues';
  if (code === 0) return 'Ciel dégagé';
  if (code <= 3) return 'Partiellement nuageux';
  if (code <= 48) return 'Brouillard / brume';
  if (code <= 57) return 'Bruine';
  if (code <= 67) return 'Pluie';
  if (code <= 77) return 'Neige';
  if (code <= 82) return 'Averses';
  if (code <= 86) return 'Averses de neige';
  return 'Orage';
}

function computeWindChill(tempC: number | null, windKph: number | null): number | null {
  if (tempC == null || windKph == null) return null;
  if (tempC > 10 || windKph < 4.8) return Math.round(tempC);
  const v = Math.pow(windKph, 0.16);
  return Math.round(13.12 + 0.6215 * tempC - 11.37 * v + 0.3965 * tempC * v);
}

/** Calcul astronomique simplifié (NOAA) du lever et coucher du soleil pour la latitude/longitude. */
export function estimateSunTimes(lat: number, lon: number, date = new Date()): {
  sunriseLocal: string;
  sunsetLocal: string;
  daylightLabel: string;
} {
  const rad = Math.PI / 180;
  const start = new Date(date.getFullYear(), 0, 0);
  const dayOfYear = Math.floor((date.getTime() - start.getTime()) / 86_400_000);
  const decl = 23.44 * Math.sin(rad * ((360 / 365) * (dayOfYear - 81)));
  const cosH =
    (Math.cos(90.833 * rad) - Math.sin(lat * rad) * Math.sin(decl * rad)) /
    (Math.cos(lat * rad) * Math.cos(decl * rad));
  const clamped = Math.max(-0.99, Math.min(0.99, cosH));
  const halfDayHours = (Math.acos(clamped) / rad) / 15;
  const tzOffsetHours = -date.getTimezoneOffset() / 60;
  const solarNoon = 12 - lon / 15 + tzOffsetHours;
  const rise = solarNoon - halfDayHours;
  const set = solarNoon + halfDayHours;

  const fmt = (h: number) => {
    const normalized = ((h % 24) + 24) % 24;
    const hh = Math.floor(normalized);
    const mm = Math.round((normalized - hh) * 60) % 60;
    return `${String(hh).padStart(2, '0')}h${String(mm).padStart(2, '0')}`;
  };
  const totalMin = Math.round(halfDayHours * 2 * 60);
  return {
    sunriseLocal: fmt(rise),
    sunsetLocal: fmt(set),
    daylightLabel: `${Math.floor(totalMin / 60)}h${String(totalMin % 60).padStart(2, '0')} de jour`,
  };
}

export function classifyEcologicalZone(maxAltM: number | null): string {
  if (maxAltM == null) return 'Étage non déterminé (altitude manquante)';
  if (maxAltM < 600) return 'Étage collinéen / plaine (< 600 m)';
  if (maxAltM < 1500) return 'Étage montagnard (600–1 500 m · forêts & alpages)';
  if (maxAltM < 2200) return 'Étage subalpin (1 500–2 200 m · pelouses & crêtes)';
  return 'Étage alpin / haute montagne (> 2 200 m · minéral & exposé)';
}

export function computeTechnicalTerrainStats(workspace: RouteWorkspaceState): TechnicalTerrainStats {
  const coords = workspace.sections.flatMap((s) => s.geometry.coordinates);
  const points = workspace.points.filter((p) => !p.deletedAt);

  let minLat = Infinity;
  let maxLat = -Infinity;
  let minLon = Infinity;
  let maxLon = -Infinity;
  for (const [lon, lat] of coords) {
    if (lat < minLat) minLat = lat;
    if (lat > maxLat) maxLat = lat;
    if (lon < minLon) minLon = lon;
    if (lon > maxLon) maxLon = lon;
  }
  for (const p of points) {
    if (p.lat < minLat) minLat = p.lat;
    if (p.lat > maxLat) maxLat = p.lat;
    if (p.lon < minLon) minLon = p.lon;
    if (p.lon > maxLon) maxLon = p.lon;
  }
  if (!Number.isFinite(minLat)) {
    minLat = 45.05;
    maxLat = 45.09;
    minLon = 5.50;
    maxLon = 5.56;
  }
  const centerLat = (minLat + maxLat) / 2;
  const centerLon = (minLon + maxLon) / 2;

  const distanceKm = Number(
    workspace.sections.reduce((acc, s) => acc + s.distanceKm, 0).toFixed(2),
  );
  const ascentValues = workspace.sections.map((s) => s.ascentM).filter((v): v is number => v != null);
  const descentValues = workspace.sections.map((s) => s.descentM).filter((v): v is number => v != null);
  const ascentM = ascentValues.length > 0 ? Math.round(ascentValues.reduce((a, b) => a + b, 0)) : null;
  const descentM = descentValues.length > 0 ? Math.round(descentValues.reduce((a, b) => a + b, 0)) : null;

  // Altitudes et pentes par tronçon
  const allEles: number[] = [];
  let flatDist = 0;
  let modDist = 0;
  let sustDist = 0;
  let steepDist = 0;
  let maxClimbSlopePct: number | null = null;
  let maxDescentSlopePct: number | null = null;

  for (const p of points) {
    if (typeof p.eleM === 'number' && Number.isFinite(p.eleM)) allEles.push(p.eleM);
  }

  for (const s of workspace.sections) {
    const eles = s.elevationSamples?.filter((v): v is number => typeof v === 'number' && Number.isFinite(v));
    if (eles && eles.length >= 2) {
      allEles.push(...eles);
      const segDistM = (s.distanceKm * 1000) / Math.max(1, eles.length - 1);
      for (let i = 1; i < eles.length; i += 1) {
        const diff = eles[i] - eles[i - 1];
        const pct = segDistM > 5 ? (diff / segDistM) * 100 : 0;
        const absPct = Math.abs(pct);
        if (pct > 0 && (maxClimbSlopePct == null || pct > maxClimbSlopePct)) {
          maxClimbSlopePct = Math.round(pct);
        }
        if (pct < 0 && (maxDescentSlopePct == null || absPct > maxDescentSlopePct)) {
          maxDescentSlopePct = Math.round(absPct);
        }
        if (absPct < 5) flatDist += segDistM;
        else if (absPct < 10) modDist += segDistM;
        else if (absPct < 15) sustDist += segDistM;
        else steepDist += segDistM;
      }
    } else if (s.distanceKm > 0 && (s.ascentM != null || s.descentM != null)) {
      const approxSlope = (((s.ascentM ?? 0) + (s.descentM ?? 0)) / (s.distanceKm * 1000)) * 100;
      if (maxClimbSlopePct == null || approxSlope > maxClimbSlopePct) {
        maxClimbSlopePct = Math.round(approxSlope);
      }
      const distM = s.distanceKm * 1000;
      if (approxSlope < 5) flatDist += distM;
      else if (approxSlope < 10) modDist += distM;
      else if (approxSlope < 15) sustDist += distM;
      else steepDist += distM;
    }
  }

  const totalSlopeDist = flatDist + modDist + sustDist + steepDist;
  const hasSlopeData = totalSlopeDist > 0;
  const minAltitudeM = allEles.length > 0 ? Math.round(Math.min(...allEles)) : null;
  const maxAltitudeM = allEles.length > 0 ? Math.round(Math.max(...allEles)) : null;
  const avgAltitudeM =
    allEles.length > 0
      ? Math.round(allEles.reduce((a, b) => a + b, 0) / allEles.length)
      : null;

  // Durée (Naismith si non fournie) & IBP simplifié
  const isCycling = workspace.sport === 'vtt' || workspace.sport === 'gravel' || workspace.sport === 'route';
  const speedBase = isCycling ? 16 : 4.2;
  const sectionDur = workspace.sections.reduce((acc, s) => acc + (s.durationMin ?? 0), 0);
  const estimatedDurationMin =
    sectionDur > 0
      ? Math.round(sectionDur)
      : distanceKm > 0
        ? Math.round((distanceKm / speedBase) * 60 + ((ascentM ?? 0) / 600) * 60)
        : null;

  const avgSpeedKmh =
    estimatedDurationMin && estimatedDurationMin > 0
      ? Number(((distanceKm / estimatedDurationMin) * 60).toFixed(1))
      : null;

  const ibpEstimate =
    distanceKm > 0
      ? Math.round(distanceKm * 2.4 + (ascentM ?? 0) * 0.045 + (maxAltitudeM && maxAltitudeM > 1800 ? 8 : 0))
      : null;

  const effortLevel: TechnicalTerrainStats['effortLevel'] =
    ibpEstimate == null || ibpEstimate < 25
      ? 'Facile (1/5)'
      : ibpEstimate < 50
        ? 'Assez facile (2/5)'
        : ibpEstimate < 75
          ? 'Peu difficile (3/5)'
          : ibpEstimate < 105
            ? 'Assez difficile (4/5)'
            : 'Difficile (5/5)';

  const estimatedCaloriesKcal =
    distanceKm > 0
      ? Math.round(distanceKm * (isCycling ? 32 : 58) + (ascentM ?? 0) * 0.45)
      : null;

  // Surfaces
  const surfAcc: Record<'trail' | 'unpaved' | 'paved' | 'rock' | 'unknown', number> = {
    trail: 0,
    unpaved: 0,
    paved: 0,
    rock: 0,
    unknown: 0,
  };
  let totalSurfKm = 0;
  for (const s of workspace.sections) {
    const d = Math.max(0.01, s.distanceKm);
    if (s.surfaceSegments.length === 0) {
      surfAcc.unknown += d;
      totalSurfKm += d;
    } else {
      for (const seg of s.surfaceSegments) {
        const share = Math.max(0, seg.toRatio - seg.fromRatio) * d;
        surfAcc[seg.surface] += share;
        totalSurfKm += share;
      }
    }
  }
  const surfLabels: Record<'trail' | 'unpaved' | 'paved' | 'rock' | 'unknown', string> = {
    trail: 'Sentier / Single',
    unpaved: 'Piste / Chemin',
    paved: 'Route / Bitume',
    rock: 'Rocher / Crête',
    unknown: 'Surface non renseignée',
  };
  const surfaces = (['trail', 'unpaved', 'paved', 'rock', 'unknown'] as const)
    .map((key) => ({
      key,
      label: surfLabels[key],
      pct: totalSurfKm > 0 ? Math.round((surfAcc[key] / totalSurfKm) * 100) : key === 'unknown' ? 100 : 0,
    }))
    .filter((s) => s.pct > 0);

  const sun = estimateSunTimes(centerLat, centerLon);

  return {
    distanceKm,
    ascentM,
    descentM,
    minAltitudeM,
    maxAltitudeM,
    avgAltitudeM,
    estimatedDurationMin,
    estimatedCaloriesKcal,
    avgSpeedKmh,
    ibpEstimate,
    effortLevel,
    maxClimbSlopePct,
    maxDescentSlopePct,
    slopeBuckets: {
      flatPct: hasSlopeData ? Math.round((flatDist / totalSlopeDist) * 100) : 0,
      moderatePct: hasSlopeData ? Math.round((modDist / totalSlopeDist) * 100) : 0,
      sustainedPct: hasSlopeData ? Math.round((sustDist / totalSlopeDist) * 100) : 0,
      steepPct: hasSlopeData ? Math.round((steepDist / totalSlopeDist) * 100) : 0,
      hasSlopeData,
    },
    surfaces,
    ecologicalZone: classifyEcologicalZone(maxAltitudeM),
    sunriseLocal: sun.sunriseLocal,
    sunsetLocal: sun.sunsetLocal,
    daylightLabel: sun.daylightLabel,
    centerLat,
    centerLon,
    bbox: { minLat, maxLat, minLon, maxLon },
  };
}

function minDistanceToTrackM(lat: number, lon: number, track: readonly [number, number][]): number {
  if (track.length === 0) return 0;
  let best = Infinity;
  const step = Math.max(1, Math.floor(track.length / 80));
  for (let i = 0; i < track.length; i += step) {
    const d = haversineKm({ lat, lon }, { lat: track[i][1], lon: track[i][0] }) * 1000;
    if (d < best) best = d;
  }
  return Math.round(best);
}

function mapRawCategory(raw: string): RoutePoiCategory {
  const c = raw.toLowerCase();
  if (c.includes('water') || c.includes('eau') || c.includes('source') || c.includes('fountain')) return 'water';
  if (c.includes('refuge') || c.includes('shelter') || c.includes('cabane') || c.includes('camp') || c.includes('bivouac') || c.includes('hut')) return 'shelter';
  if (c.includes('summit') || c.includes('sommet') || c.includes('peak') || c.includes('col') || c.includes('viewpoint') || c.includes('panorama')) return 'summit';
  if (c.includes('stay') || c.includes('eat') || c.includes('food') || c.includes('restaurant') || c.includes('shop') || c.includes('supply') || c.includes('grocery') || c.includes('bakery') || c.includes('hotel') || c.includes('gite') || c.includes('lodging') || c.includes('meal') || c.includes('supermarket') || c.includes('cafe')) return 'food_lodging';
  if (c.includes('parking') || c.includes('transit') || c.includes('bus') || c.includes('train') || c.includes('station')) return 'access';
  return 'other';
}

export async function fetchRouteKnowledgeBank(
  workspace: RouteWorkspaceState,
  signal?: AbortSignal,
): Promise<{
  pois: RouteCorridorPoi[];
  weather: LiveWeatherInfo | null;
  sources: string[];
}> {
  const stats = computeTechnicalTerrainStats(workspace);
  const track = workspace.sections.flatMap((s) => s.geometry.coordinates);
  const pad = 0.025;
  const minLat = Math.max(-89, stats.bbox.minLat - pad);
  const maxLat = Math.min(89, stats.bbox.maxLat + pad);
  const minLon = Math.max(-179, stats.bbox.minLon - pad);
  const maxLon = Math.min(179, stats.bbox.maxLon + pad);

  const bboxQs = `min_lat=${minLat.toFixed(4)}&max_lat=${maxLat.toFixed(4)}&min_lng=${minLon.toFixed(4)}&max_lng=${maxLon.toFixed(4)}`;

  const [weatherRes, dbPoisRes, osmPoisRes, amenitiesRes] = await Promise.allSettled([
    fetch(`/api/weather/point?lat=${stats.centerLat.toFixed(3)}&lon=${stats.centerLon.toFixed(3)}`, { signal }),
    fetch(`/api/pois?${bboxQs}&zoom=13&limit=60`, { signal }),
    fetch(
      `/api/explorer/osm/pois?${bboxQs}&categories=refuge,shelter,water,summit,viewpoint,camp,parking,transit&limit=60`,
      { signal },
    ),
    fetch(`/api/amenities?${bboxQs}`, { signal }),
  ]);

  const sources: string[] = [];
  let weather: LiveWeatherInfo | null = null;

  if (weatherRes.status === 'fulfilled' && weatherRes.value.ok) {
    try {
      const w = (await weatherRes.value.json()) as {
        source?: string;
        current?: {
          time?: string;
          temperature_2m?: number;
          wind_speed_10m?: number;
          relative_humidity_2m?: number;
          weather_code?: number;
        };
        hourly?: {
          time?: string[];
          temperature_2m?: number[];
          precipitation_probability?: number[];
          wind_speed_10m?: number[];
        };
      };
      const tempC = typeof w.current?.temperature_2m === 'number' ? w.current.temperature_2m : null;
      const windKph = typeof w.current?.wind_speed_10m === 'number' ? Math.round(w.current.wind_speed_10m) : null;
      const code = typeof w.current?.weather_code === 'number' ? w.current.weather_code : null;
      const hourlyPreview = (w.hourly?.time ?? []).slice(0, 6).map((t, i) => ({
        time: t.slice(11, 16),
        tempC: typeof w.hourly?.temperature_2m?.[i] === 'number' ? Math.round(w.hourly.temperature_2m[i]) : null,
        rainProbPct:
          typeof w.hourly?.precipitation_probability?.[i] === 'number'
            ? Math.round(w.hourly.precipitation_probability[i])
            : null,
        windKph: typeof w.hourly?.wind_speed_10m?.[i] === 'number' ? Math.round(w.hourly.wind_speed_10m[i]) : null,
      }));
      weather = {
        temperatureC: tempC != null ? Number(tempC.toFixed(1)) : null,
        windKph,
        humidityPct: typeof w.current?.relative_humidity_2m === 'number' ? Math.round(w.current.relative_humidity_2m) : null,
        weatherCode: code,
        windChillC: computeWindChill(tempC, windKph),
        conditionLabel: weatherCodeLabel(code),
        fetchedAt: w.current?.time ?? new Date().toISOString(),
        source: w.source ?? 'MET Norway',
        hourlyPreview,
      };
      sources.push(weather.source);
    } catch {
      /* ignore parse error */
    }
  }

  const seen = new Map<string, RouteCorridorPoi>();
  const addPoi = (poi: RouteCorridorPoi) => {
    if (!Number.isFinite(poi.lat) || !Number.isFinite(poi.lon)) return;
    if (poi.distanceToTrackM > 6500) return;
    const dedupeKey = `${poi.category}:${poi.name.toLowerCase().trim()}:${poi.lat.toFixed(3)}`;
    if (!seen.has(dedupeKey)) seen.set(dedupeKey, poi);
  };

  if (dbPoisRes.status === 'fulfilled' && dbPoisRes.value.ok) {
    try {
      const rows = (await dbPoisRes.value.json()) as Array<{
        id: string;
        name?: string;
        category?: string;
        lat: number;
        lng: number;
        altitude_m?: number | null;
        description?: string | null;
        source?: string;
      }>;
      if (Array.isArray(rows) && rows.length > 0) {
        sources.push('Base LKDV');
        for (const r of rows) {
          addPoi({
            id: `db-${r.id}`,
            name: r.name || 'Point d’intérêt',
            category: mapRawCategory(r.category || ''),
            rawCategory: r.category || 'poi',
            lat: r.lat,
            lon: r.lng,
            altitudeM: r.altitude_m ?? null,
            distanceToTrackM: minDistanceToTrackM(r.lat, r.lng, track),
            details: r.description ?? null,
            source: r.source || 'Base LKDV',
          });
        }
      }
    } catch {
      /* ignore */
    }
  }

  if (osmPoisRes.status === 'fulfilled' && osmPoisRes.value.ok) {
    try {
      const payload = (await osmPoisRes.value.json()) as {
        items?: Array<{
          id: string;
          name?: string;
          category?: string;
          lat?: number;
          lng?: number;
          lon?: number;
          elevation?: number | null;
          description?: string | null;
        }>;
      };
      if (Array.isArray(payload.items) && payload.items.length > 0) {
        sources.push('OpenStreetMap (Overpass)');
        for (const item of payload.items) {
          const lat = item.lat;
          const lon = item.lng ?? item.lon;
          if (typeof lat !== 'number' || typeof lon !== 'number') continue;
          addPoi({
            id: `osm-${item.id}`,
            name: item.name || item.category || 'Repère OSM',
            category: mapRawCategory(item.category || ''),
            rawCategory: item.category || 'osm',
            lat,
            lon,
            altitudeM: item.elevation ?? null,
            distanceToTrackM: minDistanceToTrackM(lat, lon, track),
            details: item.description ?? null,
            source: 'OpenStreetMap',
          });
        }
      }
    } catch {
      /* ignore */
    }
  }

  if (amenitiesRes.status === 'fulfilled' && amenitiesRes.value.ok) {
    try {
      const payload = (await amenitiesRes.value.json()) as {
        provider?: { name?: string } | null;
        amenities?: Array<{
          id?: string;
          name?: string;
          kind?: string;
          category?: string;
          description?: string | null;
          region?: string | null;
          lat?: number;
          lng?: number;
          lon?: number;
          address?: string | null;
        }>;
      };
      if (Array.isArray(payload.amenities) && payload.amenities.length > 0) {
        if (payload.provider?.name) sources.push(payload.provider.name);
        for (let i = 0; i < payload.amenities.length; i += 1) {
          const a = payload.amenities[i];
          const lat = a.lat;
          const lon = a.lng ?? a.lon;
          if (typeof lat !== 'number' || typeof lon !== 'number') continue;
          const rawCat = a.kind || a.category || a.description || 'food_lodging';
          const detailParts = [a.description, a.region, a.address].filter(Boolean);
          addPoi({
            id: `am-${a.id ?? i}`,
            name: a.name || rawCat,
            category: mapRawCategory(`${rawCat} ${a.description ?? ''}`),
            rawCategory: rawCat,
            lat,
            lon,
            altitudeM: null,
            distanceToTrackM: minDistanceToTrackM(lat, lon, track),
            details: detailParts.length > 0 ? detailParts.join(' · ') : null,
            source: payload.provider?.name ?? 'OpenStreetMap',
          });
        }
      }
    } catch {
      /* ignore */
    }
  }

  const pois = Array.from(seen.values()).sort((a, b) => a.distanceToTrackM - b.distanceToTrackM);
  return { pois, weather, sources: Array.from(new Set(sources)) };
}
