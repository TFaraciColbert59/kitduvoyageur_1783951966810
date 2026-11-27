'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { AnimatePresence, motion } from 'framer-motion';
import {
  AlertTriangle,
  Bike,
  Bookmark,
  Building2,
  Bus,
  Check,
  Cloud,
  CloudRain,
  Compass,
  Copy,
  Droplets,
  ExternalLink,
  Eye,
  Flag,
  HeartPulse,
  Home,
  Info,
  MapPin,
  Mountain,
  ParkingCircle,
  Route,
  Share2,
  Signpost,
  Snowflake,
  Sun,
  Sunrise,
  Sunset,
  Tent,
  TrainFront,
  Wind,
  X,
  Zap,
} from 'lucide-react';
import type { MapPin as ExplorerMapPin } from '../../map/MapStage';
import type { PoiDetailPayload, PoiItem, RouteItem, TerrainReport } from '../../data/hooks';
import {
  formatDurationFr,
  formatReportCategoryFr,
  formatRouteNetworkLabel,
  resolvePoiPresentation,
  type PoiIconKey,
} from '../../poiTaxonomy';
import { distanceKm } from '../../sheet/context';

export interface ExplorerPoiDetailViewProps {
  poi: ExplorerMapPin;
  fullPoi: PoiItem | null;
  detail: PoiDetailPayload | null | undefined;
  loading: boolean;
  center: [number, number];
  nearbyPois: readonly PoiItem[];
  nearbyRoutes?: readonly RouteItem[];
  reports?: readonly TerrainReport[];
  isSaved: boolean;
  onToggleSave: () => void;
  onStartActivity: () => void;
  onPlanRouteToPoi?: () => void;
  onSelectNearbyPoi: (poi: PoiItem) => void;
  onSelectNearbyRoute?: (route: RouteItem) => void;
  onReportSubmitted?: () => void;
  onClose: () => void;
}

function extractFirstRouteCoord(geojson: unknown): [number, number] | null {
  if (!geojson || typeof geojson !== 'object') return null;
  const obj = geojson as Record<string, unknown>;
  if (obj.type === 'Feature') return extractFirstRouteCoord(obj.geometry);
  if (obj.type === 'FeatureCollection' && Array.isArray(obj.features)) {
    for (const f of obj.features) {
      const hit = extractFirstRouteCoord(f);
      if (hit) return hit;
    }
    return null;
  }
  const coords = obj.coordinates;
  if (!Array.isArray(coords)) return null;
  const walk = (node: unknown): [number, number] | null => {
    if (!Array.isArray(node)) return null;
    if (
      typeof node[0] === 'number' &&
      typeof node[1] === 'number' &&
      Number.isFinite(node[0]) &&
      Number.isFinite(node[1])
    ) {
      return [node[0], node[1]];
    }
    for (const child of node) {
      const hit = walk(child);
      if (hit) return hit;
    }
    return null;
  };
  return walk(coords);
}

interface QuickReportPreset {
  id: string;
  label: string;
  category:
    | 'obstacle'
    | 'closure'
    | 'mud'
    | 'snow_ice'
    | 'water'
    | 'danger'
    | 'marking'
    | 'shelter'
    | 'crowding';
  severity: 'info' | 'warning' | 'critical';
  passability: 'passable' | 'difficult' | 'impassable' | 'unknown';
  tone: 'good' | 'warn' | 'bad';
}

function quickReportPresetsForGroup(group: string): QuickReportPreset[] {
  if (group === 'water') {
    return [
      { id: 'water-ok', label: 'Eau coule bien', category: 'water', severity: 'info', passability: 'passable', tone: 'good' },
      { id: 'water-low', label: 'Débit faible', category: 'water', severity: 'warning', passability: 'difficult', tone: 'warn' },
      { id: 'water-dry', label: 'À sec / coupée', category: 'water', severity: 'critical', passability: 'impassable', tone: 'bad' },
    ];
  }
  if (group === 'shelter') {
    return [
      { id: 'shelter-ok', label: 'Ouvert & praticable', category: 'shelter', severity: 'info', passability: 'passable', tone: 'good' },
      { id: 'shelter-full', label: 'Forte affluence', category: 'crowding', severity: 'warning', passability: 'difficult', tone: 'warn' },
      { id: 'shelter-closed', label: 'Fermé / endommagé', category: 'closure', severity: 'critical', passability: 'impassable', tone: 'bad' },
    ];
  }
  return [
    { id: 'trail-ok', label: 'Accès dégagé', category: 'marking', severity: 'info', passability: 'passable', tone: 'good' },
    { id: 'trail-snow', label: 'Neige / verglas', category: 'snow_ice', severity: 'warning', passability: 'difficult', tone: 'warn' },
    { id: 'trail-danger', label: 'Obstacle / danger', category: 'obstacle', severity: 'critical', passability: 'impassable', tone: 'bad' },
  ];
}

function formatReportAge(iso?: string | null): string {
  if (!iso) return 'Récent';
  const ts = Date.parse(iso);
  if (!Number.isFinite(ts)) return 'Récent';
  const diffH = Math.max(0, Math.round((Date.now() - ts) / 3_600_000));
  if (diffH < 1) return "À l'instant";
  if (diffH < 24) return `il y a ${diffH} h`;
  return `il y a ${Math.round(diffH / 24)} j`;
}

