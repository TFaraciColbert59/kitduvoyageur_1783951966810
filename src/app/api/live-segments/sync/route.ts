import { NextResponse } from 'next/server';
import {
  buildDeviceSyncReferences,
  type DeviceCapability,
} from '@/features/live-segments';
import {
  createPublicPrivacy,
  listLiveSegmentsByIds,
  LIVE_SEGMENT_CATALOG_DATA_SOURCE,
} from '@/lib/live-segments/server/catalog';
import {
  DeviceSyncRequestSchema,
} from '@/lib/live-segments/server/validation';
import {
  LIVE_SEGMENTS_NO_STORE,
  readJsonBody,
  rejected,
} from '../_shared';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/live-segments/sync
 *
 * Prépare les références compactes d'un appareil (Garmin, Wahoo, Karoo,
 * Apple Watch, Wear OS) : trace non envoyée, uniquement checksum, distance,
 * dénivelé et objectif fantôme. Les refus P01/S6.19 sont explicites.
 */
export async function POST(request: Request): Promise<NextResponse> {
  const parsed = DeviceSyncRequestSchema.safeParse(await readJsonBody(request));
  if (!parsed.success) {
    return rejected({
      code: 'invalid_sync_request',
      message: parsed.error.issues[0]?.message ?? 'Demande de synchronisation invalide.',
    });
  }

  const { device, segmentIds, preferredGhostKind, optedIn } = parsed.data;

  if (!optedIn) {
    return rejected({
      code: 'privacy_opted_out',
      message: 'Les Live Segments sont désactivés dans les réglages de confidentialité.',
    });
  }
  if (!device.supportsLiveSegments || device.platform === 'web_unsupported') {
    return rejected({
      code: 'device_incompatible',
      message: 'Cet appareil ne prend pas en charge les Live Segments.',
    });
  }
  if (!device.hasPermission) {
    return rejected({
      code: 'permission_denied',
      message: 'L’accès aux segments a été refusé sur cet appareil.',
    });
  }

  const segments = listLiveSegmentsByIds(segmentIds, { optedIn });
  if (segments.length === 0) {
    return rejected({
      code: 'no_eligible_segments',
      message: 'Aucun segment n’est éligible à la synchronisation.',
    });
  }

  const privacy = createPublicPrivacy(null, optedIn);
  const capability: DeviceCapability = device;
  const { eligible, skippedIds } = buildDeviceSyncReferences(
    segments,
    privacy,
    capability,
    preferredGhostKind,
  );

  return NextResponse.json(
    {
      deviceId: device.deviceId,
      references: eligible,
      skippedSegmentIds: skippedIds,
      offline: !device.isOnline,
      dataSource: LIVE_SEGMENT_CATALOG_DATA_SOURCE,
    },
    { headers: LIVE_SEGMENTS_NO_STORE },
  );
}
