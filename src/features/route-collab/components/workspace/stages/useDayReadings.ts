'use client';

import { useMemo } from 'react';
import { NO_PLACES, readDays, type DayReading } from '../../../dayReading';
import { useRouteWorkspace } from '../WorkspaceContext';
import { useGroupPace } from './usePace';
import { usePlacesByStage } from './useStagePlaces';

/** Lecture de toutes les journées : durée sur le plus lent, arrivée vs coucher, eau, nuits, repli (6.3 à 6.10). */
export function useDayReadings(): { days: DayReading[]; byId: Map<string, DayReading>; group: ReturnType<typeof useGroupPace> } {
  const { workspace } = useRouteWorkspace();
  const group = useGroupPace();
  const placesByStage = usePlacesByStage(workspace);
  const party = Math.max(1, workspace.members.filter((m) => !m.revokedAt).length);
  const days = useMemo(
    () => readDays(workspace, { pace: group.pace, places: NO_PLACES, placesByStage, party }),
    [workspace, group.pace, placesByStage, party]
  );
  const byId = useMemo(() => new Map(days.map((d) => [d.stageId, d])), [days]);
  return { days, byId, group };
}
