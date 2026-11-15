'use client';

import React, { useMemo } from 'react';

import {
  changeMemberRole,
  muteClubMember,
  removeOrBanClubMember,
  reviewJoinRequest,
  type Club,
  type ClubJoinRequest,
  type ClubMember,
  type ClubRole,
  type ViewerPrivacyContext,
} from '@/features/clubs';
import {
  formatEventDate,
  isClubAdmin,
  isClubManager,
  MEMBERSHIP_STATUS_LABELS,
  roleLabel,
  sortMembersForDisplay,
} from './model';
import { ClubAvatar, ClubRoleBadge, ProAthleteBadge } from './ClubIdentity';
import styles from './g02.module.css';

function cx(...values: Array<string | false | null | undefined>): string {
  return values.filter(Boolean).join(' ');
}

const ROLES: ClubRole[] = ['admin', 'moderator', 'member'];

export interface ClubMembersPanelProps {
  club: Club;
  members: readonly ClubMember[];
  joinRequests: readonly ClubJoinRequest[];
  viewerContext: ViewerPrivacyContext;
  currentUserId: string | null;
  nowIso: string;
  loading?: boolean;
  error?: string | null;
  onReviewRequest: (request: ClubJoinRequest, approve: boolean) => Promise<void> | void;
  onChangeRole: (member: ClubMember, role: ClubRole) => Promise<void> | void;
  onRemoveMember: (member: ClubMember, mode: 'remove' | 'ban') => Promise<void> | void;
  onMuteMember: (member: ClubMember, mutedUntilIso: string | null) => Promise<void> | void;
  onRetry?: () => void;
}

/**
 * S5.10 — membres, demandes d’adhésion, rôles et badges vérifiés.
 *
 * Les actions sont pré-validées par le contrat (`changeMemberRole`,
 * `removeOrBanClubMember`, `reviewJoinRequest`, `muteClubMember`) : une
 * auto-promotion, une rétrogradation du dernier admin ou une expulsion
 * interdite est désactivée à la source, jamais seulement cachée en CSS.
 */
