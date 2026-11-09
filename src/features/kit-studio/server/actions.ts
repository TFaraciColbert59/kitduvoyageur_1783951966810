'use server';
// Actions serveur du Kit Studio (P1). Chaque action : session → validation zod → service.
// Aucune donnée de prix/total n'est acceptée du client : `placePreorder` s'appuie sur la RPC
// `one_place_preorder` qui recalcule le total en base. Les erreurs sont renvoyées, jamais levées,
// pour que le client puisse annuler l'écriture optimiste et afficher « Non enregistré · réessaie ».
import { createClient } from '@/lib/supabase/server';
import { parseInput, placePreorderSchema, saveBagConfigSchema, saveKitItemPlacementSchema } from './studioSchemas';
import { placePreorderFor, saveBagConfigFor, saveKitItemPlacementFor } from './studioService';
import type { Db } from './studioService';

export type ActionFailure = { readonly ok: false; readonly error: string };
export type SaveBagConfigActionResult = { readonly ok: true; readonly kitId: string } | ActionFailure;
export type SaveKitItemPlacementActionResult =
  | { readonly ok: true; readonly kitItemId: string }
  | ActionFailure;
export type PlacePreorderActionResult =
  | { readonly ok: true; readonly preorderId: string; readonly totalCents: number }
  | ActionFailure;

async function session(): Promise<{ db: Db; userId: string } | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  return { db: supabase as unknown as Db, userId: user.id };
}

/** Enregistre la configuration d'apparence (corps, modules, couleurs) du kit. */
export async function saveBagConfig(raw: unknown): Promise<SaveBagConfigActionResult> {
  const parsed = parseInput(saveBagConfigSchema, raw);
  if (!parsed.ok) return { ok: false, error: parsed.error };
  const ctx = await session();
  if (!ctx) return { ok: false, error: 'session requise' };
  const r = await saveBagConfigFor(ctx.db, ctx.userId, parsed.data);
  return r.ok ? { ok: true, kitId: r.data.kitId } : { ok: false, error: r.message ?? r.error };
}

/** Enregistre le placement d'un objet dans le kit (zone, emplacement, ordre de chargement). */
export async function saveKitItemPlacement(raw: unknown): Promise<SaveKitItemPlacementActionResult> {
  const parsed = parseInput(saveKitItemPlacementSchema, raw);
  if (!parsed.ok) return { ok: false, error: parsed.error };
  const ctx = await session();
  if (!ctx) return { ok: false, error: 'session requise' };
  const r = await saveKitItemPlacementFor(ctx.db, ctx.userId, parsed.data);
  return r.ok ? { ok: true, kitItemId: r.data.kitItemId } : { ok: false, error: r.message ?? r.error };
}

/** Confirme une précommande ; le total est celui recalculé en base. */
export async function placePreorder(raw: unknown): Promise<PlacePreorderActionResult> {
  const parsed = parseInput(placePreorderSchema, raw);
  if (!parsed.ok) return { ok: false, error: parsed.error };
  const ctx = await session();
  if (!ctx) return { ok: false, error: 'session requise' };
  const r = await placePreorderFor(ctx.db, ctx.userId, parsed.data);
  return r.ok
    ? { ok: true, preorderId: r.data.preorderId, totalCents: r.data.totalCents }
    : { ok: false, error: r.message ?? r.error };
}
