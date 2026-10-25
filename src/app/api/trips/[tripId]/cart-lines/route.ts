import { NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { enforceRateLimit } from '@/lib/rate-limit/routes';
import { cartTripIdSchema, addCartLineSchema } from '@/features/cart/schemas/cartSchemas';
import {
  cartJson,
  invalidRequest,
  readCartJsonBody,
  requireAuthenticatedUser,
  toCartErrorResponse,
} from '@/features/cart/server/cartHttp';
import { addTripCartLine, listTripCart } from '@/features/cart/server/cartService';

export const dynamic = 'force-dynamic';

type Params = { params: Promise<{ tripId: string }> };

const READ_LIMIT = 120;
const WRITE_LIMIT = 60;
const WINDOW_MS = 60_000;

/** GET /api/trips/:tripId/cart-lines — panier de l'utilisateur sur ce voyage. */
export async function GET(request: NextRequest, { params }: Params) {
  const scope = '[api/trips/[tripId]/cart-lines] GET';
  try {
    const supabase = await createClient();
    const userId = await requireAuthenticatedUser(supabase);

    const limited = await enforceRateLimit(userId, {
      scope: 'cart-read',
      limit: READ_LIMIT,
      windowMs: WINDOW_MS,
      failMode: 'open',
    });
    if (limited) return limited;

    const { tripId } = await params;
    const parsedTripId = cartTripIdSchema.safeParse(tripId);
    if (!parsedTripId.success) throw invalidRequest(['tripId']);

    const cart = await listTripCart({ supabase, userId, tripId: parsedTripId.data });
    return cartJson({ success: true, data: cart }, 200);
  } catch (error) {
    return toCartErrorResponse(error, scope);
  }
}

/** POST /api/trips/:tripId/cart-lines — ajoute (ou fusionne) une ligne. */
export async function POST(request: NextRequest, { params }: Params) {
  const scope = '[api/trips/[tripId]/cart-lines] POST';
  try {
    const supabase = await createClient();
    const userId = await requireAuthenticatedUser(supabase);

    const limited = await enforceRateLimit(userId, {
      scope: 'cart-write',
      limit: WRITE_LIMIT,
      windowMs: WINDOW_MS,
      failMode: 'closed',
    });
    if (limited) return limited;

    const { tripId } = await params;
    const parsedTripId = cartTripIdSchema.safeParse(tripId);
    if (!parsedTripId.success) throw invalidRequest(['tripId']);

    const body = await readCartJsonBody(request);
    const parsedBody = addCartLineSchema.safeParse(body);
    if (!parsedBody.success) {
      throw invalidRequest(parsedBody.error.issues.map((issue) => issue.path.join('.')));
    }

    const result = await addTripCartLine(
      { supabase, userId, tripId: parsedTripId.data },
      parsedBody.data
    );
    return cartJson(
      { success: true, data: result.line, created: result.created, deduplicated: result.deduplicated },
      result.created ? 201 : 200
    );
  } catch (error) {
    return toCartErrorResponse(error, scope);
  }
}
