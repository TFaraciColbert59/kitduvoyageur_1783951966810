/// <reference lib="webworker" />

/**
 * Worker géo de l'Explorer v2 (02_ARCHITECTURE §2, 05_DONNEES §2).
 *
 * Calcule le profil altimétrique d'une trace à partir du modèle numérique de
 * terrain **AWS Terrain Tiles** (tuiles `terrarium`, open data, sans clé) :
 *   1. découpe la trace en points équidistants (~60 m) ;
 *   2. décode les tuiles PNG terrarium nécessaires ;
 *   3. échantillonne l'altitude réelle et renvoie le profil.
 *
 * Aucune valeur inventée : si une tuile manque, l'échantillon est marqué `null`
 * et le client n'affiche pas de courbe pour cette portion.
 */

export interface ProfileRequest {
  id: number;
  positions: Array<[number, number]>;
  stepM?: number;
  demZoom?: number;
}

export interface ProfilePoint {
  /** Distance cumulée depuis le départ, en mètres. */
  d: number;
  /** Altitude en mètres, ou null si la tuile n'a pas pu être lue. */
  ele: number | null;
}

export interface ProfileResult {
  id: number;
  points: ProfilePoint[];
  distance_m: number;
  gain_m: number;
  loss_m: number;
  min_m: number | null;
  max_m: number | null;
  source: 'aws-terrarium';
}

const TILE_URL = 'https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png';

function lonToTileX(lon: number, z: number): number {
  return ((lon + 180) / 360) * 2 ** z;
}

