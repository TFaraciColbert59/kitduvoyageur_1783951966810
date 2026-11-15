import { z } from 'zod';
import { requireUser } from '@/lib/api/requireUser';
import { fail, ok } from '@/lib/api/respond';
import {
  createDeveloperWebhook,
  listDeveloperWebhooks,
  revokeDeveloperWebhook,
} from '@/features/offers/server/developerStore';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const EVENT_TYPES = [
  'activity.created',
  'activity.updated',
  'activity.deleted',
  'route.updated',
  'consent.revoked',
] as const;

const CreateWebhookSchema = z
  .object({
    callbackUrl: z.string().trim().url().max(300),
    events: z.array(z.enum(EVENT_TYPES)).min(1).max(5),
  })
  .strict();

const RevokeWebhookSchema = z
  .object({
    id: z.string().trim().min(1).max(64),
  })
  .strict();

export async function GET() {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;
  return ok({ webhooks: listDeveloperWebhooks(auth.user.id) });
}

export async function POST(request: Request) {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;

  const parsed = CreateWebhookSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return fail('conflict', 'Configuration webhook invalide.');
  }

  const created = createDeveloperWebhook({
    userId: auth.user.id,
    callbackUrl: parsed.data.callbackUrl,
    events: parsed.data.events,
  });

  if (!created.ok) {
    return fail('conflict', created.message);
  }
  return ok({
    subscription: created.subscription,
    signingSecret: created.signingSecret,
  });
}

export async function DELETE(request: Request) {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;

  const parsed = RevokeWebhookSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return fail('conflict', 'Identifiant webhook requis.');
  }

  const revoked = revokeDeveloperWebhook(auth.user.id, parsed.data.id);
  if (!revoked) {
    return fail('not_found', 'Abonnement webhook introuvable.');
  }
  return ok({ subscription: revoked });
}
