import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Adhésions et RSVP du drawer Profil.
 *
 * - `join`  : insère la seule adhésion de l'appelant. Un membre actif déjà
 *   présent est un succès idempotent ; une demande en attente est un conflit
 *   dédié (`membership_pending`, 409) et une adhésion bannie est refusée (403).
 * - `leave` : supprime l'adhésion de l'appelant si elle est active ou en
 *   attente. Une adhésion bannie n'est jamais supprimée par l'intéressé (403) ;
 *   sans adhésion, l'opération reste un succès idempotent.
 * - `rsvp`  : persiste la participation de l'appelant à un événement réel.
 *   Pour un événement rattaché à un club, une adhésion `active` est exigée
 *   (`membership_required`, 403) : un banni, un candidat en attente ou un
 *   non-membre ne peut pas s'inscrire. Un événement sans `club_id` est ouvert
 *   aux utilisateurs connectés. `attending: false` retire la participation ;
 *   `attending` vaut `true` par défaut. L'upsert est idempotent sur la clé
 *   primaire `(event_id, user_id)`.
 *
 * Toutes les lectures/écritures passent par le client de session : la RLS de
 * `club_members` et `club_event_participants` borne chaque ligne à
 * `auth.uid()`. Aucune clé service n'est utilisée.
 *
 * `clubs.members_count` n'est pas réécrit ici : la RLS de `clubs` réserve
 * l'UPDATE au créateur/admin du club, un membre ne peut donc pas mettre à jour
 * le compteur dénormalisé. Il reste géré côté fiche club (ou futur trigger).
 */

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const bodySchema = z.discriminatedUnion('action', [
  z
    .object({
      action: z.literal('join'),
      clubId: z.string().uuid(),
    })
    .strict(),
  z
    .object({
      action: z.literal('leave'),
      clubId: z.string().uuid(),
    })
    .strict(),
  z
    .object({
      action: z.literal('rsvp'),
      eventId: z.string().uuid(),
      clubId: z.string().uuid().optional(),
      attending: z.boolean().optional(),
    })
    .strict(),
]);

type ClubRecord = {
  id: string;
};

type MembershipRecord = {
  id: string;
  role: string | null;
  status: string | null;
};

type EventRecord = {
  id: string;
  club_id: string | null;
  event_date: string | null;
};

type MembershipStatus = 'active' | 'banned' | 'pending';

function membershipStatusOf(membership: MembershipRecord | null): MembershipStatus | null {
  const status = membership?.status;
  return status === 'active' || status === 'banned' || status === 'pending' ? status : null;
}

type Supabase = Awaited<ReturnType<typeof createClient>>;

function json(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { 'Cache-Control': 'no-store, private' },
  });
}

function dbErrorCode(error: unknown): string {
  if (error && typeof error === 'object' && 'code' in error) {
    const code = (error as { code?: unknown }).code;
    return typeof code === 'string' ? code : '';
  }
  return '';
}

/**
 * Conflit d'état (contrainte métier) → 409 ; permission RLS → 403 ;
 * référence absente → 404 ; tout le reste est une panne d'infrastructure.
 */
function failure(error: unknown) {
  const code = dbErrorCode(error);
  if (code === '55000' || code === '23514' || code === '23P01' || code === 'PT409') {
    return json({ error: 'invalid_state' }, 409);
  }
  if (code === '42501') return json({ error: 'forbidden' }, 403);
  if (code === '23503' || code === 'PGRST116' || code === 'P0002') {
    return json({ error: 'not_found' }, 404);
  }
  console.error('[API /api/compte/clubs]', error);
  return json({ error: 'server_error' }, 500);
}

async function loadClub(
  supabase: Supabase,
  clubId: string
): Promise<{ club: ClubRecord | null; error: unknown }> {
  const { data, error } = await supabase
    .from('clubs')
    .select('id')
    .eq('id', clubId)
    .maybeSingle();

  return { club: (data ?? null) as ClubRecord | null, error };
}

async function loadMembership(
  supabase: Supabase,
  userId: string,
  clubId: string
): Promise<{ membership: MembershipRecord | null; error: unknown }> {
  const { data, error } = await supabase
    .from('club_members')
    .select('id,role,status')
    .eq('club_id', clubId)
    .eq('user_id', userId)
    .limit(1)
    .maybeSingle();

  return { membership: (data ?? null) as MembershipRecord | null, error };
}

