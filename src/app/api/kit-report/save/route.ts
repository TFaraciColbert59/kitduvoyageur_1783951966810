import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
    }

    const { reportId } = await req.json();
    if (!reportId) {
      return NextResponse.json({ error: 'reportId manquant' }, { status: 400 });
    }

    const { error } = await supabase
      .from('kit_reports')
      .update({ status: 'saved', updated_at: new Date().toISOString() })
      .eq('id', reportId)
      .eq('user_id', user.id);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Erreur' },
      { status: 500 }
    );
  }
}
