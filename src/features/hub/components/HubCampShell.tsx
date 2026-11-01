'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import {
  ArrowLeft,
  ArrowRight,
  Backpack,
  BookOpen,
  Check,
  CheckCircle,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Clock,
  Compass,
  DollarSign,
  FileText,
  Flame,
  MapPin,
  Mountain,
  Package,
  Plus,
  Shield,
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
  HubItineraryDrawer,
  HubGroupeDrawer,
  HubDepartDrawer,
  HubGearDrawer,
  HubDocsDrawer,
  HubBudgetDrawer,
  HubSafetyDrawer,
  HubJournalDrawer,
  HubChecklistDrawer,
} from './drawers';
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

const OPTION3_DAYS = [
  {
    title: 'Le sentier du lac',
    place: 'Prairies et rives turquoise',
    distance: '8,4 km',
    time: '3 h 10',
    up: '+420 m',
    steps: ['Départ du camp', 'Point de vue du lac', 'Retour par les prairies'],
  },
  {
    title: 'Le col des Écrins',
    place: 'Une journée en altitude',
    distance: '12,6 km',
    time: '5 h 20',
    up: '+870 m',
    steps: ['Petit-déjeuner au camp', 'Montée vers le col', 'Pause au panorama', 'Descente vers le lac'],
  },
  {
    title: 'Le chemin du retour',
    place: 'Une dernière lumière sur le lac',
    distance: '6,2 km',
    time: '2 h 15',
    up: '+180 m',
    steps: ['Ranger le camp', 'Sentier de la forêt', 'Fin de l’aventure'],
  },
];

const OPTION3_MEMBERS = [
  {
    name: 'Moi (TF)',
    initials: 'TF',
    role: 'Mon kit · propriétaire',
    weight: '4,22 kg',
    items: ['Sac Alpin 40 L', 'Gourde inox 1L', 'Tente deux places', 'Trousse de secours'],
  },
  {
    name: 'Camille',
    initials: 'CM',
    role: 'Kit partagé · lecture seule',
    weight: '3,86 kg',
    items: ['Sac de randonnée', 'Réchaud partagé', 'Popote', 'Tasse isotherme'],
  },
  {
    name: 'Alex',
    initials: 'AL',
    role: 'Kit partagé · lecture seule',
    weight: '4,05 kg',
    items: ['Sac de randonnée', 'Filtre à eau partagé', 'Duvet', 'Lampe frontale'],
  },
];

interface CampPlacement {
  x: number;
  y: number;
  w?: number;
  h?: number;
  testId?: string;
}

