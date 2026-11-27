'use client';

import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  Activity,
  Anchor,
  Bike,
  Bookmark,
  CloudDownload,
  CloudRain,
  Droplets,
  Flame,
  Footprints,
  HardDrive,
  Layers,
  Leaf,
  Map as MapIcon,
  MapPin,
  Moon,
  Mountain,
  Plane,
  Route,
  ShieldAlert,
  SlidersHorizontal,
  Sparkles,
  Tent,
  Users,
  Waves,
  X,
} from 'lucide-react';
import type { SlotLens } from '@/components/compte/drawer/SlotShell';
import {
  AnimatedNumber,
  CARNET_SPRING,
  StaggerCard,
  StaggerList,
} from '@/components/carnet/v2/CarnetDrawerMotion';
import { ClubEmptyCard } from '@/components/clubs/drawer/ClubSharedUi';
import {
  MAX_SIMULTANEOUS_ANALYTICAL_RASTERS,
  type UnifiedLayerCategory,
  type UnifiedLayerItem,
} from '../../types/encyclopedia';
import type { AtomicExplorerPresetId, ExplorerPresetId } from '../../state/presets';

export { MAX_SIMULTANEOUS_ANALYTICAL_RASTERS, type UnifiedLayerCategory, type UnifiedLayerItem };

/* ── Category 2 Lens Definitions ──────────────────────────────────────────── */

export const LAYERS_CATEGORY_LENSES: SlotLens[] = [
  { id: 'presets', label: 'Pré-réglages', icon: <Sparkles size={15} aria-hidden="true" /> },
  { id: 'overlays', label: 'Calques', icon: <SlidersHorizontal size={15} aria-hidden="true" /> },
  { id: 'offline', label: 'Hors-ligne', icon: <CloudDownload size={15} aria-hidden="true" /> },
];

/* ── Lens 2.0: LayersPresetsLens ──────────────────────────────────────────── */

interface AtomicPresetTileMeta {
  readonly id: AtomicExplorerPresetId;
  readonly label: string;
  readonly subtitle: string;
  readonly icon: React.ReactNode;
}

const ATOMIC_PRESET_TILES: readonly AtomicPresetTileMeta[] = [
  { id: 'clean', label: 'Épuré', subtitle: 'Fond topo calme', icon: <MapIcon size={17} aria-hidden="true" /> },
  { id: 'hiking', label: 'Rando', subtitle: 'Sommets & sentiers', icon: <Mountain size={17} aria-hidden="true" /> },
  { id: 'trail', label: 'Trail', subtitle: 'Pentes & radar', icon: <Footprints size={17} aria-hidden="true" /> },
  { id: 'mtb', label: 'VTT', subtitle: 'Singles & ateliers', icon: <Bike size={17} aria-hidden="true" /> },
  { id: 'bivouac', label: 'Bivouac', subtitle: 'Abris & ciel noir', icon: <Tent size={17} aria-hidden="true" /> },
  { id: 'nautical', label: 'Nautique', subtitle: 'Rivières & balises', icon: <Waves size={17} aria-hidden="true" /> },
  { id: 'safety', label: 'Sécurité', subtitle: 'Alertes & pentes', icon: <ShieldAlert size={17} aria-hidden="true" /> },
  { id: 'pokedex', label: 'Pokédex', subtitle: 'Faune & flore', icon: <Leaf size={17} aria-hidden="true" /> },
  { id: 'community', label: 'Communauté', subtitle: 'Clubs & carnets', icon: <Users size={17} aria-hidden="true" /> },
];

export interface LayersPresetsLensProps {
  activePreset: ExplorerPresetId;
  onSelectPreset: (presetId: AtomicExplorerPresetId) => void;
}

