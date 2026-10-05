import 'server-only';
import sharp from 'sharp';

/**
 * Altitudes depuis les « Terrain Tiles » (AWS Open Data, format Terrarium) :
 * gratuites, sans clé ni quota, usage commercial permis. Sources : SRTM,
 * GMTED, ETOPO1, NED… (attribution : « Terrain Tiles, Mapzen / AWS Open Data »).
 *
 * Zoom 12 : un pixel ≈ 38 m à l'équateur, assez pour l'altitude d'une étape
 * ou le profil d'un tracé. Une tuile décodée sert à tous les points qu'elle
 * couvre ; les dernières tuiles restent en mémoire.
 *
 * Échec réseau ou tuile illisible : `null` pour les points concernés, jamais
 * une altitude devinée.
 */

export const TERRAIN_SOURCE = 'Terrain Tiles (Mapzen / AWS Open Data)';
const TILE_URL = 'https://s3.amazonaws.com/elevation-tiles-prod/terrarium';
const ZOOM = 12;
const SIZE = 256;
const MAX_TILES = 64;

const tiles = new Map<string, Promise<Uint8Array | null>>();

function tileOf(lon: number, lat: number): { x: number; y: number; px: number; py: number } {
  const n = 2 ** ZOOM;
  const latRad = (Math.max(-85.05, Math.min(85.05, lat)) * Math.PI) / 180;
  const fx = ((lon + 180) / 360) * n;
  const fy = ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n;
  const x = Math.min(n - 1, Math.max(0, Math.floor(fx)));
  const y = Math.min(n - 1, Math.max(0, Math.floor(fy)));
  return {
    x,
    y,
    px: Math.min(SIZE - 1, Math.floor((fx - x) * SIZE)),
    py: Math.min(SIZE - 1, Math.floor((fy - y) * SIZE)),
  };
}

async function loadTile(x: number, y: number): Promise<Uint8Array | null> {
  try {
    const res = await fetch(`${TILE_URL}/${ZOOM}/${x}/${y}.png`, {
      // Le relief ne change pas : un mois de cache de données Vercel.
      next: { revalidate: 60 * 60 * 24 * 30 },
      signal: AbortSignal.timeout(6000),
    });
    if (!res.ok) return null;
    const png = Buffer.from(await res.arrayBuffer());
    const { data, info } = await sharp(png).removeAlpha().raw().toBuffer({ resolveWithObject: true });
    if (info.width !== SIZE || info.height !== SIZE || info.channels !== 3) return null;
    return new Uint8Array(data);
  } catch {
    return null;
  }
}

function tile(x: number, y: number): Promise<Uint8Array | null> {
  const key = `${x}/${y}`;
  let p = tiles.get(key);
  if (!p) {
    if (tiles.size >= MAX_TILES) tiles.delete(tiles.keys().next().value as string);
    p = loadTile(x, y);
    tiles.set(key, p);
    // Une tuile en échec ne reste pas en mémoire : on réessaiera.
    void p.then((t) => {
      if (!t) tiles.delete(key);
    });
  }
  return p;
}

/** Terrarium : altitude = (R × 256 + G + B / 256) − 32768 mètres. */
export function decodeTerrarium(r: number, g: number, b: number): number {
  return r * 256 + g + b / 256 - 32768;
}

/** Altitudes des points [lon, lat], dans l'ordre ; null si rien n'a pu être lu. */
export async function terrainElevations(
  points: ReadonlyArray<readonly [number, number]>
): Promise<(number | null)[] | null> {
  if (points.length === 0) return null;
  const out = await Promise.all(
    points.map(async ([lon, lat]) => {
      if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
      const t = tileOf(lon, lat);
      const data = await tile(t.x, t.y);
      if (!data) return null;
      const i = (t.py * SIZE + t.px) * 3;
      const h = decodeTerrarium(data[i], data[i + 1], data[i + 2]);
      // Mer et vides de données (≈ −32768) : pas une altitude.
      return h < -500 ? null : Math.round(h);
    })
  );
  return out.some((v) => v != null) ? out : null;
}
