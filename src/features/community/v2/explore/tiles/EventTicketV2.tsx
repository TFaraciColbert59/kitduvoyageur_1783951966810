'use client';

import React from 'react';
import { EventTicket } from '../../shared/EventTicket';
import type { EventCardVM, EventRegistration } from '../../shared/types';
import { formatDateShort, formatDateStamp, formatKm, formatTime } from '../../shared/format';
import { ExploreIcon } from '../ExploreIcons';
import { useLongPress } from '../useLongPress';

export type EventRegistrationState = EventRegistration;

export interface EventTicketV2Props {
  event: EventCardVM;
  /** Statut effectif (mémoire optimiste du parent). */
  status: EventRegistrationState;
  /** Places restantes effectives (mutation optimiste incluse). */
  spotsLeft: number;
  /** Inscription/désinscription en cours : bouton occupé. */
  busy?: boolean;
  /** `ticket` (grille) ou `compact` (liste groupée par agenda). */
  variant?: 'ticket' | 'compact';
  showDistance?: boolean;
  onOpen: (event: EventCardVM, opener: HTMLElement) => void;
  onSignup: (event: EventCardVM) => void;
  onPeek: (event: EventCardVM, opener: HTMLElement) => void;
}

export interface EventActionLabel {
  label: string;
  aria: string;
  disabled: boolean;
  tone: 'join' | 'member' | 'waitlist' | 'full' | 'past';
}

export function eventActionLabel(event: EventCardVM, status: EventRegistrationState, spotsLeft: number): EventActionLabel {
  if (event.past) {
    return { label: 'Terminée', aria: `${event.title} est terminée`, disabled: true, tone: 'past' };
  }
  if (status === 'registered') {
    return {
      label: 'Inscrit ✓',
      aria: `Inscrit à ${event.title}. Ouvrir les actions pour se désinscrire`,
      disabled: false,
      tone: 'member',
    };
  }
  if (status === 'waitlist') {
    return {
      label: 'En liste d’attente',
      aria: `En liste d’attente pour ${event.title}. Ouvrir les actions pour quitter la liste`,
      disabled: false,
      tone: 'waitlist',
    };
  }
  const unlimited = event.maxParticipants <= 0;
  if (!unlimited && spotsLeft <= 0) {
    if (event.waitlistEnabled) {
      return {
        label: 'Liste d’attente',
        aria: `Rejoindre la liste d’attente de ${event.title}`,
        disabled: false,
        tone: 'waitlist',
      };
    }
    return { label: 'Complet', aria: `${event.title} est complet`, disabled: true, tone: 'full' };
  }
  return { label: 'S’inscrire', aria: `S’inscrire à ${event.title}`, disabled: false, tone: 'join' };
}

export function EventActionButton({
  event,
  status,
  spotsLeft,
  busy,
  onSignup,
}: Pick<EventTicketV2Props, 'event' | 'busy' | 'onSignup'> & {
  status: EventRegistrationState;
  spotsLeft: number;
}) {
  const action = eventActionLabel(event, status, spotsLeft);
  return (
    <button
      type="button"
      className="lkdv-cv2x-join lkdv-cv2x-register"
      data-state={status}
      data-tone={action.tone}
      aria-pressed={status === 'registered' || status === 'waitlist'}
      aria-label={action.aria}
      aria-busy={busy || undefined}
      disabled={busy || action.disabled}
      onClick={(clickEvent) => {
        clickEvent.stopPropagation();
        if (action.disabled) return;
        onSignup(event);
      }}
      data-testid="cv2-event-register"
      data-id={event.id}
    >
      {busy ? (
        <i className="lkdv-cv2x-spinner" aria-hidden="true" />
      ) : action.tone === 'join' ? (
        <ExploreIcon name="plus" size={15} />
      ) : action.tone === 'waitlist' ? (
        <ExploreIcon name="clock" size={15} />
      ) : action.tone === 'full' ? (
        <ExploreIcon name="lock" size={15} />
      ) : null}
      <span>{busy ? 'Envoi…' : action.label}</span>
    </button>
  );
}

/**
 * Billet de sortie du volet Sorties (Sorties#1-6, 8-11, 19-20) : billet daté
 * (EventTicket partagé) + bouton d'inscription de 44 px hors du lien, ou ligne
 * compacte pour la liste groupée par agenda. La tuile est un lien vers la
 * fiche `/sorties/<id>`, intercepté pour ouvrir le détail empilé ; l'appui long
 * ouvre le Peek.
 */
export function EventTicketV2({
  event,
  status,
  spotsLeft,
  busy = false,
  variant = 'ticket',
  showDistance = false,
  onOpen,
  onSignup,
  onPeek,
}: EventTicketV2Props) {
  const longPress = useLongPress({ onLongPress: (element) => onPeek(event, element) });
  const effectiveEvent: EventCardVM = {
    ...event,
    myStatus: status,
    spotsLeft: event.maxParticipants > 0 ? Math.max(0, spotsLeft) : event.spotsLeft,
  };

  if (variant === 'compact') {
    const stamp = formatDateStamp(event.startsAt ?? `${event.eventDate}T09:00:00+01:00`);
    const time = formatTime(event.startsAt);
    const metaParts = [
      formatDateShort(event.eventDate ? `${event.eventDate}T12:00:00+01:00` : event.startsAt),
      time,
      event.location,
      showDistance && event.distanceKmFromMe != null ? `à ${formatKm(event.distanceKmFromMe)}` : null,
    ].filter(Boolean);
    return (
      <article
        className="lkdv-cv2x-event-row"
        data-testid="cv2-tile-sortie"
        data-id={event.id}
        {...longPress}
        onClickCapture={(domEvent) => {
          const anchor = (domEvent.target as Element).closest('a.lkdv-cv2x-event-row-link');
          if (!anchor) return;
          domEvent.preventDefault();
          domEvent.stopPropagation();
          onOpen(event, domEvent.currentTarget);
        }}
      >
        <a
          className="lkdv-cv2x-event-row-link"
          href={`/sorties/${event.id}`}
          aria-label={`${event.title}, ${metaParts.join(', ')}`}
        >
          <span className="lkdv-cv2x-event-row-stamp" aria-hidden="true">
            <b>{stamp.day}</b>
            <i>{stamp.month}</i>
          </span>
          <span className="lkdv-cv2x-event-row-body">
            <span className="lkdv-cv2-title lkdv-cv2-title--clamp1">{event.title}</span>
            <span className="lkdv-cv2-meta">{metaParts.join(' · ')}</span>
          </span>
        </a>
        <EventActionButton event={event} status={status} spotsLeft={spotsLeft} busy={busy} onSignup={onSignup} />
      </article>
    );
  }

  return (
    <article
      className="lkdv-cv2x-event"
      data-testid="cv2-tile-sortie"
      data-id={event.id}
      {...longPress}
      onClickCapture={(domEvent) => {
        const anchor = (domEvent.target as Element).closest('a.lkdv-cv2-ticket');
        if (!anchor) return;
        domEvent.preventDefault();
        domEvent.stopPropagation();
        onOpen(event, domEvent.currentTarget);
      }}
    >
      <EventTicket event={effectiveEvent} />
      <div className="lkdv-cv2x-event-action">
        <EventActionButton event={event} status={status} spotsLeft={spotsLeft} busy={busy} onSignup={onSignup} />
      </div>
    </article>
  );
}

export default EventTicketV2;