export function LayersPresetsLens({
  activePreset,
  onSelectPreset,
}: LayersPresetsLensProps) {
  return (
    <StaggerList
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
        gap: 8,
        paddingBottom: 112,
      }}
    >
      {ATOMIC_PRESET_TILES.map((preset) => {
        const isActive = activePreset === preset.id;
        return (
          <StaggerCard
            key={preset.id}
            asButton
            className={isActive ? undefined : 'club-glass-card'}
            onClick={() => onSelectPreset(preset.id)}
            style={{
              height: 68,
              borderRadius: 18,
              border: 0,
              padding: '0 12px',
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              textAlign: 'left',
              cursor: 'pointer',
              minWidth: 0,
              background: isActive
                ? 'linear-gradient(180deg, #1f543a, #17402c)'
                : 'rgba(255, 255, 255, 0.78)',
              color: isActive ? '#FBFAF6' : '#172B24',
              boxShadow: isActive
                ? 'inset 0 1px 0 rgba(255, 255, 255, 0.22), 0 6px 16px rgba(23, 64, 44, 0.24)'
                : 'inset 0 0 0 0.5px rgba(27, 67, 50, 0.12)',
            }}
          >
            <span
              aria-hidden="true"
              style={{
                width: 34,
                height: 34,
                borderRadius: 999,
                flex: 'none',
                display: 'grid',
                placeItems: 'center',
                background: isActive ? 'rgba(255, 255, 255, 0.18)' : 'rgba(150, 186, 142, 0.26)',
                color: isActive ? '#FBFAF6' : '#17402C',
              }}
            >
              {preset.icon}
            </span>
            <span style={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: 1 }}>
              <span
                style={{
                  fontSize: 13,
                  fontWeight: 700,
                  lineHeight: 1.15,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {preset.label}
              </span>
              <span
                style={{
                  fontSize: 10.5,
                  fontWeight: 600,
                  lineHeight: 1.2,
                  color: isActive ? 'rgba(251, 250, 246, 0.8)' : '#56665D',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {preset.subtitle}
              </span>
            </span>
          </StaggerCard>
        );
      })}
    </StaggerList>
  );
}

/* ── Lens 2.1: LayersOverlaysLens ─────────────────────────────────────────── */

const OVERLAY_GROUPS: readonly {
  readonly id: UnifiedLayerCategory;
  readonly label: string;
  readonly icon: React.ReactNode;
}[] = [
  { id: 'outdoor', label: 'Terrain', icon: <Mountain size={12} aria-hidden="true" /> },
  { id: 'safety_live', label: 'Direct', icon: <ShieldAlert size={12} aria-hidden="true" /> },
  { id: 'pokedex', label: 'Nature', icon: <Leaf size={12} aria-hidden="true" /> },
  { id: 'community', label: 'Social', icon: <Users size={12} aria-hidden="true" /> },
];

const SHORT_LAYER_LABELS: Readonly<Record<string, string>> = {
  trails_outdoor: 'Sentiers',
  routes: 'Sentiers',
  surfaceLayer: 'Surfaces',
  bikePois: 'Services vélo',
  slope_angle_raster: 'Pentes >30°',
  avalancheSlope: 'Pentes >30°',
  light_pollution_raster: 'Ciel noir',
  lightPollution: 'Ciel noir',
  seamarks: 'OpenSeaMap',
  openseamap: 'OpenSeaMap',
  waterwaysNav: 'Rivières',
  weather_radar_raster: 'Radar pluie',
  radar: 'Radar pluie',
  rainRadar: 'Radar pluie',
  wildfires_live: 'Feux actifs',
  hazardFires: 'Feux actifs',
  hydrology_flood_live: 'Crues',
  hazardFloods: 'Crues',
  hazardSeismic: 'Séismes',
  airspaceAircraft: 'Aérien',
  pokedex_observations: 'Faune & Flore',
  pokedexSpecies: 'Faune & Flore',
  pokedex_protected_zones: 'Réserves',
  biodiversityDensity: 'Densité GBIF',
  pokedexGbif: 'Densité GBIF',
  savedPlaces: 'Favoris',
  communityHeatmap: 'Fréquentation',
  personalHeatmap: 'Ma heatmap',
  community_clubs_outings: 'Clubs',
  community_heatmap: 'Heatmap',
  socialCarnets: 'Carnets',
  socialClubs: 'Clubs',
  socialStories: 'Stories',
  socialFriends: 'Amis',
  socialBottles: 'Bouteilles',
};

function shortOverlayLabel(item: UnifiedLayerItem): string {
  const mapped = SHORT_LAYER_LABELS[item.id];
  if (mapped) return mapped;
  const words = item.label.trim().split(/\s+/);
  return words.slice(0, 2).join(' ');
}

function overlayIcon(item: UnifiedLayerItem) {
  const id = item.id.toLowerCase();
  if (id.includes('bike')) return <Bike size={15} aria-hidden="true" />;
  if (id.includes('surface')) return <Layers size={15} aria-hidden="true" />;
  if (id.includes('saved')) return <Bookmark size={15} aria-hidden="true" />;
  if (id.includes('personalheatmap')) return <Footprints size={15} aria-hidden="true" />;
  if (id.includes('heatmap')) return <Flame size={15} aria-hidden="true" />;
  if (id.includes('trail') || id.includes('route')) return <Route size={15} aria-hidden="true" />;
  if (id.includes('slope') || id.includes('avalanche')) return <Mountain size={15} aria-hidden="true" />;
  if (id.includes('light')) return <Moon size={15} aria-hidden="true" />;
  if (id.includes('sea')) return <Anchor size={15} aria-hidden="true" />;
  if (id.includes('waterway')) return <Waves size={15} aria-hidden="true" />;
  if (id.includes('radar') || id.includes('rain')) return <CloudRain size={15} aria-hidden="true" />;
  if (id.includes('fire')) return <Flame size={15} aria-hidden="true" />;
  if (id.includes('flood') || id.includes('hydro')) return <Droplets size={15} aria-hidden="true" />;
  if (id.includes('seismic')) return <Activity size={15} aria-hidden="true" />;
  if (id.includes('airspace')) return <Plane size={15} aria-hidden="true" />;
  if (id.includes('pokedex') || id.includes('biodiv')) return <Leaf size={15} aria-hidden="true" />;
  if (id.includes('community') || id.includes('social')) return <Users size={15} aria-hidden="true" />;
  return <Layers size={15} aria-hidden="true" />;
}

function compactFreshness(
  updatedAtMs: number | null | undefined,
  nowMs: number,
  staleThresholdMin = 45,
): { text: string; isStale: boolean } | null {
  if (updatedAtMs == null || !Number.isFinite(updatedAtMs)) return null;
  const diffMin = Math.max(0, Math.round((nowMs - updatedAtMs) / 60_000));
  const text = diffMin < 60 ? `${diffMin}m` : `${Math.round(diffMin / 60)}h`;
  return { text, isStale: diffMin >= staleThresholdMin };
}

export interface LayersOverlaysLensProps {
  layers: readonly UnifiedLayerItem[];
  nowMs?: number;
  maxAnalyticalRasters?: number;
  onToggleLayer: (layerId: string, nextEnabled: boolean) => void;
}

export function LayersOverlaysLens({
  layers,
  nowMs,
  maxAnalyticalRasters = MAX_SIMULTANEOUS_ANALYTICAL_RASTERS,
  onToggleLayer,
}: LayersOverlaysLensProps) {
  const effectiveNowMs = nowMs ?? Date.now();

  const dedupedLayers = useMemo(() => {
    const seen = new Set<string>();
    return layers.filter((item) => {
      if (seen.has(item.id)) return false;
      seen.add(item.id);
      return true;
    });
  }, [layers]);

  const activeRasterCount = useMemo(
    () => dedupedLayers.filter((l) => l.isAnalyticalRaster && l.enabled).length,
    [dedupedLayers],
  );

  const grouped = useMemo(
    () =>
      OVERLAY_GROUPS.map((group) => ({
        ...group,
        items: dedupedLayers.filter((l) => l.category === group.id),
      })).filter((group) => group.items.length > 0),
    [dedupedLayers],
  );

  return (
    <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', gap: 12, paddingBottom: 112 }}>
      {/* Tiny floating raster badge ONLY when analytical rasters are active */}
      {activeRasterCount > 0 ? (
        <div
          aria-label={`${activeRasterCount} sur ${maxAnalyticalRasters} rasters actifs`}
          style={{
            position: 'sticky',
            top: 0,
            zIndex: 5,
            alignSelf: 'flex-end',
            marginBottom: -4,
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
            height: 24,
            padding: '0 9px',
            borderRadius: 999,
            background:
              activeRasterCount >= maxAnalyticalRasters
                ? '#17402C'
                : 'rgba(255, 255, 255, 0.92)',
            color: activeRasterCount >= maxAnalyticalRasters ? '#FBFAF6' : '#17402C',
            boxShadow:
              'inset 0 0 0 0.5px rgba(27, 67, 50, 0.16), 0 3px 10px rgba(23, 43, 36, 0.1)',
            fontSize: 11,
            fontWeight: 800,
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          <Layers size={11} aria-hidden="true" />
          <span>
            {activeRasterCount}/{maxAnalyticalRasters} calques lourds
          </span>
        </div>
      ) : null}

      {grouped.map((group) => (
        <div key={group.id} style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              color: '#56665D',
              fontSize: 11.5,
              fontWeight: 700,
              padding: '0 2px',
            }}
          >
            <span style={{ display: 'inline-flex', color: '#17402C' }}>{group.icon}</span>
            <span>{group.label}</span>
            <span
              aria-hidden="true"
              style={{
                flex: '1 1 auto',
                height: 1,
                background: 'rgba(23, 64, 44, 0.08)',
              }}
            />
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
              gap: 8,
            }}
          >
            {group.items.map((item) => {
              const isActive = item.enabled;
              const capped =
                Boolean(item.isAnalyticalRaster) &&
                !isActive &&
                activeRasterCount >= maxAnalyticalRasters;
              const fresh = item.isLive
                ? compactFreshness(item.updatedAtMs, effectiveNowMs, item.staleThresholdMin)
                : null;

              return (
                <button
                  key={item.id}
                  type="button"
                  role="switch"
                  aria-checked={isActive}
                  disabled={capped}
                  onClick={() => {
                    if (!capped) onToggleLayer(item.id, !isActive);
                  }}
                  className={isActive ? undefined : 'club-glass-card'}
                  style={{
                    minHeight: 54,
                    borderRadius: 16,
                    border: 0,
                    padding: '8px 10px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    textAlign: 'left',
                    cursor: capped ? 'not-allowed' : 'pointer',
                    opacity: capped ? 0.48 : 1,
                    minWidth: 0,
                    background: isActive
                      ? 'linear-gradient(180deg, #1f543a, #17402c)'
                      : 'rgba(255, 255, 255, 0.78)',
                    color: isActive ? '#FBFAF6' : '#172B24',
                    boxShadow: isActive
                      ? 'inset 0 1px 0 rgba(255, 255, 255, 0.22), 0 4px 12px rgba(23, 64, 44, 0.2)'
                      : 'inset 0 0 0 0.5px rgba(27, 67, 50, 0.12)',
                  }}
                >
                  <span
                    aria-hidden="true"
                    style={{
                      width: 30,
                      height: 30,
                      borderRadius: 999,
                      flex: 'none',
                      display: 'grid',
                      placeItems: 'center',
                      background: isActive
                        ? 'rgba(255, 255, 255, 0.18)'
                        : 'rgba(150, 186, 142, 0.24)',
                      color: isActive ? '#FBFAF6' : '#17402C',
                    }}
                  >
                    {overlayIcon(item)}
                  </span>

                  <div
                    style={{
                      flex: '1 1 auto',
                      minWidth: 0,
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 2,
                    }}
                  >
                    <span
                      style={{
                        fontSize: 12,
                        fontWeight: 700,
                        lineHeight: 1.15,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {shortOverlayLabel(item)}
                    </span>

                    {fresh ? (
                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 4,
                          fontSize: 10,
                          fontWeight: 600,
                          fontVariantNumeric: 'tabular-nums',
                          color: isActive ? 'rgba(251, 250, 246, 0.82)' : '#56665D',
                        }}
                      >
                        <span
                          aria-hidden="true"
                          style={{
                            width: 6,
                            height: 6,
                            borderRadius: 999,
                            background: fresh.isStale
                              ? '#B98A2E'
                              : isActive
                                ? '#96BA8E'
                                : '#3D7A52',
                          }}
                        />
                        {fresh.text}
                      </span>
                    ) : null}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

/* ── Lens 2.2: LayersOfflineLens ──────────────────────────────────────────── */

export interface OfflinePackItem {
  id: string;
  name: string;
  sizeMb: number;
  tilesCount?: number;
  savedAt?: number;
  downloading?: boolean;
  progressPct?: number | null;
}

export interface LayersOfflineLensProps {
  packs: readonly OfflinePackItem[];
  activeDownload?: {
    name?: string;
    done: number;
    total: number;
    bytes: number;
  } | null;
  currentSectorName?: string;
  estimatedSizeMb?: number;
  onDownloadCurrentSector?: () => void;
  /**
   * True when the host drawer already renders a floating "Télécharger" pill,
   * preventing duplicate download triggers inside the lens.
   */
  hasFloatingDownloadTrigger?: boolean;
  onDeletePack?: (packId: string) => void;
  onFocusPack?: (packId: string) => void;
}

export function LayersOfflineLens({
  packs,
  activeDownload = null,
  currentSectorName,
  estimatedSizeMb = 18,
  onDownloadCurrentSector,
  hasFloatingDownloadTrigger = true,
  onDeletePack,
  onFocusPack,
}: LayersOfflineLensProps) {
  const safeEstimatedMb =
    Number.isFinite(estimatedSizeMb) && estimatedSizeMb > 0
      ? Number(estimatedSizeMb.toFixed(1))
      : 18;
  const activePct = activeDownload
    ? Math.max(
        0,
        Math.min(100, Math.round((Math.max(0, activeDownload.done) / Math.max(1, activeDownload.total)) * 100)),
      )
    : 0;
  const activeMb = activeDownload
    ? Number((Math.max(0, activeDownload.bytes) / (1024 * 1024)).toFixed(1))
    : 0;

  if (packs.length === 0 && !activeDownload) {
    if (onDownloadCurrentSector || currentSectorName) {
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, paddingBottom: 112 }}>
          <div
            className="club-glass-card"
            style={{
              padding: 14,
              borderRadius: 20,
              display: 'flex',
              flexDirection: 'column',
              gap: 10,
              background:
                'linear-gradient(160deg, rgba(255, 255, 255, 0.94), rgba(242, 248, 243, 0.9))',
              border: '0.5px solid rgba(23, 64, 44, 0.14)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span
                aria-hidden="true"
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 14,
                  flex: 'none',
                  background: 'rgba(23, 64, 44, 0.1)',
                  color: '#17402C',
                  display: 'grid',
                  placeItems: 'center',
                }}
              >
                <CloudDownload size={19} />
              </span>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#56665D' }}>
                  Secteur visible · ~{safeEstimatedMb} Mo
                </div>
                <strong
                  style={{
                    display: 'block',
                    fontSize: 14,
                    fontWeight: 800,
                    color: '#172B24',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {currentSectorName || 'Zone affichée'}
                </strong>
              </div>
            </div>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {['Fond topo & relief', 'Sentiers & GR', 'Eau & refuges'].map((chip) => (
                <span
                  key={chip}
                  style={{
                    height: 22,
                    padding: '0 8px',
                    borderRadius: 999,
                    background: 'rgba(23, 64, 44, 0.08)',
                    color: '#17402C',
                    fontSize: 10.5,
                    fontWeight: 700,
                    display: 'inline-flex',
                    alignItems: 'center',
                  }}
                >
                  {chip}
                </span>
              ))}
            </div>

            {onDownloadCurrentSector && !hasFloatingDownloadTrigger ? (
              <button
                type="button"
                onClick={onDownloadCurrentSector}
                style={{
                  height: 40,
                  borderRadius: 999,
                  border: 0,
                  background: 'linear-gradient(180deg, #1f543a, #17402c)',
                  color: '#FBFAF6',
                  fontSize: 13,
                  fontWeight: 700,
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 7,
                  cursor: 'pointer',
                  boxShadow: '0 6px 16px rgba(23, 64, 44, 0.22)',
                }}
              >
                <CloudDownload size={15} aria-hidden="true" />
                <span>Télécharger ce secteur (~{safeEstimatedMb} Mo)</span>
              </button>
            ) : (
              <p
                style={{
                  margin: 0,
                  fontSize: 11.5,
                  fontWeight: 600,
                  color: '#56665D',
                  lineHeight: 1.35,
                }}
              >
                Secteur prêt à être enregistré hors-ligne (~{safeEstimatedMb} Mo).
              </p>
            )}
          </div>
        </div>
      );
    }

    return (
      <div style={{ paddingBottom: 112 }}>
        <ClubEmptyCard
          icon={<CloudDownload size={20} color="#17402C" aria-hidden="true" />}
          title="Aucune zone hors-ligne"
          description="Téléchargez la zone affichée pour naviguer sans réseau."
        />
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, paddingBottom: 112 }}>
      {activeDownload ? (
        <div
          className="club-glass-card"
          style={{
            padding: 12,
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 9, minWidth: 0 }}>
              <span
                aria-hidden="true"
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: 999,
                  background: 'rgba(150, 186, 142, 0.28)',
                  color: '#17402C',
                  display: 'grid',
                  placeItems: 'center',
                  flex: 'none',
                }}
              >
                <CloudDownload size={16} />
              </span>
              <div style={{ minWidth: 0 }}>
                <strong
                  style={{
                    display: 'block',
                    fontSize: 13,
                    fontWeight: 700,
                    color: '#172B24',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {activeDownload.name || 'Zone en cours'}
                </strong>
                <span
                  style={{
                    fontSize: 11.5,
                    color: '#56665D',
                    fontVariantNumeric: 'tabular-nums',
                  }}
                >
                  <AnimatedNumber value={activeMb} suffix=" Mo" maximumFractionDigits={1} />
                </span>
              </div>
            </div>

            <strong
              style={{
                fontSize: 12.5,
                fontWeight: 800,
                color: '#17402C',
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              <AnimatedNumber value={activePct} suffix="%" />
            </strong>
          </div>

          <div
            style={{
              width: '100%',
              height: 5,
              borderRadius: 999,
              background: 'rgba(23, 43, 36, 0.08)',
              overflow: 'hidden',
            }}
          >
            <motion.div
              aria-hidden="true"
              initial={{ width: 0 }}
              animate={{ width: `${activePct}%` }}
              transition={CARNET_SPRING}
              style={{ height: '100%', borderRadius: 999, background: '#17402C' }}
            />
          </div>
        </div>
      ) : null}

      {packs.map((pack) => {
        const pct =
          pack.downloading && typeof pack.progressPct === 'number' && Number.isFinite(pack.progressPct)
            ? Math.max(0, Math.min(100, Math.round(pack.progressPct)))
            : null;
        const safeSizeMb =
          Number.isFinite(pack.sizeMb) && pack.sizeMb >= 0
            ? Number(pack.sizeMb.toFixed(1))
            : 0;
        const canFocus = Boolean(onFocusPack) && !pack.downloading;
        return (
          <div
            key={pack.id}
            className="club-glass-card"
            style={{
              padding: 10,
              borderRadius: 18,
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
              <button
                type="button"
                onClick={() => onFocusPack?.(pack.id)}
                aria-label={canFocus ? `Centrer la carte sur ${pack.name}` : pack.name}
                style={{
                  flex: '1 1 auto',
                  minWidth: 0,
                  border: 0,
                  padding: 0,
                  background: 'transparent',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  textAlign: 'left',
                  cursor: onFocusPack ? 'pointer' : 'default',
                }}
              >
                <span
                  aria-hidden="true"
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 999,
                    flex: 'none',
                    background: 'rgba(150, 186, 142, 0.26)',
                    color: '#17402C',
                    display: 'grid',
                    placeItems: 'center',
                  }}
                >
                  <HardDrive size={16} />
                </span>
                <div style={{ minWidth: 0, flex: '1 1 auto' }}>
                  <strong
                    style={{
                      display: 'block',
                      fontSize: 13,
                      fontWeight: 700,
                      color: '#172B24',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {pack.name}
                  </strong>
                  <span
                    style={{
                      fontSize: 11.5,
                      fontWeight: 600,
                      color: '#56665D',
                      fontVariantNumeric: 'tabular-nums',
                    }}
                  >
                    <AnimatedNumber value={safeSizeMb} suffix=" Mo" maximumFractionDigits={1} />
                    {typeof pack.tilesCount === 'number' && pack.tilesCount > 0
                      ? ` · ${pack.tilesCount} tuiles`
                      : ''}
                  </span>
                </div>

                {pct !== null ? (
                  <strong
                    style={{
                      flex: 'none',
                      fontSize: 12,
                      fontWeight: 800,
                      color: '#17402C',
                      fontVariantNumeric: 'tabular-nums',
                    }}
                  >
                    <AnimatedNumber value={pct} suffix="%" />
                  </strong>
                ) : (
                  <span
                    aria-hidden="true"
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: 999,
                      flex: 'none',
                      display: 'inline-grid',
                      placeItems: 'center',
                      background: canFocus
                        ? 'rgba(23, 64, 44, 0.1)'
                        : 'rgba(23, 64, 44, 0.05)',
                      color: '#17402C',
                    }}
                  >
                    <MapPin size={14} />
                  </span>
                )}
              </button>

              {onDeletePack ? (
                <button
                  type="button"
                  onClick={() => onDeletePack(pack.id)}
                  aria-label={`Supprimer ${pack.name}`}
                  style={{
                    width: 32,
                    height: 32,
                    flex: 'none',
                    borderRadius: 999,
                    border: '0.5px solid rgba(23, 64, 44, 0.14)',
                    background: 'rgba(255, 255, 255, 0.86)',
                    color: '#17402C',
                    display: 'inline-grid',
                    placeItems: 'center',
                    cursor: 'pointer',
                  }}
                >
                  <X size={15} aria-hidden="true" />
                </button>
              ) : null}
            </div>

            {pct !== null ? (
              <div
                style={{
                  width: '100%',
                  height: 5,
                  borderRadius: 999,
                  background: 'rgba(23, 43, 36, 0.08)',
                  overflow: 'hidden',
                }}
              >
                <motion.div
                  aria-hidden="true"
                  initial={{ width: 0 }}
                  animate={{ width: `${pct}%` }}
                  transition={CARNET_SPRING}
                  style={{ height: '100%', borderRadius: 999, background: '#17402C' }}
                />
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
