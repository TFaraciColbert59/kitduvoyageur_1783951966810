import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { enforceRateLimit } from '@/lib/rate-limit/routes';
import { createBookingProvider } from '@/features/booking/server/bookingProvider';
import { bookingSearchRequestSchema } from '@/features/booking/server/bookingSchemas';
import {
  BOOKING_PROVIDER_ERROR_CODES,
  BookingProviderError,
} from '@/features/booking/server/bookingProviderErrors';

export const dynamic = 'force-dynamic';

const NO_STORE = { 'Cache-Control': 'no-store' } as const;
const MAX_BODY_BYTES = 32 * 1024;
const SEARCH_LIMIT = 30;
const SEARCH_WINDOW_MS = 10 * 60_000;

function json(body: unknown, status: number, headers: Record<string, string> = {}) {
  return NextResponse.json(body, { status, headers: { ...NO_STORE, ...headers } });
}

function statusForBookingError(error: BookingProviderError): number {
  switch (error.code) {
    case BOOKING_PROVIDER_ERROR_CODES.validation:
      return 400;
    case BOOKING_PROVIDER_ERROR_CODES.auth:
      return 502;
    case BOOKING_PROVIDER_ERROR_CODES.quota:
      return 429;
    case BOOKING_PROVIDER_ERROR_CODES.timeout:
      return 504;
    case BOOKING_PROVIDER_ERROR_CODES.unavailable:
    case BOOKING_PROVIDER_ERROR_CODES.config:
      return 503;
    case BOOKING_PROVIDER_ERROR_CODES.not_found:
      return 404;
    default:
      return 502;
  }
}

async function readJsonBody(request: NextRequest): Promise<unknown> {
  const declared = request.headers.get('content-length');
  if (declared && Number(declared) > MAX_BODY_BYTES) {
    throw new Error('payload_too_large');
  }
  if (typeof request.text !== 'function') return request.json();
  const text = await request.text();
  if (Buffer.byteLength(text, 'utf8') > MAX_BODY_BYTES) throw new Error('payload_too_large');
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new Error('payload_invalid_json');
  }
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return json({ error: 'unauthorized' }, 401);

  const limited = await enforceRateLimit(user.id, {
    scope: 'booking-search',
    limit: SEARCH_LIMIT,
    windowMs: SEARCH_WINDOW_MS,
    failMode: 'closed',
  });
  if (limited) {
    return json({ error: 'rate_limited' }, limited.status, Object.fromEntries(limited.headers.entries()));
  }

  let payload: unknown;
  try {
    payload = await readJsonBody(request);
  } catch (error) {
    const reason = error instanceof Error ? error.message : 'payload_invalid';
    return json({ error: reason === 'payload_too_large' ? 'payload_too_large' : 'invalid_request' }, reason === 'payload_too_large' ? 413 : 400);
  }

  const parsed = bookingSearchRequestSchema.safeParse(payload);
  if (!parsed.success) {
    return json({ error: 'invalid_request', fields: parsed.error.issues.map((issue) => issue.path.join('.')) }, 400);
  }

  try {
    const provider = createBookingProvider({ env: process.env });
    const result = await provider.search(parsed.data);
    return json({ success: true, data: result }, 200);
  } catch (error) {
    if (error instanceof BookingProviderError) {
      const status = statusForBookingError(error);
      if (status >= 500) console.error('[api/booking/search] provider error', { code: error.code, provider: error.provider });
      // Motif du fournisseur (refus, validation) : jamais pour la configuration (noms de variables).
      const detail =
        error.code === BOOKING_PROVIDER_ERROR_CODES.upstream || error.code === BOOKING_PROVIDER_ERROR_CODES.validation
          ? error.message.slice(0, 240)
          : undefined;
      return json({ error: 'booking_search_failed', code: error.code, retryable: error.retryable, ...(detail ? { detail } : {}) }, status);
    }
    console.error('[api/booking/search] unexpected error', error);
    return json({ error: 'booking_search_failed', code: 'unknown', retryable: true }, 502);
  }
}
