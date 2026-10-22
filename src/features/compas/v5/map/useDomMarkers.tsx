'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import type { Map as MlMap, Marker as MlMarker } from 'maplibre-gl';

/**
 * Marqueurs HTML de la carte, pilotés par React sans être recréés à chaque rendu : un élément et un
 * `Marker` MapLibre par clé, créés une fois, déplacés si la position change, retirés quand la clé disparaît.
 * Leur contenu est rendu par des portails, donc mis à jour par React sans toucher au marqueur.
 */
export interface MarkerSpec {
  /** Identité stable du marqueur. */
  key: string;
  lat: number;
  lon: number;
  /** Classes de l'élément (`v5-mk v5-mk-night`…), appliquées par différence. */
  className: string;
  content: ReactNode;
}

interface Entry {
  el: HTMLDivElement;
  marker: MlMarker | null;
  lat: number;
  lon: number;
  classes: string[];
}

/** Le strict nécessaire du module MapLibre : permet de le simuler en test. */
export interface MarkerLib {
  Marker: new (options: { element: HTMLElement; anchor: 'top-left' }) => MlMarker;
}

const split = (className: string) => className.split(/\s+/).filter(Boolean);

function applyClasses(entry: Entry, className: string) {
  const next = split(className);
  for (const c of entry.classes) if (!next.includes(c)) entry.el.classList.remove(c);
  for (const c of next) if (!entry.classes.includes(c)) entry.el.classList.add(c);
  entry.classes = next;
}

export function useDomMarkers(map: MlMap | null, lib: MarkerLib | null, specs: readonly MarkerSpec[]): ReactNode {
  const [store] = useState(() => new Map<string, Entry>());

  // Un élément par clé, créé dès le rendu pour que le portail ait une cible ; la carte le prend ensuite.
  if (map && typeof document !== 'undefined') {
    for (const s of specs) {
      if (!store.has(s.key)) {
        const el = document.createElement('div');
        const entry: Entry = { el, marker: null, lat: Number.NaN, lon: Number.NaN, classes: [] };
        applyClasses(entry, s.className);
        store.set(s.key, entry);
      }
    }
  }

  useEffect(() => {
    if (!map || !lib) return;
    const live = new Set<string>();
    for (const s of specs) {
      live.add(s.key);
      const entry = store.get(s.key);
      if (!entry) continue;
      applyClasses(entry, s.className);
      if (!entry.marker) {
        entry.marker = new lib.Marker({ element: entry.el, anchor: 'top-left' }).setLngLat([s.lon, s.lat]).addTo(map);
      } else if (entry.lat !== s.lat || entry.lon !== s.lon) {
        entry.marker.setLngLat([s.lon, s.lat]);
      }
      entry.lat = s.lat;
      entry.lon = s.lon;
    }
    for (const [key, entry] of store) {
      if (live.has(key)) continue;
      entry.marker?.remove();
      store.delete(key);
    }
  });

  // Démontage (ou simulation de démontage du mode strict) : les marqueurs quittent la carte, les éléments restent
  // pour que le prochain passage les repose.
  useEffect(
    () => () => {
      for (const entry of store.values()) {
        entry.marker?.remove();
        entry.marker = null;
      }
    },
    [store]
  );

  if (!map) return null;
  return specs.map((s) => {
    const entry = store.get(s.key);
    return entry ? createPortal(s.content, entry.el, s.key) : null;
  });
}
