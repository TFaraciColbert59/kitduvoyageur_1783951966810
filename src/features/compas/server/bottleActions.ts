'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { getTripById } from '@/lib/queries-trips';
import { enforceRateLimit } from '@/lib/rate-limit/routes';
import { reportServerError } from '@/lib/observability/appErrors';

/**
 * Bouteille à la mer depuis le Compas : une annonce de groupe publique
 * (travel_groups) pour le pays du voyage, avec les mêmes règles que la page
 * pays (confiance ≥ 65 pour lancer, plancher de confiance 50, 3 annonces
 * publiques au plus, majorité certifiée). L'organisateur accepte ou refuse
 * chaque candidature ; une personne acceptée rejoint aussi le voyage, en
 * lecture seule.
 */

const CREATION_THRESHOLD = 65;
const ABSOLUTE_MIN_TRUST = 50;
const MAX_ACTIVE_OWNED_GROUPS = 3;

export type BottleResult = { success: true } | { success: false; error: string };

export interface CompasBottleApplicant {
  memberId: string;
  userId: string;
  name: string;
  avatarUrl: string | null;
  trustScore: number | null;
}

export interface CompasBottle {
  id: string;
  name: string;
  description: string | null;
  departure: string | null;
  returnDate: string | null;
  maxMembers: number;
  minTrust: number;
  mixite: 'all' | 'women_only' | 'men_only';
  activeCount: number;
  applicants: CompasBottleApplicant[];
}

export interface CompasBottleState {
  country: string | null;
  countryName: string | null;
  trustScore: number | null;
  canLaunch: boolean;
  /** Pourquoi on ne peut pas lancer, s'il y a lieu (affiché tel quel). */
  blocked: string | null;
  bottles: CompasBottle[];
}

const uuid = z.string().uuid('Identifiant invalide');
const slug = z
  .string()
  .trim()
  .min(1)
  .max(200)
  .regex(/^[a-z0-9-]+$/i, 'Identifiant invalide');
const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .nullable();

async function requireOwner(tripId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: 'Connecte-toi pour lancer une bouteille à la mer.' } as const;
  const trip = await getTripById(tripId, user.id);
  if (!trip) return { error: 'Voyage introuvable ou non autorisé.' } as const;
  if (!trip.permissions.canEdit)
    return { error: 'Seuls les organisateurs gèrent la bouteille à la mer.' } as const;
  const country = trip.destination_country_code
    ? String(trip.destination_country_code).toLowerCase()
    : null;
  return {
    supabase,
    userId: user.id,
    trip,
    country,
    countryName: trip.destination_name ?? null,
  } as const;
}

/** La page pays est en cache (ISR) : elle seule doit être rafraîchie. */
function revalidate(country: string | null) {
  if (country) revalidatePath(`/pays/${country}`);
}

const stateSchema = z.object({ tripId: uuid });

