'use client';
import React, { useEffect, useRef, useState, useCallback } from 'react';
import 'leaflet/dist/leaflet.css';
import type { Map as LeafletMap } from 'leaflet';
import type { MapTrail } from './types';
import { toValidLatLng } from './types';
import TrailLayer from './TrailLayer';

import type { UnifiedPOI } from '@/lib/queries/pois';

interface ExplorerMapProps {
  trails: MapTrail[];
  pois?: UnifiedPOI[];
  selectedTrailId: string | null;
  onTrailClick: (trail: MapTrail) => void;
  onPoiClick?: (poi: UnifiedPOI) => void;
  userLocation?: [number, number] | null;
  userPositions?: Array<{ latitude: number; longitude: number }>;
  userAccuracy?: number | null;
  headingDeg?: number | null;
  progressFrac?: number | null;
  autoFollow?: boolean;
  onAutoFollowChange?: (enabled: boolean) => void;
  onMapReady?: () => void;
  onLocationUpdate?: (loc: [number, number]) => void;
  onViewportChange?: (bbox: { minLat: number; maxLat: number; minLng: number; maxLng: number; zoom: number }) => void;
  controlsPosition?: 'left' | 'right';
  /** Mode compact : contrôles réduits, plaqués aux bords, sans chevauchement (mobile). */
  compact?: boolean;
  /** Désactive la géolocalisation automatique au montage (ex. cockpit départ). */
  disableGeolocate?: boolean;
  /**
   * Position sûre des contrôles : jamais sous la bottom bar mobile ni derrière
   * la liste flottante desktop. Mobile → haut sous le header ; desktop → colonne droite.
   */
  safeControls?: boolean;
}

const TOPO_TILE = {
  url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}',
  attribution: '&copy; <a href="https://www.esri.com">Esri</a>, USGS, NOAA',
};

const OSM_TILE = {
  url: 'https://{s}.tile.openstreetmap.fr/osmfr/{z}/{x}/{y}.png',
  attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors | <a href="https://www.openstreetmap.fr">OSM France</a>',
};

const SATELLITE_TILE = {
  url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
  attribution: '&copy; <a href="https://www.esri.com">Esri</a>, Earthstar Geographics',
};

type TileMode = 'topo' | 'osm' | 'satellite';
type LocationState = 'idle' | 'locating' | 'located' | 'denied' | 'unavailable';

