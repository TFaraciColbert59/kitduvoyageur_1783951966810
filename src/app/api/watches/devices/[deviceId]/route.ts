import { requireUser } from '@/lib/api/requireUser';
import { ok } from '@/lib/api/respond';
import { removeWatchDevice } from '@/features/compte/server/watches';
import { handleWatchError, rejected } from '../../_shared';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const DEVICE_ID = /^[A-Za-z0-9._:-]{1,160}$/;

/** DELETE /api/watches/devices/[deviceId] — retire une montre déclarée. */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ deviceId: string }> },
) {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;

  const deviceId = (await params).deviceId;
  if (!DEVICE_ID.test(deviceId)) {
    return rejected('invalid_device_id', 'Identifiant de montre invalide.');
  }
  try {
    removeWatchDevice(auth.user.id, deviceId);
    return ok({ removed: true, deviceId });
  } catch (error) {
    return handleWatchError(error);
  }
}
