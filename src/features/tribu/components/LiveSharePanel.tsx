'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { Badge, Button, Card, LoadingState } from '@/components/ui';
import {
  startLiveSession,
  stopLiveSession,
  getLiveState,
  type LiveSessionInfo,
  type LiveMemberPosition,
} from '@/features/tribu/actions/livePosition';
import { useLivePositionSharing } from '@/features/tribu/hooks/useLivePositionSharing';
import { formatSessionRemaining } from '@/features/tribu/lib/live';

interface LiveSharePanelViewProps {
  session: LiveSessionInfo | null;
  mySharing: boolean;
  positions: LiveMemberPosition[];
  busy: boolean;
  error: string | null;
  isOrganizer: boolean;
  onStart: (durationHours: number) => void;
  onToggleSharing: () => void;
  onCloseSession: () => void;
}

const DURATIONS = [
  { hours: 2, label: '2 h' },
  { hours: 8, label: '8 h' },
  { hours: 24, label: '24 h' },
];

/** Vue pure — testable sans réseau ni géolocalisation. */
export function LiveSharePanelView({
  session,
  mySharing,
  positions,
  busy,
  error,
  isOrganizer,
  onStart,
  onToggleSharing,
  onCloseSession,
}: LiveSharePanelViewProps) {
  const [consentOpen, setConsentOpen] = useState(false);

  return (
    <Card
      className="space-y-[var(--space-3)] p-[var(--space-4)]"
      data-testid="live-share-panel"
      data-live-active={session ? 'true' : 'false'}
    >
      {!session ? (
        <>
          <div className="flex items-center justify-between gap-[var(--space-3)]">
            <div>
              <h3 className="font-display text-[length:var(--lkv-text-subheadline)] font-bold text-[color:var(--lkv-text-primary)]">
                Position live
              </h3>
              <p className="mt-0.5 text-[length:var(--lkv-text-caption)] text-[color:var(--lkv-text-secondary)]">
                Désactivé par défaut — démarrage explicite uniquement.
              </p>
            </div>
            <Button
              variant="primary"
              size="sm"
              onClick={() => setConsentOpen((open) => !open)}
              disabled={busy}
              className="shrink-0"
              data-testid="live-start-open"
            >
              Démarrer une sortie live
            </Button>
          </div>
          {consentOpen && (
            <div className="space-y-[var(--space-2)] border-t border-[color:var(--lkv-border)] pt-[var(--space-3)]">
              <p className="text-[length:var(--lkv-text-caption)] leading-relaxed text-[color:var(--lkv-text-secondary)]">
                Votre position ne sera visible que par les membres de ce groupe, pendant la
                session. Elle n’est jamais publique, jamais conservée après l’arrêt (une seule
                position, la dernière), et vous pouvez l’arrêter à tout moment.
              </p>
              <div className="flex flex-wrap gap-[var(--space-2)]">
                {DURATIONS.map((duration) => (
                  <Button
                    key={duration.hours}
                    variant="secondary"
                    size="sm"
                    onClick={() => onStart(duration.hours)}
                    disabled={busy}
                    data-testid={`live-start-${duration.hours}`}
                  >
                    {duration.label}
                  </Button>
                ))}
              </div>
            </div>
          )}
        </>
      ) : (
        <>
          <div className="flex items-center justify-between gap-[var(--space-3)]">
            <div className="min-w-0">
              <span className="flex items-center gap-[var(--space-2)]">
                <span
                  className="inline-block h-2 w-2 animate-pulse rounded-full bg-[color:var(--lkv-primary)]"
                  aria-hidden
                />
                <h3 className="font-display text-[length:var(--lkv-text-subheadline)] font-bold text-[color:var(--lkv-text-primary)]">
                  Sortie live en cours
                </h3>
              </span>
              <p
                className="mt-0.5 text-[length:var(--lkv-text-caption)] text-[color:var(--lkv-text-secondary)]"
                data-testid="live-remaining"
              >
                {formatSessionRemaining(session.expiresAt) ?? 'Session ouverte'} ·{' '}
                {positions.length} membre{positions.length > 1 ? 's' : ''} sur la carte
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-[var(--space-2)]">
              <Button
                variant={mySharing ? 'secondary' : 'primary'}
                size="sm"
                onClick={onToggleSharing}
                disabled={busy}
                aria-pressed={mySharing}
                data-testid="live-toggle-sharing"
              >
                {busy ? '…' : mySharing ? 'Arrêter mon partage' : 'Partager ma position'}
              </Button>
              {isOrganizer && (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={onCloseSession}
                  disabled={busy}
                  data-testid="live-close-session"
                >
                  Clôturer
                </Button>
              )}
            </div>
          </div>
          {mySharing && (
            <span data-testid="live-sharing-indicator" className="inline-flex">
              <Badge tone="danger" className="font-mono font-bold">
                PARTAGE ACTIF — arrêt à un tap
              </Badge>
            </span>
          )}
        </>
      )}
      {error && (
        <p
          role="alert"
          className="text-[length:var(--lkv-text-caption)] font-bold text-[color:var(--lkv-danger)]"
          data-testid="live-error"
        >
          {error}
        </p>
      )}
    </Card>
  );
}

