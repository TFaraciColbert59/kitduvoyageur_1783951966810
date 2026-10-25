import { z } from 'zod';

/**
 * Preuve terrain (chantier lignées, Lot 2) — débriefing d'un kit après randonnée.
 * Le miroir exact de la génération SQL (regexp_replace(lower(name),'[^a-z0-9]+','-','g'))
 * garantit que l'item_key envoyé par le client correspond à celui stocké en base.
 */

/** Miroir de la génération SQL de materiel_kit_items.item_key. */
export function normalizeItemKey(name: string | null | undefined): string {
  if (!name) return '';
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-');
}

/** Clé d'identité d'objet envoyée au débriefing : le lien catalogue prime. */
export function buildFieldReportItemKey(input: {
  productId?: string | null;
  name?: string | null;
}): string {
  if (input.productId) return input.productId;
  return normalizeItemKey(input.name);
}

/** Vocabulaire fermé des verdicts terrain (CHECK en base). */
export const FIELD_VERDICTS = [
  'essentiel',
  'utile',
  'jamais_servi',
  'defaillant',
  'manquait',
] as const;

export type FieldVerdict = (typeof FIELD_VERDICTS)[number];

/** Schéma d'entrée de la route de débriefing (validation stricte zod). */
export const fieldReportSchema = z.object({
  hike_session_id: z.string().uuid('Identifiant de session invalide'),
  /** Lien catalogue ou nom de l'article — sert à dériver item_key. */
  product_id: z.string().uuid().nullable().optional(),
  name: z.string().min(1).max(120).optional(),
  verdict: z.enum(FIELD_VERDICTS),
  note: z.string().max(500, 'La note ne peut dépasser 500 caractères').nullable().optional(),
});

export type FieldReportInput = z.infer<typeof fieldReportSchema>;