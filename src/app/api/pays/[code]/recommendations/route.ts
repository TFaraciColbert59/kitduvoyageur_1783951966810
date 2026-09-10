// src/app/api/pays/[code]/recommendations/route.ts
// Recommandations contextualisées (profil / durée / saison) sur données réelles.
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getPaysRecommendations } from '@/features/pays/server/paysRecommendations';

export const dynamic = 'force-dynamic';

const CACHE = { 'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400' } as const;

const querySchema = z.object({
  level: z.enum(['facile', 'modere', 'expert']).default('modere'),
  duration: z.enum(['weekend', 'semaine', 'expedition']).default('semaine'),
  month: z.coerce.number().int().min(1).max(12).optional(),
});

export async function GET(
  request: Request,
  context: { params: Promise<{ code: string }> }
) {
  const { code } = await context.params;
  const iso = (code || '').toUpperCase();
  if (!/^[A-Z]{2}$/.test(iso)) {
    return NextResponse.json({ status: 'error', reason: 'invalid_country' }, { status: 400 });
  }

  const raw = Object.fromEntries(new URL(request.url).searchParams.entries());
  const parsed = querySchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ status: 'error', reason: 'invalid_query' }, { status: 400 });
  }

  const month = parsed.data.month ?? new Date().getUTCMonth() + 1;
  const result = await getPaysRecommendations(iso, {
    level: parsed.data.level,
    duration: parsed.data.duration,
    month,
  });

  return NextResponse.json(result, { headers: CACHE });
}
