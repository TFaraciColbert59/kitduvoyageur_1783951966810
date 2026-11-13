'use client';

import React, { useState } from 'react';
import type { TrailPhotoMarker } from '@/features/highlights';
import { DrawerFrame } from './DrawerFrame';
import {
  bodyStyle,
  chipStyle,
  helperStyle,
  photoStyle,
  primaryButtonStyle,
  rowStyle,
  sectionGapStyle,
} from './styles';

export interface TrailViewPanelProps {
  routeTitle: string;
  markers: TrailPhotoMarker[];
  onClose: () => void;
  onOpenMarker?: (photoId: string) => void;
}

function kilometres(distanceM: number): string {
  const value = distanceM / 1000;
  const maximumFractionDigits = distanceM >= 10_000 ? 0 : 1;
  return `${value.toLocaleString('fr-FR', { maximumFractionDigits })} km`;
}

/**
 * K2.26 — galerie Trail View indexée sur le tracé. Les marqueurs ne portent
 * aucune coordonnée : uniquement la distance parcourue et le cap.
 */
export function TrailViewPanel({
  routeTitle,
  markers,
  onClose,
  onOpenMarker,
}: TrailViewPanelProps) {
  const [selectedId, setSelectedId] = useState<string | null>(markers[0]?.photoId ?? null);
  const selected = markers.find((marker) => marker.photoId === selectedId) ?? markers[0] ?? null;

  return (
    <DrawerFrame
      eyebrow="Trail View"
      title={routeTitle}
      subtitle={`${markers.length} photo${markers.length > 1 ? 's' : ''} géolocalisée${markers.length > 1 ? 's' : ''}`}
      onClose={onClose}
      testId="trail-view-panel"
    >
      <div style={sectionGapStyle}>
        {markers.length === 0 ? (
          <p style={helperStyle} data-testid="trail-view-empty">
            Aucune photo publique géolocalisée sur ce parcours. La position exacte des photos n’est
            jamais exposée.
          </p>
        ) : (
          <>
            {selected ? (
              <figure style={{ margin: 0, display: 'grid', gap: 8 }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={selected.url}
                  alt={selected.caption ?? 'Photo du parcours'}
                  style={{ ...photoStyle, aspectRatio: '16 / 10' }}
                />
                <figcaption style={helperStyle}>
                  {selected.caption ?? 'Photo du parcours'} · {kilometres(selected.distanceAlongM)}{' '}
                  · cap {selected.bearingDeg}°
                </figcaption>
                {onOpenMarker ? (
                  <button
                    type="button"
                    style={primaryButtonStyle}
                    onClick={() => onOpenMarker(selected.photoId)}
                  >
                    Ouvrir la photo
                  </button>
                ) : null}
              </figure>
            ) : null}

            <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
              {markers.map((marker) => (
                <li key={marker.photoId} style={rowStyle}>
                  <button
                    type="button"
                    onClick={() => setSelectedId(marker.photoId)}
                    aria-pressed={selected?.photoId === marker.photoId}
                    style={{
                      ...bodyStyle,
                      flex: 1,
                      textAlign: 'left',
                      border: 0,
                      background: 'transparent',
                      padding: 0,
                      minHeight: 44,
                      cursor: 'pointer',
                    }}
                  >
                    <strong style={{ display: 'block' }}>{marker.caption ?? 'Photo'}</strong>
                    <span style={{ ...helperStyle, display: 'block' }}>
                      {kilometres(marker.distanceAlongM)} · cap {marker.bearingDeg}°
                    </span>
                  </button>
                  <span style={chipStyle}>{Math.round(marker.offsetM)} m du tracé</span>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </DrawerFrame>
  );
}
