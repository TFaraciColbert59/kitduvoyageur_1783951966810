'use client';

import React, { useState, useMemo, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Header from '@/components/Header';
import { useEquipment, UserEquipmentItem } from '@/hooks/useEquipment';
import { useUserKits, CustomKit } from '@/hooks/useUserKits';
import { useHapticFeedback } from '@/hooks/useHapticFeedback';
import { EQUIPMENT_CATEGORIES, getCategoryIcon } from '@/constants/equipmentCategories';
import UnifiedGearCard from '@/components/inventaire/UnifiedGearCard';
import GearDetailDrawer from '@/components/inventaire/GearDetailDrawer';
import InventaireHeroBanner from '@/components/inventaire/InventaireHeroBanner';
import KitsManagerView from '@/components/inventaire/KitsManagerView';
import AIConfiguratorHeroCard from '@/components/inventaire/AIConfiguratorHeroCard';
import { adaptUserEquipmentToGearItemData, evaluateGearAlerts } from '@/lib/equipmentAdapter';
import LendItemModal from '@/components/inventaire/LendItemModal';
import { addToCart } from '@/lib/cart';
import {
  PlannedHike,
  getPlannedHikes,
  getActivePlannedHike,
  setActivePlannedHikeId,
} from '@/lib/preparation/plannedHikes';
import {
  resolveDeparturePlan,
  recordPostHikeGearUsage,
} from '@/lib/preparation/SmartDepartureEngine';

function formatWeight(g: number): string {
  if (g >= 1000) return `${(g / 1000).toFixed(1)} kg`;
  return `${g} g`;
}

function formatDateFR(dateStr?: string): string {
  if (!dateStr) return '';
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
  } catch {
    return dateStr;
  }
}

