import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { listingSchema } from '@/features/marketplace/domain/validation';
import { mutate, errorResponse } from '@/features/marketplace/server/http';
export async function POST(req: NextRequest) {
  return mutate(
    req,
    listingSchema,
    'marketplace_publish',
    (b) => ({
      p_item_id: b.item_id,
      p_description: b.description,
      p_public_location: b.public_location,
      p_price_cents: b.price_cents,
      p_deposit_cents: b.deposit_cents ?? 0,
    }),
    'listing',
    201
  );
}
export async function GET(req: NextRequest) {
  try {
    const db = await createClient();
    const mine = req.nextUrl.searchParams.get('mine') === 'true';
    if (mine) {
      const {
        data: { user },
      } = await db.auth.getUser();
      if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
    }
    const mode = req.nextUrl.searchParams.get('mode');
    if (mode && !['vente', 'location', 'pret'].includes(mode))
      return NextResponse.json({ error: 'Mode invalide' }, { status: 400 });
    const { data, error } = await db.rpc('marketplace_list', { p_mode: mode, p_mine: mine });
    if (error) return errorResponse(error);
    return NextResponse.json(
      { listings: data ?? [] },
      { headers: { 'Cache-Control': 'no-store' } }
    );
  } catch {
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
