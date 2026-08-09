'use client';

import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import dynamic from 'next/dynamic';
import { getCountryCoordinates } from '@/lib/countryCoordinates';
import type { Country } from '@/lib/countries';
import type { GlobeMethods } from 'react-globe.gl';

const Globe = dynamic(() => import('react-globe.gl'), { ssr: false }) as React.ComponentType<any>;

// ── Couleurs polygons par niveau de danger (semi-transparent pour voir le relief) ──
const DANGER_COLORS: Record<string, string> = {
  low: '#2D6A4F',
  medium: '#D97706',
  high: '#DC2626',
};

const CAP_COLORS: Record<string, string> = {
  low: 'rgba(45,106,79,0.55)',
  medium: 'rgba(217,119,6,0.55)',
  high: 'rgba(220,38,38,0.55)',
};

const SIDE_COLORS: Record<string, string> = {
  low: 'rgba(45,106,79,0.2)',
  medium: 'rgba(217,119,6,0.2)',
  high: 'rgba(220,38,38,0.2)',
};

function getFlagEmoji(code: string): string {
  const cps = code.toUpperCase().split('').map(c => 127397 + c.charCodeAt(0));
  return String.fromCodePoint(...cps);
}

function dangerBadge(level: string): string {
  return level === 'low' ? '🟢 Sûr' : level === 'medium' ? '🟡 Vigilance' : '🔴 Risqué';
}

// ── Props ──
interface CountryGlobeProps {
  countries: Country[];
  onCountryClick: (code: string) => void;
  focusCode?: string;
  fullscreen?: boolean;
}

const GEOJSON_URL = 'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_110m_admin_0_countries.geojson';

