import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getTerritorialLeaderboard } from '@/features/progression/server/progressionService';
import { TerritoryFilter } from '@/features/progression/domain/types';

export const dynamic = 'force-dynamic';

const VALID_FILTERS: TerritoryFilter[] = ['around_me', 'city', 'region', 'country', 'world'];

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const filterParam = (searchParams.get('filter') || 'world') as TerritoryFilter;
    const filter: TerritoryFilter = VALID_FILTERS.includes(filterParam) ? filterParam : 'world';

    let userId = 'user_demo_01';

    try {
      const supabase = await createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (user?.id) userId = user.id;
    } catch (_e) {
      // Fallback
    }

    const leaderboard = await getTerritorialLeaderboard(userId, filter);
    return NextResponse.json({ success: true, leaderboard });
  } catch (err: any) {
    console.error('[API /api/progression/leaderboard] Error:', err);
    return NextResponse.json(
      { success: false, error: err?.message || 'Erreur interne de classement' },
      { status: 500 }
    );
  }
}
