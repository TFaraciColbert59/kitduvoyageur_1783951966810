import { z } from 'zod';

import { requireUser } from '@/lib/api/requireUser';
import { fail, ok } from '@/lib/api/respond';
import {
  DEFAULT_SHARE_DURATION_MINUTES,
  getLiveTrackingRuntime,
} from '@/features/compte/live-tracking/server/runtime';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const Query = z.object({
  sessionId: z.string().trim().min(1).max(128).optional(),
});

const Create = z
  .object({
    sessionId: z.string().trim().min(1).max(128),
    durationMinutes: z
      .number()
      .int()
      .min(5)
      .max(72 * 60)
      .default(DEFAULT_SHARE_DURATION_MINUTES),
    label: z.string().trim().max(80).optional(),
    includeTrail: z.boolean().optional(),
  })
  .strict();

export async function GET(request: Request) {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;

  const parsed = Query.safeParse({
    sessionId: new URL(request.url).searchParams.get('sessionId') ?? undefined,
  });
  if (!parsed.success) return fail('not_found', 'Séance introuvable.');

  try {
    return ok({
      links: await getLiveTrackingRuntime().listLinks(auth.user.id, parsed.data.sessionId),
    });
  } catch {
    return fail('server', 'Impossible de charger les liens de partage.');
  }
}

export async function POST(request: Request) {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;

  const body = Create.safeParse(await request.json().catch(() => null));
  if (!body.success) return fail('conflict', 'Paramètres de partage invalides.');

  try {
    const result = await getLiveTrackingRuntime().createShareLink(auth.user.id, body.data);
    if (!result.ok) {
      if (result.error === 'unauthorized') return fail('forbidden', 'Séance non autorisée.');
      if (result.error === 'invalid_duration') {
        return fail('conflict', 'La durée doit être comprise entre 5 minutes et 72 heures.');
      }
      if (result.error === 'privacy_denied') {
        return fail('forbidden', 'Le partage est refusé par tes réglages de confidentialité.');
      }
      return fail('conflict', 'La séance n’est plus active.');
    }
    return ok(result.link, 201);
  } catch {
    return fail('server', 'Impossible de créer le lien de partage.');
  }
}