export function renderPoiIcon(iconKey: PoiIconKey, size = 18, color = '#17402C'): React.ReactNode {
  switch (iconKey) {
    case 'summit':
    case 'saddle':
      return <Mountain size={size} color={color} aria-hidden="true" />;
    case 'viewpoint':
      return <Eye size={size} color={color} aria-hidden="true" />;
    case 'water':
    case 'spring':
      return <Droplets size={size} color={color} aria-hidden="true" />;
    case 'refuge':
    case 'cabin':
    case 'shelter':
      return <Home size={size} color={color} aria-hidden="true" />;
    case 'bivouac':
      return <Tent size={size} color={color} aria-hidden="true" />;
    case 'trailhead':
      return <Signpost size={size} color={color} aria-hidden="true" />;
    case 'parking':
      return <ParkingCircle size={size} color={color} aria-hidden="true" />;
    case 'bus':
      return <Bus size={size} color={color} aria-hidden="true" />;
    case 'train':
      return <TrainFront size={size} color={color} aria-hidden="true" />;
    case 'village':
    case 'city':
      return <Building2 size={size} color={color} aria-hidden="true" />;
    case 'bike':
      return <Bike size={size} color={color} aria-hidden="true" />;
    case 'ebike':
      return <Zap size={size} color={color} aria-hidden="true" />;
    case 'favorite':
      return <Bookmark size={size} color={color} aria-hidden="true" />;
    case 'rescue':
      return <HeartPulse size={size} color={color} aria-hidden="true" />;
    case 'danger':
      return <AlertTriangle size={size} color={color} aria-hidden="true" />;
    default:
      return <MapPin size={size} color={color} aria-hidden="true" />;
  }
}

function WeatherGlyph({ symbol }: { symbol?: string | null }) {
  if (symbol === 'rain' || symbol === 'storm') return <CloudRain size={15} color="#0369A1" aria-hidden="true" />;
  if (symbol === 'snow') return <Snowflake size={15} color="#0284C7" aria-hidden="true" />;
  if (symbol === 'sun') return <Sun size={15} color="#D97706" aria-hidden="true" />;
  return <Cloud size={15} color="#475569" aria-hidden="true" />;
}

