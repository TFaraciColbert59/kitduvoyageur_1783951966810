import React from 'react';
import type { EventCardVM } from './types';
import {
  formatCountFr,
  formatDateFull,
  formatDateStamp,
  formatElevationM,
  formatInt,
  formatKm,
  formatTime,
} from './format';

export type EventTicketVariant = 'tile' | 'preview';

export interface EventTicketProps {
  event: EventCardVM;
  /** `tile` : entrée de liste (lien). `preview` : aperçu vivant de formulaire. */
  variant?: EventTicketVariant;
  /** Destination du lien en tuile (défaut : `/sorties/<id>`). */
  href?: string;
  /** Masque la jauge de places (aperçu compact, fiche). */
  showCapacity?: boolean;
  /**
   * Ouvre la fiche en détail empilé (le `href` reste la destination de repli :
   * navigation clavier, nouvel onglet et clic sans JS conservent `/sorties/<id>`).
   */
  onOpen?: () => void;
  className?: string;
}

type TicketState = 'open' | 'full' | 'waitlist' | 'registered' | 'past';

/** Hash stable (aucun état, aucune dépendance) : décore le topo du billet. */
function ticketHash(value: string): number {
  let out = 11;
  for (let index = 0; index < value.length; index += 1) {
    out = (out * 31 + value.charCodeAt(index)) >>> 0;
  }
  return out;
}

/**
 * Topo décoratif du billet (Sorties#1 : « cartouche jour et mois à gauche…
 * et topo de la sortie à droite »). Purement décoratif et déterministe :
 * aucune donnée réelle n'est inventée, `aria-hidden`.
 */
function TicketTopo({ seed }: { seed: string }) {
  const hashValue = ticketHash(seed || 'sortie');
  const shift = hashValue % 7;
  const wobble = hashValue % 5;
  const route = `M6 ${46 - shift} L24 ${30 - shift} L40 ${36 - shift} L58 ${18 + wobble} L76 ${
    26 - shift
  } L94 ${12 + wobble}`;
  return (
    <span className="lkdv-cv2-ticket-side lkdv-cv2-ticket-topo" aria-hidden="true">
      <svg viewBox="0 0 100 60" preserveAspectRatio="xMidYMid slice" focusable="false">
        <path className="lkdv-cv2-ticket-topo-line" d={`M-8 ${14 + shift} C 18 ${4 + shift}, 58 ${
          30 + shift
        }, 108 ${10 + shift}`} />
        <path className="lkdv-cv2-ticket-topo-line" d={`M-8 ${34 + shift} C 22 ${22 + shift}, 62 ${
          48 + shift
        }, 108 ${26 + shift}`} />
        <path className="lkdv-cv2-ticket-topo-line" d={`M-8 ${52 + shift} C 26 ${40 + shift}, 66 ${
          60 + shift
        }, 108 ${44 + shift}`} />
        <path className="lkdv-cv2-ticket-route" d={route} />
        <circle className="lkdv-cv2-ticket-dot" cx="6" cy={46 - shift} r="2.4" />
        <circle className="lkdv-cv2-ticket-dot lkdv-cv2-ticket-dot--end" cx="94" cy={12 + wobble} r="2.4" />
      </svg>
    </span>
  );
}

function resolveState(event: EventCardVM): TicketState {
  if (event.past) return 'past';
  if (event.myStatus === 'waitlist') return 'waitlist';
  if (event.myStatus === 'registered') return 'registered';
  if (event.spotsLeft <= 0) return 'full';
  return 'open';
}

function startIso(event: EventCardVM): string | null {
  if (event.startsAt) return event.startsAt;
  if (event.eventDate) return `${event.eventDate.slice(0, 10)}T09:00:00+01:00`;
  return null;
}

function spokeDate(fullDate: string): string {
  if (!fullDate || fullDate.startsWith('Date')) return '';
  return `${fullDate.split(' ')[0]?.slice(0, 3)}.`;
}

/**
 * Billet daté de sortie (signature du volet Sorties).
 *
 * - cartouche jour/mois à gauche, façon tampon de billet (encoches + pointillés) ;
 * - titre 600 14 px, méta 10,5 px, chips de niveau / distance / D+ / durée ;
 * - états lisibles : complet, liste d'attente, inscrit, passé ;
 * - variante `preview` pour l'aperçu vivant du formulaire (pas de lien, pas de pied) ;
 * - entièrement en jetons (`lkdv-cv2-ticket*` de `src/styles/communaute-v2.css`).
 */
