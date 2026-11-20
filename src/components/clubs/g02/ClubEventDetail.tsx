'use client';

import React, { useMemo, useState } from 'react';
import { TrailSearchFieldV2 } from '@/features/community/v2/create/carnet/TrailSearchFieldV2';
import '@/features/community/v2/create/create-v2.css';

import {
  buildEventFlyer,
  canViewClubEvent,
  computeEventAttendanceStats,
  getValidatedRaceRegistrationUrl,
  type Club,
  type ClubEvent,
  type ClubMember,
  type EventAttendanceRecord,
  type EventRegistration,
  type ParticipantRouteSyncState,
  type RouteRevisionSnapshot,
  type ViewerPrivacyContext,
} from '@/features/clubs';
import {
  EVENT_FORMAT_LABELS,
  eventCapacity,
  eventCapacityFromCounts,
  eventRsvpStatus,
  eventTemporalState,
  formatDistance,
  formatElevation,
  formatEventDate,
  formatEventTimeRange,
  isClubManager,
} from './model';
import type { EventCounts } from './model';
import styles from './g02.module.css';

function cx(...values: Array<string | false | null | undefined>): string {
  return values.filter(Boolean).join(' ');
}

export interface ClubEventDetailProps {
  event: ClubEvent;
  club: Club;
  coHostClubs?: readonly Club[];
  memberships: readonly ClubMember[];
  registrations: readonly EventRegistration[];
  eventCounts?: EventCounts;
  attendanceRecords?: readonly EventAttendanceRecord[];
  viewerContext: ViewerPrivacyContext;
  currentUserId: string | null;
  nowIso: string;
  shareUrl: string;
  latestRevision?: RouteRevisionSnapshot | null;
  routeSyncState?: ParticipantRouteSyncState | null;
  onBack?: () => void;
  onRegister: (paceGroupId?: string | null) => Promise<void> | void;
  onCancel: () => Promise<void> | void;
  onPublishRoute?: (input: {
    routeId: string;
    expectedRevision: number;
    meetingPoint: string;
  }) => Promise<void> | void;
  onSyncRoute?: () => Promise<void> | void;
  onDecideRoute?: (revision: number, adopt: boolean) => Promise<void> | void;
  onCopyShareUrl?: (url: string) => Promise<void> | void;
}

/**
 * K5.21 / K5.23 / S5.13–S5.16 — fiche d’une sortie : inscription atomique,
 * groupes d’allure, présence réelle consentie, flyer partageable et
 * synchronisation de la révision de tracé.
 */
