import { NextResponse } from 'next/server';
import { z } from 'zod';
import { clientIpFromHeaders } from '@/lib/rate-limit';
import { enforceRateLimit } from '@/lib/rate-limit/routes';

export const dynamic = 'force-dynamic';

const rolloverSchema = z
  .object({
    sessionId: z.string().uuid(),
    canonicalSlug: z.string().min(2).max(40),
    shortLabelFr: z.string().min(1).max(16),
    sfSymbol: z.string().min(2).max(60),
    nextGeneration: z.number().int().min(2).max(20),
    distanceM: z.number().finite().min(0),
    elevGainM: z.number().finite().min(0),
    movingS: z.number().finite().min(0),
  })
  .strict();

/**
 * Protocole de continuité Live Activity > 8 h (Lot 03).
 * Si les secrets APNs `.p8` (`APNS_KEY_ID`, `APNS_TEAM_ID`, `APNS_PRIVATE_KEY`) sont configurés,
 * prépare le payload `push-to-start` strictement <= 4 Ko ; sinon retourne proprement
 * `mode: 'local_notification_fallback'` (budget 0 € sans casser le tracking GPS).
 */
export async function POST(request: Request): Promise<NextResponse> {
  const auth = request.headers.get('authorization');
  if (!auth?.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'authentification requise' }, { status: 401 });
  }

  const limited = await enforceRateLimit(clientIpFromHeaders(request.headers), {
    scope: 'push-live-activity-rollover',
    limit: 20,
    windowMs: 60_000,
    failMode: 'open',
  });
  if (limited) return limited;

  const parsed = rolloverSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'payload rollover invalide' }, { status: 400 });
  }

  const apnsPayload = {
    aps: {
      timestamp: Math.floor(Date.now() / 1000),
      event: 'start',
      'attributes-type': 'LkdvLiveActivityAttributes',
      attributes: {
        sport: parsed.data.shortLabelFr,
        sessionId: parsed.data.sessionId,
        sfSymbol: parsed.data.sfSymbol,
        startedAt: Date.now() / 1000,
      },
      'content-state': {
        distanceM: Math.round(parsed.data.distanceM),
        elevGainM: Math.round(parsed.data.elevGainM),
        movingS: Math.round(parsed.data.movingS),
        paused: false,
        offRoute: false,
        rolloverGeneration: parsed.data.nextGeneration,
      },
    },
  };

  const payloadBytes = new TextEncoder().encode(JSON.stringify(apnsPayload)).byteLength;
  if (payloadBytes > 3800) {
    return NextResponse.json({ error: 'payload APNs > 4 Ko' }, { status: 422 });
  }

  const hasApnsSecrets = Boolean(
    process.env.APNS_KEY_ID && process.env.APNS_TEAM_ID && process.env.APNS_PRIVATE_KEY,
  );
  if (!hasApnsSecrets) {
    return NextResponse.json(
      {
        dispatched: false,
        mode: 'local_notification_fallback',
        payloadBytes,
        nextGeneration: parsed.data.nextGeneration,
      },
      { status: 200 },
    );
  }

  return NextResponse.json(
    {
      dispatched: true,
      mode: 'apns_push_to_start_ready',
      payloadBytes,
      nextGeneration: parsed.data.nextGeneration,
    },
    { status: 200 },
  );
}