export function EventTicket({
  event,
  variant = 'tile',
  href,
  showCapacity = true,
  onOpen,
  className,
}: EventTicketProps) {
  const start = startIso(event);
  const stamp = formatDateStamp(start);
  const fullDate = formatDateFull(start);
  const time = formatTime(start);
  const weekday = spokeDate(fullDate);
  const state = resolveState(event);

  const chips: React.ReactNode[] = [];
  if (event.level) chips.push(<i key="level">{event.level}</i>);
  if (event.distanceKm != null) chips.push(<i key="km">{formatKm(event.distanceKm)}</i>);
  if (event.elevationGainM != null) chips.push(<i key="dplus">{formatElevationM(event.elevationGainM)}</i>);
  if (event.duration) chips.push(<i key="duration">{event.duration}</i>);

  const meta = [
    time,
    event.location,
    event.distanceKmFromMe != null ? `à ${formatKm(event.distanceKmFromMe)}` : '',
  ]
    .filter(Boolean)
    .join(' · ');

  const ariaLabel = [
    event.title,
    fullDate,
    time ? `à ${time.replace(':', ' h ')}` : '',
    event.location,
    event.level ? `niveau ${event.level}` : '',
    event.distanceKm != null ? formatKm(event.distanceKm) : '',
    event.elevationGainM != null ? `${formatElevationM(event.elevationGainM)} de dénivelé` : '',
    state === 'past' ? 'terminée' : state === 'full' ? 'complet' : state === 'waitlist' ? 'liste d’attente' : '',
  ]
    .filter(Boolean)
    .join(', ');

  const percentage =
    event.maxParticipants > 0
      ? Math.min(100, Math.max(0, Math.round((event.currentParticipants / event.maxParticipants) * 100)))
      : 0;

  const statusBadge =
    state === 'past' ? (
      <span className="lkdv-cv2-badge">Terminée</span>
    ) : state === 'full' ? (
      <span className="lkdv-cv2-badge">Complet</span>
    ) : state === 'waitlist' ? (
      <span className="lkdv-cv2-badge" data-tone="accent">
        Liste d’attente
      </span>
    ) : state === 'registered' ? (
      <span className="lkdv-cv2-badge" data-tone="success">
        Inscrit
      </span>
    ) : (
      <span className="lkdv-cv2-capacity-label">
        {formatCountFr(event.spotsLeft, 'place restante', 'places restantes')}
      </span>
    );

  const rootClassName =
    variant === 'preview'
      ? `lkdv-cv2-ticket is-preview${className ? ` ${className}` : ''}`
      : `lkdv-cv2-ticket${className ? ` ${className}` : ''}`;

  const body = (
    <>
      <span
        className={
          variant === 'tile'
            ? 'lkdv-cv2-ticket-main lkdv-cv2-ticket-main--topo'
            : 'lkdv-cv2-ticket-main'
        }
      >
        <span className="lkdv-cv2-ticket-stub" aria-hidden="true">
          {weekday ? <i className="lkdv-cv2-ticket-wd">{weekday}</i> : null}
          <b className="lkdv-cv2-ticket-day">{stamp.day}</b>
          <i className="lkdv-cv2-ticket-mo">{stamp.month}</i>
          <span className="lkdv-cv2-ticket-notch lkdv-cv2-ticket-notch--top" />
          <span className="lkdv-cv2-ticket-notch lkdv-cv2-ticket-notch--bottom" />
        </span>
        <span className="lkdv-cv2-ticket-body">
          <span className="lkdv-cv2-ticket-title">{event.title}</span>
          {chips.length > 0 ? <span className="lkdv-cv2-ticket-chips">{chips}</span> : null}
          {meta ? <span className="lkdv-cv2-ticket-meta">{meta}</span> : null}
        </span>
        {variant === 'tile' ? <TicketTopo seed={event.id} /> : null}
      </span>
      {variant === 'tile' ? (
        <span className="lkdv-cv2-ticket-foot">
          {state === 'past' ? (
            <span className="lkdv-cv2-capacity-label">
              {formatCountFr(event.currentParticipants, 'participant')}
            </span>
          ) : showCapacity && event.maxParticipants > 0 ? (
            <span className="lkdv-cv2-capacity" data-state={state}>
              <span
                className="lkdv-cv2-capacity-track"
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={event.maxParticipants}
                aria-valuenow={event.currentParticipants}
                aria-label={`${formatInt(event.currentParticipants)} places prises sur ${formatInt(
                  event.maxParticipants,
                )}`}
              >
                <span className="lkdv-cv2-capacity-fill" style={{ width: `${percentage}%` }} />
              </span>
              <span className="lkdv-cv2-capacity-label">
                {formatInt(event.currentParticipants)}/{formatInt(event.maxParticipants)}
              </span>
            </span>
          ) : null}
          {statusBadge}
        </span>
      ) : null}
    </>
  );

  if (variant === 'preview') {
    return (
      <div className={rootClassName} data-state={state} aria-label={`Aperçu : ${event.title}`}>
        {body}
      </div>
    );
  }

  return (
    <a
      className={rootClassName}
      data-state={state}
      href={href ?? `/sorties/${event.id}`}
      aria-label={ariaLabel}
      onClick={
        onOpen
          ? (clickEvent) => {
              clickEvent.preventDefault();
              onOpen();
            }
          : undefined
      }
    >
      {body}
    </a>
  );
}

export default EventTicket;