export function ClubMembersPanel({
  club,
  members,
  joinRequests,
  viewerContext,
  currentUserId,
  nowIso,
  loading = false,
  error = null,
  onReviewRequest,
  onChangeRole,
  onRemoveMember,
  onMuteMember,
  onRetry,
}: ClubMembersPanelProps) {
  const [pendingMemberId, setPendingMemberId] = React.useState<string | null>(null);
  const [pendingRequestId, setPendingRequestId] = React.useState<string | null>(null);

  const viewerMembership = useMemo(
    () =>
      currentUserId
        ? members.find((member) => member.clubId === club.id && member.userId === currentUserId) ?? null
        : null,
    [club.id, currentUserId, members],
  );

  const canManage = isClubManager(viewerMembership);
  const canAdmin = isClubAdmin(viewerMembership);
  const visibleMembers = useMemo(() => sortMembersForDisplay(members), [members]);
  const pendingRequests = useMemo(
    () => joinRequests.filter((request) => request.status === 'pending'),
    [joinRequests],
  );

  const run = async (key: string, action: () => Promise<void> | void) => {
    setPendingMemberId(key);
    try {
      await action();
    } finally {
      setPendingMemberId(null);
    }
  };

  const runRequest = async (id: string, action: () => Promise<void> | void) => {
    setPendingRequestId(id);
    try {
      await action();
    } finally {
      setPendingRequestId(null);
    }
  };

  if (loading) {
    return (
      <section className={styles.screen} aria-busy="true" aria-label="Chargement des membres">
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
            <strong>Les membres n’ont pas pu être chargés.</strong>
            <p className={styles.tiny}>{error}</p>
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
    <section className={styles.screen} aria-label="Membres du club">
      <div className={styles.sectionHeader}>
        <div>
          <p className={styles.eyebrow}>Membres · S5.10</p>
          <h2 className={styles.title}>Équipe du club</h2>
          <p className={styles.subtitle}>
            {visibleMembers.length} membre{visibleMembers.length > 1 ? 's' : ''} actif
            {visibleMembers.length > 1 ? 's' : ''}. Les badges vérifiés ne s’affichent que dans un
            contexte autorisé.
          </p>
        </div>
        {pendingRequests.length > 0 && canManage ? (
          <span className={cx(styles.badge, styles.badgeWarn)}>
            {pendingRequests.length} demande{pendingRequests.length > 1 ? 's' : ''} en attente
          </span>
        ) : null}
      </div>

      {pendingRequests.length > 0 && canManage ? (
        <section className={styles.card} aria-label="Demandes d’adhésion">
          <div className={styles.cardHeader}>
            <h3 className={styles.cardTitle}>Demandes à traiter</h3>
          </div>
          <ul className={styles.list}>
            {pendingRequests.map((request) => {
              const review = reviewJoinRequest({
                request,
                actorMember: viewerMembership ?? undefined,
                approve: true,
                nowIso,
              });
              const busy = pendingRequestId === request.id;
              return (
                <li key={request.id} className={styles.listItem}>
                  <ClubAvatar name={request.displayName} avatarUrl={null} small />
                  <div className={styles.grow}>
                    <p className={styles.tiny} style={{ margin: 0, fontWeight: 700 }}>
                      {request.displayName}
                    </p>
                    <p className={styles.cardMeta}>
                      {formatEventDate(request.createdAt)}
                      {request.message ? ` · ${request.message}` : ''}
                    </p>
                    {request.answers.length > 0 ? (
                      <ul className={styles.list}>
                        {request.answers.map((answer, index) => (
                          <li key={`${request.id}_${index}`} className={styles.tiny}>
                            {answer}
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </div>
                  <div className={styles.wrap}>
                    <button
                      type="button"
                      className={cx(styles.button, styles.small, styles.primary)}
                      disabled={!review.ok || busy}
                      onClick={() =>
                        void runRequest(request.id, () => onReviewRequest(request, true))
                      }
                    >
                      Accepter
                    </button>
                    <button
                      type="button"
                      className={cx(styles.button, styles.small, styles.danger)}
                      disabled={busy}
                      onClick={() =>
                        void runRequest(request.id, () => onReviewRequest(request, false))
                      }
                    >
                      Refuser
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}

      <section className={styles.card} aria-label="Liste des membres">
        {visibleMembers.length === 0 ? (
          <div className={styles.empty}>
            <p className={styles.emptyTitle}>Aucun membre actif</p>
            <p className={styles.emptyHint}>Invitez un premier membre pour lancer le club.</p>
          </div>
        ) : (
          <ul className={styles.list}>
            {visibleMembers.map((member) => {
              const isSelf = currentUserId === member.userId;
              const busy = pendingMemberId === member.userId;
              const removeProbe = removeOrBanClubMember({
                clubId: club.id,
                actorUserId: currentUserId ?? '',
                targetUserId: member.userId,
                mode: 'remove',
                memberships: members,
              });
              const banProbe = removeOrBanClubMember({
                clubId: club.id,
                actorUserId: currentUserId ?? '',
                targetUserId: member.userId,
                mode: 'ban',
                memberships: members,
              });
              const muteProbe = muteClubMember({
                clubId: club.id,
                actorMember: viewerMembership ?? undefined,
                targetMember: member,
                mutedUntilIso: null,
              });
              const roleOptions = ROLES.map((role) => {
                const probe = changeMemberRole({
                  clubId: club.id,
                  actorUserId: currentUserId ?? '',
                  targetUserId: member.userId,
                  newRole: role,
                  memberships: members,
                });
                return { role, allowed: probe.ok || role === member.role };
              });
              return (
                <li key={member.userId} className={styles.listItem} data-member-status={member.status}>
                  <ClubAvatar name={member.displayName} avatarUrl={member.avatarUrl} />
                  <div className={styles.grow}>
                    <div className={styles.wrap}>
                      <p className={styles.tiny} style={{ margin: 0, fontWeight: 700 }}>
                        {member.displayName}
                        {isSelf ? <span className={styles.muted}> · vous</span> : null}
                      </p>
                      <ClubRoleBadge role={member.role} />
                      <ProAthleteBadge member={member} viewerContext={viewerContext} />
                      {member.status !== 'active' ? (
                        <span className={styles.badge}>{MEMBERSHIP_STATUS_LABELS[member.status]}</span>
                      ) : null}
                    </div>
                    <p className={styles.cardMeta}>
                      Membre depuis {formatEventDate(member.joinedAt)}
                      {member.mutedUntil ? ` · en sourdine jusqu’au ${formatEventDate(member.mutedUntil)}` : ''}
                    </p>
                  </div>

                  {canManage && !isSelf ? (
                    <div className={styles.wrap}>
                      {canAdmin ? (
                        <label className={styles.label} htmlFor={`role-${member.userId}`}>
                          <span className={styles.srOnly}>Rôle de {member.displayName}</span>
                          <select
                            id={`role-${member.userId}`}
                            className={cx(styles.select, styles.small)}
                            value={member.role}
                            disabled={busy}
                            onChange={(changeEvent) =>
                              void run(member.userId, () =>
                                onChangeRole(member, changeEvent.target.value as ClubRole),
                              )
                            }
                          >
                            {roleOptions.map(({ role, allowed }) => (
                              <option key={role} value={role} disabled={!allowed}>
                                {roleLabel(role)}
                              </option>
                            ))}
                          </select>
                        </label>
                      ) : null}
                      {canManage ? (
                        <button
                          type="button"
                          className={cx(styles.button, styles.small, styles.ghost)}
                          disabled={!muteProbe.ok || busy}
                          onClick={() => {
                            const until = member.mutedUntil
                              ? null
                              : new Date(Date.parse(nowIso) + 24 * 60 * 60 * 1000).toISOString();
                            void run(member.userId, () => onMuteMember(member, until));
                          }}
                        >
                          {member.mutedUntil ? 'Lever la sourdine' : 'Sourdine 24 h'}
                        </button>
                      ) : null}
                      {removeProbe.ok ? (
                        <button
                          type="button"
                          className={cx(styles.button, styles.small, styles.danger)}
                          disabled={busy}
                          onClick={() => void run(member.userId, () => onRemoveMember(member, 'remove'))}
                        >
                          Retirer
                        </button>
                      ) : null}
                      {banProbe.ok ? (
                        <button
                          type="button"
                          className={cx(styles.button, styles.small, styles.danger)}
                          disabled={busy}
                          onClick={() => void run(member.userId, () => onRemoveMember(member, 'ban'))}
                        >
                          Bannir
                        </button>
                      ) : null}
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </section>
  );
}

export default ClubMembersPanel;
