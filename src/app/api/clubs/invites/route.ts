import { NextRequest } from 'next/server';
import { z } from 'zod';

import { createClient } from '@/lib/supabase/server';
import { createInviteLink, type InviteLink } from '@/features/clubs';
import {
  csrfFailure,
  dbFailure,
  errorJson,
  hasValidOrigin,
  isUuid,
  json,
  optionalUser,
  readJson,
} from '../_lib/http';
import { loadViewerContext } from '../_lib/db';
import { loadClubBundle, isManager } from '../_lib/db';
import { asArray, mapInviteRow, type Row } from '../_lib/mappers';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const createSchema = z
  .object({
    kind: z.enum(['club', 'event', 'recorded_activity']),
    targetId: z.string().trim().min(1).max(120),
    clubId: z.string().uuid().nullish(),
    expiresInDays: z.number().int().min(1).max(365).nullish(),
    maxUses: z.number().int().min(1).max(10_000).nullish(),
  })
  .strict();

function baseUrl(request: NextRequest): string {
  const configured = process.env.NEXT_PUBLIC_SITE_URL ?? process.env.NEXT_PUBLIC_APP_URL;
  if (configured) return configured.replace(/\/+$/, '');
  return request.nextUrl.origin;
}

/** GET — liens d’invitation d’un club (créateur ou modérateur). */
export async function GET(request: NextRequest) {
  const clubId = request.nextUrl.searchParams.get('clubId');
  if (!clubId || !isUuid(clubId)) return errorJson('invalid_body', 400);

  try {
    const supabase = await createClient();
    const user = await optionalUser(supabase);
    if (!user) return errorJson('unauthenticated', 401);
    const bundle = await loadClubBundle(supabase, clubId, user.id);
    if (!bundle) return errorJson('not_found', 404);

    const { data, error } = await supabase
      .from('club_invites')
      .select('*')
      .eq('club_id', clubId)
      .order('created_at', { ascending: false })
      .limit(100);
    if (error) return dbFailure('GET invites', error);

    const invites = asArray<Row>(data).map(mapInviteRow).filter(
      (invite) => invite.createdBy === user.id || isManager(bundle),
    );
    return json({ data: invites });
  } catch (error) {
    return dbFailure('GET /api/clubs/invites', error);
  }
}

/** POST — créer un lien/QR (club, sortie ou trace enregistrée). */
export async function POST(request: NextRequest) {
  if (!hasValidOrigin(request)) return csrfFailure();

  try {
    const supabase = await createClient();
    const user = await optionalUser(supabase);
    if (!user) return errorJson('unauthenticated', 401);

    const parsed = createSchema.safeParse(await readJson(request));
    if (!parsed.success) return errorJson('invalid_body', 400, parsed.error.flatten());
    const input = parsed.data;

    if (input.clubId && !isUuid(input.clubId)) return errorJson('invalid_body', 400);
    const { memberships } = await loadViewerContext(supabase, user.id);
    const nowIso = new Date().toISOString();
    const token = crypto.randomUUID();
    const inviteId = crypto.randomUUID();
    const expiresAt =
      input.expiresInDays == null
        ? null
        : new Date(Date.parse(nowIso) + input.expiresInDays * 24 * 60 * 60 * 1000).toISOString();

    const created = createInviteLink({
      id: inviteId,
      token,
      kind: input.kind,
      targetId: input.targetId,
      clubId: input.clubId ?? null,
      actorUserId: user.id,
      memberships,
      baseUrl: baseUrl(request),
      expiresAt,
      maxUses: input.maxUses ?? null,
      nowIso,
    });
    if (!created.ok) {
      return json({ error: created.error, message: created.message }, 400);
    }

    const { error } = await supabase.from('club_invites').insert({
      id: created.data.id,
      token: created.data.token,
      kind: created.data.kind,
      target_id: created.data.targetId,
      club_id: created.data.clubId,
      created_by: user.id,
      expires_at: created.data.expiresAt,
      max_uses: created.data.maxUses,
      uses_count: 0,
      share_url: created.data.shareUrl,
      qr_payload: created.data.qrPayload,
    });
    if (error) return dbFailure('POST invite', error);

    const invite: InviteLink = created.data;
    return json({ data: invite }, 201);
  } catch (error) {
    return dbFailure('POST /api/clubs/invites', error);
  }
}
