'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { buildAnalysis, dayPassages, trackForFire, type Analysis } from '../../../analyse/analysis';
import type { MemberProfile } from '../../../analyse/effort';
import { waterObservationsFrom } from '../../../nights';
import type { WaterObservation } from '../../../types';
import { useRouteWorkspace } from '../WorkspaceContext';
import { useDayReadings } from '../stages/useDayReadings';
import { useGroupMembers, useGroupPace, usePerformanceProfile } from '../stages/usePace';
import { usePlacesByStage } from '../stages/useStagePlaces';
import { fetchAnalyseRemote, NO_REMOTE, type AnalyseRemote } from './analyseClient';

/**
 * Lecture de l'onglet Analyser : assemble les moteurs (`buildAnalysis`) sur l'état de l'atelier et lit à la
 * demande la météo au passage et les feux (`/api/itineraire/analyse`). Une seule lecture serveur par plan :
 * la clé est la suite (jour, date, point, heure) et le tracé ; elle ne repart pas à chaque frappe.
 */
export function useAnalyse(options: { load: boolean }): { analysis: Analysis; remote: AnalyseRemote; reload: () => void; passagesCount: number } {
  const { workspace, profileModel, currentUserId } = useRouteWorkspace();
  const { days } = useDayReadings();
  const { manualKmh } = useGroupPace();
  const paceMembers = useGroupMembers();
  const performanceProfile = usePerformanceProfile();
  const placesByStage = usePlacesByStage(workspace);
  const [remote, setRemote] = useState<AnalyseRemote>(NO_REMOTE);
  const lastKey = useRef<string>('');

  const passages = useMemo(() => dayPassages(days, profileModel), [days, profileModel]);
  const track = useMemo(() => trackForFire(profileModel), [profileModel]);
  const key = useMemo(
    () => `${passages.map((p) => `${p.day}|${p.dateIso}|${p.lat},${p.lon}|${p.passageLocal}`).join(';')}#${track.length}:${track[0]?.lat ?? ''},${track.at(-1)?.lon ?? ''}`,
    [passages, track],
  );

  const run = useCallback(
    async (force: boolean) => {
      if (passages.length === 0 && track.length < 2) return;
      if (!force && lastKey.current === key) return;
      lastKey.current = key;
      setRemote((r) => ({ ...r, status: 'loading' }));
      setRemote(await fetchAnalyseRemote(passages, track));
    },
    [key, passages, track],
  );

  useEffect(() => {
    if (options.load) void run(false);
  }, [options.load, run]);

  const members = useMemo<MemberProfile[]>(() => {
    const active = workspace.members.filter((m) => !m.revokedAt);
    const byId = new Map(paceMembers.map((m) => [m.id, m]));
    const out: MemberProfile[] = active.map((m) => {
      const p = byId.get(m.userId);
      return { id: m.userId, name: m.displayName, flatSpeedKmh: p?.speedKmh ?? null, ascentMPerH: p?.ascentMPerHour ?? null, paceSource: p?.origin };
    });
    if (manualKmh != null) out.push({ id: 'manual', name: 'Allure renseignée', flatSpeedKmh: manualKmh });
    return out;
  }, [workspace.members, paceMembers, manualKmh]);

  const waterByStage = useMemo(() => {
    const out: Record<string, WaterObservation[]> = {};
    const fetchedAt: Record<string, string | null> = {};
    for (const st of workspace.stages) {
      const places = placesByStage[st.id];
      const ready = places && (places.status === 'ready' || places.status === 'partial');
      fetchedAt[st.id] = ready ? places.fetchedAt : null;
      out[st.id] = [...st.waterObservations, ...(ready ? waterObservationsFrom(places.pois, places.fetchedAt ?? '') : [])];
    }
    return { out, fetchedAt };
  }, [workspace.stages, placesByStage]);

  const analysis = useMemo(
    () =>
      buildAnalysis({
        workspace,
        profile: profileModel,
        days,
        members,
        currentUserId,
        now: new Date(),
        performanceProfile,
        waterByStage: waterByStage.out,
        placesFetchedAtByStage: waterByStage.fetchedAt,
        remote: { weather: remote.weather, fire: remote.fire, official: remote.official },
      }),
    // `now` n'entre pas dans les dépendances : l'âge d'une observation se relit à chaque changement du plan ou des relevés.
    [workspace, profileModel, days, members, currentUserId, performanceProfile, waterByStage, remote.weather, remote.fire, remote.official],
  );

  const reload = useCallback(() => void run(true), [run]);
  return { analysis, remote, reload, passagesCount: passages.length };
}
