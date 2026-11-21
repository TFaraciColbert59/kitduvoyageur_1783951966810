'use client';

import { useActionState, useId, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import HubRouteMap from '@/features/hub/components/mobile/HubRouteMap';
import { formatElevationM, formatKm } from '@/features/community/v2/shared/format';
import { saveClubRouteDecision } from './clubRouteDecisionAction';

type Segments = Array<Array<[number, number]>>;
const EMPTY_ROUTE: Array<[number, number]> = [];

function readSegments(value: unknown): Segments {
  if (!value || typeof value !== 'object' || !('coordinates' in value) || !Array.isArray(value.coordinates)) return [];
  return value.coordinates
    .flatMap((line): Segments => Array.isArray(line) ? [line.flatMap((point): Array<[number, number]> =>
      Array.isArray(point) && Number.isFinite(point[0]) && Number.isFinite(point[1]) ? [[point[1], point[0]]] : [],
    )] : [])
    .filter((line) => line.length > 1);
}

export default function ClubEventRouteProposal({
  eventId,
  revision,
  routeName,
  distanceM,
  elevationGainM,
  canDecide,
  decision,
  adoptedRevision,
}: {
  eventId: string;
  revision: number;
  routeName: string | null;
  distanceM: number | null;
  elevationGainM: number | null;
  canDecide: boolean;
  decision: boolean | null;
  adoptedRevision: number | null;
}) {
  const geometryId = useId();
  const [result, save, pending] = useActionState(saveClubRouteDecision.bind(null, eventId, revision), {});
  const [mapRevision, setMapRevision] = useState<number | null>(null);
  const [segments, setSegments] = useState<Segments>([]);
  const [loading, setLoading] = useState(false);
  const [mapError, setMapError] = useState(false);
  const selected = result.adopted ?? decision;

  async function toggleMap(targetRevision: number) {
    if (loading) return;
    if (mapRevision === targetRevision) {
      setMapRevision(null);
      return;
    }
    setMapRevision(targetRevision);
    setSegments([]);
    setLoading(true);
    setMapError(false);
    try {
      const { data, error } = await createClient().rpc('get_club_event_route_trace', {
        p_event_id: eventId, p_revision: targetRevision,
      });
      const next = error ? [] : readSegments(data);
      if (next.length) setSegments(next);
      else setMapError(true);
    } catch {
      setMapError(true);
    } finally {
      setLoading(false);
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
      <button type="button" className="lkdv-event-secondary" aria-expanded={mapRevision === revision}
        aria-controls={geometryId} disabled={loading} onClick={() => void toggleMap(revision)}>
        {mapRevision === revision ? 'Masquer le tracé' : 'Voir le tracé'}
      </button>
      {adoptedRevision != null && adoptedRevision < revision && selected !== true && (
        <button type="button" className="lkdv-event-secondary" aria-expanded={mapRevision === adoptedRevision}
          aria-controls={geometryId} disabled={loading} onClick={() => void toggleMap(adoptedRevision)}>
          {mapRevision === adoptedRevision ? 'Masquer mon tracé adopté' : 'Voir mon tracé adopté'}
        </button>
      )}
      <div id={geometryId} hidden={mapRevision == null}>
        {mapRevision != null && mapRevision !== revision && (
          <p className="lkdv-event-muted">Tracé affiché · révision {mapRevision}</p>
        )}
        {mapRevision != null && (segments.length > 0 ? (
          <div className="lkdv-event-route-map">
            <HubRouteMap key={mapRevision} routeCoords={EMPTY_ROUTE} routeSegments={segments} interactive />
          </div>
        ) : (
          <p className="lkdv-event-muted" role="status">
            {mapError ? 'Ce tracé est indisponible.' : 'Chargement du tracé…'}
          </p>
        ))}
      </div>
      {canDecide && selected === null && (
        <form action={save} className="lkdv-event-actions">
          <button type="submit" name="choice" value="adopt" className="lkdv-event-primary" disabled={pending}>
            Adopter ce tracé
          </button>
          <button type="submit" name="choice" value="keep" className="lkdv-event-secondary" disabled={pending}>
            Garder mon tracé
          </button>
        </form>
      )}
      {selected !== null && <p className="lkdv-event-notice" role="status">
        {selected ? 'Tracé adopté.' : 'Ton tracé précédent est conservé.'}
      </p>}
      {result.error && <p className="lkdv-event-error" role="alert">{result.error}</p>}
    </section>
  );
}
