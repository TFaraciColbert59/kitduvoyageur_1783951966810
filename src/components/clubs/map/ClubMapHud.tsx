'use client';

import React, { useState } from 'react';
import {
  Compass,
  Flag,
  Globe2,
  Layers,
  MapPin,
  Maximize2,
  Minimize2,
  Minus,
  Mountain,
  Plus,
  Route,
} from 'lucide-react';
import type { MapModeConfig } from '@/features/compte/map/types';
import type { MapScale } from '@/features/compte/map/camera';
import type { Club3DBaseStyle, ClubZoomStage } from './clubMapTypes';
import { CLUB_3D_STYLE_OPTIONS } from './createClub3DStyle';

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
  bearing = 0,
  onResetNorth,
  isFullscreen = false,
  onToggleFullscreen,
}: ClubMapHudProps) {
  const [styleMenuOpen, setStyleMenuOpen] = useState(false);

  if (config.hud === 'none') return null;

  const isClub3D = Boolean(zoomStage && onZoomStage);
  const activeStyleMeta =
    CLUB_3D_STYLE_OPTIONS.find((opt) => opt.id === styleMode) ?? CLUB_3D_STYLE_OPTIONS[0];

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
              type="button"
              className="lkdv-map-style-trigger"
              aria-expanded={styleMenuOpen}
              aria-label={`Fond de carte : ${activeStyleMeta.shortLabel}`}
              onClick={() => setStyleMenuOpen((prev) => !prev)}
            >
              <Layers size={12} aria-hidden="true" />
              <span>{activeStyleMeta.shortLabel}</span>
            </button>

            {styleMenuOpen ? (
              <div className="lkdv-map-style-popover" role="group" aria-label="Fonds 3D">
                {CLUB_3D_STYLE_OPTIONS.map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    className={styleMode === opt.id ? 'active' : ''}
                    aria-pressed={styleMode === opt.id}
                    title={opt.hint}
                    onClick={() => {
                      onStyleMode(opt.id);
                      setStyleMenuOpen(false);
                    }}
                  >
                    {opt.shortLabel}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        ) : null}
      </div>

      <div className="lkdv-map-controls" role="group" aria-label="Contrôles de la carte">
        {onToggleFullscreen ? (
          <button
            type="button"
            onClick={onToggleFullscreen}
            aria-label={isFullscreen ? 'Réduire la carte' : 'Agrandir la carte en plein écran'}
            title={isFullscreen ? 'Réduire la carte' : 'Plein écran 3D'}
          >
            {isFullscreen ? (
              <Minimize2 size={16} aria-hidden="true" />
            ) : (
              <Maximize2 size={16} aria-hidden="true" />
            )}
          </button>
        ) : null}

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
