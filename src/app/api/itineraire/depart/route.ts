// Lectures et gestes de l'onglet « Départ » de /compas/itineraire qui touchent le voyage :
//  - GET : le sac du voyage (`trip_items`, 9.1) et la liste de départ du HUB (`trip_checklist_items`, 9.7) ;
//  - PATCH : cocher un élément de cette même liste (une seule liste, pas une copie).
// Session exigée, client Supabase de la personne (RLS : `can_read_trip` en lecture, `can_edit_trip` en écriture),
// entrée validée par zod. Une partie illisible rend `null` : l'écran dit « non lu », jamais une liste inventée.
import { NextRequest } from 'next/server';
import { z } from 'zod';
import { requireUser } from '@/lib/api/requireUser';
import { fail, ok } from '@/lib/api/respond';

export const dynamic = 'force-dynamic';

const MAX_ROWS = 500;
const getSchema = z.object({ tripId: z.string().uuid() }).strict();
const patchSchema = z.object({ tripId: z.string().uuid(), itemId: z.string().uuid(), done: z.boolean() }).strict();

export async function GET(request: NextRequest) {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;
  const parsed = getSchema.safeParse({ tripId: request.nextUrl.searchParams.get('tripId') ?? undefined });
  if (!parsed.success) return fail('bad_request', 'tripId_invalide');
  const { tripId } = parsed.data;
  const { supabase } = auth;

  const [kit, checklist] = await Promise.all([
    supabase
      .from('trip_items')
      .select('id, item_name, category, quantity, weight_grams, ownership, owner_id, inventory_item_id, is_packed')
      .eq('trip_id', tripId)
      .order('created_at', { ascending: true })
      .limit(MAX_ROWS),
    supabase
      .from('trip_checklist_items')
      .select('id, label, due_offset_days, done, done_at, position')
      .eq('trip_id', tripId)
      .order('due_offset_days', { ascending: false })
      .order('position', { ascending: true })
      .limit(MAX_ROWS),
  ]);

  return ok({
    status: 'ok',
    fetchedAt: new Date().toISOString(),
    kit: kit.error ? null : (kit.data ?? []),
    kitSource: 'trip_items',
    checklist: checklist.error ? null : (checklist.data ?? []),
    checklistSource: 'trip_checklist_items',
  });
}

export async function PATCH(request: NextRequest) {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;
  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return fail('bad_request', 'json_invalide');
  }
  const parsed = patchSchema.safeParse(json);
  if (!parsed.success) return fail('bad_request', 'entree_invalide');
  const { tripId, itemId, done } = parsed.data;
  const { data, error } = await auth.supabase
    .from('trip_checklist_items')
    .update({ done, done_at: done ? new Date().toISOString() : null })
    .eq('id', itemId)
    .eq('trip_id', tripId)
    .select('id, done, done_at');
  if (error) return fail('server', 'mise_a_jour_impossible');
  // Une mise à jour bloquée par la RLS touche 0 ligne : refus explicite, pas un faux succès.
  if (!data || data.length === 0) return fail('forbidden', 'liste_non_modifiable');
  return ok({ status: 'ok', item: data[0] });
}
