'use server';

/**
 * Server Actions du mode modification de la fiche carnet v2 (étape, nuit,
 * verdict, voyageur, moment). Chaque action : zod → session → droit de
 * participant (`is_carnet_participant`, la même fonction que la RLS) → écriture
 * sous les politiques existantes avec le client à cookies de la personne. Une
 * ligne que la RLS refuse revient vide : l'action le dit, sans rien contourner.
 */
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import {
  MomentDeleteSchema,
  MomentUpdateSchema,
  NightDeleteSchema,
  NightInputSchema,
  StepDeleteSchema,
  StepInputSchema,
  TravelerAddSchema,
  TravelerRemoveSchema,
  TravelerUpdateSchema,
  VerdictInputSchema,
  etapeFromRow,
  firstIssue,
  nightFromRow,
  nightRow,
  stepRow,
  verdictItem,
  verdictRow,
  type NightRowRead,
} from './editSchemas';
import type {
  CarnetEtapeDay,
  CarnetKitVerdictItem,
  CarnetNightItem,
  CarnetParticipant,
  EtapeRow,
} from './types';

export type ActionResult<T extends object = object> =
  | ({ ok: true } & T)
  | { ok: false; error: string };

const ETAPE_COLUMNS =
  'id, jour_numero, ordre, date_etape, lieu_depart, lieu_arrivee, recit, distance_km, denivele_m, duree_texte, meteo, temperature_c';
const NIGHT_COLUMNS = 'id, jour_numero, nom, type, altitude_m, infos, lat, lng, map_refuge_id';

type Supabase = Awaited<ReturnType<typeof createClient>>;

const REFUSED = 'Tu n’as pas le droit de modifier ce carnet.';
const OFFLINE = 'L’enregistrement a échoué, réessaie dans un instant.';

async function participantContext(
  carnetId: string
): Promise<
  { ok: true; supabase: Supabase; userId: string } | { ok: false; error: string }
> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || user.is_anonymous) return { ok: false, error: 'Connexion requise.' };
  const { data, error } = await supabase.rpc('is_carnet_participant', { p_carnet: carnetId });
  if (error || data !== true) return { ok: false, error: REFUSED };
  return { ok: true, supabase, userId: user.id };
}

function done<T>(carnetId: string, payload: T): { ok: true } & T {
  revalidatePath(`/carnets/${carnetId}`);
  return { ok: true, ...payload };
}

// ── Étape ──────────────────────────────────────────────────────────────────

export async function saveStepAction(
  input: unknown
): Promise<ActionResult<{ etape: CarnetEtapeDay }>> {
  const parsed = StepInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };
  const value = parsed.data;
  const ctx = await participantContext(value.carnetId);
  if (!ctx.ok) return ctx;
  const { supabase } = ctx;

  const { data: carnet } = await supabase
    .from('carnets')
    .select('groupe_id')
    .eq('id', value.carnetId)
    .maybeSingle();
  const groupeId = (carnet as { groupe_id: string | null } | null)?.groupe_id ?? null;
  if (!groupeId) {
    return { ok: false, error: 'Ce carnet n’a pas encore de parcours à étapes.' };
  }

  const row = stepRow(value, groupeId);
  const query = value.id
    ? supabase
        .from('groupe_etapes')
        .update(row)
        .eq('id', value.id)
        .eq('groupe_id', groupeId)
        .select(ETAPE_COLUMNS)
        .maybeSingle()
    : supabase.from('groupe_etapes').insert(row).select(ETAPE_COLUMNS).maybeSingle();
  const { data, error } = await query;
  if (error) return { ok: false, error: OFFLINE };
  if (!data) return { ok: false, error: REFUSED };
  return done(value.carnetId, { etape: etapeFromRow(data as unknown as EtapeRow) });
}

export async function deleteStepAction(input: unknown): Promise<ActionResult> {
  const parsed = StepDeleteSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };
  const { carnetId, id } = parsed.data;
  const ctx = await participantContext(carnetId);
  if (!ctx.ok) return ctx;
  const { supabase } = ctx;
  const { data: carnet } = await supabase
    .from('carnets')
    .select('groupe_id')
    .eq('id', carnetId)
    .maybeSingle();
  const groupeId = (carnet as { groupe_id: string | null } | null)?.groupe_id ?? null;
  if (!groupeId) return { ok: false, error: 'Ce carnet n’a pas encore de parcours à étapes.' };
  const { data, error } = await supabase
    .from('groupe_etapes')
    .delete()
    .eq('id', id)
    .eq('groupe_id', groupeId)
    .select('id');
  if (error) return { ok: false, error: OFFLINE };
  if (!data || data.length === 0) return { ok: false, error: REFUSED };
  return done(carnetId, {});
}

