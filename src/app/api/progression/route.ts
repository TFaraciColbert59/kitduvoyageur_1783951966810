import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getProgressionProfile } from '@/features/progression/server/progressionService';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    let userId = 'user_demo_01';

    try {
      const supabase = await createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (user?.id) userId = user.id;
    } catch (_e) {
      // Fallback
    }

    const profile = await getProgressionProfile(userId);
    return NextResponse.json({ success: true, profile });
  } catch (err: any) {
    console.error('[API /api/progression] Error:', err);
    return NextResponse.json(
      { success: false, error: err?.message || 'Erreur interne de progression' },
      { status: 500 }
    );
  }
}
