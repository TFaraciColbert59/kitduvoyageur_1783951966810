'use client';

import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { motion, MotionConfig, AnimatePresence } from 'framer-motion';
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
const FORGET_CHECK_KEY = 'lkdv_forget_checked';
const FORGET_DISMISS_KEY = 'lkdv_forget_dismissed';
const FORGET_REMIND_KEY = 'lkdv_forget_remind';
const DEPART_CHECK_KEY = 'lkdv_depart_check';
const DEFAULT_WIDGET_ORDER = ['sac', 'departure', 'gear', 'forget', 'alerts', 'kits'];
const WIDGET_SPAN: Record<string, string> = {
  sac: 'col-span-1 lg:col-span-1',
  departure: 'col-span-2 lg:col-span-2',
  gear: 'col-span-1 lg:col-span-1',
  forget: 'col-span-2 lg:col-span-2',
  alerts: 'col-span-1 lg:col-span-1',
  kits: 'col-span-1 lg:col-span-1',
};
const WIDGET_LABEL: Record<string, string> = {
  sac: 'Mon sac',
  departure: 'Prochain départ',
  gear: 'Mes équipements',
  forget: 'À ne pas oublier',
  alerts: 'Alertes & actions',
  kits: 'Mes kits',
};

// ── Cartographie des 9 catégories produit (spec « Mes équipements ») ──
const GEAR_CATEGORY_META: { key: string; label: string; kws: string[] }[] = [
  { key: 'abri', label: 'Abri & couchage', kws: ['tente', 'couchage', 'duvet', 'matelas', 'bivouac', 'abri', 'sac de couchage', 'hamac'] },
  { key: 'cuisine', label: 'Cuisine & eau', kws: ['cuisine', 'eau', 'réchaud', 'rechaud', 'popote', 'hydratation', 'filtre', 'gourde', 'gamelle', 'gaz'] },
  { key: 'vetement', label: 'Vêtements & portage', kws: ['vêtement', 'vetement', 'textile', 'veste', 'chaussure', 'pantalon', 'polaire', 'sac', 'portage', 'poncho'] },
  { key: 'hygiene', label: 'Hygiène & santé', kws: ['hygiène', 'hygiene', 'santé', 'sante', 'pharmacie', 'trousse', 'savon', 'crème', 'solaires', 'repulsif', 'répulsif'] },
  { key: 'orientation', label: 'Orientation & sécurité', kws: ['navigation', 'gps', 'boussole', 'carte', 'sécurité', 'securite', 'secours', 'sifflet', 'allume-fe', 'briquet', 'couteau'] },
  { key: 'energie', label: 'Énergie & électronique', kws: ['lampe', 'frontale', 'pile', 'batterie', 'powerbank', 'chargeur', 'éclairage', 'eclairage', 'solaire'] },
  { key: 'organisation', label: 'Organisation du sac', kws: ['organisation', 'pochette', 'étanche', 'etanche', 'compression', 'déchets', 'dechets', 'sachet'] },
  { key: 'protection', label: 'Protection météo', kws: ['imperméable', 'impermeable', 'waterproof', 'pluie', 'couverture de survie', 'surveste', 'gore-tex'] },
  { key: 'reparation', label: 'Réparation & urgence', kws: ['réparation', 'reparation', 'sangle', 'lacet', 'duct tape', 'adhésif', 'aiguille', 'rustine', 'scotch'] },
];
const GEAR_CATEGORY_LABEL: Record<string, string> = Object.fromEntries(GEAR_CATEGORY_META.map((c) => [c.key, c.label]));
function mapGearCategory(raw?: string, name?: string): string {
  const hay = `${raw || ''} ${name || ''}`.toLowerCase();
  for (const c of GEAR_CATEGORY_META) {
    if (c.kws.some((k) => hay.includes(k))) return c.key;
  }
  return 'organisation';
}

function formatWeight(g: number): string {
  if (g >= 1000) {
    return `${(g / 1000).toLocaleString('fr-FR', { minimumFractionDigits: 1, maximumFractionDigits: 2 })} kg`;
  }
  return `${g} g`;
}

const CATEGORIES = ['all', 'couchage', 'portage', 'cuisine', 'vêtement', 'navigation'];
const DEFAULT_TARGET_KG = 8;

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
      className={`relative rounded-[28px] overflow-hidden border border-white/60 bg-white/40 backdrop-blur-xl backdrop-saturate-150 shadow-[0_24px_60px_-24px_rgba(11,31,23,0.22),0_4px_16px_rgba(11,31,23,0.06),inset_0_1px_0_0_rgba(255,255,255,0.85)] ${className}`}
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

function IconChecklist() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M9 5h12M9 12h12M9 19h12" />
      <path d="M3.5 5l1 1 2-2M3.5 12l1 1 2-2M3.5 19l1 1 2-2" />
    </svg>
  );
}

function IconMaximize() {
  return (
    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" />
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
const [expandedWidget, setExpandedWidget] = useState<string | null>(null);
  const expandedCloseRef = useRef<HTMLButtonElement | null>(null);
  const expandOriginRef = useRef<HTMLButtonElement | null>(null);
const [forgetChecked, setForgetChecked] = useState<Set<string>>(new Set());
  const [forgetDismissed, setForgetDismissed] = useState<Set<string>>(new Set());
  const [forgetReminded, setForgetReminded] = useState<Set<string>>(new Set());
  const [departCheck, setDepartCheck] = useState<Set<string>>(new Set());
  const [alertFilter, setAlertFilter] = useState('');

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

  // Checklist « À ne pas oublier » — état persisté des éléments cochés
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(FORGET_CHECK_KEY);
      if (raw) setForgetChecked(new Set(JSON.parse(raw) as string[]));
    } catch {
      /* ignore malformed localStorage */
    }
  }, []);

const toggleForgetChecked = (id: string) => {
    setForgetChecked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      try {
        window.localStorage.setItem(FORGET_CHECK_KEY, JSON.stringify([...next]));
      } catch {
        /* ignore quota errors */
      }
      return next;
    });
    triggerHaptic('light');
  };

  // États « Pas nécessaire », « Me rappeler demain » de la checklist + checklist départ
  useEffect(() => {
    const load = (key: string, set: (s: Set<string>) => void) => {
      try {
        const raw = window.localStorage.getItem(key);
        if (raw) set(new Set(JSON.parse(raw) as string[]));
      } catch {
        /* ignore */
      }
    };
    load(FORGET_DISMISS_KEY, setForgetDismissed);
    load(FORGET_REMIND_KEY, setForgetReminded);
    load(DEPART_CHECK_KEY, setDepartCheck);
  }, []);

  const persistSetUpdate =
    (key: string, setter: React.Dispatch<React.SetStateAction<Set<string>>>) =>
    (id: string) => {
      triggerHaptic('light');
      setter((prev) => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        try {
          window.localStorage.setItem(key, JSON.stringify([...next]));
        } catch {
          /* ignore */
        }
        return next;
      });
    };
  const toggleForgetDismissed = persistSetUpdate(FORGET_DISMISS_KEY, setForgetDismissed);
  const toggleForgetReminded = persistSetUpdate(FORGET_REMIND_KEY, setForgetReminded);
  const toggleDepartCheck = persistSetUpdate(DEPART_CHECK_KEY, setDepartCheck);

