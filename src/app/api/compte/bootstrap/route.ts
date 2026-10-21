import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { loadAccountBootstrap } from '@/features/compte/data/accountBootstrap';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const supabase = await createClient();
    const payload = await loadAccountBootstrap(supabase);
    return NextResponse.json(payload);
  } catch {
    // Une erreur de lecture ne doit jamais casser le Compte : le runtime
    // conserve ses données de démonstration et l'erreur reste côté serveur.
    return NextResponse.json({ authenticated: false, error: 'bootstrap_unavailable' });
  }
}
