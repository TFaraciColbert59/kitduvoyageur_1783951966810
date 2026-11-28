'use client';

import React, { lazy, Suspense, useMemo, useState } from 'react';
import {
  Activity,
  ArrowLeft,
  Backpack,
  Bike,
  Check,
  ChevronRight,
  CloudSun,
  Compass,
  Download,
  Footprints,
  Loader2,
  Mountain,
  MountainSnow,
  Play,
  Radio,
  RefreshCw,
  Route,
  SlidersHorizontal,
  Snowflake,
  Sunset,
  Tent,
  Waves,
  WifiOff,
  X,
  Zap,
} from 'lucide-react';
import { StackSlideView } from '@/components/carnet/v2/CarnetDrawerMotion';
import { resolveActivityProfile } from '../specs/resolveActivityProfile';
import type { Sport } from '../state/types';
import type { PreFlightExpertSettings } from './preflight/PreFlightExpertSubDrawer';

const LazyPreFlightExpertSubDrawer = lazy(() =>
  import('./preflight/PreFlightExpertSubDrawer').then((m) => ({
    default: m.PreFlightExpertSubDrawer,
  })),
);

export interface ExplorerPreFlightSheetProps {
  sport: Sport;
  catalogSlug?: string | null;
  onChangeSport: (sport: Sport) => void;
  routeName?: string | null;
  routeDistanceKm?: number | null;
  routeElevGainM?: number | null;
  routeStatus?: 'idle' | 'loading' | 'ready' | 'unavailable';
  onClearRoute?: () => void;
  onRetryRoute?: () => void;
  kitLabel?: string | null;
  packWeightKg?: number | null;
  onOpenKitPicker?: () => void;
  gpsReady: boolean;
  locationPermission?: string;
  onRequestLocation?: () => void;
  weatherSummary?: string | null;
  sunsetHm?: string | null;
  offlineReady?: boolean;
  onDownloadOffline?: () => void;
  onLaunch: (opts: { express?: boolean }) => void;
  onBack: () => void;
  onClose: () => void;
}

interface QuickSportPill {
  readonly id: string;
  readonly label: string;
  readonly sport: Sport;
  readonly icon: React.ReactNode;
}

const QUICK_SPORT_PILLS: readonly QuickSportPill[] = [
  { id: 'rando', label: 'Rando', sport: 'rando', icon: <Mountain size={13} aria-hidden="true" /> },
  { id: 'trail', label: 'Trail', sport: 'trail', icon: <Footprints size={13} aria-hidden="true" /> },
  { id: 'vtt', label: 'VTT', sport: 'velo', icon: <Bike size={13} aria-hidden="true" /> },
  { id: 'velo', label: 'Vélo', sport: 'velo', icon: <Bike size={13} aria-hidden="true" /> },
  { id: 'course', label: 'Course', sport: 'course', icon: <Activity size={13} aria-hidden="true" /> },
  { id: 'alpinisme', label: 'Alpinisme', sport: 'escalade', icon: <MountainSnow size={13} aria-hidden="true" /> },
  { id: 'ski', label: 'Ski', sport: 'ski', icon: <Snowflake size={13} aria-hidden="true" /> },
  { id: 'kayak', label: 'Kayak', sport: 'kayak', icon: <Waves size={13} aria-hidden="true" /> },
  { id: 'bivouac', label: 'Bivouac', sport: 'bivouac', icon: <Tent size={13} aria-hidden="true" /> },
];

function formatKm(km: number): string {
  if (!Number.isFinite(km) || km < 0) return '0 km';
  if (km < 1) return `${Math.round(km * 1000)} m`;
  return `${km.toFixed(1).replace('.', ',')} km`;
}

function formatWeightKg(kg: number): string {
  if (!Number.isFinite(kg) || kg < 0) return '0 kg';
  return `${kg.toFixed(1).replace('.', ',')} kg`;
}

