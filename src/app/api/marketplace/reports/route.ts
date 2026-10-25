import { NextRequest } from 'next/server';
import { reportSchema } from '@/features/marketplace/domain/validation';
import { mutate } from '@/features/marketplace/server/http';
export async function POST(req: NextRequest) {
  return mutate(
    req,
    reportSchema,
    'marketplace_report',
    (b) => ({ p_listing_id: b.listing_id, p_reason: b.reason }),
    'report',
    201
  );
}