// Vue fullscreen d'un widget — Escape ferme, focus piégé dans l'overlay, focus sur le bouton de fermeture
  useEffect(() => {
    if (!expandedWidget) return;
    const root = document.querySelector('[data-fullscreen]') as HTMLElement | null;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setExpandedWidget(null);
        return;
      }
      if (e.key === 'Tab' && root) {
        const focusables = [...root.querySelectorAll<HTMLElement>('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])')]
          .filter((el) => !el.hasAttribute('disabled'));
        if (focusables.length === 0) return;
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        const active = document.activeElement as HTMLElement | null;
        const inside = !!active && root.contains(active);
        if (e.shiftKey && (!inside || active === first)) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && (!inside || active === last)) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    window.addEventListener('keydown', onKey);
    const t = setTimeout(() => {
      root?.querySelector<HTMLElement>('[aria-label="Fermer (échap)"]')?.focus();
    }, 50);
    return () => {
      window.removeEventListener('keydown', onKey);
      clearTimeout(t);
    };
  }, [expandedWidget]);

  // Restauration du focus sur le bouton « Agrandir » du widget d'origine à la fermeture
  useEffect(() => {
    if (expandedWidget === null) {
      const t = setTimeout(() => expandOriginRef.current?.focus(), 0);
      return () => clearTimeout(t);
    }
  }, [expandedWidget]);

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

  // Kit de référence (recommandé pour le prochain départ, sinon actif, sinon premier)
  const contextKit = useMemo(() => recommendedKit || activeKit || kits[0] || null, [recommendedKit, activeKit, kits]);

  // Préparation par kit (nom → état réel de complétude)
  const kitReadinessOf = useCallback(
    (kit: CustomKit) => {
      const items = kit.items || [];
      let owned = 0;
      const missing: CustomKitItem[] = [];
      items.forEach((ki) => {
        const isO = equipment.some((e) => (ki.gear_item_id && e.id === ki.gear_item_id) || e.name.toLowerCase() === ki.item_name.toLowerCase());
        if (isO) owned++;
        else missing.push(ki);
      });
      return {
        readinessPct: items.length ? Math.round((owned / items.length) * 100) : 100,
        ownedCount: owned,
        totalCount: items.length,
        missingItems: missing,
      };
    },
    [equipment]
  );

  // Poids de départ estimé = kit de référence + consommables du prochain départ (spec « Mon sac »)
  const consumablesWeightG = useMemo(() => {
    if (!departurePlan) return 0;
    const c = departurePlan.consumables;
    return (c.waterLiters || 0) * 1000 + (c.fuelGrams || 0) + (c.foodMealsCount || 0) * 600 + (c.snacksCount || 0) * 100;
  }, [departurePlan]);
  const sacKitWeightG = contextKit?.total_weight_g || 0;
  const sacEstimatedG = sacKitWeightG + consumablesWeightG;
  const sacInfo = contextKit ? kitReadinessOf(contextKit) : null;
  const sacMarginG = targetKg * 1000 - sacEstimatedG;
  const sacStatus: 'pret' | 'incomplet' | 'troplourd' | 'none' = !contextKit
    ? 'none'
    : sacMarginG < 0
    ? 'troplourd'
    : sacInfo && sacInfo.missingItems.length > 0
    ? 'incomplet'
    : 'pret';

  // Essentiels « Mes équipements » : items du kit de référence avec leur état réel
  const gearEssentials = useMemo(() => {
    const kit = recommendedKit || activeKit || kits[0] || null;
    if (!kit || !kit.items || kit.items.length === 0) return null;
    return kit.items.map((ki) => {
      const owned = equipment.find(
        (e) => (ki.gear_item_id && e.id === ki.gear_item_id) || e.name.toLowerCase() === ki.item_name.toLowerCase()
      );
      let state: 'owned' | 'preparer' | 'prete' | 'entretien' | 'manquant' = 'manquant';
      if (owned) {
        if (owned.loan_status === 'prêté') state = 'prete';
        else if (
          owned.condition === 'à_réparer' ||
          owned.condition === 'à_remplacer' ||
          (owned.next_maintenance_date && new Date(owned.next_maintenance_date).getTime() < Date.now())
        )
          state = 'entretien';
        else state = 'owned';
      }
      return { key: `${ki.id}-${ki.item_name}`, cat: mapGearCategory(ki.category, ki.item_name), label: ki.item_name, state, itemId: owned?.id ?? null, weight: ki.weight_g || 0 };
    });
  }, [recommendedKit, activeKit, kits, equipment]);
  const gearEssentialsByCat = useMemo(() => {
    if (!gearEssentials) return null;
    const map = new Map<string, { total: number; owned: number }>();
    gearEssentials.forEach((g) => {
      const cur = map.get(g.cat) || { total: 0, owned: 0 };
      cur.total++;
      if (g.state === 'owned') cur.owned++;
      map.set(g.cat, cur);
    });
    return [...map.entries()]
      .map(([cat, v]) => ({ cat, label: GEAR_CATEGORY_LABEL[cat] || cat, ...v }))
      .sort((a, b) => b.total - a.total);
  }, [gearEssentials]);
  const gearCoveragePct =
    gearEssentials && gearEssentials.length > 0
      ? Math.round((gearEssentials.filter((g) => g.state === 'owned').length / gearEssentials.length) * 100)
      : 0;
  const gearInventoryCats = useMemo(() => {
    const map = new Map<string, number>();
    equipment.forEach((it) => {
      const c = mapGearCategory(it.category, it.name);
      map.set(c, (map.get(c) || 0) + 1);
    });
    return [...map.entries()]
      .map(([cat, n]) => ({ cat, label: GEAR_CATEGORY_LABEL[cat] || cat, count: n }))
      .sort((a, b) => b.count - a.count);
  }, [equipment]);

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

  // ── Widget « À ne pas oublier » : checklist intelligente priorisée ──
  // Données réelles (inventaire, kits, alertes, départ) + règles génériques explicites (jamais présenté comme personnalisé s'il n'y a pas de donnée).
  const forgetItems = useMemo(() => {
    const out: {
      id: string;
      label: string;
      reason: string;
      level: 'critique' | 'verifier' | 'conseille' | 'facultatif' | 'pret';
      category: string;
      source: 'donnée' | 'règle';
      itemId?: string;
    }[] = [];

    for (const a of alerts) {
      if (a.kind === 'expiry') {
        out.push({ id: `f-exp-${a.itemId}`, label: a.label.replace('Péremption — ', ''), reason: 'Produit périmé — ne pas l\'emporter sans contrôle', level: 'critique', category: 'Péremptions', source: 'donnée', itemId: a.itemId });
      } else if (a.kind === 'maintenance') {
        out.push({ id: `f-maint-${a.itemId}`, label: a.label.replace('Révision due — ', ''), reason: 'Maintenance dépassée avant départ', level: 'verifier', category: 'Entretien', source: 'donnée', itemId: a.itemId });
      } else if (a.kind === 'replace') {
        out.push({ id: `f-rep-${a.itemId}`, label: a.label.replace('À réparer/remplacer — ', ''), reason: 'État dégradé — à remplacer ou réparer', level: 'critique', category: 'Entretien', source: 'donnée', itemId: a.itemId });
      } else if (a.kind === 'loan') {
        out.push({ id: `f-loan-${a.itemId}`, label: a.label.replace(`Prêté à ${a.borrower || 'un ami'} — `, ''), reason: 'Actuellement prêté — penser à le récupérer', level: 'verifier', category: 'Prêts', source: 'donnée', itemId: a.itemId });
      }
    }

    if (activeKit && hikeReadiness.missingItems.length > 0) {
      hikeReadiness.missingItems.forEach((m, i) => {
        if (i < 4) {
          out.push({ id: `f-miss-${m.id}`, label: m.item_name, reason: 'Manquant au kit assigné au prochain départ', level: 'critique', category: 'Kit', source: 'donnée' });
        }
      });
    }

    const invNames = equipment.map((e) => `${e.name} ${e.category || ''}`.toLowerCase());
    const hasKw = (kws: string[]) => kws.some((k) => invNames.some((n) => n.includes(k)));
    const consumChecks: { label: string; kws: string[]; reason: string }[] = [
      { label: 'Gaz / cartouche pour réchaud', kws: ['gaz', 'cartouche', 'réchaud', 'rechaud'], reason: 'Non détecté dans l\'inventaire — indispensable si cuisine au réchaud' },
      { label: 'Pastilles de purification d\'eau', kws: ['pastille', 'purif', 'micropur'], reason: 'Autonomie eau — purifier en rando sans point d\'eau sûr' },
      { label: 'Piles / batterie externe', kws: ['piles', 'pile ', 'batterie', 'powerbank', 'power bank'], reason: 'Sécurité électronique (frontale, GPS) — à charger' },
      { label: 'Pharmacie (pansements, anti-douleur)', kws: ['pharmacie', 'pansement', 'trousse', 'secours'], reason: 'Essentiel en milieu isolé' },
      { label: 'Crème solaire', kws: ['crème solaire', 'creme solaire', 'solaire'], reason: 'Protection UV — été ou altitude' },
      { label: 'Répulsif anti-moustiques', kws: ['répulsif', 'repulsif', 'anti-moustique', 'moustique'], reason: 'Confort et santé en forêt / zones humides' },
    ];
    consumChecks.forEach((c) => {
      out.push({
        id: `f-con-${c.label.replace(/[^a-zA-Z0-9]/g, '').toLowerCase()}`,
        label: c.label,
        reason: hasKw(c.kws) ? 'Présent dans l\'inventaire' : c.reason,
        level: hasKw(c.kws) ? 'pret' : 'conseille',
        category: 'Consommables',
        source: 'règle',
      });
    });

    const docChecks = [
      { label: 'Pièce d\'identité', reason: 'Obligatoire si déplacement hors zone résidence' },
      { label: 'Assurance (annulation / rapatriement)', reason: 'Rarement emporté de tête — vérifier avant départ' },
      { label: 'Argent liquide', reason: 'Souvent indispensable hors réseau' },
      { label: 'Numéros d\'urgence', reason: 'A avoir à portée en cas de souci' },
    ];
    docChecks.forEach((d, i) => {
      out.push({ id: `f-doc-${i}`, label: d.label, reason: d.reason, level: 'conseille', category: 'Documents', source: 'règle' });
    });

if (activeHike) {
      if (activeHike.isOvernight) {
        out.push({ id: 'f-ctx-bivouac', label: 'Équipement bivouac (pauses, fil, lampe)', reason: `Nuit sur place (${(activeHike.nightsCount || 1) + 1} jours)`, level: 'verifier', category: 'Contexte départ', source: 'règle' });
      }
      if (activeHike.weather && typeof activeHike.weather.tempC === 'number' && activeHike.weather.tempC < 5) {
        out.push({ id: 'f-ctx-cold', label: 'Couche chaude supplémentaire', reason: `${Math.round(activeHike.weather.tempC)} °C annoncés au prochain départ`, level: 'verifier', category: 'Contexte départ', source: 'donnée' });
      }
      if (activeHike.weather && typeof activeHike.weather.tempC === 'number' && activeHike.weather.tempC > 24) {
        out.push({ id: 'f-ctx-hot', label: 'Hydratation & protection solaire', reason: `Temps chaud annoncé (${Math.round(activeHike.weather.tempC)} °C)`, level: 'verifier', category: 'Contexte départ', source: 'donnée' });
      }
    }

    // Priorité stricte (spec) : sécurité/indispensable d'abord, puis consommables, puis confort/documents
    const PRIORITY: Record<string, number> = {
      Kit: 1,
      'Prêts': 1,
      'Péremptions': 2,
      'Entretien': 2,
      'Contexte départ': 2,
      'Consommables': 3,
      'Documents': 4,
    };
    const LEVEL_W: Record<string, number> = { critique: 0, verifier: 1, conseille: 2, pret: 3, facultatif: 4 };
    return out
      .map((it) => ({ ...it, priority: PRIORITY[it.category] ?? 3 }))
      .sort((a, b) => a.priority - b.priority || LEVEL_W[a.level] - LEVEL_W[b.level]);
  }, [alerts, activeKit, hikeReadiness, equipment, activeHike]);

  const forgetCriticalCount = useMemo(
    () => forgetItems.filter((i) => i.level === 'critique' || i.level === 'verifier').length,
    [forgetItems]
  );
  const forgetActionableCount = useMemo(
    () => forgetItems.filter((i) => i.level !== 'pret' && i.level !== 'facultatif' && !forgetDismissed.has(i.id)).length,
    [forgetItems, forgetDismissed]
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
            draggable={!expandedWidget}
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
            className={`${expandedWidget ? 'pointer-events-none opacity-40' : 'cursor-grab active:cursor-grabbing'} p-1.5 text-[#1C2620]/50 hover:text-[#1C2620] rounded-lg hover:bg-[#1C2620]/[0.06] text-xs`}
          >
            ⠿
          </span>
          <button
            type="button"
            onClick={(e) => {
              if (expandedWidget) return;
              expandOriginRef.current = e.currentTarget;
              setExpandedWidget(id);
              triggerHaptic('light');
            }}
            title={`Agrandir le widget ${WIDGET_LABEL[id] || id}`}
            aria-label={`Agrandir le widget ${WIDGET_LABEL[id] || id}`}
            className="p-1.5 text-[#1C2620]/50 hover:text-[#2D5A3D] hover:bg-[#2D5A3D]/[0.08] rounded-lg transition-colors flex items-center justify-center"
          >
            <IconMaximize />
          </button>
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
case 'sac': {
        const barColor = sacMarginG >= 0 ? '#2D5A3D' : '#C0532E';
        const pct = targetKg > 0 ? Math.min(100, Math.round((sacEstimatedG / (targetKg * 1000)) * 100)) : 0;
        return widgetShell(
          'sac',
          <IconScale />,
          'Mon sac',
          contextKit ? `${contextKit.name} · objectif ${targetKg} kg` : 'Sélectionnez un kit',
          'actions',
          <>
            <div className="flex items-end justify-between gap-3 shrink-0">
              <div className="min-w-0">
                <div className="text-4xl font-extrabold font-mono tracking-tight leading-none text-[#1C2620]">
                  {formatWeight(sacEstimatedG)}
                </div>
                <p className="text-xs text-[#1C2620]/70 mt-2">
                  Objectif {targetKg} kg · {formatWeight(Math.abs(sacMarginG))} {sacMarginG >= 0 ? 'de marge' : 'au-dessus'}
                </p>
              </div>
              {sacInfo && (
                <span className={`px-2 py-0.5 rounded-full text-xs font-bold font-mono shrink-0 ${
                  sacStatus === 'pret'
                    ? 'bg-[#2D5A3D]/10 text-[#2D5A3D] border border-[#2D5A3D]/25'
                    : sacStatus === 'incomplet'
                    ? 'bg-[#8C6A1A]/10 text-[#8C6A1A] border border-[#8C6A1A]/30'
                    : sacStatus === 'troplourd'
                    ? 'bg-[#C0532E]/10 text-[#C0532E] border border-[#C0532E]/30'
                    : 'bg-[#1C2620]/[0.06] text-[#1C2620]/60'
                }`}>
                  {sacStatus === 'pret' ? 'Prêt' : sacStatus === 'incomplet' ? 'Incomplet' : sacStatus === 'troplourd' ? 'Trop lourd' : '—'}
                </span>
              )}
            </div>
            <div className="mt-3 shrink-0">
              <div className="h-2 rounded-full bg-[#1C2620]/[0.07] overflow-hidden">
                <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, backgroundColor: barColor }} />
              </div>
            </div>
            {consumablesWeightG > 0 && (
              <p className="text-xs text-[#1C2620]/60 mt-2 shrink-0">Inclut {formatWeight(consumablesWeightG)} de consommables (eau, repas, gaz)</p>
            )}
            {!contextKit && (
              <button type="button" onClick={() => { setIsKitDrawerOpen(true); }} className="mt-3 w-full py-2 rounded-full bg-[#2D5A3D]/10 border border-[#2D5A3D]/30 text-[#2D5A3D] text-xs font-bold shrink-0">
                Choisir un kit
              </button>
            )}
          </>
        );
      }

      case 'departure':
        return widgetShell(
          'departure',
          <IconNav />,
'Prochain départ',
          activeHike ? `Prêt à ${hikeReadiness.readinessPct}% · ${hikeReadiness.missingItems.length + alerts.length} chose(s) à régler` : 'Aucune sortie planifiée',
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

              <button
                type="button"
                onClick={() => { if (!expandedWidget) { expandOriginRef.current = null; setExpandedWidget('departure'); triggerHaptic('selection'); } }}
                className="mt-3 w-full py-2.5 rounded-full bg-[#2D5A3D] hover:bg-[#235030] text-white font-bold text-xs transition-all active:scale-[0.98] shrink-0"
              >
                🎒 Préparer mon départ
              </button>

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

case 'gear': {
        const cats = gearEssentialsByCat || gearInventoryCats.map((c) => ({ label: c.label, total: c.count, owned: c.count }));
        const isEssentials = !!gearEssentialsByCat;
        return widgetShell(
          'gear',
          <IconActivity />,
          'Mes équipements',
          gearEssentials ? `${gearEssentials.length} essentiels du kit de référence` : `${equipment.length} équipement(s) possédé(s)`,
          'inventaire',
          <>
            <div className="flex items-end justify-between gap-3 shrink-0">
              <div>
                <div className="text-4xl font-extrabold font-mono leading-none text-[#2D5A3D]">{gearCoveragePct}%</div>
                <p className="text-xs text-[#1C2620]/70 mt-2">{isEssentials ? 'des essentiels couverts' : 'du matériel inventorié'}</p>
              </div>
            </div>
            <div className="flex-1 min-h-0 overflow-y-auto scrollbar-none mt-3 space-y-2 pr-0.5">
              {!gearEssentials && gearInventoryCats.length === 0 && (
                <p className="text-xs text-[#1C2620]/60 text-center py-3">Inventaire vide</p>
              )}
              {cats.slice(0, 4).map((c) => {
                const ratio = c.total > 0 ? Math.round((c.owned / c.total) * 100) : 0;
                return (
                  <div key={c.label} className="space-y-1">
                    <div className="flex items-center justify-between text-xs text-[#1C2620]/80">
                      <span className="truncate">{c.label}</span>
                      <span className="font-mono text-[#2D5A3D]">{isEssentials ? `${c.owned} / ${c.total}` : `${c.owned} possédé(s)`}</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-[#1C2620]/[0.07] overflow-hidden">
                      <div className="h-full rounded-full bg-[#2D5A3D]" style={{ width: `${isEssentials ? ratio : Math.min(100, (c.owned || 1) * 20)}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        );
      }

      case 'forget': {
const actionable = forgetItems.filter((i) => i.level !== 'pret' && i.level !== 'facultatif' && !forgetDismissed.has(i.id));
        const done = forgetItems.filter((i) => forgetChecked.has(i.id)).length;
        return widgetShell(
          'forget',
          <IconChecklist />,
          'À ne pas oublier',
          forgetActionableCount > 0 ? `${forgetActionableCount} élément(s) pour votre départ` : 'Tout est en ordre',
          'actions',
          <>
            <div className="flex items-end justify-between gap-3 shrink-0">
              <div>
                <div className={`text-4xl font-extrabold font-mono leading-none ${forgetActionableCount > 0 ? 'text-[#8C6A1A] drop-shadow-[0_0_14px_rgba(184,147,42,0.4)]' : 'text-[#2D5A3D]'}`}>
                  {forgetActionableCount}
                </div>
                <p className="text-xs text-[#1C2620]/70 mt-2">
                  {forgetActionableCount > 0 ? `${forgetCriticalCount} à vérifier · ${done} traité(s)` : `tout est prêt · ${done}/${forgetItems.length} cochés`}
                </p>
              </div>
            </div>
            <div className="flex-1 min-h-0 overflow-y-auto scrollbar-none mt-3 space-y-1.5 pr-0.5">
{actionable.length === 0 ? (
                <p className="text-xs text-[#1C2620]/70 text-center py-4">Aucun élément critique ✨</p>
              ) : (
                actionable.slice(0, 4).map((it) => (
                  <button
                    key={it.id}
                    type="button"
                    onClick={() => toggleForgetChecked(it.id)}
                    aria-pressed={forgetChecked.has(it.id)}
                    className="w-full text-left p-2.5 rounded-xl bg-white/40 hover:bg-white/60 border border-[#1C2620]/[0.07] text-xs flex items-center justify-between gap-2 min-h-[44px] transition-colors"
                  >
                    <div className="min-w-0">
                      <p className={`font-semibold truncate ${forgetChecked.has(it.id) ? 'text-[#1C2620]/45 line-through' : 'text-[#1C2620]/90'}`}>• {it.label}</p>
                      <p className="text-[#1C2620]/60 truncate">{it.reason}</p>
                      {forgetReminded.has(it.id) && <span className="inline-flex text-[#8C6A1A] font-semibold">⏰ Rappel demain</span>}
                    </div>
                    <span className={`w-6 h-6 rounded-md border shrink-0 flex items-center justify-center ${forgetChecked.has(it.id) ? 'bg-[#2D5A3D] border-[#2D5A3D] text-white' : 'border-[#1C2620]/30 text-transparent'}`}>
                      <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="3"><path d="M5 12l5 5L20 7" /></svg>
                    </span>
                  </button>
                ))
              )}
            </div>
          </>
        );
      }

case 'alerts': {
        return widgetShell(
          'alerts',
          <IconBell />,
          'Alertes & actions',
          alerts.length > 0 ? `${alerts.length} action(s) nécessaire(s)` : 'Tout est en ordre',
          'prets',
          <>
            <div className="flex items-end justify-between gap-3 shrink-0">
              <div>
                <div className={`text-4xl font-extrabold font-mono leading-none ${alerts.length > 0 ? 'text-[#8C6A1A] drop-shadow-[0_0_12px_rgba(184,147,42,0.4)]' : 'text-[#2D5A3D]'}`}>
                  {alerts.length}
                </div>
                <p className="text-xs text-[#1C2620]/70 mt-2">{alerts.length === 0 ? 'Tout est en ordre' : 'sujets réellement urgents'}</p>
              </div>
            </div>
            <div className="flex-1 min-h-0 overflow-y-auto scrollbar-none mt-3 space-y-1.5 pr-0.5">
              {alerts.length === 0 ? (
                <p className="text-xs text-[#1C2620]/70 text-center py-4">Aucune alerte ✨</p>
              ) : (
                alerts.slice(0, 4).map((a) => (
                  <button
                    key={a.id}
                    type="button"
                    onClick={() => { setSelectedItemId(a.itemId); setIsDetailDrawerOpen(true); triggerHaptic('light'); }}
                    className="w-full text-left p-2 rounded-xl bg-white/40 hover:bg-[#1C2620]/[0.06] border border-[#1C2620]/[0.07] text-xs text-[#1C2620]/85 flex items-center justify-between gap-1.5 transition-colors"
                  >
                    <span className="truncate">• {a.label}</span>
                    <span className="text-xs text-[#2D5A3D] font-bold shrink-0">Voir ➔</span>
                  </button>
                ))
              )}
            </div>
            <div className="grid grid-cols-3 gap-1.5 shrink-0 mt-3 border-t border-[#1C2620]/[0.07] pt-2.5">
              <button type="button" onClick={() => { setEditingItem(null); setIsAddModalOpen(true); }} title="Ajouter un équipement" className="text-xs py-2 rounded-lg bg-white/40 hover:bg-white/60 border border-[#1C2620]/[0.07] text-[#1C2620]/85 font-semibold transition-colors">+ Équipement</button>
              <button type="button" onClick={handleCreateNewKit} title="Créer un kit" className="text-xs py-2 rounded-lg bg-white/40 hover:bg-white/60 border border-[#1C2620]/[0.07] text-[#1C2620]/85 font-semibold transition-colors">🎒 Créer un kit</button>
              <button type="button" onClick={() => setIsNewHikeModalOpen(true)} title="Planifier un départ" className="text-xs py-2 rounded-lg bg-white/40 hover:bg-white/60 border border-[#1C2620]/[0.07] text-[#1C2620]/85 font-semibold transition-colors">🧭 Planifier</button>
            </div>
          </>
        );
      }

case 'kits': {
        const rec = recommendedKit;
        const recInfo = rec ? kitReadinessOf(rec) : null;
        return widgetShell(
          'kits',
          <IconBackpack />,
          'Mes kits',
          `${kits.length} kit${kits.length > 1 ? 's' : ''} disponible${kits.length > 1 ? 's' : ''}`,
          'actions',
          <>
            {rec && activeHike && (
              <div className="shrink-0 rounded-2xl bg-[#2D5A3D]/[0.08] border border-[#2D5A3D]/25 p-2.5 space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-mono uppercase text-[#2D5A3D] font-bold">Kit recommandé</span>
                  <span className="px-2 py-0.5 rounded-full bg-[#2D5A3D]/10 border border-[#2D5A3D]/30 text-xs font-mono text-[#2D5A3D]">
                    {activeHike.name.slice(0, 14)}{activeHike.name.length > 14 ? '…' : ''}
                  </span>
                </div>
                <p className="text-xs font-bold text-[#1C2620] truncate">{rec.name}</p>
                {recInfo && recInfo.missingItems.length > 0 ? (
                  <p className="text-xs text-[#C0532E]">Il manque : {recInfo.missingItems.slice(0, 2).map((m) => m.item_name).join(' · ')}</p>
                ) : (
                  <p className="text-xs text-[#2D5A3D]">Prêt à {recInfo?.readinessPct ?? 100}%</p>
                )}
                <button
                  type="button"
                  onClick={() => { setSelectedKitForCockpit(rec); setIsKitDrawerOpen(true); }}
                  className="w-full py-1.5 rounded-full bg-[#2D5A3D] text-white text-xs font-bold transition-all active:scale-[0.98]"
                >
                  Compléter / gérer
                </button>
              </div>
            )}
            <div className="flex-1 min-h-0 overflow-y-auto scrollbar-none mt-2.5 space-y-2 pr-0.5">
              {kits.length === 0 ? (
                <p className="text-xs text-[#1C2620]/70 text-center py-3">Aucun kit actif. Créez votre premier kit.</p>
              ) : (
                kits.slice(0, 3).map((kit) => {
                  const info = kitReadinessOf(kit);
                  return (
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
                        <p className="text-xs text-[#1C2620]/60 truncate">{info.totalCount} équipement(s) · {info.readinessPct}% prêt</p>
                      </div>
                      <div className="text-right shrink-0">
                        <span className="text-xs font-mono font-bold text-[#2D5A3D] block">{formatWeight(kit.total_weight_g || 0)}</span>
                        {info.missingItems.length > 0 ? (
                          <span className="text-xs text-[#C0532E]">{info.missingItems.length} manquant(s)</span>
                        ) : (
                          <span className="text-xs text-[#2D5A3D]">Complet ✓</span>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </>
        );
      }

      default:
        return null;
    }
  };

  // ── Vues fullscreen détaillées (bouton « Agrandir » de chaque widget) ──
  const FORGET_LEVEL_META: Record<string, { label: string; cls: string }> = {
    critique: { label: 'Critique', cls: 'bg-[#9B2C2C]/10 text-[#9B2C2C] border-[#9B2C2C]/30' },
    verifier: { label: 'À vérifier', cls: 'bg-[#8C6A1A]/10 text-[#8C6A1A] border-[#8C6A1A]/30' },
    conseille: { label: 'Conseillé', cls: 'bg-[#2D5A3D]/10 text-[#2D5A3D] border-[#2D5A3D]/25' },
    facultatif: { label: 'Facultatif', cls: 'bg-[#1C2620]/[0.06] text-[#1C2620]/70 border-[#1C2620]/[0.1]' },
    pret: { label: 'Prêt ✓', cls: 'bg-[#2D5A3D]/10 text-[#2D5A3D] border-[#2D5A3D]/25' },
  };
  const FORGET_CATEGORY_ORDER = ['Kit', 'Prêts', 'Péremptions', 'Entretien', 'Contexte départ', 'Consommables', 'Documents'];

const renderExpandedWidget = (id: string): React.ReactNode => {
    const title = WIDGET_LABEL[id] || id;
    const closeBtn = (
      <button
        ref={expandedCloseRef}
        type="button"
        onClick={() => setExpandedWidget(null)}
        className="w-11 h-11 rounded-full bg-[#1C2620]/[0.06] hover:bg-[#1C2620]/[0.1] border border-[#1C2620]/[0.1] flex items-center justify-center text-base text-[#1C2620] shrink-0"
        aria-label="Fermer (échap)"
      >
        ✕
      </button>
    );
const icons: Record<string, React.ReactNode> = {
      sac: <IconScale />,
      departure: <IconNav />,
      gear: <IconActivity />,
      forget: <IconChecklist />,
      alerts: <IconBell />,
      kits: <IconBackpack />,
    };
    const iconChip = (
      <span className="w-9 h-9 rounded-xl bg-[#2D5A3D]/[0.08] border border-[#1C2620]/[0.08] flex items-center justify-center text-[#2D5A3D] shrink-0">
        {icons[id] || null}
      </span>
    );

    let subtitle = '';
    let body: React.ReactNode = null;

if (id === 'sac') {
      subtitle = contextKit ? `${contextKit.name} · objectif ${targetKg} kg` : 'Aucun kit sélectionné';
      const pct = targetKg > 0 ? Math.min(100, Math.round((sacEstimatedG / (targetKg * 1000)) * 100)) : 0;
      const barColor = sacMarginG >= 0 ? '#2D5A3D' : '#C0532E';
      const heaviest = [...equipment]
        .sort((a, b) => (b.weight_g || 0) * (b.quantity || 1) - (a.weight_g || 0) * (a.quantity || 1))
        .slice(0, 6);
      body = (
        <div className="grid gap-4 lg:grid-cols-2">
          <section className="rounded-3xl bg-white/60 border border-[#1C2620]/[0.07] p-4 space-y-3">
            <h3 className="text-xs font-extrabold uppercase tracking-wider text-[#1C2620]">Poids de départ estimé</h3>
            <div className="text-5xl font-extrabold font-mono leading-none text-[#1C2620]">{formatWeight(sacEstimatedG)}</div>
            <p className="text-xs text-[#1C2620]/70">
              Objectif <strong className="text-[#1C2620]">{targetKg} kg</strong> · {formatWeight(Math.abs(sacMarginG))} {sacMarginG >= 0 ? 'de marge' : 'au-dessus'} · {pct}%
            </p>
            <div className="h-2 rounded-full bg-[#1C2620]/[0.07] overflow-hidden">
              <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, backgroundColor: barColor }} />
            </div>
            <ul className="text-xs text-[#1C2620]/75 space-y-1">
              {contextKit && <li>📦 Kit « {contextKit.name} » : {formatWeight(sacKitWeightG)}</li>}
              <li>💧 Consommables (eau, repas, gaz) : {formatWeight(consumablesWeightG)}</li>
              {sacInfo && (
                <li className={sacInfo.missingItems.length > 0 ? 'text-[#C0532E]' : 'text-[#2D5A3D]'}>
                  {sacInfo.missingItems.length > 0 ? `⚠ ${sacInfo.missingItems.length} élément(s) manquant(s) au kit` : '✓ Kit complet'}
                </li>
              )}
            </ul>
            <div className="flex gap-1.5 flex-wrap">
              {[6, 8, 10, 12, 14, 20].map((t) => (
                <button key={t} type="button" onClick={() => { setTargetKg(t); triggerHaptic('light'); showToast(`Objectif ajusté à ${t} kg`, 'info'); }} className={`px-2.5 py-1 rounded-lg text-xs font-mono font-bold transition-colors ${targetKg === t ? 'bg-[#2D5A3D] text-white' : 'bg-white/50 text-[#1C2620]/80 border border-[#1C2620]/[0.1]'}`}>{t} kg</button>
              ))}
            </div>
          </section>
          <section className="rounded-3xl bg-white/60 border border-[#1C2620]/[0.07] p-4 space-y-2">
            <h3 className="text-xs font-extrabold uppercase tracking-wider text-[#1C2620]">Poids par catégorie</h3>
            {categoryStats.length === 0 && <p className="text-xs text-[#1C2620]/60">Aucune donnée — ajoutez des articles</p>}
            {categoryStats.map((c) => (
              <div key={c.label} className="space-y-1">
                <div className="flex items-center justify-between text-xs text-[#1C2620]/80">
                  <span className="capitalize truncate">{c.label}</span>
                  <span className="font-mono text-[#2D5A3D]">{formatWeight(c.grams)} ({c.pct}%)</span>
                </div>
                <div className="h-1.5 rounded-full bg-[#1C2620]/[0.07] overflow-hidden">
                  <div className="h-full rounded-full bg-[#2D5A3D]" style={{ width: `${c.pct}%` }} />
                </div>
              </div>
            ))}
          </section>
          <section className="rounded-3xl bg-white/60 border border-[#1C2620]/[0.07] p-4 space-y-2 lg:col-span-2">
            <h3 className="text-xs font-extrabold uppercase tracking-wider text-[#1C2620]">Équipements les plus lourds</h3>
            {heaviest.length === 0 && <p className="text-xs text-[#1C2620]/60">Inventaire vide</p>}
            {heaviest.map((it) => (
              <div key={it.id} className="flex items-center justify-between gap-2 p-2 rounded-xl bg-white/40 border border-[#1C2620]/[0.07] text-xs">
                <div className="min-w-0">
                  <p className="font-semibold text-[#1C2620] truncate">{it.name}</p>
                  <p className="text-[#1C2620]/60">{it.brand || 'Outdoor'} · {it.category || 'Autre'}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="font-mono font-bold text-[#2D5A3D]">{formatWeight((it.weight_g || 0) * (it.quantity || 1))}</span>
                  <button type="button" onClick={() => { setSelectedItemId(it.id); setExpandedWidget(null); setIsDetailDrawerOpen(true); }} className="px-2 py-1 rounded-lg bg-[#2D5A3D]/10 border border-[#2D5A3D]/30 text-[#2D5A3D] text-xs font-bold">Fiche</button>
                </div>
              </div>
            ))}
            <p className="text-xs text-[#1C2620]/60 border-t border-[#1C2620]/[0.05] pt-2">
              {sacMarginG < 0 && heaviest[0]
                ? `💡 Retirer ${formatWeight((heaviest[0].weight_g || 0) * (heaviest[0].quantity || 1))} (« ${heaviest[0].name} ») ou choisir une alternative plus légère pour rentrer dans l&apos;objectif.`
                : sacInfo && sacInfo.missingItems.length > 0
                ? '💡 Complétez d\'abord le kit manquant avant de viser l\'allègement.'
                : `💡 Vous disposez de ${formatWeight(Math.abs(sacMarginG))} de marge — vous pouvez ajouter du matériel confort si besoin.`}
            </p>
          </section>
        </div>
      );
    } else if (id === 'departure') {
      subtitle = 'Préparation de la prochaine sortie';
      body = activeHike ? (
        <div className="space-y-4">
          <section className="rounded-3xl bg-white/60 border border-[#1C2620]/[0.07] p-4 space-y-3">
            {(() => {
              const d = daysUntil(activeHike.targetDate);
              const imminent = d !== null && d >= 0 && d <= 3;
              return (
                <>
                  <div className="flex items-center gap-3 flex-wrap">
                    <span className={`px-3 py-1 rounded-full text-xs font-bold font-mono ${d === null ? 'bg-white/50 text-[#1C2620]/70 border border-[#1C2620]/[0.1]' : d < 0 ? 'bg-white/50 text-[#1C2620]/60 border border-[#1C2620]/[0.1]' : imminent ? 'bg-[#8C6A1A] text-white shadow-[0_0_18px_rgba(184,147,42,0.5)]' : 'bg-[#2D5A3D]/10 text-[#2D5A3D] border border-[#2D5A3D]/25'}`}>
                      {d === null ? 'Date à définir' : d < 0 ? `J+${Math.abs(d)}` : d === 0 ? "C'est aujourd'hui !" : `J-${d} jours`}
                    </span>
                    <span className="text-xs text-[#1C2620]/60">{formatDateRange(activeHike)}</span>
                  </div>
                  <div>
                    <h3 className="text-2xl font-extrabold text-[#1C2620]">{activeHike.name}</h3>
                    <p className="text-xs text-[#1C2620]/70 mt-1">{activeHike.terrain || activeHike.season || 'Randonnée'}{activeHike.companions ? ` · ${activeHike.companions}` : ''}</p>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
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
                  <div className="flex flex-wrap gap-2">
                    <Link href={activeHike.routeId ? `/randonnee-active?routeId=${activeHike.routeId}` : '/randonnee-active'} onClick={() => setExpandedWidget(null)} className="px-4 py-2 rounded-full bg-[#2D5A3D] text-white font-bold text-xs">🚀 Démarrer</Link>
                    <Link href={activeHike.routeId ? `/preparer-randonnee?routeId=${activeHike.routeId}` : '/explorer'} onClick={() => setExpandedWidget(null)} className="px-4 py-2 rounded-full bg-white/50 hover:bg-[#1C2620]/[0.06] text-[#1C2620] font-bold text-xs border border-[#1C2620]/[0.1]">Itinéraire</Link>
                    <button type="button" onClick={() => handleDeleteHike(activeHike.id)} className="px-4 py-2 rounded-full bg-[#E76F51]/10 hover:bg-[#E76F51]/20 text-[#C0532E] font-bold text-xs border border-[#E76F51]/30">🗑️ Supprimer la sortie</button>
                  </div>
                </>
              );
            })()}
          </section>

          <div className="grid gap-4 lg:grid-cols-2">
            <section className="rounded-3xl bg-white/60 border border-[#1C2620]/[0.07] p-4 space-y-3">
              <h3 className="text-xs font-extrabold uppercase tracking-wider text-[#1C2620]">Kit pour ce départ</h3>
              <select
                value={activeHike.assignedKitId || ''}
                onChange={(e) => handleAssignKitToHike(activeHike.id, e.target.value)}
                className="w-full px-2.5 py-2 rounded-xl bg-white border border-[#1C2620]/[0.14] text-xs text-[#1C2620] focus:outline-none focus:border-[#2D5A3D] cursor-pointer"
              >
                {kits.length === 0 && <option value="">Aucun kit</option>}
                {kits.map((k) => (
                  <option key={k.id} value={k.id}>{k.name} ({formatWeight(k.total_weight_g || 0)})</option>
                ))}
              </select>
              <div className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-[#1C2620]/80">Prêt : <strong className="text-[#1C2620]">{hikeReadiness.ownedCount}/{hikeReadiness.totalCount} articles</strong></span>
                  <span className="font-mono font-bold text-[#2D5A3D]">{hikeReadiness.readinessPct}%</span>
                </div>
                <div className="h-1.5 rounded-full bg-[#1C2620]/[0.07] overflow-hidden">
                  <div className="h-full bg-[#2D5A3D] rounded-full transition-all duration-500" style={{ width: `${hikeReadiness.readinessPct}%` }} />
                </div>
              </div>
              {hikeReadiness.missingItems.length > 0 && (
                <div className="space-y-1.5">
                  <p className="text-xs font-bold text-[#C0532E]">Articles manquants ({hikeReadiness.missingItems.length}) :</p>
                  {hikeReadiness.missingItems.map((m) => (
                    <div key={m.id} className="flex items-center justify-between gap-2 p-2 rounded-xl bg-white/40 border border-[#1C2620]/[0.07] text-xs">
                      <span className="truncate text-[#1C2620]/90">{m.item_name}</span>
                      <button
                        type="button"
                        onClick={() => { addToEquipment({ name: m.item_name, category: m.category || 'Autre', weight_g: m.weight_g || 100 }); showToast(`🎒 ${m.item_name} ajouté à votre inventaire`, 'success'); }}
                        className="px-2.5 py-1 rounded-lg bg-[#2D5A3D]/10 border border-[#2D5A3D]/30 text-[#2D5A3D] text-xs font-bold shrink-0"
                      >
                        + Ajouter
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section className="rounded-3xl bg-white/60 border border-[#1C2620]/[0.07] p-4 space-y-3">
              <h3 className="text-xs font-extrabold uppercase tracking-wider text-[#1C2620]">Recommandation & consommables</h3>
              {departurePlan ? (
                <>
                  <div className="p-2.5 rounded-xl bg-[#2D5A3D]/[0.06] border border-[#2D5A3D]/25 text-xs">
                    <span className="text-[#2D5A3D] font-mono uppercase font-bold block">Kit recommandé — score {departurePlan.suitabilityScore}/100</span>
                    <p className="text-[#1C2620]/90 font-semibold mt-0.5">{recommendedKit ? recommendedKit.name : 'Kit auto-généré à partir de votre inventaire'}</p>
                    {recommendedKit && recommendedKit.id !== activeKit?.id && (
                      <button type="button" onClick={() => handleAssignKitToHike(activeHike.id, recommendedKit.id)} className="mt-2 px-3 py-1.5 rounded-full bg-[#2D5A3D] text-white text-xs font-bold">
                        Utiliser ce kit
                      </button>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {departurePlan.consumables.waterLiters > 0 && <span className="px-2 py-1 rounded-lg bg-white/50 border border-[#1C2620]/[0.07] text-xs text-[#1C2620]/85">💧 {departurePlan.consumables.waterLiters.toFixed(1).replace('.', ',')} L d&apos;eau</span>}
                    {departurePlan.consumables.foodMealsCount > 0 && <span className="px-2 py-1 rounded-lg bg-white/50 border border-[#1C2620]/[0.07] text-xs text-[#1C2620]/85">🍽️ {departurePlan.consumables.foodMealsCount} repas</span>}
                    <span className="px-2 py-1 rounded-lg bg-white/50 border border-[#1C2620]/[0.07] text-xs text-[#1C2620]/85">🥨 {departurePlan.consumables.snacksCount} en-cas</span>
                    {departurePlan.consumables.fuelGrams > 0 && <span className="px-2 py-1 rounded-lg bg-white/50 border border-[#1C2620]/[0.07] text-xs text-[#1C2620]/85">🔥 {departurePlan.consumables.fuelGrams} g gaz</span>}
                    <span className="px-2 py-1 rounded-lg bg-white/50 border border-[#8C6A1A]/25 text-xs text-[#8C6A1A]">{departurePlan.weatherSummary.advice}</span>
                  </div>
                </>
              ) : (
                <p className="text-xs text-[#1C2620]/60">Moteur de recommandation indisponible pour cette sortie</p>
              )}
            </section>
          </div>

          <section className="rounded-3xl bg-white/60 border border-[#1C2620]/[0.07] p-4 space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-extrabold uppercase tracking-wider text-[#1C2620]">Toutes les sorties ({plannedHikes.length})</h3>
              <button type="button" onClick={() => { setExpandedWidget(null); setIsNewHikeModalOpen(true); }} className="text-xs font-bold text-[#2D5A3D] hover:underline">+ Planifier</button>
            </div>
            <div className="flex gap-2 overflow-x-auto scrollbar-none">
              {plannedHikes.map((h) => (
                <button
                  key={h.id}
                  type="button"
                  onClick={() => handleSelectHike(h)}
                  className={`px-3 py-1.5 rounded-xl text-left border shrink-0 transition-all ${h.id === activeHike.id ? 'bg-[#2D5A3D]/10 border-[#2D5A3D]/50 text-[#1C2620] font-bold' : 'bg-white/40 border-[#1C2620]/[0.07] text-[#1C2620]/70'}`}
                >
                  <span className="block text-xs truncate max-w-[140px]">{h.name}</span>
                  <span className="text-xs font-mono text-[#2D5A3D]">{daysUntil(h.targetDate) !== null ? `J-${daysUntil(h.targetDate)}` : 'Date à définir'}</span>
                </button>
              ))}
            </div>
</section>

          <section className="rounded-3xl bg-white/60 border border-[#1C2620]/[0.07] p-4 space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-extrabold uppercase tracking-wider text-[#1C2620]">Check final avant départ</h3>
              <span className="text-xs text-[#1C2620]/60 font-mono">{departCheck.size + (hikeReadiness.readinessPct === 100 ? 1 : 0) + (alerts.filter((a) => a.kind !== 'loan').length === 0 ? 1 : 0)}/5</span>
            </div>
            {[
              { key: 'pret', label: 'Matériel prêt (100%)', auto: hikeReadiness.readinessPct === 100 },
              { key: 'charge', label: 'Sac chargé — poids contre objectif', auto: false },
              { key: 'entretien', label: 'Équipement entretenu (aucune alerte)', auto: alerts.filter((a) => a.kind !== 'loan').length === 0 },
              { key: 'emballe', label: 'Affaires emballées', auto: false },
              { key: 'valide', label: 'Validation avant départ', auto: false },
            ].map((item) => {
              const checked = item.auto || departCheck.has(item.key);
              return (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => toggleDepartCheck(item.key)}
                  className={`w-full text-left p-2 rounded-xl text-xs flex items-center justify-between gap-2 transition-colors ${checked ? 'bg-[#2D5A3D]/10 border border-[#2D5A3D]/25 text-[#1C2620]/75' : 'bg-white/40 border border-[#1C2620]/[0.07] text-[#1C2620]/90'}`}
                >
                  <span className={`font-semibold flex items-center gap-2 ${checked ? 'line-through decoration-[#1C2620]/40' : ''}`}>
                    <span className={`w-5 h-5 rounded-md border flex items-center justify-center shrink-0 ${checked ? 'bg-[#2D5A3D] border-[#2D5A3D] text-white' : 'border-[#1C2620]/30'}`}>
                      {checked && <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="3"><path d="M5 12l5 5L20 7" /></svg>}
                    </span>
                    {item.label}
                  </span>
                  <span className="text-[#1C2620]/60 shrink-0">{checked ? '✓' : 'À cocher'}</span>
                </button>
              );
            })}
          </section>
        </div>
      ) : (
        <div className="h-full flex flex-col items-center justify-center gap-3 text-center py-16">
          <span className="text-3xl block">🧭</span>
          <p className="text-sm text-[#1C2620]/75 font-medium">Aucune sortie planifiée</p>
          <button type="button" onClick={() => setIsNewHikeModalOpen(true)} className="px-5 py-2 rounded-full bg-[#2D5A3D] text-white font-bold text-xs">🧭 Planifier ma première sortie</button>
        </div>
      );
} else if (id === 'gear') {
      subtitle = 'Essentiels couverts vs manquants, par catégorie';
      const ess = gearEssentials;
      body = (
        <div className="grid gap-4 lg:grid-cols-2">
          <section className="rounded-3xl bg-white/60 border border-[#1C2620]/[0.07] p-4 space-y-3">
            <h3 className="text-xs font-extrabold uppercase tracking-wider text-[#1C2620]">Couverture des essentiels</h3>
            <div className="text-5xl font-extrabold font-mono leading-none text-[#2D5A3D]">{gearCoveragePct}%</div>
            <p className="text-xs text-[#1C2620]/70">
              {ess ? `${ess.filter((g) => g.state === 'owned').length}/${ess.length} essentiels du kit possédés` : `${equipment.length} équipement(s) possédés`}
            </p>
            <div className="h-2 rounded-full bg-[#1C2620]/[0.07] overflow-hidden">
              <div className="h-full bg-[#2D5A3D] rounded-full transition-all duration-500" style={{ width: `${gearCoveragePct}%` }} />
            </div>
            <div className="space-y-2 pt-1">
              {(gearEssentialsByCat || gearInventoryCats.map((c) => ({ label: c.label, total: c.count, owned: c.count }))).slice(0, 6).map((c) => {
                const ratio = c.total > 0 ? Math.round((c.owned / c.total) * 100) : 0;
                return (
                  <div key={c.label} className="space-y-1">
                    <div className="flex items-center justify-between text-xs text-[#1C2620]/80">
                      <span className="truncate">{c.label}</span>
                      <span className="font-mono text-[#2D5A3D]">{gearEssentialsByCat ? `${c.owned} / ${c.total}` : `${c.owned} possédé(s)`}</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-[#1C2620]/[0.07] overflow-hidden">
                      <div className="h-full rounded-full bg-[#2D5A3D]" style={{ width: `${gearEssentialsByCat ? ratio : Math.min(100, (c.owned || 1) * 14)}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          <section className="rounded-3xl bg-white/60 border border-[#1C2620]/[0.07] p-4 space-y-3 lg:col-span-2">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-extrabold uppercase tracking-wider text-[#1C2620]">Par catégorie</h3>
              <button type="button" onClick={() => { setEditingItem(null); setExpandedWidget(null); setIsAddModalOpen(true); }} className="px-3 py-1.5 rounded-full bg-[#2D5A3D] text-white text-xs font-bold">+ Ajouter un équipement</button>
            </div>
            {!ess ? (
              <div className="grid gap-3 sm:grid-cols-2">
                {(gearInventoryCats.length ? gearInventoryCats : [{ label: 'Inventaire', cat: 'organisation', count: 0 }]).map((c) => (
                  <div key={c.label} className="p-3 rounded-xl bg-white/40 border border-[#1C2620]/[0.07]">
                    <p className="text-xs font-bold text-[#1C2620]">{c.label}</p>
                    <p className="text-xs text-[#1C2620]/60 mt-0.5">{c.count} équipement(s) possédé(s)</p>
                  </div>
                ))}
              </div>
            ) : (
              GEAR_CATEGORY_META.map((cat) => {
                const items = ess.filter((g) => g.cat === cat.key);
                if (items.length === 0) return null;
                return (
                  <div key={cat.key} className="space-y-1.5">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-[#2D5A3D] pt-1 border-b border-[#1C2620]/[0.05] pb-1">{cat.label} ({items.length})</h4>
                    {items.map((g) => (
                      <div key={g.key} className="p-2.5 rounded-xl bg-white/40 border border-[#1C2620]/[0.07] text-xs flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <p className={g.state === 'owned' ? 'font-semibold text-[#2D5A3D] truncate' : 'text-[#1C2620]/90 truncate'}>
                            {g.state === 'owned' ? '✓ ' : g.state === 'prete' ? '🤝 ' : g.state === 'entretien' ? '🛠 ' : '○ '}{g.label}
                          </p>
                          <p className="text-[#1C2620]/60">
                            {g.state === 'owned' && `Possédé · ${formatWeight(g.weight)}`}
                            {g.state === 'prete' && 'Prêté — à récupérer avant départ'}
                            {g.state === 'entretien' && 'Maintenance dépassée — à préparer'}
                            {g.state === 'manquant' && 'Non possédé — nécessaire pour ce départ'}
                          </p>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          {g.state === 'manquant' ? (
                            <button
                              type="button"
                              onClick={() => { addToEquipment({ name: g.label, category: 'Autre', weight_g: g.weight || 100 }); showToast(`🎒 « ${g.label} » ajouté à l&apos;inventaire`, 'success'); }}
                              className="px-2.5 py-1 rounded-lg bg-[#2D5A3D] text-white text-xs font-bold"
                            >
                              + Ajouter à l&apos;inventaire
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => { if (g.itemId) { setSelectedItemId(g.itemId); setExpandedWidget(null); setIsDetailDrawerOpen(true); } }}
                              className="px-2.5 py-1 rounded-lg bg-[#2D5A3D]/10 border border-[#2D5A3D]/30 text-[#2D5A3D] text-xs font-bold"
                            >
                              {g.state === 'owned' ? 'Fiche' : 'Gérer'}
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                );
              })
            )}
          </section>
        </div>
      );
    } else if (id === 'forget') {
      subtitle = 'Checklist intelligente — données réelles + règles métier';
      const critical = forgetItems.filter((i) => i.level === 'critique' || i.level === 'verifier');
      body = (
        <div className="space-y-4">
          <section className="rounded-3xl bg-white/60 border border-[#1C2620]/[0.07] p-4 space-y-3">
            <div className="flex items-end justify-between gap-4">
              <div>
                <div className={`text-5xl font-extrabold font-mono leading-none ${critical.length > 0 ? 'text-[#8C6A1A]' : 'text-[#2D5A3D]'}`}>{critical.length}</div>
                <p className="text-xs text-[#1C2620]/70 mt-2">{critical.length > 0 ? 'élément(s) à vérifier avant départ' : 'Tout est en ordre'}</p>
              </div>
              <div className="flex flex-wrap gap-1.5 justify-end">
                <span className="px-2 py-1 rounded-lg bg-[#9B2C2C]/10 border border-[#9B2C2C]/30 text-xs font-mono text-[#9B2C2C]">Critique</span>
                <span className="px-2 py-1 rounded-lg bg-[#8C6A1A]/10 border border-[#8C6A1A]/30 text-xs font-mono text-[#8C6A1A]">À vérifier</span>
                <span className="px-2 py-1 rounded-lg bg-[#2D5A3D]/10 border border-[#2D5A3D]/25 text-xs font-mono text-[#2D5A3D]">Conseillé / Prêt</span>
              </div>
            </div>
            <p className="text-xs text-[#1C2620]/60">
              {forgetItems.filter((i) => i.source === 'donnée').length} recommandation(s) issues de vos données · {forgetItems.filter((i) => i.source === 'règle').length} règle(s) générique(s) de bon sens.
            </p>
          </section>

          {FORGET_CATEGORY_ORDER.map((cat) => {
            const items = forgetItems.filter((i) => i.category === cat && !forgetDismissed.has(i.id));
            if (items.length === 0) return null;
            return (
              <section key={cat} className="rounded-3xl bg-white/60 border border-[#1C2620]/[0.07] p-4 space-y-2">
                <h3 className="text-xs font-extrabold uppercase tracking-wider text-[#1C2620] pb-1 border-b border-[#1C2620]/[0.05]">{cat} ({items.length})</h3>
                {items.map((it) => {
                  const meta = FORGET_LEVEL_META[it.level] || FORGET_LEVEL_META.conseille;
                  const checked = forgetChecked.has(it.id);
                  return (
<div key={it.id} className="p-2.5 rounded-xl bg-white/40 border border-[#1C2620]/[0.07] text-xs flex items-start justify-between gap-2">
                      <div className="min-w-0 space-y-0.5">
                        <p className={`font-semibold truncate ${checked ? 'text-[#1C2620]/45 line-through' : 'text-[#1C2620]/90'}`}>{it.label}</p>
                        <p className="text-[#1C2620]/60">{it.reason}</p>
                        <div className="flex flex-wrap gap-1 pt-1">
                          <span className={`px-2 py-0.5 rounded-full border font-mono font-bold ${meta.cls}`}>{meta.label}</span>
                          <span className="px-2 py-0.5 rounded-full bg-[#1C2620]/[0.05] border border-[#1C2620]/[0.08] font-mono text-[#1C2620]/60">{it.source === 'donnée' ? 'Vos données' : 'Règle générique'}</span>
                          {it.itemId && (
                            <button
                              type="button"
                              onClick={() => { setSelectedItemId(it.itemId!); setExpandedWidget(null); setIsDetailDrawerOpen(true); }}
                              className="px-2 py-0.5 rounded-full bg-[#2D5A3D]/10 border border-[#2D5A3D]/30 text-[#2D5A3D] font-bold"
                            >
                              Ouvrir la fiche ➔
                            </button>
                          )}
                        </div>
                        <div className="flex flex-wrap gap-1.5 pt-1.5">
                          <button
                            type="button"
                            onClick={() => toggleForgetChecked(it.id)}
                            className={`px-2 py-1 rounded-lg text-xs font-semibold transition-colors ${checked ? 'bg-[#2D5A3D]/10 text-[#2D5A3D] border border-[#2D5A3D]/25' : 'bg-white/50 border border-[#1C2620]/[0.1] text-[#1C2620]/80'}`}
                          >
                            ✓ J&apos;ai déjà
                          </button>
                          <button
                            type="button"
                            onClick={() => toggleForgetDismissed(it.id)}
                            className={`px-2 py-1 rounded-lg text-xs font-semibold transition-colors ${forgetDismissed.has(it.id) ? 'bg-[#1C2620]/[0.06] text-[#1C2620]/50' : 'bg-white/50 border border-[#1C2620]/[0.1] text-[#1C2620]/80'}`}
                          >
                            − Pas nécessaire
                          </button>
                          <button
                            type="button"
                            onClick={() => toggleForgetReminded(it.id)}
                            className={`px-2 py-1 rounded-lg text-xs font-semibold transition-colors ${forgetReminded.has(it.id) ? 'bg-[#8C6A1A]/10 text-[#8C6A1A] border border-[#8C6A1A]/30' : 'bg-white/50 border border-[#1C2620]/[0.1] text-[#1C2620]/80'}`}
                          >
                            ⏰ Rappel demain
                          </button>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => toggleForgetChecked(it.id)}
                        aria-pressed={checked}
                        className={`w-11 h-11 rounded-lg border shrink-0 flex items-center justify-center transition-all ${checked ? 'bg-[#2D5A3D] border-[#2D5A3D] text-white' : 'border-[#1C2620]/30 text-transparent hover:border-[#1C2620]/60 hover:bg-white/60'}`}
                        aria-label={checked ? `Décocher ${it.label}` : `Cocher ${it.label}`}
                      >
                        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="3"><path d="M5 12l5 5L20 7" /></svg>
                      </button>
                    </div>
                  );
                })}
              </section>
            );
          })}
          {forgetItems.length === 0 && (
            <section className="rounded-3xl bg-white/60 border border-[#1C2620]/[0.07] p-6 text-center">
              <p className="text-xs text-[#1C2620]/60">Aucune information à signaler pour le moment.</p>
            </section>
          )}
        </div>
      );
    } else if (id === 'alerts') {
      subtitle = 'Consolidation des alertes opérationnelles';
      const kinds = [
        { k: '', label: 'Toutes' },
        { k: 'replace', label: 'Remplacer' },
        { k: 'expiry', label: 'Périmé' },
        { k: 'maintenance', label: 'Entretien' },
        { k: 'loan', label: 'Prêt' },
      ] as const;
      const shown = alertFilter ? alerts.filter((a) => a.kind === alertFilter) : alerts;
      body = (
        <div className="space-y-4">
          <section className="rounded-3xl bg-white/60 border border-[#1C2620]/[0.07] p-4 space-y-3">
            <div className="text-5xl font-extrabold font-mono leading-none text-[#8C6A1A]">{alerts.length}</div>
            <p className="text-xs text-[#1C2620]/70">{alerts.length === 0 ? 'Aucune alerte active' : 'alertes actives'}</p>
            <div className="flex gap-1.5 flex-wrap">
              {kinds.map((kind) => (
                <button
                  key={kind.k || 'all'}
                  type="button"
                  onClick={() => { triggerHaptic('light'); setAlertFilter(kind.k); }}
                  className={`px-2.5 py-1 rounded-full text-xs font-bold ${alertFilter === kind.k ? 'bg-[#2D5A3D] text-white' : 'bg-white/50 text-[#1C2620]/80 border border-[#1C2620]/[0.1]'}`}
                >
                  {kind.label}
                </button>
              ))}
            </div>
          </section>
          {shown.length === 0 ? (
            <section className="rounded-3xl bg-white/60 border border-[#1C2620]/[0.07] p-6 text-center">
              <p className="text-xs text-[#1C2620]/60">Aucune alerte dans cette catégorie ✨</p>
            </section>
          ) : (
            <div className="space-y-2">
              {shown.map((a) => (
                <div key={a.id} className="p-3 rounded-2xl bg-white/60 border border-[#1C2620]/[0.07] text-xs flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[#1C2620]/90 font-semibold truncate">{a.label}</p>
                    <p className="text-[#1C2620]/60">
                      {a.kind === 'maintenance' && 'Révision planifiée dépassée'}
                      {a.kind === 'expiry' && 'Produit arrivé à péremption'}
                      {a.kind === 'replace' && 'État dégradé — à réparer ou remplacer'}
                      {a.kind === 'loan' && `Prêté à ${a.borrower || 'un ami'}`}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => { setSelectedItemId(a.itemId); setExpandedWidget(null); setIsDetailDrawerOpen(true); }}
                    className="px-2.5 py-1 rounded-lg bg-[#2D5A3D]/10 border border-[#2D5A3D]/30 text-[#2D5A3D] text-xs font-bold shrink-0"
                  >
                    Corriger ➔
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      );
    } else if (id === 'kits') {
      subtitle = 'Création, édition, sélection et corbeille';
      body = (
        <div className="space-y-4">
          <section className="rounded-3xl bg-white/60 border border-[#1C2620]/[0.07] p-4 space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-5xl font-extrabold font-mono leading-none text-[#2D5A3D]">{kits.length}</div>
                <p className="text-xs text-[#1C2620]/70 mt-2">kit(s) actifs · {formatWeight(kits.reduce((s, k) => s + (k.total_weight_g || 0), 0))}</p>
              </div>
              <div className="flex gap-2">
                <button type="button" onClick={handleCreateNewKit} className="px-4 py-2 rounded-full bg-[#2D5A3D] text-white text-xs font-bold">+ Nouveau kit</button>
                {trashCount > 0 && (
                  <button type="button" onClick={() => { setExpandedWidget(null); setIsTrashModalOpen(true); }} className="px-4 py-2 rounded-full bg-white/50 border border-[#1C2620]/[0.1] text-[#1C2620]/80 text-xs font-bold">Corbeille ({trashCount})</button>
                )}
              </div>
            </div>
          </section>

          <div className="grid gap-3 lg:grid-cols-2">
            {kits.length === 0 && (
              <section className="rounded-3xl bg-white/60 border border-[#1C2620]/[0.07] p-6 text-center lg:col-span-2">
                <p className="text-xs text-[#1C2620]/60">Aucun kit actif — créez votre premier kit.</p>
              </section>
            )}
            {kits.map((kit) => {
              const missing = activeKit?.id === kit.id ? hikeReadiness.missingItems.length : null;
              return (
                <section key={kit.id} className="rounded-3xl bg-white/60 border border-[#1C2620]/[0.07] p-4 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <h3 className="text-sm font-extrabold text-[#1C2620] truncate">{kit.name}</h3>
                      <p className="text-xs text-[#1C2620]/60">{kit.items?.length || 0} articles · {kit.season || '3 saisons'}</p>
                    </div>
                    <span className="font-mono font-bold text-[#2D5A3D] shrink-0">{formatWeight(kit.total_weight_g || 0)}</span>
                  </div>
                  {missing !== null && (
                    <p className="text-xs text-[#C0532E] font-semibold">{missing > 0 ? `${missing} élément(s) manquant(s) au kit du prochain départ` : 'Kit complet pour le prochain départ ✓'}</p>
                  )}
                  <div className="flex flex-wrap gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => { setSelectedKitForCockpit(kit); setExpandedWidget(null); setIsKitDrawerOpen(true); }}
                      className="px-3 py-1.5 rounded-full bg-[#2D5A3D]/10 border border-[#2D5A3D]/30 text-[#2D5A3D] text-xs font-bold"
                    >
                      Ouvrir le kit
                    </button>
                    {activeHike && (
                      <button
                        type="button"
                        onClick={() => { handleAssignKitToHike(activeHike.id, kit.id); showToast(`Kit « ${kit.name} » assigné au départ`, 'success'); }}
                        disabled={activeHike.assignedKitId === kit.id}
                        className={`px-3 py-1.5 rounded-full text-xs font-bold disabled:opacity-50 ${activeHike.assignedKitId === kit.id ? 'bg-[#2D5A3D] text-white' : 'bg-white/50 border border-[#1C2620]/[0.1] text-[#1C2620]/80'}`}
                      >
                        {activeHike.assignedKitId === kit.id ? '✓ Assigné au départ' : 'Assigner au départ'}
                      </button>
                    )}
                  </div>
                </section>
              );
            })}
          </div>
        </div>
      );
    }

    return (
      <motion.div
      data-fullscreen
      layout
      layoutId={`lkdv-exp-${id}`}
      transition={{ type: 'spring', stiffness: 280, damping: 32, mass: 1.05 }}
      className="fixed inset-0 z-[5000] flex flex-col bg-[#FBFAF6]/50 backdrop-blur-md overflow-hidden"
    >
        <Header />
        <div className="flex-1 min-h-0 overflow-y-auto scrollbar-none pt-20 sm:pt-[88px]">
            <motion.div
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.26, duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
              className="max-w-5xl mx-auto p-4 sm:p-6 space-y-4"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  {iconChip}
                  <div className="min-w-0">
                    <h2 className="text-sm font-extrabold uppercase tracking-wider text-[#1C2620] truncate">{title}</h2>
                    {subtitle && <p className="text-xs text-[#1C2620]/60 truncate">{subtitle}</p>}
                  </div>
                </div>
                {closeBtn}
              </div>
              {body}
            </motion.div>
          </div>
        </motion.div>
    );
  };

const renderWidgetFrame = (id: string) => {
    return (
      <motion.div
        key={id}
        layoutId={`lkdv-exp-${id}`}
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
      </motion.div>
    );
  };

  return (
    <MotionConfig reducedMotion="user">
    <>
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
          style={{ filter: 'blur(8px) saturate(1.08) brightness(1.02)', opacity: 0.95 }}
        />
        <div className="absolute inset-0 bg-gradient-to-b from-[#F5F3EE]/45 via-[#F5F3EE]/20 to-[#F5F3EE]/45" />
        <div
          className="absolute inset-0"
          style={{ background: 'radial-gradient(ellipse at 50% 18%, rgba(255,255,255,0.2) 0%, transparent 60%)' }}
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
        <motion.div
          className="min-h-0 grid grid-cols-2 grid-flow-dense gap-3 items-stretch lg:grid-cols-4 lg:auto-rows-fr lg:flex-1 lg:min-h-0"
          animate={{ opacity: expandedWidget ? 0.35 : 1, scale: expandedWidget ? 0.985 : 1 }}
          transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
          style={{ transformOrigin: 'center top' }}
          onDragOver={(e) => e.preventDefault()}
        >
          {widgetOrder.map((id) => renderWidgetFrame(id))}
        </motion.div>
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

                  <section className="pt-2 border-t border-[#1C2620]/[0.07] space-y-2">
                    <div className="flex items-center justify-between">
                      <h3 className="text-xs font-extrabold uppercase tracking-wider text-[#1C2620] flex items-center gap-1.5"><span className="text-[#2D5A3D]"><IconSparkle /></span> Assistance IA</h3>
                      {aiMode === 'local' && (
                        <span className="px-2 py-0.5 rounded-full bg-[#8C6A1A]/10 border border-[#8C6A1A]/30 text-xs font-mono font-bold text-[#8C6A1A]">Mode dégradé</span>
                      )}
                      {aiMode === 'live' && (
                        <span className="px-2 py-0.5 rounded-full bg-[#2D5A3D]/10 border border-[#2D5A3D]/30 text-xs font-mono font-bold text-[#2D5A3D]">IA en ligne</span>
                      )}
                    </div>
                    <div ref={aiScrollRef} className="space-y-1.5 text-xs max-h-[180px] overflow-y-auto scrollbar-none pr-0.5">
                      {aiResponse ? (
                        <div className="p-3 rounded-2xl bg-white/50 border border-[#1C2620]/[0.08] shadow-inner">
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
                      className="flex items-center gap-1.5 rounded-xl bg-white/50 border border-[#1C2620]/[0.09] px-2 py-1.5"
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

      {/* ═══ VUE FULLSCREEN D'UN WIDGET (bouton Agrandir) — hors root stacking context ═══ */}
      <AnimatePresence>
        {expandedWidget !== null && renderExpandedWidget(expandedWidget)}
      </AnimatePresence>
    </>
    </MotionConfig>
  );
}

