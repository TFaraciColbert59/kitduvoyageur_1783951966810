'use client';

import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  Compass,
  Flag,
  Globe2,
  Layers,
  MapPin,
  Minus,
  Mountain,
  Plus,
  Route,
} from 'lucide-react';
import type { MapModeConfig } from '@/features/compte/map/types';
import type { MapScale } from '@/features/compte/map/camera';
import type {
  Club3DBaseStyle,
  ClubOutdoorOverlayId,
  ClubOutdoorOverlaysState,
  ClubZoomStage,
} from './clubMapTypes';
import {
  CLUB_3D_STYLE_OPTIONS,
  CLUB_OUTDOOR_OVERLAY_OPTIONS,
} from './createClub3DStyle';

export function ClubMapAttribution({
  text,
  hasScrubber = false,
}: {
  text?: string;
  hasScrubber?: boolean;
}) {
  if (text) {
    return (
      <div
        className="lkdv-map-attribution"
        data-has-scrubber={hasScrubber ? 'true' : undefined}
      >
        <span>{text}</span>
      </div>
    );
  }
  return (
    <div
      className="lkdv-map-attribution"
      data-has-scrubber={hasScrubber ? 'true' : undefined}
    >
      <a href="https://www.esri.com" target="_blank" rel="noreferrer noopener">
        Powered by Esri
      </a>
      <span aria-hidden="true"> · </span>
      <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer noopener">
        © OpenStreetMap
      </a>
    </div>
  );
}

export interface ClubMapHudProps {
  config: MapModeConfig;
  scale: MapScale;
  onScale: (scale: MapScale) => void;
  onRecenter: () => void;
  onLayers: () => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  /** Le carnet garde les trois contrôles de la maquette (pas de calques). */
  showLayers?: boolean;
  /** Tiroir ouvert (fiche carnet) : contrôles masqués, retirés de l'ordre de tabulation. */
  hidden?: boolean;
  // --- Nouveaux contrôles 3D Club ---
  zoomStage?: ClubZoomStage;
  onZoomStage?: (stage: ClubZoomStage) => void;
  styleMode?: Club3DBaseStyle;
  onStyleMode?: (mode: Club3DBaseStyle) => void;
  outdoorOverlays?: ClubOutdoorOverlaysState;
  onToggleOutdoorOverlay?: (id: ClubOutdoorOverlayId) => void;
  bearing?: number;
  onResetNorth?: () => void;
  isFullscreen?: boolean;
  onToggleFullscreen?: () => void;
}

const LEGACY_SCALE_ITEMS = [
  { id: 'globe' as const, label: 'Vue globe', Icon: Globe2 },
  { id: 'massif' as const, label: 'Vue massif', Icon: Mountain },
  { id: 'sentier' as const, label: 'Vue sentier', Icon: Compass },
];

const CLUB_STAGE_ITEMS: Array<{
  id: ClubZoomStage;
  label: string;
  Icon: React.ComponentType<{ size?: number; strokeWidth?: number; 'aria-hidden'?: boolean }>;
}> = [
  { id: 'planetary', label: 'Vue planétaire', Icon: Globe2 },
  { id: 'country', label: 'Vue pays & massifs', Icon: Flag },
  { id: 'massif', label: 'Vue massif 3D', Icon: Mountain },
  { id: 'trail', label: 'Vue sentier 3D', Icon: Route },
];

const MAP_TRAIL_LEGEND_ITEMS: Array<{
  id: string;
  label: string;
  stroke: string;
  strokeWidth: number;
  dasharray?: string;
  casing?: string;
  buoy?: boolean;
}> = [
  { id: 'club-active', label: 'Sortie club active', stroke: '#c97b36', strokeWidth: 3.4, casing: '#ffffff' },
  { id: 'club-other', label: 'Autres sorties club', stroke: '#2f6b45', strokeWidth: 2, dasharray: 'none' },
  { id: 'gr', label: 'GR · Grandes Randonnées', stroke: '#9f4f44', strokeWidth: 2.2 },
  { id: 'pr', label: 'Sentiers GRP & PR', stroke: '#9c7848', strokeWidth: 1.7, dasharray: '4 3' },
  { id: 'mtb-cycle', label: 'VTT & Véloroutes', stroke: '#5d6b7c', strokeWidth: 1.7, dasharray: '6 2 1.5 2' },
  { id: 'slopes', label: 'Ski & Pistes hivernales', stroke: '#557399', strokeWidth: 1.7, dasharray: '2 2.5' },
  { id: 'nautical', label: 'Lacs navigables & Hydro', stroke: '#4c86a8', strokeWidth: 1.8, buoy: true },
];

/**
 * Contrôles Liquid Glass de la carte : sélecteur d'échelle (4 mondes sur la carte 3D Club),
 * sélecteur de 4 fonds 3D (Topo 3D, Ortho 20 cm, Plan IGN, Alpenglow),
 * boussole 3D dynamique, plein écran ⤢/⤡, recentrage et zoom.
 */
