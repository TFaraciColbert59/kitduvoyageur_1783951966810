'use client';
import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import {
  Zap,
  Wifi,
  WifiOff,
  Layers,
  ArrowRight,
  Boxes,
  CheckCircle2,
} from 'lucide-react';
import { DepartWeather } from './DepartWeather';
import { DepartParticipants } from './DepartParticipants';
import { DepartLeftSidebar } from './DepartLeftSidebar';
import { DepartRightSidebar } from './DepartRightSidebar';
import { DepartWeightBreakdown } from './DepartWeightBreakdown';
import { DepartEquipmentHub } from './DepartEquipmentHub';
import { DepartureSheetModal } from './DepartureSheetModal';
import { KitSwitcher } from './KitSwitcher';
import ScrollableTabs, { type TabOption } from '@/components/ui/ScrollableTabs';
import { Skeleton } from '@/components/ui/Skeleton';
import { generateSmartPrompts } from '@/features/materiel/services/generateSmartPrompts';
import { flushOfflineQueue } from '@/features/materiel/offline/departOfflineQueue';
import { cn } from '@/lib/utils';
import type { DepartDetail } from '@/features/materiel/services/getDepartDetail';
import type { WeatherForecast } from '@/features/materiel/services/getWeather';
import type { InventoryItem } from '@/features/materiel/services/getInventory';
import type { LoanItem } from '@/features/materiel/services/getLoans';
import type { ProductSuggestion } from '@/features/materiel/services/getProductSuggestions';

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
        <Skeleton className="h-[240px] rounded-none" />
      </div>
    ),
  }
);

export type DepartSectionId =
  | 'all'
  | 'terrain'
  | 'equipment_hub';

interface DepartCockpitProps {
  depart: DepartDetail;
  weather: WeatherForecast | null;
  kits: { id: string; name: string }[];
  inventory?: InventoryItem[];
  loans?: LoanItem[];
  products?: ProductSuggestion[];
}