export function ClubEventDetail({
  event,
  club,
  coHostClubs = [],
  memberships,
  registrations,
  eventCounts,
  attendanceRecords = [],
  viewerContext,
  currentUserId,
  nowIso,
  shareUrl,
  latestRevision = null,
  routeSyncState = null,
  onBack,
  onRegister,
  onCancel,
  onPublishRoute,
  onSyncRoute,
  onDecideRoute,
  onCopyShareUrl,
}: ClubEventDetailProps) {
  const [paceGroupId, setPaceGroupId] = useState<string>(event.paceGroups[0]?.id ?? '');
  const [pending, setPending] = useState(false);
  const [copied, setCopied] = useState(false);
  const [revisionDraft, setRevisionDraft] = useState({
    routeId: event.routeId ?? '',
    meetingPoint: event.meetingPoint ?? '',
  });
  const [revisionError, setRevisionError] = useState<string | null>(null);

  const visible = canViewClubEvent(event, club, viewerContext, memberships);
  const viewerMembership = useMemo(
    () =>
      currentUserId
        ? memberships.find((member) => member.clubId === club.id && member.userId === currentUserId) ?? null
        : null,
    [club.id, currentUserId, memberships],
  );
  const canManage = isClubManager(viewerMembership);
  const canPublish = !event.cancelledAt && (canManage || currentUserId === event.createdBy);
  const capacity = eventCounts ? eventCapacityFromCounts(event, eventCounts) : eventCapacity(event, registrations);
  const rsvp = eventRsvpStatus(event.id, currentUserId, registrations);
  const temporal = eventTemporalState(event.startsAt, event.endsAt, nowIso);
  const raceUrl = getValidatedRaceRegistrationUrl(event);
  const flyerResult = buildEventFlyer({ event, hostClub: club, coHostClubs, shareUrl });
  const attendance = computeEventAttendanceStats({
    event,
    actorMember: viewerMembership ?? undefined,
    registrations,
    attendanceRecords,
  });

  const run = async (action: () => Promise<void> | void) => {
    setPending(true);
    try {
      await action();
    } finally {
      setPending(false);
    }
  };

  const copy = async () => {
    if (onCopyShareUrl) {
      await onCopyShareUrl(shareUrl);
    } else if (typeof navigator !== 'undefined' && navigator.clipboard) {
      await navigator.clipboard.writeText(shareUrl);
    }
    setCopied(true);
  };

  const publishRevision = async (formEvent: React.FormEvent<HTMLFormElement>) => {
    formEvent.preventDefault();
    setRevisionError(null);
    if (!/^[1-9][0-9]{0,17}$/.test(revisionDraft.routeId)) {
      setRevisionError('Choisis un tracé dans le catalogue.');
      return;
    }
    if (!onPublishRoute) return;
    await runRouteAction(() => onPublishRoute({
        routeId: revisionDraft.routeId,
        expectedRevision: event.routeRevision,
        meetingPoint: revisionDraft.meetingPoint.trim(),
    }));
  };

  async function runRouteAction(action: () => Promise<void> | void) {
    setRevisionError(null);
    try {
      await run(action);
    } catch (error) {
      setRevisionError(error instanceof Error ? error.message : 'Parcours indisponible.');
    }
  }

  if (!visible) {
    return (
      <section className={styles.screen}>
        <div className={styles.empty} role="status">
          <p className={styles.emptyTitle}>Sortie non accessible</p>
          <p className={styles.emptyHint}>
            Cette sortie appartient à un club fermé ou secret, ou son organisateur est bloqué. Demandez
            une invitation à un membre du club.
          </p>
          {onBack ? (
            <button type="button" className={cx(styles.button, styles.small)} onClick={onBack}>
              Revenir aux sorties
            </button>
          ) : null}
        </div>
      </section>
    );
  }

  return (
    <section className={styles.screen} aria-label={`Sortie ${event.title}`}>
      <div className={styles.sectionHeader}>
        <div>
          <p className={styles.eyebrow}>Sortie · {club.name}</p>
          <h1 className={styles.title}>{event.title}</h1>
          <p className={styles.subtitle}>
            {formatEventDate(event.startsAt)} · {formatEventTimeRange(event.startsAt, event.endsAt)} ·{' '}
            {event.locationLabel}
          </p>
        </div>
        {onBack ? (
          <button type="button" className={cx(styles.button, styles.small, styles.ghost)} onClick={onBack}>
            ← Toutes les sorties
          </button>
        ) : null}
      </div>

      <div className={styles.card}>
        <div className={styles.wrap}>
          <span className={styles.badge}>{EVENT_FORMAT_LABELS[event.format]}</span>
          <span className={styles.badge}>{event.sport}</span>
          <span className={cx(styles.badge, event.visibility === 'private' ? styles.badgeForest : styles.badgeSage)}>
            {event.visibility === 'public'
              ? 'Visible par tous'
              : event.visibility === 'club_only'
                ? 'Membres du club'
                : event.visibility === 'friends'
                  ? 'Amis'
                  : 'Privé'}
          </span>
          {temporal === 'past' ? <span className={styles.badge}>Passée</span> : null}
          {capacity.isFull ? (
            <span className={cx(styles.badge, styles.badgeWarn)}>
              {capacity.waitlistOpen ? 'Complet · liste d’attente' : 'Complet'}
            </span>
          ) : null}
        </div>

        {event.description ? <p className={styles.cardMeta}>{event.description}</p> : null}

        <div className={styles.grid}>
          <div className={styles.metric}>
            <span className={styles.metricValue}>
              {capacity.registered}
              {event.maxParticipants !== null ? `/${event.maxParticipants}` : ''}
            </span>
            <span className={styles.metricLabel}>Inscrits</span>
          </div>
          <div className={styles.metric}>
            <span className={styles.metricValue}>{capacity.waitlist}</span>
            <span className={styles.metricLabel}>Liste d’attente</span>
          </div>
          <div className={styles.metric}>
            <span className={styles.metricValue}>{event.routeRevision}</span>
            <span className={styles.metricLabel}>Révision du tracé</span>
          </div>
        </div>

        {event.meetingPoint ? (
          <p className={styles.tiny} style={{ margin: 0 }}>
            <strong>Rendez-vous :</strong> {event.meetingPoint}
          </p>
        ) : null}

        {event.paceGroups.length > 0 ? (
          <div className={styles.field}>
            <label className={styles.label} htmlFor="g02-pace-group">
              Groupe d’allure (S5.13)
            </label>
            <select
              id="g02-pace-group"
              className={styles.select}
              value={paceGroupId}
              onChange={(selectEvent) => setPaceGroupId(selectEvent.target.value)}
              disabled={rsvp !== 'none'}
            >
              <option value="">Sans groupe</option>
              {event.paceGroups.map((group) => (
                <option key={group.id} value={group.id}>
                  {group.label} · {group.targetPaceLabel}
                </option>
              ))}
            </select>
          </div>
        ) : null}

        <div className={styles.rowBetween}>
          <p className={styles.tiny} style={{ margin: 0 }}>
            {rsvp === 'registered'
              ? 'Votre inscription est confirmée.'
              : rsvp === 'waitlist'
                ? 'Vous êtes en liste d’attente ; la place est attribuée dans l’ordre d’arrivée.'
                : 'Aucune inscription enregistrée pour votre compte.'}
          </p>
          <div className={styles.wrap}>
            {raceUrl ? (
              <a
                className={cx(styles.button, styles.small)}
                href={raceUrl}
                target="_blank"
                rel="noopener noreferrer"
              >
                Inscription à la course
              </a>
            ) : null}
            {temporal !== 'past' && rsvp === 'none' ? (
              <button
                type="button"
                className={cx(styles.button, styles.primary)}
                disabled={pending || (capacity.isFull && !capacity.waitlistOpen)}
                onClick={() => void run(() => onRegister(paceGroupId || null))}
              >
                {pending
                  ? 'Inscription…'
                  : capacity.isFull && capacity.waitlistOpen
                    ? 'Rejoindre la liste d’attente'
                    : 'S’inscrire'}
              </button>
            ) : null}
            {temporal !== 'past' && rsvp !== 'none' ? (
              <button
                type="button"
                className={styles.button}
                disabled={pending}
                onClick={() => void run(onCancel)}
              >
                {pending ? 'Annulation…' : 'Se désinscrire'}
              </button>
            ) : null}
          </div>
        </div>
      </div>

      {canManage ? (
        <section className={styles.card} aria-label="Présence réelle">
          <div className={styles.cardHeader}>
            <div>
              <h2 className={styles.cardTitle}>Présence réelle · S5.14</h2>
              <p className={styles.cardMeta}>
                Seules les activités rattachées avec consentement explicite sont comptées.
              </p>
            </div>
          </div>
          {attendance.ok ? (
            <>
              <div className={styles.grid}>
                <div className={styles.metric}>
                  <span className={styles.metricValue}>{attendance.data.confirmedAttendeesCount}</span>
                  <span className={styles.metricLabel}>Présents confirmés</span>
                </div>
                <div className={styles.metric}>
                  <span className={styles.metricValue}>{Math.round(attendance.data.attendanceRate * 100)} %</span>
                  <span className={styles.metricLabel}>Taux de présence</span>
                </div>
                <div className={styles.metric}>
                  <span className={styles.metricValue}>{attendance.data.consentedActivityIds.length}</span>
                  <span className={styles.metricLabel}>Activités consenties</span>
                </div>
              </div>
              <p className={styles.tiny} style={{ margin: 0 }}>
                {attendance.data.registeredCount} inscrit(s), {attendance.data.waitlistCount} en liste
                d’attente. Aucune trace GPS n’est exposée.
              </p>
            </>
          ) : (
            <p className={styles.notice}>{attendance.message}</p>
          )}
        </section>
      ) : null}

      <section className={styles.card} aria-label="Tracé partagé">
        <div className={styles.cardHeader}>
          <div>
            <h2 className={styles.cardTitle}>Tracé partagé</h2>
            <p className={styles.cardMeta}>
              {event.routeId
                ? `${latestRevision?.routeName ?? 'Tracé partagé'} · révision ${event.routeRevision}`
                : 'Aucun tracé publié pour cette sortie.'}
            </p>
          </div>
          {routeSyncState?.decisionRequired ? (
            <span className={cx(styles.badge, styles.badgeWarn)}>Décision requise</span>
          ) : null}
        </div>

        {latestRevision ? (
          <div className={styles.grid}>
            <div className={styles.metric}>
              <span className={styles.metricValue}>{formatDistance(latestRevision.distanceM)}</span>
              <span className={styles.metricLabel}>Distance</span>
            </div>
            {latestRevision.elevationGainM != null && (
              <div className={styles.metric}>
                <span className={styles.metricValue}>{formatElevation(latestRevision.elevationGainM)}</span>
                <span className={styles.metricLabel}>Dénivelé</span>
              </div>
            )}
            <div className={styles.metric}>
              <span className={styles.metricValue}>{latestRevision.revision}</span>
              <span className={styles.metricLabel}>Révision</span>
            </div>
          </div>
        ) : null}

        {routeSyncState ? (
          <p className={styles.tiny} style={{ margin: 0 }}>
            Dernière synchronisation : révision {routeSyncState.lastSyncedRevision}
            {routeSyncState.pendingRevision !== null
              ? ` · révision ${routeSyncState.pendingRevision} en attente`
              : ''}
            {routeSyncState.revoked ? ' · accès révoqué' : ''}
          </p>
        ) : null}

        {latestRevision && rsvp === 'registered' && !event.cancelledAt &&
          routeSyncState?.lastSyncedRevision !== latestRevision.revision && onSyncRoute ? (
          <button
            type="button"
            className={cx(styles.button, styles.primary)}
            disabled={pending}
            onClick={() => void runRouteAction(onSyncRoute)}
          >
            {pending ? 'Synchronisation…' : 'Recevoir la révision'}
          </button>
        ) : null}

        {latestRevision?.canonicalRevisionId && rsvp === 'registered' && !event.cancelledAt
          && routeSyncState?.pendingRevision === latestRevision.revision && onDecideRoute && (
          <div className={styles.formRow}>
            <button type="button" className={cx(styles.button, styles.primary)}
              disabled={pending} onClick={() => void runRouteAction(() => onDecideRoute(latestRevision.revision, true))}>
              Adopter ce tracé
            </button>
            <button type="button" className={styles.button}
              disabled={pending} onClick={() => void runRouteAction(() => onDecideRoute(latestRevision.revision, false))}>
              Garder mon tracé
            </button>
          </div>
        )}
        {routeSyncState?.adoptedRevision != null && (
          <p className={styles.tiny}>Tracé adopté · révision {routeSyncState.adoptedRevision}</p>
        )}
        {revisionError && <p className={styles.notice} role="alert">{revisionError}</p>}

        {canPublish && onPublishRoute ? (
          <form className={styles.stack} onSubmit={(formEvent) => void publishRevision(formEvent)}>
            <TrailSearchFieldV2
              label="Tracé du catalogue"
              onPickTrail={(trail) => setRevisionDraft((current) => ({ ...current, routeId: String(trail.id) }))}
            />
            <div className={styles.field}>
              <label className={styles.label} htmlFor="g02-route-meeting">Rendez-vous</label>
              <input
                id="g02-route-meeting"
                className={styles.input}
                value={revisionDraft.meetingPoint}
                onChange={(change) => setRevisionDraft((current) => ({ ...current, meetingPoint: change.target.value }))}
                maxLength={200}
              />
            </div>
            <div>
              <button type="submit" className={cx(styles.button, styles.small)} disabled={pending}>
                Publier la révision
              </button>
            </div>
          </form>
        ) : null}
      </section>

      {flyerResult.ok ? (
        <section className={styles.card} aria-label="Flyer partageable">
          <div className={styles.cardHeader}>
            <div>
              <h2 className={styles.cardTitle}>Flyer de la sortie · S5.13</h2>
              <p className={styles.cardMeta}>
                {flyerResult.data.dateLabel} · {flyerResult.data.locationLabel}
              </p>
            </div>
          </div>
          <div className={styles.mono} aria-label="Lien de partage">
            {flyerResult.data.shareUrl}
          </div>
          <div className={styles.mono} aria-label="Charge utile du QR">
            {flyerResult.data.qrPayload}
          </div>
          <div className={styles.rowBetween}>
            <p className={styles.tiny} style={{ margin: 0 }}>
              {flyerResult.data.coHostClubNames.length > 0
                ? `Co-organisé avec ${flyerResult.data.coHostClubNames.join(', ')}`
                : 'Organisé par le club.'}
            </p>
            <button type="button" className={cx(styles.button, styles.small)} onClick={() => void copy()}>
              {copied ? 'Lien copié' : 'Copier le lien'}
            </button>
          </div>
        </section>
      ) : (
        <p className={styles.notice}>{flyerResult.message}</p>
      )}
    </section>
  );
}

export default ClubEventDetail;
