import 'server-only';
import { z } from 'zod';
import { getServiceSupabase } from '@/lib/ai/serviceClient';
import { normalizeTrailRef, pickTrail, type GeoTrailRow } from '../engine/geoTrails';

/**
 * Un grand itinéraire (« GR34 », « E5 ») retrouvé dans le référentiel `geo_trails` (plan 3.7) :
 * son centre et son emprise, jamais son tracé. Remplacera `FAMOUS_TRAILS` quand l'import sera fait.
 *
 * INTERRUPTEUR : `COMPAS_GEO_TRAILS=1` (variable Vercel). Éteint (défaut), cette fonction ne touche
 * pas à la base et rend null : le Compas se comporte comme avant. Table vide ou référence inconnue :
 * null aussi, donc rien ne change non plus.
 */
export function geoTrailsEnabled(): boolean {
  const v = (process.env.COMPAS_GEO_TRAILS ?? '').trim().toLowerCase();
  return v === '1' || v === 'on' || v === 'true';
}

const rowSchema = z.object({
  osm_id: z.string().regex(/^r\d+$/),
  ref: z.string().nullable(),
  name: z.string().nullable(),
  network: z.enum(['iwn', 'nwn']),
  lat: z.number().min(-90).max(90),
  lon: z.number().min(-180).max(180),
  west: z.number().min(-180).max(180),
  south: z.number().min(-90).max(90),
  east: z.number().min(-180).max(180),
  north: z.number().min(-90).max(90),
});

/** L'itinéraire le plus étendu qui porte exactement cette référence, ou null (interrupteur éteint, base muette, inconnu). */
export async function referentialTrail(ref: string): Promise<GeoTrailRow | null> {
  if (!geoTrailsEnabled()) return null;
  const key = normalizeTrailRef(ref);
  if (!key) return null;
  const client = getServiceSupabase();
  if (!client) return null;
  try {
    const { data, error } = await client.rpc('geo_trails_by_ref', { p_ref: key });
    if (error) {
      console.warn('[compas] référentiel des grands itinéraires', error.code);
      return null;
    }
    if (!Array.isArray(data)) return null;
    const rows: GeoTrailRow[] = [];
    for (const raw of data) {
      const row = rowSchema.safeParse(raw);
      if (row.success) rows.push(row.data);
    }
    return pickTrail(rows, key);
  } catch (err) {
    console.warn(
      '[compas] référentiel des grands itinéraires',
      err instanceof Error ? err.message : 'erreur'
    );
    return null;
  }
}