// ── Nuit ───────────────────────────────────────────────────────────────────

export async function saveNightAction(
  input: unknown
): Promise<ActionResult<{ night: CarnetNightItem }>> {
  const parsed = NightInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };
  const value = parsed.data;
  const ctx = await participantContext(value.carnetId);
  if (!ctx.ok) return ctx;
  const { supabase, userId } = ctx;

  const row = nightRow(value, userId);
  let saved: NightRowRead | null = null;

  if (value.id) {
    const changes = {
      jour_numero: row.jour_numero,
      nom: row.nom,
      type: row.type,
      altitude_m: row.altitude_m,
      infos: row.infos,
    };
    const updated = await supabase
      .from('carnet_nights')
      .update(changes)
      .eq('id', value.id)
      .eq('carnet_id', value.carnetId)
      .select(NIGHT_COLUMNS)
      .maybeSingle();
    if (updated.error) {
      return {
        ok: false,
        error: updated.error.code === '23505' ? 'Une nuit existe déjà pour ce jour.' : OFFLINE,
      };
    }
    saved = (updated.data as NightRowRead | null) ?? null;
  }

  if (!saved) {
    /* Création, ou nuit lue depuis l'ancien carnet de groupe (aucune ligne
       `carnet_nights` à mettre à jour) : une ligne par jour, remplacée si elle existe. */
    const inserted = await supabase
      .from('carnet_nights')
      .upsert(row, { onConflict: 'carnet_id,jour_numero' })
      .select(NIGHT_COLUMNS)
      .maybeSingle();
    if (inserted.error) return { ok: false, error: OFFLINE };
    saved = (inserted.data as NightRowRead | null) ?? null;
  }
  if (!saved) return { ok: false, error: REFUSED };
  return done(value.carnetId, { night: nightFromRow(saved) });
}

export async function deleteNightAction(input: unknown): Promise<ActionResult> {
  const parsed = NightDeleteSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };
  const { carnetId, dayNumber } = parsed.data;
  const ctx = await participantContext(carnetId);
  if (!ctx.ok) return ctx;
  const { data, error } = await ctx.supabase
    .from('carnet_nights')
    .delete()
    .eq('carnet_id', carnetId)
    .eq('jour_numero', dayNumber)
    .select('id');
  if (error) return { ok: false, error: OFFLINE };
  if (!data || data.length === 0) return { ok: false, error: REFUSED };
  return done(carnetId, {});
}

// ── Verdict ────────────────────────────────────────────────────────────────

export async function saveVerdictAction(
  input: unknown
): Promise<ActionResult<{ verdict: CarnetKitVerdictItem }>> {
  const parsed = VerdictInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };
  const value = parsed.data;
  const ctx = await participantContext(value.carnetId);
  if (!ctx.ok) return ctx;
  const { data, error } = await ctx.supabase
    .from('carnet_kit_items')
    .update(verdictRow(value))
    .eq('id', value.itemId)
    .eq('carnet_id', value.carnetId)
    .select('id');
  if (error) {
    return {
      ok: false,
      error:
        error.code === '42703'
          ? 'Les verdicts ne sont pas encore disponibles sur ce serveur.'
          : OFFLINE,
    };
  }
  if (!data || data.length === 0) return { ok: false, error: REFUSED };
  return done(value.carnetId, { verdict: verdictItem(value) });
}

// ── Voyageur ───────────────────────────────────────────────────────────────

interface ProfileRead {
  id: string;
  full_name: string | null;
  handle: string | null;
  avatar_url: string | null;
}

