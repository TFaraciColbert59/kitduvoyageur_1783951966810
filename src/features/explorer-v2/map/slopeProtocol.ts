/**
 * Explorer v2 — Client-Side Offline Avalanche Slope Protocol (`lkdv-slope://{z}/{x}/{y}`).
 *
 * Fetches AWS Terrarium DEM tiles (compatible with Service Worker offline cache),
 * computes terrain slope in degrees via Horn's 3×3 gradient kernel, and renders
 * WCAG 1.4.1 colorblind-safe avalanche bands:
 *   - 30°–35° : yellow  #FACC15 (class 1)
 *   - 35°–40° : orange  #FB923C + subtle diagonal hatching (class 2)
 *   - 40°–45° : red     #EF4444 + cross-hatching (class 3)
 *   - > 45°   : violet  #A855F7 + dense cross-hatching (class 4)
 *
 * Rendered PNG tiles are held in a bounded in-memory LRU cache (`<= 24` tiles).
 */

import { decodeTerrariumTile, terrariumTileUrl, TILE_SIZE } from '../geo/dem';

export const SLOPE_PROTOCOL_NAME = 'lkdv-slope';
export const MAX_SLOPE_TILE_CACHE = 24;

const EARTH_CIRCUMFERENCE_M = 40_075_016.686;

export type AvalancheSlopeClass = 0 | 1 | 2 | 3 | 4;

export interface SlopeBandColor {
  readonly hex: string;
  readonly fill: readonly [number, number, number, number];
  readonly hatch?: readonly [number, number, number, number];
}

export const AVALANCHE_SLOPE_BANDS: Readonly<Record<Exclude<AvalancheSlopeClass, 0>, SlopeBandColor>> =
  Object.freeze({
    1: {
      hex: '#FACC15',
      fill: [250, 204, 21, 170],
    },
    2: {
      hex: '#FB923C',
      fill: [251, 146, 60, 185],
      hatch: [124, 45, 18, 225],
    },
    3: {
      hex: '#EF4444',
      fill: [239, 68, 68, 195],
      hatch: [69, 10, 10, 235],
    },
    4: {
      hex: '#A855F7',
      fill: [168, 85, 247, 205],
      hatch: [46, 16, 101, 240],
    },
  });

/**
 * Classifies a terrain slope angle in degrees into avalanche risk bands:
 * - `0`: `< 30°` (or invalid/non-finite) — transparent
 * - `1`: `30°–35°` — yellow `#FACC15`
 * - `2`: `35°–40°` — orange `#FB923C` (diagonal hatching)
 * - `3`: `40°–45°` — red `#EF4444` (cross-hatching)
 * - `4`: `> 45°` — violet `#A855F7` (dense cross-hatching)
 */
export function classifyAvalancheSlopeDeg(deg: number): AvalancheSlopeClass {
  if (!Number.isFinite(deg) || deg < 30) return 0;
  if (deg < 35) return 1;
  if (deg < 40) return 2;
  if (deg <= 45) return 3;
  return 4;
}

/**
 * Computes Web Mercator ground resolution (meters per pixel) at a given
 * tile zoom, tile Y index, and pixel row `py` (0..size-1).
 */
export function mercatorMetersPerPixel(
  z: number,
  tileY: number,
  py: number,
  size: number = TILE_SIZE,
): number {
  const n = Math.PI - (2 * Math.PI * (tileY + (py + 0.5) / size)) / 2 ** z;
  const latRad = Math.atan(Math.sinh(n));
  return Math.max(0.01, (EARTH_CIRCUMFERENCE_M * Math.cos(latRad)) / (size * 2 ** z));
}

/**
 * Computes Horn's 3×3 slope angle (degrees) and renders an RGBA pixel buffer
 * with colorblind-safe bands and WCAG 1.4.1 hatching patterns (>35° diagonal,
 * >40° cross-hatch).
 */
