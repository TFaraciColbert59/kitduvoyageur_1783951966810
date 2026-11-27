'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  AlertTriangle,
  ArrowUp,
  Camera,
  Check,
  ChevronDown,
  ChevronUp,
  Copy,
  CornerUpLeft,
  CornerUpRight,
  Droplets,
  Eye,
  Flag,
  Gauge,
  Home,
  MapPin,
  MessageSquareWarning,
  Mountain,
  Pause,
  Phone,
  Play,
  Radio,
  RefreshCw,
  RotateCcw,
  Send,
  ShieldAlert,
  Square,
  Tent,
  TrendingUp,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import { AnimatedNumber } from '@/components/carnet/v2/CarnetDrawerMotion';
import { SortMenuButton, type SortMenuGroup } from '@/components/ui/drawer/SortMenuButton';
import { useWakeLock } from '../hud/useWakeLock';
import type { ExplorerMode, HudContrastMode, SafetyCorridorState } from '../state/hudMachine';
import type { ActivityState } from '../state/types';

export interface ExplorerGpsTurnByTurn {
  instruction: string;
  distanceM: number | null;
  remainingM?: number | null;
  etaMinutes?: number | null;
  kind?: string;
  nextInstruction?: string | null;
}

export interface ExplorerGpsReroute {
  state: string;
  distanceOffRouteM?: number | null;
  bearingLabel?: string | null;
  error?: string | null;
}

export interface ExplorerGpsClimbCard {
  name?: string | null;
  remainingGainM?: number | null;
  avgGradePct?: number | null;
  remainingDistM?: number | null;
}

export type QuickWaypointKind = 'water' | 'bivouac' | 'danger' | 'viewpoint' | 'note';

export interface ExplorerGpsDrawerProps {
  activity: ActivityState;
  mode: ExplorerMode;
  units: 'metric' | 'imperial';
  contrast: HudContrastMode;
  autoPauseEnabled: boolean;
  gpsAccuracyM: number | null;
  isDeadReckoning: boolean;
  locationPermission?: 'prompt' | 'granted' | 'denied';
  onRequestLocation?: () => void;
  safetyCorridor?: SafetyCorridorState | null;
  emergencyNumber?: string;
  onTogglePause: () => void;
  onMarkWaypoint: () => void;
  onStopActivity: () => void;
  onContrastChange: (contrast: HudContrastMode) => void;
  onToggleAutoPause: (enabled: boolean) => void;
  onTriggerSos: () => void;
  onConfirmSos: () => void;
  onCancelSos: () => void;
  /** Optional sport label pill displayed in the HUD header */
  sportLabel?: string;
  /** Current user coordinates as [lng, lat] (GeoJSON / MapLibre convention) */
  currentCoords?: [number, number] | null;
  currentAltitudeM?: number | null;
  currentSpeedKmh?: number | null;
  turnByTurn?: ExplorerGpsTurnByTurn | null;
  reroute?: ExplorerGpsReroute | null;
  onRetryReroute?: () => void;
  hasArrived?: boolean;
  onAcceptArrival?: () => void;
  audioMuted?: boolean;
  onToggleAudio?: () => void;
  climbCard?: ExplorerGpsClimbCard | null;
  beaconActive?: boolean;
  beaconShareUrl?: string | null;
  onToggleBeacon?: () => void;
  onDropWaypoint?: (wp: { kind: QuickWaypointKind; label: string }) => void;
  onCapturePhoto?: (file: File) => void;
  onOpenReport?: () => void;
}

const STOP_HOLD_MS = 800;
const SOS_COUNTDOWN_S = 3;

const QUICK_WAYPOINT_CHIPS: ReadonlyArray<{
  kind: QuickWaypointKind;
  label: string;
  icon: React.ReactNode;
}> = [
  { kind: 'water', label: 'Eau', icon: <Droplets size={12} aria-hidden="true" /> },
  { kind: 'bivouac', label: 'Bivouac', icon: <Tent size={12} aria-hidden="true" /> },
  { kind: 'danger', label: 'Danger', icon: <AlertTriangle size={12} aria-hidden="true" /> },
  { kind: 'viewpoint', label: 'Panorama', icon: <Eye size={12} aria-hidden="true" /> },
  { kind: 'note', label: 'Repère', icon: <MapPin size={12} aria-hidden="true" /> },
];

