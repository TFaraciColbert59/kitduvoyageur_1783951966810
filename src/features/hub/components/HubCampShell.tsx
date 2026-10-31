'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Backpack,
  Compass,
  CreditCard,
  FileText,
  Footprints,
  HeartPulse,
  Layers,
  MapPin,
  Moon,
  Navigation,
  Package,
  Settings,
  Share2,
  Shield,
  Sliders,
  Sun,
  Truck,
  Users,
  Utensils,
  X,
} from 'lucide-react';
import { DrawerShell, type DrawerTab } from '@/components/ui/drawer';
import { useKeyboardInsets } from '@/hooks/useKeyboardInsets';
import {
  HUB_CANONICAL_SEGMENTS,
  resolveCanonicalDrawer,
  type HubCanonicalSegment,
} from '../registry/hubSectionRegistry';
import {
  DrawerNavigationMachine,
  type DrawerMachineState,
  type StudioDrawer,
} from '../state/drawerMachine';
import { CampMap } from './CampMap';
import {
  ChecklistMobileExperience,
  DocsMobileExperience,
  ItineraryMobileExperience,
  JournalMobileExperience,
  SafetyMobileExperience,
  TeamMobileExperience,
} from '@/app/hub/[section]/sectionViews.client';

export interface HubCampShellProps {
  initialDrawer?: string;
  trip?: any;
  adventure?: any;
  searchParams?: Record<string, string | undefined>;
  drawerContent?: React.ReactNode;
}

interface SectionTile {
  segment: HubCanonicalSegment;
  label: string;
  icon: React.ReactNode;
  category: 'studio' | 'terrain' | 'logistique';
  description: string;
}

const SECTION_TILES: readonly SectionTile[] = [
  // ── Kit Studio ──
  {
    segment: 'inventaire',
    label: 'Inventaire',
    icon: <Package className="w-5 h-5 text-[#226148]" />,
    category: 'studio',
    description: 'Équipements, poids et rangement',
  },
  {
    segment: 'personnaliser',
    label: 'Personnaliser',
    icon: <Sliders className="w-5 h-5 text-[#226148]" />,
    category: 'studio',
    description: 'Matières, poches et couleurs',
  },
  {
    segment: 'statistiques',
    label: 'Statistiques',
    icon: <Layers className="w-5 h-5 text-[#226148]" />,
    category: 'studio',
    description: 'Poids g/kg, volume et progression',
  },
  {
    segment: 'lignee',
    label: 'Lignée',
    icon: <Compass className="w-5 h-5 text-[#226148]" />,
    category: 'studio',
    description: 'Origine et versions du kit',
  },
  {
    segment: 'options',
    label: 'Options',
    icon: <Settings className="w-5 h-5 text-[#226148]" />,
    category: 'studio',
    description: 'Préférences 3D/Liste et audio',
  },

  // ── Camp de Base & Terrain ──
  {
    segment: 'groupe',
    label: 'Groupe',
    icon: <Users className="w-5 h-5 text-[#226148]" />,
    category: 'terrain',
    description: 'Équipage et partage du matériel',
  },
  {
    segment: 'depart',
    label: 'Départ',
    icon: <Footprints className="w-5 h-5 text-[#226148]" />,
    category: 'terrain',
    description: 'Checklist finale avant le sentier',
  },
  {
    segment: 'itineraire',
    label: 'Itinéraire',
    icon: <Navigation className="w-5 h-5 text-[#226148]" />,
    category: 'terrain',
    description: 'Étapes, dénivelé et profil altimétrique',
  },
  {
    segment: 'bivouac',
    label: 'Bivouacs',
    icon: <Moon className="w-5 h-5 text-[#226148]" />,
    category: 'terrain',
    description: 'Refuges, campements et nuitées',
  },
  {
    segment: 'meteo',
    label: 'Météo',
    icon: <Sun className="w-5 h-5 text-[#226148]" />,
    category: 'terrain',
    description: 'Conditions d’altitude et alertes',
  },
  {
    segment: 'securite',
    label: 'Sécurité',
    icon: <Shield className="w-5 h-5 text-[#226148]" />,
    category: 'terrain',
    description: 'Contacts d’urgence et protocoles',
  },
  {
    segment: 'trousse',
    label: 'Trousse secours',
    icon: <HeartPulse className="w-5 h-5 text-[#226148]" />,
    category: 'terrain',
    description: 'Pharmacie et soins de trek',
  },

  // ── Organisation & Logistique ──
  {
    segment: 'budget',
    label: 'Budget',
    icon: <CreditCard className="w-5 h-5 text-[#226148]" />,
    category: 'logistique',
    description: 'Dépenses, acomptes et réservations',
  },
  {
    segment: 'documents',
    label: 'Documents',
    icon: <FileText className="w-5 h-5 text-[#226148]" />,
    category: 'logistique',
    description: 'Billets, assurances et pièces officielles',
  },
  {
    segment: 'participants',
    label: 'Participants',
    icon: <Users className="w-5 h-5 text-[#226148]" />,
    category: 'logistique',
    description: 'Fiches contact et rôles dans l’équipe',
  },
  {
    segment: 'transports',
    label: 'Transports',
    icon: <Truck className="w-5 h-5 text-[#226148]" />,
    category: 'logistique',
    description: 'Trains, navettes et acheminement',
  },
  {
    segment: 'repas',
    label: 'Repas & Ravitaillement',
    icon: <Utensils className="w-5 h-5 text-[#226148]" />,
    category: 'logistique',
    description: 'Menus de trek et points d’eau',
  },
  {
    segment: 'notes',
    label: 'Journal de bord',
    icon: <FileText className="w-5 h-5 text-[#226148]" />,
    category: 'logistique',
    description: 'Carnet de route et observations',
  },
];

