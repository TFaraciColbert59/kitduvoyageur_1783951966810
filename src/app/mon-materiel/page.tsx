'use client';

import React, { useState, useMemo, useEffect, useCallback } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import Header from '@/components/Header';
import { useEquipment, UserEquipmentItem, UnifiedProduct, FALLBACK_AUTHENTIC_PRODUCTS } from '@/hooks/useEquipment';
import { useUserKits, CustomKit, CustomKitItem } from '@/hooks/useUserKits';
import { useHapticFeedback } from '@/hooks/useHapticFeedback';
import AddEditGearModal from '@/components/inventaire/AddEditGearModal';
import KitCockpitDrawer from '@/components/inventaire/KitCockpitDrawer';
import LendItemModal from '@/components/inventaire/LendItemModal';
import { addToCart } from '@/lib/cart';
import {
  PlannedHike,
  getPlannedHikes,
  getActivePlannedHike,
  updatePlannedHike,
  setActivePlannedHikeId,
} from '@/lib/preparation/plannedHikes';
import {
  DepartureHikeContext,
  resolveDeparturePlan,
  DeparturePreparationPlan,
} from '@/lib/preparation/SmartDepartureEngine';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import { motion, AnimatePresence } from 'framer-motion';

// --- Types & Constants ---
type CardId = 'depart' | 'kits' | 'alertes' | 'oublier' | 'equipements' | 'actions';
const DEFAULT_ORDER: CardId[] = ['depart', 'kits', 'alertes', 'oublier', 'equipements', 'actions'];

const CATEGORIES = ['Couchage', 'Portage', 'Cuisine', 'Vêtement', 'Navigation', 'Éclairage', 'Sécurité', 'Autre'];

// Helpers
function formatWeight(g: number): string {
  if (!g || g <= 0) return '0 g';
  if (g >= 1000) {
    return `${(g / 1000).toLocaleString('fr-FR', { minimumFractionDigits: 1, maximumFractionDigits: 2 })} kg`;
  }
  return `${Math.round(g)} g`;
}

function daysUntil(targetDate?: string): number | null {
  if (!targetDate) return null;
  const target = new Date(`${targetDate}T00:00:00`);
  if (Number.isNaN(target.getTime())) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((target.getTime() - today.getTime()) / 86400000);
}

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

