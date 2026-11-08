'use client';

import React, { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import HeaderBackButton from '@/components/ui/HeaderBackButton';
import { createClient } from '@/lib/supabase/client';
import { useHapticFeedback } from '@/hooks/useHapticFeedback';
import { PlaceMiniMap } from '@/features/community/v2/shared/PlaceMiniMap';
import {
  buildEventIcs,
  eventIcsFilename,
  formatDateFull,
  formatDateStamp,
  formatDistanceKm,
  formatElevationM,
  formatKm,
  formatTime,
  formatWeightG,
  initialsFromName,
} from '@/features/community/v2/shared/format';

export interface EventDetailData {
  id: string;
  title: string;
  description: string | null;
  activity: string;
  emoji: string | null;
  eventDate: string;
  startsAt: string | null;
  endsAt: string | null;
  duration: string | null;
  location: string;
  meetingPoint: string | null;
  level: 'facile' | 'moyen' | 'difficile' | null;
  distanceKm: number | null;
  elevationGainM: number | null;
  lat: number | null;
  lng: number | null;
  meetingGeom: { type?: string; coordinates?: [number, number] } | null;
  coverImage: string | null;
  coverAlt: string;
  maxParticipants: number;
  currentParticipants: number;
  waitlistEnabled: boolean;
  status: string | null;
  past: boolean;
  cancelled: boolean;
  recurrence: 'weekly' | 'monthly' | null;
  safetyNotes: string | null;
  safetyChecklist: string[];
  organizer: { id: string; name: string; handle: string | null; avatarUrl: string | null } | null;
  participants: Array<{
    id: string;
    name: string;
    handle: string | null;
    avatarUrl: string | null;
    status: 'confirmed' | 'waitlist';
  }>;
  myStatus: 'none' | 'registered' | 'waitlist';
  club: { id: string; slug: string | null; name: string } | null;
  kit: { id: string; name: string; totalWeightG: number | null } | null;
}

const LEVEL_LABEL: Record<NonNullable<EventDetailData['level']>, string> = {
  facile: 'Facile',
  moyen: 'Moyen',
  difficile: 'Difficile',
};

const ACTIVITY_LABEL: Record<string, string> = {
  rando: 'Randonnée',
  trail: 'Trail',
  ski: 'Ski de rando',
  velo: 'Vélo',
  escalade: 'Escalade',
  autre: 'Autre',
};

function coords(event: EventDetailData): { lat: number; lng: number } | null {
  if (event.lat != null && event.lng != null) return { lat: event.lat, lng: event.lng };
  const coordinates = event.meetingGeom?.coordinates;
  if (Array.isArray(coordinates) && coordinates.length === 2) {
    const [lng, lat] = coordinates;
    if (Number.isFinite(lng) && Number.isFinite(lat)) return { lat, lng };
  }
  return null;
}

/**
 * Fiche sortie minimale (billet daté, méta, rendez-vous sur carte, participants,
 * inscription et `.ics`), au système `/compte`.
 */
export default function EventDetailClient({
  event,
  signedIn,
}: {
  event: EventDetailData;
  signedIn: boolean;
}) {
  const router = useRouter();
  const { haptic } = useHapticFeedback();
  const [status, setStatus] = useState(event.myStatus);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const stamp = formatDateStamp(event.startsAt ?? `${event.eventDate}T09:00:00+01:00`);
  const meeting = coords(event);
  const spotsLeft = Math.max(0, event.maxParticipants - event.currentParticipants);
  const full = event.maxParticipants > 0 && spotsLeft === 0;
  const registrationClosed = event.past || event.cancelled;

  const participants = useMemo(
    () => event.participants.filter((participant) => participant.status === 'confirmed'),
    [event.participants],
  );
  const waitlisted = useMemo(
    () => event.participants.filter((participant) => participant.status === 'waitlist'),
    [event.participants],
  );

  const downloadIcs = () => {
    const ics = buildEventIcs({
      id: event.id,
      title: event.title,
      startsAt: event.startsAt,
      endsAt: event.endsAt,
      eventDate: event.eventDate,
      location: event.location,
      meetingPoint: event.meetingPoint,
      description: event.description,
      url: typeof window !== 'undefined' ? window.location.href : null,
    });
    const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = eventIcsFilename(event.title);
    anchor.rel = 'noopener';
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1500);
    haptic('light');
    setNotice('Fichier .ics téléchargé.');
  };

  const toggleRegistration = async () => {
    if (!signedIn) {
      router.push(`/connexion?next=${encodeURIComponent(`/sorties/${event.id}`)}`);
      return;
    }
    if (busy || registrationClosed) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    const supabase = createClient();
    const previous = status;
    // Optimiste : l'état bascule avant la réponse, retour arrière si échec.
    setStatus(previous === 'none' ? (full && event.waitlistEnabled ? 'waitlist' : 'registered') : 'none');
    try {
      const rpc = previous === 'none' ? 'join_event' : 'leave_event';
      const { data, error: rpcError } = await supabase.rpc(rpc, { p_event_id: event.id });
      if (rpcError) throw rpcError;
      const payload = (data ?? {}) as { registered?: boolean; status?: string; waitlisted?: boolean };
      const next: 'none' | 'registered' | 'waitlist' = payload.registered
        ? payload.waitlisted || payload.status === 'waitlist'
          ? 'waitlist'
          : 'registered'
        : 'none';
      setStatus(next);
      haptic(next === 'none' ? 'selection' : 'success');
      setNotice(
        next === 'none'
          ? 'Inscription annulée.'
          : next === 'waitlist'
            ? 'Liste d’attente : tu es prévenu dès qu’une place se libère.'
            : 'Inscription confirmée.',
      );
    } catch (err) {
      setStatus(previous);
      haptic('error');
      const message =
        err && typeof err === 'object' && 'message' in err
          ? String((err as { message?: unknown }).message ?? '')
          : '';
      setError(
        message.includes('complet') && !event.waitlistEnabled
          ? 'Cette sortie est complète.'
          : message.includes('banned')
            ? 'Tu ne peux pas rejoindre cette sortie.'
            : 'Inscription impossible pour le moment. Réessaie.',
      );
    } finally {
      setBusy(false);
    }
  };

  const registrationLabel = event.cancelled
    ? 'Sortie annulée'
    : event.past
      ? 'Sortie passée'
      : status === 'registered'
        ? 'Inscrit ✓ — annuler'
        : status === 'waitlist'
          ? 'Sur liste d’attente — quitter'
          : full
            ? event.waitlistEnabled
              ? 'Rejoindre la liste d’attente'
              : 'Complet'
            : 'S’inscrire';

  return (
    <main className="lkdv-event-page" aria-labelledby="event-title">
      <div className="lkdv-event-top">
        <HeaderBackButton fallbackHref="/communaute?tab=evenements" />
        <span className="lkdv-event-top-label">
          {ACTIVITY_LABEL[event.activity] ?? event.activity}
        </span>
      </div>

      <header className="lkdv-event-hero">
        {event.coverImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img className="lkdv-event-cover" src={event.coverImage} alt={event.coverAlt} />
        ) : (
          <div className="lkdv-event-cover lkdv-event-cover--empty" aria-hidden="true" />
        )}
        <div className="lkdv-event-billet">
          <span className="lkdv-event-stamp">
            <b>{stamp.day}</b>
            <i>{stamp.month}</i>
          </span>
          <span className="lkdv-event-billet-text">
            <b id="event-title">{event.title}</b>
            <small>
              {formatDateFull(event.startsAt ?? `${event.eventDate}T09:00:00+01:00`)}
              {event.startsAt ? ` · ${formatTime(event.startsAt)}` : ''}
              {event.location ? ` · ${event.location}` : ''}
            </small>
          </span>
        </div>
      </header>

      <section className="lkdv-event-card" aria-label="Place et inscription">
        <div className="lkdv-event-capacity">
          <div className="lkdv-event-capacity-head">
            <b>
              {event.maxParticipants > 0
                ? formatCount(event.currentParticipants, event.maxParticipants)
                : `${event.currentParticipants} inscrit${event.currentParticipants > 1 ? 's' : ''}`}
            </b>
            {event.maxParticipants > 0 ? (
              <span>{full ? 'Complet' : `${spotsLeft} place${spotsLeft > 1 ? 's' : ''} restante${spotsLeft > 1 ? 's' : ''}`}</span>
            ) : null}
          </div>
          {event.maxParticipants > 0 ? (
            <div
              className="lkdv-event-gauge"
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={event.maxParticipants}
              aria-valuenow={event.currentParticipants}
              aria-label={`${event.currentParticipants} inscrit(s) sur ${event.maxParticipants}`}
            >
              <i
                style={{
                  width: `${Math.min(100, Math.round((event.currentParticipants / event.maxParticipants) * 100))}%`,
                }}
              />
            </div>
          ) : null}
        </div>
        <div className="lkdv-event-actions">
          <button
            type="button"
            className="lkdv-event-primary"
            onClick={() => void toggleRegistration()}
            disabled={busy || registrationClosed || (full && !event.waitlistEnabled && status === 'none')}
            aria-busy={busy}
          >
            {busy ? 'Envoi…' : registrationLabel}
          </button>
          <button type="button" className="lkdv-event-secondary" onClick={downloadIcs}>
            Ajouter au calendrier
          </button>
        </div>
        {waitlisted.length > 0 ? (
          <p className="lkdv-event-note">
            {waitlisted.length} personne{waitlisted.length > 1 ? 's' : ''} sur liste d’attente.
          </p>
        ) : null}
        {error ? (
          <p className="lkdv-event-error" role="alert">
            {error}
          </p>
        ) : null}
        {notice ? (
          <p className="lkdv-event-notice" role="status">
            {notice}
          </p>
        ) : null}
      </section>

      <section className="lkdv-event-meta" aria-label="Détails de la sortie">
        {event.level ? (
          <span className="lkdv-event-chip">
            <b>{LEVEL_LABEL[event.level]}</b>
          </span>
        ) : null}
        {event.distanceKm != null ? <span className="lkdv-event-chip">{formatKm(event.distanceKm)}</span> : null}
        {event.elevationGainM != null ? (
          <span className="lkdv-event-chip">{formatElevationM(event.elevationGainM)}</span>
        ) : null}
        {event.duration ? <span className="lkdv-event-chip">{event.duration}</span> : null}
        {event.recurrence ? (
          <span className="lkdv-event-chip">
            {event.recurrence === 'weekly' ? 'Chaque semaine' : 'Chaque mois'}
          </span>
        ) : null}
      </section>

      {event.description ? (
        <section className="lkdv-event-card lkdv-event-section" aria-label="Programme">
          <h2 className="lkdv-event-h2">Programme</h2>
          <p className="lkdv-event-text">{event.description}</p>
        </section>
      ) : null}

      {meeting || event.meetingPoint ? (
        <section className="lkdv-event-card lkdv-event-section" aria-label="Rendez-vous">
          <h2 className="lkdv-event-h2">Rendez-vous</h2>
          {meeting ? (
            <PlaceMiniMap
              lat={meeting.lat}
              lng={meeting.lng}
              label={event.meetingPoint ?? event.location}
              interactive={false}
              itinerary
              height={170}
            />
          ) : null}
          {event.meetingPoint ? <p className="lkdv-event-text">{event.meetingPoint}</p> : null}
          <p className="lkdv-event-muted">
            {formatDateFull(event.startsAt ?? `${event.eventDate}T09:00:00+01:00`)}
            {event.startsAt ? ` · ${formatTime(event.startsAt)}` : ''}
            {event.location ? ` · ${event.location}` : ''}
          </p>
        </section>
      ) : null}

      <section className="lkdv-event-card lkdv-event-section" aria-label="Organisateur">
        <h2 className="lkdv-event-h2">Organisateur</h2>
        {event.organizer ? (
          <a
            className="lkdv-event-organizer"
            href={`/profil/${event.organizer.handle ?? event.organizer.id}`}
          >
            <span className="lkdv-event-avatar" aria-hidden="true">
              {event.organizer.avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={event.organizer.avatarUrl} alt="" />
              ) : (
                initialsFromName(event.organizer.name)
              )}
            </span>
            <span>
              <b>{event.organizer.name}</b>
              <small>{event.organizer.handle ? `@${event.organizer.handle}` : 'Organisateur'}</small>
            </span>
          </a>
        ) : null}
      </section>

      <section className="lkdv-event-card lkdv-event-section" aria-label="Participants">
        <h2 className="lkdv-event-h2">
          Participants
          <span className="lkdv-event-count">
            {formatCount(event.participants.length, 'inscrit')}
          </span>
        </h2>
        {participants.length > 0 ? (
          <ul className="lkdv-event-participants">
            {participants.slice(0, 12).map((participant) => (
              <li key={participant.id}>
                <a href={`/profil/${participant.handle ?? participant.id}`}>
                  <span className="lkdv-event-avatar" aria-hidden="true">
                    {participant.avatarUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={participant.avatarUrl} alt="" />
                    ) : (
                      initialsFromName(participant.name)
                    )}
                  </span>
                  <span className="lkdv-event-participant-name">{participant.name}</span>
                </a>
              </li>
            ))}
          </ul>
        ) : (
          <p className="lkdv-event-muted">Aucun inscrit pour le moment.</p>
        )}
      </section>

      {event.safetyNotes || event.safetyChecklist.length > 0 ? (
        <section className="lkdv-event-card lkdv-event-section" aria-label="Sécurité">
          <h2 className="lkdv-event-h2">Sécurité</h2>
          {event.safetyChecklist.length > 0 ? (
            <ul className="lkdv-event-chips">
              {event.safetyChecklist.map((item) => (
                <li key={item} className="lkdv-event-chip">
                  {item}
                </li>
              ))}
            </ul>
          ) : null}
          {event.safetyNotes ? <p className="lkdv-event-text">{event.safetyNotes}</p> : null}
        </section>
      ) : null}

      {event.club || event.kit ? (
        <section className="lkdv-event-card lkdv-event-links" aria-label="Liens">
          {event.club ? (
            <a className="lkdv-event-link" href={`/clubs/${event.club.slug ?? event.club.id}`}>
              <b>{event.club.name}</b>
              <small>Club organisateur →</small>
            </a>
          ) : null}
          {event.kit ? (
            <div className="lkdv-event-link">
              <b>{event.kit.name}</b>
              <small>
                Kit prêté
                {event.kit.totalWeightG != null ? ` · ${formatWeightG(event.kit.totalWeightG)}` : ''}
              </small>
            </div>
          ) : null}
        </section>
      ) : null}

      <p className="lkdv-event-footnote">
        Les coordonnées de rendez-vous{event.distanceKm != null ? ` à ${formatDistanceKm(event.distanceKm)}` : ''} ne
        sont partagées qu’avec les personnes inscrites.
      </p>
    </main>
  );
}

function formatCount(current: number, max: number): string {
  return `${current} / ${max} inscrit${current > 1 ? 's' : ''}`;
}
