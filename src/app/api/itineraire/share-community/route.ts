// Publier la version publiée d'un itinéraire dans la communauté (10.9), zone de départ masquée.
// Entrée validée par zod ; droits : propriétaire de l'espace (route.manage_privacy) ; écriture par la RPC
// `create_community_post` (identité et audience contrôlées en SQL).
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { publishRouteToCommunity } from '@/features/route-collab/server/shareToCommunity';

export const dynamic = 'force-dynamic';

const bodySchema = z
  .object({
    workspaceId: z.string().min(1).max(80),
    audience: z.enum(['public', 'abonnies', 'club']).default('abonnies'),
    clubId: z.string().uuid().nullish(),
    caption: z.string().trim().max(2000).optional(),
    linkedCarnetId: z.string().uuid().nullish(),
    clientRequestId: z.string().uuid().nullish(),
  })
  .strict();

const HTTP: Record<string, number> = {
  unauthenticated: 401,
  forbidden: 403,
  not_found: 404,
  no_published: 409,
  rejected: 422,
  error: 500,
};

export async function POST(request: Request) {
  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ status: 'invalid' }, { status: 400 });
  }
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) return NextResponse.json({ status: 'invalid' }, { status: 400 });
  const result = await publishRouteToCommunity(parsed.data.workspaceId, parsed.data);
  return NextResponse.json(result, { status: HTTP[result.status] ?? 200 });
}
