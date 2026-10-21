import { randomBytes } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Invitations à un profil privé.
 *
 * - `create` : le propriétaire authentifié crée une invitation nominative par
 *   lien. Le statut naît `pending`, le jeton est aléatoire et unique, et
 *   l'expiration est explicite (30 jours par défaut).
 * - `revoke` : le propriétaire révoque une de ses invitations (idempotent) ;
 *   une invitation acceptée peut aussi être révoquée pour retirer l'accès.
 * - `accept` : l'invité lie son identité (`invitee_id = auth.uid()`) à une
 *   invitation `pending` non expirée. La contrainte
 *   `profile_invitations_accepted_bound` impose cette liaison.
 *
 * Aucune clé service : le client Supabase est celui de la session, donc borné
 * par les politiques RLS `profile_invitations` (propriétaire et invité).
 */

const INVITATION_COLUMNS = 'id,owner_id,invitee_id,token,status,expires_at,created_at';
const DEFAULT_EXPIRY_DAYS = 30;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const bodySchema = z
  .object({
    action: z.enum(['create', 'revoke', 'accept']),
    expiresInDays: z.number().int().min(1).max(365).optional(),
    invitationId: z.string().uuid().optional(),
    token: z.string().trim().min(8).max(256).optional(),
  })
  .strict();

type InvitationRow = {
  id: string;
  owner_id: string;
  invitee_id: string | null;
  token: string;
  status: string;
  expires_at: string | null;
  created_at: string | null;
};

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
 * Conflit de jeton → 409 ; contrainte/état → 409 ; permission RLS → 403 ;
 * introuvable → 404 ; tout le reste est une panne d'infrastructure → 500.
 */
function failure(error: unknown) {
  const code = dbErrorCode(error);
  if (code === '23505') return json({ error: 'conflict' }, 409);
  // PGRST116 : `.single()` n'a reçu aucune ligne — course perdue avec une
  // révocation/acceptation concurrente, pas une panne.
  if (code === 'PGRST116') return json({ error: 'invalid_state' }, 409);
  if (code === '23514' || code === '55000') return json({ error: 'invalid_state' }, 409);
  if (code === '42501') return json({ error: 'forbidden' }, 403);
  if (code === 'P0002') return json({ error: 'not_found' }, 404);
  console.error('[API /api/compte/invitations]', error);
  return json({ error: 'server_error' }, 500);
}

/** Jeton opaque de 192 bits, compatible URL. */
function newToken(): string {
  return randomBytes(24).toString('base64url');
}

function expiry(days: number, now = Date.now()): string {
  return new Date(now + days * 24 * 60 * 60 * 1000).toISOString();
}

function isExpired(invitation: Pick<InvitationRow, 'expires_at'>, now = Date.now()): boolean {
  if (!invitation.expires_at) return false;
  const time = new Date(invitation.expires_at).getTime();
  // Une date illisible ne doit jamais déverrouiller un profil.
  if (!Number.isFinite(time)) return true;
  return time <= now;
}

async function createInvitation(
  supabase: Supabase,
  userId: string,
  expiresInDays = DEFAULT_EXPIRY_DAYS
) {
  const { data, error } = await supabase
    .from('profile_invitations')
    .insert({
      owner_id: userId,
      invitee_id: null,
      token: newToken(),
      status: 'pending',
      expires_at: expiry(expiresInDays),
    })
    .select(INVITATION_COLUMNS)
    .single();

  if (error || !data) return { invitation: null, error };
  return { invitation: data as InvitationRow, error: null };
}

async function revokeInvitation(supabase: Supabase, userId: string, invitationId: string) {
  const { data, error } = await supabase
    .from('profile_invitations')
    .select(INVITATION_COLUMNS)
    .eq('id', invitationId)
    .eq('owner_id', userId)
    .maybeSingle();
  if (error) return { invitation: null, error, missing: false };
  if (!data) return { invitation: null, error: null, missing: true };

  const current = data as InvitationRow;
  // Révoquer deux fois ne réécrit rien.
  if (current.status === 'revoked') return { invitation: current, error: null, missing: false };

  const { data: revoked, error: updateError } = await supabase
    .from('profile_invitations')
    .update({ status: 'revoked' })
    .eq('id', invitationId)
    .eq('owner_id', userId)
    .select(INVITATION_COLUMNS)
    .single();
  if (updateError) return { invitation: null, error: updateError, missing: false };
  if (!revoked) return { invitation: null, error: null, missing: true };
  return { invitation: revoked as InvitationRow, error: null, missing: false };
}

