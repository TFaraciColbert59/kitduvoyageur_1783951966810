'use client';

// Carte du pays — tuiles réelles (Esri/OSM) **déplaçables et zoomables**.
//
// Le montage est fait à la main (pas de moteur) : on calcule les tuiles Web
// Mercator qui couvrent la boîte, on les pose en absolu, et le déplacement se
// fait au pointeur (souris/tactile) puis se « commit » au relâchement.
//
// Aucune coordonnée inventée : le centre vient de `latitude`/`longitude` du pays
// (« 46°36′ N »). Sans coordonnées, pas de carte : état honnête.

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
const MIN_Z = 3;
const MAX_Z = 11;

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

const lonToPx = (lng: number, z: number) => ((lng + 180) / 360) * TILE * 2 ** z;
const latToPx = (lat: number, z: number) => {
  const s = Math.sin((lat * Math.PI) / 180);
  return (0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI)) * TILE * 2 ** z;
};

export function CountryMap({ name, latitude, longitude, capital }: CountryMapProps) {
  const lat = parseCoord(latitude, 'lat');
  const lng = parseCoord(longitude, 'lng');
  const hasGeo = lat !== null && lng !== null;

  /** Centre de la vue en pixels monde au zoom courant. */
  const [view, setView] = useState(() => ({
    z: 5,
    cx: hasGeo ? lonToPx(lng as number, 5) : 0,
    cy: hasGeo ? latToPx(lat as number, 5) : 0,
  }));
  const [drag, setDrag] = useState<{ dx: number; dy: number } | null>(null);
  const dragRef = useRef<{ x: number; y: number; dx: number; dy: number } | null>(null);
  const [touched, setTouched] = useState(false);

  const spec = leafletTiles('topo');

  const tiles = useMemo(() => {
    if (!hasGeo) return [];
    const originX = view.cx - W / 2;
    const originY = view.cy - H / 2;
    const firstX = Math.floor(originX / TILE);
    const firstY = Math.floor(originY / TILE);
    const lastX = Math.floor((originX + W) / TILE);
    const lastY = Math.floor((originY + H) / TILE);
    const max = 2 ** view.z;
    const out: { key: string; url: string; left: number; top: number }[] = [];
    for (let x = firstX; x <= lastX; x++) {
      for (let y = firstY; y <= lastY; y++) {
        const wrappedX = ((x % max) + max) % max;
        const url = spec.url
          .replace('{z}', String(view.z))
          .replace('{x}', String(wrappedX))
          .replace('{y}', String(y))
          .replace('{s}', 'a');
        out.push({ key: `${view.z}-${x}-${y}`, url, left: x * TILE - originX, top: y * TILE - originY });
      }
    }
    return out;
  }, [hasGeo, spec.url, view]);

  const zoomBy = useCallback((delta: number) => {
    setView((v) => {
      const z = Math.min(MAX_Z, Math.max(MIN_Z, v.z + delta));
      const k = 2 ** (z - v.z);
      return { z, cx: v.cx * k, cy: v.cy * k };
    });
    setTouched(true);
  }, []);

  const onPointerDown = (e: React.PointerEvent) => {
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    dragRef.current = { x: e.clientX, y: e.clientY, dx: 0, dy: 0 };
    setDrag({ dx: 0, dy: 0 });
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const d = dragRef.current;
    if (!d) return;
    d.dx = e.clientX - d.x;
    d.dy = e.clientY - d.y;
    setDrag({ dx: d.dx, dy: d.dy });
  };

  const onPointerUp = () => {
    const d = dragRef.current;
    dragRef.current = null;
    if (d && (Math.abs(d.dx) > 2 || Math.abs(d.dy) > 2)) {
      setView((v) => ({ ...v, cx: v.cx - d.dx, cy: v.cy - d.dy }));
      setTouched(true);
    }
    setDrag(null);
  };

  useEffect(() => {
    if (!hasGeo) return;
    setView({ z: 5, cx: lonToPx(lng as number, 5), cy: latToPx(lat as number, 5) });
  }, [hasGeo, lat, lng]);

  if (!hasGeo) {
    return (
      <div className="map" style={{ display: 'grid', placeItems: 'center' }}>
        <p style={{ font: '600 11px/1.4 var(--sf)', color: 'var(--label2)', textAlign: 'center', padding: 24 }}>
          Coordonnées indisponibles : la carte ne peut pas être affichée.
        </p>
      </div>
    );
  }

  return (
    <div className="map" aria-label={`Carte de ${name}`} role="img">
      <div
        className="lkdv-pays-map-canvas is-draggable"
        aria-hidden="true"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        style={{ transform: drag ? `translate3d(${drag.dx}px, ${drag.dy}px, 0)` : undefined }}
      >
        {tiles.map((t) => (
          // eslint-disable-next-line @next/next/no-img-element -- tuiles distantes
          <img key={t.key} src={t.url} alt="" width={TILE} height={TILE} style={{ left: t.left, top: t.top }} loading="eager" draggable={false} />
        ))}
        {/* Repère : sa position suit le déplacement et le zoom */}
        <span
          className="lkdv-pays-map-pin"
          style={{
            left: W / 2 + (lonToPx(lng as number, view.z) - view.cx),
            top: H / 2 + (latToPx(lat as number, view.z) - view.cy),
          }}
        >
          <i />
          <em>{capital || name}</em>
        </span>
      </div>

      <div className="lkdv-pays-map-scale" role="group" aria-label="Échelle de la carte">
        <button type="button" className={view.z <= 5 ? 'on' : ''} aria-pressed={view.z <= 5} aria-label="Vue pays" onClick={() => zoomBy(5 - view.z)}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" aria-hidden="true">
            <circle cx="12" cy="12" r="9" />
            <path d="M3.5 9h17M3.5 15h17M12 3c2.5 2.6 3.6 5.6 3.6 9s-1.1 6.4-3.6 9c-2.5-2.6-3.6-5.6-3.6-9S9.5 5.6 12 3Z" />
          </svg>
        </button>
        <button type="button" className={view.z === 7 ? 'on' : ''} aria-pressed={view.z === 7} aria-label="Vue région" onClick={() => zoomBy(7 - view.z)}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" aria-hidden="true">
            <path d="m3 18 5.5-9 4 6 3-4L21 18H3Z" />
          </svg>
        </button>
        <button type="button" className={view.z >= 9 ? 'on' : ''} aria-pressed={view.z >= 9} aria-label="Vue locale" onClick={() => zoomBy(9 - view.z)}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" aria-hidden="true">
            <circle cx="12" cy="12" r="7" />
            <circle cx="12" cy="12" r="2.2" fill="currentColor" stroke="none" />
          </svg>
        </button>
      </div>

      <div className="lkdv-pays-map-ctrls" role="group" aria-label="Contrôles de la carte">
        <button type="button" aria-label="Zoom avant" onClick={() => zoomBy(1)}>
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>
        </button>
        <button type="button" aria-label="Zoom arrière" onClick={() => zoomBy(-1)}>
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" aria-hidden="true"><path d="M5 12h14" /></svg>
        </button>
        <button type="button" aria-label="Recentrer sur le pays" onClick={() => { setView({ z: 5, cx: lonToPx(lng as number, 5), cy: latToPx(lat as number, 5) }); setTouched(false); }}>
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" aria-hidden="true">
            <circle cx="12" cy="12" r="3" /><path d="M12 2v3M12 19v3M2 12h3M19 12h3" />
          </svg>
        </button>
      </div>

      <p className="lkdv-map-attribution">
        <a href="https://www.esri.com" target="_blank" rel="noreferrer noopener">Powered by Esri</a>
        <span aria-hidden="true"> · </span>
        <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer noopener">© OpenStreetMap</a>
      </p>

      {!touched ? <span className="lkdv-pays-map-hint">Glissez pour déplacer</span> : null}
    </div>
  );
}

export default CountryMap;
