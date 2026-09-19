import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { updateUserTerritory } from '@/features/progression/server/progressionService';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { cityName, departmentCode, regionName, countryCode, postalCode } = body || {};

    if (!cityName || !regionName) {
      return NextResponse.json(
        { success: false, error: 'Ville et région requises' },
        { status: 400 }
      );
    }

    let userId = 'user_demo_01';

    try {
      const supabase = await createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (user?.id) userId = user.id;
    } catch (_e) {
      // Fallback
    }

    const result = await updateUserTerritory(userId, {
      cityName,
      departmentCode,
      regionName,
      countryCode,
      postalCode,
    });

    if (!result.success) {
      return NextResponse.json({ success: false, error: result.error }, { status: 400 });
    }

    return NextResponse.json({ success: true, lockUntil: result.lockUntil });
  } catch (err: any) {
    console.error('[API /api/progression/territory] Error:', err);
    return NextResponse.json(
      { success: false, error: err?.message || 'Erreur lors de la mise à jour du territoire' },
      { status: 500 }
    );
  }
}
