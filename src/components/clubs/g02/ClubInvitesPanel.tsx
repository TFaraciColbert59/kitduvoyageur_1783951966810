'use client';

import React, { useMemo, useState } from 'react';

import {
  revokeInviteLink,
  updateRecordedActivityInvite,
  type ClubMember,
  type InviteLink,
  type InviteTargetKind,
  type RecordedActivityInvite,
  type ViewerPrivacyContext,
} from '@/features/clubs';
import {
  formatEventDate,
  inviteAvailability,
  INVITE_AVAILABILITY_LABELS,
  inviteKindLabel,
  inviteUsesLabel,
} from './model';
import styles from './g02.module.css';

function cx(...values: Array<string | false | null | undefined>): string {
  return values.filter(Boolean).join(' ');
}

export interface CreateInviteInput {
  kind: InviteTargetKind;
  targetId: string;
  clubId: string | null;
  expiresInDays: number | null;
  maxUses: number | null;
}

export interface ClubInvitesPanelProps {
  invites: readonly InviteLink[];
  activityInvites?: readonly RecordedActivityInvite[];
  memberships: readonly ClubMember[];
  viewerContext: ViewerPrivacyContext;
  currentUserId: string | null;
  nowIso: string;
  canCreate?: boolean;
  loading?: boolean;
  error?: string | null;
  onCreateInvite: (input: CreateInviteInput) => Promise<void> | void;
  onRevokeInvite: (invite: InviteLink) => Promise<void> | void;
  onRespondActivityInvite?: (
    invite: RecordedActivityInvite,
    action: 'accept' | 'decline' | 'revoke',
  ) => Promise<void> | void;
  onRetry?: () => void;
}

/**
 * K5.21 / K5.22 / S5.19 — liens et QR d’invitation, plus invitations à
 * réutiliser une trace enregistrée. Un lien révoqué, expiré ou épuisé est
 * signalé avant toute tentative de consommation ; la révocation est
 * pré-validée par le contrat.
 */
