'use client';
import React, { useEffect, useRef, useState, useCallback } from 'react';
import 'leaflet/dist/leaflet.css';
import type { Map as LeafletMap } from 'leaflet';
import type { MapTrail } from './types';
import { toValidLatLng } from './types';
import TrailLayer from './TrailLayer';

interface ExplorerMapProps {
  trails: MapTrail[];
  selectedTrailId: string | null;
  onTrailClick: (trail: MapTrail) => void;
  userLocation?: [number, number] | null;
  userPositions?: Array<{ latitude: number; longitude: number }>;
  userAccuracy?: number | null;
  headingDeg?: number | null;
  progressFrac?: number | null;
  autoFollow?: boolean;
  onAutoFollowChange?: (enabled: boolean) => void;
  onMapReady?: () => void;
  onLocationUpdate?: (loc: [number, number]) => void;
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
  selectedTrailId,
  onTrailClick,
  userLocation,
  userPositions,
  userAccuracy = null,
  headingDeg,
  progressFrac = null,
  autoFollow = true,
  onAutoFollowChange,
  onMapReady,
  onLocationUpdate,
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

  // Position sûre (safeControls) : mobile → haut sous le header (jamais sous la
  // bottom bar / le sheet) ; desktop → colonne droite (jamais derrière la liste).
  const controlPos = safeControls
    ? isAutoCompact
      ? { zoom: 'left-3 top-[64px]', tiles: 'right-3 top-[64px]' }
      : { zoom: 'right-3 bottom-[88px]', tiles: 'right-3 bottom-3' }
    : effectiveCompact
      ? { zoom: 'left-3 bottom-3', tiles: 'right-3 bottom-3' }
      : controlsPosition === 'left'
        ? { zoom: 'left-4 top-[180px]', tiles: 'left-4 bottom-[85px]' }
        : { zoom: 'right-3 top-3', tiles: 'right-3 bottom-14' };
  const userTrackPolylineRef = useRef<import('leaflet').Polyline | null>(null);
  const userDraggingRef = useRef(false);

  const [mapInstance, setMapInstance] = useState<LeafletMap | null>(null);
  const [tileMode, setTileMode] = useState<TileMode>('osm');
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

  // Initialize Leaflet map instance
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

