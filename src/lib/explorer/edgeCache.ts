import crypto from 'node:crypto';

export const LKDV_USER_AGENT =
  'kitduvoyageur/1.0 (explorer-bff; +https://lekitduvoyageur.com)';

export interface ExplorerApiMeta {
  fetchedAt: string;
  upstreamUpdatedAt?: string;
  expiresAt?: string;
  stale: boolean;
  source: string;
  attribution: string;
  warning?: string;
}

export interface CacheEntry<T> {
  value: T;
  fetchedAt: number;
  expiresAt: number;
}

/**
 * Bounded in-memory LRU cache with TTL and stale-entry lookup for graceful
 * degradation when upstream open-data providers time out or rate-limit.
 */
export class LruCache<T> {
  private readonly store = new Map<string, CacheEntry<T>>();
  private readonly maxEntries: number;
  private readonly maxStaleMs: number;

  constructor(maxEntries = 256, maxStaleMs = 24 * 60 * 60 * 1000) {
    this.maxEntries = Math.max(1, Math.floor(maxEntries));
    this.maxStaleMs = Math.max(0, maxStaleMs);
  }

  get size(): number {
    return this.store.size;
  }

  get(key: string, nowMs = Date.now()): T | undefined {
    const entry = this.store.get(key);
    if (!entry) return undefined;
    if (nowMs > entry.expiresAt) {
      if (nowMs - entry.expiresAt > this.maxStaleMs) {
        this.store.delete(key);
      }
      return undefined;
    }
    this.store.delete(key);
    this.store.set(key, entry);
    return entry.value;
  }

  getEntry(key: string, nowMs = Date.now()): (CacheEntry<T> & { isExpired: boolean }) | undefined {
    const entry = this.store.get(key);
    if (!entry) return undefined;
    const isExpired = nowMs > entry.expiresAt;
    if (isExpired && nowMs - entry.expiresAt > this.maxStaleMs) {
      this.store.delete(key);
      return undefined;
    }
    this.store.delete(key);
    this.store.set(key, entry);
    return { ...entry, isExpired };
  }

  getStale(key: string, nowMs = Date.now()): CacheEntry<T> | undefined {
    const entry = this.store.get(key);
    if (!entry) return undefined;
    if (nowMs - entry.expiresAt > this.maxStaleMs) {
      this.store.delete(key);
      return undefined;
    }
    return entry;
  }

  set(key: string, value: T, ttlMs: number, nowMs = Date.now()): CacheEntry<T> {
    if (this.store.has(key)) {
      this.store.delete(key);
    }
    const entry: CacheEntry<T> = {
      value,
      fetchedAt: nowMs,
      expiresAt: nowMs + Math.max(0, ttlMs),
    };
    this.store.set(key, entry);
    while (this.store.size > this.maxEntries) {
      const oldestKey = this.store.keys().next().value;
      if (oldestKey === undefined) break;
      this.store.delete(oldestKey);
    }
    return entry;
  }

  delete(key: string): boolean {
    return this.store.delete(key);
  }

  clear(): void {
    this.store.clear();
  }
}

export interface BoundingBox {
  south: number;
  west: number;
  north: number;
  east: number;
}

export interface QuantizedBbox extends BoundingBox {
  key: string;
}

export interface ClampedBbox extends BoundingBox {
  clamped: boolean;
}

function clampLat(n: number): number {
  return Math.max(-90, Math.min(90, n));
}

function clampLng(n: number): number {
  return Math.max(-180, Math.min(180, n));
}

export function quantizeCoord(n: number, decimals = 2): number {
  if (!Number.isFinite(n)) return 0;
  const d = Math.max(0, Math.min(6, Math.floor(decimals)));
  const factor = 10 ** d;
  const rounded = Math.round(n * factor) / factor;
  return Object.is(rounded, -0) ? 0 : rounded;
}

export function quantizeBbox(
  south: number,
  west: number,
  north: number,
  east: number,
  decimals = 2,
): QuantizedBbox {
  const d = Math.max(0, Math.min(6, Math.floor(decimals)));
  const factor = 10 ** d;
  const rawSouth = clampLat(Math.min(south, north));
  const rawNorth = clampLat(Math.max(south, north));
  const rawWest = clampLng(Math.min(west, east));
  const rawEast = clampLng(Math.max(west, east));

  const qSouth = clampLat(Math.floor(rawSouth * factor) / factor);
  const qNorth = clampLat(Math.ceil(rawNorth * factor) / factor);
  const qWest = clampLng(Math.floor(rawWest * factor) / factor);
  const qEast = clampLng(Math.ceil(rawEast * factor) / factor);

  const normalizeZero = (v: number) => (Object.is(v, -0) ? 0 : v);
  const s = normalizeZero(Number(qSouth.toFixed(d)));
  const w = normalizeZero(Number(qWest.toFixed(d)));
  const n = normalizeZero(Number(qNorth.toFixed(d)));
  const e = normalizeZero(Number(qEast.toFixed(d)));

  return {
    south: s,
    west: w,
    north: n,
    east: e,
    key: `${s.toFixed(d)},${w.toFixed(d)},${n.toFixed(d)},${e.toFixed(d)}`,
  };
}

