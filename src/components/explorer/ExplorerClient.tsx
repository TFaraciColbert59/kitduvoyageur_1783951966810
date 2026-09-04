'use client';

import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
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
import { SearchIcon as SearchAnimated } from '@/components/icons/search';
import Link from 'next/link';
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

// ── Dynamic (client-only) ─────────────────────────────────────────────────────

const ExplorerMap = dynamic(() => import('@/components/explorer/ExplorerMap'), {
  ssr: false,
  loading: () => (
    // Icône de chargement seule, centrée (sans texte).
    <div className="w-full h-full flex items-center justify-center bg-[#EAE6DF]">
      <div className="w-8 h-8 border-[3px] border-[#17402C] border-t-transparent rounded-full animate-spin" />
    </div>
  ),
});

const TrailDetailPanel = dynamic(() => import('@/components/explorer/TrailDetailPanel'), {
  ssr: false,
});

// ── Navigation Links (Exactement identiques à la charte LKDV) ──────────────────

const NAV_LINKS = [
  { label: 'Aventures', href: '/explorer' },
  { label: 'Earth', href: '/pays' },
  { label: 'Matériel', href: '/materiel' },
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

// ── Props ─────────────────────────────────────────────────────────────────────

interface ExplorerClientProps {
  initialTrails: MapTrail[];
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function ExplorerClient({ initialTrails }: ExplorerClientProps) {
  const router = useRouter();

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
  const initialGeoAppliedRef = useRef(false);
  const queriedBboxRef = useRef(queriedBbox);
  queriedBboxRef.current = queriedBbox;

  // Géolocalisation immédiate au montage pour centrer sur la position de l'utilisateur par défaut
  useEffect(() => {
    if (typeof window !== 'undefined' && 'geolocation' in navigator && !initialGeoAppliedRef.current) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const lat = pos.coords.latitude;
          const lng = pos.coords.longitude;
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
        },
        () => {
          // Si refusé, conservation de la vue initiale par défaut
        },
        { enableHighAccuracy: true, timeout: 6000 }
      );
    }
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

  const trails = trailsData ?? initialTrails ?? [];

  const filteredTrails = useMemo(() => {
    return trails.filter((t) => {
      // Spatial restriction: only show hikes inside the active queried bounding box (e.g. 2km radius)
      if (queriedBbox) {
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
  }, [trails, queriedBbox, searchQuery, activeDifficulties, activeDuration, familyOnly, activeCategory]);

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

  const visiblePois = useMemo(() => {
    if (!poisData || activePoiCategories.length === 0) return undefined;
    return poisData.filter((poi) => activePoiCategories.includes(poi.category));
  }, [poisData, activePoiCategories]);

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

  return (
    <div className="relative w-full h-[100dvh] overflow-hidden bg-[#FBFAF6] select-none" style={{ minHeight: '100dvh', height: '100dvh', width: '100%' }}>

      {/* ── 1A. HEADER DESKTOP (GRAND ÉCRAN >= 768px) ── */}
      <header className="hidden md:block fixed top-3 left-1/2 -translate-x-1/2 z-[1000] w-full max-w-[640px] px-3 pointer-events-none">
        <div
          className="pointer-events-auto flex items-center justify-between gap-3 px-3.5 py-1 rounded-full w-full"
          style={{
            background: 'linear-gradient(180deg, rgba(255, 255, 255, 0.45) 0%, rgba(255, 255, 255, 0.18) 100%)',
            backdropFilter: 'blur(20px) saturate(180%)',
            WebkitBackdropFilter: 'blur(20px) saturate(180%)',
            border: '1px solid rgba(255, 255, 255, 0.55)',
            boxShadow: '0 8px 32px -4px rgba(23, 64, 44, 0.08), inset 0 1px 1.5px rgba(255, 255, 255, 0.85)',
          }}
        >
          {/* Logo Liquid Glass (Icon Only — Sans texte) */}
          <Link
            href="/"
            className="flex items-center group shrink-0"
            aria-label="Accueil LKDV"
          >
            <div className="w-8 h-8 min-w-[32px] min-h-[32px] max-w-[32px] max-h-[32px] rounded-full overflow-hidden border border-white/80 shadow-xs transition-transform group-hover:scale-105 bg-[#17402C]/10 shrink-0">
              <img
                src="/assets/images/app_logo.png"
                alt="LKDV"
                width={32}
                height={32}
                className="w-full h-full object-cover rounded-full"
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
                  className={`relative px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all select-none ${
                    isActive
                      ? 'text-[#17402C]'
                      : 'text-[#365233]/70 hover:text-[#17402C] hover:bg-white/30'
                  }`}
                >
                  {isActive && (
                    <motion.div
                      layoutId="explorerNavActive"
                      className="absolute inset-0 rounded-full bg-white/60 border border-white/80 shadow-2xs -z-0"
                      transition={{ type: 'spring', stiffness: 450, damping: 32 }}
                    />
                  )}
                  <span
                    className={`relative z-10 transition-colors ${
                      isActive ? 'text-[#17402C] font-extrabold' : 'text-[#365233]/75 hover:text-[#17402C]'
                    }`}
                  >
                    {link.label}
                  </span>
                </Link>
              );
            })}
          </nav>

          {/* Actions Desktop */}
          <div className="flex items-center gap-2 shrink-0">
            <Link
              href="/randonnee-active"
              className="inline-flex items-center gap-1.5 bg-gradient-to-b from-[#17402C]/15 to-[#17402C]/06 text-[#17402C] border border-white/40 shadow-[inset_0_1px_1px_rgba(255,255,255,0.6)] text-[11px] font-bold px-3.5 py-1.5 rounded-full hover:bg-[#17402C]/20 active:opacity-85 transition-all cursor-pointer select-none"
              title="Lancer le mode randonnée GPS"
            >
              <span>🥾</span>
              <span>Lancer rando</span>
            </Link>
          </div>
        </div>
      </header>

      {/* ── 2. CARTE UNIQUE PLEIN ÉCRAN (100% FLUIDE) ── */}
      <div className="absolute inset-0 w-full h-full z-0 pointer-events-auto" style={{ width: '100%', height: '100%' }}>
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
      </div>

      {/* ── 2B. BOUTON FLOTTANT DYNAMIQUE : « RECHERCHER DANS CETTE ZONE » ── */}
      <AnimatePresence>
        {showSearchHereButton && (
          <motion.div
            initial={{ opacity: 0, y: -16, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -16, scale: 0.9 }}
            transition={{ type: 'spring', stiffness: 500, damping: 30 }}
            className="fixed top-[calc(env(safe-area-inset-top,0px)+16px)] sm:top-[76px] left-1/2 -translate-x-1/2 z-[850] pointer-events-auto"
          >
            {/* Icône seule (44px), même verre givré que les autres boutons carte.
                Animation garantie : rotation continue pendant le fetch +
                déclenchement impératif au tap (mouseenter ne bulle pas). */}
            <button
              type="button"
              onClick={() => {
                searchHereIconRef.current?.startAnimation();
                handleSearchHere();
              }}
              className="glass-circle-btn w-11 h-11 shadow-lg flex items-center justify-center cursor-pointer active:scale-95"
              title="Rechercher les randonnées dans cette zone"
              aria-label="Rechercher les randonnées dans cette zone"
              aria-busy={trailsFetching}
            >
              <RotateCcwAnimated
                ref={searchHereIconRef}
                size={16}
                className={trailsFetching ? 'animate-spin' : ''}
              />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── 3. BOUTON FILTRES SUR LA PAROI DE DROITE (ONGLET RÉTRACTABLE COLLÉ AU REBORD DROIT) ── */}
      <div className="fixed right-0 top-1/2 -translate-y-1/2 z-[900] pointer-events-none flex items-center justify-end">
        <AnimatePresence mode="wait">
          {!filtersOpen ? (
            /* Onglet collé à la paroi droite */
            <motion.button
              key="filter-dock-closed"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              type="button"
              onClick={() => setFiltersOpen(true)}
              className="pointer-events-auto glass !rounded-r-none !rounded-l-2xl !w-12 !h-12 cursor-pointer transition-all active:scale-95 group relative flex items-center justify-center shadow-xl border-y border-l border-white/90"
              style={{
                background: 'linear-gradient(180deg, rgba(240, 237, 228, 0.96) 0%, rgba(225, 221, 208, 0.88) 100%)',
                backdropFilter: 'blur(16px) saturate(180%)',
                WebkitBackdropFilter: 'blur(16px) saturate(180%)',
                boxShadow: '-4px 8px 24px -2px rgba(23, 64, 44, 0.15), inset 0 1.5px 2px rgba(255, 255, 255, 0.95)',
              }}
              title="Ouvrir la recherche et les filtres"
              aria-label="Ouvrir la recherche et les filtres"
            >
              <SlidersHorizontalAnimated size={20} className="text-[#17402C]" />
              {(activeFilterCount > 0 || searchQuery.trim().length > 0) && (
                <span className="absolute top-1 left-1 w-4 h-4 rounded-full bg-[#17402C] text-white text-[9px] font-mono font-bold flex items-center justify-center shadow-xs">
                  {activeFilterCount + (searchQuery.trim().length > 0 ? 1 : 0)}
                </span>
              )}
            </motion.button>
          ) : (
            /* Panneau de filtres complet déployé sur le côté droit */
            <motion.div
              key="filter-dock-open"
              initial={{ opacity: 0, x: 100 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 100 }}
              transition={{ type: 'spring', stiffness: 400, damping: 35 }}
              className="pointer-events-auto w-[320px] sm:w-[350px] p-4 rounded-l-3xl bg-white/95 border-y border-l border-white/80 shadow-2xl backdrop-blur-xl space-y-3"
              style={{
                boxShadow: '-8px 16px 36px -6px rgba(23, 64, 44, 0.16), inset 0 1px 1.5px rgba(255, 255, 255, 0.95)',
              }}
            >
              <div className="flex items-center justify-between pb-2 border-b border-[#17402C]/10">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-xl bg-[#5B7F55]/15 text-[#5B7F55] flex items-center justify-center">
                    <SlidersHorizontalAnimated size={15} />
                  </div>
                  <div>
                    <h3 className="font-display font-bold text-xs sm:text-sm text-[#17402C]">
                      Recherche & Filtres
                    </h3>
                    <p className="text-[9px] text-[#5A7064] font-mono">
                      {filteredTrails.length} itinéraire{filteredTrails.length > 1 ? 's' : ''} disponible{filteredTrails.length > 1 ? 's' : ''}
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setFiltersOpen(false)}
                  className="w-7 h-7 rounded-full bg-black/5 hover:bg-black/10 flex items-center justify-center text-[#17402C] transition-colors cursor-pointer"
                  title="Fermer"
                >
                  <XAnimated size={14} />
                </button>
              </div>

              <div className="max-h-[65vh] overflow-y-auto no-scrollbar pr-0.5">
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
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ── 4. DESKTOP : LISTE DES SENTIERS FLOTTANTE (PLEINE HAUTEUR) ── */}
      <div className="hidden md:flex absolute left-4 top-[84px] bottom-4 z-[900] w-[350px] max-w-[calc(100vw-32px)] pointer-events-none flex-col gap-2">
        {/* Barre de recherche compacte Liquid Glass */}
        <div
          className="pointer-events-auto flex items-center justify-between gap-1.5 p-1.5 rounded-full shrink-0"
          style={{
            background: 'linear-gradient(180deg, rgba(255, 255, 255, 0.70) 0%, rgba(251, 250, 246, 0.40) 100%)',
            backdropFilter: 'blur(20px) saturate(180%)',
            WebkitBackdropFilter: 'blur(20px) saturate(180%)',
            border: '1px solid rgba(255, 255, 255, 0.75)',
            boxShadow: '0 8px 32px -4px rgba(23, 64, 44, 0.12), inset 0 1px 1.5px rgba(255, 255, 255, 0.95)',
          }}
        >
          <div className="relative flex-1">
            <SearchAnimated size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#5A7064]" />
            <input
              type="text"
              placeholder="Rechercher sentier, massif…"
              value={searchQuery}
              onChange={(e) => handleSearchChange(e.target.value)}
              className="w-full h-8 pl-8 pr-6 rounded-full text-xs font-semibold text-[#17402C] placeholder:text-[#5A7064]/70 bg-white/60 hover:bg-white/80 focus:bg-white/95 border border-white/70 shadow-2xs outline-none focus-visible:ring-1 focus-visible:ring-[#17402C]/40 transition-all"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => handleSearchChange('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#5A7064] hover:text-[#17402C]"
              >
                <XAnimated size={12} />
              </button>
            )}
          </div>
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
          className="flex-1 min-h-0 overflow-y-auto pr-0.5 pb-4 flex flex-col gap-2 pointer-events-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {filteredTrails.length === 0 ? (
            <div
              className="p-4 rounded-[20px] text-center flex flex-col items-center gap-2"
              style={{
                background: 'linear-gradient(180deg, rgba(255, 255, 255, 0.60) 0%, rgba(251, 250, 246, 0.35) 100%)',
                backdropFilter: 'blur(16px)',
                border: '1px solid rgba(255, 255, 255, 0.65)',
                boxShadow: '0 8px 24px -4px rgba(23, 64, 44, 0.10)',
              }}
            >
              <Compass size={18} className="text-[#5A7064]" />
              <p className="text-[12px] font-bold text-[#17402C]">Aucun itinéraire trouvé</p>
              <button
                type="button"
                onClick={resetFilters}
                className="glass-capsule-btn primary !py-1 !px-3 text-[10px] font-bold shadow-xs active:scale-95 transition-all cursor-pointer"
              >
                Effacer les filtres
              </button>
            </div>
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
                <button
                  type="button"
                  onClick={() => setDisplayLimit((p) => Math.min(p + 40, filteredTrails.length))}
                  className="glass-capsule-btn w-full !py-2.5 text-xs font-bold shadow-xs active:scale-[0.98] transition-all cursor-pointer flex items-center justify-center gap-1.5 shrink-0"
                >
                  <ChevronDown size={13} />
                  <span>Afficher +{Math.min(40, filteredTrails.length - displayLimit)} sentiers</span>
                </button>
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
            className="hidden md:block absolute z-[950] bottom-4 left-[375px] w-[320px] max-w-[calc(100vw-32px)] pointer-events-auto"
          >
            <div
              className="rounded-[24px] overflow-hidden shadow-2xl"
              style={{
                background: 'linear-gradient(180deg, rgba(255, 255, 255, 0.70) 0%, rgba(251, 250, 246, 0.40) 100%)',
                backdropFilter: 'blur(24px) saturate(190%)',
                WebkitBackdropFilter: 'blur(24px) saturate(190%)',
                border: '1px solid rgba(255, 255, 255, 0.75)',
                boxShadow: '0 20px 50px -12px rgba(23, 64, 44, 0.18), inset 0 1.5px 2px rgba(255, 255, 255, 0.95)',
              }}
            >
              {/* Photo hero */}
              <div className="relative h-20 w-full overflow-hidden bg-stone-200">
                <img
                  src={getTrailImage(selectedTrail.id)}
                  alt={selectedTrail.name}
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                {selectedTrail.difficulty && (
                  <span
                    className="glass-capsule-btn text-[9px] font-bold !py-0.5 !px-2 absolute bottom-2 left-2.5 !text-white !border-transparent shadow-xs"
                    style={{ backgroundColor: getDifficultyColor(selectedTrail.difficulty) }}
                  >
                    {selectedTrail.difficulty}
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => { setSelectedTrailId(null); setSelectedTrail(null); }}
                  className="glass-circle-btn w-6.5 h-6.5 absolute top-2 right-2"
                  title="Fermer"
                  aria-label="Fermer"
                >
                  <XAnimated size={12} />
                </button>
              </div>

              {/* Contenu */}
              <div className="p-3 flex flex-col gap-2">
                <h4 className="font-display font-bold text-[13px] text-[#17402C] line-clamp-1">
                  {selectedTrail.name}
                </h4>
                <div className="flex items-center gap-2 text-[10.5px] font-mono text-[#365233]">
                  <span className="flex items-center gap-1 font-semibold">
                    <Navigation size={9.5} className="text-[#17402C]" />
                    {formatDistance(selectedTrail.distance_km)}
                  </span>
                  <span className="text-[#5A7064]/40">·</span>
                  <span className="flex items-center gap-1 font-semibold">
                    <Clock size={9.5} className="text-[#5A7064]" />
                    {formatDuration(selectedTrail.duration_hours)}
                  </span>
                  {selectedTrail.elevation_gain != null && (
                    <>
                      <span className="text-[#5A7064]/40">·</span>
                      <span className="flex items-center gap-1 font-bold text-[#17402C]">
                        <TrendingUp size={9.5} />
                        +{Math.round(selectedTrail.elevation_gain)}m
                      </span>
                    </>
                  )}
                </div>

                <div className="flex items-center gap-2 pt-1 border-t border-[#17402C]/08">
                  <button
                    type="button"
                    onClick={() => router.push(`/materiel/depart/none?route=${selectedTrail.id}`)}
                    className="glass-capsule-btn flex-1 !min-h-[36px] text-xs font-bold shadow-xs active:scale-[0.97] transition-all cursor-pointer"
                  >
                    <span>Préparer</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setDetailPanelOpen(true)}
                    className="glass-circle-btn w-9 h-9 shrink-0 active:scale-[0.97] transition-all cursor-pointer shadow-xs"
                    title="Voir la fiche complète"
                    aria-label="Voir la fiche complète"
                  >
                    <FileText size={15} strokeWidth={2.2} />
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── 5. MOBILE : HORIZONTAL SWIPEABLE HIKE CAROUSEL (LIQUID GLASS) ── */}
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
      <AnimatePresence>
        {detailPanelOpen && selectedTrail && (
          <TrailDetailPanel
            trail={selectedTrail}
            onClose={() => setDetailPanelOpen(false)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
