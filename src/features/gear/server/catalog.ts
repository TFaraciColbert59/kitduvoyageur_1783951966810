import type { SupabaseClient } from '@supabase/supabase-js';
import { selectDefaultGear } from '@/features/gear/domain/defaults';
import { inferGearKind, normalizeSport } from '@/features/gear/domain/gearKind';
import type { GearDefaultCandidate, GearRef, GearSportDefault } from '@/features/gear/domain/types';
import { GearError } from './mileage';

/**
 * Catalogue d'association d'une sortie : objets du propriétaire classés par
 * type, défauts de sport et objets déjà liés. Le sport vient de la séance
 * multi-sport quand elle existe, sinon du résumé `hike_sessions` historique.
 */

type OutingRow = {
  id: string;
  user_id: string;
  activity_session_id: string | null;
};

type GearRow = {
  id: string;
  name: string | null;
  category: string | null;
  condition: string | null;
  weight_g: number | null;
  image: string | null;
};

export interface GearCatalogPayload {
  sport: string | null;
  items: GearDefaultCandidate[];
  existingGearIds: string[];
  /** `false` si la table des défauts n'est pas encore migrée. */
  defaultsAvailable: boolean;
}

async function assertOutingOwner(supabase: SupabaseClient, userId: string, outingId: string): Promise<OutingRow> {
  const { data, error } = await supabase
    .from('hike_sessions')
    .select('id,user_id,activity_session_id')
    .eq('id', outingId)
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new GearError('not_found');
  return data as OutingRow;
}

async function loadOutingSport(supabase: SupabaseClient, outing: OutingRow): Promise<string | null> {
  if (outing.activity_session_id) {
    const { data } = await supabase
      .from('activity_sessions')
      .select('sport')
      .eq('id', outing.activity_session_id)
      .maybeSingle();
    const sport = normalizeSport((data as { sport?: string | null } | null)?.sport ?? null);
    if (sport) return sport;
  }
  return 'rando';
}

function isMissingTable(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  if (error.code === '42P01' || error.code === 'PGRST205' || error.code === '42703') return true;
  return /does not exist|schema cache/i.test(error.message ?? '');
}

export async function loadGearCatalogForOuting(
  supabase: SupabaseClient,
  userId: string,
  outingId: string
): Promise<GearCatalogPayload> {
  const outing = await assertOutingOwner(supabase, userId, outingId);
  const sport = await loadOutingSport(supabase, outing);

  const { data: gearData, error: gearError } = await supabase
    .from('gear_items')
    .select('id,name,category,condition,weight_g,image')
    .eq('user_id', userId)
    .order('name', { ascending: true });
  if (gearError) throw gearError;

  const items: GearRef[] = ((gearData ?? []) as GearRow[]).map((row) => ({
    id: row.id,
    name: row.name?.trim() || 'Objet',
    kind: inferGearKind(row.name, row.category),
    weightG: row.weight_g,
    condition: row.condition,
    photoUrl: row.image?.trim() || null,
  }));

  let existingGearIds: string[] = [];
  const { data: linkData, error: linkError } = await supabase
    .from('hike_session_gear')
    .select('gear_item_id')
    .eq('session_id', outingId);
  if (linkError) {
    // Colonne absente = migration du lot non appliquée : on le dit
    // explicitement au lieu de proposer une association qui échouerait.
    if (linkError.code === '42703') throw new GearError('migration_required');
    if (!isMissingTable(linkError)) throw linkError;
  }
  if (!linkError) {
    existingGearIds = ((linkData ?? []) as Array<{ gear_item_id: string | null }>)
      .map((row) => row.gear_item_id)
      .filter((value): value is string => typeof value === 'string' && value.length > 0);
  }

  let defaults: GearSportDefault[] = [];
  let defaultsAvailable = true;
  const { data: defaultData, error: defaultError } = await supabase
    .from('gear_sport_defaults')
    .select('gear_item_id,sport,kind,priority')
    .eq('user_id', userId)
    .eq('sport', sport ?? 'rando');
  if (defaultError) {
    if (isMissingTable(defaultError)) defaultsAvailable = false;
    else throw defaultError;
  } else {
    defaults = ((defaultData ?? []) as Array<{ gear_item_id: string; sport: string; kind: string; priority: number }>)
      .filter((row) => row.kind === 'bike' || row.kind === 'shoe' || row.kind === 'component' || row.kind === 'other')
      .map((row) => ({
        gearItemId: row.gear_item_id,
        sport: row.sport,
        kind: row.kind as GearSportDefault['kind'],
        priority: Number.isFinite(row.priority) ? row.priority : 0,
      }));
  }

  const candidates = selectDefaultGear({
    sport,
    items,
    defaults,
    activityGearIds: existingGearIds,
  });

  return { sport, items: candidates, existingGearIds, defaultsAvailable };
}

export interface AssociateGearResult {
  status: 'attached' | 'already_attached';
  gearItemId: string;
  gearLinkId: string | null;
}

export async function associateGearToOuting(
  supabase: SupabaseClient,
  userId: string,
  outingId: string,
  gearItemId: string
): Promise<AssociateGearResult> {
  const outing = await assertOutingOwner(supabase, userId, outingId);

  const { data: gearData, error: gearError } = await supabase
    .from('gear_items')
    .select('id,name,weight_g')
    .eq('id', gearItemId)
    .eq('user_id', userId)
    .maybeSingle();
  if (gearError) throw gearError;
  if (!gearData) throw new GearError('not_found');
  const gear = gearData as { id: string; name: string | null; weight_g: number | null };

  const { data: existing, error: existingError } = await supabase
    .from('hike_session_gear')
    .select('id')
    .eq('session_id', outingId)
    .eq('gear_item_id', gearItemId)
    .maybeSingle();
  if (existingError) {
    if (existingError.code === '42703') throw new GearError('migration_required');
    throw existingError;
  }
  if (existing) {
    return { status: 'already_attached', gearItemId, gearLinkId: (existing as { id: string }).id };
  }

  const sport = await loadOutingSport(supabase, outing);
  const { data, error } = await supabase
    .from('hike_session_gear')
    .insert({
      session_id: outingId,
      gear_item_id: gearItemId,
      item_name: gear.name?.trim() || 'Objet',
      weight_g: gear.weight_g,
      sport,
    })
    .select('id')
    .single();
  if (error) {
    if (error.code === '42703') throw new GearError('migration_required');
    throw error;
  }
  return { status: 'attached', gearItemId, gearLinkId: (data as { id: string }).id };
}
