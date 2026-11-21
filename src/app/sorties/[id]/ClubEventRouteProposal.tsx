'use client';

import { useActionState, useEffect, useId, useRef, useState } from 'react';
import { liveQuery } from 'dexie';
import { useAuth } from '@/contexts/AuthContext';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import { createClient } from '@/lib/supabase/client';
import HubRouteMap from '@/features/hub/components/mobile/HubRouteMap';
import { formatElevationM, formatKm } from '@/features/community/v2/shared/format';
import {
  clubRouteSegments, readClubRouteCopy, removeClubRouteCopy, saveClubRouteCopy,
  type ClubRouteSegments,
} from '@/features/adventure-intelligence/offline/clubRouteCopies';
import { saveClubRouteDecision } from './clubRouteDecisionAction';

const EMPTY_ROUTE: Array<[number, number]> = [];

async function fetchRoute(eventId: string, revision: number, signal: AbortSignal) {
  const { data, error } = await createClient().rpc('get_club_event_route_trace', {
    p_event_id: eventId, p_revision: revision,
  }).abortSignal(signal);
  if (error) throw error;
  const segments = clubRouteSegments(data);
  if (segments.length === 0) throw new Error('Club route geometry is unavailable');
  return segments;
}

function ClubRouteTrace({ eventId, viewerId, revision, isOnline }: {
  eventId: string;
  viewerId: string;
  revision: number;
  isOnline: boolean;
}) {
  const [segments, setSegments] = useState<ClubRouteSegments | null>(null);
  useEffect(() => {
    const request = new AbortController();
    const read = isOnline
      ? fetchRoute(eventId, revision, request.signal)
      : readClubRouteCopy(viewerId, eventId, revision);
    const publish = (lines: ClubRouteSegments) => {
      if (!request.signal.aborted) setSegments(lines);
    };
    void read.then(publish, () => publish([]));
    return () => request.abort();
  }, [eventId, isOnline, revision, viewerId]);

  if (!segments?.length) return (
    <p className="lkdv-event-muted" role="status">
      {segments ? 'Ce tracé est indisponible.' : 'Chargement du tracé…'}
    </p>
  );
  return (
    <>
      {!isOnline && <p className="lkdv-event-muted">Copie hors ligne · fond de carte indisponible</p>}
      <div className="lkdv-event-route-map">
        <HubRouteMap routeCoords={EMPTY_ROUTE} routeSegments={segments} interactive showBasemap={isOnline} />
      </div>
    </>
  );
}