function latToTileY(lat: number, z: number): number {
  const rad = (lat * Math.PI) / 180;
  return ((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2) * 2 ** z;
}

function haversineM(a: [number, number], b: [number, number]): number {
  const R = 6371000;
  const dLat = ((b[1] - a[1]) * Math.PI) / 180;
  const dLon = ((b[0] - a[0]) * Math.PI) / 180;
  const lat1 = (a[1] * Math.PI) / 180;
  const lat2 = (b[1] * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Sous-échantillonne une trace trop dense (les géométries OSM sont bruitées). */
function decimate(positions: Array<[number, number]>, max: number): Array<[number, number]> {
  if (positions.length <= max) return positions;
  const step = Math.ceil(positions.length / max);
  const out: Array<[number, number]> = [];
  for (let index = 0; index < positions.length; index += step) out.push(positions[index]);
  const last = positions[positions.length - 1];
  if (out[out.length - 1] !== last) out.push(last);
  return out;
}

/** Rééchantillonne la trace tous les `stepM` mètres. */
export function resampleTrack(
  positions: Array<[number, number]>,
  stepM = 60,
): Array<{ position: [number, number]; distance_m: number }> {
  if (positions.length === 0) return [];
  const out: Array<{ position: [number, number]; distance_m: number }> = [
    { position: positions[0], distance_m: 0 },
  ];
  let travelled = 0;
  let nextAt = stepM;
  for (let i = 1; i < positions.length; i += 1) {
    const a = positions[i - 1];
    const b = positions[i];
    const segment = haversineM(a, b);
    let cursor = travelled;
    while (cursor + segment >= nextAt && segment > 0) {
      const ratio = (nextAt - cursor) / segment;
      out.push({
        position: [a[0] + (b[0] - a[0]) * ratio, a[1] + (b[1] - a[1]) * ratio],
        distance_m: nextAt,
      });
      nextAt += stepM;
      cursor = nextAt;
    }
    travelled += segment;
  }
  return out;
}

/**
 * Cache d'altitudes par tuile (Float32Array 256×256 = 256 Ko) plutôt que les
 * pixels RGBA (1 Mo) : une trace de 9 km traverse une dizaine de tuiles.
 */
const elevationCache = new Map<string, Float32Array>();
const MAX_TILES = 24;

async function loadTile(z: number, x: number, y: number): Promise<Float32Array | null> {
  const key = `${z}/${x}/${y}`;
  const cached = elevationCache.get(key);
  if (cached) return cached;
  try {
    const res = await fetch(TILE_URL.replace('{z}', String(z)).replace('{x}', String(x)).replace('{y}', String(y)));
    if (!res.ok) return null;
    const blob = await res.blob();
    const bitmap = await createImageBitmap(blob);
    const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.drawImage(bitmap, 0, 0);
    const data = ctx.getImageData(0, 0, bitmap.width, bitmap.height);
    const size = bitmap.width;
    bitmap.close();
    const elevations = new Float32Array(size * size);
    for (let index = 0; index < elevations.length; index += 1) {
      const offset = index * 4;
      elevations[index] = data.data[offset] * 256 + data.data[offset + 1] + data.data[offset + 2] / 256 - 32768;
    }
    if (elevationCache.size >= MAX_TILES) {
      const oldest = elevationCache.keys().next().value;
      if (oldest) elevationCache.delete(oldest);
    }
    elevationCache.set(key, elevations);
    return elevations;
  } catch {
    return null;
  }
}

function elevationFromTile(data: Float32Array, size: number, px: number, py: number): number {
  return data[py * size + px];
}

/** Altitude terrarium d'une position (null si tuile indisponible). */
export async function elevationAt(
  lng: number,
  lat: number,
  z: number,
): Promise<number | null> {
  const size = 256;
  const xf = lonToTileX(lng, z);
  const yf = latToTileY(lat, z);
  const x = Math.floor(xf);
  const y = Math.floor(yf);
  const data = await loadTile(z, x, y);
  if (!data) return null;
  const px = Math.min(size - 1, Math.max(0, Math.floor((xf - x) * size)));
  const py = Math.min(size - 1, Math.max(0, Math.floor((yf - y) * size)));
  return Math.round(elevationFromTile(data, size, px, py));
}

export async function buildProfile(request: ProfileRequest): Promise<ProfileResult> {
  const { id, positions } = request;
  const demZoom = request.demZoom ?? 10;
  const raw = decimate(positions, 400);
  // Pas d'échantillonnage : ~80 points suffisent pour un profil lisible, et
  // bornent le nombre de tuiles DEM à charger.
  const trackLength = raw.reduce(
    (total, point, index) => (index === 0 ? 0 : total + haversineM(raw[index - 1], point)),
    0,
  );
  const stepM = request.stepM ?? Math.max(80, Math.ceil(trackLength / 40));
  const samples = resampleTrack(raw, stepM);

  const points: ProfilePoint[] = [];
  for (let index = 0; index < samples.length; index += 1) {
    const sample = samples[index];
    const ele = await elevationAt(sample.position[0], sample.position[1], demZoom);
    points.push({ d: Math.round(sample.distance_m), ele });
    // Rend la main toutes les 8 tuiles : la feuille reste interactive.
    if (index % 8 === 7 && typeof requestAnimationFrame === 'function') {
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
  }

  let gain = 0;
  let loss = 0;
  let min: number | null = null;
  let max: number | null = null;
  for (let i = 1; i < points.length; i += 1) {
    const previous = points[i - 1].ele;
    const current = points[i].ele;
    if (previous === null || current === null) continue;
    const delta = current - previous;
    if (delta > 0) gain += delta;
    else loss -= delta;
  }
  for (const point of points) {
    if (point.ele === null) continue;
    if (min === null || point.ele < min) min = point.ele;
    if (max === null || point.ele > max) max = point.ele;
  }

  return {
    id,
    points,
    distance_m: points.length ? points[points.length - 1].d : 0,
    gain_m: Math.round(gain),
    loss_m: Math.round(loss),
    min_m: min,
    max_m: max,
    source: 'aws-terrarium',
  };
}

const worker = self as unknown as DedicatedWorkerGlobalScope;

worker.addEventListener('message', (event: MessageEvent<ProfileRequest>) => {
  void buildProfile(event.data).then((result) => worker.postMessage(result));
});