export function ExplorerPreFlightSheet({
  sport,
  catalogSlug = null,
  onChangeSport,
  routeName = null,
  routeDistanceKm = null,
  routeElevGainM = null,
  routeStatus = 'idle',
  onClearRoute,
  onRetryRoute,
  kitLabel = null,
  packWeightKg = null,
  onOpenKitPicker,
  gpsReady,
  locationPermission = 'prompt',
  onRequestLocation,
  weatherSummary = null,
  sunsetHm = null,
  offlineReady = false,
  onDownloadOffline,
  onLaunch,
  onBack,
  onClose,
}: ExplorerPreFlightSheetProps) {
  const [pickedPillId, setPickedPillId] = useState<string | null>(null);
  const [expertOpen, setExpertOpen] = useState(false);
  const activeProfile = useMemo(
    () => resolveActivityProfile(catalogSlug || sport),
    [catalogSlug, sport],
  );
  const [expertSettings, setExpertSettings] = useState<PreFlightExpertSettings>(() => ({
    beaconEnabled: false,
    epzRadiusM: activeProfile.privacyAndCompliance.epzRadiusDefaultM,
    autoPauseEnabled: activeProfile.algorithms.autoPause.defaultEnabled,
    voiceGuidanceEnabled: true,
    baroAutoCalibrate: activeProfile.acquisition.barometer.enabled,
    selectedBleSensors: [],
  }));

  const activePillId = useMemo(() => {
    if (pickedPillId) {
      const picked = QUICK_SPORT_PILLS.find((p) => p.id === pickedPillId);
      if (picked && picked.sport === sport) return picked.id;
    }
    return QUICK_SPORT_PILLS.find((p) => p.sport === sport)?.id ?? 'rando';
  }, [pickedPillId, sport]);

  const activePillLabel = useMemo(
    () =>
      catalogSlug
        ? activeProfile.identity.labelFr
        : QUICK_SPORT_PILLS.find((p) => p.id === activePillId)?.label ?? 'Sortie',
    [activePillId, activeProfile.identity.labelFr, catalogSlug],
  );

  const hasRoute = Boolean(routeName) || routeStatus === 'loading' || routeStatus === 'ready' || routeStatus === 'unavailable';
  const isGpsDenied = locationPermission === 'denied';

  const cardStyle: React.CSSProperties = {
    borderRadius: 18,
    padding: '11px 12px',
    background: 'rgba(255, 255, 255, 0.78)',
    border: '0.5px solid rgba(23, 64, 44, 0.12)',
    boxShadow: 'inset 0 1px 0 rgba(255, 255, 255, 0.92), 0 4px 14px rgba(16, 32, 25, 0.05)',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'space-between',
    gap: 8,
    minWidth: 0,
    textAlign: 'left',
  };

  return (
    <StackSlideView stackKey={`pre-flight-${sport}`}>
      <div
        data-testid="xp20-preflight-sheet"
        style={{
          display: 'flex',
          flexDirection: 'column',
          height: '100%',
          minHeight: 0,
        }}
      >
        {/* Sticky Liquid Glass header */}
        <div
          style={{
            position: 'sticky',
            top: 0,
            zIndex: 6,
            padding: '4px 12px 10px',
            background: '#F9F8F4',
            borderBottom: '0.5px solid rgba(23, 64, 44, 0.08)',
            display: 'flex',
            flexDirection: 'column',
            gap: 10,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
            <button
              type="button"
              className="xp20-close-pill"
              onClick={onBack}
              aria-label="Retour au choix du sport"
            >
              <ArrowLeft size={15} aria-hidden="true" />
            </button>

            <div style={{ minWidth: 0, flex: '1 1 auto' }}>
              <strong
                style={{
                  display: 'block',
                  fontSize: 15,
                  fontWeight: 800,
                  color: '#172B24',
                  lineHeight: 1.15,
                }}
              >
                Préparation · {activePillLabel}
              </strong>
              <span
                style={{
                  display: 'block',
                  fontSize: 11,
                  fontWeight: 600,
                  color: '#56665D',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                Vérification rapide avant départ
              </span>
            </div>

            <button
              type="button"
              className="xp20-close-pill"
              onClick={onClose}
              aria-label="Fermer"
            >
              <X size={15} aria-hidden="true" />
            </button>
          </div>

          {/* Horizontal compact sport pill selector */}
          <div
            role="radiogroup"
            aria-label="Choisir une activité"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              overflowX: 'auto',
              paddingBottom: 2,
              scrollbarWidth: 'none',
            }}
          >
            {QUICK_SPORT_PILLS.map((pill) => {
              const selected = pill.id === activePillId;
              return (
                <button
                  key={pill.id}
                  type="button"
                  role="radio"
                  className="xp20-tactile"
                  aria-checked={selected}
                  onClick={() => {
                    setPickedPillId(pill.id);
                    onChangeSport(pill.sport);
                  }}
                  style={{
                    flex: 'none',
                    minHeight: 44,
                    padding: '0 13px',
                    borderRadius: 999,
                    border: selected
                      ? '0.5px solid rgba(23, 64, 44, 0.35)'
                      : '0.5px solid rgba(23, 64, 44, 0.14)',
                    background: selected
                      ? 'linear-gradient(180deg, #1f543a, #17402c)'
                      : 'rgba(255, 255, 255, 0.84)',
                    color: selected ? '#FBFAF6' : '#172B24',
                    fontSize: 12,
                    fontWeight: 700,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 5,
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                    boxShadow: selected ? '0 4px 10px rgba(23, 64, 44, 0.2)' : 'none',
                  }}
                >
                  {pill.icon}
                  <span>{pill.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Scrollable body */}
        <div
          style={{
            flex: '1 1 auto',
            minHeight: 0,
            overflowY: 'auto',
            padding: '12px 12px 16px',
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
          }}
        >
          {/* Trace / Destination card */}
          <div
            className="club-glass-card"
            style={{
              borderRadius: 20,
              padding: '12px 13px',
              background: hasRoute
                ? 'linear-gradient(180deg, rgba(255, 255, 255, 0.92), rgba(244, 248, 243, 0.88))'
                : 'rgba(255, 255, 255, 0.78)',
              border: '0.5px solid rgba(23, 64, 44, 0.14)',
              display: 'flex',
              flexDirection: 'column',
              gap: 9,
            }}
          >
            {hasRoute ? (
              <>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 9, minWidth: 0 }}>
                    <span
                      aria-hidden="true"
                      style={{
                        width: 32,
                        height: 32,
                        borderRadius: 11,
                        background: 'rgba(23, 64, 44, 0.12)',
                        color: '#17402C',
                        display: 'grid',
                        placeItems: 'center',
                        flex: 'none',
                      }}
                    >
                      <Route size={16} />
                    </span>
                    <div style={{ minWidth: 0 }}>
                      <strong
                        style={{
                          display: 'block',
                          fontSize: 13.5,
                          fontWeight: 800,
                          color: '#172B24',
                          lineHeight: 1.25,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {routeName || 'Itinéraire sélectionné'}
                      </strong>
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          flexWrap: 'wrap',
                          gap: 8,
                          marginTop: 3,
                          fontSize: 11.5,
                          fontWeight: 700,
                          color: '#56665D',
                          fontVariantNumeric: 'tabular-nums',
                        }}
                      >
                        {routeDistanceKm !== null && Number.isFinite(routeDistanceKm) ? (
                          <span>{formatKm(routeDistanceKm)}</span>
                        ) : null}
                        {routeElevGainM !== null && Number.isFinite(routeElevGainM) ? (
                          <span>+{Math.round(routeElevGainM)} m D+</span>
                        ) : null}
                        {routeStatus === 'loading' ? (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: '#17402C' }}>
                            <Loader2 size={11} aria-hidden="true" />
                            Chargement…
                          </span>
                        ) : routeStatus === 'ready' ? (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, color: '#2E7D4F' }}>
                            <Check size={11} aria-hidden="true" />
                            Guidage prêt
                          </span>
                        ) : routeStatus === 'unavailable' ? (
                          <span style={{ color: '#B45309' }}>Géométrie indisponible</span>
                        ) : null}
                      </div>
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                  {routeStatus === 'unavailable' && onRetryRoute ? (
                    <button
                      type="button"
                      onClick={onRetryRoute}
                      style={{
                        height: 28,
                        padding: '0 10px',
                        borderRadius: 999,
                        border: '0.5px solid rgba(180, 83, 9, 0.3)',
                        background: 'rgba(180, 83, 9, 0.1)',
                        color: '#92400E',
                        fontSize: 11.5,
                        fontWeight: 700,
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 5,
                        cursor: 'pointer',
                      }}
                    >
                      <RefreshCw size={11} aria-hidden="true" />
                      Réessayer
                    </button>
                  ) : null}

                  {onClearRoute ? (
                    <button
                      type="button"
                      onClick={onClearRoute}
                      style={{
                        height: 28,
                        padding: '0 10px',
                        borderRadius: 999,
                        border: '0.5px solid rgba(23, 64, 44, 0.16)',
                        background: 'rgba(255, 255, 255, 0.9)',
                        color: '#172B24',
                        fontSize: 11.5,
                        fontWeight: 700,
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 5,
                        cursor: 'pointer',
                      }}
                    >
                      <Compass size={11} aria-hidden="true" />
                      Mode libre
                    </button>
                  ) : null}
                </div>
              </>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span
                  aria-hidden="true"
                  style={{
                    width: 34,
                    height: 34,
                    borderRadius: 12,
                    background: 'rgba(150, 186, 142, 0.24)',
                    color: '#17402C',
                    display: 'grid',
                    placeItems: 'center',
                    flex: 'none',
                  }}
                >
                  <Compass size={17} />
                </span>
                <div style={{ minWidth: 0 }}>
                  <strong style={{ display: 'block', fontSize: 13.5, fontWeight: 800, color: '#172B24' }}>
                    Sortie libre
                  </strong>
                  <span style={{ display: 'block', marginTop: 1, fontSize: 11.5, fontWeight: 600, color: '#56665D' }}>
                    Trace enregistrée au fil de tes pas
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* 2x2 Terrain Readiness Liquid Glass Grid */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
              gap: 8,
            }}
          >
            {/* 1. GPS */}
            <div style={cardStyle}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11.5, fontWeight: 700, color: '#56665D' }}>
                  <Radio size={13} color={gpsReady ? '#2E7D4F' : '#B45309'} aria-hidden="true" />
                  GPS
                </span>
                <span
                  className={gpsReady ? 'xp20-pulse-dot' : undefined}
                  aria-hidden="true"
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: 999,
                    background: gpsReady ? '#2E7D4F' : isGpsDenied ? '#B91C1C' : '#D97706',
                    color: gpsReady ? '#2E7D4F' : isGpsDenied ? '#B91C1C' : '#D97706',
                  }}
                />
              </div>

              {gpsReady ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 5, color: '#17402C', fontSize: 13, fontWeight: 800 }}>
                  <Check size={14} color="#2E7D4F" aria-hidden="true" />
                  Signal prêt
                </div>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: isGpsDenied ? '#991B1B' : '#92400E' }}>
                    {isGpsDenied ? 'Refusé' : 'Inactif'}
                  </span>
                  {onRequestLocation ? (
                    <button
                      type="button"
                      onClick={onRequestLocation}
                      style={{
                        height: 26,
                        padding: '0 9px',
                        borderRadius: 999,
                        border: 0,
                        background: '#17402C',
                        color: '#FBFAF6',
                        fontSize: 11,
                        fontWeight: 700,
                        cursor: 'pointer',
                        flex: 'none',
                      }}
                    >
                      Autoriser
                    </button>
                  ) : null}
                </div>
              )}
            </div>

            {/* 2. Sac / Kit */}
            {onOpenKitPicker ? (
              <button
                type="button"
                onClick={onOpenKitPicker}
                style={{
                  ...cardStyle,
                  cursor: 'pointer',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', gap: 6 }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11.5, fontWeight: 700, color: '#56665D' }}>
                    <Backpack size={13} color="#17402C" aria-hidden="true" />
                    Sac / Kit
                  </span>
                  <ChevronRight size={13} color="#56665D" aria-hidden="true" />
                </div>
                <div style={{ minWidth: 0, width: '100%' }}>
                  <strong
                    style={{
                      display: 'block',
                      fontSize: 12.5,
                      fontWeight: 800,
                      color: '#172B24',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {kitLabel || 'Choisir un kit'}
                  </strong>
                  <span style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#56665D', fontVariantNumeric: 'tabular-nums' }}>
                    {packWeightKg !== null && Number.isFinite(packWeightKg)
                      ? formatWeightKg(packWeightKg)
                      : 'Poids non défini'}
                  </span>
                </div>
              </button>
            ) : (
              <div style={cardStyle}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11.5, fontWeight: 700, color: '#56665D' }}>
                  <Backpack size={13} color="#17402C" aria-hidden="true" />
                  Sac / Kit
                </span>
                <div style={{ minWidth: 0 }}>
                  <strong
                    style={{
                      display: 'block',
                      fontSize: 12.5,
                      fontWeight: 800,
                      color: '#172B24',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {kitLabel || 'Équipement libre'}
                  </strong>
                  <span style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#56665D', fontVariantNumeric: 'tabular-nums' }}>
                    {packWeightKg !== null && Number.isFinite(packWeightKg)
                      ? formatWeightKg(packWeightKg)
                      : 'Prêt à partir'}
                  </span>
                </div>
              </div>
            )}

            {/* 3. Météo & Jour */}
            <div style={cardStyle}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11.5, fontWeight: 700, color: '#56665D' }}>
                <CloudSun size={13} color="#17402C" aria-hidden="true" />
                Météo &amp; Jour
              </span>
              <div style={{ minWidth: 0 }}>
                <strong
                  style={{
                    display: 'block',
                    fontSize: 12.5,
                    fontWeight: 800,
                    color: '#172B24',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {weatherSummary || 'Conditions locales'}
                </strong>
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 4,
                    marginTop: 2,
                    fontSize: 11,
                    fontWeight: 700,
                    color: sunsetHm ? '#92400E' : '#56665D',
                    fontVariantNumeric: 'tabular-nums',
                  }}
                >
                  <Sunset size={11} aria-hidden="true" />
                  {sunsetHm ? `Nuit ${sunsetHm}` : 'Vérifier la lumière'}
                </span>
              </div>
            </div>

            {/* 4. Hors-ligne */}
            <div style={cardStyle}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11.5, fontWeight: 700, color: '#56665D' }}>
                <WifiOff size={13} color={offlineReady ? '#2E7D4F' : '#56665D'} aria-hidden="true" />
                Hors-ligne
              </span>
              {offlineReady ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 5, color: '#17402C', fontSize: 12.5, fontWeight: 800 }}>
                  <Check size={14} color="#2E7D4F" aria-hidden="true" />
                  Secteur en cache
                </div>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
                  <span style={{ fontSize: 11.5, fontWeight: 700, color: '#56665D' }}>Non mis en cache</span>
                  {onDownloadOffline ? (
                    <button
                      type="button"
                      onClick={onDownloadOffline}
                      style={{
                        height: 26,
                        padding: '0 8px',
                        borderRadius: 999,
                        border: '0.5px solid rgba(23, 64, 44, 0.2)',
                        background: 'rgba(23, 64, 44, 0.08)',
                        color: '#17402C',
                        fontSize: 10.5,
                        fontWeight: 700,
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 4,
                        cursor: 'pointer',
                        flex: 'none',
                      }}
                    >
                      <Download size={11} aria-hidden="true" />
                      Télécharger
                    </button>
                  ) : null}
                </div>
              )}
            </div>
          </div>

          {/* 1-tap Progressive Disclosure -> Expert Pre-Flight Sub-Drawer */}
          <button
            type="button"
            className="xp20-card-press"
            onClick={() => setExpertOpen(true)}
            data-testid="xp20-preflight-expert-trigger"
            style={{
              minHeight: 46,
              padding: '0 14px',
              borderRadius: 18,
              border: '0.5px solid rgba(23, 64, 44, 0.12)',
              background: 'rgba(255, 255, 255, 0.88)',
              boxShadow: 'inset 0 1px 0 rgba(255, 255, 255, 0.95), 0 4px 12px rgba(16, 32, 25, 0.04)',
              color: '#172B24',
              fontSize: 13,
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 8,
              cursor: 'pointer',
            }}
          >
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 9 }}>
              <span
                aria-hidden="true"
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: 9,
                  background: 'rgba(23, 64, 44, 0.09)',
                  color: '#17402C',
                  display: 'grid',
                  placeItems: 'center',
                }}
              >
                <SlidersHorizontal size={14} />
              </span>
              <span>Réglages experts · BLE, Baro, Beacon, EPZ</span>
            </span>
            <ChevronRight size={15} color="#56665D" className="xp20-chevron-nudge" aria-hidden="true" />
          </button>
        </div>

        {expertOpen ? (
          <Suspense fallback={null}>
            <LazyPreFlightExpertSubDrawer
              open={expertOpen}
              onOpenChange={setExpertOpen}
              profile={activeProfile}
              settings={expertSettings}
              onChangeSettings={(patch) =>
                setExpertSettings((prev) => ({ ...prev, ...patch }))
              }
              offlineReady={offlineReady}
              onDownloadOffline={onDownloadOffline}
            />
          </Suspense>
        ) : null}

        {/* Sticky bottom CTA bar — toujours visible au bas du tiroir */}
        <div
          style={{
            position: 'sticky',
            bottom: 0,
            zIndex: 8,
            flex: 'none',
            padding: '10px 12px calc(var(--safe-bottom, 0px) + 12px)',
            borderTop: '0.5px solid rgba(23, 64, 44, 0.1)',
            background: '#FAF9F5',
            boxShadow: '0 -8px 20px rgba(16, 32, 25, 0.06)',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <button
            type="button"
            className="xp20-tactile"
            onClick={() => onLaunch({ express: false })}
            style={{
              flex: '1 1 auto',
              height: 48,
              borderRadius: 999,
              border: 0,
              background: 'linear-gradient(180deg, #1f543a, #17402c)',
              color: '#FBFAF6',
              fontSize: 14,
              fontWeight: 800,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 7,
              cursor: 'pointer',
              boxShadow: '0 10px 22px rgba(23, 64, 44, 0.24)',
            }}
          >
            <Play size={15} fill="currentColor" aria-hidden="true" />
            <span>Lancer la sortie</span>
          </button>

          <button
            type="button"
            className="xp20-tactile"
            onClick={() => onLaunch({ express: true })}
            aria-label="Lancement Express sans compte à rebours"
            title="Démarrer immédiatement sans compte à rebours"
            style={{
              flex: '0 0 auto',
              height: 48,
              padding: '0 15px',
              borderRadius: 999,
              border: '0.5px solid rgba(23, 64, 44, 0.2)',
              background: 'rgba(255, 255, 255, 0.92)',
              color: '#17402C',
              fontSize: 13,
              fontWeight: 800,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 5,
              cursor: 'pointer',
              whiteSpace: 'nowrap',
            }}
          >
            <Zap size={14} aria-hidden="true" />
            <span>Express</span>
          </button>
        </div>
      </div>
    </StackSlideView>
  );
}

export default ExplorerPreFlightSheet;
