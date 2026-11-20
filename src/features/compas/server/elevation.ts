import 'server-only';

import { buildProfile, sampleRoute, type ElevationProfile } from '../engine/elevation';
import { TERRAIN_SOURCE, terrainElevations } from '@/lib/geo/terrainElevation';
import { appUserAgent } from '@/lib/userAgent';
import type { Evidence } from '@/features/adventure-intelligence/schemas/effort.schema';
import {
  assertNoForbiddenProdProvider,
  buildProviderEvidence,
  formatLicenceSnapshot,
} from '@/features/adventure-intelligence/server/providerTerms';
import { ascentFromElevations } from '../engine/legDistance';

/**
 * Altitudes réelles du tracé : Terrain Tiles (AWS Open Data, gratuites, usage
 * commercial permis). Échec réseau : null, l'accessoire garde le dénivelé et
 * la distance.
 */

export async function getRouteElevation(
  coords: ReadonlyArray<[number, number]>
): Promise<ElevationProfile | null> {
  const samples = sampleRoute(coords, 80);
  if (samples.length === 0) return null;
  const elevations = await terrainElevations(samples.map((sp) => [sp.lon, sp.lat] as const));
  return elevations ? buildProfile(samples, elevations, TERRAIN_SOURCE) : null;
}

/**
 * Dénivelé positif (m) d'un tracé `[lon, lat]` mesuré par un routeur, lu sur
 * le relief : un échantillon tous les 100 m environ (20 à 150). Aucun routeur
 * autorisé ne donne le dénivelé (plan 1.5) ; null si le relief est injoignable.
 */
export async function routeAscentM(line: ReadonlyArray<readonly [number, number]>): Promise<number | null> {
  const coords = line.map(([lon, lat]) => [lat, lon] as [number, number]);
  const ends = sampleRoute(coords, 2);
  const totalKm = ends.at(-1)?.km ?? 0;
  if (!(totalKm > 0)) return null;
  const samples = sampleRoute(coords, Math.min(150, Math.max(20, Math.ceil(totalKm * 10) + 1)));
  const elevations = await terrainElevations(samples.map((sp) => [sp.lon, sp.lat] as const)).catch(() => null);
  return elevations ? ascentFromElevations(elevations) : null;
}

/** Lieux lus au plus (étapes distinctes d'un voyage) : une tuile du relief couvre souvent plusieurs lieux. */
const MAX_ALTITUDE_PLACES = 12;

