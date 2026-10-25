import 'server-only';
import { z } from 'zod';
import { getServiceSupabase } from '@/lib/ai/serviceClient';
import { GEO_SITE_KINDS, type GeoSiteKind, type GeoSiteNear } from '../engine/geoSites';

/**
 * Sites d'escalade et de ski autour d'un point, lus dans le référentiel `geo_sites` (plan 3.5) :
 * falaises et secteurs (Kalymnos), via ferrata (Dolomites), domaines skiables, gares de remontée.
 * Le choix d'un cœur de zone (`densestSite`) ou d'un site nommé (`findSitesByName`) se fait ensuite
 * côté Compas, sur ces lignes.
 *
 * INTERRUPTEUR : `COMPAS_GEO_SITES=1` (variable Vercel). Éteint (défaut), cette fonction ne touche
 * pas à la base et rend null : le Compas se comporte comme avant. Table vide ou zone non importée :
 * null aussi (la base dit « non couvert »), donc rien ne change non plus.
 */
export function geoSitesEnabled(): boolean {
  const v = (process.env.COMPAS_GEO_SITES ?? '').trim().toLowerCase();
  return v === '1' || v === 'on' || v === 'true';
}

const kindSchema = z.enum(GEO_SITE_KINDS as [GeoSiteKind, ...GeoSiteKind[]]);

const rowSchema = z.object({
  osm_id: z.string().regex(/^[nwr]\d+$/),
  kind: kindSchema,
  name: z.string().min(1),
  lat: z.number().min(-90).max(90),
  lon: z.number().min(-180).max(180),
  ele_m: z.number().nullable(),
  distance_km: z.number().min(0),
});

const resultSchema = z.object({ covered: z.boolean(), rows: z.array(z.unknown()) });

/** Rayon au-delà duquel la base plafonne (20 km, voir `geo_sites_around`). */
export const GEO_SITES_MAX_RADIUS_M = 20_000;

/**
 * Les sites du référentiel à moins de `radiusM` du point, du plus proche au plus loin. Null :
 * interrupteur éteint, base muette, ou zone non importée (jamais « rien ici » sans le savoir).
 */
export async function referentialSitesAround(
  point: { lat: number; lon: number },
  radiusM: number,
  kinds?: readonly GeoSiteKind[]
): Promise<GeoSiteNear[] | null> {
  if (!geoSitesEnabled()) return null;
  const client = getServiceSupabase();
  if (!client) return null;
  try {
    const { data, error } = await client.rpc('geo_sites_around', {
      p_lat: point.lat,
      p_lon: point.lon,
      p_radius_m: Math.round(Math.min(Math.max(radiusM, 100), GEO_SITES_MAX_RADIUS_M)),
      p_kinds: kinds && kinds.length ? [...kinds] : null,
      p_limit: 300,
    });
    if (error) {
      console.warn('[compas] référentiel des sites d’escalade et de ski', error.code);
      return null;
    }
    const parsed = resultSchema.safeParse(data);
    if (!parsed.success || !parsed.data.covered) return null;
    const rows: GeoSiteNear[] = [];
    for (const raw of parsed.data.rows) {
      const row = rowSchema.safeParse(raw);
      if (row.success) rows.push(row.data);
    }
    return rows;
  } catch (err) {
    console.warn(
      '[compas] référentiel des sites d’escalade et de ski',
      err instanceof Error ? err.message : 'erreur'
    );
    return null;
  }
}