      const map = L.map(containerRef.current!, {
        center: [46.5, 2.5],
        zoom: 6,
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

      const initialCfg = OSM_TILE;
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
      onMapReady?.();

      // Ensure immediate sizing
      setTimeout(() => {
        try { map.invalidateSize(); } catch { /* ignore */ }
      }, 100);
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
          if (mapRef.current && (mapRef.current as any)._loaded) {
            try {
              mapRef.current.flyTo(validPos, 13, { duration: 1.5 });
            } catch (err) {
              console.warn('[ExplorerMap] flyTo position error:', err);
            }
          }
        }
      },
      () => {
        setLocationState('denied');
        if (mapRef.current && (mapRef.current as any)._loaded) {
          try {
            mapRef.current.flyTo([46.6, 2.5], 5, { duration: 1.0 });
          } catch (err) {
            console.warn('[ExplorerMap] flyTo fallback error:', err);
          }
        }
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  }, [mapReady, onLocationUpdate, disableGeolocate]);

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
    });
  }, [userLocation, userAccuracy, headingDeg, mapReady]);

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

  // Real-time GPS auto-following & camera centering (Google Maps Turn-by-Turn style)
  useEffect(() => {
    if (!mapRef.current || !mapReady || isUserPanned || userDraggingRef.current) return;

    let targetLoc: [number, number] | null = userLocation ? toValidLatLng(userLocation[0], userLocation[1]) : null;
    if (!targetLoc && userPositions && userPositions.length > 0) {
      for (let i = userPositions.length - 1; i >= 0; i--) {
        const pt = toValidLatLng(userPositions[i]?.latitude, userPositions[i]?.longitude);
        if (pt) {
          targetLoc = pt;
          break;
        }
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
  }, [userLocation, userPositions, mapReady, isUserPanned]);

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

  useEffect(() => {
    if (!selectedTrailId || !mapReady) return;
    const trail = trails.find((t) => String(t.id) === String(selectedTrailId));
    if (trail) fitToTrail(trail);
  }, [selectedTrailId, trails, mapReady, fitToTrail]);

  // Auto-fit all trails on load
  useEffect(() => {
    if (!mapReady || !trails.length || !mapRef.current) return;
    if (locationState === 'located' || locationState === 'locating') return;
    import('leaflet').then((LModule) => {
      const L = (LModule as any).default || LModule;
      const coords: [number, number][] = [];
      trails.forEach((t) => {
        const pt = toValidLatLng(t?.lat, t?.lng);
        if (pt) coords.push(pt);
      });
      if (!coords.length) return;
      try {
        const allBounds = L.latLngBounds(coords);
        if (allBounds.isValid() && mapRef.current && (mapRef.current as any)._loaded) {
          mapRef.current.fitBounds(allBounds, { padding: [40, 40], maxZoom: 10 });
        }
      } catch (e) {
        console.warn('[ExplorerMap] fitBounds error:', e);
      }
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapReady, trails.length, locationState]);

  const handleManualLocate = () => {
    if (!navigator.geolocation || !mapRef.current) return;
    setLocationState('locating');
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { longitude, latitude } = position.coords;
        const validLoc = toValidLatLng(latitude, longitude);
        if (validLoc && mapRef.current && (mapRef.current as any)._loaded) {
          setLocationState('located');
          onLocationUpdate?.(validLoc);
          try {
            mapRef.current.flyTo(validLoc, 15, { duration: 1.0 });
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

      {mapReady && mapInstance && trails.length > 0 && (
        <TrailLayer map={mapInstance} trails={trails} selectedTrailId={selectedTrailId} onTrailClick={onTrailClick} />
      )}

      {/* Floating Zoom Controls (+ / −) — Liquid Glass haute lisibilité */}
      <div className={`absolute z-[400] pointer-events-auto flex flex-col gap-1.5 ${controlPos.zoom}`}>
        <button
          onClick={handleZoomIn}
          title="Zoom avant"
          aria-label="Zoom avant"
          className="glass bg-white/85 hover:bg-white interactive h-8 w-8 !rounded-full flex items-center justify-center text-[#17402C] font-bold text-base border border-white/60  cursor-pointer active:scale-95 transition-all"
        >
          +
        </button>
        <button
          onClick={handleZoomOut}
          title="Zoom arrière"
          aria-label="Zoom arrière"
          className="glass bg-white/85 hover:bg-white interactive h-8 w-8 !rounded-full flex items-center justify-center text-[#17402C] font-bold text-base border border-white/60  cursor-pointer active:scale-95 transition-all"
        >
          −
        </button>
      </div>

      {/* Tile switcher (Carte / Relief / Satellite) — Liquid Glass haute lisibilité avec état actif bien visible */}
      <div className={`absolute z-[400] pointer-events-auto flex items-center gap-1.5 ${controlPos.tiles}`}>
        <button
          onClick={() => handleTileChange('osm')}
          title="Carte standard"
          aria-label="Carte standard"
          className={`interactive h-8 w-8 !rounded-full flex items-center justify-center transition-all cursor-pointer  ${
            tileMode === 'osm'
              ? 'bg-[#17402C] text-white ring-2 ring-white '
              : 'glass bg-white/85 hover:bg-white text-[#17402C] border border-white/60'
          }`}
        >
          <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
            <path d="M3 6l6-3 6 3 6-3v12l-6 3-6-3-6 3V6z"></path>
            <path d="M9 3v12"></path>
            <path d="M15 6v12"></path>
          </svg>
        </button>
        <button
          onClick={() => handleTileChange('topo')}
          title="Relief / Topo"
          aria-label="Relief / Topo"
          className={`interactive h-8 w-8 !rounded-full flex items-center justify-center transition-all cursor-pointer  ${
            tileMode === 'topo'
              ? 'bg-[#17402C] text-white ring-2 ring-white '
              : 'glass bg-white/85 hover:bg-white text-[#17402C] border border-white/60'
          }`}
        >
          <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
            <path d="M8 3l4 8 5-5 5 15H2L8 3z"></path>
          </svg>
        </button>
        <button
          onClick={() => handleTileChange('satellite')}
          title="Satellite"
          aria-label="Satellite"
          className={`interactive h-8 w-8 !rounded-full flex items-center justify-center transition-all cursor-pointer  ${
            tileMode === 'satellite'
              ? 'bg-[#17402C] text-white ring-2 ring-white '
              : 'glass bg-white/85 hover:bg-white text-[#17402C] border border-white/60'
          }`}
        >
          <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
            <circle cx="12" cy="12" r="10"></circle>
            <path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"></path>
            <path d="M2 12h20"></path>
          </svg>
        </button>
      </div>
    </div>
  );
}
