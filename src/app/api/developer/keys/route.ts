import { z } from 'zod';
import { requireUser } from '@/lib/api/requireUser';
import { fail, ok } from '@/lib/api/respond';
import { DEVELOPER_API_SCOPES } from '@/features/offers/domain/developerApi';
import {
  issueDeveloperKey,
  listDeveloperKeys,
  revokeDeveloperKey,
} from '@/features/offers/server/developerStore';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const CreateKeySchema = z
  .object({
    clientName: z.string().trim().min(2).max(60),
    scopes: z.array(z.enum(DEVELOPER_API_SCOPES)).min(1).max(4),
    rateLimitPerMin: z.number().int().min(10).max(600).optional(),
    expiresAtIso: z.string().datetime().nullable().optional(),
  })
  .strict();

const RevokeSchema = z
  .object({
    id: z.string().trim().min(1).max(64),
  })
  .strict();

export async function GET() {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;
  return ok({ keys: listDeveloperKeys(auth.user.id) });
}

export async function POST(request: Request) {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;

  const parsed = CreateKeySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return fail('conflict', 'Paramètres de client API invalides.');
  }

  try {
    const created = issueDeveloperKey({
      userId: auth.user.id,
      clientName: parsed.data.clientName,
      scopes: parsed.data.scopes,
      rateLimitPerMin: parsed.data.rateLimitPerMin,
      expiresAtIso: parsed.data.expiresAtIso ?? null,
    });
    return ok(created);
  } catch {
    return fail('server', 'Création du client API impossible.');
  }
}

export async function DELETE(request: Request) {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;

  const parsed = RevokeSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return fail('conflict', 'Identifiant de clé requis.');
  }

  const revoked = revokeDeveloperKey(auth.user.id, parsed.data.id);
  if (!revoked) {
    return fail('not_found', 'Clé API introuvable.');
  }
  return ok({ key: revoked });
}
