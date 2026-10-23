'use client';

import React from 'react';
import { Crosshair, Layers, LocateFixed, Maximize2 } from 'lucide-react';
import type { CompteMapStats, MapModeConfig } from '@/features/compte/map/types';
import type { MapScale } from '@/features/compte/map/camera';

export function CompteMapAttribution() {
  return (
    <div className="lkdv-map-attribution">
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

export interface CompteMapHudProps {
  config: MapModeConfig;
  stats: CompteMapStats;
  truncated?: boolean;
  scale: MapScale;
  onScale: (scale: MapScale) => void;
  onRecenter: () => void;
  onLayers: () => void;
  onExpand: () => void;
  onLocate: () => void;
}

export function CompteMapHud({
  config,
  stats,
  truncated = false,
  scale,
  onScale,
  onRecenter,
  onLayers,
  onExpand,
  onLocate,
}: CompteMapHudProps) {
  if (config.hud === 'none') return null;

  const summary =
    config.hud === 'outing'
      ? 'Sortie sélectionnée'
      : `${stats.outings} sorties · ${stats.km} km · ${stats.massifs} massifs${
          truncated ? ' · 80 affichées' : ''
        }`;

  return (
    <div className="lkdv-map-hud">
      <div className="lkdv-map-top">
        <div className="lkdv-map-capsule" role="status">
          <span>{config.label}</span>
          <b>{stats.outings}</b>
        </div>
        <div className="lkdv-map-scale" role="group" aria-label="Échelle de la carte">
          {(['globe', 'massif', 'sentier'] as const).map((item) => (
            <button
              key={item}
              type="button"
              className={scale === item ? 'active' : ''}
              aria-pressed={scale === item}
              aria-label={
                item === 'globe' ? 'Vue globe' : item === 'massif' ? 'Vue massif' : 'Vue sentier'
              }
              onClick={() => onScale(item)}
            >
              {item === 'globe' ? 'Globe' : item === 'massif' ? 'Massif' : 'Sentier'}
            </button>
          ))}
        </div>
      </div>

      <div className="lkdv-map-controls">
        <button type="button" onClick={onLayers} aria-label="Changer le fond de carte">
          <Layers size={18} aria-hidden="true" />
        </button>
        <button type="button" onClick={onRecenter} aria-label="Recentrer la carte">
          <Crosshair size={18} aria-hidden="true" />
        </button>
        <button type="button" onClick={onExpand} aria-label="Agrandir la carte">
          <Maximize2 size={18} aria-hidden="true" />
        </button>
        <button type="button" onClick={onLocate} aria-label="Ma position">
          <LocateFixed size={18} aria-hidden="true" />
        </button>
      </div>

      <div className="lkdv-map-summary" aria-live="polite">
        {summary}
      </div>
    </div>
  );
}

export default CompteMapHud;
