'use client';

import React, { useMemo, useState } from 'react';

import {
  getValidatedRaceRegistrationUrl,
  searchClubEvents,
  type Club,
  type ClubEvent,
  type ClubMember,
  type EventFormat,
  type EventRegistration,
  type EventSearchQuery,
  type ViewerPrivacyContext,
} from '@/features/clubs';
import {
  EVENT_FORMAT_LABELS,
  eventCapacity,
  eventCapacityFromCounts,
  eventRsvpStatus,
  formatDayMonth,
  formatEventTimeRange,
  sortEventsForDisplay,
} from './model';
import type { EventCounts } from './model';
import styles from './g02.module.css';

function cx(...values: Array<string | false | null | undefined>): string {
  return values.filter(Boolean).join(' ');
}

const FORMAT_OPTIONS: EventFormat[] = ['social_ride', 'training', 'race', 'trail_outing', 'indoor'];

export interface ClubEventsBoardProps {
  events: readonly ClubEvent[];
  clubsById: ReadonlyMap<string, Club> | Record<string, Club>;
  memberships: readonly ClubMember[];
  viewerContext: ViewerPrivacyContext;
  registrations: readonly EventRegistration[];
  eventCounts?: Readonly<Record<string, EventCounts>>;
  currentUserId: string | null;
  nowIso: string;
  loading?: boolean;
  error?: string | null;
  onRegister: (event: ClubEvent, paceGroupId?: string | null) => Promise<void> | void;
  onCancel: (event: ClubEvent) => Promise<void> | void;
  onOpen?: (event: ClubEvent) => void;
  onRetry?: () => void;
}

/**
 * K5.21 / S5.13–S5.16 — tableau des sorties d’un club.
 *
 * La liste est filtrée par `searchClubEvents`, qui applique la confidentialité
 * du club, la visibilité P01 de la sortie et les blocages S6.19. Un événement
 * refusé par le contrat n’entre jamais dans le DOM.
 */
