'use server';

import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { enforceRateLimit } from '@/lib/rate-limit/routes';
import { serverT, serverText, type CompasServerKey, type ServerT } from './serverText';

/**
 * Côté invité : voir ses invitations à un voyage, les accepter ou les refuser
 * sur place (notifications, commentaires, clubs, lien). L'accès au voyage
 * n'existe qu'après acceptation : c'est la fonction en base
 * `respond_trip_invitation` qui crée la ligne trip_collaborators.
 */

export interface TripInvitationView {
  invitationId: string;
  tripId: string;
  token: string | null;
  role: 'editor' | 'viewer';
  tripTitle: string;
  destination: string | null;
  startDate: string | null;
  endDate: string | null;
  inviterName: string;
  inviterAvatar: string | null;
}

export interface TripInvitationPreview extends TripInvitationView {
  status: 'pending' | 'accepted' | 'declined' | 'cancelled';
  isLink: boolean;
  forMe: boolean;
  alreadyMember: boolean;
  expired: boolean;
}

type Row = Record<string, unknown>;
const str = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : null);

function toView(r: Row, t: ServerT): TripInvitationView {
  return {
    invitationId: String(r.invitation_id),
    tripId: String(r.trip_id),
    token: str(r.token),
    role: r.role === 'editor' ? 'editor' : 'viewer',
    tripTitle: str(r.trip_title) ?? t('compas.server.invitation.untitledTrip'),
    destination: str(r.destination),
    startDate: str(r.start_date),
    endDate: str(r.end_date),
    inviterName: str(r.inviter_name) ?? t('compas.server.invitation.someone'),
    inviterAvatar: str(r.inviter_avatar),
  };
}

/** Invitations nominatives en attente de la personne connectée. */
export async function listMyTripInvitations(): Promise<TripInvitationView[]> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return [];
    const { data, error } = await supabase.rpc('my_trip_invitations');
    if (error) {
      console.warn('[invitation] liste', error.code, error.message);
      return [];
    }
    const t = await serverT();
    return ((data ?? []) as Row[]).map((r) => toView(r, t));
  } catch (err) {
    console.error('[invitation] listMyTripInvitations', err);
    return [];
  }
}

const tokenSchema = z.string().regex(/^[a-f0-9]{16,64}$/);

/** Aperçu d'une invitation par son lien (titre, lieu, dates, organisateur). */
export async function getTripInvitationPreview(
  token: string
): Promise<TripInvitationPreview | null> {
  if (!tokenSchema.safeParse(token).success) return null;
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc('trip_invitation_preview', { p_token: token });
    if (error) {
      console.warn('[invitation] aperçu', error.code, error.message);
      return null;
    }
    const r = ((data ?? []) as Row[])[0];
    if (!r) return null;
    const status = String(r.status);
    return {
      ...toView({ ...r, token }, await serverT()),
      status:
        status === 'accepted' || status === 'declined' || status === 'cancelled'
          ? status
          : 'pending',
      isLink: r.is_link === true,
      forMe: r.for_me === true,
      alreadyMember: r.already_member === true,
      expired: r.expired === true,
    };
  } catch (err) {
    console.error('[invitation] getTripInvitationPreview', err);
    return null;
  }
}

const respondSchema = z
  .object({
    invitationId: z.string().uuid().optional(),
    token: tokenSchema.optional(),
    accept: z.boolean(),
  })
  .refine((v) => Boolean(v.invitationId || v.token));

/** Raison renvoyée par la base (`respond_trip_invitation`) → message montré. */
const REASONS: Record<string, CompasServerKey> = {
  'invitation closed': 'compas.server.invitation.closed',
  'invitation not found': 'compas.server.invitation.notFound',
  'not invitee': 'compas.server.invitation.notInvitee',
  'auth required': 'compas.server.invitation.signIn',
};

export async function respondTripInvitationAction(
  input: z.input<typeof respondSchema>
): Promise<{ success: true; tripId: string } | { success: false; error: string }> {
  const parsed = respondSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: await serverText('compas.server.common.invalidRequest') };
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { success: false, error: await serverText(REASONS['auth required']) };
    const limited = await enforceRateLimit(user.id, {
      scope: 'trip-invitation-respond',
      limit: 30,
      windowMs: 60_000,
      failMode: 'closed',
    });
    if (limited) return { success: false, error: await serverText('compas.server.invitation.tooMany') };
    const { data, error } = await supabase.rpc('respond_trip_invitation', {
      p_invitation_id: parsed.data.invitationId ?? null,
      p_token: parsed.data.invitationId ? null : (parsed.data.token ?? null),
      p_accept: parsed.data.accept,
    });
    if (error) {
      const reason = Object.keys(REASONS).find((k) => error.message?.includes(k));
      if (!reason) console.warn('[invitation] réponse', error.code, error.message);
      return { success: false, error: await serverText(reason ? REASONS[reason] : 'compas.server.invitation.failed') };
    }
    return { success: true, tripId: String(data) };
  } catch (err) {
    console.error('[invitation] respondTripInvitationAction', err);
    return { success: false, error: await serverText('compas.server.common.serverError') };
  }
}