export function renderSlopePixels(
  elevations: Float32Array,
  size: number,
  z: number,
  tileY: number,
): Uint8ClampedArray {
  const rgba = new Uint8ClampedArray(size * size * 4);
  const maxIdx = size - 1;

  for (let py = 0; py < size; py += 1) {
    const cellM = mercatorMetersPerPixel(z, tileY, py, size);
    const invEightCell = 1 / (8 * cellM);
    const yPrev = py > 0 ? py - 1 : 0;
    const yNext = py < maxIdx ? py + 1 : maxIdx;
    const rowPrev = yPrev * size;
    const rowCurr = py * size;
    const rowNext = yNext * size;

    for (let px = 0; px < size; px += 1) {
      const xPrev = px > 0 ? px - 1 : 0;
      const xNext = px < maxIdx ? px + 1 : maxIdx;

      const a = elevations[rowPrev + xPrev];
      const b = elevations[rowPrev + px];
      const c = elevations[rowPrev + xNext];
      const d = elevations[rowCurr + xPrev];
      const f = elevations[rowCurr + xNext];
      const g = elevations[rowNext + xPrev];
      const h = elevations[rowNext + px];
      const i = elevations[rowNext + xNext];

      const dzdx = (c + 2 * f + i - (a + 2 * d + g)) * invEightCell;
      const dzdy = (g + 2 * h + i - (a + 2 * b + c)) * invEightCell;
      const slopeDeg = (Math.atan(Math.hypot(dzdx, dzdy)) * 180) / Math.PI;
      const cls = classifyAvalancheSlopeDeg(slopeDeg);

      if (cls === 0) continue;

      const band = AVALANCHE_SLOPE_BANDS[cls];
      let isHatch = false;
      if (cls === 2) {
        // Subtle diagonal hatching on >35°
        isHatch = (px + py) % 6 === 0;
      } else if (cls === 3) {
        // Cross-hatching on >40°
        isHatch = (px + py) % 6 === 0 || (px - py + size) % 6 === 0;
      } else if (cls === 4) {
        // Denser cross-hatching on >45°
        isHatch = (px + py) % 5 === 0 || (px - py + size) % 5 === 0;
      }

      const color = isHatch && band.hatch ? band.hatch : band.fill;
      const offset = (rowCurr + px) * 4;
      rgba[offset] = color[0];
      rgba[offset + 1] = color[1];
      rgba[offset + 2] = color[2];
      rgba[offset + 3] = color[3];
    }
  }

  return rgba;
}

/** Parses `lkdv-slope://{z}/{x}/{y}` (with optional `.png` or query string). */
export function parseSlopeTileUrl(url: string): { z: number; x: number; y: number } | null {
  const match = /^lkdv-slope:\/\/(\d+)\/(\d+)\/(\d+)(?:\.png)?(?:\?.*)?$/i.exec(url.trim());
  if (!match) return null;
  const z = Number.parseInt(match[1], 10);
  const x = Number.parseInt(match[2], 10);
  const y = Number.parseInt(match[3], 10);
  if (!Number.isFinite(z) || !Number.isFinite(x) || !Number.isFinite(y)) return null;
  return { z, x, y };
}

class LruTileCache {
  private readonly store = new Map<string, ArrayBuffer>();
  private readonly maxEntries: number;

  constructor(maxEntries: number) {
    this.maxEntries = maxEntries;
  }

  get(key: string): ArrayBuffer | undefined {
    const existing = this.store.get(key);
    if (!existing) return undefined;
    // Refresh recency
    this.store.delete(key);
    this.store.set(key, existing);
    return existing;
  }

  set(key: string, value: ArrayBuffer): void {
    if (this.store.has(key)) {
      this.store.delete(key);
    } else if (this.store.size >= this.maxEntries) {
      const oldestKey = this.store.keys().next().value;
      if (oldestKey !== undefined) {
        this.store.delete(oldestKey);
      }
    }
    this.store.set(key, value);
  }

  clear(): void {
    this.store.clear();
  }

  get size(): number {
    return this.store.size;
  }
}

const slopeTileCache = new LruTileCache(MAX_SLOPE_TILE_CACHE);
const registeredLibraries = new WeakSet<object>();

