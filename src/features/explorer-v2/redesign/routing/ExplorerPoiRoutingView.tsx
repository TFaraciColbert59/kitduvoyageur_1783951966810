'use client';

import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  Backpack,
  Bookmark,
  Check,
  CheckCircle2,
  Compass,
  Crosshair,
  Download,
  Droplets,
  Flame,
  GitFork,
  Info,
  Loader2,
  MapPin,
  Moon,
  Mountain,
  Pencil,
  Play,
  Plus,
  RefreshCw,
  Route,
  ShieldCheck,
  Sparkles,
  Sun,
  WifiOff,
  X,
  Zap,
} from 'lucide-react';
import { SortMenuButton, type SortMenuGroup } from '@/components/ui/drawer/SortMenuButton';
import type {
  ComputedItinerary,
  RoutePlanEndpoint,
  RoutePlanResponse,
  RoutingTravelMode,
} from '../../routing/types';
import { RouteExplainabilitySubSheet } from './RouteExplainabilitySubSheet';
import { RouteKitSubDrawer } from './RouteKitSubDrawer';
import { RouteOriginSubDrawer, type VerifiedGpsState } from './RouteOriginSubDrawer';
import { RouteReliefSubDrawer } from './RouteReliefSubDrawer';
import { distanceKm } from '../../sheet/context';
import { useExplorerStore } from '../../state/store';

const GPS_LOCATING_TIMEOUT_MS = 3500;

export interface ExplorerPoiRoutingViewProps {
  destinationName: string;
  destination?: {
    id?: string | null;
    name?: string | null;
    lat?: number | null;
    lng?: number | null;
  } | null;
  origin: RoutePlanEndpoint | null;
  verifiedGps: VerifiedGpsState;
  savedPlaces?: ReadonlyArray<{ id: string; name: string; lat: number; lng: number; kind?: string }>;
  plan: RoutePlanResponse | null;
  loading: boolean;
  error: string | null;
  selectedItineraryId: string | null;
  activeMode: RoutingTravelMode;
  packWeightKg: number | null;
  activeKitId: string | null;
  onSelectItinerary: (id: string) => void;
  onChangeMode: (mode: RoutingTravelMode) => void;
  onChangePack: (kitId: string | null, weightKg: number) => void;
  onChangeOrigin: (origin: RoutePlanEndpoint) => void;
  onRequestVerifiedGps: () => void;
  onToggleAlternativesPreview: (show: boolean) => void;
  onProfileCursorChange?: (
    cursor: { lon: number; lat: number; distanceM: number; elevationM: number | null } | null,
  ) => void;
  onFocusCoordinates?: (coords: [number, number], label?: string) => void;
  onStartGuidance: (itinerary: ComputedItinerary) => void;
  onRetry: () => void;
  onBackToPoi: () => void;
  onClose: () => void;
  onExportGpx?: (itinerary: ComputedItinerary) => void;
  onSaveRoute?: (itinerary: ComputedItinerary) => void;
  onDownloadOffline?: (itinerary: ComputedItinerary) => void;
  viaPoints?: ReadonlyArray<{ id: string; name: string; lat: number; lng: number }>;
  onAddViaPoint?: () => void;
  onRemoveViaPoint?: (id: string) => void;
}

type RoutingSubDrawer = 'trajet' | 'relief' | 'alternatives' | 'pourquoi';
type ModalSubDrawer = 'none' | 'origin' | 'kit';

const MODE_LABELS: Record<RoutingTravelMode, string> = {
  rando: 'Randonnée',
  trail: 'Trail',
  velo: 'Vélo route',
  gravel: 'Gravel',
  vtt: 'VTT',
  vae: 'Vélo électrique',
  ski: 'Ski de rando',
  raquettes: 'Raquettes',
  kayak: 'Kayak / Nautique',
  multimodal: 'Multimodal',
};

const LOADING_STEPS = ['GPS & Départ', 'Relief & sentiers', 'Météo & vent', 'Alternatives'] as const;

function formatDurationFr(min: number): string {
  const m = Math.max(1, Math.round(min));
  const h = Math.floor(m / 60);
  const rem = m % 60;
  if (h <= 0) return `${rem} min`;
  return rem > 0 ? `${h}h${String(rem).padStart(2, '0')}` : `${h}h`;
}

function formatClockIso(iso: string): string {
  const ts = Date.parse(iso);
  if (!Number.isFinite(ts)) return '--:--';
  return new Date(ts).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
}

