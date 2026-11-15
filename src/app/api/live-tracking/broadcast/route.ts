import { z } from 'zod';

import { requireUser } from '@/lib/api/requireUser';
import { fail, ok } from '@/lib/api/respond';
import { getLiveTrackingRuntime } from '@/features/compte/live-tracking/server/runtime';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const Body = z
  .object({
    sessionId: z.string().trim().min(1).max(128),
    event: z.enum(['live_share_started', 'live_share_stopped', 'safety_ping']),
    shareUrl: z.string().url().max(2048).optional(),
    targetContactIds: z.array(z.string().trim().min(1).max(128)).max(5).optional(),
  })
  .strict();

export async function POST(request: Request) {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;

  const body = Body.safeParse(await request.json().catch(() => null));
  if (!body.success) return fail('conflict', 'Notification invalide.');

  try {
    if (body.data.shareUrl) {
      let url: URL;
      try {
        url = new URL(body.data.shareUrl);
      } catch {
        return fail('conflict', 'Lien de partage invalide.');
      }
      if (url.protocol !== 'https:' && url.hostname !== 'localhost') {
        return fail('conflict', 'Lien de partage invalide.');
      }
    }

    const result = await getLiveTrackingRuntime().broadcast(auth.user.id, body.data);
    if (!result.ok) return fail('not_found', 'Séance introuvable.');
    return ok(result.result);
  } catch {
    return fail('server', 'Impossible de prévenir les contacts de sécurité.');
  }
}
