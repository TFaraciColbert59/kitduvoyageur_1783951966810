'use client';

// Carte du pays — tuiles réelles assemblées sans moteur de carte.
//
// Leaflet fige la taille de son conteneur à l'initialisation et se décale dans
// une colonne centrée : plutôt que de compenser ses artefacts, on calcule
// directement les tuiles Web Mercator qui couvrent la boîte (430 × 334,9) et on
// les pose en absolu. Même source que le reste de l'app (`leafletTiles`),
// même crédit Esri/OSM, contrôles de zoom réels.
//
// Aucune coordonnée inventée : le centre vient de `latitude`/`longitude` du
// pays (format « 46°36′ N »). Sans coordonnées, pas de carte : état honnête.

import React, { useMemo, useState } from 'react';
import { leafletTiles } from '@/components/map/engine/leafletTiles';

export interface CountryMapProps {
  name: string;
  latitude: string;
  longitude: string;
  capital?: string;
}

const W = 430;
const H = 334.9;
const TILE = 256;

function parseCoord(raw: string | undefined, axis: 'lat' | 'lng'): number | null {
  if (!raw) return null;
  const m = raw.match(/(\d+)[°\s]+(\d+)?[′'\s]?(\d+)?[″"]?\s*([NSEOW])?/i);
  if (!m) return null;
  const deg = Number(m[1]);
  const min = Number(m[2] || 0);
  const sec = Number(m[3] || 0);
  if (!Number.isFinite(deg)) return null;
  const value = deg + min / 60 + sec / 3600;
  const hem = (m[4] || '').toUpperCase();
  const negative = axis === 'lat' ? hem === 'S' : hem === 'O' || hem === 'W';
  return negative ? -value : value;
}

/** Web Mercator : pixel monde au zoom z. */
function lonToPx(lng: number, z: number): number {
  return ((lng + 180) / 360) * TILE * 2 ** z;
}

function latToPx(lat: number, z: number): number {
  const s = Math.sin((lat * Math.PI) / 180);
  return (0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI)) * TILE * 2 ** z;
}

export function CountryMap({ name, latitude, longitude, capital }: CountryMapProps) {
  const [zoom, setZoom] = useState(5);

  const lat = parseCoord(latitude, 'lat');
  const lng = parseCoord(longitude, 'lng');
  const hasGeo = lat !== null && lng !== null;

  const tiles = useMemo(() => {
    if (!hasGeo) return [];
    const spec = leafletTiles('topo');
    const centerX = lonToPx(lng as number, zoom);
    const centerY = latToPx(lat as number, zoom);
    const originX = centerX - W / 2;
    const originY = centerY - H / 2;
    const firstX = Math.floor(originX / TILE);
    const firstY = Math.floor(originY / TILE);
    const lastX = Math.floor((originX + W) / TILE);
    const lastY = Math.floor((originY + H) / TILE);
    const max = 2 ** zoom;
    const out: { key: string; url: string; left: number; top: number; z: number; x: number; y: number }[] = [];
    for (let x = firstX; x <= lastX; x++) {
      for (let y = firstY; y <= lastY; y++) {
        const wrappedX = ((x % max) + max) % max;
        const url = spec.url
          .replace('{z}', String(zoom))
          .replace('{x}', String(wrappedX))
          .replace('{y}', String(y))
          .replace('{s}', 'a');
        out.push({ key: `${zoom}-${x}-${y}`, url, left: x * TILE - originX, top: y * TILE - originY, z: zoom, x, y });
      }
    }
    return out;
  }, [hasGeo, lat, lng, zoom]);

  if (!hasGeo) {
    return (
      <div className="map" style={{ display: 'grid', placeItems: 'center' }}>
        <p style={{ font: '600 11px/1.4 var(--sf)', color: 'var(--label2)', textAlign: 'center', padding: 24 }}>
          Coordonnées indisponibles : la carte ne peut pas être affichée.
        </p>
      </div>
    );
  }

  const spec = leafletTiles('topo');

  return (
    <div className="map" aria-label={`Carte de ${name}`} role="img">
      <div className="lkdv-pays-map-canvas" aria-hidden="true">
        {tiles.map((t) => (
          // eslint-disable-next-line @next/next/no-img-element -- tuiles distantes de la carte
          <img key={t.key} src={t.url} alt="" width={TILE} height={TILE} style={{ left: t.left, top: t.top }} loading="eager" draggable={false} />
        ))}
        <span
          className="lkdv-pays-map-pin"
          style={{ left: W / 2, top: H / 2 }}
          title={capital || name}
        >
          <i />
          <em>{capital || name}</em>
        </span>
      </div>

      <div className="lkdv-pays-map-scale" role="group" aria-label="Échelle de la carte">
        <button type="button" className={zoom === 5 ? 'on' : ''} aria-pressed={zoom === 5} aria-label="Zoom pays" onClick={() => setZoom(5)}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" aria-hidden="true">
            <circle cx="12" cy="12" r="9" />
            <path d="M3.5 9h17M3.5 15h17M12 3c2.5 2.6 3.6 5.6 3.6 9s-1.1 6.4-3.6 9c-2.5-2.6-3.6-5.6-3.6-9S9.5 5.6 12 3Z" />
          </svg>
        </button>
        <button type="button" className={zoom === 6 ? 'on' : ''} aria-pressed={zoom === 6} aria-label="Zoom région" onClick={() => setZoom(6)}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" aria-hidden="true">
            <path d="m3 18 5.5-9 4 6 3-4L21 18H3Z" />
          </svg>
        </button>
        <button type="button" className={zoom === 7 ? 'on' : ''} aria-pressed={zoom === 7} aria-label="Zoom local" onClick={() => setZoom(7)}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" aria-hidden="true">
            <circle cx="12" cy="12" r="7" />
            <circle cx="12" cy="12" r="2.2" fill="currentColor" stroke="none" />
          </svg>
        </button>
      </div>

      <div className="lkdv-pays-map-ctrls" role="group" aria-label="Contrôles de la carte">
        <button type="button" aria-label="Agrandir" onClick={() => setZoom((z) => Math.min(10, z + 1))}>
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>
        </button>
        <button type="button" aria-label="Réduire" onClick={() => setZoom((z) => Math.max(3, z - 1))}>
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" aria-hidden="true"><path d="M5 12h14" /></svg>
        </button>
      </div>

      <p className="lkdv-map-attribution">
        {spec.options.attribution?.includes('Esri') ? (
          <>
            <a href="https://www.esri.com" target="_blank" rel="noreferrer noopener">Powered by Esri</a>
            <span aria-hidden="true"> · </span>
          </>
        ) : null}
        <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer noopener">© OpenStreetMap</a>
      </p>
    </div>
  );
}

export default CountryMap;