export function DepartCockpit({
  depart,
  weather,
  kits,
  inventory = [],
  loans = [],
  products = [],
}: DepartCockpitProps) {
  const [activeSection, setActiveSection] = useState<DepartSectionId>('all');
  const [isUltraSave, setIsUltraSave] = useState(false);
  const [batteryLevel, setBatteryLevel] = useState<number | null>(null);
  const [isOnline, setIsOnline] = useState(true);
  const [isSheetOpen, setIsSheetOpen] = useState(false);

  const shouldReduceMotion = useReducedMotion();

  const isRealKit = !SHOWCASE_IDS.has(depart?.id);

  const alertInput = {
    items: (depart?.assignedKit?.items || []).map((i) => ({
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
    participants: depart?.participants || [],
    emergencyContact: depart?.emergencyContact || null,
    trailDistanceKm: depart?.trail?.distance_km ?? null,
    activityType: depart?.activityType || 'trekking',
  };

  const smartAlerts = generateSmartPrompts(alertInput);

  useEffect(() => {
    if (typeof window === 'undefined' || !depart?.id) return;

    try {
      localStorage.setItem(
        `lkdv_depart_cache_${depart.id}`,
        JSON.stringify({
          depart,
          weather,
          cachedAt: Date.now(),
        })
      );
    } catch {}

    setIsOnline(navigator.onLine);
    if (navigator.onLine) {
      flushOfflineQueue().catch(() => {});
    }

    const handleOnline = () => {
      setIsOnline(true);
      flushOfflineQueue().catch(() => {});
    };
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    const handleOpenSheet = () => setIsSheetOpen(true);
    window.addEventListener('open-departure-sheet', handleOpenSheet);

    if ('getBattery' in navigator) {
      (navigator as any)
        .getBattery()
        .then((battery: any) => {
          setBatteryLevel(battery.level);
          if (battery.level <= 0.2) {
            setIsUltraSave(true);
          }
          battery.addEventListener('levelchange', () => {
            setBatteryLevel(battery.level);
            if (battery.level <= 0.2) setIsUltraSave(true);
          });
        })
        .catch(() => {});
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('open-departure-sheet', handleOpenSheet);
    };
  }, [depart, weather]);

  const handleSelectTab = (tabId: string) => {
    setActiveSection(tabId as DepartSectionId);
  };

  const SECTIONS_TABS: TabOption[] = [
    { id: 'all', label: "Vue d'ensemble" },
    { id: 'terrain', label: 'Terrain & Météo' },
    { id: 'equipment_hub', label: 'Parc Matériel & Sac' },
  ];

  const totalItemsCount = depart?.assignedKit?.items?.length || 0;
  const checkedItemsCount = depart?.assignedKit?.items?.filter((i) => i.is_checked)?.length || 0;

  const renderMainContent = () => (
    <div className="flex flex-col gap-4 w-full">
      {/* ════ BANNIÈRE HORS-LIGNE TRANSPARENTE ════ */}
      {!isOnline && (
        <div className="p-3 rounded-2xl bg-amber-500/15 border border-amber-500/30 text-[#17402C] text-xs font-semibold flex items-center justify-between gap-2 shadow-2xs">
          <div className="flex items-center gap-2 min-w-0">
            <WifiOff size={15} className="text-amber-700 shrink-0" />
            <span className="truncate">
              Mode hors-ligne actif — Fiche de départ et données en cache. Synchronisation automatique dès reconnexion.
            </span>
          </div>
          <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-lg bg-amber-600/20 text-amber-900 shrink-0">
            Hors-ligne
          </span>
        </div>
      )}

      {/* ════ 1. VUE D'ENSEMBLE (Strict Minimum : Carte du parcours tout en haut + Poids synthétique + Accès direct) ════ */}
      {activeSection === 'all' && (
        <div className="space-y-4 w-full">
          {/* 1.1 Carte interactive du tracé GPS TOUT EN HAUT */}
          {depart?.trail && (
            <div className="w-full">
              <DepartMap trail={depart.trail} height="260px" />
            </div>
          )}

          {/* 1.2 Analyse du Poids & Décision Synthétique */}
          <div className="w-full">
            <DepartWeightBreakdown
              breakdown={depart?.weightBreakdown || []}
              totalWeightG={depart?.baseWeightG || 0}
              baseWeightG={depart?.baseWeightG || 0}
              wornWeightG={depart?.wornWeightG || 0}
              consumablesWeightG={depart?.consumablesWeightG || 0}
              items={depart?.assignedKit?.items || []}
              participants={depart?.participants || []}
              comparableTripName={depart?.comparableTrip?.name}
            />
          </div>

          {/* 1.3 Synthèse Rapide & Accès au Parc Matériel */}
          <div className="glass rounded-[24px] p-4 sm:p-5 border border-white/80 dark:border-white/10 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-[#17402C] text-white flex items-center justify-center shadow-xs shrink-0">
                <Boxes size={18} />
              </div>
              <div>
                <h3 className="text-sm font-bold text-[#17402C]">
                  Préparation du Sac & Parc Matériel
                </h3>
                <p className="text-xs text-[#5A7064]">
                  {checkedItemsCount} sur {totalItemsCount} équipements prêts ({totalItemsCount > 0 ? Math.round((checkedItemsCount / totalItemsCount) * 100) : 100}% finalisé).
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setActiveSection('equipment_hub')}
              className="px-4 py-2 rounded-xl text-xs font-bold bg-[#17402C] text-white hover:bg-[#17402C]/90 shadow-2xs flex items-center gap-1.5 cursor-pointer transition-all active:scale-98 shrink-0"
            >
              <span>Ouvrir le Parc Matériel & Sac</span>
              <ArrowRight size={13} />
            </button>
          </div>
        </div>
      )}

      {/* ════ 2. ONGLET TERRAIN & MÉTÉO (Carte complète, Météo détaillée & Groupe) ════ */}
      {activeSection === 'terrain' && (
        <section
          id="section-depart-terrain"
          aria-label="Terrain, carte interactive et météo"
          className="space-y-4"
        >
          {depart?.trail && (
            <div className="w-full">
              <DepartMap trail={depart.trail} height="380px" />
            </div>
          )}
          <DepartWeather weather={weather} updatedAt={depart?.updatedAt} />
          <DepartParticipants
            participants={depart?.participants || []}
            emergencyContact={depart?.emergencyContact}
          />
        </section>
      )}

      {/* ════ 3. ONGLET PARC MATÉRIEL & SAC (Poids, Catalogue 3-cards & Checklist en direct) ════ */}
      {activeSection === 'equipment_hub' && (
        <section id="section-depart-equipment-hub" aria-label="Parc Matériel & Analyse du Poids">
          <DepartEquipmentHub
            inventory={inventory}
            loans={loans}
            products={products}
            kitItems={depart?.assignedKit?.items || []}
            consumables={depart?.consumables}
            participants={depart?.participants || []}
            weightBreakdown={depart?.weightBreakdown || []}
            baseWeightG={depart?.baseWeightG || 0}
            wornWeightG={depart?.wornWeightG || 0}
            consumablesWeightG={depart?.consumablesWeightG || 0}
            comparableTripName={depart?.comparableTrip?.name}
            kitId={depart?.id || 'kit-default'}
            isRealKit={isRealKit}
          />
        </section>
      )}
    </div>
  );

  return (
    <div className={cn('w-full h-full min-h-0 overflow-hidden', isUltraSave && 'ultra-save-mode')}>
      {/* Modal Fiche de Départ */}
      <DepartureSheetModal
        depart={depart}
        weather={weather}
        isOpen={isSheetOpen}
        onClose={() => setIsSheetOpen(false)}
        isRealKit={isRealKit}
      />

      {/* ════ 1. VERSION MOBILE (< 768px) ════ */}
      <div className="block md:hidden w-full h-full overflow-y-auto max-w-3xl mx-auto px-3 sm:px-4 pb-[calc(5rem+env(safe-area-inset-bottom))] space-y-3 overscroll-contain">
        <div className="space-y-2 sticky top-0 z-30 pt-1 pb-1 backdrop-blur-md bg-white/30 rounded-2xl border border-white/40">
          <div className="flex items-center justify-between gap-2 px-2">
            <div className="flex items-center gap-1.5">
              <span className="text-[10.5px] font-semibold uppercase tracking-wider text-[#5A7064]">
                Cockpit
              </span>
              <span
                className={cn(
                  'flex items-center gap-1 text-[9.5px] font-mono px-1.5 py-0.2 rounded-full font-bold',
                  isOnline ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                )}
              >
                {isOnline ? <Wifi size={9} /> : <WifiOff size={9} />}
                {isOnline ? 'EN LIGNE' : 'HORS-LIGNE'}
              </span>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setIsUltraSave((v) => !v)}
                className={cn(
                  'px-2 py-0.5 rounded-lg text-[10px] font-bold flex items-center gap-1 transition-all cursor-pointer',
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

              {kits && kits.length > 1 && <KitSwitcher kits={kits} currentId={depart?.id} />}
              <Link
                href="/materiel/kits"
                className="p-1 rounded-lg bg-white/40 hover:bg-white/70 text-[#17402C] transition-colors"
                title="Gérer tous mes kits"
                aria-label="Gérer tous mes kits"
              >
                <Layers size={12} />
              </Link>
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

      {/* ════ 2. VERSION DESKTOP COCKPIT FULLSCREEN STRICT (hidden md:flex) ════ */}
      <div className="hidden md:flex h-full max-h-full overflow-hidden max-w-[1680px] w-full mx-auto px-4 sm:px-6 lg:px-8 gap-6">
        {/* Colonne 1 : Sidebar Gauche (Navigation & Switcher) */}
        <div className="w-[280px] shrink-0 h-full max-h-full min-h-0 overflow-hidden flex flex-col">
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

        {/* Colonne 2 : Flux Central Dynamique (Strict Minimum en Vue d'ensemble, Hub en Parc Matériel) */}
        <div className="flex-1 min-w-0 h-full max-h-full overflow-y-auto no-scrollbar pr-1 pb-4">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeSection}
              initial={shouldReduceMotion ? false : { opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: -6 }}
              transition={{ duration: shouldReduceMotion ? 0 : 0.18, ease: 'easeOut' }}
            >
              {renderMainContent()}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Colonne 3 : Sidebar Droite (Sections 1 & 2 : Statut du départ + Alertes & Fiabilité) */}
        <div className="w-[300px] xl:w-[320px] shrink-0 h-full max-h-full overflow-hidden flex flex-col">
          <DepartRightSidebar
            depart={depart}
            alertInput={alertInput}
            onOpenDepartureSheet={() => setIsSheetOpen(true)}
          />
        </div>
      </div>
    </div>
  );
}
