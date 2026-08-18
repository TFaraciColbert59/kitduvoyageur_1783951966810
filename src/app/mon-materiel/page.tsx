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
  neuf: { label: 'Neuf', color: '#A3C4A3', bg: 'rgba(163,196,163,0.16)' },
  excellent: { label: 'Excellent', color: '#7FBE7F', bg: 'rgba(127,190,127,0.16)' },
  bon: { label: 'Bon', color: '#E9C46A', bg: 'rgba(233,196,106,0.16)' },
  moyen: { label: 'Moyen', color: '#E9A23B', bg: 'rgba(233,162,59,0.22)' },
  usé: { label: 'Usé', color: '#E76F51', bg: 'rgba(231,111,81,0.22)' },
  à_réparer: { label: 'À réparer', color: '#E76F51', bg: 'rgba(231,111,81,0.22)' },
  à_remplacer: { label: 'À remplacer', color: '#C24E3D', bg: 'rgba(194,78,61,0.26)' },
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
// Reusable Liquid Glass card (visionOS style)
// ─────────────────────────────────────────────────────────────
function GlassCard({
  children,
  className = '',
  ...rest
}: React.HTMLAttributes<HTMLDivElement> & { className?: string }) {
  return (
    <div
      className={`relative rounded-[28px] overflow-hidden border border-white/12 bg-white/[0.06] backdrop-blur-2xl backdrop-saturate-150 shadow-[0_20px_60px_-15px_rgba(11,31,23,0.6),inset_0_1px_0_0_rgba(255,255,255,0.18)] ${className}`}
      {...rest}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-24 opacity-70"
        style={{ background: 'linear-gradient(180deg, rgba(255,255,255,0.14) 0%, transparent 100%)' }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 rounded-[28px]"
        style={{
          padding: 1,
          background: 'linear-gradient(140deg, rgba(255,255,255,0.35), rgba(255,255,255,0.04) 40%, transparent 70%)',
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
  const color = ratio <= 0.85 ? '#A3C4A3' : ratio <= 1 ? '#E9C46A' : '#E76F51';
  return (
    <div className="relative w-[84px] h-[84px] shrink-0">
      <svg viewBox="0 0 84 84" className="w-full h-full -rotate-90">
        <circle cx="42" cy="42" r={r} fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="6" />
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
        <span className="text-[8px] text-white/50 font-mono">/ {targetKg} kg</span>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Main Page Component — Dashboard Cockpit Sans Sidebar
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

  const refreshHikes = useCallback(() => {
    setPlannedHikes(getPlannedHikes());
  }, []);

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
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [isNewHikeModalOpen, setIsNewHikeModalOpen] = useState(false);
  const [isTrashModalOpen, setIsTrashModalOpen] = useState(false);

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
  const handleToggleFavorite = async (item: UserEquipmentItem, e?: React.MouseEvent) => {
    e?.stopPropagation();
    triggerHaptic('light');
    const nextState = !item.is_favorite;
    await updateEquipment(item.id, { is_favorite: nextState });
    showToast(nextState ? `❤️ ${item.name} ajouté aux favoris` : `Retiré des favoris`, 'info');
  };

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

  return (
    <div className="fixed inset-0 w-full bg-[#0B1F17] text-white select-none font-sans flex flex-col overflow-hidden">
      <Header />
      <div className="h-full w-full flex flex-col pt-20 sm:pt-[88px] overflow-y-auto lg:overflow-hidden">
      <style>{`
        @keyframes fadeInUp { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: none; } }
        .scrollbar-none::-webkit-scrollbar { display: none; }
        .scrollbar-none { -ms-overflow-style: none; scrollbar-width: none; }
        @media (prefers-reduced-motion: reduce) { * { animation: none !important; transition: none !important; } }
        html, body { overflow: hidden !important; }
      `}</style>

      {/* ═══ BACKGROUND — alpine trek landscape ═══ */}
      <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden">
        <Image
          src="/assets/images/hero-misty.jpg"
          alt="Paysage de montagne — trek alpin"
          fill
          priority
          sizes="100vw"
          className={`object-cover object-center scale-[1.15] ${prefersReducedMotion ? '' : 'motion-safe:animate-[fadeInUp_1.2s_ease_both]'}`}
          style={{ filter: 'blur(32px) saturate(1.15)' }}
        />
        <div className="absolute inset-0 bg-gradient-to-b from-[#0B1F17]/75 via-[#0B1F17]/60 to-[#0B1F17]/88" />
        <div
          className="absolute inset-0"
          style={{ background: 'radial-gradient(ellipse at 50% 25%, transparent 20%, rgba(11,31,23,0.92) 100%)' }}
        />
      </div>

      {/* ═══ FLOATING TOAST NOTIFICATION ═══ */}
      {toastMessage && (
        <div
          role="status"
          aria-live="polite"
          className="fixed top-24 left-1/2 -translate-x-1/2 z-[100] px-4 py-2 rounded-full border border-[#A3C4A3]/50 bg-[#0B1F17]/90 text-white text-xs font-semibold backdrop-blur-xl shadow-[0_10px_30px_rgba(0,0,0,0.6),0_0_20px_rgba(163,196,163,0.3)] flex items-center gap-2 animate-[fadeInUp_0.25s_ease_both]"
        >
          <span className="w-2 h-2 rounded-full bg-[#A3C4A3] animate-pulse" />
          <span>{toastMessage.text}</span>
        </div>
      )}

      {/* ═══ COCKPIT SUB-HEADER / SUMMARY HUD BAR ═══ */}
      <div className="relative z-10 w-full shrink-0 px-3 pb-2">
        <div className="flex flex-wrap items-center justify-between gap-2 p-2.5 rounded-[20px] border border-white/12 bg-white/[0.06] backdrop-blur-xl shadow-lg">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-white/10 border border-white/15 flex items-center justify-center shadow-inner shrink-0">
              <svg viewBox="0 0 32 32" width="16" height="16" fill="none">
                <path d="M2 24 L10 10 L14 16 L20 6 L30 24 Z" stroke="#A3C4A3" strokeWidth="2.2" strokeLinejoin="round" />
                <path d="M2 24 L30 24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-extrabold text-sm sm:text-base text-white tracking-tight">Cockpit Mon Équipement</h1>
                <span className="px-2 py-0.5 rounded-full bg-[#A3C4A3]/20 text-[#A3C4A3] text-[10px] font-mono font-bold">
                  v4 fullscreen
                </span>
              </div>
              <p className="text-[10px] text-white/60">
                Centre de pilotage en direct · {equipment.length} articles · {formatWeight(totalWeightG)} · {kits.length} kits · {plannedHikes.length} sorties
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => { setEditingItem(null); setIsAddModalOpen(true); triggerHaptic('light'); }}
              className="px-3 py-1.5 rounded-full bg-[#A3C4A3] hover:bg-[#b3d4b3] text-[#0B1F17] font-bold text-xs shadow-sm transition-all active:scale-95 flex items-center gap-1.5"
            >
              <span>+</span> Ajouter du matériel
            </button>
            <button
              type="button"
              onClick={() => { setIsNewHikeModalOpen(true); triggerHaptic('light'); }}
              className="px-3 py-1.5 rounded-full bg-white/10 hover:bg-white/20 text-white text-xs font-semibold border border-white/12 transition-all active:scale-95 flex items-center gap-1.5"
            >
              <span>🧭</span> Planifier sortie
            </button>
            <button
              type="button"
              onClick={() => {
                setSelectedKitForCockpit(null);
                setIsKitDrawerOpen(true);
                triggerHaptic('light');
              }}
              className="px-3 py-1.5 rounded-full bg-white/10 hover:bg-white/20 text-white text-xs font-semibold border border-white/12 transition-all active:scale-95 flex items-center gap-1.5"
            >
              <span>🧰</span> Gérer kits
            </button>
            <button
              type="button"
              onClick={() => { setIsSettingsModalOpen(true); triggerHaptic('light'); }}
              className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 border border-white/15 flex items-center justify-center text-white text-xs transition-transform active:scale-90"
              title="Réglages du Cockpit"
              aria-label="Réglages"
            >
              ⚙️
            </button>
          </div>
        </div>
      </div>

      {/* ═══ MAIN COCKPIT DASHBOARD — SANS SIDEBAR, GRID DE CARDS ═══ */}
      <main className="relative z-10 w-full max-w-[1800px] mx-auto flex-1 min-h-0 px-3 pb-20 lg:pb-14 flex flex-col lg:gap-3 overflow-hidden">

        {/* ─── RANG 1 : Inventaire · Fiche outil · Télémétrie + État du matériel ─── */}
        <div className="min-h-0 grid grid-cols-1 lg:grid-cols-12 gap-3 items-stretch lg:basis-0 lg:min-h-0 grow-[1] lg:grow-[46]">

          {/* Colonne gauche : INVENTAIRE MATÉRIEL & FILTRES */}
          <div className="lg:col-span-4 xl:col-span-4 flex flex-col gap-3 min-h-0">
            <GlassCard className="p-3 min-h-0 flex-1">
              <div className="flex items-baseline justify-between pb-2 border-b border-white/10 shrink-0">
                <div>
                  <h2 className="text-sm font-extrabold uppercase tracking-wider text-white">Inventaire Matériel</h2>
                  <p className="text-[11px] text-white/50">{filteredEquipment.length} articles affichés</p>
                </div>
                <span className="text-xs font-mono text-[#A3C4A3] font-bold">
                  {formatWeight(totalWeightG)}
                </span>
              </div>

              {/* Search + Clear */}
              <div className="relative flex items-center mt-2.5">
                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" className="absolute left-3 text-white/50">
                  <circle cx="11" cy="11" r="7" />
                  <path d="M20 20l-3.5-3.5" />
                </svg>
                <input
                  ref={searchInputRef}
                  type="text"
                  placeholder="Rechercher équipement…  ( / )"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-7 py-1.5 bg-black/30 rounded-xl border border-white/12 text-xs text-white placeholder-white/50 focus:outline-none focus:border-[#A3C4A3]/60 focus:ring-1 focus:ring-[#A3C4A3]/40 transition-colors"
                />
                {searchQuery && (
                  <button type="button" onClick={() => setSearchQuery('')} className="absolute right-2.5 text-white/50 hover:text-white text-xs" aria-label="Effacer">✕</button>
                )}
              </div>

              {/* Category Filter Pills */}
              <div className="flex gap-1.5 overflow-x-auto pb-1 mt-2 scrollbar-none text-[11px]">
                {CATEGORIES.map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => { triggerHaptic('light'); setActiveCategory(cat); }}
                    className={`px-3 py-1 rounded-full capitalize whitespace-nowrap transition-colors ${
                      activeCategory === cat
                        ? 'bg-[#A3C4A3] text-[#0B1F17] font-bold shadow-xs'
                        : 'bg-white/8 text-white/75 hover:bg-white/14 hover:text-white border border-white/10'
                    }`}
                  >
                    {cat === 'all' ? 'Tous' : cat}
                  </button>
                ))}
              </div>

              {/* Brands + Favorites + Condition filter toggle */}
              <div className="flex items-center justify-between gap-2 mt-1.5 pt-1.5 border-t border-white/8 text-[10px]">
                <div className="flex items-center gap-1 overflow-x-auto scrollbar-none">
                  <span className="text-white/40 font-mono uppercase text-[9px] shrink-0">Marque:</span>
                  {availableBrands.slice(0, 5).map((b) => (
                    <button
                      key={b}
                      type="button"
                      onClick={() => { triggerHaptic('light'); setSelectedBrand(b); }}
                      className={`px-2 py-0.5 rounded-lg whitespace-nowrap transition-colors ${
                        selectedBrand === b
                          ? 'bg-[#A3C4A3]/25 text-[#A3C4A3] font-bold border border-[#A3C4A3]/50'
                          : 'bg-white/5 text-white/60 hover:text-white border border-white/10'
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
                      ? 'bg-[#E76F51]/25 text-[#F4A18C] border border-[#E76F51]/40'
                      : 'bg-white/5 text-white/60 hover:text-white'
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
                  className="mt-2 w-full px-2.5 py-1.5 rounded-xl bg-[#E9A23B]/15 border border-[#E9A23B]/40 text-[#E9C46A] text-[11px] font-semibold flex items-center justify-between transition-all hover:bg-[#E9A23B]/25"
                >
                  <span>Filtre actif : {CONDITION_META[conditionFilter]?.label || conditionFilter}</span>
                  <span>✕ Réinitialiser</span>
                </button>
              )}

              {/* Bulk Action Bar */}
              {selectedIds.size > 0 && (
                <div className="flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-xl bg-[#A3C4A3]/15 border border-[#A3C4A3]/30 mt-2">
                  <span className="text-[11px] text-white/90 font-medium">{selectedIds.size} sélectionné(s)</span>
                  <div className="flex items-center gap-1.5">
                    <button type="button" onClick={bulkDelete} className="px-2.5 py-1 rounded-lg bg-[#E76F51]/25 hover:bg-[#E76F51]/35 text-[#F4A18C] text-[11px] font-semibold transition-all">Supprimer</button>
                    <button type="button" onClick={clearSelection} className="px-2 py-1 rounded-lg bg-white/8 hover:bg-white/14 text-white/80 text-[11px]">Annuler</button>
                  </div>
                </div>
              )}

              {/* Item list */}
              <div className="space-y-2 mt-3 flex-1 min-h-0 overflow-y-auto scrollbar-none pr-0.5">
                {isLoading && equipment.length === 0 ? (
                  <div className="space-y-2">
                    {[1, 2, 3, 4].map((n) => (
                      <div key={n} className="p-3 rounded-2xl bg-white/5 animate-pulse flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-white/10 shrink-0" />
                        <div className="flex-1 space-y-1.5">
                          <div className="w-3/4 h-3 rounded bg-white/15" />
                          <div className="w-1/2 h-2.5 rounded bg-white/10" />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : filteredEquipment.length === 0 ? (
                  <div className="p-4 rounded-2xl bg-white/5 text-center space-y-2 my-2 border border-white/10">
                    <span className="text-2xl block">🧭</span>
                    <p className="text-xs text-white/75 font-medium">Aucun équipement trouvé</p>
                    <button
                      type="button"
                      onClick={handleResetFilters}
                      className="px-3.5 py-1.5 rounded-full bg-white/12 hover:bg-white/20 text-white text-xs font-semibold transition-all"
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
                        onClick={() => { triggerHaptic('light'); setSelectedItemId(item.id); }}
                        style={prefersReducedMotion ? undefined : { animationDelay: `${Math.min(i, 12) * 25}ms` }}
                        className={`${enterAnim} p-2.5 rounded-2xl border transition-all cursor-pointer flex items-center gap-2.5 relative group ${
                          isSelected
                            ? 'bg-white/[0.12] border-[#A3C4A3]/50 ring-1 ring-[#A3C4A3]/30 shadow-md'
                            : 'bg-white/[0.04] border-white/8 hover:bg-white/[0.08] hover:border-white/15'
                        }`}
                      >
                        {isSelected && (
                          <div className="absolute -left-1 top-1/2 -translate-y-1/2 w-1.5 h-6 rounded-full bg-[#A3C4A3] shadow-[0_0_10px_rgba(163,196,163,0.8)]" />
                        )}

                        <button
                          type="button"
                          onClick={(e) => toggleSelected(item.id, e)}
                          aria-label={isChecked ? 'Désélectionner' : 'Sélectionner'}
                          className={`w-4 h-4 rounded-md border shrink-0 flex items-center justify-center transition-all ${
                            isChecked ? 'bg-[#A3C4A3] border-[#A3C4A3] text-[#0B1F17]' : 'border-white/30 text-transparent hover:border-white/60'
                          }`}
                        >
                          <svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" strokeWidth="3"><path d="M5 12l5 5L20 7" /></svg>
                        </button>

                        <div className="w-10 h-10 rounded-xl bg-black/30 overflow-hidden relative shrink-0 border border-white/10 flex items-center justify-center p-1 shadow-inner">
                          <Image src={item.image || '/assets/images/no_image.png'} alt={item.name} width={36} height={36} className="object-contain max-h-full max-w-full" />
                        </div>

                        <div className="min-w-0 flex-1">
                          <h4 className="text-xs font-bold text-white truncate leading-tight">{item.name}</h4>
                          {editing ? (
                            <div className="flex items-center gap-1 mt-1" onClick={(e) => e.stopPropagation()}>
                              <input value={inlineWeight} onChange={(e) => setInlineWeight(e.target.value)} inputMode="numeric" className="w-12 px-1.5 py-0.5 rounded bg-black/40 border border-white/20 text-[10px] text-white text-center focus:outline-none focus:border-[#A3C4A3]" aria-label="Poids en grammes" />
                              <span className="text-[9px] text-white/50">g</span>
                              <input value={inlineQty} onChange={(e) => setInlineQty(e.target.value)} inputMode="numeric" className="w-8 px-1 py-0.5 rounded bg-black/40 border border-white/20 text-[10px] text-white text-center focus:outline-none focus:border-[#A3C4A3]" aria-label="Quantité" />
                              <button type="button" onClick={() => saveInlineEdit(item)} className="px-1.5 py-0.5 rounded bg-[#A3C4A3] text-[#0B1F17] text-[9px] font-bold">OK</button>
                              <button type="button" onClick={() => setInlineEditId(null)} className="px-1 py-0.5 rounded bg-white/10 text-white/70 text-[9px]">✕</button>
                            </div>
                          ) : (
                            <div className="flex items-center gap-1.5 text-[11px] text-white/60 mt-0.5 truncate">
                              <span>{item.brand || 'Outdoor'}</span>
                              <span>·</span>
                              <button type="button" onClick={(e) => startInlineEdit(item, e)} className="font-mono text-[#A3C4A3] font-bold hover:underline" title="Cliquer pour éditer le poids">
                                {formatWeight(item.weight_g || 0)}{(item.quantity || 1) > 1 ? ` ×${item.quantity}` : ''}
                              </button>
                              {item.loan_status === 'prêté' && (
                                <span className="px-1 py-0.5 rounded bg-white/10 text-[9px] text-white/80 border border-white/15">Prêté</span>
                              )}
                            </div>
                          )}
                        </div>

                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); toggleCompare(item.id); }}
                            className={`p-1 rounded-md transition-colors ${inCompare ? 'text-[#A3C4A3]' : 'text-white/35 hover:text-white/80'}`}
                            title="Comparer"
                            aria-label="Comparer"
                          >
                            <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 7h6v10H4zM14 7h6v10h-6z"/></svg>
                          </button>
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); setSelectedItemId(item.id); setIsDetailDrawerOpen(true); }}
                            className="text-white/40 hover:text-[#A3C4A3] p-1 transition-colors"
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
                className="w-full mt-2 py-2 rounded-xl border border-dashed border-white/20 hover:border-[#A3C4A3] bg-white/[0.03] hover:bg-white/[0.08] text-white/80 hover:text-[#A3C4A3] text-xs font-bold flex items-center justify-center gap-1.5 transition-all active:scale-[0.98]"
              >
                <span>+</span> Ajouter un article à l&apos;inventaire
              </button>
            </GlassCard>
          </div>

          {/* Colonne centrale : FICHE OUTIL ACTIVE */}
          <div className="lg:col-span-5 xl:col-span-5 flex flex-col gap-3 min-h-0 lg:overflow-y-auto scrollbar-none">
            <GlassCard className="p-4 sm:p-5">
              {activeItem ? (
                <div className="space-y-3.5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 rounded-full bg-[#A3C4A3]/20 text-[#A3C4A3] text-[10px] font-bold font-mono uppercase">
                          {activeItem.category}
                        </span>
                        {activeItem.loan_status === 'prêté' && (
                          <span className="px-2 py-0.5 rounded-full bg-white/10 border border-white/15 text-[10px] text-white/80">
                            Prêté à {activeItem.loan_to_name || 'un ami'}
                          </span>
                        )}
                      </div>
                      <h2 className="text-xl font-extrabold text-white tracking-tight mt-1 truncate">{activeItem.name}</h2>
                      <p className="text-xs text-white/60">{activeItem.brand || 'Outdoor'} · Matériel certifié</p>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => setIsDetailDrawerOpen(true)}
                        className="px-3.5 py-1.5 rounded-full bg-[#A3C4A3] hover:bg-[#b3d4b3] text-[#0B1F17] font-bold text-xs transition-all shadow-sm active:scale-95"
                      >
                        Fiche ➔
                      </button>
                      <button
                        type="button"
                        onClick={(e) => handleToggleFavorite(activeItem, e)}
                        className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 border border-white/15 flex items-center justify-center text-xs text-white transition-transform active:scale-90"
                        title="Favori (f)"
                      >
                        {activeItem.is_favorite ? '❤️' : '🤍'}
                      </button>
                    </div>
                  </div>

                  {/* Hero Visual Container */}
                  <div className="relative h-24 sm:h-28 rounded-2xl bg-gradient-to-b from-white/[0.06] to-black/30 border border-white/10 overflow-hidden flex items-center justify-center p-2 group">
                    <div className="absolute inset-0 pointer-events-none" style={{ background: 'radial-gradient(circle at 30% 20%, rgba(255,255,255,0.12) 0%, transparent 60%)' }} />
                    <div className="relative z-10 w-full h-full max-h-[104px] flex items-center justify-center">
                      <Image
                        src={activeItem.image || '/assets/images/no_image.png'}
                        alt={activeItem.name}
                        width={280}
                        height={180}
                        className="object-contain max-h-full max-w-full drop-shadow-[0_15px_25px_rgba(11,31,23,0.7)] group-hover:scale-105 transition-transform duration-500"
                      />
                    </div>
                  </div>

                  {/* 7 Interactive Spec Tiles */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
                    <SpecTile
                      label="Poids pesé"
                      value={formatWeight(activeItem.weight_g || 0)}
                      accent
                      onClick={() => { setEditingItem(activeItem); setIsAddModalOpen(true); }}
                      title="Modifier le poids"
                    />
                    <SpecTile
                      label="État"
                      value={CONDITION_META[activeItem.condition || 'bon']?.label || activeItem.condition || 'Excellent'}
                      onClick={() => { setEditingItem(activeItem); setIsAddModalOpen(true); }}
                      title="Modifier l'état"
                    />
                    <SpecTile
                      label="Usure"
                      value={activeItem.wear_percentage != null ? `${activeItem.wear_percentage}%` : '—'}
                      onClick={() => { setEditingItem(activeItem); setIsAddModalOpen(true); }}
                      title="Modifier l'usure"
                    />
                    <SpecTile
                      label="Usages"
                      value={activeItem.usage_count != null ? `${activeItem.usage_count} sortie(s)` : '0 sortie'}
                      onClick={async () => {
                        triggerHaptic('light');
                        const nextCount = (activeItem.usage_count || 0) + 1;
                        await updateEquipment(activeItem.id, { usage_count: nextCount });
                        showToast(`+1 sortie enregistrée (${nextCount} au total)`, 'success');
                      }}
                      title="+1 sortie enregistrée"
                    />
                    <SpecTile
                      label="Valeur"
                      value={activeItem.purchase_price ? `${activeItem.purchase_price} €` : '—'}
                      onClick={() => { setEditingItem(activeItem); setIsAddModalOpen(true); }}
                      title="Modifier la valeur d'achat"
                    />
                    <SpecTile
                      label="Matériaux"
                      value={activeItem.materials || 'Standard'}
                      onClick={() => setIsDetailDrawerOpen(true)}
                      title="Ouvrir la fiche complète"
                    />
                    <SpecTile
                      label="Imperm."
                      value={activeItem.waterproof_rating || 'Standard'}
                      onClick={() => setIsDetailDrawerOpen(true)}
                      title="Détails imperméabilité"
                    />
                    <SpecTile
                      label="Maintenance"
                      value={activeItem.next_maintenance_date ? new Date(activeItem.next_maintenance_date).toLocaleDateString('fr-FR') : 'À planifier'}
                      onClick={() => { setEditingItem(activeItem); setIsAddModalOpen(true); }}
                      title="Planifier un entretien"
                    />
                  </div>

                  {/* Direct Action Buttons */}
                  <div className="grid grid-cols-3 gap-2 pt-1 border-t border-white/10">
                    <button
                      type="button"
                      onClick={() => { setEditingItem(activeItem); setIsAddModalOpen(true); triggerHaptic('light'); }}
                      className="py-2 rounded-xl bg-white/[0.06] hover:bg-white/[0.12] border border-white/12 text-white text-xs font-semibold flex items-center justify-center gap-1 transition-all active:scale-95"
                    >
                      ✎ Éditer
                    </button>
                    <button
                      type="button"
                      onClick={() => { setIsLendModalOpen(true); triggerHaptic('light'); }}
                      className="py-2 rounded-xl bg-white/[0.06] hover:bg-white/[0.12] border border-white/12 text-white text-xs font-semibold flex items-center justify-center gap-1 transition-all active:scale-95"
                    >
                      🤝 Prêter
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        triggerHaptic('selection');
                        addToCart({
                          id: activeItem.product_id || activeItem.id,
                          slug: 'equipement',
                          name: activeItem.name,
                          brand: activeItem.brand || 'LKDV',
                          priceEur: activeItem.purchase_price || 99,
                          weightG: activeItem.weight_g || 100,
                          image: activeItem.image || '/assets/images/no_image.png',
                          imageAlt: activeItem.name,
                          category: activeItem.category || 'équipement',
                        });
                        showToast(`🛒 ${activeItem.name} ajouté au panier !`, 'success');
                      }}
                      className="py-2 rounded-xl bg-[#A3C4A3]/20 hover:bg-[#A3C4A3]/30 border border-[#A3C4A3]/40 text-[#A3C4A3] text-xs font-bold flex items-center justify-center gap-1 transition-all active:scale-95"
                    >
                      ↻ Racheter
                    </button>
                  </div>
                </div>
              ) : (
                <div className="p-8 text-center text-white/60">Sélectionnez un équipement</div>
              )}
            </GlassCard>
          </div>

          {/* Colonne droite rang 1 : TÉLÉMÉTRIE + ÉTAT DU MATÉRIEL */}
          <div className="lg:col-span-3 xl:col-span-3 flex flex-col gap-3 min-h-0 lg:overflow-y-auto scrollbar-none">

            {/* Card Télémétrie du Pack & Jauge SVG */}
            <GlassCard className="p-4">
              <div className="flex items-center justify-between pb-2.5 border-b border-white/10">
                <h3 className="text-xs font-extrabold text-white uppercase tracking-wider">Télémétrie du pack</h3>
                <span className="text-[9px] text-[#A3C4A3] font-mono font-bold uppercase tracking-wider">Live</span>
              </div>

              <div className="flex items-center gap-3 mt-3">
                <WeightGauge currentG={totalWeightG} targetKg={targetKg} />
                <div className="flex flex-col gap-1 text-xs">
                  <span className="text-[10px] text-white/60 uppercase font-mono">Objectif cible</span>
                  <div className="flex items-center gap-1">
                    {[6, 8, 10, 12].map((t) => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => { setTargetKg(t); triggerHaptic('light'); showToast(`Objectif ajusté à ${t} kg`, 'info'); }}
                        className={`px-1.5 py-0.5 rounded text-[10px] font-mono transition-colors ${
                          targetKg === t ? 'bg-[#A3C4A3] text-[#0B1F17] font-bold' : 'bg-white/8 text-white/70 hover:bg-white/14'
                        }`}
                      >
                        {t}k
                      </button>
                    ))}
                  </div>
                  <span className="text-[11px] font-mono text-white/80 mt-0.5">Valeur : <strong className="text-white">{Math.round(totalValue)} €</strong></span>
                </div>
              </div>

              {/* Category breakdown */}
              <div className="mt-3 space-y-1.5 pt-2 border-t border-white/8">
                {categoryStats.map((c) => (
                  <button
                    key={c.label}
                    type="button"
                    onClick={() => { setActiveCategory(c.label.toLowerCase()); triggerHaptic('light'); }}
                    className="w-full text-left p-1 rounded-lg hover:bg-white/5 transition-colors cursor-pointer"
                    title={`Filtrer par ${c.label}`}
                  >
                    <div className="flex items-center justify-between text-[10px] text-white/70 mb-0.5">
                      <span className="capitalize truncate">{c.label}</span>
                      <span className="font-mono text-[#A3C4A3]">{formatWeight(c.grams)} ({c.pct}%)</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
                      <div className="h-full rounded-full bg-[#A3C4A3]" style={{ width: `${c.pct}%` }} />
                    </div>
                  </button>
                ))}
              </div>
            </GlassCard>

            {/* Card État du Matériel */}
            <GlassCard className="p-4">
              <div className="flex items-center justify-between pb-2.5 border-b border-white/10">
                <h3 className="text-xs font-extrabold text-white uppercase tracking-wider">État du matériel</h3>
                <span className="text-[9px] text-white/50 font-mono">{equipment.length} articles</span>
              </div>
              <div className="space-y-2 mt-3">
                {conditionStats.length === 0 && (
                  <p className="text-[11px] text-white/50 text-center py-3">Aucun article inventorié</p>
                )}
                {conditionStats.map((s) => {
                  const meta = CONDITION_META[s.key] || { label: s.key, color: '#A3C4A3', bg: 'rgba(163,196,163,0.16)' };
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
                          ? 'bg-white/[0.12] border-[#A3C4A3]/50 ring-1 ring-[#A3C4A3]/30'
                          : 'bg-white/[0.04] hover:bg-white/[0.09] border-white/8'
                      }`}
                    >
                      <div className="flex items-center justify-between text-[11px] text-white/80 mb-1">
                        <span className="font-semibold capitalize truncate">{meta.label}</span>
                        <span className="shrink-0 pl-2">
                          <span className="font-mono text-white font-bold">{s.count}</span>
                          <span className="text-white/40"> · </span>
                          <span className="font-mono" style={{ color: meta.color }}>{formatWeight(s.weight)}</span>
                        </span>
                      </div>
                      <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
                        <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, backgroundColor: meta.color }} />
                      </div>
                    </button>
                  );
                })}
              </div>
            </GlassCard>
          </div>
        </div>

        {/* ─── RANG 2 : Prochain départ · Kits & Alertes ─── */}
        <div className="min-h-0 grid grid-cols-1 lg:grid-cols-12 gap-3 items-stretch lg:basis-0 lg:min-h-0 grow-[1] lg:grow-[30]">

          {/* Card Prochain Départ & Randonnées Prévues + moteur intelligent */}
          <GlassCard className="lg:col-span-8 xl:col-span-8 p-4 sm:p-5 min-h-0 lg:overflow-y-auto scrollbar-none">
            {activeHike ? (
              <div className="space-y-3.5">
                <div className="flex items-start justify-between gap-3 pb-2.5 border-b border-white/10">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      {daysUntil(activeHike.targetDate) !== null && (
                        <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold font-mono ${
                          (daysUntil(activeHike.targetDate) ?? 0) < 0
                            ? 'bg-white/10 text-white/50'
                            : 'bg-[#A3C4A3]/20 text-[#A3C4A3]'
                        }`}>
                          {(daysUntil(activeHike.targetDate) ?? 0) < 0
                            ? `Terminée (J+${Math.abs(daysUntil(activeHike.targetDate) ?? 0)})`
                            : `J-${daysUntil(activeHike.targetDate)}`}
                        </span>
                      )}
                      <span className="text-xs text-white/60">{formatDateRange(activeHike)}</span>
                    </div>
                    <h3 className="text-lg font-extrabold text-white mt-1 leading-tight">{activeHike.name}</h3>
                    <p className="text-xs text-white/65">
                      {activeHike.terrain || activeHike.season || 'Randonnée'} · {activeHike.companions || `${activeHike.isOvernight ? 'Nuitée en refuge/bivouac' : 'Sortie à la journée'}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <Link
                      href={activeHike.routeId ? `/randonnee-active?routeId=${activeHike.routeId}` : '/randonnee-active'}
                      className="px-4 py-1.5 rounded-full bg-[#A3C4A3] hover:bg-[#b3d4b3] text-[#0B1F17] font-bold text-xs transition-all shadow-sm active:scale-95 flex items-center gap-1"
                    >
                      <span>🚀</span> Démarrer
                    </Link>
                    <Link
                      href={activeHike.routeId ? `/preparer-randonnee?routeId=${activeHike.routeId}` : '/explorer'}
                      className="px-3 py-1.5 rounded-full bg-white/10 hover:bg-white/20 text-white text-xs font-bold transition-all active:scale-95"
                    >
                      {activeHike.routeId ? 'Itinéraire' : 'Trouver une rando'}
                    </Link>
                    <button
                      type="button"
                      onClick={() => handleDeleteHike(activeHike.id)}
                      className="w-8 h-8 rounded-full bg-white/8 hover:bg-[#E76F51]/30 border border-white/10 text-white/70 hover:text-white text-xs transition-colors"
                      title="Supprimer cette sortie"
                      aria-label="Supprimer cette sortie"
                    >
                      🗑️
                    </button>
                  </div>
                </div>

                {/* Metrics ribbon */}
                <div className="grid grid-cols-4 gap-2">
                  <div className="p-2 rounded-xl bg-white/[0.04] border border-white/8 text-center">
                    <span className="text-sm font-bold font-mono text-[#A3C4A3]">{activeHike.distanceKm} km</span>
                    <span className="text-[9px] text-white/50 block font-mono">Distance</span>
                  </div>
                  <div className="p-2 rounded-xl bg-white/[0.04] border border-white/8 text-center">
                    <span className="text-sm font-bold font-mono text-white">+{activeHike.elevationGain || 0}m</span>
                    <span className="text-[9px] text-white/50 block font-mono">Dénivelé D+</span>
                  </div>
                  <div className="p-2 rounded-xl bg-white/[0.04] border border-white/8 text-center">
                    <span className="text-sm font-bold font-mono text-white">
                      {activeHike.isOvernight ? `${(activeHike.nightsCount || 1) + 1}j` : 'Journée'}
                    </span>
                    <span className="text-[9px] text-white/50 block font-mono">Durée</span>
                  </div>
                  <div className="p-2 rounded-xl bg-white/[0.04] border border-white/8 text-center">
                    <span className="text-xs font-bold text-[#E9C46A] truncate block">{formatWeather(activeHike)}</span>
                    <span className="text-[9px] text-white/50 block font-mono">Météo {formatTemp(activeHike)}</span>
                  </div>
                </div>

                {/* Kit Linker & Readiness */}
                <div className="p-3 rounded-2xl bg-black/25 border border-white/10 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[10px] font-mono uppercase text-[#A3C4A3] font-bold">Kit Assigné pour ce départ</span>
                    <select
                      value={activeHike.assignedKitId || ''}
                      onChange={(e) => handleAssignKitToHike(activeHike.id, e.target.value)}
                      className="px-2.5 py-1 rounded-lg bg-[#0B1F17] border border-white/20 text-xs text-white focus:outline-none focus:border-[#A3C4A3] cursor-pointer"
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
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-white/80">Matériel prêt : <strong className="text-white">{hikeReadiness.ownedCount}/{hikeReadiness.totalCount} articles</strong></span>
                      <span className="font-mono font-bold text-[#A3C4A3]">{hikeReadiness.readinessPct}%</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
                      <div className="h-full bg-[#A3C4A3] rounded-full transition-all duration-500" style={{ width: `${hikeReadiness.readinessPct}%` }} />
                    </div>
                  </div>
                </div>

                {/* Kit recommandé par le SmartDepartureEngine + consommables */}
                {departurePlan && (
                  <div className="p-3 rounded-2xl bg-[#A3C4A3]/[0.08] border border-[#A3C4A3]/25 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <span className="text-[10px] font-mono uppercase text-[#A3C4A3] font-bold block">Kit recommandé pour cette sortie</span>
                        {recommendedKit ? (
                          <p className="text-xs text-white/90 font-semibold truncate mt-0.5">
                            {recommendedKit.name} · score {departurePlan.suitabilityScore}/100
                          </p>
                        ) : (
                          <p className="text-xs text-white/70 mt-0.5">Kit auto-généré à partir de votre inventaire</p>
                        )}
                      </div>
                      {recommendedKit && recommendedKit.id !== activeKit?.id && (
                        <button
                          type="button"
                          onClick={() => handleAssignKitToHike(activeHike.id, recommendedKit.id)}
                          className="px-3 py-1.5 rounded-full bg-[#A3C4A3] hover:bg-[#b3d4b3] text-[#0B1F17] text-[11px] font-bold transition-all active:scale-95 shrink-0"
                        >
                          Utiliser ce kit
                        </button>
                      )}
                      {recommendedKit && recommendedKit.id === activeKit?.id && (
                        <span className="px-2.5 py-1 rounded-full bg-white/10 border border-white/15 text-[10px] text-white/80 shrink-0">✓ Déjà sélectionné</span>
                      )}
                    </div>

                    {/* Consommables estimés */}
                    {(departurePlan.consumables.waterLiters > 0 || departurePlan.consumables.foodMealsCount > 0) && (
                      <div className="flex flex-wrap gap-1.5 pt-1">
                        <span className="px-2 py-1 rounded-lg bg-black/30 text-[10px] text-white/85">
                          💧 {departurePlan.consumables.waterLiters.toFixed(1).replace('.', ',')} L d&apos;eau
                        </span>
                        {departurePlan.consumables.foodMealsCount > 0 && (
                          <span className="px-2 py-1 rounded-lg bg-black/30 text-[10px] text-white/85">
                            🍽️ {departurePlan.consumables.foodMealsCount} repas
                          </span>
                        )}
                        <span className="px-2 py-1 rounded-lg bg-black/30 text-[10px] text-white/85">
                          🥨 {departurePlan.consumables.snacksCount} en-cas
                        </span>
                        {departurePlan.consumables.fuelGrams > 0 && (
                          <span className="px-2 py-1 rounded-lg bg-black/30 text-[10px] text-white/85">
                            🔥 {departurePlan.consumables.fuelGrams} g gaz
                          </span>
                        )}
                        <span className="px-2 py-1 rounded-lg bg-black/30 text-[10px] text-[#E9C46A]">
                          {departurePlan.weatherSummary.advice}
                        </span>
                      </div>
                    )}
                  </div>
                )}

                {/* Missing items list */}
                {hikeReadiness.missingItems.length > 0 && (
                  <div className="p-2.5 rounded-xl bg-[#E76F51]/12 border border-[#E76F51]/30 space-y-1.5">
                    <span className="text-[11px] font-bold text-[#F4A18C] block">Articles manquants à emporter :</span>
                    <div className="flex flex-wrap gap-1.5">
                      {hikeReadiness.missingItems.slice(0, 3).map((m) => (
                        <div key={m.id} className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-black/30 text-[10px] text-white">
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
                            className="text-[#A3C4A3] font-bold hover:underline"
                          >
                            + Ajouter
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Other Hikes Selector */}
                <div className="pt-2 border-t border-white/8">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[10px] font-bold uppercase text-white/50 font-mono">Toutes les sorties ({plannedHikes.length})</span>
                    <button
                      type="button"
                      onClick={() => setIsNewHikeModalOpen(true)}
                      className="text-[10px] font-bold text-[#A3C4A3] hover:underline"
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
                            ? 'bg-white/12 border-[#A3C4A3]/50 text-white font-bold'
                            : 'bg-white/5 border-white/8 text-white/70 hover:bg-white/10'
                        }`}
                      >
                        <span className="block text-[11px] truncate max-w-[120px]">{h.name}</span>
                        <span className="text-[9px] text-[#A3C4A3] font-mono">
                          {daysUntil(h.targetDate) !== null ? `J-${daysUntil(h.targetDate)}` : 'Date à définir'}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-8 text-center space-y-3">
                <span className="text-3xl block">🧭</span>
                <p className="text-sm text-white/75 font-medium">Aucune sortie planifiée pour le moment</p>
                <p className="text-xs text-white/50">Planifiez votre prochaine randonnée pour voir ici le kit recommandé, les articles manquants et les consommables.</p>
                <button
                  type="button"
                  onClick={() => setIsNewHikeModalOpen(true)}
                  className="px-5 py-2 rounded-full bg-[#A3C4A3] hover:bg-[#b3d4b3] text-[#0B1F17] font-bold text-xs transition-all"
                >
                  🧭 Planifier ma première sortie
                </button>
              </div>
            )}
          </GlassCard>

          {/* Colonne droite rang 2 : KITS + ALERTES */}
          <div className="lg:col-span-4 xl:col-span-4 flex flex-col gap-3 min-h-0">

            {/* Card Kits Assemblés */}
            <GlassCard className="p-4">
              <div className="flex items-baseline justify-between pb-2.5 border-b border-white/10">
                <h3 className="text-xs font-extrabold text-white uppercase tracking-wider">Kits & Sacs ({kits.length})</h3>
                <div className="flex items-center gap-2">
                  {trashCount > 0 && (
                    <button
                      type="button"
                      onClick={() => setIsTrashModalOpen(true)}
                      className="text-[10px] font-bold text-white/60 hover:text-[#F4A18C] underline"
                      title="Voir la corbeille des kits"
                    >
                      Corbeille ({trashCount})
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={async () => {
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
                    }}
                    className="text-[10px] font-bold text-[#A3C4A3] hover:underline"
                  >
                    + Nouveau Kit
                  </button>
                </div>
              </div>

              <div className="space-y-2 mt-2.5 max-h-[190px] overflow-y-auto scrollbar-none pr-0.5">
                {kits.length === 0 && (
                  <p className="text-[11px] text-white/50 text-center py-4">Aucun kit actif. Créez votre premier kit ci-dessus.</p>
                )}
                {kits.map((kit) => (
                  <div
                    key={kit.id}
                    onClick={() => {
                      setSelectedKitForCockpit(kit);
                      setIsKitDrawerOpen(true);
                      triggerHaptic('light');
                    }}
                    className="p-2.5 rounded-xl bg-white/[0.04] hover:bg-white/[0.09] border border-white/8 transition-all cursor-pointer flex items-center justify-between gap-2"
                  >
                    <div className="min-w-0">
                      <h4 className="text-xs font-bold text-white truncate">{kit.name}</h4>
                      <p className="text-[10px] text-white/50 truncate">{kit.items?.length || 0} articles · {kit.season || '3 saisons'}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <span className="text-xs font-mono font-bold text-[#A3C4A3] block">{formatWeight(kit.total_weight_g || 0)}</span>
                      <span className="text-[9px] text-white/40">Éditer ➔</span>
                    </div>
                  </div>
                ))}
              </div>
            </GlassCard>

            {/* Card Alertes Opérationnelles & Prêts */}
            <GlassCard className="p-4">
              <div className="flex items-center justify-between pb-2 border-b border-white/10">
                <h3 className="text-xs font-extrabold text-white uppercase tracking-wider">Alertes & Entretien ({alerts.length})</h3>
                <span className="text-[9px] text-[#E9C46A] font-mono font-bold">Action requise</span>
              </div>
              {alerts.length === 0 ? (
                <p className="text-[11px] text-white/50 py-3 text-center">Aucune alerte — tout est en ordre ✨</p>
              ) : (
                <div className="space-y-1.5 mt-2.5 max-h-[140px] overflow-y-auto scrollbar-none pr-0.5">
                  {alerts.map((a) => (
                    <button
                      key={a.id}
                      type="button"
                      onClick={() => { setSelectedItemId(a.itemId); triggerHaptic('light'); }}
                      className="w-full text-left p-2 rounded-xl bg-white/[0.04] hover:bg-white/[0.09] border border-white/8 text-[11px] text-white/85 flex items-center justify-between gap-1.5 transition-colors"
                    >
                      <span className="truncate">{a.label}</span>
                      <span className="text-[10px] text-[#A3C4A3] font-bold shrink-0">Voir ➔</span>
                    </button>
                  ))}
                </div>
              )}
            </GlassCard>
          </div>
        </div>

        {/* Comparateur (quand 2 articles sélectionnés) */}
        {compareItems.length === 2 && (
          <GlassCard className="p-4 bg-gradient-to-r from-white/[0.08] to-black/30">
            <div className="flex items-center justify-between pb-2 border-b border-white/10">
              <span className="text-xs font-bold text-white uppercase tracking-wider">Comparateur 2 Articles ⚖️</span>
              <button type="button" onClick={() => setCompareIds([])} className="text-white/50 hover:text-white text-xs">Fermer ✕</button>
            </div>
            <div className="grid grid-cols-2 gap-3 mt-2 text-xs">
              {compareItems.map((it) => (
                <div key={it.id} className="p-2.5 rounded-xl bg-black/30 border border-white/10">
                  <p className="font-bold text-white truncate">{it.name}</p>
                  <p className="text-white/60 mt-1">Poids : <span className="font-mono text-[#A3C4A3] font-bold">{formatWeight(it.weight_g || 0)}</span></p>
                  <p className="text-white/60">Prix : <span className="font-mono text-white">{it.purchase_price ? `${it.purchase_price} €` : '—'}</span></p>
                  <p className="text-white/60 capitalize">État : {CONDITION_META[it.condition || 'bon']?.label || it.condition || '—'}</p>
                </div>
              ))}
            </div>
          </GlassCard>
        )}

        {/* ─── RANG 3 : Copilote IA · Matériel prêté · Actions rapides ─── */}
        <div className="min-h-0 grid grid-cols-1 lg:grid-cols-12 gap-3 items-stretch lg:basis-0 lg:min-h-0 grow-[1] lg:grow-[24]">

          {/* Card Copilote IA Équipement */}
          <GlassCard className="lg:col-span-8 xl:col-span-7 p-4 min-h-0 lg:overflow-y-auto scrollbar-none">
            <div className="flex items-center justify-between gap-2 pb-2 border-b border-white/10">
              <div className="flex items-center gap-2">
                <span className="text-sm">✦</span>
                <div>
                  <h3 className="text-xs font-extrabold text-white uppercase tracking-wider">Copilote IA Équipement</h3>
                  <span className="text-[9px] text-[#A3C4A3] font-mono font-bold uppercase tracking-wider">
                    {aiStreaming ? 'Analyse en cours…' : 'Prêt'}
                  </span>
                </div>
              </div>
              {aiMode === 'local' && (
                <span className="px-2 py-0.5 rounded-full bg-[#E9C46A]/15 border border-[#E9C46A]/30 text-[9px] font-mono font-bold text-[#E9C46A]">
                  Mode dégradé · analyse locale
                </span>
              )}
              {aiMode === 'live' && (
                <span className="px-2 py-0.5 rounded-full bg-[#A3C4A3]/15 border border-[#A3C4A3]/30 text-[9px] font-mono font-bold text-[#A3C4A3]">
                  IA en ligne
                </span>
              )}
            </div>

            <div ref={aiScrollRef} className="my-2.5 max-h-[170px] overflow-y-auto space-y-2 scrollbar-none pr-0.5 text-xs">
              {aiResponse ? (
                <div className="p-3 rounded-2xl bg-white/[0.05] border border-white/10 shadow-inner">
                  <p className="text-white/90 leading-relaxed whitespace-pre-wrap">{aiResponse}{aiStreaming && <span className="inline-block w-1.5 h-3 ml-0.5 bg-[#A3C4A3] animate-pulse align-middle" />}</p>
                </div>
              ) : aiError ? (
                <div className="p-2.5 rounded-xl bg-[#E76F51]/12 border border-[#E76F51]/30 text-[11px] text-[#F4A18C]">{aiError}</div>
              ) : (
                <div className="space-y-1.5">
                  {['Optimise un pack bivouac sous 8 kg', 'Quel matériel alléger en priorité ?'].map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => runAi(s)}
                      className="w-full text-left p-2 rounded-xl bg-white/[0.04] hover:bg-white/[0.09] border border-white/8 text-[11px] text-white/90 transition-all active:scale-[0.98]"
                    >
                      ✦ {s}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <form
              onSubmit={(e) => { e.preventDefault(); runAi(aiInput); setAiInput(''); }}
              className="flex items-center gap-1.5 rounded-xl bg-black/30 border border-white/12 px-2 py-1"
            >
              <input
                value={aiInput}
                onChange={(e) => setAiInput(e.target.value)}
                placeholder="Question au copilote…"
                className="flex-1 bg-transparent text-xs text-white placeholder-white/40 focus:outline-none py-1"
                aria-label="Question IA"
              />
              <button
                type="submit"
                disabled={aiStreaming || !aiInput.trim()}
                className="w-6 h-6 rounded-full bg-[#A3C4A3] text-[#0B1F17] flex items-center justify-center text-xs font-bold disabled:opacity-40 transition-all active:scale-90"
                aria-label="Envoyer"
              >
                ↑
              </button>
            </form>
          </GlassCard>

          {/* Colonne droite rang 3 : Prêts + Actions rapides */}
          <div className="lg:col-span-4 xl:col-span-5 flex flex-col gap-3 min-h-0 lg:overflow-y-auto scrollbar-none">

            {/* Card Matériel Prêté */}
            <GlassCard className="p-4">
              <div className="flex items-center justify-between pb-2 border-b border-white/10">
                <h3 className="text-xs font-extrabold text-white uppercase tracking-wider">Matériel prêté ({loanedItems.length})</h3>
                <span className="text-[9px] text-[#F4A18C] font-mono font-bold">À récupérer</span>
              </div>
              {loanedItems.length === 0 ? (
                <p className="text-[11px] text-white/50 py-3 text-center">Aucun matériel actuellement prêté 🤝</p>
              ) : (
                <div className="space-y-1.5 mt-2.5 max-h-[200px] overflow-y-auto scrollbar-none pr-0.5">
                  {loanedItems.map((item) => (
                    <div
                      key={item.id}
                      className="p-2 rounded-xl bg-white/[0.04] border border-white/8 text-[11px] flex items-center justify-between gap-2"
                    >
                      <div className="min-w-0">
                        <p className="text-white/90 font-semibold truncate">{item.name}</p>
                        <p className="text-[10px] text-white/50 truncate">Prêté à {item.loan_to_name || 'un ami'}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleMarkReturned(item)}
                        className="px-2.5 py-1 rounded-lg bg-[#A3C4A3]/20 hover:bg-[#A3C4A3]/30 border border-[#A3C4A3]/40 text-[#A3C4A3] text-[10px] font-bold shrink-0 transition-all active:scale-95"
                      >
                        Rendu ✓
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </GlassCard>

            {/* Card Actions Rapides */}
            <GlassCard className="p-4">
              <div className="flex items-center justify-between pb-2.5 border-b border-white/10">
                <h3 className="text-xs font-extrabold text-white uppercase tracking-wider">Actions rapides</h3>
                <span className="text-[9px] text-white/50 font-mono">Navigation</span>
              </div>
              <div className="grid grid-cols-2 gap-2 mt-3">
                <Link
                  href="/explorer"
                  className="p-2.5 rounded-xl bg-white/[0.04] hover:bg-white/[0.09] border border-white/8 text-[11px] text-white/90 flex flex-col gap-0.5 transition-all active:scale-[0.98]"
                >
                  <span>🗺️</span>
                  <span className="font-bold">Explorer</span>
                  <span className="text-[9px] text-white/45">Trouver des randonnées</span>
                </Link>
                <Link
                  href="/ai-configurator"
                  className="p-2.5 rounded-xl bg-white/[0.04] hover:bg-white/[0.09] border border-white/8 text-[11px] text-white/90 flex flex-col gap-0.5 transition-all active:scale-[0.98]"
                >
                  <span>✨</span>
                  <span className="font-bold">Configurateur IA</span>
                  <span className="text-[9px] text-white/45">Générer un kit</span>
                </Link>
                <Link
                  href="/rapport-kit"
                  className="p-2.5 rounded-xl bg-white/[0.04] hover:bg-white/[0.09] border border-white/8 text-[11px] text-white/90 flex flex-col gap-0.5 transition-all active:scale-[0.98]"
                >
                  <span>📦</span>
                  <span className="font-bold">Rapport Kit</span>
                  <span className="text-[9px] text-white/45">Évaluer son sac</span>
                </Link>
                <Link
                  href="/jumeau-3d"
                  className="p-2.5 rounded-xl bg-white/[0.04] hover:bg-white/[0.09] border border-white/8 text-[11px] text-white/90 flex flex-col gap-0.5 transition-all active:scale-[0.98]"
                >
                  <span>🧊</span>
                  <span className="font-bold">Jumeau 3D</span>
                  <span className="text-[9px] text-white/45">Vue du sac</span>
                </Link>
              </div>
            </GlassCard>
          </div>
        </div>
      </main>
      </div>

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
        <div className="fixed inset-0 z-[1100] flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-[fadeInUp_0.2s_ease_both]">
          <div className="relative w-full max-w-md rounded-[28px] border border-white/15 bg-[#0B1F17]/95 p-6 text-white shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <h3 className="text-sm font-extrabold text-white uppercase tracking-wider">Planifier une nouvelle sortie</h3>
              <button
                type="button"
                onClick={() => setIsNewHikeModalOpen(false)}
                className="w-7 h-7 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-xs text-white"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateHike} className="space-y-3 text-xs">
              <div>
                <label className="text-[11px] text-white/70 block mb-1">Nom de la randonnée / trek *</label>
                <input
                  required
                  value={newHikeName}
                  onChange={(e) => setNewHikeName(e.target.value)}
                  placeholder="Ex. Tour du Mont Blanc, GR20 Sud…"
                  className="w-full px-3 py-2 rounded-xl bg-black/30 border border-white/15 text-white focus:outline-none focus:border-[#A3C4A3]"
                />
              </div>
              <div>
                <label className="text-[11px] text-white/70 block mb-1">Massif / Destination</label>
                <input
                  value={newHikeDest}
                  onChange={(e) => setNewHikeDest(e.target.value)}
                  placeholder="Ex. Massif des Écrins, Vercors…"
                  className="w-full px-3 py-2 rounded-xl bg-black/30 border border-white/15 text-white focus:outline-none focus:border-[#A3C4A3]"
                />
              </div>
              <div>
                <label className="text-[11px] text-white/70 block mb-1">Compagnons (optionnel)</label>
                <input
                  value={newHikeCompanions}
                  onChange={(e) => setNewHikeCompanions(e.target.value)}
                  placeholder="Ex. Léna & Antoine"
                  className="w-full px-3 py-2 rounded-xl bg-black/30 border border-white/15 text-white focus:outline-none focus:border-[#A3C4A3]"
                />
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="text-[10px] text-white/70 block mb-1">Durée (jours)</label>
                  <input
                    type="number"
                    min="1"
                    value={newHikeDays}
                    onChange={(e) => setNewHikeDays(Number(e.target.value))}
                    className="w-full px-2 py-1.5 rounded-xl bg-black/30 border border-white/15 text-white text-center focus:outline-none focus:border-[#A3C4A3]"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-white/70 block mb-1">Distance (km)</label>
                  <input
                    type="number"
                    min="1"
                    value={newHikeKm}
                    onChange={(e) => setNewHikeKm(Number(e.target.value))}
                    className="w-full px-2 py-1.5 rounded-xl bg-black/30 border border-white/15 text-white text-center focus:outline-none focus:border-[#A3C4A3]"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-white/70 block mb-1">D+ (mètres)</label>
                  <input
                    type="number"
                    min="0"
                    value={newHikeDPlus}
                    onChange={(e) => setNewHikeDPlus(Number(e.target.value))}
                    className="w-full px-2 py-1.5 rounded-xl bg-black/30 border border-white/15 text-white text-center focus:outline-none focus:border-[#A3C4A3]"
                  />
                </div>
              </div>

              <div className="pt-3 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsNewHikeModalOpen(false)}
                  className="px-4 py-2 rounded-full bg-white/10 text-white text-xs font-semibold"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-full bg-[#A3C4A3] text-[#0B1F17] font-bold text-xs hover:bg-[#b3d4b3]"
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
        <div className="fixed inset-0 z-[1100] flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-[fadeInUp_0.2s_ease_both]">
          <div className="relative w-full max-w-md rounded-[28px] border border-white/15 bg-[#0B1F17]/95 p-6 text-white shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <h3 className="text-sm font-extrabold text-white uppercase tracking-wider">Corbeille des kits ({trashCount})</h3>
              <button
                type="button"
                onClick={() => setIsTrashModalOpen(false)}
                className="w-7 h-7 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-xs text-white"
                aria-label="Fermer"
              >
                ✕
              </button>
            </div>

            <div className="space-y-2 max-h-[60vh] overflow-y-auto scrollbar-none pr-0.5">
              {trashKits.length === 0 && (
                <p className="text-xs text-white/50 text-center py-6">Corbeille vide</p>
              )}
              {trashKits.map((kit) => (
                <div key={kit.id} className="p-3 rounded-xl bg-white/[0.04] border border-white/8 flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-white truncate">{kit.name}</p>
                    <p className="text-[10px] text-white/45">
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
                      className="px-2.5 py-1 rounded-lg bg-[#A3C4A3]/20 hover:bg-[#A3C4A3]/30 border border-[#A3C4A3]/40 text-[#A3C4A3] text-[10px] font-bold transition-all active:scale-95"
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
                      className="px-2.5 py-1 rounded-lg bg-[#E76F51]/20 hover:bg-[#E76F51]/30 border border-[#E76F51]/40 text-[#F4A18C] text-[10px] font-bold transition-all active:scale-95"
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

      {/* ═══ COCKPIT SETTINGS MODAL ═══ */}
      {isSettingsModalOpen && (
        <div className="fixed inset-0 z-[1100] flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-[fadeInUp_0.2s_ease_both]">
          <div className="relative w-full max-w-md rounded-[28px] border border-white/15 bg-[#0B1F17]/95 p-6 text-white shadow-2xl space-y-5">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div className="flex items-center gap-2">
                <span className="text-base">⚙️</span>
                <h3 className="text-sm font-extrabold text-white uppercase tracking-wider">Réglages du Cockpit</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsSettingsModalOpen(false)}
                className="w-7 h-7 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-xs text-white"
                aria-label="Fermer"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4 text-xs">
              <div className="space-y-2">
                <label className="text-[11px] font-semibold text-white/70 uppercase tracking-wide block">
                  Objectif de poids de base du sac (kg)
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {[5, 6, 8, 10, 12, 14, 16, 20].map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => {
                        setTargetKg(t);
                        triggerHaptic('light');
                        showToast(`Objectif ajusté à ${t} kg`, 'info');
                      }}
                      className={`py-2 rounded-xl text-center font-mono font-bold transition-all active:scale-95 ${
                        targetKg === t
                          ? 'bg-[#A3C4A3] text-[#0B1F17] shadow-sm'
                          : 'bg-white/8 hover:bg-white/14 text-white/80 border border-white/10'
                      }`}
                    >
                      {t} kg
                    </button>
                  ))}
                </div>
              </div>

              <div className="pt-2 border-t border-white/10 space-y-2">
                <label className="text-[11px] font-semibold text-white/70 uppercase tracking-wide block">
                  Raccourcis & Navigation
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      handleResetFilters();
                      setIsSettingsModalOpen(false);
                      showToast('Filtres réinitialisés', 'info');
                    }}
                    className="py-2.5 px-3 rounded-xl bg-white/8 hover:bg-white/14 border border-white/10 text-white/90 text-[11px] font-semibold text-left transition-colors flex items-center gap-1.5"
                  >
                    <span>🔄</span> Réinitialiser filtres
                  </button>
                  <Link
                    href="/compte"
                    onClick={() => setIsSettingsModalOpen(false)}
                    className="py-2.5 px-3 rounded-xl bg-white/8 hover:bg-white/14 border border-white/10 text-white/90 text-[11px] font-semibold text-left transition-colors flex items-center gap-1.5"
                  >
                    <span>👤</span> Mon Profil LKDV
                  </Link>
                </div>
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={() => setIsSettingsModalOpen(false)}
                className="px-5 py-2 rounded-full bg-[#A3C4A3] text-[#0B1F17] font-bold text-xs hover:bg-[#b3d4b3] transition-colors"
              >
                Terminer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────
function SpecTile({
  label,
  value,
  accent,
  onClick,
  title,
}: {
  label: string;
  value: string;
  accent?: boolean;
  onClick?: () => void;
  title?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title || label}
      className="p-2 rounded-xl bg-white/[0.04] hover:bg-white/[0.09] border border-white/8 hover:border-white/15 text-left transition-all active:scale-95 cursor-pointer flex flex-col justify-between"
    >
      <span className={`text-[11px] font-bold block truncate capitalize ${accent ? 'text-[#A3C4A3]' : 'text-white'}`}>
        {value}
      </span>
      <span className="text-[9px] text-white/50 uppercase font-mono tracking-wider mt-0.5 flex items-center justify-between w-full">
        <span>{label}</span>
        {onClick && <span className="text-[8px] text-[#A3C4A3] opacity-60">✎</span>}
      </span>
    </button>
  );
}