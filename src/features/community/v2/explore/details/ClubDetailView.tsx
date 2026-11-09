'use client';

import React from 'react';
import Link from 'next/link';
import AppImage from '@/components/ui/AppImage';
import type { ClubCardVM, ClubJoinRequestVM, EventCardVM, MemberStatus } from '../../shared/types';
import { formatCountFr, formatDateShort, formatDateStamp, formatRelativeTime, formatTime } from '../../shared/format';
import { activityLabel } from '../../data/communityFeedMappers';
import { useClubDetail } from '../../data/useClubDetail';
import { useClubJoinRequests } from '../../data/useClubJoinRequests';
import { ClubCrest } from '../../shared/ClubCrest';
import { ExploreIcon } from '../ExploreIcons';
import { ExploreError, ExploreSkeleton } from '../ExploreStates';
import { clubJoinDisplayLabel } from '../tiles/ClubTileV2';
import { EventActionButton } from '../tiles/EventTicketV2';

export interface ClubDetailViewProps {
  club: ClubCardVM;
  status: MemberStatus;
  membersCount: number;
  viewerId: string | null;
  busy: boolean;
  onJoin: (club: ClubCardVM) => void;
  onLeave: (club: ClubCardVM) => void;
  onCancelRequest: (club: ClubCardVM) => void;
  onReviewRequest: (clubId: string, request: ClubJoinRequestVM, approve: boolean) => void;
  reviewingRequestId: string | null;
  /** Dernière demande traitée : la retire de la pile locale (évite un re-fetch). */
  reviewedRequestId?: string | null;
  /** Ouvre le Peek du club : « Membre ✓ » / « Demande envoyée » y mènent aux
      actions destructives (quitter / annuler), comme la maquette. */
  onOpenPeek?: (club: ClubCardVM) => void;
  /** Ouvre une sortie de « Prochaines sorties » dans le détail empilé. */
  onOpenEvent?: (event: EventCardVM) => void;
  /** Inscrit à une sortie de « Prochaines sorties ». */
  onSignupEvent?: (event: EventCardVM) => void;
}

/**
 * Détail empilé d'un club (Clubs#7-11, 14-16, 19) : blason, stats, description,
 * amis membres, prochaines sorties, membres, règles, dernières publications,
 * pile « Demandes (n) » réservée aux admins/modérateurs, adhésion/quitter.
 */
