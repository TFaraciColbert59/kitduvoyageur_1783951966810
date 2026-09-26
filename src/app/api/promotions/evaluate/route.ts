import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { enforceRateLimit } from '@/lib/rate-limit/routes';
import { evaluatePromotionRequestSchema } from '@/features/promotions/server/promotionSchemas';
import {
  evaluateModelPromotion,
  PROMOTION_ERROR_CODES,
  PromotionError,
} from '@/features/promotions/server/promotionService';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const NO_STORE = { 'Cache-Control': 'no-store' } as const;
const MAX_BODY_BYTES = 32 * 1024;
const EVALUATE_LIMIT = 20;
const EVALUATE_WINDOW_MS = 10 * 60_000;

function json(body: unknown, status: number, headers: Record<string, string> = {}) {
  return NextResponse.json(body, { status, headers: { ...NO_STORE, ...headers } });
}

function statusForPromotionError(error: PromotionError): number {
  switch (error.code) {
    case PROMOTION_ERROR_CODES.validation:
      return 400;
    case PROMOTION_ERROR_CODES.forbidden:
      return 403;
    case PROMOTION_ERROR_CODES.conflict:
      return 409;
    case PROMOTION_ERROR_CODES.unavailable:
      return 503;
    default:
      return 500;
  }
}

async function readJsonBody(request: NextRequest): Promise<unknown> {
  const declared = request.headers.get('content-length');
  if (declared && Number(declared) > MAX_BODY_BYTES) throw new Error('payload_too_large');
  if (typeof request.text !== 'function') return request.json();
  const text = await request.text();
  if (Buffer.byteLength(text, 'utf8') > MAX_BODY_BYTES) throw new Error('payload_too_large');
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new Error('payload_invalid_json');
  }
}

/**
 * POST /api/promotions/evaluate
 * Evalue (etoptionnellement promeut) une version de modele.
 *
 * L'autorisation n'est pas seulement ici : la RPC SQL exige `is_admin()` ou
 * `service_role`. Cette route fournit la couche HTTP (401 / 403 explicite,
 * quota, validation) sans jamais divulguer de detail interne.
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return json({ error: 'unauthorized' }, 401);

  const limited = await enforceRateLimit(user.id, {
    scope: 'promotion-evaluate',
    limit: EVALUATE_LIMIT,
    windowMs: EVALUATE_WINDOW_MS,
    failMode: 'closed',
  });
  if (limited) {
    return json(
      { error: 'rate_limited' },
      limited.status,
      Object.fromEntries(limited.headers.entries())
    );
  }

  let payload: unknown;
  try {
    payload = await readJsonBody(request);
  } catch (error) {
    const reason = error instanceof Error ? error.message : 'payload_invalid';
    return json(
      { error: reason === 'payload_too_large' ? 'payload_too_large' : 'invalid_request' },
      reason === 'payload_too_large' ? 413 : 400
    );
  }

  const parsed = evaluatePromotionRequestSchema.safeParse(payload);
  if (!parsed.success) {
    return json(
      {
        error: 'invalid_request',
        fields: parsed.error.issues.map((issue) => issue.path.join('.')),
      },
      400
    );
  }

  try {
    const outcome = await evaluateModelPromotion(supabase, parsed.data);
    return json({ success: true, data: outcome }, 200);
  } catch (error) {
    if (error instanceof PromotionError) {
      const status = statusForPromotionError(error);
      if (status >= 500) {
        console.error('[api/promotions/evaluate] failure', { code: error.code });
      }
      return json({ error: 'promotion_failed', code: error.code, retryable: error.retryable }, status);
    }
    console.error('[api/promotions/evaluate] unexpected error');
    return json({ error: 'promotion_failed', code: 'unknown', retryable: true }, 500);
  }
}