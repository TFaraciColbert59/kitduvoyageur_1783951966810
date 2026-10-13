import 'server-only';
import { z } from 'zod';
import { getServiceSupabase } from '@/lib/ai/serviceClient';
import { STAGE_POI_RADIUS_M, parseOverpass, type StagePoint } from '../engine/stagePois';
import { geoPoiToElement, type GeoPoiRow } from '../engine/geoPois';
import type { RoutePoi } from '../engine/routePois';

/**
 * Refuges, campings et points d'eau autour d'une étape, lus dans le référentiel
 * (`geo_pois_around`, plan 3.4) : aucune requête Overpass pour ces catégories
 * quand la zone a été importée. Overpass reste le secours d'une zone absente
 * (plan 1.4).
 *
 * INTERRUPTEUR : `COMPAS_GEO_POIS=1` (variable Vercel). Éteint (défaut), cette
 * fonction ne touche pas à la base et rend null : le Compas se comporte comme
 * avant. À allumer par Tony une fois la migration `geo_pois` appliquée et le
 * premier import fait ; table vide ou zone non importée : null aussi (la base
 * dit « non couvert »), donc rien ne change non plus.
 */
export function geoPoisEnabled(): boolean {
  const v = (process.env.COMPAS_GEO_POIS ?? '').trim().toLowerCase();
  return v === '1' || v === 'on' || v === 'true';
}

const rowSchema = z.object({
  osm_id: z.string().regex(/^[nwr]\d+$/),
  subtype: z.enum(['alpine_hut', 'wilderness_hut', 'shelter', 'camp_site', 'drinking_water', 'spring']),
  name: z.string().nullable(),
  lat: z.number().min(-90).max(90),
  lon: z.number().min(-180).max(180),
  ele_m: z.number().nullable(),
  capacity: z.number().nullable(),
  potable: z.boolean().nullable(),
});

const resultSchema = z.object({ covered: z.boolean(), rows: z.array(z.unknown()) });

/**
 * Les points du référentiel autour d'un lieu d'étape, au même format que ceux
 * d'Overpass (`parseOverpass` : distance, plafond par catégorie, doublons).
 * Null : interrupteur éteint, base muette, ou zone non importée.
 */
export async function referentialPoisAround(place: StagePoint): Promise<RoutePoi[] | null> {
  if (!geoPoisEnabled()) return null;
  const client = getServiceSupabase();
  if (!client) return null;
  try {
    const { data, error } = await client.rpc('geo_pois_around', {
      p_lat: place.lat,
      p_lon: place.lon,
      p_radius_m: STAGE_POI_RADIUS_M,
      p_subtypes: null,
      p_limit: 300,
    });
    if (error) {
      console.warn('[compas] référentiel des refuges et points d’eau', error.code);
      return null;
    }
    const parsed = resultSchema.safeParse(data);
    if (!parsed.success || !parsed.data.covered) return null;
    const rows: GeoPoiRow[] = [];
    for (const raw of parsed.data.rows) {
      const row = rowSchema.safeParse(raw);
      if (row.success) rows.push(row.data);
    }
    return parseOverpass({ elements: rows.map(geoPoiToElement) }, [place]);
  } catch (err) {
    console.warn('[compas] référentiel des refuges et points d’eau', err instanceof Error ? err.message : 'erreur');
    return null;
  }
}
