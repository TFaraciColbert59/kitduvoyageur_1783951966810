// Services d'écriture du Kit Studio (P1), testables sans réseau : le client Supabase est injecté.
// Les actions serveur (`server/actions.ts`) ne font que : session + validation zod + appel ici.
// Règle dure : aucun prix ni total fourni par le client ; `placePreorder` passe par la RPC
// `one_place_preorder`, qui recalcule le total en base à partir de `one_pieces.price_cents`.
import type { SupabaseClient } from '@supabase/supabase-js';
import type { PlacePreorderInput, SaveBagConfigInput, SaveKitItemPlacementInput } from './studioSchemas';

export type Db = Pick<SupabaseClient, 'from' | 'rpc'>;

export type ServiceError =
  | 'not_authenticated'
  | 'not_owner'
  | 'not_found'
  | 'invalid_input'
  | 'unknown_piece_or_colorway'
  | 'db_error';

export type ServiceResult<T> =
  | { readonly ok: true; readonly data: T }
  | { readonly ok: false; readonly error: ServiceError; readonly message?: string };

const fail = <T>(error: ServiceError, message?: string): ServiceResult<T> => ({ ok: false, error, message });

interface Row { [key: string]: unknown }
type ReadResult = { data: unknown; error: { message?: string } | null };

async function read(query: PromiseLike<ReadResult>, label: string): Promise<Row[] | null> {
  const { data, error } = await query;
  if (error) {
    void label;
    return null;
  }
  return (data as Row[] | null) ?? [];
}

/** Le kit appartient-il à l'utilisateur ? (RLS + contrôle explicite) */
async function ownsKit(db: Db, userId: string, kitId: string): Promise<ServiceResult<true>> {
  const rows = await read(
    db.from('materiel_kits').select('id').eq('id', kitId).eq('user_id', userId),
    'materiel_kits',
  );
  if (rows === null) return fail('db_error', 'lecture du kit impossible');
  if (rows.length === 0) return fail('not_owner', 'kit absent ou non détenu');
  return { ok: true, data: true };
}

