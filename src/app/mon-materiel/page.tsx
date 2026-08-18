'use client';

import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import Header from '@/components/Header';
import { useEquipment, UserEquipmentItem } from '@/hooks/useEquipment';
import { useUserKits, CustomKit, CustomKitItem } from '@/hooks/useUserKits';
import { useHapticFeedback } from '@/hooks/useHapticFeedback';
import AddEditGearModal from '@/components/inventaire/AddEditGearModal';
import GearDetailDrawer from '@/components/inventaire/GearDetailDrawer';
import KitCockpitDrawer from '@/components/inventaire/KitCockpitDrawer';
import LendItemModal from '@/components/inventaire/LendItemModal';
import { addToCart } from '@/lib/cart';
import {
  getStreamingChatCompletion,
  GEMINI_PROVIDER,
  GEMINI_DEFAULT_MODEL,
} from '@/lib/ai/chatCompletion';
import {
  PlannedHike,
  getPlannedHikes,
  savePlannedHike,
  updatePlannedHike,
  removePlannedHike,
  getActivePlannedHike,
  setActivePlannedHikeId,
} from '@/lib/preparation/plannedHikes';
import {
  DepartureHikeContext,
  resolveDeparturePlan,
} from '@/lib/preparation/SmartDepartureEngine';

// ─────────────────────────────────────────────────────────────
// Constants & Helpers
// ─────────────────────────────────────────────────────────────
const PLANNED_HIKES_STORAGE_KEY = 'lkdv_planned_hikes';
const WIDGET_ORDER_KEY = 'lkdv_cockpit_widget_order';
const DEFAULT_WIDGET_ORDER = ['weight', 'departure', 'condition', 'copilot', 'alerts', 'kits'];
const WIDGET_SPAN: Record<string, string> = {
  weight: 'col-span-1 lg:col-span-1',
  departure: 'col-span-2 lg:col-span-2',
  condition: 'col-span-1 lg:col-span-1',
  copilot: 'col-span-2 lg:col-span-2',
  alerts: 'col-span-1 lg:col-span-1',
  kits: 'col-span-1 lg:col-span-1',
};
const WIDGET_LABEL: Record<string, string> = {
  weight: 'Poids du pack',
  departure: 'Prochain départ',
  condition: 'État du matériel',
  copilot: 'Copilote IA',
  alerts: 'Alertes & entretien',
  kits: 'Kits & sacs',
};

function formatWeight(g: number): string {
  if (g >= 1000) {
    return `${(g / 1000).toLocaleString('fr-FR', { minimumFractionDigits: 1, maximumFractionDigits: 2 })} kg`;
  }
  return `${g} g`;
}

const CATEGORIES = ['all', 'couchage', 'portage', 'cuisine', 'vêtement', 'navigation'];
const DEFAULT_TARGET_KG = 8;

const CONDITION_ORDER = ['neuf', 'excellent', 'bon', 'moyen', 'usé', 'à_réparer', 'à_remplacer'];
const CONDITION_META: Record<string, { label: string; color: string; bg: string }> = {
  neuf: { label: 'Neuf', color: '#2D5A3D', bg: 'rgba(45,90,61,0.08)' },
  excellent: { label: 'Excellent', color: '#3D7A52', bg: 'rgba(61,122,82,0.08)' },
  bon: { label: 'Bon', color: '#B8932A', bg: 'rgba(184,147,42,0.1)' },
  moyen: { label: 'Moyen', color: '#A1701F', bg: 'rgba(161,112,31,0.12)' },
  usé: { label: 'Usé', color: '#C0532E', bg: 'rgba(192,83,46,0.12)' },
  à_réparer: { label: 'À réparer', color: '#C0532E', bg: 'rgba(192,83,46,0.12)' },
  à_remplacer: { label: 'À remplacer', color: '#9B2C2C', bg: 'rgba(155,44,44,0.14)' },
};

function daysUntil(targetDate?: string): number | null {
  if (!targetDate) return null;
  const target = new Date(`${targetDate}T00:00:00`);
  if (Number.isNaN(target.getTime())) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((target.getTime() - today.getTime()) / 86400000);
}

function formatDateRange(h: PlannedHike): string {
  if (!h.targetDate) return 'Date à définir';
  const start = new Date(`${h.targetDate}T00:00:00`);
  if (Number.isNaN(start.getTime())) return 'Date à définir';
  const fmt = start.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
  if (h.isOvernight && h.nightsCount) {
    const end = new Date(start);
    end.setDate(end.getDate() + (h.nightsCount || 1));
    return `${fmt} → ${end.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}`;
  }
  return fmt;
}

function formatWeather(h: PlannedHike): string {
  if (h.weather && h.weather.condition) return h.weather.condition;
  return 'Prévisions non disponibles';
}

function formatTemp(h: PlannedHike): string {
  const w = h.weather;
  if (w && typeof w.tempC === 'number') return `${Math.round(w.tempC)}°C`;
  return '—';
}

function buildHikeContext(h: PlannedHike & { companions?: string }): DepartureHikeContext {
  const days = (h.isOvernight && h.nightsCount ? h.nightsCount : 0) + (h.isOvernight ? 1 : 0);
  return {
    id: h.routeId || h.id,
    name: h.name,
    distanceKm: h.distanceKm,
    elevationGain: h.elevationGain,
    elevationLoss: h.elevationLoss,
    difficulty: h.difficulty,
    season: h.season,
    terrain: h.terrain,
    hasWaterPoints: h.hasWaterPoints,
    waterPointsCount: h.waterPointsCount,
    hasRefuges: h.hasRefuges,
    isOvernight: h.isOvernight,
    nightsCount: h.nightsCount,
    weather: h.weather || null,
    startDate: h.targetDate,
    durationHours: days > 0 ? days * 6 : Math.round((h.distanceKm / 3.8) * 10) / 10,
  };
}

function extractChunkText(chunk: unknown): string {
  if (typeof chunk === 'string') return chunk;
  const c = chunk as Record<string, any>;
  if (!c) return '';
  return (
    c.content ||
    c.delta ||
    c.text ||
    c.message?.content ||
    c.choices?.[0]?.delta?.content ||
    c.choices?.[0]?.message?.content ||
    ''
  );
}

// ─────────────────────────────────────────────────────────────
// Reusable Liquid Glass card — vitre claire (visionOS style, fond papier)
// ─────────────────────────────────────────────────────────────
function GlassCard({
  children,
  className = '',
  ...rest
}: React.HTMLAttributes<HTMLDivElement> & { className?: string }) {
  return (
    <div
      className={`relative rounded-[28px] overflow-hidden border border-white/70 bg-white/65 backdrop-blur-2xl backdrop-saturate-150 shadow-[0_24px_60px_-24px_rgba(11,31,23,0.22),0_4px_16px_rgba(11,31,23,0.06),inset_0_1px_0_0_rgba(255,255,255,0.85)] ${className}`}
      {...rest}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-28 opacity-80"
        style={{ background: 'linear-gradient(180deg, rgba(255,255,255,0.6) 0%, rgba(255,255,255,0.12) 55%, transparent 100%)' }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 rounded-[28px]"
        style={{
          padding: 1,
          background: 'linear-gradient(140deg, rgba(255,255,255,1), rgba(255,255,255,0.4) 40%, rgba(255,255,255,0.15) 75%)',
          WebkitMask: 'linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)',
          WebkitMaskComposite: 'xor',
          maskComposite: 'exclude',
        }}
      />
      <div className="relative h-full flex flex-col">{children}</div>
    </div>
  );
}

// Radial Weight Gauge
function WeightGauge({ currentG, targetKg }: { currentG: number; targetKg: number }) {
  const targetG = targetKg * 1000;
  const ratio = targetG > 0 ? currentG / targetG : 0;
  const pct = Math.min(ratio, 1);
  const r = 32;
  const c = 2 * Math.PI * r;
  const dash = c * pct;
  const color = ratio <= 0.85 ? '#2D5A3D' : ratio <= 1 ? '#B8932A' : '#C0532E';
  return (
    <div className="relative w-[84px] h-[84px] shrink-0">
      <svg viewBox="0 0 84 84" className="w-full h-full -rotate-90">
        <circle cx="42" cy="42" r={r} fill="none" stroke="rgba(11,31,23,0.08)" strokeWidth="6" />
        <circle
          cx="42"
          cy="42"
          r={r}
          fill="none"
          stroke={color}
          strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray={`${dash} ${c}`}
          style={{ transition: 'stroke-dasharray 0.6s ease, stroke 0.3s ease' }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-xs font-bold font-mono" style={{ color }}>
          {(currentG / 1000).toFixed(1)}
        </span>
        <span className="text-xs text-[#1C2620]/60 font-mono">/ {targetKg} kg</span>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Cockpit icons (Polestar automotive — strong, monochrome)
// ─────────────────────────────────────────────────────────────
function IconScale() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M12 3v4M9 7h6M12 7l5 13H7l5-13Z" />
      <path d="M5 20h14" />
    </svg>
  );
}

function IconNav() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="12" cy="12" r="9" />
      <path d="M15.5 8.5l-2 5-5 2 2-5 5-2Z" />
    </svg>
  );
}

function IconActivity() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M3 12h4l2-7 4 14 2-7h6" />
    </svg>
  );
}

function IconSparkle() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3Z" />
      <path d="M19 15l.7 2 2 .7-2 .7-.7 2-.7-2-2-.7 2-.7.7-2Z" />
    </svg>
  );
}

function IconBell() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M18 8a6 6 0 1 0-12 0c0 7-3 8-3 8h18s-3-1-3-8" />
      <path d="M13.7 21a2 2 0 0 1-3.4 0" />
    </svg>
  );
}

function IconBackpack() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M6 9a6 6 0 0 1 12 0v11a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V9Z" />
      <path d="M9 6a3 3 0 0 1 6 0M8 14h8M8 18h8" />
    </svg>
  );
}

