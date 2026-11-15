import { z } from 'zod';

import { requireUser } from '@/lib/api/requireUser';
import { fail, ok } from '@/lib/api/respond';
import { getLiveTrackingRuntime } from '@/features/compte/live-tracking/server/runtime';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const Id = z.string().trim().min(1).max(128);

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;

  const id = Id.safeParse((await params).id);
  if (!id.success) return fail('not_found', 'Lien introuvable.');

  const sessionId = new URL(request.url).searchParams.get('sessionId') ?? undefined;
  if (sessionId !== undefined && (sessionId.length === 0 || sessionId.length > 128)) {
    return fail('not_found', 'Séance introuvable.');
  }

  try {
    const result = await getLiveTrackingRuntime().revokeShareLink(auth.user.id, id.data, sessionId);
    if (!result.ok) {
      if (result.error === 'unauthorized') return fail('forbidden', 'Lien non autorisé.');
      return fail('not_found', 'Lien introuvable.');
    }
    return ok({ status: 'revoked' });
  } catch {
    return fail('server', 'Impossible de révoquer le lien.');
  }
}
