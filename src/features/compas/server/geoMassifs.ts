import 'server-only';
import { z } from 'zod';
import { getServiceSupabase } from '@/lib/ai/serviceClient';
import {
  GEO_MASSIF_CODES,
  normalizeMassifName,
  pickMassif,
  type GeoMassifRow,
} from '../engine/geoMassifs';

/**
 * Un massif ou une chaîne (« Vosges », « Jura », « Monts du Cantal ») retrouvé dans le référentiel
 * `geo_massifs` (plan 3.3, GeoNames classes T et L, CC BY 4.0) : son nom, son pays et son centre,
 * jamais une emprise (GeoNames n'en donne pas). Sert à `lookupMassif`, sans appel réseau.
 *
 * INTERRUPTEUR : `COMPAS_GEO_MASSIFS=1` (variable Vercel). Éteint (défaut), cette fonction ne
 * touche pas à la base et rend null : le Compas se comporte comme avant. Table vide, absente ou
 * nom inconnu : null aussi, donc rien ne change non plus.
 */
export function geoMassifsEnabled(): boolean {
  const v = (process.env.COMPAS_GEO_MASSIFS ?? '').trim().toLowerCase();
  return v === '1' || v === 'on' || v === 'true';
}

const rowSchema = z.object({
  geoname_id: z.number().int().positive(),
  feature_code: z.enum(
    GEO_MASSIF_CODES as [GeoMassifRow['feature_code'], ...GeoMassifRow['feature_code'][]]
  ),
  name: z.string().min(1),
  name_plain: z.string().min(2),
  country_code: z
    .string()
    .regex(/^[A-Z]{2}$/)
    .nullable(),
  lat: z.number().min(-90).max(90),
  lon: z.number().min(-180).max(180),
  elevation_m: z.number().nullable(),
});

/** Le relief de ce nom le mieux placé à moins de 150 km de `near` (`pickMassif`), ou null. */
export async function referentialMassif(
  name: string,
  near: { lat: number; lon: number }
): Promise<GeoMassifRow | null> {
  if (!geoMassifsEnabled()) return null;
  const key = normalizeMassifName(name.slice(0, 140));
  if (!key) return null;
  const client = getServiceSupabase();
  if (!client) return null;
  try {
    const { data, error } = await client.rpc('geo_massifs_by_name', { p_name_plain: key });
    if (error) {
      console.warn('[compas] référentiel des massifs', error.code);
      return null;
    }
    if (!Array.isArray(data)) return null;
    const rows: GeoMassifRow[] = [];
    for (const raw of data) {
      const row = rowSchema.safeParse(raw);
      if (row.success) rows.push(row.data);
    }
    return pickMassif(rows, key, near);
  } catch (err) {
    console.warn('[compas] référentiel des massifs', err instanceof Error ? err.message : 'erreur');
    return null;
  }
}