interface LiveSharePanelProps {
  groupId: string;
  isOrganizer: boolean;
}

/** Conteneur : état live + consentement + hook de partage. */
export default function LiveSharePanel({ groupId, isOrganizer }: LiveSharePanelProps) {
  const [session, setSession] = useState<LiveSessionInfo | null>(null);
  const [positions, setPositions] = useState<LiveMemberPosition[]>([]);
  const [mySharing, setMySharing] = useState(false);
  const [wantsToShare, setWantsToShare] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  const refresh = useCallback(async () => {
    const result = await getLiveState(groupId);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setSession(result.session);
    setPositions(result.positions);
    setMySharing(result.mySharing);
    if (!result.mySharing) setWantsToShare(false);
    setLoaded(true);
  }, [groupId]);

  useEffect(() => {
    void refresh();
    const timer = setInterval(() => {
      void refresh();
    }, 60_000);
    return () => clearInterval(timer);
  }, [refresh]);

  const { active, sharingError, stop } = useLivePositionSharing({
    sessionId: session?.id ?? null,
    enabled: wantsToShare && !!session,
    onFatalError: (message) => {
      setWantsToShare(false);
      setError(message);
      void refresh();
    },
  });

  const handleStart = async (durationHours: number) => {
    setBusy(true);
    setError(null);
    const result = await startLiveSession({ groupId, durationHours });
    setBusy(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setSession(result.session);
    setPositions([]);
    setMySharing(false);
    // Opt-in individuel : le partage démarre uniquement via le toggle.
    setWantsToShare(false);
    setLoaded(true);
  };

  const handleToggleSharing = async () => {
    const sharing = mySharing || active;
    if (sharing) {
      setBusy(true);
      setError(null);
      const result = await stop();
      setBusy(false);
      if (!result.ok) {
        setError(result.error ?? 'Arrêt impossible pour le moment.');
        return;
      }
      setMySharing(false);
      setWantsToShare(false);
      void refresh();
      return;
    }
    setError(null);
    setWantsToShare(true);
  };

  const handleCloseSession = async () => {
    if (!session) return;
    setBusy(true);
    setError(null);
    const result = await stopLiveSession({ sessionId: session.id });
    setBusy(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setWantsToShare(false);
    setMySharing(false);
    setSession(null);
    setPositions([]);
    void refresh();
  };

  if (!loaded) {
    return (
      <Card className="p-[var(--space-4)]" data-testid="live-share-panel-loading">
        <LoadingState compact label="Position live…" />
      </Card>
    );
  }

  return (
    <LiveSharePanelView
      session={session}
      mySharing={mySharing || active}
      positions={positions}
      busy={busy}
      error={error ?? sharingError}
      isOrganizer={isOrganizer}
      onStart={handleStart}
      onToggleSharing={handleToggleSharing}
      onCloseSession={handleCloseSession}
    />
  );
}
