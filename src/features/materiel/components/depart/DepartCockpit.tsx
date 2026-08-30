'use client';
import { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Compass,
  ListChecks,
  AlertTriangle,
  CheckSquare,
  Scale,
  Droplets,
  MapPin,
  LayoutGrid,
} from 'lucide-react';
import { DepartHeader } from './DepartHeader';
import { DepartPreparation } from './DepartPreparation';
import { DepartAlerts } from './DepartAlerts';
import { DepartChecklist } from './DepartChecklist';
import { DepartWeightBreakdown } from './DepartWeightBreakdown';
import { DepartConsumables } from './DepartConsumables';
import { DepartWeather } from './DepartWeather';
import { DepartParticipants } from './DepartParticipants';
import { KitSwitcher } from './KitSwitcher';
import ScrollableTabs, { type TabOption } from '@/components/ui/ScrollableTabs';
import { Skeleton } from '@/components/ui/Skeleton';
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

  // Les 7 sections fonctionnelles
  const SECTIONS_TABS: TabOption[] = [
    { id: 'all', label: 'Vue complète', icon: <LayoutGrid size={13} /> },
    { id: 'overview', label: '1. Départ', icon: <Compass size={13} /> },
    { id: 'progression', label: '2. Progression', icon: <ListChecks size={13} /> },
    { id: 'alerts', label: '3. Alertes', icon: <AlertTriangle size={13} /> },
    { id: 'checklist', label: '4. Checklist', icon: <CheckSquare size={13} /> },
    { id: 'weight', label: '5. Poids', icon: <Scale size={13} /> },
    { id: 'consumables', label: '6. Consommables', icon: <Droplets size={13} /> },
    { id: 'terrain', label: '7. Terrain & Météo', icon: <MapPin size={13} /> },
  ];

  const showAll = activeSection === 'all';

  return (
    <div className="flex flex-col gap-3 w-full max-w-3xl mx-auto px-3 sm:px-4 pb-8">
      {/* Barre d'action supérieure : Switcher de kit + Switcher des 7 sections */}
      <div className="space-y-2 sticky top-0 z-30 pt-1 pb-1 backdrop-blur-md bg-white/20 rounded-2xl">
        <div className="flex items-center justify-between gap-2 px-1">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-[#5A7064]">
            Cockpit de départ
          </span>
          {kits.length > 1 && <KitSwitcher kits={kits} currentId={depart.id} />}
        </div>

        {/* Sélecteur des 7 sections */}
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
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4 }}
          transition={{ duration: 0.18, ease: 'easeOut' }}
          className="flex flex-col gap-3"
        >
          {/* ========================================================
              SECTION 1 : En-tête, Destination & Compte à rebours
             ======================================================== */}
          {(showAll || activeSection === 'overview') && (
            <section id="section-depart-overview" aria-label="Section 1 : Vue d'ensemble du départ">
              <DepartHeader depart={depart} />
            </section>
          )}

          {/* ========================================================
              SECTION 2 : Progression du Pack & Métriques
             ======================================================== */}
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

          {/* ========================================================
              SECTION 3 : Alertes & Recommandations Intelligentes
             ======================================================== */}
          {(showAll || activeSection === 'alerts') && (
            <section id="section-depart-alerts" aria-label="Section 3 : Alertes de départ">
              <DepartAlerts input={alertInput} />
            </section>
          )}

          {/* ========================================================
              SECTION 4 : Checklist Interactive du Matériel
             ======================================================== */}
          {(showAll || activeSection === 'checklist') && (
            <section id="section-depart-checklist" aria-label="Section 4 : Checklist du kit">
              <DepartChecklist items={depart.assignedKit.items} isRealKit={isRealKit} />
            </section>
          )}

          {/* ========================================================
              SECTION 5 : Analyse & Répartition du Poids
             ======================================================== */}
          {(showAll || activeSection === 'weight') && (
            <section id="section-depart-weight" aria-label="Section 5 : Répartition du poids">
              <DepartWeightBreakdown
                breakdown={depart.weightBreakdown}
                totalWeightG={depart.assignedKit.totalWeightG}
              />
            </section>
          )}

          {/* ========================================================
              SECTION 6 : Consommables & Autonomie
             ======================================================== */}
          {(showAll || activeSection === 'consumables') && (
            <section id="section-depart-consumables" aria-label="Section 6 : Consommables estimés">
              <DepartConsumables
                consumables={depart.consumables}
                durationDays={depart.durationDays}
                participantsCount={depart.participants.length || 1}
              />
            </section>
          )}

          {/* ========================================================
              SECTION 7 : Terrain, Météo & Équipe de Sécurité
             ======================================================== */}
          {(showAll || activeSection === 'terrain') && (
            <section
              id="section-depart-terrain"
              aria-label="Section 7 : Terrain, météo et sécurité"
              className="space-y-3"
            >
              {/* Météo locale */}
              <DepartWeather weather={weather} />

              {/* Équipe & Contact d'urgence */}
              <DepartParticipants
                participants={depart.participants}
                emergencyContact={depart.emergencyContact}
              />

              {/* Carte Leaflet & Tracé */}
              {depart.trail && <DepartMap trail={depart.trail} height="240px" />}
            </section>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
