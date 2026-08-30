'use client';
import React, { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import {
  Compass,
  AlertTriangle,
  CheckSquare,
  Scale,
  MapPin,
  LayoutGrid,
  Zap,
  Wifi,
  WifiOff,
} from 'lucide-react';
import { DepartHeader } from './DepartHeader';
import { DepartAlerts } from './DepartAlerts';
import { DepartChecklist } from './DepartChecklist';
import { DepartWeightBreakdown } from './DepartWeightBreakdown';
import { DepartWeather } from './DepartWeather';
import { DepartParticipants } from './DepartParticipants';
import { DepartLeftSidebar } from './DepartLeftSidebar';
import { DepartureSheetModal } from './DepartureSheetModal';
import { KitSwitcher } from './KitSwitcher';
import ScrollableTabs, { type TabOption } from '@/components/ui/ScrollableTabs';
import { Skeleton } from '@/components/ui/Skeleton';
import { generateSmartPrompts } from '@/features/materiel/services/generateSmartPrompts';
import { cn } from '@/lib/utils';
import type { DepartDetail } from '@/features/materiel/services/getDepartDetail';
import type { WeatherForecast } from '@/features/materiel/services/getWeather';

const SHOWCASE_IDS = new Set(['tmb-4j', 'vercors-ultra', 'belledonne-winter', 'none']);

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
  | 'alerts'
  | 'checklist'
  | 'weight'
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
  const [isSheetOpen, setIsSheetOpen] = useState(false);

  const shouldReduceMotion = useReducedMotion();

  const checkedCount = depart.assignedKit.items.filter((i) => i.is_checked).length;
  const itemsCount = depart.assignedKit.items.length;
  const isRealKit = !SHOWCASE_IDS.has(depart.id);

  const alertInput = {
    items: depart.assignedKit.items.map((i) => ({
      id: i.id,
      name: i.name,
      category: i.category,
      weight_g: i.weight_g,
      is_checked: i.is_checked,
      is_worn: i.is_worn,
      is_consumable: i.is_consumable,
      is_vital: i.is_vital,
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

  useEffect(() => {
    if (typeof window === 'undefined') return;

    setIsOnline(navigator.onLine);
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    const handleOpenSheet = () => setIsSheetOpen(true);
    window.addEventListener('open-departure-sheet', handleOpenSheet);

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
      window.removeEventListener('open-departure-sheet', handleOpenSheet);
    };
  }, []);

  const handleSelectTab = (tabId: string) => {
    setActiveSection(tabId as DepartSectionId);
  };

  const SECTIONS_TABS: TabOption[] = [
    { id: 'all', label: 'Vue complète', icon: <LayoutGrid size={13} /> },
    { id: 'overview', label: 'Statut & Départ', icon: <Compass size={13} /> },
    { id: 'alerts', label: 'Alertes', icon: <AlertTriangle size={13} />, badge: smartAlerts.length || undefined },
    { id: 'checklist', label: 'Checklist & Vivres', icon: <CheckSquare size={13} />, badge: `${checkedCount}/${itemsCount}` },
    { id: 'weight', label: 'Poids', icon: <Scale size={13} /> },
    { id: 'terrain', label: 'Météo & Sécurité', icon: <MapPin size={13} /> },
  ];

  const showAll = activeSection === 'all';

  const renderMainContent = () => (
    <div className="flex flex-col gap-3.5 max-w-4xl mx-auto w-full">
      {/* ════ NIVEAU 1 : STATUT PERMANENT & EN-TÊTE TACTIQUE ════ */}
      {(showAll || activeSection === 'overview') && (
        <section id="section-depart-overview" aria-label="Niveau 1 : Statut du départ">
          <DepartHeader
            depart={depart}
            isRealKit={isRealKit}
            onOpenDepartureSheet={() => setIsSheetOpen(true)}
          />
        </section>
      )}

      {/* ════ NIVEAU 2 : CE QUI EMPÊCHE DE PARTIR ════ */}
      {((showAll && smartAlerts.length > 0) || activeSection === 'alerts') && (
        <section id="section-depart-alerts" aria-label="Niveau 2 : À régler avant le départ">
          <DepartAlerts input={alertInput} />
        </section>
      )}

      {/* ════ NIVEAU 3 : LE TRAVAIL & LE DÉTAIL PROGRESSIF ════ */}

      {/* 3.A — Checklist de travail absorbant Vivres & Eau */}
      {(showAll || activeSection === 'checklist') && (
        <section id="section-depart-checklist" aria-label="Checklist du matériel et vivres">
          <DepartChecklist
            items={depart.assignedKit.items}
            consumables={depart.consumables}
            isRealKit={isRealKit}
          />
        </section>
      )}

      {/* 3.B — Poids & Répartition */}
      {(showAll || activeSection === 'weight') && (
        <section id="section-depart-weight" aria-label="Analyse du poids">
          <DepartWeightBreakdown
            breakdown={depart.weightBreakdown}
            totalWeightG={depart.baseWeightG}
          />
        </section>
      )}

      {/* 3.C — Météo, Équipe & Carte */}
      {(showAll || activeSection === 'terrain') && (
        <section id="section-depart-terrain" aria-label="Terrain, météo et sécurité" className="space-y-3.5">
          <DepartWeather weather={weather} />
          <DepartParticipants
            participants={depart.participants}
            emergencyContact={depart.emergencyContact}
          />
          {depart.trail && <DepartMap trail={depart.trail} height="260px" />}
        </section>
      )}
    </div>
  );

  return (
    <div className={cn('w-full h-full min-h-0', isUltraSave && 'ultra-save-mode')}>
      {/* Modal Fiche de Départ (§4F) */}
      <DepartureSheetModal
        depart={depart}
        weather={weather}
        isOpen={isSheetOpen}
        onClose={() => setIsSheetOpen(false)}
        isRealKit={isRealKit}
      />

      {/* ════ 1. VERSION MOBILE (< 768px) ════ */}
      <div className="block md:hidden w-full max-w-3xl mx-auto px-3 sm:px-4 pb-12 space-y-3">
        <div className="space-y-2 sticky top-0 z-30 pt-1 pb-1 backdrop-blur-md bg-white/30 rounded-2xl border border-white/40">
          <div className="flex items-center justify-between gap-2 px-2">
            <div className="flex items-center gap-1.5">
              <span className="text-[10.5px] font-semibold uppercase tracking-wider text-[#5A7064]">
                Cockpit
              </span>
              <span className={cn('flex items-center gap-1 text-[9.5px] font-mono px-1.5 py-0.2 rounded-full font-bold', isOnline ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800')}>
                {isOnline ? <Wifi size={9} /> : <WifiOff size={9} />}
                {isOnline ? 'EN LIGNE' : 'HORS-LIGNE'}
              </span>
            </div>

            <div className="flex items-center gap-1.5">
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
            {renderMainContent()}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* ════ 2. VERSION DESKTOP COCKPIT 2 COLONNES (hidden md:flex) ════ */}
      <div className="hidden md:flex h-full overflow-hidden max-w-[1440px] w-full mx-auto px-4 lg:px-6 py-2 gap-5 items-start">
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

        <main className="flex-1 h-full overflow-y-auto custom-scrollbar space-y-4 px-1 pb-8">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeSection}
              initial={shouldReduceMotion ? false : { opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: -4 }}
              transition={{ duration: shouldReduceMotion ? 0 : 0.16, ease: 'easeOut' }}
            >
              {renderMainContent()}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
    </div>
  );
}
