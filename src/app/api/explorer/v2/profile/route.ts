import { NextResponse } from 'next/server';
import { z } from 'zod';
import sharp from 'sharp';

export const revalidate = 86400;

const bodySchema = z.object({
  positions: z
    .array(z.tuple([z.number().min(-180).max(180), z.number().min(-90).max(90)]))
    .min(2)
    .max(6000),
  stepM: z.number().min(40).max(500).optional(),
  demZoom: z.number().int().min(8).max(13).optional(),
});

const TILE_URL = (z: number, x: number, y: number) =>
  `https://s3.amazonaws.com/elevation-tiles-prod/terrarium/${z}/${x}/${y}.png`;

/** Cache mémoire des tuiles décodées (altitudes), plafonné. */
const tileCache = new Map<string, Float32Array>();
const MAX_TILES = 48;

function lonToTileX(lon: number, zoom: number) {
  return ((lon + 180) / 360) * 2 ** zoom;
}
function latToTileY(lat: number, zoom: number) {
  const rad = (lat * Math.PI) / 180;
  return ((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2) * 2 ** zoom;
}
function haversineM(a: [number, number], b: [number, number]) {
  const R = 6371000;
  const dLat = ((b[1] - a[1]) * Math.PI) / 180;
  const dLon = ((b[0] - a[0]) * Math.PI) / 180;
  const lat1 = (a[1] * Math.PI) / 180;
  const lat2 = (b[1] * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

async function loadTile(zoom: number, x: number, y: number): Promise<Float32Array | null> {
  const key = `${zoom}/${x}/${y}`;
  const cached = tileCache.get(key);
  if (cached) return cached;
  try {
    const res = await fetch(TILE_URL(zoom, x, y), { next: { revalidate: 86400 * 30 } });
    if (!res.ok) return null;
    const buffer = Buffer.from(await res.arrayBuffer());
    const { data, info } = await sharp(buffer).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const size = info.width;
    const elevations = new Float32Array(size * size);
    for (let index = 0; index < elevations.length; index += 1) {
      const offset = index * info.channels;
      elevations[index] = data[offset] * 256 + data[offset + 1] + data[offset + 2] / 256 - 32768;
    }
    if (tileCache.size >= MAX_TILES) {
      const oldest = tileCache.keys().next().value;
      if (oldest) tileCache.delete(oldest);
    }
    tileCache.set(key, elevations);
    return elevations;
  } catch {
    return null;
  }
}

async function elevationAt(lng: number, lat: number, zoom: number): Promise<number | null> {
  const size = 256;
  const xf = lonToTileX(lng, zoom);
  const yf = latToTileY(lat, zoom);
  const x = Math.floor(xf);
  const y = Math.floor(yf);
  const data = await loadTile(zoom, x, y);
  if (!data) return null;
  const px = Math.min(size - 1, Math.max(0, Math.floor((xf - x) * size)));
  const py = Math.min(size - 1, Math.max(0, Math.floor((yf - y) * size)));
  return Math.round(data[py * size + px]);
}

function decimate(positions: Array<[number, number]>, max: number): Array<[number, number]> {
  if (positions.length <= max) return positions;
  const step = Math.ceil(positions.length / max);
  const out: Array<[number, number]> = [];
  for (let index = 0; index < positions.length; index += step) out.push(positions[index]);
  const last = positions[positions.length - 1];
  if (out[out.length - 1] !== last) out.push(last);
  return out;
}

function resample(positions: Array<[number, number]>, stepM: number) {
  const out: Array<{ position: [number, number]; d: number }> = [{ position: positions[0], d: 0 }];
  let travelled = 0;
  let nextAt = stepM;
  for (let index = 1; index < positions.length; index += 1) {
    const a = positions[index - 1];
    const b = positions[index];
    const segment = haversineM(a, b);
    while (travelled + segment >= nextAt && segment > 0) {
      const ratio = (nextAt - travelled) / segment;
      out.push({
        position: [a[0] + (b[0] - a[0]) * ratio, a[1] + (b[1] - a[1]) * ratio],
        d: nextAt,
      });
      nextAt += stepM;
    }
    travelled += segment;
  }
  return out;
}

/**
 * Profil altimétrique calculé côté serveur depuis le DEM AWS Terrarium
 * (P6-06). Le client envoie la trace, le serveur échantillonne le relief réel :
 * aucun décodage d'image dans le navigateur, résultat cacheable.
 */
export async function POST(request: Request) {
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'trace invalide' }, { status: 400 });
  }
  const { positions, stepM: requestedStep, demZoom = 10 } = parsed.data;
  const raw = decimate(positions as Array<[number, number]>, 400);
  const distance = raw.reduce(
    (total, point, index) => (index === 0 ? 0 : total + haversineM(raw[index - 1], point)),
    0,
  );
  const stepM = requestedStep ?? Math.max(80, Math.ceil(distance / 48));
  const samples = resample(raw, stepM);

  const points: Array<{ d: number; ele: number | null }> = [];
  for (const sample of samples) {
    points.push({ d: Math.round(sample.d), ele: await elevationAt(sample.position[0], sample.position[1], demZoom) });
  }

  let gain = 0;
  let loss = 0;
  let min: number | null = null;
  let max: number | null = null;
  for (let index = 1; index < points.length; index += 1) {
    const previous = points[index - 1].ele;
    const current = points[index].ele;
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

  return NextResponse.json(
    {
      points,
      distance_m: Math.round(distance),
      gain_m: Math.round(gain),
      loss_m: Math.round(loss),
      min_m: min,
      max_m: max,
      source: 'aws-terrarium',
      samples: points.length,
    },
    { headers: { 'Cache-Control': 'public, s-maxage=86400, stale-while-revalidate=604800' } },
  );
}
