'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  type DeviceCapability,
  type LiveSegmentDefinition,
  type PrivacyContext,
  type SportType,
} from '@/features/live-segments';
import {
  LiveSegmentAlertBanner,
  LiveSegmentDeviceSync,
  LiveSegmentHud,
  LiveSegmentsList,
  createLiveSegmentsApi,
  useLiveSegmentSession,
  type LiveSegmentSummaryView,
} from '@/components/live-segments';
import { useAuth } from '@/contexts/AuthContext';

const CACHE_KEY = 'lkdv.live_segments.cache.v1';

const DEVICE_PRESETS: Array<{ id: DeviceCapability['platform']; label: string; cap: DeviceCapability }> = [
  {
    id: 'garmin_connect',
    label: 'Garmin Connect',
    cap: { platform: 'garmin_connect', supportsLiveSegments: true, maxStarredSegments: 100, bluetoothConnected: true },
  },
  {
    id: 'wahoo_elemnt',
    label: 'Wahoo ELEMNT',
    cap: { platform: 'wahoo_elemnt', supportsLiveSegments: true, maxStarredSegments: 50, bluetoothConnected: true },
  },
  {
    id: 'hammerhead_karoo',
    label: 'Hammerhead Karoo',
    cap: { platform: 'hammerhead_karoo', supportsLiveSegments: true, maxStarredSegments: 100, bluetoothConnected: true },
  },
  {
    id: 'apple_watch',
    label: 'Apple Watch',
    cap: { platform: 'apple_watch', supportsLiveSegments: true, maxStarredSegments: 25, bluetoothConnected: true },
  },
  {
    id: 'wear_os',
    label: 'Wear OS',
    cap: { platform: 'wear_os', supportsLiveSegments: true, maxStarredSegments: 25, bluetoothConnected: true },
  },
];

function mapExplorerSportToLive(raw: string): SportType | undefined {
  const s = raw.toLowerCase();
  if (s === 'velo' || s === 'cycling' || s === 'route') return 'cycling';
  if (s === 'gravel') return 'gravel';
  if (s === 'trail') return 'trail';
  if (s === 'course' || s === 'running' || s === 'run') return 'running';
  if (s === 'rando' || s === 'hiking' || s === 'marche') return 'hiking';
  return undefined;
}

function readCachedSegments(): LiveSegmentSummaryView[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(CACHE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as LiveSegmentSummaryView[]) : [];
  } catch {
    return [];
  }
}

function writeCachedSegments(items: LiveSegmentSummaryView[]): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(CACHE_KEY, JSON.stringify(items.slice(0, 30)));
  } catch {
    /* ignore storage quota */
  }
}

export interface ExplorerLiveSegmentsPanelProps {
  sport: string;
  center: [number, number]; // [lng, lat]
  online: boolean;
  paused?: boolean;
  compactOverlay?: boolean;
}

/**
 * Raccordement S03 (`S4.09`, `S4.10`) dans Explorer `LiveDirectTab` et HUD carte :
 * - Détection d'approche / actif / résultat éphémère (`LiveSegmentAlertBanner` + `LiveSegmentHud`)
 * - Repli cache hors ligne (`localStorage`) pour sortie en montagne sans réseau
 * - Synchronisation favoris vers GPS / montre (`LiveSegmentDeviceSync`)
 */
