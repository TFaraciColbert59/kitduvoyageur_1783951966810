/**
 * Création d'un moment depuis la feuille « Créer » (mode modification, participant).
 * Toute entrée est validée par zod avant d'atteindre la base ; les messages sont
 * ceux de la maquette (`submitCreate`), tutoiement compris.
 */
import { z } from 'zod';
import {
  MOMENT_EXPENSE_CATEGORIES,
  MOMENT_TYPES,
  type MomentMeta,
  type MomentType,
} from './momentTypes';
import type { CarnetMomentItem } from './types';

const place = z.string().trim().min(1, 'Indique un lieu.').max(80, 'Le lieu est trop long.');
const day = z.number().int().min(1).max(366);
const optional = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((value) => (value ? value : undefined));
const required = (message: string, max: number) => z.string().trim().min(1, message).max(max);

const common = { place, day };

export const MomentInputSchema = z.discriminatedUnion('type', [
  z.object({ ...common, type: z.literal('photo'), caption: optional(120) }),
  z.object({ ...common, type: z.literal('video'), caption: optional(120) }),
  z.object({
    ...common,
    type: z.literal('voice'),
    caption: required('Donne un titre à ton moment.', 120),
    durationLabel: z
      .string()
      .trim()
      .regex(/^\d{1,2}:\d{2}$/, 'Durée au format 0:30.')
      .optional(),
  }),
  z.object({ ...common, type: z.literal('text'), caption: required('Donne un titre à ton moment.', 400) }),
  z.object({
    ...common,
    type: z.literal('meet'),
    caption: required('Donne un titre à ton moment.', 240),
    who: optional(60),
  }),
  z.object({
    ...common,
    type: z.literal('spend'),
    amountEur: z.number().finite().min(0, 'Le montant est négatif.').max(100000),
    category: z.enum(MOMENT_EXPENSE_CATEGORIES),
    caption: optional(60),
  }),
  z.object({
    ...common,
    type: z.literal('kit'),
    itemId: z.string().trim().min(1, 'Choisis un objet.').max(80),
    caption: optional(120),
  }),
  z.object({
    ...common,
    type: z.literal('species'),
    caption: required('Donne un titre à ton moment.', 80),
    latin: optional(80),
  }),
  z.object({ ...common, type: z.literal('inc'), caption: required('Donne un titre à ton moment.', 400) }),
]);

export type MomentInput = z.infer<typeof MomentInputSchema>;

export type ValidatedMoment =
  | { ok: true; value: MomentInput }
  | { ok: false; error: string };

export function validateMomentInput(input: unknown): ValidatedMoment {
  const parsed = MomentInputSchema.safeParse(input);
  if (parsed.success) return { ok: true, value: parsed.data };
  return { ok: false, error: parsed.error.issues[0]?.message ?? 'Saisie invalide.' };
}

/** Type saisi (liste fermée) : sert aussi à rejeter un `data-type` forgé. */
export function isCreatableType(value: unknown): value is MomentType {
  return typeof value === 'string' && (MOMENT_TYPES as readonly string[]).includes(value);
}

export function metaOf(value: MomentInput): MomentMeta | null {
  switch (value.type) {
    case 'voice':
      return value.durationLabel ? { durationLabel: value.durationLabel } : null;
    case 'meet':
      return value.who ? { who: value.who } : null;
    case 'spend':
      return { amountEur: value.amountEur, category: value.category };
    case 'kit':
      return { itemId: value.itemId };
    case 'species':
      return value.latin ? { latin: value.latin } : null;
    default:
      return null;
  }
}

export interface MomentInsertContext {
  carnetId: string;
  userId: string;
  authorName: string | null;
  imageUrl: string | null;
  now: Date;
}

/** Ligne `carnet_moments` à écrire (colonnes de la v2 comprises). */
export function momentInsertRow(value: MomentInput, ctx: MomentInsertContext) {
  const hh = String(ctx.now.getHours()).padStart(2, '0');
  const mm = String(ctx.now.getMinutes()).padStart(2, '0');
  const meta = metaOf(value);
  return {
    carnet_id: ctx.carnetId,
    jour_numero: value.day,
    heure: `${hh}:${mm}`,
    citation: value.caption ?? '',
    auteur_nom: ctx.authorName,
    auteur_id: ctx.userId,
    lieu: value.place,
    image_url: ctx.imageUrl,
    moment_timestamp: ctx.now.toISOString(),
    source: 'manuel' as const,
    moment_type: value.type,
    moment_meta: meta,
  };
}

/** Le moment tel que la fiche l'affiche tout de suite après l'écriture. */
export function momentItemFromRow(
  id: string,
  row: ReturnType<typeof momentInsertRow>
): CarnetMomentItem {
  return {
    id,
    dayNumber: row.jour_numero,
    time: row.heure,
    caption: row.citation || null,
    authorName: row.auteur_nom,
    authorId: row.auteur_id,
    place: row.lieu,
    imageUrl: row.image_url,
    title: row.lieu,
    type: row.moment_type,
    meta: row.moment_meta,
  };
}
