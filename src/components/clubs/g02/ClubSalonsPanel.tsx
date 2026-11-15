'use client';

import React, { useMemo, useState } from 'react';

import {
  listChannelMessagesForViewer,
  moderateChannelMessage,
  postChannelMessage,
  reportChannelMessage,
  type ClubChannel,
  type ClubChannelMessage,
  type ClubMember,
  type ViewerPrivacyContext,
} from '@/features/clubs';
import { channelKindLabel } from './model';
import { ClubAvatar } from './ClubIdentity';
import styles from './g02.module.css';

function cx(...values: Array<string | false | null | undefined>): string {
  return values.filter(Boolean).join(' ');
}

function messageTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('fr-FR', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Europe/Paris',
  }).format(date);
}

export interface ClubSalonsPanelProps {
  channels: readonly ClubChannel[];
  activeChannelId: string | null;
  messages: readonly ClubChannelMessage[];
  memberships: readonly ClubMember[];
  viewerContext: ViewerPrivacyContext;
  currentUserId: string | null;
  nowIso: string;
  loading?: boolean;
  error?: string | null;
  onSelectChannel: (channelId: string) => void;
  onSendMessage: (channel: ClubChannel, body: string) => Promise<void> | void;
  onModerateMessage: (
    message: ClubChannelMessage,
    action: 'hide' | 'delete',
    reason?: string | null,
  ) => Promise<void> | void;
  onReportMessage?: (message: ClubChannelMessage, reason: string) => Promise<void> | void;
  onRetry?: () => void;
}

/**
 * S5.07 — salon de club : lecture fail-closed, publication contrôlée,
 * modération admin/modérateur et signalement par les membres actifs.
 *
 * Le composant ne fait jamais confiance à `messages` : il repasse la liste
 * dans `listChannelMessagesForViewer` (blocages S6.19, messages masqués ou
 * supprimés) avant de rendre quoi que ce soit.
 */