const CAMP_HOTSPOT_POSITIONS: readonly CampPlacement[] = [
  /* 0: inventaire   */ { x: 22, y: 74, w: 90, h: 80 },
  /* 1: kit (sac)    */ { x: 40, y: 54, w: 120, h: 120, testId: 'hub-hotspot-bag' },
  /* 2: preparation  */ { x: 36, y: 38, w: 80, h: 75 },
  /* 3: depart       */ { x: 12, y: 52, w: 80, h: 75 },
  /* 4: disponibilite*/ { x: 52, y: 74, w: 85, h: 75 },
  /* 5: alertes      */ { x: 18, y: 14, w: 95, h: 80 },
  /* 6: oublis       */ { x: 26, y: 48, w: 75, h: 75 },
  /* 7: overview     */ { x: 22, y: 25, w: 90, h: 75 },
  /* 8: itinerary    */ { x: 80, y: 23, w: 95, h: 85, testId: 'hub-hotspot-route' },
  /* 9: gear         */ { x: 44, y: 64, w: 90, h: 80 },
  /* 10: groupe (feu)*/ { x: 14, y: 36, w: 95, h: 90, testId: 'hub-hotspot-fire' },
  /* 11: budget (table)*/ { x: 78, y: 68, w: 95, h: 85 },
  /* 12: docs (carte)*/ { x: 78, y: 56, w: 85, h: 75 },
  /* 13: checklist   */ { x: 12, y: 66, w: 80, h: 75 },
  /* 14: safety      */ { x: 50, y: 13, w: 100, h: 80 },
  /* 15: journal     */ { x: 64, y: 38, w: 80, h: 75 },
  /* 16: export      */ { x: 52, y: 25, w: 80, h: 75 },
  /* 17: invitations */ { x: 84, y: 35, w: 100, h: 90, testId: 'hub-hotspot-group' },
  /* 18: voyages-lies*/ { x: 84, y: 14, w: 90, h: 75 },
];

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
  const [selectedDay, setSelectedDay] = useState(0);
  const [selectedMember, setSelectedMember] = useState(0);
  const [notesList, setNotesList] = useState<string[]>([
    'Arriver au lac avant le coucher du soleil.',
    'Réserve d’eau à vérifier au col des Écrins.',
  ]);
  const [noteDraft, setNoteDraft] = useState('');
  const [prepItems, setPrepItems] = useState([
    { id: 'water', name: 'Gourde', detail: 'Gourde inox 1L', ready: false, tag: 'Hydratation' },
    { id: 'aid', name: 'Trousse de secours', detail: 'Compresses et pansements à contrôler', ready: false, tag: 'Sécurité' },
    { id: 'tent', name: 'Tente deux places & Duvet 5°C', detail: 'Roulés et sanglés dans le sac', ready: true, tag: 'Bivouac' },
    { id: 'lamp', name: 'Lampe frontale 300lm', detail: 'Batterie chargée à 100%', ready: true, tag: 'Sécurité' },
  ]);

  const togglePrepItem = useCallback((id: string) => {
    setPrepItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, ready: !item.ready } : item))
    );
  }, []);

  const pendingPrepCount = useMemo(
    () => prepItems.filter((i) => !i.ready).length,
    [prepItems]
  );

  const [checklistItems, setChecklistItems] = useState([
    { id: 'knife', label: 'Couteau suisse multifonction', done: true },
    { id: 'glasses', label: 'Lunettes de soleil catégorie 4', done: true },
    { id: 'sunscreen', label: 'Crème solaire indice 50 & stick lèvres', done: false },
    { id: 'trash', label: 'Sac poubelle étanche (zéro trace)', done: true },
    { id: 'lighter', label: 'Briquet tempête / allume-feu', done: false },
  ]);

  const toggleChecklistItem = useCallback((id: string) => {
    setChecklistItems((prev) =>
      prev.map((c) => (c.id === id ? { ...c, done: !c.done } : c))
    );
  }, []);
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

      if (def.id === 'itinerary') {
        return (
          <HubItineraryDrawer
            trip={trip}
            effectiveRouteCoords={effectiveRouteCoords}
            effectiveTitle={effectiveTitle}
            onOpenDepart={() => {
              const prepDef = hubSectionRegistry.find(
                (s) => s.id === 'depart' || s.id === 'preparation'
              );
              if (prepDef) handleOpenRegistryEntry(prepDef);
            }}
          />
        );
      }

      if (def.id === 'groupe') {
        return (
          <HubGroupeDrawer
            onEnterStudio={() => handleEnterStudio(DEFAULT_STUDIO_DRAWER)}
          />
        );
      }

      if (def.id === 'depart' || def.id === 'preparation') {
        return (
          <HubDepartDrawer
            onEnterStudio={() => handleEnterStudio(DEFAULT_STUDIO_DRAWER)}
          />
        );
      }

      if (def.id === 'docs' || def.id === 'export') {
        return <HubDocsDrawer />;
      }

      if (def.id === 'budget') {
        return <HubBudgetDrawer />;
      }

      if (def.id === 'journal') {
        return <HubJournalDrawer />;
      }

      if (def.id === 'safety' || def.id === 'alertes') {
        return <HubSafetyDrawer />;
      }

      if (
        def.id === 'gear' ||
        def.id === 'kit' ||
        def.id === hubSectionRegistry[0].id ||
        def.id === hubSectionRegistry[4].id
      ) {
        return (
          <HubGearDrawer
            onEnterStudio={() => handleEnterStudio(DEFAULT_STUDIO_DRAWER)}
          />
        );
      }

      if (def.id === 'checklist' || def.id === 'oublis') {
        return (
          <HubChecklistDrawer
            onEnterStudio={() => handleEnterStudio(DEFAULT_STUDIO_DRAWER)}
          />
        );
      }

      if (def.id === 'invitations') {
        return (
          <HubGroupeDrawer
            onEnterStudio={() => handleEnterStudio(DEFAULT_STUDIO_DRAWER)}
          />
        );
      }

      if (def.id === hubSectionRegistry[18].id) {
        return (
          <div className="p-4 space-y-4">
            <div className="p-4 rounded-3xl camp-card-white shadow-sm space-y-3">
              <div>
                <h3 className="text-base font-bold camp-text-title">Aventures & Voyages liés</h3>
                <p className="text-xs camp-text-sub">Historique et sorties planifiées avec cet équipement</p>
              </div>

              <div className="space-y-2 pt-2 border-t camp-border-subtle">
                <div className="p-3 rounded-2xl camp-card-cream flex items-center justify-between min-h-[48px]">
                  <div className="flex items-center gap-2.5">
                    <Mountain className="w-5 h-5 text-[var(--hub-action)]" />
                    <div>
                      <strong className="text-xs camp-text-title block">Traversée des Écrins 2026</strong>
                      <small className="text-[11px] camp-text-sub">En cours · Équipage 3 pers</small>
                    </div>
                  </div>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-md camp-chip-success">
                    En cours
                  </span>
                </div>

                <div className="p-3 rounded-2xl camp-card-cream flex items-center justify-between min-h-[48px]">
                  <div className="flex items-center gap-2.5">
                    <Mountain className="w-5 h-5 text-[var(--hub-text-secondary)]" />
                    <div>
                      <strong className="text-xs camp-text-title block">Tour des Fiz 2025</strong>
                      <small className="text-[11px] camp-text-sub">Terminé · 42 km parcourus</small>
                    </div>
                  </div>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-md camp-card-white camp-text-sub">
                    Archivé
                  </span>
                </div>
              </div>
            </div>
          </div>
        );
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

          <div className="p-5 rounded-3xl camp-card-white shadow-sm text-center space-y-3">
            <div className="w-12 h-12 rounded-2xl camp-badge-forest grid place-items-center mx-auto">
              <Package className="w-6 h-6" />
            </div>
            <h4 className="font-bold text-sm camp-text-title">Atelier d’équipement & Sac à dos</h4>
            <p className="text-xs camp-text-sub max-w-xs mx-auto">
              Retrouvez l’inventaire complet de cette section, organisez les poches et personnalisez votre équipement dans le Kit Studio.
            </p>
            <button
              type="button"
              className="min-h-[44px] px-5 rounded-2xl camp-btn-action text-xs font-bold inline-flex items-center gap-2 shadow-md active:scale-98 transition-transform"
              onClick={() => handleEnterStudio(DEFAULT_STUDIO_DRAWER)}
            >
              <Backpack className="w-4 h-4" />
              <span>Ouvrir l’atelier Kit Studio 3D</span>
            </button>
          </div>
        </div>
      );
    },
    [
      activeSubDrawerId,
      checklistItems,
      drawerContent,
      effectiveCounts,
      effectiveRouteCoords,
      effectiveTitle,
      handleCloseSubDrawer,
      handleEnterStudio,
      handleOpenRegistryEntry,
      handleOpenSubDrawer,
      initialDrawer,
      noteDraft,
      notesList,
      prepItems,
      router,
      selectedDay,
      selectedMember,
      toggleChecklistItem,
      togglePrepItem,
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

      {/* ── 3. Zones Tactiles Directes sur le Décor Alpin (0 pilule polluante) ── */}
      <div className="camp-locations" aria-label="Objets du camp">
        {hubSectionRegistry.map((def, idx) => {
          const pos = CAMP_HOTSPOT_POSITIONS[idx] ?? { x: 50, y: 50 };
          const testId = pos.testId ?? `hub-hotspot-${def.id}`;
          const width = pos.w ?? 64;
          const height = pos.h ?? 64;

          return (
            <button
              key={def.id}
              type="button"
              data-testid={testId}
              data-section-id={def.id}
              className="camp-touch-target"
              style={{
                left: `${pos.x}%`,
                top: `${pos.y}%`,
                width: `${width}px`,
                height: `${height}px`,
              }}
              onClick={() => {
                if (def.id === 'kit' || def.id === 'gear') {
                  handleEnterStudio();
                } else {
                  handleOpenRegistryEntry(def);
                }
              }}
              aria-label={def.label}
            >
              <span className="camp-touch-ripple" aria-hidden="true" />
            </button>
          );
        })}
      </div>

      {/* ── 4. Pilule Légère Flottante au-dessus de la BottomBar (Option 3 : « ... » uniquement) ── */}
      <div className="camp-floating-pill-container" data-testid="hub-camp-bottom-panel">
        <button
          type="button"
          data-testid="hub-camp-floating-pill"
          onClick={() => {
            const departDef = hubSectionRegistry[3];
            handleOpenRegistryEntry(departDef);
          }}
          className="camp-floating-pill"
          aria-label="Actions du camp"
        >
          <span className="camp-pill-dots" aria-hidden="true">
            ...
          </span>
        </button>
      </div>

      {/* ── 6. Tiroir Actif ── */}
      {activeDef && (
        <div
          data-testid="hub-active-drawer"
          data-drawer-segment={activeDef.segment}
          role="dialog"
          aria-modal="true"
          aria-label={activeDef.label}
          onClick={(e) => {
            if (e.target === e.currentTarget) handleCloseDrawer();
          }}
          className="hub-camp-drawer-overlay"
          style={{ overscrollBehavior: 'contain' }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="hub-camp-drawer-sheet w-full max-h-[40dvh] h-[40dvh] flex flex-col"
            style={{
              paddingBottom:
                'calc(max(16px, env(safe-area-inset-bottom, 0px)) + var(--keyboard-inset, 0px))',
            }}
          >
            <div className="flex items-center justify-between px-4 pt-3 pb-2.5 border-b camp-border-subtle shrink-0">
              <div className="flex items-center gap-2.5">
                <span className="w-8 h-8 rounded-xl camp-badge-forest grid place-items-center">
                  {React.createElement(activeDef.icon, {
                    className: 'w-4 h-4',
                    'aria-hidden': true,
                  })}
                </span>
                <div>
                  <h3 className="text-sm font-bold camp-text-title truncate">
                    {activeDef.label}
                  </h3>
                  <p className="text-[10px] camp-text-sub">
                    {describeNatureGroup(activeDef)}
                  </p>
                </div>
              </div>

              <div
                aria-hidden="true"
                className="w-10 h-1.5 rounded-full bg-[var(--hub-border-strong)]"
              />

              <button
                type="button"
                data-testid="hub-close-drawer"
                onClick={handleCloseDrawer}
                aria-label="Fermer le tiroir"
                className="camp-glass-close-btn"
              >
                <X className="w-5 h-5" aria-hidden="true" />
              </button>
            </div>

            <div
              ref={drawerScrollRef}
              className="flex-1 min-h-0 flex flex-col overflow-hidden"
            >
              {renderDrawerBody(activeDef)}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
