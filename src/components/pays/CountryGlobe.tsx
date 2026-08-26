'use client';

import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import dynamic from 'next/dynamic';
import { getCountryCoordinates } from '@/lib/countryCoordinates';
import type { Country } from '@/lib/countries';
import { DANGER_FILL, DANGER_CAP, DANGER_SIDE } from '@/lib/pays/danger';
import type { GlobeMethods } from 'react-globe.gl';

const Globe = dynamic(() => import('react-globe.gl'), { ssr: false }) as any;

const INACTIVE_CAP = 'rgba(255,255,255,0.015)';
const INACTIVE_SIDE = 'rgba(255,255,255,0.005)';

/**
 * Résout le code ISO A2 d'un feature Natural Earth.
 * Certains pays (France, Norvège…) ont ISO_A2='-99' dans le GeoJSON 110m
 * (fusion métropole + dépendances) → fallback sur ISO_A2_EH / WB_A2 / ADM0_A3.
 */
function resolveIsoA2(props: any): string | null {
  if (!props) return null;
  const candidates = [props.ISO_A2, props.ISO_A2_EH, props.WB_A2, props.ADM0_A3];
  for (const c of candidates) {
    if (c && c !== '-99' && c !== '-3' && c !== '' && String(c).length === 2) return String(c);
  }
  return null;
}

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
  /** Sélection (aperçu) — remplace la navigation directe quand fourni. */
  onCountrySelect?: (country: Country) => void;
  /** Focus caméra sur un code pays (ex. recherche mobile). */
  focusCode?: string;
  /** Focus caméra sur un point (lat, lng) — ex. zoom continent. */
  focusPoint?: [number, number] | null;
  fullscreen?: boolean;
  /** Mode uniforme : tous les pays en couleurs neutres Sage/Stone, sans badge danger. */
  uniform?: boolean;
}

const GEOJSON_URL = 'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_110m_admin_0_countries.geojson';

