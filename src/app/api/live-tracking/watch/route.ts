import { z } from 'zod';

import { requireUser } from '@/lib/api/requireUser';
import { fail, ok } from '@/lib/api/respond';
import { getLiveTrackingRuntime } from '@/features/compte/live-tracking/server/runtime';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const Device = z
  .object({
    deviceId: z.string().trim().min(1).max(128),
    platform: z.enum(['apple_watch', 'wear_os']),
    osVersion: z.string().trim().min(1).max(32),
    appVersion: z.string().trim().min(1).max(32),
    isPaired: z.boolean(),
    hasLocationPermission: z.boolean(),
    hasBackgroundPermission: z.boolean(),
  })
  .strict();

const Command = z.discriminatedUnion('type', [
  z
    .object({
      type: z.literal('start_live_share'),
      sessionId: z.string().trim().min(1).max(128),
      ownerUserId: z.string().trim().min(1).max(128),
      durationMinutes: z
        .number()
        .int()
        .min(5)
        .max(72 * 60),
      notifySafetyContacts: z.boolean().optional(),
    })
    .strict(),
  z
    .object({
      type: z.literal('stop_live_share'),
      sessionId: z.string().trim().min(1).max(128),
      ownerUserId: z.string().trim().min(1).max(128),
      tokenId: z.string().trim().min(1).max(128).optional(),
    })
    .strict(),
  z
    .object({
      type: z.literal('sync_status'),
      sessionId: z.string().trim().min(1).max(128),
      ownerUserId: z.string().trim().min(1).max(128),
    })
    .strict(),
]);

const Body = z.object({ device: Device, command: Command }).strict();

export async function POST(request: Request) {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;

  const body = Body.safeParse(await request.json().catch(() => null));
  if (!body.success) return fail('conflict', 'Commande montre invalide.');
  if (body.data.command.ownerUserId !== auth.user.id) {
    return fail('forbidden', 'Commande non autorisée.');
  }

  try {
    const result = await getLiveTrackingRuntime().handleWatchCommand(
      auth.user.id,
      body.data.device,
      body.data.command
    );
    return ok(result);
  } catch {
    return fail('server', 'Impossible de traiter la commande de la montre.');
  }
}
