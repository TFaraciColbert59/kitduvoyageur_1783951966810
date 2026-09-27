'use client';

import dynamic from 'next/dynamic';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Icon from '@/components/ui/Icon';
import { zIndex } from '@/lib/ui/zIndex';
import { cn } from '@/lib/utils';
import type { HubRoutePoint } from '@/features/hub/components/mobile/HubRouteMap';

/**
 * La carte MapLibre du hub est un chunk lourd : elle n'est jamais incluse dans
 * le premier rendu. `ssr: false` la sort du graphe RSC, et le `loading` garde
 * la zone peinte immédiatement — la carte ne « saute » pas d'une étape à
 * l'autre (A7 : la carte reste en place, sans rechargement brutal).
 */
const HubGlobeMap = dynamic(
  () => import('@/features/hub/components/mobile/HubGlobeMap').then((module) => module.default),
  {
    ssr: false,
    loading: () => <MapSkeleton />,
  },
);

function MapSkeleton() {
  return (
    <div
      aria-hidden="true"
      className="absolute inset-0"
      style={{
        background:
          'radial-gradient(120% 90% at 30% 0%, rgb(34 97 72 / 0.10), transparent 60%), linear-gradient(180deg, rgb(245 247 243), rgb(236 241 236))',
      }}
    />
  );
}

export interface PrepMapPoint {
  id: string;
  lat: number;
  lon: number;
  label: string;
  color: string;
  category?: string | null;
  stepId?: string | null;
}

export interface PrepMapProps {
  /** Nom du tracé — libellé accessible et titre de calque. */
  name: string;
  /** Tracé. Un seul point suffit : HubGlobeMap cadre automatiquement. */
  routeCoords: Array<[number, number]>;
  points?: readonly PrepMapPoint[];
  highlightCoords?: Array<[number, number]>;
  /** Étiquette du périmètre affiché : « Jour 1 » ou « Ensemble ». */
  scopeLabel: string;
  /** Familles de points proposées ; pilote les filtres du plein écran. */
  filterCategories?: readonly string[];
  hideExpand?: boolean;
  className?: string;
}

/** Palette des points : un symbole par famille, jamais la couleur seule. */
export const PREP_POINT_COLORS: Readonly<Record<string, string>> = {
  trajet: '#1F4D3A',
  arret: '#226148',
  repos: '#5C6B5E',
  nuit: '#3B2F55',
  ravitaillement: '#1D4E6B',
};

const FILTERS: readonly { id: string; label: string }[] = [
  { id: 'trajet', label: 'Trajets' },
  { id: 'arret', label: 'Arrêts' },
  { id: 'repos', label: 'Pauses' },
  { id: 'nuit', label: 'Nuits' },
  { id: 'ravitaillement', label: 'Ravitaillement' },
];

const DEFAULT_FILTERS = FILTERS.map((filter) => filter.id);

/**
 * Carte du préparateur — mêmes commandes à toutes les étapes (A7).
 *
 * Le verre est ici à sa bonne place : ces commandes flottent au-dessus du fond
 * de carte. Les surfaces de texte, elles, restent presque opaques.
 * Les libellés sont explicites (« Agrandir », « Recentrer », « Ma position »)
 * : l'icône ne porte jamais seule le sens.
 */
export function PrepMap({
  name,
  routeCoords,
  points = [],
  highlightCoords,
  scopeLabel,
  filterCategories = DEFAULT_FILTERS,
  hideExpand = false,
  className,
}: PrepMapProps) {
  const [full, setFull] = useState(false);
  const [recenterKey, setRecenterKey] = useState(0);
  const [locating, setLocating] = useState(false);
  const [filters, setFilters] = useState<readonly string[]>(DEFAULT_FILTERS);
  const [mine, setMine] = useState<[number, number] | null>(null);
  const [geolocateError, setGeolocateError] = useState<string | null>(null);

  const visiblePoints = useMemo(
    () => points.filter((point) => filters.includes(point.category ?? 'arret')),
    [points, filters],
  );

  const combinedCoords = useMemo<Array<[number, number]>>(
    () => (mine ? [...routeCoords, mine] : routeCoords),
    [routeCoords, mine],
  );

  const recenter = useCallback(() => setRecenterKey((key) => key + 1), []);

  const locate = useCallback(() => {
    if (locating) return;
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setGeolocateError('Localisation indisponible sur cet appareil');
      return;
    }
    setLocating(true);
    setGeolocateError(null);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setMine([position.coords.latitude, position.coords.longitude]);
        setLocating(false);
      },
      () => {
        setLocating(false);
        setGeolocateError('Position non obtenue — réessaie quand tu en as besoin');
      },
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 30000 },
    );
  }, [locating]);

  // Plein écran : on bloque le scroll de la page pour que la carte reste fixe.
  useEffect(() => {
    if (!full) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setFull(false);
    };
    document.addEventListener('keydown', onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = previous;
    };
  }, [full]);

  const canvas = (
    <div className="prep-map__canvas">
      {/* La key force un recadrage propre quand « Recentrer » est pressé. */}
      <HubGlobeMap
        key={`prep-map-${recenterKey}`}
        name={name}
        routeCoords={combinedCoords}
        highlightCoords={highlightCoords}
        points={visiblePoints as unknown as HubRoutePoint[]}
      />
    </div>
  );

  const scope = (
    <div className="prep-map__scope">
      <span className="prep-map__glass">{scopeLabel}</span>
    </div>
  );

  if (full) {
    return (
      <div
        className="prep-map prep-map--full"
        role="dialog"
        aria-modal="true"
        aria-label="Carte en plein écran"
        style={{ zIndex: zIndex.modal }}
      >
        {canvas}
        {scope}
        <div className="prep-map__controls prep-map__controls--end">
          <button type="button" className="prep-map__glass" onClick={locate} disabled={locating}>
            <Icon name="map-pin" size={16} />
            Ma position
          </button>
          <button
            type="button"
            className="prep-map__glass"
            onClick={() => setFull(false)}
            aria-label="Réduire la carte"
          >
            <Icon name="minus" size={16} />
            Réduire
          </button>
        </div>
        <div className="prep-map__fullbar">
          {FILTERS.filter((filter) => filterCategories.includes(filter.id)).map((filter) => {
            const on = filters.includes(filter.id);
            return (
              <button
                key={filter.id}
                type="button"
                className="prep-map__glass"
                aria-pressed={on}
                onClick={() =>
                  setFilters((current) =>
                    on ? current.filter((id) => id !== filter.id) : [...current, filter.id],
                  )
                }
              >
                <Icon name={on ? 'check' : 'plus'} size={15} />
                {filter.label}
              </button>
            );
          })}
        </div>
        {geolocateError && (
          <p className="prep-note" style={{ position: 'absolute', bottom: 108, left: 16, right: 16 }}>
            {geolocateError}
          </p>
        )}
      </div>
    );
  }

  return (
    <div className={cn('prep-map', className)}>
      {canvas}
      {scope}
      <div className="prep-map__controls prep-map__controls--end">
        {!hideExpand && (
          <button
            type="button"
            className="prep-map__glass"
            onClick={() => setFull(true)}
            aria-label="Agrandir la carte"
          >
            <Icon name="arrow-up-right" size={16} />
            Agrandir
          </button>
        )}
        <button
          type="button"
          className="prep-map__glass"
          onClick={recenter}
          aria-label="Recentrer sur le parcours"
        >
          <Icon name="navigation" size={16} />
          Recentrer
        </button>
      </div>
    </div>
  );
}

export default PrepMap;