export function ClubSalonsPanel({
  channels,
  activeChannelId,
  messages,
  memberships,
  viewerContext,
  currentUserId,
  nowIso,
  loading = false,
  error = null,
  onSelectChannel,
  onSendMessage,
  onModerateMessage,
  onReportMessage,
  onRetry,
}: ClubSalonsPanelProps) {
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [composerError, setComposerError] = useState<string | null>(null);
  const [reportingId, setReportingId] = useState<string | null>(null);
  const [reportReason, setReportReason] = useState('');
  const [reportError, setReportError] = useState<string | null>(null);

  const activeChannel =
    channels.find((channel) => channel.id === activeChannelId) ?? channels[0] ?? null;

  const actorMember = useMemo(
    () =>
      currentUserId
        ? memberships.find(
            (member) =>
              member.userId === currentUserId &&
              member.clubId === (activeChannel?.clubId ?? memberships[0]?.clubId ?? '') &&
              member.status === 'active',
          ) ?? null
        : null,
    [activeChannel?.clubId, currentUserId, memberships],
  );

  const visibleMessages = useMemo(() => {
    if (!activeChannel) return [] as ClubChannelMessage[];
    const result = listChannelMessagesForViewer({
      channel: activeChannel,
      messages,
      viewerContext,
      memberships,
    });
    return result.ok ? result.data : [];
  }, [activeChannel, memberships, messages, viewerContext]);

  const canPost = useMemo(() => {
    if (!activeChannel || !actorMember) return false;
    const probe = postChannelMessage({
      id: 'probe',
      channel: activeChannel,
      actorMember,
      body: 'probe',
      nowIso,
    });
    return probe.ok;
  }, [activeChannel, actorMember, nowIso]);

  const membersById = useMemo(() => {
    const map = new Map<string, ClubMember>();
    for (const member of memberships) map.set(member.userId, member);
    return map;
  }, [memberships]);

  const submitMessage = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!activeChannel) return;
    setComposerError(null);
    const result = postChannelMessage({
      id: `local_${Date.now()}`,
      channel: activeChannel,
      actorMember: actorMember ?? undefined,
      body: draft,
      nowIso,
    });
    if (!result.ok) {
      setComposerError(result.message);
      return;
    }
    setSending(true);
    try {
      await onSendMessage(activeChannel, draft.trim());
      setDraft('');
    } catch (sendError) {
      setComposerError(sendError instanceof Error ? sendError.message : 'Envoi impossible.');
    } finally {
      setSending(false);
    }
  };

  const submitReport = async (message: ClubChannelMessage) => {
    setReportError(null);
    const result = reportChannelMessage({
      id: `report_${message.id}`,
      message,
      reporterMember: actorMember ?? undefined,
      reason: reportReason,
      nowIso,
    });
    if (!result.ok) {
      setReportError(result.message);
      return;
    }
    if (onReportMessage) {
      await onReportMessage(message, reportReason.trim());
    }
    setReportingId(null);
    setReportReason('');
  };

  if (loading) {
    return (
      <section className={styles.screen} aria-busy="true" aria-label="Chargement des salons">
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
            <strong>Les salons n’ont pas pu être chargés.</strong>
            <p className={styles.tiny} style={{ margin: '2px 0 8px' }}>
              {error}
            </p>
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

  if (channels.length === 0) {
    return (
      <section className={styles.screen}>
        <div className={styles.empty}>
          <p className={styles.emptyTitle}>Aucun salon pour l’instant</p>
          <p className={styles.emptyHint}>
            Un administrateur peut créer un salon général, des annonces ou un salon de sortie.
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className={styles.screen} aria-label="Salons du club">
      <div className={styles.sectionHeader}>
        <div>
          <p className={styles.eyebrow}>Salons · S5.07</p>
          <h2 className={styles.title}>Discussions du club</h2>
          <p className={styles.subtitle}>
            Les messages masqués et les auteurs bloqués ne sont jamais affichés. Les annonces sont en
            lecture seule pour les membres.
          </p>
        </div>
      </div>

      <div className={styles.channelList} role="tablist" aria-label="Salons">
        {channels.map((channel) => (
          <button
            key={channel.id}
            type="button"
            role="tab"
            aria-selected={channel.id === activeChannel?.id}
            data-active={channel.id === activeChannel?.id}
            className={styles.channelChip}
            onClick={() => onSelectChannel(channel.id)}
          >
            <span aria-hidden="true">{channel.kind === 'announcements' ? '◆' : '#'}</span>
            {channel.name}
            <span className={styles.srOnly}>, {channelKindLabel(channel.kind)}</span>
          </button>
        ))}
      </div>

      {activeChannel ? (
        <div className={styles.card}>
          <div className={styles.cardHeader}>
            <div>
              <h3 className={styles.cardTitle}>
                #{activeChannel.name}
              </h3>
              <p className={styles.cardMeta}>
                {channelKindLabel(activeChannel.kind)}
                {activeChannel.readOnlyForMembers
                  ? ' · lecture seule pour les membres'
                  : ' · ouvert aux membres actifs'}
              </p>
            </div>
            <span className={styles.badge}>{visibleMessages.length} messages</span>
          </div>

          {!actorMember ? (
            <p className={styles.notice}>
              Ce salon est réservé aux membres actifs du club. Demandez votre adhésion pour lire et
              participer.
            </p>
          ) : null}

          <div aria-live="polite" aria-label="Messages du salon">
            {visibleMessages.length === 0 ? (
              <div className={styles.empty}>
                <p className={styles.emptyTitle}>Le salon est calme</p>
                <p className={styles.emptyHint}>
                  {canPost ? 'Lancez la discussion avec un premier message.' : 'Aucun message visible.'}
                </p>
              </div>
            ) : (
              visibleMessages.map((message) => {
                const author = membersById.get(message.authorId);
                const canHide = moderateChannelMessage({
                  message,
                  actorMember: actorMember ?? undefined,
                  action: 'hide',
                  nowIso,
                }).ok;
                const canDelete = moderateChannelMessage({
                  message,
                  actorMember: actorMember ?? undefined,
                  action: 'delete',
                  nowIso,
                }).ok;
                const isAuthor = currentUserId !== null && message.authorId === currentUserId;
                return (
                  <article key={message.id} className={styles.message} aria-label={`Message de ${author?.displayName ?? 'un membre'}`}>
                    <ClubAvatar
                      name={author?.displayName ?? 'Membre'}
                      avatarUrl={author?.avatarUrl ?? null}
                      small
                    />
                    <div className={styles.grow}>
                      <div className={styles.rowBetween}>
                        <p className={styles.tiny} style={{ margin: 0, fontWeight: 700 }}>
                          {author?.displayName ?? 'Membre'}
                          {isAuthor ? <span className={styles.muted}> · vous</span> : null}
                        </p>
                        <time className={styles.tiny} dateTime={message.createdAt}>
                          {messageTime(message.createdAt)}
                          {message.editedAt ? ' · modifié' : ''}
                        </time>
                      </div>
                      <p className={styles.messageBody}>{message.body}</p>
                      <div className={styles.wrap}>
                        {onReportMessage && actorMember ? (
                          <button
                            type="button"
                            className={cx(styles.linkButton, styles.tiny)}
                            onClick={() => {
                              setReportingId(reportingId === message.id ? null : message.id);
                              setReportError(null);
                              setReportReason('');
                            }}
                            aria-expanded={reportingId === message.id}
                          >
                            Signaler
                          </button>
                        ) : null}
                        {canHide ? (
                          <button
                            type="button"
                            className={cx(styles.linkButton, styles.tiny)}
                            onClick={() => onModerateMessage(message, 'hide', 'Modération du salon')}
                          >
                            Masquer
                          </button>
                        ) : null}
                        {canDelete ? (
                          <button
                            type="button"
                            className={cx(styles.linkButton, styles.tiny)}
                            onClick={() => onModerateMessage(message, 'delete')}
                          >
                            Supprimer
                          </button>
                        ) : null}
                      </div>

                      {reportingId === message.id ? (
                        <div className={styles.stack} style={{ marginTop: 8 }}>
                          <label className={styles.label} htmlFor={`report-${message.id}`}>
                            Motif du signalement
                          </label>
                          <input
                            id={`report-${message.id}`}
                            className={styles.input}
                            value={reportReason}
                            onChange={(event) => setReportReason(event.target.value)}
                            placeholder="Propos hors sujet, agressif…"
                            maxLength={280}
                          />
                          {reportError ? (
                            <p className={styles.tiny} role="alert" style={{ color: 'var(--lkv-danger-dark)' }}>
                              {reportError}
                            </p>
                          ) : null}
                          <div className={styles.wrap}>
                            <button
                              type="button"
                              className={cx(styles.button, styles.small, styles.primary)}
                              onClick={() => void submitReport(message)}
                              disabled={reportReason.trim().length === 0}
                            >
                              Envoyer le signalement
                            </button>
                            <button
                              type="button"
                              className={cx(styles.button, styles.small, styles.ghost)}
                              onClick={() => setReportingId(null)}
                            >
                              Annuler
                            </button>
                          </div>
                        </div>
                      ) : null}
                    </div>
                  </article>
                );
              })
            )}
          </div>

          {actorMember ? (
            <form className={styles.composer} onSubmit={(event) => void submitMessage(event)}>
              <label className={styles.label} htmlFor="club-salon-composer">
                Votre message
              </label>
              <textarea
                id="club-salon-composer"
                className={styles.textarea}
                value={draft}
                onChange={(event) => {
                  setDraft(event.target.value);
                  setComposerError(null);
                }}
                placeholder={canPost ? 'Écrire au club…' : 'Ce salon est en lecture seule.'}
                maxLength={2000}
                disabled={!canPost || sending}
                aria-describedby={composerError ? 'club-salon-error' : undefined}
                aria-invalid={Boolean(composerError)}
              />
              {composerError ? (
                <p id="club-salon-error" role="alert" className={styles.tiny} style={{ color: 'var(--lkv-danger-dark)' }}>
                  {composerError}
                </p>
              ) : null}
              <div className={styles.rowBetween}>
                <p className={styles.tiny} style={{ margin: 0 }}>
                  {draft.trim().length}/2000
                </p>
                <button
                  type="submit"
                  className={cx(styles.button, styles.primary)}
                  disabled={!canPost || sending || draft.trim().length === 0}
                >
                  {sending ? 'Envoi…' : 'Publier'}
                </button>
              </div>
            </form>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

export default ClubSalonsPanel;
