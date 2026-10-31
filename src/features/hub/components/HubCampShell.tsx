'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import {
  ArrowLeft,
  ArrowRight,
  Backpack,
  Compass,
  MapPin,
  Package,
  Plus,
  Sliders,
  X,
} from 'lucide-react';
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
      className="hub-camp-shell-root flex flex-col w-full min-h-[100dvh] bg-[var(--hub-bg)] text-[var(--hub-text-primary)]"
      style={{
        paddingTop: 'max(12px, var(--hub-safe-top))',
        paddingBottom: 'max(16px, var(--hub-safe-bottom))',
        paddingLeft: 'var(--hub-safe-left)',
        paddingRight: 'var(--hub-safe-right)',
        boxSizing: 'border-box',
      }}
    >
      {/* ── 1. En-tête du Camp de Base ── */}
      <header className="px-4 py-3 flex items-center justify-between gap-3 border-b border-[var(--hub-border-subtle)] bg-[var(--hub-surface-card)]">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-10 h-10 rounded-2xl bg-[var(--hub-primary-subtle)] flex items-center justify-center text-[var(--hub-primary)] shrink-0">
            <Backpack className="w-5 h-5" aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <h1 className="text-base font-bold text-[var(--hub-primary)] leading-tight truncate">
              {effectiveTitle}
            </h1>
            <p className="text-xs text-[var(--hub-text-muted)] truncate">
              {trip?.destination || (adventure?.nature === 'collectif' ? 'Équipage actif' : 'Camp de Base')} • Vue d’ensemble
            </p>
          </div>
        </div>

        <button
          type="button"
          data-testid="hub-enter-studio-header"
          onClick={() => handleEnterStudio(DEFAULT_STUDIO_DRAWER)}
          className="min-h-[44px] min-w-[44px] px-3.5 rounded-full bg-[var(--hub-action)] text-[var(--hub-text-inverted)] text-xs font-semibold flex items-center gap-1.5 transition-transform active:scale-95 shrink-0 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--hub-action)]"
        >
          <Package className="w-4 h-4" aria-hidden="true" />
          <span>Kit Studio</span>
        </button>
      </header>

      {/* ── 2. Corps Principal du Camp ── */}
      <main
        inert={Boolean(activeDef) || undefined}
        aria-hidden={activeDef ? 'true' : undefined}
        className="flex-1 flex flex-col p-4 gap-5 overflow-y-auto"
      >
        {/* Bandeau discret de reprise < 24h, zéro redirection automatique (B-03 / B-04) */}
        <HubResumeBanner adventure={adventure} />

        {/* État d'erreur réseau non bloquant avec bouton Réessayer (A-07) */}
        {syncError && (
          <div data-testid="hub-sync-error" className="rounded-2xl border border-[var(--hub-border)] bg-[var(--hub-surface-card)]">
            <div className="lkdv-drawer-state" data-state="error" role="alert">
              <p>
                <b>Synchronisation du Camp interrompue</b>
              </p>
              <p>{syncError}</p>
              <button
                type="button"
                className="lkdv-drawer-retry min-h-[44px]"
                onClick={() => {
                  void refreshCampContext();
                }}
              >
                Réessayer
              </button>
            </div>
          </div>
        )}

        {/* État explicite de projet vide sans coordonnées fictives (B-09) */}
        {isEmptyProject && (
          <section
            data-testid="hub-empty-project-state"
            aria-label="Aucun projet actif"
            className="p-4 rounded-3xl bg-[var(--hub-surface-card)] border border-[var(--hub-border)] space-y-3"
          >
            <div className="space-y-1">
              <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--hub-secondary)]">
                Premier bivouac
              </span>
              <h2 className="text-sm font-bold text-[var(--hub-text-primary)]">
                Aucune sortie ni inventaire actif pour l’instant
              </h2>
              <p className="text-xs text-[var(--hub-text-secondary)]">
                Préparez votre premier sac dans le Kit Studio ou planifiez un itinéraire réel dans le Compas.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Link
                href={HUB_NEW_HREF}
                data-testid="hub-empty-create-activity"
                className="min-h-[44px] px-4 rounded-2xl bg-[var(--hub-primary)] text-[var(--hub-text-inverted)] text-xs font-semibold inline-flex items-center gap-1.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--hub-action)]"
              >
                <Plus className="w-4 h-4" aria-hidden="true" />
                <span>Créer une activité</span>
              </Link>
              <button
                type="button"
                data-testid="hub-empty-open-studio"
                onClick={() => handleEnterStudio(DEFAULT_STUDIO_DRAWER)}
                className="min-h-[44px] px-4 rounded-2xl bg-[var(--hub-surface)] border border-[var(--hub-border)] text-[var(--hub-text-primary)] text-xs font-semibold inline-flex items-center gap-1.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--hub-action)]"
              >
                <Backpack className="w-4 h-4" aria-hidden="true" />
                <span>Créer mon premier kit</span>
              </button>
            </div>
          </section>
        )}

        {/* Carte d'entrée vers le Kit Studio 3D */}
        <section
          aria-label="Atelier Kit Studio"
          className="p-4 rounded-3xl bg-[var(--hub-surface-card)] border border-[var(--hub-border)] flex items-center justify-between gap-4"
        >
          <div className="space-y-1">
            <span className="text-[11px] font-bold tracking-wider uppercase text-[var(--hub-secondary)]">
              Atelier d’équipement
            </span>
            <h2 className="text-base font-bold text-[var(--hub-primary)]">
              Kit Studio 3D & Sac à dos
            </h2>
            <p className="text-xs text-[var(--hub-text-secondary)]">
              Organisation par poches, pesée honnête g / kg, personnalisation et insignes.
            </p>
          </div>
          <button
            type="button"
            data-testid="hub-enter-studio-cta"
            onClick={() => handleEnterStudio()}
            className="min-h-[44px] min-w-[44px] px-4 rounded-2xl bg-[var(--hub-primary)] text-[var(--hub-text-inverted)] text-xs font-semibold flex items-center gap-2 active:scale-95 transition-transform shrink-0 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--hub-action)]"
          >
            <Sliders className="w-4 h-4" aria-hidden="true" />
            <span>Ouvrir</span>
          </button>
        </section>

        {/* Grille des 19 entrées canoniques de hubSectionRegistry (B-01) */}
        <section aria-label="Sections du Camp de base" className="space-y-3">
          <div className="flex items-center justify-between px-1">
            <h2 className="text-xs font-bold uppercase tracking-wider text-[var(--hub-text-muted)]">
              Modules du Camp de base
            </h2>
            <span className="text-xs text-[var(--hub-text-subtle)]">
              {hubSectionRegistry.length} sections
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
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
                  className={`min-h-[60px] min-w-[44px] p-3 rounded-2xl border transition-colors flex items-center gap-3 text-left group focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--hub-action)] ${
                    isSelected
                      ? 'bg-[var(--hub-primary-subtle)] border-[var(--hub-primary)]'
                      : 'bg-[var(--hub-surface-card)] border-[var(--hub-border)] hover:border-[var(--hub-border-strong)] active:bg-[var(--hub-surface-muted)]'
                  }`}
                >
                  <div className="w-9 h-9 rounded-xl bg-[var(--hub-surface)] flex items-center justify-center shrink-0 text-[var(--hub-action)]">
                    <IconComp className="w-5 h-5" aria-hidden="true" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-1.5">
                      <span className="text-xs font-bold text-[var(--hub-text-primary)] truncate">
                        {def.label}
                      </span>
                      {badgeCount !== null && (
                        <span className="px-1.5 py-0.5 rounded-full bg-[var(--hub-surface)] text-[10px] font-bold text-[var(--hub-text-secondary)] shrink-0">
                          {badgeCount}
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-[var(--hub-text-muted)] truncate">
                      {def.id === 'preparation'
                        ? 'Vers Compas'
                        : def.segment === ''
                          ? 'Racine du Camp'
                          : describeNatureGroup(def)}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </section>

        {/* ── 3. Carte du Camp de base en bas de /hub sous WebGLArbiter (B-08 / C-04 / C-05) ── */}
        <section aria-label="Carte de l’expédition" className="space-y-2.5 pt-1">
          <div className="flex items-center justify-between px-1">
            <h2 className="text-xs font-bold uppercase tracking-wider text-[var(--hub-text-muted)] flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5 text-[var(--hub-action)]" aria-hidden="true" />
              <span>Tracé de l’expédition</span>
            </h2>
            <span className="text-xs text-[var(--hub-text-subtle)]">MapLibre GL</span>
          </div>

          <CampMap
            routeCoords={effectiveRouteCoords}
            title={effectiveTitle}
          />
        </section>
      </main>

      {/* ── 4. Tiroir Actif (DrawerShell) ── */}
      {activeDef && (
        <div
          data-testid="hub-active-drawer"
          data-drawer-segment={activeDef.segment}
          role="dialog"
          aria-modal="true"
          aria-label={activeDef.label}
          className="hub-camp-drawer-overlay fixed inset-0 z-50 flex flex-col justify-end bg-[var(--hub-backdrop-scrim)] backdrop-blur-sm"
          style={{ overscrollBehavior: 'contain' }}
        >
          <div
            className="w-full max-h-[90dvh] flex flex-col bg-[var(--hub-surface-card)] rounded-t-[32px] border-t border-[var(--hub-border)] overflow-hidden"
            style={{
              boxShadow: 'var(--hub-sheet-shadow)',
              paddingBottom:
                'calc(max(16px, var(--hub-safe-bottom)) + var(--keyboard-inset, 0px))',
            }}
          >
            <div className="flex items-center justify-between px-4 pt-3 pb-2 border-b border-[var(--hub-border-subtle)]">
              <span className="text-xs font-bold text-[var(--hub-text-primary)] truncate">
                {activeDef.label}
              </span>
              <div
                aria-hidden="true"
                className="w-10 h-1.5 rounded-full bg-[var(--hub-border-strong)]"
              />
              <button
                type="button"
                data-testid="hub-close-drawer"
                onClick={handleCloseDrawer}
                aria-label="Fermer le tiroir"
                className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-full text-[var(--hub-text-muted)] hover:text-[var(--hub-text-primary)] hover:bg-[var(--hub-surface)] transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--hub-action)]"
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
