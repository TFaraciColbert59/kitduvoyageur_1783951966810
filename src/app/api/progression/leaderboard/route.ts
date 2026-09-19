import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getTerritorialLeaderboard } from '@/features/progression/server/progressionService';
import { TerritoryFilter } from '@/features/progression/domain/types';

export const dynamic = 'force-dynamic';

const VALID_FILTERS: TerritoryFilter[] = ['around_me', 'city', 'region', 'country', 'world'];

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ success: false, error: 'unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const filterParam = (searchParams.get('filter') || 'world') as TerritoryFilter;
    const filter: TerritoryFilter = VALID_FILTERS.includes(filterParam) ? filterParam : 'world';

    const leaderboard = await getTerritorialLeaderboard(user.id, filter);
    return NextResponse.json({ success: true, leaderboard });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erreur interne de classement';
    console.error('[API /api/progression/leaderboard] Error:', message);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
