import type { NextRequest } from 'next/server';
import { handleLocalLegends } from '@/lib/leaderboards/api';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type SegmentRouteContext = {
  params: Promise<{ segmentId: string }> | { segmentId: string };
};

export async function GET(request: NextRequest, context: SegmentRouteContext) {
  const params = await context.params;
  return handleLocalLegends(request, params.segmentId);
}
