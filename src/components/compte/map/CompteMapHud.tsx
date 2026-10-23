'use client';

import React from 'react';
import { Compass, Globe2, Layers, MapPin, Minus, Mountain, Plus } from 'lucide-react';
import type { MapModeConfig } from '@/features/compte/map/types';
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
  scale: MapScale;
  onScale: (scale: MapScale) => void;
  onRecenter: () => void;
  onLayers: () => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
}

const SCALE_ITEMS = [
  { id: 'globe' as const, label: 'Vue globe', Icon: Globe2 },
  { id: 'massif' as const, label: 'Vue massif', Icon: Mountain },
  { id: 'sentier' as const, label: 'Vue sentier', Icon: Compass },
];

/**
 * Contrôles historiques de la carte : le sélecteur d'échelle en haut à gauche
 * et la colonne verre à droite (calques, recentrage, zoom + / zoom −).
 *
 * La carte React ne réintroduit pas la capsule, la synthèse ni les boutons
 * d'agrandissement / géolocalisation de la refonte : seuls les tracés, les
 * massifs, les carnets, les POI et leurs fiches restent visibles.
 */
export function CompteMapHud({
  config,
  scale,
  onScale,
  onRecenter,
  onLayers,
  onZoomIn,
  onZoomOut,
}: CompteMapHudProps) {
  if (config.hud === 'none') return null;

  return (
    <div className="lkdv-map-hud">
      <div className="lkdv-map-scale" role="group" aria-label="Échelle de la carte">
        {SCALE_ITEMS.map(({ id, label, Icon }) => (
          <button
            key={id}
            type="button"
            className={scale === id ? 'active' : ''}
            aria-pressed={scale === id}
            aria-label={label}
            title={label}
            onClick={() => onScale(id)}
          >
            <Icon size={15} strokeWidth={2} aria-hidden="true" />
          </button>
        ))}
      </div>

      <div className="lkdv-map-controls" role="group" aria-label="Contrôles de la carte">
        <button
          type="button"
          onClick={onLayers}
          aria-label="Personnaliser la carte d'empreinte"
          title="Personnaliser la carte d'empreinte"
        >
          <Layers size={18} aria-hidden="true" />
        </button>
        <button type="button" onClick={onRecenter} aria-label="Recentrer" title="Recentrer">
          <MapPin size={18} aria-hidden="true" />
        </button>
        <button type="button" onClick={onZoomIn} aria-label="Zoom avant" title="Zoom avant">
          <Plus size={18} aria-hidden="true" />
        </button>
        <button type="button" onClick={onZoomOut} aria-label="Zoom arrière" title="Zoom arrière">
          <Minus size={18} aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}

export default CompteMapHud;
