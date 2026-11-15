import { NextRequest } from 'next/server';

import { createClient } from '@/lib/supabase/server';
import { redeemInviteLink, revokeInviteLink, type InviteLink } from '@/features/clubs';
import {
  csrfFailure,
  dbFailure,
  errorJson,
  hasValidOrigin,
  json,
  optionalUser,
  respondClubResult,
} from '../../_lib/http';
import { loadViewerContext } from '../../_lib/db';
import { mapInviteRow, type Row } from '../../_lib/mappers';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function loadInvite(
  supabase: Awaited<ReturnType<typeof createClient>>,
  token: string,
): Promise<InviteLink | null> {
  const { data, error } = await supabase.rpc('lkdv_get_club_invite', { p_token: token });
  if (error) throw error;
  const rows = Array.isArray(data) ? data : data ? [data] : [];
  return rows.length > 0 ? mapInviteRow(rows[0] as Row) : null;
}

/** GET — état public minimal d’un lien (sans liste des invités). */
export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ token: string }> },
) {
  const { token } = await context.params;
  if (!token || token.length > 200) return errorJson('not_found', 404);

  try {
    const supabase = await createClient();
    const user = await optionalUser(supabase);
    if (!user) return errorJson('unauthenticated', 401);
    const invite = await loadInvite(supabase, token);
    if (!invite) return errorJson('not_found', 404);
    return json({
      data: {
        kind: invite.kind,
        clubId: invite.clubId,
        targetId: invite.targetId,
        expiresAt: invite.expiresAt,
        maxUses: invite.maxUses,
        usesCount: invite.usesCount,
        revokedAt: invite.revokedAt,
      },
    });
  } catch (error) {
    return dbFailure('GET /api/clubs/invites/[token]', error);
  }
}

/** POST — consommation atomique de l’invitation (idempotence côté usage). */
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ token: string }> },
) {
  if (!hasValidOrigin(request)) return csrfFailure();
  const { token } = await context.params;
  if (!token || token.length > 200) return errorJson('not_found', 404);

  try {
    const supabase = await createClient();
    const user = await optionalUser(supabase);
    if (!user) return errorJson('unauthenticated', 401);

    const invite = await loadInvite(supabase, token);
    if (!invite) return errorJson('not_found', 404);

    const { context: viewerContext, memberships } = await loadViewerContext(supabase, user.id);
    const nowIso = new Date().toISOString();
    const redeemed = redeemInviteLink({
      invite,
      redeemerUserId: user.id,
      memberships,
      privacyContext: viewerContext,
      nowIso,
    });
    if (!redeemed.ok) return respondClubResult(redeemed);

    const { error } = await supabase.rpc('lkdv_redeem_club_invite', { p_token: token });
    if (error) return dbFailure('POST redeem invite', error);

    if (invite.kind === 'club' && invite.clubId) {
      const { error: memberError } = await supabase.from('club_members').upsert(
        {
          club_id: invite.clubId,
          user_id: user.id,
          role: 'member',
          status: 'active',
          joined_at: nowIso,
          leaderboard_opt_in: false,
        },
        { onConflict: 'club_id,user_id' },
      );
      if (memberError) return dbFailure('POST redeem membership', memberError);
    }

    if (invite.kind === 'event') {
      const { error: registrationError } = await supabase.from('club_event_registrations').upsert(
        {
          event_id: invite.targetId,
          user_id: user.id,
          status: 'registered',
          invite_id: invite.id,
          invited_by_user_id: invite.createdBy,
          registered_at: nowIso,
          updated_at: nowIso,
        },
        { onConflict: 'event_id,user_id' },
      );
      if (registrationError) return dbFailure('POST redeem event', registrationError);
    }

    return json({ data: redeemed.data });
  } catch (error) {
    return dbFailure('POST /api/clubs/invites/[token]', error);
  }
}

/** DELETE — révocation par le créateur ou un admin/modérateur du club. */
export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ token: string }> },
) {
  if (!hasValidOrigin(request)) return csrfFailure();
  const { token } = await context.params;
  if (!token || token.length > 200) return errorJson('not_found', 404);

  try {
    const supabase = await createClient();
    const user = await optionalUser(supabase);
    if (!user) return errorJson('unauthenticated', 401);

    const invite = await loadInvite(supabase, token);
    if (!invite) return errorJson('not_found', 404);

    const { memberships } = await loadViewerContext(supabase, user.id);
    const nowIso = new Date().toISOString();
    const revoked = revokeInviteLink({ invite, actorUserId: user.id, memberships, nowIso });
    if (!revoked.ok) return respondClubResult(revoked);

    const { error } = await supabase
      .from('club_invites')
      .update({ revoked_at: revoked.data.revokedAt })
      .eq('id', invite.id);
    if (error) return dbFailure('DELETE invite', error);
    return json({ data: revoked.data });
  } catch (error) {
    return dbFailure('DELETE /api/clubs/invites/[token]', error);
  }
}
