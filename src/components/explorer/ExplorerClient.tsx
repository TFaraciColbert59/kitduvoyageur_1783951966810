'use client';

import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { useQuery } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { Backpack } from 'lucide-react';
import { TrendingUpIcon as TrendingUp } from '@/components/icons/trending-up';
import { NavigationIcon as Navigation } from '@/components/icons/navigation';
import { CompassIcon as Compass } from '@/components/icons/compass';
import { DocIcon as FileText } from '@/components/icons/doc';
import { BellIcon as Bell } from '@/components/icons/bell';
import { ShoppingBagIcon as ShoppingBag } from '@/components/icons/shopping-bag';
import { ClockIcon as Clock } from '@/components/icons/clock';
import { ChevronDownIcon as ChevronDown } from '@/components/icons/chevron-down';
import { SlidersHorizontalIcon as SlidersHorizontalAnimated } from '@/components/icons/sliders-horizontal';
import { XIcon as XAnimated } from '@/components/icons/x';
import { RotateCCWIcon as RotateCcwAnimated, type RotateCCWIconHandle } from '@/components/icons/rotate-ccw';
import Icon from '@/components/ui/AppIcon';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { MapTrail } from '@/components/explorer/types';
import {
  getDifficultyColor,
  getDifficultyLabel,
  formatDistance,
  formatDuration,
  getTrailImage,
} from '@/components/explorer/types';
import ExplorerListCard from '@/components/explorer/ExplorerListCard';
import ExplorerFilterPanel from '@/components/explorer/ExplorerFilterPanel';
import ExplorerMobileHikeCarousel from '@/components/explorer/ExplorerMobileHikeCarousel';
import EphemeralGroupSheet from '@/features/tribu/components/EphemeralGroupSheet';
import { setActiveAdventureAction } from '@/features/hub/context/activeAdventureServer';
import { hubSectionHref } from '@/features/hub/registry/hubSectionRegistry';
import { useActiveAdventure } from '@/features/hub/context/ActiveAdventureContext';
import { createClient } from '@/lib/supabase/client';
import {
  getLiveState,
  stopSharingPosition,
  type LiveMemberPosition,
} from '@/features/tribu/actions/livePosition';
import { getCurrentGeoPosition } from '@/lib/native/geolocation';
import { Badge, Button, Card, EmptyState, IconButton, SearchField, Spinner } from '@/components/ui';
import { MapPageLayout } from '@/design';

// ── Dynamic (client-only) ─────────────────────────────────────────────────────

const ExplorerMap = dynamic(() => import('@/components/explorer/ExplorerMap'), {
  ssr: false,
  loading: () => (
    <div className="flex h-full w-full items-center justify-center bg-[color:var(--glass-bg-medium)]">
      <Spinner size="lg" label="Chargement de la carte" />
    </div>
  ),
});

const TrailDetailPanel = dynamic(() => import('@/components/explorer/TrailDetailPanel'), {
  ssr: false,
});

// CHANTIER ATLAS — moteur unique MapLibre (projection globe), activé par ?atlas=1.
const UnifiedExplorerMap = dynamic(() => import('@/components/map/UnifiedExplorerMap'), {
  ssr: false,
  loading: () => (
    <div className="flex h-full w-full items-center justify-center bg-[color:var(--glass-bg-medium)]">
      <Spinner size="lg" label="Chargement de la carte" />
    </div>
  ),
});

// ── Navigation Links (Exactement identiques à la charte LKDV) ──────────────────
// P1 RULING — le libellé « MATÉRIEL » de la topbar DESKTOP est conservé :
// pattern desktop légitime, hors scope mobile (aucun « Matériel » en nav mobile).

const NAV_LINKS = [
  { label: 'Explorer', href: '/explorer' },
  { label: 'Matériel', href: '/hub' },
  { label: 'Communauté', href: '/communaute' },
];

const DIFFICULTY_FILTERS = ['Facile', 'Modérée', 'Difficile', 'Expert'];
const DURATION_FILTERS = [
  { label: '< 2h', min: 0, max: 2 },
  { label: '2–4h', min: 2, max: 4 },
  { label: '4–8h', min: 4, max: 8 },
  { label: '+ 8h', min: 8, max: Infinity },
];

const CATEGORIES = ['Tout', 'Refuge', 'Itinéraire', 'Bivouac', 'Escalade', 'Multi-jours', 'Famille'];

import type { UnifiedPOI } from '@/lib/queries/pois';

// ── Dernière position connue ───────────────────────────────────────────────────
// Clé relue par `UnifiedExplorerMap` pour replier « Explorer ma zone » sans GPS.

const LAST_LOCATION_STORAGE_KEY = 'lkdv_last_location';

// Liens-actions stylés comme `Button variant="secondary"` (pas de `<button>` imbriqué).
const LINK_PILL =
  'inline-flex shrink-0 select-none items-center justify-center gap-[var(--space-2)] whitespace-nowrap rounded-full border border-[color:var(--glass-border)] bg-[color:var(--card-tint-strong)] px-[var(--space-4)] font-semibold text-[color:var(--card-content)] backdrop-blur-[var(--blur-md)] transition-transform duration-[var(--motion-press-duration)] active:scale-[var(--motion-press-scale)] hover:bg-[color:var(--lkv-hover-surface)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--lkv-focus-ring)]';
