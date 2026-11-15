'use client';

import React from 'react';

import {
  evaluateClubVerificationBadge,
  evaluateProAthleteBadge,
  type Club,
  type ClubMember,
  type ClubPrivacy,
  type ClubRole,
  type ViewerPrivacyContext,
} from '@/features/clubs';
import {
  initials,
  isClubManager,
  MEMBERSHIP_STATUS_LABELS,
  privacyLabel,
  PRIVACY_HINTS,
  roleLabel,
} from './model';
import styles from './g02.module.css';

function cx(...values: Array<string | false | null | undefined>): string {
  return values.filter(Boolean).join(' ');
}

export function ClubPrivacyBadge({ privacy }: { privacy: ClubPrivacy }) {
  return (
    <span
      className={cx(styles.badge, privacy === 'secret' ? styles.badgeForest : styles.badgeSage)}
      title={PRIVACY_HINTS[privacy]}
    >
      <span aria-hidden="true">{privacy === 'open' ? '◉' : privacy === 'closed' ? '◐' : '●'}</span>
      {privacyLabel(privacy)}
    </span>
  );
}

export function ClubRoleBadge({ role }: { role: ClubRole }) {
  return (
    <span className={cx(styles.badge, role === 'admin' ? styles.badgeForest : role === 'moderator' ? styles.badgeSage : '')}>
      {roleLabel(role)}
    </span>
  );
}

export function ClubVerificationBadge({
  club,
  sportContext = null,
  isAuthorizedContext = true,
}: {
  club: Club;
  sportContext?: string | null;
  isAuthorizedContext?: boolean;
}) {
  const badge = evaluateClubVerificationBadge({ club, sportContext, isAuthorizedContext });
  if (!badge.visible) return null;
  return (
    <span className={styles.badge} aria-label={`${badge.label}${badge.sport ? ` — ${badge.sport}` : ''}`}>
      <span aria-hidden="true">✓</span>
      {badge.label}
      {badge.sport ? <span className={styles.muted}>· {badge.sport}</span> : null}
    </span>
  );
}

export function ProAthleteBadge({
  member,
  sportContext = null,
  viewerContext,
}: {
  member: ClubMember;
  sportContext?: string | null;
  viewerContext: ViewerPrivacyContext;
}) {
  const badge = evaluateProAthleteBadge({ member, sportContext, viewerContext });
  if (!badge.visible) return null;
  return (
    <span className={styles.badge} aria-label={`${badge.label}${badge.sport ? ` — ${badge.sport}` : ''}`}>
      <span aria-hidden="true">★</span>
      {badge.label}
    </span>
  );
}

export function ClubAvatar({
  name,
  avatarUrl,
  small = false,
}: {
  name: string;
  avatarUrl: string | null;
  small?: boolean;
}) {
  return (
    <span className={cx(styles.avatar, small && styles.avatarSmall)} aria-hidden="true">
      {avatarUrl ? (
        // eslint-disable-next-line @next/next/no-img-element -- avatar distant déjà borné par le contrat ; AppImage n'est pas requis hors catalogue.
        <img src={avatarUrl} alt="" loading="lazy" referrerPolicy="no-referrer" />
      ) : (
        initials(name)
      )}
    </span>
  );
}

export interface ClubIdentityHeaderProps {
  club: Club;
  memberCount: number;
  eventCount: number;
  challengeCount: number;
  viewerMembership?: ClubMember | null;
  sportContext?: string | null;
  onInvite?: () => void;
}

/**
 * En-tête d'un écran de club : identité, confidentialité, vérification S5.10,
 * rôle du lecteur et compteurs. Aucun contenu d'un club secret n'est rendu si
 * le lecteur n'est pas membre actif (le parent applique `canViewClub`).
 */
export function ClubIdentityHeader({
  club,
  memberCount,
  eventCount,
  challengeCount,
  viewerMembership = null,
  sportContext = null,
  onInvite,
}: ClubIdentityHeaderProps) {
  const canManage = isClubManager(viewerMembership);
  return (
    <header className={styles.screen}>
      <div className={styles.card}>
        <div className={styles.rowBetween}>
          <div className={styles.grow}>
            <p className={styles.eyebrow}>Club · {club.primarySport}</p>
            <h1 className={styles.title}>{club.name}</h1>
            {club.description ? <p className={styles.subtitle}>{club.description}</p> : null}
          </div>
          {club.coverImage ? (
            // eslint-disable-next-line @next/next/no-img-element -- couverture éditoriale, dimensions gérées par la carte.
            <img
              src={club.coverImage}
              alt=""
              width={88}
              height={88}
              loading="lazy"
              style={{ borderRadius: '18px', objectFit: 'cover', flex: '0 0 auto' }}
            />
          ) : null}
        </div>

        <div className={styles.wrap}>
          <ClubPrivacyBadge privacy={club.privacy} />
          <ClubVerificationBadge club={club} sportContext={sportContext} />
          {viewerMembership ? <ClubRoleBadge role={viewerMembership.role} /> : null}
          {viewerMembership && viewerMembership.status !== 'active' ? (
            <span className={styles.badge}>{MEMBERSHIP_STATUS_LABELS[viewerMembership.status]}</span>
          ) : null}
          {club.zoneLabel ? <span className={styles.badge}>{club.zoneLabel}</span> : null}
        </div>

        <div className={styles.grid}>
          <div className={styles.metric}>
            <span className={styles.metricValue}>{memberCount}</span>
            <span className={styles.metricLabel}>Membres</span>
          </div>
          <div className={styles.metric}>
            <span className={styles.metricValue}>{eventCount}</span>
            <span className={styles.metricLabel}>Sorties à venir</span>
          </div>
          <div className={styles.metric}>
            <span className={styles.metricValue}>{challengeCount}</span>
            <span className={styles.metricLabel}>Défis actifs</span>
          </div>
        </div>

        <div className={styles.rowBetween}>
          <p className={styles.tiny}>
            {PRIVACY_HINTS[club.privacy]}
            {canManage ? ' Vous pouvez modérer ce club.' : ''}
          </p>
          {onInvite ? (
            <button type="button" className={cx(styles.button, styles.primary)} onClick={onInvite}>
              Inviter
            </button>
          ) : null}
        </div>
      </div>
    </header>
  );
}

export default ClubIdentityHeader;