async function loadEvent(
  supabase: Supabase,
  eventId: string
): Promise<{ event: EventRecord | null; error: unknown }> {
  const { data, error } = await supabase
    .from('club_events')
    .select('id,club_id,event_date')
    .eq('id', eventId)
    .maybeSingle();

  return { event: (data ?? null) as EventRecord | null, error };
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  const user = auth?.user;
  // Aucune lecture ni écriture avant d'avoir identifié la session.
  if (!user) return json({ error: 'unauthenticated' }, 401);
  // Un identifiant non UUID ne doit jamais entrer dans un filtre PostgREST.
  if (!UUID_RE.test(user.id)) return json({ error: 'server_error' }, 500);

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return json({ error: 'invalid_body' }, 400);
  }

  const parsed = bodySchema.safeParse(raw);
  if (!parsed.success) {
    const actionInvalid = parsed.error.issues.some((issue) => issue.path[0] === 'action');
    return json({ error: actionInvalid ? 'invalid_action' : 'invalid_body' }, 400);
  }
  const body = parsed.data;

  try {
    switch (body.action) {
      case 'join': {
        const { club, error: clubError } = await loadClub(supabase, body.clubId);
        if (clubError) return failure(clubError);
        if (!club) return json({ error: 'not_found' }, 404);

        const { membership, error: membershipError } = await loadMembership(
          supabase,
          user.id,
          body.clubId
        );
        if (membershipError) return failure(membershipError);

        const status = membershipStatusOf(membership);
        if (status === 'active') {
          // Déjà membre : rejoindre reste sans effet.
          return json({ clubId: body.clubId, joined: true });
        }
        if (status === 'pending') return json({ error: 'membership_pending' }, 409);
        if (status === 'banned') return json({ error: 'forbidden' }, 403);
        if (membership) return json({ error: 'invalid_state' }, 409);

        const { error: insertError } = await supabase.from('club_members').insert({
          club_id: body.clubId,
          user_id: user.id,
          role: 'member',
          status: 'active',
        });
        if (insertError && dbErrorCode(insertError) === '23505') {
          // Course concurrente : relire l'adhésion réellement présente et
          // appliquer le même mapping de statut, jamais un succès aveugle.
          const { membership: raced, error: racedError } = await loadMembership(
            supabase,
            user.id,
            body.clubId
          );
          if (racedError) return failure(racedError);
          const racedStatus = membershipStatusOf(raced);
          if (racedStatus === 'active') {
            return json({ clubId: body.clubId, joined: true });
          }
          if (racedStatus === 'pending') {
            return json({ error: 'membership_pending' }, 409);
          }
          if (racedStatus === 'banned') return json({ error: 'forbidden' }, 403);
          return json({ error: 'invalid_state' }, 409);
        }
        if (insertError) return failure(insertError);

        return json({ clubId: body.clubId, joined: true });
      }

      case 'leave': {
        const { club, error: clubError } = await loadClub(supabase, body.clubId);
        if (clubError) return failure(clubError);
        if (!club) return json({ error: 'not_found' }, 404);

        const { membership, error: membershipError } = await loadMembership(
          supabase,
          user.id,
          body.clubId
        );
        if (membershipError) return failure(membershipError);
        // Un bannissement est une décision du club : l'intéressé ne peut pas
        // l'effacer en quittant. Les statuts pending/active restent retirables.
        if (membershipStatusOf(membership) === 'banned') {
          return json({ error: 'forbidden' }, 403);
        }

        // Le filtre `user_id` est indispensable : la RLS autorise la suppression
        // de ses propres lignes, jamais celles d'un autre membre.
        const { error: deleteError } = await supabase
          .from('club_members')
          .delete()
          .eq('club_id', body.clubId)
          .eq('user_id', user.id);
        if (deleteError) return failure(deleteError);

        return json({ clubId: body.clubId, joined: false });
      }

      case 'rsvp': {
        if (body.clubId) {
          const { club, error: clubError } = await loadClub(supabase, body.clubId);
          if (clubError) return failure(clubError);
          if (!club) return json({ error: 'not_found' }, 404);
        }

        const { event, error: eventError } = await loadEvent(supabase, body.eventId);
        if (eventError) return failure(eventError);
        if (!event) return json({ error: 'not_found' }, 404);

        // Un événement rattaché à un autre club ne peut pas être confirmé sous
        // ce club : la requête est incohérente.
        if (body.clubId && event.club_id !== body.clubId) {
          return json({ error: 'invalid_club' }, 400);
        }

        // RSVP réservé aux membres actifs du club de l'événement. Un événement
        // sans club (null) reste ouvert à tout utilisateur connecté : il n'y a
        // alors aucune adhésion à exiger.
        if (event.club_id) {
          const { membership, error: membershipError } = await loadMembership(
            supabase,
            user.id,
            event.club_id
          );
          if (membershipError) return failure(membershipError);
          if (membershipStatusOf(membership) !== 'active') {
            return json({ error: 'membership_required' }, 403);
          }
        }

        const startsAt = event.event_date ? new Date(event.event_date).getTime() : Number.NaN;
        if (Number.isFinite(startsAt) && startsAt < Date.now()) {
          return json({ error: 'invalid_state' }, 409);
        }

        const attending = body.attending !== false;
        if (attending) {
          const { error: upsertError } = await supabase
            .from('club_event_participants')
            .upsert(
              { event_id: body.eventId, user_id: user.id },
              { onConflict: 'event_id,user_id', ignoreDuplicates: true }
            );
          if (upsertError) return failure(upsertError);
        } else {
          const { error: deleteError } = await supabase
            .from('club_event_participants')
            .delete()
            .eq('event_id', body.eventId)
            .eq('user_id', user.id);
          if (deleteError) return failure(deleteError);
        }

        return json({
          clubId: body.clubId ?? event.club_id ?? null,
          eventId: body.eventId,
          attending,
        });
      }
    }
  } catch (error) {
    return failure(error);
  }
}
