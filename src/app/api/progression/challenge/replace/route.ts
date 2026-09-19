import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { replaceCurrentChallenge } from '@/features/progression/server/progressionService';

export const dynamic = 'force-dynamic';

export async function POST() {
  try {
    let userId = 'user_demo_01';

    try {
      const supabase = await createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (user?.id) userId = user.id;
    } catch (_e) {
      // Fallback
    }

    const result = await replaceCurrentChallenge(userId);
    if (!result.success) {
      return NextResponse.json({ success: false, error: result.error }, { status: 400 });
    }

    return NextResponse.json({ success: true, challenge: result.challenge });
  } catch (err: any) {
    console.error('[API /api/progression/challenge/replace] Error:', err);
    return NextResponse.json(
      { success: false, error: err?.message || 'Erreur lors du remplacement de défi' },
      { status: 500 }
    );
  }
}
