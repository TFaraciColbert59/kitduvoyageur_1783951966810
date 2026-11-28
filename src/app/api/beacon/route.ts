import { NextResponse } from 'next/server';
import { z } from 'zod';
import { clientIpFromHeaders } from '@/lib/rate-limit';
import { enforceRateLimit } from '@/lib/rate-limit/routes';

export const dynamic = 'force-dynamic';

const createBeaconSchema = z
  .object({
    sessionId: z.string().uuid(),
    scope: z.enum(['guest_link', 'trip_members', 'carnet_followers', 'club_group']).default('guest_link'),
    tripId: z.string().uuid().nullable().optional(),
    carnetId: z.string().uuid().nullable().optional(),
    clubEventId: z.string().uuid().nullable().optional(),
    ttlHours: z.number().int().min(1).max(72).default(24),
  })
  .strict();

const pingBeaconSchema = z
  .object({
    beaconId: z.string().uuid(),
    lat: z.number().min(-90).max(90),
    lng: z.number().min(-180).max(180),
    altM: z.number().min(-500).max(9000).nullable().optional(),
    batteryPct: z.number().int().min(0).max(100).nullable().optional(),
    status: z.enum(['active', 'paused', 'ended', 'revoked']).default('active'),
  })
  .strict();

async function sha256Hex(raw: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(raw));
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function generateShareToken(): string {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Lot 05 — Beacon Temps Réel Unifié (remplace le store in-memory `live-tracking`).
 * Persiste le bail dans `public.live_beacons` (RLS propriétaire) et renvoie le nom
 * du canal Supabase Realtime Broadcast `beacon:<share_token_hash>` (`0 €` surcoût
 * dans le quota 5 M messages Pro, vs Durable Objects).
 */
export async function POST(request: Request): Promise<NextResponse> {
  const auth = request.headers.get('authorization');
  if (!auth?.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'authentification requise' }, { status: 401 });
  }
  const limited = await enforceRateLimit(clientIpFromHeaders(request.headers), {
    scope: 'explorer-unified-beacon-create',
    limit: 20,
    windowMs: 60_000,
    failMode: 'open',
  });
  if (limited) return limited;

  const parsed = createBeaconSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'paramètres beacon invalides' }, { status: 400 });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) return NextResponse.json({ error: 'configuration absente' }, { status: 503 });

  const shareToken = generateShareToken();
  const shareTokenHash = await sha256Hex(shareToken);
  const expiresAt = new Date(Date.now() + parsed.data.ttlHours * 3600_000).toISOString();

  try {
    const res = await fetch(`${url.replace(/\/$/, '')}/rest/v1/live_beacons`, {
      method: 'POST',
      headers: {
        apikey: anon,
        Authorization: auth,
        'Content-Type': 'application/json',
        Prefer: 'return=representation',
      },
      body: JSON.stringify({
        session_id: parsed.data.sessionId,
        share_token_hash: shareTokenHash,
        scope: parsed.data.scope,
        trip_id: parsed.data.tripId ?? null,
        carnet_id: parsed.data.carnetId ?? null,
        club_event_id: parsed.data.clubEventId ?? null,
        status: 'active',
        expires_at: expiresAt,
      }),
    });
    if (!res.ok) {
      return NextResponse.json({ error: 'création beacon refusée' }, { status: res.status === 401 ? 401 : 503 });
    }
    const rows = (await res.json()) as Array<{ beacon_id: string }>;
    return NextResponse.json(
      {
        beaconId: rows[0]?.beacon_id ?? null,
        shareToken,
        sharePath: `/live/${shareToken}`,
        realtimeChannel: `beacon:${shareTokenHash}`,
        pingIntervalS: 30,
        expiresAt,
      },
      { status: 201 },
    );
  } catch {
    return NextResponse.json({ error: 'indisponible' }, { status: 503 });
  }
}

export async function PATCH(request: Request): Promise<NextResponse> {
  const auth = request.headers.get('authorization');
  if (!auth?.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'authentification requise' }, { status: 401 });
  }
  const parsed = pingBeaconSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'ping beacon invalide' }, { status: 400 });
  }
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) return NextResponse.json({ error: 'configuration absente' }, { status: 503 });

  const patch: Record<string, unknown> = {
    last_lat: parsed.data.lat,
    last_lng: parsed.data.lng,
    last_alt_m: parsed.data.altM ?? null,
    last_battery_pct: parsed.data.batteryPct ?? null,
    last_ping_at: new Date().toISOString(),
    status: parsed.data.status,
  };
  if (parsed.data.status === 'revoked') {
    patch.revoked_at = new Date().toISOString();
  }

  const res = await fetch(
    `${url.replace(/\/$/, '')}/rest/v1/live_beacons?beacon_id=eq.${encodeURIComponent(parsed.data.beaconId)}`,
    {
      method: 'PATCH',
      headers: {
        apikey: anon,
        Authorization: auth,
        'Content-Type': 'application/json',
        Prefer: 'return=minimal',
      },
      body: JSON.stringify(patch),
    },
  );
  if (!res.ok) {
    return NextResponse.json({ error: 'mise à jour beacon refusée' }, { status: res.status === 401 ? 401 : 503 });
  }
  return NextResponse.json({ ok: true, status: parsed.data.status }, { status: 200 });
}
