'use client';

import dynamic from 'next/dynamic';
import { useMemo, useRef, useState, type ReactNode } from 'react';
import Icon from '@/components/ui/Icon';
import type { HubRoutePoint } from '@/features/hub/components/mobile/HubRouteMap';
import type { CompasPoint } from '../server/getCompasData';
import {
  ALL_LAYERS,
  MAP_LAYERS,
  NO_LAYERS,
  layerOf,
  visiblePoints,
  type LayerState,
  type MapLayer,
} from '../engine/mapLayers';

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
  layers,
  onLayers,
  children,
}: {
  name: string;
  coords: Array<[number, number]>;
  routeGeojson: Record<string, unknown> | null;
  points: CompasPoint[];
  big: boolean;
  onToggleBig: () => void;
  /** Calques affichés (maquette : « Personnaliser la carte »). */
  layers: LayerState;
  onLayers: (next: LayerState) => void;
  /** Surcouches : prochaine décision, accessoire. */
  children?: ReactNode;
}) {
  const [recenter, setRecenter] = useState(0);
  const [panel, setPanel] = useState(false);
  const grabY = useRef<number | null>(null);
  const grabClick = useRef(false);
  const counts = useMemo(() => {
    const c = new Map<MapLayer, number>();
    for (const p of points) {
      const l = layerOf(p);
      if (l) c.set(l, (c.get(l) ?? 0) + 1);
    }
    return c;
  }, [points]);
  const mapPoints = useMemo<HubRoutePoint[]>(
    () =>
      visiblePoints(points, layers).map((p) => ({
        id: p.id,
        lat: p.lat,
        lon: p.lon,
        label: p.label,
        category: p.category,
        color: POINT_COLORS[p.kind === 'poi' ? 'poi' : p.category === 'stay' ? 'stay' : 'step'],
      })),
    [points, layers]
  );
  const shown = MAP_LAYERS.filter((l) => layers[l.id]).length;
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
          Choisis un parcours dans « Où » : il s’affiche ici.
        </p>
      )}
      <button
        type="button"
        className="cp-map__grab"
        aria-label={big ? 'Glisser pour réduire la carte' : 'Glisser pour agrandir la carte'}
        aria-pressed={big}
        onPointerDown={(e) => {
          grabY.current = e.clientY;
          e.currentTarget.setPointerCapture?.(e.pointerId);
        }}
        onPointerUp={(e) => {
          const from = grabY.current;
          grabY.current = null;
          if (from == null || !Number.isFinite(e.clientY)) return;
          const dy = e.clientY - from;
          // Tirer vers le haut agrandit, vers le bas réduit, un toucher bascule.
          if (Math.abs(dy) < 16 || dy < 0 !== big) onToggleBig();
          grabClick.current = true;
        }}
        onPointerCancel={() => {
          grabY.current = null;
        }}
        onClick={() => {
          // Clavier (Entrée, Espace) : le pointeur a déjà décidé sinon.
          if (grabClick.current) grabClick.current = false;
          else onToggleBig();
        }}
      >
        <span />
      </button>
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
        <button
          type="button"
          onClick={() => setPanel((v) => !v)}
          aria-expanded={panel}
          aria-label="Personnaliser la carte"
        >
          <Icon name="layers" size={17} />
        </button>
      </div>
      {panel && (
        <div className="cp-mopts cp-sheet-glass" role="dialog" aria-label="Personnaliser la carte">
          <div className="cp-mopts__h">
            <b>Carte</b>
            <span>
              {shown} calque{shown > 1 ? 's' : ''} affiché{shown > 1 ? 's' : ''}
            </span>
          </div>
          <div className="cp-mopts__grid">
            {MAP_LAYERS.map((l) => {
              const n = l.id === 'profil' ? null : (counts.get(l.id) ?? 0);
              return (
                <button
                  key={l.id}
                  type="button"
                  role="switch"
                  aria-checked={layers[l.id]}
                  disabled={n === 0}
                  title={n === 0 ? 'Aucun point de ce type sur ce voyage' : undefined}
                  onClick={() => onLayers({ ...layers, [l.id]: !layers[l.id] })}
                >
                  <Icon name={l.icon} size={16} />
                  <span>{l.label}</span>
                  {n != null && n > 0 && <small>{n}</small>}
                </button>
              );
            })}
          </div>
          <div className="cp-mopts__f">
            <button type="button" onClick={() => onLayers(NO_LAYERS)}>
              Carte nue
            </button>
            <button type="button" onClick={() => onLayers(ALL_LAYERS)}>
              Tout afficher
            </button>
          </div>
        </div>
      )}
      {children}
    </section>
  );
}