export function ClubEventsBoard({
  events,
  clubsById,
  memberships,
  viewerContext,
  registrations,
  eventCounts,
  currentUserId,
  nowIso,
  loading = false,
  error = null,
  onRegister,
  onCancel,
  onOpen,
  onRetry,
}: ClubEventsBoardProps) {
  const [text, setText] = useState('');
  const [format, setFormat] = useState<EventFormat | ''>('');
  const [sport, setSport] = useState('');
  const [racesOnly, setRacesOnly] = useState(false);
  const [fromIso, setFromIso] = useState('');
  const [pendingEventId, setPendingEventId] = useState<string | null>(null);

  const sports = useMemo(() => {
    const values = new Set<string>();
    for (const event of events) {
      if (event.sport) values.add(event.sport);
    }
    return [...values].sort((a, b) => a.localeCompare(b, 'fr'));
  }, [events]);

  const query: EventSearchQuery = useMemo(
    () => ({
      text: text.trim() || undefined,
      sport: sport || undefined,
      format: format || undefined,
      racesOnly: racesOnly || undefined,
      fromIso: fromIso ? `${fromIso}T00:00:00.000Z` : undefined,
    }),
    [format, fromIso, racesOnly, sport, text],
  );

  const visibleEvents = useMemo(
    () =>
      sortEventsForDisplay(
        searchClubEvents({
          events,
          clubsById,
          memberships,
          viewerContext,
          query,
        }),
      ),
    [clubsById, events, memberships, query, viewerContext],
  );

  const resetFilters = () => {
    setText('');
    setFormat('');
    setSport('');
    setRacesOnly(false);
    setFromIso('');
  };

  const runRegistration = async (event: ClubEvent, paceGroupId?: string | null) => {
    setPendingEventId(event.id);
    try {
      await onRegister(event, paceGroupId ?? null);
    } finally {
      setPendingEventId(null);
    }
  };

  const runCancel = async (event: ClubEvent) => {
    setPendingEventId(event.id);
    try {
      await onCancel(event);
    } finally {
      setPendingEventId(null);
    }
  };

  if (loading) {
    return (
      <section className={styles.screen} aria-busy="true" aria-label="Chargement des sorties">
        <div className={styles.skeleton} />
        <div className={styles.skeleton} />
      </section>
    );
  }

  if (error) {
    return (
      <section className={styles.screen}>
        <div className={styles.alert} role="alert">
          <span aria-hidden="true">⚠</span>
          <div className={styles.grow}>
            <strong>Les sorties n’ont pas pu être chargées.</strong>
            <p className={styles.tiny} style={{ margin: '2px 0 8px' }}>
              {error}
            </p>
            {onRetry ? (
              <button type="button" className={cx(styles.button, styles.small)} onClick={onRetry}>
                Réessayer
              </button>
            ) : null}
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className={styles.screen} aria-label="Sorties du club">
      <div className={styles.sectionHeader}>
        <div>
          <p className={styles.eyebrow}>Sorties · K5.21</p>
          <h2 className={styles.title}>Prochaines sorties</h2>
          <p className={styles.subtitle}>
            Les sorties d’un club fermé ou secret ne sont visibles que par ses membres actifs.
          </p>
        </div>
        <span className={styles.badge} aria-live="polite">
          {visibleEvents.length} sortie{visibleEvents.length > 1 ? 's' : ''}
        </span>
      </div>

      <div className={cx(styles.card, styles.cardFlat)}>
        <div className={styles.filters}>
          <div className={styles.field}>
            <label className={styles.label} htmlFor="club-events-search">
              Rechercher
            </label>
            <input
              id="club-events-search"
              className={styles.input}
              value={text}
              onChange={(event) => setText(event.target.value)}
              placeholder="Titre, lieu, description…"
              type="search"
            />
          </div>
          <div className={styles.field}>
            <label className={styles.label} htmlFor="club-events-format">
              Format
            </label>
            <select
              id="club-events-format"
              className={styles.select}
              value={format}
              onChange={(event) => setFormat(event.target.value as EventFormat | '')}
            >
              <option value="">Tous les formats</option>
              {FORMAT_OPTIONS.map((value) => (
                <option key={value} value={value}>
                  {EVENT_FORMAT_LABELS[value]}
                </option>
              ))}
            </select>
          </div>
          <div className={styles.field}>
            <label className={styles.label} htmlFor="club-events-sport">
              Sport
            </label>
            <select
              id="club-events-sport"
              className={styles.select}
              value={sport}
              onChange={(event) => setSport(event.target.value)}
            >
              <option value="">Tous les sports</option>
              {sports.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </div>
          <div className={styles.field}>
            <label className={styles.label} htmlFor="club-events-from">
              À partir du
            </label>
            <input
              id="club-events-from"
              className={styles.input}
              value={fromIso}
              onChange={(event) => setFromIso(event.target.value)}
              type="date"
            />
          </div>
          <label className={styles.inlineCheck}>
            <input
              type="checkbox"
              checked={racesOnly}
              onChange={(event) => setRacesOnly(event.target.checked)}
            />
            Courses uniquement
          </label>
        </div>
        {(text || format || sport || racesOnly || fromIso) && (
          <div>
            <button type="button" className={cx(styles.linkButton, styles.tiny)} onClick={resetFilters}>
              Réinitialiser les filtres
            </button>
          </div>
        )}
      </div>

      {visibleEvents.length === 0 ? (
        <div className={styles.empty}>
          <p className={styles.emptyTitle}>
            {text || format || sport || racesOnly || fromIso
              ? 'Aucune sortie ne correspond'
              : 'Aucune sortie programmée'}
          </p>
          <p className={styles.emptyHint}>
            {text || format || sport || racesOnly || fromIso
              ? 'Élargissez la recherche, le format ou la date de départ.'
              : 'Les organisateurs du club n’ont pas encore publié de sortie visible pour vous.'}
          </p>
          {text || format || sport || racesOnly || fromIso ? (
            <button type="button" className={cx(styles.button, styles.small)} onClick={resetFilters}>
              Tout afficher
            </button>
          ) : null}
        </div>
      ) : (
        <ul className={styles.list}>
          {visibleEvents.map((event) => {
            const counts = eventCounts?.[event.id];
            const capacity = counts ? eventCapacityFromCounts(event, counts) : eventCapacity(event, registrations);
            const rsvp = eventRsvpStatus(event.id, currentUserId, registrations);
            const raceUrl = getValidatedRaceRegistrationUrl(event);
            const isPast = Date.parse(event.startsAt) < Date.parse(nowIso);
            const busy = pendingEventId === event.id;
            return (
              <li key={event.id}>
                <article className={styles.card} aria-label={event.title}>
                  <div className={styles.cardHeader}>
                    <div className={styles.eventDate} aria-hidden="true">
                      <span>{formatDayMonth(event.startsAt).split(' ')[1] ?? ''}</span>
                      <strong>{formatDayMonth(event.startsAt).split(' ')[0] ?? '—'}</strong>
                    </div>
                    <div className={styles.grow}>
                      <div className={styles.wrap}>
                        <span className={styles.badge}>{EVENT_FORMAT_LABELS[event.format]}</span>
                        <span className={styles.badge}>{event.sport}</span>
                        {capacity.isFull ? (
                          <span className={cx(styles.badge, styles.badgeWarn)}>
                            {capacity.waitlistOpen ? 'Complet · liste d’attente' : 'Complet'}
                          </span>
                        ) : null}
                        {isPast ? <span className={styles.badge}>Passée</span> : null}
                      </div>
                      <h3 className={styles.cardTitle} style={{ marginTop: 6 }}>
                        {onOpen ? (
                          <button type="button" className={styles.linkButton} onClick={() => onOpen(event)}>
                            {event.title}
                          </button>
                        ) : (
                          event.title
                        )}
                      </h3>
                      <p className={styles.cardMeta}>
                        {formatEventTimeRange(event.startsAt, event.endsAt)} · {event.locationLabel}
                      </p>
                      {event.description ? (
                        <p className={styles.cardMeta} style={{ marginTop: 4 }}>
                          {event.description}
                        </p>
                      ) : null}
                    </div>
                  </div>

                  <div className={styles.wrap}>
                    <span className={styles.badge}>
                      {capacity.registered}
                      {event.maxParticipants !== null ? ` / ${event.maxParticipants}` : ''} inscrit
                      {capacity.registered > 1 ? 's' : ''}
                    </span>
                    {capacity.waitlist > 0 ? (
                      <span className={styles.badge}>{capacity.waitlist} en attente</span>
                    ) : null}
                    {event.paceGroups.length > 0 ? (
                      <span className={styles.badge}>{event.paceGroups.length} groupe(s) d’allure</span>
                    ) : null}
                    {capacity.remaining !== null && capacity.remaining > 0 && !isPast ? (
                      <span className={styles.badge}>{capacity.remaining} place(s) restante(s)</span>
                    ) : null}
                  </div>

                  {event.paceGroups.length > 0 ? (
                    <div className={styles.wrap}>
                      {event.paceGroups.map((group) => (
                        <span key={group.id} className={styles.badge}>
                          {group.label} · {group.targetPaceLabel}
                        </span>
                      ))}
                    </div>
                  ) : null}

                  <div className={styles.rowBetween}>
                    <p className={styles.tiny} style={{ margin: 0 }}>
                      {rsvp === 'registered'
                        ? 'Vous êtes inscrit·e.'
                        : rsvp === 'waitlist'
                          ? 'Vous êtes en liste d’attente.'
                          : capacity.isFull && capacity.waitlistOpen
                            ? 'Les places sont prises ; inscrivez-vous en liste d’attente.'
                            : capacity.isFull
                              ? 'Complet.'
                              : 'Inscription ouverte.'}
                    </p>
                    <div className={styles.wrap}>
                      {raceUrl ? (
                        <a
                          className={cx(styles.button, styles.small)}
                          href={raceUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          S’inscrire à la course
                        </a>
                      ) : null}
                      {!isPast && rsvp === 'none' ? (
                        <button
                          type="button"
                          className={cx(styles.button, styles.small, styles.primary)}
                          onClick={() => void runRegistration(event)}
                          disabled={busy || (capacity.isFull && !capacity.waitlistOpen)}
                        >
                          {busy
                            ? 'Inscription…'
                            : capacity.isFull && capacity.waitlistOpen
                              ? 'Rejoindre la liste d’attente'
                              : 'S’inscrire'}
                        </button>
                      ) : null}
                      {!isPast && rsvp !== 'none' ? (
                        <button
                          type="button"
                          className={cx(styles.button, styles.small)}
                          onClick={() => void runCancel(event)}
                          disabled={busy}
                        >
                          {busy ? 'Annulation…' : 'Se désinscrire'}
                        </button>
                      ) : null}
                    </div>
                  </div>
                </article>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

export default ClubEventsBoard;
