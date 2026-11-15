import { requireUser } from '@/lib/api/requireUser';
import { ok } from '@/lib/api/respond';
import {
  listWatchDevices,
  registerWatchDevice,
} from '@/features/compte/server/watches';
import { WatchDeviceProfileSchema } from '@/features/compte/server/watches/validation';
import { handleWatchError, readJson, rejected } from '../_shared';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** GET /api/watches/devices — montres déclarées par l'utilisateur. */
export async function GET() {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;
  try {
    return ok({ devices: listWatchDevices(auth.user.id) });
  } catch (error) {
    return handleWatchError(error);
  }
}

/**
 * POST /api/watches/devices — déclare une montre et calcule sa matrice de
 * capacités réelle. Aucune capacité n'est supposée disponible.
 */
export async function POST(request: Request) {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;

  const parsed = WatchDeviceProfileSchema.safeParse(await readJson(request));
  if (!parsed.success) {
    return rejected(
      'invalid_device',
      parsed.error.issues[0]?.message ?? 'Profil de montre invalide.',
    );
  }

  try {
    const result = registerWatchDevice(auth.user.id, parsed.data);
    return ok(result, 201);
  } catch (error) {
    return handleWatchError(error);
  }
}
