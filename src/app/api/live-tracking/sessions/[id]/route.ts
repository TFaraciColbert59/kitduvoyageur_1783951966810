import { z } from 'zod';

import { requireUser } from '@/lib/api/requireUser';
import { fail, ok } from '@/lib/api/respond';
import { getLiveTrackingRuntime } from '@/features/compte/live-tracking/server/runtime';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const Id = z.string().trim().min(1).max(128);
const Update = z.object({ status: z.enum(['active', 'paused', 'ended']) }).strict();

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;

  const id = Id.safeParse((await params).id);
  if (!id.success) return fail('not_found', 'Séance introuvable.');
  const body = Update.safeParse(await request.json().catch(() => null));
  if (!body.success) return fail('conflict', 'Statut de séance invalide.');

  try {
    const result = await getLiveTrackingRuntime().setSessionStatus(
      auth.user.id,
      id.data,
      body.data.status
    );
    if (!result.ok) {
      if (result.error === 'unauthorized') return fail('forbidden', 'Séance non autorisée.');
      return fail('not_found', 'Séance introuvable.');
    }
    return ok({ session: result.session });
  } catch {
    return fail('server', 'Impossible de modifier la séance.');
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;

  const id = Id.safeParse((await params).id);
  if (!id.success) return fail('not_found', 'Séance introuvable.');

  try {
    const result = await getLiveTrackingRuntime().endSession(auth.user.id, id.data);
    if (!result.ok) {
      if (result.error === 'unauthorized') return fail('forbidden', 'Séance non autorisée.');
      return fail('not_found', 'Séance introuvable.');
    }
    return ok({ status: 'ended' });
  } catch {
    return fail('server', 'Impossible de terminer la séance.');
  }
}
