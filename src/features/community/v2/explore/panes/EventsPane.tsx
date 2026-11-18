'use client';

import React from 'react';
import Link from 'next/link';
import { getValidatedRaceRegistrationUrl, type ClubEvent, type EventFormat } from '@/features/clubs';
import type { AgendaCounts, EventCardVM, EventFilter, EventRegistration, GeoPermissionState } from '../../shared/types';
import type { CursorFeedResult } from '../../data/useCursorFeed';
import { AgendaStrip } from '../../shared/AgendaStrip';
import { formatCountFr, groupEventsByAgenda } from '../../shared/format';
import { EventTicketV2 } from '../tiles/EventTicketV2';
import { ExploreEmpty, ExploreError, ExploreGeoPrompt, ExploreOfflineBanner, ExploreSkeleton } from '../ExploreStates';
import { usePaneNearBottom, usePaneScrollMemory } from '../usePaneScrollMemory';
import type { EventView } from '../useExploreState';
import { ExploreWorldMap } from '../details/LazyExploreWorldMap';

export interface EventsPaneProps {
  feed: CursorFeedResult<EventCardVM>;
  filter: EventFilter;
  day: string | null;
  view: EventView;
  agendaCounts: AgendaCounts;
  agendaLoading: boolean;
  agendaError: string | null;
  nearState: GeoPermissionState;
  nearPointKnown: boolean;
  online: boolean;
  overrides: Record<string, EventRegistration>;
  busyEventId: string | null;
  onDayChange: (iso: string | null) => void;
  onViewChange: (view: EventView) => void;
  onFilterChange: (filter: EventFilter) => void;
  onRequestGeo: () => void;
  onOpen: (event: EventCardVM, opener: HTMLElement) => void;
  onSignup: (event: EventCardVM) => void;
  onPeek: (event: EventCardVM, opener: HTMLElement) => void;
  onCreateEvent: () => void;
  onRetryAgenda: () => void;
}

export interface EffectiveEventState {
  status: EventRegistration;
  spotsLeft: number;
  currentParticipants: number;
}

/** Statut et places effectifs d'une sortie (patch optimiste du parent). */
export function effectiveEventState(
  event: EventCardVM,
  overrides: Record<string, EventRegistration>,
): EffectiveEventState {
  const status = overrides[event.id] ?? event.myStatus;
  const wasRegistered = event.myStatus === 'registered' || event.myStatus === 'waitlist';
  const isRegistered = status === 'registered' || status === 'waitlist';
  const delta = !wasRegistered && isRegistered ? -1 : wasRegistered && !isRegistered ? 1 : 0;
  if (event.maxParticipants <= 0) {
    return {
      status,
      spotsLeft: event.spotsLeft,
      currentParticipants: Math.max(0, event.currentParticipants - delta),
    };
  }
  return {
    status,
    spotsLeft: Math.max(0, Math.min(event.maxParticipants, event.spotsLeft + delta)),
    currentParticipants: Math.max(0, Math.min(event.maxParticipants, event.currentParticipants - delta)),
  };
}

/**
 * Volet Sorties (Sorties#1-20) — bande agenda 14 jours en tête (toucher =
 * filtre), bascule Grille/Liste, billets datés ou liste groupée « Ce week-end /
 * La semaine prochaine / Plus tard », états complets/liste d'attente/inscrit,
 * pagination au défilement.
 */
