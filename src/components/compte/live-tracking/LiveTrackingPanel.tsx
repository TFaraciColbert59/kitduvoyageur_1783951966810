'use client';

import React, { useCallback, useEffect, useId, useMemo, useState } from 'react';

import Button from '@/components/ui/Button';
import EmptyState from '@/components/ui/EmptyState';
import LkvIcon from '@/components/ui/LkvIcon';
import Spinner from '@/components/ui/Spinner';
import { useHapticFeedback } from '@/hooks/useHapticFeedback';
import type { LiveSessionState } from '@/features/live-tracking';
import type {
  CreatedShareLinkView,
  OwnerLiveTrackingStatus,
  ShareLinkView,
} from '@/features/compte/live-tracking/types';

import {
  DURATION_PRESETS,
  MAX_SHARE_MINUTES,
  MIN_SHARE_MINUTES,
  SHARE_LINK_LABEL,
  formatDuration,
  formatRemaining,
  isValidShareDuration,
  sessionStatusLabel,
} from './model';
import { liveTrackingApi, type LiveTrackingApi } from './liveTrackingApi';
import {
  Chip,
  ErrorNotice,
  PanelCard,
  SectionHeading,
  Switch,
  formatDateTime as formatDate,
} from './shared';

export interface LiveTrackingPanelProps {
  api?: LiveTrackingApi;
  initialStatus?: OwnerLiveTrackingStatus | null;
  sessionId?: string;
  onStatusChange?: (status: OwnerLiveTrackingStatus) => void;
}

const DEFAULT_DURATION_MINUTES = 60;

function activeSessionOf(status: OwnerLiveTrackingStatus | null): LiveSessionState | null {
  if (!status) return null;
  return (
    status.sessions.find((session) => session.sessionId === status.activeSessionId) ??
    status.sessions.find((session) => session.status === 'active') ??
    status.sessions.find((session) => session.status === 'paused') ??
    null
  );
}

function linksForSession(
  status: OwnerLiveTrackingStatus | null,
  sessionId: string | null
): ShareLinkView[] {
  if (!status || !sessionId) return [];
  return status.links.filter((link) => link.sessionId === sessionId);
}

function copyToClipboard(text: string): Promise<void> {
  if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
    return navigator.clipboard.writeText(text);
  }
  if (typeof document === 'undefined') return Promise.reject(new Error('clipboard_unavailable'));
  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.setAttribute('readonly', '');
  textarea.style.position = 'fixed';
  textarea.style.opacity = '0';
  document.body.appendChild(textarea);
  textarea.select();
  const copied = document.execCommand('copy');
  document.body.removeChild(textarea);
  return copied ? Promise.resolve() : Promise.reject(new Error('clipboard_unavailable'));
}

