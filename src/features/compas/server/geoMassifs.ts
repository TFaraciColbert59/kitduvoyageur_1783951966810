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

/** Les lignes du référentiel pour cette clé (RPC `geo_massifs_by_name`), validées ; null si muet. */
async function massifRows(key: string): Promise<GeoMassifRow[] | null> {
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
    return rows;
  } catch (err) {
    console.warn('[compas] référentiel des massifs', err instanceof Error ? err.message : 'erreur');
    return null;
  }
}

/** Le relief de ce nom le mieux placé à moins de 150 km de `near` (`pickMassif`), ou null. */
export async function referentialMassif(
  name: string,
  near: { lat: number; lon: number }
): Promise<GeoMassifRow | null> {
  if (!geoMassifsEnabled()) return null;
  const key = normalizeMassifName(name.slice(0, 140));
  if (!key) return null;
  const rows = await massifRows(key);
  return rows ? pickMassif(rows, key, near) : null;
}

/** Codes d'un lieu naturel NOMMÉ qui n'est pas un relief : région naturelle, presqu'île. */
const NATURAL_REGION_CODES: readonly GeoMassifRow['feature_code'][] = ['RGN', 'PEN'];

/** Le nom tel qu'écrit, plié (sans accents, casse ni ponctuation), sans article de tête. */
const spelled = (v: string) =>
  v
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/^(?:la|le|les|l) /, '');

/**
 * La région naturelle (`RGN`) ou la presqu'île (`PEN`) qui porte CE nom (plan 3.3) : le nom
 * écrit, et non la seule clé du référentiel, qui retire la désignation (« Crozon » la commune
 * n'est pas « Presqu'île de Crozon »). Pays donné : celui-là (ou un lieu sans pays) ; sans pays,
 * des homonymes de pays différents → null (jamais un tirage). Puis le plus petit identifiant.
 * Pas de distance : `lookupNatural` n'a pas de point de référence. Aucun : null.
 */
export function pickNaturalRegion(
  rows: readonly GeoMassifRow[],
  name: string,
  countryCode: string | null
): GeoMassifRow | null {
  const wanted = spelled(name);
  if (wanted.length < 3) return null;
  const hits = rows
    .filter(
      (r) =>
        NATURAL_REGION_CODES.includes(r.feature_code) &&
        spelled(r.name) === wanted &&
        (!countryCode || r.country_code == null || r.country_code === countryCode)
    )
    .sort((a, b) => a.geoname_id - b.geoname_id);
  if (!hits.length) return null;
  if (!countryCode && new Set(hits.map((r) => r.country_code)).size > 1) return null;
  return hits[0];
}

/**
 * La région naturelle ou la presqu'île de ce nom (« Camargue », « Presqu'île de Crozon ») dans le
 * référentiel `geo_massifs`, pour `lookupNatural`. MÊME interrupteur que les massifs
 * (`COMPAS_GEO_MASSIFS`) : éteint, base muette ou nom inconnu → null, le Compas fait comme avant.
 * Une région administrative (« Bretagne », GeoNames `ADM1`) n'est pas dans la table.
 */
export async function referentialNaturalRegion(
  name: string,
  countryCode: string | null
): Promise<GeoMassifRow | null> {
  if (!geoMassifsEnabled()) return null;
  const key = normalizeMassifName(name.slice(0, 140));
  if (!key) return null;
  const rows = await massifRows(key);
  return rows ? pickNaturalRegion(rows, name, countryCode) : null;
}
