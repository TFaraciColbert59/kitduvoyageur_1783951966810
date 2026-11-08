'use client';

import React, { useCallback } from 'react';
import Link from 'next/link';
import AppImage from '@/components/ui/AppImage';
import type { EventCardVM, EventRegistration } from '../../shared/types';
import {
  buildEventIcs,
  daysBetweenIso,
  eventIcsFilename,
  formatCountFr,
  formatDateFull,
  formatDateStamp,
  formatKm,
  formatTime,
  todayIso,
} from '../../shared/format';
import { useEventDetail } from '../../data/useEventDetail';
import { useHapticFeedback } from '@/hooks/useHapticFeedback';
import { PlaceMiniMap } from '../../shared/PlaceMiniMap';
import { ExploreIcon } from '../ExploreIcons';
import { ExploreError, ExploreSkeleton } from '../ExploreStates';
import { EventActionButton } from '../tiles/EventTicketV2';

export interface EventDetailViewProps {
  event: EventCardVM;
  status: EventRegistration;
  spotsLeft: number;
  busy: boolean;
  onSignup: (event: EventCardVM) => void;
}

/**
 * Détail empilé d'une sortie (Sorties#1-11, 14, 15) : billet daté, jauge de
 * places, météo du jour J (fenêtre J-7, repli silencieux), RDV sur mini-carte
 * avec « Itinéraire », organisateur, participants, sécurité, `.ics` et lien
 * vers la fiche.
 */
