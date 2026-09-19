import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function POST() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ success: false, error: 'unauthorized' }, { status: 401 });
    }

    return NextResponse.json(
      { success: false, error: 'not_implemented_p3' },
      { status: 501 }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erreur lors de la mise à jour du territoire';
    console.error('[API /api/progression/territory] Error:', message);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
