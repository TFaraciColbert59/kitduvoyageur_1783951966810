'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { getTripById } from '@/lib/queries-trips';
import { enforceRateLimit } from '@/lib/rate-limit/routes';
import { reportServerError } from '@/lib/observability/appErrors';
import { issueError, serverT, serverText } from './serverText';

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

const uuid = z.string().uuid('compas.server.common.invalidId');
const slug = z
  .string()
  .trim()
  .min(1)
  .max(200)
  .regex(/^[a-z0-9-]+$/i, 'compas.server.common.invalidId');
const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .nullable();

async function requireOwner(tripId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: await serverText('compas.server.bottle.signIn') } as const;
  const trip = await getTripById(tripId, user.id);
  if (!trip)
    return { error: await serverText('compas.server.common.tripNotFoundOrDenied') } as const;
  if (!trip.permissions.canEdit)
    return { error: await serverText('compas.server.bottle.ownersOnly') } as const;
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
  if (!parsed.success)
    return { success: false, error: await serverText('compas.server.common.invalidRequest') };
  try {
    const auth = await requireOwner(parsed.data.tripId);
    if ('error' in auth)
      return {
        success: false,
        error: auth.error ?? (await serverText('compas.server.common.accessDenied')),
      };
    const { supabase, userId, country } = auth;
    const t = await serverT();
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
      if (error)
        return { success: false, error: await serverText('compas.server.bottle.readFailed') };
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
          name: String(g.name ?? t('compas.server.bottle.untitled')),
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
                    : t('compas.server.bottle.someone'),
                avatarUrl: typeof p?.avatar_url === 'string' ? p.avatar_url : null,
                trustScore: typeof p?.trust_score === 'number' ? p.trust_score : null,
              };
            }),
        };
      });
    }

    let blocked: string | null = null;
    if (!country) blocked = t('compas.server.bottle.noCountry');
    else if (suspended) blocked = t('compas.server.bottle.suspended');
    else if ((trust ?? 0) < CREATION_THRESHOLD)
      blocked = t('compas.server.bottle.lowTrust', {
        trust: trust ?? 0,
        threshold: CREATION_THRESHOLD,
      });
    else if (ownedPublic >= MAX_ACTIVE_OWNED_GROUPS)
      blocked = t('compas.server.bottle.tooManyOwned', {
        count: ownedPublic,
        max: MAX_ACTIVE_OWNED_GROUPS,
      });

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
    return { success: false, error: await serverText('compas.server.common.serverError') };
  }
}

const launchSchema = z.object({
  tripId: uuid,
  tripSlug: slug,
  name: z
    .string()
    .trim()
    .min(3, 'compas.server.bottle.titleTooShort')
    .max(80, 'compas.server.bottle.titleTooLong'),
  description: z.string().trim().max(600, 'compas.server.bottle.messageTooLong'),
  departure: isoDate,
  returnDate: isoDate,
  maxMembers: z.number().int().min(2).max(20),
  minTrust: z.number().int().min(ABSOLUTE_MIN_TRUST).max(100),
  mixite: z.enum(['all', 'women_only', 'men_only']),
  isAdult: z.literal(true, { message: 'compas.server.bottle.adultRequired' }),
});

export async function compasLaunchBottleAction(
  input: z.input<typeof launchSchema>
): Promise<BottleResult> {
  const parsed = launchSchema.safeParse(input);
  if (!parsed.success)
    return issueError(parsed.error.issues[0]?.message, 'compas.server.common.invalidRequest');
  const d = parsed.data;
  if (d.departure && d.returnDate && d.returnDate < d.departure)
    return {
      success: false,
      error: await serverText('compas.server.bottle.returnBeforeDeparture'),
    };
  try {
    const auth = await requireOwner(d.tripId);
    if ('error' in auth)
      return {
        success: false,
        error: auth.error ?? (await serverText('compas.server.common.accessDenied')),
      };
    const limited = await enforceRateLimit(auth.userId, {
      scope: 'compas-bottle',
      limit: 5,
      windowMs: 10 * 60_000,
      failMode: 'closed',
    });
    if (limited) return { success: false, error: await serverText('compas.server.bottle.tooMany') };
    const state = await compasBottleStateAction({ tripId: d.tripId });
    if (!state.success) return state;
    if (!state.state.canLaunch || !auth.country)
      return {
        success: false,
        error: state.state.blocked ?? (await serverText('compas.server.bottle.launchBlocked')),
      };

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
    if (error)
      return { success: false, error: await serverText('compas.server.bottle.launchFailed') };
    revalidate(auth.country);
    return { success: true };
  } catch (err) {
    await reportServerError('compas.compasLaunchBottleAction', err);
    return { success: false, error: await serverText('compas.server.common.serverError') };
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
  if (!parsed.success)
    return { success: false, error: await serverText('compas.server.common.invalidRequest') };
  const d = parsed.data;
  try {
    const auth = await requireOwner(d.tripId);
    if ('error' in auth)
      return {
        success: false,
        error: auth.error ?? (await serverText('compas.server.common.accessDenied')),
      };
    const { supabase, userId } = auth;
    const { data: group } = await supabase
      .from('travel_groups')
      .select('id, name, max_members, owner_id')
      .eq('id', d.groupId)
      .maybeSingle();
    if (!group || group.owner_id !== userId)
      return { success: false, error: await serverText('compas.server.bottle.notFound') };
    const { data: member } = await supabase
      .from('group_members')
      .select('id, user_id, status')
      .eq('id', d.memberId)
      .eq('group_id', d.groupId)
      .maybeSingle();
    if (!member || member.status !== 'pending')
      return { success: false, error: await serverText('compas.server.bottle.alreadyHandled') };

    if (d.accept) {
      const { count } = await supabase
        .from('group_members')
        .select('id', { count: 'exact', head: true })
        .eq('group_id', d.groupId)
        .eq('status', 'active');
      if ((count ?? 0) >= Number(group.max_members))
        return { success: false, error: await serverText('compas.server.bottle.groupFull') };
    }
    const { error } = await supabase
      .from('group_members')
      .update({ status: d.accept ? 'active' : 'rejected' })
      .eq('id', d.memberId);
    if (error)
      return { success: false, error: await serverText('compas.server.bottle.answerFailed') };

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
    return { success: false, error: await serverText('compas.server.common.serverError') };
  }
}

const closeSchema = z.object({ tripId: uuid, tripSlug: slug, groupId: uuid });

/** Retire la bouteille de la communauté (le groupe devient privé, rien n'est supprimé). */
export async function compasCloseBottleAction(
  input: z.input<typeof closeSchema>
): Promise<BottleResult> {
  const parsed = closeSchema.safeParse(input);
  if (!parsed.success)
    return { success: false, error: await serverText('compas.server.common.invalidRequest') };
  try {
    const auth = await requireOwner(parsed.data.tripId);
    if ('error' in auth)
      return {
        success: false,
        error: auth.error ?? (await serverText('compas.server.common.accessDenied')),
      };
    const { data, error } = await auth.supabase
      .from('travel_groups')
      .update({ visibility: 'private' })
      .eq('id', parsed.data.groupId)
      .eq('owner_id', auth.userId)
      .select('id');
    if (error || !data?.length)
      return { success: false, error: await serverText('compas.server.bottle.notFound') };
    revalidate(auth.country);
    return { success: true };
  } catch (err) {
    await reportServerError('compas.compasCloseBottleAction', err);
    return { success: false, error: await serverText('compas.server.common.serverError') };
  }
}