function escapeXml(raw: string): string {
  return raw
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function downloadItineraryGpxInline(itinerary: ComputedItinerary, destinationName: string): void {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;
  const profilePoints = itinerary.elevationProfile ?? [];
  const rawCoords = itinerary.geojson?.geometry?.coordinates ?? [];
  const trkpts =
    profilePoints.length > 1
      ? profilePoints
          .filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng))
          .map(
            (p) =>
              `      <trkpt lat="${p.lat.toFixed(6)}" lon="${p.lng.toFixed(6)}"><ele>${Math.round(p.ele)}</ele></trkpt>`,
          )
      : rawCoords
          .filter((c) => Array.isArray(c) && Number.isFinite(c[0]) && Number.isFinite(c[1]))
          .map((c) => `      <trkpt lat="${c[1].toFixed(6)}" lon="${c[0].toFixed(6)}"></trkpt>`);

  if (trkpts.length === 0) return;

  const trackName = itinerary.title?.trim() || `Itinéraire vers ${destinationName}`;
  const xml = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<gpx version="1.1" creator="Le Kit du Voyageur - Explorer v2" xmlns="http://www.topografix.com/GPX/1/1">',
    '  <metadata>',
    `    <name>${escapeXml(trackName)}</name>`,
    `    <time>${new Date().toISOString()}</time>`,
    '  </metadata>',
    '  <trk>',
    `    <name>${escapeXml(trackName)}</name>`,
    '    <trkseg>',
    ...trkpts,
    '    </trkseg>',
    '  </trk>',
    '</gpx>',
  ].join('\n');

  const slug = trackName
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
  const blob = new Blob([xml], { type: 'application/gpx+xml;charset=utf-8' });
  const url = window.URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `${slug || 'itineraire'}.gpx`;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  window.setTimeout(() => window.URL.revokeObjectURL(url), 1000);
}

function roleIcon(role: ComputedItinerary['role']) {
  if (role === 'safer') return <ShieldCheck size={13} aria-hidden="true" />;
  if (role === 'gentler') return <Mountain size={13} aria-hidden="true" />;
  if (role === 'faster') return <Zap size={13} aria-hidden="true" />;
  return <Sparkles size={13} aria-hidden="true" />;
}

function FitScoreRing({ score, verdict, size = 56 }: { score: number; verdict: string; size?: number }) {
  const clamped = Math.max(0, Math.min(100, Math.round(score)));
  const stroke = 5;
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const dashOffset = circ * (1 - clamped / 100);
  const color =
    verdict === 'not_recommended' ? '#DC2626' : verdict === 'caution' ? '#D97706' : '#0E8F5B';

  return (
    <div className="xp20-fit-ring" style={{ width: size, height: size }} aria-label={`Score ${clamped} sur 100`}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(23, 64, 44, 0.1)" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circ}
          strokeDashoffset={dashOffset}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </svg>
      <div className="xp20-fit-ring-center">
        <strong>{clamped}</strong>
        <span>FIT</span>
      </div>
    </div>
  );
}

function DaylightTimelineBar({ arrivalTimeIso, afterDarkMinutes }: { arrivalTimeIso: string; afterDarkMinutes: number }) {
  const isNight = afterDarkMinutes > 0;
  const dotPct = isNight ? Math.min(92, 74 + Math.min(18, Math.round(afterDarkMinutes / 15))) : 46;
  return (
    <div className="xp20-daylight-bar-wrap" aria-label={`Arrivée estimée à ${formatClockIso(arrivalTimeIso)}`}>
      <Sun size={13} color="#D97706" aria-hidden="true" />
      <div className="xp20-daylight-track">
        <span className="xp20-daylight-dot" data-night={isNight ? 'true' : 'false'} style={{ left: `${dotPct}%` }} />
      </div>
      <Moon size={12} color="#334155" aria-hidden="true" />
      <span className="xp20-daylight-clock" data-night={isNight ? 'true' : 'false'}>
        {formatClockIso(arrivalTimeIso)}
      </span>
    </div>
  );
}

