import { z } from 'zod';
import { NextRequest, NextResponse } from 'next/server';
import { mutate, authenticatedRead, errorResponse } from '@/features/marketplace/server/http';
const schema = z
  .object({
    action: z.enum(['hide', 'resolve_dispute', 'dismiss_report']),
    listing_id: z.string().uuid().optional(),
    transaction_id: z.string().uuid().optional(),
    report_id: z.string().uuid().optional(),
    note: z.string().trim().min(10).max(2000),
    resolution: z.enum(['completed', 'cancelled']).optional(),
  })
  .strict()
  .refine(
    (b) =>
      b.action === 'hide'
        ? !!b.listing_id
        : b.action === 'dismiss_report'
          ? !!b.report_id
          : !!b.transaction_id && !!b.resolution,
    'Cible et résolution requises'
  );
export async function POST(req: NextRequest) {
  return mutate(
    req,
    schema,
    'marketplace_moderate',
    (b) => ({
      p_action: b.action,
      p_listing_id: b.listing_id ?? null,
      p_transaction_id: b.transaction_id ?? null,
      p_report_id: b.report_id ?? null,
      p_note: b.note,
      p_resolution: b.resolution ?? null,
    }),
    'result'
  );
}
export async function GET() {
  return authenticatedRead(async (db) => {
    const { data, error } = await db.rpc('marketplace_moderation');
    return error
      ? errorResponse(error)
      : NextResponse.json(data, { headers: { 'Cache-Control': 'no-store' } });
  });
}
