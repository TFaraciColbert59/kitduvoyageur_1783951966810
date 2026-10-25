import { NextRequest, NextResponse } from 'next/server';
import { requestSchema } from '@/features/marketplace/domain/validation';
import { mutate, authenticatedRead, errorResponse } from '@/features/marketplace/server/http';
export async function POST(req: NextRequest) {
  return mutate(
    req,
    requestSchema,
    'marketplace_request',
    (b) => ({
      p_listing_id: b.listing_id,
      p_start_date: b.start_date ?? null,
      p_end_date: b.end_date ?? null,
    }),
    'transaction',
    201
  );
}
export async function GET() {
  return authenticatedRead(async (db) => {
    const { data, error } = await db
      .from('marketplace_transactions')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100);
    return error
      ? errorResponse(error)
      : NextResponse.json(
          { transactions: data ?? [] },
          { headers: { 'Cache-Control': 'no-store' } }
        );
  });
}
