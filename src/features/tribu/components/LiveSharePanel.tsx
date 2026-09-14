'use client';

import React, { useCallback, useEffect, useState } from 'react';
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
    <div
      className="glass rounded-2xl p-4 space-y-3"
      data-testid="live-share-panel"
      data-live-active={session ? 'true' : 'false'}
    >
      {!session ? (
        <>
          <div className="flex items-center justify-between gap-3">
            <div>
              <h3 className="font-display font-bold text-sm text-[var(--lkv-text-primary)]">
                Position live
              </h3>
              <p className="text-xs text-[var(--lkv-text-secondary)] mt-0.5">
                Désactivé par défaut — démarrage explicite uniquement.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setConsentOpen((open) => !open)}
              disabled={busy}
              className="glass-capsule-btn primary text-xs font-bold px-4 min-h-[44px] disabled:opacity-60 shrink-0"
              data-testid="live-start-open"
            >
              <span className="relative z-10">Démarrer une sortie live</span>
            </button>
          </div>
          {consentOpen && (
            <div className="space-y-2 border-t border-white/40 pt-3">
              <p className="text-xs text-[var(--lkv-text-secondary)] leading-relaxed">
                Votre position ne sera visible que par les membres de ce groupe, pendant la
                session. Elle n’est jamais publique, jamais conservée après l’arrêt (une seule
                position, la dernière), et vous pouvez l’arrêter à tout moment.
              </p>
              <div className="flex gap-2 flex-wrap">
                {DURATIONS.map((duration) => (
                  <button
                    key={duration.hours}
                    type="button"
                    onClick={() => onStart(duration.hours)}
                    disabled={busy}
                    className="glass-capsule-btn text-xs font-bold px-4 min-h-[44px] disabled:opacity-60"
                    data-testid={`live-start-${duration.hours}`}
                  >
                    <span className="relative z-10">{duration.label}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </>
      ) : (
        <>
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <span className="flex items-center gap-2">
                <span
                  className="inline-block w-2 h-2 rounded-full bg-lkv-primary animate-pulse"
                  aria-hidden
                />
                <h3 className="font-display font-bold text-sm text-[var(--lkv-text-primary)]">
                  Sortie live en cours
                </h3>
              </span>
              <p className="text-xs text-[var(--lkv-text-secondary)] mt-0.5" data-testid="live-remaining">
                {formatSessionRemaining(session.expiresAt) ?? 'Session ouverte'} ·{' '}
                {positions.length} membre{positions.length > 1 ? 's' : ''} sur la carte
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={onToggleSharing}
                disabled={busy}
                aria-pressed={mySharing}
                className={`glass-capsule-btn text-xs font-bold px-4 min-h-[44px] disabled:opacity-60 ${
                  mySharing ? '' : 'primary'
                }`}
                data-testid="live-toggle-sharing"
              >
                <span className="relative z-10">
                  {busy ? '…' : mySharing ? 'Arrêter mon partage' : 'Partager ma position'}
                </span>
              </button>
              {isOrganizer && (
                <button
                  type="button"
                  onClick={onCloseSession}
                  disabled={busy}
                  className="glass-capsule-btn text-xs font-bold px-4 min-h-[44px] disabled:opacity-60"
                  data-testid="live-close-session"
                >
                  <span className="relative z-10">Clôturer</span>
                </button>
              )}
            </div>
          </div>
          {mySharing && (
            <p
              className="glass-pill pill-danger text-[10px] font-mono font-bold inline-flex"
              data-testid="live-sharing-indicator"
            >
              PARTAGE ACTIF — arrêt à un tap
            </p>
          )}
        </>
      )}
      {error && (
        <p role="alert" className="text-xs font-bold text-[var(--lkv-danger)]" data-testid="live-error">
          {error}
        </p>
      )}
    </div>
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
      <div className="glass rounded-2xl p-4" data-testid="live-share-panel-loading">
        <p className="text-xs text-[var(--lkv-text-muted)]">Position live…</p>
      </div>
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