export default function ClubEventRouteProposal({
  eventId,
  viewerId,
  revision,
  routeName,
  distanceM,
  elevationGainM,
  canDecide,
  decision,
  adoptedRevision,
}: {
  eventId: string;
  viewerId: string;
  revision: number;
  routeName: string | null;
  distanceM: number | null;
  elevationGainM: number | null;
  canDecide: boolean;
  decision: boolean | null;
  adoptedRevision: number | null;
}) {
  const geometryId = useId();
  const { user } = useAuth();
  const { isOnline } = useOnlineStatus();
  const currentViewer = user?.id === viewerId;
  const [result, save, pending] = useActionState(saveClubRouteDecision.bind(null, eventId, revision), {});
  const selected = result.adopted ?? decision;
  const myRevision = selected === true ? revision : adoptedRevision;
  const previousRevision = myRevision != null && myRevision < revision ? myRevision : null;

  const [requestedRevision, setRequestedRevision] = useState<number | null>(null);
  const [localCopy, setLocalCopy] = useState<{ revision: number; present: boolean } | null>(null);
  const [copyPending, setCopyPending] = useState(false);
  const [copyFeedback, setCopyFeedback] = useState<{ revision: number; message: string } | null>(null);
  const copyRequest = useRef<AbortController | null>(null);

  const copyChecked = currentViewer && localCopy != null && localCopy.revision === myRevision;
  const hasCopy = copyChecked && localCopy.present;
  const offlineRevision = hasCopy ? myRevision : null;
  const mapRevision = currentViewer && (isOnline || requestedRevision === offlineRevision)
    ? requestedRevision : null;

  useEffect(() => {
    if (!currentViewer || myRevision == null) return;
    const subscription = liveQuery(() => readClubRouteCopy(viewerId, eventId, myRevision)).subscribe({
      next: (lines) => setLocalCopy({ revision: myRevision, present: lines.length > 0 }),
      error: () => setLocalCopy({ revision: myRevision, present: false }),
    });
    return () => subscription.unsubscribe();
  }, [currentViewer, eventId, myRevision, viewerId]);

  useEffect(() => {
    return () => { copyRequest.current?.abort(); };
  }, [currentViewer, eventId, myRevision]);

  function toggleMap(targetRevision: number) {
    setRequestedRevision((open) => open === targetRevision ? null : targetRevision);
  }

  async function toggleCopy() {
    if (!copyChecked || myRevision == null || copyRequest.current) return;
    if (!hasCopy && !isOnline) return;
    const request = new AbortController();
    copyRequest.current = request;
    setCopyPending(true);
    setCopyFeedback(null);
    const publish = (message: string) => {
      if (!request.signal.aborted) setCopyFeedback({ revision: myRevision, message });
    };
    try {
      if (hasCopy) {
        await removeClubRouteCopy(viewerId, eventId, myRevision);
        if (!isOnline && !request.signal.aborted) setRequestedRevision(null);
      } else {
        const route = await fetchRoute(eventId, myRevision, request.signal);
        // Load the Leaflet module while the connection is available.
        await import('leaflet');
        await saveClubRouteCopy(viewerId, eventId, myRevision, route, request.signal);
      }
      publish(hasCopy ? 'Copie retirée de cet appareil.' : 'Copie enregistrée sur cet appareil.');
    } catch {
      publish(hasCopy ? 'La copie n’a pas pu être retirée.'
        : 'Le tracé n’a pas pu être enregistré. Réessaie avec une connexion.');
    } finally {
      copyRequest.current = null;
      setCopyPending(false);
    }
  }

  return (
    <section id="parcours" className="lkdv-event-card lkdv-event-section" aria-label="Parcours proposé">
      <h2 className="lkdv-event-h2">{routeName || 'Parcours proposé'}</h2>
      <p className="lkdv-event-muted">
        {[
          `Révision ${revision}`,
          distanceM != null ? formatKm(distanceM / 1000) : null,
          elevationGainM != null ? formatElevationM(elevationGainM) : null,
        ].filter(Boolean).join(' · ')}
      </p>
      {isOnline && (
        <button type="button" className="lkdv-event-secondary" aria-expanded={mapRevision === revision}
          aria-controls={geometryId} disabled={!currentViewer} onClick={() => toggleMap(revision)}>
          {mapRevision === revision ? 'Masquer le tracé' : 'Voir le tracé'}
        </button>
      )}
      {(isOnline ? previousRevision : offlineRevision) != null && (
        <button type="button" className="lkdv-event-secondary" aria-expanded={mapRevision === myRevision}
          aria-controls={geometryId} disabled={!currentViewer || myRevision == null}
          onClick={() => myRevision != null && toggleMap(myRevision)}>
          {mapRevision === myRevision ? 'Masquer mon tracé adopté' : 'Voir mon tracé adopté'}
        </button>
      )}
      {copyChecked && (isOnline || hasCopy) && (
        <button type="button" className="lkdv-event-secondary" disabled={copyPending} onClick={() => void toggleCopy()}>
          {copyPending ? 'En cours…' : hasCopy ? 'Retirer la copie hors ligne' : 'Enregistrer mon tracé hors ligne'}
        </button>
      )}
      {currentViewer && copyFeedback?.revision === myRevision && (
        <p className="lkdv-event-muted" role="status">{copyFeedback.message}</p>
      )}
      {!isOnline && copyChecked && !hasCopy && (
        <p className="lkdv-event-muted">Enregistre ton tracé avec une connexion pour le retrouver hors ligne.</p>
      )}
      <div id={geometryId} hidden={mapRevision == null}>
        {mapRevision != null && mapRevision !== revision && (
          <p className="lkdv-event-muted">Tracé affiché · révision {mapRevision}</p>
        )}
        {mapRevision != null && (
          <ClubRouteTrace key={mapRevision + ':' + isOnline} eventId={eventId} viewerId={viewerId}
            revision={mapRevision} isOnline={isOnline} />
        )}
      </div>
      {canDecide && selected === null && (
        <form action={save} className="lkdv-event-actions">
          <button type="submit" name="choice" value="adopt" className="lkdv-event-primary"
            disabled={pending || !currentViewer || !isOnline}>Adopter ce tracé</button>
          <button type="submit" name="choice" value="keep" className="lkdv-event-secondary"
            disabled={pending || !currentViewer || !isOnline}>Garder mon tracé</button>
          {!isOnline && <p className="lkdv-event-muted">Connexion requise pour envoyer ton choix.</p>}
        </form>
      )}
      {selected !== null && <p className="lkdv-event-notice" role="status">
        {selected ? 'Tracé adopté.' : 'Ton tracé précédent est conservé.'}
      </p>}
      {result.error && <p className="lkdv-event-error" role="alert">{result.error}</p>}
    </section>
  );
}
