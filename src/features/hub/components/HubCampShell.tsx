'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import {
  ArrowLeft,
  ArrowRight,
  Backpack,
  ChevronDown,
  ChevronUp,
  Compass,
  Flame,
  MapPin,
  Mountain,
  Package,
  Plus,
  RotateCw,
  Sliders,
  Users,
  X,
} from 'lucide-react';
import '../styles/hub-camp-option3.css';
import { DrawerEmpty, DrawerShell, type DrawerTab } from '@/components/ui/drawer';
import { useKeyboardInsets } from '@/hooks/useKeyboardInsets';
import { useActiveAdventure } from '../context/ActiveAdventureContext';
import type { ActiveAdventureData } from '../context/adventureSchema';
import {
  HUB_HOME_HREF,
  HUB_NEW_HREF,
  hubSectionRegistry,
  type HubCounters,
  type HubSectionDef,
} from '../registry/hubSectionRegistry';
import {
  DEFAULT_STUDIO_DRAWER,
  DrawerNavigationMachine,
  hubDrawerUrl,
  isGearHubSection,
  parseHubUrlState,
  serializeHubUrlState,
  type DrawerMachineState,
  type StudioDrawer,
} from '../state/drawerMachine';
import { CampMap } from './CampMap';
import { HubResumeBanner } from './HubResumeBanner';
import { KitStudioView } from '@/features/kit-studio/components/KitStudioView';
import {
  DocsMobileExperience,
  ItineraryMobileExperience,
  JournalMobileExperience,
  SafetyMobileExperience,
  TeamMobileExperience,
} from '@/app/hub/[section]/sectionViews.client';

export interface HubCampShellProps {
  initialDrawer?: string;
  trip?: any;
  hiking?: { routeGeojson?: Record<string, unknown> | null } | null;
  adventure?: ActiveAdventureData | null;
  counts?: HubCounters;
  searchParams?: Record<string, string | string[] | undefined>;
  drawerContent?: React.ReactNode;
}

function buildSearchString(params?: Record<string, string | string[] | undefined>): string {
  if (!params) return '';
  const usp = new URLSearchParams();
  for (const [key, val] of Object.entries(params)) {
    if (typeof val === 'string') {
      usp.set(key, val);
    } else if (Array.isArray(val) && val[0]) {
      usp.set(key, val[0]);
    }
  }
  const str = usp.toString();
  return str ? `?${str}` : '';
}

function extractRouteCoordsFromProps(
  trip?: any,
  hiking?: { routeGeojson?: Record<string, unknown> | null } | null
): Array<[number, number]> {
  const fromSteps = Array.isArray(trip?.steps)
    ? trip.steps
        .map((s: any) => [Number(s?.latitude), Number(s?.longitude)] as [number, number])
        .filter(
          ([lat, lng]: [number, number]) =>
            Number.isFinite(lat) && Number.isFinite(lng) && (lat !== 0 || lng !== 0)
        )
    : [];

  if (fromSteps.length > 0) {
    return fromSteps;
  }

  const geo = hiking?.routeGeojson;
  if (geo && geo.type === 'LineString' && Array.isArray(geo.coordinates)) {
    return (geo.coordinates as unknown[])
      .filter((pt): pt is [number, number] => Array.isArray(pt) && pt.length >= 2)
      .map(([lng, lat]) => [Number(lat), Number(lng)] as [number, number])
      .filter(([lat, lng]) => Number.isFinite(lat) && Number.isFinite(lng));
  }

  return [];
}

function adventureResumeKey(adventure?: ActiveAdventureData | null): string | null {
  if (!adventure) return null;
  if (adventure.nature === 'possession') return 'possession';
  if (adventure.nature === 'sortie' && adventure.slug) return `sortie:${adventure.slug}`;
  if (adventure.nature === 'collectif' && adventure.id) return `collectif:${adventure.id}`;
  return null;
}

function describeNatureGroup(def: HubSectionDef): string {
  if (def.natures.includes('possession')) return 'Équipement';
  if (def.natures.includes('collectif') && !def.natures.includes('sortie')) return 'Équipage';
  return 'Terrain & Sortie';
}

