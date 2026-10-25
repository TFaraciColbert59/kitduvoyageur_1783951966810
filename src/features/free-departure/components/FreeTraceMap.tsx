'use client';

import dynamic from 'next/dynamic';
import React, { useMemo } from 'react';
import Icon from '@/components/ui/Icon';
import type { TracePoint } from '../engine/freeSession';

/**
 * La carte MapLibre du hub est un chunk lourd : elle ne doit jamais entrer dans
 * le premier rendu de cet ecran. `ssr: false` la sort du graphe RSC, et le
 * `loading` peint immediatement la zone, pour que la carte ne « saute » pas
 * entre l'ecran 60 et l'ecran 61.
 *
 * Ce composant existe pour une seule raison : que les trois ecrans aient
 * EXACTEMENT la meme carte. Il est separe pour etre mockable — un test du
 * contenu d'un ecran ne doit pas demarrer MapLibre.
 */
const HubGlobeMap = dynamic(
  () => import('@/features/hub/components/mobile/HubGlobeMap').then((module) => module.default),
  { ssr: false, loading: () => <MapSkeleton /> }
);

function MapSkeleton() {
  return (
    <div
      aria-hidden="true"
      className="absolute inset-0"
      style={{ background: 'var(--prep-map-skeleton-bg)' }}
    />
  );
}

export interface FreeTraceMapProps {
  /** Etiquette de perimetre affichee en pastille : « Autour de moi », « Ma trace ». */
  pillLabel: string;
  /** Trace a dessiner. Vide = rien a dessiner, la carte reste lisible. */
  trace?: readonly TracePoint[];
  /** Titre de calque accessible. */
  name?: string;
  /** Recadre la carte sur la position courante. */
  onRecenter?: () => void;
  className?: string;
}

/**
 * Carte du retour libre — le bloc ancre en bas des ecrans 60, 61 et 62.
 *
 * Elle ne se developpe pas en plein ecran : le retour libre n'a ni programme,
 * ni etapes, ni POI a explorer. Une seule carte suffit, et sa place est fixe
 * en bas de l'ecran pour que le pouce ne masque jamais les actions.
 */
export function FreeTraceMap({
  pillLabel,
  trace = [],
  name = 'Sortie libre',
  onRecenter,
  className = '',
}: FreeTraceMapProps) {
  const routeCoords = useMemo<Array<[number, number]>>(
    () => trace.map((point) => [point.lat, point.lon] as [number, number]),
    [trace]
  );

  return (
    <div className={`prep-map ${className}`.trim()}>
      <div className="prep-map__canvas">
        <HubGlobeMap name={name} routeCoords={routeCoords} className="absolute inset-0 h-full w-full" />
      </div>

      <div className="prep-map__scope">
        <span className="prep-map__glass">
          <Icon name="route" size={16} aria-hidden="true" />
          {pillLabel}
        </span>
      </div>

      {onRecenter ? (
        <div className="prep-map__controls prep-map__controls--end">
          <button
            type="button"
            className="prep-map__glass prep-map__glass--icon"
            onClick={onRecenter}
            aria-label="Recadrer sur ma position"
          >
            <Icon name="navigation" size={18} aria-hidden="true" />
          </button>
        </div>
      ) : null}

      {routeCoords.length === 0 ? (
        <p className="prep-note--overlay absolute inset-x-3 bottom-3">
          Aucune position exploitable : la carte reste affichée, la trace non.
        </p>
      ) : null}
    </div>
  );
}

export default FreeTraceMap;