export default function ExplorerMap({
  trails,
  pois,
  selectedTrailId,
  onTrailClick,
  onPoiClick,
  userLocation,
  userPositions,
  userAccuracy = null,
  headingDeg,
  progressFrac = null,
  autoFollow = true,
  onAutoFollowChange,
  onMapReady,
  onLocationUpdate,
  onViewportChange,
  controlsPosition = 'left',
  compact = false,
  disableGeolocate = false,
  safeControls = false,
}: ExplorerMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const tileLayerRef = useRef<ReturnType<typeof import('leaflet')['tileLayer']> | null>(null);
  const userMarkerRef = useRef<import('leaflet').Marker | null>(null);
  const accuracyCircleRef = useRef<import('leaflet').Circle | null>(null);

  // Auto-compact sur mobile (toutes les instances de la carte)
  const [isAutoCompact, setIsAutoCompact] = useState(false);
  useEffect(() => {
    const check = () => setIsAutoCompact(typeof window !== 'undefined' && window.innerWidth < 768);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);
  // Uniformité : le même jeu de boutons compact que « Préparer la randonnée », partout.
  const effectiveCompact = true;

  // Position sûre des contrôles de carte :
  // Sur mobile : toujours en haut sous le header flottant (jamais sous le carousel ni la bottom bar)
  // Sur desktop : colonne droite haute dégagée
  const controlPos = isAutoCompact
    ? { zoom: 'left-3 top-[calc(env(safe-area-inset-top,0px)+68px)]', tiles: 'right-3 top-[calc(env(safe-area-inset-top,0px)+68px)]' }
    : { zoom: 'right-4 top-[84px]', tiles: 'right-4 top-[152px]' };
  const userTrackPolylineRef = useRef<import('leaflet').Polyline | null>(null);
  const userDraggingRef = useRef(false);

  const [mapInstance, setMapInstance] = useState<LeafletMap | null>(null);
  const [tileMode, setTileMode] = useState<TileMode>('topo');
  const [mapReady, setMapReady] = useState(false);
  const [locationState, setLocationState] = useState<LocationState>('idle');
  const [isUserPanned, setIsUserPanned] = useState(false);
  const geoAttemptedRef = useRef(false);

  const handleRecenter = useCallback(() => {
    userDraggingRef.current = false;
    setIsUserPanned(false);
    onAutoFollowChange?.(true);

    let targetLoc: [number, number] | null = userLocation ? toValidLatLng(userLocation[0], userLocation[1]) : null;
    if (!targetLoc && userPositions && userPositions.length > 0) {
      const lastP = userPositions[userPositions.length - 1];
      targetLoc = toValidLatLng(lastP?.latitude, lastP?.longitude);
    }

    if (targetLoc && mapRef.current && (mapRef.current as any)._loaded) {
      try {
        mapRef.current.flyTo(targetLoc, 16, { animate: true, duration: 1.0 });
      } catch (err) {
        console.warn('[ExplorerMap] recenter flyTo error:', err);
      }
    }
  }, [userLocation, userPositions, onAutoFollowChange]);

  const handleTileChange = (mode: TileMode) => {
    setTileMode(mode);
  };

  const handleZoomIn = () => {
    if (mapRef.current && (mapRef.current as any)._loaded) {
      mapRef.current.zoomIn();
    }
  };

  const handleZoomOut = () => {
    if (mapRef.current && (mapRef.current as any)._loaded) {
      mapRef.current.zoomOut();
    }
  };

  const onViewportChangeRef = useRef(onViewportChange);
  onViewportChangeRef.current = onViewportChange;
  const onMapReadyRef = useRef(onMapReady);
  onMapReadyRef.current = onMapReady;
  const onLocationUpdateRef = useRef(onLocationUpdate);
  onLocationUpdateRef.current = onLocationUpdate;

  // Initialize Leaflet map instance — UNIQUE INITIALIZATION ON MOUNT
  useEffect(() => {
    if (!containerRef.current || mapRef.current || typeof window === 'undefined') return;

    import('leaflet').then((LModule) => {
      const L = (LModule as any).default || LModule;
      if (!containerRef.current || mapRef.current) return;
      if ((containerRef.current as any)?._leaflet_id) {
        (containerRef.current as any)._leaflet_id = null;
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      delete (L.Icon.Default.prototype as any)._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
        iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
        shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
      });

      const initialCenter: [number, number] = userLocation ? toValidLatLng(userLocation[0], userLocation[1]) || [45.9237, 6.8694] : [45.9237, 6.8694];

      const map = L.map(containerRef.current!, {
        center: initialCenter,
        zoom: 14,
        zoomControl: false,
        attributionControl: false,
        dragging: true,
        touchZoom: true,
        scrollWheelZoom: true,
        doubleClickZoom: true,
        boxZoom: true,
        keyboard: true,
        tap: false,
        // GPU canvas — plus rapide sur mobile bas de gamme, évite les repaints SVG
        preferCanvas: true,
      });

      L.control.attribution({ prefix: false }).addAttribution('© OSM France').addTo(map);

      const handleUserMove = () => {
        userDraggingRef.current = true;
        setIsUserPanned(true);
        onAutoFollowChange?.(false);
      };

      map.on('dragstart', handleUserMove);
      map.on('movestart', (e: any) => {
        if (e.originalEvent) {
          handleUserMove();
        }
      });
      map.on('dragend', () => {
        userDraggingRef.current = false;
      });

      const initialCfg = TOPO_TILE;
      const tile = L.tileLayer(initialCfg.url, {
        attribution: initialCfg.attribution,
        maxZoom: 18,
        maxNativeZoom: 18,
        keepBuffer: 6,
      });
      tile.addTo(map);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      tileLayerRef.current = tile as any;

      mapRef.current = map;
      setMapInstance(map);
      setMapReady(true);
      onMapReadyRef.current?.();

      let debounceTimer: NodeJS.Timeout | null = null;
      const notifyViewport = () => {
        if (!mapRef.current) return;
        const bounds = map.getBounds();
        const zoom = map.getZoom();
        const latSpan = bounds.getNorth() - bounds.getSouth();
        const lngSpan = bounds.getEast() - bounds.getWest();
        const bufferLat = latSpan * 0.25;
        const bufferLng = lngSpan * 0.25;
        onViewportChangeRef.current?.({
          minLat: bounds.getSouth() - bufferLat,
          maxLat: bounds.getNorth() + bufferLat,
          minLng: bounds.getWest() - bufferLng,
          maxLng: bounds.getEast() + bufferLng,
          zoom,
        });
      };

      const handleMoveEnd = () => {
        if (debounceTimer) clearTimeout(debounceTimer);
        debounceTimer = setTimeout(notifyViewport, 300);
      };

      map.on('moveend', handleMoveEnd);
      map.on('zoomend', handleMoveEnd);

      // Ensure immediate sizing and initial viewport notification
      setTimeout(() => {
        try {
          map.invalidateSize();
          notifyViewport();
        } catch { /* ignore */ }
      }, 150);
      setTimeout(() => {
        try { map.invalidateSize(); } catch { /* ignore */ }
      }, 400);
    });

    return () => {
      if (mapRef.current) {
        try { mapRef.current.remove(); } catch { /* ignore */ }
        mapRef.current = null;
      }
      if (containerRef.current) {
        (containerRef.current as any)._leaflet_id = null;
      }
      setMapInstance(null);
      setMapReady(false);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ResizeObserver for dynamic layout size changes
  useEffect(() => {
    if (!containerRef.current || !mapRef.current || !mapReady) return;
    const observer = new ResizeObserver(() => {
      if (mapRef.current && (mapRef.current as any)._loaded) {
        try {
          mapRef.current.invalidateSize();
        } catch { /* ignore */ }
      }
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, [mapReady]);

  // Auto-geolocation on mount — désactivé si disableGeolocate (ex. cockpit départ)
  useEffect(() => {
    if (!mapReady || geoAttemptedRef.current || disableGeolocate) return;
    geoAttemptedRef.current = true;

    if (!navigator.geolocation) {
      setLocationState('unavailable');
      return;
    }

    setLocationState('locating');
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { longitude, latitude } = position.coords;
        const validPos = toValidLatLng(latitude, longitude);
        if (validPos && mapRef.current) {
          setLocationState('located');
          onLocationUpdate?.(validPos);
          // Only fly on startup if the user hasn't already started panning or dragging
          if (!isUserPanned && !userDraggingRef.current && mapRef.current && (mapRef.current as any)._loaded) {
            try {
              mapRef.current.flyTo(validPos, 14, { duration: 1.2 });
            } catch (err) {
              console.warn('[ExplorerMap] flyTo position error:', err);
            }
          }
        }
      },
      () => {
        setLocationState('denied');
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  }, [mapReady, onLocationUpdate, disableGeolocate, isUserPanned]);

  // Switch tile layer
  useEffect(() => {
    if (!mapRef.current || !mapReady) return;
    import('leaflet').then((LModule) => {
      const L = (LModule as any).default || LModule;
      if (tileLayerRef.current) {
        try { mapRef.current!.removeLayer(tileLayerRef.current as unknown as import('leaflet').Layer); } catch { /* ignore */ }
      }
      const cfg = tileMode === 'topo' ? TOPO_TILE : tileMode === 'satellite' ? SATELLITE_TILE : OSM_TILE;
      const tile = L.tileLayer(cfg.url, {
        attribution: cfg.attribution,
        maxZoom: 18,
        maxNativeZoom: 18,
        keepBuffer: 6,
      });
      tile.addTo(mapRef.current!);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      tileLayerRef.current = tile as any;
    });
  }, [tileMode, mapReady]);

  // User location marker & accuracy circle
  useEffect(() => {
    const validLoc = userLocation ? toValidLatLng(userLocation[0], userLocation[1]) : null;
    if (!mapRef.current || !mapReady || !validLoc) return;
    import('leaflet').then((LModule) => {
      const L = (LModule as any).default || LModule;
      if (userMarkerRef.current) {
        try { mapRef.current!.removeLayer(userMarkerRef.current); } catch { /* ignore */ }
      }
      if (accuracyCircleRef.current) {
        try { mapRef.current!.removeLayer(accuracyCircleRef.current); } catch { /* ignore */ }
      }

      if (userAccuracy != null && Number.isFinite(userAccuracy) && userAccuracy > 0) {
        const circle = L.circle(validLoc, {
          radius: Math.min(200, userAccuracy),
          color: userAccuracy > 30 ? '#f59e0b' : '#2D5A27',
          fillColor: userAccuracy > 30 ? '#f59e0b' : '#2D5A27',
          fillOpacity: 0.15,
          weight: 1,
        });
        circle.addTo(mapRef.current!);
        accuracyCircleRef.current = circle;
      }

      const heading = headingDeg != null && Number.isFinite(headingDeg) && headingDeg >= 0 && headingDeg < 360
        ? Math.round(headingDeg)
        : null;

      const html = heading != null
        ? `<div style="position:relative;width:20px;height:20px">
             <div style="position:absolute;inset:0;background:#17402C;border:3px solid #8BAF7C;border-radius:50%;box-shadow:0 0 0 4px rgba(23,64,44,0.3)"></div>
             <svg width="18" height="18" viewBox="0 0 24 24" style="position:absolute;top:1px;left:1px;transform:rotate(${heading}deg);transform-origin:center">
               <path d="M12 2 L7 22 L12 17 L17 22 Z" fill="#17402C" stroke="#FBFAF6" stroke-width="1.5"/>
             </svg>
           </div>`
        : `<div style="width:16px;height:16px;background:#17402C;border:3px solid #8BAF7C;border-radius:50%;box-shadow:0 0 0 4px rgba(23,64,44,0.3)"></div>`;

      const icon = L.divIcon({
        html,
        className: '',
        iconSize: heading != null ? [20, 20] : [16, 16],
        iconAnchor: heading != null ? [10, 10] : [8, 8],
      });
      const marker = L.marker(validLoc, { icon });
      marker.addTo(mapRef.current!);
      userMarkerRef.current = marker;

      if (!isUserPanned && !userDraggingRef.current && mapRef.current && (mapRef.current as any)._loaded && !disableGeolocate) {
        try {
          mapRef.current.flyTo(validLoc, 14, { duration: 1.0 });
        } catch { /* ignore */ }
      }
    });
  }, [userLocation, userAccuracy, headingDeg, mapReady, isUserPanned, disableGeolocate]);

  // Live GPS Track Polyline (from userPositions)
  useEffect(() => {
    if (!mapRef.current || !mapReady || !userPositions || userPositions.length < 2) return;
    import('leaflet').then((LModule) => {
      const L = (LModule as any).default || LModule;
      const validLatLngs: [number, number][] = [];
      for (const p of userPositions) {
        const pt = toValidLatLng(p?.latitude, p?.longitude);
        if (pt) validLatLngs.push(pt);
      }
      if (validLatLngs.length < 2) return;

      if (userTrackPolylineRef.current) {
        userTrackPolylineRef.current.setLatLngs(validLatLngs);
      } else {
        const polyline = L.polyline(validLatLngs, {
          color: '#ef4444',
          weight: 5,
          opacity: 0.9,
          lineCap: 'round',
          lineJoin: 'round',
        });
        polyline.addTo(mapRef.current!);
        userTrackPolylineRef.current = polyline;
      }
    });
  }, [userPositions, mapReady]);

  // Live GPS Turn-by-Turn auto-following (only when actively tracking route positions)
  useEffect(() => {
    if (!mapRef.current || !mapReady || isUserPanned || userDraggingRef.current || !userPositions || userPositions.length < 2) return;

    let targetLoc: [number, number] | null = null;
    for (let i = userPositions.length - 1; i >= 0; i--) {
      const pt = toValidLatLng(userPositions[i]?.latitude, userPositions[i]?.longitude);
      if (pt) {
        targetLoc = pt;
        break;
      }
    }
    if (!targetLoc) return;

    try {
      if (mapRef.current && (mapRef.current as any)._loaded) {
        const center = mapRef.current.getCenter();
        const distDeg = Math.hypot(center.lat - targetLoc[0], center.lng - targetLoc[1]);
        if (distDeg > 0.00001) {
          mapRef.current.panTo(targetLoc, { animate: true, duration: 0.8, easeLinearity: 0.25 });
        }
      }
    } catch (e) {
      console.warn('[ExplorerMap] panTo autoFollow error:', e);
    }
  }, [userPositions, mapReady, isUserPanned]);

  // Automatic map rotation based on orientation / movement heading
  useEffect(() => {
    if (!mapRef.current || !mapReady) return;
    const mapPane = mapRef.current.getPane('mapPane');
    if (!mapPane) return;

    const heading = headingDeg != null && Number.isFinite(headingDeg) && headingDeg >= 0 && headingDeg < 360
      ? Math.round(headingDeg)
      : 0;

    mapPane.style.transition = 'transform 0.4s ease-out';
    mapPane.style.transformOrigin = 'center center';
    mapPane.style.transform = heading !== 0 ? `rotate(${-heading}deg)` : 'none';
  }, [headingDeg, mapReady]);

  // Auto-zoom to selected trail
  const fitToTrail = useCallback((trail: MapTrail) => {
    if (!mapRef.current || !trail) return;
    const pt = toValidLatLng(trail.lat, trail.lng);
    if (!pt || !Number.isFinite(pt[0]) || !Number.isFinite(pt[1])) return;

    const [lat, lng] = pt;
    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return;

    if (mapRef.current && (mapRef.current as any)._loaded && Number.isFinite(lat) && Number.isFinite(lng)) {
      try {
        mapRef.current.flyTo([lat, lng], 14, { animate: true, duration: 1.2 });
      } catch (e) {
        console.warn('[ExplorerMap] flyTo trail error:', e);
      }
    }
  }, []);

  const prevSelectedIdRef = useRef<string | null>(null);
  useEffect(() => {
    if (!selectedTrailId || !mapReady) {
      prevSelectedIdRef.current = selectedTrailId;
      return;
    }
    if (prevSelectedIdRef.current !== selectedTrailId) {
      prevSelectedIdRef.current = selectedTrailId;
      const trail = trails.find((t) => String(t.id) === String(selectedTrailId));
      if (trail) fitToTrail(trail);
    }
  }, [selectedTrailId, trails, mapReady, fitToTrail]);

  const handleManualLocate = () => {
    if (!navigator.geolocation || !mapRef.current) return;
    setLocationState('locating');
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { longitude, latitude } = position.coords;
        const validPos = toValidLatLng(latitude, longitude);
        if (validPos && mapRef.current && (mapRef.current as any)._loaded) {
          setLocationState('located');
          onLocationUpdate?.(validPos);
          try {
            mapRef.current.flyTo(validPos, 14, { duration: 1.0 });
          } catch (err) {
            console.warn('[ExplorerMap] flyTo position error:', err);
          }
        }
      },
      () => setLocationState('denied'),
      { enableHighAccuracy: true, timeout: 8000 }
    );
  };

  return (
    <div className="relative w-full h-full bg-[#EAE6DF] overflow-hidden select-none" style={{ width: '100%', height: '100%', touchAction: 'none' }}>
      <div ref={containerRef} className="w-full h-full z-0" style={{ width: '100%', height: '100%', touchAction: 'none' }} />

      {mapReady && mapInstance && (trails.length > 0 || (pois && pois.length > 0)) && (
        <TrailLayer map={mapInstance} trails={trails} pois={pois} selectedTrailId={selectedTrailId} onTrailClick={onTrailClick} onPoiClick={onPoiClick} />
      )}

      {/* 1. Sélecteur de Calques (Top Right sous la barre de recherche) */}
      <div className="absolute z-[400] pointer-events-auto right-3.5 top-[calc(env(safe-area-inset-top,0px)+60px)] md:top-auto md:right-4 md:bottom-6">
        <div
          className="flex items-center gap-1 p-1 rounded-full shadow-lg"
          style={{
            background: 'linear-gradient(180deg, rgba(240, 237, 228, 0.94) 0%, rgba(225, 221, 208, 0.84) 100%)',
            backdropFilter: 'blur(16px) saturate(180%)',
            WebkitBackdropFilter: 'blur(16px) saturate(180%)',
            border: '1.5px solid rgba(255, 255, 255, 0.88)',
            boxShadow: '0 8px 32px -4px rgba(23, 64, 44, 0.12), inset 0 1.5px 2px rgba(255, 255, 255, 0.95)',
          }}
        >
          <button
            type="button"
            onClick={() => handleTileChange('osm')}
            title="Carte standard (Plan)"
            aria-label="Carte standard (Plan)"
            className={`w-8.5 h-8.5 rounded-full flex items-center justify-center transition-all cursor-pointer active:scale-95 ${
              tileMode === 'osm'
                ? 'glass-circle-btn primary !text-white shadow-xs'
                : 'hover:bg-white/60 text-[#17402C]'
            }`}
          >
            <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24">
              <path d="M3 6l6-3 6 3 6-3v12l-6 3-6-3-6 3V6z"></path>
              <path d="M9 3v12"></path>
              <path d="M15 6v12"></path>
            </svg>
          </button>
          <button
            type="button"
            onClick={() => handleTileChange('topo')}
            title="Relief / Topographie"
            aria-label="Relief / Topographie"
            className={`w-8.5 h-8.5 rounded-full flex items-center justify-center transition-all cursor-pointer active:scale-95 ${
              tileMode === 'topo'
                ? 'glass-circle-btn primary !text-white shadow-xs'
                : 'hover:bg-white/60 text-[#17402C]'
            }`}
          >
            <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24">
              <path d="M8 3l4 8 5-5 5 15H2L8 3z"></path>
            </svg>
          </button>
          <button
            type="button"
            onClick={() => handleTileChange('satellite')}
            title="Vue Satellite"
            aria-label="Vue Satellite"
            className={`w-8.5 h-8.5 rounded-full flex items-center justify-center transition-all cursor-pointer active:scale-95 ${
              tileMode === 'satellite'
                ? 'glass-circle-btn primary !text-white shadow-xs'
                : 'hover:bg-white/60 text-[#17402C]'
            }`}
          >
            <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24">
              <circle cx="12" cy="12" r="10"></circle>
              <line x1="2" y1="12" x2="22" y2="12"></line>
              <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path>
            </svg>
          </button>
        </div>
      </div>

      {/* 2. Dock de Navigation GPS & Zoom (+ / −) — Bottom Right (Zone pouce naturelle) */}
      <div className="absolute z-[400] pointer-events-auto right-3.5 bottom-[calc(var(--bottom-tab-base-height,68px)+150px)] md:bottom-20 md:right-4">
        <div
          className="flex flex-col gap-0.5 items-center p-1 rounded-full shadow-lg"
          style={{
            background: 'linear-gradient(180deg, rgba(240, 237, 228, 0.94) 0%, rgba(225, 221, 208, 0.84) 100%)',
            backdropFilter: 'blur(16px) saturate(180%)',
            WebkitBackdropFilter: 'blur(16px) saturate(180%)',
            border: '1.5px solid rgba(255, 255, 255, 0.88)',
            boxShadow: '0 8px 32px -4px rgba(23, 64, 44, 0.12), inset 0 1.5px 2px rgba(255, 255, 255, 0.95)',
          }}
        >
          <button
            type="button"
            onClick={handleRecenter}
            title="Recentrer sur ma position"
            aria-label="Recentrer sur ma position"
            className="w-9 h-9 rounded-full flex items-center justify-center text-[#17402C] hover:bg-white/60 active:scale-95 transition-all cursor-pointer"
          >
            <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24">
              <circle cx="12" cy="12" r="4" />
              <path d="M12 2v3m0 14v3M2 12h3m14 0h3" />
            </svg>
          </button>
          <div className="w-5 h-[1px] bg-[#17402C]/10 my-0.5" />
          <button
            type="button"
            onClick={handleZoomIn}
            title="Zoom avant"
            aria-label="Zoom avant"
            className="w-9 h-9 rounded-full flex items-center justify-center font-bold text-base text-[#17402C] hover:bg-white/60 active:scale-95 transition-all cursor-pointer"
          >
            +
          </button>
          <div className="w-5 h-[1px] bg-[#17402C]/10 my-0.5" />
          <button
            type="button"
            onClick={handleZoomOut}
            title="Zoom arrière"
            aria-label="Zoom arrière"
            className="w-9 h-9 rounded-full flex items-center justify-center font-bold text-base text-[#17402C] hover:bg-white/60 active:scale-95 transition-all cursor-pointer"
          >
            −
          </button>
        </div>
      </div>
    </div>
  );
}