export function ExplorerPoiDetailView({
  poi,
  fullPoi,
  detail,
  loading,
  center,
  nearbyPois,
  nearbyRoutes = [],
  reports = [],
  isSaved,
  onToggleSave,
  onStartActivity,
  onPlanRouteToPoi,
  onSelectNearbyPoi,
  onSelectNearbyRoute,
  onReportSubmitted,
  onClose,
}: ExplorerPoiDetailViewProps) {
  const [poiLens, setPoiLens] = useState<'apercu' | 'infos' | 'autour'>('apercu');
  const [photoExpanded, setPhotoExpanded] = useState(false);
  const [activePhotoIdx, setActivePhotoIdx] = useState(0);
  const [summaryExpanded, setSummaryExpanded] = useState(false);
  const [copiedGps, setCopiedGps] = useState(false);
  const [sharedFeedback, setSharedFeedback] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [selectedPresetId, setSelectedPresetId] = useState<string | null>(null);
  const [reportNote, setReportNote] = useState('');
  const [reportStatus, setReportStatus] = useState<'idle' | 'submitting' | 'sent' | 'auth' | 'error'>('idle');
  const reportPanelRef = useRef<HTMLDivElement | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const photoOpenedAtRef = useRef<number>(0);
  const lastScrollTopRef = useRef<number>(0);

  const openPhotoPreview = () => {
    photoOpenedAtRef.current = typeof performance !== 'undefined' ? performance.now() : Date.now();
    setPhotoExpanded(true);
    const scroller = scrollContainerRef.current;
    if (scroller && scroller.scrollTop > 0) {
      scroller.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  useEffect(() => {
    setPoiLens('apercu');
    setPhotoExpanded(false);
    setActivePhotoIdx(0);
    setSummaryExpanded(false);
    setReportOpen(false);
    lastScrollTopRef.current = 0;
  }, [poi.id]);

  useEffect(() => {
    if (!reportOpen) return;
    const id = window.requestAnimationFrame(() => {
      reportPanelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    });
    return () => window.cancelAnimationFrame(id);
  }, [reportOpen]);

  const pres = resolvePoiPresentation(poi.kind, poi.subtype ?? fullPoi?.subtype);
  const reportPresets = useMemo(() => quickReportPresetsForGroup(pres.group), [pres.group]);
  const distKmVal = distanceKm(center, [poi.lon, poi.lat]);
  const walkMin = Math.round((distKmVal / 4) * 60);

  const elevationM =
    detail?.elevationM ??
    fullPoi?.ele_m ??
    (poi.sub ? Number.parseInt(poi.sub.replace(/\s+/g, ''), 10) || null : null);

  const galleryImages = useMemo(() => {
    const raw = [
      ...(detail?.galleryImages ?? []),
      detail?.imageUrl ?? null,
      fullPoi?.imageUrl ?? null,
    ].filter((u): u is string => Boolean(u));
    return Array.from(new Set(raw)).slice(0, 4);
  }, [detail?.galleryImages, detail?.imageUrl, fullPoi?.imageUrl]);

  const heroImage = galleryImages[activePhotoIdx] ?? galleryImages[0] ?? null;

  // Closest useful nearby services (water, refuge/shelter, transport) excluding self
  const closestServices = useMemo(() => {
    const others = nearbyPois
      .filter((p) => p && p.id !== poi.id && Number.isFinite(p.lat) && Number.isFinite(p.lon))
      .map((p) => ({
        poi: p,
        pres: resolvePoiPresentation(p.kind, p.subtype),
        km: distanceKm([poi.lon, poi.lat], [p.lon, p.lat]),
      }))
      .filter((x) => x.km <= 5)
      .sort((a, b) => a.km - b.km);

    const picks: typeof others = [];
    const wantedGroups: Array<typeof others[number]['pres']['group']> = ['water', 'shelter', 'access'];
    for (const grp of wantedGroups) {
      const hit = others.find((item) => item.pres.group === grp && !picks.some((p) => p.poi.id === item.poi.id));
      if (hit) picks.push(hit);
    }
    return picks;
  }, [nearbyPois, poi.id, poi.lat, poi.lon]);

  // Closest GR/PR/VTT routes within 4 km of this POI
  const closestRoutes = useMemo(() => {
    if (!nearbyRoutes.length) return [];
    return nearbyRoutes
      .map((r) => {
        const anchor = extractFirstRouteCoord(r.geojson);
        if (!anchor) return null;
        const km = distanceKm([poi.lon, poi.lat], anchor);
        if (km > 4) return null;
        return {
          route: r,
          km,
          badge: formatRouteNetworkLabel(r.network, r.ref).shortBadge,
        };
      })
      .filter((x): x is NonNullable<typeof x> => x !== null)
      .sort((a, b) => a.km - b.km)
      .slice(0, 3);
  }, [nearbyRoutes, poi.lat, poi.lon]);

  // Active terrain reports within 2.5 km of this POI
  const localReports = useMemo(() => {
    return reports
      .filter((r) => Number.isFinite(r.lat) && Number.isFinite(r.lng))
      .map((r) => ({
        report: r,
        km: distanceKm([poi.lon, poi.lat], [r.lng, r.lat]),
      }))
      .filter((x) => x.km <= 2.5)
      .sort((a, b) => a.km - b.km)
      .slice(0, 3);
  }, [reports, poi.lat, poi.lon]);

  const handleCopyGps = () => {
    const coordsText = `${poi.lat.toFixed(5)}, ${poi.lon.toFixed(5)}`;
    try {
      void navigator.clipboard?.writeText(coordsText);
      setCopiedGps(true);
      window.setTimeout(() => setCopiedGps(false), 1800);
    } catch {
      /* ignore clipboard refusal */
    }
  };

  const handleShare = async () => {
    const shareUrl =
      typeof window !== 'undefined'
        ? `${window.location.origin}/explorer?lat=${poi.lat.toFixed(5)}&lng=${poi.lon.toFixed(5)}&z=14`
        : '';
    const title = `${poi.name} (${pres.label})`;
    const text = `${title}${elevationM != null ? ` · ${elevationM} m` : ''} — Le Kit du Voyageur`;
    try {
      if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
        await navigator.share({ title, text, url: shareUrl });
        setSharedFeedback(true);
        window.setTimeout(() => setSharedFeedback(false), 1800);
        return;
      }
      await navigator.clipboard?.writeText(shareUrl || `${poi.name} (${poi.lat.toFixed(5)}, ${poi.lon.toFixed(5)})`);
      setSharedFeedback(true);
      window.setTimeout(() => setSharedFeedback(false), 1800);
    } catch {
      /* user cancelled share sheet */
    }
  };

  const handleSubmitReport = async () => {
    const preset = reportPresets.find((p) => p.id === selectedPresetId) ?? reportPresets[0];
    if (!preset || reportStatus === 'submitting') return;
    setReportStatus('submitting');
    try {
      const { createClient } = await import('@/lib/supabase/client');
      const supabase = createClient();
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      const userId = data.session?.user?.id;
      if (!token || !userId) {
        setReportStatus('auth');
        return;
      }
      const desc = reportNote.trim()
        ? `${poi.name} · ${preset.label} — ${reportNote.trim()}`
        : `${poi.name} · ${preset.label}`;
      const res = await fetch('/api/explorer/v2/reports', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          reporterId: userId,
          lat: poi.lat,
          lng: poi.lon,
          category: preset.category,
          severity: preset.severity,
          passability: preset.passability,
          description: desc.slice(0, 950),
        }),
      });
      if (!res.ok) {
        setReportStatus('error');
        return;
      }
      setReportStatus('sent');
      setReportNote('');
      onReportSubmitted?.();
    } catch {
      setReportStatus('error');
    }
  };

  return (
    <div
      style={{
        position: 'relative',
        height: '100%',
        minHeight: 0,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      <div
        ref={scrollContainerRef}
        onScroll={(e) => {
          const nextTop = e.currentTarget.scrollTop;
          const prevTop = lastScrollTopRef.current;
          lastScrollTopRef.current = nextTop;
          const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
          if (
            photoExpanded &&
            nextTop > 16 &&
            nextTop > prevTop &&
            now - photoOpenedAtRef.current > 450
          ) {
            setPhotoExpanded(false);
          }
        }}
        style={{
          flex: '1 1 auto',
          minHeight: 0,
          overflowY: 'auto',
          overflowAnchor: 'none',
          padding: '8px 16px 16px',
          boxSizing: 'border-box',
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
        }}
      >
      {/* Header: explicit French type label + POI name + real locality */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, minWidth: 0, flex: 1 }}>
          {heroImage ? (
            <button
              type="button"
              className="xp20-poi-avatar-trigger"
              data-expanded={photoExpanded ? 'true' : 'false'}
              aria-expanded={photoExpanded}
              aria-label={photoExpanded ? 'Réduire la photo du lieu' : 'Afficher la photo du lieu'}
              onClick={() => {
                if (photoExpanded) {
                  setPhotoExpanded(false);
                } else {
                  openPhotoPreview();
                }
              }}
              style={{ background: pres.bgTint }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={heroImage}
                alt={poi.name}
                style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
              />
            </button>
          ) : (
            <span
              style={{
                width: 44,
                height: 44,
                borderRadius: 14,
                background: pres.bgTint,
                color: pres.color,
                display: 'grid',
                placeItems: 'center',
                flex: 'none',
                overflow: 'hidden',
                position: 'relative',
                border: '0.5px solid rgba(23, 64, 44, 0.12)',
              }}
            >
              {renderPoiIcon(pres.iconKey, 20, pres.color)}
            </span>
          )}
          <div style={{ minWidth: 0, flex: 1 }}>
            <span
              style={{
                display: 'inline-block',
                fontSize: 11,
                fontWeight: 800,
                color: pres.color,
                textTransform: 'uppercase',
                letterSpacing: '0.03em',
                marginBottom: 1,
              }}
            >
              {pres.label}
            </span>
            <h3
              style={{
                margin: 0,
                fontSize: 17,
                fontWeight: 800,
                color: '#172B24',
                lineHeight: 1.2,
              }}
            >
              {poi.name}
            </h3>
            {detail?.locationLabel ? (
              <div style={{ fontSize: 12, fontWeight: 600, color: '#56665D', marginTop: 2 }}>
                {detail.locationLabel}
              </div>
            ) : loading ? (
              <div style={{ fontSize: 11.5, color: '#74857C', marginTop: 2 }}>
                Chargement des infos réelles…
              </div>
            ) : null}
          </div>
        </div>

        <button
          type="button"
          onClick={onClose}
          aria-label="Fermer la fiche"
          style={{
            width: 32,
            height: 32,
            borderRadius: 999,
            border: '0.5px solid rgba(23, 64, 44, 0.14)',
            background: 'rgba(255, 255, 255, 0.9)',
            color: '#172B24',
            display: 'grid',
            placeItems: 'center',
            cursor: 'pointer',
            flex: 'none',
          }}
        >
          <X size={15} aria-hidden="true" />
        </button>
      </div>

      {/* Animated photo postcard: opens ONLY on tapping top-left thumbnail & auto-closes smoothly on scroll */}
      <AnimatePresence initial={false}>
        {photoExpanded && heroImage ? (
          <motion.div
            key="poi-photo-expand"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 176, opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
            style={{ overflow: 'hidden', width: '100%', flex: 'none', borderRadius: 20 }}
          >
            <div
              className="xp20-poi-postcard"
              onClick={() => setPhotoExpanded(false)}
              role="button"
              tabIndex={0}
              aria-label="Fermer l’aperçu photo"
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ' || e.key === 'Escape') {
                  e.preventDefault();
                  setPhotoExpanded(false);
                }
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={heroImage}
                alt={poi.name}
                className="xp20-poi-postcard-img"
              />
              {galleryImages.length > 1 ? (
                <>
                  <div className="xp20-poi-postcard-scrim" />
                  <div
                    className="xp20-poi-postcard-overlay"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="xp20-poi-photo-dots" role="tablist" aria-label="Photos du lieu">
                      {galleryImages.map((imgUrl, idx) => (
                        <button
                          key={imgUrl}
                          type="button"
                          role="tab"
                          aria-selected={idx === activePhotoIdx}
                          aria-label={`Photo ${idx + 1} sur ${galleryImages.length}`}
                          className="xp20-poi-photo-dot"
                          data-active={idx === activePhotoIdx ? 'true' : 'false'}
                          onClick={() => {
                            setActivePhotoIdx(idx);
                            openPhotoPreview();
                          }}
                        />
                      ))}
                    </div>
                  </div>
                </>
              ) : null}
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      {/* 3 crystal-clear metric tiles: Aperçu sub-drawer */}
      {poiLens === 'apercu' ? (
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 8 }}>
        <div
          className="club-glass-card"
          style={{ padding: '10px 10px', borderRadius: 16, display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}
        >
          <span style={{ fontSize: 10.5, fontWeight: 700, color: '#56665D' }}>Altitude</span>
          <strong style={{ fontSize: 14.5, fontWeight: 800, color: '#172B24', fontVariantNumeric: 'tabular-nums' }}>
            {elevationM != null ? `${elevationM.toLocaleString('fr-FR')} m` : loading ? '…' : 'Non mesurée'}
          </strong>
          <span style={{ fontSize: 10, fontWeight: 600, color: '#6E7F76', lineHeight: 1.25 }}>
            {elevationM != null ? 'Relief réel' : ''}
          </span>
        </div>

        <div
          className="club-glass-card"
          style={{ padding: '10px 10px', borderRadius: 16, display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}
        >
          <span style={{ fontSize: 10.5, fontWeight: 700, color: '#56665D' }}>Distance</span>
          <strong style={{ fontSize: 14.5, fontWeight: 800, color: '#172B24', fontVariantNumeric: 'tabular-nums' }}>
            {distKmVal < 1 ? `${Math.round(distKmVal * 1000)} m` : `${distKmVal.toFixed(1)} km`}
          </strong>
          <span style={{ fontSize: 10, fontWeight: 600, color: '#6E7F76', lineHeight: 1.25 }}>
            {distKmVal <= 25 ? `~${formatDurationFr(walkMin)} à pied` : 'À vol d’oiseau'}
          </span>
        </div>

        <div
          className="club-glass-card"
          style={{ padding: '10px 10px', borderRadius: 16, display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}
        >
          <span style={{ fontSize: 10.5, fontWeight: 700, color: '#56665D' }}>Météo ici</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap', minWidth: 0 }}>
            <WeatherGlyph symbol={detail?.weather?.symbol} />
            <strong style={{ fontSize: 14.5, fontWeight: 800, color: '#172B24', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
              {detail?.weather?.tempC != null ? `${detail.weather.tempC}°C` : loading ? '…' : '—'}
            </strong>
          </div>
          {detail?.weather ? (
            <div
              style={{
                fontSize: 10,
                fontWeight: 600,
                color: '#6E7F76',
                lineHeight: 1.25,
                display: 'flex',
                flexWrap: 'wrap',
                alignItems: 'baseline',
                columnGap: 4,
                rowGap: 1,
                minWidth: 0,
              }}
            >
              <span>{detail.weather.label}</span>
              {detail.weather.windKmh != null ? (
                <span style={{ whiteSpace: 'nowrap' }}>· {detail.weather.windKmh} km/h</span>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
      ) : null}

      {/* Weather / daylight practical note — Aperçu sub-drawer */}
      {poiLens === 'apercu' && detail?.weather ? (
        <div
          className="club-glass-card"
          style={{
            padding: '10px 12px',
            borderRadius: 16,
            display: 'flex',
            flexDirection: 'column',
            gap: 6,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: '#172B24', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <WeatherGlyph symbol={detail.weather.symbol} />
              <span>
                {detail.weather.label}
                {detail.weather.feelsLikeC != null ? ` · ressenti ${detail.weather.feelsLikeC}°C` : ''}
              </span>
            </span>
            <span style={{ fontSize: 11.5, fontWeight: 600, color: '#56665D', display: 'inline-flex', alignItems: 'center', gap: 8 }}>
              {detail.weather.windKmh != null ? (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                  <Wind size={12} color="#5B7F55" aria-hidden="true" />
                  {detail.weather.windKmh} km/h
                </span>
              ) : null}
              {detail.weather.sunriseHm && detail.weather.sunsetHm ? (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                  <Sunrise size={12} color="#D97706" aria-hidden="true" />
                  {detail.weather.sunriseHm}
                  <Sunset size={12} color="#B45309" aria-hidden="true" />
                  {detail.weather.sunsetHm}
                </span>
              ) : null}
            </span>
          </div>
          {detail.weather.advice ? (
            <div style={{ fontSize: 11.5, fontWeight: 600, color: '#17402C', lineHeight: 1.35 }}>
              {detail.weather.advice}
            </div>
          ) : null}
        </div>
      ) : null}

      {/* Practical OSM visual tiles — Infos sub-drawer */}
      {poiLens === 'infos' && galleryImages.length > 0 ? (
        <div className="xp20-poi-gallery-strip">
          {galleryImages.map((imgUrl, idx) => (
            <button
              key={imgUrl}
              type="button"
              className="xp20-poi-gallery-thumb"
              data-active={idx === activePhotoIdx ? 'true' : 'false'}
              onClick={() => {
                setActivePhotoIdx(idx);
                openPhotoPreview();
              }}
              aria-label={`Agrandir photo ${idx + 1}`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={imgUrl} alt={`${poi.name} ${idx + 1}`} />
            </button>
          ))}
        </div>
      ) : null}

      {poiLens === 'infos' && detail && (detail.practical.length > 0 || detail.population || detail.address) ? (
        <div className="xp20-poi-facts-grid">
          {detail.population ? (
            <div className="xp20-poi-fact-tile">
              <span>Habitants</span>
              <strong>{detail.population.toLocaleString('fr-FR')}</strong>
            </div>
          ) : null}
          {detail.address ? (
            <div className="xp20-poi-fact-tile">
              <span>Adresse</span>
              <strong>{detail.address}</strong>
            </div>
          ) : null}
          {detail.practical.map((fact) => (
            <div key={fact.key} className="xp20-poi-fact-tile" data-tone={fact.tone ?? 'neutral'}>
              <span>{fact.label}</span>
              {fact.href ? (
                <a
                  href={fact.href}
                  target={fact.href.startsWith('http') ? '_blank' : undefined}
                  rel={fact.href.startsWith('http') ? 'noopener noreferrer' : undefined}
                >
                  {fact.value}
                </a>
              ) : (
                <strong>{fact.value}</strong>
              )}
            </div>
          ))}
        </div>
      ) : null}

      {/* Visual Editorial Quote Card — Infos sub-drawer */}
      {poiLens === 'infos' && detail?.summary ? (
        <div className="xp20-poi-editorial-card">
          <div className="xp20-poi-editorial-bar" aria-hidden="true" />
          <div className="xp20-poi-editorial-body">
            <p className={summaryExpanded ? 'xp20-poi-editorial-text-full' : 'xp20-poi-editorial-text'}>
              {detail.summary}
            </p>
            <div className="xp20-poi-editorial-foot">
              <button
                type="button"
                className="xp20-xai-mini-btn"
                onClick={() => setSummaryExpanded((v) => !v)}
              >
                {summaryExpanded ? 'Réduire' : 'Lire la suite'}
              </button>
              {detail.wikiUrl ? (
                <a
                  href={detail.wikiUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="xp20-poi-wiki-pill"
                >
                  <span>Wikipédia</span>
                  <ExternalLink size={11} aria-hidden="true" />
                </a>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}

      {poiLens === 'infos' && !detail?.summary && !(detail && (detail.practical.length > 0 || detail.population || detail.address)) ? (
        <div className="club-glass-card" style={{ padding: '12px', borderRadius: 16, fontSize: 12.5, color: '#56665D' }}>
          {loading ? 'Chargement des informations OSM et Wikipédia…' : 'Aucune fiche détaillée supplémentaire sur OpenStreetMap pour ce lieu.'}
        </div>
      ) : null}

      {/* Nearby useful POIs — Autour sub-drawer */}
      {poiLens === 'autour' && closestServices.length > 0 ? (
        <div
          className="club-glass-card"
          style={{ padding: '11px 12px', borderRadius: 16, display: 'flex', flexDirection: 'column', gap: 7 }}
        >
          <span style={{ fontSize: 11, fontWeight: 800, color: '#56665D', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            Services utiles à proximité
          </span>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {closestServices.map((srv) => (
              <button
                key={srv.poi.id}
                type="button"
                onClick={() => onSelectNearbyPoi(srv.poi)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 8,
                  padding: '7px 9px',
                  borderRadius: 12,
                  border: '0.5px solid rgba(23, 64, 44, 0.1)',
                  background: 'rgba(255, 255, 255, 0.72)',
                  cursor: 'pointer',
                  textAlign: 'left',
                }}
              >
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, minWidth: 0 }}>
                  {renderPoiIcon(srv.pres.iconKey, 14, srv.pres.color)}
                  <span style={{ fontSize: 12, fontWeight: 700, color: '#172B24', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {srv.pres.shortBadge} · {srv.poi.name}
                  </span>
                </span>
                <span style={{ fontSize: 11.5, fontWeight: 700, color: '#56665D', flex: 'none', fontVariantNumeric: 'tabular-nums' }}>
                  {srv.km < 1 ? `${Math.round(srv.km * 1000)} m` : `${srv.km.toFixed(1)} km`}
                </span>
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {/* Nearby GR / PR / VTT routes — Autour sub-drawer */}
      {poiLens === 'autour' && closestRoutes.length > 0 && onSelectNearbyRoute ? (
        <div
          className="club-glass-card"
          style={{ padding: '11px 12px', borderRadius: 16, display: 'flex', flexDirection: 'column', gap: 7 }}
        >
          <span style={{ fontSize: 11, fontWeight: 800, color: '#56665D', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            Itinéraires à proximité
          </span>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {closestRoutes.map(({ route, km, badge }) => (
              <button
                key={`near-route-${route.id}`}
                type="button"
                onClick={() => onSelectNearbyRoute(route)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 8,
                  padding: '7px 9px',
                  borderRadius: 12,
                  border: '0.5px solid rgba(23, 64, 44, 0.1)',
                  background: 'rgba(255, 255, 255, 0.72)',
                  cursor: 'pointer',
                  textAlign: 'left',
                }}
              >
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, minWidth: 0 }}>
                  <Route size={14} color="#17402C" aria-hidden="true" style={{ flex: 'none' }} />
                  <span style={{ fontSize: 12, fontWeight: 700, color: '#172B24', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {badge} · {route.name || route.ref || `Parcours #${route.id}`}
                  </span>
                </span>
                <span style={{ fontSize: 11.5, fontWeight: 700, color: '#56665D', flex: 'none', fontVariantNumeric: 'tabular-nums' }}>
                  {route.distance_km != null ? `${route.distance_km.toFixed(1)} km` : km < 1 ? `${Math.round(km * 1000)} m` : `${km.toFixed(1)} km`}
                </span>
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {/* Active community terrain reports — Autour sub-drawer */}
      {poiLens === 'autour' && localReports.length > 0 ? (
        <div
          className="club-glass-card"
          style={{ padding: '11px 12px', borderRadius: 16, display: 'flex', flexDirection: 'column', gap: 7 }}
        >
          <span style={{ fontSize: 11, fontWeight: 800, color: '#56665D', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            Signalements terrain récents
          </span>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {localReports.map(({ report, km }) => {
              const sevColor =
                report.severity === 'critical'
                  ? '#991B1B'
                  : report.severity === 'warning'
                    ? '#92400E'
                    : '#17402C';
              const sevBg =
                report.severity === 'critical'
                  ? 'rgba(220, 38, 38, 0.11)'
                  : report.severity === 'warning'
                    ? 'rgba(217, 119, 6, 0.13)'
                    : 'rgba(150, 186, 142, 0.22)';
              return (
                <div
                  key={report.id}
                  style={{
                    padding: '8px 10px',
                    borderRadius: 12,
                    background: 'rgba(255, 255, 255, 0.76)',
                    border: '0.5px solid rgba(23, 64, 44, 0.1)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 4,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
                    <span
                      style={{
                        padding: '2px 7px',
                        borderRadius: 999,
                        background: sevBg,
                        color: sevColor,
                        fontSize: 10.5,
                        fontWeight: 700,
                      }}
                    >
                      {formatReportCategoryFr(report.category)}
                    </span>
                    <span style={{ fontSize: 10.5, fontWeight: 600, color: '#56665D', fontVariantNumeric: 'tabular-nums' }}>
                      {km < 1 ? `${Math.round(km * 1000)} m` : `${km.toFixed(1)} km`} · {formatReportAge(report.created_at)}
                    </span>
                  </div>
                  {report.description ? (
                    <div style={{ fontSize: 12, fontWeight: 500, color: '#1F332B', lineHeight: 1.35 }}>
                      {report.description}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>
      ) : null}

      {/* Utility actions: Aperçu & Infos & Autour */}
      {poiLens === 'apercu' || poiLens === 'autour' ? (
      <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap' }}>
        <button
          type="button"
          onClick={onToggleSave}
          style={{
            flex: '1 1 auto',
            height: 36,
            padding: '0 12px',
            borderRadius: 999,
            border: '0.5px solid rgba(23, 64, 44, 0.16)',
            background: isSaved ? 'rgba(23, 64, 44, 0.12)' : 'rgba(255, 255, 255, 0.86)',
            color: '#17402C',
            fontSize: 12,
            fontWeight: 700,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
            cursor: 'pointer',
          }}
        >
          <Bookmark size={13} fill={isSaved ? 'currentColor' : 'none'} aria-hidden="true" />
          <span>{isSaved ? 'Enregistré' : 'Enregistrer'}</span>
        </button>

        <button
          type="button"
          onClick={() => void handleShare()}
          style={{
            flex: '1 1 auto',
            height: 36,
            padding: '0 12px',
            borderRadius: 999,
            border: '0.5px solid rgba(23, 64, 44, 0.16)',
            background: 'rgba(255, 255, 255, 0.86)',
            color: '#172B24',
            fontSize: 12,
            fontWeight: 700,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
            cursor: 'pointer',
          }}
        >
          {sharedFeedback ? <Check size={13} color="#15803D" aria-hidden="true" /> : <Share2 size={13} aria-hidden="true" />}
          <span>{sharedFeedback ? 'Lien copié' : 'Partager'}</span>
        </button>

        <button
          type="button"
          onClick={handleCopyGps}
          style={{
            flex: '1 1 auto',
            height: 36,
            padding: '0 12px',
            borderRadius: 999,
            border: '0.5px solid rgba(23, 64, 44, 0.16)',
            background: 'rgba(255, 255, 255, 0.86)',
            color: '#172B24',
            fontSize: 12,
            fontWeight: 700,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
            cursor: 'pointer',
          }}
        >
          {copiedGps ? <Check size={13} color="#15803D" aria-hidden="true" /> : <Copy size={13} aria-hidden="true" />}
          <span>{copiedGps ? 'GPS copié' : `${poi.lat.toFixed(4)}, ${poi.lon.toFixed(4)}`}</span>
        </button>

        <button
          type="button"
          onClick={() => {
            setReportOpen((v) => !v);
            setReportStatus('idle');
            if (!selectedPresetId && reportPresets[0]) {
              setSelectedPresetId(reportPresets[0].id);
            }
          }}
          aria-expanded={reportOpen}
          style={{
            flex: '1 1 auto',
            height: 36,
            padding: '0 12px',
            borderRadius: 999,
            border: '0.5px solid rgba(180, 83, 9, 0.24)',
            background: reportOpen ? 'rgba(217, 119, 6, 0.15)' : 'rgba(255, 255, 255, 0.86)',
            color: '#92400E',
            fontSize: 12,
            fontWeight: 700,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
            cursor: 'pointer',
          }}
        >
          <Flag size={13} aria-hidden="true" />
          <span>Signaler l’état</span>
        </button>

        {detail?.osmUrl ? (
          <a
            href={detail.osmUrl}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              height: 36,
              padding: '0 12px',
              borderRadius: 999,
              border: '0.5px solid rgba(23, 64, 44, 0.14)',
              background: 'rgba(255, 255, 255, 0.78)',
              color: '#56665D',
              fontSize: 11.5,
              fontWeight: 700,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
              textDecoration: 'none',
            }}
          >
            <Compass size={12} aria-hidden="true" />
            <span>OSM</span>
          </a>
        ) : null}
      </div>
      ) : null}

      {/* Inline contextual quick-report panel */}
      {reportOpen ? (
        <div
          ref={reportPanelRef}
          className="club-glass-card"
          style={{
            padding: '11px 12px',
            borderRadius: 16,
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
            border: '0.5px solid rgba(180, 83, 9, 0.2)',
          }}
        >
          <span style={{ fontSize: 11, fontWeight: 800, color: '#56665D', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            État constaté sur place
          </span>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {reportPresets.map((preset) => {
              const active = (selectedPresetId ?? reportPresets[0]?.id) === preset.id;
              return (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => setSelectedPresetId(preset.id)}
                  style={{
                    height: 30,
                    padding: '0 11px',
                    borderRadius: 999,
                    border: active ? '1px solid #17402C' : '0.5px solid rgba(23, 64, 44, 0.16)',
                    background: active ? '#17402C' : 'rgba(255, 255, 255, 0.9)',
                    color: active ? '#FBFAF6' : '#172B24',
                    fontSize: 11.5,
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  {preset.label}
                </button>
              );
            })}
          </div>
          <input
            type="text"
            value={reportNote}
            onChange={(e) => setReportNote(e.target.value)}
            placeholder="Précision utile (facultatif)…"
            maxLength={240}
            style={{
              height: 36,
              padding: '0 12px',
              borderRadius: 12,
              border: '0.5px solid rgba(23, 64, 44, 0.16)',
              background: 'rgba(255, 255, 255, 0.92)',
              color: '#172B24',
              fontSize: 12.5,
              fontWeight: 500,
              outline: 'none',
            }}
          />
          {reportStatus === 'auth' ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, fontSize: 12, color: '#92400E', fontWeight: 600 }}>
              <span>Connectez-vous pour publier un signalement terrain.</span>
              <Link
                href="/connexion"
                style={{
                  padding: '5px 11px',
                  borderRadius: 999,
                  background: '#17402C',
                  color: '#FBFAF6',
                  textDecoration: 'none',
                  fontSize: 11.5,
                  fontWeight: 700,
                  flex: 'none',
                }}
              >
                Connexion
              </Link>
            </div>
          ) : reportStatus === 'sent' ? (
            <div style={{ fontSize: 12, fontWeight: 700, color: '#15803D' }}>
              ✓ Merci ! Votre signalement terrain a bien été enregistré.
            </div>
          ) : reportStatus === 'error' ? (
            <div style={{ fontSize: 12, fontWeight: 600, color: '#991B1B' }}>
              Impossible d’enregistrer pour le moment. Réessayez plus tard.
            </div>
          ) : null}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 6 }}>
            <button
              type="button"
              onClick={() => setReportOpen(false)}
              style={{
                height: 32,
                padding: '0 12px',
                borderRadius: 999,
                border: '0.5px solid rgba(23, 64, 44, 0.14)',
                background: 'rgba(255, 255, 255, 0.85)',
                color: '#56665D',
                fontSize: 12,
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              Fermer
            </button>
            <button
              type="button"
              disabled={reportStatus === 'submitting' || reportStatus === 'sent'}
              onClick={() => void handleSubmitReport()}
              style={{
                height: 32,
                padding: '0 14px',
                borderRadius: 999,
                border: 0,
                background: '#17402C',
                color: '#FBFAF6',
                fontSize: 12,
                fontWeight: 700,
                cursor: reportStatus === 'submitting' || reportStatus === 'sent' ? 'default' : 'pointer',
                opacity: reportStatus === 'submitting' || reportStatus === 'sent' ? 0.6 : 1,
              }}
            >
              {reportStatus === 'submitting' ? 'Envoi…' : reportStatus === 'sent' ? 'Envoyé ✓' : 'Publier'}
            </button>
          </div>
        </div>
      ) : null}

      </div>

      {/* Carnet & Club Style Bottom Sub-Drawer Dock: Y aller (left) + Icon-Only Glass Lens Capsule (right) */}
      <div className="xp20-subdrawer-dock">
        <button
          type="button"
          className="xp20-floating-pill-primary xp20-subdrawer-cta"
          onClick={onPlanRouteToPoi ?? onStartActivity}
        >
          <Route size={14} aria-hidden="true" />
          <span>Y aller</span>
        </button>

        <div
          className="xp20-glass-lens-capsule"
          role="tablist"
          aria-label="Sous-tiroirs du lieu"
          style={{ '--n': 3 } as React.CSSProperties}
        >
          <span
            className="xp20-glass-lens-thumb"
            aria-hidden="true"
            style={{
              width: 'calc((100% - 6px) / 3)',
              transform: `translateX(${(poiLens === 'apercu' ? 0 : poiLens === 'infos' ? 1 : 2) * 100}%)`,
            }}
          />
          <button
            type="button"
            role="tab"
            aria-selected={poiLens === 'apercu'}
            aria-label="Aperçu du lieu"
            title="Aperçu"
            className="xp20-glass-lens-btn"
            data-active={poiLens === 'apercu' ? 'true' : 'false'}
            onClick={() => setPoiLens('apercu')}
          >
            <Eye size={16} strokeWidth={2} aria-hidden="true" />
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={poiLens === 'infos'}
            aria-label="Informations détaillées"
            title="Infos"
            className="xp20-glass-lens-btn"
            data-active={poiLens === 'infos' ? 'true' : 'false'}
            onClick={() => setPoiLens('infos')}
          >
            <Info size={16} strokeWidth={2} aria-hidden="true" />
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={poiLens === 'autour'}
            aria-label="Autour de ce lieu"
            title="Autour"
            className="xp20-glass-lens-btn"
            data-active={poiLens === 'autour' ? 'true' : 'false'}
            onClick={() => setPoiLens('autour')}
          >
            <Compass size={16} strokeWidth={2} aria-hidden="true" />
          </button>
        </div>
      </div>
    </div>
  );
}
