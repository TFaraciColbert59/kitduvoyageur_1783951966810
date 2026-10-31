import { NextResponse } from 'next/server';
import { z } from 'zod';
import sharp from 'sharp';
import {
  decimateTrack,
  resampleTrack,
  summarizeElevation,
  trackDistanceM,
  type LngLat,
} from '@/features/explorer-v2/geo/track';
import {
  TILE_SIZE,
  decodeTerrariumTile,
  latToTileY,
  lonToTileX,
  sampleTileElevation,
  terrariumTileUrl,
  type TileDecoderInput,
} from '@/features/explorer-v2/geo/dem';

export const revalidate = 86400;

const bodySchema = z.object({
  positions: z
    .array(z.tuple([z.number().min(-180).max(180), z.number().min(-90).max(90)]))
    .min(2)
    .max(6000),
  stepM: z.number().min(40).max(500).optional(),
  demZoom: z.number().int().min(8).max(13).optional(),
});

/** Cache mémoire des tuiles décodées (altitudes), plafonné. */
const tileCache = new Map<string, Float32Array>();
const MAX_TILES = 48;

async function loadTile(zoom: number, x: number, y: number): Promise<Float32Array | null> {
  const key = `${zoom}/${x}/${y}`;
  const cached = tileCache.get(key);
  if (cached) return cached;
  try {
    const res = await fetch(terrariumTileUrl(zoom, x, y), { next: { revalidate: 86400 * 30 } });
    if (!res.ok) return null;
    const buffer = Buffer.from(await res.arrayBuffer());
    const { data, info } = await sharp(buffer).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const elevations = decodeTerrariumTile(data as TileDecoderInput, info.width, info.channels);
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
  const x = Math.floor(lonToTileX(lng, zoom));
  const y = Math.floor(latToTileY(lat, zoom));
  const tile = await loadTile(zoom, x, y);
  if (!tile) return null;
  return sampleTileElevation(tile, TILE_SIZE, lng, lat, zoom);
}

/**
 * Profil altimétrique calculé côté serveur depuis le DEM AWS Terrarium
 * (P6-06). Le client envoie la trace, le serveur échantillonne le relief réel :
 * aucun décodage d'image dans le navigateur, résultat cacheable.
 *
 * La géométrie (distance, décimation, rééchantillonnage, synthèse) vient du
 * moteur partagé `features/explorer-v2/geo/track` — même résultat que le worker
 * navigateur, une seule implémentation à maintenir.
 */
export async function POST(request: Request) {
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'trace invalide' }, { status: 400 });
  }
  const { positions, stepM: requestedStep, demZoom = 10 } = parsed.data;
  const raw = decimateTrack(positions as LngLat[], 400);
  const distance = trackDistanceM(raw);
  const stepM = requestedStep ?? Math.max(80, Math.ceil(distance / 48));
  const samples = resampleTrack(raw, stepM);

  const points: Array<{ d: number; ele: number | null }> = [];
  for (const sample of samples) {
    points.push({
      d: Math.round(sample.distance_m),
      ele: await elevationAt(sample.position[0], sample.position[1], demZoom),
    });
  }

  const summary = summarizeElevation(points, distance);

  return NextResponse.json(
    {
      points,
      distance_m: summary.distance_m,
      gain_m: summary.gain_m,
      loss_m: summary.loss_m,
      min_m: summary.min_m,
      max_m: summary.max_m,
      source: 'aws-terrarium',
      samples: points.length,
    },
    { headers: { 'Cache-Control': 'public, s-maxage=86400, stale-while-revalidate=604800' } },
  );
}
