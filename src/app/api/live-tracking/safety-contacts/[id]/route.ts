import { z } from 'zod';

import { requireUser } from '@/lib/api/requireUser';
import { fail, ok } from '@/lib/api/respond';
import { getLiveTrackingRuntime } from '@/features/compte/live-tracking/server/runtime';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const Id = z.string().trim().min(1).max(128);
const Consent = z.object({ consentStatus: z.enum(['accepted', 'revoked']) }).strict();

function mapError(error: 'not_found' | 'unauthorized') {
  return error === 'unauthorized'
    ? fail('forbidden', 'Contact non autorisé.')
    : fail('not_found', 'Contact introuvable.');
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;

  const id = Id.safeParse((await params).id);
  if (!id.success) return fail('not_found', 'Contact introuvable.');
  const body = Consent.safeParse(await request.json().catch(() => null));
  if (!body.success) return fail('conflict', 'Consentement invalide.');

  try {
    const result = await getLiveTrackingRuntime().setContactConsent(
      auth.user.id,
      id.data,
      body.data.consentStatus
    );
    if (!result.ok) return mapError(result.error);
    return ok({ contact: result.contact });
  } catch {
    return fail('server', 'Impossible de mettre à jour le consentement.');
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;

  const id = Id.safeParse((await params).id);
  if (!id.success) return fail('not_found', 'Contact introuvable.');

  try {
    const result = await getLiveTrackingRuntime().removeContact(auth.user.id, id.data);
    if (!result.ok) return mapError(result.error);
    return ok({ status: 'deleted' });
  } catch {
    return fail('server', 'Impossible de supprimer ce contact.');
  }
}
