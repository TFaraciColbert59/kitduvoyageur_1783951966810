import { z } from 'zod';
import { requireUser } from '@/lib/api/requireUser';
import { fail, ok } from '@/lib/api/respond';
import {
  PRIVACY_ZONE_MAX_RADIUS_M,
  PRIVACY_ZONE_MIN_RADIUS_M,
  deletePrivacyZone,
  updatePrivacyZone,
} from '@/features/compte/server/privacyZones';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const Id = z.string().min(1).max(64);
const PatchZoneSchema = z
  .object({
    label: z.string().trim().min(1).max(60).optional(),
    centerLat: z.number().finite().min(-90).max(90).optional(),
    centerLng: z.number().finite().min(-180).max(180).optional(),
    radiusM: z.number().finite().min(PRIVACY_ZONE_MIN_RADIUS_M).max(PRIVACY_ZONE_MAX_RADIUS_M).optional(),
    isActive: z.boolean().optional(),
  })
  .strict();

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, context: RouteContext) {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;
  const parsedId = Id.safeParse((await context.params).id);
  if (!parsedId.success) return fail('not_found', 'Zone introuvable.');

  const parsed = PatchZoneSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return fail('bad_request', 'Modification de zone invalide.');

  try {
    const zone = await updatePrivacyZone(auth.supabase, auth.user.id, parsedId.data, parsed.data);
    return ok({ zone });
  } catch (error) {
    if (error instanceof Error && error.message === 'not_found') {
      return fail('not_found', 'Zone introuvable.');
    }
    return fail('server', 'Impossible de mettre à jour cette zone privée.');
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;
  const parsedId = Id.safeParse((await context.params).id);
  if (!parsedId.success) return fail('not_found', 'Zone introuvable.');

  try {
    await deletePrivacyZone(auth.supabase, auth.user.id, parsedId.data);
    return ok({ status: 'deleted' });
  } catch {
    return fail('server', 'Impossible de supprimer cette zone privée.');
  }
}