/** Altitudes lues sur le relief pour des lieux distincts ; null si le relief est injoignable ou qu'aucun lieu n'est valide. */
async function placeAltitudes(points: ReadonlyArray<{ lat: number; lon: number }>): Promise<number[] | null> {
  const seen = new Set<string>();
  const places: Array<{ lat: number; lon: number }> = [];
  for (const p of points) {
    if (!Number.isFinite(p.lat) || !Number.isFinite(p.lon) || Math.abs(p.lat) > 90 || Math.abs(p.lon) > 180) continue;
    const key = `${p.lat.toFixed(2)},${p.lon.toFixed(2)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    places.push(p);
    if (places.length >= MAX_ALTITUDE_PLACES) break;
  }
  if (!places.length) return null;
  const elevations = await terrainElevations(places.map((p) => [p.lon, p.lat] as const)).catch(() => null);
  return (elevations ?? []).filter((a): a is number => a != null);
}

/**
 * Altitude de secours (plan 4.8) : le point le plus haut des lieux donnés,
 * LU SUR LE RELIEF (Terrain Tiles), jamais une valeur devinée d'après le pays.
 * C'est l'altitude des lieux, pas celle d'un sommet du parcours : elle ne
 * dépasse pas ce que le voyage touche. Relief injoignable, mer (0 m) ou aucun
 * lieu valide : null, et les règles passent en formulation prudente.
 */
export async function pointsMaxAltitudeM(
  points: ReadonlyArray<{ lat: number; lon: number }>
): Promise<number | null> {
  const max = Math.max(0, ...((await placeAltitudes(points)) ?? []));
  return max > 0 ? max : null;
}

/**
 * Le point le plus haut ET le plus bas des lieux donnés, lus sur le relief. Le plus bas dit que le parcours
 * descend au moins jusque-là (les lieux sont sur le parcours) ; il ne dit rien du reste du tracé. Même
 * règle que `pointsMaxAltitudeM` : relief injoignable, mer (0 m) ou aucun lieu valide : null.
 */
export async function pointsAltitudeRange(
  points: ReadonlyArray<{ lat: number; lon: number }>
): Promise<{ maxM: number; minM: number } | null> {
  const altitudes = (await placeAltitudes(points)) ?? [];
  const maxM = Math.max(0, ...altitudes);
  return maxM > 0 ? { maxM, minM: Math.min(...altitudes) } : null;
}

/* ---------- Lot P2 : IGN Géoplateforme (`elevationLine`), Repli AWS Terrain Tiles & Lissage MNT Hystérésis 3 m ---------- */

export const IGN_GEOPLATEFORME_SOURCE =
  'IGN Géoplateforme — Service d’Altimétrie (RGE ALTI) — Licence Ouverte Etalab 2.0';
export const IGN_ELEVATION_LINE_URL =
  'https://data.geopf.fr/altimetrie/1.0/calcul/alti/rest/elevationLine.json';
export const IGN_MAX_POINTS_PER_REQUEST = 5000;
export const IGN_MAX_REQ_PER_SECOND = 5;
export const DEFAULT_DEM_HYSTERESIS_M = 3;

const IGN_USER_AGENT = appUserAgent('Altimetrie IGN');

export const IGN_COVERAGE_ZONES = [
  'metropole',
  'guadeloupe',
  'martinique',
  'guyane',
  'reunion',
  'mayotte',
] as const;

export type IgnCoverageZone = (typeof IGN_COVERAGE_ZONES)[number];

export interface GeoBoundingBox {
  minLat: number;
  maxLat: number;
  minLon: number;
  maxLon: number;
}

/**
 * Emprises géographiques couvertes par le MNT IGN Géoplateforme (RGE ALTI / BD ALTI) :
 * France métropolitaine (Corse incluse) + 5 DROM (Guadeloupe, Martinique, Guyane, La Réunion, Mayotte).
 */
export const IGN_COVERAGE_BBOXES: Readonly<Record<IgnCoverageZone, GeoBoundingBox>> = {
  metropole: { minLat: 41.3, maxLat: 51.15, minLon: -5.2, maxLon: 9.65 },
  guadeloupe: { minLat: 15.8, maxLat: 18.15, minLon: -63.2, maxLon: -60.95 },
  martinique: { minLat: 14.35, maxLat: 14.9, minLon: -61.25, maxLon: -60.75 },
  guyane: { minLat: 2.1, maxLat: 5.8, minLon: -54.65, maxLon: -51.6 },
  reunion: { minLat: -21.42, maxLat: -20.85, minLon: 55.2, maxLon: 55.85 },
  mayotte: { minLat: -13.05, maxLat: -12.6, minLon: 44.95, maxLon: 45.35 },
};

/**
 * Détecte l'emprise IGN (France métropolitaine ou DROM) d'un point `(lat, lon)`.
 * Retourne `null` si le point est hors couverture IGN.
 */
export function detectIgnCoverageZone(lat: number, lon: number): IgnCoverageZone | null {
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  for (const zone of IGN_COVERAGE_ZONES) {
    const box = IGN_COVERAGE_BBOXES[zone];
    if (lat >= box.minLat && lat <= box.maxLat && lon >= box.minLon && lon <= box.maxLon) {
      return zone;
    }
  }
  return null;
}

export function isPointInIgnCoverage(lat: number, lon: number): boolean {
  return detectIgnCoverageZone(lat, lon) !== null;
}

export function areAllPointsInIgnCoverage(
  points: ReadonlyArray<{ lat: number; lon: number }>
): boolean {
  if (points.length === 0) return false;
  return points.every((p) => isPointInIgnCoverage(p.lat, p.lon));
}

/**
 * Découpe une liste de points en lots de taille maximale `maxPointsPerBatch` (<= 5 000 pts/req pour IGN).
 */
export function chunkElevationPoints<T>(
  points: ReadonlyArray<T>,
  maxPointsPerBatch: number = IGN_MAX_POINTS_PER_REQUEST
): T[][] {
  const safeLimit = Math.min(
    IGN_MAX_POINTS_PER_REQUEST,
    Math.max(1, Math.trunc(maxPointsPerBatch))
  );
  const chunks: T[][] = [];
  for (let i = 0; i < points.length; i += safeLimit) {
    chunks.push(points.slice(i, i + safeLimit));
  }
  return chunks;
}

/**
 * Calcule l'empreinte SHA-256 hexadécimale déterministe d'une géométrie `(lat, lon)[]`.
 */
export async function computeGeometrySha256(
  points: ReadonlyArray<{ lat: number; lon: number }>
): Promise<string> {
  const canonical = points
    .map((p) => `${p.lat.toFixed(6)},${p.lon.toFixed(6)}`)
    .join(';');
  const subtle = globalThis.crypto?.subtle;
  if (typeof subtle?.digest !== 'function') {
    throw new Error('computeGeometrySha256 : Web Crypto SHA-256 indisponible.');
  }
  const digest = await subtle.digest('SHA-256', new TextEncoder().encode(canonical));
  let hex = '';
  for (const byte of new Uint8Array(digest)) {
    hex += byte.toString(16).padStart(2, '0');
  }
  return hex;
}

/* ---------- Rate Limiter Token-Bucket IGN (<= 5 req/s/IP) ---------- */

let ignAvailableTokens = IGN_MAX_REQ_PER_SECOND;
let ignLastRefillMs = Date.now();

export function resetIgnRateLimiter(initialTimeMs: number = Date.now()): void {
  ignAvailableTokens = IGN_MAX_REQ_PER_SECOND;
  ignLastRefillMs = initialTimeMs;
}

export function getIgnRateLimiterState(): { availableTokens: number; lastRefillMs: number } {
  return { availableTokens: ignAvailableTokens, lastRefillMs: ignLastRefillMs };
}

/**
 * Consomme 1 jeton dans le seau à jetons IGN (`<= 5 req/s/IP`).
 * Si le seau est vide, attend le temps exact de recharge d'un jeton (`200 ms`).
 */
export async function acquireIgnRateLimitSlot(
  now: () => number = Date.now,
  sleep: (ms: number) => Promise<void> = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
): Promise<{ waitedMs: number }> {
  let totalWaitedMs = 0;
  for (;;) {
    const currentMs = now();
    const elapsedMs = Math.max(0, currentMs - ignLastRefillMs);
    if (elapsedMs > 0) {
      const refilled = (elapsedMs / 1000) * IGN_MAX_REQ_PER_SECOND;
      ignAvailableTokens = Math.min(IGN_MAX_REQ_PER_SECOND, ignAvailableTokens + refilled);
      ignLastRefillMs = currentMs;
    }

    if (ignAvailableTokens >= 1) {
      ignAvailableTokens -= 1;
      return { waitedMs: totalWaitedMs };
    }

    const deficit = 1 - ignAvailableTokens;
    const waitMs = Math.max(1, Math.ceil((deficit / IGN_MAX_REQ_PER_SECOND) * 1000));
    totalWaitedMs += waitMs;
    await sleep(waitMs);
  }
}

/* ---------- Cache SHA-256 de la géométrie & Adaptateur IGN avec repli AWS ---------- */

export interface ElevationLineResolution {
  elevations: number[];
  provider: 'ign-geoplateforme' | 'aws-terrain-tiles';
  source: string;
  licenceSnapshot: string;
  geometryHash: string;
  batchCount: number;
  fromCache: boolean;
  fallbackUsed: boolean;
  zone: IgnCoverageZone | null;
  waitedRateLimitMs: number;
  evidence: Evidence<number[]>;
}

const elevationGeometryCache = new Map<string, ElevationLineResolution>();

export function clearElevationGeometryCache(): void {
  elevationGeometryCache.clear();
}

export function getElevationGeometryCacheSize(): number {
  return elevationGeometryCache.size;
}

export function parseIgnElevationLinePayload(
  payload: unknown,
  expectedCount: number
): number[] | null {
  if (!payload || typeof payload !== 'object') return null;
  const rawList = (payload as { elevations?: unknown }).elevations;
  if (!Array.isArray(rawList) || rawList.length !== expectedCount) return null;

  const result: number[] = [];
  for (const item of rawList) {
    const zVal =
      typeof item === 'number'
        ? item
        : item && typeof item === 'object'
          ? ((item as { z?: unknown; elevation?: unknown }).z ??
            (item as { z?: unknown; elevation?: unknown }).elevation)
          : null;
    if (typeof zVal !== 'number' || !Number.isFinite(zVal) || zVal < -500 || zVal > 9000) {
      return null;
    }
    result.push(Math.round(zVal * 100) / 100);
  }
  return result;
}

export interface FetchElevationLineOptions {
  endpointUrl?: string;
  fetchFn?: (url: string, init?: RequestInit) => Promise<Response>;
  fallbackFn?: (
    pointsLonLat: ReadonlyArray<readonly [number, number]>
  ) => Promise<(number | null)[] | null>;
  maxPointsPerBatch?: number;
  bypassCache?: boolean;
  nowIso?: string;
  clock?: {
    now?: () => number;
    sleep?: (ms: number) => Promise<void>;
  };
}

/**
 * Résout le profil altimétrique d'une polyligne :
 * 1. Priorité à IGN Géoplateforme (`elevationLine`) en France métropolitaine et DROM,
 *    avec découpage par lots `<= 5 000 pts/req`, rate limiter token-bucket `<= 5 req/s/IP`
 *    et cache par hash SHA-256 de la géométrie.
 * 2. Repli transparent sur AWS Terrain Tiles hors emprise ou en cas d'indisponibilité IGN.
 */
export async function fetchElevationLineWithFallback(
  points: ReadonlyArray<{ lat: number; lon: number }>,
  options: FetchElevationLineOptions = {}
): Promise<ElevationLineResolution | null> {
  if (points.length === 0) return null;
  for (const p of points) {
    if (!Number.isFinite(p.lat) || !Number.isFinite(p.lon) || Math.abs(p.lat) > 90 || Math.abs(p.lon) > 180) {
      return null;
    }
  }

  const endpointUrl = options.endpointUrl ?? IGN_ELEVATION_LINE_URL;
  assertNoForbiddenProdProvider(endpointUrl);

  const capturedAt = options.nowIso ?? new Date().toISOString();
  const geometryHash = await computeGeometrySha256(points);

  if (!options.bypassCache) {
    const cached = elevationGeometryCache.get(geometryHash);
    if (cached) {
      return {
        ...cached,
        fromCache: true,
      };
    }
  }

  const inIgnCoverage = areAllPointsInIgnCoverage(points);
  const firstZone = inIgnCoverage ? detectIgnCoverageZone(points[0].lat, points[0].lon) : null;
  const fetchFn = options.fetchFn ?? ((url: string, init?: RequestInit) => fetch(url, init));
  const fallbackFn = options.fallbackFn ?? terrainElevations;
  const batches = chunkElevationPoints(
    points,
    options.maxPointsPerBatch ?? IGN_MAX_POINTS_PER_REQUEST
  );

  let totalWaitedMs = 0;

  if (inIgnCoverage) {
    const ignElevations: number[] = [];
    let ignSucceeded = true;

    for (const batch of batches) {
      const { waitedMs } = await acquireIgnRateLimitSlot(
        options.clock?.now,
        options.clock?.sleep
      );
      totalWaitedMs += waitedMs;

      try {
        const res = await fetchFn(endpointUrl, {
          method: 'POST',
          headers: {
            'User-Agent': IGN_USER_AGENT,
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
          body: JSON.stringify({
            lon: batch.map((p) => p.lon).join('|'),
            lat: batch.map((p) => p.lat).join('|'),
            resource: 'ign_rge_alti_wld',
            delimiter: '|',
            indent: 'false',
            measures: 'false',
            zonly: 'false',
          }),
        });

        if (!res.ok) {
          ignSucceeded = false;
          break;
        }
        const json = (await res.json()) as unknown;
        const parsedBatch = parseIgnElevationLinePayload(json, batch.length);
        if (!parsedBatch) {
          ignSucceeded = false;
          break;
        }
        ignElevations.push(...parsedBatch);
      } catch {
        ignSucceeded = false;
        break;
      }
    }

    if (ignSucceeded && ignElevations.length === points.length) {
      const licenceSnapshot = formatLicenceSnapshot('ign_geoplateforme_altimetrie', capturedAt);
      const resolution: ElevationLineResolution = {
        elevations: ignElevations,
        provider: 'ign-geoplateforme',
        source: IGN_GEOPLATEFORME_SOURCE,
        licenceSnapshot,
        geometryHash,
        batchCount: batches.length,
        fromCache: false,
        fallbackUsed: false,
        zone: firstZone,
        waitedRateLimitMs: totalWaitedMs,
        evidence: buildProviderEvidence({
          providerId: 'ign_geoplateforme_altimetrie',
          value: ignElevations,
          unit: 'm',
          kind: 'measured',
          quality: 0.96,
          capturedAt,
          updatedAt: capturedAt,
          modelVersion: 'rge-alti-1.0',
          sourceDetail: `zone=${firstZone ?? 'metropole'}, batches=${batches.length}`,
        }),
      };
      elevationGeometryCache.set(geometryHash, resolution);
      return resolution;
    }
  }

  // Repli sur AWS Terrain Tiles (hors France/DROM ou en cas d'indisponibilité IGN)
  const rawAws = await fallbackFn(points.map((p) => [p.lon, p.lat] as const)).catch(() => null);
  if (!rawAws || rawAws.length !== points.length) return null;

  const awsElevations: number[] = [];
  for (const val of rawAws) {
    if (typeof val !== 'number' || !Number.isFinite(val) || val < -500 || val > 9000) {
      return null;
    }
    awsElevations.push(Math.round(val * 100) / 100);
  }

  const licenceSnapshot = formatLicenceSnapshot('aws_terrain_tiles', capturedAt);
  const fallbackResolution: ElevationLineResolution = {
    elevations: awsElevations,
    provider: 'aws-terrain-tiles',
    source: TERRAIN_SOURCE,
    licenceSnapshot,
    geometryHash,
    batchCount: 1,
    fromCache: false,
    fallbackUsed: true,
    zone: firstZone,
    waitedRateLimitMs: totalWaitedMs,
    evidence: buildProviderEvidence({
      providerId: 'aws_terrain_tiles',
      value: awsElevations,
      unit: 'm',
      kind: 'measured',
      quality: 0.85,
      capturedAt,
      updatedAt: capturedAt,
      modelVersion: 'terrarium-z12',
      sourceDetail: inIgnCoverage ? 'fallback_from_ign' : 'global_coverage',
    }),
  };

  elevationGeometryCache.set(geometryHash, fallbackResolution);
  return fallbackResolution;
}

/* ---------- Lissage altimétrique GPX sur MNT avec hystérésis 3 m ---------- */

export interface DemTrackPointInput {
  lat: number;
  lon?: number;
  lng?: number;
  /** Altitude brute issue du GPS ou baromètre (mètres). */
  rawEleM?: number | null;
  /** Alias standard GPX (`ele`). */
  ele?: number | null;
  /** Altitude de référence lue sur le MNT IGN/AWS (mètres). */
  demEleM?: number | null;
}

export interface SmoothedElevationSegment {
  segmentIndex: number;
  startIndex: number;
  endIndex: number;
  distanceM: number;
  startElevationM: number;
  endElevationM: number;
  gainM: number;
  lossM: number;
  /** Pente en pourcentage (`[-100, 100]`). */
  gradePct: number;
  /** Pente décimale (`gradePct / 100`). */
  gradeDec: number;
}

export interface SmoothedDemElevationResult {
  hysteresisM: number;
  /** Altitudes recalées sur le MNT avant filtre d'hystérésis. */
  recalibratedElevationsM: number[];
  /** Altitudes lissées après filtre d'hystérésis `3 m`. */
  smoothedElevationsM: number[];
  totalDistanceM: number;
  totalGainM: number;
  totalLossM: number;
  meanGradePct: number;
  segments: SmoothedElevationSegment[];
}

const EARTH_RADIUS_M = 6_371_000;

function haversineMeters(
  a: { lat: number; lon: number },
  b: { lat: number; lon: number }
): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

/**
 * Recale une trace GPX sur le MNT (IGN Géoplateforme / AWS Terrain Tiles) et applique
 * un filtre d'hystérésis de `3 m` (par défaut) pour supprimer les micro-oscillations `< 3 m`
 * (bruit GPS/baromètre et bruit de quantification MNT), puis calcule précisément
 * `D+`, `D-` et `gradePct` par tronçon.
 */
export function smoothElevationWithDemHysteresis(
  points: ReadonlyArray<DemTrackPointInput>,
  options: { hysteresisM?: number } = {}
): SmoothedDemElevationResult {
  const hysteresisM =
    typeof options.hysteresisM === 'number' &&
    Number.isFinite(options.hysteresisM) &&
    options.hysteresisM >= 0
      ? options.hysteresisM
      : DEFAULT_DEM_HYSTERESIS_M;

  if (points.length === 0) {
    return {
      hysteresisM,
      recalibratedElevationsM: [],
      smoothedElevationsM: [],
      totalDistanceM: 0,
      totalGainM: 0,
      totalLossM: 0,
      meanGradePct: 0,
      segments: [],
    };
  }

  // 1. Recalage MNT : l'altitude MNT (`demEleM`) prime sur l'altitude GPS brute (`rawEleM` / `ele`)
  const recalibratedElevationsM: number[] = [];
  let lastValidEle = 0;
  for (const pt of points) {
    const dem = typeof pt.demEleM === 'number' && Number.isFinite(pt.demEleM) ? pt.demEleM : null;
    const raw =
      typeof pt.rawEleM === 'number' && Number.isFinite(pt.rawEleM)
        ? pt.rawEleM
        : typeof pt.ele === 'number' && Number.isFinite(pt.ele)
          ? pt.ele
          : null;
    const chosen = dem ?? raw ?? lastValidEle;
    lastValidEle = chosen;
    recalibratedElevationsM.push(chosen);
  }

  // 2. Filtre d'hystérésis `3 m` : ignore toute variation strictement inférieure à `hysteresisM` (< 3 m)
  const smoothedElevationsM: number[] = [];
  let anchorEle = recalibratedElevationsM[0];
  let totalGainM = 0;
  let totalLossM = 0;

  for (let i = 0; i < recalibratedElevationsM.length; i += 1) {
    const currentEle = recalibratedElevationsM[i];
    const delta = currentEle - anchorEle;
    if (Math.abs(delta) >= hysteresisM) {
      if (delta > 0) {
        totalGainM += delta;
      } else if (delta < 0) {
        totalLossM += -delta;
      }
      anchorEle = currentEle;
    }
    smoothedElevationsM.push(Math.round(anchorEle * 100) / 100);
  }

  // 3. Calcul précis par tronçon : distanceM, D+, D-, gradePct et gradeDec
  const segments: SmoothedElevationSegment[] = [];
  let totalDistanceM = 0;

  for (let i = 1; i < points.length; i += 1) {
    const prev = points[i - 1];
    const curr = points[i];
    const prevLon = prev.lon ?? prev.lng ?? 0;
    const currLon = curr.lon ?? curr.lng ?? 0;
    const distanceM = haversineMeters(
      { lat: prev.lat, lon: prevLon },
      { lat: curr.lat, lon: currLon }
    );
    totalDistanceM += distanceM;

    const startElevationM = smoothedElevationsM[i - 1];
    const endElevationM = smoothedElevationsM[i];
    const deltaEle = endElevationM - startElevationM;
    const gainM = deltaEle > 0 ? Math.round(deltaEle * 100) / 100 : 0;
    const lossM = deltaEle < 0 ? Math.round(-deltaEle * 100) / 100 : 0;

    const rawGradePct = distanceM > 0 ? (deltaEle / distanceM) * 100 : 0;
    const clampedGradePct = Math.min(100, Math.max(-100, rawGradePct));
    const gradePct = Math.round(clampedGradePct * 100) / 100;
    const gradeDec = Math.round((gradePct / 100) * 10_000) / 10_000;

    segments.push({
      segmentIndex: i,
      startIndex: i - 1,
      endIndex: i,
      distanceM: Math.round(distanceM * 100) / 100,
      startElevationM,
      endElevationM,
      gainM,
      lossM,
      gradePct,
      gradeDec,
    });
  }

  const meanGradePct =
    totalDistanceM > 0
      ? Math.round((((totalGainM - totalLossM) / totalDistanceM) * 100) * 100) / 100
      : 0;

  return {
    hysteresisM,
    recalibratedElevationsM,
    smoothedElevationsM,
    totalDistanceM: Math.round(totalDistanceM * 100) / 100,
    totalGainM: Math.round(totalGainM * 100) / 100,
    totalLossM: Math.round(totalLossM * 100) / 100,
    meanGradePct,
    segments,
  };
}