export function ExplorerPoiRoutingView({
  destinationName,
  destination = null,
  origin,
  verifiedGps,
  savedPlaces = [],
  plan,
  loading,
  error,
  selectedItineraryId,
  activeMode,
  packWeightKg,
  activeKitId,
  onSelectItinerary,
  onChangeMode,
  onChangePack,
  onChangeOrigin,
  onRequestVerifiedGps,
  onToggleAlternativesPreview,
  onProfileCursorChange,
  onFocusCoordinates,
  onStartGuidance,
  onRetry,
  onBackToPoi,
  onClose,
  onExportGpx,
  onSaveRoute,
  onDownloadOffline,
  viaPoints = [],
  onAddViaPoint,
  onRemoveViaPoint,
}: ExplorerPoiRoutingViewProps) {
  const [activeLens, setActiveLens] = useState<RoutingSubDrawer>('trajet');
  const [modalSubDrawer, setModalSubDrawer] = useState<ModalSubDrawer>('none');
  const [loadingStepIdx, setLoadingStepIdx] = useState(0);
  const [gpsTimedOut, setGpsTimedOut] = useState(false);
  const [gpsAttemptNonce, setGpsAttemptNonce] = useState(0);
  const [gpxFeedback, setGpxFeedback] = useState(false);
  const [savedFeedback, setSavedFeedback] = useState(false);
  const mapCenter = useExplorerStore((s) => s.center);

  useEffect(() => {
    if (verifiedGps.status !== 'locating') {
      setGpsTimedOut(false);
      return;
    }
    setGpsTimedOut(false);
    const timer = window.setTimeout(() => {
      setGpsTimedOut(true);
    }, GPS_LOCATING_TIMEOUT_MS);
    return () => window.clearTimeout(timer);
  }, [verifiedGps.status, gpsAttemptNonce]);

  const handleRequestVerifiedGps = () => {
    setGpsTimedOut(false);
    setGpsAttemptNonce((n) => n + 1);
    onRequestVerifiedGps();
  };

  const effectiveGps: VerifiedGpsState =
    gpsTimedOut && verifiedGps.status === 'locating'
      ? {
          status: 'error',
          errorTitle: 'Signal GPS indisponible',
          errorHint:
            'Choisissez un lieu de départ manuellement ou utilisez le centre de la carte.',
        }
      : verifiedGps;

  const isLocating = effectiveGps.status === 'locating';

  useEffect(() => {
    if (!loading && !isLocating) {
      setLoadingStepIdx(0);
      return;
    }
    const id = window.setInterval(() => {
      setLoadingStepIdx((i) => (i + 1) % LOADING_STEPS.length);
    }, 1250);
    return () => window.clearInterval(id);
  }, [loading, isLocating]);

  const resolvedDestination = useMemo(() => {
    const destId = destination?.id ?? plan?.destination?.poiId ?? null;
    const destLat =
      typeof destination?.lat === 'number' && Number.isFinite(destination.lat)
        ? destination.lat
        : typeof plan?.destination?.lat === 'number' && Number.isFinite(plan.destination.lat)
          ? plan.destination.lat
          : null;
    const destLng =
      typeof destination?.lng === 'number' && Number.isFinite(destination.lng)
        ? destination.lng
        : typeof plan?.destination?.lng === 'number' && Number.isFinite(plan.destination.lng)
          ? plan.destination.lng
          : null;
    return {
      id: destId,
      name: destination?.name ?? destinationName,
      lat: destLat,
      lng: destLng,
    };
  }, [destination, destinationName, plan?.destination]);

  const mapCenterFallback = useMemo<[number, number] | null>(() => {
    if (
      !Array.isArray(mapCenter) ||
      !Number.isFinite(mapCenter[0]) ||
      !Number.isFinite(mapCenter[1])
    ) {
      return null;
    }
    if (resolvedDestination.lat !== null && resolvedDestination.lng !== null) {
      if (distanceKm(mapCenter, [resolvedDestination.lng, resolvedDestination.lat]) < 0.15) {
        return null;
      }
    }
    return mapCenter;
  }, [mapCenter, resolvedDestination.lat, resolvedDestination.lng]);

  const allItineraries = useMemo<ComputedItinerary[]>(() => {
    if (!plan) return [];
    return [plan.recommended, ...plan.alternatives];
  }, [plan]);

  const activeItinerary = useMemo<ComputedItinerary | null>(() => {
    if (allItineraries.length === 0) return null;
    return allItineraries.find((it) => it.id === selectedItineraryId) ?? allItineraries[0] ?? null;
  }, [allItineraries, selectedItineraryId]);

  const allowedModes = plan?.manifestSummary.allowedModes ?? [activeMode];
  const effectivePackKg = packWeightKg ?? plan?.manifestSummary.packWeightKg ?? 6;
  const availableKits = plan?.manifestSummary.availableKits ?? [];

  const switchLens = (next: RoutingSubDrawer) => {
    setActiveLens(next);
    onToggleAlternativesPreview(next === 'alternatives');
  };

  // Dedicated Sub-Drawer: Origin Search & Verified GPS
  if (modalSubDrawer === 'origin') {
    return (
      <RouteOriginSubDrawer
        currentOrigin={origin}
        destination={resolvedDestination}
        mapCenterFallback={mapCenterFallback}
        verifiedGps={effectiveGps}
        savedPlaces={savedPlaces}
        onRequestVerifiedGps={handleRequestVerifiedGps}
        onSelectOrigin={(nextOrigin) => {
          setModalSubDrawer('none');
          onChangeOrigin(nextOrigin);
        }}
        onBack={() => setModalSubDrawer('none')}
      />
    );
  }

  // Dedicated Sub-Drawer: Real LKDV Kit Drawer
  if (modalSubDrawer === 'kit') {
    return (
      <RouteKitSubDrawer
        activeKitId={activeKitId}
        packWeightKg={effectivePackKg}
        fallbackKits={availableKits}
        onSelectKit={(kitId, weightKg) => onChangePack(kitId, weightKg)}
        onBack={() => setModalSubDrawer('none')}
      />
    );
  }

  const maxAltDur = Math.max(1, ...allItineraries.map((i) => i.durationP50Min));
  const maxAltDplus = Math.max(10, ...allItineraries.map((i) => i.dplusM));

  // Bottom-Right Filter Menu (EXACT Carnet/Club/Explorer SortMenuButton pattern!)
  const modeFilterGroups: SortMenuGroup[] = [
    {
      id: 'routing-mode',
      label: 'Mode de déplacement',
      value: activeMode,
      defaultValue: allowedModes[0] ?? 'rando',
      options: allowedModes.map((m) => ({ value: m, label: MODE_LABELS[m] ?? m })),
      onChange: (v) => onChangeMode(v as RoutingTravelMode),
    },
  ];

  const isBusy = loading || isLocating;
  const isUsingVerifiedGps =
    effectiveGps.status === 'verified' &&
    origin &&
    typeof effectiveGps.lat === 'number' &&
    typeof effectiveGps.lng === 'number' &&
    Math.abs(origin.lat - effectiveGps.lat) < 0.002 &&
    Math.abs(origin.lng - effectiveGps.lng) < 0.002;

  return (
    <div className="xp20-route-shell" role="region" aria-label={`Itinéraire vers ${destinationName}`}>
      {/* Clean Header (Zero top filter clutter!) */}
      <div className="xp20-route-header">
        <button
          type="button"
          className="xp20-route-icon-btn"
          onClick={onBackToPoi}
          aria-label="Retour à la fiche du lieu"
        >
          <ArrowLeft size={16} aria-hidden="true" />
        </button>
        <div className="xp20-route-header-copy">
          <h2 className="xp20-route-title" title={destinationName}>
            {destinationName}
          </h2>
          <button
            type="button"
            className="xp20-origin-trigger"
            onClick={() => setModalSubDrawer('origin')}
            aria-label="Modifier le point de départ ou vérifier la position GPS"
          >
            {isLocating ? (
              <Loader2 size={11} className="xp20-route-spin" aria-hidden="true" />
            ) : isUsingVerifiedGps ? (
              <CheckCircle2 size={11} color="#0E8F5B" aria-hidden="true" />
            ) : (
              <MapPin size={11} aria-hidden="true" />
            )}
            <span>
              {isLocating
                ? 'Vérification GPS…'
                : origin?.label
                  ? `${origin.label}${isUsingVerifiedGps && effectiveGps.accuracyM ? ` (±${Math.round(effectiveGps.accuracyM)}m)` : ''}`
                  : 'Choisir un départ'}
            </span>
            <Pencil size={10} aria-hidden="true" />
          </button>
        </div>
        <button
          type="button"
          className="xp20-route-pack-chip"
          onClick={() => setModalSubDrawer('kit')}
          aria-label={`Ouvrir le tiroir kit (${effectivePackKg.toFixed(1)} kg)`}
        >
          <Backpack size={13} aria-hidden="true" />
          <span>{effectivePackKg.toFixed(1)} kg</span>
        </button>
        <button
          type="button"
          className="xp20-route-icon-btn"
          onClick={onClose}
          aria-label="Fermer l’itinéraire"
        >
          <X size={16} aria-hidden="true" />
        </button>
      </div>

      {/* Sub-Drawer Content (Each lens is dedicated, visual-first, and compact!) */}
      <div className="xp20-route-scroll">
        {/* GPS Permission Denied / Timed Out / Unverified Banner */}
        {!origin && (effectiveGps.status === 'denied' || effectiveGps.status === 'error') ? (
          <div className="xp20-gps-prompt-card" role="alert">
            <Crosshair size={18} aria-hidden="true" />
            <div>
              <strong>{effectiveGps.errorTitle ?? 'Position GPS non vérifiée'}</strong>
              <span>{effectiveGps.errorHint ?? 'Autorisez la localisation sur votre appareil ou recherchez un lieu de départ.'}</span>
            </div>
            <div className="xp20-gps-prompt-actions">
              <button type="button" className="xp20-route-secondary-btn" onClick={() => setModalSubDrawer('origin')}>
                <MapPin size={13} aria-hidden="true" />
                <span>Choisir un départ</span>
              </button>
              {mapCenterFallback ? (
                <button
                  type="button"
                  className="xp20-route-secondary-btn"
                  onClick={() =>
                    onChangeOrigin({
                      lat: mapCenterFallback[1],
                      lng: mapCenterFallback[0],
                      label: 'Centre de la carte',
                    })
                  }
                >
                  <Compass size={13} aria-hidden="true" />
                  <span>Centre carte</span>
                </button>
              ) : null}
              <button type="button" className="xp20-route-secondary-btn" onClick={handleRequestVerifiedGps}>
                <Crosshair size={13} aria-hidden="true" />
                <span>Réessayer GPS</span>
              </button>
            </div>
          </div>
        ) : isBusy && !activeItinerary ? (
          <div className="xp20-route-loading" role="status" aria-live="polite" aria-busy="true">
            <div className="xp20-route-loading-card">
              <div className="xp20-route-loading-head">
                <span className="xp20-route-spinner-badge" aria-hidden="true">
                  <Loader2 size={16} className="xp20-route-spin" />
                </span>
                <div className="xp20-route-loading-copy">
                  <strong className="xp20-route-loading-title">
                    {isLocating ? 'Localisation GPS précise…' : 'Calcul du tracé…'}
                  </strong>
                  <div className="xp20-loading-step-dots">
                    {LOADING_STEPS.map((label, idx) => (
                      <span
                        key={label}
                        className="xp20-loading-pill"
                        data-active={idx === loadingStepIdx ? 'true' : 'false'}
                      >
                        {label}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
              <div className="xp20-route-progress-track" aria-hidden="true">
                <span className="xp20-route-progress-bar" />
              </div>
            </div>
            <div className="xp20-shimmer xp20-route-skel-hero" />
          </div>
        ) : error && !activeItinerary ? (
          <div className="xp20-route-error" role="alert">
            <AlertTriangle size={18} aria-hidden="true" />
            <p>{error}</p>
            <div className="xp20-gps-prompt-actions">
              <button type="button" className="xp20-route-secondary-btn" onClick={() => setModalSubDrawer('origin')}>
                <MapPin size={13} aria-hidden="true" />
                <span>Autre départ</span>
              </button>
              <button type="button" className="xp20-route-secondary-btn" onClick={onRetry}>
                <RefreshCw size={13} aria-hidden="true" />
                <span>Réessayer</span>
              </button>
            </div>
          </div>
        ) : activeItinerary ? (
          <>
            {isBusy ? (
              <div className="xp20-route-recalc-pill" role="status" aria-live="polite" aria-busy="true">
                <Loader2 size={14} className="xp20-route-spin" aria-hidden="true" />
                <span>{isLocating ? 'Vérification GPS…' : 'Recalcul…'}</span>
              </div>
            ) : null}

            {/* SUB-DRAWER 1: TRAJET — Ultra-clean visual card (zero clutter!) */}
            {activeLens === 'trajet' ? (
              <div className="xp20-sub-pane" data-loading={isBusy ? 'true' : 'false'}>
                <div className="xp20-route-hero-card">
                  <div className="xp20-visual-hero-row">
                    <FitScoreRing score={activeItinerary.fit.fitScore} verdict={activeItinerary.fit.verdict} />
                    <div className="xp20-visual-hero-stats">
                      <div className="xp20-visual-hero-primary">
                        <strong>{formatDurationFr(activeItinerary.durationP50Min)}</strong>
                        <span>{activeItinerary.distanceKm.toFixed(1)} km</span>
                        <span className="xp20-dplus-chip">+{activeItinerary.dplusM} m</span>
                      </div>
                      <div className="xp20-visual-micro-chips">
                        <span className="xp20-micro-chip">
                          {roleIcon(activeItinerary.role)} {MODE_LABELS[activeMode]}
                        </span>
                        <span className="xp20-micro-chip">
                          <Route size={11} aria-hidden="true" /> {activeItinerary.explanation.maxSacGradeLabel}
                        </span>
                        <span className="xp20-micro-chip">
                          <Droplets size={11} aria-hidden="true" /> {activeItinerary.hydrationLiters.toFixed(1)} L
                        </span>
                        <span className="xp20-micro-chip">
                          <Flame size={11} aria-hidden="true" /> {Math.round(activeItinerary.estimatedKcal)} kcal
                        </span>
                      </div>
                    </div>
                  </div>

                  {activeItinerary.legs.length > 1 ? (
                    <div className="xp20-route-legs-strip">
                      {activeItinerary.legs.map((leg) => (
                        <span key={leg.id} className="xp20-route-leg-pill" data-kind={leg.kind}>
                          {leg.label} · {formatDurationFr(leg.durationMin)}
                        </span>
                      ))}
                    </div>
                  ) : null}

                  <DaylightTimelineBar
                    arrivalTimeIso={activeItinerary.arrivalTimeIso}
                    afterDarkMinutes={activeItinerary.afterDarkMinutes}
                  />
                </div>

                {/* Active Via-Point Chips */}
                {viaPoints.length > 0 ? (
                  <div
                    style={{
                      display: 'flex',
                      flexWrap: 'wrap',
                      gap: 6,
                      marginTop: 8,
                    }}
                    aria-label="Étapes intermédiaires"
                  >
                    {viaPoints.map((vp, idx) => (
                      <span
                        key={vp.id}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 5,
                          height: 28,
                          padding: '0 8px 0 9px',
                          borderRadius: 999,
                          background: 'rgba(255, 255, 255, 0.86)',
                          border: '0.5px solid rgba(23, 64, 44, 0.16)',
                          color: '#172B24',
                          fontSize: 11.5,
                          fontWeight: 700,
                          boxShadow: 'inset 0 1px 0 rgba(255, 255, 255, 0.94)',
                        }}
                      >
                        <MapPin size={11} color="#17402C" aria-hidden="true" />
                        <span>
                          Étape {idx + 1} · {vp.name}
                        </span>
                        {onRemoveViaPoint ? (
                          <button
                            type="button"
                            onClick={() => onRemoveViaPoint(vp.id)}
                            aria-label={`Retirer l'étape ${vp.name}`}
                            style={{
                              width: 18,
                              height: 18,
                              borderRadius: 999,
                              border: 0,
                              background: 'rgba(23, 64, 44, 0.08)',
                              color: '#17402C',
                              display: 'inline-grid',
                              placeItems: 'center',
                              cursor: 'pointer',
                              padding: 0,
                            }}
                          >
                            <X size={10} aria-hidden="true" />
                          </button>
                        ) : null}
                      </span>
                    ))}
                  </div>
                ) : null}

                {/* Compact Liquid Glass Routing Actions Strip */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    flexWrap: 'wrap',
                    marginTop: 8,
                  }}
                >
                  <button
                    type="button"
                    onClick={() => {
                      if (onExportGpx) {
                        onExportGpx(activeItinerary);
                      } else {
                        downloadItineraryGpxInline(activeItinerary, destinationName);
                      }
                      setGpxFeedback(true);
                      window.setTimeout(() => setGpxFeedback(false), 1800);
                    }}
                    style={{
                      height: 31,
                      padding: '0 11px',
                      borderRadius: 999,
                      border: '0.5px solid rgba(23, 64, 44, 0.15)',
                      background: 'rgba(255, 255, 255, 0.86)',
                      color: gpxFeedback ? '#15803D' : '#17402C',
                      fontSize: 11.5,
                      fontWeight: 700,
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 5,
                      cursor: 'pointer',
                      boxShadow: 'inset 0 1px 0 #fff, 0 2px 6px rgba(23, 43, 36, 0.05)',
                    }}
                  >
                    {gpxFeedback ? (
                      <Check size={12} aria-hidden="true" />
                    ) : (
                      <Download size={12} aria-hidden="true" />
                    )}
                    <span>{gpxFeedback ? 'GPX prêt' : 'Export GPX'}</span>
                  </button>

                  {onDownloadOffline ? (
                    <button
                      type="button"
                      onClick={() => onDownloadOffline(activeItinerary)}
                      style={{
                        height: 31,
                        padding: '0 11px',
                        borderRadius: 999,
                        border: '0.5px solid rgba(23, 64, 44, 0.15)',
                        background: 'rgba(255, 255, 255, 0.86)',
                        color: '#17402C',
                        fontSize: 11.5,
                        fontWeight: 700,
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 5,
                        cursor: 'pointer',
                        boxShadow: 'inset 0 1px 0 #fff, 0 2px 6px rgba(23, 43, 36, 0.05)',
                      }}
                    >
                      <WifiOff size={12} aria-hidden="true" />
                      <span>Hors-ligne</span>
                    </button>
                  ) : null}

                  {onSaveRoute ? (
                    <button
                      type="button"
                      onClick={() => {
                        onSaveRoute(activeItinerary);
                        setSavedFeedback(true);
                        window.setTimeout(() => setSavedFeedback(false), 1800);
                      }}
                      style={{
                        height: 31,
                        padding: '0 11px',
                        borderRadius: 999,
                        border: '0.5px solid rgba(23, 64, 44, 0.15)',
                        background: savedFeedback
                          ? 'rgba(21, 128, 61, 0.11)'
                          : 'rgba(255, 255, 255, 0.86)',
                        color: savedFeedback ? '#15803D' : '#17402C',
                        fontSize: 11.5,
                        fontWeight: 700,
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 5,
                        cursor: 'pointer',
                        boxShadow: 'inset 0 1px 0 #fff, 0 2px 6px rgba(23, 43, 36, 0.05)',
                      }}
                    >
                      {savedFeedback ? (
                        <Check size={12} aria-hidden="true" />
                      ) : (
                        <Bookmark size={12} aria-hidden="true" />
                      )}
                      <span>{savedFeedback ? 'Enregistré' : 'Enregistrer'}</span>
                    </button>
                  ) : null}

                  {onAddViaPoint ? (
                    <button
                      type="button"
                      onClick={onAddViaPoint}
                      style={{
                        height: 31,
                        padding: '0 11px',
                        borderRadius: 999,
                        border: '0.5px dashed rgba(23, 64, 44, 0.28)',
                        background: 'rgba(23, 64, 44, 0.06)',
                        color: '#17402C',
                        fontSize: 11.5,
                        fontWeight: 700,
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 4,
                        cursor: 'pointer',
                      }}
                    >
                      <Plus size={12} aria-hidden="true" />
                      <span>Étape</span>
                    </button>
                  ) : null}
                </div>
              </div>
            ) : null}

            {/* SUB-DRAWER 2: RELIEF — Dedicated Technical Elevation & Slopes Sub-Drawer */}
            {activeLens === 'relief' ? (
              <RouteReliefSubDrawer
                itinerary={activeItinerary}
                onProfileCursorChange={onProfileCursorChange}
              />
            ) : null}

            {/* SUB-DRAWER 3: ALTERNATIVES — Dedicated Comparison Sub-Drawer */}
            {activeLens === 'alternatives' ? (
              <div className="xp20-route-alt-list" role="radiogroup" aria-label="Variantes d’itinéraires">
                {allItineraries.map((it) => {
                  const active = it.id === activeItinerary.id;
                  const durPct = Math.max(18, Math.round((it.durationP50Min / maxAltDur) * 100));
                  const dplusPct = Math.max(12, Math.round((it.dplusM / maxAltDplus) * 100));
                  return (
                    <button
                      key={it.id}
                      type="button"
                      role="radio"
                      aria-checked={active}
                      className="xp20-route-alt-card"
                      data-selected={active ? 'true' : 'false'}
                      onClick={() => {
                        onSelectItinerary(it.id);
                        switchLens('trajet');
                      }}
                    >
                      <div className="xp20-route-alt-top">
                        <span className="xp20-route-role-badge" data-role={it.role}>
                          {roleIcon(it.role)}
                          <span>{it.roleLabel}</span>
                        </span>
                        <span className="xp20-route-fit-pill" data-verdict={it.fit.verdict}>
                          {active ? <Check size={12} aria-hidden="true" /> : null}
                          <span>{it.fit.fitScore}</span>
                        </span>
                      </div>

                      <div className="xp20-alt-visual-bars">
                        <div className="xp20-alt-bar-row">
                          <span className="xp20-alt-bar-val">{formatDurationFr(it.durationP50Min)}</span>
                          <div className="xp20-alt-bar-track">
                            <span className="xp20-alt-bar-fill" style={{ width: `${durPct}%`, background: '#0E8F5B' }} />
                          </div>
                          <span className="xp20-alt-bar-meta">{it.distanceKm.toFixed(1)} km</span>
                        </div>
                        <div className="xp20-alt-bar-row">
                          <span className="xp20-alt-bar-val">+{it.dplusM} m</span>
                          <div className="xp20-alt-bar-track">
                            <span className="xp20-alt-bar-fill" style={{ width: `${dplusPct}%`, background: '#D97706' }} />
                          </div>
                          <span className="xp20-alt-bar-meta">{it.explanation.maxSacGradeLabel}</span>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            ) : null}

            {/* SUB-DRAWER 4: DÉTAILS (Variables & Pourquoi — 4 visual XAI pillars) */}
            {activeLens === 'pourquoi' ? (
              <RouteExplainabilitySubSheet
                itinerary={activeItinerary}
                activeKitId={activeKitId}
                packWeightKg={effectivePackKg}
                onOpenKit={() => setModalSubDrawer('kit')}
                onFocusCoordinates={onFocusCoordinates}
                embedded
              />
            ) : null}
          </>
        ) : null}
      </div>

      {/* Carnet & Club Bottom Dock: ▶ Guider (left) | 4 Sub-Drawer Lenses (center) | SortMenuButton Filter (bottom-right!) */}
      <div className="xp20-subdrawer-dock">
        <button
          type="button"
          className="xp20-floating-pill-primary xp20-subdrawer-cta"
          disabled={!activeItinerary || isBusy}
          onClick={() => {
            if (activeItinerary) onStartGuidance(activeItinerary);
          }}
        >
          {isBusy ? (
            <>
              <Loader2 size={13} className="xp20-route-spin" aria-hidden="true" />
              <span>…</span>
            </>
          ) : (
            <>
              <Play size={13} fill="currentColor" aria-hidden="true" />
              <span>Guider</span>
            </>
          )}
        </button>

        <div className="xp20-subdrawer-right-group">
          <div
            className="xp20-glass-lens-capsule"
            role="tablist"
            aria-label="Sous-tiroirs itinéraire"
            style={{ '--n': 4 } as React.CSSProperties}
          >
            <span
              className="xp20-glass-lens-thumb"
              aria-hidden="true"
              style={{
                width: 'calc((100% - 6px) / 4)',
                transform: `translateX(${(activeLens === 'trajet' ? 0 : activeLens === 'relief' ? 1 : activeLens === 'alternatives' ? 2 : 3) * 100}%)`,
              }}
            />
            <button
              type="button"
              role="tab"
              aria-selected={activeLens === 'trajet'}
              aria-label="Trajet"
              title="Trajet"
              className="xp20-glass-lens-btn"
              data-active={activeLens === 'trajet' ? 'true' : 'false'}
              onClick={() => switchLens('trajet')}
            >
              <Route size={16} strokeWidth={2} aria-hidden="true" />
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeLens === 'relief'}
              aria-label="Relief et profil altimétrique"
              title="Relief"
              disabled={!activeItinerary}
              className="xp20-glass-lens-btn"
              data-active={activeLens === 'relief' ? 'true' : 'false'}
              onClick={() => switchLens('relief')}
            >
              <Mountain size={16} strokeWidth={2} aria-hidden="true" />
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeLens === 'alternatives'}
              aria-label={`Alternatives (${Math.max(0, allItineraries.length - 1)})`}
              title="Alternatives"
              disabled={allItineraries.length <= 1}
              className="xp20-glass-lens-btn"
              data-active={activeLens === 'alternatives' ? 'true' : 'false'}
              onClick={() => switchLens('alternatives')}
            >
              <GitFork size={16} strokeWidth={2} aria-hidden="true" />
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeLens === 'pourquoi'}
              aria-label="Détails, météo et équipement"
              title="Détails & Équipement"
              disabled={!activeItinerary}
              className="xp20-glass-lens-btn"
              data-active={activeLens === 'pourquoi' ? 'true' : 'false'}
              onClick={() => switchLens('pourquoi')}
            >
              <Info size={16} strokeWidth={2} aria-hidden="true" />
            </button>
          </div>

          {/* Bottom-Right Filter Button (exact Carnet / Club / Explorer SortMenuButton!) */}
          <div className="xp20-subdrawer-filter">
            <SortMenuButton
              value={activeMode}
              defaultValue={allowedModes[0] ?? 'rando'}
              options={[]}
              onChange={() => {}}
              groups={modeFilterGroups}
              label="Filtrer le mode de déplacement"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
