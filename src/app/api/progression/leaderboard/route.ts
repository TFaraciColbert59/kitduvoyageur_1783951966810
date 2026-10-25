import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { enforceRateLimit } from '@/lib/rate-limit/routes';
import {
  getTerritorialLeaderboard,
  type LeaderboardOptions,
} from '@/features/progression/server/progressionService';
import { TerritoryFilter } from '@/features/progression/domain/types';

export const dynamic = 'force-dynamic';

/**
 * Classement privé par utilisateur (le rang « moi » dépend de la session) :
 * cache navigateur court uniquement, jamais partagé.
 */
const LEADERBOARD_CACHE_HEADERS = {
  'Cache-Control': 'private, max-age=30, stale-while-revalidate=60',
  Vary: 'Cookie',
} as const;

const VALID_FILTERS: TerritoryFilter[] = ['around_me', 'city', 'region', 'country', 'world'];
const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function parseLimit(raw: string | null): number {
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) return DEFAULT_LIMIT;
  return Math.min(Math.floor(parsed), MAX_LIMIT);
}

function parseCursor(raw: string | null): LeaderboardOptions['cursor'] {
  if (!raw) return null;
  const separator = raw.indexOf(':');
  if (separator <= 0) return null;
  const points = Number(raw.slice(0, separator));
  const userId = raw.slice(separator + 1);
  if (!Number.isFinite(points) || points < 0) return null;
  if (!UUID_PATTERN.test(userId)) return null;
  return { points: Math.floor(points), userId };
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ success: false, error: 'unauthorized' }, { status: 401 });
    }

    // 60/min : protection de la RPC de rang ; le filtre 1 km conserve son
    // quota interne de 30/h (leaderboard_access_log, anti-triangulation).
    const limited = await enforceRateLimit(user.id, {
      scope: 'progression-leaderboard',
      limit: 60,
      windowMs: 60_000,
      failMode: 'closed',
    });
    if (limited) return limited;

    const { searchParams } = new URL(request.url);
    const filterParam = (searchParams.get('filter') || 'world') as TerritoryFilter;
    const filter: TerritoryFilter = VALID_FILTERS.includes(filterParam) ? filterParam : 'world';
    const limit = parseLimit(searchParams.get('limit'));
    const cursor = parseCursor(searchParams.get('cursor'));

    const leaderboard = await getTerritorialLeaderboard(user.id, filter, { limit, cursor });
    if (leaderboard.error === 'rate_limited') {
      return NextResponse.json({ success: false, error: 'rate_limited' }, { status: 429 });
    }
    return NextResponse.json(
      { success: true, leaderboard },
      { headers: LEADERBOARD_CACHE_HEADERS }
    );
  } catch (err) {
    const message = 'Erreur interne de classement'; console.error('[API /api/progression/leaderboard]', err);
    console.error('[API /api/progression/leaderboard] Error:', message);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