async function decodeImagePixels(
  blob: Blob,
): Promise<{ data: Uint8ClampedArray; width: number; height: number }> {
  if (typeof createImageBitmap === 'function' && typeof OffscreenCanvas !== 'undefined') {
    const bitmap = await createImageBitmap(blob);
    try {
      const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('OffscreenCanvas 2D context unavailable');
      ctx.drawImage(bitmap, 0, 0);
      const imageData = ctx.getImageData(0, 0, bitmap.width, bitmap.height);
      return { data: imageData.data, width: bitmap.width, height: bitmap.height };
    } finally {
      bitmap.close();
    }
  }

  if (typeof document !== 'undefined' && typeof URL !== 'undefined') {
    const objectUrl = URL.createObjectURL(blob);
    try {
      const img = await new Promise<HTMLImageElement>((resolve, reject) => {
        const el = new Image();
        el.crossOrigin = 'anonymous';
        el.onload = () => resolve(el);
        el.onerror = () => reject(new Error('Failed to decode Terrarium PNG tile'));
        el.src = objectUrl;
      });
      const canvas = document.createElement('canvas');
      canvas.width = img.width || TILE_SIZE;
      canvas.height = img.height || TILE_SIZE;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Canvas 2D context unavailable');
      ctx.drawImage(img, 0, 0);
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      return { data: imageData.data, width: canvas.width, height: canvas.height };
    } finally {
      URL.revokeObjectURL(objectUrl);
    }
  }

  throw new Error('No image decoder available in current environment');
}

async function encodeRgbaToPngBuffer(
  rgba: Uint8ClampedArray,
  size: number,
): Promise<ArrayBuffer> {
  if (typeof OffscreenCanvas !== 'undefined') {
    const canvas = new OffscreenCanvas(size, size);
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('OffscreenCanvas 2D context unavailable');
    const clamped = new Uint8ClampedArray(rgba);
    ctx.putImageData(new ImageData(clamped, size, size), 0, 0);
    const pngBlob = await canvas.convertToBlob({ type: 'image/png' });
    return pngBlob.arrayBuffer();
  }

  if (typeof document !== 'undefined') {
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D context unavailable');
    const clamped = new Uint8ClampedArray(rgba);
    ctx.putImageData(new ImageData(clamped, size, size), 0, 0);
    const pngBlob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (blob) => (blob ? resolve(blob) : reject(new Error('Failed to encode slope PNG'))),
        'image/png',
      );
    });
    return pngBlob.arrayBuffer();
  }

  throw new Error('No PNG encoder available in current environment');
}

export interface MapLibreProtocolRegistry {
  addProtocol(
    customProtocol: string,
    loadFn: (
      requestParameters: { url: string },
      abortController: AbortController,
    ) => Promise<{ data: ArrayBuffer }>,
  ): void;
}

/**
 * Registers the `lkdv-slope://{z}/{x}/{y}` custom protocol on a MapLibre GL
 * module instance. Idempotent per library reference.
 */
export function registerSlopeProtocol(maplibregl: MapLibreProtocolRegistry): boolean {
  if (!maplibregl || typeof maplibregl.addProtocol !== 'function') return false;
  if (registeredLibraries.has(maplibregl as object)) return false;

  maplibregl.addProtocol(SLOPE_PROTOCOL_NAME, async (params, abortController) => {
    const coords = parseSlopeTileUrl(params.url);
    if (!coords) {
      throw new Error(`Invalid lkdv-slope tile URL: ${params.url}`);
    }

    const cacheKey = `${coords.z}/${coords.x}/${coords.y}`;
    const cached = slopeTileCache.get(cacheKey);
    if (cached) {
      return { data: cached.slice(0) };
    }

    const demUrl = terrariumTileUrl(coords.z, coords.x, coords.y);
    const response = await fetch(demUrl, {
      signal: abortController?.signal,
      mode: 'cors',
    });
    if (!response.ok) {
      throw new Error(`Terrarium DEM fetch failed (${response.status}): ${demUrl}`);
    }

    const blob = await response.blob();
    const { data, width, height } = await decodeImagePixels(blob);
    const size = Math.min(width, height);
    const elevations = decodeTerrariumTile(data, size, 4);
    const slopeRgba = renderSlopePixels(elevations, size, coords.z, coords.y);
    const pngBuffer = await encodeRgbaToPngBuffer(slopeRgba, size);

    slopeTileCache.set(cacheKey, pngBuffer);
    return { data: pngBuffer.slice(0) };
  });

  registeredLibraries.add(maplibregl as object);
  return true;
}

/** Clears the in-memory slope tile LRU cache (useful on memory pressure or tests). */
export function clearSlopeTileCache(): void {
  slopeTileCache.clear();
}
