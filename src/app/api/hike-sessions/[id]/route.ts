import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const supabase = await createClient();

    const { data: session, error } = await supabase
      .from('hike_sessions')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !session) {
      return NextResponse.json({ error: 'Session non trouvée' }, { status: 404 });
    }

    return NextResponse.json({ session });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
