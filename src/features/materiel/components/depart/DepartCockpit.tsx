'use client';
import React, { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import {
  Compass,
  ListChecks,
  AlertTriangle,
  CheckSquare,
  Scale,
  Droplets,
  MapPin,
  LayoutGrid,
  Zap,
  Wifi,
  WifiOff,
} from 'lucide-react';
import { DepartHeader } from './DepartHeader';
import { DepartPreparation } from './DepartPreparation';
import { DepartAlerts } from './DepartAlerts';
import { DepartChecklist } from './DepartChecklist';
import { DepartWeightBreakdown } from './DepartWeightBreakdown';
import { DepartConsumables } from './DepartConsumables';
import { DepartWeather } from './DepartWeather';
import { DepartParticipants } from './DepartParticipants';
import { DepartLeftSidebar } from './DepartLeftSidebar';
import { DepartRightSidebar } from './DepartRightSidebar';
import { KitSwitcher } from './KitSwitcher';
import ScrollableTabs, { type TabOption } from '@/components/ui/ScrollableTabs';
import { Skeleton } from '@/components/ui/Skeleton';
import { generateSmartPrompts } from '@/features/materiel/services/generateSmartPrompts';
import { cn } from '@/lib/utils';
import type { DepartDetail } from '@/features/materiel/services/getDepartDetail';
import type { WeatherForecast } from '@/features/materiel/services/getWeather';

// IDs de kits showcase : pas de mutation serveur sur ces IDs fictifs
const SHOWCASE_IDS = new Set(['tmb-4j', 'vercors-ultra', 'belledonne-winter', 'none']);

// Chargement lazy de Leaflet — evite l inclusion dans le bundle initial
const DepartMap = dynamic(
  () => import('./DepartMap').then((m) => ({ default: m.DepartMap })),
  {
    ssr: false,
    loading: () => (
      <div className="glass rounded-[28px] overflow-hidden">
        <div className="px-4 py-2.5 border-b border-white/20">
          <Skeleton className="h-4 w-40" />
        </div>
        <Skeleton className="h-[228px] rounded-none" />
      </div>
    ),
  }
);

export type DepartSectionId =
  | 'all'
  | 'overview'
  | 'progression'
  | 'alerts'
  | 'checklist'
  | 'weight'
  | 'consumables'
  | 'terrain';

interface DepartCockpitProps {
  depart: DepartDetail;
  weather: WeatherForecast | null;
  kits: { id: string; name: string }[];
}

export function DepartCockpit({ depart, weather, kits }: DepartCockpitProps) {
  const [activeSection, setActiveSection] = useState<DepartSectionId>('all');
  const [isUltraSave, setIsUltraSave] = useState(false);
  const [batteryLevel, setBatteryLevel] = useState<number | null>(null);
  const [isOnline, setIsOnline] = useState(true);

  const shouldReduceMotion = useReducedMotion();

  const checkedCount = depart.assignedKit.items.filter((i) => i.is_checked).length;
  const itemsCount = depart.assignedKit.items.length;

  // Kit reel = mutations Server Action activees ; showcase = toggle local uniquement
  const isRealKit = !SHOWCASE_IDS.has(depart.id);

  const alertInput = {
    items: depart.assignedKit.items.map((i) => ({
      id: i.id,
      name: i.name,
      category: i.category,
      weight_g: i.weight_g,
      is_checked: i.is_checked,
      quantity: i.quantity,
      photoUrl: i.photoUrl,
      productHref: i.productHref,
    })),
    weather,
    participants: depart.participants,
    emergencyContact: depart.emergencyContact,
    trailDistanceKm: depart.trail?.distance_km ?? null,
  };

  const smartAlerts = generateSmartPrompts(alertInput);

  // Synchronisation reseau et batterie pour mode Ultra-Save (§19)
  useEffect(() => {
    if (typeof window === 'undefined') return;

    setIsOnline(navigator.onLine);
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Detection batterie si supportee
    if ('getBattery' in navigator) {
      (navigator as any).getBattery().then((battery: any) => {
        setBatteryLevel(battery.level);
        if (battery.level <= 0.2) {
          setIsUltraSave(true);
        }
        battery.addEventListener('levelchange', () => {
          setBatteryLevel(battery.level);
          if (battery.level <= 0.2) setIsUltraSave(true);
        });
      }).catch(() => {});
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Synchronisation avec BottomTabBar si nécessaire
  useEffect(() => {
    const handleSectionChange = (e: any) => {
      if (e.detail && typeof e.detail === 'string') {
        setActiveSection(e.detail as DepartSectionId);
      }
    };
    window.addEventListener('depart-section-change', handleSectionChange);
    return () => window.removeEventListener('depart-section-change', handleSectionChange);
  }, []);

  const handleSelectTab = (tabId: string) => {
    setActiveSection(tabId as DepartSectionId);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('depart-section-change', { detail: tabId }));
    }
  };

  // Les 7 onglets de navigation
  const SECTIONS_TABS: TabOption[] = [
    { id: 'all', label: 'Vue complète', icon: <LayoutGrid size={13} /> },
    { id: 'overview', label: '1. Départ', icon: <Compass size={13} /> },
    { id: 'progression', label: '2. Progression', icon: <ListChecks size={13} /> },
    { id: 'alerts', label: '3. Alertes', icon: <AlertTriangle size={13} />, badge: smartAlerts.length || undefined },
    { id: 'checklist', label: '4. Checklist', icon: <CheckSquare size={13} />, badge: `${checkedCount}/${itemsCount}` },
    { id: 'weight', label: '5. Poids', icon: <Scale size={13} /> },
    { id: 'consumables', label: '6. Consommables', icon: <Droplets size={13} /> },
    { id: 'terrain', label: '7. Terrain & Météo', icon: <MapPin size={13} /> },
  ];

  const showAll = activeSection === 'all';

  // Rendu du contenu principal
  const renderMainSections = () => (
    <div className="flex flex-col gap-3">
      {/* SECTION 1 : Départ & En-tête */}
      {(showAll || activeSection === 'overview') && (
        <section id="section-depart-overview" aria-label="Section 1 : Vue d'ensemble du départ">
          <DepartHeader depart={depart} />
        </section>
      )}

      {/* SECTION 2 : Progression du Pack & Métriques */}
      {(showAll || activeSection === 'progression') && (
        <section id="section-depart-progression" aria-label="Section 2 : Progression du pack">
          <DepartPreparation
            checklistPct={depart.checklistPct}
            totalWeightG={depart.assignedKit.totalWeightG}
            itemsCount={itemsCount}
            checkedCount={checkedCount}
            kitId={depart.id}
          />
        </section>
      )}

      {/* SECTION 3 : Alertes Intelligentes */}
      {(showAll || activeSection === 'alerts') && (
        <section id="section-depart-alerts" aria-label="Section 3 : Alertes de départ">
          <DepartAlerts input={alertInput} />
        </section>
      )}

      {/* SECTION 4 : Checklist du Matériel */}
      {(showAll || activeSection === 'checklist') && (
        <section id="section-depart-checklist" aria-label="Section 4 : Checklist du kit">
          <DepartChecklist items={depart.assignedKit.items} isRealKit={isRealKit} />
        </section>
      )}

      {/* SECTION 5 : Analyse du Poids */}
      {(showAll || activeSection === 'weight') && (
        <section id="section-depart-weight" aria-label="Section 5 : Répartition du poids">
          <DepartWeightBreakdown
            breakdown={depart.weightBreakdown}
            totalWeightG={depart.assignedKit.totalWeightG}
          />
        </section>
      )}

      {/* SECTION 6 : Consommables */}
      {(showAll || activeSection === 'consumables') && (
        <section id="section-depart-consumables" aria-label="Section 6 : Consommables estimés">
          <DepartConsumables
            consumables={depart.consumables}
            durationDays={depart.durationDays}
            participantsCount={depart.participants.length || 1}
          />
        </section>
      )}

      {/* SECTION 7 : Terrain, Météo & Équipe */}
      {(showAll || activeSection === 'terrain') && (
        <section
          id="section-depart-terrain"
          aria-label="Section 7 : Terrain, météo et sécurité"
          className="space-y-3"
        >
          <DepartWeather weather={weather} />
          <DepartParticipants
            participants={depart.participants}
            emergencyContact={depart.emergencyContact}
          />
          {depart.trail && <DepartMap trail={depart.trail} height="240px" />}
        </section>
      )}
    </div>
  );

  return (
    <div className={cn('w-full h-full', isUltraSave && 'ultra-save-mode')}>
      {/* ══════════════════════════════════════════════════════════════════════
          1. VERSION MOBILE (< 768px)
         ══════════════════════════════════════════════════════════════════════ */}
      <div className="block md:hidden w-full max-w-3xl mx-auto px-3 sm:px-4 pb-12 space-y-3">
        {/* Barre d'action supérieure mobile : Switcher de kit + Ultra-Save + Tabs */}
        <div className="space-y-2 sticky top-0 z-30 pt-1 pb-1 backdrop-blur-md bg-white/30 rounded-2xl border border-white/40">
          <div className="flex items-center justify-between gap-2 px-2">
            <div className="flex items-center gap-1.5">
              <span className="text-[10.5px] font-semibold uppercase tracking-wider text-[#5A7064]">
                Cockpit de départ
              </span>
              <span className={cn('flex items-center gap-1 text-[9.5px] font-mono px-1.5 py-0.2 rounded-full font-bold', isOnline ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800')}>
                {isOnline ? <Wifi size={9} /> : <WifiOff size={9} />}
                {isOnline ? 'EN LIGNE' : 'HORS-LIGNE'}
              </span>
            </div>

            <div className="flex items-center gap-1.5">
              {/* Ultra-Save Button */}
              <button
                type="button"
                onClick={() => setIsUltraSave((v) => !v)}
                className={cn(
                  'px-2 py-0.5 rounded-lg text-[10px] font-bold flex items-center gap-1 transition-all',
                  isUltraSave
                    ? 'bg-[#2D6B4A] text-white shadow-xs'
                    : 'bg-white/40 text-[#17402C] hover:bg-white/60'
                )}
                title="Mode Éco Batterie Ultra-Save"
                aria-pressed={isUltraSave}
              >
                <Zap size={10} />
                <span>{isUltraSave ? 'ECO ACTIF' : 'ECO'}</span>
                {batteryLevel !== null && (
                  <span className="font-mono text-[9px] opacity-80">
                    {Math.round(batteryLevel * 100)}%
                  </span>
                )}
              </button>

              {kits.length > 1 && <KitSwitcher kits={kits} currentId={depart.id} />}
            </div>
          </div>

          <ScrollableTabs
            tabs={SECTIONS_TABS}
            activeTab={activeSection}
            onSelectTab={handleSelectTab}
            size="sm"
            className="px-0.5"
          />
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={activeSection}
            initial={shouldReduceMotion ? false : { opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: -4 }}
            transition={{ duration: shouldReduceMotion ? 0 : 0.16, ease: 'easeOut' }}
          >
            {renderMainSections()}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* ══════════════════════════════════════════════════════════════════════
          2. VERSION DESKTOP COCKPIT 3 COLONNES FULLSCREEN (hidden md:flex)
         ══════════════════════════════════════════════════════════════════════ */}
      <div className="hidden md:flex h-full overflow-hidden max-w-[1680px] w-full mx-auto px-4 lg:px-6 py-2 gap-4 items-start">
        {/* COLONNE GAUCHE : NAVIGATION ONGLETS & IDENTITÉ (260px) */}
        <div className="w-[260px] shrink-0 h-full overflow-hidden">
          <DepartLeftSidebar
            depart={depart}
            activeSection={activeSection}
            onSectionChange={setActiveSection}
            kits={kits}
            alertsCount={smartAlerts.length}
            isUltraSave={isUltraSave}
            onToggleUltraSave={() => setIsUltraSave((v) => !v)}
            batteryLevel={batteryLevel}
            isOnline={isOnline}
          />
        </div>

        {/* COLONNE CENTRALE : CONTENU DE LA SECTION ACTIVE (flex-1) */}
        <main className="flex-1 h-full overflow-y-auto no-scrollbar space-y-4 px-1 pb-8">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeSection}
              initial={shouldReduceMotion ? false : { opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: -4 }}
              transition={{ duration: shouldReduceMotion ? 0 : 0.16, ease: 'easeOut' }}
            >
              {renderMainSections()}
            </motion.div>
          </AnimatePresence>
        </main>

        {/* COLONNE DROITE : WIDGETS TACTIQUES & MINI-MAP (310px) */}
        <div className="w-[310px] shrink-0 h-full overflow-hidden">
          <DepartRightSidebar depart={depart} />
        </div>
      </div>
    </div>
  );
}