export function LiveTrackingPanel({
  api = liveTrackingApi,
  initialStatus = null,
  sessionId,
  onStatusChange,
}: LiveTrackingPanelProps) {
  const { haptic } = useHapticFeedback();
  const durationId = useId();
  const labelId = useId();
  const trailId = useId();

  const [status, setStatus] = useState<OwnerLiveTrackingStatus | null>(initialStatus);
  const [loading, setLoading] = useState(!initialStatus);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [created, setCreated] = useState<CreatedShareLinkView | null>(null);
  const [copied, setCopied] = useState<'idle' | 'copied' | 'failed'>('idle');
  const [duration, setDuration] = useState(DEFAULT_DURATION_MINUTES);
  const [includeTrail, setIncludeTrail] = useState(true);
  const [label, setLabel] = useState('');
  const [nowMs, setNowMs] = useState(initialStatus?.nowMs ?? Date.now());

  const session = activeSessionOf(status);
  const displaySession = session ?? status?.sessions[0] ?? null;
  const sessionLinks = useMemo(
    () => linksForSession(status, displaySession?.sessionId ?? null),
    [status, displaySession?.sessionId]
  );
  const activeLinks = sessionLinks.filter((link) => link.status === 'active');

  const refresh = useCallback(async () => {
    try {
      const next = await api.getStatus(sessionId);
      setStatus(next);
      setNowMs(next.nowMs);
      onStatusChange?.(next);
      setError(null);
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : 'Impossible de charger le suivi en direct.'
      );
    } finally {
      setLoading(false);
    }
  }, [api, onStatusChange, sessionId]);

  useEffect(() => {
    if (!initialStatus) void refresh();
  }, [initialStatus, refresh]);

  useEffect(() => {
    const timer = window.setInterval(() => setNowMs(Date.now()), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  const startSessionIfNeeded = useCallback(async (): Promise<string | null> => {
    if (session) return session.sessionId;
    const started = await api.startSession(sessionId);
    return started.sessionId;
  }, [api, session, sessionId]);

  const handleCreate = useCallback(async () => {
    if (!isValidShareDuration(duration)) {
      setError(`La durée doit être comprise entre ${MIN_SHARE_MINUTES} minutes et 72 heures.`);
      return;
    }
    setBusy('create');
    setError(null);
    setNotice(null);
    try {
      const targetSessionId = await startSessionIfNeeded();
      if (!targetSessionId) throw new Error('Séance indisponible.');
      const link = await api.createShareLink({
        sessionId: targetSessionId,
        durationMinutes: duration,
        label: label.trim() || undefined,
        includeTrail,
      });
      setCreated(link);
      setCopied('idle');
      setLabel('');
      setNotice('Lien créé. Copie-le maintenant : il ne sera plus affiché ensuite.');
      haptic('success');
      await refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Impossible de créer le lien.');
    } finally {
      setBusy(null);
    }
  }, [api, duration, haptic, includeTrail, label, refresh, startSessionIfNeeded]);

  const handleCopy = useCallback(async () => {
    if (!created) return;
    try {
      await copyToClipboard(created.shareUrl);
      setCopied('copied');
      haptic('light');
    } catch {
      setCopied('failed');
    }
  }, [created, haptic]);

  const handleRevoke = useCallback(
    async (link: ShareLinkView) => {
      setBusy(`revoke:${link.id}`);
      setError(null);
      try {
        await api.revokeShareLink(link.id, link.sessionId);
        if (created?.link.id === link.id) setCreated(null);
        setNotice('Lien révoqué. Toute personne qui l’ouvre ne verra plus ta position.');
        haptic('medium');
        await refresh();
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : 'Impossible de révoquer ce lien.');
      } finally {
        setBusy(null);
      }
    },
    [api, created?.link.id, haptic, refresh]
  );

  const handleStatus = useCallback(
    async (nextStatus: 'active' | 'paused' | 'ended') => {
      if (!session) return;
      setBusy(nextStatus);
      setError(null);
      try {
        await api.updateSession(session.sessionId, nextStatus);
        if (nextStatus === 'ended') {
          setCreated(null);
          setNotice('Séance terminée. Les liens sont révoqués et les positions purgées.');
        } else if (nextStatus === 'paused') {
          setNotice(
            'Partage en pause. Les liens restent valides mais aucune position n’est ajoutée.'
          );
        } else {
          setNotice('Partage repris.');
        }
        haptic('selection');
        await refresh();
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : 'Impossible de modifier le partage.');
      } finally {
        setBusy(null);
      }
    },
    [api, haptic, refresh, session]
  );

  const handlePing = useCallback(async () => {
    if (!session) return;
    setBusy('ping');
    setError(null);
    try {
      const result = await api.broadcast({
        sessionId: session.sessionId,
        event: 'safety_ping',
        shareUrl: created?.shareUrl,
      });
      const sent = result.notifiedContactIds.length;
      setNotice(
        sent === 0
          ? 'Aucun contact autorisé n’a pu être prévenu. Vérifie les consentements.'
          : `${sent} contact${sent > 1 ? 's' : ''} de sécurité prévenu${sent > 1 ? 's' : ''}.`
      );
      haptic(sent > 0 ? 'success' : 'warning');
      await refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Impossible de prévenir les contacts.');
    } finally {
      setBusy(null);
    }
  }, [api, created?.shareUrl, haptic, refresh, session]);

  const activeLinkCount = activeLinks.length;
  const maxExpiry = activeLinks.reduce<string | null>((latest, link) => {
    if (!latest) return link.expiresAtIso;
    return Date.parse(link.expiresAtIso) > Date.parse(latest) ? link.expiresAtIso : latest;
  }, null);

  return (
    <div className="space-y-4">
      <PanelCard aria-labelledby="live-tracking-state-title">
        <SectionHeading
          id="live-tracking-state-title"
          eyebrow="Beacon"
          title="Suivi en direct"
          description="Un lien temporaire permet à un proche de voir ta position. Rien n’est partagé sans lien actif."
        />

        {loading ? (
          <div className="flex items-center gap-3 py-4 text-[13px] text-[color:var(--glass-secondary)]">
            <Spinner size="sm" label="Chargement du suivi" />
            Chargement du suivi…
          </div>
        ) : null}

        {error ? <ErrorNotice message={error} onRetry={() => void refresh()} /> : null}

        {!loading && !error && session ? (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <Chip tone={session.status === 'active' ? 'live' : 'warning'}>
                {sessionStatusLabel(session.status)}
              </Chip>
              <span className="text-[12px] text-[color:var(--glass-secondary)]">
                {activeLinkCount} lien{activeLinkCount > 1 ? 's' : ''} actif
                {activeLinkCount > 1 ? 's' : ''}
                {maxExpiry ? ` · jusqu’à ${formatRemaining(maxExpiry, nowMs)}` : ''}
              </span>
            </div>
            <p className="text-[12px] text-[color:var(--glass-secondary)]">
              Séance démarrée le {formatDate(new Date(session.startedAtMs).toISOString())}.
            </p>
            <div className="flex flex-wrap gap-2">
              {session.status === 'active' ? (
                <Button
                  variant="secondary"
                  size="sm"
                  loading={busy === 'paused'}
                  onClick={() => void handleStatus('paused')}
                >
                  Mettre en pause
                </Button>
              ) : (
                <Button
                  variant="secondary"
                  size="sm"
                  loading={busy === 'active'}
                  onClick={() => void handleStatus('active')}
                >
                  Reprendre
                </Button>
              )}
              <Button
                variant="ghost"
                size="sm"
                loading={busy === 'ping'}
                onClick={() => void handlePing()}
                icon={
                  <span aria-hidden>
                    <LkvIcon name="bell" size={16} />
                  </span>
                }
              >
                Prévenir mes contacts
              </Button>
              <Button
                variant="destructive"
                size="sm"
                loading={busy === 'ended'}
                onClick={() => void handleStatus('ended')}
              >
                Terminer le partage
              </Button>
            </div>
          </div>
        ) : null}

        {!loading && !error && !session ? (
          <EmptyState
            compact
            icon={
              <span aria-hidden>
                <LkvIcon name="map-pin" size={26} />
              </span>
            }
            title="Aucun partage actif"
            description="Crée un lien ci-dessous : il ouvre une page de suivi sans compte."
          />
        ) : null}
      </PanelCard>

      {notice ? (
        <div
          role="status"
          className="rounded-2xl border border-[color:var(--lkv-action-soft)] bg-[var(--lkv-action-soft)] px-4 py-3 text-[13px] leading-relaxed text-[color:var(--lkv-action)]"
        >
          {notice}
        </div>
      ) : null}

      {created ? (
        <PanelCard aria-labelledby="live-tracking-created-title">
          <div className="mb-3 flex items-start justify-between gap-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[color:var(--lkv-action)]">
                Lien prêt
              </p>
              <h2
                id="live-tracking-created-title"
                className="mt-1 text-[18px] font-semibold text-[color:var(--glass-label)]"
              >
                Copie ce lien maintenant
              </h2>
            </div>
            <Chip tone="live">Visible une fois</Chip>
          </div>
          <p className="text-[13px] leading-relaxed text-[color:var(--glass-secondary)]">
            Il expirera dans {formatRemaining(created.expiresAtIso, nowMs)}. Toute personne qui
            l’obtient peut voir ta position jusqu’à cette échéance.
          </p>
          <div className="mt-4 flex flex-col gap-2 sm:flex-row">
            <label className="sr-only" htmlFor="live-share-url">
              Lien de suivi à partager
            </label>
            <input
              id="live-share-url"
              readOnly
              value={created.shareUrl}
              onFocus={(event) => event.currentTarget.select()}
              className="h-11 min-w-0 flex-1 rounded-xl border border-[color:var(--lkv-field-border)] bg-[var(--lkv-field-bg)] px-3 font-mono text-[12px] text-[color:var(--glass-label)]"
            />
            <Button variant="primary" size="md" onClick={() => void handleCopy()}>
              {copied === 'copied'
                ? 'Copié'
                : copied === 'failed'
                  ? 'Sélectionne le lien'
                  : 'Copier'}
            </Button>
          </div>
          {copied === 'failed' ? (
            <p role="alert" className="mt-2 text-[12px] text-[color:var(--lkv-danger-dark)]">
              La copie automatique est indisponible. Sélectionne le lien puis copie-le manuellement.
            </p>
          ) : null}
        </PanelCard>
      ) : null}

      <PanelCard aria-labelledby="live-tracking-create-title">
        <SectionHeading
          id="live-tracking-create-title"
          eyebrow="Nouveau lien"
          title="Partager ma position"
          description="Choisis une durée courte. Le lien se révoque à tout moment."
        />

        <fieldset>
          <legend className="mb-2 text-[13px] font-medium text-[color:var(--glass-label)]">
            Durée du partage
          </legend>
          <div className="flex flex-wrap gap-2">
            {DURATION_PRESETS.map((minutes) => (
              <button
                key={minutes}
                type="button"
                aria-pressed={duration === minutes}
                onClick={() => setDuration(minutes)}
                className={`min-h-11 rounded-full border px-4 text-[13px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--lkv-focus-ring)] ${
                  duration === minutes
                    ? 'border-[color:var(--lkv-action)] bg-[color:var(--lkv-action)] text-[color:var(--lkv-text-inverted)]'
                    : 'border-[color:var(--glass-rim)] bg-[var(--lkv-surface-paper)] text-[color:var(--glass-label)]'
                }`}
              >
                {formatDuration(minutes)}
              </button>
            ))}
          </div>
          <div className="mt-3 flex items-center gap-2">
            <label htmlFor={durationId} className="text-[12px] text-[color:var(--glass-secondary)]">
              Durée personnalisée
            </label>
            <input
              id={durationId}
              type="number"
              inputMode="numeric"
              min={MIN_SHARE_MINUTES}
              max={MAX_SHARE_MINUTES}
              step={5}
              value={duration}
              onChange={(event) => setDuration(Number(event.target.value))}
              className="h-11 w-24 rounded-xl border border-[color:var(--lkv-field-border)] bg-[var(--lkv-field-bg)] px-3 text-[13px] text-[color:var(--glass-label)]"
            />
            <span className="text-[12px] text-[color:var(--glass-secondary)]">minutes</span>
          </div>
        </fieldset>

        <div className="mt-4">
          <label
            htmlFor={labelId}
            className="mb-1 block text-[13px] font-medium text-[color:var(--glass-label)]"
          >
            Nom du lien{' '}
            <span className="font-normal text-[color:var(--glass-secondary)]">(facultatif)</span>
          </label>
          <input
            id={labelId}
            type="text"
            maxLength={80}
            value={label}
            placeholder="Ex. Vercors — samedi"
            onChange={(event) => setLabel(event.target.value)}
            className="h-11 w-full rounded-xl border border-[color:var(--lkv-field-border)] bg-[var(--lkv-field-bg)] px-3 text-[14px] text-[color:var(--glass-label)] placeholder:text-[color:var(--lkv-text-muted)]"
          />
        </div>

        <div className="mt-4">
          <Switch
            id={trailId}
            checked={includeTrail}
            onChange={setIncludeTrail}
            label="Afficher le tracé récent"
            description="Le proche voit les dernières positions, pas seulement la dernière."
          />
        </div>

        <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-[12px] leading-relaxed text-[color:var(--glass-secondary)]">
            Aucun compte requis pour le proche. Le lien est indépendant de tes réglages publics.
          </p>
          <Button
            variant="primary"
            size="md"
            loading={busy === 'create'}
            onClick={() => void handleCreate()}
          >
            Créer le lien de suivi
          </Button>
        </div>
      </PanelCard>

      <PanelCard aria-labelledby="live-tracking-links-title">
        <SectionHeading
          id="live-tracking-links-title"
          eyebrow="Historique"
          title="Liens de cette séance"
          description="Un lien révoqué ou expiré ne donne plus aucune coordonnée."
        />
        {sessionLinks.length === 0 ? (
          <p className="text-[13px] text-[color:var(--glass-secondary)]">
            Aucun lien créé pour l’instant.
          </p>
        ) : (
          <ul className="divide-y divide-[color:var(--glass-rim)]">
            {sessionLinks.map((link) => (
              <li
                key={link.id}
                className="flex flex-col gap-3 py-3 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="truncate text-[14px] font-medium text-[color:var(--glass-label)]">
                      {link.label ?? 'Lien de suivi'}
                    </p>
                    <Chip
                      tone={
                        link.status === 'active'
                          ? 'live'
                          : link.status === 'revoked'
                            ? 'danger'
                            : 'neutral'
                      }
                    >
                      {SHARE_LINK_LABEL[link.status]}
                    </Chip>
                  </div>
                  <p className="mt-1 text-[12px] text-[color:var(--glass-secondary)]">
                    Créé le {formatDate(link.createdAtIso)} · expire le{' '}
                    {formatDate(link.expiresAtIso)}
                    {link.includeTrail ? ' · tracé inclus' : ' · position seule'}
                  </p>
                </div>
                {link.status === 'active' ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    loading={busy === `revoke:${link.id}`}
                    onClick={() => void handleRevoke(link)}
                  >
                    Révoquer
                  </Button>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </PanelCard>

      {status && status.notifications.length > 0 ? (
        <PanelCard aria-labelledby="live-tracking-notifications-title">
          <SectionHeading
            id="live-tracking-notifications-title"
            eyebrow="Contacts"
            title="Dernières alertes"
            description="Les envois sont tracés localement ; aucun contact non consentant n’est notifié."
          />
          <ul className="space-y-2">
            {status.notifications
              .slice(-3)
              .reverse()
              .map((notification, index) => (
                <li
                  key={`${notification.contactId}-${notification.sentAtMs}-${index}`}
                  className="text-[12px] text-[color:var(--glass-secondary)]"
                >
                  {notification.event === 'safety_ping'
                    ? 'Ping de sécurité'
                    : notification.event === 'live_share_started'
                      ? 'Partage démarré'
                      : 'Partage arrêté'}{' '}
                  · {formatDateTime(new Date(notification.sentAtMs).toISOString())}
                </li>
              ))}
          </ul>
        </PanelCard>
      ) : null}
    </div>
  );
}

export default LiveTrackingPanel;