export default function MonMaterielPage() {
  const { triggerHaptic } = useHapticFeedback();
  const searchInputRef = useRef<HTMLInputElement>(null);

  // 1. Matériel & Catalogue
  const {
    equipment,
    products,
    loading: equipmentLoading,
    totalPackWeight,
    isOwned,
    addToEquipment,
    removeFromEquipment,
    updateEquipment,
  } = useEquipment();

  // 2. Kits Intelligents & Cycle de vie
  const {
    kits,
    trashKits,
    totalKitsCount,
    loading: kitsLoading,
    createKit,
    updateKit,
    moveToTrash,
    restoreFromTrash,
    permanentDelete,
    handleGearDeleted,
  } = useUserKits(equipment);

  // 3. Randonnées Planifiées enregistrées
  const [plannedHikes, setPlannedHikes] = useState<PlannedHike[]>([]);
  const [activeHike, setActiveHike] = useState<PlannedHike | null>(null);
  const [selectedKitForDeparture, setSelectedKitForDeparture] = useState<CustomKit | null>(null);
  const [checkedDepartureItems, setCheckedDepartureItems] = useState<Set<string>>(new Set());
  const [departureCompleted, setDepartureCompleted] = useState(false);

  useEffect(() => {
    const hikes = getPlannedHikes();
    setPlannedHikes(hikes);
    const active = getActivePlannedHike();
    setActiveHike(active);
  }, []);

  // Filtre unique Inventaire : 'all' (Tout) | 'owned' (Possédé)
  const [inventoryFilter, setInventoryFilter] = useState<'all' | 'owned'>('all');
  const [search, setSearch] = useState('');

  // Drawer / Modales
  const [selectedGearItem, setSelectedGearItem] = useState<UserEquipmentItem | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingItem, setEditingItem] = useState<UserEquipmentItem | null>(null);
  const [lendingItem, setLendingItem] = useState<UserEquipmentItem | null>(null);
  const [cartToast, setCartToast] = useState<string | null>(null);

  // Formulaire d'ajout / édition manuelle de matériel
  const [formName, setFormName] = useState('');
  const [formBrand, setFormBrand] = useState('');
  const [formCategory, setFormCategory] = useState('Couchage');
  const [formWeight, setFormWeight] = useState('');
  const [formPrice, setFormPrice] = useState('');
  const [formCondition, setFormCondition] = useState<UserEquipmentItem['condition']>('excellent');
  const [formNotes, setFormNotes] = useState('');
  const [formMaintDate, setFormMaintDate] = useState('');
  const [formExpDate, setFormExpDate] = useState('');

  // Raccourcis clavier (/, +, n)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as HTMLElement)?.tagName)) {
        return;
      }
      if (e.key === '/') {
        e.preventDefault();
        triggerHaptic('light');
        searchInputRef.current?.focus();
      } else if (e.key === '+' || e.key === 'n' || e.key === 'N') {
        e.preventDefault();
        triggerHaptic('selection');
        setEditingItem(null);
        resetForm();
        setShowAddModal(true);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [triggerHaptic]);

  // Plan de départ automatique pour la randonnée sélectionnée
  const departurePlan = useMemo(() => {
    if (!activeHike) return null;
    const customUserKits = selectedKitForDeparture ? [selectedKitForDeparture, ...kits] : kits;
    return resolveDeparturePlan(
      {
        id: activeHike.id,
        name: activeHike.name,
        distanceKm: activeHike.distanceKm,
        elevationGain: activeHike.elevationGain,
        elevationLoss: activeHike.elevationLoss,
        difficulty: activeHike.difficulty,
        season: activeHike.season,
        terrain: activeHike.terrain,
        hasWaterPoints: activeHike.hasWaterPoints,
        waterPointsCount: activeHike.waterPointsCount,
        hasRefuges: activeHike.hasRefuges,
        isOvernight: activeHike.isOvernight,
        nightsCount: activeHike.nightsCount,
        weather: activeHike.weather,
        startDate: activeHike.targetDate,
      },
      customUserKits,
      equipment
    );
  }, [activeHike, selectedKitForDeparture, kits, equipment]);

  const handleSelectHike = (hike: PlannedHike) => {
    triggerHaptic('light');
    setActiveHike(hike);
    setActivePlannedHikeId(hike.id);
    setDepartureCompleted(false);
  };

  const handleToggleDepartureItem = (id: string) => {
    triggerHaptic('light');
    setCheckedDepartureItems((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleValidateDeparture = async () => {
    if (!departurePlan) return;
    triggerHaptic('selection');
    const usedGearIds = departurePlan.checklist.inPackReady
      .map((i) => i.ownedGearId)
      .filter(Boolean) as string[];

    await recordPostHikeGearUsage(usedGearIds);
    setDepartureCompleted(true);
  };

  // Suppression sécurisée avec auto-substitution dans les kits
  const handleDeleteGear = async (id: string) => {
    await removeFromEquipment(id);
    await handleGearDeleted(id);
    setIsDrawerOpen(false);
  };

  // Ajout direct au panier
  const handleAddToCart = (product: any) => {
    triggerHaptic('selection');
    addToCart({
      id: product.id,
      slug: product.slug || product.id,
      name: product.name,
      brand: product.brand || 'LKDV',
      priceEur: product.price_eur || 0,
      weightG: product.weight_g || 0,
      image: product.image || '/assets/images/no_image.png',
      imageAlt: product.name,
      category: product.category || 'Matériel',
    });
    setCartToast(`« ${product.name} » ajouté à votre panier !`);
    setTimeout(() => setCartToast(null), 4000);
  };

  // Ouverture fiche détaillée
  const handleOpenDetail = (item: UserEquipmentItem) => {
    triggerHaptic('selection');
    setSelectedGearItem(item);
    setIsDrawerOpen(true);
  };

  // Ouverture modale d'édition
  const handleOpenEdit = (item: UserEquipmentItem) => {
    triggerHaptic('light');
    setEditingItem(item);
    setFormName(item.name);
    setFormBrand(item.brand || '');
    setFormCategory(item.category || 'Couchage');
    setFormWeight(String(item.weight_g || ''));
    setFormPrice(item.purchase_price != null ? String(item.purchase_price) : '');
    setFormCondition(item.condition || 'excellent');
    setFormNotes(item.notes || '');
    setFormMaintDate(item.next_maintenance_date || '');
    setFormExpDate(item.expiry_date || '');
    setShowAddModal(true);
  };

  // Soumission Ajout / Édition Matériel
  const handleSaveItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) return;
    triggerHaptic('selection');

    if (editingItem) {
      await updateEquipment(editingItem.id, {
        name: formName.trim(),
        brand: formBrand.trim() || null,
        category: formCategory,
        weight_g: Number(formWeight) || 0,
        purchase_price: formPrice ? Number(formPrice) : null,
        condition: formCondition,
        notes: formNotes.trim() || null,
        next_maintenance_date: formMaintDate || null,
        expiry_date: formExpDate || null,
      });
      if (selectedGearItem && selectedGearItem.id === editingItem.id) {
        setSelectedGearItem((prev) =>
          prev
            ? {
                ...prev,
                name: formName.trim(),
                brand: formBrand.trim() || null,
                category: formCategory,
                weight_g: Number(formWeight) || 0,
                purchase_price: formPrice ? Number(formPrice) : null,
                condition: formCondition,
                notes: formNotes.trim() || null,
                next_maintenance_date: formMaintDate || null,
                expiry_date: formExpDate || null,
              }
            : null
        );
      }
      setEditingItem(null);
    } else {
      await addToEquipment(
        {
          name: formName.trim(),
          brand: formBrand.trim() || 'Matériel personnel',
          category: formCategory,
          weight_g: Number(formWeight) || 0,
          price_eur: formPrice ? Number(formPrice) : 0,
        },
        {
          condition: formCondition,
          source: 'manuel',
          notes: formNotes.trim() || null,
          next_maintenance_date: formMaintDate || null,
          expiry_date: formExpDate || null,
        }
      );
    }

    setShowAddModal(false);
    resetForm();
  };

  const resetForm = () => {
    setFormName('');
    setFormBrand('');
    setFormCategory('Couchage');
    setFormWeight('');
    setFormPrice('');
    setFormCondition('excellent');
    setFormNotes('');
    setFormMaintDate('');
    setFormExpDate('');
  };

  // Gestion du prêt
  const handleSaveLoan = async (borrowerName: string, returnDate?: string, notes?: string) => {
    if (!lendingItem) return;
    triggerHaptic('selection');
    const isReturning = lendingItem.loan_status === 'prêté';
    await updateEquipment(lendingItem.id, {
      loan_status: isReturning ? 'disponible' : 'prêté',
      loan_to_name: isReturning ? null : borrowerName,
      notes: notes ? `${lendingItem.notes || ''} [Prêt: ${notes}]`.trim() : lendingItem.notes,
    });
    if (selectedGearItem && selectedGearItem.id === lendingItem.id) {
      setSelectedGearItem((prev) =>
        prev
          ? {
              ...prev,
              loan_status: isReturning ? 'disponible' : 'prêté',
              loan_to_name: isReturning ? null : borrowerName,
            }
          : null
      );
    }
    setLendingItem(null);
  };

  // Répartition du poids
  const weightDistribution = useMemo(() => {
    if (totalPackWeight <= 0) return [];
    const catMap: Record<string, number> = {};
    equipment.forEach((item) => {
      const match = EQUIPMENT_CATEGORIES.find(
        (c) => c.key !== 'all' && item.category && item.category.toLowerCase().includes(c.key.toLowerCase())
      );
      const catKey = match ? match.key : 'Autre';
      catMap[catKey] = (catMap[catKey] || 0) + (item.weight_g || 0) * (item.quantity || 1);
    });

    return Object.entries(catMap)
      .map(([key, weight]) => {
        const cat = EQUIPMENT_CATEGORIES.find((c) => c.key === key);
        const pct = Math.round((weight / totalPackWeight) * 100);
        return {
          key,
          label: cat?.label || key,
          color: cat?.color || '#17402C',
          weight,
          pct,
        };
      })
      .filter((c) => c.weight > 0)
      .sort((a, b) => b.weight - a.weight);
  }, [equipment, totalPackWeight]);

  // ── INVENTAIRE & MATÉRIEL RANGÉ PAR CATÉGORIES AVEC TOGGLE TOUT / POSSÉDÉ ──
  const categoriesWithItems = useMemo(() => {
    const ownedItems = equipment.map((eq) => ({
      key: `owned-${eq.id}`,
      type: 'owned' as const,
      isOwned: true,
      ownedItem: eq,
      adaptedData: adaptUserEquipmentToGearItemData(eq),
      name: eq.name,
      brand: eq.brand || '',
      category: eq.category || 'Autre',
      weight_g: eq.weight_g || 0,
      alerts: evaluateGearAlerts(eq),
    }));

    const missingProducts = products
      .filter((p) => !isOwned(p))
      .map((p) => ({
        key: `shop-${p.id}`,
        type: 'missing' as const,
        isOwned: false,
        product: p,
        name: p.name,
        brand: p.brand || '',
        category: p.category_main || p.category || 'Autre',
        weight_g: p.weight_g || 0,
        alerts: { totalAlertsCount: 0, hasMaintenanceDue: false, isLent: false, isMaintenanceApproaching: false, hasExpired: false, isExpiringSoon: false, needsWearCheck: false },
      }));

    // Filtrage selon le toggle Tout / Possédé
    let baseList = inventoryFilter === 'owned' ? ownedItems : [...ownedItems, ...missingProducts];

    // Filtrage recherche
    if (search.trim()) {
      const q = search.toLowerCase().trim();
      baseList = baseList.filter(
        (item) =>
          item.name.toLowerCase().includes(q) ||
          item.brand.toLowerCase().includes(q) ||
          item.category.toLowerCase().includes(q)
      );
    }

    // Regroupement par catégories définies
    const catDefinitions = EQUIPMENT_CATEGORIES.filter((c) => c.key !== 'all');
    const result: Array<{
      key: string;
      label: string;
      icon: string;
      items: typeof baseList;
      totalWeightG: number;
    }> = [];

    catDefinitions.forEach((catDef) => {
      const matchingItems = baseList.filter((it) =>
        it.category.toLowerCase().includes(catDef.key.toLowerCase()) ||
        catDef.label.toLowerCase().includes(it.category.toLowerCase())
      );
      if (matchingItems.length > 0) {
        const catWeight = matchingItems.reduce(
          (sum, it) => sum + (it.isOwned ? it.weight_g : 0),
          0
        );
        result.push({
          key: catDef.key,
          label: catDef.label,
          icon: catDef.icon,
          items: matchingItems,
          totalWeightG: catWeight,
        });
      }
    });

    // Éléments orphelins / "Autre"
    const assignedKeys = new Set(result.flatMap((r) => r.items.map((i) => i.key)));
    const remainingItems = baseList.filter((it) => !assignedKeys.has(it.key));
    if (remainingItems.length > 0) {
      const remainingWeight = remainingItems.reduce(
        (sum, it) => sum + (it.isOwned ? it.weight_g : 0),
        0
      );
      result.push({
        key: 'Autre',
        label: 'Accessoires & Autres',
        icon: '🔧',
        items: remainingItems,
        totalWeightG: remainingWeight,
      });
    }

    return result;
  }, [equipment, products, isOwned, inventoryFilter, search]);

  const loading = equipmentLoading || kitsLoading;

  return (
    <div className="min-h-screen bg-[#FBFAF6] text-[#0B1F17] font-sans selection:bg-[#17402C]/10 pb-36">
      {/* Header Desktop */}
      <div className="hidden md:block">
        <Header />
      </div>

      <main className="max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8 pt-4 md:pt-24 space-y-8">
        {/* ── 0. OUTIL NUMÉRO 1 : CONFIGURATEUR IA ULTRA-RAPIDE (1 CLIC / ZERO EFFORT) ── */}
        <AIConfiguratorHeroCard
          userEquipment={equipment}
          onKitGenerated={async (kitData) => {
            const created = await createKit(kitData);
            if (created) {
              setSelectedKitForDeparture(created);
            }
          }}
        />

        {/* ── 1. EN-TÊTE ÉPURÉ & POIDS DU SAC ── */}
        <InventaireHeroBanner
          totalItemsCount={equipment.length}
          totalWeightG={totalPackWeight}
          weightDistribution={weightDistribution}
          onFilterCategory={() => {}}
        />

        {/* ── 2. SECTION A : PROCHAINE RANDONNÉE & PRÉPARATION DE DÉPART ── */}
        {activeHike && departurePlan && (
          <section className="bg-white rounded-3xl p-5 sm:p-7 border border-black/[0.06] shadow-2xs space-y-6">
            {/* Header de la Randonnée Sélectionnée */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-black/[0.06]">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[10px] font-mono uppercase tracking-wider text-emerald-800 bg-emerald-50 px-2.5 py-0.5 rounded-full font-bold">
                    ⚡ Prochain départ planifié
                  </span>
                  {activeHike.targetDate && (
                    <span className="text-xs font-medium text-[#6B7A72]">
                      📅 {formatDateFR(activeHike.targetDate)}
                    </span>
                  )}
                </div>
                <h2 className="text-lg sm:text-xl font-bold text-[#0B1F17] tracking-tight">
                  {activeHike.name}
                </h2>
              </div>

              {/* Sélecteur de randonnées enregistrées */}
              {plannedHikes.length > 1 && (
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-xs text-[#6B7A72] font-medium mr-1">Changer :</span>
                  {plannedHikes.map((h) => (
                    <button
                      key={h.id}
                      onClick={() => handleSelectHike(h)}
                      className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-colors ${
                        activeHike.id === h.id
                          ? 'bg-[#17402C] text-white shadow-xs'
                          : 'bg-black/[0.04] text-[#6B7A72] hover:text-[#0B1F17]'
                      }`}
                    >
                      {h.name.split('—')[0].trim()}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Cartes métriques : Score & Kit, Poids Réel, Météo */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
              {/* Score & Kit */}
              <div className="p-4 rounded-2xl bg-[#FBFAF6] border border-black/[0.04] flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] font-mono uppercase tracking-wider text-[#6B7A72]">
                      Kit & Préparation
                    </span>
                    <span className="text-xs font-bold text-[#17402C] font-mono bg-[#E1EBDD] px-2 py-0.5 rounded-md">
                      {departurePlan.suitabilityScore}% prêt
                    </span>
                  </div>
                  <h4 className="text-sm font-bold text-[#0B1F17]">
                    {departurePlan.selectedKit ? departurePlan.selectedKit.name : 'Kit sur-mesure optimisé'}
                  </h4>
                  <p className="text-[11px] text-[#6B7A72] mt-0.5">
                    {departurePlan.isAutoGeneratedKit
                      ? 'Généré automatiquement selon vos équipements disponibles'
                      : 'Sélectionné automatiquement comme le plus adapté'}
                  </p>
                </div>
                <p className="text-[11px] text-[#17402C] font-semibold pt-2">
                  ✓ {departurePlan.checklist.inPackReady.length} articles vérifiés
                </p>
              </div>

              {/* Poids Total Mesuré */}
              <div className="p-4 rounded-2xl bg-[#FBFAF6] border border-black/[0.04] flex flex-col justify-between">
                <div>
                  <span className="text-[10px] font-mono uppercase tracking-wider text-[#6B7A72]">
                    Poids total estimé du sac
                  </span>
                  <div className="text-2xl font-bold text-[#0B1F17] font-mono mt-0.5">
                    {formatWeight(departurePlan.totalPackWeightG)}
                  </div>
                  <p className="text-[11px] text-[#6B7A72] mt-0.5">
                    Matériel net + eau ({departurePlan.consumables.waterLiters}L) & vivres
                  </p>
                </div>
                <span className="text-[10px] font-mono text-[#6B7A72]">
                  {activeHike.distanceKm} km · +{activeHike.elevationGain || 0}m D+
                </span>
              </div>

              {/* Météo en direct */}
              <div className="p-4 rounded-2xl bg-[#FBFAF6] border border-black/[0.04] flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] font-mono uppercase tracking-wider text-[#6B7A72]">
                      Météo du parcours
                    </span>
                    <span className="text-xs font-bold text-[#0B1F17] font-mono">
                      {departurePlan.weatherSummary.tempMinMax}
                    </span>
                  </div>
                  <h4 className="text-sm font-bold text-[#0B1F17]">
                    {departurePlan.weatherSummary.condition}
                  </h4>
                  <p className="text-[11px] text-[#6B7A72] mt-0.5">
                    {departurePlan.weatherSummary.advice}
                  </p>
                </div>
                <div className="text-[10px] font-mono text-[#6B7A72] flex items-center justify-between pt-1">
                  <span>Pluie : {departurePlan.weatherSummary.rainRiskPct}%</span>
                  <span>Vent : {departurePlan.weatherSummary.windKmh} km/h</span>
                </div>
              </div>
            </div>

            {/* Checklist Intelligente du Départ (4 zones) */}
            <div className="space-y-4 pt-2">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-[#0B1F17]">
                  Checklist de départ : « Tout est pensé »
                </h3>
                <span className="text-[11px] font-mono font-semibold text-[#17402C] bg-[#E1EBDD] px-2.5 py-0.5 rounded-full">
                  {checkedDepartureItems.size} / {departurePlan.checklist.inPackReady.length + departurePlan.checklist.consumablesToPack.length} vérifiés
                </span>
              </div>

              {/* Matériel & Consommables */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {departurePlan.checklist.inPackReady.map((item) => {
                  const isChecked = checkedDepartureItems.has(item.id);
                  return (
                    <div
                      key={item.id}
                      onClick={() => handleToggleDepartureItem(item.id)}
                      className={`p-2.5 rounded-xl border text-xs flex items-center justify-between cursor-pointer transition-all ${
                        isChecked
                          ? 'bg-[#E1EBDD]/40 border-[#A9C6B0] text-[#17402C]'
                          : 'bg-[#FBFAF6] border-black/[0.04] text-[#0B1F17] hover:border-black/20'
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="w-3.5 h-3.5 rounded border flex items-center justify-center font-bold text-[9px] shrink-0 border-[#17402C] bg-white text-[#17402C]">
                          {isChecked ? '✓' : ''}
                        </span>
                        <span className={`truncate font-medium ${isChecked ? 'line-through opacity-70' : ''}`}>
                          {item.name}
                        </span>
                      </div>
                      <span className="font-mono text-[10px] text-[#6B7A72] shrink-0 ml-2">
                        {item.weightG} g
                      </span>
                    </div>
                  );
                })}

                {departurePlan.checklist.consumablesToPack.map((item) => {
                  const isChecked = checkedDepartureItems.has(item.id);
                  return (
                    <div
                      key={item.id}
                      onClick={() => handleToggleDepartureItem(item.id)}
                      className={`p-2.5 rounded-xl border text-xs flex items-center justify-between cursor-pointer transition-all ${
                        isChecked
                          ? 'bg-[#E1EBDD]/40 border-[#A9C6B0] text-[#17402C]'
                          : 'bg-emerald-50/50 border-emerald-200/60 text-[#0B1F17]'
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="w-3.5 h-3.5 rounded border flex items-center justify-center font-bold text-[9px] shrink-0 border-[#17402C] bg-white text-[#17402C]">
                          {isChecked ? '✓' : ''}
                        </span>
                        <div className="min-w-0">
                          <span className={`truncate font-semibold ${isChecked ? 'line-through opacity-70' : ''}`}>
                            {item.name}
                          </span>
                        </div>
                      </div>
                      <span className="font-mono text-[10px] text-[#6B7A72] shrink-0 ml-2">
                        {item.weightG} g
                      </span>
                    </div>
                  );
                })}
              </div>

              {/* Alertes de sécurité si existantes */}
              {departurePlan.checklist.securityChecks.length > 0 && (
                <div className="space-y-2 pt-2 border-t border-black/[0.04]">
                  {departurePlan.checklist.securityChecks.map((item) => (
                    <div
                      key={item.id}
                      className="p-2.5 rounded-xl bg-amber-50 border border-amber-200/80 text-xs flex items-center justify-between gap-2"
                    >
                      <span className="text-amber-950 font-medium truncate">
                        ⚠️ {item.name} — {item.warningMessage || item.actionHint}
                      </span>
                      <button
                        onClick={() => setShowAddModal(true)}
                        className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-amber-900 text-white shrink-0"
                      >
                        Vérifier
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Bouton de validation du départ */}
              <div className="pt-3 border-t border-black/[0.04] flex flex-col sm:flex-row items-center justify-between gap-3">
                <p className="text-xs text-[#6B7A72]">
                  {departureCompleted
                    ? '✓ Départ validé ! Le compteur d\'usage de vos équipements a été actualisé.'
                    : 'Validez votre sac avant le départ pour enregistrer l\'historique d\'usage.'}
                </p>
                <button
                  disabled={departureCompleted}
                  onClick={handleValidateDeparture}
                  className={`w-full sm:w-auto px-5 py-2.5 rounded-full text-xs font-bold transition-all shadow-sm ${
                    departureCompleted
                      ? 'bg-emerald-800 text-white cursor-default'
                      : 'bg-[#17402C] text-white hover:bg-[#0B1F17] active:scale-95'
                  }`}
                >
                  {departureCompleted ? '✓ Sortie en cours' : '🚀 Valider mon sac & Partir'}
                </button>
              </div>
            </div>
          </section>
        )}

        {/* ── 3. SECTION B : MES KITS INTELLIGENTS ── */}
        <section className="space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-black/[0.06]">
            <div>
              <h2 className="text-lg font-bold text-[#0B1F17] tracking-tight">
                Mes Kits ({totalKitsCount})
              </h2>
              <p className="text-xs text-[#6B7A72]">
                Kits générés par l'IA ou organisés pour vos expéditions
              </p>
            </div>
          </div>

          <KitsManagerView
            kits={kits}
            trashKits={trashKits}
            userEquipment={equipment}
            onCreateKit={createKit}
            onUpdateKit={updateKit}
            onMoveToTrash={moveToTrash}
            onRestoreFromTrash={restoreFromTrash}
            onPermanentDelete={permanentDelete}
            onSelectKitForDeparture={(kit) => {
              setSelectedKitForDeparture(kit);
              triggerHaptic('selection');
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
          />
        </section>

        {/* ── 4. SECTION C : INVENTAIRE & MATÉRIEL RANGÉ PAR CATÉGORIES (TOGGLE TOUT / POSSÉDÉ) ── */}
        <section className="space-y-6 pt-4 border-t border-black/[0.06]">
          {/* Header & Toggle Tout / Possédé */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-bold text-[#0B1F17] tracking-tight">
                Inventaire & Matériel
              </h2>
              <p className="text-xs text-[#6B7A72]">
                Organisé par catégories · {equipment.length} équipement{equipment.length > 1 ? 's' : ''} possédé{equipment.length > 1 ? 's' : ''}
              </p>
            </div>

            {/* Toggle Tout / Possédé & Barre de recherche */}
            <div className="flex items-center gap-3 flex-wrap">
              <div className="inline-flex p-1 bg-black/[0.04] rounded-full border border-black/[0.06]">
                <button
                  onClick={() => {
                    triggerHaptic('light');
                    setInventoryFilter('all');
                  }}
                  className={`px-3.5 py-1 rounded-full text-xs font-bold transition-all ${
                    inventoryFilter === 'all'
                      ? 'bg-[#17402C] text-white shadow-xs'
                      : 'text-[#6B7A72] hover:text-[#0B1F17]'
                  }`}
                >
                  Tout
                </button>
                <button
                  onClick={() => {
                    triggerHaptic('light');
                    setInventoryFilter('owned');
                  }}
                  className={`px-3.5 py-1 rounded-full text-xs font-bold transition-all ${
                    inventoryFilter === 'owned'
                      ? 'bg-[#17402C] text-white shadow-xs'
                      : 'text-[#6B7A72] hover:text-[#0B1F17]'
                  }`}
                >
                  Possédé ({equipment.length})
                </button>
              </div>

              {/* Recherche rapide */}
              <div className="relative w-48 sm:w-56">
                <input
                  ref={searchInputRef}
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Rechercher un article..."
                  className="w-full bg-white border border-black/[0.06] rounded-xl px-3 py-1.5 text-xs text-[#0B1F17] placeholder:text-[#6B7A72]/60 outline-none focus:border-[#17402C] pl-7 pr-7 transition-colors"
                  style={{ boxShadow: '0 1px 2px rgba(11,31,23,0.04)' }}
                />
                <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-[#6B7A72]/70">
                  🔍
                </span>
                {search && (
                  <button
                    onClick={() => setSearch('')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-[#6B7A72] hover:text-[#0B1F17]"
                  >
                    ✕
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Grille Rangée par Catégories */}
          {loading ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4 pt-1">
              {[...Array(8)].map((_, i) => (
                <div
                  key={i}
                  className="aspect-[3/4] rounded-2xl bg-white animate-pulse p-3 flex flex-col justify-between"
                  style={{ boxShadow: '0 1px 3px rgba(11,31,23,0.04)' }}
                >
                  <div className="w-full aspect-[4/3] bg-[#F3F2ED] rounded-xl" />
                  <div className="space-y-1.5 mt-2">
                    <div className="h-3 bg-[#F3F2ED] rounded w-1/3" />
                    <div className="h-3.5 bg-[#F3F2ED] rounded w-3/4" />
                  </div>
                </div>
              ))}
            </div>
          ) : categoriesWithItems.length === 0 ? (
            <div className="p-12 text-center rounded-2xl bg-white border border-black/[0.04] my-4">
              <p className="text-3xl mb-2">🎒</p>
              <h3 className="text-sm font-semibold text-[#0B1F17]">
                Aucun équipement trouvé
              </h3>
              <p className="text-xs text-[#6B7A72] max-w-xs mx-auto mt-1 mb-4">
                {inventoryFilter === 'owned'
                  ? 'Vous n\'avez aucun équipement enregistré dans cette vue.'
                  : 'Modifiez votre recherche ou ajoutez un nouvel article.'}
              </p>
              <button
                onClick={() => {
                  triggerHaptic('selection');
                  setEditingItem(null);
                  resetForm();
                  setShowAddModal(true);
                }}
                className="px-4 py-2 rounded-full text-xs font-semibold bg-[#17402C] text-white hover:bg-[#0B1F17] transition-colors"
              >
                + Ajouter un article
              </button>
            </div>
          ) : (
            <div className="space-y-8">
              {categoriesWithItems.map((catGroup) => (
                <div key={catGroup.key} className="space-y-3">
                  {/* Titre de la catégorie avec icône et total */}
                  <div className="flex items-center justify-between pb-1.5 border-b border-black/[0.06]">
                    <div className="flex items-center gap-2">
                      <span className="text-base">{catGroup.icon}</span>
                      <h3 className="text-sm font-bold text-[#0B1F17] tracking-tight">
                        {catGroup.label}
                      </h3>
                      <span className="text-[10px] font-mono font-bold text-[#6B7A72] bg-black/[0.04] px-2 py-0.5 rounded-full">
                        {catGroup.items.length}
                      </span>
                    </div>
                    {catGroup.totalWeightG > 0 && (
                      <span className="text-xs font-mono font-bold text-[#17402C]">
                        {formatWeight(catGroup.totalWeightG)}
                      </span>
                    )}
                  </div>

                  {/* Grille d'articles de la catégorie */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
                    {catGroup.items.map((item) => {
                      if (item.type === 'owned') {
                        return (
                          <UnifiedGearCard
                            key={item.key}
                            item={item.adaptedData}
                            isOwned={true}
                            onOpenDetail={() => handleOpenDetail(item.ownedItem)}
                            onEdit={() => handleOpenEdit(item.ownedItem)}
                            onDelete={() => handleDeleteGear(item.ownedItem.id)}
                          />
                        );
                      }
                      return (
                        <UnifiedGearCard
                          key={item.key}
                          product={item.product}
                          isOwned={false}
                          onAddProductToInventory={() => {
                            addToEquipment(item.product, {
                              source: 'catalogue',
                              condition: 'neuf',
                            });
                          }}
                          onAddToCart={() => handleAddToCart(item.product)}
                        />
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>

      {/* ── 5. TOAST AJOUT PANIER ── */}
      <AnimatePresence>
        {cartToast && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="fixed bottom-20 left-1/2 -translate-x-1/2 z-50 bg-[#17402C] text-white px-4 py-2.5 rounded-full text-xs font-bold shadow-2xl flex items-center gap-2 border border-white/20"
          >
            <span>🛒</span>
            <span>{cartToast}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── 6. BOUTON D'ACTION FLOTTANT (FAB UNIQUE) ── */}
      <div className="fixed right-5 bottom-20 sm:bottom-8 z-40">
        <button
          onClick={() => {
            triggerHaptic('selection');
            setEditingItem(null);
            resetForm();
            setShowAddModal(true);
          }}
          className="w-12 h-12 rounded-full bg-[#17402C] text-white hover:bg-[#0B1F17] transition-all flex items-center justify-center text-xl font-medium focus:outline-none shadow-lg"
          aria-label="Ajouter un équipement"
          title="Ajouter un équipement (Raccourci: +)"
        >
          +
        </button>
      </div>

      {/* ── 7. DRAWER PLEIN ÉCRAN FICHE ARTICLE ── */}
      <GearDetailDrawer
        isOpen={isDrawerOpen}
        item={selectedGearItem}
        onClose={() => setIsDrawerOpen(false)}
        onEdit={(item) => handleOpenEdit(item)}
        onDelete={(id) => handleDeleteGear(id)}
        onUpdateNotes={async (gearId, notes) => {
          await updateEquipment(gearId, { notes });
        }}
        onLend={(item) => setLendingItem(item)}
        onToggleFavorite={async (id) => {
          if (!selectedGearItem) return;
          const nextFav = !selectedGearItem.is_favorite;
          await updateEquipment(id, { is_favorite: nextFav });
          setSelectedGearItem((prev) => (prev ? { ...prev, is_favorite: nextFav } : null));
        }}
      />

      {/* ── 8. MODALE AJOUT / ÉDITION MANUELLE ── */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs font-sans">
          <div
            className="bg-white rounded-2xl p-6 max-w-sm w-full border border-black/[0.06] space-y-4 max-h-[90vh] overflow-y-auto"
            style={{ boxShadow: '0 12px 36px rgba(11,31,23,0.12)' }}
          >
            <div className="flex items-center justify-between pb-2 border-b border-black/[0.04]">
              <div>
                <h3 className="text-sm font-bold text-[#0B1F17]">
                  {editingItem ? 'Modifier l\'équipement' : 'Nouvel équipement'}
                </h3>
                <p className="text-[11px] text-[#6B7A72]">
                  {editingItem ? 'Mettez à jour les informations' : 'Ajoutez un article à votre inventaire'}
                </p>
              </div>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-[#6B7A72] hover:text-[#0B1F17] p-1 text-sm"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveItem} className="space-y-3">
              <div>
                <label className="block text-[11px] font-medium text-[#6B7A72] mb-1">
                  Nom *
                </label>
                <input
                  type="text"
                  required
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="Ex : Sac Osprey Atmos 65"
                  className="w-full bg-[#FBFAF6] border border-black/[0.06] rounded-xl px-3 py-2 text-xs text-[#0B1F17] outline-none focus:border-[#17402C]"
                />
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-[11px] font-medium text-[#6B7A72] mb-1">
                    Marque
                  </label>
                  <input
                    type="text"
                    value={formBrand}
                    onChange={(e) => setFormBrand(e.target.value)}
                    placeholder="Ex : Osprey"
                    className="w-full bg-[#FBFAF6] border border-black/[0.06] rounded-xl px-3 py-2 text-xs text-[#0B1F17] outline-none focus:border-[#17402C]"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-[#6B7A72] mb-1">
                    Poids (g)
                  </label>
                  <input
                    type="number"
                    value={formWeight}
                    onChange={(e) => setFormWeight(e.target.value)}
                    placeholder="Ex : 2100"
                    className="w-full bg-[#FBFAF6] border border-black/[0.06] rounded-xl px-3 py-2 text-xs text-[#0B1F17] outline-none focus:border-[#17402C]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-[11px] font-medium text-[#6B7A72] mb-1">
                    Catégorie
                  </label>
                  <select
                    value={formCategory}
                    onChange={(e) => setFormCategory(e.target.value)}
                    className="w-full bg-[#FBFAF6] border border-black/[0.06] rounded-xl px-3 py-2 text-xs text-[#0B1F17] outline-none focus:border-[#17402C]"
                  >
                    {EQUIPMENT_CATEGORIES.filter((c) => c.key !== 'all').map((c) => (
                      <option key={c.key} value={c.key}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-[#6B7A72] mb-1">
                    État
                  </label>
                  <select
                    value={formCondition}
                    onChange={(e) => setFormCondition(e.target.value as any)}
                    className="w-full bg-[#FBFAF6] border border-black/[0.06] rounded-xl px-3 py-2 text-xs text-[#0B1F17] outline-none focus:border-[#17402C]"
                  >
                    <option value="neuf">Neuf</option>
                    <option value="excellent">Excellent</option>
                    <option value="bon">Bon état</option>
                    <option value="moyen">Moyen</option>
                    <option value="usé">Usé</option>
                    <option value="à_réparer">À réparer</option>
                    <option value="à_remplacer">À remplacer</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-medium text-[#6B7A72] mb-1">
                  Notes
                </label>
                <textarea
                  rows={2}
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  placeholder="Remarques, réglages..."
                  className="w-full bg-[#FBFAF6] border border-black/[0.06] rounded-xl px-3 py-2 text-xs text-[#0B1F17] outline-none focus:border-[#17402C] resize-none"
                />
              </div>

              <div className="pt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="flex-1 py-2 rounded-xl text-xs font-medium text-[#6B7A72] hover:bg-black/[0.04]"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2 rounded-xl text-xs font-semibold bg-[#17402C] text-white hover:bg-[#0B1F17]"
                >
                  {editingItem ? 'Enregistrer' : 'Ajouter'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── 9. MODALE DE GESTION DU PRÊT ── */}
      {lendingItem && (
        <LendItemModal
          isOpen={Boolean(lendingItem)}
          onClose={() => setLendingItem(null)}
          item={adaptUserEquipmentToGearItemData(lendingItem)}
          onSaveLoan={handleSaveLoan}
        />
      )}
    </div>
  );
}