export function HubCampShell({
  initialDrawer,
  trip,
  adventure,
  searchParams,
  drawerContent,
}: HubCampShellProps) {
  const machineRef = useRef<DrawerNavigationMachine | null>(null);
  if (!machineRef.current) {
    machineRef.current = new DrawerNavigationMachine();
    if (initialDrawer) {
      machineRef.current.openDrawer(initialDrawer);
    }
  }

  const [navState, setNavState] = useState<DrawerMachineState>(() =>
    machineRef.current!.getState()
  );

  // Évitement dynamique du clavier virtuel sur mobile
  useKeyboardInsets();

  // Abonnement aux changements de la machine
  useEffect(() => {
    const unsub = machineRef.current!.subscribe((st) => setNavState(st));
    return unsub;
  }, []);

  // Synchronisation avec popstate (bouton retour navigateur / mobile)
  useEffect(() => {
    const onPopState = () => {
      if (machineRef.current) {
        const result = machineRef.current.handlePopState();
        if (result.handled) {
          const nextSegment =
            result.state.type === 'DRAWER_OPEN' || result.state.type === 'SUB_DRAWER_OPEN'
              ? result.state.drawerId
              : '';
          const targetUrl = nextSegment ? `/hub/${nextSegment}` : '/hub';
          window.history.replaceState(null, '', targetUrl);
        }
      }
    };

    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  const navigateToSegment = useCallback((segment: HubCanonicalSegment) => {
    if (!machineRef.current) return;
    machineRef.current.openDrawer(segment);
    const targetUrl = segment ? `/hub/${segment}` : '/hub';
    window.history.pushState(null, '', targetUrl);
  }, []);

  const closeCurrentDrawer = useCallback(() => {
    if (!machineRef.current) return;
    machineRef.current.closeDrawer();
    window.history.pushState(null, '', '/hub');
  }, []);

  const activeDrawerSegment = useMemo(() => {
    if (navState.type === 'DRAWER_OPEN' || navState.type === 'SUB_DRAWER_OPEN') {
      return navState.drawerId;
    }
    return null;
  }, [navState]);

  // Rendu du contenu d'un drawer selon son segment canonique
  const renderDrawerContent = useCallback((segment: HubCanonicalSegment) => {
    if (drawerContent && segment === initialDrawer) {
      return drawerContent;
    }

    switch (segment) {
      case 'inventaire':
        return (
          <div className="p-4 space-y-4">
            <div className="p-4 rounded-2xl bg-[var(--hub-surface)] border border-[var(--hub-border)]">
              <h4 className="font-semibold text-sm text-[var(--hub-text-primary)]">Inventaire du Camp</h4>
              <p className="text-xs text-[var(--hub-text-secondary)] mt-1">
                Gérez vos articles, vérifiez leur pesée et organisez vos sacs dans l’atelier Kit Studio.
              </p>
            </div>
          </div>
        );
      case 'depart':
        return (
          <div className="p-4 space-y-4">
            <div className="p-4 rounded-2xl bg-[var(--hub-surface)] border border-[var(--hub-border)]">
              <h4 className="font-semibold text-sm text-[var(--hub-text-primary)]">Départ & Checklist finale</h4>
              <p className="text-xs text-[var(--hub-text-secondary)] mt-1">
                Contrôle des indispensables, validation des étapes et météo de départ.
              </p>
            </div>
          </div>
        );
      case 'itineraire':
        return trip ? (
          <ItineraryMobileExperience trip={trip} initialSteps={trip.steps || []} />
        ) : (
          <div className="p-6 text-center text-sm text-[var(--hub-text-secondary)]">
            Aucun itinéraire configuré pour cette aventure.
          </div>
        );
      case 'groupe':
      case 'participants':
        return trip ? (
          <TeamMobileExperience trip={trip} />
        ) : (
          <div className="p-6 text-center text-sm text-[var(--hub-text-secondary)]">
            Aucun groupe rattaché à ce camp.
          </div>
        );
      case 'securite':
        return trip ? (
          <SafetyMobileExperience trip={trip} />
        ) : (
          <div className="p-6 text-center text-sm text-[var(--hub-text-secondary)]">
            Protocoles d’urgence et contacts de sécurité prêts.
          </div>
        );
      case 'documents':
        return trip ? (
          <DocsMobileExperience trip={trip} />
        ) : (
          <div className="p-6 text-center text-sm text-[var(--hub-text-secondary)]">
            Documents et réservations de l’aventure.
          </div>
        );
      case 'notes':
        return trip ? (
          <JournalMobileExperience trip={trip} />
        ) : (
          <div className="p-6 text-center text-sm text-[var(--hub-text-secondary)]">
            Journal de bord et notes de campement.
          </div>
        );
      default:
        // Contenu standardisé conforme Apple HIG pour les tiroirs de terrain
        const tile = SECTION_TILES.find((t) => t.segment === segment);
        return (
          <div className="p-6 space-y-4">
            <div className="flex items-center gap-3 p-4 rounded-2xl bg-[var(--hub-surface)] border border-[var(--hub-border)]">
              {tile?.icon}
              <div>
                <h4 className="font-semibold text-[var(--hub-text-primary)]">{tile?.label}</h4>
                <p className="text-xs text-[var(--hub-text-muted)]">{tile?.description}</p>
              </div>
            </div>
            <div className="p-4 rounded-2xl bg-white border border-[var(--hub-border)] text-sm text-[var(--hub-text-secondary)]">
              Surface active du Camp de Base. Données réelles synchronisées avec le profil de l’expédition.
            </div>
          </div>
        );
    }
  }, [trip, drawerContent, initialDrawer]);

  // Définition de l'onglet actif pour DrawerShell
  const drawerTabs: DrawerTab[] = useMemo(() => {
    if (!activeDrawerSegment) return [];
    const tile = SECTION_TILES.find((t) => t.segment === activeDrawerSegment);
    return [
      {
        id: activeDrawerSegment,
        label: tile?.label || activeDrawerSegment,
        icon: tile?.icon || <Package className="w-4 h-4" />,
        render: () => renderDrawerContent(activeDrawerSegment),
      },
    ];
  }, [activeDrawerSegment, renderDrawerContent]);

  return (
    <div
      className="hub-camp-shell-root flex flex-col w-full min-h-[100dvh] bg-[var(--hub-bg)] text-[var(--hub-text-primary)]"
      style={{
        paddingTop: 'max(12px, env(safe-area-inset-top, 0px))',
        paddingBottom: 'max(16px, env(safe-area-inset-bottom, 0px))',
        boxSizing: 'border-box',
      }}
    >
      {/* ── 1. En-tête du Camp de Base ── */}
      <header className="px-4 py-3 flex items-center justify-between border-b border-[var(--hub-border-subtle)] bg-[var(--hub-surface-card)]">
        <div className="flex items-center gap-2.5">
          <div className="w-10 h-10 rounded-2xl bg-[var(--hub-primary-subtle)] flex items-center justify-center text-[var(--hub-primary)]">
            <Backpack className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-base font-bold text-[var(--hub-primary)] leading-tight">
              {adventure?.name || trip?.title || 'Camp de Base'}
            </h1>
            <p className="text-xs text-[var(--hub-text-muted)]">
              {trip?.destination || 'Expédition active'} • Vue d’ensemble
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => navigateToSegment('inventaire')}
          className="min-h-[44px] px-3.5 rounded-full bg-[var(--hub-action)] text-white text-xs font-semibold flex items-center gap-1.5 shadow-sm active:scale-95 transition-transform"
        >
          <Package className="w-4 h-4" />
          <span>Matériel</span>
        </button>
      </header>

      {/* ── 2. Corps Principal du Camp ── */}
      <main className="flex-1 flex flex-col p-4 gap-6 overflow-y-auto">
        {/* Bannière d'accès direct au Kit Studio 3D */}
        <section
          className="p-4 rounded-3xl bg-gradient-to-br from-[var(--hub-surface-card)] to-[var(--hub-surface)] border border-[var(--hub-border)] shadow-sm flex items-center justify-between gap-4"
        >
          <div className="space-y-1">
            <span className="text-[11px] font-bold tracking-wider uppercase text-[var(--hub-secondary)]">
              Atelier d’équipement
            </span>
            <h2 className="text-base font-bold text-[var(--hub-primary)]">
              Kit Studio 3D & Sac à dos
            </h2>
            <p className="text-xs text-[var(--hub-text-secondary)]">
              Organisation des slots, pesée honnête et personnalisation.
            </p>
          </div>
          <button
            type="button"
            onClick={() => navigateToSegment('personnaliser')}
            className="min-h-[44px] min-w-[44px] px-4 rounded-2xl bg-[var(--hub-primary)] text-white text-xs font-semibold flex items-center gap-2 shadow-md active:scale-95 transition-transform shrink-0"
          >
            <Sliders className="w-4 h-4" />
            <span>Ouvrir</span>
          </button>
        </section>

        {/* Grille des 19 modules canoniques du Camp de Base */}
        <section className="space-y-3">
          <div className="flex items-center justify-between px-1">
            <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--hub-text-muted)]">
              Modules d’expédition
            </h3>
            <span className="text-xs text-[var(--hub-text-subtle)]">18 tiroirs</span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
            {SECTION_TILES.map((tile) => (
              <button
                key={tile.segment}
                type="button"
                onClick={() => navigateToSegment(tile.segment)}
                className="min-h-[64px] p-3 rounded-2xl bg-[var(--hub-surface-card)] border border-[var(--hub-border)] hover:border-[var(--hub-border-strong)] active:bg-[var(--hub-surface-muted)] transition-colors flex items-center gap-3 text-left shadow-sm group"
              >
                <div className="w-9 h-9 rounded-xl bg-[var(--hub-surface)] group-hover:bg-[var(--hub-primary-subtle)] flex items-center justify-center shrink-0 transition-colors">
                  {tile.icon}
                </div>
                <div className="min-w-0">
                  <div className="text-xs font-bold text-[var(--hub-text-primary)] truncate">
                    {tile.label}
                  </div>
                  <div className="text-[11px] text-[var(--hub-text-muted)] truncate">
                    {tile.category}
                  </div>
                </div>
              </button>
            ))}
          </div>
        </section>

        {/* ── 3. Carte de Basecamp au bas de la page sous WebGL Arbiter ── */}
        <section className="space-y-2.5 pt-2">
          <div className="flex items-center justify-between px-1">
            <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--hub-text-muted)] flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5 text-[var(--hub-action)]" />
              <span>Tracé de l’expédition</span>
            </h3>
            <span className="text-xs text-[var(--hub-text-subtle)]">MapLibre GL</span>
          </div>

          <CampMap
            routeCoords={trip?.steps?.map((s: any) => [s.latitude, s.longitude]).filter((c: any) => c[0] && c[1]) || []}
            title={trip?.title || 'Carte du Camp de Base'}
          />
        </section>
      </main>

      {/* ── 4. Tiroir Actif (DrawerShell) ── */}
      {activeDrawerSegment && (
        <div
          className="hub-camp-drawer-overlay fixed inset-0 z-50 flex flex-col justify-end bg-black/40 backdrop-blur-sm"
          style={{ overscrollBehavior: 'contain' }}
        >
          <div
            className="w-full max-h-[92dvh] flex flex-col bg-[var(--hub-surface-card)] rounded-t-[32px] shadow-2xl border-t border-[var(--hub-border)] overflow-hidden animate-in slide-in-from-bottom duration-300"
            style={{
              paddingBottom: 'max(16px, env(safe-area-inset-bottom, 0px))',
            }}
          >
            {/* Barre supérieure du tiroir avec bouton fermeture */}
            <div className="flex items-center justify-between px-4 pt-3 pb-2 border-b border-[var(--hub-border-subtle)]">
              <span className="w-8" />
              <div className="w-10 h-1.5 rounded-full bg-[var(--hub-border-strong)]" />
              <button
                type="button"
                onClick={closeCurrentDrawer}
                aria-label="Fermer le tiroir"
                className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-full text-[var(--hub-text-muted)] hover:text-[var(--hub-text-primary)] hover:bg-[var(--hub-surface)] transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Contenu du tiroir encapsulé dans DrawerShell */}
            <div className="flex-1 overflow-y-auto">
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
