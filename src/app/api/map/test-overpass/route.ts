import { NextRequest, NextResponse } from 'next/server';
import { testOverpassConnectivity } from '@/lib/overpass';

export const maxDuration = 30;

/**
 * GET /api/map/test-overpass
 * Diagnostic endpoint: tests connectivity to all Overpass API endpoints
 * and returns which ones are reachable from this server.
 */
export async function GET(_request: NextRequest) {
  const result = await testOverpassConnectivity();

  return NextResponse.json({
    ...result,
    timestamp: new Date().toISOString(),
    message: result.success
      ? `✅ Overpass API reachable via ${result.endpoint} (${result.latencyMs}ms)`
      : '❌ All Overpass endpoints unreachable from this server',
  });
}
