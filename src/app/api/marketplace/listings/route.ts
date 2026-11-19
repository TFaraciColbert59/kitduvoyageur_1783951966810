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
    const listings = (Array.isArray(data) ? data : []) as Array<Record<string, unknown>>;
    const ownerIds = Array.from(
      new Set(
        listings
          .map((row) => (typeof row.owner_id === 'string' ? row.owner_id : ''))
          .filter(Boolean),
      ),
    );
    const ownersById = new Map<
      string,
      { id: string; full_name: string | null; avatar_url: string | null; trust_score: number | null }
    >();
    if (ownerIds.length > 0) {
      const { data: profiles } = await db
        .from('public_profiles')
        .select('id, full_name, avatar_url, trust_score')
        .in('id', ownerIds);
      for (const p of (profiles ?? []) as Array<{
        id: string;
        full_name: string | null;
        avatar_url: string | null;
        trust_score: number | null;
      }>) {
        ownersById.set(p.id, p);
      }
    }
    const enriched = listings.map((row) => {
      const ownerId = typeof row.owner_id === 'string' ? row.owner_id : '';
      return {
        ...row,
        owner: ownerId ? ownersById.get(ownerId) ?? null : null,
      };
    });
    return NextResponse.json(
      { listings: enriched },
      { headers: { 'Cache-Control': 'no-store' } }
    );
  } catch {
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