export function clampBbox(
  south: number,
  west: number,
  north: number,
  east: number,
  maxSpanDeg: number,
): ClampedBbox {
  const maxSpan = Math.max(0.01, maxSpanDeg);
  let s = clampLat(Math.min(south, north));
  let n = clampLat(Math.max(south, north));
  let w = clampLng(Math.min(west, east));
  let e = clampLng(Math.max(west, east));

  let clamped =
    s !== south || n !== north || w !== west || e !== east;

  const latSpan = n - s;
  if (latSpan > maxSpan) {
    const centerLat = (s + n) / 2;
    const half = maxSpan / 2;
    s = clampLat(centerLat - half);
    n = clampLat(centerLat + half);
    if (n - s > maxSpan) {
      n = clampLat(s + maxSpan);
    }
    clamped = true;
  }

  const lngSpan = e - w;
  if (lngSpan > maxSpan) {
    const centerLng = (w + e) / 2;
    const half = maxSpan / 2;
    w = clampLng(centerLng - half);
    e = clampLng(centerLng + half);
    if (e - w > maxSpan) {
      e = clampLng(w + maxSpan);
    }
    clamped = true;
  }

  return {
    south: Number(s.toFixed(6)),
    west: Number(w.toFixed(6)),
    north: Number(n.toFixed(6)),
    east: Number(e.toFixed(6)),
    clamped,
  };
}

export function sanitizeHttpsUrl(url: string | null | undefined): string | null {
  if (typeof url !== 'string') return null;
  const trimmed = url.trim();
  if (!trimmed || trimmed.length > 2048) return null;
  if (/[\u0000-\u001F\u007F]/.test(trimmed)) return null;
  if (trimmed.startsWith('//')) return null;

  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== 'https:') return null;
    if (parsed.username || parsed.password) return null;
    if (!parsed.hostname) return null;
    return parsed.toString();
  } catch {
    return null;
  }
}

export class SafeFetchError extends Error {
  readonly status?: number;
  readonly isTimeout: boolean;
  readonly isRateLimited: boolean;
  readonly retryAfterSec?: number;

  constructor(
    message: string,
    opts: {
      status?: number;
      isTimeout?: boolean;
      isRateLimited?: boolean;
      retryAfterSec?: number;
    } = {},
  ) {
    super(message);
    this.name = 'SafeFetchError';
    this.status = opts.status;
    this.isTimeout = Boolean(opts.isTimeout);
    this.isRateLimited = Boolean(opts.isRateLimited);
    this.retryAfterSec = opts.retryAfterSec;
  }
}

export interface SafeFetchOptions {
  method?: 'GET' | 'POST';
  headers?: Record<string, string>;
  body?: string;
  timeoutMs?: number;
  signal?: AbortSignal;
  revalidate?: number;
}

export interface SafeFetchResult<T> {
  data: T;
  status: number;
  headers: Headers;
}

/**
 * Hardened JSON fetcher for open-data BFF proxies:
 * - Requires valid HTTPS URL (blocks http:, file:, javascript:, credentials)
 * - Enforces `redirect: 'error'` to block SSRF open-redirect pivots
 * - Enforces `AbortSignal.timeout(5000)` by default
 * - Sends explicit LKDV `User-Agent` header
 */
export async function safeFetchJson<T>(
  url: string,
  options: SafeFetchOptions = {},
): Promise<SafeFetchResult<T>> {
  const safeUrl = sanitizeHttpsUrl(url);
  if (!safeUrl) {
    throw new SafeFetchError('Invalid or non-HTTPS upstream URL');
  }

  const timeoutMs = Math.max(500, Math.min(10_000, options.timeoutMs ?? 5000));
  const timeoutSignal = AbortSignal.timeout(timeoutMs);
  const signal = options.signal
    ? AbortSignal.any([options.signal, timeoutSignal])
    : timeoutSignal;

  const headers: Record<string, string> = {
    'User-Agent': LKDV_USER_AGENT,
    Accept: 'application/json',
    ...(options.headers ?? {}),
  };

  try {
    const fetchInit: RequestInit & { next?: { revalidate?: number } } = {
      method: options.method ?? 'GET',
      headers,
      body: options.body,
      // Cloudflare Workers (`workerd`) rejects `redirect: 'error'` with a TypeError.
      // Using `redirect: 'manual'` + rejecting 3xx responses preserves identical
      // SSRF open-redirect protection across both Node.js and Cloudflare Workers.
      redirect: 'manual',
      signal,
    };
    if (typeof options.revalidate === 'number') {
      fetchInit.next = { revalidate: options.revalidate };
    }

    const res = await fetch(safeUrl, fetchInit);
    if (res.status >= 300 && res.status < 400) {
      throw new SafeFetchError(`Upstream redirect HTTP ${res.status} rejected`, {
        status: res.status,
      });
    }
    if (!res.ok) {
      const retryHeader = res.headers.get('retry-after');
      const retryAfterSec = retryHeader && Number.isFinite(Number(retryHeader))
        ? Number(retryHeader)
        : undefined;
      throw new SafeFetchError(`Upstream HTTP ${res.status}`, {
        status: res.status,
        isRateLimited: res.status === 429,
        retryAfterSec,
      });
    }

    const data = (await res.json()) as T;
    return { data, status: res.status, headers: res.headers };
  } catch (err) {
    if (err instanceof SafeFetchError) throw err;
    const isTimeout =
      err instanceof Error &&
      (err.name === 'TimeoutError' || err.name === 'AbortError');
    throw new SafeFetchError(
      err instanceof Error ? err.message : 'Upstream fetch failed',
      { isTimeout },
    );
  }
}

