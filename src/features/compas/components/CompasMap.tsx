'use client';

import dynamic from 'next/dynamic';
import { useMemo, useState, type ReactNode } from 'react';
import Icon from '@/components/ui/Icon';
import type { HubRoutePoint } from '@/features/hub/components/mobile/HubRouteMap';
import type { CompasPoint } from '../server/getCompasData';

/**
 * Carte du Compas : la carte MapLibre du hub, chargée à part (chunk lourd,
 * jamais rendu côté serveur). Agrandir ne change PAS le zoom : la carte garde
 * son cadrage et gagne seulement de la hauteur ; le haut de l'écran se réduit
 * à une carte-titre (maquette v8).
 */
const HubGlobeMap = dynamic(
  () => import('@/features/hub/components/mobile/HubGlobeMap').then((module) => module.default),
  { ssr: false, loading: () => null }
);

/** Palette de marqueurs du préparateur (mêmes teintes que PreparatorView). */
const POINT_COLORS: Record<string, string> = {
  stay: '#5B7F55',
  step: '#17402C',
  poi: '#4B6B7C',
};

export function CompasMap({
  name,
  coords,
  routeGeojson,
  points,
  big,
  onToggleBig,
  children,
}: {
  name: string;
  coords: Array<[number, number]>;
  routeGeojson: Record<string, unknown> | null;
  points: CompasPoint[];
  big: boolean;
  onToggleBig: () => void;
  /** Surcouches : prochaine décision, accessoire. */
  children?: ReactNode;
}) {
  const [recenter, setRecenter] = useState(0);
  const mapPoints = useMemo<HubRoutePoint[]>(
    () =>
      points.map((p) => ({
        id: p.id,
        lat: p.lat,
        lon: p.lon,
        label: p.label,
        category: p.category,
        color: POINT_COLORS[p.kind === 'poi' ? 'poi' : p.category === 'stay' ? 'stay' : 'step'],
      })),
    [points]
  );
  const hasSomething = coords.length > 0 || Boolean(routeGeojson) || points.length > 0;

  return (
    <section className="cp-map" aria-label="Carte du parcours">
      {hasSomething ? (
        <div className="cp-map__canvas">
          <HubGlobeMap
            key={`compas-map-${recenter}`}
            name={name}
            routeCoords={coords.length === 1 ? [coords[0], coords[0]] : coords}
            routeGeojson={routeGeojson}
            points={mapPoints}
            hideBuiltInControls
          />
        </div>
      ) : (
        <p className="cp-map__empty">
          Aucun point encore : trace le parcours dans le préparateur pour le voir ici.
        </p>
      )}
      <span className="cp-map__grab" aria-hidden="true" />
      <div className="cp-map__actions cp-glass">
        <button
          type="button"
          onClick={onToggleBig}
          aria-pressed={big}
          aria-label={big ? 'Réduire la carte' : 'Agrandir la carte'}
        >
          <Icon name={big ? 'chevron-down' : 'chevron-up'} size={18} />
        </button>
        {hasSomething && (
          <button type="button" onClick={() => setRecenter((n) => n + 1)} aria-label="Recentrer">
            <Icon name="navigation" size={17} />
          </button>
        )}
      </div>
      {children}
    </section>
  );
}