const LINK_ICON =
  'inline-flex h-[var(--control-height-md)] w-[var(--control-height-md)] shrink-0 select-none items-center justify-center rounded-full border border-[color:var(--glass-border)] bg-[color:var(--card-tint-strong)] text-[color:var(--card-content)] backdrop-blur-[var(--blur-md)] transition-transform duration-[var(--motion-press-duration)] active:scale-[var(--motion-press-scale)] hover:bg-[color:var(--lkv-hover-surface)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--lkv-focus-ring)]';

function rememberLastLocation(lat: number, lng: number): void {
  try {
    localStorage.setItem(
      LAST_LOCATION_STORAGE_KEY,
      JSON.stringify({ lat, lng, timestamp: Date.now() })
    );
  } catch {
    // Stockage indisponible : le repli carte fonctionne sans dernière position.
  }
}

// ── Props ─────────────────────────────────────────────────────────────────────

interface ExplorerClientProps {
  initialTrails: MapTrail[];
  /** CHANTIER ATLAS — moteur cartographique unifié (MapLibre globe) au lieu de Leaflet. */
  unifiedMap?: boolean;
  /** CHANTIER ATLAS — densités matérialisées (paliers continent/région). */
  atlasDensity?: {
    countries: import('@/components/map/layers/densityLayers').CountryDensityRow[];
    cells: import('@/components/map/layers/densityLayers').RegionDensityCell[];
  };
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function ExplorerClient({
  initialTrails,
  unifiedMap = false,
  atlasDensity,
}: ExplorerClientProps) {
  // State
  const [selectedTrailId, setSelectedTrailId] = useState<string | null>(null);
  const [selectedTrail, setSelectedTrail] = useState<MapTrail | null>(null);
  const [detailPanelOpen, setDetailPanelOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeDifficulties, setActiveDifficulties] = useState<string[]>([]);
  const [activeDuration, setActiveDuration] = useState<string | null>(null);
  const [familyOnly, setFamilyOnly] = useState(false);
  const [activePoiCategories, setActivePoiCategories] = useState<string[]>([]);
  const [userLocation, setUserLocation] = useState<[number, number] | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [activeCategory, setActiveCategory] = useState<string>('Tout');
  const [displayLimit, setDisplayLimit] = useState(30);
  const [sheetExpanded, setSheetExpanded] = useState(false);
  const listScrollRef = useRef<HTMLDivElement>(null);

  // Initial 2km radius default bbox (Chamonix: 45.9237, 6.8694) at zoom 14
  const [queriedBbox, setQueriedBbox] = useState<{ minLat: number; maxLat: number; minLng: number; maxLng: number; zoom: number }>({
    minLat: 45.9237 - 0.015,
    maxLat: 45.9237 + 0.015,
    minLng: 6.8694 - 0.022,
    maxLng: 6.8694 + 0.022,
    zoom: 14,
  });

  const [liveViewportBbox, setLiveViewportBbox] = useState<{ minLat: number; maxLat: number; minLng: number; maxLng: number; zoom: number } | null>(null);
  const [showSearchHereButton, setShowSearchHereButton] = useState(false);
  const router = useRouter();
  const [ephemeralOpen, setEphemeralOpen] = useState(false);

  const handleEphemeralCreated = async (result: { groupId: string; name: string }) => {
    const res = await setActiveAdventureAction({
      nature: 'collectif',
      id: result.groupId,
      title: result.name,
    });
    setEphemeralOpen(false);
    if (res.success) {
      router.push(hubSectionHref({ nature: 'collectif' }, 'groupe'));
    }
  };

  // ── Positions live du groupe (TRIBU Phase 7, lecture membres uniquement) ──
  const { activeAdventure } = useActiveAdventure();
  const supabaseLive = useMemo(() => createClient(), []);
  const [liveSessionId, setLiveSessionId] = useState<string | null>(null);
  const [livePositions, setLivePositions] = useState<LiveMemberPosition[]>([]);
  const [liveMySharing, setLiveMySharing] = useState(false);
  const [liveError, setLiveError] = useState<string | null>(null);

  const refreshLive = useCallback(async (groupId: string) => {
    const result = await getLiveState(groupId);
    if (!result.ok) {
      console.warn('[explorer/live]', result.error);
      return;
    }
    setLiveSessionId(result.session?.id ?? null);
    setLivePositions(result.positions);
    setLiveMySharing(result.mySharing);
  }, []);

  const activeGroupId =
    activeAdventure?.nature === 'collectif' ? activeAdventure.id : null;

  useEffect(() => {
    if (!activeGroupId) {
      setLiveSessionId(null);
      setLivePositions([]);
      setLiveMySharing(false);
      return;
    }
    const groupId = activeGroupId;
    void refreshLive(groupId);
    const interval = setInterval(() => {
      void refreshLive(groupId);
    }, 60_000);
    const channel = supabaseLive
      .channel(`group-live-${groupId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'group_live_positions' },
        () => {
          void refreshLive(groupId);
        }
      )
      .subscribe();
    return () => {
      clearInterval(interval);
      void supabaseLive.removeChannel(channel);
    };
  }, [activeGroupId, refreshLive, supabaseLive]);

  const handleStopLiveSharing = async () => {
    if (!liveSessionId || activeAdventure?.nature !== 'collectif') return;
    const groupId = activeAdventure.id;
    setLiveError(null);
    let result: { ok: boolean; error?: string };
    try {
      result = await stopSharingPosition({ sessionId: liveSessionId });
    } catch {
      result = { ok: false, error: 'Réseau indisponible.' };
    }
    if (result.ok) {
      setLiveMySharing(false);
      void refreshLive(groupId);
    } else {
      setLiveError(result.error ?? 'Arrêt impossible pour le moment.');
    }
  };
  // CHANTIER ATLAS — données réelles du viewport remontées par UnifiedExplorerMap.
  const [unifiedViewportData, setUnifiedViewportData] = useState<{
    trails: MapTrail[];
    pois: UnifiedPOI[];
  } | null>(null);
  const initialGeoAppliedRef = useRef(false);
  const queriedBboxRef = useRef(queriedBbox);
  queriedBboxRef.current = queriedBbox;

  // Géolocalisation immédiate au montage pour centrer sur la position de l'utilisateur par défaut
  // (wrapper natif Capacitor ⇄ Web — jamais d'appel direct à `navigator.geolocation`).
  useEffect(() => {
    if (initialGeoAppliedRef.current) return;
    let cancelled = false;
    void getCurrentGeoPosition({ enableHighAccuracy: true, timeout: 6000 })
      .then((pos) => {
        if (cancelled) return;
        const lat = pos.latitude;
        const lng = pos.longitude;
        rememberLastLocation(lat, lng);
        setUserLocation([lat, lng]);
        if (!initialGeoAppliedRef.current) {
          initialGeoAppliedRef.current = true;
          const deltaLat = 0.018;
          const deltaLng = 0.026 / Math.cos((lat * Math.PI) / 180);
          setQueriedBbox({
            minLat: lat - deltaLat,
            maxLat: lat + deltaLat,
            minLng: lng - deltaLng,
            maxLng: lng + deltaLng,
            zoom: 14,
          });
          setShowSearchHereButton(false);
        }
      })
      .catch(() => {
        // Si refusé ou indisponible, conservation de la vue initiale par défaut
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const handleViewportChange = useCallback((bbox: { minLat: number; maxLat: number; minLng: number; maxLng: number; zoom: number }) => {
    setLiveViewportBbox(bbox);
    const qBbox = queriedBboxRef.current;
    if (qBbox) {
      const latDiff = Math.abs((bbox.minLat + bbox.maxLat) / 2 - (qBbox.minLat + qBbox.maxLat) / 2);
      const lngDiff = Math.abs((bbox.minLng + bbox.maxLng) / 2 - (qBbox.minLng + qBbox.maxLng) / 2);
      const zoomDiff = Math.abs(bbox.zoom - qBbox.zoom);
      if (latDiff > 0.008 || lngDiff > 0.012 || zoomDiff >= 1) {
        setShowSearchHereButton(true);
      }
    }
  }, []);

  const searchHereIconRef = useRef<RotateCCWIconHandle | null>(null);
  const handleSearchHere = useCallback(() => {
    if (liveViewportBbox) {
      setQueriedBbox(liveViewportBbox);
      setShowSearchHereButton(false);
    }
  }, [liveViewportBbox]);

  // Data - Trails (with Viewport LOD)
  const { data: trailsData, isFetching: trailsFetching } = useQuery<MapTrail[]>({
    queryKey: ['hikes', queriedBbox?.minLat?.toFixed(3), queriedBbox?.maxLat?.toFixed(3), queriedBbox?.minLng?.toFixed(3), queriedBbox?.maxLng?.toFixed(3), queriedBbox?.zoom],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (queriedBbox) {
        params.set('min_lat', queriedBbox.minLat.toFixed(4));
        params.set('max_lat', queriedBbox.maxLat.toFixed(4));
        params.set('min_lng', queriedBbox.minLng.toFixed(4));
        params.set('max_lng', queriedBbox.maxLng.toFixed(4));
        const limit = queriedBbox.zoom <= 7 ? 35 : queriedBbox.zoom <= 11 ? 75 : 120;
        params.set('limit', limit.toString());
      } else {
        params.set('limit', '60');
      }
      const res = await fetch(`/api/hikes?${params.toString()}`);
      if (!res.ok) throw new Error('Failed to fetch trails');
      return (await res.json()) as MapTrail[];
    },
    staleTime: 60_000,
    enabled: !unifiedMap,
  });

  // Data - Unified POIs (with Viewport LOD)
  const { data: poisData } = useQuery<UnifiedPOI[]>({
    queryKey: ['pois', queriedBbox?.minLat?.toFixed(3), queriedBbox?.maxLat?.toFixed(3), queriedBbox?.minLng?.toFixed(3), queriedBbox?.maxLng?.toFixed(3), queriedBbox?.zoom],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (queriedBbox) {
        params.set('min_lat', queriedBbox.minLat.toFixed(4));
        params.set('max_lat', queriedBbox.maxLat.toFixed(4));
        params.set('min_lng', queriedBbox.minLng.toFixed(4));
        params.set('max_lng', queriedBbox.maxLng.toFixed(4));
        params.set('zoom', queriedBbox.zoom.toString());
        const limit = queriedBbox.zoom <= 7 ? 40 : queriedBbox.zoom <= 11 ? 80 : 150;
        params.set('limit', limit.toString());
      } else {
        params.set('limit', '50');
      }
      const res = await fetch(`/api/pois?${params.toString()}`);
      if (!res.ok) return [];
      return (await res.json()) as UnifiedPOI[];
    },
    staleTime: 60_000,
    enabled: !unifiedMap,
  });

  // Fetch real GeoJSON GPS track when a hike is selected
  useEffect(() => {
    if (!selectedTrailId) return;
    let isMounted = true;
    fetch(`/api/hikes/${selectedTrailId}`)
      .then((res) => res.json())
      .then((data) => {
        if (isMounted && data.geojson) {
          setSelectedTrail((prev) => (prev && String(prev.id) === String(data.id) ? { ...prev, geojson: data.geojson } : prev));
        }
      })
      .catch((err) => console.warn('Failed to load hike GeoJSON:', err));
    return () => {
      isMounted = false;
    };
  }, [selectedTrailId]);

  const trails =
    unifiedMap && unifiedViewportData
      ? unifiedViewportData.trails
      : trailsData ?? initialTrails ?? [];

  const filteredTrails = useMemo(() => {
    return trails.filter((t) => {
      // Spatial restriction: only show hikes inside the active queried bounding box.
      // En mode unifié (ATLAS), le serveur a déjà borné au viewport réel de la carte.
      if (queriedBbox && !unifiedMap) {
        const tLat = t.lat != null ? Number(t.lat) : (t as any).start_lat != null ? Number((t as any).start_lat) : null;
        const tLng = t.lng != null ? Number(t.lng) : (t as any).start_lng != null ? Number((t as any).start_lng) : null;
        if (tLat != null && tLng != null && !isNaN(tLat) && !isNaN(tLng)) {
          if (
            tLat < queriedBbox.minLat ||
            tLat > queriedBbox.maxLat ||
            tLng < queriedBbox.minLng ||
            tLng > queriedBbox.maxLng
          ) {
            return false;
          }
        }
      }

      const dist = t.distance_km != null ? Number(t.distance_km) : 0;
      if (dist < 2.0) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        if (
          !(t.name || '').toLowerCase().includes(q) &&
          !(t.ref || '').toLowerCase().includes(q) &&
          !(t.terrain_type || '').toLowerCase().includes(q) &&
          !(t.network || '').toLowerCase().includes(q)
        ) return false;
      }
      if (activeDifficulties.length > 0) {
        const d = (t.difficulty || '').toLowerCase();
        if (!activeDifficulties.some((f) => d.includes(f.toLowerCase()))) return false;
      }
      if (activeDuration) {
        const dur = DURATION_FILTERS.find((f) => f.label === activeDuration);
        if (dur && t.duration_hours != null) {
          if (t.duration_hours < dur.min || t.duration_hours >= dur.max) return false;
        }
      }
      if (familyOnly && !t.family_friendly) return false;
      if (activeCategory && activeCategory !== 'Tout') {
        const cat = activeCategory.toLowerCase();
        const t_ = (t.terrain_type || '').toLowerCase();
        const n_ = (t.network || '').toLowerCase();
        const nm_ = (t.name || '').toLowerCase();
        if (!t_.includes(cat) && !n_.includes(cat) && !nm_.includes(cat)) return false;
      }
      return true;
    });
  }, [trails, queriedBbox, unifiedMap, searchQuery, activeDifficulties, activeDuration, familyOnly, activeCategory]);

  // Handlers
  const handleTrailClick = useCallback((trail: MapTrail) => {
    setSelectedTrailId(trail.id);
    setSelectedTrail(trail);
  }, []);

  // Mobile : le tap sur une carte ouvre directement la fiche détail (plein écran)
  const handleMobileTrailTap = useCallback((trail: MapTrail) => {
    setSelectedTrailId(trail.id);
    setSelectedTrail(trail);
    setDetailPanelOpen(true);
    setSheetExpanded(false);
  }, []);

  const handleLocationUpdate = useCallback((loc: [number, number]) => {
    rememberLastLocation(loc[0], loc[1]);
    setUserLocation(loc);
    if (!initialGeoAppliedRef.current) {
      initialGeoAppliedRef.current = true;
      const [lat, lng] = loc;
      const deltaLat = 0.018;
      const deltaLng = 0.026 / Math.cos((lat * Math.PI) / 180);
      setQueriedBbox({
        minLat: lat - deltaLat,
        maxLat: lat + deltaLat,
        minLng: lng - deltaLng,
        maxLng: lng + deltaLng,
        zoom: 14,
      });
      setShowSearchHereButton(false);
    }
  }, []);

  // Verrouille le scroll de la page (html/body) pendant la vue plein écran :
  // le contenu est 100% fixed, aucun scroll ne doit être possible (100vh mobile).
  useEffect(() => {
    const html = document.documentElement;
    const body = document.body;
    const prevHtml = html.style.overflow;
    const prevBody = body.style.overflow;
    html.style.overflow = 'hidden';
    body.style.overflow = 'hidden';
    return () => {
      html.style.overflow = prevHtml;
      body.style.overflow = prevBody;
    };
  }, []);

  const toggleDifficulty = useCallback((d: string) => {
    setActiveDifficulties((prev) => prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d]);
  }, []);

  const togglePoiCategory = useCallback((poiCat: string) => {
    setActivePoiCategories((prev) =>
      prev.includes(poiCat) ? prev.filter((x) => x !== poiCat) : [...prev, poiCat]
    );
  }, []);

  const relevantPois =
    unifiedMap && unifiedViewportData ? unifiedViewportData.pois : poisData;

  const visiblePois = useMemo(() => {
    if (!relevantPois || activePoiCategories.length === 0) return undefined;
    return relevantPois.filter((poi) => activePoiCategories.includes(poi.category));
  }, [relevantPois, activePoiCategories]);

  const handleSearchChange = useCallback((q: string) => {
    setSearchQuery(q);
    setDisplayLimit(30);
  }, []);

  const resetFilters = useCallback(() => {
    setActiveDifficulties([]);
    setActiveDuration(null);
    setFamilyOnly(false);
    setActiveCategory('Tout');
    setActivePoiCategories([]);
    setSearchQuery('');
  }, []);

  const hasFilters =
    activeDifficulties.length > 0 ||
    !!activeDuration ||
    familyOnly ||
    activeCategory !== 'Tout' ||
    activePoiCategories.length > 0 ||
    searchQuery !== '';

  const activeFilterCount =
    activeDifficulties.length +
    (activeDuration ? 1 : 0) +
    (familyOnly ? 1 : 0) +
    (activeCategory !== 'Tout' ? 1 : 0) +
    activePoiCategories.length;

  // ── RENDER ────────────────────────────────────────────────────────────────────

  const mapNode = unifiedMap ? (
    <UnifiedExplorerMap
      trails={filteredTrails}
      pois={visiblePois}
      selectedTrailId={selectedTrailId}
      selectedTrail={selectedTrail}
      onTrailClick={handleTrailClick}
      userLocation={userLocation}
      onLocationUpdate={handleLocationUpdate}
      onViewportChange={handleViewportChange}
      onViewportData={setUnifiedViewportData}
      countryDensity={atlasDensity?.countries}
      regionDensity={atlasDensity?.cells}
      memberPositions={livePositions.map((position) => ({
        userId: position.userId,
        name: position.name,
        lat: position.lat,
        lng: position.lng,
      }))}
      safeControls
    />
  ) : (
    <ExplorerMap
      trails={filteredTrails}
      pois={visiblePois}
      selectedTrailId={selectedTrailId}
      onTrailClick={handleTrailClick}
      userLocation={userLocation}
      onLocationUpdate={handleLocationUpdate}
      onViewportChange={handleViewportChange}
      safeControls
    />
  );

  const controls = (
    <>
      {/* ── 1A. HEADER DESKTOP (GRAND ÉCRAN >= 768px) ── */}
      <div className="pointer-events-none fixed left-1/2 top-[calc(var(--safe-top)+12px)] z-[var(--z-sticky)] hidden w-full max-w-[640px] -translate-x-1/2 px-3 md:block">
        <div className="pointer-events-auto flex w-full items-center justify-between gap-3 rounded-full border border-[color:var(--glass-border)] bg-[color:var(--card-tint-strong)] px-3.5 py-1 backdrop-blur-[var(--blur-xl)]">
          {/* Logo (Icon Only — Sans texte) */}
          <Link
            href="/"
            className="group flex shrink-0 items-center"
            aria-label="Accueil LKDV"
          >
            <div className="h-8 w-8 max-h-[32px] min-h-[32px] w-8 min-w-[32px] max-w-[32px] shrink-0 overflow-hidden rounded-full border border-[color:var(--glass-border)] bg-[color:var(--btn-tint)] backdrop-blur-[var(--btn-blur)] saturate-[var(--btn-saturate)] shadow-xs transition-transform group-hover:scale-105">
              <img
                src="/assets/images/app_logo.png"
                alt="LKDV"
                width={32}
                height={32}
                className="h-full w-full rounded-full object-cover"
              />
            </div>
          </Link>

          {/* Navigation Principale Desktop */}
          <nav className="flex items-center gap-1">
            {NAV_LINKS.map((link) => {
              const isActive = link.href === '/explorer';
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`relative select-none rounded-full px-3.5 py-1.5 text-[length:var(--lkv-text-caption)] font-semibold transition-colors ${
                    isActive
                      ? 'text-[color:var(--lkv-primary)]'
                      : 'text-[color:var(--lkv-text-secondary)]/70 hover:bg-[color:var(--lkv-hover-surface)] hover:text-[color:var(--lkv-primary)]'
                  }`}
                >
                  {isActive && (
                    <motion.div
                      layoutId="explorerNavActive"
                      className="absolute inset-0 -z-0 rounded-full border border-[color:var(--glass-border)] bg-[color:var(--card-tint-strong)] shadow-2xs"
                      transition={{ type: 'spring', stiffness: 450, damping: 32 }}
                    />
                  )}
                  <span
                    className={`relative z-10 transition-colors ${
                      isActive ? 'font-extrabold text-[color:var(--lkv-primary)]' : 'hover:text-[color:var(--lkv-primary)]'
                    }`}
                  >
                    {link.label}
                  </span>
                </Link>
              );
            })}
          </nav>

          {/* Actions Desktop */}
          <div className="flex shrink-0 items-center gap-2">
            <Link
              href="/progression"
              className={`${LINK_PILL} h-[var(--control-height-sm)] text-[length:var(--lkv-text-caption-2)] font-bold`}
              title="Consulter ma progression et mes classements"
            >
              <span aria-hidden="true">🧭</span>
              <span>Ma progression</span>
            </Link>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setEphemeralOpen(true)}
              className="text-[length:var(--lkv-text-caption-2)] font-bold"
              title="Créer une sortie éphémère avec des amis"
              data-testid="ephemeral-group-cta-desktop"
            >
              <span aria-hidden="true">👥</span>
              <span>Sortie entre amis</span>
            </Button>
            <Link
              href="/randonnee-active"
              className={`${LINK_PILL} h-[var(--control-height-sm)] text-[length:var(--lkv-text-caption-2)] font-bold`}
              title="Lancer le mode randonnée GPS"
            >
              <span aria-hidden="true">🥾</span>
              <span>Lancer rando</span>
            </Link>
          </div>
        </div>
      </div>

      {/* ── 2B. BOUTON FLOTTANT DYNAMIQUE : « RECHERCHER DANS CETTE ZONE » ──
          P1 — CTA unique en haut : masqué quand le rail filtres est ouvert
          (filtres XOR recherche-ici, jamais superposés au header desktop). */}
      <AnimatePresence>
        {showSearchHereButton && !unifiedMap && !filtersOpen && (
          <motion.div
            initial={{ opacity: 0, y: -16, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -16, scale: 0.9 }}
            transition={{ type: 'spring', stiffness: 500, damping: 30 }}
            className="pointer-events-auto fixed left-1/2 top-[calc(var(--safe-top)+16px)] z-[var(--z-sticky)] -translate-x-1/2 sm:top-[76px]"
          >
            {/* Icône seule (44px), même verre givré que les autres boutons carte.
                Animation garantie : rotation continue pendant le fetch +
                déclenchement impératif au tap (mouseenter ne bulle pas). */}
            <IconButton
              variant="glass"
              size="lg"
              onClick={() => {
                searchHereIconRef.current?.startAnimation();
                handleSearchHere();
              }}
              className="shadow-lg"
              title="Rechercher les randonnées dans cette zone"
              aria-label="Rechercher les randonnées dans cette zone"
              aria-busy={trailsFetching}
            >
              <RotateCcwAnimated
                ref={searchHereIconRef}
                size={16}
                className={trailsFetching ? 'animate-spin' : ''}
              />
            </IconButton>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── 3. BOUTON FILTRES FLOTTANT (bord droit, jamais coupé) ──
          P1 — rail droit DESKTOP (centré vertical) OU colonne mobile
          (haut-droite sous les tuiles), jamais superposés. L'onglet reste à
          droite sans croiser la colonne zoom carte (décalée right-14 mobile). */}
      <div className="pointer-events-none fixed right-3 top-[calc(var(--safe-top)+64px)] z-[var(--z-fab)] flex items-center justify-end md:right-[var(--map-control-inset-x)] md:top-1/2 md:-translate-y-1/2">
        <AnimatePresence mode="wait">
          {!filtersOpen ? (
            /* Onglet collé à la paroi droite */
            <motion.div
              key="filter-dock-closed"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
            >
              <IconButton
                variant="glass"
                size="lg"
                onClick={() => setFiltersOpen(true)}
                className="pointer-events-auto relative shadow-lg"
                title="Ouvrir la recherche et les filtres"
                aria-label="Ouvrir la recherche et les filtres"
              >
                <SlidersHorizontalAnimated size={20} />
                {(activeFilterCount > 0 || searchQuery.trim().length > 0) && (
                  <Badge
                    className="absolute left-1 top-1 h-4 min-h-0 border-transparent bg-[color:var(--btn-tint)] backdrop-blur-[var(--btn-blur)] saturate-[var(--btn-saturate)] lkv-rim-btn px-1 text-[length:var(--lkv-text-caption-2)] text-[color:var(--lkv-text-primary)]"
                  >
                    {activeFilterCount + (searchQuery.trim().length > 0 ? 1 : 0)}
                  </Badge>
                )}
              </IconButton>
            </motion.div>
          ) : (
            /* Panneau de filtres complet déployé sur le côté droit */
            <motion.div
              key="filter-dock-open"
              initial={{ opacity: 0, x: 100 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 100 }}
              transition={{ type: 'spring', stiffness: 400, damping: 35 }}
              className="pointer-events-auto w-[320px] max-w-[calc(100vw-24px)] overflow-hidden sm:w-[350px]"
            >
              <Card variant="featured" className="space-y-3 rounded-r-none p-4">
                <div className="flex items-center justify-between border-b border-[color:var(--lkv-border)] pb-2">
                  <div className="flex items-center gap-2">
                    <div className="flex h-7 w-7 items-center justify-center rounded-[var(--lkv-radius-sm)] bg-[color:var(--lkv-secondary)]/15 text-[color:var(--lkv-secondary)]">
                      <SlidersHorizontalAnimated size={15} />
                    </div>
                    <div>
                      <h3 className="font-display text-[length:var(--lkv-text-footnote)] font-bold text-[color:var(--lkv-text-primary)]">
                        Recherche & Filtres
                      </h3>
                      <p className="font-mono text-[length:var(--lkv-text-caption-2)] text-[color:var(--lkv-text-muted)]">
                        {filteredTrails.length} itinéraire{filteredTrails.length > 1 ? 's' : ''} disponible{filteredTrails.length > 1 ? 's' : ''}
                      </p>
                    </div>
                  </div>

                  <IconButton
                    variant="glass"
                    size="sm"
                    onClick={() => setFiltersOpen(false)}
                    title="Fermer"
                    aria-label="Fermer les filtres"
                  >
                    <Icon name="x" size={14} />
                  </IconButton>
                </div>

                <div className="no-scrollbar max-h-[65vh] overflow-y-auto overscroll-contain pr-0.5">
                  <ExplorerFilterPanel
                    searchQuery={searchQuery}
                    onSearchChange={handleSearchChange}
                    activeDifficulties={activeDifficulties}
                    activeDuration={activeDuration}
                    activeCategory={activeCategory}
                    familyOnly={familyOnly}
                    activePoiCategories={activePoiCategories}
                    hasFilters={hasFilters || searchQuery.trim().length > 0}
                    onToggleDifficulty={toggleDifficulty}
                    onSelectDuration={(label) => setActiveDuration(label)}
                    onSelectCategory={setActiveCategory}
                    onToggleFamily={() => setFamilyOnly((v) => !v)}
                    onTogglePoiCategory={togglePoiCategory}
                    onReset={() => {
                      resetFilters();
                      handleSearchChange('');
                    }}
                  />
                </div>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ── 4. DESKTOP : LISTE DES SENTIERS FLOTTANTE (PLEINE HAUTEUR) ──
          P1 — garde overflow : le panneau ne déborde jamais (overflow-hidden),
          seul le rail interne scrolle (overscroll-contain). */}
      <div className="pointer-events-none fixed left-4 top-[84px] bottom-4 z-[var(--z-fab)] hidden w-[350px] max-w-[calc(100vw-32px)] flex-col gap-2 overflow-hidden md:flex">
        {/* Barre de recherche compacte */}
        <div className="pointer-events-auto shrink-0">
          <SearchField
            placeholder="Rechercher sentier, massif…"
            value={searchQuery}
            onChange={(e) => handleSearchChange(e.target.value)}
            onClear={() => handleSearchChange('')}
            aria-label="Rechercher un sentier"
            containerClassName="bg-[color:var(--card-tint-strong)] backdrop-blur-[var(--blur-xl)]"
          />
        </div>

        {/* Colonne scrollable complète des sentiers */}
        <div
          ref={listScrollRef}
          onScroll={(e) => {
            const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
            if (scrollHeight - scrollTop - clientHeight < 200) {
              setDisplayLimit((prev) => Math.min(prev + 30, filteredTrails.length));
            }
          }}
          className="pointer-events-auto flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto overscroll-contain pb-4 pr-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {filteredTrails.length === 0 ? (
            <Card variant="featured" className="p-4">
              <EmptyState
                compact
                icon={<Compass size={18} className="text-[color:var(--lkv-text-muted)]" />}
                title="Aucun itinéraire trouvé"
                actionLabel="Effacer les filtres"
                onAction={resetFilters}
              />
            </Card>
          ) : (
            <>
              {filteredTrails.slice(0, displayLimit).map((trail) => (
                <ExplorerListCard
                  key={trail.id}
                  trail={trail}
                  isSelected={selectedTrailId === trail.id}
                  onClick={() => handleTrailClick(trail)}
                />
              ))}
              {filteredTrails.length > displayLimit && (
                <Button
                  variant="secondary"
                  size="sm"
                  fullWidth
                  onClick={() => setDisplayLimit((p) => Math.min(p + 40, filteredTrails.length))}
                  icon={<ChevronDown size={13} />}
                  className="shrink-0"
                >
                  <span>Afficher +{Math.min(40, filteredTrails.length - displayLimit)} sentiers</span>
                </Button>
              )}
            </>
          )}
        </div>
      </div>

      {/* ── 4. CARTE DU SENTIER SÉLECTIONNÉ FLOTTANTE (DESKTOP) ── */}
      <AnimatePresence>
        {selectedTrail && !detailPanelOpen && (
          <motion.div
            key="selected-card"
            initial={{ opacity: 0, y: 20, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.96 }}
            transition={{ type: 'spring', stiffness: 400, damping: 38 }}
            className="pointer-events-auto fixed bottom-4 left-[375px] z-[var(--z-fab)] hidden w-[320px] max-w-[calc(100vw-32px)] md:block"
          >
            <Card variant="featured" className="overflow-hidden p-0">
              {/* Photo hero */}
              <div className="relative h-20 w-full overflow-hidden bg-[color:var(--glass-bg-medium)]">
                <img
                  src={getTrailImage(selectedTrail.id)}
                  alt={selectedTrail.name}
                  className="h-full w-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                {selectedTrail.difficulty && (
                  <Badge
                    className="absolute bottom-2 left-2.5 border-transparent text-white shadow-xs"
                    style={{ backgroundColor: getDifficultyColor(selectedTrail.difficulty) }}
                  >
                    {selectedTrail.difficulty}
                  </Badge>
                )}
                <IconButton
                  variant="glass"
                  size="sm"
                  onClick={() => { setSelectedTrailId(null); setSelectedTrail(null); }}
                  className="absolute right-2 top-2"
                  title="Fermer"
                  aria-label="Fermer"
                >
                  <XAnimated size={12} />
                </IconButton>
              </div>

              {/* Contenu */}
              <div className="flex flex-col gap-2 p-3">
                <h4 className="font-display text-[length:var(--lkv-text-caption)] font-bold text-[color:var(--lkv-text-primary)] line-clamp-1">
                  {selectedTrail.name}
                </h4>
                <div className="flex items-center gap-2 font-mono text-[length:var(--lkv-text-caption-2)] text-[color:var(--lkv-text-secondary)]">
                  <span className="flex items-center gap-1 font-semibold">
                    <Navigation size={9.5} className="text-[color:var(--lkv-primary)]" />
                    {formatDistance(selectedTrail.distance_km)}
                  </span>
                  <span aria-hidden="true" className="text-[color:var(--lkv-text-muted)]/40">·</span>
                  <span className="flex items-center gap-1 font-semibold">
                    <Clock size={9.5} className="text-[color:var(--lkv-text-muted)]" />
                    {formatDuration(selectedTrail.duration_hours)}
                  </span>
                  {selectedTrail.elevation_gain != null && (
                    <>
                      <span aria-hidden="true" className="text-[color:var(--lkv-text-muted)]/40">·</span>
                      <span className="flex items-center gap-1 font-bold text-[color:var(--lkv-text-primary)]">
                        <TrendingUp size={9.5} />
                        +{Math.round(selectedTrail.elevation_gain)}m
                      </span>
                    </>
                  )}
                </div>

                <div className="flex items-center gap-2 border-t border-[color:var(--lkv-border)] pt-1">
                  <Link
                    href={`/preparer-sentier/${selectedTrail.id}`}
                    prefetch={false}
                    className={`${LINK_PILL} min-h-[36px] flex-1 text-[length:var(--lkv-text-caption)] font-bold shadow-xs`}
                  >
                    <span>Préparer</span>
                  </Link>
                  <IconButton
                    variant="glass"
                    size="sm"
                    onClick={() => setDetailPanelOpen(true)}
                    className="shrink-0"
                    title="Voir la fiche complète"
                    aria-label="Voir la fiche complète"
                  >
                    <FileText size={15} strokeWidth={2.2} />
                  </IconButton>
                </div>
              </div>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );

  const bottomOverlays = (
    <>
      {/* ── 2C. SORTIE ÉCLAIR — mobile : ancre gauche, au-dessus du carrousel.
          P1 — CTA unique et DÉPILÉ : masqué quand le badge live (2D) est
          affiché (même ancre, même niveau) et remonté d'un cran (nav+100) pour
          ne jamais chevaucher le CTA carte centré (nav+36). Offset canonique
          --nav-offset. ── */}
      {!liveSessionId && (
      <div className="pointer-events-auto fixed left-4 bottom-[calc(var(--nav-offset)+100px+var(--explorer-carousel-height,0px))] z-[var(--z-fab)] md:hidden">
        <Button
          variant="secondary"
          onClick={() => setEphemeralOpen(true)}
          className="min-h-[48px] px-3.5 shadow-lg"
          aria-label="Créer une sortie avec des amis"
          data-testid="ephemeral-group-cta-mobile"
        >
          <span aria-hidden="true">👥</span>
          <span className="whitespace-nowrap text-[length:var(--lkv-text-caption)] font-bold">Sortie entre amis</span>
        </Button>
      </div>
      )}

      {/* ── 2D. SESSION LIVE — positions des membres (jamais public).
          P1 — formule de position UNIQUE via --nav-offset, même ancre/niveau
          que la sortie éclair (2C) qu'il remplace : un seul visible à la fois.
          Garde overflow : jamais plus large que le viewport. ── */}
      {liveSessionId && (
        <Card
          variant="compact"
          className="pointer-events-auto fixed left-4 bottom-[calc(var(--nav-offset)+100px+var(--explorer-carousel-height,0px))] z-[var(--z-fab)] flex max-w-[calc(100vw-32px)] items-center gap-2 overflow-hidden"
          data-testid="explorer-live-badge"
        >
          <Badge tone="sage" className="whitespace-nowrap font-mono">
            ● {livePositions.length} position{livePositions.length > 1 ? 's' : ''} du groupe
          </Badge>
          {liveMySharing && (
            <Button
              variant="secondary"
              size="sm"
              onClick={handleStopLiveSharing}
              className="whitespace-nowrap text-[length:var(--lkv-text-caption-2)] font-bold"
              data-testid="explorer-live-stop"
            >
              Arrêter mon partage
            </Button>
          )}
          {liveError && (
            <span
              role="alert"
              className="whitespace-nowrap text-[length:var(--lkv-text-caption-2)] font-bold text-[color:var(--lkv-danger)]"
              data-testid="explorer-live-error"
            >
              {liveError}
            </span>
          )}
        </Card>
      )}

      {/* ── 5. MOBILE : HORIZONTAL SWIPEABLE HIKE CAROUSEL ── */}
      <ExplorerMobileHikeCarousel
        trails={filteredTrails}
        selectedTrailId={selectedTrailId}
        count={filteredTrails.length}
        onSelectTrail={(trail) => {
          setSelectedTrailId(trail.id);
          setSelectedTrail(trail);
        }}
        onOpenDetail={handleMobileTrailTap}
      />

      {/* ── 6. TRAIL DETAIL SLIDING MODAL ── */}
      {selectedTrail && (
        <TrailDetailPanel
          trail={selectedTrail}
          open={detailPanelOpen}
          onClose={() => setDetailPanelOpen(false)}
        />
      )}
    </>
  );

  return (
    <MapPageLayout hasBottomNav map={mapNode} controls={controls}>
      {bottomOverlays}

      {/* ── 7. SORTIE ÉCLAIR (groupe éphémère, géré dans le Hub) ── */}
      <EphemeralGroupSheet
        open={ephemeralOpen}
        onClose={() => setEphemeralOpen(false)}
        onCreated={handleEphemeralCreated}
      />
    </MapPageLayout>
  );
}
