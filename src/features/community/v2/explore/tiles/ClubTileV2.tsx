'use client';

import React from 'react';
import Link from 'next/link';
import AppImage from '@/components/ui/AppImage';
import { ClubCrest } from '../../shared/ClubCrest';
import { activityLabel } from '../../data/communityFeedMappers';
import type { ClubCardVM, MemberStatus } from '../../shared/types';
import { formatCountFr } from '../../shared/format';
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

/**
 * Libellé affiché par la pilule (maquette `joinBtn`, L2386 : « Demander à
 * rejoindre »). `clubJoinLabel` reste le libellé court (rétro-compatibilité et
 * espaces contraints) ; ici on rend la formulation complète de la maquette.
 */
export function clubJoinDisplayLabel(club: ClubCardVM, status: MemberStatus): string {
  if (status === 'none' && club.privacy === 'closed') return 'Demander à rejoindre';
  return clubJoinLabel(club, status);
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
  const label = clubJoinDisplayLabel(club, status);
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

  const metaParts = [
    activityLabel(club.category),
    club.zoneLabel || null,
  ].filter(Boolean);

  return (
    <article
      className={`lkdv-carnet-card lkdv-cv2c-carnet-ig-editor lkdv-cv2x-carnet-ig-tile lkdv-cv2x-club-ig-tile${club.coverImage ? ' has-cover-bg' : ''}${month ? ' lkdv-cv2-tile--wide is-month' : ''}`}
      data-testid="cv2-tile-club"
      data-id={club.id}
      {...longPress}
    >
      {club.coverImage ? (
        <span className="lkdv-cv2x-carnet-bg" aria-hidden="true">
          <AppImage
            src={club.coverImage}
            alt=""
            fill
            sizes="320px"
            className="lkdv-cv2x-carnet-bg-img"
          />
          <span className="lkdv-cv2x-carnet-bg-scrim" />
        </span>
      ) : null}

      <Link
        className="lkdv-carnet-card-scroll lkdv-cv2x-tile-link"
        href={`/clubs/${club.slug}`}
        aria-label={tileAria}
        onClick={(event) => {
          event.preventDefault();
          onOpen(club, event.currentTarget);
        }}
      >
        <div className="lkdv-ig-header">
          <div className="lkdv-ig-avi-wrap">
            <span className="lkdv-ig-avi">
              {club.coverImage ? (
                <AppImage
                  src={club.coverImage}
                  alt=""
                  fill
                  sizes="66px"
                  className="lkdv-cv2x-cover-img"
                />
              ) : (
                <ClubCrest
                  name={club.name}
                  activity={club.category}
                  seed={club.crestSeed}
                  size={62}
                />
              )}
            </span>
          </div>

          <div className="lkdv-ig-stats" role="group" aria-label="Statistiques du club">
            <div className="lkdv-ig-stat">
              <b>{membersCount}</b>
              <span>{membersCount > 1 ? 'membres' : 'membre'}</span>
            </div>
            <div className="lkdv-ig-stat">
              <b>{club.eventsThisMonth}</b>
              <span>{club.eventsThisMonth > 1 ? 'sorties' : 'sortie'}</span>
            </div>
            <div className="lkdv-ig-stat">
              <b>{club.privacy === 'closed' ? 'Privé' : 'Ouvert'}</b>
              <span>accès</span>
            </div>
          </div>
        </div>

        <div className="lkdv-ig-bio">
          <span className="lkdv-ig-name lkdv-cv2x-carnet-title">
            {club.name}
            {club.privacy === 'closed' ? (
              <span className="lkdv-cv2x-club-lock" title="Adhésion sur validation">
                {' '}
                <ExploreIcon name="lock" size={12} />
              </span>
            ) : null}
            {month ? <span className="lkdv-cv2x-club-month-badge">Club du mois</span> : null}
          </span>
          {metaParts.length > 0 ? (
            <span className="lkdv-ig-handle-sub lkdv-cv2-meta">{metaParts.join(' · ')}</span>
          ) : null}
        </div>
      </Link>

      <div className="lkdv-cv2x-tile-foot">
        <span className="lkdv-cv2-avatars" aria-hidden="true">
          {club.friends.slice(0, 3).map((friend) => (
            <span key={friend.id || friend.name} className="lkdv-cv2-avatar">
              {friend.avatarUrl ? (
                <AppImage
                  src={friend.avatarUrl}
                  alt=""
                  width={28}
                  height={28}
                  className="lkdv-cv2x-avatar-img"
                />
              ) : (
                friend.initials.slice(0, 1)
              )}
            </span>
          ))}
          {club.friendsTotal > club.friends.length ? (
            <span className="lkdv-cv2-avatar lkdv-cv2-avatar--more">
              +{club.friendsTotal - club.friends.length}
            </span>
          ) : null}
        </span>

        <button
          type="button"
          className="lkdv-cv2x-join lkdv-cv2x-club-join-compact"
          data-state={status}
          data-long={status === 'none' && club.privacy === 'closed' ? 'true' : undefined}
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
            <ExploreIcon name="clock" size={14} />
          ) : status === 'member' || status === 'admin' ? null : club.privacy === 'closed' ? (
            <ExploreIcon name="lock" size={14} />
          ) : (
            <ExploreIcon name="plus" size={14} />
          )}
          <span>{busy ? 'Envoi…' : label}</span>
        </button>
      </div>
    </article>
  );
}

export default ClubTileV2;