export async function addTravelerAction(
  input: unknown
): Promise<ActionResult<{ participant: CarnetParticipant }>> {
  const parsed = TravelerAddSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };
  const { carnetId, handle, role } = parsed.data;
  const ctx = await participantContext(carnetId);
  if (!ctx.ok) return ctx;
  const { supabase } = ctx;

  const found = await supabase
    .from('public_profiles')
    .select('id, full_name, handle, avatar_url')
    .ilike('handle', handle.replace(/[\\%_]/g, '\\$&'))
    .limit(1)
    .maybeSingle();
  const profile = found.data as ProfileRead | null;
  if (!profile) return { ok: false, error: `Aucun voyageur « @${handle} ».` };

  const { data: carnet } = await supabase
    .from('carnets')
    .select('author_id')
    .eq('id', carnetId)
    .maybeSingle();
  if ((carnet as { author_id: string | null } | null)?.author_id === profile.id) {
    return { ok: false, error: 'Cette personne est l’auteur du carnet.' };
  }
  const existing = await supabase
    .from('carnet_collaborators')
    .select('user_id')
    .eq('carnet_id', carnetId)
    .eq('user_id', profile.id)
    .limit(1);
  if ((existing.data ?? []).length > 0) {
    return { ok: false, error: 'Ce voyageur fait déjà partie du carnet.' };
  }

  const { data, error } = await supabase
    .from('carnet_collaborators')
    .insert({ carnet_id: carnetId, user_id: profile.id, role })
    .select('user_id')
    .maybeSingle();
  if (error) return { ok: false, error: OFFLINE };
  if (!data) return { ok: false, error: 'Seul l’auteur du carnet peut inviter un voyageur.' };
  return done(carnetId, {
    participant: {
      userId: profile.id,
      id: profile.id,
      name: profile.full_name,
      handle: profile.handle,
      avatarUrl: profile.avatar_url,
      role: 'collaborator',
    },
  });
}

export async function updateTravelerAction(input: unknown): Promise<ActionResult> {
  const parsed = TravelerUpdateSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };
  const { carnetId, userId, role } = parsed.data;
  const ctx = await participantContext(carnetId);
  if (!ctx.ok) return ctx;
  const { data, error } = await ctx.supabase
    .from('carnet_collaborators')
    .update({ role })
    .eq('carnet_id', carnetId)
    .eq('user_id', userId)
    .select('user_id');
  if (error) return { ok: false, error: OFFLINE };
  if (!data || data.length === 0) {
    return { ok: false, error: 'Seul l’auteur du carnet peut changer le rôle d’un voyageur.' };
  }
  return done(carnetId, {});
}

export async function removeTravelerAction(input: unknown): Promise<ActionResult> {
  const parsed = TravelerRemoveSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };
  const { carnetId, userId } = parsed.data;
  const ctx = await participantContext(carnetId);
  if (!ctx.ok) return ctx;
  const { data, error } = await ctx.supabase
    .from('carnet_collaborators')
    .delete()
    .eq('carnet_id', carnetId)
    .eq('user_id', userId)
    .select('user_id');
  if (error) return { ok: false, error: OFFLINE };
  if (!data || data.length === 0) {
    return { ok: false, error: 'Seul l’auteur du carnet peut retirer un voyageur.' };
  }
  return done(carnetId, {});
}

// ── Moment ─────────────────────────────────────────────────────────────────

export async function updateMomentAction(
  input: unknown
): Promise<ActionResult<{ place: string; caption: string | null }>> {
  const parsed = MomentUpdateSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };
  const { carnetId, id, place, caption } = parsed.data;
  const ctx = await participantContext(carnetId);
  if (!ctx.ok) return ctx;
  const { data, error } = await ctx.supabase
    .from('carnet_moments')
    .update({ lieu: place, citation: caption ?? '' })
    .eq('id', id)
    .eq('carnet_id', carnetId)
    .select('id');
  if (error) return { ok: false, error: OFFLINE };
  if (!data || data.length === 0) return { ok: false, error: REFUSED };
  return done(carnetId, { place, caption: caption ?? null });
}

export async function deleteMomentAction(input: unknown): Promise<ActionResult> {
  const parsed = MomentDeleteSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };
  const { carnetId, id } = parsed.data;
  const ctx = await participantContext(carnetId);
  if (!ctx.ok) return ctx;
  const { data, error } = await ctx.supabase
    .from('carnet_moments')
    .delete()
    .eq('id', id)
    .eq('carnet_id', carnetId)
    .select('id');
  if (error) return { ok: false, error: OFFLINE };
  if (!data || data.length === 0) return { ok: false, error: REFUSED };
  return done(carnetId, {});
}