export default function MonMaterielPage() {
  const { triggerHaptic } = useHapticFeedback();

  // Data hooks
  const {
    equipment,
    loading: equipmentLoading,
    addToEquipment,
    updateEquipment,
    removeFromEquipment,
    products: catalogProducts,
  } = useEquipment();

  const {
    kits,
    updateKit,
    moveToTrash,
    createKit,
  } = useUserKits(equipment);

  // Planned Hikes State
  const [plannedHikes, setPlannedHikes] = useState<PlannedHike[]>([]);
  const [activeHike, setActiveHike] = useState<PlannedHike | null>(null);

  useEffect(() => {
    const hikes = getPlannedHikes();
    setPlannedHikes(hikes);
    setActiveHike(getActivePlannedHike() || hikes[0] || null);
  }, []);

  // UI state
  const [expandedCard, setExpandedCard] = useState<CardId | null>(null);
  const [cardOrder, setCardOrder] = useState<CardId[]>(DEFAULT_ORDER);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
    triggerHaptic('success');
    setTimeout(() => setToastMessage(null), 3500);
  }, [triggerHaptic]);

  // Persistent Card Order
  useEffect(() => {
    const saved = localStorage.getItem('lkdv_cockpit_order');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length === 6) {
          setCardOrder(parsed);
        }
      } catch (e) {}
    }
  }, []);

  // Checklist Local Persistence
  const [checkedOublis, setCheckedOublis] = useState<Record<string, boolean>>({});
  useEffect(() => {
    const saved = localStorage.getItem('lkdv_checked_oublis');
    if (saved) {
      try {
        setCheckedOublis(JSON.parse(saved));
      } catch (e) {}
    }
  }, []);

  const toggleOubliCheck = (id: string) => {
    triggerHaptic('selection');
    setCheckedOublis(prev => {
      const next = { ...prev, [id]: !prev[id] };
      localStorage.setItem('lkdv_checked_oublis', JSON.stringify(next));
      return next;
    });
  };

  // Modals & Drawers state
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<UserEquipmentItem | null>(null);
  const [isKitDrawerOpen, setIsKitDrawerOpen] = useState(false);
  const [selectedKitForCockpit, setSelectedKitForCockpit] = useState<CustomKit | null>(null);
  const [isLendModalOpen, setIsLendModalOpen] = useState(false);
  const [selectedLendItem, setSelectedLendItem] = useState<UserEquipmentItem | null>(null);

  // Filter & Search states inside Fullscreens
  const [selectedCategoryTab, setSelectedCategoryTab] = useState<string>('Tous');
  const [gearSearchQuery, setGearSearchQuery] = useState<string>('');
  const [gearPossessionFilter, setGearPossessionFilter] = useState<'all' | 'owned' | 'catalog'>('all');
  const [selectedKitInFullscreen, setSelectedKitInFullscreen] = useState<string | null>(null);
  const [alertFilterTab, setAlertFilterTab] = useState<string>('all');

  // --- Derived Calculations ---
  // Active kit for the active hike
  const activeKit = useMemo(() => {
    if (activeHike?.assignedKitId) {
      const match = kits.find(k => k.id === activeHike.assignedKitId);
      if (match) return match;
    }
    return kits[0] || null;
  }, [kits, activeHike]);

  // Synchronize selected kit in fullscreen
  useEffect(() => {
    if (activeKit && !selectedKitInFullscreen) {
      setSelectedKitInFullscreen(activeKit.id);
    }
  }, [activeKit, selectedKitInFullscreen]);

  // SmartDepartureEngine resolution
  const departurePlan: DeparturePreparationPlan | null = useMemo(() => {
    if (!activeHike) return null;
    try {
      return resolveDeparturePlan(buildHikeContext(activeHike), kits, equipment);
    } catch {
      return null;
    }
  }, [activeHike, kits, equipment]);

  // Hike readiness calculation
  const hikeReadiness = useMemo(() => {
    if (!activeKit) return { readinessPct: 100, ownedCount: 0, totalCount: 0, missingItems: [] as CustomKitItem[] };
    const kitItems = activeKit.items || [];
    const missing: CustomKitItem[] = [];
    let owned = 0;
    kitItems.forEach((ki) => {
      const isOwned = equipment.some((e) =>
        (ki.gear_item_id && e.id === ki.gear_item_id) ||
        e.name.toLowerCase() === ki.item_name.toLowerCase()
      );
      if (isOwned) {
        owned++;
      } else {
        missing.push(ki);
      }
    });
    return {
      readinessPct: kitItems.length > 0 ? Math.round((owned / kitItems.length) * 100) : 100,
      ownedCount: owned,
      totalCount: kitItems.length,
      missingItems: missing,
    };
  }, [activeKit, equipment]);

  // Dynamic Alerts computation
  const alerts = useMemo(() => {
    const now = Date.now();
    const out: {
      id: string;
      kind: 'maintenance' | 'expiry' | 'replace' | 'loan';
      title: string;
      description: string;
      critical: boolean;
      item: UserEquipmentItem;
    }[] = [];

    equipment.forEach(it => {
      if (it.next_maintenance_date && new Date(it.next_maintenance_date).getTime() < now) {
        out.push({
          id: `maint-${it.id}`,
          kind: 'maintenance',
          title: `Entretien dépassé : ${it.name}`,
          description: `Prévu le ${new Date(it.next_maintenance_date).toLocaleDateString('fr-FR')}. Ré-imperméabilisation / révision requise.`,
          critical: true,
          item: it,
        });
      }
      if (it.expiry_date && new Date(it.expiry_date).getTime() < (now + 30 * 86400000)) {
        const isPast = new Date(it.expiry_date).getTime() < now;
        out.push({
          id: `exp-${it.id}`,
          kind: 'expiry',
          title: `${isPast ? 'Périmé' : 'Péremption proche'} : ${it.name}`,
          description: `Date limite : ${new Date(it.expiry_date).toLocaleDateString('fr-FR')}.`,
          critical: isPast,
          item: it,
        });
      }
      if (it.condition === 'à_remplacer' || it.condition === 'à_réparer') {
        out.push({
          id: `rep-${it.id}`,
          kind: 'replace',
          title: `Matériel ${it.condition.replace('_', ' ')} : ${it.name}`,
          description: `État dégradé constaté. Remplacement recommandé avant un grand départ.`,
          critical: true,
          item: it,
        });
      }
      if (it.loan_status === 'prêté') {
        out.push({
          id: `loan-${it.id}`,
          kind: 'loan',
          title: `Matériel prêté : ${it.name}`,
          description: `Prêté à ${it.loan_to_name || 'un ami'}. Pensez à le récupérer pour votre sortie.`,
          critical: false,
          item: it,
        });
      }
    });

    return out;
  }, [equipment]);

  // "À ne pas oublier" Proactive Checklist items
  const proactiveList = useMemo(() => {
    const list: {
      id: string;
      label: string;
      category: 'sécurité' | 'consommable' | 'météo' | 'oubli' | 'document';
      reason: string;
      critical: boolean;
      actionType?: 'cart' | 'gear';
      productSuggestion?: UnifiedProduct;
    }[] = [];

    // 1. Missing kit items for active departure
    hikeReadiness.missingItems.forEach(mi => {
      const matchedProd = (catalogProducts || FALLBACK_AUTHENTIC_PRODUCTS).find(
        p => p.name.toLowerCase().includes(mi.item_name.toLowerCase()) || mi.item_name.toLowerCase().includes(p.name.toLowerCase())
      );
      list.push({
        id: `missing-kit-${mi.id}`,
        label: `${mi.item_name} (Manquant)`,
        category: 'sécurité',
        reason: `Indispensable pour le kit "${activeKit?.name}"`,
        critical: true,
        actionType: 'cart',
        productSuggestion: matchedProd,
      });
    });

    // 2. Consumables from SmartDepartureEngine
    if (departurePlan) {
      if (departurePlan.consumables.fuelGrams > 0) {
        list.push({
          id: 'gas-refill',
          label: `Cartouche de gaz (~${departurePlan.consumables.fuelGrams}g requis)`,
          category: 'consommable',
          reason: `Calculé pour ${departurePlan.consumables.foodMealsCount} repas chauds`,
          critical: true,
        });
      }
      if (departurePlan.consumables.waterLiters > 0) {
        list.push({
          id: 'water-stock',
          label: `Autonomie en eau : ${departurePlan.consumables.waterLiters}L`,
          category: 'consommable',
          reason: departurePlan.consumables.waterReason,
          critical: true,
        });
      }
      if (departurePlan.consumables.rainProtectionNeeded) {
        list.push({
          id: 'rain-shield',
          label: 'Veste imperméable / Cape de pluie',
          category: 'météo',
          reason: 'Risque d’intempéries signalé sur le parcours',
          critical: true,
        });
      }
      if (departurePlan.consumables.sunProtectionNeeded) {
        list.push({
          id: 'sun-shield',
          label: 'Crème solaire & Lunettes cat. 3/4',
          category: 'météo',
          reason: 'Indice UV élevé / haute altitude',
          critical: false,
        });
      }
    }

    // 3. Urgent gear checks
    alerts.forEach(a => {
      if (a.kind === 'expiry') {
        list.push({
          id: `alert-exp-${a.item.id}`,
          label: `Vérifier péremption : ${a.item.name}`,
          category: 'sécurité',
          reason: 'Date limite dépassée ou imminente',
          critical: true,
        });
      } else if (a.kind === 'loan') {
        list.push({
          id: `alert-loan-${a.item.id}`,
          label: `Récupérer prêt : ${a.item.name}`,
          category: 'oubli',
          reason: `Actuellement chez ${a.item.loan_to_name || 'un ami'}`,
          critical: false,
        });
      }
    });

    // 4. Frequent outdoor forgotten items
    list.push(
      { id: 'charge-powerbank', label: 'Recharger lampe frontale & batterie externe', category: 'oubli', reason: 'Autonomie électrique sur le sentier', critical: false },
      { id: 'ign-map', label: 'Carte IGN papier & boussole de secours', category: 'sécurité', reason: 'Sécurité en cas de panne de batterie smartphone/GPS', critical: false },
      { id: 'waterproof-bag', label: 'Sacs étanches pour vêtements & duvet', category: 'oubli', reason: 'Protection absolue contre l’humidité', critical: false },
      { id: 'cash-id', label: 'Pièce d’identité & espèces (refuges)', category: 'document', reason: 'Nombreux refuges sans terminal carte bancaire', critical: false }
    );

    return list;
  }, [hikeReadiness, departurePlan, alerts, activeKit, catalogProducts]);

  // Drag & drop handler
  const handleDragEnd = (result: DropResult) => {
    if (!result.destination) return;
    const items = Array.from(cardOrder);
    const [reorderedItem] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reorderedItem);
    setCardOrder(items);
    localStorage.setItem('lkdv_cockpit_order', JSON.stringify(items));
    triggerHaptic('selection');
  };

  const closeExpanded = () => {
    triggerHaptic('selection');
    setExpandedCard(null);
  };

  // Keyboard shortcut Esc to close
  useEffect(() => {
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeExpanded();
    };
    window.addEventListener('keydown', onEsc);
    return () => window.removeEventListener('keydown', onEsc);
  }, []);

  // Quick Cart Action
  const handleAddProductToCart = (product: UnifiedProduct | { name: string; price_eur?: number; weight_g?: number; id?: string }) => {
    addToCart({
      id: product.id || `custom-${Date.now()}`,
      slug: (product as UnifiedProduct).slug || 'equipement-outdoor',
      name: product.name,
      brand: (product as UnifiedProduct).brand || 'LKDV Sélection',
      priceEur: product.price_eur || 49,
      weightG: product.weight_g || 150,
      category: (product as UnifiedProduct).category || 'équipement',
      image: (product as UnifiedProduct).image || 'https://images.unsplash.com/photo-1504280390367-361c6d9f38f4?auto=format&fit=crop&w=600&q=80',
      imageAlt: product.name,
    });
    showToast(`✓ "${product.name}" ajouté au panier`);
  };

  // Quick Loan Return Action
  const handleReturnLoan = async (item: UserEquipmentItem) => {
    await updateEquipment(item.id, { loan_status: 'disponible', loan_to_name: null });
    showToast(`✓ "${item.name}" marqué comme récupéré !`);
  };

  // Quick Maintenance Resolved Action
  const handleResolveMaintenance = async (item: UserEquipmentItem) => {
    const nextYear = new Date(Date.now() + 365 * 86400000).toISOString().split('T')[0];
    await updateEquipment(item.id, {
      last_maintenance_date: new Date().toISOString().split('T')[0],
      next_maintenance_date: nextYear,
      condition: 'bon',
    });
    showToast(`✓ Entretien de "${item.name}" validé pour 1 an`);
  };

  // =========================================================================
  // CARD 1: PROCHAIN DÉPART
  // =========================================================================
  const renderCardDepart = (isExpanded: boolean) => {
    const daysLeft = activeHike ? daysUntil(activeHike.targetDate) : null;
    const isUrgent = daysLeft !== null && daysLeft <= 3 && daysLeft >= 0;

    return (
      <div className="flex flex-col h-full text-white">
        {!activeHike ? (
          <div className="flex flex-col items-center justify-center h-full py-8 text-center">
            <div className="w-16 h-16 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-3xl mb-3">
              🏔️
            </div>
            <h3 className="font-extrabold text-xl mb-1">Aucun départ programmé</h3>
            <p className="text-white/60 text-sm max-w-sm mb-4">
              Planifiez une sortie pour que LKDV prépare automatiquement votre sac et votre checklist.
            </p>
            <Link
              href="/explorer"
              className="px-5 py-2.5 bg-[#A3C4A3] text-[#0B1F17] font-bold rounded-full text-sm hover:scale-105 transition-transform"
            >
              Explorer les randonnées
            </Link>
          </div>
        ) : (
          <div className="flex flex-col h-full justify-between gap-4">
            {/* Header compact & countdown */}
            <div className="flex justify-between items-start">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold tracking-wider uppercase bg-[#17402C] text-[#A3C4A3] border border-[#A3C4A3]/30">
                    Prochain Départ
                  </span>
                  {activeHike.isOvernight && (
                    <span className="px-2 py-0.5 rounded-full text-[10px] bg-white/10 text-white/70">
                      ⛺ Bivouac ({activeHike.nightsCount || 1}n)
                    </span>
                  )}
                </div>
                <h3 className={`font-black tracking-tight ${isExpanded ? 'text-4xl' : 'text-xl md:text-2xl'} text-white`}>
                  {activeHike.name}
                </h3>
                <p className="text-white/70 text-xs md:text-sm mt-0.5">
                  {activeHike.terrain || 'Montagne'} · {activeHike.difficulty || 'Moyen'} · {activeHike.distanceKm} km
                </p>
              </div>

              {/* Countdown & Readiness */}
              <div className="flex flex-col items-end shrink-0 pl-3">
                <span className={`font-black tracking-tighter ${isExpanded ? 'text-5xl' : 'text-3xl'} ${isUrgent ? 'text-[#E76F51] animate-pulse' : 'text-[#A3C4A3]'}`}>
                  {daysLeft === null ? 'Date libre' : daysLeft === 0 ? "Aujourd'hui" : daysLeft > 0 ? `J-${daysLeft}` : 'Passé'}
                </span>
                <span className="text-xs font-semibold text-white/60">
                  {hikeReadiness.readinessPct}% prêt
                </span>
              </div>
            </div>

            {/* Smart info row (Consumables & Kit) */}
            <div className="grid grid-cols-2 gap-2 bg-black/20 p-2.5 rounded-2xl border border-white/5">
              <div className="flex flex-col">
                <span className="text-[10px] text-white/50 uppercase font-semibold">Kit assigné</span>
                <span className="text-xs font-bold text-[#A3C4A3] truncate">
                  🎒 {activeKit?.name || 'Aucun kit lié'}
                </span>
                <span className="text-[11px] text-white/70">
                  {activeKit ? formatWeight(activeKit.total_weight_g || 0) : '—'}
                </span>
              </div>
              <div className="flex flex-col">
                <span className="text-[10px] text-white/50 uppercase font-semibold">Smart Consommables</span>
                <span className="text-xs font-bold text-white truncate">
                  💧 {departurePlan?.consumables.waterLiters || 2}L · 🍲 {departurePlan?.consumables.foodMealsCount || 2} repas
                </span>
                <span className="text-[11px] text-white/70">
                  🔥 {departurePlan?.consumables.fuelGrams || 100}g gaz
                </span>
              </div>
            </div>

            {/* Missing alert snippet */}
            {hikeReadiness.missingItems.length > 0 ? (
              <div className="flex items-center justify-between px-3 py-2 bg-[#E76F51]/15 border border-[#E76F51]/30 rounded-xl text-xs">
                <span className="text-[#E76F51] font-bold">
                  ⚠️ {hikeReadiness.missingItems.length} équipement(s) manquant(s)
                </span>
                <span className="text-[11px] text-white/70 underline">
                  {isExpanded ? 'Voir la liste ci-dessous' : 'Agrandir pour compléter'}
                </span>
              </div>
            ) : (
              <div className="flex items-center gap-2 px-3 py-1.5 bg-[#17402C]/40 border border-[#A3C4A3]/20 rounded-xl text-xs text-[#A3C4A3]">
                <span>✓</span>
                <span className="font-semibold">Kit complet & prêt pour le départ</span>
              </div>
            )}

            {/* EXPANDED FULLSCREEN DEEP DIVE */}
            {isExpanded && (
              <div className="mt-6 space-y-6 pt-6 border-t border-white/10">
                {/* 1. Hike Switcher if multiple */}
                {plannedHikes.length > 1 && (
                  <div className="bg-white/5 p-4 rounded-2xl border border-white/10">
                    <label className="text-xs font-bold uppercase tracking-wider text-white/60 block mb-2">
                      Changer la randonnée active :
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {plannedHikes.map(h => (
                        <button
                          key={h.id}
                          onClick={() => {
                            setActiveHike(h);
                            setActivePlannedHikeId(h.id);
                            triggerHaptic('selection');
                          }}
                          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${h.id === activeHike.id ? 'bg-[#A3C4A3] text-[#0B1F17]' : 'bg-white/10 text-white hover:bg-white/20'}`}
                        >
                          {h.name} ({h.targetDate})
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* 2. Detailed Specs Matrix */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div className="bg-white/5 p-3.5 rounded-2xl border border-white/10">
                    <span className="text-[11px] text-white/50 block">Distance</span>
                    <span className="text-xl font-black text-white">{activeHike.distanceKm} km</span>
                  </div>
                  <div className="bg-white/5 p-3.5 rounded-2xl border border-white/10">
                    <span className="text-[11px] text-white/50 block">Dénivelé positif</span>
                    <span className="text-xl font-black text-[#A3C4A3]">+{activeHike.elevationGain || 0} m</span>
                  </div>
                  <div className="bg-white/5 p-3.5 rounded-2xl border border-white/10">
                    <span className="text-[11px] text-white/50 block">Points d'eau sur trace</span>
                    <span className="text-xl font-black text-white">{activeHike.hasWaterPoints ? `${activeHike.waterPointsCount || 1} répertorié(s)` : 'Aucun point d’eau'}</span>
                  </div>
                  <div className="bg-white/5 p-3.5 rounded-2xl border border-white/10">
                    <span className="text-[11px] text-white/50 block">Météo prévue</span>
                    <span className="text-xl font-black text-white">{activeHike.weather?.tempC ? `${activeHike.weather.tempC}°C` : 'Tempérée'}</span>
                  </div>
                </div>

                {/* 3. Kit Switcher for this departure */}
                <div className="bg-white/5 p-5 rounded-2xl border border-white/10">
                  <div className="flex justify-between items-center mb-3">
                    <h4 className="font-bold text-sm uppercase tracking-wider text-[#A3C4A3]">
                      Kit associé à cette sortie
                    </h4>
                    <button
                      onClick={() => setIsKitDrawerOpen(true)}
                      className="text-xs font-bold text-white/80 hover:text-white underline"
                    >
                      Éditer le kit dans le studio
                    </button>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {kits.map(k => {
                      const isSelected = activeKit?.id === k.id;
                      return (
                        <div
                          key={k.id}
                          onClick={() => {
                            updatePlannedHike(activeHike.id, { assignedKitId: k.id });
                            setActiveHike(prev => prev ? { ...prev, assignedKitId: k.id } : null);
                            triggerHaptic('selection');
                          }}
                          className={`p-3.5 rounded-xl border cursor-pointer transition-all ${isSelected ? 'bg-[#17402C] border-[#A3C4A3] shadow-[0_0_15px_rgba(163,196,163,0.2)]' : 'bg-white/5 border-white/10 hover:bg-white/10'}`}
                        >
                          <div className="flex justify-between items-start">
                            <span className="font-bold text-sm">{k.name}</span>
                            {isSelected && <span className="text-xs text-[#A3C4A3]">✓ Actif</span>}
                          </div>
                          <p className="text-xs text-white/60 mt-1">{k.items?.length || 0} articles · {formatWeight(k.total_weight_g || 0)}</p>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* 4. Missing items resolution */}
                {hikeReadiness.missingItems.length > 0 && (
                  <div className="bg-[#E76F51]/10 p-5 rounded-2xl border border-[#E76F51]/30">
                    <h4 className="font-bold text-sm uppercase tracking-wider text-[#E76F51] mb-3">
                      Équipements manquants pour cette randonnée ({hikeReadiness.missingItems.length})
                    </h4>
                    <div className="space-y-2.5">
                      {hikeReadiness.missingItems.map(mi => (
                        <div key={mi.id} className="flex flex-wrap items-center justify-between gap-3 p-3 bg-black/40 rounded-xl border border-white/10">
                          <div>
                            <span className="font-bold text-sm text-white">{mi.item_name}</span>
                            <span className="text-xs text-white/50 block">{mi.category} · {formatWeight(mi.weight_g)}</span>
                          </div>
                          <div className="flex gap-2">
                            <button
                              onClick={() => {
                                addToEquipment(
                                  {
                                    name: mi.item_name,
                                    category: mi.category,
                                    weight_g: mi.weight_g,
                                  },
                                  { condition: 'bon' }
                                );
                                showToast(`✓ "${mi.item_name}" ajouté à votre inventaire`);
                              }}
                              className="px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white rounded-lg text-xs font-bold transition-colors"
                            >
                              Déjà possédé (ajouter)
                            </button>
                            <button
                              onClick={() => handleAddProductToCart({ name: mi.item_name, weight_g: mi.weight_g })}
                              className="px-3 py-1.5 bg-[#A3C4A3] text-[#0B1F17] hover:bg-[#b8d6b8] rounded-lg text-xs font-bold transition-colors"
                            >
                              + Ajouter au panier
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  // =========================================================================
  // CARD 2: MES KITS & SACS
  // =========================================================================
  const renderCardKits = (isExpanded: boolean) => {
    return (
      <div className="flex flex-col h-full text-white justify-between">
        <div>
          <div className="flex justify-between items-center mb-3">
            <span className="text-[11px] font-bold tracking-wider uppercase text-white/50">
              Mes Kits & Sacs
            </span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-[#17402C] text-[#A3C4A3] font-bold">
              {kits.length} créés
            </span>
          </div>

          {activeKit && (
            <div className="p-3 bg-white/5 rounded-2xl border border-white/10 mb-3">
              <div className="flex justify-between items-baseline mb-1">
                <h4 className="font-extrabold text-base truncate max-w-[140px] text-white">
                  {activeKit.name}
                </h4>
                {/* WEIGHT UNIQUE TO THIS SPECIFIC KIT */}
                <span className="text-lg font-black text-[#A3C4A3]">
                  {formatWeight(activeKit.total_weight_g || 0)}
                </span>
              </div>
              <div className="flex justify-between items-center text-xs text-white/60">
                <span>{activeKit.items?.length || 0} équipements</span>
                <span>{activeKit.season || '3 saisons'}</span>
              </div>
            </div>
          )}

          {/* Quick preview of secondary kit */}
          {kits.length > 1 && (
            <div className="space-y-1.5">
              {kits.filter(k => k.id !== activeKit?.id).slice(0, 2).map(k => (
                <div key={k.id} className="flex justify-between items-center px-2.5 py-1.5 bg-black/20 rounded-xl text-xs text-white/70">
                  <span className="truncate max-w-[130px] font-medium">{k.name}</span>
                  <span className="font-bold text-[#A3C4A3]">{formatWeight(k.total_weight_g || 0)}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="mt-3 pt-2 border-t border-white/5">
          <button
            onClick={() => setIsKitDrawerOpen(true)}
            className="w-full py-2 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-bold transition-colors text-center"
          >
            Ouvrir le Studio Kits
          </button>
        </div>

        {/* FULLSCREEN EXPANDED KIT MANAGER */}
        {isExpanded && (
          <div className="mt-8 space-y-6 pt-6 border-t border-white/10">
            <div className="flex justify-between items-center">
              <h3 className="text-xl font-bold text-white">Tous mes kits de randonnée ({kits.length})</h3>
              <button
                onClick={() => {
                  createKit({
                    name: `Nouveau Kit (${kits.length + 1})`,
                    description: 'Kit sur-mesure',
                    season: '3 Saisons',
                    activity: 'Randonnée',
                    for_destination: 'Toutes destinations',
                    items: [],
                  });
                  showToast('✓ Nouveau kit créé');
                }}
                className="px-4 py-2 bg-[#A3C4A3] text-[#0B1F17] font-bold text-xs rounded-xl"
              >
                + Créer un nouveau kit
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {kits.map(k => {
                const isSelected = selectedKitInFullscreen === k.id;
                const isAssigned = activeHike?.assignedKitId === k.id;

                return (
                  <div
                    key={k.id}
                    onClick={() => setSelectedKitInFullscreen(k.id)}
                    className={`p-5 rounded-2xl border cursor-pointer transition-all flex flex-col justify-between min-h-[160px] ${isSelected ? 'bg-[#17402C]/60 border-[#A3C4A3]' : 'bg-white/5 border-white/10 hover:bg-white/10'}`}
                  >
                    <div>
                      <div className="flex justify-between items-start mb-2">
                        <span className="font-extrabold text-base text-white">{k.name}</span>
                        {isAssigned && (
                          <span className="px-2 py-0.5 rounded-full bg-[#A3C4A3] text-[#0B1F17] text-[10px] font-bold">
                            Départ actif
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-white/60 mb-3">{k.description || 'Kit configuré pour l’aventure'}</p>
                    </div>

                    <div className="flex justify-between items-end pt-3 border-t border-white/10">
                      <div>
                        <span className="text-[10px] text-white/40 block uppercase">Poids du kit</span>
                        <span className="text-xl font-black text-[#A3C4A3]">{formatWeight(k.total_weight_g || 0)}</span>
                      </div>
                      <span className="text-xs text-white/70 font-semibold">{k.items?.length || 0} items</span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Inspect selected kit items */}
            {selectedKitInFullscreen && (
              <div className="bg-white/5 p-6 rounded-2xl border border-white/10 mt-6">
                {(() => {
                  const targetKit = kits.find(k => k.id === selectedKitInFullscreen);
                  if (!targetKit) return null;

                  return (
                    <div>
                      <div className="flex justify-between items-center mb-4">
                        <div>
                          <h4 className="font-bold text-lg text-white">{targetKit.name} — Contenu détaillé</h4>
                          <p className="text-xs text-white/60">Poids total spécifique : {formatWeight(targetKit.total_weight_g || 0)}</p>
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => {
                              if (activeHike) {
                                updatePlannedHike(activeHike.id, { assignedKitId: targetKit.id });
                                setActiveHike(prev => prev ? { ...prev, assignedKitId: targetKit.id } : null);
                                showToast(`✓ "${targetKit.name}" assigné au prochain départ`);
                              }
                            }}
                            className="px-3 py-1.5 bg-[#A3C4A3] text-[#0B1F17] font-bold text-xs rounded-lg"
                          >
                            Assigner au départ
                          </button>
                        </div>
                      </div>

                      {targetKit.items && targetKit.items.length > 0 ? (
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
                          {targetKit.items.map(item => (
                            <div key={item.id} className="p-3 bg-black/30 rounded-xl border border-white/5 flex justify-between items-center">
                              <div>
                                <span className="font-bold text-xs text-white">{item.item_name}</span>
                                <span className="text-[10px] text-white/50 block">{item.category}</span>
                              </div>
                              <span className="text-xs font-bold text-[#A3C4A3]">{formatWeight(item.weight_g)}</span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-xs text-white/50 text-center py-6">Ce kit ne contient aucun équipement pour l'instant.</p>
                      )}
                    </div>
                  );
                })()}
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  // =========================================================================
  // CARD 3: ALERTES & FIABILITÉ
  // =========================================================================
  const renderCardAlertes = (isExpanded: boolean) => {
    const hasAlerts = alerts.length > 0;

    return (
      <div className="flex flex-col h-full text-white justify-between">
        <div>
          <div className="flex justify-between items-center mb-2">
            <span className="text-[11px] font-bold tracking-wider uppercase text-white/50">
              Fiabilité & Alertes
            </span>
            <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${hasAlerts ? 'bg-[#E76F51]/20 text-[#E76F51]' : 'bg-[#17402C] text-[#A3C4A3]'}`}>
              {hasAlerts ? `${alerts.length} action(s)` : '0 alerte'}
            </span>
          </div>

          <div className="flex flex-col items-center justify-center py-3">
            {!hasAlerts ? (
              <div className="text-center">
                <div className="w-12 h-12 rounded-full bg-[#A3C4A3]/20 flex items-center justify-center text-2xl mx-auto mb-2 text-[#A3C4A3]">
                  ✓
                </div>
                <span className="text-sm font-bold text-[#A3C4A3] block">100% Opérationnel</span>
                <span className="text-[11px] text-white/50">Aucun matériel à réviser</span>
              </div>
            ) : (
              <div className="w-full">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-3xl font-black text-[#E76F51] drop-shadow-[0_0_15px_rgba(231,111,81,0.5)]">
                    {alerts.length}
                  </span>
                  <span className="text-xs text-white/70 font-semibold leading-tight">
                    points d'attention avant départ
                  </span>
                </div>
                {/* Show top priority alert */}
                <div className="p-2.5 bg-[#E76F51]/15 border border-[#E76F51]/30 rounded-xl">
                  <span className="text-xs font-bold text-[#E76F51] block truncate">
                    {alerts[0].title}
                  </span>
                  <span className="text-[10px] text-white/70 line-clamp-1">
                    {alerts[0].description}
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>

        <button
          onClick={() => {
            triggerHaptic('selection');
            setExpandedCard('alertes');
          }}
          className="w-full py-2 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-bold transition-colors text-center"
        >
          {hasAlerts ? 'Résoudre les alertes' : 'Voir l’historique'}
        </button>

        {/* FULLSCREEN RESOLUTION CENTER */}
        {isExpanded && (
          <div className="mt-8 space-y-6 pt-6 border-t border-white/10">
            <div className="flex flex-wrap gap-2">
              {['all', 'maintenance', 'expiry', 'loan', 'replace'].map(tab => (
                <button
                  key={tab}
                  onClick={() => setAlertFilterTab(tab)}
                  className={`px-3 py-1.5 rounded-full text-xs font-bold uppercase transition-all ${alertFilterTab === tab ? 'bg-[#A3C4A3] text-[#0B1F17]' : 'bg-white/10 text-white hover:bg-white/20'}`}
                >
                  {tab === 'all' ? `Toutes (${alerts.length})` : tab}
                </button>
              ))}
            </div>

            {alerts.length === 0 ? (
              <div className="p-12 text-center bg-white/5 rounded-3xl border border-white/10">
                <span className="text-4xl block mb-2">🎉</span>
                <h4 className="text-lg font-bold text-white mb-1">Tout votre équipement est à jour !</h4>
                <p className="text-xs text-white/60">Aucune maintenance en retard, aucun objet prêté, aucune péremption.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                {alerts
                  .filter(a => alertFilterTab === 'all' || a.kind === alertFilterTab)
                  .map(alert => (
                    <div key={alert.id} className="p-4 bg-white/5 border border-white/10 rounded-2xl flex flex-col justify-between gap-3">
                      <div>
                        <div className="flex justify-between items-start mb-1">
                          <span className={`text-[10px] uppercase font-black px-2 py-0.5 rounded-full ${alert.critical ? 'bg-[#E76F51]/20 text-[#E76F51]' : 'bg-amber-500/20 text-amber-300'}`}>
                            {alert.kind}
                          </span>
                          <span className="text-xs text-white/50">{alert.item.category}</span>
                        </div>
                        <h4 className="font-bold text-sm text-white mt-1">{alert.title}</h4>
                        <p className="text-xs text-white/60 mt-0.5">{alert.description}</p>
                      </div>

                      <div className="flex justify-end gap-2 pt-2 border-t border-white/5">
                        {alert.kind === 'maintenance' && (
                          <button
                            onClick={() => handleResolveMaintenance(alert.item)}
                            className="px-3 py-1.5 bg-[#A3C4A3] text-[#0B1F17] rounded-lg text-xs font-bold hover:bg-[#b5d6b5]"
                          >
                            ✓ Marquer comme révisé
                          </button>
                        )}
                        {alert.kind === 'loan' && (
                          <button
                            onClick={() => handleReturnLoan(alert.item)}
                            className="px-3 py-1.5 bg-[#A3C4A3] text-[#0B1F17] rounded-lg text-xs font-bold hover:bg-[#b5d6b5]"
                          >
                            ✓ Marquer comme rendu
                          </button>
                        )}
                        {alert.kind === 'replace' && (
                          <button
                            onClick={() => handleAddProductToCart({ name: alert.item.name, weight_g: alert.item.weight_g })}
                            className="px-3 py-1.5 bg-[#E76F51] text-white rounded-lg text-xs font-bold"
                          >
                            + Remplacer (Panier)
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  // =========================================================================
  // CARD 4: À NE PAS OUBLIER (Checklist Proactive)
  // =========================================================================
  const renderCardOublier = (isExpanded: boolean) => {
    const uncheckedCount = proactiveList.filter(p => !checkedOublis[p.id]).length;

    return (
      <div className="flex flex-col h-full text-white">
        <div className="flex justify-between items-center mb-3">
          <div className="flex items-center gap-3">
            <span className="text-2xl font-black text-[#E9C46A] drop-shadow-[0_0_12px_rgba(233,196,106,0.3)]">
              {uncheckedCount}
            </span>
            <div>
              <span className="text-[11px] font-bold tracking-wider uppercase text-white/70 block">
                À ne pas oublier
              </span>
              <span className="text-[10px] text-white/50">
                {proactiveList.length - uncheckedCount}/{proactiveList.length} vérifiés
              </span>
            </div>
          </div>
          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-[#E9C46A]/20 text-[#E9C46A] border border-[#E9C46A]/30">
            Checklist Départ
          </span>
        </div>

        {/* Compact List with real interactive checkboxes */}
        <div className="space-y-2 flex-1 overflow-hidden">
          {proactiveList.slice(0, 3).map((item) => {
            const isChecked = !!checkedOublis[item.id];
            return (
              <div
                key={item.id}
                onClick={() => toggleOubliCheck(item.id)}
                className={`flex items-center justify-between p-2.5 rounded-xl cursor-pointer border transition-all ${isChecked ? 'bg-white/5 border-white/5 opacity-50' : item.critical ? 'bg-[#E9C46A]/10 border-[#E9C46A]/30' : 'bg-black/30 border-white/10'}`}
              >
                <div className="flex items-center gap-2.5 truncate">
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={() => {}}
                    className="w-4 h-4 rounded accent-[#A3C4A3] pointer-events-none"
                  />
                  <div className="truncate">
                    <span className={`text-xs font-semibold block truncate ${isChecked ? 'line-through text-white/50' : 'text-white'}`}>
                      {item.label}
                    </span>
                    <span className="text-[10px] text-white/50 truncate block">{item.reason}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {proactiveList.length > 3 && !isExpanded && (
          <p className="text-[11px] text-white/40 text-center mt-2">
            +{proactiveList.length - 3} autres points de contrôle (agrandir)
          </p>
        )}

        {/* FULLSCREEN EXPANDED CHECKLIST */}
        {isExpanded && (
          <div className="mt-8 space-y-6 pt-6 border-t border-white/10">
            <div className="flex justify-between items-center">
              <div>
                <h3 className="text-xl font-bold text-white">Checklist d'Expédition Complète</h3>
                <p className="text-xs text-white/60">Cochez les éléments au fur et à mesure que vous préparez votre sac.</p>
              </div>
              <button
                onClick={() => {
                  setCheckedOublis({});
                  localStorage.removeItem('lkdv_checked_oublis');
                  showToast('Checklist réinitialisée');
                }}
                className="text-xs text-white/60 hover:text-white underline"
              >
                Tout décocher
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {proactiveList.map(item => {
                const isChecked = !!checkedOublis[item.id];

                return (
                  <div
                    key={item.id}
                    className={`p-3.5 rounded-2xl border flex items-center justify-between gap-3 transition-all ${isChecked ? 'bg-white/5 border-white/5 opacity-50' : 'bg-white/10 border-white/10'}`}
                  >
                    <div
                      onClick={() => toggleOubliCheck(item.id)}
                      className="flex items-center gap-3 cursor-pointer flex-1"
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => {}}
                        className="w-5 h-5 rounded accent-[#A3C4A3] pointer-events-none"
                      />
                      <div>
                        <div className="flex items-center gap-2">
                          <span className={`font-bold text-sm ${isChecked ? 'line-through text-white/50' : 'text-white'}`}>
                            {item.label}
                          </span>
                          <span className="text-[9px] uppercase px-1.5 py-0.5 rounded bg-white/10 text-white/60">
                            {item.category}
                          </span>
                        </div>
                        <span className="text-xs text-white/50 block">{item.reason}</span>
                      </div>
                    </div>

                    {item.actionType === 'cart' && (
                      <button
                        onClick={() => handleAddProductToCart(item.productSuggestion || { name: item.label })}
                        className="px-3 py-1.5 bg-[#A3C4A3] text-[#0B1F17] font-bold text-xs rounded-lg shrink-0"
                      >
                        + Panier
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    );
  };

  // =========================================================================
  // CARD 5: MES ÉQUIPEMENTS & CATALOGUE (Vue unitaire par catégorie)
  // =========================================================================
  const renderCardEquipements = (isExpanded: boolean) => {
    const counts = CATEGORIES.reduce((acc, cat) => {
      acc[cat] = equipment.filter(e => (e.category || 'Autre').toLowerCase().includes(cat.toLowerCase())).length;
      return acc;
    }, {} as Record<string, number>);

    const totalWeight = equipment.reduce((sum, item) => sum + (item.weight_g || 0), 0);

    return (
      <div className="flex flex-col h-full text-white justify-between">
        <div>
          <div className="flex justify-between items-center mb-2">
            <span className="text-[11px] font-bold tracking-wider uppercase text-white/50">
              Mes Équipements
            </span>
            <span className="text-xs text-[#A3C4A3] font-bold">
              {equipment.length} items · {formatWeight(totalWeight)}
            </span>
          </div>

          {/* Category Chips with count */}
          <div className="flex flex-wrap gap-1.5 py-1">
            {CATEGORIES.slice(0, 5).map(cat => (
              <div
                key={cat}
                className="px-2.5 py-1 bg-white/5 border border-white/10 rounded-lg text-[11px] flex items-center gap-1.5"
              >
                <span className="text-white/80">{cat}</span>
                <span className="text-[#A3C4A3] font-black">{counts[cat] || 0}</span>
              </div>
            ))}
          </div>

          {/* Mini preview */}
          <div className="mt-2.5 space-y-1">
            {equipment.slice(0, 2).map(e => (
              <div key={e.id} className="flex justify-between items-center px-2.5 py-1 bg-black/20 rounded-lg text-xs">
                <span className="truncate max-w-[130px]">{e.name}</span>
                <span className="text-white/50 text-[10px]">{formatWeight(e.weight_g)}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="flex gap-2 mt-3 pt-2 border-t border-white/5">
          <button
            onClick={() => setIsAddModalOpen(true)}
            className="flex-1 py-1.5 bg-[#A3C4A3] text-[#0B1F17] hover:bg-[#b5d6b5] rounded-xl text-xs font-bold transition-colors text-center"
          >
            + Ajouter
          </button>
          <button
            onClick={() => {
              triggerHaptic('selection');
              setExpandedCard('equipements');
            }}
            className="flex-1 py-1.5 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-bold transition-colors text-center"
          >
            Catalogue
          </button>
        </div>

        {/* FULLSCREEN EXPANDED INVENTORY & CATALOG MATRIX */}
        {isExpanded && (
          <div className="mt-8 space-y-6 pt-6 border-t border-white/10">
            {/* Filter Tabs & Search */}
            <div className="flex flex-wrap justify-between items-center gap-3">
              <div className="flex flex-wrap gap-1.5">
                {['Tous', ...CATEGORIES].map(cat => (
                  <button
                    key={cat}
                    onClick={() => setSelectedCategoryTab(cat)}
                    className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all ${selectedCategoryTab === cat ? 'bg-[#A3C4A3] text-[#0B1F17]' : 'bg-white/10 text-white hover:bg-white/20'}`}
                  >
                    {cat}
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="text"
                  placeholder="Rechercher un matériel..."
                  value={gearSearchQuery}
                  onChange={(e) => setGearSearchQuery(e.target.value)}
                  className="px-3 py-1.5 bg-white/10 border border-white/10 rounded-xl text-xs text-white placeholder-white/40 focus:outline-none focus:border-[#A3C4A3]"
                />
                <button
                  onClick={() => setIsAddModalOpen(true)}
                  className="px-3 py-1.5 bg-[#A3C4A3] text-[#0B1F17] rounded-xl text-xs font-bold"
                >
                  + Ajouter
                </button>
              </div>
            </div>

            {/* Owned vs Catalog toggle */}
            <div className="flex gap-2">
              <button
                onClick={() => setGearPossessionFilter('all')}
                className={`px-3 py-1 rounded-lg text-xs font-bold ${gearPossessionFilter === 'all' ? 'bg-white/20 text-white' : 'text-white/50'}`}
              >
                Tous
              </button>
              <button
                onClick={() => setGearPossessionFilter('owned')}
                className={`px-3 py-1 rounded-lg text-xs font-bold ${gearPossessionFilter === 'owned' ? 'bg-[#17402C] text-[#A3C4A3]' : 'text-white/50'}`}
              >
                Possédés ({equipment.length})
              </button>
              <button
                onClick={() => setGearPossessionFilter('catalog')}
                className={`px-3 py-1 rounded-lg text-xs font-bold ${gearPossessionFilter === 'catalog' ? 'bg-amber-500/20 text-amber-300' : 'text-white/50'}`}
              >
                Recommandés / Catalogue
              </button>
            </div>

            {/* Inventory Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              {/* 1. Owned items */}
              {(gearPossessionFilter === 'all' || gearPossessionFilter === 'owned') &&
                equipment
                  .filter(e => selectedCategoryTab === 'Tous' || (e.category || '').toLowerCase().includes(selectedCategoryTab.toLowerCase()))
                  .filter(e => !gearSearchQuery || e.name.toLowerCase().includes(gearSearchQuery.toLowerCase()) || (e.brand || '').toLowerCase().includes(gearSearchQuery.toLowerCase()))
                  .map(item => (
                    <div key={item.id} className="p-4 bg-white/5 border border-white/10 rounded-2xl flex flex-col justify-between">
                      <div>
                        <div className="flex justify-between items-start mb-1">
                          <span className="px-2 py-0.5 rounded bg-[#17402C] text-[#A3C4A3] text-[10px] font-bold uppercase">
                            Possédé
                          </span>
                          <span className="text-xs text-white/50 font-medium">{item.category}</span>
                        </div>
                        <h4 className="font-bold text-sm text-white mt-1">{item.name}</h4>
                        <p className="text-xs text-white/60">{item.brand || 'Sans marque'} · {formatWeight(item.weight_g)}</p>
                      </div>

                      <div className="flex justify-between items-center pt-3 mt-3 border-t border-white/5">
                        <span className="text-[11px] text-white/40">{item.condition || 'Bon état'}</span>
                        <div className="flex gap-1.5">
                          <button
                            onClick={() => {
                              setSelectedLendItem(item);
                              setIsLendModalOpen(true);
                            }}
                            className="px-2 py-1 bg-white/10 hover:bg-white/20 rounded text-[11px] font-bold"
                          >
                            Prêter
                          </button>
                          <button
                            onClick={() => {
                              setEditingItem(item);
                              setIsAddModalOpen(true);
                            }}
                            className="px-2 py-1 bg-white/10 hover:bg-white/20 rounded text-[11px] font-bold"
                          >
                            Éditer
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}

              {/* 2. Catalog / Non-possessed items (with ADD TO CART button) */}
              {(gearPossessionFilter === 'all' || gearPossessionFilter === 'catalog') &&
                (catalogProducts || FALLBACK_AUTHENTIC_PRODUCTS)
                  .filter(p => selectedCategoryTab === 'Tous' || p.category.toLowerCase().includes(selectedCategoryTab.toLowerCase()))
                  .filter(p => !equipment.some(e => e.name.toLowerCase() === p.name.toLowerCase()))
                  .filter(p => !gearSearchQuery || p.name.toLowerCase().includes(gearSearchQuery.toLowerCase()) || p.brand.toLowerCase().includes(gearSearchQuery.toLowerCase()))
                  .map(product => (
                    <div key={product.id} className="p-4 bg-amber-500/[0.03] border border-amber-500/20 rounded-2xl flex flex-col justify-between">
                      <div>
                        <div className="flex justify-between items-start mb-1">
                          <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 text-[10px] font-bold uppercase">
                            Non possédé
                          </span>
                          <span className="text-xs font-black text-white">{product.price_eur} €</span>
                        </div>
                        <h4 className="font-bold text-sm text-white mt-1">{product.name}</h4>
                        <p className="text-xs text-white/60">{product.brand} · {formatWeight(product.weight_g)}</p>
                      </div>

                      <div className="flex gap-2 pt-3 mt-3 border-t border-white/5">
                        <button
                          onClick={() => {
                            addToEquipment(
                              {
                                name: product.name,
                                brand: product.brand,
                                category: product.category,
                                weight_g: product.weight_g,
                                price_eur: product.price_eur,
                              },
                              { condition: 'neuf' }
                            );
                            showToast(`✓ "${product.name}" ajouté à votre inventaire`);
                          }}
                          className="flex-1 py-1.5 bg-white/10 hover:bg-white/20 text-white rounded-lg text-xs font-bold transition-colors"
                        >
                          + Inventaire
                        </button>
                        <button
                          onClick={() => handleAddProductToCart(product)}
                          className="flex-1 py-1.5 bg-[#A3C4A3] text-[#0B1F17] hover:bg-[#b5d6b5] rounded-lg text-xs font-bold transition-colors"
                        >
                          + Au panier
                        </button>
                      </div>
                    </div>
                  ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  // =========================================================================
  // CARD 6: ACTIONS RAPIDES & OUTILS
  // =========================================================================
  const renderCardActions = (isExpanded: boolean) => {
    return (
      <div className="flex flex-col h-full text-white justify-between">
        <span className="text-[11px] font-bold tracking-wider uppercase text-white/50 mb-2">
          Actions Rapides
        </span>

        <div className="grid grid-cols-2 gap-2 flex-1">
          <button
            onClick={() => {
              setEditingItem(null);
              setIsAddModalOpen(true);
            }}
            className="p-2.5 bg-white/5 hover:bg-white/15 border border-white/10 rounded-xl flex flex-col items-center justify-center gap-1 transition-all group"
          >
            <span className="text-lg group-hover:scale-110 transition-transform">➕</span>
            <span className="text-[11px] font-bold text-center">Ajouter</span>
          </button>

          <button
            onClick={() => setIsKitDrawerOpen(true)}
            className="p-2.5 bg-white/5 hover:bg-white/15 border border-white/10 rounded-xl flex flex-col items-center justify-center gap-1 transition-all group"
          >
            <span className="text-lg group-hover:scale-110 transition-transform">🎒</span>
            <span className="text-[11px] font-bold text-center">Kits</span>
          </button>

          <button
            onClick={() => {
              if (equipment.length > 0) {
                setSelectedLendItem(equipment[0]);
                setIsLendModalOpen(true);
              }
            }}
            className="p-2.5 bg-white/5 hover:bg-white/15 border border-white/10 rounded-xl flex flex-col items-center justify-center gap-1 transition-all group"
          >
            <span className="text-lg group-hover:scale-110 transition-transform">🤝</span>
            <span className="text-[11px] font-bold text-center">Prêter</span>
          </button>

          <button
            onClick={() => {
              triggerHaptic('selection');
              setExpandedCard('equipements');
            }}
            className="p-2.5 bg-white/5 hover:bg-white/15 border border-white/10 rounded-xl flex flex-col items-center justify-center gap-1 transition-all group"
          >
            <span className="text-lg group-hover:scale-110 transition-transform">📋</span>
            <span className="text-[11px] font-bold text-center">Inventaire</span>
          </button>
        </div>

        {isExpanded && (
          <div className="mt-6 pt-6 border-t border-white/10">
            <h4 className="font-bold text-sm mb-3">Boîte à outils de l'explorateur</h4>
            <p className="text-xs text-white/60 mb-4">Générez des rapports, exportez votre inventaire en PDF ou préparez un kit en 1 clic.</p>
            <div className="flex gap-3">
              <Link href="/preparer-randonnee" className="px-4 py-2 bg-[#A3C4A3] text-[#0B1F17] rounded-xl text-xs font-bold">
                Moteur de préparation pas-à-pas
              </Link>
              <Link href="/explorer" className="px-4 py-2 bg-white/10 text-white rounded-xl text-xs font-bold">
                Chercher une nouvelle randonnée
              </Link>
            </div>
          </div>
        )}
      </div>
    );
  };

  // Router for Card Content
  const getCardContent = (id: CardId, isExpanded: boolean) => {
    switch (id) {
      case 'depart': return renderCardDepart(isExpanded);
      case 'kits': return renderCardKits(isExpanded);
      case 'alertes': return renderCardAlertes(isExpanded);
      case 'oublier': return renderCardOublier(isExpanded);
      case 'equipements': return renderCardEquipements(isExpanded);
      case 'actions': return renderCardActions(isExpanded);
      default: return null;
    }
  };

  const getCardTitle = (id: CardId) => {
    switch (id) {
      case 'depart': return 'Prochain départ';
      case 'kits': return 'Mes Kits & Sacs';
      case 'alertes': return 'Alertes & Fiabilité';
      case 'oublier': return 'À ne pas oublier';
      case 'equipements': return 'Mes Équipements';
      case 'actions': return 'Actions rapides';
      default: return '';
    }
  };

  return (
    <div className="fixed inset-0 w-full bg-[#0B1F17] text-white overflow-hidden flex flex-col font-sans select-none">
      <Header />

      {/* Toast Notification Floating */}
      <AnimatePresence>
        {toastMessage && (
          <motion.div
            initial={{ opacity: 0, y: -20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.95 }}
            className="fixed top-20 left-1/2 -translate-x-1/2 z-[100] px-5 py-2.5 bg-[#17402C] border border-[#A3C4A3] text-[#A3C4A3] rounded-full text-xs font-bold shadow-2xl backdrop-blur-xl"
          >
            {toastMessage}
          </motion.div>
        )}
      </AnimatePresence>

      <main className="flex-1 w-full max-w-[1550px] mx-auto px-4 pt-20 pb-4 flex flex-col h-[100dvh]">
        <DragDropContext onDragEnd={handleDragEnd}>
          <Droppable droppableId="cockpit-grid" direction="horizontal">
            {(provided) => (
              <div
                {...provided.droppableProps}
                ref={provided.innerRef}
                className="grid grid-cols-1 md:grid-cols-4 gap-3.5 flex-1 h-full max-h-[calc(100dvh-5.5rem)]"
              >
                {cardOrder.map((cardId, index) => {
                  const isLarge = cardId === 'depart' || cardId === 'oublier';
                  const isHidden = expandedCard && expandedCard !== cardId;

                  return (
                    <Draggable key={cardId} draggableId={cardId} index={index} isDragDisabled={expandedCard !== null}>
                      {(provided, snapshot) => (
                        <div
                          ref={provided.innerRef}
                          {...provided.draggableProps}
                          className={`${isLarge ? 'md:col-span-2' : 'md:col-span-1'} h-full transition-all duration-300`}
                          style={{
                            ...provided.draggableProps.style,
                            opacity: isHidden ? 0.15 : (snapshot.isDragging ? 0.8 : 1),
                            transform: `${provided.draggableProps.style?.transform || ''} ${isHidden ? 'scale(0.98)' : 'scale(1)'}`,
                          }}
                        >
                          <motion.div
                            layoutId={`card-container-${cardId}`}
                            className="w-full h-full rounded-[24px] border border-white/10 bg-gradient-to-br from-white/[0.08] to-white/[0.02] backdrop-blur-xl shadow-[0_8px_32px_rgba(0,0,0,0.37)] flex flex-col overflow-hidden hover:border-white/20 transition-colors"
                          >
                            {/* Card Header with Drag Handle & Expand Button */}
                            <motion.div
                              layoutId={`card-header-${cardId}`}
                              className="flex items-center justify-between px-4 py-2.5 border-b border-white/10 bg-black/25 shrink-0"
                            >
                              <div className="flex items-center gap-2.5">
                                <div
                                  {...provided.dragHandleProps}
                                  className="text-white/40 hover:text-white cursor-grab active:cursor-grabbing p-1 -ml-1 transition-colors"
                                  aria-label="Déplacer la carte"
                                >
                                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                    <circle cx="9" cy="6" r="1.5" />
                                    <circle cx="15" cy="6" r="1.5" />
                                    <circle cx="9" cy="12" r="1.5" />
                                    <circle cx="15" cy="12" r="1.5" />
                                    <circle cx="9" cy="18" r="1.5" />
                                    <circle cx="15" cy="18" r="1.5" />
                                  </svg>
                                </div>
                                <h2 className="font-bold text-xs uppercase tracking-wider text-white/90">
                                  {getCardTitle(cardId)}
                                </h2>
                              </div>

                              <button
                                onClick={() => {
                                  triggerHaptic('selection');
                                  setExpandedCard(cardId);
                                }}
                                aria-label={`Agrandir le widget ${getCardTitle(cardId)}`}
                                className="w-7 h-7 rounded-full bg-white/10 hover:bg-white/25 flex items-center justify-center transition-colors text-white/80 hover:text-white"
                              >
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                  <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" strokeLinecap="round" strokeLinejoin="round" />
                                </svg>
                              </button>
                            </motion.div>

                            {/* Card Content Compact */}
                            <div className="flex-1 p-3.5 overflow-hidden flex flex-col">
                              {getCardContent(cardId, false)}
                            </div>
                          </motion.div>
                        </div>
                      )}
                    </Draggable>
                  );
                })}
                {provided.placeholder}
              </div>
            )}
          </Droppable>
        </DragDropContext>
      </main>

      {/* Expanded Fullscreen Overlay Backdrop */}
      <AnimatePresence>
        {expandedCard && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 bg-black/85 backdrop-blur-md"
            onClick={closeExpanded}
          />
        )}
      </AnimatePresence>

      {/* Expanded Fullscreen Shared Element Card */}
      <AnimatePresence>
        {expandedCard && (
          <motion.div
            layoutId={`card-container-${expandedCard}`}
            transition={{ type: 'spring', stiffness: 280, damping: 28, duration: 0.45 }}
            className="fixed inset-4 md:inset-8 z-50 rounded-[32px] border border-white/20 bg-[#0B1F17] shadow-[0_20px_60px_rgba(0,0,0,0.8)] flex flex-col overflow-hidden select-text"
          >
            {/* Header in Fullscreen */}
            <motion.div
              layoutId={`card-header-${expandedCard}`}
              className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-black/30 shrink-0"
            >
              <div className="flex items-center gap-3">
                <span className="w-3 h-3 rounded-full bg-[#A3C4A3] animate-pulse" />
                <h2 className="font-black text-xl uppercase tracking-wider text-[#A3C4A3]">
                  {getCardTitle(expandedCard)}
                </h2>
              </div>

              <button
                onClick={closeExpanded}
                aria-label={`Réduire le widget ${getCardTitle(expandedCard)}`}
                className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/25 flex items-center justify-center transition-colors text-white"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
            </motion.div>

            {/* Deep Expanded Content */}
            <motion.div
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1, duration: 0.3 }}
              className="flex-1 p-6 md:p-8 overflow-y-auto"
            >
              {getCardContent(expandedCard, true)}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Modals & Drawers */}
      <AddEditGearModal
        isOpen={isAddModalOpen}
        initialItem={editingItem as any}
        onClose={() => {
          setIsAddModalOpen(false);
          setEditingItem(null);
        }}
        onSave={async (itemData) => {
          if (editingItem) {
            await updateEquipment(editingItem.id, itemData);
            showToast('✓ Équipement mis à jour');
          } else {
            await addToEquipment(itemData as any);
            showToast('✓ Équipement ajouté à l’inventaire');
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
          if (activeHike) updatePlannedHike(activeHike.id, { assignedKitId: kit.id });
          setIsKitDrawerOpen(false);
          showToast(`✓ Kit "${kit.name}" sélectionné pour le départ`);
        }}
        onUpdateKit={async (kitId, patch) => {
          await updateKit(kitId, patch);
          showToast('✓ Kit mis à jour');
        }}
        onDeleteKit={async (kitId) => {
          await moveToTrash(kitId);
          setIsKitDrawerOpen(false);
          showToast('✓ Kit supprimé');
        }}
        onAddGearToInventory={async (product) => {
          await addToEquipment({
            name: product.name,
            category: product.category || 'Autre',
            weight_g: product.weight_g || 100,
          });
          showToast(`✓ "${product.name}" ajouté à votre inventaire`);
        }}
        onAddToCart={(p) => handleAddProductToCart(p)}
      />

      <LendItemModal
        isOpen={isLendModalOpen}
        item={selectedLendItem || equipment[0] || null}
        onClose={() => {
          setIsLendModalOpen(false);
          setSelectedLendItem(null);
        }}
        onSaveLoan={async (borrowerName, returnDate, notes) => {
          if (selectedLendItem) {
            await updateEquipment(selectedLendItem.id, {
              loan_status: 'prêté',
              loan_to_name: borrowerName,
              expiry_date: returnDate,
              notes: notes || selectedLendItem.notes,
            });
            showToast(`✓ "${selectedLendItem.name}" marqué prêté à ${borrowerName}`);
          }
          setIsLendModalOpen(false);
          setSelectedLendItem(null);
        }}
        onSave={async (lendData) => {
          if (selectedLendItem) {
            await updateEquipment(selectedLendItem.id, {
              loan_status: 'prêté',
              loan_to_name: lendData.loan_to_name,
              expiry_date: lendData.expiry_date,
              notes: lendData.notes || selectedLendItem.notes,
            });
            showToast(`✓ "${selectedLendItem.name}" prêté à ${lendData.loan_to_name}`);
          }
          setIsLendModalOpen(false);
          setSelectedLendItem(null);
        }}
      />
    </div>
  );
}