export function ClubDetailView({
  club,
  status,
  membersCount,
  viewerId,
  busy,
  onJoin,
  onLeave,
  onCancelRequest,
  onReviewRequest,
  reviewingRequestId,
  reviewedRequestId,
  onOpenPeek,
  onOpenEvent,
  onSignupEvent,
}: ClubDetailViewProps) {
  const detailState = useClubDetail(club, viewerId);
  const detail = detailState.detail;
  const canReview = detail?.viewerRole === 'admin' || detail?.viewerRole === 'moderator';
  const requests = useClubJoinRequests(club.id, canReview);
  const removeRequest = requests.remove;

  React.useEffect(() => {
    if (!reviewedRequestId) return;
    removeRequest(reviewedRequestId);
  }, [removeRequest, reviewedRequestId]);

  const isMember = status === 'member' || status === 'admin';
  const isPending = status === 'pending';
  const statusLabel = clubJoinDisplayLabel(club, status);

  // Maquette (`clubPane`, L2563) : la pilule d'état affiche « Membre ✓ » /
  // « Demande envoyée » ; « Quitter le club » et « Annuler la demande » vivent
  // dans le Peek, pas dans le détail.
  const actionArea = isMember || isPending ? (
    <button
      type="button"
      className="lkdv-cv2x-join lkdv-cv2x-club-detail-action"
      data-state={status}
      aria-pressed
      aria-busy={busy || undefined}
      disabled={busy}
      aria-label={
        isMember
          ? `Membre du club ${club.name}. Ouvrir les actions pour quitter`
          : `Demande envoyée au club ${club.name}. Ouvrir les actions pour annuler`
      }
      onClick={() => {
        if (onOpenPeek) {
          onOpenPeek(club);
          return;
        }
        if (isMember) onLeave(club);
        else onCancelRequest(club);
      }}
    >
      {busy ? <i className="lkdv-cv2x-spinner" aria-hidden="true" /> : null}
      <span>{busy ? 'Envoi…' : statusLabel}</span>
    </button>
  ) : (
    <button
      type="button"
      className="lkdv-cv2x-join lkdv-cv2x-club-detail-action"
      data-state={status}
      aria-pressed={false}
      aria-busy={busy || undefined}
      disabled={busy}
      onClick={() => onJoin(club)}
    >
      {busy ? (
        <i className="lkdv-cv2x-spinner" aria-hidden="true" />
      ) : club.privacy === 'closed' ? (
        <ExploreIcon name="lock" size={15} />
      ) : (
        <ExploreIcon name="plus" size={15} />
      )}
      <span>{busy ? 'Envoi…' : statusLabel}</span>
    </button>
  );

  return (
    <div className="lkdv-cv2x-club-detail">
      <div className="lkdv-cv2x-club-detail-head">
        <ClubCrest name={club.name} activity={club.category} seed={club.crestSeed} size={72} />
        <div>
          <span className="lkdv-cv2-eyebrow lkdv-cv2-eyebrow--sage">
            {activityLabel(club.category) || 'Club'}
          </span>
          <h2 className="lkdv-cv2x-detail-title">{club.name}</h2>
          <p className="lkdv-cv2-meta">
            {[
              club.zoneLabel,
              formatCountFr(membersCount, 'membre'),
              club.privacy === 'closed' ? 'adhésion sur validation' : null,
            ]
              .filter(Boolean)
              .join(' · ')}
          </p>
        </div>
      </div>

      {detailState.loading && !detail ? (
        <ExploreSkeleton variant="rows" />
      ) : detailState.error && !detail ? (
        <ExploreError title="Club indisponible" onRetry={detailState.retry} />
      ) : detail ? (
        <>
          <p className="lkdv-cv2x-club-signal lkdv-cv2x-club-signal--big">
            <i aria-hidden="true" />
            {formatCountFr(club.eventsThisMonth, 'sortie')} ce mois · dernière publication{' '}
            {club.lastPostAt ? formatRelativeTime(club.lastPostAt) : 'aucune'}
          </p>
          {detail.club.description ? (
            <p className="lkdv-cv2x-detail-text">{detail.club.description}</p>
          ) : null}

          {detail.friends.length > 0 ? (
            <div className="lkdv-cv2-card lkdv-cv2x-friends-card">
              <span className="lkdv-cv2-avatars" aria-hidden="true">
                {detail.friends.slice(0, 3).map((friend) => (
                  <span key={friend.id || friend.name} className="lkdv-cv2-avatar">
                    {friend.avatarUrl ? (
                  <AppImage src={friend.avatarUrl} alt="" width={28} height={28} className="lkdv-cv2x-avatar-img" />
                ) : (
                  friend.initials.slice(0, 1)
                )}
                  </span>
                ))}
              </span>
              <span>
                <b>
                  {detail.friends.length === 1
                    ? '1 ami est membre'
                    : `${detail.friends.length} amis sont membres`}
                </b>
                <small>{detail.friends.map((friend) => friend.name.split(' ')[0]).join(', ')}</small>
              </span>
            </div>
          ) : null}

          <div className="lkdv-cv2x-detail-actions">
            {actionArea}
            <Link className="lkdv-cv2-pill lkdv-cv2-pill--secondary" href={`/clubs/${club.slug}`}>
              Voir la page
            </Link>
          </div>

          {canReview ? (
            <section className="lkdv-cv2x-requests" aria-label={`Demandes d’adhésion : ${requests.requests.length}`}>
              <div className="lkdv-cv2-group-head">
                <span className="lkdv-cv2-eyebrow">
                  Demandes {requests.loading ? '' : `(${requests.requests.length})`}
                </span>
              </div>
              {requests.loading ? <p className="lkdv-cv2-meta">Chargement des demandes…</p> : null}
              {requests.error ? (
                <button type="button" className="lkdv-cv2x-agenda-retry" onClick={requests.reload}>
                  Demandes indisponibles · Réessayer
                </button>
              ) : null}
              {!requests.loading && !requests.error && requests.requests.length === 0 ? (
                <p className="lkdv-cv2-meta">Aucune demande en attente.</p>
              ) : null}
              <ul className="lkdv-cv2-list">
                {requests.requests.map((request) => (
                  <li key={request.id} className="lkdv-cv2x-request">
                    <span className="lkdv-cv2-avatar lkdv-cv2x-request-avatar" aria-hidden="true">
                      {request.user.initials.slice(0, 1)}
                    </span>
                    <span className="lkdv-cv2x-request-body">
                      <b>{request.user.name}</b>
                      {request.answers.map((answer, index) => (
                        <small key={index}>{answer}</small>
                      ))}
                      {request.message ? <small>{request.message}</small> : null}
                    </span>
                    <span className="lkdv-cv2x-request-actions">
                      <button
                        type="button"
                        className="lkdv-cv2-pill lkdv-cv2-pill--primary lkdv-cv2-pill--sm"
                        aria-busy={reviewingRequestId === request.id || undefined}
                        disabled={reviewingRequestId === request.id}
                        onClick={() => onReviewRequest(club.id, request, true)}
                      >
                        Accepter
                      </button>
                      <button
                        type="button"
                        className="lkdv-cv2-pill lkdv-cv2-pill--secondary lkdv-cv2-pill--sm"
                        aria-busy={reviewingRequestId === request.id || undefined}
                        disabled={reviewingRequestId === request.id}
                        onClick={() => onReviewRequest(club.id, request, false)}
                      >
                        Refuser
                      </button>
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          <span className="lkdv-cv2-eyebrow">Prochaines sorties</span>
          {detail.nextEvents.length > 0 ? (
            <div className="lkdv-cv2x-event-rows">
              {detail.nextEvents.map((event: EventCardVM) => {
                const stamp = formatDateStamp(`${event.eventDate}T12:00:00+01:00`);
                const time = formatTime(event.startsAt);
                return (
                  <article key={event.id} className="lkdv-cv2x-mini-event-row">
                    <Link
                      href={`/sorties/${event.id}`}
                      className="lkdv-cv2x-mini-event"
                      onClick={(clickEvent) => {
                        if (!onOpenEvent) return;
                        clickEvent.preventDefault();
                        onOpenEvent(event);
                      }}
                    >
                      <span className="lkdv-cv2x-mini-event-stamp" aria-hidden="true">
                        <b>{stamp.day}</b>
                        <i>{stamp.month}</i>
                      </span>
                      <span className="lkdv-cv2x-mini-event-body">
                        <span className="lkdv-cv2-title lkdv-cv2-title--clamp1">{event.title}</span>
                        <span className="lkdv-cv2-meta">
                          {[formatDateShort(event.eventDate ? `${event.eventDate}T12:00:00+01:00` : event.startsAt), time, event.location]
                            .filter(Boolean)
                            .join(' · ')}
                        </span>
                      </span>
                    </Link>
                    {/* Maquette (L2564) : billet compact + « S'inscrire » 44 px. */}
                    {onSignupEvent ? (
                      <EventActionButton
                        event={event}
                        status={event.myStatus}
                        spotsLeft={event.spotsLeft}
                        onSignup={onSignupEvent}
                      />
                    ) : null}
                  </article>
                );
              })}
            </div>
          ) : (
            <p className="lkdv-cv2-meta">Aucune sortie prévue pour le moment.</p>
          )}

          <span className="lkdv-cv2-eyebrow">Membres</span>
          <div className="lkdv-cv2-card lkdv-cv2x-members-card">
            <span className="lkdv-cv2-avatars" aria-hidden="true">
              {detail.members.slice(0, 6).map((member) => (
                <span key={member.id || member.name} className="lkdv-cv2-avatar">
                  {member.avatarUrl ? (
                    <AppImage src={member.avatarUrl} alt="" width={28} height={28} className="lkdv-cv2x-avatar-img" />
                  ) : (
                    member.initials.slice(0, 1)
                  )}
                </span>
              ))}
            </span>
            <span className="lkdv-cv2-meta">
              {formatCountFr(detail.membersTotal, 'membre actif', 'membres actifs')}
            </span>
          </div>

          {detail.rules ? (
            <>
              <span className="lkdv-cv2-eyebrow">Règles du club</span>
              <div className="lkdv-cv2-card">
                <p className="lkdv-cv2x-detail-text">{detail.rules}</p>
              </div>
            </>
          ) : null}

          <span className="lkdv-cv2-eyebrow">Dernières publications</span>
          {detail.posts.length > 0 ? (
            <div className="lkdv-cv2-list">
              {detail.posts.map((post) => (
                <div key={post.id} className="lkdv-cv2-row lkdv-cv2x-post-row">
                  <span className="lkdv-cv2x-post-ico" aria-hidden="true">
                    <ExploreIcon name="doc" size={15} />
                  </span>
                  <span className="lkdv-cv2x-post-body">
                    <span className="lkdv-cv2x-post-excerpt">{post.excerpt}</span>
                    <span className="lkdv-cv2-meta">{formatRelativeTime(post.createdAt)}</span>
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="lkdv-cv2-meta">Aucune publication.</p>
          )}
        </>
      ) : null}
    </div>
  );
}

export default ClubDetailView;