// ─────────────────────────────────────────────────────────────
// Main Page Component — Cockpit Polestar 6 Modules (Sans Sidebar)
// ─────────────────────────────────────────────────────────────
export default function MonMaterielCockpitPage() {
  const { triggerHaptic } = useHapticFeedback();

  // Supabase Hooks
  const {
    equipment,
    loading: equipmentLoading,
    addToEquipment,
    removeFromEquipment,
    updateEquipment,
  } = useEquipment();

  const {
    kits,
    trashKits,
    trashCount,
    loading: kitsLoading,
    updateKit,
    moveToTrash,
    createKit,
    restoreFromTrash,
    permanentDelete,
  } = useUserKits(equipment);

  const isLoading = equipmentLoading || kitsLoading;

  // Filter and Selection States
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedBrand, setSelectedBrand] = useState<string>('Tous');
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [conditionFilter, setConditionFilter] = useState<string>('all');
  const [onlyFavorites, setOnlyFavorites] = useState(false);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [selectedKitId, setSelectedKitId] = useState<string | null>(null);
  const [selectedHikeId, setSelectedHikeId] = useState<string | null>(null);
  const [targetKg, setTargetKg] = useState<number>(DEFAULT_TARGET_KG);

  // Planned Hikes State — source de vérité partagée (src/lib/preparation/plannedHikes.ts)
  // Chargé après hydration pour rester cohérent avec le SSR (pattern identique aux hooks équipement/kits).
  const [plannedHikes, setPlannedHikes] = useState<PlannedHike[]>([]);

  useEffect(() => {
    const all = getPlannedHikes();
    setPlannedHikes(all);
    const active = getActivePlannedHike();
    setSelectedHikeId((prev) => prev ?? active?.id ?? all[0]?.id ?? null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Synchronise automatiquement avec les sorties planifiées ailleurs (préparateur, autre onglet)
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === PLANNED_HIKES_STORAGE_KEY) {
        setPlannedHikes(getPlannedHikes());
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  // Selection & Compare states
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [compareIds, setCompareIds] = useState<string[]>([]);

  // Inline edit state
  const [inlineEditId, setInlineEditId] = useState<string | null>(null);
  const [inlineWeight, setInlineWeight] = useState<string>('');
  const [inlineQty, setInlineQty] = useState<string>('');

  // Modals & Drawers
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<UserEquipmentItem | null>(null);
  const [isDetailDrawerOpen, setIsDetailDrawerOpen] = useState(false);
  const [isKitDrawerOpen, setIsKitDrawerOpen] = useState(false);
  const [selectedKitForCockpit, setSelectedKitForCockpit] = useState<CustomKit | null>(null);
  const [isLendModalOpen, setIsLendModalOpen] = useState(false);
  const [isNewHikeModalOpen, setIsNewHikeModalOpen] = useState(false);
  const [isTrashModalOpen, setIsTrashModalOpen] = useState(false);

  // Cockpit Polestar — ordre des 6 modules (drag & drop + persistance localStorage)
  const [widgetOrder, setWidgetOrder] = useState<string[]>(DEFAULT_WIDGET_ORDER);
  const [widgetOrderLoaded, setWidgetOrderLoaded] = useState(false);
  const [voirToutOpen, setVoirToutOpen] = useState(false);
  const [voirToutTab, setVoirToutTab] = useState<'inventaire' | 'prets' | 'reglages' | 'actions'>('inventaire');
  const [dragWidget, setDragWidget] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(WIDGET_ORDER_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (
          Array.isArray(parsed) &&
          parsed.length === DEFAULT_WIDGET_ORDER.length &&
          DEFAULT_WIDGET_ORDER.every((w) => parsed.includes(w))
        ) {
          setWidgetOrder(parsed as string[]);
        }
      }
    } catch {
      /* ignore malformed localStorage */
    }
    setWidgetOrderLoaded(true);
  }, []);

  useEffect(() => {
    if (!widgetOrderLoaded) return;
    try {
      window.localStorage.setItem(WIDGET_ORDER_KEY, JSON.stringify(widgetOrder));
    } catch {
      /* ignore quota errors */
    }
  }, [widgetOrder, widgetOrderLoaded]);

  // New Hike Form state
  const [newHikeName, setNewHikeName] = useState('');
  const [newHikeDest, setNewHikeDest] = useState('');
  const [newHikeDays, setNewHikeDays] = useState(2);
  const [newHikeKm, setNewHikeKm] = useState(30);
  const [newHikeDPlus, setNewHikeDPlus] = useState(1500);
  const [newHikeCompanions, setNewHikeCompanions] = useState('');

  // Toast feedback state
  const [toastMessage, setToastMessage] = useState<{ id: number; text: string; type?: 'success' | 'info' } | null>(null);
  const showToast = useCallback((text: string, type: 'success' | 'info' = 'success') => {
    setToastMessage({ id: Date.now(), text, type });
    setTimeout(() => {
      setToastMessage((cur) => (cur && Date.now() - cur.id >= 2400 ? null : cur));
    }, 2500);
  }, []);

  // AI Copilot State
  const [aiInput, setAiInput] = useState('');
  const [aiResponse, setAiResponse] = useState('');
  const [aiStreaming, setAiStreaming] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiMode, setAiMode] = useState<'live' | 'local' | null>(null);
  const aiScrollRef = useRef<HTMLDivElement | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);

  const prefersReducedMotion =
    typeof window !== 'undefined' &&
    window.matchMedia &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Reset search when filters change (garder la sélection cohérente)
  useEffect(() => {
    if (equipment.length > 0) {
      if (!selectedItemId || !equipment.some((e) => e.id === selectedItemId)) {
        setSelectedItemId(equipment[0].id);
      }
    }
  }, [equipment, selectedItemId]);

  useEffect(() => {
    if (kits.length > 0) {
      if (!selectedKitId || !kits.some((k) => k.id === selectedKitId)) {
        setSelectedKitId(kits[0].id);
      }
    }
  }, [kits, selectedKitId]);

  // Available brands computed from inventory
  const availableBrands = useMemo(() => {
    const set = new Set<string>();
    equipment.forEach((e) => {
      if (e.brand && e.brand.trim()) set.add(e.brand.trim());
    });
    return ['Tous', ...Array.from(set).sort()];
  }, [equipment]);

  // Filtered equipment list
  const filteredEquipment = useMemo(() => {
    return equipment.filter((item) => {
      if (onlyFavorites && !item.is_favorite) return false;
      if (selectedBrand && selectedBrand !== 'Tous') {
        if (!item.brand?.toLowerCase().includes(selectedBrand.toLowerCase())) return false;
      }
      if (conditionFilter && conditionFilter !== 'all') {
        if ((item.condition || 'bon') !== conditionFilter) return false;
      }
      if (activeCategory !== 'all') {
        const cat = (item.category || '').toLowerCase();
        const t = activeCategory.toLowerCase();
        let matches = cat.includes(t);
        if (t === 'portage' && (cat.includes('sac') || cat.includes('pack') || cat.includes('portage'))) matches = true;
        if (t === 'couchage' && (cat.includes('tente') || cat.includes('duvet') || cat.includes('matelas') || cat.includes('bivouac') || cat.includes('couchage'))) matches = true;
        if (t === 'cuisine' && (cat.includes('hydrat') || cat.includes('eau') || cat.includes('rechaud') || cat.includes('réchaud') || cat.includes('popote') || cat.includes('filtre') || cat.includes('cuisine'))) matches = true;
        if (t === 'vêtement' && (cat.includes('vetement') || cat.includes('vêtement') || cat.includes('textile') || cat.includes('veste') || cat.includes('chaussure'))) matches = true;
        if (t === 'navigation' && (cat.includes('gps') || cat.includes('boussole') || cat.includes('carte') || cat.includes('sécurité') || cat.includes('securite') || cat.includes('secours') || cat.includes('éclair') || cat.includes('eclair') || cat.includes('lampe') || cat.includes('navigation'))) matches = true;
        if (!matches) return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchName = item.name?.toLowerCase().includes(q);
        const matchBrand = item.brand?.toLowerCase().includes(q);
        const matchCat = item.category?.toLowerCase().includes(q);
        const matchNotes = item.notes?.toLowerCase().includes(q);
        if (!matchName && !matchBrand && !matchCat && !matchNotes) return false;
      }
      return true;
    });
  }, [equipment, onlyFavorites, selectedBrand, conditionFilter, activeCategory, searchQuery]);

  // Active selected item
  const activeItem = useMemo(() => {
    if (filteredEquipment.length > 0) {
      const found = filteredEquipment.find((e) => e.id === selectedItemId);
      if (found) return found;
      return filteredEquipment[0];
    }
    return equipment.find((e) => e.id === selectedItemId) || equipment[0] || null;
  }, [filteredEquipment, equipment, selectedItemId]);

  // Active selected hike
  const activeHike = useMemo(() => {
    return plannedHikes.find((h) => h.id === selectedHikeId) || plannedHikes[0] || null;
  }, [plannedHikes, selectedHikeId]);

  // Active selected kit
  const activeKit = useMemo(() => {
    if (activeHike?.assignedKitId) {
      const found = kits.find((k) => k.id === activeHike.assignedKitId);
      if (found) return found;
    }
    return kits.find((k) => k.id === selectedKitId) || kits[0] || null;
  }, [kits, selectedKitId, activeHike]);

  // Moteur de départ intelligent (SmartDepartureEngine) — kit recommandé + consommables réels
  const departurePlan = useMemo(() => {
    if (!activeHike) return null;
    try {
      return resolveDeparturePlan(buildHikeContext(activeHike), kits, equipment);
    } catch {
      return null;
    }
  }, [activeHike, kits, equipment]);

  const recommendedKit = departurePlan?.selectedKit ?? null;

  // Hike readiness analysis (kit assigné)
  const hikeReadiness = useMemo(() => {
    if (!activeKit) return { readinessPct: 100, ownedCount: 0, totalCount: 0, missingItems: [] };
    const kitItems = activeKit.items || [];
    const missing: CustomKitItem[] = [];
    let owned = 0;

    kitItems.forEach((ki) => {
      const isOwned = equipment.some(
        (e) => (ki.gear_item_id && e.id === ki.gear_item_id) || e.name.toLowerCase() === ki.item_name.toLowerCase()
      );
      if (isOwned) {
        owned++;
      } else {
        missing.push(ki);
      }
    });

    const pct = kitItems.length > 0 ? Math.round((owned / kitItems.length) * 100) : 100;
    return {
      readinessPct: pct,
      ownedCount: owned,
      totalCount: kitItems.length,
      missingItems: missing,
    };
  }, [activeKit, equipment]);

  // Totals
  const totalWeightG = useMemo(
    () => equipment.reduce((sum, it) => sum + (it.weight_g || 0) * (it.quantity || 1), 0),
    [equipment]
  );
  const totalValue = useMemo(
    () => equipment.reduce((sum, it) => sum + (Number(it.purchase_price) || 0) * (it.quantity || 1), 0),
    [equipment]
  );
  const favoritesCount = useMemo(() => equipment.filter((e) => e.is_favorite).length, [equipment]);

  // Category distribution
  const categoryStats = useMemo(() => {
    const map = new Map<string, number>();
    equipment.forEach((it) => {
      const cat = (it.category || 'Autre').split(/[&/]/)[0].trim();
      map.set(cat, (map.get(cat) || 0) + (it.weight_g || 0) * (it.quantity || 1));
    });
    const total = Array.from(map.values()).reduce((a, b) => a + b, 0) || 1;
    return Array.from(map.entries())
      .map(([label, grams]) => ({ label, grams, pct: Math.round((grams / total) * 100) }))
      .sort((a, b) => b.grams - a.grams)
      .slice(0, 4);
  }, [equipment]);

  // État du matériel (répartition par condition)
  const conditionStats = useMemo(() => {
    return CONDITION_ORDER.map((key) => {
      const items = equipment.filter((it) => (it.condition || 'bon') === key);
      const weight = items.reduce((sum, it) => sum + (it.weight_g || 0) * (it.quantity || 1), 0);
      return { key, count: items.length, weight };
    }).filter((s) => s.count > 0);
  }, [equipment]);

  // Smart alerts & loans
  const alerts = useMemo(() => {
    const now = Date.now();
    const out: { id: string; kind: 'maintenance' | 'expiry' | 'replace' | 'loan'; label: string; itemId: string; borrower?: string }[] = [];
    equipment.forEach((it) => {
      if (it.next_maintenance_date && new Date(it.next_maintenance_date).getTime() < now) {
        out.push({ id: `m-${it.id}`, kind: 'maintenance', label: `Révision due — ${it.name}`, itemId: it.id });
      }
      if (it.expiry_date && new Date(it.expiry_date).getTime() < now) {
        out.push({ id: `e-${it.id}`, kind: 'expiry', label: `Péremption — ${it.name}`, itemId: it.id });
      }
      if (it.condition === 'à_remplacer' || it.condition === 'à_réparer') {
        out.push({ id: `r-${it.id}`, kind: 'replace', label: `À réparer/remplacer — ${it.name}`, itemId: it.id });
      }
      if (it.loan_status === 'prêté') {
        out.push({ id: `l-${it.id}`, kind: 'loan', label: `Prêté à ${it.loan_to_name || 'un ami'} — ${it.name}`, itemId: it.id, borrower: it.loan_to_name || '' });
      }
    });
    return out;
  }, [equipment]);

  // Matériel actuellement prêté (card dédiée, action « rendu » réelle)
  const loanedItems = useMemo(
    () => equipment.filter((it) => it.loan_status === 'prêté'),
    [equipment]
  );

  const handleMarkReturned = async (item: UserEquipmentItem) => {
    triggerHaptic('success');
    await updateEquipment(item.id, { loan_status: 'disponible', loan_to_name: null });
    showToast(`✅ ${item.name} marqué comme rendu`, 'success');
  };

  // Reset filters
  const handleResetFilters = () => {
    triggerHaptic('light');
    setSearchQuery('');
    setSelectedBrand('Tous');
    setActiveCategory('all');
    setConditionFilter('all');
    setOnlyFavorites(false);
  };

  // Toggle favorite
  const handleToggleFavorite = useCallback(
    async (item: UserEquipmentItem, e?: React.MouseEvent) => {
      e?.stopPropagation();
      triggerHaptic('light');
      const nextState = !item.is_favorite;
      await updateEquipment(item.id, { is_favorite: nextState });
      showToast(nextState ? `❤️ ${item.name} ajouté aux favoris` : `Retiré des favoris`, 'info');
    },
    [updateEquipment, triggerHaptic, showToast]
  );

  // Inline edit save
  const startInlineEdit = (item: UserEquipmentItem, e: React.MouseEvent) => {
    e.stopPropagation();
    setInlineEditId(item.id);
    setInlineWeight(String(item.weight_g ?? ''));
    setInlineQty(String(item.quantity ?? 1));
  };
  const saveInlineEdit = async (item: UserEquipmentItem) => {
    triggerHaptic('light');
    const w = Number(inlineWeight);
    const q = Math.max(1, Number(inlineQty) || 1);
    await updateEquipment(item.id, {
      weight_g: Number.isFinite(w) && w >= 0 ? w : item.weight_g,
      quantity: q,
    });
    setInlineEditId(null);
    showToast(`Poids mis à jour : ${formatWeight((Number.isFinite(w) ? w : item.weight_g) * q)}`, 'success');
  };

  // Multi-select & Bulk delete
  const toggleSelected = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    triggerHaptic('light');
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };
  const clearSelection = () => setSelectedIds(new Set());
  const bulkDelete = async () => {
    triggerHaptic('warning');
    const count = selectedIds.size;
    for (const id of Array.from(selectedIds)) {
      await removeFromEquipment(id);
    }
    clearSelection();
    showToast(`${count} article(s) supprimé(s)`, 'info');
  };

  // Comparator
  const toggleCompare = (id: string) => {
    triggerHaptic('light');
    setCompareIds((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= 2) return [prev[1], id];
      return [...prev, id];
    });
  };
  const compareItems = useMemo(
    () => compareIds.map((id) => equipment.find((e) => e.id === id)).filter(Boolean) as UserEquipmentItem[],
    [compareIds, equipment]
  );

  // Assign kit to hike (persisté via le module partagé)
  const handleAssignKitToHike = (hikeId: string, kitId: string) => {
    triggerHaptic('selection');
    const updated = updatePlannedHike(hikeId, { assignedKitId: kitId });
    setPlannedHikes(updated);
    const kitObj = kits.find((k) => k.id === kitId);
    showToast(`Kit « ${kitObj?.name || 'Sélectionné'} » assigné à cette sortie`, 'success');
  };

  // Delete a planned hike
  const handleDeleteHike = (hikeId: string) => {
    const hike = plannedHikes.find((h) => h.id === hikeId);
    if (!hike) return;
    if (!window.confirm(`Supprimer la sortie « ${hike.name} » ?`)) return;
    triggerHaptic('warning');
    const remaining = removePlannedHike(hikeId);
    setPlannedHikes(remaining);
    setSelectedHikeId(remaining[0]?.id ?? null);
    showToast('Sortie supprimée', 'info');
  };

  // Create new planned hike (source partagée)
  const handleCreateHike = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newHikeName.trim()) return;
    triggerHaptic('success');
    const days = Math.max(1, Number(newHikeDays) || 1);
    const target = new Date();
    target.setDate(target.getDate() + 30);
    const targetDate = target.toISOString().split('T')[0];

    const newHike = savePlannedHike({
      name: newHikeName.trim(),
      distanceKm: Number(newHikeKm) || 25,
      elevationGain: Number(newHikeDPlus) || 1200,
      targetDate,
      difficulty: 'Moyen',
      season: 'Toutes saisons',
      terrain: newHikeDest.trim() || 'Massif Alpin',
      isOvernight: days > 1,
      nightsCount: days > 1 ? days - 1 : 0,
      assignedKitId: kits[0]?.id,
      companions: newHikeCompanions.trim() || undefined,
    });
    setPlannedHikes((prev) => [newHike, ...prev]);
    setSelectedHikeId(newHike.id);
    setActivePlannedHikeId(newHike.id);
    setIsNewHikeModalOpen(false);
    setNewHikeName('');
    setNewHikeDest('');
    setNewHikeDays(2);
    setNewHikeKm(30);
    setNewHikeDPlus(1500);
    setNewHikeCompanions('');
    showToast(`Randonnée « ${newHike.name} » planifiée !`, 'success');
  };

  // Sélection d'une sortie dans la liste
  const handleSelectHike = (h: PlannedHike) => {
    triggerHaptic('light');
    setSelectedHikeId(h.id);
    setActivePlannedHikeId(h.id);
    if (h.assignedKitId) setSelectedKitId(h.assignedKitId);
  };

  // Créer un nouveau kit (réutilisé par le widget Kits et l'onglet Actions)
  const handleCreateNewKit = async () => {
    triggerHaptic('success');
    const created = await createKit({
      name: `Nouveau Kit #${kits.length + 1}`,
      description: 'Kit sur-mesure pour expédition',
      for_destination: 'Haute Montagne',
      season: 'Été',
      activity: 'Trek',
      source: 'manuel',
      gearItems: [],
    });
    if (created) {
      setSelectedKitForCockpit(created);
      setIsKitDrawerOpen(true);
      showToast(`Kit « ${created.name} » créé !`, 'success');
    }
  };

  // ── Drag & drop : réordonner les 6 modules ──
  const handleGripDragStart = (id: string) => (e: React.DragEvent) => {
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', id);
    setDragWidget(id);
  };
  const handleGripDragEnd = () => {
    setDragWidget(null);
    setDragOverId(null);
  };
  const handleDropOn = (targetId: string) => {
    if (!dragWidget || dragWidget === targetId) return;
    setWidgetOrder((prev) => {
      const next = [...prev];
      const from = next.indexOf(dragWidget);
      const to = next.indexOf(targetId);
      next.splice(from, 1);
      next.splice(to, 0, dragWidget);
      return next;
    });
    triggerHaptic('selection');
    setDragWidget(null);
    setDragOverId(null);
  };
  const moveWidget = (id: string, dir: -1 | 1) => {
    setWidgetOrder((prev) => {
      const idx = prev.indexOf(id);
      const to = idx + dir;
      if (idx < 0 || to < 0 || to >= prev.length) return prev;
      const next = [...prev];
      next.splice(to, 0, next.splice(idx, 1)[0]);
      return next;
    });
    triggerHaptic('light');
  };
  const resetWidgetOrder = () => {
    setWidgetOrder([...DEFAULT_WIDGET_ORDER]);
    showToast('Disposition des modules réinitialisée', 'info');
  };

  // Local AI Expert generator (instant fallback when offline or no API key)
  const generateLocalAiAdvice = useCallback(
    (q: string) => {
      const sortedByWeight = [...equipment].sort((a, b) => (b.weight_g || 0) - (a.weight_g || 0));
      const heaviest = sortedByWeight.slice(0, 3);
      const targetG = targetKg * 1000;
      const diffG = totalWeightG - targetG;
      const diffStr = diffG > 0 ? `+${formatWeight(diffG)} au-dessus` : `${formatWeight(Math.abs(diffG))} sous`;

      let advice = `🎒 **Analyse LKDV de ton pack :**\n\n`;
      advice += `• **Poids total inventorié :** ${formatWeight(totalWeightG)} (${diffStr} de ton objectif de ${targetKg} kg).\n`;
      if (activeHike) {
        advice += `• **Sortie active :** ${activeHike.name} (${activeHike.distanceKm} km, +${activeHike.elevationGain || 0}m D+, ${activeHike.isOvernight ? `${(activeHike.nightsCount || 1) + 1} jours` : 'journée'}).\n`;
        advice += `• **Kit assigné :** ${activeKit?.name || 'Aucun'} (${hikeReadiness.readinessPct}% de matériel prêt).\n`;
      }
      advice += `• **Top 3 des articles les plus lourds :**\n`;
      heaviest.forEach((it, idx) => {
        advice += `  ${idx + 1}. **${it.name}** (${it.brand || 'Outdoor'}) : ${formatWeight(it.weight_g || 0)}\n`;
      });

      if (q.toLowerCase().includes('alléger') || q.toLowerCase().includes('poids') || q.toLowerCase().includes('optimis')) {
        advice += `\n⚡ **Pistes d'allègement prioritaires :**\n`;
        if (heaviest[0]) {
          advice += `1. **Remplacement de « ${heaviest[0].name} »** par une alternative ultralégère (-${Math.round((heaviest[0].weight_g || 500) * 0.4)} g estimé).\n`;
        }
        advice += `2. **Mutualisation** des consommables et popote si départ à plusieurs.\n`;
        advice += `3. Contrôle des doublons textiles et petits accessoires.\n`;
      } else if (q.toLowerCase().includes('réviser') || q.toLowerCase().includes('départ') || q.toLowerCase().includes('mainten')) {
        advice += `\n🛠️ **Vérifications avant départ :**\n`;
        const toCheck = equipment.filter((e) => e.condition === 'à_réparer' || e.condition === 'à_remplacer' || e.next_maintenance_date);
        if (toCheck.length > 0) {
          toCheck.forEach((it) => {
            advice += `• **${it.name}** : État ${it.condition || 'révision requise'}.\n`;
          });
        } else {
          advice += `• Tout le matériel inventorié est en bon état opérationnel.\n• Pense à tester l'étanchéité de la tente et les piles de la frontale.\n`;
        }
      } else {
        advice += `\n💡 **Recommandation LKDV :** Ton équipement couvre ${categoryStats.length} grandes catégories. Pense à équilibrer le portage avec les charges les plus denses près du dos.`;
      }

      return advice;
    },
    [equipment, totalWeightG, targetKg, activeHike, activeKit, hikeReadiness, categoryStats]
  );

  // AI Copilot streaming trigger
  const runAi = useCallback(
    (question: string) => {
      const q = question.trim();
      if (!q || aiStreaming) return;
      triggerHaptic('selection');
      setAiStreaming(true);
      setAiError(null);
      setAiMode(null);
      setAiResponse('');

      const inventorySummary = equipment
        .map((e) => `- ${e.name} (${e.brand || 'sans marque'}, ${e.category}, ${e.weight_g || 0} g${e.condition ? `, état: ${e.condition}` : ''})`)
        .join('\n');

      const messages = [
        {
          role: 'system',
          content:
            "Tu es le Copilote Équipement du Kit du Voyageur, expert en optimisation de packs de randonnée et trek. Tu réponds en français, de façon concise et actionnable (listes courtes, poids en grammes/kg). Base-toi UNIQUEMENT sur l'inventaire fourni. Propose des arbitrages de poids concrets.",
        },
        {
          role: 'user',
          content: `Voici mon inventaire actuel (${equipment.length} articles, poids total ${formatWeight(totalWeightG)}, objectif ${targetKg} kg, rando active: ${activeHike?.name || 'Trek standard'}):\n${inventorySummary}\n\nDemande: ${q}`,
        },
      ];

      let receivedAnyChunk = false;

      try {
        getStreamingChatCompletion(
          GEMINI_PROVIDER,
          GEMINI_DEFAULT_MODEL,
          messages,
          (chunk) => {
            const text = extractChunkText(chunk);
            if (text) {
              receivedAnyChunk = true;
              setAiMode('live');
              setAiResponse((prev) => prev + text);
              requestAnimationFrame(() => {
                if (aiScrollRef.current) aiScrollRef.current.scrollTop = aiScrollRef.current.scrollHeight;
              });
            }
          },
          () => setAiStreaming(false),
          (_err) => {
            if (!receivedAnyChunk) {
              setAiMode('local');
              const fallbackText = generateLocalAiAdvice(q);
              let currIdx = 0;
              const interval = setInterval(() => {
                currIdx += 12;
                if (currIdx >= fallbackText.length) {
                  setAiResponse(fallbackText);
                  setAiStreaming(false);
                  clearInterval(interval);
                } else {
                  setAiResponse(fallbackText.slice(0, currIdx));
                }
              }, 25);
            } else {
              setAiStreaming(false);
            }
          },
          { temperature: 0.6, max_tokens: 700 }
        );
      } catch {
        setAiMode('local');
        const fallbackText = generateLocalAiAdvice(q);
        setAiResponse(fallbackText);
        setAiStreaming(false);
      }
    },
    [aiStreaming, equipment, totalWeightG, targetKg, activeHike, triggerHaptic, generateLocalAiAdvice]
  );

  // Keyboard shortcuts
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const typing = ['INPUT', 'TEXTAREA'].includes(target?.tagName) || target?.isContentEditable;
      if (e.key === '/' && !typing) {
        e.preventDefault();
        searchInputRef.current?.focus();
        return;
      }
      if (typing) return;
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        if (filteredEquipment.length === 0) return;
        e.preventDefault();
        const idx = filteredEquipment.findIndex((it) => it.id === (activeItem?.id || selectedItemId));
        const nextIdx =
          e.key === 'ArrowDown'
            ? Math.min(filteredEquipment.length - 1, idx + 1)
            : Math.max(0, idx - 1);
        setSelectedItemId(filteredEquipment[nextIdx].id);
        triggerHaptic('light');
      } else if (e.key.toLowerCase() === 'f' && activeItem) {
        handleToggleFavorite(activeItem);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [filteredEquipment, activeItem, selectedItemId, handleToggleFavorite, triggerHaptic]);

  const enterAnim = prefersReducedMotion ? '' : 'motion-safe:animate-[fadeInUp_0.4s_ease_both]';

  // ── Widget shells (en-tête commun + corps des 6 modules) ──
  const widgetShell = (
    id: string,
    icon: React.ReactNode,
    title: string,
    subtitle: string,
    moreTab: 'inventaire' | 'prets' | 'reglages' | 'actions',
    children: React.ReactNode
  ) => (
    <div className="h-full flex flex-col p-3.5 min-h-0">
      <div className="flex items-center justify-between gap-2 pb-2.5 border-b border-[#1C2620]/[0.08] shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <span className="w-7 h-7 rounded-lg bg-[#2D5A3D]/[0.08] border border-[#1C2620]/[0.09] flex items-center justify-center text-sm shrink-0 text-[#2D5A3D]">
            {icon}
          </span>
          <div className="min-w-0">
            <h2 className="text-xs font-extrabold uppercase tracking-wider text-[#1C2620] truncate">{title}</h2>
            {subtitle && <p className="text-xs text-[#1C2620]/70 truncate">{subtitle}</p>}
          </div>
        </div>
        <div className="flex items-center gap-0.5 shrink-0">
          <span
            draggable
            onDragStart={handleGripDragStart(id)}
            onDragEnd={handleGripDragEnd}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                setVoirToutTab('reglages');
                setVoirToutOpen(true);
              }
            }}
            title="Réorganiser le module (glisser, ou via Réglages)"
            aria-label="Réorganiser le module"
            className="cursor-grab active:cursor-grabbing p-1.5 text-[#1C2620]/50 hover:text-[#1C2620] rounded-lg hover:bg-[#1C2620]/[0.06] text-xs"
          >
            ⠿
          </span>
          <button
            type="button"
            onClick={() => {
              setVoirToutTab(moreTab);
              setVoirToutOpen(true);
              triggerHaptic('light');
            }}
            className="px-2 py-1 text-xs font-semibold text-[#2D5A3D] hover:text-[#1C2620] hover:bg-[#1C2620]/[0.06] rounded-lg transition-colors"
          >
            Tout voir
          </button>
        </div>
      </div>
      <div className="flex-1 min-h-0 mt-3 flex flex-col overflow-hidden">{children}</div>
    </div>
  );

  const renderWidget = (id: string): React.ReactNode => {
    switch (id) {
      case 'weight':
        return widgetShell(
          'weight',
          <IconScale />,
          'Poids du pack',
          `${equipment.length} articles · ${Math.round(totalValue)} €`,
          'reglages',
          (() => {
            const targetG = targetKg * 1000;
            const ratio = targetG > 0 ? totalWeightG / targetG : 0;
            const pct = Math.min(100, Math.round(ratio * 100));
            const color = ratio <= 0.85 ? '#2D5A3D' : ratio <= 1 ? '#B8932A' : '#C0532E';
            return (
              <>
                <div className="flex items-end justify-between gap-3 shrink-0">
                  <div className="min-w-0">
                    <div className="text-4xl font-extrabold font-mono tracking-tight leading-none text-[#1C2620]">
                      {formatWeight(totalWeightG)}
                    </div>
                    <p className="text-xs text-[#1C2620]/70 mt-2">
                      Cible <span className="font-bold" style={{ color }}>{targetKg} kg</span> · {pct}% chargé
                    </p>
                  </div>
                  <WeightGauge currentG={totalWeightG} targetKg={targetKg} />
                </div>
                <div className="mt-3 shrink-0">
                  <div className="h-2 rounded-full bg-[#1C2620]/[0.07] overflow-hidden">
                    <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, backgroundColor: color }} />
                  </div>
                </div>
                <div className="flex items-center gap-1.5 mt-3 shrink-0 flex-wrap">
                  <span className="text-xs text-[#1C2620]/70">Objectif :</span>
                  {[6, 8, 10, 12].map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => { setTargetKg(t); triggerHaptic('light'); showToast(`Objectif ajusté à ${t} kg`, 'info'); }}
                      className={`px-2.5 py-1 rounded-lg text-xs font-mono font-bold transition-colors ${
                        targetKg === t
                          ? 'bg-[#2D5A3D] text-white'
                          : 'bg-[#1C2620]/[0.04]0 hover:bg-[#1C2620]/[0.1] text-[#1C2620]/80 border border-[#1C2620]/[0.08]'
                      }`}
                    >
                      {t}k
                    </button>
                  ))}
                </div>
              </>
            );
          })()
        );

      case 'departure':
        return widgetShell(
          'departure',
          <IconNav />,
          'Prochain départ',
          activeHike ? `${activeHike.name} · ${activeHike.terrain || activeHike.season || 'Randonnée'}` : 'Aucune sortie planifiée',
          'actions',
          activeHike ? (
            <>
              <div className="flex items-start justify-between gap-3 shrink-0">
                <div className="min-w-0">
                  {(() => {
                    const d = daysUntil(activeHike.targetDate);
                    const imminent = d !== null && d >= 0 && d <= 3;
                    return (
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold font-mono ${
                        d === null
                          ? 'bg-[#1C2620]/[0.07] text-[#1C2620]/70'
                          : d < 0
                          ? 'bg-[#1C2620]/[0.07] text-[#1C2620]/60'
                          : imminent
                          ? 'bg-[#8C6A1A] text-white shadow-[0_0_18px_rgba(233,196,106,0.55)]'
                          : 'bg-[#2D5A3D]/20 text-[#2D5A3D]'
                      }`}>
                        {d === null ? 'Date à définir' : d < 0 ? `J+${Math.abs(d)}` : d === 0 ? "C'est aujourd'hui !" : `J-${d} jours`}
                      </span>
                    );
                  })()}
                  <p className="text-xs text-[#1C2620]/70 mt-1.5">
                    {formatDateRange(activeHike)}
                    {activeHike.companions ? ` · ${activeHike.companions}` : ''}
                  </p>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <Link
                    href={activeHike.routeId ? `/randonnee-active?routeId=${activeHike.routeId}` : '/randonnee-active'}
                    className="px-3.5 py-1.5 rounded-full bg-[#2D5A3D] hover:bg-[#235030] text-white font-bold text-xs transition-all active:scale-95"
                  >
                    🚀 Démarrer
                  </Link>
                  <Link
                    href={activeHike.routeId ? `/preparer-randonnee?routeId=${activeHike.routeId}` : '/explorer'}
                    className="px-3 py-1.5 rounded-full bg-[#1C2620]/[0.07] hover:bg-white/20 text-[#1C2620] text-xs font-bold transition-all active:scale-95"
                  >
                    Itinéraire
                  </Link>
                  <button
                    type="button"
                    onClick={() => handleDeleteHike(activeHike.id)}
                    className="w-8 h-8 rounded-full bg-[#1C2620]/[0.06] hover:bg-[#E76F51]/30 border border-[#1C2620]/[0.08] text-[#1C2620]/70 hover:text-[#1C2620] text-xs transition-colors"
                    title="Supprimer cette sortie"
                    aria-label="Supprimer cette sortie"
                  >
                    🗑️
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-4 gap-2 shrink-0 mt-3">
                <div className="p-2.5 rounded-xl bg-white/40 border border-[#1C2620]/[0.07]">
                  <span className="block text-lg font-bold font-mono text-[#1C2620] leading-none">{activeHike.distanceKm}<span className="text-xs text-[#1C2620]/70 font-normal"> km</span></span>
                  <span className="block text-xs text-[#1C2620]/70 mt-1">Distance</span>
                </div>
                <div className="p-2.5 rounded-xl bg-white/40 border border-[#1C2620]/[0.07]">
                  <span className="block text-lg font-bold font-mono text-[#1C2620] leading-none">+{activeHike.elevationGain || 0}<span className="text-xs text-[#1C2620]/70 font-normal"> m</span></span>
                  <span className="block text-xs text-[#1C2620]/70 mt-1">Dénivelé D+</span>
                </div>
                <div className="p-2.5 rounded-xl bg-white/40 border border-[#1C2620]/[0.07]">
                  <span className="block text-lg font-bold font-mono text-[#1C2620] leading-none">{activeHike.isOvernight ? `${(activeHike.nightsCount || 1) + 1}` : '1'}<span className="text-xs text-[#1C2620]/70 font-normal"> j</span></span>
                  <span className="block text-xs text-[#1C2620]/70 mt-1">Durée</span>
                </div>
                <div className="p-2.5 rounded-xl bg-white/40 border border-[#1C2620]/[0.07]">
                  <span className="block text-xs font-bold text-[#8C6A1A] truncate leading-none">{formatWeather(activeHike)}</span>
                  <span className="block text-xs text-[#1C2620]/70 mt-1">Météo {formatTemp(activeHike)}</span>
                </div>
              </div>

              <div className="flex-1 min-h-0 overflow-y-auto scrollbar-none mt-3 space-y-3 pr-0.5">
                <div className="p-3 rounded-2xl bg-[#1C2620]/[0.04] border border-[#1C2620]/[0.08] space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-mono uppercase text-[#2D5A3D] font-bold">Kit pour ce départ</span>
                    <select
                      value={activeHike.assignedKitId || ''}
                      onChange={(e) => handleAssignKitToHike(activeHike.id, e.target.value)}
                      className="px-2.5 py-1 rounded-lg bg-white border border-[#1C2620]/[0.14] text-xs text-[#1C2620] focus:outline-none focus:border-[#2D5A3D] cursor-pointer"
                    >
                      {kits.length === 0 && <option value="">Aucun kit</option>}
                      {kits.map((k) => (
                        <option key={k.id} value={k.id}>
                          {k.name} ({formatWeight(k.total_weight_g || 0)})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-[#1C2620]/80">Prêt : <strong className="text-[#1C2620]">{hikeReadiness.ownedCount}/{hikeReadiness.totalCount} articles</strong></span>
                      <span className="font-mono font-bold text-[#2D5A3D]">{hikeReadiness.readinessPct}%</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-[#1C2620]/[0.07] overflow-hidden">
                      <div className="h-full bg-[#2D5A3D] rounded-full transition-all duration-500" style={{ width: `${hikeReadiness.readinessPct}%` }} />
                    </div>
                  </div>
                </div>

                {departurePlan && (
                  <div className="p-3 rounded-2xl bg-[#2D5A3D]/[0.08] border border-[#2D5A3D]/25 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <span className="text-xs font-mono uppercase text-[#2D5A3D] font-bold block">Kit recommandé pour cette sortie</span>
                        {recommendedKit ? (
                          <p className="text-xs text-[#1C2620]/90 font-semibold truncate mt-0.5">
                            {recommendedKit.name} · score {departurePlan.suitabilityScore}/100
                          </p>
                        ) : (
                          <p className="text-xs text-[#1C2620]/70 mt-0.5">Kit auto-généré à partir de votre inventaire</p>
                        )}
                      </div>
                      {recommendedKit && recommendedKit.id !== activeKit?.id && (
                        <button
                          type="button"
                          onClick={() => handleAssignKitToHike(activeHike.id, recommendedKit.id)}
                          className="px-3 py-1.5 rounded-full bg-[#2D5A3D] hover:bg-[#235030] text-white text-xs font-bold transition-all active:scale-95 shrink-0"
                        >
                          Utiliser ce kit
                        </button>
                      )}
                      {recommendedKit && recommendedKit.id === activeKit?.id && (
                        <span className="px-2.5 py-1 rounded-full bg-[#1C2620]/[0.07] border border-[#1C2620]/[0.11] text-xs text-[#1C2620]/80 shrink-0">✓ Déjà sélectionné</span>
                      )}
                    </div>
                    {(departurePlan.consumables.waterLiters > 0 || departurePlan.consumables.foodMealsCount > 0) && (
                      <div className="flex flex-wrap gap-1.5 pt-1">
                        <span className="px-2 py-1 rounded-lg bg-white/50 text-xs text-[#1C2620]/85">
                          💧 {departurePlan.consumables.waterLiters.toFixed(1).replace('.', ',')} L d&apos;eau
                        </span>
                        {departurePlan.consumables.foodMealsCount > 0 && (
                          <span className="px-2 py-1 rounded-lg bg-white/50 text-xs text-[#1C2620]/85">
                            🍽️ {departurePlan.consumables.foodMealsCount} repas
                          </span>
                        )}
                        <span className="px-2 py-1 rounded-lg bg-white/50 text-xs text-[#1C2620]/85">
                          🥨 {departurePlan.consumables.snacksCount} en-cas
                        </span>
                        {departurePlan.consumables.fuelGrams > 0 && (
                          <span className="px-2 py-1 rounded-lg bg-white/50 text-xs text-[#1C2620]/85">
                            🔥 {departurePlan.consumables.fuelGrams} g gaz
                          </span>
                        )}
                        <span className="px-2 py-1 rounded-lg bg-white/50 text-xs text-[#8C6A1A]">
                          {departurePlan.weatherSummary.advice}
                        </span>
                      </div>
                    )}
                  </div>
                )}

                {hikeReadiness.missingItems.length > 0 && (
                  <div className="p-2.5 rounded-xl bg-[#E76F51]/12 border border-[#E76F51]/30 space-y-1.5">
                    <span className="text-xs font-bold text-[#C0532E] block">Articles manquants à emporter :</span>
                    <div className="flex flex-wrap gap-1.5">
                      {hikeReadiness.missingItems.slice(0, 3).map((m) => (
                        <div key={m.id} className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-white/50 text-xs text-[#1C2620]">
                          <span>{m.item_name}</span>
                          <button
                            type="button"
                            onClick={() => {
                              addToEquipment({
                                name: m.item_name,
                                category: m.category || 'Autre',
                                weight_g: m.weight_g || 100,
                              });
                              showToast(`🎒 ${m.item_name} ajouté à votre inventaire`, 'success');
                            }}
                            className="text-[#2D5A3D] font-bold hover:underline"
                          >
                            + Ajouter
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="pt-2 border-t border-[#1C2620]/[0.07]">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs font-bold uppercase text-[#1C2620]/60 font-mono">Toutes les sorties ({plannedHikes.length})</span>
                    <button
                      type="button"
                      onClick={() => setIsNewHikeModalOpen(true)}
                      className="text-xs font-bold text-[#2D5A3D] hover:underline"
                    >
                      + Planifier
                    </button>
                  </div>
                  <div className="flex gap-2 overflow-x-auto scrollbar-none pb-1">
                    {plannedHikes.map((h) => (
                      <button
                        key={h.id}
                        type="button"
                        onClick={() => handleSelectHike(h)}
                        className={`px-2.5 py-1 rounded-xl text-left border shrink-0 transition-all ${
                          h.id === activeHike.id
                            ? 'bg-[#1C2620]/[0.08] border-[#2D5A3D]/50 text-[#1C2620] font-bold'
                            : 'bg-[#1C2620]/[0.04] border-[#1C2620]/[0.07] text-[#1C2620]/70 hover:bg-[#1C2620]/[0.07]'
                        }`}
                      >
                        <span className="block text-xs truncate max-w-[120px]">{h.name}</span>
                        <span className="text-xs text-[#2D5A3D] font-mono">
                          {daysUntil(h.targetDate) !== null ? `J-${daysUntil(h.targetDate)}` : 'Date à définir'}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div className="h-full flex flex-col items-center justify-center gap-3 text-center">
              <span className="text-3xl block">🧭</span>
              <p className="text-xs text-[#1C2620]/80 font-medium">Aucune sortie planifiée pour le moment</p>
              <button
                type="button"
                onClick={() => setIsNewHikeModalOpen(true)}
                className="px-5 py-2 rounded-full bg-[#2D5A3D] hover:bg-[#235030] text-white font-bold text-xs transition-all active:scale-95"
              >
                🧭 Planifier ma première sortie
              </button>
            </div>
          )
        );

      case 'condition': {
        const ready = conditionStats
          .filter((s) => ['neuf', 'excellent', 'bon'].includes(s.key))
          .reduce((n, s) => n + s.count, 0);
        const readyPct = equipment.length > 0 ? Math.round((ready / equipment.length) * 100) : 0;
        return widgetShell(
          'condition',
          <IconActivity />,
          'État du matériel',
          `${equipment.length} articles suivis`,
          'inventaire',
          <>
            <div className="flex items-end justify-between gap-3 shrink-0">
              <div>
                <div className="text-4xl font-extrabold font-mono leading-none text-[#1C2620]">{readyPct}%</div>
                <p className="text-xs text-[#1C2620]/70 mt-2">{ready}/{equipment.length} articles en bon état</p>
              </div>
              <IconActivity />
            </div>
            <div className="flex-1 min-h-0 overflow-y-auto scrollbar-none mt-3 space-y-2 pr-0.5">
              {conditionStats.length === 0 ? (
                <p className="text-xs text-[#1C2620]/70 text-center py-3">Aucun article inventorié</p>
              ) : (
                conditionStats.map((s) => {
                  const meta = CONDITION_META[s.key] || { label: s.key, color: '#2D5A3D', bg: 'rgba(45,90,61,0.08)' };
                  const active = conditionFilter === s.key;
                  const pct = totalWeightG > 0 ? Math.round((s.weight / totalWeightG) * 100) : 0;
                  return (
                    <button
                      key={s.key}
                      type="button"
                      onClick={() => {
                        triggerHaptic('light');
                        setConditionFilter(active ? 'all' : s.key);
                      }}
                      title={active ? 'Retirer le filtre' : `Filtrer par état : ${meta.label}`}
                      className={`w-full text-left p-2 rounded-xl border transition-all ${
                        active
                          ? 'bg-[#1C2620]/[0.09] border-[#2D5A3D]/50 ring-1 ring-[#2D5A3D]/30'
                          : 'bg-white/40 hover:bg-[#1C2620]/[0.06] border-[#1C2620]/[0.07]'
                      }`}
                    >
                      <div className="flex items-center justify-between text-xs text-[#1C2620]/80 mb-1">
                        <span className="font-semibold capitalize truncate">{meta.label}</span>
                        <span className="shrink-0 pl-2">
                          <span className="font-mono text-[#1C2620] font-bold">{s.count}</span>
                          <span className="text-[#1C2620]/40"> · </span>
                          <span className="font-mono" style={{ color: meta.color }}>{formatWeight(s.weight)}</span>
                        </span>
                      </div>
                      <div className="h-1.5 rounded-full bg-[#1C2620]/[0.07] overflow-hidden">
                        <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, backgroundColor: meta.color }} />
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </>
        );
      }

      case 'copilot':
        return widgetShell(
          'copilot',
          <span className={aiStreaming ? 'animate-pulse' : ''}><IconSparkle /></span>,
          'Copilote IA Équipement',
          aiStreaming
            ? 'Analyse en cours…'
            : aiMode === 'live'
            ? 'IA en ligne'
            : aiMode === 'local'
            ? 'Mode dégradé · analyse locale'
            : 'Prêt à répondre',
          'inventaire',
          <>
            <div ref={aiScrollRef} className="flex-1 min-h-0 overflow-y-auto scrollbar-none space-y-2 pr-0.5 text-xs">
              {aiResponse ? (
                <div className="p-3 rounded-2xl bg-[#1C2620]/[0.04]0 border border-[#1C2620]/[0.08] shadow-inner">
                  <p className="text-[#1C2620]/90 leading-relaxed whitespace-pre-wrap">{aiResponse}{aiStreaming && <span className="inline-block w-1.5 h-3 ml-0.5 bg-[#2D5A3D] animate-pulse align-middle" />}</p>
                </div>
              ) : aiError ? (
                <div className="p-2.5 rounded-xl bg-[#E76F51]/12 border border-[#E76F51]/30 text-xs text-[#C0532E]">{aiError}</div>
              ) : (
                <div className="space-y-1.5">
                  {['Optimise un pack bivouac sous 8 kg', 'Quel matériel alléger en priorité ?'].map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => runAi(s)}
                      className="w-full text-left p-2 rounded-xl bg-white/40 hover:bg-[#1C2620]/[0.06] border border-[#1C2620]/[0.07] text-xs text-[#1C2620]/90 transition-all active:scale-[0.98]"
                    >
                      ✦ {s}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <form
              onSubmit={(e) => { e.preventDefault(); runAi(aiInput); setAiInput(''); }}
              className="flex items-center gap-1.5 rounded-xl bg-white/50 border border-[#1C2620]/[0.09] px-2 py-1.5 shrink-0 mt-3"
            >
              <input
                value={aiInput}
                onChange={(e) => setAiInput(e.target.value)}
                placeholder="Question au copilote…"
                className="flex-1 bg-transparent text-xs text-[#1C2620] placeholder-[#1C2620]/40 focus:outline-none"
                aria-label="Question IA"
              />
              <button
                type="submit"
                disabled={aiStreaming || !aiInput.trim()}
                className="w-6 h-6 rounded-full bg-[#2D5A3D] text-white flex items-center justify-center text-xs font-bold disabled:opacity-40 transition-all active:scale-90"
                aria-label="Envoyer"
              >
                ↑
              </button>
            </form>
          </>
        );

      case 'alerts': {
        const critical = alerts.filter((a) => a.kind === 'replace' || a.kind === 'expiry').length;
        return widgetShell(
          'alerts',
          <IconBell />,
          'Alertes & entretien',
          alerts.length > 0 ? `${critical} action(s) critique(s)` : 'Tout est en ordre',
          'prets',
          <>
            <div className="flex items-end justify-between gap-3 shrink-0">
              <div>
                <div className={`text-4xl font-extrabold font-mono leading-none ${alerts.length > 0 ? 'text-[#8C6A1A] drop-shadow-[0_0_14px_rgba(233,196,106,0.5)]' : 'text-[#2D5A3D]'}`}>
                  {alerts.length}
                </div>
                <p className="text-xs text-[#1C2620]/70 mt-2">{alerts.length === 0 ? 'Tout est en ordre' : 'Alertes actives'}</p>
              </div>
            </div>
            <div className="flex-1 min-h-0 overflow-y-auto scrollbar-none mt-3 space-y-1.5 pr-0.5">
              {alerts.length === 0 ? (
                <p className="text-xs text-[#1C2620]/70 text-center py-4">Aucune alerte — tout est en ordre ✨</p>
              ) : (
                alerts.slice(0, 6).map((a) => (
                  <button
                    key={a.id}
                    type="button"
                    onClick={() => { setSelectedItemId(a.itemId); setIsDetailDrawerOpen(true); triggerHaptic('light'); }}
                    className="w-full text-left p-2 rounded-xl bg-white/40 hover:bg-[#1C2620]/[0.06] border border-[#1C2620]/[0.07] text-xs text-[#1C2620]/85 flex items-center justify-between gap-1.5 transition-colors"
                  >
                    <span className="truncate">{a.label}</span>
                    <span className="text-xs text-[#2D5A3D] font-bold shrink-0">Voir ➔</span>
                  </button>
                ))
              )}
            </div>
          </>
        );
      }

      case 'kits':
        return widgetShell(
          'kits',
          <IconBackpack />,
          'Kits & sacs',
          `${kits.length} kit${kits.length > 1 ? 's' : ''} assemblés`,
          'actions',
          <>
            <div className="flex items-end justify-between gap-3 shrink-0">
              <div>
                <div className="text-4xl font-extrabold font-mono leading-none text-[#1C2620]">{kits.length}</div>
                <p className="text-xs text-[#1C2620]/70 mt-2">Poids total {formatWeight(kits.reduce((s, k) => s + (k.total_weight_g || 0), 0))}</p>
              </div>
              <button
                type="button"
                onClick={handleCreateNewKit}
                className="px-3 py-1.5 rounded-full bg-[#2D5A3D]/20 hover:bg-[#2D5A3D]/30 border border-[#2D5A3D]/40 text-[#2D5A3D] text-xs font-bold transition-all active:scale-95 shrink-0"
              >
                + Nouveau
              </button>
            </div>
            <div className="flex-1 min-h-0 overflow-y-auto scrollbar-none mt-3 space-y-2 pr-0.5">
              {kits.length === 0 ? (
                <p className="text-xs text-[#1C2620]/70 text-center py-4">Aucun kit actif. Créez votre premier kit.</p>
              ) : (
                kits.map((kit) => (
                  <div
                    key={kit.id}
                    onClick={() => {
                      setSelectedKitForCockpit(kit);
                      setIsKitDrawerOpen(true);
                      triggerHaptic('light');
                    }}
                    className="p-2.5 rounded-xl bg-white/40 hover:bg-[#1C2620]/[0.06] border border-[#1C2620]/[0.07] transition-all cursor-pointer flex items-center justify-between gap-2"
                  >
                    <div className="min-w-0">
                      <h4 className="text-xs font-bold text-[#1C2620] truncate">{kit.name}</h4>
                      <p className="text-xs text-[#1C2620]/60 truncate">{kit.items?.length || 0} articles · {kit.season || '3 saisons'}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <span className="text-xs font-mono font-bold text-[#2D5A3D] block">{formatWeight(kit.total_weight_g || 0)}</span>
                      <span className="text-xs text-[#1C2620]/50">Éditer ➔</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </>
        );

      default:
        return null;
    }
  };

  const renderWidgetFrame = (id: string) => {
    return (
      <div
        key={id}
        className={`${WIDGET_SPAN[id] || 'col-span-2 lg:col-span-1'} min-h-0 ${dragWidget === id ? 'opacity-50' : ''} ${dragOverId === id ? 'ring-2 ring-[#2D5A3D]/70 ring-inset rounded-[28px]' : ''} transition-opacity`}
        onDragOver={(e) => {
          if (dragWidget && dragWidget !== id) {
            e.preventDefault();
            setDragOverId(id);
          }
        }}
        onDragLeave={() => setDragOverId((cur) => (cur === id ? null : cur))}
        onDrop={() => handleDropOn(id)}
      >
        <GlassCard className="h-full">{renderWidget(id)}</GlassCard>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 w-full bg-[#F5F3EE] text-[#1C2620] select-none font-sans flex flex-col overflow-hidden">
      <Header />
      <div className="h-full w-full flex flex-col pt-20 sm:pt-[88px] overflow-y-auto lg:overflow-hidden">
      <style>{`
        @keyframes fadeInUp { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: none; } }
        .scrollbar-none::-webkit-scrollbar { display: none; }
        .scrollbar-none { -ms-overflow-style: none; scrollbar-width: none; }
        @media (prefers-reduced-motion: reduce) { * { animation: none !important; transition: none !important; } }
        html, body { overflow: hidden !important; }
      `}</style>

      {/* ═══ BACKGROUND — photo « urban vintage » voilée de verre clair (thème papier LKDV) ═══ */}
      <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden bg-[#F5F3EE]">
        <Image
          src="/assets/images/urban-vintage.jpg"
          alt=""
          fill
          priority
          sizes="100vw"
          className="object-cover object-center"
          style={{ filter: 'blur(12px) saturate(1.08) brightness(1.06)', opacity: 0.05 }}
        />
        <div className="absolute inset-0 bg-gradient-to-b from-[#F5F3EE]/90 via-[#FBFAF6]/80 to-[#F5F3EE]/92" />
        <div
          className="absolute inset-0"
          style={{ background: 'radial-gradient(ellipse at 50% 18%, rgba(255,255,255,0.4) 0%, transparent 62%)' }}
        />
      </div>

      {/* ═══ FLOATING TOAST NOTIFICATION ═══ */}
      {toastMessage && (
        <div
          role="status"
          aria-live="polite"
          className="fixed top-24 left-1/2 -translate-x-1/2 z-[1200] px-4 py-2 rounded-full border border-[#2D5A3D]/30 bg-white/95 text-[#1C2620] text-xs font-semibold backdrop-blur-xl shadow-[0_10px_30px_rgba(11,31,23,0.18),inset_0_1px_0_0_rgba(255,255,255,0.9)] flex items-center gap-2 animate-[fadeInUp_0.25s_ease_both]"
        >
          <span className="w-2 h-2 rounded-full bg-[#2D5A3D] animate-pulse" />
          <span>{toastMessage.text}</span>
        </div>
      )}

      {/* ═══ MAIN COCKPIT — 6 MODULES POLESTAR (Sans Sidebar, Sans Scroll) ═══ */}
      <h1 className="sr-only">Cockpit Mon Équipement</h1>
      <main className="relative z-10 w-full max-w-[1800px] mx-auto flex-1 min-h-0 px-3 pb-20 lg:pb-14 flex flex-col gap-2.5 overflow-y-auto lg:overflow-hidden">

        {/* Barre d'état du cockpit */}
        <div className="flex items-center justify-between gap-2 shrink-0 px-1">
          <span className="text-xs font-mono uppercase tracking-widest text-[#1C2620]/60">Cockpit · 6 modules</span>
          <button
            type="button"
            onClick={() => { setVoirToutTab('inventaire'); setVoirToutOpen(true); triggerHaptic('light'); }}
            className="text-xs font-bold text-[#2D5A3D] hover:text-[#1C2620] px-3 py-1.5 rounded-full bg-white/60 hover:bg-[#1C2620]/[0.09] border border-[#1C2620]/[0.09] transition-all active:scale-95"
          >
            Tout voir ▸
          </button>
        </div>

        {/* Grille des 6 modules — Rang 1 [Poids|Départ|État] · Rang 2 [IA|Alertes|Kits] */}
        <div
          className="min-h-0 grid grid-cols-2 grid-flow-dense gap-3 items-stretch lg:grid-cols-4 lg:auto-rows-fr lg:flex-1 lg:min-h-0"
          onDragOver={(e) => e.preventDefault()}
        >
          {widgetOrder.map((id) => renderWidgetFrame(id))}
        </div>
      </main>
      </div>

      {/* ═══ DRAWER « TOUT VOIR » — fonctionnalités reléguées ═══ */}
      {voirToutOpen && (
        <div className="fixed inset-0 z-[1040]" role="dialog" aria-modal="true" aria-label="Tout voir">
          <div className="absolute inset-0 bg-[#1C2620]/55 backdrop-blur-sm" onClick={() => setVoirToutOpen(false)} />
          <div className="absolute right-0 top-0 h-full w-full max-w-md bg-[#FBFAF6]/95 backdrop-blur-2xl border-l border-[#1C2620]/[0.1] shadow-2xl flex flex-col animate-[fadeInUp_0.2s_ease_both]">
            <div className="flex items-center justify-between p-4 border-b border-[#1C2620]/[0.08] shrink-0">
              <h2 className="text-sm font-extrabold uppercase tracking-wider text-[#1C2620]">Tout voir</h2>
              <button
                type="button"
                onClick={() => setVoirToutOpen(false)}
                className="w-8 h-8 rounded-full bg-[#1C2620]/[0.07] hover:bg-white/20 flex items-center justify-center text-sm text-[#1C2620]"
                aria-label="Fermer"
              >
                ✕
              </button>
            </div>

            <div className="flex gap-1 p-2 border-b border-[#1C2620]/[0.08] shrink-0">
              {([['inventaire', 'Inventaire'], ['prets', 'Prêts & Alertes'], ['reglages', 'Réglages'], ['actions', 'Actions']] as const).map(([tab, label]) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => { setVoirToutTab(tab); triggerHaptic('light'); }}
                  className={`px-3 py-1.5 rounded-full text-xs font-bold transition-colors ${
                    voirToutTab === tab
                      ? 'bg-[#2D5A3D] text-white'
                      : 'bg-white/60 hover:bg-[#1C2620]/[0.09] text-[#1C2620]/80 border border-[#1C2620]/[0.08]'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto scrollbar-none p-4 space-y-4">
              {voirToutTab === 'inventaire' && (
                <div className="space-y-3">
                  <section className="rounded-2xl bg-white/40 border border-[#1C2620]/[0.07] p-3 space-y-1.5">
                    <h3 className="text-xs font-extrabold uppercase tracking-wider text-[#1C2620]">Répartition par catégorie</h3>
                    {categoryStats.map((c) => (
                      <div key={c.label} className="flex items-center justify-between text-xs text-[#1C2620]/80">
                        <span className="capitalize truncate">{c.label}</span>
                        <span className="font-mono text-[#2D5A3D]">{formatWeight(c.grams)} ({c.pct}%)</span>
                      </div>
                    ))}
                  </section>

                  <section className="rounded-2xl bg-white/40 border border-[#1C2620]/[0.07] p-3 space-y-2">
                    <div className="flex items-baseline justify-between gap-2">
                      <h3 className="text-xs font-extrabold uppercase tracking-wider text-[#1C2620]">Inventaire matériel</h3>
                      <span className="text-xs text-[#1C2620]/70 shrink-0">{filteredEquipment.length} articles · {formatWeight(totalWeightG)}</span>
                    </div>

                    <div className="relative flex items-center">
                      <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" className="absolute left-3 text-[#1C2620]/50"><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" /></svg>
                      <input
                        ref={searchInputRef}
                        type="text"
                        placeholder="Rechercher équipement…  ( / )"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-9 pr-7 py-1.5 bg-white/50 rounded-xl border border-[#1C2620]/[0.09] text-xs text-[#1C2620] placeholder-[#1C2620]/50 focus:outline-none focus:border-[#2D5A3D]/60 focus:ring-1 focus:ring-[#2D5A3D]/40 transition-colors"
                      />
                      {searchQuery && (
                        <button type="button" onClick={() => setSearchQuery('')} className="absolute right-2.5 text-[#1C2620]/50 hover:text-[#1C2620] text-xs" aria-label="Effacer">✕</button>
                      )}
                    </div>

                    <div className="flex gap-1.5 overflow-x-auto scrollbar-none text-xs">
                      {CATEGORIES.map((cat) => (
                        <button
                          key={cat}
                          type="button"
                          onClick={() => { triggerHaptic('light'); setActiveCategory(cat); }}
                          className={`px-3 py-1 rounded-full capitalize whitespace-nowrap transition-colors ${
                            activeCategory === cat
                              ? 'bg-[#2D5A3D] text-white font-bold'
                              : 'bg-[#1C2620]/[0.06] text-[#1C2620]/75 hover:bg-white/14 hover:text-[#1C2620] border border-[#1C2620]/[0.08]'
                          }`}
                        >
                          {cat === 'all' ? 'Tous' : cat}
                        </button>
                      ))}
                    </div>

                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <div className="flex items-center gap-1 overflow-x-auto scrollbar-none">
                        <span className="text-xs text-[#1C2620]/50 font-mono uppercase shrink-0">Marque :</span>
                        {availableBrands.slice(0, 5).map((b) => (
                          <button
                            key={b}
                            type="button"
                            onClick={() => { triggerHaptic('light'); setSelectedBrand(b); }}
                            className={`px-2 py-0.5 rounded-lg whitespace-nowrap transition-colors ${
                              selectedBrand === b
                                ? 'bg-[#2D5A3D]/25 text-[#2D5A3D] font-bold border border-[#2D5A3D]/50'
                                : 'bg-[#1C2620]/[0.04] text-[#1C2620]/60 hover:text-[#1C2620] border border-[#1C2620]/[0.08]'
                            }`}
                          >
                            {b}
                          </button>
                        ))}
                      </div>
                      <button
                        type="button"
                        onClick={() => { triggerHaptic('light'); setOnlyFavorites((f) => !f); }}
                        className={`px-2 py-1 rounded-lg font-bold transition-colors shrink-0 flex items-center gap-1 ${
                          onlyFavorites
                            ? 'bg-[#E76F51]/25 text-[#C0532E] border border-[#E76F51]/40'
                            : 'bg-[#1C2620]/[0.04] text-[#1C2620]/60 hover:text-[#1C2620]'
                        }`}
                        title="Filtrer uniquement les favoris"
                      >
                        <span>{onlyFavorites ? '❤️' : '🤍'}</span>
                        <span>Favoris ({favoritesCount})</span>
                      </button>
                    </div>

                    {conditionFilter !== 'all' && (
                      <button
                        type="button"
                        onClick={() => { setConditionFilter('all'); triggerHaptic('light'); }}
                        className="w-full px-2.5 py-1.5 rounded-xl bg-[#E9A23B]/15 border border-[#E9A23B]/40 text-[#8C6A1A] text-xs font-semibold flex items-center justify-between transition-all hover:bg-[#E9A23B]/25"
                      >
                        <span>Filtre actif : {CONDITION_META[conditionFilter]?.label || conditionFilter}</span>
                        <span>✕ Réinitialiser</span>
                      </button>
                    )}

                    {selectedIds.size > 0 && (
                      <div className="flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-xl bg-[#2D5A3D]/15 border border-[#2D5A3D]/30">
                        <span className="text-xs text-[#1C2620]/90 font-medium">{selectedIds.size} sélectionné(s)</span>
                        <div className="flex items-center gap-1.5">
                          <button type="button" onClick={bulkDelete} className="px-2.5 py-1 rounded-lg bg-[#E76F51]/25 hover:bg-[#E76F51]/35 text-[#C0532E] text-xs font-semibold transition-all">Supprimer</button>
                          <button type="button" onClick={clearSelection} className="px-2 py-1 rounded-lg bg-[#1C2620]/[0.06] hover:bg-white/14 text-[#1C2620]/80 text-xs">Annuler</button>
                        </div>
                      </div>
                    )}

                    <div className="space-y-2">
                      {isLoading && equipment.length === 0 ? (
                        <div className="space-y-2">
                          {[...Array(4)].map((_, n) => (
                            <div key={n} className="p-3 rounded-2xl bg-[#1C2620]/[0.04] animate-pulse flex items-center gap-3">
                              <div className="w-10 h-10 rounded-xl bg-[#1C2620]/[0.07] shrink-0" />
                              <div className="flex-1 space-y-1.5">
                                <div className="w-3/4 h-3 rounded bg-[#1C2620]/[0.1]" />
                                <div className="w-1/2 h-2.5 rounded bg-[#1C2620]/[0.07]" />
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : filteredEquipment.length === 0 ? (
                        <div className="p-4 rounded-2xl bg-[#1C2620]/[0.04] text-center space-y-2 border border-[#1C2620]/[0.08]">
                          <span className="text-2xl block">🧭</span>
                          <p className="text-xs text-[#1C2620]/75 font-medium">Aucun équipement trouvé</p>
                          <button
                            type="button"
                            onClick={handleResetFilters}
                            className="px-3.5 py-1.5 rounded-full bg-[#1C2620]/[0.08] hover:bg-white/20 text-[#1C2620] text-xs font-semibold transition-all"
                          >
                            Réinitialiser les filtres
                          </button>
                        </div>
                      ) : (
                        filteredEquipment.map((item, i) => {
                          const isSelected = item.id === (activeItem?.id || selectedItemId);
                          const isChecked = selectedIds.has(item.id);
                          const inCompare = compareIds.includes(item.id);
                          const editing = inlineEditId === item.id;
                          return (
                            <div
                              key={item.id}
                              onClick={() => { triggerHaptic('light'); setSelectedItemId(item.id); setIsDetailDrawerOpen(true); }}
                              style={prefersReducedMotion ? undefined : { animationDelay: `${Math.min(i, 12) * 25}ms` }}
                              className={`${enterAnim} p-2.5 rounded-2xl border transition-all cursor-pointer flex items-center gap-2.5 relative group ${
                                isSelected
                                  ? 'bg-[#1C2620]/[0.09] border-[#2D5A3D]/50 ring-1 ring-[#2D5A3D]/30 shadow-md'
                                  : 'bg-white/40 border-[#1C2620]/[0.07] hover:bg-[#2D5A3D]/[0.08] hover:border-[#1C2620]/[0.11]'
                              }`}
                            >
                              {isSelected && (
                                <div className="absolute -left-1 top-1/2 -translate-y-1/2 w-1.5 h-6 rounded-full bg-[#2D5A3D] shadow-[0_0_10px_rgba(45,90,61,0.4)]" />
                              )}
                              <button
                                type="button"
                                onClick={(e) => toggleSelected(item.id, e)}
                                aria-label={isChecked ? 'Désélectionner' : 'Sélectionner'}
                                className={`w-4 h-4 rounded-md border shrink-0 flex items-center justify-center transition-all ${
                                  isChecked ? 'bg-[#2D5A3D] border-[#2D5A3D] text-white' : 'border-[#1C2620]/[0.3] text-transparent hover:border-[#1C2620]/60'
                                }`}
                              >
                                <svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" strokeWidth="3"><path d="M5 12l5 5L20 7" /></svg>
                              </button>
                              <div className="w-10 h-10 rounded-xl bg-white/50 overflow-hidden relative shrink-0 border border-[#1C2620]/[0.08] flex items-center justify-center p-1 shadow-inner">
                                <Image src={item.image || '/assets/images/no_image.png'} alt={item.name} width={36} height={36} className="object-contain max-h-full max-w-full" />
                              </div>
                              <div className="min-w-0 flex-1">
                                <h4 className="text-xs font-bold text-[#1C2620] truncate leading-tight">{item.name}</h4>
                                {editing ? (
                                  <div className="flex items-center gap-1 mt-1" onClick={(e) => e.stopPropagation()}>
                                    <input value={inlineWeight} onChange={(e) => setInlineWeight(e.target.value)} inputMode="numeric" className="w-12 px-1.5 py-0.5 rounded bg-white/60 border border-[#1C2620]/[0.14] text-xs text-[#1C2620] text-center focus:outline-none focus:border-[#2D5A3D]" aria-label="Poids en grammes" />
                                    <span className="text-xs text-[#1C2620]/50">g</span>
                                    <input value={inlineQty} onChange={(e) => setInlineQty(e.target.value)} inputMode="numeric" className="w-8 px-1 py-0.5 rounded bg-white/60 border border-[#1C2620]/[0.14] text-xs text-[#1C2620] text-center focus:outline-none focus:border-[#2D5A3D]" aria-label="Quantité" />
                                    <button type="button" onClick={() => saveInlineEdit(item)} className="px-1.5 py-0.5 rounded bg-[#2D5A3D] text-white text-xs font-bold">OK</button>
                                    <button type="button" onClick={() => setInlineEditId(null)} className="px-1 py-0.5 rounded bg-[#1C2620]/[0.07] text-[#1C2620]/70 text-xs">✕</button>
                                  </div>
                                ) : (
                                  <div className="flex items-center gap-1.5 text-xs text-[#1C2620]/60 mt-0.5 truncate">
                                    <span>{item.brand || 'Outdoor'}</span>
                                    <span>·</span>
                                    <button type="button" onClick={(e) => startInlineEdit(item, e)} className="font-mono text-[#2D5A3D] font-bold hover:underline" title="Cliquer pour éditer le poids">
                                      {formatWeight(item.weight_g || 0)}{(item.quantity || 1) > 1 ? ` ×${item.quantity}` : ''}
                                    </button>
                                    {item.loan_status === 'prêté' && (
                                      <span className="px-1 py-0.5 rounded bg-[#1C2620]/[0.07] text-xs text-[#1C2620]/80 border border-[#1C2620]/[0.11]">Prêté</span>
                                    )}
                                  </div>
                                )}
                              </div>
                              <div className="flex items-center gap-1 shrink-0">
                                <button
                                  type="button"
                                  onClick={(e) => { e.stopPropagation(); toggleCompare(item.id); }}
                                  className={`p-1 rounded-md transition-colors ${inCompare ? 'text-[#2D5A3D]' : 'text-[#1C2620]/35 hover:text-[#1C2620]/80'}`}
                                  title="Comparer"
                                  aria-label="Comparer"
                                >
                                  <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 7h6v10H4zM14 7h6v10h-6z"/></svg>
                                </button>
                                <button
                                  type="button"
                                  onClick={(e) => { e.stopPropagation(); setSelectedItemId(item.id); setIsDetailDrawerOpen(true); }}
                                  className="text-[#1C2620]/40 hover:text-[#2D5A3D] p-1 transition-colors"
                                  title="Fiche détaillée"
                                  aria-label="Ouvrir la fiche"
                                >
                                  <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2">
                                    <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6M15 3h6v6M10 14L21 3" />
                                  </svg>
                                </button>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={() => { setEditingItem(null); setIsAddModalOpen(true); triggerHaptic('light'); }}
                      className="w-full mt-1 py-2 rounded-xl border border-dashed border-[#1C2620]/[0.14] hover:border-[#2D5A3D] bg-white/30 hover:bg-[#2D5A3D]/[0.08] text-[#1C2620]/80 hover:text-[#2D5A3D] text-xs font-bold flex items-center justify-center gap-1.5 transition-all active:scale-[0.98]"
                    >
                      <span>+</span> Ajouter un article à l&apos;inventaire
                    </button>
                  </section>

                  {compareItems.length === 2 && (
                    <section className="rounded-2xl bg-gradient-to-r from-white/[0.08] to-black/30 border border-[#1C2620]/[0.08] p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-[#1C2620] uppercase tracking-wider">Comparateur 2 Articles ⚖️</span>
                        <button type="button" onClick={() => setCompareIds([])} className="text-[#1C2620]/50 hover:text-[#1C2620] text-xs">Fermer ✕</button>
                      </div>
                      <div className="grid grid-cols-2 gap-3 text-xs">
                        {compareItems.map((it) => (
                          <div key={it.id} className="p-2.5 rounded-xl bg-white/50 border border-[#1C2620]/[0.08]">
                            <p className="font-bold text-[#1C2620] truncate">{it.name}</p>
                            <p className="text-[#1C2620]/70 mt-1">Poids : <span className="font-mono text-[#2D5A3D] font-bold">{formatWeight(it.weight_g || 0)}</span></p>
                            <p className="text-[#1C2620]/70">Prix : <span className="font-mono text-[#1C2620]">{it.purchase_price ? `${it.purchase_price} €` : '—'}</span></p>
                            <p className="text-[#1C2620]/70 capitalize">État : {CONDITION_META[it.condition || 'bon']?.label || it.condition || '—'}</p>
                          </div>
                        ))}
                      </div>
                    </section>
                  )}
                </div>
              )}

              {voirToutTab === 'prets' && (
                <div className="space-y-4">
                  <section>
                    <h3 className="text-xs font-extrabold uppercase tracking-wider text-[#1C2620] mb-2">Alertes ({alerts.length})</h3>
                    {alerts.length === 0 ? (
                      <p className="text-xs text-[#1C2620]/70 text-center py-4 rounded-2xl bg-white/40 border border-[#1C2620]/[0.07]">Aucune alerte — tout est en ordre ✨</p>
                    ) : (
                      <div className="space-y-1.5">
                        {alerts.map((a) => (
                          <button
                            key={a.id}
                            type="button"
                            onClick={() => { setVoirToutOpen(false); setSelectedItemId(a.itemId); setIsDetailDrawerOpen(true); triggerHaptic('light'); }}
                            className="w-full text-left p-2 rounded-xl bg-white/40 hover:bg-[#1C2620]/[0.06] border border-[#1C2620]/[0.07] text-xs text-[#1C2620]/85 flex items-center justify-between gap-1.5 transition-colors"
                          >
                            <span className="truncate">{a.label}</span>
                            <span className="text-xs text-[#2D5A3D] font-bold shrink-0">Voir ➔</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </section>

                  <section className="pt-2 border-t border-[#1C2620]/[0.08]">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="text-xs font-extrabold uppercase tracking-wider text-[#1C2620]">Prêts ({loanedItems.length})</h3>
                      {trashCount > 0 && (
                        <button
                          type="button"
                          onClick={() => { setVoirToutOpen(false); setIsTrashModalOpen(true); }}
                          className="text-xs font-bold text-[#1C2620]/60 hover:text-[#C0532E] underline"
                          title="Voir la corbeille des kits"
                        >
                          Corbeille ({trashCount})
                        </button>
                      )}
                    </div>
                    {loanedItems.length === 0 ? (
                      <p className="text-xs text-[#1C2620]/70 text-center py-4 rounded-2xl bg-white/40 border border-[#1C2620]/[0.07]">Aucun matériel actuellement prêté 🤝</p>
                    ) : (
                      <div className="space-y-1.5">
                        {loanedItems.map((item) => (
                          <div key={item.id} className="p-2 rounded-xl bg-white/40 border border-[#1C2620]/[0.07] text-xs flex items-center justify-between gap-2">
                            <div className="min-w-0">
                              <p className="text-[#1C2620]/90 font-semibold truncate">{item.name}</p>
                              <p className="text-xs text-[#1C2620]/60 truncate">Prêté à {item.loan_to_name || 'un ami'}</p>
                            </div>
                            <button
                              type="button"
                              onClick={() => handleMarkReturned(item)}
                              className="px-2.5 py-1 rounded-lg bg-[#2D5A3D]/20 hover:bg-[#2D5A3D]/30 border border-[#2D5A3D]/40 text-[#2D5A3D] text-xs font-bold shrink-0 transition-all active:scale-95"
                            >
                              Rendu ✓
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </section>
                </div>
              )}

              {voirToutTab === 'reglages' && (
                <div className="space-y-5">
                  <section>
                    <h3 className="text-xs font-extrabold uppercase tracking-wider text-[#1C2620] mb-2">Objectif de poids du sac</h3>
                    <div className="grid grid-cols-4 gap-2">
                      {[5, 6, 8, 10, 12, 14, 16, 20].map((t) => (
                        <button
                          key={t}
                          type="button"
                          onClick={() => { setTargetKg(t); triggerHaptic('light'); showToast(`Objectif ajusté à ${t} kg`, 'info'); }}
                          className={`py-2 rounded-xl text-center font-mono font-bold text-xs transition-all active:scale-95 ${
                            targetKg === t
                              ? 'bg-[#2D5A3D] text-white shadow-sm'
                              : 'bg-[#1C2620]/[0.06] hover:bg-white/14 text-[#1C2620]/80 border border-[#1C2620]/[0.08]'
                          }`}
                        >
                          {t} kg
                        </button>
                      ))}
                    </div>
                  </section>

                  <section className="pt-2 border-t border-[#1C2620]/[0.08]">
                    <h3 className="text-xs font-extrabold uppercase tracking-wider text-[#1C2620] mb-2">Disposition des modules</h3>
                    <div className="space-y-2">
                      {widgetOrder.map((id, i) => (
                        <div key={id} className="flex items-center justify-between gap-2 p-2 rounded-xl bg-white/40 border border-[#1C2620]/[0.07]">
                          <span className="text-xs text-[#1C2620]/90 capitalize">{WIDGET_LABEL[id] || id}</span>
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => moveWidget(id, -1)}
                              disabled={i === 0}
                              className="w-7 h-7 rounded-lg bg-white/60 hover:bg-[#1C2620]/[0.09] border border-[#1C2620]/[0.08] text-[#1C2620] text-xs disabled:opacity-30 disabled:pointer-events-none transition-colors"
                              aria-label={`Déplacer ${WIDGET_LABEL[id]} vers le haut`}
                            >
                              ▲
                            </button>
                            <button
                              type="button"
                              onClick={() => moveWidget(id, 1)}
                              disabled={i === widgetOrder.length - 1}
                              className="w-7 h-7 rounded-lg bg-white/60 hover:bg-[#1C2620]/[0.09] border border-[#1C2620]/[0.08] text-[#1C2620] text-xs disabled:opacity-30 disabled:pointer-events-none transition-colors"
                              aria-label={`Déplacer ${WIDGET_LABEL[id]} vers le bas`}
                            >
                              ▼
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                    <button
                      type="button"
                      onClick={resetWidgetOrder}
                      className="mt-2 w-full py-2 rounded-xl bg-white/60 hover:bg-[#1C2620]/[0.09] border border-[#1C2620]/[0.09] text-[#1C2620]/90 text-xs font-semibold transition-colors"
                    >
                      ↺ Réinitialiser la disposition
                    </button>
                  </section>

                  <section className="pt-2 border-t border-[#1C2620]/[0.08]">
                    <h3 className="text-xs font-extrabold uppercase tracking-wider text-[#1C2620] mb-2">Général</h3>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => { handleResetFilters(); showToast('Filtres réinitialisés', 'info'); }}
                        className="py-2.5 px-3 rounded-xl bg-[#1C2620]/[0.06] hover:bg-white/14 border border-[#1C2620]/[0.08] text-[#1C2620]/90 text-xs font-semibold text-left transition-colors flex items-center gap-1.5"
                      >
                        <span>🔄</span> Réinitialiser filtres
                      </button>
                      <Link
                        href="/compte"
                        onClick={() => setVoirToutOpen(false)}
                        className="py-2.5 px-3 rounded-xl bg-[#1C2620]/[0.06] hover:bg-white/14 border border-[#1C2620]/[0.08] text-[#1C2620]/90 text-xs font-semibold text-left transition-colors flex items-center gap-1.5"
                      >
                        <span>👤</span> Mon Profil LKDV
                      </Link>
                    </div>
                  </section>
                </div>
              )}

              {voirToutTab === 'actions' && (
                <div className="space-y-4">
                  <section>
                    <h3 className="text-xs font-extrabold uppercase tracking-wider text-[#1C2620] mb-2">Navigation</h3>
                    <div className="grid grid-cols-2 gap-2">
                      <Link
                        href="/explorer"
                        onClick={() => setVoirToutOpen(false)}
                        className="p-2.5 rounded-xl bg-white/40 hover:bg-[#1C2620]/[0.06] border border-[#1C2620]/[0.07] text-xs text-[#1C2620]/90 flex flex-col gap-0.5 transition-all active:scale-[0.98]"
                      >
                        <span>🗺️</span>
                        <span className="font-bold">Explorer</span>
                        <span className="text-xs text-[#1C2620]/60">Trouver des randonnées</span>
                      </Link>
                      <Link
                        href="/ai-configurator"
                        onClick={() => setVoirToutOpen(false)}
                        className="p-2.5 rounded-xl bg-white/40 hover:bg-[#1C2620]/[0.06] border border-[#1C2620]/[0.07] text-xs text-[#1C2620]/90 flex flex-col gap-0.5 transition-all active:scale-[0.98]"
                      >
                        <span>✨</span>
                        <span className="font-bold">Configurateur IA</span>
                        <span className="text-xs text-[#1C2620]/60">Générer un kit</span>
                      </Link>
                      <Link
                        href="/rapport-kit"
                        onClick={() => setVoirToutOpen(false)}
                        className="p-2.5 rounded-xl bg-white/40 hover:bg-[#1C2620]/[0.06] border border-[#1C2620]/[0.07] text-xs text-[#1C2620]/90 flex flex-col gap-0.5 transition-all active:scale-[0.98]"
                      >
                        <span>📦</span>
                        <span className="font-bold">Rapport Kit</span>
                        <span className="text-xs text-[#1C2620]/60">Évaluer son sac</span>
                      </Link>
                      <Link
                        href="/jumeau-3d"
                        onClick={() => setVoirToutOpen(false)}
                        className="p-2.5 rounded-xl bg-white/40 hover:bg-[#1C2620]/[0.06] border border-[#1C2620]/[0.07] text-xs text-[#1C2620]/90 flex flex-col gap-0.5 transition-all active:scale-[0.98]"
                      >
                        <span>🧊</span>
                        <span className="font-bold">Jumeau 3D</span>
                        <span className="text-xs text-[#1C2620]/60">Vue du sac</span>
                      </Link>
                    </div>
                  </section>

                  <section className="pt-2 border-t border-[#1C2620]/[0.08] space-y-2">
                    <h3 className="text-xs font-extrabold uppercase tracking-wider text-[#1C2620]">Actions rapides</h3>
                    <button
                      type="button"
                      onClick={() => { setVoirToutOpen(false); setEditingItem(null); setIsAddModalOpen(true); }}
                      className="w-full py-2.5 px-3 rounded-xl bg-white/60 hover:bg-[#1C2620]/[0.09] border border-[#1C2620]/[0.09] text-[#1C2620]/90 text-xs font-semibold text-left flex items-center gap-2 transition-colors"
                    >
                      <span>➕</span> Ajouter un article à l&apos;inventaire
                    </button>
                    <button
                      type="button"
                      onClick={() => { setVoirToutOpen(false); setIsNewHikeModalOpen(true); }}
                      className="w-full py-2.5 px-3 rounded-xl bg-white/60 hover:bg-[#1C2620]/[0.09] border border-[#1C2620]/[0.09] text-[#1C2620]/90 text-xs font-semibold text-left flex items-center gap-2 transition-colors"
                    >
                      <span>🧭</span> Planifier une nouvelle sortie
                    </button>
                    <button
                      type="button"
                      onClick={() => { setVoirToutOpen(false); handleCreateNewKit(); }}
                      className="w-full py-2.5 px-3 rounded-xl bg-white/60 hover:bg-[#1C2620]/[0.09] border border-[#1C2620]/[0.09] text-[#1C2620]/90 text-xs font-semibold text-left flex items-center gap-2 transition-colors"
                    >
                      <span>🎒</span> Créer un nouveau kit
                    </button>
                  </section>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ═══ MODALS & DRAWERS ═══ */}
      <GearDetailDrawer
        isOpen={isDetailDrawerOpen}
        item={activeItem}
        onClose={() => setIsDetailDrawerOpen(false)}
        onEdit={(item) => { setIsDetailDrawerOpen(false); setEditingItem(item); setIsAddModalOpen(true); }}
        onDelete={async (id) => {
          await removeFromEquipment(id);
          setIsDetailDrawerOpen(false);
          showToast('Article supprimé de l\'inventaire', 'info');
        }}
        onUpdateNotes={async (gearId, notes) => {
          await updateEquipment(gearId, { notes });
          showToast('Notes enregistrées avec succès', 'success');
        }}
        onAddToKit={(_item) => {
          setIsDetailDrawerOpen(false);
          setIsKitDrawerOpen(true);
        }}
        onLend={() => { setIsDetailDrawerOpen(false); setIsLendModalOpen(true); }}
        onToggleFavorite={() => { if (activeItem) handleToggleFavorite(activeItem); }}
        onAddToCart={(p) => {
          addToCart({
            id: p.id || 'prod',
            slug: p.slug || 'equipement',
            name: p.name || 'Équipement',
            brand: p.brand || 'LKDV',
            priceEur: p.price_eur || p.priceEur || 99,
            weightG: p.weight_g || p.weightG || 100,
            image: p.image || '/assets/images/no_image.png',
            imageAlt: p.name || 'Équipement',
            category: p.category || 'équipement',
          });
          showToast(`🛒 ${p.name || 'Article'} ajouté au panier !`, 'success');
        }}
      />

      <AddEditGearModal
        isOpen={isAddModalOpen}
        initialItem={
          editingItem
            ? {
                id: editingItem.id,
                name: editingItem.name,
                brand: editingItem.brand || undefined,
                category: editingItem.category,
                weight_g: editingItem.weight_g,
                weight: editingItem.weight_g,
                count: editingItem.quantity || 1,
                quantity: editingItem.quantity || 1,
                condition: editingItem.condition as any,
                image: editingItem.image || undefined,
                purchase_price: editingItem.purchase_price || undefined,
                purchase_date: editingItem.purchase_date || undefined,
                is_favorite: editingItem.is_favorite,
                is_rented: false,
                notes: editingItem.notes || undefined,
              }
            : null
        }
        onClose={() => { setIsAddModalOpen(false); setEditingItem(null); }}
        onSave={async (itemData) => {
          if (editingItem && editingItem.id) {
            await updateEquipment(editingItem.id, {
              name: itemData.name,
              brand: itemData.brand,
              category: itemData.category,
              weight_g: itemData.weight_g,
              condition: itemData.condition as any,
              notes: itemData.notes,
              image: itemData.image,
              purchase_price: itemData.purchase_price,
            });
            showToast(`« ${itemData.name} » mis à jour`, 'success');
          } else {
            await addToEquipment(
              {
                name: itemData.name || 'Nouvel équipement',
                category: itemData.category || 'autre',
                weight_g: itemData.weight_g || 100,
                brand: itemData.brand || undefined,
                image: itemData.image || undefined,
              },
              {
                condition: (itemData.condition as any) || 'excellent',
                notes: itemData.notes || undefined,
                purchase_price: itemData.purchase_price || undefined,
              }
            );
            showToast(`« ${itemData.name || 'Nouvel article'} » ajouté à votre inventaire`, 'success');
          }
          setIsAddModalOpen(false);
          setEditingItem(null);
        }}
      />

      <KitCockpitDrawer
        isOpen={isKitDrawerOpen}
        kit={selectedKitForCockpit || activeKit || kits[0] || null}
        userEquipment={equipment}
        onClose={() => { setIsKitDrawerOpen(false); setSelectedKitForCockpit(null); }}
        onSelectForDeparture={(kit) => {
          setSelectedKitForCockpit(kit);
          if (activeHike) handleAssignKitToHike(activeHike.id, kit.id);
          setIsKitDrawerOpen(false);
          showToast(`🚀 Kit « ${kit.name} » sélectionné pour le départ`, 'success');
        }}
        onUpdateKit={async (kitId, patch) => {
          await updateKit(kitId, patch);
          showToast('Kit mis à jour', 'success');
        }}
        onDeleteKit={async (kitId) => {
          await moveToTrash(kitId);
          setIsKitDrawerOpen(false);
          setSelectedKitForCockpit(null);
          showToast('Kit déplacé dans la corbeille', 'info');
        }}
        onAddGearToInventory={async (product) => {
          await addToEquipment({
            name: product.name,
            brand: product.brand,
            category: product.category || 'Autre',
            weight_g: product.weight_g || 100,
            image: product.image,
          });
          showToast(`🎒 ${product.name} ajouté à votre inventaire`, 'success');
        }}
        onAddToCart={(p) => {
          addToCart({
            id: p.id || 'prod',
            slug: p.slug || 'equipement',
            name: p.name || 'Équipement',
            brand: p.brand || 'LKDV',
            priceEur: p.price_eur || p.priceEur || 99,
            weightG: p.weight_g || p.weightG || 100,
            image: p.image || '/assets/images/no_image.png',
            imageAlt: p.name || 'Équipement',
            category: p.category || 'équipement',
          });
          showToast(`🛒 ${p.name || 'Article'} ajouté au panier !`, 'success');
        }}
      />

      <LendItemModal
        isOpen={isLendModalOpen}
        item={activeItem}
        onClose={() => setIsLendModalOpen(false)}
        onSaveLoan={async (borrowerName, _returnDate, notes) => {
          if (activeItem) {
            await updateEquipment(activeItem.id, {
              loan_status: 'prêté',
              loan_to_name: borrowerName,
              notes: notes || activeItem.notes,
            });
            showToast(`🤝 Matériel prêté à ${borrowerName}`, 'success');
          }
          setIsLendModalOpen(false);
        }}
      />

      {/* ═══ NEW HIKE MODAL ═══ */}
      {isNewHikeModalOpen && (
        <div className="fixed inset-0 z-[1100] flex items-center justify-center p-4 bg-[#1C2620]/55 backdrop-blur-md animate-[fadeInUp_0.2s_ease_both]">
          <div className="relative w-full max-w-md rounded-[28px] border border-[#1C2620]/[0.11] bg-[#FBFAF6]/97 backdrop-blur-2xl p-6 text-[#1C2620] shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-[#1C2620]/[0.08] pb-3">
              <h3 className="text-sm font-extrabold text-[#1C2620] uppercase tracking-wider">Planifier une nouvelle sortie</h3>
              <button
                type="button"
                onClick={() => setIsNewHikeModalOpen(false)}
                className="w-7 h-7 rounded-full bg-[#1C2620]/[0.07] hover:bg-white/20 flex items-center justify-center text-xs text-[#1C2620]"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateHike} className="space-y-3 text-xs">
              <div>
                <label className="text-xs text-[#1C2620]/70 block mb-1">Nom de la randonnée / trek *</label>
                <input
                  required
                  value={newHikeName}
                  onChange={(e) => setNewHikeName(e.target.value)}
                  placeholder="Ex. Tour du Mont Blanc, GR20 Sud…"
                  className="w-full px-3 py-2 rounded-xl bg-white/50 border border-[#1C2620]/[0.11] text-[#1C2620] focus:outline-none focus:border-[#2D5A3D]"
                />
              </div>
              <div>
                <label className="text-xs text-[#1C2620]/70 block mb-1">Massif / Destination</label>
                <input
                  value={newHikeDest}
                  onChange={(e) => setNewHikeDest(e.target.value)}
                  placeholder="Ex. Massif des Écrins, Vercors…"
                  className="w-full px-3 py-2 rounded-xl bg-white/50 border border-[#1C2620]/[0.11] text-[#1C2620] focus:outline-none focus:border-[#2D5A3D]"
                />
              </div>
              <div>
                <label className="text-xs text-[#1C2620]/70 block mb-1">Compagnons (optionnel)</label>
                <input
                  value={newHikeCompanions}
                  onChange={(e) => setNewHikeCompanions(e.target.value)}
                  placeholder="Ex. Léna & Antoine"
                  className="w-full px-3 py-2 rounded-xl bg-white/50 border border-[#1C2620]/[0.11] text-[#1C2620] focus:outline-none focus:border-[#2D5A3D]"
                />
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="text-xs text-[#1C2620]/70 block mb-1">Durée (jours)</label>
                  <input
                    type="number"
                    min="1"
                    value={newHikeDays}
                    onChange={(e) => setNewHikeDays(Number(e.target.value))}
                    className="w-full px-2 py-1.5 rounded-xl bg-white/50 border border-[#1C2620]/[0.11] text-[#1C2620] text-center focus:outline-none focus:border-[#2D5A3D]"
                  />
                </div>
                <div>
                  <label className="text-xs text-[#1C2620]/70 block mb-1">Distance (km)</label>
                  <input
                    type="number"
                    min="1"
                    value={newHikeKm}
                    onChange={(e) => setNewHikeKm(Number(e.target.value))}
                    className="w-full px-2 py-1.5 rounded-xl bg-white/50 border border-[#1C2620]/[0.11] text-[#1C2620] text-center focus:outline-none focus:border-[#2D5A3D]"
                  />
                </div>
                <div>
                  <label className="text-xs text-[#1C2620]/70 block mb-1">D+ (mètres)</label>
                  <input
                    type="number"
                    min="0"
                    value={newHikeDPlus}
                    onChange={(e) => setNewHikeDPlus(Number(e.target.value))}
                    className="w-full px-2 py-1.5 rounded-xl bg-white/50 border border-[#1C2620]/[0.11] text-[#1C2620] text-center focus:outline-none focus:border-[#2D5A3D]"
                  />
                </div>
              </div>

              <div className="pt-3 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsNewHikeModalOpen(false)}
                  className="px-4 py-2 rounded-full bg-[#1C2620]/[0.07] text-[#1C2620] text-xs font-semibold"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-full bg-[#2D5A3D] text-white font-bold text-xs hover:bg-[#235030]"
                >
                  Enregistrer la sortie
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ═══ KIT TRASH MODAL ═══ */}
      {isTrashModalOpen && (
        <div className="fixed inset-0 z-[1100] flex items-center justify-center p-4 bg-[#1C2620]/55 backdrop-blur-md animate-[fadeInUp_0.2s_ease_both]">
          <div className="relative w-full max-w-md rounded-[28px] border border-[#1C2620]/[0.11] bg-[#FBFAF6]/97 backdrop-blur-2xl p-6 text-[#1C2620] shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-[#1C2620]/[0.08] pb-3">
              <h3 className="text-sm font-extrabold text-[#1C2620] uppercase tracking-wider">Corbeille des kits ({trashCount})</h3>
              <button
                type="button"
                onClick={() => setIsTrashModalOpen(false)}
                className="w-7 h-7 rounded-full bg-[#1C2620]/[0.07] hover:bg-white/20 flex items-center justify-center text-xs text-[#1C2620]"
                aria-label="Fermer"
              >
                ✕
              </button>
            </div>

            <div className="space-y-2 max-h-[60vh] overflow-y-auto scrollbar-none pr-0.5">
              {trashKits.length === 0 && (
                <p className="text-xs text-[#1C2620]/50 text-center py-6">Corbeille vide</p>
              )}
              {trashKits.map((kit) => (
                <div key={kit.id} className="p-3 rounded-xl bg-white/40 border border-[#1C2620]/[0.07] flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-[#1C2620] truncate">{kit.name}</p>
                    <p className="text-xs text-[#1C2620]/45">
                      Supprimé {kit.deleted_at ? new Date(kit.deleted_at).toLocaleDateString('fr-FR') : ''}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={async () => {
                        triggerHaptic('light');
                        await restoreFromTrash(kit.id);
                        showToast(`Kit « ${kit.name} » restauré`, 'success');
                      }}
                      className="px-2.5 py-1 rounded-lg bg-[#2D5A3D]/20 hover:bg-[#2D5A3D]/30 border border-[#2D5A3D]/40 text-[#2D5A3D] text-xs font-bold transition-all active:scale-95"
                    >
                      Restaurer
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (window.confirm(`Supprimer définitivement le kit « ${kit.name} » ?`)) {
                          permanentDelete(kit.id);
                          showToast('Kit supprimé définitivement', 'info');
                        }
                      }}
                      className="px-2.5 py-1 rounded-lg bg-[#E76F51]/20 hover:bg-[#E76F51]/30 border border-[#E76F51]/40 text-[#C0532E] text-xs font-bold transition-all active:scale-95"
                    >
                      Suppr.
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
