import { z } from 'zod';
import { requireUser } from '@/lib/api/requireUser';
import { fail, ok } from '@/lib/api/respond';
import {
  PRIVACY_ZONE_MAX_RADIUS_M,
  PRIVACY_ZONE_MIN_RADIUS_M,
  createPrivacyZone,
  listOwnerPrivacyZones,
} from '@/features/compte/server/privacyZones';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const CreateZoneSchema = z
  .object({
    label: z.string().trim().min(1).max(60),
    centerLat: z.number().finite().min(-90).max(90),
    centerLng: z.number().finite().min(-180).max(180),
    radiusM: z.number().finite().min(PRIVACY_ZONE_MIN_RADIUS_M).max(PRIVACY_ZONE_MAX_RADIUS_M),
    isActive: z.boolean().optional(),
  })
  .strict();

export async function GET() {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;

  try {
    const zones = await listOwnerPrivacyZones(auth.supabase, auth.user.id);
    return ok({ zones });
  } catch {
    return fail('server', 'Impossible de charger tes zones privées.');
  }
}

export async function POST(request: Request) {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;

  const parsed = CreateZoneSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return fail('bad_request', 'Zone privée invalide (nom, coordonnées ou rayon 200 m–5 km).');
  }

  try {
    const zone = await createPrivacyZone(auth.supabase, auth.user.id, parsed.data);
    return ok({ zone }, 201);
  } catch (error) {
    if (error instanceof Error && error.message === 'max_zones_reached') {
      return fail('conflict', 'Limite atteinte (10 zones privées maximum).');
    }
    if (
      error instanceof Error &&
      ['invalid_label', 'invalid_coordinates', 'invalid_radius'].includes(error.message)
    ) {
      return fail('bad_request', 'Paramètres de zone privée invalides.');
    }
    return fail('server', 'Impossible de créer cette zone privée.');
  }
}