export function HubCampShell({
  initialDrawer,
  trip,
  hiking,
  adventure,
  counts,
  searchParams,
  drawerContent,
}: HubCampShellProps) {
  const router = useRouter();
  const pathname = usePathname();
  const liveSearchParams = useSearchParams();
  const { setLastSection } = useActiveAdventure();

  const initialPathname = initialDrawer ? hubDrawerUrl(initialDrawer) : HUB_HOME_HREF;
  const initialSearch = buildSearchString(searchParams);

  const machineRef = useRef<DrawerNavigationMachine | null>(null);
  const lastSyncedUrlRef = useRef<string>('');
  const drawerScrollRef = useRef<HTMLDivElement | null>(null);

  if (!machineRef.current) {
    const parsed = parseHubUrlState(initialPathname, initialSearch);
    machineRef.current = new DrawerNavigationMachine(parsed);
    lastSyncedUrlRef.current = serializeHubUrlState(parsed);
  }

  const [navState, setNavState] = useState<DrawerMachineState>(() =>
    machineRef.current!.getState()
  );

  const [liveRouteCoords, setLiveRouteCoords] = useState<Array<[number, number]>>(() =>
    extractRouteCoordsFromProps(trip, hiking)
  );

  const [liveTripTitle, setLiveTripTitle] = useState<string | null>(trip?.title ?? null);
  const [livePossessionCounts, setLivePossessionCounts] = useState<{
    items?: number;
    loans?: number;
    alerts?: number;
  }>({});
  const [syncError, setSyncError] = useState<string | null>(null);
  const [focus, setFocus] = useState<'camp' | 'bag' | 'route' | 'group' | 'prep'>('camp');
  const [offset, setOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [modulesOpen, setModulesOpen] = useState(false);
  const downRef = useRef<{ x: number; y: number } | null>(null);

  // Évitement dynamique du clavier virtuel sur mobile (B-11)
  useKeyboardInsets();

  const refreshCampContext = useCallback(async () => {
    setSyncError(null);
    try {
      const res = await fetch('/api/hub/adventures', { cache: 'no-store' });
      if (!res.ok) {
        throw new Error(`Synchronisation refusée (${res.status})`);
      }
      const payload = await res.json();
      if (Array.isArray(payload?.activeRouteCoords) && payload.activeRouteCoords.length > 0) {
        setLiveRouteCoords(payload.activeRouteCoords);
      }
      if (typeof payload?.activeTripTitle === 'string' && payload.activeTripTitle.trim()) {
        setLiveTripTitle(payload.activeTripTitle);
      }
      if (payload?.possession && typeof payload.possession === 'object') {
        setLivePossessionCounts({
          items:
            typeof payload.possession.items === 'number' ? payload.possession.items : undefined,
          loans:
            typeof payload.possession.loans === 'number' ? payload.possession.loans : undefined,
          alerts:
            typeof payload.possession.alerts === 'number' ? payload.possession.alerts : undefined,
        });
      }
    } catch (err) {
      setSyncError(
        err instanceof Error
          ? err.message
          : 'Impossible de synchroniser les données du Camp de base.'
      );
    }
  }, []);

  useEffect(() => {
    void refreshCampContext();
  }, [refreshCampContext]);

  // Abonnement aux transitions de la machine de tiroirs
  useEffect(() => {
    const unsub = machineRef.current!.subscribe((st) => setNavState(st));
    return unsub;
  }, []);

  // Synchronisation lorsque Next.js navigue via <Link> externe (ex. HubResumeBanner)
  useEffect(() => {
    if (!pathname || !machineRef.current) return;
    const qs = liveSearchParams?.toString() ?? '';
    const currentUrl = qs ? `${pathname}?${qs}` : pathname;
    if (currentUrl === lastSyncedUrlRef.current) return;

    const next = machineRef.current.syncFromUrl(pathname, qs ? `?${qs}` : '');
    lastSyncedUrlRef.current = serializeHubUrlState(next);
    if (next.type === 'CLOSED' && next.redirectHref) {
      router.replace(next.redirectHref);
    }
  }, [pathname, liveSearchParams, router]);

  // Hiérarchie stricte du retour arrière navigateur / mobile (B-05)
  useEffect(() => {
    const onPopState = () => {
      if (!machineRef.current) return;
      const result = machineRef.current.handlePopState();
      if (result.handled) {
        const targetUrl = serializeHubUrlState(result.state);
        lastSyncedUrlRef.current = targetUrl;
        const currentBrowserUrl = `${window.location.pathname}${window.location.search}`;
        if (currentBrowserUrl !== targetUrl) {
          window.history.replaceState(null, '', targetUrl);
        }
      }
    };

    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  const pushMachineUrl = useCallback((state: DrawerMachineState) => {
    const targetUrl = serializeHubUrlState(state);
    lastSyncedUrlRef.current = targetUrl;
    if (typeof window !== 'undefined') {
      const currentBrowserUrl = `${window.location.pathname}${window.location.search}`;
      if (currentBrowserUrl !== targetUrl) {
        window.history.pushState(null, '', targetUrl);
      }
    }
  }, []);

  const recordResumeSection = useCallback(
    (sectionId: string) => {
      const key = adventureResumeKey(adventure);
      if (key && sectionId && sectionId !== 'overview') {
        setLastSection(key, sectionId);
      }
    },
    [adventure, setLastSection]
  );

  const handleOpenRegistryEntry = useCallback(
    (def: HubSectionDef) => {
      if (!machineRef.current) return;

      if (def.id === 'preparation') {
        router.push('/compas?etape=kit');
        return;
      }

      if (def.segment === '') {
        machineRef.current.closeDrawer();
        pushMachineUrl(machineRef.current.getState());
        return;
      }

      if (
        (navState.type === 'DRAWER_OPEN' || navState.type === 'SUB_DRAWER_OPEN') &&
        drawerScrollRef.current
      ) {
        machineRef.current.saveScrollPosition(
          navState.drawerId,
          drawerScrollRef.current.scrollTop
        );
      }

      const resolved = machineRef.current.openDrawer(def.segment);
      if (resolved?.kind === 'redirect') {
        router.push(resolved.href);
        return;
      }
      if (resolved?.kind === 'drawer') {
        recordResumeSection(resolved.sectionId);
      }
      pushMachineUrl(machineRef.current.getState());
    },
    [navState, pushMachineUrl, recordResumeSection, router]
  );

  const handleCloseDrawer = useCallback(() => {
    if (!machineRef.current) return;
    if (
      (navState.type === 'DRAWER_OPEN' || navState.type === 'SUB_DRAWER_OPEN') &&
      drawerScrollRef.current
    ) {
      machineRef.current.saveScrollPosition(navState.drawerId, drawerScrollRef.current.scrollTop);
    }
    machineRef.current.closeDrawer();
    pushMachineUrl(machineRef.current.getState());
  }, [navState, pushMachineUrl]);

  const handleOpenSubDrawer = useCallback(
    (subId: string) => {
      if (!machineRef.current) return;
      machineRef.current.openSubDrawer(subId);
      pushMachineUrl(machineRef.current.getState());
    },
    [pushMachineUrl]
  );

  const handleCloseSubDrawer = useCallback(() => {
    if (!machineRef.current) return;
    machineRef.current.closeSubDrawer();
    pushMachineUrl(machineRef.current.getState());
  }, [pushMachineUrl]);

  const handleEnterStudio = useCallback(
    (drawer?: StudioDrawer, kitId?: string | null) => {
      if (!machineRef.current) return;
      machineRef.current.enterStudio(drawer, kitId);
      pushMachineUrl(machineRef.current.getState());
    },
    [pushMachineUrl]
  );

  const handleSelectStudioDrawer = useCallback(
    (drawer?: StudioDrawer) => {
      if (!machineRef.current) return;
      machineRef.current.setStudioDrawer(drawer);
      pushMachineUrl(machineRef.current.getState());
    },
    [pushMachineUrl]
  );

  const handleExitStudio = useCallback(() => {
    if (!machineRef.current) return;
    machineRef.current.exitStudio();
    pushMachineUrl(machineRef.current.getState());
  }, [pushMachineUrl]);

  const activeDrawerSegment =
    navState.type === 'DRAWER_OPEN' || navState.type === 'SUB_DRAWER_OPEN'
      ? navState.drawerId
      : null;

  const activeSubDrawerId =
    navState.type === 'SUB_DRAWER_OPEN' ? navState.subDrawerId : null;

  // Restauration de position de scroll du tiroir (scrollCache)
  useEffect(() => {
    if (!activeDrawerSegment || !drawerScrollRef.current || !machineRef.current) return;
    const savedTop = machineRef.current.getScrollPosition(activeDrawerSegment);
    drawerScrollRef.current.scrollTop = savedTop;
  }, [activeDrawerSegment]);

  const effectiveCounts = useMemo<HubCounters>(
    () => ({
      ...counts,
      items: livePossessionCounts.items ?? counts?.items,
      loans: livePossessionCounts.loans ?? counts?.loans,
      alerts: livePossessionCounts.alerts ?? counts?.alerts,
    }),
    [counts, livePossessionCounts]
  );

  const propRouteCoords = useMemo(() => extractRouteCoordsFromProps(trip, hiking), [trip, hiking]);
  const effectiveRouteCoords =
    propRouteCoords.length > 0 ? propRouteCoords : liveRouteCoords;

  const effectiveTitle =
    (adventure && 'title' in adventure && adventure.title) ||
    liveTripTitle ||
    trip?.title ||
    'Camp de Base';

  const isEmptyProject =
    !trip &&
    effectiveRouteCoords.length === 0 &&
    adventure?.nature !== 'collectif' &&
    (effectiveCounts.items ?? 0) === 0;

  const activeDef = useMemo(
    () =>
      activeDrawerSegment
        ? hubSectionRegistry.find((d) => d.segment === activeDrawerSegment) ?? null
        : null,
    [activeDrawerSegment]
  );

  const renderDrawerBody = useCallback(
    (def: HubSectionDef) => {
      if (activeSubDrawerId) {
        return (
          <div data-testid="hub-active-subdrawer" className="p-4 space-y-4">
            <div className="flex items-center justify-between gap-2 pb-2 border-b border-[var(--hub-border-subtle)]">
              <button
                type="button"
                data-testid="hub-close-subdrawer"
                onClick={handleCloseSubDrawer}
                className="min-h-[44px] px-3 rounded-xl bg-[var(--hub-surface)] border border-[var(--hub-border)] text-xs font-semibold text-[var(--hub-text-primary)] inline-flex items-center gap-1.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--hub-action)]"
              >
                <ArrowLeft className="w-4 h-4" aria-hidden="true" />
                <span>Retour à {def.label}</span>
              </button>
              <span className="text-xs text-[var(--hub-text-muted)]">Sous-tiroir • {activeSubDrawerId}</span>
            </div>

            <div className="p-4 rounded-2xl bg-[var(--hub-surface)] border border-[var(--hub-border)] space-y-3">
              <h4 className="text-sm font-bold text-[var(--hub-text-primary)]">
                Actions rapides — {def.label}
              </h4>
              <p className="text-xs text-[var(--hub-text-secondary)]">
                Accédez directement à l’atelier d’équipement ou lancez une nouvelle préparation dans le Compas.
              </p>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => handleEnterStudio(DEFAULT_STUDIO_DRAWER)}
                  className="min-h-[44px] px-4 rounded-xl bg-[var(--hub-primary)] text-[var(--hub-text-inverted)] text-xs font-semibold inline-flex items-center gap-1.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--hub-action)]"
                >
                  <Backpack className="w-4 h-4" aria-hidden="true" />
                  <span>Ouvrir Kit Studio</span>
                </button>
                <Link
                  href={HUB_NEW_HREF}
                  className="min-h-[44px] px-4 rounded-xl bg-[var(--hub-surface-card)] border border-[var(--hub-border)] text-[var(--hub-text-primary)] text-xs font-semibold inline-flex items-center gap-1.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--hub-action)]"
                >
                  <Compass className="w-4 h-4" aria-hidden="true" />
                  <span>Ouvrir le Compas</span>
                </Link>
              </div>
            </div>
          </div>
        );
      }

      if (drawerContent && initialDrawer === def.segment) {
        return (
          <div className="p-4 space-y-4">
            <div className="flex justify-end">
              <button
                type="button"
                data-testid="hub-open-subdrawer"
                onClick={() => handleOpenSubDrawer('actions')}
                className="min-h-[44px] px-3 rounded-xl bg-[var(--hub-surface)] border border-[var(--hub-border)] text-xs font-semibold text-[var(--hub-text-primary)] inline-flex items-center gap-1.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--hub-action)]"
              >
                <span>Options de section</span>
                <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
              </button>
            </div>
            {drawerContent}
          </div>
        );
      }

      const sectionCount = def.counter(effectiveCounts);

      if (def.id === 'itinerary' && trip) {
        return (
          <div className="p-3 space-y-3">
            <div className="flex justify-end">
              <button
                type="button"
                data-testid="hub-open-subdrawer"
                onClick={() => handleOpenSubDrawer('actions')}
                className="min-h-[44px] px-3 rounded-xl bg-[var(--hub-surface)] border border-[var(--hub-border)] text-xs font-semibold text-[var(--hub-text-primary)]"
              >
                Options d’itinéraire
              </button>
            </div>
            <ItineraryMobileExperience trip={trip} initialSteps={trip.steps || []} />
          </div>
        );
      }

      if (def.id === 'groupe' && trip) {
        return (
          <div className="p-3 space-y-3">
            <div className="flex justify-end">
              <button
                type="button"
                data-testid="hub-open-subdrawer"
                onClick={() => handleOpenSubDrawer('actions')}
                className="min-h-[44px] px-3 rounded-xl bg-[var(--hub-surface)] border border-[var(--hub-border)] text-xs font-semibold text-[var(--hub-text-primary)]"
              >
                Options de groupe
              </button>
            </div>
            <TeamMobileExperience trip={trip} />
          </div>
        );
      }

      if (def.id === 'safety' && trip) {
        return <SafetyMobileExperience trip={trip} />;
      }

      if (def.id === 'docs' && trip) {
        return <DocsMobileExperience trip={trip} />;
      }

      if (def.id === 'journal' && trip) {
        return <JournalMobileExperience trip={trip} />;
      }

      const isGearSection = isGearHubSection(def.id);

      return (
        <div className="p-4 space-y-4">
          <div className="p-4 rounded-2xl bg-[var(--hub-surface)] border border-[var(--hub-border)] flex items-start justify-between gap-3">
            <div className="space-y-1">
              <h4 className="font-bold text-sm text-[var(--hub-text-primary)]">{def.label}</h4>
              <p className="text-xs text-[var(--hub-text-secondary)]">
                {sectionCount !== null
                  ? `${sectionCount} élément${sectionCount > 1 ? 's' : ''} enregistré${sectionCount > 1 ? 's' : ''}`
                  : 'Section du Camp de base synchronisée avec votre compte.'}
              </p>
            </div>
            <button
              type="button"
              data-testid="hub-open-subdrawer"
              onClick={() => handleOpenSubDrawer('actions')}
              className="min-h-[44px] px-3 rounded-xl bg-[var(--hub-surface-card)] border border-[var(--hub-border)] text-xs font-semibold text-[var(--hub-text-primary)] shrink-0 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--hub-action)]"
            >
              Actions
            </button>
          </div>

          {isGearSection ? (
            <DrawerEmpty
              title={`Atelier ${def.label}`}
              hint="Organisez vos poches, pesez votre matériel sans valeur inventée et personnalisez votre sac dans le Kit Studio."
              action={
                <button
                  type="button"
                  className="lkdv-drawer-retry min-h-[44px]"
                  onClick={() => handleEnterStudio(DEFAULT_STUDIO_DRAWER)}
                >
                  Ouvrir l’atelier Kit Studio
                </button>
              }
            />
          ) : (
            <DrawerEmpty
              title={trip ? `${def.label} — ${effectiveTitle}` : `Aucun contenu actif dans ${def.label}`}
              hint={
                trip
                  ? 'Ouvrez la vue détaillée de cette section ou gérez votre matériel dans le Kit Studio.'
                  : 'Créez ou sélectionnez une sortie active depuis le Compas pour alimenter cette section.'
              }
              action={
                <button
                  type="button"
                  className="lkdv-drawer-retry min-h-[44px]"
                  onClick={() =>
                    router.push(trip && def.segment ? hubDrawerUrl(def.segment) : HUB_NEW_HREF)
                  }
                >
                  {trip ? `Charger ${def.label}` : 'Créer une nouvelle activité'}
                </button>
              }
            />
          )}
        </div>
      );
    },
    [
      activeSubDrawerId,
      drawerContent,
      effectiveCounts,
      effectiveTitle,
      handleCloseSubDrawer,
      handleEnterStudio,
      handleOpenSubDrawer,
      initialDrawer,
      router,
      trip,
    ]
  );

  const drawerTabs: DrawerTab[] = useMemo(() => {
    if (!activeDef) return [];
    const IconComp = activeDef.icon;
    return [
      {
        id: activeDef.segment || activeDef.id,
        label: activeDef.label,
        icon: <IconComp className="w-4 h-4" aria-hidden="true" />,
        render: () => renderDrawerBody(activeDef),
      },
    ];
  }, [activeDef, renderDrawerBody]);

  // Mode plein écran Kit Studio (?studio=1, zéro nouvelle route Next.js — B-02 / C-04)
  if (navState.type === 'STUDIO') {
    return (
      <KitStudioView
        requestedKitId={navState.kitId}
        activeDrawer={navState.activeDrawer}
        subDrawerId={navState.subDrawerId}
        tripId={trip?.id ?? null}
        crewId={adventure?.nature === 'collectif' ? adventure.id : null}
        onSelectDrawer={handleSelectStudioDrawer}
        onExitStudio={handleExitStudio}
      />
    );
  }

  return (
    <div
      data-testid="hub-camp-shell"
      className="hub-camp-option3-root flex flex-col w-full h-[100dvh] relative overflow-hidden"
      style={{
        boxSizing: 'border-box',
      }}
    >
      {/* ── 1. Le Monde Alpin (Arrière-plan immersif panoramique) ── */}
      <div
        className={`camp-world focus-${focus}`}
        style={
          {
            '--pan-x': `${offset.x}px`,
            '--pan-y': `${offset.y}px`,
          } as React.CSSProperties
        }
        onPointerDown={(e) => {
          downRef.current = { x: e.clientX, y: e.clientY };
        }}
        onPointerMove={(e) => {
          if (!downRef.current) return;
          setOffset({
            x: Math.max(-14, Math.min(14, (e.clientX - downRef.current.x) * 0.08)),
            y: Math.max(-10, Math.min(10, (e.clientY - downRef.current.y) * 0.05)),
          });
        }}
        onPointerUp={() => {
          downRef.current = null;
        }}
        onPointerLeave={() => {
          downRef.current = null;
        }}
      >
        <img
          className="camp-landscape"
          src="/assets/camp/camp-golden.jpg"
          alt="Camp au bord d’un lac turquoise des Alpes, tentes, feu et sac dans la lumière dorée"
          draggable={false}
        />
      </div>

      {/* ── 2. En-tête Flottant Liquid Glass ── */}
      <header className="camp-header">
        <button
          type="button"
          className="camp-identity"
          onClick={() => {
            const overviewDef =
              hubSectionRegistry.find((s) => s.segment === '') ?? hubSectionRegistry[0];
            handleOpenRegistryEntry(overviewDef);
          }}
          aria-label="Camp de base"
        >
          <span className="camp-identity-icon">
            <Mountain className="w-5 h-5" aria-hidden="true" />
          </span>
          <span>
            <strong>{effectiveTitle}</strong>
            <small>
              {trip?.destination ||
                (adventure?.nature === 'collectif' ? 'Équipage actif' : 'Camp de Base')}
            </small>
          </span>
        </button>

        <div className="camp-header-actions">
          <button
            type="button"
            data-testid="hub-enter-studio-header"
            onClick={() => handleEnterStudio(DEFAULT_STUDIO_DRAWER)}
            className="camp-header-btn camp-header-btn-studio"
            aria-label="Ouvrir Kit Studio 3D"
          >
            <Package className="w-4 h-4" aria-hidden="true" />
            <span>Kit Studio</span>
          </button>
        </div>
      </header>

      {/* ── 3. Hotspots Tactiles sur le Décor ── */}
      <div className="camp-locations" aria-label="Objets du camp">
        {/* 🎒 Mon kit */}
        <button
          type="button"
          data-testid="hub-hotspot-bag"
          className="hotspot hotspot-bag"
          onClick={() => {
            setFocus('bag');
            handleEnterStudio(DEFAULT_STUDIO_DRAWER);
          }}
        >
          <span className="hotspot-icon">
            <Backpack className="w-4 h-4" aria-hidden="true" />
          </span>
          <span>Mon kit</span>
        </button>

        {/* 🗺️ Itinéraire */}
        <button
          type="button"
          data-testid="hub-hotspot-route"
          className="hotspot hotspot-route"
          onClick={() => {
            setFocus('route');
            const routeDef = hubSectionRegistry.find(
              (s) => s.id === 'itinerary' || s.segment === 'itineraire'
            );
            if (routeDef) handleOpenRegistryEntry(routeDef);
          }}
        >
          <span className="hotspot-icon">
            <Compass className="w-4 h-4" aria-hidden="true" />
          </span>
          <span>Itinéraire</span>
        </button>

        {/* 👥 Le groupe */}
        <button
          type="button"
          data-testid="hub-hotspot-group"
          className="hotspot hotspot-tents"
          onClick={() => {
            setFocus('group');
            const groupDef = hubSectionRegistry.find((s) => s.id === 'groupe');
            if (groupDef) handleOpenRegistryEntry(groupDef);
          }}
        >
          <span className="hotspot-icon">
            <Users className="w-4 h-4" aria-hidden="true" />
          </span>
          <span>Le groupe</span>
        </button>

        {/* 🔥 Mon départ */}
        <button
          type="button"
          data-testid="hub-hotspot-fire"
          className="hotspot hotspot-fire"
          onClick={() => {
            setFocus('prep');
            const prepDef = hubSectionRegistry.find(
              (s) => s.id === 'depart' || s.id === 'preparation'
            );
            if (prepDef) handleOpenRegistryEntry(prepDef);
          }}
        >
          <span className="hotspot-icon">
            <Flame className="w-4 h-4" aria-hidden="true" />
          </span>
          <span>Mon départ</span>
        </button>

        {/* 🔄 Recentrer la scène */}
        <button
          type="button"
          className="scene-reset"
          aria-label="Recentrer le camp"
          onClick={() => {
            setOffset({ x: 0, y: 0 });
            setFocus('camp');
          }}
        >
          <RotateCw className="w-4 h-4" aria-hidden="true" />
        </button>
      </div>

      {/* ── 4. Volet Inférieur Coulissant Liquid Glass (Modules & Synthèse) ── */}
      <div className="camp-bottom-card">
        <button
          type="button"
          className="camp-panel-grip"
          aria-label={modulesOpen ? 'Replier les modules' : 'Déplier les modules'}
          onClick={() => setModulesOpen((prev) => !prev)}
        >
          <span />
        </button>

        <div className="camp-summary-row">
          <div className="camp-summary-copy">
            <h3>{effectiveTitle}</h3>
            <p>
              {isEmptyProject
                ? 'Aucun projet actif — commencez par composer votre sac'
                : `${effectiveCounts.items ?? 0} objets en sac · ${effectiveCounts.alerts ?? 0} alerte${(effectiveCounts.alerts ?? 0) > 1 ? 's' : ''}`}
            </p>
          </div>
          <button
            type="button"
            data-testid="hub-enter-studio-cta"
            onClick={() => handleEnterStudio()}
            className="camp-summary-badge"
          >
            Atelier 3D →
          </button>
        </div>

        {/* Bandeau discret de reprise < 24h (B-03 / B-04) */}
        <HubResumeBanner adventure={adventure} />

        {/* État d'erreur réseau non bloquant avec bouton Réessayer (A-07) */}
        {syncError && (
          <div
            data-testid="hub-sync-error"
            className="my-1.5 p-2 rounded-xl bg-amber-950/60 border border-amber-600/40 text-xs text-amber-100 flex items-center justify-between"
          >
            <span>{syncError}</span>
            <button
              type="button"
              className="px-2 py-1 rounded-lg bg-amber-600 text-white font-bold text-[11px]"
              onClick={() => {
                void refreshCampContext();
              }}
            >
              Réessayer
            </button>
          </div>
        )}

        {/* État de projet vide */}
        {isEmptyProject && (
          <div
            data-testid="hub-empty-project-state"
            className="my-1.5 p-3 rounded-2xl bg-white/70 border border-[#122F26]/10 space-y-2"
          >
            <p className="text-xs text-[#122F26] font-medium">
              Préparez votre premier sac dans le Kit Studio ou planifiez une aventure.
            </p>
            <div className="flex gap-2">
              <Link
                href={HUB_NEW_HREF}
                data-testid="hub-empty-create-activity"
                className="px-3 py-1.5 rounded-xl bg-[#2D7A58] text-white text-xs font-semibold inline-flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Créer</span>
              </Link>
              <button
                type="button"
                data-testid="hub-empty-open-studio"
                onClick={() => handleEnterStudio(DEFAULT_STUDIO_DRAWER)}
                className="px-3 py-1.5 rounded-xl bg-white text-[#122F26] border border-[#122F26]/20 text-xs font-semibold inline-flex items-center gap-1"
              >
                <Backpack className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Premier kit</span>
              </button>
            </div>
          </div>
        )}

        {/* Accordéon des 19 modules canoniques */}
        <button
          type="button"
          className="camp-modules-toggle"
          onClick={() => setModulesOpen((prev) => !prev)}
        >
          <span>{modulesOpen ? 'Masquer les 19 modules' : 'Tous les modules du camp (19)'}</span>
          {modulesOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
        </button>

        {modulesOpen && (
          <div className="camp-modules-grid">
            {hubSectionRegistry.map((def) => {
              const IconComp = def.icon;
              const badgeCount = def.counter(effectiveCounts);
              const tileKey = def.segment || 'overview';
              const isRootSelected = def.segment === '' && !activeDef;
              const isSelected = isRootSelected || activeDef?.id === def.id;

              return (
                <button
                  key={def.id}
                  type="button"
                  data-testid={`hub-section-tile-${tileKey}`}
                  data-section-id={def.id}
                  aria-current={isSelected ? 'true' : undefined}
                  onClick={() => handleOpenRegistryEntry(def)}
                  className="camp-module-pill"
                >
                  <div className="camp-module-icon">
                    <IconComp className="w-4 h-4" aria-hidden="true" />
                  </div>
                  <span className="camp-module-name">{def.label}</span>
                  {badgeCount !== null && (
                    <span className="camp-module-badge">{badgeCount}</span>
                  )}
                </button>
              );
            })}

            {/* Carte intégrée dans les modules */}
            <div className="col-span-2 pt-2">
              <div className="flex items-center justify-between px-1 pb-1">
                <span className="text-[11px] font-bold text-[#3B5246] flex items-center gap-1">
                  <MapPin className="w-3 h-3 text-[#2D7A58]" aria-hidden="true" />
                  Tracé de l’expédition
                </span>
                <span className="text-[10px] text-[#586960]">MapLibre</span>
              </div>
              <CampMap routeCoords={effectiveRouteCoords} title={effectiveTitle} />
            </div>
          </div>
        )}
      </div>

      {/* ── 5. Tiroir Actif (DrawerShell) ── */}
      {activeDef && (
        <div
          data-testid="hub-active-drawer"
          data-drawer-segment={activeDef.segment}
          role="dialog"
          aria-modal="true"
          aria-label={activeDef.label}
          className="hub-camp-drawer-overlay fixed inset-0 z-50 flex flex-col justify-end bg-black/60 backdrop-blur-md"
          style={{ overscrollBehavior: 'contain' }}
        >
          <div
            className="w-full max-h-[90dvh] flex flex-col bg-[#F7F3E9] rounded-t-[32px] border-t border-white/60 overflow-hidden shadow-2xl"
            style={{
              paddingBottom:
                'calc(max(16px, env(safe-area-inset-bottom, 0px)) + var(--keyboard-inset, 0px))',
            }}
          >
            <div className="flex items-center justify-between px-4 pt-3 pb-2 border-b border-[#122F26]/10">
              <span className="text-sm font-bold text-[#122F26] truncate">
                {activeDef.label}
              </span>
              <div
                aria-hidden="true"
                className="w-10 h-1.5 rounded-full bg-[#122F26]/20"
              />
              <button
                type="button"
                data-testid="hub-close-drawer"
                onClick={handleCloseDrawer}
                aria-label="Fermer le tiroir"
                className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-full text-[#122F26]/70 hover:text-[#122F26] hover:bg-[#122F26]/10 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#2D7A58]"
              >
                <X className="w-5 h-5" aria-hidden="true" />
              </button>
            </div>

            <div
              ref={drawerScrollRef}
              onScroll={(e) => {
                if (activeDef.segment) {
                  machineRef.current?.saveScrollPosition(
                    activeDef.segment,
                    e.currentTarget.scrollTop
                  );
                }
              }}
              className="flex-1 overflow-y-auto"
            >
              <DrawerShell
                tabs={drawerTabs}
                activeIndex={0}
                onIndexChange={() => {}}
                state="ready"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
