// Schémas zod des écritures serveur du Kit Studio (P1).
// Toute entrée venue du client passe par ces schémas : rien n'est écrit sans validation.
// Module pur (sans 'use server') : importable par les tests et par server/actions.ts.
import { z } from 'zod';

/** Modules ONE connus (`one_pieces.kind = 'module'`). */
export const MODULE_IDS = ['lid', 'front', 'sides', 'tool', 'hipp', 'flask'] as const;
/** Zones de rangement (`materiel_kit_items.zone`). */
export const ZONE_IDS = ['worn', 'lid', 'main', 'front', 'sides', 'hip', 'back'] as const;
/** Emplacements fins du compartiment principal (`materiel_kit_items.slot`). */
export const SLOT_IDS = ['bottom', 'bottomF', 'midBack', 'midFront', 'top'] as const;

export const HEX_COLOR = z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'couleur hexadécimale attendue');

/** Clé de pièce du domaine : 'chassis' | 'corps:b28|b42|lkdv-one-*' | 'mod:<module>'. */
export const PIECE_ID = z
  .string()
  .regex(/^(chassis|corps:(b(28|42)|lkdv-one-(15|25|45|60|80))|mod:(lid|front|sides|tool|hipp|flask))$/, 'pièce inconnue');

/** Corps de sac uniquement (`one_bag_configs.corps_id`). */
export const CORPS_ID = z.string().regex(/^corps:(b(28|42)|lkdv-one-(15|25|45|60|80))$/, 'corps de sac attendu');

/** Coloris : id du référentiel `one_colorways` (jamais un hexadécimal du client). */
export const COLORWAY_ID = z.string().regex(/^[a-z][a-z0-9_-]{1,31}$/, 'coloris attendu');

const COLORS_KEYS = ['body', 'lid', 'front', 'sides', 'hip', 'harness', 'webbing', 'accent'] as const;

/** `saveBagConfig` : corps, modules actifs et couleurs de la configuration d'apparence. */
export const saveBagConfigSchema = z
  .object({
    kitId: z.string().uuid(),
    corpsId: CORPS_ID,
    modules: z.array(z.enum(MODULE_IDS)).max(MODULE_IDS.length).default([]),
    colors: z.record(z.string(), HEX_COLOR).default({}),
  })
  .strict()
  .refine((v) => Object.keys(v.colors).every((k) => (COLORS_KEYS as readonly string[]).includes(k)), {
    message: 'clé de couleur inconnue',
    path: ['colors'],
  });

/** `saveKitItemPlacement` : zone, emplacement fin et ordre de chargement d'un objet. */
export const saveKitItemPlacementSchema = z
  .object({
    kitId: z.string().uuid(),
    itemId: z.string().uuid(),
    zone: z.enum(ZONE_IDS).nullable(),
    slot: z.enum(SLOT_IDS).nullable().optional(),
    loadOrder: z.number().int().min(0).max(1000).nullable().optional(),
  })
  .strict();

/** `placePreorder` : pièces et coloris. Aucun prix, aucun total : tout est recalculé en base. */
export const placePreorderSchema = z
  .object({
    items: z
      .array(z.object({ pieceId: PIECE_ID, colorwayId: COLORWAY_ID }).strict())
      .min(1, 'précommande vide')
      .max(20),
    label: z.string().trim().max(24).optional(),
    notify: z.boolean().optional(),
  })
  .strict();

export type SaveBagConfigInput = z.infer<typeof saveBagConfigSchema>;
export type SaveKitItemPlacementInput = z.infer<typeof saveKitItemPlacementSchema>;
export type PlacePreorderInput = z.infer<typeof placePreorderSchema>;

/** Résultat de validation uniforme : jamais d'exception, message lisible par l'UI. */
export type ParseResult<T> = { ok: true; data: T } | { ok: false; error: string };

export function parseInput<T>(schema: z.ZodType<T>, raw: unknown): ParseResult<T> {
  const r = schema.safeParse(raw);
  if (r.success) return { ok: true, data: r.data };
  const first = r.error.issues[0];
  return { ok: false, error: first ? `${first.path.join('.') || 'entrée'}: ${first.message}` : 'entrée invalide' };
}