export function EventDetailView({ event, status, spotsLeft, busy, onSignup }: EventDetailViewProps) {
  const { haptic } = useHapticFeedback();
  const detailState = useEventDetail(event);
  const detail = detailState.detail;
  const weather = detailState.weather;
  const stamp = formatDateStamp(event.startsAt ?? `${event.eventDate}T09:00:00+01:00`);
  const time = formatTime(event.startsAt);
  const fullDate = formatDateFull(event.startsAt ?? `${event.eventDate}T12:00:00+01:00`);
  const weekdays = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
  const weekday = weekdays[new Date(`${event.eventDate}T12:00:00+01:00`).getDay()] ?? '';
  const point = detail?.meetingPointPoint ?? detail?.locationPoint ?? null;
  const mapLabel = event.meetingPoint ?? event.location;
  const daysToEvent = event.eventDate ? daysBetweenIso(todayIso(), event.eventDate) : null;

  const downloadIcs = useCallback(() => {
    if (typeof document === 'undefined' || typeof URL.createObjectURL !== 'function') return;
    const ics = buildEventIcs({
      id: event.id,
      title: event.title,
      startsAt: event.startsAt,
      endsAt: event.endsAt,
      eventDate: event.eventDate,
      location: event.location,
      description: detail?.description ?? event.description,
      meetingPoint: event.meetingPoint,
      url:
        typeof window !== 'undefined' ? `${window.location.origin}/sorties/${event.id}` : null,
    });
    const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = eventIcsFilename(event.title);
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    haptic('medium');
  }, [detail?.description, event, haptic]);

  return (
    <div className="lkdv-cv2x-event-detail">
      <div className="lkdv-cv2-ticket lkdv-cv2x-event-head" data-state={event.past ? 'past' : 'open'}>
        <span className="lkdv-cv2-ticket-stub" aria-hidden="true">
          <i className="lkdv-cv2-ticket-wd">{weekday.slice(0, 3)}.</i>
          <b className="lkdv-cv2-ticket-day">{stamp.day}</b>
          <i className="lkdv-cv2-ticket-mo">{stamp.month}</i>
          <span className="lkdv-cv2-ticket-notch lkdv-cv2-ticket-notch--top" />
          <span className="lkdv-cv2-ticket-notch lkdv-cv2-ticket-notch--bottom" />
        </span>
        <span className="lkdv-cv2-ticket-body">
          <span className="lkdv-cv2x-event-date">{fullDate}</span>
          <span className="lkdv-cv2-meta">
            {[time, event.location].filter(Boolean).join(' · ')}
          </span>
          <span className="lkdv-cv2-ticket-chips">
            {event.level ? <i>{event.level}</i> : null}
            {event.distanceKm != null ? <i>{formatKm(event.distanceKm)}</i> : null}
            {event.elevationGainM != null ? <i>+{event.elevationGainM} m</i> : null}
            {event.duration ? <i>{event.duration}</i> : null}
          </span>
        </span>
      </div>

      <h2 className="lkdv-cv2x-detail-title">{event.title}</h2>

      {detailState.loading && !detail ? (
        <ExploreSkeleton variant="rows" />
      ) : detailState.error && !detail ? (
        <ExploreError title="Sortie indisponible" onRetry={detailState.retry} />
      ) : detail ? (
        <>
          {event.past ? (
            <div className="lkdv-cv2x-signal-card">
              <ExploreIcon name="check" size={18} />
              <span>
                <b>Sortie terminée</b>
                <small>
                  {formatCountFr(event.currentParticipants, 'participant')}
                  {event.distanceKm != null ? ` · ${formatKm(event.distanceKm)}` : ''}
                  {event.elevationGainM != null ? ` · +${event.elevationGainM} m` : ''}
                </small>
              </span>
            </div>
          ) : (
            <div className="lkdv-cv2-card lkdv-cv2x-capacity-card">
              {event.maxParticipants > 0 ? (
                <span className="lkdv-cv2-capacity" data-state={spotsLeft <= 0 ? 'full' : 'open'}>
                  <span
                    className="lkdv-cv2-capacity-track"
                    role="progressbar"
                    aria-valuemin={0}
                    aria-valuemax={event.maxParticipants}
                    aria-valuenow={event.currentParticipants}
                    aria-label={`${event.currentParticipants} places prises sur ${event.maxParticipants}`}
                  >
                    <span
                      className="lkdv-cv2-capacity-fill"
                      style={{
                        width: `${Math.min(100, Math.round((event.currentParticipants / event.maxParticipants) * 100))}%`,
                      }}
                    />
                  </span>
                  <span className="lkdv-cv2-capacity-label">
                    {spotsLeft > 0
                      ? formatCountFr(spotsLeft, 'place restante', 'places restantes')
                      : event.waitlistEnabled
                        ? 'Complet · liste d’attente'
                        : 'Complet'}
                  </span>
                </span>
              ) : (
                <span className="lkdv-cv2-capacity-label">
                  {formatCountFr(event.currentParticipants, 'inscrit')} · places illimitées
                </span>
              )}
              <div className="lkdv-cv2x-capacity-row">
                <span className="lkdv-cv2-meta">
                  {formatCountFr(event.currentParticipants, 'inscrit')}
                  {event.maxParticipants > 0 ? ` sur ${event.maxParticipants}` : ''}
                </span>
                <EventActionButton
                  event={event}
                  status={status}
                  spotsLeft={spotsLeft}
                  busy={busy}
                  onSignup={onSignup}
                />
              </div>
            </div>
          )}

          {weather ? (
            <div className="lkdv-cv2-card lkdv-cv2x-weather-card">
              <ExploreIcon name="cloud" size={22} />
              <span>
                <b>
                  {weather.label} · {weather.tempMax}° / {weather.tempMin}°
                </b>
                <small>Prévu pour le {fullDate}</small>
              </span>
            </div>
          ) : !event.past && daysToEvent != null && daysToEvent > 7 ? (
            <p className="lkdv-cv2-meta lkdv-cv2x-weather-hint">
              Prévisions disponibles à partir de J-7 ({daysToEvent - 7} {daysToEvent - 7 > 1 ? 'jours' : 'jour'}{' '}
              restants).
            </p>
          ) : null}

          {point ? (
            <div className="lkdv-cv2-card lkdv-cv2x-rdv-card">
              <span className="lkdv-cv2-eyebrow">Rendez-vous</span>
              <PlaceMiniMap
                lat={point.lat}
                lng={point.lng}
                label={mapLabel}
                height={150}
                itinerary
                interactive
              />
              <div className="lkdv-cv2x-rdv-line">
                <span>
                  <b>{mapLabel}</b>
                  <small>{[time, event.location].filter(Boolean).join(' · ')}</small>
                </span>
                <a
                  className="lkdv-cv2-pill lkdv-cv2-pill--secondary lkdv-cv2-pill--sm"
                  href={`https://www.google.com/maps/dir/?api=1&destination=${point.lat},${point.lng}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Itinéraire
                </a>
              </div>
            </div>
          ) : null}

          <span className="lkdv-cv2-eyebrow">Organisateur</span>
          <div className="lkdv-cv2-card lkdv-cv2x-organizer">
            <span className="lkdv-cv2-avatar lkdv-cv2x-organizer-avatar" aria-hidden="true">
              {event.organizer.avatarUrl ? (
                <AppImage
                  src={event.organizer.avatarUrl}
                  alt=""
                  width={32}
                  height={32}
                  className="lkdv-cv2x-avatar-img"
                />
              ) : (
                event.organizer.initials
              )}
            </span>
            <span>
              <b>{event.organizer.name}</b>
              <small>Organisateur</small>
            </span>
          </div>

          <div className="lkdv-cv2-card">
            <span className="lkdv-cv2-eyebrow">Participants</span>
            <div className="lkdv-cv2x-participants-row">
              <span className="lkdv-cv2-avatars" aria-hidden="true">
                {detail.participants.map((participant) => (
                  <span key={participant.id || participant.name} className="lkdv-cv2-avatar">
                    {participant.avatarUrl ? (
                      <AppImage
                        src={participant.avatarUrl}
                        alt=""
                        width={28}
                        height={28}
                        className="lkdv-cv2x-avatar-img"
                      />
                    ) : (
                      participant.initials
                    )}
                  </span>
                ))}
              </span>
              <span className="lkdv-cv2-meta">
                {formatCountFr(detail.participantsTotal, 'inscrit')}
                {detail.waitlistCount > 0
                  ? ` · ${formatCountFr(detail.waitlistCount, 'en liste d’attente', 'en liste d’attente')}`
                  : ''}
              </span>
            </div>
          </div>

          {detail.description ? <p className="lkdv-cv2x-detail-text">{detail.description}</p> : null}

          {detail.safetyNotes || detail.safetyChecklist.length > 0 ? (
            <>
              <span className="lkdv-cv2-eyebrow">Sécurité</span>
              <div className="lkdv-cv2-card">
                {detail.safetyNotes ? <p className="lkdv-cv2x-detail-text">{detail.safetyNotes}</p> : null}
                {detail.safetyChecklist.length > 0 ? (
                  <div className="lkdv-cv2-chips">
                    {detail.safetyChecklist.map((item) => (
                      <span key={item} className="lkdv-cv2-chip lkdv-cv2-chip--sm">
                        {item}
                      </span>
                    ))}
                  </div>
                ) : null}
              </div>
            </>
          ) : null}

          <div className="lkdv-cv2x-detail-actions lkdv-cv2x-event-actions">
            {!event.past ? (
              <button
                type="button"
                className="lkdv-cv2-pill lkdv-cv2-pill--secondary"
                onClick={downloadIcs}
                data-testid="cv2-event-ics"
              >
                <ExploreIcon name="calendar" size={15} />
                Ajouter au calendrier
              </button>
            ) : null}
            <Link className="lkdv-cv2-pill lkdv-cv2-pill--secondary" href={`/sorties/${event.id}`}>
              Voir la fiche de la sortie
            </Link>
          </div>
        </>
      ) : null}
    </div>
  );
}

export default EventDetailView;
