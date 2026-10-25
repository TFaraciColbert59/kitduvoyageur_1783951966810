import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { reviewSchema } from '@/features/marketplace/domain/validation';
import { mutate, errorResponse, uuidSchema } from '@/features/marketplace/server/http';
export async function POST(req: NextRequest) {
  return mutate(
    req,
    reviewSchema,
    'marketplace_review',
    (b) => ({ p_transaction_id: b.transaction_id, p_rating: b.rating, p_comment: b.comment }),
    'review',
    201
  );
}
export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get('listing_id');
  if (!uuidSchema.safeParse(id).success)
    return NextResponse.json({ error: 'Annonce requise' }, { status: 400 });
  try {
    const db = await createClient();
    const { data, error } = await db
      .from('marketplace_reviews')
      .select('id,listing_id,transaction_id,author_id,subject_id,rating,comment,created_at')
      .eq('listing_id', id)
      .order('created_at', { ascending: false })
      .limit(100);
    return error ? errorResponse(error) : NextResponse.json({ reviews: data ?? [] });
  } catch {
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
