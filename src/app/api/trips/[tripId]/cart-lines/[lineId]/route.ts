import { NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { enforceRateLimit } from '@/lib/rate-limit/routes';
import {
  cartLineIdSchema,
  cartTripIdSchema,
  updateCartLineSchema,
} from '@/features/cart/schemas/cartSchemas';
import {
  cartJson,
  invalidRequest,
  readCartJsonBody,
  requireAuthenticatedUser,
  toCartErrorResponse,
} from '@/features/cart/server/cartHttp';
import { removeTripCartLine, updateTripCartLine } from '@/features/cart/server/cartService';

export const dynamic = 'force-dynamic';

type RawParams = Promise<{ tripId: string; lineId: string }>;
type Params = { params: RawParams };

const WRITE_LIMIT = 60;
const WINDOW_MS = 60_000;

async function resolveParams(params: RawParams) {
  const { tripId, lineId } = await params;
  const parsedTripId = cartTripIdSchema.safeParse(tripId);
  if (!parsedTripId.success) throw invalidRequest(['tripId']);
  const parsedLineId = cartLineIdSchema.safeParse(lineId);
  if (!parsedLineId.success) throw invalidRequest(['lineId']);
  return { tripId: parsedTripId.data, lineId: parsedLineId.data };
}

/** PATCH /api/trips/:tripId/cart-lines/:lineId — quantité et/ou libellés. */
export async function PATCH(request: NextRequest, { params }: Params) {
  const scope = '[api/trips/[tripId]/cart-lines/[lineId]] PATCH';
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

    const { tripId, lineId } = await resolveParams(params);
    const body = await readCartJsonBody(request);
    const parsedBody = updateCartLineSchema.safeParse(body);
    if (!parsedBody.success) {
      throw invalidRequest(parsedBody.error.issues.map((issue) => issue.path.join('.')));
    }

    const line = await updateTripCartLine({ supabase, userId, tripId }, lineId, parsedBody.data);
    return cartJson({ success: true, data: line }, 200);
  } catch (error) {
    return toCartErrorResponse(error, scope);
  }
}

/** DELETE /api/trips/:tripId/cart-lines/:lineId — retrait de la ligne. */
export async function DELETE(_request: NextRequest, { params }: Params) {
  const scope = '[api/trips/[tripId]/cart-lines/[lineId]] DELETE';
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

    const { tripId, lineId } = await resolveParams(params);
    const removed = await removeTripCartLine({ supabase, userId, tripId }, lineId);
    return cartJson({ success: true, data: removed }, 200);
  } catch (error) {
    return toCartErrorResponse(error, scope);
  }
}
