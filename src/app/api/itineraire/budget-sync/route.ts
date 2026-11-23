// Budget prévu depuis la version publiée de l'itinéraire (10.6). Idempotent ; droit de gestion du budget du
// voyage exigé (même règle que les actions budget) ; entrée validée par zod ; aucun montant inventé.
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { syncPublishedRouteBudget } from '@/features/route-collab/server/budgetSync';

export const dynamic = 'force-dynamic';

const bodySchema = z.object({ tripId: z.string().uuid() }).strict();

export async function POST(request: Request) {
  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ status: 'invalid' }, { status: 400 });
  }
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) return NextResponse.json({ status: 'invalid' }, { status: 400 });
  const result = await syncPublishedRouteBudget(parsed.data.tripId);
  const status =
    result.status === 'unauthenticated' ? 401 : result.status === 'forbidden' ? 403 : result.status === 'error' ? 500 : 200;
  return NextResponse.json(result, { status });
}
