'use client';

import React from 'react';
import Link from 'next/link';
import AppImage from '@/components/ui/AppImage';
import { ClubCrest } from '../../shared/ClubCrest';
import { activityLabel } from '../../data/communityFeedMappers';
import type { ClubCardVM, MemberStatus } from '../../shared/types';
import { formatCountFr, formatRelativeTime } from '../../shared/format';
import { ExploreIcon } from '../ExploreIcons';
import { useLongPress } from '../useLongPress';

export interface ClubTileV2Props {
  club: ClubCardVM;
  /** Statut effectif (mémoire optimiste du parent, sinon `club.myStatus`). */
  status: MemberStatus;
  membersCount: number;
  /** Pleine largeur : « Club du mois » (Clubs#3). */
  month?: boolean;
  /** Action en cours sur ce club : pilule occupée, pas de double envoi. */
  busy?: boolean;
  onOpen: (club: ClubCardVM, opener: HTMLElement) => void;
  onJoin: (club: ClubCardVM) => void;
  onPeek: (club: ClubCardVM, opener: HTMLElement) => void;
}

export function clubJoinLabel(club: ClubCardVM, status: MemberStatus): string {
  if (status === 'member' || status === 'admin') return 'Membre ✓';
  if (status === 'pending') return 'Demande envoyée';
  if (club.privacy === 'closed') return 'Demander';
  return 'Rejoindre';
}

function activityLine(club: ClubCardVM): string {
  const events = formatCountFr(club.eventsThisMonth, 'sortie');
  const post = club.lastPostAt ? `post ${formatRelativeTime(club.lastPostAt)}` : 'aucune publication récente';
  return `${events} ce mois · ${post}`;
}

/**
 * Tuile club (Clubs#1-6, 18, 20) : blason généré, cadenas si adhésion sur
 * validation, méta 10,5 px, signal d'activité, amis membres et pilule
 * Rejoindre de 44 px hors du lien. La tuile est un lien vers la page du club,
 * intercepté pour ouvrir le détail empilé ; l'appui long ouvre le Peek.
 */
export function ClubTileV2({
  club,
  status,
  membersCount,
  month = false,
  busy = false,
  onOpen,
  onJoin,
  onPeek,
}: ClubTileV2Props) {
  const longPress = useLongPress({ onLongPress: (element) => onPeek(club, element) });
  const isMember = status === 'member' || status === 'admin';
  const label = clubJoinLabel(club, status);
  const joinAria =
    status === 'member' || status === 'admin'
      ? `Membre du club ${club.name}. Ouvrir les actions pour quitter`
      : status === 'pending'
        ? `Demande envoyée au club ${club.name}. Ouvrir les actions pour annuler`
        : club.privacy === 'closed'
          ? `Demander à rejoindre le club ${club.name} (adhésion sur validation)`
          : `Rejoindre le club ${club.name}`;

  const tileAria = [
    club.name,
    activityLabel(club.category),
    club.zoneLabel,
    formatCountFr(membersCount, 'membre'),
    club.privacy === 'closed' ? 'adhésion sur validation' : '',
  ]
    .filter(Boolean)
    .join(', ');

  return (
    <article
      className={`lkdv-cv2-tile lkdv-cv2x-club${month ? ' lkdv-cv2-tile--wide is-month' : ''}`}
      data-testid="cv2-tile-club"
      data-id={club.id}
      {...longPress}
    >
      <Link
        className="lkdv-cv2x-tile-link"
        href={`/clubs/${club.slug}`}
        aria-label={tileAria}
        onClick={(event) => {
          event.preventDefault();
          onOpen(club, event.currentTarget);
        }}
      >
        <span className="lkdv-cv2x-club-head">
          <ClubCrest name={club.name} activity={club.category} seed={club.crestSeed} size={44} />
          {club.privacy === 'closed' && !isMember ? (
            <span className="lkdv-cv2x-club-lock" title="Adhésion sur validation">
              <ExploreIcon name="lock" size={12} />
            </span>
          ) : null}
          {month ? <span className="lkdv-cv2x-club-month">Club du mois</span> : null}
        </span>
        <span className="lkdv-cv2-title lkdv-cv2x-club-title">{club.name}</span>
        <span className="lkdv-cv2-meta">
          {[activityLabel(club.category), club.zoneLabel, formatCountFr(membersCount, 'membre')]
            .filter(Boolean)
            .join(' · ')}
        </span>
        <span className="lkdv-cv2x-club-signal">
          <i aria-hidden="true" />
          {activityLine(club)}
        </span>
        {club.friendsTotal > 0 ? (
          <span className="lkdv-cv2x-club-friends">
            <span className="lkdv-cv2-avatars" aria-hidden="true">
              {club.friends.slice(0, 3).map((friend) => (
                <span key={friend.id || friend.name} className="lkdv-cv2-avatar">
                  {friend.avatarUrl ? (
                    <AppImage src={friend.avatarUrl} alt="" width={28} height={28} className="lkdv-cv2x-avatar-img" />
                  ) : (
                    friend.initials
                  )}
                </span>
              ))}
            </span>
            <small>
              {club.friendsTotal === 1
                ? '1 ami membre'
                : `${club.friendsTotal} amis membres`}
            </small>
          </span>
        ) : null}
      </Link>

      <button
        type="button"
        className="lkdv-cv2x-join"
        data-state={status}
        aria-pressed={status !== 'none'}
        aria-label={joinAria}
        aria-busy={busy || undefined}
        disabled={busy}
        onClick={(event) => {
          event.stopPropagation();
          onJoin(club);
        }}
        data-testid="cv2-club-join"
        data-id={club.id}
      >
        {busy ? (
          <i className="lkdv-cv2x-spinner" aria-hidden="true" />
        ) : status === 'pending' ? (
          <ExploreIcon name="clock" size={15} />
        ) : status === 'member' || status === 'admin' ? null : club.privacy === 'closed' ? (
          <ExploreIcon name="lock" size={15} />
        ) : (
          <ExploreIcon name="plus" size={15} />
        )}
        <span>{busy ? 'Envoi…' : label}</span>
      </button>
    </article>
  );
}

export default ClubTileV2;
