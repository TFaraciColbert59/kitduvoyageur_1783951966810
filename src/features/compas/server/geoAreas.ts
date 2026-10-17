import 'server-only';
import { z } from 'zod';
import { getServiceSupabase } from '@/lib/ai/serviceClient';
import { normalizeAreaName, pickArea, type GeoAreaRow } from '../engine/geoAreas';

/**
 * Un parc ou un espace protégé (« Vanoise », « Calanques », « Massif de la Chartreuse » → le parc
 * naturel régional) retrouvé dans le référentiel `geo_areas` (plan 3.3) : sa nature, son centre et
 * son emprise rectangulaire, jamais son contour. Même forme utile que le lieu naturel rendu par
 * Photon (`lookupNatural`), sans appel réseau.
 *
 * INTERRUPTEUR : `COMPAS_GEO_AREAS=1` (variable Vercel). Éteint (défaut), cette fonction ne touche
 * pas à la base et rend null : le Compas se comporte comme avant. Table vide ou nom inconnu : null
 * aussi, donc rien ne change non plus.
 */
export function geoAreasEnabled(): boolean {
  const v = (process.env.COMPAS_GEO_AREAS ?? '').trim().toLowerCase();
  return v === '1' || v === 'on' || v === 'true';
}

const rowSchema = z.object({
  osm_id: z.string().regex(/^[wr]\d+$/),
  kind: z.enum(['national_park', 'protected_area', 'nature_reserve']),
  name: z.string().min(1),
  name_plain: z.string().min(2),
  protect_class: z.string().nullable(),
  lat: z.number().min(-90).max(90),
  lon: z.number().min(-180).max(180),
  west: z.number().min(-180).max(180),
  south: z.number().min(-90).max(90),
  east: z.number().min(-180).max(180),
  north: z.number().min(-90).max(90),
  area_km2: z.number().min(0).nullable(),
});

/** L'espace le plus étendu dont la clé est celle de ce nom, ou null (interrupteur éteint, base muette, inconnu). */
export async function referentialArea(name: string): Promise<GeoAreaRow | null> {
  if (!geoAreasEnabled()) return null;
  const key = normalizeAreaName(name.slice(0, 140));
  if (!key) return null;
  const client = getServiceSupabase();
  if (!client) return null;
  try {
    const { data, error } = await client.rpc('geo_areas_by_name', { p_name_plain: key });
    if (error) {
      console.warn('[compas] référentiel des parcs', error.code);
      return null;
    }
    if (!Array.isArray(data)) return null;
    const rows: GeoAreaRow[] = [];
    for (const raw of data) {
      const row = rowSchema.safeParse(raw);
      if (row.success) rows.push(row.data);
    }
    return pickArea(rows, key);
  } catch (err) {
    console.warn('[compas] référentiel des parcs', err instanceof Error ? err.message : 'erreur');
    return null;
  }
}
