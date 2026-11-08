'use client';

import React from 'react';
import type { AgendaCounts, EventCardVM, EventFilter, EventRegistration, GeoPermissionState } from '../../shared/types';
import type { CursorFeedResult } from '../../data/useCursorFeed';
import { AgendaStrip } from '../../shared/AgendaStrip';
import { formatCountFr, groupEventsByAgenda } from '../../shared/format';
import { EventTicketV2 } from '../tiles/EventTicketV2';
import { ExploreEmpty, ExploreError, ExploreGeoPrompt, ExploreListFoot, ExploreOfflineBanner, ExploreSkeleton } from '../ExploreStates';
import { usePaneNearBottom, usePaneScrollMemory } from '../usePaneScrollMemory';
import type { EventView } from '../useExploreState';

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
      <div className="lkdv-cv2x-events-head">
        <span className="lkdv-cv2-eyebrow">Affichage</span>
        <div className="lkdv-cv2-seg" role="group" aria-label="Affichage des sorties">
          <button type="button" aria-pressed={view === 'grid'} onClick={() => onViewChange('grid')}>
            Billets
          </button>
          <button type="button" aria-pressed={view === 'list'} onClick={() => onViewChange('list')}>
            Liste
          </button>
        </div>
      </div>
    </div>
  );

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

  const groups = groupEventsByAgenda(upcoming);

  return (
    <div ref={scrollRef} className="lkdv-cv2x-pane">
      {!online ? <ExploreOfflineBanner /> : null}
      {agenda}

      {upcoming.length === 0 && past.length > 0 ? (
        <p className="lkdv-cv2x-events-empty-line">Aucune sortie à venir. Récap des sorties passées ci-dessous.</p>
      ) : null}

      {view === 'list' ? (
        groups.map((group) => (
          <div key={group.key} className="lkdv-cv2-group">
            <div className="lkdv-cv2-group-head">
              <span className="lkdv-cv2-eyebrow">
                {group.label}
                <b>{group.items.length}</b>
              </span>
            </div>
            <div className="lkdv-cv2x-event-rows">{group.items.map((event) => renderEvent(event, 'compact'))}</div>
          </div>
        ))
      ) : (
        <div className="lkdv-cv2x-event-billets">{upcoming.map((event) => renderEvent(event))}</div>
      )}

      {past.length > 0 ? (
        <div className="lkdv-cv2-group">
          <div className="lkdv-cv2-group-head">
            <span className="lkdv-cv2-eyebrow">
              Sorties passées
              <b>{past.length}</b>
            </span>
          </div>
          <div className="lkdv-cv2x-event-rows">{past.map((event) => renderEvent(event, 'compact'))}</div>
        </div>
      ) : null}

      <div ref={nearBottomRef}>
        <ExploreListFoot
          hasMore={feed.hasMore}
          loadingMore={feed.loadingMore}
          onLoadMore={feed.loadMore}
          total={feed.items.length}
          label={formatCountFr(feed.items.length, 'sortie')}
        />
      </div>
    </div>
  );
}

export default EventsPane;