export function ExplorerLiveSegmentsPanel({
  sport,
  center,
  online,
  paused = false,
  compactOverlay = false,
}: ExplorerLiveSegmentsPanelProps) {
  const { user } = useAuth();
  const api = useMemo(() => createLiveSegmentsApi(), []);
  const [segments, setSegments] = useState<LiveSegmentSummaryView[]>(() => readCachedSegments());
  const [loading, setLoading] = useState(false);
  const [offlineFallback, setOfflineFallback] = useState(false);
  const [optedIn, setOptedIn] = useState(true);
  const [platform, setPlatform] = useState<DeviceCapability['platform']>('garmin_connect');
  const submittedEffortRef = useRef<string | null>(null);
  const [verdict, setVerdict] = useState<string | null>(null);

  const liveSport = mapExplorerSportToLive(sport);

  const loadSegments = useCallback(async () => {
    if (!online) {
      setSegments(readCachedSegments());
      setOfflineFallback(true);
      return;
    }
    setLoading(true);
    setOfflineFallback(false);
    try {
      const res = await api.list({
        lat: Number.isFinite(center[1]) ? center[1] : undefined,
        lon: Number.isFinite(center[0]) ? center[0] : undefined,
        radius: 50_000,
        sport: liveSport,
        limit: 12,
        optIn: optedIn,
      });
      setSegments(res.items);
      if (res.items.length > 0) writeCachedSegments(res.items);
    } catch {
      const cached = readCachedSegments();
      if (cached.length > 0) {
        setSegments(cached);
        setOfflineFallback(true);
      }
    } finally {
      setLoading(false);
    }
  }, [api, center[0], center[1], liveSport, online, optedIn]);

  useEffect(() => {
    void loadSegments();
  }, [loadSegments]);

  const definitions = useMemo<LiveSegmentDefinition[]>(
    () =>
      segments.map((s) => ({
        id: s.id,
        version: s.version,
        name: s.name,
        sport: s.sport,
        direction: s.direction,
        points: s.points,
        totalDistanceM: s.totalDistanceM,
        elevationGainM: s.elevationGainM,
        isPrivate: false,
        ownerId: 'lkdv-catalog',
        isStarred: true,
        ghostProfiles: s.ghostProfiles,
      })),
    [segments]
  );

  const privacy = useMemo<PrivacyContext>(
    () => ({
      viewerId: user?.id ?? 'anonymous',
      optedInLiveSegments: optedIn,
      blockedUserIds: new Set<string>(),
      allowedPeerIds: new Set<string>(),
    }),
    [user?.id, optedIn]
  );

  const session = useLiveSegmentSession({
    segments: definitions,
    privacy,
  });

  // Synchronise la pause d'activité Explorer avec le suivi Live Segment
  useEffect(() => {
    if (!session.isTracking) return;
    if (paused && !session.isPaused) session.pause();
    if (!paused && session.isPaused) session.resume();
  }, [paused, session]);

  // Pousse chaque nouvelle position carte/GPS dans le moteur quand le suivi est actif
  useEffect(() => {
    if (!session.isTracking || paused) return;
    if (!Number.isFinite(center[1]) || !Number.isFinite(center[0])) return;
    session.pushPoint({
      lat: center[1],
      lon: center[0],
      timestampMs: Date.now(),
    });
  }, [center[0], center[1], paused, session]);

  const finalResult = session.snapshot.finalResult;
  useEffect(() => {
    if (!finalResult || submittedEffortRef.current === finalResult.effortId) return;
    submittedEffortRef.current = finalResult.effortId;
    if (!online) {
      setVerdict('Effort conservé hors ligne (en attente de réseau).');
      return;
    }
    void api
      .submitEffort(finalResult.segmentId, finalResult)
      .then((res) => {
        setVerdict(
          res.effort.isValidForLeaderboard
            ? 'Temps validé et éligible au classement.'
            : 'Temps enregistré (hors classement public).'
        );
      })
      .catch(() => {
        setVerdict('Validation serveur indisponible ; résultat local conservé.');
      });
  }, [api, finalResult, online]);

  const activeAlert = session.alerts[0] ?? null;
  const deviceCapability =
    DEVICE_PRESETS.find((d) => d.id === platform)?.cap ?? DEVICE_PRESETS[0].cap;

  if (compactOverlay) {
    if (!activeAlert && !session.snapshot.isVisible) return null;
    return (
      <div
        role="region"
        aria-label="Segment en direct"
        style={{
          position: 'absolute',
          left: 14,
          right: 14,
          top: 'calc(var(--safe-top, 12px) + 64px)',
          zIndex: 12,
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
          pointerEvents: 'auto',
        }}
      >
        <LiveSegmentAlertBanner
          alert={activeAlert}
          snapshot={session.snapshot}
          onDismiss={activeAlert ? () => session.dismissAlert(activeAlert) : undefined}
          onAction={
            activeAlert?.type === 'finish' || activeAlert?.type === 'aborted'
              ? () => session.dismissAlert(activeAlert)
              : undefined
          }
        />
        {session.snapshot.isVisible ? (
          <LiveSegmentHud
            snapshot={session.snapshot}
            isPaused={session.isPaused}
            onPause={session.pause}
            onResume={session.resume}
            onStop={session.stop}
            onAcknowledge={() => {
              setVerdict(null);
              session.acknowledge();
            }}
            onRestart={() => {
              submittedEffortRef.current = null;
              setVerdict(null);
              if (session.selectedSegmentId) session.start(session.selectedSegmentId);
            }}
          />
        ) : null}
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 10 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <span className="xp-eyebrow" style={{ margin: 0 }}>
          Live Segments {offlineFallback ? '· Hors ligne (cache)' : ''}
        </span>
        <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11.5 }}>
          <input
            type="checkbox"
            checked={optedIn}
            onChange={(e) => setOptedIn(e.target.checked)}
          />
          Activer
        </label>
      </div>

      {!optedIn ? (
        <p style={{ margin: 0, fontSize: 12, color: 'var(--xp-mut)' }}>
          Live Segments désactivé pour cette sortie (préférence P01 respectée).
        </p>
      ) : (
        <>
          <LiveSegmentAlertBanner
            alert={activeAlert}
            snapshot={session.snapshot}
            onDismiss={activeAlert ? () => session.dismissAlert(activeAlert) : undefined}
            onAction={
              activeAlert?.type === 'finish' || activeAlert?.type === 'aborted'
                ? () => session.dismissAlert(activeAlert)
                : undefined
            }
          />
          {verdict ? (
            <p role="status" style={{ margin: 0, fontSize: 12, color: 'var(--xp-forest, #17402c)' }}>
              {verdict}
            </p>
          ) : null}
          {session.snapshot.isVisible ? (
            <LiveSegmentHud
              snapshot={session.snapshot}
              isPaused={session.isPaused}
              onPause={session.pause}
              onResume={session.resume}
              onStop={session.stop}
              onAcknowledge={() => {
                setVerdict(null);
                session.acknowledge();
              }}
              onRestart={() => {
                submittedEffortRef.current = null;
                setVerdict(null);
                if (session.selectedSegmentId) session.start(session.selectedSegmentId);
              }}
            />
          ) : loading ? (
            <p style={{ margin: 0, fontSize: 12, color: 'var(--xp-mut)' }}>
              Chargement des segments à proximité…
            </p>
          ) : (
            <LiveSegmentsList
              segments={segments}
              selectedId={session.selectedSegmentId}
              busy={session.isTracking}
              onStart={(seg) => {
                submittedEffortRef.current = null;
                setVerdict(null);
                session.start(seg.id);
              }}
            />
          )}

          {segments.length > 0 ? (
            <div style={{ marginTop: 4 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                <span style={{ fontSize: 11.5, fontWeight: 600 }}>Sync montre / GPS (S4.10)</span>
                <select
                  aria-label="Appareil compatible Live Segments"
                  value={platform}
                  onChange={(e) => setPlatform(e.target.value as DeviceCapability['platform'])}
                  style={{
                    height: 28,
                    borderRadius: 8,
                    border: '0.5px solid rgba(23,43,36,.16)',
                    background: 'rgba(255,255,255,.85)',
                    padding: '0 8px',
                    fontSize: 11.5,
                  }}
                >
                  {DEVICE_PRESETS.map((preset) => (
                    <option key={preset.id} value={preset.id}>
                      {preset.label}
                    </option>
                  ))}
                </select>
              </div>
              <LiveSegmentDeviceSync
                device={deviceCapability}
                segmentIds={segments.slice(0, 10).map((s) => s.id)}
                api={api}
                optedIn={optedIn}
              />
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}

export default ExplorerLiveSegmentsPanel;
