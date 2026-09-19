import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getProgressionProfile } from '@/features/progression/server/progressionService';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ success: false, error: 'unauthorized' }, { status: 401 });
    }

    const profile = await getProgressionProfile(user.id);
    return NextResponse.json({ success: true, profile });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erreur interne de progression';
    console.error('[API /api/progression] Error:', message);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
