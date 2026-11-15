/**
 * Types partagés entre l'écran Live Segments et les routes `/api/live-segments`.
 * Le type de résumé est ré-exporté du catalogue serveur (import de type seul,
 * effacé au build) pour garder une seule forme de données.
 */

import type {
  DeviceSegmentReference,
  FinalSegmentEffort,
  GhostTargetKind,
  LiveSegmentDefinition,
} from '@/features/live-segments';
import type { LiveSegmentSummary } from '@/lib/live-segments/server/catalog';

export type LiveSegmentSummaryView = LiveSegmentSummary;

export interface ListLiveSegmentsResponse {
  items: LiveSegmentSummary[];
  dataSource: 'demo_catalog';
  catalogSize: number;
}

export interface LiveSegmentDetailResponse {
  segment: LiveSegmentDefinition;
  region: string;
  dataSource: 'demo_catalog';
}

export interface SubmitEffortResponse {
  accepted: true;
  effort: FinalSegmentEffort;
  segmentId: string;
  dataSource: 'demo_catalog';
  persisted: false;
}

export interface DeviceSyncRequestBody {
  device: {
    deviceId: string;
    deviceName: string;
    platform:
      | 'garmin_connect'
      | 'wahoo_elemnt'
      | 'hammerhead_karoo'
      | 'apple_watch'
      | 'wear_os'
      | 'web_unsupported';
    supportsLiveSegments: boolean;
    maxSyncedSegments: number;
    supportedSports: Array<'cycling' | 'running' | 'hiking' | 'trail' | 'gravel'>;
    hasPermission: boolean;
    isOnline: boolean;
  };
  segmentIds: string[];
  preferredGhostKind?: GhostTargetKind;
  optedIn?: boolean;
}

export interface DeviceSyncResponse {
  deviceId: string;
  references: DeviceSegmentReference[];
  skippedSegmentIds: string[];
  offline: boolean;
  dataSource: 'demo_catalog';
}
