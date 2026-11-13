import { requireUser } from '@/lib/api/requireUser';
import { ok } from '@/lib/api/respond';
import { z } from 'zod';
import { getWatchStatus } from '@/features/compte/server/watches';
import { WATCH_PLATFORMS } from '@/features/compte/server/watches/validation';
import { handleWatchError, rejected, truthyFlag } from '../_shared';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const PlatformSchema = z.enum(WATCH_PLATFORMS);

/**
 * GET /api/watches/status
 *
 * Diagnostic réel des cibles natives (WatchKit / Gradle `:wear`), matrice de
 * compatibilité et capacités effectives. Fail-closed : sans cible native
 * compilée ou injectée, le statut est `native_target_unavailable`.
 *
 * Paramètres optionnels : `platform`, `deviceId`, et les trois drapeaux
 * `xcodeWatchKitTargetPresent`, `wearOsGradleModulePresent`,
 * `runtimeBridgeInjected` (réservés aux diagnostics et aux tests).
 */
export async function GET(request: Request) {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;

  const url = new URL(request.url);
  const rawPlatform = url.searchParams.get('platform');
  const platform = rawPlatform ? PlatformSchema.safeParse(rawPlatform) : null;
  if (platform && !platform.success) {
    return rejected('invalid_platform', 'Plateforme de montre inconnue.');
  }

  try {
    const result = getWatchStatus(auth.user.id, {
      platform: platform?.success ? platform.data : undefined,
      deviceId: url.searchParams.get('deviceId') ?? undefined,
      xcodeWatchKitTargetPresent: truthyFlag(
        url.searchParams.get('xcodeWatchKitTargetPresent'),
      ),
      wearOsGradleModulePresent: truthyFlag(
        url.searchParams.get('wearOsGradleModulePresent'),
      ),
      runtimeBridgeInjected: truthyFlag(url.searchParams.get('runtimeBridgeInjected')),
    });
    return ok(result);
  } catch (error) {
    return handleWatchError(error);
  }
}
