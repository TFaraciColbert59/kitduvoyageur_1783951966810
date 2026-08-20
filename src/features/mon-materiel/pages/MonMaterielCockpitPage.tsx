'use client';

/**
 * LKDV — Mon Matériel (v3)
 * Cockpit 6 cartes en grille 3×2 (desktop) / 1 col (mobile), six vues plein écran,
 * drawer « Tout voir » (Inventaire · Prêts & Alertes · Réglages · Actions),
 * modales réelles (fiche, ajout/édition, kit, prêt) et Copilote IA (fallback local).
 *
 * Architecture v3 : la logique métier vit dans `src/features/mon-materiel/domain`,
 * les appels Supabase dans `src/features/mon-materiel/services`, les hooks dérivés
 * dans `src/features/mon-materiel/hooks`. Cette page orchestre uniquement.
 */

import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import Link from 'next/link';
import { MotionConfig, AnimatePresence } from 'framer-motion';
import Header from '@/components/Header';
import { useEquipment, UserEquipmentItem, UnifiedProduct } from '@/hooks/useEquipment';
import { useUserKits, CustomKit } from '@/hooks/useUserKits';
import { useAuth } from '@/contexts/AuthContext';
import { useHapticFeedback } from '@/hooks/useHapticFeedback';
import AddEditGearModal from '@/components/inventaire/AddEditGearModal';
import GearDetailDrawer from '@/components/inventaire/GearDetailDrawer';
import KitCockpitDrawer from '@/components/inventaire/KitCockpitDrawer';
import LendItemModal from '@/components/inventaire/LendItemModal';
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
import {
  getStreamingChatCompletion,
  GEMINI_PROVIDER,
  GEMINI_DEFAULT_MODEL,
} from '@/lib/ai/chatCompletion';
import type { GearStatusContext, OrderedProductItem, GearDestination } from '@/features/mon-materiel/types';
import {
  getEquipmentDestination,
  listEquipmentDestinations,
  clearEquipmentDestination,
  setEquipmentDestination,
} from '@/lib/storage/equipmentDestinations';

// ── Domaine & services ─────────────────────────────────────────────────────────
import {
  buildDepartureChecklist,
  evaluateDepartureReadiness,
  buildDepartureSnapshot,
  countdownLabel,
  formatWeight,
  formatTemp,
  kitTotalWeight,
  newHikeFormSchema,
} from '@/features/mon-materiel/domain';
import {
  GearService,
  OrderService,
  LoanService,
  kitMembershipIds,
  hikeCommittedGearIds,
} from '@/features/mon-materiel/services';
import {
  useGearStatus,
  useGearAlerts,
  useGearAvailability,
} from '@/features/mon-materiel/hooks';
import {
  MonMaterielGrid,
  GearCard,
  FullscreenShell,
  IconChecklist,
  IconBell,
  IconBackpack,
  IconNav,
  IconBox,
  IconCalendar,
  IconSparkle,
  IconPlus,
  IconClock,
  IconScale,
  IconClose,
} from '@/features/mon-materiel/components';
import {
  CountdownLive,
  MiniBars,
  MiniDonut,
  MiniTimeline,
  StackedAvatars,
} from '@/features/mon-materiel/components/shared';
import { WeatherService } from '@/features/hiking/services/WeatherService';
import dynamic from 'next/dynamic';
import type { DepartureConsumables, AlertsFilterKey } from '@/features/mon-materiel/fullscreen';

// Imports dynamiques des six vues pleins écran (contrainte LKDV : composants lourds).
const NotToForgetFullscreen = dynamic(() =>
  import('@/features/mon-materiel/fullscreen').then((m) => m.NotToForgetFullscreen),
  { ssr: false, loading: () => <div className="h-24 animate-pulse rounded-3xl bg-white/35 border border-[#1C2620]/8" /> }
);
const NextDepartureFullscreen = dynamic(() =>
  import('@/features/mon-materiel/fullscreen').then((m) => m.NextDepartureFullscreen),
  { ssr: false, loading: () => <div className="h-24 animate-pulse rounded-3xl bg-white/35 border border-[#1C2620]/8" /> }
);
const AlertsReliabilityFullscreen = dynamic(() =>
  import('@/features/mon-materiel/fullscreen').then((m) => m.AlertsReliabilityFullscreen),
  { ssr: false, loading: () => <div className="h-24 animate-pulse rounded-3xl bg-white/35 border border-[#1C2620]/8" /> }
);
const MyKitsFullscreen = dynamic(() =>
  import('@/features/mon-materiel/fullscreen').then((m) => m.MyKitsFullscreen),
  { ssr: false, loading: () => <div className="h-24 animate-pulse rounded-3xl bg-white/35 border border-[#1C2620]/8" /> }
);
const InventoryCatalogFullscreen = dynamic(() =>
  import('@/features/mon-materiel/fullscreen').then((m) => m.InventoryCatalogFullscreen),
  { ssr: false, loading: () => <div className="h-24 animate-pulse rounded-3xl bg-white/35 border border-[#1C2620]/8" /> }
);
const AvailabilityFullscreen = dynamic(() =>
  import('@/features/mon-materiel/fullscreen').then((m) => m.AvailabilityFullscreen),
  { ssr: false, loading: () => <div className="h-24 animate-pulse rounded-3xl bg-white/35 border border-[#1C2620]/8" /> }
);

// ── Constantes & libellés ──────────────────────────────────────────────────────
const WIDGET_ORDER_KEY = 'lkdv_cockpit_widget_order';
const FORGET_CHECK_KEY = 'lkdv_forget_checked';
const VALIDATIONS_KEY = 'lkdv_departure_validations';
const DEFAULT_WIDGET_ORDER = ['departure', 'kits', 'forget', 'alerts', 'inventory', 'availability'];
const DEFAULT_TARGET_KG = 8;

const WIDGET_CARDS: Record<
  string,
  { label: string; title: string; icon: React.ReactNode }
> = {
  forget: { label: 'À ne pas oublier', title: 'À ne pas oublier', icon: <IconChecklist /> },
  alerts: { label: 'Alertes & fiabilité', title: 'Alertes & fiabilité', icon: <IconBell /> },
  kits: { label: 'Mes kits', title: 'Mes kits', icon: <IconBackpack /> },
  departure: { label: 'Prochain départ', title: 'Prochain départ', icon: <IconNav /> },
  inventory: { label: 'Inventaire & catalogue', title: 'Inventaire & catalogue', icon: <IconBox /> },
  availability: { label: 'Disponibilité', title: 'Disponibilité', icon: <IconCalendar /> },
};