function formatElapsedClock(totalSeconds: number): string {
  const safe = Math.max(0, Math.floor(Number.isFinite(totalSeconds) ? totalSeconds : 0));
  const h = Math.floor(safe / 3600);
  const m = Math.floor((safe % 3600) / 60);
  const s = safe % 60;
  if (h > 0) {
    return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function formatDistanceShort(meters: number | null | undefined, units: 'metric' | 'imperial'): string | null {
  if (meters === null || meters === undefined || !Number.isFinite(meters)) return null;
  const safe = Math.max(0, meters);
  if (units === 'imperial') {
    const miles = safe / 1609.344;
    if (miles < 0.2) return `${Math.round(safe * 3.28084)} ft`;
    return `${miles.toFixed(1).replace('.', ',')} mi`;
  }
  if (safe < 1000) return `${Math.round(safe)} m`;
  return `${(safe / 1000).toFixed(1).replace('.', ',')} km`;
}

function formatEtaMinutes(minutes: number | null | undefined): string | null {
  if (minutes === null || minutes === undefined || !Number.isFinite(minutes) || minutes < 0) return null;
  const rounded = Math.round(minutes);
  if (rounded < 60) return `${rounded} min`;
  const h = Math.floor(rounded / 60);
  const m = rounded % 60;
  return `${h}h${String(m).padStart(2, '0')}`;
}

function toDms(value: number, posHemisphere: string, negHemisphere: string): string {
  const hemisphere = value >= 0 ? posHemisphere : negHemisphere;
  const abs = Math.abs(value);
  const deg = Math.floor(abs);
  const minFloat = (abs - deg) * 60;
  const min = Math.floor(minFloat);
  const sec = ((minFloat - min) * 60).toFixed(1);
  return `${deg}°${String(min).padStart(2, '0')}'${sec}"${hemisphere}`;
}

function renderManeuverIcon(kind?: string): React.ReactNode {
  const k = (kind ?? '').toLowerCase();
  if (k.includes('left')) return <CornerUpLeft size={18} aria-hidden="true" />;
  if (k.includes('right')) return <CornerUpRight size={18} aria-hidden="true" />;
  if (k.includes('u-turn') || k.includes('uturn')) return <RotateCcw size={18} aria-hidden="true" />;
  if (k.includes('arrive') || k.includes('finish')) return <Flag size={18} aria-hidden="true" />;
  return <ArrowUp size={18} aria-hidden="true" />;
}

export function ExplorerGpsDrawer({
  activity,
  mode,
  units,
  contrast,
  autoPauseEnabled,
  gpsAccuracyM,
  isDeadReckoning,
  locationPermission = 'prompt',
  onRequestLocation,
  safetyCorridor,
  emergencyNumber = '112',
  onTogglePause,
  onMarkWaypoint,
  onStopActivity,
  onContrastChange,
  onToggleAutoPause,
  onTriggerSos,
  onConfirmSos,
  onCancelSos,
  sportLabel,
  currentCoords = null,
  currentAltitudeM = null,
  currentSpeedKmh = null,
  turnByTurn = null,
  reroute = null,
  onRetryReroute,
  hasArrived = false,
  onAcceptArrival,
  audioMuted = false,
  onToggleAudio,
  climbCard = null,
  beaconActive = false,
  beaconShareUrl = null,
  onToggleBeacon,
  onDropWaypoint,
  onCapturePhoto,
  onOpenReport,
}: ExplorerGpsDrawerProps) {
  useWakeLock(true);

  const [expanded, setExpanded] = useState(false);
  const [waypointPopoverOpen, setWaypointPopoverOpen] = useState(false);
  const [holdProgress, setHoldProgress] = useState(0);
  const [stopTapHint, setStopTapHint] = useState(false);
  const [sosModalOpen, setSosModalOpen] = useState(false);
  const [sosCountdown, setSosCountdown] = useState(SOS_COUNTDOWN_S);
  const [beaconCopied, setBeaconCopied] = useState(false);
  const [coordsCopied, setCoordsCopied] = useState(false);

  // Elapsed clock state that freezes cleanly while paused (never resets to 00:00)
  const [clockState, setClockState] = useState(() => ({
    startedAt: activity.startedAt,
    activeNowMs: Date.now(),
    pausedTotalMs: 0,
  }));

  const pauseStartedAtRef = useRef<number | null>(activity.paused ? Date.now() : null);
  const sosConfirmedRef = useRef(false);
  const photoInputRef = useRef<HTMLInputElement | null>(null);
  const holdStartRef = useRef<number | null>(null);
  const holdRafRef = useRef<number | null>(null);
  const stopFiredRef = useRef(false);
  const stopHintTimerRef = useRef<number | null>(null);
  const copyTimerRef = useRef<number | null>(null);

  // Keep global NavigationBar hidden while in GPS_ACTIVE / SOS
  useEffect(() => {
    if (typeof window === 'undefined') return;
    document.documentElement.dataset.explorerSheetOpen = 'true';
    window.dispatchEvent(new CustomEvent('lkdv-toggle-bottom-bar', { detail: { hide: true } }));
    return () => {
      delete document.documentElement.dataset.explorerSheetOpen;
      window.dispatchEvent(new CustomEvent('lkdv-toggle-bottom-bar', { detail: { hide: false } }));
    };
  }, []);

  // Freeze-safe 1 Hz ticker for live active duration (handles pause/resume without resetting to 00:00)
  useEffect(() => {
    if (activity.paused) {
      const pausedMoment = pauseStartedAtRef.current ?? Date.now();
      pauseStartedAtRef.current = pausedMoment;
      const rafId = window.requestAnimationFrame(() => {
        setClockState((prev) =>
          prev.startedAt === activity.startedAt
            ? { ...prev, activeNowMs: Math.max(prev.activeNowMs, pausedMoment) }
            : { startedAt: activity.startedAt, activeNowMs: pausedMoment, pausedTotalMs: 0 },
        );
      });
      return () => window.cancelAnimationFrame(rafId);
    }

    const resumeNow = Date.now();
    const pausedDelta =
      pauseStartedAtRef.current !== null ? Math.max(0, resumeNow - pauseStartedAtRef.current) : 0;
    pauseStartedAtRef.current = null;

    const rafId = window.requestAnimationFrame(() => {
      setClockState((prev) => {
        if (prev.startedAt !== activity.startedAt) {
          return { startedAt: activity.startedAt, activeNowMs: resumeNow, pausedTotalMs: 0 };
        }
        return {
          startedAt: prev.startedAt,
          activeNowMs: resumeNow,
          pausedTotalMs: prev.pausedTotalMs + pausedDelta,
        };
      });
    });

    const intervalId = window.setInterval(() => {
      const now = Date.now();
      setClockState((prev) =>
        prev.startedAt === activity.startedAt
          ? { ...prev, activeNowMs: now }
          : { startedAt: activity.startedAt, activeNowMs: now, pausedTotalMs: 0 },
      );
    }, 1000);

    return () => {
      window.cancelAnimationFrame(rafId);
      window.clearInterval(intervalId);
    };
  }, [activity.paused, activity.startedAt]);

  const cancelStopHold = useCallback((showShortTapHint = false) => {
    const startedAt = holdStartRef.current;
    const fired = stopFiredRef.current;
    holdStartRef.current = null;
    stopFiredRef.current = false;
    if (holdRafRef.current !== null) {
      window.cancelAnimationFrame(holdRafRef.current);
      holdRafRef.current = null;
    }
    setHoldProgress(0);
    if (showShortTapHint && startedAt !== null && !fired && performance.now() - startedAt < STOP_HOLD_MS) {
      setStopTapHint(true);
      if (stopHintTimerRef.current !== null) {
        window.clearTimeout(stopHintTimerRef.current);
      }
      stopHintTimerRef.current = window.setTimeout(() => {
        setStopTapHint(false);
        stopHintTimerRef.current = null;
      }, 2200);
    }
  }, []);

  useEffect(() => {
    return () => {
      if (holdRafRef.current !== null) {
        window.cancelAnimationFrame(holdRafRef.current);
      }
      if (stopHintTimerRef.current !== null) {
        window.clearTimeout(stopHintTimerRef.current);
      }
      if (copyTimerRef.current !== null) {
        window.clearTimeout(copyTimerRef.current);
      }
    };
  }, []);

  const beginStopHold = useCallback(() => {
    if (holdStartRef.current !== null) return;
    holdStartRef.current = performance.now();
    stopFiredRef.current = false;

    const tick = (now: number) => {
      if (holdStartRef.current === null) return;
      const pct = Math.min(1, (now - holdStartRef.current) / STOP_HOLD_MS);
      setHoldProgress(pct);
      if (pct >= 1) {
        holdStartRef.current = null;
        holdRafRef.current = null;
        if (!stopFiredRef.current) {
          stopFiredRef.current = true;
          setHoldProgress(0);
          onStopActivity();
        }
        return;
      }
      holdRafRef.current = window.requestAnimationFrame(tick);
    };

    holdRafRef.current = window.requestAnimationFrame(tick);
  }, [onStopActivity]);

  // Portaled 3-second SOS countdown modal (single-fire guarded)
  const fireConfirmSosOnce = useCallback(() => {
    if (sosConfirmedRef.current) return;
    sosConfirmedRef.current = true;
    setSosModalOpen(false);
    onConfirmSos();
  }, [onConfirmSos]);

  const openSosCountdown = useCallback(() => {
    sosConfirmedRef.current = false;
    setSosCountdown(SOS_COUNTDOWN_S);
    setSosModalOpen(true);
    onTriggerSos();
  }, [onTriggerSos]);

  const handleAbortSos = useCallback(() => {
    sosConfirmedRef.current = false;
    setSosModalOpen(false);
    setSosCountdown(SOS_COUNTDOWN_S);
    onCancelSos();
  }, [onCancelSos]);

  useEffect(() => {
    if (!sosModalOpen) return;
    if (sosCountdown <= 0) {
      const rafId = window.requestAnimationFrame(() => {
        fireConfirmSosOnce();
      });
      return () => window.cancelAnimationFrame(rafId);
    }
    const timer = window.setTimeout(() => {
      setSosCountdown((prev) => prev - 1);
    }, 1000);
    return () => window.clearTimeout(timer);
  }, [sosModalOpen, sosCountdown, fireConfirmSosOnce]);

  useEffect(() => {
    if (!sosModalOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        handleAbortSos();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [sosModalOpen, handleAbortSos]);

  const distanceDisplay = useMemo(() => {
    const meters = Math.max(0, activity.distanceM || 0);
    if (units === 'imperial') {
      const miles = meters / 1609.344;
      return { value: Number(miles.toFixed(2)), suffix: ' mi', decimals: 2 };
    }
    if (meters < 1000) {
      return { value: Math.round(meters), suffix: ' m', decimals: 0 };
    }
    return { value: Number((meters / 1000).toFixed(2)), suffix: ' km', decimals: 2 };
  }, [activity.distanceM, units]);

  const displayedSeconds = useMemo(() => {
    if (activity.movingS > 0) return activity.movingS;
    const activeElapsedMs = Math.max(
      0,
      clockState.activeNowMs - activity.startedAt - clockState.pausedTotalMs,
    );
    return Math.floor(activeElapsedMs / 1000);
  }, [activity.movingS, activity.startedAt, clockState.activeNowMs, clockState.pausedTotalMs]);

  const elevGainM = Math.max(0, Math.round(activity.elevGainM || 0));

  const menuGroups = useMemo<SortMenuGroup[]>(
    () => [
      {
        id: 'contrast',
        label: 'Contraste',
        value: contrast,
        defaultValue: 'standard',
        options: [
          { value: 'standard', label: 'Standard' },
          { value: 'sunlight', label: 'Plein soleil' },
          { value: 'night-red', label: 'Nuit rouge' },
        ],
        onChange: (next) => {
          if (next === 'standard' || next === 'sunlight' || next === 'night-red') {
            onContrastChange(next);
          }
        },
      },
      {
        id: 'safety',
        label: 'Sécurité',
        value: autoPauseEnabled ? 'auto-pause-on' : 'auto-pause-off',
        defaultValue: 'auto-pause-on',
        options: [
          { value: 'sos', label: `Urgence SOS ${emergencyNumber}` },
          {
            value: autoPauseEnabled ? 'auto-pause-off' : 'auto-pause-on',
            label: autoPauseEnabled ? 'Pause auto : ON (couper)' : 'Pause auto : OFF (activer)',
          },
        ],
        onChange: (next) => {
          if (next === 'sos') {
            openSosCountdown();
            return;
          }
          onToggleAutoPause(next === 'auto-pause-on');
        },
      },
    ],
    [contrast, autoPauseEnabled, emergencyNumber, onContrastChange, onToggleAutoPause, openSosCountdown],
  );

  const isPaused = Boolean(activity.paused);
  const isAutoPaused = Boolean(activity.autoPaused && !activity.paused);
  const isNightRed = contrast === 'night-red';
  const isSunlight = contrast === 'sunlight';

  const inkPrimary = isNightRed ? '#FCA5A5' : isSunlight ? '#0B1F17' : '#172B24';
  const inkSecondary = isNightRed ? '#F87171' : isSunlight ? '#172B24' : '#56665D';

  const showRerouteBanner = Boolean(
    reroute && reroute.state && reroute.state !== 'on_route' && reroute.state !== 'idle',
  );
  const showSecondaryTelemetry =
    (currentAltitudeM !== null && Number.isFinite(currentAltitudeM)) ||
    (currentSpeedKmh !== null && Number.isFinite(currentSpeedKmh));

  const sosCoordReadout = useMemo(() => {
    if (!currentCoords || !Number.isFinite(currentCoords[0]) || !Number.isFinite(currentCoords[1])) {
      return null;
    }
    const [lng, lat] = currentCoords;
    return {
      lat,
      lng,
      decimal: `${lat.toFixed(5)}, ${lng.toFixed(5)}`,
      dms: `${toDms(lat, 'N', 'S')}  ${toDms(lng, 'E', 'W')}`,
    };
  }, [currentCoords]);

  const smsHref = useMemo(() => {
    const parts: string[] = [`URGENCE SOS (${emergencyNumber}) — Besoin d'assistance.`];
    if (sosCoordReadout) {
      parts.push(`Position GPS : ${sosCoordReadout.decimal} (${sosCoordReadout.dms}).`);
    }
    if (currentAltitudeM !== null && Number.isFinite(currentAltitudeM)) {
      parts.push(`Altitude : ${Math.round(currentAltitudeM)} m.`);
    }
    if (gpsAccuracyM !== null && Number.isFinite(gpsAccuracyM)) {
      parts.push(`Précision : ±${Math.round(gpsAccuracyM)} m.`);
    }
    if (sosCoordReadout) {
      parts.push(
        `Carte : https://maps.google.com/?q=${sosCoordReadout.lat.toFixed(5)},${sosCoordReadout.lng.toFixed(5)}`,
      );
      parts.push(
        `OSM : https://www.openstreetmap.org/?mlat=${sosCoordReadout.lat.toFixed(5)}&mlon=${sosCoordReadout.lng.toFixed(5)}#map=16/${sosCoordReadout.lat.toFixed(5)}/${sosCoordReadout.lng.toFixed(5)}`,
      );
    }
    return `sms:?body=${encodeURIComponent(parts.join(' '))}`;
  }, [emergencyNumber, sosCoordReadout, currentAltitudeM, gpsAccuracyM]);

  const handleCopyText = useCallback((text: string, target: 'beacon' | 'coords') => {
    if (typeof navigator === 'undefined' || !navigator.clipboard) return;
    void navigator.clipboard.writeText(text).then(() => {
      if (target === 'beacon') setBeaconCopied(true);
      else setCoordsCopied(true);
      if (copyTimerRef.current !== null) window.clearTimeout(copyTimerRef.current);
      copyTimerRef.current = window.setTimeout(() => {
        setBeaconCopied(false);
        setCoordsCopied(false);
        copyTimerRef.current = null;
      }, 2000);
    });
  }, []);

  const handlePhotoChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (file && onCapturePhoto) {
        onCapturePhoto(file);
      }
      event.target.value = '';
    },
    [onCapturePhoto],
  );

  const handleRepereButtonClick = useCallback(() => {
    if (onDropWaypoint) {
      setWaypointPopoverOpen((prev) => !prev);
      return;
    }
    onMarkWaypoint();
  }, [onDropWaypoint, onMarkWaypoint]);

  const toolPillStyle: React.CSSProperties = {
    height: 28,
    padding: '0 8px',
    borderRadius: 999,
    border: isNightRed
      ? '1px solid rgba(248, 113, 113, 0.36)'
      : isSunlight
        ? '1.5px solid #0B1F17'
        : '0.5px solid rgba(23, 64, 44, 0.16)',
    background: isNightRed ? '#220606' : isSunlight ? '#FFFFFF' : 'rgba(255, 255, 255, 0.88)',
    color: inkPrimary,
    fontSize: 11,
    fontWeight: 700,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    cursor: 'pointer',
    flex: 'none',
  };

  const hazardCount = safetyCorridor?.activeHazardsCount ?? 0;

  return (
    <>
      <section
        className="xp20-gps-drawer"
        data-testid="xp20-gps-drawer"
        data-mode={mode}
        data-hud-contrast={contrast !== 'standard' ? contrast : undefined}
        aria-label="Suivi GPS actif"
        style={{
          position: 'fixed',
          left: 10,
          right: 10,
          bottom: 'calc(var(--safe-bottom, 0px) + 10px)',
          maxWidth: 430,
          margin: '0 auto',
          zIndex: 24,
          borderRadius: 26,
          padding: '8px 12px 12px',
          background: isNightRed
            ? '#140404'
            : isSunlight
              ? '#FFFFFF'
              : 'linear-gradient(180deg, rgba(255, 255, 255, 0.96) 0%, rgba(251, 250, 246, 0.94) 100%)',
          backdropFilter: isNightRed || isSunlight ? 'none' : 'blur(32px) saturate(1.15)',
          WebkitBackdropFilter: isNightRed || isSunlight ? 'none' : 'blur(32px) saturate(1.15)',
          border: isNightRed
            ? '1px solid rgba(220, 38, 38, 0.5)'
            : isSunlight
              ? '1.5px solid #0B1F17'
              : '0.5px solid rgba(23, 64, 44, 0.14)',
          boxShadow: isNightRed
            ? '0 14px 36px rgba(0, 0, 0, 0.72)'
            : isSunlight
              ? '0 12px 32px rgba(0, 0, 0, 0.25)'
              : 'inset 0 1px 0 rgba(255, 255, 255, 0.98), 0 18px 44px rgba(16, 32, 25, 0.22)',
          color: inkPrimary,
          boxSizing: 'border-box',
        }}
      >
        {/* Top HUD Header: Visible Safety Corridor handle + Sport pill + Field Tools + Direct SOS */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 6,
            marginBottom: 8,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, minWidth: 0 }}>
            {/* High-contrast Safety Corridor toggle handle */}
            <button
              type="button"
              className="xp20-gps-grab"
              onClick={() => setExpanded((v) => !v)}
              aria-expanded={expanded}
              aria-label={expanded ? 'Masquer le corridor de sécurité' : 'Afficher le corridor de sécurité'}
              style={{
                position: 'relative',
                left: 'auto',
                top: 'auto',
                margin: 0,
                height: 28,
                padding: '0 10px',
                borderRadius: 999,
                border: isNightRed
                  ? '1px solid rgba(248, 113, 113, 0.5)'
                  : isSunlight
                    ? '1.5px solid #0B1F17'
                    : '0.5px solid rgba(23, 64, 44, 0.22)',
                background: isNightRed
                  ? '#2B0808'
                  : isSunlight
                    ? '#0B1F17'
                    : expanded
                      ? '#17402C'
                      : 'rgba(23, 64, 44, 0.09)',
                color: isNightRed
                  ? '#FECACA'
                  : isSunlight || expanded
                    ? '#FBFAF6'
                    : '#17402C',
                fontSize: 11,
                fontWeight: 800,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
                cursor: 'pointer',
                flex: 'none',
              }}
            >
              {expanded ? (
                <ChevronDown size={13} aria-hidden="true" />
              ) : (
                <ChevronUp size={13} aria-hidden="true" />
              )}
              <span>Corridor</span>
              {hazardCount > 0 ? (
                <span
                  aria-label={`${hazardCount} risque${hazardCount > 1 ? 's' : ''}`}
                  style={{
                    minWidth: 15,
                    height: 15,
                    padding: '0 4px',
                    borderRadius: 999,
                    background: '#DC2626',
                    color: '#FFFFFF',
                    fontSize: 9.5,
                    fontWeight: 800,
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  {hazardCount}
                </span>
              ) : null}
            </button>

            {sportLabel ? (
              <span
                style={{
                  height: 26,
                  padding: '0 9px',
                  borderRadius: 999,
                  background: isNightRed
                    ? 'rgba(127, 29, 29, 0.35)'
                    : isSunlight
                      ? '#F1F5F2'
                      : 'rgba(150, 186, 142, 0.24)',
                  color: isNightRed ? '#FECACA' : '#17402C',
                  fontSize: 11,
                  fontWeight: 800,
                  display: 'inline-flex',
                  alignItems: 'center',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  maxWidth: 110,
                }}
              >
                {sportLabel}
              </span>
            ) : null}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 5, flex: 'none' }}>
            {onToggleAudio ? (
              <button
                type="button"
                onClick={onToggleAudio}
                aria-label={audioMuted ? 'Activer le guidage vocal' : 'Couper le guidage vocal'}
                aria-pressed={!audioMuted}
                style={toolPillStyle}
              >
                {audioMuted ? (
                  <VolumeX size={13} aria-hidden="true" />
                ) : (
                  <Volume2 size={13} aria-hidden="true" />
                )}
              </button>
            ) : null}

            {onToggleBeacon ? (
              <button
                type="button"
                onClick={onToggleBeacon}
                aria-label={beaconActive ? 'Désactiver la balise Live' : 'Activer la balise Live'}
                aria-pressed={beaconActive}
                style={{
                  ...toolPillStyle,
                  background: beaconActive
                    ? isNightRed
                      ? '#7F1D1D'
                      : 'rgba(46, 125, 79, 0.16)'
                    : toolPillStyle.background,
                  color: beaconActive ? (isNightRed ? '#FECACA' : '#17402C') : inkPrimary,
                  borderColor: beaconActive ? 'rgba(46, 125, 79, 0.45)' : undefined,
                }}
              >
                <Radio size={13} aria-hidden="true" />
                {beaconActive ? (
                  <span
                    aria-hidden="true"
                    style={{
                      width: 6,
                      height: 6,
                      borderRadius: 999,
                      background: '#2E7D4F',
                    }}
                  />
                ) : null}
              </button>
            ) : null}

            {onCapturePhoto ? (
              <>
                <input
                  ref={photoInputRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={handlePhotoChange}
                  style={{ display: 'none' }}
                  aria-hidden="true"
                  tabIndex={-1}
                />
                <button
                  type="button"
                  onClick={() => photoInputRef.current?.click()}
                  aria-label="Prendre une photo géolocalisée"
                  style={toolPillStyle}
                >
                  <Camera size={13} aria-hidden="true" />
                </button>
              </>
            ) : null}

            {onOpenReport ? (
              <button
                type="button"
                onClick={onOpenReport}
                aria-label="Signaler un danger terrain"
                style={toolPillStyle}
              >
                <MessageSquareWarning size={13} aria-hidden="true" />
              </button>
            ) : null}

            {/* Direct tactile SOS 112 pill */}
            <button
              type="button"
              onClick={openSosCountdown}
              aria-label={`Urgence SOS ${emergencyNumber}`}
              style={{
                height: 28,
                padding: '0 9px',
                borderRadius: 999,
                border: isNightRed
                  ? '1px solid rgba(248, 113, 113, 0.65)'
                  : '1px solid rgba(185, 28, 28, 0.35)',
                background: isNightRed ? '#7F1D1D' : 'rgba(185, 28, 28, 0.12)',
                color: isNightRed ? '#FECACA' : '#991B1B',
                fontSize: 11,
                fontWeight: 900,
                letterSpacing: '0.02em',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
                cursor: 'pointer',
                flex: 'none',
              }}
            >
              <ShieldAlert size={12} aria-hidden="true" />
              <span>SOS</span>
            </button>
          </div>
        </div>

        {/* Live Beacon share URL pill when active */}
        {beaconActive && beaconShareUrl ? (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 8,
              padding: '5px 9px',
              marginBottom: 8,
              borderRadius: 12,
              background: isNightRed ? 'rgba(127, 29, 29, 0.28)' : 'rgba(46, 125, 79, 0.1)',
              border: '0.5px solid rgba(46, 125, 79, 0.28)',
              fontSize: 11,
              fontWeight: 700,
              color: isNightRed ? '#FECACA' : '#17402C',
            }}
          >
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
                minWidth: 0,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              <Radio size={12} aria-hidden="true" style={{ flex: 'none' }} />
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
                Balise Live active · {beaconShareUrl}
              </span>
            </span>
            <button
              type="button"
              onClick={() => handleCopyText(beaconShareUrl, 'beacon')}
              style={{
                height: 22,
                padding: '0 8px',
                borderRadius: 999,
                border: 0,
                background: isNightRed ? '#7F1D1D' : '#17402C',
                color: '#FBFAF6',
                fontSize: 10.5,
                fontWeight: 700,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
                cursor: 'pointer',
                flex: 'none',
              }}
            >
              {beaconCopied ? <Check size={11} aria-hidden="true" /> : <Copy size={11} aria-hidden="true" />}
              <span>{beaconCopied ? 'Copié' : 'Copier'}</span>
            </button>
          </div>
        ) : null}

        {/* Emerald Arrival Celebration Banner */}
        {hasArrived ? (
          <div
            role="status"
            aria-live="polite"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 8,
              padding: '8px 10px',
              marginBottom: 8,
              borderRadius: 16,
              background: isNightRed
                ? 'rgba(127, 29, 29, 0.32)'
                : 'linear-gradient(135deg, rgba(46, 125, 79, 0.16), rgba(150, 186, 142, 0.28))',
              border: '1px solid rgba(46, 125, 79, 0.35)',
              color: isNightRed ? '#FECACA' : '#14532D',
            }}
          >
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12.5, fontWeight: 800 }}>
              <Flag size={15} aria-hidden="true" />
              Arrivée atteinte !
            </span>
            {onAcceptArrival ? (
              <button
                type="button"
                onClick={onAcceptArrival}
                style={{
                  height: 28,
                  padding: '0 11px',
                  borderRadius: 999,
                  border: 0,
                  background: '#17402C',
                  color: '#FBFAF6',
                  fontSize: 11.5,
                  fontWeight: 700,
                  cursor: 'pointer',
                  flex: 'none',
                }}
              >
                Terminer &amp; enregistrer
              </button>
            ) : null}
          </div>
        ) : null}

        {/* Amber Off-Route / Reroute Banner */}
        {showRerouteBanner && reroute ? (
          <div
            role="alert"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 8,
              padding: '7px 10px',
              marginBottom: 8,
              borderRadius: 16,
              background: isNightRed ? 'rgba(127, 29, 29, 0.32)' : 'rgba(217, 119, 6, 0.14)',
              border: isNightRed
                ? '1px solid rgba(248, 113, 113, 0.45)'
                : '1px solid rgba(217, 119, 6, 0.38)',
              color: isNightRed ? '#FECACA' : '#92400E',
            }}
          >
            <div style={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: 1 }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12, fontWeight: 800 }}>
                <AlertTriangle size={14} aria-hidden="true" style={{ flex: 'none' }} />
                {reroute.state === 'recalculating_online'
                  ? 'Recalcul d’itinéraire…'
                  : reroute.state === 'recalculated'
                    ? 'Détour de retour actif'
                    : 'Hors-trace'}
                {reroute.distanceOffRouteM !== null && reroute.distanceOffRouteM !== undefined
                  ? ` · ${formatDistanceShort(reroute.distanceOffRouteM, units)}`
                  : ''}
              </span>
              {reroute.bearingLabel || reroute.error ? (
                <span style={{ fontSize: 11, fontWeight: 600, opacity: 0.92 }}>
                  {[reroute.bearingLabel, reroute.error].filter(Boolean).join(' · ')}
                </span>
              ) : null}
            </div>
            {onRetryReroute ? (
              <button
                type="button"
                onClick={onRetryReroute}
                disabled={reroute.state === 'recalculating_online'}
                style={{
                  height: 28,
                  padding: '0 10px',
                  borderRadius: 999,
                  border: 0,
                  background: isNightRed ? '#7F1D1D' : '#92400E',
                  color: '#FFFFFF',
                  fontSize: 11,
                  fontWeight: 700,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4,
                  cursor: reroute.state === 'recalculating_online' ? 'default' : 'pointer',
                  opacity: reroute.state === 'recalculating_online' ? 0.7 : 1,
                  flex: 'none',
                }}
              >
                <RefreshCw size={11} aria-hidden="true" />
                Recalculer
              </button>
            ) : null}
          </div>
        ) : null}

        {/* Crisp Liquid Glass Turn-by-Turn Banner */}
        {turnByTurn && turnByTurn.instruction ? (
          <div
            data-testid="xp20-tbt-banner"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 9,
              padding: '8px 10px',
              marginBottom: 8,
              borderRadius: 18,
              background: isNightRed
                ? 'rgba(127, 29, 29, 0.24)'
                : isSunlight
                  ? '#F4F6F4'
                  : 'linear-gradient(180deg, rgba(23, 64, 44, 0.09), rgba(23, 64, 44, 0.05))',
              border: isNightRed
                ? '1px solid rgba(248, 113, 113, 0.35)'
                : isSunlight
                  ? '1px solid #0B1F17'
                  : '0.5px solid rgba(23, 64, 44, 0.14)',
            }}
          >
            <div
              aria-hidden="true"
              style={{
                width: 36,
                height: 36,
                borderRadius: 12,
                background: isNightRed ? '#7F1D1D' : '#17402C',
                color: isNightRed ? '#FECACA' : '#FBFAF6',
                display: 'grid',
                placeItems: 'center',
                flex: 'none',
              }}
            >
              {renderManeuverIcon(turnByTurn.kind)}
            </div>

            <div style={{ minWidth: 0, flex: '1 1 auto' }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, minWidth: 0 }}>
                {turnByTurn.distanceM !== null ? (
                  <span
                    style={{
                      fontSize: 13.5,
                      fontWeight: 900,
                      color: inkPrimary,
                      fontVariantNumeric: 'tabular-nums',
                      flex: 'none',
                    }}
                  >
                    {formatDistanceShort(turnByTurn.distanceM, units)}
                  </span>
                ) : null}
                <strong
                  style={{
                    fontSize: 12.5,
                    fontWeight: 800,
                    color: inkPrimary,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {turnByTurn.instruction}
                </strong>
              </div>
              {turnByTurn.nextInstruction ? (
                <div
                  style={{
                    marginTop: 1,
                    fontSize: 10.5,
                    fontWeight: 600,
                    color: inkSecondary,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  Puis : {turnByTurn.nextInstruction}
                </div>
              ) : null}
            </div>

            {turnByTurn.remainingM !== undefined || turnByTurn.etaMinutes !== undefined ? (
              <div
                style={{
                  flex: 'none',
                  textAlign: 'right',
                  fontVariantNumeric: 'tabular-nums',
                  lineHeight: 1.2,
                }}
              >
                {formatDistanceShort(turnByTurn.remainingM, units) ? (
                  <div style={{ fontSize: 11.5, fontWeight: 800, color: inkPrimary }}>
                    {formatDistanceShort(turnByTurn.remainingM, units)}
                  </div>
                ) : null}
                {formatEtaMinutes(turnByTurn.etaMinutes) ? (
                  <div style={{ fontSize: 10, fontWeight: 700, color: inkSecondary }}>
                    ETA {formatEtaMinutes(turnByTurn.etaMinutes)}
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
        ) : null}

        {/* Compact Climb Progress Chip */}
        {climbCard &&
        (climbCard.name ||
          climbCard.remainingGainM !== null ||
          climbCard.avgGradePct !== null) ? (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 8,
              padding: '5px 10px',
              marginBottom: 8,
              borderRadius: 12,
              background: isNightRed ? 'rgba(127, 29, 29, 0.22)' : 'rgba(150, 186, 142, 0.2)',
              color: inkPrimary,
              fontSize: 11,
              fontWeight: 700,
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
                minWidth: 0,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              <TrendingUp size={12} aria-hidden="true" style={{ flex: 'none' }} />
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {climbCard.name || 'Montée en cours'}
              </span>
            </span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, flex: 'none' }}>
              {climbCard.remainingGainM !== null && climbCard.remainingGainM !== undefined ? (
                <span>+{Math.round(climbCard.remainingGainM)} m</span>
              ) : null}
              {climbCard.avgGradePct !== null && climbCard.avgGradePct !== undefined ? (
                <span>{climbCard.avgGradePct.toFixed(1).replace('.', ',')} %</span>
              ) : null}
              {formatDistanceShort(climbCard.remainingDistM, units) ? (
                <span style={{ color: inkSecondary }}>
                  {formatDistanceShort(climbCard.remainingDistM, units)}
                </span>
              ) : null}
            </span>
          </div>
        ) : null}

        {/* Active SOS status banner if SOS armed */}
        {mode === 'SOS' ? (
          <div
            role="alert"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 8,
              padding: '7px 10px',
              marginBottom: 8,
              borderRadius: 14,
              background: 'rgba(185, 28, 28, 0.14)',
              border: '1px solid rgba(220, 38, 38, 0.36)',
              color: isNightRed ? '#FECACA' : '#991B1B',
              fontSize: 12,
              fontWeight: 700,
            }}
          >
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <ShieldAlert size={15} aria-hidden="true" />
              SOS actif ({emergencyNumber})
            </span>
            <button
              type="button"
              onClick={handleAbortSos}
              style={{
                height: 26,
                padding: '0 10px',
                borderRadius: 999,
                border: 0,
                background: '#991B1B',
                color: '#FFFFFF',
                fontSize: 11,
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              Annuler
            </button>
          </div>
        ) : null}

        {/* GPS permission / signal status banner (when denied or waiting for first fix) */}
        {locationPermission === 'denied' || (gpsAccuracyM === null && !isDeadReckoning) ? (
          <div
            role="status"
            aria-live="polite"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 8,
              padding: '6px 10px',
              marginBottom: 8,
              borderRadius: 12,
              background:
                locationPermission === 'denied'
                  ? 'rgba(180, 83, 9, 0.12)'
                  : isNightRed
                    ? 'rgba(127, 29, 29, 0.24)'
                    : 'rgba(23, 64, 44, 0.07)',
              color:
                locationPermission === 'denied'
                  ? isNightRed
                    ? '#FECACA'
                    : '#92400E'
                  : inkSecondary,
              fontSize: 11.5,
              fontWeight: 700,
            }}
          >
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
              <Radio size={13} aria-hidden="true" style={{ flex: 'none' }} />
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {locationPermission === 'denied'
                  ? 'Position refusée · activez le GPS'
                  : 'Signal GPS en attente…'}
              </span>
            </span>
            {onRequestLocation ? (
              <button
                type="button"
                onClick={onRequestLocation}
                style={{
                  height: 24,
                  padding: '0 9px',
                  borderRadius: 999,
                  border: 0,
                  background: isNightRed ? '#7F1D1D' : '#17402C',
                  color: '#FBFAF6',
                  fontSize: 10.5,
                  fontWeight: 700,
                  cursor: 'pointer',
                  flex: 'none',
                }}
              >
                {locationPermission === 'denied' ? 'Réessayer' : 'Activer'}
              </button>
            ) : null}
          </div>
        ) : null}

        {/* Short-tap helper hint for Stop 0,8 s */}
        {stopTapHint ? (
          <div
            role="status"
            aria-live="polite"
            style={{
              marginBottom: 8,
              padding: '5px 10px',
              borderRadius: 12,
              background: 'rgba(185, 28, 28, 0.1)',
              color: isNightRed ? '#FECACA' : '#991B1B',
              fontSize: 11.5,
              fontWeight: 700,
              textAlign: 'center',
            }}
          >
            Maintenez « Stop 0,8 s » pour terminer la sortie
          </div>
        ) : null}

        {/* Top row: 3 large AnimatedNumber tabular KPIs */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
            gap: 6,
            padding: '2px 2px 8px',
            textAlign: 'center',
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          <div style={{ minWidth: 0 }}>
            <div
              style={{
                fontSize: 21,
                fontWeight: 800,
                lineHeight: 1.1,
                letterSpacing: '-0.02em',
                color: inkPrimary,
              }}
            >
              <AnimatedNumber
                value={distanceDisplay.value}
                suffix={distanceDisplay.suffix}
                maximumFractionDigits={distanceDisplay.decimals}
              />
            </div>
            <div style={{ marginTop: 2, fontSize: 10, fontWeight: 700, color: inkSecondary }}>
              Distance
            </div>
          </div>

          <div style={{ minWidth: 0 }}>
            <div
              style={{
                fontSize: 21,
                fontWeight: 800,
                lineHeight: 1.1,
                letterSpacing: '-0.02em',
                color: inkPrimary,
              }}
            >
              {formatElapsedClock(displayedSeconds)}
            </div>
            {isPaused ? (
              <span
                style={{
                  display: 'inline-block',
                  marginTop: 2,
                  padding: '1px 6px',
                  borderRadius: 999,
                  background: isNightRed ? 'rgba(248, 113, 113, 0.22)' : 'rgba(180, 83, 9, 0.14)',
                  color: isNightRed ? '#FECACA' : '#92400E',
                  fontSize: 9.5,
                  fontWeight: 800,
                }}
              >
                En pause
              </span>
            ) : isAutoPaused ? (
              <span
                style={{
                  display: 'inline-block',
                  marginTop: 2,
                  padding: '1px 6px',
                  borderRadius: 999,
                  background: isNightRed ? 'rgba(248, 113, 113, 0.2)' : 'rgba(23, 64, 44, 0.1)',
                  color: inkSecondary,
                  fontSize: 9.5,
                  fontWeight: 700,
                }}
              >
                Pause auto
              </span>
            ) : (
              <div style={{ marginTop: 2, fontSize: 10, fontWeight: 700, color: inkSecondary }}>
                Durée
              </div>
            )}
          </div>

          <div style={{ minWidth: 0 }}>
            <div
              style={{
                fontSize: 21,
                fontWeight: 800,
                lineHeight: 1.1,
                letterSpacing: '-0.02em',
                color: inkPrimary,
              }}
            >
              <AnimatedNumber value={elevGainM} prefix="+" suffix=" m" />
            </div>
            <div style={{ marginTop: 2, fontSize: 10, fontWeight: 700, color: inkSecondary }}>
              Dénivelé +
            </div>
          </div>
        </div>

        {/* Optional 2nd telemetry row: Altitude + Speed */}
        {showSecondaryTelemetry ? (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 12,
              padding: '4px 10px 8px',
              fontSize: 11.5,
              fontWeight: 700,
              color: inkSecondary,
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {currentAltitudeM !== null && Number.isFinite(currentAltitudeM) ? (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                <Mountain size={12} aria-hidden="true" />
                {units === 'imperial'
                  ? `${Math.round(currentAltitudeM * 3.28084)} ft`
                  : `${Math.round(currentAltitudeM)} m`}
              </span>
            ) : null}
            {currentSpeedKmh !== null && Number.isFinite(currentSpeedKmh) ? (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                <Gauge size={12} aria-hidden="true" />
                {units === 'imperial'
                  ? `${(currentSpeedKmh * 0.621371).toFixed(1).replace('.', ',')} mph`
                  : `${currentSpeedKmh.toFixed(1).replace('.', ',')} km/h`}
              </span>
            ) : null}
          </div>
        ) : null}

        {/* Expandable 3 km safety corridor + GPS accuracy mini-panel */}
        {expanded ? (
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 6,
              padding: '8px 10px',
              marginBottom: 10,
              borderRadius: 16,
              background: isNightRed
                ? 'rgba(127, 29, 29, 0.22)'
                : isSunlight
                  ? '#F4F6F4'
                  : 'rgba(23, 64, 44, 0.06)',
              fontSize: 11.5,
              fontWeight: 700,
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                <Droplets size={12} aria-hidden="true" />
                Eau {safetyCorridor?.waterCount ?? 0}
              </span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                <Home size={12} aria-hidden="true" />
                Abris {safetyCorridor?.shelterCount ?? 0}
              </span>
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4,
                  color:
                    hazardCount > 0
                      ? isNightRed
                        ? '#FCA5A5'
                        : '#B91C1C'
                      : inkPrimary,
                }}
              >
                <AlertTriangle size={12} aria-hidden="true" />
                Risques {hazardCount}
              </span>
            </div>

            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
                color: isDeadReckoning ? '#B98A2E' : inkSecondary,
              }}
            >
              <Radio size={11} aria-hidden="true" />
              {isDeadReckoning
                ? 'Estimé'
                : gpsAccuracyM !== null
                  ? `±${Math.round(gpsAccuracyM)} m`
                  : 'GPS'}
            </span>
          </div>
        ) : null}

        {/* Quick 1-row Waypoint chip popover */}
        {waypointPopoverOpen && onDropWaypoint ? (
          <div
            role="menu"
            aria-label="Choisir un type de repère"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 5,
              overflowX: 'auto',
              padding: '6px 6px',
              marginBottom: 8,
              borderRadius: 16,
              background: isNightRed
                ? 'rgba(127, 29, 29, 0.28)'
                : isSunlight
                  ? '#F4F6F4'
                  : 'rgba(23, 64, 44, 0.07)',
              border: isNightRed
                ? '1px solid rgba(248, 113, 113, 0.35)'
                : '0.5px solid rgba(23, 64, 44, 0.14)',
              scrollbarWidth: 'none',
            }}
          >
            {QUICK_WAYPOINT_CHIPS.map((chip) => (
              <button
                key={chip.kind}
                type="button"
                role="menuitem"
                onClick={() => {
                  onDropWaypoint({ kind: chip.kind, label: chip.label });
                  setWaypointPopoverOpen(false);
                }}
                style={{
                  flex: '1 0 auto',
                  height: 30,
                  padding: '0 9px',
                  borderRadius: 999,
                  border: isNightRed
                    ? '1px solid rgba(248, 113, 113, 0.4)'
                    : '0.5px solid rgba(23, 64, 44, 0.16)',
                  background: isNightRed ? '#220606' : '#FFFFFF',
                  color: chip.kind === 'danger' ? (isNightRed ? '#FECACA' : '#991B1B') : inkPrimary,
                  fontSize: 11.5,
                  fontWeight: 700,
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 4,
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                }}
              >
                {chip.icon}
                <span>{chip.label}</span>
              </button>
            ))}
          </div>
        ) : null}

        {/* Bottom action row: 3 tactile >= 52px pills + SortMenuButton */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          {/* Pause / Reprendre */}
          <button
            type="button"
            onClick={onTogglePause}
            aria-label={isPaused ? 'Reprendre' : 'Mettre en pause'}
            style={{
              flex: '1 1 0',
              minHeight: 52,
              borderRadius: 999,
              border: isNightRed
                ? '1px solid rgba(248, 113, 113, 0.45)'
                : isSunlight
                  ? '1.5px solid #0B1F17'
                  : '0.5px solid rgba(255, 255, 255, 0.24)',
              background: isNightRed
                ? '#7F1D1D'
                : isSunlight
                  ? '#0B1F17'
                  : 'linear-gradient(180deg, #1f543a, #17402c)',
              color: isNightRed ? '#FECACA' : '#FBFAF6',
              fontSize: 13,
              fontWeight: 700,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
              cursor: 'pointer',
              padding: '0 10px',
            }}
          >
            {isPaused ? (
              <Play size={16} fill="currentColor" aria-hidden="true" />
            ) : (
              <Pause size={16} aria-hidden="true" />
            )}
            <span>{isPaused ? 'Reprendre' : 'Pause'}</span>
          </button>

          {/* Repère */}
          <button
            type="button"
            onClick={handleRepereButtonClick}
            aria-label="Poser un repère"
            aria-expanded={onDropWaypoint ? waypointPopoverOpen : undefined}
            style={{
              flex: '0.85 1 0',
              minHeight: 52,
              borderRadius: 999,
              border: isNightRed
                ? '1px solid rgba(248, 113, 113, 0.36)'
                : isSunlight
                  ? '1.5px solid #0B1F17'
                  : waypointPopoverOpen
                    ? '1px solid #17402C'
                    : '0.5px solid rgba(23, 64, 44, 0.16)',
              background: isNightRed
                ? '#1F0606'
                : isSunlight
                  ? '#FFFFFF'
                  : waypointPopoverOpen
                    ? 'rgba(23, 64, 44, 0.12)'
                    : 'rgba(255, 255, 255, 0.88)',
              color: inkPrimary,
              fontSize: 13,
              fontWeight: 700,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 5,
              cursor: 'pointer',
              padding: '0 10px',
            }}
          >
            <MapPin size={15} aria-hidden="true" />
            <span>Repère</span>
          </button>

          {/* Stop (0,8 s hold) */}
          <button
            type="button"
            aria-label="Maintenir 0,8 seconde pour arrêter"
            onPointerDown={(e) => {
              if (e.button !== 0 && e.pointerType === 'mouse') return;
              beginStopHold();
            }}
            onPointerUp={() => cancelStopHold(true)}
            onPointerCancel={() => cancelStopHold(false)}
            onPointerLeave={() => cancelStopHold(false)}
            onKeyDown={(e) => {
              if ((e.key === ' ' || e.key === 'Enter') && !e.repeat) {
                e.preventDefault();
                beginStopHold();
              }
            }}
            onKeyUp={(e) => {
              if (e.key === ' ' || e.key === 'Enter') {
                e.preventDefault();
                cancelStopHold(true);
              }
            }}
            style={{
              position: 'relative',
              overflow: 'hidden',
              flex: '1 1 0',
              minHeight: 52,
              borderRadius: 999,
              border: isNightRed
                ? '1px solid rgba(248, 113, 113, 0.5)'
                : isSunlight
                  ? '1.5px solid #991B1B'
                  : '0.5px solid rgba(185, 28, 28, 0.24)',
              background: isNightRed ? '#2B0808' : 'rgba(185, 28, 28, 0.10)',
              color: isNightRed ? '#FECACA' : '#991B1B',
              fontSize: 12.5,
              fontWeight: 800,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 5,
              cursor: 'pointer',
              padding: '0 10px',
              userSelect: 'none',
              touchAction: 'none',
            }}
          >
            {/* Visual hold fill bar */}
            <span
              aria-hidden="true"
              style={{
                position: 'absolute',
                inset: 0,
                width: `${Math.round(holdProgress * 100)}%`,
                background: 'rgba(185, 28, 28, 0.28)',
                transition: holdProgress === 0 ? 'width 120ms ease' : 'none',
                pointerEvents: 'none',
              }}
            />
            <Square size={13} fill="currentColor" aria-hidden="true" style={{ position: 'relative' }} />
            <span style={{ position: 'relative', whiteSpace: 'nowrap' }}>Stop 0,8 s</span>
          </button>

          {/* Bottom-right SortMenuButton: Contrast + Safety */}
          <SortMenuButton
            value={contrast}
            defaultValue="standard"
            options={[]}
            onChange={() => {}}
            groups={menuGroups}
            label="Contraste et sécurité"
          />
        </div>
      </section>

      {/* Portaled 3-second SOS countdown modal with Coordinates Readout & SMS share */}
      {sosModalOpen && typeof document !== 'undefined'
        ? createPortal(
            <div
              role="alertdialog"
              aria-modal="true"
              aria-label="Déclenchement Urgence SOS"
              style={{
                position: 'fixed',
                inset: 0,
                zIndex: 9999,
                background: 'rgba(11, 20, 16, 0.68)',
                backdropFilter: 'blur(12px)',
                WebkitBackdropFilter: 'blur(12px)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: 16,
              }}
            >
              <div
                style={{
                  width: '100%',
                  maxWidth: 360,
                  borderRadius: 28,
                  padding: 20,
                  background: 'rgba(251, 250, 246, 0.98)',
                  border: '1px solid rgba(185, 28, 28, 0.3)',
                  boxShadow: '0 24px 60px rgba(11, 31, 23, 0.38)',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  textAlign: 'center',
                  gap: 13,
                  color: '#172B24',
                }}
              >
                <div
                  style={{
                    width: 60,
                    height: 60,
                    borderRadius: '50%',
                    background: 'rgba(185, 28, 28, 0.14)',
                    color: '#991B1B',
                    display: 'grid',
                    placeItems: 'center',
                    fontSize: 26,
                    fontWeight: 900,
                    fontVariantNumeric: 'tabular-nums',
                  }}
                >
                  {sosCountdown}
                </div>

                <div>
                  <strong style={{ display: 'block', fontSize: 17, fontWeight: 900, color: '#991B1B' }}>
                    Urgence SOS {emergencyNumber}
                  </strong>
                  <span style={{ display: 'block', marginTop: 3, fontSize: 12.5, color: '#56665D' }}>
                    Déclenchement automatique dans {sosCountdown} s
                  </span>
                </div>

                {/* High-contrast GPS coordinates readout card for 112 / PGHM voice relay */}
                <div
                  style={{
                    width: '100%',
                    borderRadius: 18,
                    padding: '10px 12px',
                    background: 'rgba(23, 43, 36, 0.06)',
                    border: '0.5px solid rgba(23, 64, 44, 0.14)',
                    textAlign: 'left',
                    fontVariantNumeric: 'tabular-nums',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 5,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
                    <span style={{ fontSize: 10.5, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.04em', color: '#56665D' }}>
                      Position à dicter (112 / PGHM)
                    </span>
                    {sosCoordReadout ? (
                      <button
                        type="button"
                        onClick={() => handleCopyText(`${sosCoordReadout.decimal} (${sosCoordReadout.dms})`, 'coords')}
                        style={{
                          height: 22,
                          padding: '0 7px',
                          borderRadius: 999,
                          border: '0.5px solid rgba(23, 64, 44, 0.18)',
                          background: '#FFFFFF',
                          color: '#172B24',
                          fontSize: 10.5,
                          fontWeight: 700,
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 3,
                          cursor: 'pointer',
                        }}
                      >
                        {coordsCopied ? <Check size={10} aria-hidden="true" /> : <Copy size={10} aria-hidden="true" />}
                        {coordsCopied ? 'Copié' : 'Copier'}
                      </button>
                    ) : null}
                  </div>

                  {sosCoordReadout ? (
                    <>
                      <div style={{ fontSize: 15.5, fontWeight: 900, color: '#172B24', letterSpacing: '-0.01em' }}>
                        {sosCoordReadout.decimal}
                      </div>
                      <div style={{ fontSize: 12.5, fontWeight: 700, color: '#394D43' }}>
                        {sosCoordReadout.dms}
                      </div>
                    </>
                  ) : (
                    <div style={{ fontSize: 12.5, fontWeight: 700, color: '#92400E' }}>
                      Position GPS en cours d’acquisition…
                    </div>
                  )}

                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 8,
                      paddingTop: 4,
                      borderTop: '0.5px solid rgba(23, 64, 44, 0.1)',
                      fontSize: 12,
                      fontWeight: 700,
                      color: '#172B24',
                    }}
                  >
                    <span>
                      Alt.{' '}
                      {currentAltitudeM !== null && Number.isFinite(currentAltitudeM)
                        ? `${Math.round(currentAltitudeM)} m`
                        : '—'}
                    </span>
                    <span>
                      Précision{' '}
                      {gpsAccuracyM !== null && Number.isFinite(gpsAccuracyM)
                        ? `±${Math.round(gpsAccuracyM)} m`
                        : isDeadReckoning
                          ? 'Estimé'
                          : '—'}
                    </span>
                  </div>
                </div>

                {/* SMS share button */}
                <a
                  href={smsHref}
                  style={{
                    width: '100%',
                    height: 44,
                    borderRadius: 999,
                    border: '1px solid rgba(23, 64, 44, 0.22)',
                    background: '#FFFFFF',
                    color: '#17402C',
                    fontSize: 13.5,
                    fontWeight: 800,
                    textDecoration: 'none',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 7,
                  }}
                >
                  <Send size={14} aria-hidden="true" />
                  <span>Partager ma position (SMS)</span>
                </a>

                {/* Cancel + Single-trigger Call button (no double tel: firing) */}
                <div style={{ display: 'flex', width: '100%', gap: 8 }}>
                  <button
                    type="button"
                    onClick={handleAbortSos}
                    style={{
                      flex: 1,
                      height: 46,
                      borderRadius: 999,
                      border: '0.5px solid rgba(23, 64, 44, 0.2)',
                      background: '#FFFFFF',
                      color: '#172B24',
                      fontSize: 14,
                      fontWeight: 700,
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 6,
                      cursor: 'pointer',
                    }}
                  >
                    <X size={15} aria-hidden="true" />
                    Annuler
                  </button>

                  <button
                    type="button"
                    onClick={fireConfirmSosOnce}
                    style={{
                      flex: 1,
                      height: 46,
                      borderRadius: 999,
                      border: 0,
                      background: '#991B1B',
                      color: '#FFFFFF',
                      fontSize: 14,
                      fontWeight: 800,
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 6,
                      cursor: 'pointer',
                    }}
                  >
                    <Phone size={15} aria-hidden="true" />
                    Appeler {emergencyNumber}
                  </button>
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}

export default ExplorerGpsDrawer;
