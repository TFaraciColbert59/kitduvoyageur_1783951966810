/**
 * LKDV — Mon Matériel : validation stricte des entrées utilisateur (Zod).
 * Contrainte LKDV obligatoire : toute donnée saisie ou reçue passe par un
 * schema avant usage. Les schemas sont exposés ici et appliqués dans l'UI
 * (page cockpit, AddToEquipmentButton, OrderService) ; en cas d'échec, une
 * erreur lisible est renvoyée sans jamais muter l'état.
 */

import { z } from 'zod';

/** Destination du flux universel « Ajouter à l'équipement » (Cas C). */
export const gearDestinationSchema = z
  .object({
    type: z.enum(['kit', 'checklist', 'departure', 'inventory']),
    refId: z.string().trim().min(1, 'Référence requise pour une destination « kit »').optional(),
    label: z.string().trim().max(120, 'Libellé trop long').optional(),
    reason: z.string().trim().max(200, 'Raison trop longue').optional(),
  })
  .strict();
export type GearDestinationInput = z.infer<typeof gearDestinationSchema>;

/** Ligne de commande reçue (réception confirmée). */
export const orderedProductItemSchema = z
  .object({
    orderId: z.string().min(1, 'orderId requis'),
    orderItemId: z.string().min(1, 'orderItemId requis'),
    productId: z.string().nullable().optional(),
    slug: z.string().optional(),
    name: z.string().trim().min(1, 'Nom requis'),
    brand: z.string().optional(),
    category: z.string().optional(),
    weightG: z.number().int().nonnegative().optional(),
    priceEur: z.number().nonnegative().optional(),
    quantity: z.number().int().min(1, 'Quantité ≥ 1'),
    status: z.string().min(1, 'Statut requis'),
    createdAt: z.string().nullable().optional(),
    destination: gearDestinationSchema.optional(),
  })
  .strict();
export type OrderedProductItemInput = z.infer<typeof orderedProductItemSchema>;

/** Formulaire « Planifier une sortie » (cockpit). */
export const newHikeFormSchema = z
  .object({
    name: z.string().trim().min(2, 'Nom de sortie requis (≥ 2 caractères)').max(80, 'Nom trop long'),
    terrainMassif: z.string().trim().max(80, 'Massif trop long').optional(),
    days: z.coerce.number().int().min(1, 'Durée ≥ 1 jour').max(60, 'Durée ≤ 60 jours'),
    distanceKm: z.coerce.number().positive('Distance > 0').max(2000, 'Distance invalide'),
    elevationGain: z.coerce.number().nonnegative('Dénivelé ≥ 0').max(20000, 'Dénivelé invalide'),
    companions: z.string().trim().max(120, 'Compagnons trop longs').optional(),
  })
  .strict();

/** Données saisies pour une sortie (à partir du formulaire cockpit). */
export type NewHikeFormInput = z.infer<typeof newHikeFormSchema>;

/** Helper : première erreur lisible d'un ZodError. */
export function firstIssue(error: z.ZodError, fallback = 'Données invalides'): string {
  return error.issues[0]?.message || fallback;
}

/** Valide et retourne `{ ok: true, data }` ou `{ ok: false, error }` sans lever. */
export function safeParse<T>(schema: z.ZodType<T>, input: unknown): { ok: true; data: T } | { ok: false; error: string } {
  const result = schema.safeParse(input);
  if (result.success) return { ok: true, data: result.data };
  return { ok: false, error: firstIssue(result.error) };
}