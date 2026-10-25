import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { enforceRateLimit } from '@/lib/rate-limit/routes';
import {
  bookingCreateSchema,
  canEditTrip,
  insertBooking,
  listBookings,
  type BookingStore,
} from '@/features/booking/server/bookingPersistence';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET  /api/trips/[tripId]/bookings — liste les réservations du voyage.
 * POST /api/trips/[tripId]/bookings — crée une réservation `pending`.
 *
 * Authentification Supabase requise, `can_edit_trip` vérifié côté serveur,
 * corps et réponses `no-store`, aucun secret stocké ni renvoyé.
 */

const NO_STORE = { 'Cache-Control': 'no-store' } as const;
const MAX_BODY_BYTES = 32 * 1024;
const TRIP_ID_UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const WRITE_LIMIT = 30;
const WRITE_WINDOW_MS = 10 * 60_000;

function json(body: unknown, status: number, headers: Record<string, string> = {}) {
  return NextResponse.json(body, { status, headers: { ...NO_STORE, ...headers } });
}

type Gate =
  | { ok: true; store: BookingStore; userId: string }
  | { ok: false; response: NextResponse };

async function requireTripEditor(tripId: string): Promise<Gate> {
  const client = await createClient();
  const {
    data: { user },
  } = await client.auth.getUser();
  if (!user) return { ok: false, response: json({ error: 'unauthorized' }, 401) };

  const store = client as unknown as BookingStore;
  const allowed = await canEditTrip(store, tripId);
  if (!allowed) return { ok: false, response: json({ error: 'forbidden' }, 403) };

  return { ok: true, store, userId: user.id };
}

async function readJsonBody(request: NextRequest): Promise<unknown> {
  const declared = request.headers.get('content-length');
  if (declared && Number(declared) > MAX_BODY_BYTES) throw new Error('payload_too_large');
  const text = await request.text();
  if (Buffer.byteLength(text, 'utf8') > MAX_BODY_BYTES) throw new Error('payload_too_large');
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new Error('payload_invalid_json');
  }
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ tripId: string }> }
) {
  const { tripId } = await params;
  if (!TRIP_ID_UUID.test(tripId)) return json({ error: 'invalid_trip' }, 400);

  const gate = await requireTripEditor(tripId);
  if (!gate.ok) return gate.response;

  const result = await listBookings(gate.store, tripId);
  if (result.error) {
    console.error('[api/trips/bookings] list failed', { code: result.error.code });
    return json({ error: 'bookings_unavailable' }, result.error.status);
  }
  return json({ success: true, data: result.data }, 200);
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ tripId: string }> }
) {
  const { tripId } = await params;
  if (!TRIP_ID_UUID.test(tripId)) return json({ error: 'invalid_trip' }, 400);

  const gate = await requireTripEditor(tripId);
  if (!gate.ok) return gate.response;

  const limited = await enforceRateLimit(gate.userId, {
    scope: 'booking-write',
    limit: WRITE_LIMIT,
    windowMs: WRITE_WINDOW_MS,
    failMode: 'closed',
  });
  if (limited) return limited;

  let payload: unknown;
  try {
    payload = await readJsonBody(request);
  } catch (error) {
    const reason = error instanceof Error ? error.message : 'payload_invalid';
    const tooLarge = reason === 'payload_too_large';
    return json({ error: tooLarge ? 'payload_too_large' : 'invalid_request' }, tooLarge ? 413 : 400);
  }

  const parsed = bookingCreateSchema.safeParse(payload);
  if (!parsed.success) {
    return json(
      { error: 'invalid_request', fields: parsed.error.issues.map((issue) => issue.path.join('.')) },
      400
    );
  }

  const result = await insertBooking(gate.store, {
    tripId,
    userId: gate.userId,
    payload: parsed.data,
  });
  if (result.error) {
    console.error('[api/trips/bookings] insert failed', {
      code: result.error.code,
      status: result.error.status,
    });
    return json({ error: 'booking_create_failed' }, result.error.status);
  }
  return json({ success: true, data: result.data }, 201);
}