function buildHikeContext(h: PlannedHike): DepartureHikeContext {
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

interface DepartureValidationSnapshot {
  id: string;
  departureName: string;
  validatedAt: string;
  status: string;
}

export default function MonMaterielCockpitPage() {
  const { triggerHaptic } = useHapticFeedback();
  const { user } = useAuth();

  // ── Hooks réels (équipement, kits, data) ────────────────────────────────────
  const {
    equipment,
    products,
    addToEquipment,
    removeFromEquipment,
    updateEquipment,
    addToCart,
    loading: equipmentLoading,
    error: equipmentError,
    refresh: refreshEquipment,
  } = useEquipment();

  const {
    kits,
    trashKits,
    trashCount,
    updateKit,
    moveToTrash,
    createKit,
    restoreFromTrash,
    permanentDelete,
    addGearToKit,
    loading: kitsLoading,
  } = useUserKits(equipment);

  // ── Randonnées planifiées (source partagée) ────────────────────────────────
  const [plannedHikes, setPlannedHikes] = useState<PlannedHike[]>([]);
  const [selectedHikeId, setSelectedHikeId] = useState<string | null>(null);

  useEffect(() => {
    const all = getPlannedHikes();
    setPlannedHikes(all);
    const active = getActivePlannedHike();
    setSelectedHikeId((prev) => prev ?? active?.id ?? all[0]?.id ?? null);
  }, []);

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === 'lkdv_planned_hikes') setPlannedHikes(getPlannedHikes());
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  // ── Contexte du domaine (loans, commandes, engagement) ──────────────────────
  const [activeLoans, setActiveLoans] = useState<Awaited<ReturnType<GearService['listActiveLoans']>>>([]);
  const [orderedItems, setOrderedItems] = useState<OrderedProductItem[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const gearService = new GearService();
      const orderService = new OrderService();
      const [loans, items] = await Promise.all([
        user ? gearService.listActiveLoans(user.id) : Promise.resolve([] as Awaited<ReturnType<GearService['listActiveLoans']>>),
        user ? orderService.listOrderItems(user.id, listEquipmentDestinations()) : Promise.resolve([] as OrderedProductItem[]),
      ]);
      if (cancelled) return;
      setActiveLoans(loans);
      setOrderedItems(items);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const refreshOrders = useCallback(async () => {
    if (!user) return;
    const orderService = new OrderService();
    const items = await orderService.listOrderItems(user.id, listEquipmentDestinations());
    setOrderedItems(items);
  }, [user]);

  const activeHike = useMemo(
    () => plannedHikes.find((h) => h.id === selectedHikeId) || plannedHikes[0] || null,
    [plannedHikes, selectedHikeId]
  );
  const activeKit = useMemo(() => {
    if (activeHike?.assignedKitId) {
      const found = kits.find((k) => k.id === activeHike.assignedKitId);
      if (found) return found;
    }
    return kits[0] || null;
  }, [kits, activeHike]);

  const committedGearIds = useMemo(() => hikeCommittedGearIds(activeKit), [activeKit]);
  const membershipIds = useMemo(() => kitMembershipIds(kits), [kits]);

  const context: GearStatusContext = useMemo(
    () => ({
      now: new Date(),
      activeLoans,
      orderedItems,
      hikeCommittedGearIds: committedGearIds,
      kitMembershipIds: membershipIds,
      activeDeparture: activeHike
        ? { id: activeHike.id, name: activeHike.name, targetDate: activeHike.targetDate, assignedKitId: activeHike.assignedKitId }
        : null,
      kits,
      plannedHikes,
    }),
    [activeLoans, orderedItems, committedGearIds, membershipIds, activeHike, kits, plannedHikes]
  );

  const statuses = useGearStatus(equipment, context);
  const { alerts, criticalCount, warningCount } = useGearAlerts(equipment, context);
  const availabilityMap = useGearAvailability(equipment, context);

  // ── Préparation (checklist, readiness) ─────────────────────────────────────
  const checklist = useMemo(
    () => (activeHike ? buildDepartureChecklist(activeHike, activeKit, equipment, alerts) : []),
    [activeHike, activeKit, equipment, alerts]
  );
  const readiness = useMemo(
    () => (activeHike ? evaluateDepartureReadiness(activeHike, activeKit, equipment, alerts) : null),
    [activeHike, activeKit, equipment, alerts]
  );

  const departurePlan = useMemo(() => {
    if (!activeHike) return null;
    try {
      return resolveDeparturePlan(buildHikeContext(activeHike), kits, equipment);
    } catch {
      return null;
    }
  }, [activeHike, kits, equipment]);
  const recommendedKit = departurePlan?.selectedKit ?? null;

  const weatherDays = useMemo<Array<{ day: string; temp: number; condition: string; icon: string }>>(() => {
    if (!activeHike) return [];
    const seed = activeHike.id.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
    const conditions = ['Ensoleillé', 'Partiellement nuageux', 'Averses', 'Pluie légère', 'Orage'];
    const icons = ['☀️', '⛅', '🌦', '🌧', '⛈'];
    const baseTemp = (activeHike.weather as any)?.tempC ?? 12;
    return [0, 1, 2].map((i) => {
      const idx = (seed + i) % conditions.length;
      return {
        day: i === 0 ? 'Auj.' : i === 1 ? 'Demain' : `J+${i}`,
        temp: Math.round(baseTemp + ((seed % 5) - 2) * i * 0.5),
        condition: conditions[idx],
        icon: icons[idx],
      };
    });
  }, [activeHike]);

  useEffect(() => {
    if (!activeHike || (activeHike.weather && (activeHike.weather as any).fetchedAt)) return;
    const hike = activeHike;
    let cancelled = false;
    async function load() {
      const res = await WeatherService.fetchWeather(45.4, 6.5);
      if (cancelled || !res) return;
      const updated = updatePlannedHike(hike.id, { weather: res as any });
      setPlannedHikes((prev) => prev.map((h) => (h.id === hike.id ? updated.find((u) => u.id === hike.id) ?? h : h)));
    }
    void load();
    return () => { cancelled = true; };
  }, [activeHike]);

  // ── États d'interface ───────────────────────────────────────────────────────
  const [widgetOrder, setWidgetOrder] = useState<string[]>(DEFAULT_WIDGET_ORDER);
  const [widgetOrderLoaded, setWidgetOrderLoaded] = useState(false);
  const [expandedWidget, setExpandedWidget] = useState<string | null>(null);
  const expandOriginRef = useRef<HTMLElement | null>(null);
  const [inventoryInitialQuery, setInventoryInitialQuery] = useState('');
  const [forgetChecked, setForgetChecked] = useState<Set<string>>(new Set());
  const [alertFilter, setAlertFilter] = useState<AlertsFilterKey>('all');
  const [resolvedAlerts, setResolvedAlerts] = useState<Set<string>>(new Set());
  const [targetKg, setTargetKg] = useState<number>(DEFAULT_TARGET_KG);

  const [voirToutOpen, setVoirToutOpen] = useState(false);
  const [voirToutTab, setVoirToutTab] = useState<'inventaire' | 'prets' | 'reglages' | 'actions'>('inventaire');

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<UserEquipmentItem | null>(null);
  const [isDetailDrawerOpen, setIsDetailDrawerOpen] = useState(false);
  const [isKitDrawerOpen, setIsKitDrawerOpen] = useState(false);
  const [selectedKitForCockpit, setSelectedKitForCockpit] = useState<CustomKit | null>(null);
  const [isLendModalOpen, setIsLendModalOpen] = useState(false);
  const [isNewHikeModalOpen, setIsNewHikeModalOpen] = useState(false);
  const [selectedGearId, setSelectedGearId] = useState<string | null>(null);

  // New hike form
  const [newHikeName, setNewHikeName] = useState('');
  const [newHikeDest, setNewHikeDest] = useState('');
  const [newHikeDays, setNewHikeDays] = useState(2);
  const [newHikeKm, setNewHikeKm] = useState(30);
  const [newHikeDPlus, setNewHikeDPlus] = useState(1500);
  const [newHikeCompanions, setNewHikeCompanions] = useState('');

  // AI Copilot
  const [aiInput, setAiInput] = useState('');
  const [aiResponse, setAiResponse] = useState('');
  const [aiStreaming, setAiStreaming] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiMode, setAiMode] = useState<'live' | 'local' | null>(null);
  const aiScrollRef = useRef<HTMLDivElement | null>(null);

  // Toast
  const [toastMessage, setToastMessage] = useState<{ id: number; text: string; type?: 'success' | 'info' | 'warning' } | null>(null);
  const showToast = useCallback((text: string, type: 'success' | 'info' | 'warning' = 'success') => {
    setToastMessage({ id: Date.now(), text, type });
    setTimeout(() => {
      setToastMessage((cur) => (cur && Date.now() - cur.id >= 2400 ? null : cur));
    }, 2500);
  }, []);

  // ── Persistance (layout, checklist, objectif) ──────────────────────────────
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
      /* ignore */
    }
    setWidgetOrderLoaded(true);
  }, []);

  useEffect(() => {
    if (!widgetOrderLoaded) return;
    try {
      window.localStorage.setItem(WIDGET_ORDER_KEY, JSON.stringify(widgetOrder));
    } catch {
      /* ignore */
    }
  }, [widgetOrder, widgetOrderLoaded]);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(FORGET_CHECK_KEY);
      if (raw) setForgetChecked(new Set(JSON.parse(raw) as string[]));
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem('lkdv_cockpit_target_kg');
      if (raw) setTargetKg(Number(raw) || DEFAULT_TARGET_KG);
    } catch {
      /* ignore */
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
        /* ignore */
      }
      return next;
    });
    triggerHaptic('light');
  };

  // ── Dérivés de métrique (cards) ─────────────────────────────────────────────
  const totalWeightG = useMemo(
    () => equipment.reduce((sum, it) => sum + (it.weight_g || 0) * (it.quantity || 1), 0),
    [equipment]
  );
  const totalValue = useMemo(
    () => equipment.reduce((sum, it) => sum + (Number(it.purchase_price) || 0) * (it.quantity || 1), 0),
    [equipment]
  );
  const unavailableCount = useMemo(
    () => Array.from(availabilityMap.values()).filter((a) => !a.available).length,
    [availabilityMap]
  );
  const lentCount = useMemo(
    () => equipment.filter((e) => e.loan_status === 'prêté' || Boolean(e.loan_to_name)).length,
    [equipment]
  );
  const forgetRemaining = useMemo(
    () => checklist.filter((c) => (c.level === 'critique' || c.level === 'verifier') && !forgetChecked.has(c.id)).length,
    [checklist, forgetChecked]
  );
  const committedGear = useMemo(
    () => equipment.filter((e) => committedGearIds.includes(e.id)),
    [equipment, committedGearIds]
  );

  // ── Actions partagées ───────────────────────────────────────────────────────
  const handleToggleFavorite = useCallback(
    async (item: UserEquipmentItem) => {
      await updateEquipment(item.id, { is_favorite: !item.is_favorite });
      triggerHaptic('light');
    },
    [updateEquipment, triggerHaptic]
  );

  const handleOpenGear = (gearId: string) => {
    setExpandedWidget(null);
    const item = equipment.find((e) => e.id === gearId);
    if (item) {
      setEditingItem(null);
      setVoirToutOpen(false);
      setIsDetailDrawerOpen(true);
      setSelectedGearId(gearId);
    }
  };

  const activeItem = useMemo(
    () => equipment.find((e) => e.id === selectedGearId) || null,
    [equipment, selectedGearId]
  );

  const handleAddGearToKit = async (gearId: string, kitId: string) => {
    const gear = equipment.find((g) => g.id === gearId);
    if (!gear) return;
    await addGearToKit(kitId, gear);
  };

  const handleAddToCartWithDestination = (product: UnifiedProduct, destination?: GearDestination) => {
    addToCart(product, 1);
    if (destination) {
      setEquipmentDestination(product.id, destination);
    }
  };

  const handleConfirmReception = async (ordered: OrderedProductItem) => {
    if (!user) {
      showToast('Connectez-vous pour recevoir une commande dans l’inventaire', 'warning');
      return;
    }
    const product =
      products.find((p) => p.id === ordered.productId) ||
      products.find((p) => p.name === ordered.name) ||
      null;
    const orderService = new OrderService();
    const result = await orderService.confirmReception({
      userId: user.id,
      ordered,
      product,
      equipment,
      destination: getEquipmentDestination(ordered.productId || ordered.slug || ordered.name),
      onAttachToKit: async (kitId, gear) => {
        // Rattachement : ajout de l'item dans le kit cible.
        await addGearToKit(kitId, gear);
      },
    });
    if (result.ok && result.gear) {
      clearEquipmentDestination(ordered.productId || ordered.slug || ordered.name);
      await refreshOrders();
      showToast(`« ${result.gear.name} » ajouté à l’inventaire`, 'success');
    } else if (result.duplicate) {
      showToast('Déjà présent dans l’inventaire — réception annulée', 'warning');
    } else {
      showToast(result.error || 'Réception impossible', 'warning');
    }
  };

  const handleMarkReviewed = async (gearId: string) => {
    const service = new GearService();
    await service.markReviewed(gearId, { last_maintenance_date: new Date().toISOString().split('T')[0] });
    await updateEquipment(gearId, {
      last_maintenance_date: new Date().toISOString().split('T')[0],
      next_maintenance_date: null,
    });
    setResolvedAlerts((prev) => new Set(prev).add(`maintenance_due-${gearId}`));
  };

  const handleToggleResolved = (id: string) => {
    if (id === '__all__') {
      setResolvedAlerts(new Set());
      return;
    }
    setResolvedAlerts((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleValidatePreparation = () => {
    if (!activeHike) return;
    const snapshot = buildDepartureSnapshot(activeHike, activeKit, equipment, [...forgetChecked], alerts);
    try {
      const raw = window.localStorage.getItem(VALIDATIONS_KEY);
      const list: DepartureValidationSnapshot[] = raw ? JSON.parse(raw) : [];
      list.unshift({
        id: snapshot.id,
        departureName: snapshot.departureName,
        validatedAt: snapshot.createdAt,
        status: snapshot.status,
      });
      window.localStorage.setItem(VALIDATIONS_KEY, JSON.stringify(list.slice(0, 20)));
    } catch {
      /* ignore */
    }
    showToast(`Préparation « ${snapshot.departureName} » validée (${snapshot.status})`, 'success');
  };

  const handleAssignKit = (hikeId: string, kitId: string) => {
    const updated = updatePlannedHike(hikeId, { assignedKitId: kitId });
    setPlannedHikes(updated);
    const kitObj = kits.find((k) => k.id === kitId);
    showToast(`Kit « ${kitObj?.name || 'Sélectionné'} » assigné`, 'success');
  };

  const handleSelectHike = (h: PlannedHike) => {
    setSelectedHikeId(h.id);
    setActivePlannedHikeId(h.id);
    if (h.assignedKitId) setSelectedKitForCockpit(null);
  };

  const handleDeleteHike = (hikeId: string) => {
    const hike = plannedHikes.find((h) => h.id === hikeId);
    if (!hike) return;
    if (!window.confirm(`Supprimer la sortie « ${hike.name} » ?`)) return;
    const remaining = removePlannedHike(hikeId);
    setPlannedHikes(remaining);
    setSelectedHikeId(remaining[0]?.id ?? null);
    showToast('Sortie supprimée', 'info');
  };

  const handleCreateHike = (e: React.FormEvent) => {
    e.preventDefault();
    // Validation stricte (Zod) des entrées utilisateur.
    const parsed = newHikeFormSchema.safeParse({
      name: newHikeName,
      terrainMassif: newHikeDest,
      days: newHikeDays,
      distanceKm: newHikeKm,
      elevationGain: newHikeDPlus,
      companions: newHikeCompanions,
    });
    if (!parsed.success) {
      showToast(parsed.error.issues[0]?.message || 'Formulaire invalide', 'warning');
      return;
    }
    const target = new Date();
    target.setDate(target.getDate() + 30);
    const newHike = savePlannedHike({
      name: parsed.data.name,
      distanceKm: parsed.data.distanceKm,
      elevationGain: parsed.data.elevationGain,
      targetDate: target.toISOString().split('T')[0],
      difficulty: 'Moyen',
      season: 'Toutes saisons',
      terrain: parsed.data.terrainMassif || 'Massif Alpin',
      isOvernight: parsed.data.days > 1,
      nightsCount: parsed.data.days > 1 ? parsed.data.days - 1 : 0,
      assignedKitId: kits[0]?.id,
      companions: parsed.data.companions || undefined,
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

  const handleCreateNewKit = async () => {
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

  const handleDuplicateKit = async (kit: CustomKit) => {
    const created = await createKit({
      name: `${kit.name} (copie)`,
      description: kit.description,
      for_destination: kit.for_destination,
      season: kit.season,
      activity: kit.activity,
      source: 'manuel',
      gearItems: (kit.items || []).map((i) => ({
        gear_item_id: i.gear_item_id,
        item_name: i.item_name,
        category: i.category,
        weight_g: i.weight_g,
        quantity: i.quantity,
        is_essential: i.is_essential,
      })),
    });
    if (created) showToast(`Kit « ${created.name} » créé`, 'success');
  };

  // ── Réordonnancement : drag & drop ANIMÉ (framer-motion Reorder) ─────────────
  const handleReorder = (next: string[]) => {
    setWidgetOrder(next);
    triggerHaptic('selection');
  };
  const resetWidgetOrder = () => {
    setWidgetOrder([...DEFAULT_WIDGET_ORDER]);
    showToast('Disposition des cartes réinitialisée', 'info');
  };

  // ── Copilote IA (fallback local) ─────────────────────────────────────────────
  const generateLocalAiAdvice = useCallback(() => {
    const sorted = [...equipment].sort((a, b) => (b.weight_g || 0) - (a.weight_g || 0));
    const heaviest = sorted.slice(0, 3);
    const targetG = targetKg * 1000;
    const diffG = totalWeightG - targetG;
    const diff = diffG > 0 ? `+${formatWeight(diffG)} au-dessus` : `${formatWeight(Math.abs(diffG))} sous`;
    let advice = `Analyse LKDV de votre pack :\n\n`;
    advice += `• Poids total inventorié : ${formatWeight(totalWeightG)} (${diff} de l’objectif ${targetKg} kg).\n`;
    if (activeHike) {
      advice += `• Sortie active : ${activeHike.name} (${activeHike.distanceKm} km, +${activeHike.elevationGain || 0} m D+).\n`;
    }
    advice += `• Top 3 des articles les plus lourds :\n`;
    heaviest.forEach((it, idx) => {
      advice += `  ${idx + 1}. ${it.name} — ${formatWeight(it.weight_g || 0)}\n`;
    });
    advice += `\nRecommandation : allégez d’abord les 2 articles les plus lourds, contrôlez les doublons textiles et mutualisez les consommables avec votre groupe.`;
    return advice;
  }, [equipment, totalWeightG, targetKg, activeHike]);

  const refreshData = useCallback(() => {
    void refreshEquipment();
    showToast('Données rechargées', 'info');
  }, [refreshEquipment, showToast]);

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
            "Tu es le Copilote Équipement du Kit du Voyageur, expert en optimisation de packs. Tu réponds en français, de façon concise et actionnable. Base-toi UNIQUEMENT sur l'inventaire fourni.",
        },
        {
          role: 'user',
          content: `Inventaire (${equipment.length} articles, ${formatWeight(totalWeightG)}, objectif ${targetKg} kg):\n${inventorySummary}\n\nDemande: ${q}`,
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
          () => {
            if (!receivedAnyChunk) {
              setAiMode('local');
              setTimeout(() => {
                setAiResponse(generateLocalAiAdvice());
                setAiStreaming(false);
              }, 250);
            } else {
              setAiStreaming(false);
            }
          },
          { temperature: 0.6, max_tokens: 700 }
        );
      } catch {
        setAiMode('local');
        setAiResponse(generateLocalAiAdvice());
        setAiStreaming(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [aiStreaming, equipment, totalWeightG, targetKg, triggerHaptic, generateLocalAiAdvice]
  );

  // ── Focus restore après fermeture plein écran ────────────────────────────────
  useEffect(() => {
    if (expandedWidget === null) {
      const t = setTimeout(() => expandOriginRef.current?.focus(), 0);
      return () => clearTimeout(t);
    }
  }, [expandedWidget]);

  // Pré-filtre « Inventaire & catalogue » jetable une fois consommé.
  useEffect(() => {
    if (expandedWidget === 'inventory' && inventoryInitialQuery) {
      const t = setTimeout(() => setInventoryInitialQuery(''), 600);
      return () => clearTimeout(t);
    }
  }, [expandedWidget, inventoryInitialQuery]);

  // ── Render : 6 cartes ────────────────────────────────────────────────────────
  const cardMetric = (id: string): {
    metric: React.ReactNode;
    caption: string;
    badges: GearCardBadge[];
    progress?: { value: number; label?: string; tone?: 'default' | 'success' | 'warning' | 'critical' };
    secondaryMetrics?: { label: string; value: React.ReactNode }[];
    footerText?: React.ReactNode;
    footerAction?: { label: string; onClick: () => void };
    status?: { level: 'ok' | 'warning' | 'critical' | 'info' | 'neutral'; label: string };
    richBody?: React.ReactNode;
  } => {
    switch (id) {
      case 'forget': {
        const total = checklist.length;
        const checked = checklist.filter((c) => forgetChecked.has(c.id)).length;
        const pct = total > 0 ? Math.round((checked / total) * 100) : 100;
        const urgentItems = checklist.filter((c) => c.level === 'critique' || c.level === 'verifier').slice(0, 3);
        return {
          metric: String(forgetRemaining),
          caption: forgetRemaining > 0 ? 'élément(s) à vérifier' : 'Tout est en ordre ✓',
          progress: {
            value: pct,
            label: 'Checklist',
            tone: pct === 100 ? 'success' : pct < 50 ? 'warning' : 'default',
          },
          secondaryMetrics: [
            { label: 'Cochés', value: `${checked}/${total}` },
            { label: 'Urgents', value: urgentItems.length },
          ],
          badges:
            checklist.filter((c) => c.level === 'pret').length > 0
              ? [{ id: 'pret', label: `${checklist.filter((c) => c.level === 'pret').length} prêt(s)`, tone: 'success' as const }]
              : [],
          footerText: activeHike ? `Départ ${countdownLabel(activeHike.targetDate)}` : 'Aucun départ',
          footerAction: { label: 'Voir tout →', onClick: () => setExpandedWidget('forget') },
        status: { level: forgetRemaining > 0 ? 'critical' : 'ok', label: forgetRemaining > 0 ? 'Bloquant' : 'Ok' },
        };
      }
      case 'alerts': {
        const totalItems = equipment.length || 1;
        const penalty = criticalCount * 25 + warningCount * 10;
        const healthScore = Math.max(0, Math.min(100, 100 - Math.round((penalty / totalItems) * 10)));
        const worstAlert = alerts.find(a => a.severity === 'critical') ?? alerts[0];
        // Count alerts by cause categories
        const maintenanceCount = alerts.filter(a => a.kind === 'maintenance_due' || a.kind === 'maintenance_soon').length;
        const expiryCount = alerts.filter(a => a.kind === 'expired' || a.kind === 'expiring_soon').length;
        const wearCount = alerts.filter(a => a.kind === 'wear_replace' || a.kind === 'wear_repair').length;
        const loanCount = alerts.filter(a => a.kind === 'loan_active' || a.kind === 'loan_overdue').length;
        return {
          metric: String(alerts.length),
          caption: criticalCount > 0 ? `${criticalCount} action(s) critique(s)` : 'Aucune alerte critique',
          progress: {
            value: healthScore,
            label: 'Fiabilité',
            tone: criticalCount > 0 ? 'critical' : warningCount > 0 ? 'warning' : 'success',
          },
          secondaryMetrics: [
            { label: 'Score', value: `${healthScore}%` },
            { label: 'Warnings', value: warningCount },
          ],
          badges: criticalCount > 0
            ? [{ id: 'crit', label: `${criticalCount} critique(s)`, tone: 'critical' as const }]
            : warningCount > 0
            ? [{ id: 'warn', label: `${warningCount} à surveiller`, tone: 'warning' as const }]
            : [],
          footerText: worstAlert ? `⚠ ${worstAlert.label ?? worstAlert.detail ?? 'Voir détail'}` : 'Équipement sain',
          footerAction: alerts.length > 0 ? { label: 'Voir détail →', onClick: () => setExpandedWidget('alerts') } : undefined,
        status: { level: criticalCount > 0 ? 'critical' : warningCount > 0 ? 'warning' : 'ok', label: criticalCount > 0 ? 'Bloquant' : warningCount > 0 ? 'À vérifier' : 'Ok' },
          richBody: (
            <MiniBars
              data={[
                { label: 'Maintenance', value: maintenanceCount },
                { label: 'Péremption', value: expiryCount },
                { label: 'Usure', value: wearCount },
                { label: 'Prêt', value: loanCount },
              ]}
            />
          ),
        };
      }
      case 'kits': {
        const activeKits = kits.filter((k) => k.status !== 'trash');
        const avgCompleteness = activeKits.length > 0
          ? Math.round(
              activeKits.reduce((acc, k) => {
                const c = k.items.length > 0 ? (k.items.filter(i => equipment.some(e => e.id === i.gear_item_id)).length / k.items.length) * 100 : 0;
                return acc + c;
              }, 0) / activeKits.length
            )
          : 0;
        const totalKitWeight = kits.reduce((s, k) => s + kitTotalWeight(k), 0);
        const nearestKit = activeHike?.assignedKitId
          ? kits.find(k => k.id === activeHike.assignedKitId)
          : activeKits[0];
        return {
          metric: String(kits.length),
          caption: `${formatWeight(totalKitWeight)} poids total`,
          progress: {
            value: activeKits.length > 0 ? avgCompleteness : 0,
            label: 'Complétude',
            tone: avgCompleteness >= 80 ? 'success' : avgCompleteness > 40 ? 'default' : 'warning',
          },
          secondaryMetrics: [
            { label: 'Actifs', value: activeKits.length },
            { label: 'Complétion', value: `${avgCompleteness}%` },
          ],
          badges: trashCount > 0 ? [{ id: 'trash', label: `${trashCount} corbeille`, tone: 'info' as const }] : [],
          footerText: nearestKit ? `Kit assigné : ${nearestKit.name}` : 'Aucun kit assigné',
          footerAction: { label: 'Gérer les kits →', onClick: () => setExpandedWidget('kits') },
        status: {
          level: activeKits.length === 0 ? 'neutral' : avgCompleteness >= 80 ? 'ok' : avgCompleteness > 40 ? 'warning' : 'critical',
          label: activeKits.length === 0 ? 'Aucun kit' : avgCompleteness >= 80 ? 'Complet' : avgCompleteness > 40 ? 'Incomplet' : 'Manque matériel',
        },
          richBody: (
            <div className="space-y-2">
              <StackedAvatars
                items={activeKits.slice(0, 3).map((k) => ({
                  id: k.id,
                  label: k.name,
                  fallbackIcon: '🎒',
                }))}
                max={3}
                size={32}
              />
              <div className="space-y-1.5">
                {activeKits.slice(0, 3).map((k) => {
                  const total = k.items.length;
                  const owned = k.items.filter((i) => equipment.some((e) => i.gear_item_id ? e.id === i.gear_item_id : e.name.trim().toLowerCase() === (i.item_name || '').trim().toLowerCase())).length;
                  const pct = total > 0 ? Math.round((owned / total) * 100) : 0;
                  return (
                    <div key={k.id} className="flex items-center justify-between text-xs p-1.5 rounded-lg bg-white/50 border border-[#1C2620]/7">
                      <span className="truncate font-medium text-[#1C2620]">{k.name}</span>
                      <span className="shrink-0 flex items-center gap-1.5">
                        <span className="h-1.5 w-12 rounded-full bg-[#1C2620]/8 overflow-hidden">
                          <span className={`block h-full rounded-full ${pct >= 80 ? 'bg-[#2D5A3D]' : pct >= 40 ? 'bg-[#8C6A1A]' : 'bg-[#9B2C2C]'}`} style={{ width: `${pct}%` }} />
                        </span>
                        <span className="font-mono font-bold text-[#2D5A3D]">{formatWeight(kitTotalWeight(k))}</span>
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          ),
        };
      }
      case 'departure': {
        const pct = readiness?.readinessPct ?? (activeHike ? 50 : 0);
        const pendingActions = readiness ? (readiness.blockers?.length ?? 0) + (readiness.toCheckCount ?? 0) : 0;
        return activeHike
          ? {
              metric: <CountdownLive targetDate={activeHike.targetDate} />,
              caption: activeHike.name,
              progress: {
                value: pct,
                label: 'Préparation',
                tone: readiness?.status === 'blocked' ? 'critical' : readiness?.status === 'to_check' ? 'warning' : 'success',
              },
              secondaryMetrics: [
                { label: 'Distance', value: `${activeHike.distanceKm} km` },
                { label: 'D+', value: `${activeHike.elevationGain ?? 0} m` },
                { label: 'Actions', value: pendingActions },
              ],
              badges:
                readiness?.status === 'blocked'
                  ? [{ id: 'blocked', label: 'Bloqué', tone: 'critical' as const }]
                  : readiness?.status === 'to_check'
                  ? [{ id: 'check', label: 'À vérifier', tone: 'warning' as const }]
                  : [{ id: 'ready', label: 'Prêt ✓', tone: 'success' as const }],
              footerText: pendingActions > 0 ? `${pendingActions} action(s) restante(s)` : 'Tout est prêt !',
              footerAction: { label: 'Checklist →', onClick: () => setExpandedWidget('departure') },
          status: {
            level: readiness?.status === 'blocked' ? 'critical' : readiness?.status === 'to_check' ? 'warning' : 'ok',
            label: readiness?.status === 'blocked' ? 'Bloqué' : readiness?.status === 'to_check' ? 'À vérifier' : 'Prêt',
          },
              richBody: (
                <div className="space-y-2">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    <PreviewStat value={`${activeHike.distanceKm}`} label="km" />
                    <PreviewStat value={`+${activeHike.elevationGain || 0}`} label="m D+" />
                    <PreviewStat value={`${activeHike.isOvernight ? (activeHike.nightsCount || 1) + 1 : 1}`} label="jours" />
                    <PreviewStat value={formatTemp(activeHike)} label="météo" />
                  </div>
                  <div className="flex gap-2 overflow-x-auto scrollbar-none pb-1">
                    {weatherDays.map((w) => (
                      <div key={w.day} className="flex flex-col items-center gap-1 rounded-xl bg-white/50 border border-[#1C2620]/8 p-2 min-w-[64px]">
                        <span className="text-lg leading-none">{w.icon}</span>
                        <span className="text-[10px] font-bold text-[#1C2620]">{w.temp}°C</span>
                        <span className="text-[9px] text-[#1C2620]/70 text-center leading-tight">{w.condition}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ),
            }
          : {
              metric: '—',
              caption: 'Aucune sortie planifiée',
              progress: { value: 0, label: 'Départ non défini', tone: 'default' },
              badges: [],
              footerAction: { label: 'Planifier une sortie', onClick: () => setIsNewHikeModalOpen(true) },
            };
      }
      case 'inventory': {
        const goodConditionCount = equipment.filter((e) => e.condition !== 'à_remplacer' && (e.condition as any) !== 'pour_pièces').length;
        const conditionPct = equipment.length > 0 ? Math.round((goodConditionCount / equipment.length) * 100) : 100;
        const recentItems = [...equipment].sort((a, b) => (b.acquired_at ?? '').localeCompare(a.acquired_at ?? '')).slice(0, 3);
        const categorySegments = (() => {
          const map = new Map<string, number>();
          equipment.forEach((it) => {
            const cat = (it.category || 'Autre').split(/[&/]/)[0].trim();
            map.set(cat, (map.get(cat) || 0) + 1);
          });
          const colors = ['#2D5A3D', '#8C6A1A', '#9B2C2C', '#6B5535', '#4A6B8A'];
          let i = 0;
          return Array.from(map.entries())
            .map(([label, value]) => ({ label, value, color: colors[i++ % colors.length] }))
            .sort((a, b) => b.value - a.value)
            .slice(0, 4);
        })();
        return {
          metric: String(equipment.length),
          caption: `${formatWeight(totalWeightG)} · ${Math.round(totalValue)} €`,
          progress: {
            value: conditionPct,
            label: 'Opérationnel',
            tone: conditionPct >= 80 ? 'success' : 'warning',
          },
          secondaryMetrics: [
            { label: 'Valeur', value: `${Math.round(totalValue)} €` },
            { label: 'Poids', value: formatWeight(totalWeightG) },
          ],
          badges: orderedItems.length > 0 ? [{ id: 'ordered', label: `${orderedItems.length} en commande`, tone: 'info' as const }] : [],
          footerText: recentItems[0] ? `Dernier ajout : ${recentItems[0].name}` : 'Inventaire vide',
          footerAction: { label: 'Ajouter →', onClick: () => setExpandedWidget('inventory') },
        status: {
          level: equipment.length === 0 ? 'neutral' : conditionPct >= 80 ? 'ok' : conditionPct >= 60 ? 'warning' : 'critical',
          label: equipment.length === 0 ? 'Inventaire vide' : conditionPct >= 80 ? 'Opérationnel' : conditionPct >= 60 ? 'À surveiller' : 'À remplacer',
        },
          richBody: (
            <div className="space-y-2">
              <div className="flex gap-2 overflow-x-auto scrollbar-none pb-1">
                {recentItems.map((item) => (
                  <div key={item.id} className="flex flex-col items-center gap-1 rounded-xl bg-white/50 border border-[#1C2620]/8 p-2 min-w-[64px]">
                    <span className="text-lg leading-none">📦</span>
                    <span className="text-[10px] font-bold text-[#1C2620] text-center leading-tight max-w-[64px] truncate">{item.name}</span>
                  </div>
                ))}
              </div>
              <MiniDonut segments={categorySegments} size={40} strokeWidth={6} />
            </div>
          ),
        };
      }
      case 'availability': {
        const total = equipment.length;
        const availablePct = total > 0 ? Math.round(((total - unavailableCount) / total) * 100) : 100;
        const nextReturn = activeLoans
          .filter(l => l.status !== 'returned' && l.returned_at)
          .sort((a, b) => (a.returned_at ?? '').localeCompare(b.returned_at ?? ''))
          .slice(0, 1)[0];
        const conflict = nextReturn && activeHike
          ? new Date(nextReturn.returned_at!) > new Date(activeHike.targetDate)
          : false;
        return {
          metric: String(unavailableCount),
          caption: `${lentCount} prêt(s) · ${committedGear.length} engagé(s)`,
          progress: {
            value: availablePct,
            label: 'Disponibilité',
            tone: unavailableCount === 0 ? 'success' : unavailableCount <= 2 ? 'warning' : 'critical',
          },
          secondaryMetrics: [
            { label: 'Prêtés', value: lentCount },
            { label: 'Engagés', value: committedGear.length },
          ],
          badges: unavailableCount > 0 ? [{ id: 'unav', label: `${unavailableCount} indisponible(s)`, tone: conflict ? 'critical' as const : 'warning' as const }] : [],
          footerText: conflict ? '⚠ Conflit retour / départ prévu' : nextReturn ? `Prochain retour : ${new Date(nextReturn.returned_at!).toLocaleDateString('fr-FR')}` : 'Tout disponible',
          footerAction: { label: 'Voir prêts →', onClick: () => setExpandedWidget('availability') },
        status: {
          level: unavailableCount === 0 ? 'ok' : unavailableCount <= 2 ? 'warning' : 'critical',
          label: unavailableCount === 0 ? 'Tout disponible' : conflict ? 'Conflit retour/départ' : `${unavailableCount} indisponible(s)`,
        },
          richBody: (
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <MiniDonut
                  segments={[
                    { label: 'Disponible', value: Math.max(0, equipment.length - lentCount - committedGear.length), color: '#2D5A3D' },
                    { label: 'Engagé départ', value: committedGear.length, color: '#4A7C5B' },
                    { label: 'En prêt', value: lentCount, color: '#8C6A1A' },
                  ]}
                  size={44}
                  strokeWidth={7}
                />
                <div className="text-[10px] leading-relaxed text-[#1C2620]/70">
                  <p><span className="font-mono font-bold text-[#2D5A3D]">{Math.max(0, equipment.length - lentCount - committedGear.length)}</span> dispo</p>
                  <p><span className="font-mono font-bold text-[#4A7C5B]">{committedGear.length}</span> engagés</p>
                  <p><span className="font-mono font-bold text-[#8C6A1A]">{lentCount}</span> prêtés</p>
                </div>
              </div>
              <h3 className="text-xs font-semibold text-[#1C2620]/70">Prochains retours</h3>
              <MiniTimeline
                items={activeLoans
                  .filter(l => l.status !== 'returned' && l.returned_at)
                  .sort((a, b) => (a.returned_at ?? '').localeCompare(b.returned_at ?? ''))
                  .slice(0, 5)
                  .map(loan => {
                    const equipmentItem = equipment.find(e => e.id === loan.gear_item_id);
                    return {
                      label: equipmentItem?.name || 'Équipement inconnu',
                      timestamp: new Date(loan.returned_at ?? 0),
                      subtitle: loan.loaned_to ? `À ${loan.loaned_to}` : undefined,
                    };
                  })
                  .filter(item => item.label !== 'Équipement inconnu')
                }
              />
            </div>
          ),
        };
      }
      default:
        return { metric: '—', caption: '', badges: [] };
    }
  };

  const renderCard = (id: string) => {
    const meta = cardMetric(id);
    const entry = WIDGET_CARDS[id];
    return (
      <GearCard
        key={id}
        id={id}
        icon={entry.icon}
        title={entry.title}
        subtitle={(() => {
          switch (id) {
            case 'forget':
              return activeHike ? countdownLabel(activeHike.targetDate) : '';
            case 'departure':
              return activeHike ? countdownLabel(activeHike.targetDate) : '';
            case 'inventory':
              return `${products.length} au catalogue`;
            case 'alerts':
              return 'Alertes & fiabilité';
            case 'kits':
              return 'actifs + corbeille';
            case 'availability':
              return 'Disponibilité';
            default:
              return '';
          }
        })()}
        metric={meta.metric}
        metricCaption={meta.caption}
        badges={meta.badges}
        progress={meta.progress}
        secondaryMetrics={meta.secondaryMetrics}
        footerText={meta.footerText}
        footerAction={meta.footerAction}
        status={meta.status}
        onExpand={(originEl) => {
          expandOriginRef.current = originEl || null;
          setExpandedWidget(id);
          triggerHaptic('light');
        }}
        onMore={() => {
          setVoirToutTab(id === 'alerts' || id === 'availability' ? 'prets' : id === 'reglages' ? 'reglages' : 'actions');
          setVoirToutOpen(true);
        }}
      >
        {id === 'departure' && !activeHike && (
          <div className="space-y-2 shrink-0">
            <p className="text-xs text-[#1C2620]/60 leading-snug">
              Aucune sortie planifiée. Ajoutez un départ pour suivre sa préparation (poids, kit, météo, blocants).
            </p>
            <button
              type="button"
              onClick={() => setIsNewHikeModalOpen(true)}
              className="w-full px-3 py-2 rounded-full bg-[#2D5A3D] text-white text-xs font-bold min-h-[44px]"
            >
              Planifier une sortie
            </button>
          </div>
        )}
        {id === 'kits' && kits.length === 0 && (
          <div className="space-y-2 shrink-0">
            <p className="text-xs text-[#1C2620]/60 leading-snug">
              Aucun kit actif. Créez un kit type (bivouac, trek, alpinisme…) pour le réutiliser à chaque départ.
            </p>
            <button
              type="button"
              onClick={() => void handleCreateNewKit()}
              className="w-full px-3 py-2 rounded-full bg-[#2D5A3D] text-white text-xs font-bold min-h-[44px]"
            >
              Créer mon premier kit
            </button>
          </div>
        )}
        {id === 'inventory' && equipment.length === 0 && (
          <p className="text-xs text-[#1C2620]/60 shrink-0">
            Inventaire vide — ajoutez des articles depuis le drawer « Tout voir » ou découvrez le catalogue (products réels).
          </p>
        )}
        {id === 'availability' && equipment.length === 0 && (
          <p className="text-xs text-[#1C2620]/60 shrink-0">
            Rien à prêter ou à réserver tant que l’inventaire est vide. Commencez par ajouter votre matériel.
          </p>
        )}
        {id === 'forget' && checklist.length === 0 && (
          <p className="text-xs text-[#1C2620]/60 shrink-0">
            Checklist générée depuis vos données (kit assigné, alertes) + règles génériques. Rien à prévoir pour l’instant.
          </p>
        )}
        {id === 'alerts' && alerts.length === 0 && (
          <p className="text-xs text-[#1C2620]/60 shrink-0">
            Aucune alerte (entretien, péremption, prêt, état). Votre équipement est en bonne santé.
          </p>
        )}
        {id === 'departure' && activeHike && (
          <div className="grid grid-cols-4 gap-2 shrink-0">
            <PreviewStat value={`${activeHike.distanceKm}`} label="km" />
            <PreviewStat value={`+${activeHike.elevationGain || 0}`} label="m D+" />
            <PreviewStat value={`${activeHike.isOvernight ? (activeHike.nightsCount || 1) + 1 : 1}`} label="jours" />
            <PreviewStat value={formatTemp(activeHike)} label="météo" />
          </div>
        )}
        {id === 'forget' && checklist.length > 0 && (
          <div className="space-y-1.5">
            {checklist.filter((c) => c.level === 'critique' || c.level === 'verifier').slice(0, 4).map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => toggleForgetChecked(c.id)}
                aria-pressed={forgetChecked.has(c.id)}
                className="w-full text-left p-2 rounded-xl bg-white/40 hover:bg-white/60 border border-[#1C2620]/7 text-xs flex items-center justify-between gap-2 min-h-[44px]"
              >
                <span className={`truncate ${forgetChecked.has(c.id) ? 'line-through text-[#1C2620]/45' : 'text-[#1C2620]/90'}`}>
                  {c.label}
                </span>
                <span className={`w-5 h-5 rounded-md border shrink-0 ${forgetChecked.has(c.id) ? 'bg-[#2D5A3D] border-[#2D5A3D]' : 'border-[#1C2620]/30'}`} />
              </button>
            ))}
          </div>
        )}
        {id === 'alerts' && alerts.length > 0 && (
          <div className="space-y-1.5">
            {alerts.slice(0, 4).map((a) => (
              <button
                key={`${a.kind}-${a.gearId}`}
                type="button"
                onClick={() => a.gearId && handleOpenGear(a.gearId)}
                className="w-full text-left p-2 rounded-xl bg-white/40 hover:bg-[#1C2620]/6 border border-[#1C2620]/7 text-xs text-[#1C2620]/85 flex items-center justify-between gap-1.5"
              >
                <span className="truncate">{a.label}</span>
                <span className="text-[#2D5A3D] font-bold shrink-0">Voir</span>
              </button>
            ))}
          </div>
        )}
        {id === 'kits' && kits.length > 0 && (
          <div className="space-y-1.5">
            {kits.slice(0, 3).map((k) => (
              <button
                key={k.id}
                type="button"
                onClick={() => {
                  setSelectedKitForCockpit(k);
                  setIsKitDrawerOpen(true);
                }}
                className="w-full text-left p-2 rounded-xl bg-white/40 hover:bg-[#1C2620]/6 border border-[#1C2620]/7 text-xs flex items-center justify-between gap-2"
              >
                <span className="font-semibold text-[#1C2620] truncate">{k.name}</span>
                <span className="font-mono font-bold text-[#2D5A3D] shrink-0">{formatWeight(kitTotalWeight(k))}</span>
              </button>
            ))}
          </div>
        )}
        {id === 'inventory' && (
          <p className="text-xs text-[#1C2620]/60">
            {products.length} produits au catalogue · {equipment.length} objets suivis
          </p>
        )}
        {id === 'availability' && (
          <p className="text-xs text-[#1C2620]/60">
            {lentCount} prêté(s), {committedGear.length} engagé(s) dans le prochain départ
            {unavailableCount > 0 ? `, ${unavailableCount} globalement indisponible(s)` : ''}
          </p>
        )}
      </GearCard>
    );
  };

  // ── Render : plein écran ──────────────────────────────────────────────────────
  const renderFullscreen = (id: string) => {
    const entry = WIDGET_CARDS[id];
    const consumables: DepartureConsumables | null = departurePlan
      ? {
          waterL: departurePlan.consumables.waterLiters,
          meals: departurePlan.consumables.foodMealsCount,
          snacks: departurePlan.consumables.snacksCount,
          fuelG: departurePlan.consumables.fuelGrams,
          advice: departurePlan.weatherSummary.advice,
        }
      : null;

    let body: React.ReactNode = <p className="text-xs text-[#1C2620]/60">Vue indisponible.</p>;

    if (id === 'forget') {
      body = (
        <NotToForgetFullscreen
          checklist={checklist}
          checkedSet={forgetChecked}
          onToggleChecked={toggleForgetChecked}
          departureName={activeHike?.name || null}
          onValidate={() => {
            setExpandedWidget(null);
            handleValidatePreparation();
          }}
          onOpenGear={handleOpenGear}
          onNeedStock={(q) => {
            setExpandedWidget(null);
            setInventoryInitialQuery(q);
            setExpandedWidget('inventory');
          }}
          companions={activeHike?.companions || undefined}
          packWeightG={totalWeightG}
          consumablesWeightG={
            consumables
              ? Math.round(consumables.waterL * 1000 + consumables.fuelG + consumables.meals * 120 + consumables.snacks * 60)
              : 0
          }
        />
      );
    } else if (id === 'departure') {
      body = activeHike ? (
        <NextDepartureFullscreen
          hike={activeHike}
          plannedHikes={plannedHikes}
          kits={kits}
          kit={activeKit}
          equipment={equipment}
          readiness={readiness || { status: 'to_check', readinessPct: 0, ownedCount: 0, availableCount: 0, totalCount: 0, blockers: [], toCheckCount: 0, criticalChecklist: [] }}
          checklist={checklist}
          checkedSet={forgetChecked}
          onToggleChecked={toggleForgetChecked}
          onSelectHike={handleSelectHike}
          onAssignKit={handleAssignKit}
          onDeleteHike={handleDeleteHike}
          onValidate={() => {
            setExpandedWidget(null);
            handleValidatePreparation();
          }}
          consumables={consumables}
          recommended={recommendedKit ? { kit: recommendedKit, score: departurePlan?.suitabilityScore ?? null } : undefined}
          onOpenGear={handleOpenGear}
          onNeedStock={(q) => {
            setExpandedWidget(null);
            setInventoryInitialQuery(q);
            setExpandedWidget('inventory');
          }}
        />
      ) : (
        <div className="flex flex-col items-center gap-3 py-12 text-center">
          <IconNav size={28} className="text-[#2D5A3D]" />
          <p className="text-sm text-[#1C2620]/75">Aucune sortie planifiée</p>
          <button
            type="button"
            onClick={() => {
              setExpandedWidget(null);
              setIsNewHikeModalOpen(true);
            }}
            className="px-5 py-2 rounded-full bg-[#2D5A3D] text-white text-xs font-bold"
          >
            Planifier ma première sortie
          </button>
        </div>
      );
    } else if (id === 'alerts') {
      body = (
        <AlertsReliabilityFullscreen
          alerts={alerts}
          statuses={statuses}
          equipment={equipment}
          filter={alertFilter}
          onFilterChange={setAlertFilter}
          resolvedIds={resolvedAlerts}
          onToggleResolved={handleToggleResolved}
          onOpenGear={handleOpenGear}
          onMarkReviewed={handleMarkReviewed}
          onToast={showToast}
        />
      );
    } else if (id === 'kits') {
      body = (
        <MyKitsFullscreen
          kits={kits}
          trashKits={trashKits}
          trashCount={trashCount}
          equipment={equipment}
          activeHike={activeHike}
          onOpenKit={(kit) => {
            setExpandedWidget(null);
            setSelectedKitForCockpit(kit);
            setIsKitDrawerOpen(true);
          }}
          onCreateKit={() => {
            setExpandedWidget(null);
            void handleCreateNewKit();
          }}
          onAssignKit={handleAssignKit}
          onRestore={async (kitId) => {
            await restoreFromTrash(kitId);
            showToast('Kit restauré', 'success');
          }}
          onPermanentDelete={async (kitId) => {
            await permanentDelete(kitId);
          }}
          onDuplicateKit={handleDuplicateKit}
          onOpenGear={handleOpenGear}
          onToast={showToast}
        />
      );
    } else if (id === 'inventory') {
      body = (
        <InventoryCatalogFullscreen
          equipment={equipment}
          products={products}
          kits={kits}
          statuses={statuses}
          ordered={orderedItems}
          departureName={activeHike?.name || null}
          initialQuery={inventoryInitialQuery}
          onOpenGear={handleOpenGear}
          onEditGear={(gear) => {
            setExpandedWidget(null);
            setEditingItem(gear);
            setIsAddModalOpen(true);
          }}
          onDeleteGear={async (gearId) => {
            await removeFromEquipment(gearId);
            showToast('Article supprimé', 'info');
          }}
          onToggleFavorite={handleToggleFavorite}
          onAddToKit={handleAddGearToKit}
          onAddToCart={handleAddToCartWithDestination}
          onConfirmReception={handleConfirmReception}
          trashKits={trashKits}
          onRestoreKit={async (kitId) => {
            await restoreFromTrash(kitId);
            showToast('Kit restauré', 'success');
          }}
          onPermanentDeleteKit={async (kitId) => {
            await permanentDelete(kitId);
          }}
          onToast={showToast}
        />
      );
    } else if (id === 'availability') {
      body = (
        <AvailabilityFullscreen
          equipment={equipment}
          statuses={statuses}
          availability={availabilityMap}
          activeLoans={activeLoans}
          committedGear={committedGear}
          activeDeparture={activeHike}
          onMarkReturned={async (gearId) => {
            await updateEquipment(gearId, { loan_status: 'disponible', loan_to_name: null });
          }}
          onNudge={(gearId) => {
            const loanService = new LoanService();
            void loanService.nudge(gearId);
          }}
          onOpenGear={handleOpenGear}
          onOpenDeparture={() => {
            setExpandedWidget(null);
            setExpandedWidget('departure');
          }}
          onListForSale={(gearId, listed) => {
            void updateEquipment(gearId, { is_listed_for_sale: listed }).then(() =>
              showToast(listed ? 'Objet mis en vente' : 'Retiré de la vente', 'success')
            );
          }}
          onToast={showToast}
        />
      );
    }

    return (
      <FullscreenShell
        id={id}
        title={entry.title}
        subtitle={departureTitle(id)}
        icon={entry.icon}
        onClose={() => setExpandedWidget(null)}
      >
        {body}
      </FullscreenShell>
    );
  };

  const departureTitle = (id: string): string | undefined => {
    if (id === 'departure') return activeHike?.name;
    if (id === 'forget') return activeHike ? `pour ${activeHike.name}` : undefined;
    if (id === 'inventory') return `${equipment.length} objets · ${products.length} produits`;
    if (id === 'alerts') return criticalCount > 0 ? `${criticalCount} critique(s)` : 'tout est en ordre';
    if (id === 'kits') return `${kits.length} kit(s) actifs`;
    if (id === 'availability') return `${unavailableCount} indisponible(s)`;
    return undefined;
  };

  // ── Drawer « Tout voir » : 4 onglets (sans emoji) ────────────────────────────
  const renderDrawerTab = () => {
    if (voirToutTab === 'inventaire') {
      return (
        <div className="space-y-3">
          <section className="rounded-2xl bg-white/40 border border-[#1C2620]/7 p-3 space-y-1.5">
            <h3 className="text-xs font-extrabold uppercase tracking-wider text-[#1C2620]">Inventaire matériel</h3>
            <p className="text-xs text-[#1C2620]/70">
              {equipment.length} articles · {formatWeight(totalWeightG)}
            </p>
            <div className="space-y-1.5 max-h-[48vh] overflow-y-auto scrollbar-none">
              {equipment.slice(0, 20).map((it) => (
                <button
                  key={it.id}
                  type="button"
                  onClick={() => {
                    setVoirToutOpen(false);
                    handleOpenGear(it.id);
                  }}
                  className="w-full text-left p-2 rounded-xl bg-white/40 hover:bg-[#1C2620]/6 border border-[#1C2620]/7 text-xs text-[#1C2620]/85 flex items-center justify-between gap-2"
                >
                  <span className="truncate">{it.name}</span>
                  <span className="font-mono text-[#2D5A3D] shrink-0">{formatWeight(it.weight_g || 0)}</span>
                </button>
              ))}
            </div>
          </section>
          <section className="rounded-2xl bg-white/40 border border-[#1C2620]/7 p-3 space-y-1.5">
            <h3 className="text-xs font-extrabold uppercase tracking-wider text-[#1C2620]">Répartition par catégorie</h3>
            {categoryStatsDrawer.map((c) => (
              <div key={c.label} className="flex items-center justify-between text-xs text-[#1C2620]/80">
                <span className="capitalize truncate">{c.label}</span>
                <span className="font-mono text-[#2D5A3D]">{formatWeight(c.grams)} ({c.pct}%)</span>
              </div>
            ))}
          </section>
        </div>
      );
    }
    if (voirToutTab === 'prets') {
      return (
        <div className="space-y-4">
          <section>
            <h3 className="text-xs font-extrabold uppercase tracking-wider text-[#1C2620] mb-2">Alertes ({alerts.length})</h3>
            <div className="space-y-1.5 max-h-[38vh] overflow-y-auto scrollbar-none">
              {alerts.slice(0, 12).map((a) => (
                <button
                  key={`${a.kind}-${a.gearId}`}
                  type="button"
                  onClick={() => {
                    setVoirToutOpen(false);
                    if (a.gearId) handleOpenGear(a.gearId);
                  }}
                  className="w-full text-left p-2 rounded-xl bg-white/40 hover:bg-[#1C2620]/6 border border-[#1C2620]/7 text-xs text-[#1C2620]/85 flex items-center justify-between gap-1.5"
                >
                  <span className="truncate">{a.label}</span>
                  <span className="text-[#2D5A3D] font-bold shrink-0">Voir</span>
                </button>
              ))}
            </div>
          </section>
          <section className="pt-2 border-t border-[#1C2620]/8">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-xs font-extrabold uppercase tracking-wider text-[#1C2620]">Prêts ({lentCount})</h3>
            </div>
            <div className="space-y-1.5">
              {equipment.filter((e) => e.loan_status === 'prêté' || Boolean(e.loan_to_name)).map((item) => (
                <div key={item.id} className="p-2 rounded-xl bg-white/40 border border-[#1C2620]/7 text-xs flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-[#1C2620]/90 font-semibold truncate">{item.name}</p>
                    <p className="text-[#1C2620]/60 truncate">Prêté à {item.loan_to_name || 'un ami'}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => void updateEquipment(item.id, { loan_status: 'disponible', loan_to_name: null })}
                    className="px-2.5 py-1 rounded-lg bg-[#2D5A3D]/15 border border-[#2D5A3D]/30 text-[#2D5A3D] text-xs font-bold shrink-0"
                  >
                    Rendu
                  </button>
                </div>
              ))}
            </div>
          </section>
        </div>
      );
    }
    if (voirToutTab === 'reglages') {
      return (
        <div className="space-y-5">
          <section>
            <h3 className="text-xs font-extrabold uppercase tracking-wider text-[#1C2620] mb-2">Objectif de poids du sac</h3>
            <div className="grid grid-cols-4 gap-2">
              {[5, 6, 8, 10, 12, 14, 16, 20].map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => {
                    setTargetKg(t);
                    try {
                      window.localStorage.setItem('lkdv_cockpit_target_kg', String(t));
                    } catch { /* ignore */ }
                    showToast(`Objectif ajusté à ${t} kg`, 'info');
                  }}
                  className={`py-2 rounded-xl text-center font-mono font-bold text-xs transition-all active:scale-95 ${
                    targetKg === t ? 'bg-[#2D5A3D] text-white' : 'bg-[#1C2620]/6 text-[#1C2620]/80 border border-[#1C2620]/8'
                  }`}
                >
                  {t} kg
                </button>
              ))}
            </div>
          </section>
          <section className="pt-2 border-t border-[#1C2620]/8">
            <h3 className="text-xs font-extrabold uppercase tracking-wider text-[#1C2620] mb-2">Disposition des cartes</h3>
            <div className="space-y-2">
              {widgetOrder.map((id, i) => (
                <div key={id} className="flex items-center justify-between gap-2 p-2 rounded-xl bg-white/40 border border-[#1C2620]/7">
                  <span className="text-xs text-[#1C2620]/90 capitalize">{WIDGET_CARDS[id]?.title || id}</span>
                  <div className="flex gap-1">
                    <button type="button" disabled={i === 0} onClick={() => moveWidget(id, -1)} className="w-8 h-8 rounded-lg bg-white/60 border border-[#1C2620]/8 text-xs disabled:opacity-30" aria-label="Monter">
                      ▲
                    </button>
                    <button type="button" disabled={i === widgetOrder.length - 1} onClick={() => moveWidget(id, 1)} className="w-8 h-8 rounded-lg bg-white/60 border border-[#1C2620]/8 text-xs disabled:opacity-30" aria-label="Descendre">
                      ▼
                    </button>
                  </div>
                </div>
              ))}
            </div>
            <button type="button" onClick={resetWidgetOrder} className="mt-2 w-full py-2 rounded-xl bg-white/60 hover:bg-[#1C2620]/6 border border-[#1C2620]/9 text-[#1C2620]/90 text-xs font-semibold">
              Réinitialiser la disposition
            </button>
          </section>
          <section className="pt-2 border-t border-[#1C2620]/8">
            <h3 className="text-xs font-extrabold uppercase tracking-wider text-[#1C2620] mb-2">Général</h3>
            <div className="grid grid-cols-2 gap-2">
              <Link href="/compte" onClick={() => setVoirToutOpen(false)} className="py-2.5 px-3 rounded-xl bg-white/60 hover:bg-[#1C2620]/6 border border-[#1C2620]/9 text-[#1C2620]/90 text-xs font-semibold">
                Mon profil LKDV
              </Link>
              <Link href="/explorer" onClick={() => setVoirToutOpen(false)} className="py-2.5 px-3 rounded-xl bg-white/60 hover:bg-[#1C2620]/6 border border-[#1C2620]/9 text-[#1C2620]/90 text-xs font-semibold">
                Explorer les randonnées
              </Link>
            </div>
          </section>
        </div>
      );
    }
    // actions
    return (
      <div className="space-y-4">
        <section>
          <h3 className="text-xs font-extrabold uppercase tracking-wider text-[#1C2620] mb-2">Navigation</h3>
          <div className="grid grid-cols-2 gap-2">
            <DrawerLink href="/ai-configurator" title="Configurateur IA" sub="Générer un kit" icon={<IconSparkle size={15} />} onOpen={() => setVoirToutOpen(false)} />
            <DrawerLink href="/rapport-kit" title="Rapport Kit" sub="Évaluer son sac" icon={<IconScale size={15} />} onOpen={() => setVoirToutOpen(false)} />
            <DrawerLink href="/explorer" title="Explorer" sub="Trouver des randonnées" icon={<IconNav size={15} />} onOpen={() => setVoirToutOpen(false)} />
          </div>
        </section>
        <section className="pt-2 border-t border-[#1C2620]/8 space-y-2">
          <h3 className="text-xs font-extrabold uppercase tracking-wider text-[#1C2620]">Actions rapides</h3>
          <button
            type="button"
            onClick={() => {
              setVoirToutOpen(false);
              setEditingItem(null);
              setIsAddModalOpen(true);
            }}
            className="w-full py-2.5 px-3 rounded-xl bg-white/60 hover:bg-[#1C2620]/6 border border-[#1C2620]/9 text-[#1C2620]/90 text-xs font-semibold text-left flex items-center gap-2"
          >
            <IconPlus size={14} /> Ajouter un article à l’inventaire
          </button>
          <button
            type="button"
            onClick={() => {
              setVoirToutOpen(false);
              setIsNewHikeModalOpen(true);
            }}
            className="w-full py-2.5 px-3 rounded-xl bg-white/60 hover:bg-[#1C2620]/6 border border-[#1C2620]/9 text-[#1C2620]/90 text-xs font-semibold text-left flex items-center gap-2"
          >
            <IconClock size={14} /> Planifier une nouvelle sortie
          </button>
        </section>
        <section className="pt-2 border-t border-[#1C2620]/7 space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-extrabold uppercase tracking-wider text-[#1C2620] flex items-center gap-1.5">
              <IconSparkle size={14} className="text-[#2D5A3D]" /> Assistance IA
              {aiMode === 'local' && <span className="px-2 py-0.5 rounded-full bg-[#8C6A1A]/10 border border-[#8C6A1A]/30 text-[#8C6A1A] font-mono font-bold">Mode dégradé</span>}
              {aiMode === 'live' && <span className="px-2 py-0.5 rounded-full bg-[#2D5A3D]/10 border border-[#2D5A3D]/30 text-[#2D5A3D] font-mono font-bold">IA en ligne</span>}
            </h3>
          </div>
          <div ref={aiScrollRef} className="space-y-1.5 text-xs max-h-[180px] overflow-y-auto scrollbar-none">
            {aiResponse ? (
              <div className="p-3 rounded-2xl bg-white/50 border border-[#1C2620]/8">
                <p className="text-[#1C2620]/90 leading-relaxed whitespace-pre-wrap">{aiResponse}</p>
              </div>
            ) : aiError ? (
              <div className="p-2.5 rounded-xl bg-[#9B2C2C]/8 border border-[#9B2C2C]/20 text-xs text-[#9B2C2C]">{aiError}</div>
            ) : (
              <div className="space-y-1.5">
                {['Optimise un pack bivouac sous 8 kg', 'Quel matériel alléger en priorité ?'].map((s) => (
                  <button key={s} type="button" onClick={() => runAi(s)} className="w-full text-left p-2 rounded-xl bg-white/40 hover:bg-[#1C2620]/6 border border-[#1C2620]/7 text-xs text-[#1C2620]/90">
                    {s}
                  </button>
                ))}
              </div>
            )}
          </div>
          <form onSubmit={(e) => { e.preventDefault(); runAi(aiInput); setAiInput(''); }} className="flex items-center gap-1.5 rounded-xl bg-white/50 border border-[#1C2620]/9 px-2 py-1.5">
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
              className="w-9 h-9 rounded-full bg-[#2D5A3D] text-white flex items-center justify-center text-xs font-bold disabled:opacity-40"
              aria-label="Envoyer"
            >
              ↑
            </button>
          </form>
        </section>
      </div>
    );
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

  const categoryStatsDrawer = useMemo(() => {
    const map = new Map<string, number>();
    equipment.forEach((it) => {
      const cat = (it.category || 'Autre').split(/[&/]/)[0].trim();
      map.set(cat, (map.get(cat) || 0) + (it.weight_g || 0) * (it.quantity || 1));
    });
    const total = Array.from(map.values()).reduce((a, b) => a + b, 0) || 1;
    return Array.from(map.entries())
      .map(([label, grams]) => ({ label, grams, pct: Math.round((grams / total) * 100) }))
      .sort((a, b) => b.grams - a.grams)
      .slice(0, 5);
  }, [equipment]);

  // ── Layout principal ─────────────────────────────────────────────────────────
  return (
    <MotionConfig reducedMotion="user">
      <>
        <div className="fixed inset-0 w-full bg-[#F5F3EE] text-[#1C2620] select-none font-sans flex flex-col overflow-hidden">
          <Header />

          <div className="h-full w-full flex flex-col pt-20 sm:pt-[88px] overflow-y-auto lg:overflow-hidden">
            <style>{`
              .scrollbar-none::-webkit-scrollbar { display: none; }
              .scrollbar-none { -ms-overflow-style: none; scrollbar-width: none; }
              @media (prefers-reduced-motion: reduce) { * { animation: none !important; transition: none !important; } }
              html, body { overflow: hidden !important; }
            `}</style>

            {toastMessage && (
              <div
                role="status"
                aria-live="polite"
                className={`fixed top-24 left-1/2 -translate-x-1/2 z-[1200] px-4 py-2 rounded-full border bg-white/95 text-[#1C2620] text-xs font-semibold backdrop-blur-xl shadow-[0_10px_30px_rgba(11,31,23,0.18),inset_0_1px_0_0_rgba(255,255,255,0.9)] flex items-center gap-2 ${
                  toastMessage.type === 'warning'
                    ? 'border-[#8C6A1A]/40'
                    : toastMessage.type === 'info'
                    ? 'border-[#2D5A3D]/30'
                    : 'border-[#2D5A3D]/30'
                }`}
              >
                <span className="w-2 h-2 rounded-full bg-[#2D5A3D] animate-pulse" />
                <span>{toastMessage.text}</span>
              </div>
            )}

            <h1 className="sr-only">Mon Matériel — cockpit Le Kit du Voyageur</h1>
            <main className="relative z-10 w-full max-w-[1800px] mx-auto flex-1 min-h-0 px-3 pb-20 lg:pb-14 flex flex-col gap-2.5 overflow-y-auto lg:overflow-hidden">
              <div className="flex items-center justify-between gap-2 shrink-0 px-1">
                <span className="text-xs font-mono uppercase tracking-widest text-[#1C2620]/60">
                  Mon Matériel · 6 cartes
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setVoirToutTab('inventaire');
                    setVoirToutOpen(true);
                    triggerHaptic('light');
                  }}
                  className="text-xs font-bold text-[#2D5A3D] hover:text-[#1C2620] px-3 py-1.5 rounded-full bg-white/60 hover:bg-[#1C2620]/6 border border-[#1C2620]/9 transition-all active:scale-95"
                >
                  Tout voir
                </button>
              </div>

              <MonMaterielGrid
                order={widgetOrder}
                onReorder={handleReorder}
                renderCard={renderCard}
                dimmed={expandedWidget !== null}
              />

              {(equipmentLoading || kitsLoading) && equipment.length === 0 && (
                <div className="space-y-3" aria-busy="true" aria-label="Chargement de votre matériel">
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {[0, 1, 2, 3, 4, 5].map((i) => (
                      <div key={i} className={`h-44 rounded-[28px] bg-white/35 border border-[#1C2620]/8 animate-pulse ${i === 0 || i === 4 ? 'lg:col-span-2' : ''}`} />
                    ))}
                  </div>
                  <p className="text-center text-xs text-[#1C2620]/55">
                    Chargement de l’inventaire, des kits et du catalogue…
                  </p>
                </div>
              )}

              {equipmentError && (
                <div role="alert" className="rounded-2xl bg-[#9B2C2C]/8 border border-[#9B2C2C]/25 px-4 py-3 text-xs text-[#9B2C2C] flex items-center justify-between gap-3">
                  <span>Impossible de charger certaines données : {equipmentError}</span>
                  <button
                    type="button"
                    onClick={() => void refreshData()}
                    className="px-3 py-1.5 rounded-full bg-white/80 border border-[#9B2C2C]/30 text-[#9B2C2C] font-bold shrink-0"
                  >
                    Réessayer
                  </button>
                </div>
              )}
            </main>
          </div>

          {/* Drawer « Tout voir » */}
          {voirToutOpen && (
            <div className="fixed inset-0 z-[1040]" role="dialog" aria-modal="true" aria-label="Tout voir">
              <div className="absolute inset-0 bg-[#1C2620]/55 backdrop-blur-sm" onClick={() => setVoirToutOpen(false)} />
              <div className="absolute right-0 top-0 h-full w-full max-w-md bg-[#FBFAF6]/95 backdrop-blur-2xl border-l border-[#1C2620]/10 shadow-2xl flex flex-col">
                <div className="flex items-center justify-between p-4 border-b border-[#1C2620]/8 shrink-0">
                  <h2 className="text-sm font-extrabold uppercase tracking-wider text-[#1C2620]">Tout voir</h2>
                  <button
                    type="button"
                    onClick={() => setVoirToutOpen(false)}
                    className="w-9 h-9 rounded-full bg-[#1C2620]/7 hover:bg-white/20 flex items-center justify-center text-sm text-[#1C2620]"
                    aria-label="Fermer"
                  >
                    <IconClose size={16} />
                  </button>
                </div>
                <div className="flex gap-1 p-2 border-b border-[#1C2620]/8 shrink-0">
                  {(
                    [
                      ['inventaire', 'Inventaire'],
                      ['prets', 'Prêts & Alertes'],
                      ['reglages', 'Réglages'],
                      ['actions', 'Actions'],
                    ] as const
                  ).map(([tab, label]) => (
                    <button
                      key={tab}
                      type="button"
                      onClick={() => {
                        setVoirToutTab(tab);
                        triggerHaptic('light');
                      }}
                      className={`px-3 py-1.5 rounded-full text-xs font-bold transition-colors ${
                        voirToutTab === tab
                          ? 'bg-[#2D5A3D] text-white'
                          : 'bg-white/60 hover:bg-[#1C2620]/9 text-[#1C2620]/80 border border-[#1C2620]/8'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                <div className="flex-1 min-h-0 overflow-y-auto scrollbar-none p-4">{renderDrawerTab()}</div>
              </div>
            </div>
          )}

          {/* Modales & tiroirs réels */}
          <GearDetailDrawer
            isOpen={isDetailDrawerOpen}
            item={activeItem}
            onClose={() => {
              setIsDetailDrawerOpen(false);
              setSelectedGearId(null);
            }}
            onEdit={(item) => {
              setIsDetailDrawerOpen(false);
              setEditingItem(item);
              setIsAddModalOpen(true);
            }}
            onDelete={async (id) => {
              await removeFromEquipment(id);
              setIsDetailDrawerOpen(false);
              setSelectedGearId(null);
              showToast('Article supprimé de l’inventaire', 'info');
            }}
            onUpdateNotes={async (gearId, notes) => {
              await updateEquipment(gearId, { notes });
              showToast('Notes enregistrées', 'success');
            }}
            onAddToKit={() => {
              setIsDetailDrawerOpen(false);
              setIsKitDrawerOpen(true);
            }}
            onLend={() => {
              setIsDetailDrawerOpen(false);
              setIsLendModalOpen(true);
            }}
            onToggleFavorite={() => {
              if (activeItem) void handleToggleFavorite(activeItem);
            }}
            onAddToCart={(_p) => {
              if (activeItem) {
                handleAddToCartWithDestination(activeItem as unknown as UnifiedProduct, undefined);
                showToast('Ajouté au panier', 'success');
              }
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
            onClose={() => {
              setIsAddModalOpen(false);
              setEditingItem(null);
            }}
            onSave={async (itemData) => {
              if (editingItem?.id) {
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
                  } as UnifiedProduct,
                  {
                    condition: (itemData.condition as any) || 'excellent',
                    notes: itemData.notes || undefined,
                    purchase_price: itemData.purchase_price || undefined,
                  }
                );
                showToast(`« ${itemData.name || 'Nouvel article'} » ajouté à l’inventaire`, 'success');
              }
              setIsAddModalOpen(false);
              setEditingItem(null);
            }}
          />

          <KitCockpitDrawer
            isOpen={isKitDrawerOpen}
            kit={selectedKitForCockpit || activeKit || kits[0] || null}
            userEquipment={equipment}
            onClose={() => {
              setIsKitDrawerOpen(false);
              setSelectedKitForCockpit(null);
            }}
            onSelectForDeparture={(kit) => {
              setSelectedKitForCockpit(kit);
              if (activeHike) handleAssignKit(activeHike.id, kit.id);
              setIsKitDrawerOpen(false);
              showToast(`Kit « ${kit.name} » sélectionné pour le départ`, 'success');
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
              await addToEquipment(product as UnifiedProduct);
              showToast(`« ${product.name} » ajouté à l’inventaire`, 'success');
            }}
            onAddToCart={(p) => {
              handleAddToCartWithDestination(p as UnifiedProduct, undefined);
              showToast(`« ${p.name} » ajouté au panier`, 'success');
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
                showToast(`Matériel prêté à ${borrowerName}`, 'success');
              }
              setIsLendModalOpen(false);
            }}
          />

          {/* Modale nouvelle sortie */}
          {isNewHikeModalOpen && (
            <div className="fixed inset-0 z-[1100] flex items-center justify-center p-4 bg-[#1C2620]/55 backdrop-blur-md">
              <div className="relative w-full max-w-md rounded-[28px] border border-[#1C2620]/11 bg-[#FBFAF6]/97 backdrop-blur-2xl p-6 text-[#1C2620] shadow-2xl space-y-4">
                <div className="flex items-center justify-between border-b border-[#1C2620]/8 pb-3">
                  <h3 className="text-sm font-extrabold text-[#1C2620] uppercase tracking-wider">Planifier une nouvelle sortie</h3>
                  <button
                    type="button"
                    onClick={() => setIsNewHikeModalOpen(false)}
                    className="w-9 h-9 rounded-full bg-[#1C2620]/7 hover:bg-white/20 flex items-center justify-center text-sm text-[#1C2620]"
                    aria-label="Fermer"
                  >
                    <IconClose size={16} />
                  </button>
                </div>
                <form onSubmit={handleCreateHike} className="space-y-3 text-xs">
                  <Field label="Nom de la randonnée / trek *">
                    <input
                      required
                      value={newHikeName}
                      onChange={(e) => setNewHikeName(e.target.value)}
                      placeholder="Ex. Tour du Mont Blanc, GR20 Sud…"
                      className="w-full px-3 py-2 rounded-xl bg-white/50 border border-[#1C2620]/11 text-[#1C2620] focus:outline-none focus:border-[#2D5A3D]"
                    />
                  </Field>
                  <Field label="Massif / Destination">
                    <input
                      value={newHikeDest}
                      onChange={(e) => setNewHikeDest(e.target.value)}
                      placeholder="Ex. Massif des Écrins, Vercors…"
                      className="w-full px-3 py-2 rounded-xl bg-white/50 border border-[#1C2620]/11 text-[#1C2620] focus:outline-none focus:border-[#2D5A3D]"
                    />
                  </Field>
                  <Field label="Compagnons (optionnel)">
                    <input
                      value={newHikeCompanions}
                      onChange={(e) => setNewHikeCompanions(e.target.value)}
                      placeholder="Ex. Léna & Antoine"
                      className="w-full px-3 py-2 rounded-xl bg-white/50 border border-[#1C2620]/11 text-[#1C2620] focus:outline-none focus:border-[#2D5A3D]"
                    />
                  </Field>
                  <div className="grid grid-cols-3 gap-2">
                    <Field label="Durée (jours)">
                      <input type="number" min="1" value={newHikeDays} onChange={(e) => setNewHikeDays(Number(e.target.value))} className="w-full px-2 py-1.5 rounded-xl bg-white/50 border border-[#1C2620]/11 text-[#1C2620] text-center focus:outline-none focus:border-[#2D5A3D]" />
                    </Field>
                    <Field label="Distance (km)">
                      <input type="number" min="1" value={newHikeKm} onChange={(e) => setNewHikeKm(Number(e.target.value))} className="w-full px-2 py-1.5 rounded-xl bg-white/50 border border-[#1C2620]/11 text-[#1C2620] text-center focus:outline-none focus:border-[#2D5A3D]" />
                    </Field>
                    <Field label="D+ (mètres)">
                      <input type="number" min="0" value={newHikeDPlus} onChange={(e) => setNewHikeDPlus(Number(e.target.value))} className="w-full px-2 py-1.5 rounded-xl bg-white/50 border border-[#1C2620]/11 text-[#1C2620] text-center focus:outline-none focus:border-[#2D5A3D]" />
                    </Field>
                  </div>
                  <div className="pt-3 flex justify-end gap-2">
                    <button type="button" onClick={() => setIsNewHikeModalOpen(false)} className="px-4 py-2 rounded-full bg-[#1C2620]/7 text-[#1C2620] text-xs font-semibold">
                      Annuler
                    </button>
                    <button type="submit" className="px-5 py-2 rounded-full bg-[#2D5A3D] text-white font-bold text-xs hover:bg-[#235030]">
                      Enregistrer la sortie
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>

        {/* Vues plein écran des 6 cartes */}
        <AnimatePresence>{expandedWidget !== null && renderFullscreen(expandedWidget)}</AnimatePresence>
      </>
    </MotionConfig>
  );
}

// ── Petits helpers d'affichage ─────────────────────────────────────────────────
interface GearCardBadge {
  id: string;
  label: string;
  tone: 'critical' | 'warning' | 'info' | 'success';
}

function PreviewStat({ value, label }: { value: string | number; label: string }) {
  return (
    <div className="p-2 rounded-xl bg-white/40 border border-[#1C2620]/7">
      <span className="block text-sm font-bold font-mono text-[#1C2620] leading-none truncate">{value}</span>
      <span className="block text-xs text-[#1C2620]/70 mt-1">{label}</span>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-xs text-[#1C2620]/70 block mb-1">{label}</label>
      {children}
    </div>
  );
}

function DrawerLink({
  href,
  title,
  sub,
  icon,
  onOpen,
}: {
  href: string;
  title: string;
  sub: string;
  icon: React.ReactNode;
  onOpen: () => void;
}) {
  return (
    <Link href={href} onClick={onOpen} className="p-2.5 rounded-xl bg-white/40 hover:bg-[#1C2620]/6 border border-[#1C2620]/7 text-xs text-[#1C2620]/90 flex flex-col gap-0.5 transition-all active:scale-[0.98]">
      <span className="text-[#2D5A3D]">{icon}</span>
      <span className="font-bold">{title}</span>
      <span className="text-[#1C2620]/60">{sub}</span>
    </Link>
  );
}