export function EventsPane({
  feed,
  filter,
  day,
  view,
  agendaCounts,
  agendaLoading,
  agendaError,
  nearState,
  nearPointKnown,
  online,
  overrides,
  busyEventId,
  onDayChange,
  onViewChange,
  onFilterChange,
  onRequestGeo,
  onOpen,
  onSignup,
  onPeek,
  onCreateEvent,
  onRetryAgenda,
}: EventsPaneProps) {
  const scrollRef = usePaneScrollMemory<HTMLDivElement>(`cv2:explore:scroll:sorties:${filter}:${day ?? ''}`);
  const nearBottomRef = usePaneNearBottom<HTMLDivElement>(
    feed.hasMore && !feed.loadingMore && !feed.loading,
    feed.loadMore,
  );

  // S5.15 / S5.16 — filtres transverses sorties clubs & courses (/api/clubs/events)
  const [clubFiltersOpen, setClubFiltersOpen] = React.useState(false);
  const [clubLoc, setClubLoc] = React.useState('');
  const [clubSport, setClubSport] = React.useState('');
  const [clubFormat, setClubFormat] = React.useState<'' | EventFormat>('');
  const [racesOnly, setRacesOnly] = React.useState(false);
  const [clubEvents, setClubEvents] = React.useState<ClubEvent[]>([]);
  const [clubEventsLoading, setClubEventsLoading] = React.useState(false);
  const [clubEventsError, setClubEventsError] = React.useState<string | null>(null);

  const hasClubFilters = Boolean(clubLoc.trim() || clubSport.trim() || clubFormat || racesOnly || day);

  React.useEffect(() => {
    if (!clubFiltersOpen || !hasClubFilters) {
      setClubEvents([]);
      setClubEventsError(null);
      return;
    }
    let cancelled = false;
    setClubEventsLoading(true);
    setClubEventsError(null);
    const params = new URLSearchParams();
    if (clubLoc.trim()) params.set('location', clubLoc.trim());
    if (clubSport.trim()) params.set('sport', clubSport.trim());
    if (clubFormat) params.set('format', clubFormat);
    if (racesOnly) params.set('racesOnly', '1');
    if (day) params.set('from', `${day}T00:00:00Z`);

    fetch(`/api/clubs/events?${params.toString()}`, { credentials: 'include' })
      .then(async (res) => {
        if (!res.ok) throw new Error('Recherche clubs indisponible');
        const payload = (await res.json()) as { data?: ClubEvent[] };
        if (!cancelled) setClubEvents(Array.isArray(payload.data) ? payload.data : []);
      })
      .catch((err) => {
        if (!cancelled) setClubEventsError(err instanceof Error ? err.message : 'Erreur recherche');
      })
      .finally(() => {
        if (!cancelled) setClubEventsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [clubFiltersOpen, clubFormat, clubLoc, clubSport, day, hasClubFilters, racesOnly]);

  const agenda = (
    <div className="lkdv-cv2x-agenda-block">
      {agendaLoading && Object.keys(agendaCounts).length === 0 ? (
        <div className="lkdv-cv2x-agenda-skeleton" aria-hidden="true">
          {Array.from({ length: 7 }, (_, index) => (
            <span key={index} />
          ))}
        </div>
      ) : (
        <AgendaStrip counts={agendaCounts} value={day} onChange={onDayChange} />
      )}
      {agendaError ? (
        <button type="button" className="lkdv-cv2x-agenda-retry" onClick={onRetryAgenda}>
          Agenda indisponible · Réessayer
        </button>
      ) : null}
    </div>
  );

  if (filter === 'map') {
    return (
      <div className="lkdv-cv2x-pane lkdv-cv2x-pane--map">
        <ExploreWorldMap kind="sorties" />
      </div>
    );
  }

  if (filter === 'near' && !nearPointKnown) {
    return (
      <div ref={scrollRef} className="lkdv-cv2x-pane">
        {agenda}
        <ExploreGeoPrompt state={nearState} onRequest={onRequestGeo} />
      </div>
    );
  }

  if (feed.error && feed.items.length === 0) {
    return (
      <div ref={scrollRef} className="lkdv-cv2x-pane">
        {agenda}
        <ExploreError title="Sorties indisponibles" onRetry={feed.refresh} />
      </div>
    );
  }

  if (feed.loading && feed.items.length === 0) {
    return (
      <div ref={scrollRef} className="lkdv-cv2x-pane">
        {agenda}
        <ExploreSkeleton variant="tickets" />
      </div>
    );
  }

  if (!feed.loading && feed.items.length === 0) {
    const dayLabel = day ? 'ce jour-là' : filter === 'mine' ? 'dans tes sorties' : 'pour l’instant';
    return (
      <div ref={scrollRef} className="lkdv-cv2x-pane">
        {agenda}
        <ExploreEmpty
          icon="calendar"
          title={day ? 'Aucune sortie ce jour-là' : 'Aucune sortie'}
          description={
            day
              ? 'Choisis un autre jour dans la bande ou retire le filtre.'
              : `Aucune sortie ${dayLabel}. Organise la prochaine et invite ta cordée.`
          }
        >
          {day ? (
            <button
              type="button"
              className="lkdv-cv2-pill lkdv-cv2-pill--secondary"
              onClick={() => onDayChange(null)}
            >
              Retirer le filtre
            </button>
          ) : (
            <button type="button" className="lkdv-cv2-pill lkdv-cv2-pill--primary" onClick={onCreateEvent}>
              Organiser une sortie
            </button>
          )}
          {!day && filter !== 'discover' ? (
            <button
              type="button"
              className="lkdv-cv2-pill lkdv-cv2-pill--secondary"
              onClick={() => onFilterChange('discover')}
            >
              Découvrir
            </button>
          ) : null}
        </ExploreEmpty>
      </div>
    );
  }

  const upcoming = feed.items.filter((event) => !event.past);
  const past = feed.items.filter((event) => event.past);

  const renderEvent = (event: EventCardVM, variant: 'ticket' | 'compact' = 'ticket') => {
    const effective = effectiveEventState(event, overrides);
    return (
      <EventTicketV2
        key={event.id}
        event={event}
        status={effective.status}
        spotsLeft={effective.spotsLeft}
        busy={busyEventId === event.id}
        variant={variant}
        showDistance={filter === 'near'}
        onOpen={onOpen}
        onSignup={onSignup}
        onPeek={onPeek}
      />
    );
  };

  const allOrdered = [...upcoming, ...past];

  return (
    <div ref={scrollRef} className="lkdv-cv2x-pane">
      {!online ? <ExploreOfflineBanner /> : null}
      <div className="lkdv-cv2x-hrail" data-hscroll="" role="list" aria-label="Sorties">
        {allOrdered.map((event) => (
          <div key={event.id} className="lkdv-cv2x-hrail-item lkdv-cv2x-hrail-item--wide" role="listitem">
            {renderEvent(event)}
          </div>
        ))}
        <div ref={nearBottomRef} className="lkdv-cv2x-hrail-sentinel" aria-hidden="true" />
      </div>
    </div>
  );
}

export default EventsPane;