export async function compasBottleStateAction(
  input: z.input<typeof stateSchema>
): Promise<{ success: true; state: CompasBottleState } | { success: false; error: string }> {
  const parsed = stateSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: 'Requête invalide' };
  try {
    const auth = await requireOwner(parsed.data.tripId);
    if ('error' in auth) return { success: false, error: auth.error ?? 'Accès refusé' };
    const { supabase, userId, country } = auth;
    const { data: me } = await supabase
      .from('user_profiles')
      .select('trust_score, is_suspended_groups, suspended_from_groups_at')
      .eq('id', userId)
      .maybeSingle();
    const trust = typeof me?.trust_score === 'number' ? me.trust_score : null;
    const suspended = Boolean(me?.is_suspended_groups || me?.suspended_from_groups_at);

    let bottles: CompasBottle[] = [];
    let ownedPublic = 0;
    {
      const { count } = await supabase
        .from('travel_groups')
        .select('id', { count: 'exact', head: true })
        .eq('owner_id', userId)
        .eq('visibility', 'public');
      ownedPublic = count ?? 0;
    }
    if (country) {
      const { data: groups, error } = await supabase
        .from('travel_groups')
        .select(
          'id, name, description, departure_date, return_date, max_members, min_trust_score, mixite'
        )
        .eq('owner_id', userId)
        .eq('visibility', 'public')
        .ilike('country_iso', country)
        .order('created_at', { ascending: false })
        .limit(5);
      if (error) return { success: false, error: 'Impossible de lire tes bouteilles.' };
      const ids = (groups ?? []).map((g) => g.id as string);
      const { data: members } = ids.length
        ? await supabase
            .from('group_members')
            .select('id, group_id, user_id, status')
            .in('group_id', ids)
            .in('status', ['pending', 'active'])
        : { data: [] };
      const rows = (members ?? []) as Array<{
        id: string;
        group_id: string;
        user_id: string;
        status: string;
      }>;
      const pendingIds = [
        ...new Set(rows.filter((r) => r.status === 'pending').map((r) => r.user_id)),
      ];
      const { data: profiles } = pendingIds.length
        ? await supabase
            .from('public_profiles')
            .select('id, full_name, avatar_url, trust_score')
            .in('id', pendingIds)
        : { data: [] };
      const byId = new Map(
        ((profiles ?? []) as Array<Record<string, unknown>>).map((p) => [String(p.id), p])
      );
      bottles = (groups ?? []).map((g) => {
        const mine = rows.filter((r) => r.group_id === g.id);
        return {
          id: String(g.id),
          name: String(g.name ?? 'Bouteille à la mer'),
          description: typeof g.description === 'string' ? g.description : null,
          departure: typeof g.departure_date === 'string' ? g.departure_date : null,
          returnDate: typeof g.return_date === 'string' ? g.return_date : null,
          maxMembers: Number(g.max_members) || 6,
          minTrust: Number(g.min_trust_score) || ABSOLUTE_MIN_TRUST,
          mixite:
            g.mixite === 'women_only' || g.mixite === 'men_only'
              ? (g.mixite as 'women_only' | 'men_only')
              : 'all',
          activeCount: mine.filter((r) => r.status === 'active').length,
          applicants: mine
            .filter((r) => r.status === 'pending')
            .map((r) => {
              const p = byId.get(r.user_id);
              return {
                memberId: r.id,
                userId: r.user_id,
                name:
                  typeof p?.full_name === 'string' && p.full_name.trim()
                    ? p.full_name.trim()
                    : 'Voyageur',
                avatarUrl: typeof p?.avatar_url === 'string' ? p.avatar_url : null,
                trustScore: typeof p?.trust_score === 'number' ? p.trust_score : null,
              };
            }),
        };
      });
    }

    let blocked: string | null = null;
    if (!country) blocked = 'Pays de destination non renseigné : choisis d’abord où tu pars.';
    else if (suspended)
      blocked = 'Ton compte est restreint pour les groupes suite à un signalement.';
    else if ((trust ?? 0) < CREATION_THRESHOLD)
      blocked = `Confiance ${trust ?? 0}/100 : il faut ${CREATION_THRESHOLD} pour lancer une bouteille.`;
    else if (ownedPublic >= MAX_ACTIVE_OWNED_GROUPS)
      blocked = `Tu as déjà ${ownedPublic} annonces publiques (maximum ${MAX_ACTIVE_OWNED_GROUPS}).`;

    return {
      success: true,
      state: {
        country,
        countryName: auth.countryName,
        trustScore: trust,
        canLaunch: blocked == null,
        blocked,
        bottles,
      },
    };
  } catch (err) {
    await reportServerError('compas.compasBottleStateAction', err);
    return { success: false, error: 'Erreur serveur' };
  }
}

const launchSchema = z.object({
  tripId: uuid,
  tripSlug: slug,
  name: z.string().trim().min(3, 'Titre trop court').max(80, 'Titre trop long'),
  description: z.string().trim().max(600, 'Message trop long'),
  departure: isoDate,
  returnDate: isoDate,
  maxMembers: z.number().int().min(2).max(20),
  minTrust: z.number().int().min(ABSOLUTE_MIN_TRUST).max(100),
  mixite: z.enum(['all', 'women_only', 'men_only']),
  isAdult: z.literal(true, { message: 'Certifie avoir 18 ans ou plus.' }),
});

export async function compasLaunchBottleAction(
  input: z.input<typeof launchSchema>
): Promise<BottleResult> {
  const parsed = launchSchema.safeParse(input);
  if (!parsed.success)
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Requête invalide' };
  const d = parsed.data;
  if (d.departure && d.returnDate && d.returnDate < d.departure)
    return { success: false, error: 'Le retour précède le départ.' };
  try {
    const auth = await requireOwner(d.tripId);
    if ('error' in auth) return { success: false, error: auth.error ?? 'Accès refusé' };
    const limited = await enforceRateLimit(auth.userId, {
      scope: 'compas-bottle',
      limit: 5,
      windowMs: 10 * 60_000,
      failMode: 'closed',
    });
    if (limited) return { success: false, error: 'Trop de bouteilles d’un coup : patiente.' };
    const state = await compasBottleStateAction({ tripId: d.tripId });
    if (!state.success) return state;
    if (!state.state.canLaunch || !auth.country)
      return { success: false, error: state.state.blocked ?? 'Lancement impossible.' };

    await auth.supabase
      .from('user_profiles')
      .update({ age_confirmed_at: new Date().toISOString() })
      .eq('id', auth.userId);

    const { error } = await auth.supabase.from('travel_groups').insert({
      name: d.name,
      description: d.description || null,
      owner_id: auth.userId,
      departure_date: d.departure,
      return_date: d.returnDate,
      max_members: d.maxMembers,
      theme: '🌍',
      destination: auth.countryName ?? auth.country.toUpperCase(),
      country_iso: auth.country,
      visibility: 'public',
      min_trust_score: Math.max(ABSOLUTE_MIN_TRUST, d.minTrust),
      mixite: d.mixite,
    });
    if (error) return { success: false, error: 'Impossible de lancer la bouteille.' };
    revalidate(auth.country);
    return { success: true };
  } catch (err) {
    await reportServerError('compas.compasLaunchBottleAction', err);
    return { success: false, error: 'Erreur serveur' };
  }
}