/** `saveBagConfig` : upsert `one_bag_configs` (une ligne par couple utilisateur/kit). */
export async function saveBagConfigFor(
  db: Db,
  userId: string,
  input: SaveBagConfigInput,
): Promise<ServiceResult<{ kitId: string }>> {
  const owned = await ownsKit(db, userId, input.kitId);
  if (!owned.ok) return owned as ServiceResult<{ kitId: string }>;

  // Les pièces citées doivent exister dans le catalogue actif (corps + modules).
  const ids = [input.corpsId, ...input.modules.map((m) => `mod:${m}`)];
  const pieces = await read(
    db.from('one_pieces').select('id, kind').in('id', ids).eq('active', true),
    'one_pieces',
  );
  if (pieces === null) return fail('db_error', 'catalogue illisible');
  const found = new Set(pieces.map((p) => String(p.id)));
  if (!ids.every((id) => found.has(id))) return fail('invalid_input', 'pièce inconnue du catalogue');

  const { error } = await db.from('one_bag_configs').upsert(
    {
      user_id: userId,
      kit_id: input.kitId,
      corps_id: input.corpsId,
      modules: input.modules,
      colors: input.colors,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id,kit_id' },
  );
  if (error) return fail('db_error', error.message ?? 'upsert one_bag_configs impossible');
  return { ok: true, data: { kitId: input.kitId } };
}

/** `saveKitItemPlacement` : zone, emplacement fin et ordre de chargement dans `materiel_kit_items`. */
export async function saveKitItemPlacementFor(
  db: Db,
  userId: string,
  input: SaveKitItemPlacementInput,
): Promise<ServiceResult<{ kitItemId: string }>> {
  const owned = await ownsKit(db, userId, input.kitId);
  if (!owned.ok) return owned as ServiceResult<{ kitItemId: string }>;

  const patch = {
    zone: input.zone,
    slot: input.slot ?? null,
    load_order: input.loadOrder ?? null,
    updated_at: new Date().toISOString(),
  };

  // La ligne de kit est soit l'objet lui-même (id), soit la ligne liée à l'objet possédé.
  const byId = await read(
    db.from('materiel_kit_items').select('id').eq('id', input.itemId).eq('kit_id', input.kitId),
    'materiel_kit_items(id)',
  );
  if (byId === null) return fail('db_error', 'lecture de la ligne de kit impossible');
  let rowId = byId[0] ? String(byId[0].id) : null;
  if (!rowId) {
    const byOwnership = await read(
      db.from('materiel_kit_items').select('id')
        .eq('product_ownership_id', input.itemId).eq('kit_id', input.kitId),
      'materiel_kit_items(ownership)',
    );
    if (byOwnership === null) return fail('db_error', 'lecture de la ligne de kit impossible');
    rowId = byOwnership[0] ? String(byOwnership[0].id) : null;
  }

  if (rowId) {
    const { error } = await db.from('materiel_kit_items').update(patch).eq('id', rowId).eq('kit_id', input.kitId);
    if (error) return fail('db_error', error.message ?? 'mise à jour de la ligne de kit impossible');
    return { ok: true, data: { kitItemId: rowId } };
  }

  // Objet possédé pas encore présent dans le kit : on crée la ligne de kit correspondante.
  const ownedItem = await read(
    db.from('product_ownership')
      .select('id, name, category, weight_g, function_id')
      .eq('id', input.itemId).eq('user_id', userId),
    'product_ownership',
  );
  if (ownedItem === null) return fail('db_error', 'lecture de l’inventaire impossible');
  const item = ownedItem[0];
  if (!item) return fail('not_found', 'objet introuvable dans l’inventaire');

  const inserted = await db.from('materiel_kit_items').insert({
    kit_id: input.kitId,
    user_id: userId,
    product_ownership_id: input.itemId,
    name: item.name ?? null,
    category: item.category ?? null,
    weight_g: item.weight_g ?? 0,
    function_id: item.function_id ?? null,
    ...patch,
  }).select('id');
  if (inserted.error) return fail('db_error', inserted.error.message ?? 'insertion de la ligne de kit impossible');
  const created = (inserted.data as Row[] | null)?.[0];
  if (!created) return fail('db_error', 'ligne de kit créée sans identifiant');
  return { ok: true, data: { kitItemId: String(created.id) } };
}

/** `placePreorder` : RPC `one_place_preorder`, total recalculé en base (jamais fourni par le client). */
export async function placePreorderFor(
  db: Db,
  _userId: string,
  input: PlacePreorderInput,
): Promise<ServiceResult<{ preorderId: string; totalCents: number }>> {
  const items = input.items.map((i) => ({ piece_id: i.pieceId, colorway_id: i.colorwayId }));
  const { data, error } = await db.rpc('one_place_preorder', {
    p_items: items,
    p_label: input.label ?? '',
    p_notify: input.notify ?? true,
  });
  if (error) {
    const message = error.message ?? '';
    if (/unknown_piece_or_colorway/.test(message)) return fail('unknown_piece_or_colorway', 'pièce ou coloris inconnu');
    if (/not_authenticated/.test(message)) return fail('not_authenticated', 'session requise');
    if (/empty_order/.test(message)) return fail('invalid_input', 'précommande vide');
    return fail('db_error', message || 'précommande refusée');
  }
  const preorderId = typeof data === 'string' ? data : null;
  if (!preorderId) return fail('db_error', 'précommande sans identifiant');

  const rows = await read(
    db.from('one_preorders').select('total_cents').eq('id', preorderId),
    'one_preorders',
  );
  if (rows === null) return fail('db_error', 'total de précommande illisible');
  const total = rows[0]?.total_cents;
  if (typeof total !== 'number') return fail('db_error', 'total de précommande absent');
  return { ok: true, data: { preorderId, totalCents: total } };
}