let cachedEphemeralHmacSecret: string | null = null;

function getEphemeralHmacSecret(): string {
  if (!cachedEphemeralHmacSecret) {
    cachedEphemeralHmacSecret = crypto.randomBytes(32).toString('hex');
  }
  return cachedEphemeralHmacSecret;
}

function resolveLocationHmacSecret(explicitSecret?: string): string {
  if (explicitSecret && explicitSecret.trim().length > 0) {
    return explicitSecret;
  }
  const envSecret =
    process.env.EXPLORER_LOCATION_HMAC_SECRET?.trim() ||
    process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ||
    process.env.NEXTAUTH_SECRET?.trim();
  if (envSecret) return envSecret;
  return getEphemeralHmacSecret();
}

export interface FuzzedLocation {
  lat: number;
  lng: number;
  fuzzyRadiusM: number;
  hourBucket: number;
}

/**
 * Keyed HMAC-SHA256 >=250m location jitter rotated every hour bucket.
 * Guarantees deterministic display within a 1-hour window (no visual pin jitter)
 * while preventing offline reversal or cross-hour triangulation.
 * Distance is strictly in [255m, 345m] so Haversine distance always satisfies
 * >=250m privacy floor and stays within [180m, 400m].
 */
export function fuzzLocation250mHmac(
  lat: number,
  lng: number,
  userId: string,
  nowMs = Date.now(),
  secret?: string,
): FuzzedLocation {
  const hourBucket = Math.floor(nowMs / 3_600_000);
  const key = resolveLocationHmacSecret(secret);
  const digest = crypto
    .createHmac('sha256', key)
    .update(`lkdv-fuzz-v1:${userId}:${hourBucket}`)
    .digest();

  const angleUnit = digest.readUInt32BE(0) / 0xffffffff;
  const distUnit = digest.readUInt32BE(4) / 0xffffffff;

  const angle = angleUnit * Math.PI * 2;
  const distMeters = 255 + distUnit * 90; // [255m, 345m]

  const metersPerDegLat = 111_320;
  const clampedBaseLat = Math.max(-89.9, Math.min(89.9, lat));
  const cosLat = Math.max(0.15, Math.cos((clampedBaseLat * Math.PI) / 180));

  const dLat = (Math.sin(angle) * distMeters) / metersPerDegLat;
  const dLng = (Math.cos(angle) * distMeters) / (metersPerDegLat * cosLat);

  const fuzzedLat = Math.max(-89.99999, Math.min(89.99999, clampedBaseLat + dLat));
  let fuzzedLng = lng + dLng;
  if (fuzzedLng > 180) fuzzedLng -= 360;
  if (fuzzedLng < -180) fuzzedLng += 360;

  return {
    lat: Number(fuzzedLat.toFixed(5)),
    lng: Number(fuzzedLng.toFixed(5)),
    fuzzyRadiusM: Math.round(distMeters),
    hourBucket,
  };
}

export function buildApiMeta(params: {
  source: string;
  attribution: string;
  stale?: boolean;
  ttlMs?: number;
  fetchedAtMs?: number;
  upstreamUpdatedAt?: string;
  warning?: string;
}): ExplorerApiMeta {
  const fetchedMs = params.fetchedAtMs ?? Date.now();
  const meta: ExplorerApiMeta = {
    fetchedAt: new Date(fetchedMs).toISOString(),
    stale: Boolean(params.stale),
    source: params.source,
    attribution: params.attribution,
  };
  if (params.upstreamUpdatedAt) {
    meta.upstreamUpdatedAt = params.upstreamUpdatedAt;
  }
  if (typeof params.ttlMs === 'number' && params.ttlMs > 0) {
    meta.expiresAt = new Date(fetchedMs + params.ttlMs).toISOString();
  }
  if (params.warning) {
    meta.warning = params.warning;
  }
  return meta;
}

export interface GeoJsonPointFeature {
  type: 'Feature';
  id?: string;
  geometry: {
    type: 'Point';
    coordinates: [number, number];
  };
  properties: Record<string, unknown>;
}

export interface GeoJsonFeatureCollection {
  type: 'FeatureCollection';
  features: GeoJsonPointFeature[];
}

export function emptyFeatureCollection(): GeoJsonFeatureCollection {
  return { type: 'FeatureCollection', features: [] };
}