const answerSchema = z.object({
  tripId: uuid,
  tripSlug: slug,
  groupId: uuid,
  memberId: uuid,
  accept: z.boolean(),
});

/** Accepte (rejoint le groupe ET le voyage en lecture seule) ou refuse une candidature. */
export async function compasAnswerApplicantAction(
  input: z.input<typeof answerSchema>
): Promise<BottleResult> {
  const parsed = answerSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: 'Requête invalide' };
  const d = parsed.data;
  try {
    const auth = await requireOwner(d.tripId);
    if ('error' in auth) return { success: false, error: auth.error ?? 'Accès refusé' };
    const { supabase, userId } = auth;
    const { data: group } = await supabase
      .from('travel_groups')
      .select('id, name, max_members, owner_id')
      .eq('id', d.groupId)
      .maybeSingle();
    if (!group || group.owner_id !== userId)
      return { success: false, error: 'Bouteille introuvable.' };
    const { data: member } = await supabase
      .from('group_members')
      .select('id, user_id, status')
      .eq('id', d.memberId)
      .eq('group_id', d.groupId)
      .maybeSingle();
    if (!member || member.status !== 'pending')
      return { success: false, error: 'Candidature déjà traitée.' };

    if (d.accept) {
      const { count } = await supabase
        .from('group_members')
        .select('id', { count: 'exact', head: true })
        .eq('group_id', d.groupId)
        .eq('status', 'active');
      if ((count ?? 0) >= Number(group.max_members))
        return { success: false, error: 'Le groupe est complet.' };
    }
    const { error } = await supabase
      .from('group_members')
      .update({ status: d.accept ? 'active' : 'rejected' })
      .eq('id', d.memberId);
    if (error) return { success: false, error: 'Réponse non enregistrée.' };

    await supabase.from('notifications').insert({
      user_id: member.user_id,
      actor_id: userId,
      related_type: 'travel_group',
      related_id: d.groupId,
      type: d.accept ? 'group_join_accepted' : 'group_join_rejected',
      title: d.accept ? 'Demande acceptée' : 'Demande non retenue',
      message: d.accept
        ? `Tu fais partie de l’équipage « ${group.name} ».`
        : `Ta demande pour « ${group.name} » n’a pas été retenue.`,
      ...(d.accept ? { link: `/groupes/${d.groupId}` } : {}),
    });

    if (d.accept) {
      // Rejoint aussi le voyage, en lecture seule (déjà présent : rien à faire).
      const { data: existing } = await supabase
        .from('trip_collaborators')
        .select('id')
        .eq('trip_id', d.tripId)
        .eq('user_id', member.user_id)
        .maybeSingle();
      if (!existing && member.user_id !== auth.trip.user_id)
        await supabase.from('trip_collaborators').insert({
          trip_id: d.tripId,
          user_id: member.user_id,
          role: 'viewer',
          invited_by: userId,
        });
    }
    revalidate(auth.country);
    return { success: true };
  } catch (err) {
    await reportServerError('compas.compasAnswerApplicantAction', err);
    return { success: false, error: 'Erreur serveur' };
  }
}

const closeSchema = z.object({ tripId: uuid, tripSlug: slug, groupId: uuid });

/** Retire la bouteille de la communauté (le groupe devient privé, rien n'est supprimé). */
export async function compasCloseBottleAction(
  input: z.input<typeof closeSchema>
): Promise<BottleResult> {
  const parsed = closeSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: 'Requête invalide' };
  try {
    const auth = await requireOwner(parsed.data.tripId);
    if ('error' in auth) return { success: false, error: auth.error ?? 'Accès refusé' };
    const { data, error } = await auth.supabase
      .from('travel_groups')
      .update({ visibility: 'private' })
      .eq('id', parsed.data.groupId)
      .eq('owner_id', auth.userId)
      .select('id');
    if (error || !data?.length) return { success: false, error: 'Bouteille introuvable.' };
    revalidate(auth.country);
    return { success: true };
  } catch (err) {
    await reportServerError('compas.compasCloseBottleAction', err);
    return { success: false, error: 'Erreur serveur' };
  }
}