export function ClubInvitesPanel({
  invites,
  activityInvites = [],
  memberships,
  viewerContext,
  currentUserId,
  nowIso,
  canCreate = false,
  loading = false,
  error = null,
  onCreateInvite,
  onRevokeInvite,
  onRespondActivityInvite,
  onRetry,
}: ClubInvitesPanelProps) {
  const [kind, setKind] = useState<InviteTargetKind>('club');
  const [targetId, setTargetId] = useState('');
  const [expiresInDays, setExpiresInDays] = useState('7');
  const [maxUses, setMaxUses] = useState('1');
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, setPending] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const activeInvites = useMemo(
    () => [...invites].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt)),
    [invites],
  );

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormError(null);
    if (!targetId.trim()) {
      setFormError('La cible de l’invitation est requise.');
      return;
    }
    const parsedDays = expiresInDays.trim() === '' ? null : Number(expiresInDays);
    const parsedUses = maxUses.trim() === '' ? null : Number(maxUses);
    if (parsedDays !== null && (!Number.isFinite(parsedDays) || parsedDays < 1)) {
      setFormError('La durée doit être d’au moins un jour.');
      return;
    }
    if (parsedUses !== null && (!Number.isFinite(parsedUses) || parsedUses < 1)) {
      setFormError('Le nombre d’utilisations doit être d’au moins 1.');
      return;
    }
    setPending('create');
    try {
      await onCreateInvite({
        kind,
        targetId: targetId.trim(),
        clubId: kind === 'club' ? targetId.trim() : null,
        expiresInDays: parsedDays,
        maxUses: parsedUses,
      });
      setTargetId('');
    } catch (createError) {
      setFormError(createError instanceof Error ? createError.message : 'Création impossible.');
    } finally {
      setPending(null);
    }
  };

  const copy = async (invite: InviteLink) => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      await navigator.clipboard.writeText(invite.shareUrl);
    }
    setCopiedId(invite.id);
  };

  const run = async (key: string, action: () => Promise<void> | void) => {
    setPending(key);
    try {
      await action();
    } finally {
      setPending(null);
    }
  };

  if (loading) {
    return (
      <section className={styles.screen} aria-busy="true" aria-label="Chargement des invitations">
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
            <strong>Les invitations n’ont pas pu être chargées.</strong>
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
    <section className={styles.screen} aria-label="Invitations du club">
      <div className={styles.sectionHeader}>
        <div>
          <p className={styles.eyebrow}>Invitations · K5.21 / K5.22</p>
          <h2 className={styles.title}>Inviter sans fuite</h2>
          <p className={styles.subtitle}>
            Un lien porte une cible et une limite. Un lien révoqué, expiré ou épuisé ne peut plus être
            consommé, et un blocage S6.19 le neutralise.
          </p>
        </div>
      </div>

      {canCreate ? (
        <form className={styles.card} noValidate onSubmit={(event) => void submit(event)}>
          <div className={styles.cardHeader}>
            <h3 className={styles.cardTitle}>Créer un lien</h3>
          </div>
          <div className={styles.formRow}>
            <div className={styles.field}>
              <label className={styles.label} htmlFor="g02-invite-kind">
                Type
              </label>
              <select
                id="g02-invite-kind"
                className={styles.select}
                value={kind}
                onChange={(event) => setKind(event.target.value as InviteTargetKind)}
              >
                <option value="club">Club</option>
                <option value="event">Sortie</option>
                <option value="recorded_activity">Trace enregistrée</option>
              </select>
            </div>
            <div className={styles.field}>
              <label className={styles.label} htmlFor="g02-invite-target">
                Identifiant de la cible
              </label>
              <input
                id="g02-invite-target"
                className={styles.input}
                value={targetId}
                onChange={(event) => setTargetId(event.target.value)}
                required
              />
            </div>
            <div className={styles.field}>
              <label className={styles.label} htmlFor="g02-invite-expires">
                Expire dans (jours)
              </label>
              <input
                id="g02-invite-expires"
                className={styles.input}
                inputMode="numeric"
                value={expiresInDays}
                onChange={(event) => setExpiresInDays(event.target.value)}
                placeholder="Vide = jamais"
              />
            </div>
            <div className={styles.field}>
              <label className={styles.label} htmlFor="g02-invite-uses">
                Utilisations max.
              </label>
              <input
                id="g02-invite-uses"
                className={styles.input}
                inputMode="numeric"
                value={maxUses}
                onChange={(event) => setMaxUses(event.target.value)}
                placeholder="Vide = illimité"
              />
            </div>
          </div>
          {formError ? (
            <p className={styles.tiny} role="alert" style={{ color: 'var(--lkv-danger-dark)' }}>
              {formError}
            </p>
          ) : null}
          <div>
            <button type="submit" className={cx(styles.button, styles.primary)} disabled={pending === 'create'}>
              {pending === 'create' ? 'Création…' : 'Générer le lien'}
            </button>
          </div>
        </form>
      ) : null}

      {activeInvites.length === 0 ? (
        <div className={styles.empty}>
          <p className={styles.emptyTitle}>Aucun lien actif</p>
          <p className={styles.emptyHint}>
            Les liens que vous créez apparaissent ici avec leur QR et leur durée de validité.
          </p>
        </div>
      ) : (
        <ul className={styles.list}>
          {activeInvites.map((invite) => {
            const availability = inviteAvailability(invite, nowIso);
            const revokeProbe = revokeInviteLink({
              invite,
              actorUserId: currentUserId ?? '',
              memberships,
              nowIso,
            });
            const isOwner = currentUserId !== null && invite.createdBy === currentUserId;
            return (
              <li key={invite.id}>
                <article className={styles.card} aria-label={inviteKindLabel(invite.kind)}>
                  <div className={styles.cardHeader}>
                    <div>
                      <div className={styles.wrap}>
                        <span className={styles.badge}>{inviteKindLabel(invite.kind)}</span>
                        <span
                          className={cx(
                            styles.badge,
                            availability === 'active' ? styles.badgeSage : styles.badgeWarn,
                          )}
                        >
                          {INVITE_AVAILABILITY_LABELS[availability]}
                        </span>
                        {isOwner ? <span className={styles.badge}>Votre lien</span> : null}
                      </div>
                      <p className={styles.cardMeta} style={{ marginTop: 6 }}>
                        {inviteUsesLabel(invite)}
                        {invite.expiresAt ? ` · expire le ${formatEventDate(invite.expiresAt)}` : ' · sans expiration'}
                      </p>
                    </div>
                  </div>
                  <div className={styles.mono}>{invite.shareUrl}</div>
                  <div className={styles.mono} aria-label="Charge utile du QR">
                    {invite.qrPayload}
                  </div>
                  <div className={styles.rowBetween}>
                    <p className={styles.tiny} style={{ margin: 0 }}>
                      Cible : {invite.targetId}
                    </p>
                    <div className={styles.wrap}>
                      <button
                        type="button"
                        className={cx(styles.button, styles.small)}
                        onClick={() => void copy(invite)}
                      >
                        {copiedId === invite.id ? 'Lien copié' : 'Copier'}
                      </button>
                      {availability === 'active' && revokeProbe.ok ? (
                        <button
                          type="button"
                          className={cx(styles.button, styles.small, styles.danger)}
                          disabled={pending === invite.id}
                          onClick={() => void run(invite.id, () => onRevokeInvite(invite))}
                        >
                          {pending === invite.id ? 'Révocation…' : 'Révoquer'}
                        </button>
                      ) : null}
                    </div>
                  </div>
                </article>
              </li>
            );
          })}
        </ul>
      )}

      {activityInvites.length > 0 ? (
        <section className={styles.card} aria-label="Invitations sur traces enregistrées">
          <div className={styles.cardHeader}>
            <div>
              <h3 className={styles.cardTitle}>Traces partagées · S5.19</h3>
              <p className={styles.cardMeta}>
                Une trace reste privée tant que son propriétaire ne l’a pas explicitement partagée.
              </p>
            </div>
          </div>
          <ul className={styles.list}>
            {activityInvites.map((invite) => {
              const isInvitee = invite.inviteeUserId === currentUserId;
              const isOwner = invite.ownerUserId === currentUserId;
              const acceptProbe = updateRecordedActivityInvite({
                invite,
                actorUserId: currentUserId ?? '',
                action: 'accept',
                privacyContext: viewerContext,
                nowIso,
              });
              const declineProbe = updateRecordedActivityInvite({
                invite,
                actorUserId: currentUserId ?? '',
                action: 'decline',
                privacyContext: viewerContext,
                nowIso,
              });
              const revokeProbe = updateRecordedActivityInvite({
                invite,
                actorUserId: currentUserId ?? '',
                action: 'revoke',
                privacyContext: viewerContext,
                nowIso,
              });
              return (
                <li key={invite.id} className={styles.listItem}>
                  <div className={styles.grow}>
                    <p className={styles.tiny} style={{ margin: 0, fontWeight: 700 }}>
                      {isInvitee ? 'Une trace vous a été partagée' : isOwner ? 'Votre trace' : 'Trace partagée'}
                    </p>
                    <p className={styles.cardMeta}>
                      Statut : {invite.status} · {formatEventDate(invite.createdAt)}
                    </p>
                  </div>
                  <div className={styles.wrap}>
                    {!isOwner && acceptProbe.ok && onRespondActivityInvite ? (
                      <button
                        type="button"
                        className={cx(styles.button, styles.small, styles.primary)}
                        onClick={() => void onRespondActivityInvite?.(invite, 'accept')}
                      >
                        Accepter
                      </button>
                    ) : null}
                    {!isOwner && declineProbe.ok && onRespondActivityInvite ? (
                      <button
                        type="button"
                        className={cx(styles.button, styles.small)}
                        onClick={() => void onRespondActivityInvite?.(invite, 'decline')}
                      >
                        Refuser
                      </button>
                    ) : null}
                    {isOwner && revokeProbe.ok && onRespondActivityInvite ? (
                      <button
                        type="button"
                        className={cx(styles.button, styles.small, styles.danger)}
                        onClick={() => void onRespondActivityInvite?.(invite, 'revoke')}
                      >
                        Révoquer
                      </button>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}
    </section>
  );
}

export default ClubInvitesPanel;
