'use client';

/**
 * Région carte pilotable au clavier (Lot O02-UI).
 *
 * Enveloppe une carte déjà rendue (MapLibre/Leaflet) sans toucher au composant
 * verrouillé `ExplorerV2.tsx`. `handleMapKeyDown` du contrat O02 traite les
 * flèches, le zoom, le recentrage, la sélection et Échap ; `Tab` n'est jamais
 * intercepté pour ne pas créer de piège clavier.
 */

import React, { useEffect, useId, useRef, type CSSProperties, type ReactNode } from 'react';
import {
  handleMapKeyDown,
  type MapKeyboardHandlers,
} from '@/features/accessibility';
import { useAnnouncer } from './LiveRegion';

export interface MapKeyboardRegionProps extends MapKeyboardHandlers {
  /** Nom accessible de la carte (« Carte de l'itinéraire »). */
  label: string;
  description?: string;
  children?: ReactNode;
  className?: string;
  style?: CSSProperties;
  /** Affiche le mode d'emploi visible au-dessus de la carte (défaut : true). */
  showInstructions?: boolean;
  /** Hauteur minimale de la zone focusable. */
  minHeight?: string | number;
}

const DEFAULT_DESCRIPTION =
  'Flèches : déplacer la carte. Plus et moins : zoomer. Origine : recentrer. Entrée : sélectionner. Échap : effacer la sélection.';

export function MapKeyboardRegion({
  label,
  description = DEFAULT_DESCRIPTION,
  children,
  className,
  style,
  showInstructions = true,
  minHeight,
  onPan,
  onZoom,
  onResetView,
  onActivateSelection,
  onEscape,
  onAnnounce,
}: MapKeyboardRegionProps) {
  const regionRef = useRef<HTMLDivElement | null>(null);
  const instructionsId = useId();
  const { announce } = useAnnouncer();

  const handlersRef = useRef<MapKeyboardHandlers>({
    onPan,
    onZoom,
    onResetView,
    onActivateSelection,
    onEscape,
    onAnnounce,
  });
  handlersRef.current = {
    onPan,
    onZoom,
    onResetView,
    onActivateSelection,
    onEscape,
    onAnnounce,
  };

  useEffect(() => {
    const element = regionRef.current;
    if (!element) return;

    const listener = (event: KeyboardEvent) => {
      handleMapKeyDown(event, {
        onPan: (direction, stepMultiplier) => {
          handlersRef.current.onPan?.(direction, stepMultiplier);
        },
        onZoom: (delta) => {
          handlersRef.current.onZoom?.(delta);
        },
        onResetView: () => {
          handlersRef.current.onResetView?.();
        },
        onActivateSelection: () => {
          handlersRef.current.onActivateSelection?.();
        },
        onEscape: () => {
          handlersRef.current.onEscape?.();
        },
        onAnnounce: (message) => {
          if (handlersRef.current.onAnnounce) {
            handlersRef.current.onAnnounce(message);
          } else {
            announce(message);
          }
        },
      });
    };

    element.addEventListener('keydown', listener);
    return () => element.removeEventListener('keydown', listener);
  }, [announce]);

  return (
    <div className="lkdv-a11y-root">
      <p
        id={instructionsId}
        className={showInstructions ? 'lkdv-a11y-map-help' : 'lkdv-a11y-sr-only'}
      >
        {description}
      </p>
      <div
        ref={regionRef}
        className={['lkdv-a11y-map', className].filter(Boolean).join(' ')}
        style={{ minHeight, ...style }}
        role="region"
        aria-roledescription="carte interactive"
        aria-label={label}
        aria-describedby={instructionsId}
        aria-keyshortcuts="ArrowUp ArrowDown ArrowLeft ArrowRight + - Home Enter Escape"
        tabIndex={0}
        data-lkdv-map-keyboard="true"
      >
        {children}
      </div>
    </div>
  );
}

export default MapKeyboardRegion;
