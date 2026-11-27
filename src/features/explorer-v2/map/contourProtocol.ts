/**
 * Explorer v2 — Client-Side Topographic Contour Lines Protocol (`lkdv-contour://{z}/{x}/{y}`).
 *
 * Fetches AWS Terrarium DEM tiles (same tileset cached offline by `slopeProtocol.ts`),
 * decodes elevation in meters, and renders razor-sharp IGN/Swisstopo-inspired
 * topographic contour lines (courbes de niveau: minor + thicker index contours)
 * directly draped onto MapLibre's 3D terrain — globally, at zero external API cost.
 */

import { decodeTerrariumTile, terrariumTileUrl, TILE_SIZE } from '../geo/dem';
import type { MapLibreProtocolRegistry } from './slopeProtocol';

export const CONTOUR_PROTOCOL_NAME = 'lkdv-contour';
export const MAX_CONTOUR_TILE_CACHE = 32;

export interface ContourIntervals {
  minorM: number;
  majorM: number;
}

/**
 * Returns zoom-calibrated contour intervals (in meters) matching IGN/Swisstopo readability.
 */
export function contourIntervalsForZoom(z: number): ContourIntervals {
  if (z >= 14) return { minorM: 10, majorM: 50 };
  if (z >= 12) return { minorM: 20, majorM: 100 };
  if (z >= 10) return { minorM: 50, majorM: 250 };
  return { minorM: 100, majorM: 500 };
}

/** Parses `lkdv-contour://{z}/{x}/{y}` (with optional `.png`). */
export function parseContourTileUrl(url: string): { z: number; x: number; y: number } | null {
  const match = /^lkdv-contour:\/\/(\d+)\/(\d+)\/(\d+)(?:\.png)?(?:\?.*)?$/i.exec(url.trim());
  if (!match) return null;
  const z = Number.parseInt(match[1], 10);
  const x = Number.parseInt(match[2], 10);
  const y = Number.parseInt(match[3], 10);
  if (!Number.isFinite(z) || !Number.isFinite(x) || !Number.isFinite(y)) return null;
  return { z, x, y };
}

/**
 * Renders crisp topographic contour lines (minor & bold major index lines) into an RGBA buffer.
 * Skips sea level (<= 1 m) so oceans and flat coastal waters remain crystal clean.
 */
export function renderContourPixels(
  elevations: Float32Array,
  size: number,
  z: number,
): Uint8ClampedArray {
  const rgba = new Uint8ClampedArray(size * size * 4);
  const { minorM, majorM } = contourIntervalsForZoom(z);
  const invMinor = 1 / minorM;
  const invMajor = 1 / majorM;
  const maxIdx = size - 1;

  for (let py = 0; py < maxIdx; py += 1) {
    const row = py * size;
    const nextRow = (py + 1) * size;
    for (let px = 0; px < maxIdx; px += 1) {
      const e0 = elevations[row + px];
      // Keep oceans, lakes & sea-level flats clean
      if (!Number.isFinite(e0) || e0 <= 1.5) continue;

      const eRight = elevations[row + px + 1];
      const eDown = elevations[nextRow + px];

      const b0Major = Math.floor(e0 * invMajor);
      const isMajor =
        b0Major !== Math.floor(eRight * invMajor) || b0Major !== Math.floor(eDown * invMajor);

      if (isMajor) {
        // Bold warm alpine-umber index contour (1.5px presence via right/down subtle AA)
        const off = (row + px) * 4;
        rgba[off] = 88;
        rgba[off + 1] = 66;
        rgba[off + 2] = 44;
        rgba[off + 3] = 176;

        const offR = (row + px + 1) * 4;
        if (rgba[offR + 3] < 80) {
          rgba[offR] = 88;
          rgba[offR + 1] = 66;
          rgba[offR + 2] = 44;
          rgba[offR + 3] = 74;
        }
        continue;
      }

      const b0Minor = Math.floor(e0 * invMinor);
      const isMinor =
        b0Minor !== Math.floor(eRight * invMinor) || b0Minor !== Math.floor(eDown * invMinor);

      if (isMinor) {
        const off = (row + px) * 4;
        rgba[off] = 112;
        rgba[off + 1] = 90;
        rgba[off + 2] = 64;
        rgba[off + 3] = 104;
      }
    }
  }

  return rgba;
}

class BoundedTileCache {
  private readonly store = new Map<string, ArrayBuffer>();
  private readonly maxEntries: number;

  constructor(maxEntries: number) {
    this.maxEntries = maxEntries;
  }

  get(key: string): ArrayBuffer | undefined {
    const existing = this.store.get(key);
    if (!existing) return undefined;
    this.store.delete(key);
    this.store.set(key, existing);
    return existing;
  }

  set(key: string, value: ArrayBuffer): void {
    if (this.store.has(key)) {
      this.store.delete(key);
    } else if (this.store.size >= this.maxEntries) {
      const oldest = this.store.keys().next().value;
      if (oldest !== undefined) this.store.delete(oldest);
    }
    this.store.set(key, value);
  }

  clear(): void {
    this.store.clear();
  }
}

const contourTileCache = new BoundedTileCache(MAX_CONTOUR_TILE_CACHE);
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
        el.onerror = () => reject(new Error('Failed to decode DEM tile'));
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

  throw new Error('No image decoder available');
}

async function encodeRgbaToPngBuffer(rgba: Uint8ClampedArray, size: number): Promise<ArrayBuffer> {
  if (typeof OffscreenCanvas !== 'undefined') {
    const canvas = new OffscreenCanvas(size, size);
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('OffscreenCanvas 2D context unavailable');
    ctx.putImageData(new ImageData(new Uint8ClampedArray(rgba), size, size), 0, 0);
    const pngBlob = await canvas.convertToBlob({ type: 'image/png' });
    return pngBlob.arrayBuffer();
  }

  if (typeof document !== 'undefined') {
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D context unavailable');
    ctx.putImageData(new ImageData(new Uint8ClampedArray(rgba), size, size), 0, 0);
    const pngBlob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (blob) => (blob ? resolve(blob) : reject(new Error('Failed to encode contour PNG'))),
        'image/png',
      );
    });
    return pngBlob.arrayBuffer();
  }

  throw new Error('No PNG encoder available');
}

/**
 * Registers the `lkdv-contour://{z}/{x}/{y}` custom protocol idempotently.
 */
export function registerContourProtocol(maplibregl: MapLibreProtocolRegistry): boolean {
  if (!maplibregl || typeof maplibregl.addProtocol !== 'function') return false;
  if (registeredLibraries.has(maplibregl as object)) return false;

  maplibregl.addProtocol(CONTOUR_PROTOCOL_NAME, async (params, abortController) => {
    const coords = parseContourTileUrl(params.url);
    if (!coords) {
      throw new Error(`Invalid lkdv-contour tile URL: ${params.url}`);
    }

    const cacheKey = `${coords.z}/${coords.x}/${coords.y}`;
    const cached = contourTileCache.get(cacheKey);
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
    const contourRgba = renderContourPixels(elevations, size, coords.z);
    const pngBuffer = await encodeRgbaToPngBuffer(contourRgba, size);

    contourTileCache.set(cacheKey, pngBuffer);
    return { data: pngBuffer.slice(0) };
  });

  registeredLibraries.add(maplibregl as object);
  return true;
}

export function clearContourTileCache(): void {
  contourTileCache.clear();
}
