'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { canSeeParticipants, participantRows, participantsSummary } from '../../../depart/participants';
import { departReading } from '../../../depart/readiness';
import { isRealTripId } from '../../../startPersist';
import { useRouteWorkspace } from '../WorkspaceContext';
import { fetchDepart, fetchSafetyContacts, fetchSessions, NO_DEPART, patchChecklist, type DepartData } from './departClient';
import type { RecordedSession } from '../../../depart/carnetCompare';

/**
 * Lecture de l'onglet Départ : le sac et la liste du HUB (même voyage), les contacts de sécurité du suivi en
 * direct, l'état des participants (organisateur seulement) et le « prêt à partir » qui en découle.
 */
export function useDepart(options: { load: boolean }) {
  const { workspace, verifiedPack, currentUserId } = useRouteWorkspace();
  const tripId = workspace.tripId;
  const linked = isRealTripId(tripId);
  const [data, setData] = useState<DepartData>(NO_DEPART);
  const [contacts, setContacts] = useState<number | null>(null);

  const reload = useCallback(async () => {
    if (!linked) return;
    setData((d) => ({ ...d, status: 'loading' }));
    setData(await fetchDepart(tripId));
    setContacts(await fetchSafetyContacts());
  }, [linked, tripId]);

  useEffect(() => {
    if (options.load && linked) void reload();
  }, [options.load, linked, reload]);

  const toggle = useCallback(
    async (id: string, done: boolean) => {
      const before = data.checklist;
      setData((d) => ({ ...d, checklist: d.checklist?.map((c) => (c.id === id ? { ...c, done } : c)) ?? null }));
      const ok = await patchChecklist(tripId, id, done);
      if (!ok) setData((d) => ({ ...d, checklist: before }));
      return ok;
    },
    [data.checklist, tripId],
  );

  const organiser = canSeeParticipants(workspace, currentUserId);
  const participants = useMemo(() => (organiser ? participantRows(workspace) : null), [organiser, workspace]);
  const checklistSummary = data.checklist ? { total: data.checklist.length, done: data.checklist.filter((c) => c.done).length } : null;
  const reading = useMemo(
    () =>
      departReading({
        workspace,
        pack: verifiedPack,
        checklist: checklistSummary,
        safetyContacts: contacts,
        participants: participants && participants.length > 1 ? participantsSummary(participants) : null,
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [workspace, verifiedPack, data.checklist, contacts, participants]
  );
  return { linked, data, reload, toggle, contacts, participants, reading };
}

/** Sorties enregistrées qui ont suivi cet itinéraire (carnet, 9.9), lues à l'ouverture du tiroir. */
export function useLinkedSessions(enabled: boolean) {
  const { workspace } = useRouteWorkspace();
  const [state, setState] = useState<{ status: 'idle' | 'loading' | 'ready'; sessions: RecordedSession[] | null; reason: string | null }>({ status: 'idle', sessions: null, reason: null });
  useEffect(() => {
    if (!enabled) return;
    let alive = true;
    setState((s) => ({ ...s, status: 'loading' }));
    void fetchSessions(workspace.id).then((r) => alive && setState({ status: 'ready', ...r }));
    return () => {
      alive = false;
    };
  }, [enabled, workspace.id]);
  return state;
}