type AcceptOutcome =
  | { kind: 'ok'; invitation: InvitationRow }
  | { kind: 'missing' }
  | { kind: 'forbidden' }
  | { kind: 'invalid_state' }
  | { kind: 'error'; error: unknown };

async function acceptInvitation(
  supabase: Supabase,
  userId: string,
  token: string
): Promise<AcceptOutcome> {
  const { data, error } = await supabase
    .from('profile_invitations')
    .select(INVITATION_COLUMNS)
    .eq('token', token)
    .maybeSingle();
  if (error) return { kind: 'error', error };
  if (!data) return { kind: 'missing' };

  const invitation = data as InvitationRow;
  if (invitation.status === 'accepted') {
    // Accepter deux fois son invitation reste sans effet ; celle d'un autre
    // invité ne se détourne pas.
    return invitation.invitee_id === userId
      ? { kind: 'ok', invitation }
      : { kind: 'invalid_state' };
  }
  if (invitation.status !== 'pending') return { kind: 'invalid_state' };
  if (invitation.invitee_id && invitation.invitee_id !== userId) {
    return { kind: 'forbidden' };
  }
  if (isExpired(invitation)) return { kind: 'invalid_state' };

  // Liaison obligatoire : une invitation acceptée sans `invitee_id` viole
  // `profile_invitations_accepted_bound`.
  const { data: accepted, error: updateError } = await supabase
    .from('profile_invitations')
    .update({ status: 'accepted', invitee_id: userId })
    .eq('id', invitation.id)
    .eq('status', 'pending')
    .select(INVITATION_COLUMNS)
    .single();
  if (updateError) return { kind: 'error', error: updateError };
  // Course avec une révocation/acceptation concurrente : rien n'a été écrit.
  if (!accepted) return { kind: 'invalid_state' };
  return { kind: 'ok', invitation: accepted as InvitationRow };
}

export async function POST(request: NextRequest) {
  let supabase: Supabase;
  try {
    supabase = await createClient();
  } catch (error) {
    console.error('[API /api/compte/invitations]', error);
    return json({ error: 'server_error' }, 500);
  }

  // 401 avant toute analyse du corps : un appel non authentifié ne lit rien.
  const { data: auth } = await supabase.auth.getUser();
  const user = auth?.user;
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
      case 'create': {
        const { invitation, error } = await createInvitation(supabase, user.id, body.expiresInDays);
        if (error) return failure(error);
        if (!invitation) return json({ error: 'server_error' }, 500);
        return json({ invitation }, 201);
      }

      case 'revoke': {
        if (!body.invitationId) return json({ error: 'invalid_body' }, 400);
        const { invitation, error, missing } = await revokeInvitation(
          supabase,
          user.id,
          body.invitationId
        );
        if (error) return failure(error);
        if (missing || !invitation) return json({ error: 'not_found' }, 404);
        return json({ revoked: true, invitation });
      }

      case 'accept': {
        if (!body.token) return json({ error: 'invalid_body' }, 400);
        const outcome = await acceptInvitation(supabase, user.id, body.token);
        switch (outcome.kind) {
          case 'ok':
            return json({ invitation: outcome.invitation });
          case 'missing':
            return json({ error: 'not_found' }, 404);
          case 'forbidden':
            return json({ error: 'forbidden' }, 403);
          case 'invalid_state':
            return json({ error: 'invalid_state' }, 409);
          case 'error':
            return failure(outcome.error);
          default:
            return json({ error: 'server_error' }, 500);
        }
      }

      default:
        return json({ error: 'invalid_action' }, 400);
    }
  } catch (error) {
    console.error('[API /api/compte/invitations]', error);
    return json({ error: 'server_error' }, 500);
  }
}
