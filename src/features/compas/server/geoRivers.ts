import 'server-only';
import { z } from 'zod';
import { getServiceSupabase } from '@/lib/ai/serviceClient';
import { normalizeRiverName, pickRiver, type GeoRiverRow } from '../engine/geoRivers';

/**
 * Une rivière (« Le Tarn », « Río Colorado ») retrouvée dans le référentiel `geo_rivers` (plan 3.6) :
 * son centre, son emprise, l'accès en canoë et la difficulté d'eau vive qu'en dit OSM, jamais son tracé.
 * Servira à `lookupRiver` (descente en canoë) quand l'import sera fait ; l'emprise se passe à
 * `riverQuery` via `riverExtent`.
 *
 * INTERRUPTEUR : `COMPAS_GEO_RIVERS=1` (variable Vercel). Éteint (défaut), cette fonction ne touche
 * pas à la base et rend null : le Compas se comporte comme avant. Table vide ou nom inconnu :
 * null aussi, donc rien ne change non plus.
 */
export function geoRiversEnabled(): boolean {
  const v = (process.env.COMPAS_GEO_RIVERS ?? '').trim().toLowerCase();
  return v === '1' || v === 'on' || v === 'true';
}

const rowSchema = z.object({
  osm_id: z.string().regex(/^[rw]\d+$/),
  name: z.string().min(1),
  name_plain: z.string().min(2),
  alt_plain: z.array(z.string()),
  canoe: z.enum(['yes', 'permissive', 'portage']).nullable(),
  whitewater_grade: z.number().int().min(0).max(6).nullable(),
  length_km: z.number().positive().nullable(),
  lat: z.number().min(-90).max(90),
  lon: z.number().min(-180).max(180),
  west: z.number().min(-180).max(180),
  south: z.number().min(-90).max(90),
  east: z.number().min(-180).max(180),
  north: z.number().min(-90).max(90),
});

/**
 * La rivière qui porte exactement ce nom (après normalisation), de préférence celle dont l'emprise
 * contient `near` ; null si l'interrupteur est éteint, la base muette ou le nom inconnu.
 */
export async function referentialRiver(
  name: string,
  near?: { lat: number; lon: number } | null
): Promise<GeoRiverRow | null> {
  if (!geoRiversEnabled()) return null;
  const key = normalizeRiverName(name);
  if (!key) return null;
  const client = getServiceSupabase();
  if (!client) return null;
  try {
    const { data, error } = await client.rpc('geo_rivers_by_name', { p_plain: key });
    if (error) {
      console.warn('[compas] référentiel des rivières', error.code);
      return null;
    }
    if (!Array.isArray(data)) return null;
    const rows: GeoRiverRow[] = [];
    for (const raw of data) {
      const row = rowSchema.safeParse(raw);
      if (row.success) rows.push(row.data);
    }
    return pickRiver(rows, name, near);
  } catch (err) {
    console.warn(
      '[compas] référentiel des rivières',
      err instanceof Error ? err.message : 'erreur'
    );
    return null;
  }
}
