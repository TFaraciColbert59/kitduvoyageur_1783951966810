import 'server-only';

import {
  searchSegments,
  type SegmentDefinition,
  type SegmentEffort,
  type SegmentHazardReport,
  type UserSegmentPreferences,
} from '@/features/segments';
import {
  getPreferences,
  listEfforts,
  listHazardReports,
  listSegments,
} from './store';

export interface SegmentsViewerData {
  viewerUserId: string | null;
  segments: SegmentDefinition[];
  efforts: SegmentEffort[];
  hazardReports: SegmentHazardReport[];
  preferences: UserSegmentPreferences;
}

/**
 * Charge le catalogue visible par un lecteur (P01) pour le rendu serveur de
 * `/segments`. Les préférences personnelles ne sortent que pour leur porteur.
 */
export function loadSegmentsViewerData(viewerUserId: string | null): SegmentsViewerData {
  const preferences = viewerUserId
    ? getPreferences(viewerUserId)
    : { userId: 'anonymous', starredSegmentIds: [], hiddenSegmentIds: [] };

  const result = searchSegments(listSegments(), {
    viewerUserId,
    preferences,
    includeHidden: true,
    limit: 200,
  });

  const segments = result.hits.map((hit) => hit.segment);
  const segmentIds = new Set(segments.map((segment) => segment.id));

  return {
    viewerUserId,
    segments,
    efforts: listEfforts().filter((effort) => segmentIds.has(effort.segmentId)),
    hazardReports: listHazardReports().filter((report) => segmentIds.has(report.segmentId)),
    preferences,
  };
}