export default function CountryGlobe({
  countries,
  onCountryClick,
  onCountrySelect,
  focusCode,
  focusPoint,
  fullscreen,
  uniform,
}: CountryGlobeProps) {
  const globeRef = useRef<GlobeMethods | undefined>(undefined);
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 500 });
  const [hoveredD, setHoveredD] = useState<Country | null>(null);
  const hoveredRef = useRef<Country | null>(null);
  const [geoFeatures, setGeoFeatures] = useState<any[]>([]);
  const [geoLoaded, setGeoLoaded] = useState(false);
  const [isGlobeReady, setIsGlobeReady] = useState(false);
  const ctrlRef = useRef<any>(null);

  // Respecte prefers-reduced-motion : pas d'auto-rotation pour les utilisateurs sensibles
  const prefersReducedMotion = useMemo(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return false;
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }, []);

  // ── Matériau « verre très léger » : sphère translucide très subtile ──
  const glassMaterial = useMemo(() => {
    if (typeof window === 'undefined') return undefined;
    try {
      const THREE = (require('three') as any).default || require('three');
      return new THREE.MeshPhongMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.06,
        depthWrite: false,
        side: THREE.FrontSide,
      });
    } catch {
      return undefined;
    }
  }, []);

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
        if (width > 0 && height > 0) setDimensions(p => p.width === width && p.height === height ? p : { width, height });
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // ── Auto-rotation initiale + DPR mobile (performance) ──
  useEffect(() => {
    if (!isGlobeReady || !globeRef.current) return;
    if (typeof globeRef.current.controls !== 'function') return;
    const ctrl = globeRef.current.controls();
    ctrlRef.current = ctrl;
    if (!prefersReducedMotion) {
      ctrl.autoRotate = true;
      ctrl.autoRotateSpeed = 0.4;
    }
    try {
      const renderer = globeRef.current.renderer();
      if (renderer && typeof renderer.setPixelRatio === 'function') {
        const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
        const dpr = isMobile ? 1 : Math.min(window.devicePixelRatio || 1, 1.5);
        renderer.setPixelRatio(dpr);
      }
    } catch (_e) { /* non-critical */ }
    // Initial camera view to prevent overlaps and keep globe centered/uncrowded
    try {
      const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
      if (typeof globeRef.current.pointOfView === 'function') {
        globeRef.current.pointOfView({ lat: 20, lng: 10, altitude: isMobile ? 2.5 : 2.2 }, 0);
      }
    } catch (_e) { /* non-critical */ }
  }, [isGlobeReady, prefersReducedMotion]);

  // ── Focus caméra ──
  useEffect(() => {
    if (!isGlobeReady || !globeRef.current) return;
    if (focusPoint) {
      const [lat, lng] = focusPoint;
      if (typeof globeRef.current.pointOfView === 'function') globeRef.current.pointOfView({ lat, lng, altitude: 1.1 }, 1200);
      return;
    }
    if (!focusCode) return;
    const coords = getCountryCoordinates(focusCode);
    if (coords && typeof globeRef.current.pointOfView === 'function') globeRef.current.pointOfView({ lat: coords.lat, lng: coords.lng, altitude: 1.5 }, 1000);
  }, [isGlobeReady, focusCode, focusPoint]);

  // ── Fusion GeoJSON × nos données (résolution ISO robuste) ──
  const polygonsData = useMemo(() => {
    const map = new Map(countries.map(c => [c.code.toUpperCase(), c]));
    return geoFeatures.map((f: any) => {
      const iso = resolveIsoA2(f?.properties);
      const countryData = iso ? map.get(iso) : null;
      return { ...f, countryData };
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
      if (onCountrySelect) {
        onCountrySelect(p.countryData);
      } else {
        onCountryClick(p.countryData.code);
      }
    }
  }, [onCountryClick, onCountrySelect]);

  const handlePolygonHover = useCallback((hovered: any) => {
    const data = hovered?.countryData || null;
    setHoveredD(data);
    hoveredRef.current = data;
    document.body.style.cursor = hovered ? 'pointer' : 'grab';
  }, []);

  const handleZoom = useCallback(() => {
    if (ctrlRef.current && !prefersReducedMotion) {
      ctrlRef.current.autoRotate = true;
      ctrlRef.current.autoRotateSpeed = 0.4;
    }
    document.body.style.cursor = hoveredRef.current ? 'pointer' : 'grab';
  }, [prefersReducedMotion]);

  // ── Tooltip HTML riche — même design que la fiche pays (Liquid Glass) ──
  const polygonLabel = useCallback((d: any) => {
    if (!d?.countryData) return '';
    const c = d.countryData;
    const dc = DANGER_FILL[c.danger_level as Country['danger_level']] || '#A6C1A0';
    const dangerBadgeHtml = uniform ? '' : `
    <span style="padding:3px 11px;border-radius:999px;font-size:10px;font-weight:700;border:1px solid ${dc}66;color:#17402C;background:${dc}22;">
      ${dangerBadge(c.danger_level)}
    </span>`;
    return `
<div style="background:rgba(255,255,255,0.55);backdrop-filter:blur(20px) saturate(180%);-webkit-backdrop-filter:blur(20px) saturate(180%);border-radius:16px;padding:14px 16px;font-family:var(--font-sans, system-ui),sans-serif;font-size:12px;color:#17402C;box-shadow:0 20px 44px -12px rgba(23,64,44,0.28), inset 0 1.5px 1px 0 rgba(255,255,255,0.85);border:1px solid rgba(255,255,255,0.5);min-width:210px;max-width:270px;line-height:1.35;">
  <div style="display:flex;align-items:center;gap:11px;margin-bottom:10px;">
    <span style="font-size:32px;line-height:1;flex-shrink:0;">${getFlagEmoji(c.code)}</span>
    <div style="min-width:0;">
      <div style="font-family:var(--font-display, system-ui),sans-serif;font-weight:700;font-size:15px;color:#17402C;line-height:1.15;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${c.nom}</div>
      <div style="color:#5A7064;font-size:11px;margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${c.capital} · ${c.continent}</div>
    </div>
  </div>
  <div style="display:flex;gap:6px;margin-bottom:9px;flex-wrap:wrap;">
    <span style="padding:3px 10px;border-radius:999px;font-size:10px;font-weight:600;background:rgba(23,64,44,0.06);border:1px solid rgba(23,64,44,0.10);color:#365233;">📅 ${c.meilleure_saison}</span>
    <span style="padding:3px 10px;border-radius:999px;font-size:10px;font-weight:600;background:rgba(23,64,44,0.06);border:1px solid rgba(23,64,44,0.10);color:#365233;">💰 ${c.monnaie}</span>
  </div>
  <div style="display:flex;justify-content:space-between;align-items:center;border-top:1px solid rgba(23,64,44,0.08);padding-top:8px;">
    ${dangerBadgeHtml}
    <span style="font-size:10px;font-weight:700;color:#17402C;">Cliquer pour explorer →</span>
  </div>
</div>`;
  }, [uniform]);

  return (
    <div
      ref={containerRef}
      onMouseDown={() => { document.body.style.cursor = 'grabbing'; }}
      onMouseUp={() => { document.body.style.cursor = hoveredRef.current ? 'pointer' : 'grab'; }}
      style={{
        width: '100%',
        height: '100%',
        position: 'relative',
        borderRadius: fullscreen ? 0 : '16px',
        overflow: 'hidden',
        background: 'transparent',
        cursor: 'grab',
        touchAction: 'none',
        WebkitTapHighlightColor: 'transparent',
      }}
    >
      <Globe
          ref={globeRef}
          width={dimensions.width}
          height={dimensions.height}
          globeImageUrl="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=="
          bumpImageUrl="https://unpkg.com/three-globe/example/img/earth-topology.png"
          globeMaterial={glassMaterial}
          backgroundColor="rgba(0,0,0,0)"
          showAtmosphere
          atmosphereColor="#A6C1A0"
          atmosphereAltitude={0.22}
          showGraticules={false}

          // ── Polygones pays ──
          polygonsData={polygonsData}
          polygonCapColor={(d: any) =>
            d.countryData ? (uniform ? 'rgba(91,127,85,0.35)' : (DANGER_CAP[d.countryData.danger_level as Country['danger_level']] || 'rgba(91,127,85,0.35)')) : INACTIVE_CAP
          }
          polygonSideColor={(d: any) =>
            d.countryData ? (uniform ? 'rgba(91,127,85,0.18)' : (DANGER_SIDE[d.countryData.danger_level as Country['danger_level']] || 'rgba(91,127,85,0.18)')) : INACTIVE_SIDE
          }
          polygonAltitude={(d: any) => (d.countryData ? 0.012 : 0)}
          polygonStrokeColor={() => 'rgba(255,255,255,0.28)'}
          polygonLabel={polygonLabel}
          onPolygonClick={handlePolygonClick}
          onPolygonHover={handlePolygonHover}

          // ── Points fallback ──
          pointsData={fallbackPoints}
          pointLat="lat"
          pointLng="lng"
          pointColor={() => 'rgba(166,193,160,0.75)'}
          pointRadius={() => 0.5}
          pointResolution={8}
          pointsMerge
          pointAltitude={() => 0.012}

          // ── Caméra ──
          onZoom={handleZoom}
          onGlobeReady={() => setTimeout(() => setIsGlobeReady(true), 0)}
        />

      {/* Spinner pendant le chargement du GeoJSON (jamais d'écran vide) */}
      {!geoLoaded && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 12,
            background: 'transparent',
            zIndex: 5,
            pointerEvents: 'none',
          }}
        >
          <div
            className="w-8 h-8 rounded-full border-[3px] border-[#17402C] border-t-transparent animate-spin"
            style={{ animationDuration: '0.8s' }}
          />
          <span style={{ fontSize: 11, fontFamily: 'var(--lkv-font-mono, monospace)', fontWeight: 700, color: '#17402C', letterSpacing: '0.06em' }}>
            Chargement des pays…
          </span>
        </div>
      )}
    </div>
  );
}