export function ClubMapHud({
  config,
  scale,
  onScale,
  onRecenter,
  onLayers,
  onZoomIn,
  onZoomOut,
  showLayers = true,
  hidden = false,
  zoomStage,
  onZoomStage,
  styleMode,
  onStyleMode,
  outdoorOverlays,
  onToggleOutdoorOverlay,
  bearing = 0,
  onResetNorth,
  isFullscreen = false,
  onToggleFullscreen: _onToggleFullscreen,
}: ClubMapHudProps) {
  const [styleMenuOpen, setStyleMenuOpen] = useState(false);
  const styleTriggerRef = useRef<HTMLButtonElement | null>(null);
  const stylePopoverRef = useRef<HTMLDivElement | null>(null);
  const [popoverPos, setPopoverPos] = useState<{
    left: number;
    top?: number;
    bottom?: number;
    maxHeight: number;
    placement: 'up' | 'down';
  } | null>(null);

  const computePopoverPos = useCallback(() => {
    const btn = styleTriggerRef.current;
    if (!btn || typeof window === 'undefined') return;
    const rect = btn.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom - 96;
    const spaceAbove = rect.top - 16;
    const openUp = !isFullscreen || (spaceBelow < 260 && spaceAbove > spaceBelow);
    const left = Math.max(10, Math.min(rect.left, window.innerWidth - 306));
    if (openUp) {
      setPopoverPos({
        left,
        bottom: Math.max(12, window.innerHeight - rect.top + 8),
        maxHeight: Math.min(360, Math.max(180, spaceAbove - 8)),
        placement: 'up',
      });
    } else {
      setPopoverPos({
        left,
        top: rect.bottom + 8,
        maxHeight: Math.min(360, Math.max(200, spaceBelow)),
        placement: 'down',
      });
    }
  }, [isFullscreen]);

  useLayoutEffect(() => {
    if (!styleMenuOpen) return;
    computePopoverPos();
  }, [styleMenuOpen, computePopoverPos]);

  useEffect(() => {
    if (!styleMenuOpen) return;
    const onResizeOrScroll = () => computePopoverPos();
    const onPointerDown = (e: PointerEvent) => {
      const target = e.target as Node | null;
      if (!target) return;
      if (stylePopoverRef.current?.contains(target)) return;
      if (styleTriggerRef.current?.contains(target)) return;
      setStyleMenuOpen(false);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setStyleMenuOpen(false);
    };
    window.addEventListener('resize', onResizeOrScroll);
    window.addEventListener('scroll', onResizeOrScroll, true);
    document.addEventListener('pointerdown', onPointerDown, true);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('resize', onResizeOrScroll);
      window.removeEventListener('scroll', onResizeOrScroll, true);
      document.removeEventListener('pointerdown', onPointerDown, true);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [styleMenuOpen, computePopoverPos]);

  if (config.hud === 'none') return null;

  const isClub3D = Boolean(zoomStage && onZoomStage);
  const activeStyleMeta =
    CLUB_3D_STYLE_OPTIONS.find((opt) => opt.id === styleMode) ?? CLUB_3D_STYLE_OPTIONS[0];
  const activeOverlayCount = outdoorOverlays
    ? Object.values(outdoorOverlays).filter(Boolean).length
    : 0;

  return (
    <div
      className="lkdv-map-hud"
      data-hidden={hidden ? 'true' : undefined}
      aria-hidden={hidden ? true : undefined}
      inert={hidden ? true : undefined}
    >
      <div className="lkdv-map-top-left">
        <div className="lkdv-map-scale" role="group" aria-label="Échelle de la carte">
          {isClub3D
            ? CLUB_STAGE_ITEMS.map(({ id, label, Icon }) => (
                <button
                  key={id}
                  type="button"
                  className={zoomStage === id ? 'active' : ''}
                  aria-pressed={zoomStage === id}
                  aria-label={label}
                  title={label}
                  onClick={() => onZoomStage?.(id)}
                >
                  <Icon size={14} strokeWidth={2} aria-hidden />
                </button>
              ))
            : LEGACY_SCALE_ITEMS.map(({ id, label, Icon }) => (
                <button
                  key={id}
                  type="button"
                  className={scale === id ? 'active' : ''}
                  aria-pressed={scale === id}
                  aria-label={label}
                  title={label}
                  onClick={() => onScale(id)}
                >
                  <Icon size={15} strokeWidth={2} aria-hidden />
                </button>
              ))}
        </div>

        {styleMode && onStyleMode ? (
          <div className="lkdv-map-style-wrap">
            <button
              ref={styleTriggerRef}
              type="button"
              className="lkdv-map-style-trigger"
              aria-expanded={styleMenuOpen}
              aria-label={`Fond de carte : ${activeStyleMeta.shortLabel}`}
              onClick={() => setStyleMenuOpen((prev) => !prev)}
            >
              <Layers size={12} aria-hidden="true" />
              <span>{activeStyleMeta.shortLabel}</span>
              {activeOverlayCount > 0 ? (
                <span className="lkdv-map-overlay-count" aria-label={`${activeOverlayCount} calques actifs`}>
                  +{activeOverlayCount}
                </span>
              ) : null}
            </button>

            {!hidden && styleMenuOpen && popoverPos && typeof document !== 'undefined'
              ? createPortal(
                  <div
                    ref={stylePopoverRef}
                    className="lkdv-map-style-popover"
                    data-placement={popoverPos.placement}
                    role="group"
                    aria-label="Fonds 3D et réseaux plein air"
                    style={{
                      position: 'fixed',
                      left: popoverPos.left,
                      top: popoverPos.top,
                      bottom: popoverPos.bottom,
                      maxHeight: popoverPos.maxHeight,
                      zIndex: 1250,
                      pointerEvents: 'auto',
                    }}
                  >
                    <div className="lkdv-map-popover-section">
                      <span className="lkdv-map-popover-label">Fonds 3D</span>
                      <div className="lkdv-map-popover-row">
                        {CLUB_3D_STYLE_OPTIONS.map((opt) => (
                          <button
                            key={opt.id}
                            type="button"
                            className={styleMode === opt.id ? 'active' : ''}
                            aria-pressed={styleMode === opt.id}
                            title={opt.hint}
                            onClick={() => {
                              onStyleMode(opt.id);
                            }}
                          >
                            {opt.shortLabel}
                          </button>
                        ))}
                      </div>
                    </div>
                    {outdoorOverlays && onToggleOutdoorOverlay ? (
                      <div className="lkdv-map-popover-section">
                        <span className="lkdv-map-popover-label">GR, Sentiers & Lacs</span>
                        <div className="lkdv-map-popover-row">
                          {CLUB_OUTDOOR_OVERLAY_OPTIONS.map((ov) => {
                            const isOn = Boolean(outdoorOverlays[ov.id]);
                            return (
                              <button
                                key={ov.id}
                                type="button"
                                className={isOn ? 'active is-overlay' : 'is-overlay'}
                                aria-pressed={isOn}
                                title={ov.hint}
                                style={isOn ? { background: ov.accent, color: '#ffffff' } : undefined}
                                onClick={() => onToggleOutdoorOverlay(ov.id)}
                              >
                                {ov.shortLabel}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    ) : null}
                    <div className="lkdv-map-popover-section">
                      <span className="lkdv-map-popover-label">Légende des tracés</span>
                      <div className="lkdv-map-legend-list" role="list" aria-label="Légende des types de tracés">
                        {MAP_TRAIL_LEGEND_ITEMS.map((item) => (
                          <div key={item.id} className="lkdv-map-legend-item" role="listitem">
                            <svg
                              className="lkdv-map-legend-swatch"
                              viewBox="0 0 30 10"
                              width="30"
                              height="10"
                              aria-hidden="true"
                            >
                              {item.casing ? (
                                <line
                                  x1="2"
                                  y1="5"
                                  x2="28"
                                  y2="5"
                                  stroke={item.casing}
                                  strokeWidth={item.strokeWidth + 2}
                                  strokeLinecap="round"
                                />
                              ) : null}
                              <line
                                x1="2"
                                y1="5"
                                x2={item.buoy ? '21' : '28'}
                                y2="5"
                                stroke={item.stroke}
                                strokeWidth={item.strokeWidth}
                                strokeDasharray={item.dasharray && item.dasharray !== 'none' ? item.dasharray : undefined}
                                strokeLinecap="round"
                              />
                              {item.buoy ? (
                                <circle cx="26" cy="5" r="2.3" fill="#d4a73d" stroke="#17402c" strokeWidth="0.8" />
                              ) : null}
                            </svg>
                            <span>{item.label}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>,
                  document.body,
                )
              : null}
          </div>
        ) : null}
      </div>

      <div className="lkdv-map-controls" role="group" aria-label="Contrôles de la carte">
        {onResetNorth ? (
          <button
            type="button"
            onClick={onResetNorth}
            aria-label={`Boussole 3D (${Math.round(((bearing % 360) + 360) % 360)}°), réinitialiser le Nord`}
            title="Réorienter plein Nord"
          >
            <span
              className="lkdv-map-compass-needle"
              style={{ transform: `rotate(${-bearing}deg)` }}
            >
              <Compass size={17} aria-hidden="true" />
            </span>
          </button>
        ) : null}

        {showLayers ? (
          <button
            type="button"
            onClick={() => {
              if (onStyleMode) setStyleMenuOpen((prev) => !prev);
              else onLayers();
            }}
            aria-label="Choisir le fond 3D"
            title="Choisir le fond 3D"
          >
            <Layers size={16} aria-hidden="true" />
          </button>
        ) : null}

        <button type="button" onClick={onRecenter} aria-label="Recentrer" title="Recentrer">
          <MapPin size={16} aria-hidden="true" />
        </button>
        <button type="button" onClick={onZoomIn} aria-label="Zoom avant" title="Zoom avant">
          <Plus size={16} aria-hidden="true" />
        </button>
        <button type="button" onClick={onZoomOut} aria-label="Zoom arrière" title="Zoom arrière">
          <Minus size={16} aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}

export default ClubMapHud;