export default function CountryGlobe({
  countries,
  onCountryClick,
  focusCode,
  fullscreen,
}: CountryGlobeProps) {
  const globeRef = useRef<GlobeMethods | undefined>(undefined);
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 500 });
  const [hoveredD, setHoveredD] = useState<Country | null>(null);
  const hoveredRef = useRef<Country | null>(null);
  const [geoFeatures, setGeoFeatures] = useState<any[]>([]);
  const [geoLoaded, setGeoLoaded] = useState(false);
  const ctrlRef = useRef<any>(null);

  // ── Load GeoJSON Natural Earth ──
  useEffect(() => {
    fetch(GEOJSON_URL)
      .then(r => r.json())
      .then(data => { setGeoFeatures(data.features || []); setGeoLoaded(true); })
      .catch(() => setGeoLoaded(true));
  }, []);

  // ── ResizeObserver ──
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(entries => {
      for (const e of entries) {
        const { width, height } = e.contentRect;
        if (width > 0 && height > 0) setDimensions({ width, height });
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // ── Auto-rotation initiale + DPR mobile (performance) ──
  useEffect(() => {
    if (!geoLoaded || !globeRef.current) return;
    const ctrl = globeRef.current.controls();
    ctrlRef.current = ctrl;
    ctrl.autoRotate = true;
    ctrl.autoRotateSpeed = 0.4;
    try {
      const renderer = globeRef.current.renderer();
      if (renderer && typeof renderer.setPixelRatio === 'function') {
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        renderer.setPixelRatio(dpr);
      }
    } catch (_e) { /* non-critical */ }
  }, [geoLoaded]);

  // ── Focus caméra ──
  useEffect(() => {
    if (!focusCode || !globeRef.current) return;
    const coords = getCountryCoordinates(focusCode);
    if (coords) globeRef.current.pointOfView({ lat: coords.lat, lng: coords.lng, altitude: 1.5 }, 1000);
  }, [focusCode]);

  // ── Fusion GeoJSON × nos données ──
  const polygonsData = useMemo(() => {
    const map = new Map(countries.map(c => [c.code.toUpperCase(), c]));
    return geoFeatures.map((f: any) => {
      const isoA2 = f.properties?.ISO_A2;
      return { ...f, countryData: isoA2 ? map.get(isoA2) : null };
    });
  }, [geoFeatures, countries]);

  // ── Points fallback pour les pays non trouvés dans le GeoJSON ──
  const fallbackPoints = useMemo(() => {
    const matched = new Set(
      polygonsData.filter(p => p.countryData).map(p => p.countryData.code.toUpperCase())
    );
    return countries
      .filter(c => !matched.has(c.code.toUpperCase()))
      .map(c => { const p = getCountryCoordinates(c.code); return { ...c, lat: p?.lat ?? 0, lng: p?.lng ?? 0 }; })
      .filter(d => d.lat !== 0 || d.lng !== 0);
  }, [polygonsData, countries]);

  // ── Handlers ──
  const handlePolygonClick = useCallback((p: any) => {
    if (p?.countryData?.code) {
      if (ctrlRef.current) ctrlRef.current.autoRotate = false;
      onCountryClick(p.countryData.code);
    }
  }, [onCountryClick]);

  const handlePolygonHover = useCallback((hovered: any) => {
    const data = hovered?.countryData || null;
    setHoveredD(data);
    hoveredRef.current = data;
    document.body.style.cursor = hovered ? 'pointer' : 'grab';
  }, []);

  const handleZoom = useCallback(() => {
    if (ctrlRef.current) {
      ctrlRef.current.autoRotate = true;
      ctrlRef.current.autoRotateSpeed = 0.4;
    }
    document.body.style.cursor = hoveredRef.current ? 'pointer' : 'grab';
  }, []);

  // ── Tooltip HTML riche ──
  const polygonLabel = useCallback((d: any) => {
    if (!d?.countryData) return '';
    const c = d.countryData;
    const dc = DANGER_COLORS[c.danger_level] || '#6B7A72';
    return `
<div style="background:rgba(11,31,23,0.92);backdrop-filter:blur(16px);-webkit-backdrop-filter:blur(16px);border-radius:14px;padding:16px 18px;font-family:system-ui,sans-serif;font-size:13px;color:#FBFAF6;box-shadow:0 12px 40px rgba(0,0,0,0.5);border:1px solid rgba(255,255,255,0.08);min-width:200px;max-width:280px;">
  <div style="display:flex;align-items:center;gap:12px;margin-bottom:10px;">
    <span style="font-size:34px;line-height:1;flex-shrink:0;">${getFlagEmoji(c.code)}</span>
    <div>
      <div style="font-weight:700;font-size:17px;color:#fff;line-height:1.2;">${c.nom}</div>
      <div style="color:rgba(255,255,255,0.45);font-size:11px;margin-top:2px;">${c.capital} · ${c.continent}</div>
    </div>
  </div>
  <div style="display:flex;gap:6px;margin-bottom:8px;flex-wrap:wrap;">
    <span style="padding:3px 10px;border-radius:999px;font-size:10px;font-weight:500;background:rgba(255,255,255,0.08);color:rgba(255,255,255,0.65);">📅 ${c.meilleure_saison}</span>
    <span style="padding:3px 10px;border-radius:999px;font-size:10px;font-weight:500;background:rgba(255,255,255,0.08);color:rgba(255,255,255,0.65);">💰 ${c.monnaie}</span>
  </div>
  <div style="display:flex;justify-content:space-between;align-items:center;">
    <span style="padding:4px 12px;border-radius:999px;font-size:10px;font-weight:600;border:1px solid ${dc}44;color:#FBFAF6;background:${dc}22;">
      ${dangerBadge(c.danger_level)}
    </span>
    <span style="font-size:10px;color:rgba(255,255,255,0.3);">Cliquer →</span>
  </div>
</div>`;
  }, []);

  return (
    <div
      ref={containerRef}
      onMouseDown={() => { document.body.style.cursor = 'grabbing'; }}
      onMouseUp={() => { document.body.style.cursor = hoveredRef.current ? 'pointer' : 'grab'; }}
      style={{
        width: '100%',
        height: fullscreen ? '100%' : '500px',
        position: 'relative',
        borderRadius: fullscreen ? 0 : '16px',
        overflow: 'hidden',
        background: '#0B1F17',
        cursor: 'grab',
        touchAction: 'none',
        WebkitTapHighlightColor: 'transparent',
      }}
    >
      {typeof window !== 'undefined' && geoLoaded && (
        <Globe
          ref={globeRef}
          width={dimensions.width}
          height={dimensions.height}
          globeImageUrl="//unpkg.com/three-globe/example/img/earth-blue-marble.jpg"
          bumpImageUrl="//unpkg.com/three-globe/example/img/earth-topology.png"
          backgroundColor="#0B1F17"
          showAtmosphere
          atmosphereColor="#A8C8A0"
          atmosphereAltitude={0.25}
          showGraticules={false}

          // ── Polygones pays ──
          polygonsData={polygonsData}
          polygonCapColor={(d: any) =>
            d.countryData ? (CAP_COLORS[d.countryData.danger_level] || 'rgba(107,122,114,0.25)') : 'rgba(255,255,255,0.015)'
          }
          polygonSideColor={(d: any) =>
            d.countryData ? (SIDE_COLORS[d.countryData.danger_level] || 'rgba(107,122,114,0.1)') : 'rgba(255,255,255,0.005)'
          }
          polygonAltitude={(d: any) => (d.countryData ? 0.008 : 0)}
          polygonStrokeColor={() => 'rgba(255,255,255,0.05)'}
          polygonLabel={polygonLabel}
          onPolygonClick={handlePolygonClick}
          onPolygonHover={handlePolygonHover}

          // ── Points fallback ──
          pointsData={fallbackPoints}
          pointLat="lat"
          pointLng="lng"
          pointColor={() => 'rgba(255,255,255,0.2)'}
          pointRadius={() => 0.35}
          pointResolution={8}
          pointsMerge
          pointAltitude={() => 0.01}

          // ── Caméra ──
          onZoom={handleZoom}
        />
      )}

      {/* Label flottant au survol */}
      {hoveredD && (
        <div
          style={{
            position: 'absolute',
            bottom: 16,
            left: '50%',
            transform: 'translateX(-50%)',
            background: 'rgba(11,31,23,0.85)',
            backdropFilter: 'blur(14px)',
            WebkitBackdropFilter: 'blur(14px)',
            borderRadius: 12,
            padding: '8px 20px',
            color: '#FBFAF6',
            fontSize: 13,
            fontWeight: 600,
            pointerEvents: 'none',
            whiteSpace: 'nowrap',
            border: '1px solid rgba(255,255,255,0.08)',
            zIndex: 10,
          }}
        >
          {getFlagEmoji(hoveredD.code)} {hoveredD.nom} — {hoveredD.capital}
        </div>
      )}
    </div>
  );
}
