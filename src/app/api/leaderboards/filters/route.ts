import type { NextRequest } from 'next/server';
import { handleFilters } from '@/lib/leaderboards/api';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  return handleFilters(request);
}
