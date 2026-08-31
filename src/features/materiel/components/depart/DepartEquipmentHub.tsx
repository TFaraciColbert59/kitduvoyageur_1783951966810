'use client';
import React, { useState, useMemo } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import {
  Boxes,
  Handshake,
  ShoppingBag,
  Search,
  Plus,
  Trash2,
  Check,
  RotateCcw,
  Scale,
  X,
  ExternalLink,
  CheckSquare,
  Layers,
  ArrowRight,
  ArrowUpRight,
  LayoutGrid,
  List,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { formatWeight } from '@/features/materiel/domain/departCalculations';
import { addInventoryItem } from '@/features/materiel/actions/addInventoryItem';
import { deleteInventoryItem } from '@/features/materiel/actions/deleteInventoryItem';
import { updateLoanStatus } from '@/features/materiel/actions/updateLoanStatus';
import { createLoan } from '@/features/materiel/actions/createLoan';
import { addDepartItem } from '@/features/materiel/actions/addDepartItem';
import { resolveGearImage } from '@/features/materiel/services/gearImageResolver';
import { DepartChecklist } from './DepartChecklist';
import { DepartWeightBreakdown } from './DepartWeightBreakdown';
import { cn } from '@/lib/utils';
import type { InventoryItem } from '@/features/materiel/services/getInventory';
import type { LoanItem } from '@/features/materiel/services/getLoans';
import type { ProductSuggestion } from '@/features/materiel/services/getProductSuggestions';
import type { ChecklistItem, Participant } from '@/features/materiel/types/trekHub';
import type { MapTrail } from '@/components/explorer/types';
import type { WeatherForecast } from '@/features/materiel/services/getWeather';

export interface UnifiedEquipmentItem {
  id: string;
  name: string;
  brand: string | null;
  category: string;
  weightG: number;
  priceEur: number | null;
  image: string;
  slug: string | null;
  inInventory: boolean;
  inBag: boolean;
  isLent: boolean;
  lentDetails: { borrower: string; dueDate?: string | null; isOverdue: boolean } | null;
  inDelivery: boolean;
  toAcquire: boolean;
  condition: string | null;
  inventoryId: string | null;
  loanId: string | null;
  kitItemId: string | null;
}

interface DepartEquipmentHubProps {
  inventory: InventoryItem[];
  loans: LoanItem[];
  products: ProductSuggestion[];
  kitItems: ChecklistItem[];
  consumables?: Record<string, number>;
  participants?: Participant[];
  emergencyContact?: string | null;
  trail?: MapTrail | null;
  weather?: WeatherForecast | null;
  weightBreakdown?: { category: string; value: number }[];
  baseWeightG?: number;
  wornWeightG?: number;
  consumablesWeightG?: number;
  comparableTripName?: string;
  kitId: string;
  isRealKit?: boolean;
}

const CATEGORIES = [
  'Toutes',
  'Bivouac',
  'Couchage',
  'Vivres & Eau',
  'Vêtements',
  'Cuisine',
  'Hydratation',
  'Sécurité',
  'Électronique',
  'Autre',
];

const CONDITION_LABELS: Record<string, { label: string; tone: string }> = {
  neuf: { label: 'Neuf', tone: 'bg-emerald-500/10 text-emerald-800 border border-emerald-500/20' },
  tres_bon: { label: 'Très bon', tone: 'bg-emerald-500/10 text-emerald-800 border border-emerald-500/20' },
  bon: { label: 'Bon', tone: 'bg-blue-500/10 text-blue-800 border border-blue-500/20' },
  moyen: { label: 'Usé', tone: 'bg-amber-500/10 text-amber-800 border border-amber-500/20' },
  a_remplacer: { label: 'À remplacer', tone: 'bg-red-500/15 text-red-800 border border-red-500/30' },
};

export function DepartEquipmentHub({
  inventory: initialInventory,
  loans: initialLoans,
  products,
  kitItems,
  consumables = {},
  participants = [],
  emergencyContact = null,
  trail = null,
  weather = null,
  weightBreakdown = [],
  baseWeightG = 0,
  wornWeightG = 0,
  consumablesWeightG = 0,
  comparableTripName,
  kitId,
  isRealKit = false,
}: DepartEquipmentHubProps) {
  const [statusFilter, setStatusFilter] = useState<'all' | 'in_bag' | 'in_inventory' | 'lent' | 'to_acquire'>('all');
  const [selectedCat, setSelectedCat] = useState('Toutes');
  const [searchQuery, setSearchQuery] = useState('');
  const [mobileTab, setMobileTab] = useState<'catalog' | 'bag'>('catalog');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  const [inventoryList, setInventoryList] = useState<InventoryItem[]>(initialInventory);
  const [loanList, setLoanList] = useState<LoanItem[]>(initialLoans);

  // Modales
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isLoanModalOpen, setIsLoanModalOpen] = useState(false);
  const [selectedItemForLoan, setSelectedItemForLoan] = useState<UnifiedEquipmentItem | null>(null);

  // Formulaire d'ajout
  const [newName, setNewName] = useState('');
  const [newBrand, setNewBrand] = useState('');
  const [newCategory, setNewCategory] = useState('Bivouac');
  const [newWeight, setNewWeight] = useState(250);
  const [newCondition, setNewCondition] = useState('tres_bon');
  const [newPriceEur, setNewPriceEur] = useState<number | ''>('');

  const [borrowerContact, setBorrowerContact] = useState('');
  const [dueDate, setDueDate] = useState('');

  // ════ CONSOLIDATION UNIFIÉE DES ÉQUIPEMENTS SANS DOUBLON ════
  const unifiedItems: UnifiedEquipmentItem[] = useMemo(() => {
    const map = new Map<string, UnifiedEquipmentItem>();
    const normalize = (s: string) => s.toLowerCase().trim().replace(/[^a-z0-9]/g, '');

    // 1. Inventaire utilisateur
    for (const inv of inventoryList) {
      const normName = normalize(inv.name);
      const activeLoan = loanList.find(
        (l) => l.product_ownership_id === inv.id && (l.status === 'en_cours' || l.status === 'en_retard')
      );
      const isOverdue = !!(activeLoan?.due_date && new Date(activeLoan.due_date) < new Date());
      const inBagItem = kitItems.find(
        (ki) => normalize(ki.name) === normName || (ki.id && ki.id === inv.id)
      );

      const category = inv.category || 'Autre';
      const image = resolveGearImage(inv.name, category, inv.photo_url);

      const item: UnifiedEquipmentItem = {
        id: `inv-${inv.id}`,
        name: inv.name,
        brand: inv.brand,
        category,
        weightG: inv.weight_g || 0,
        priceEur: inv.price_cents ? inv.price_cents / 100 : null,
        image,
        slug: null,
        inInventory: true,
        inBag: !!inBagItem,
        isLent: !!activeLoan,
        lentDetails: activeLoan
          ? {
              borrower: activeLoan.borrower_contact || 'Contact',
              dueDate: activeLoan.due_date,
              isOverdue,
            }
          : null,
        inDelivery: false,
        toAcquire: false,
        condition: inv.condition || 'tres_bon',
        inventoryId: inv.id,
        loanId: activeLoan?.id || null,
        kitItemId: inBagItem?.id || null,
      };

      map.set(normName, item);
    }

    // 2. Équipements prescrits dans le kit
    for (const ki of kitItems) {
      const normName = normalize(ki.name);
      const category = ki.category || 'Autre';
      const image = resolveGearImage(ki.name, category, ki.photoUrl);

      if (!map.has(normName)) {
        map.set(normName, {
          id: `kit-${ki.id || normName}`,
          name: ki.name,
          brand: null,
          category,
          weightG: ki.weight_g || 0,
          priceEur: null,
          image,
          slug: null,
          inInventory: false,
          inBag: true,
          isLent: false,
          lentDetails: null,
          inDelivery: false,
          toAcquire: false,
          condition: null,
          inventoryId: null,
          loanId: null,
          kitItemId: ki.id || null,
        });
      } else {
        const existing = map.get(normName)!;
        existing.inBag = true;
        existing.kitItemId = ki.id || existing.kitItemId;
      }
    }

    // 3. Suggestions Boutique LKDV
    for (const p of products) {
      const normName = normalize(p.name);
      const category = p.category || 'Autre';
      const image = resolveGearImage(p.name, category, p.image);

      if (!map.has(normName)) {
        map.set(normName, {
          id: `shop-${p.id}`,
          name: p.name,
          brand: null,
          category,
          weightG: p.weightG || 0,
          priceEur: p.priceEur || null,
          image,
          slug: p.slug,
          inInventory: false,
          inBag: false,
          isLent: false,
          lentDetails: null,
          inDelivery: false,
          toAcquire: true,
          condition: 'neuf',
          inventoryId: null,
          loanId: null,
          kitItemId: null,
        });
      }
    }

    return Array.from(map.values());
  }, [inventoryList, loanList, products, kitItems]);

  const stats = useMemo(() => {
    const totalCount = unifiedItems.length;
    const inBagCount = unifiedItems.filter((i) => i.inBag).length;
    const inInventoryCount = unifiedItems.filter((i) => i.inInventory).length;
    const lentCount = unifiedItems.filter((i) => i.isLent).length;
    const toAcquireCount = unifiedItems.filter((i) => i.toAcquire).length;

    return { totalCount, inBagCount, inInventoryCount, lentCount, toAcquireCount };
  }, [unifiedItems]);

  const filteredItems = useMemo(() => {
    return unifiedItems.filter((item) => {
      if (statusFilter === 'in_bag' && !item.inBag) return false;
      if (statusFilter === 'in_inventory' && !item.inInventory) return false;
      if (statusFilter === 'lent' && !item.isLent) return false;
      if (statusFilter === 'to_acquire' && !item.toAcquire) return false;

      if (selectedCat !== 'Toutes' && item.category !== selectedCat) return false;

      if (searchQuery.trim() === '') return true;
      const q = searchQuery.toLowerCase();
      return (
        item.name.toLowerCase().includes(q) ||
        (item.brand && item.brand.toLowerCase().includes(q)) ||
        item.category.toLowerCase().includes(q)
      );
    });
  }, [unifiedItems, statusFilter, selectedCat, searchQuery]);

  const handleAddItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;

    const img = resolveGearImage(newName.trim(), newCategory, null);

    const optimisticItem: InventoryItem = {
      id: `temp-${Date.now()}`,
      name: newName.trim(),
      brand: newBrand.trim() || null,
      category: newCategory,
      weight_g: Number(newWeight) || 0,
      price_cents: newPriceEur ? Number(newPriceEur) * 100 : null,
      condition: newCondition,
      photo_url: img,
      is_lent: false,
      purchase_date: new Date().toISOString().slice(0, 10),
      maintenance_due_at: null,
      expiry_date: null,
      tags: [],
    };

    setInventoryList((prev) => [optimisticItem, ...prev]);
    setIsAddModalOpen(false);
    setNewName('');
    setNewBrand('');
    setNewPriceEur('');

    const res = await addInventoryItem({
      name: optimisticItem.name,
      brand: optimisticItem.brand || undefined,
      category: optimisticItem.category || 'Autre',
      weightG: optimisticItem.weight_g || 0,
      condition: optimisticItem.condition || 'tres_bon',
      priceCents: optimisticItem.price_cents || undefined,
    });

    if (res.success && res.itemId) {
      setInventoryList((prev) =>
        prev.map((i) => (i.id === optimisticItem.id ? { ...i, id: res.itemId! } : i))
      );
    }
  };

  const handleDeleteItem = async (inventoryId: string) => {
    setInventoryList((prev) => prev.filter((i) => i.id !== inventoryId));
    await deleteInventoryItem(inventoryId);
  };

  const handleReturnLoan = async (loanId: string, inventoryId?: string | null) => {
    setLoanList((prev) =>
      prev.map((l) => (l.id === loanId ? { ...l, status: 'rendu', returned_at: new Date().toISOString() } : l))
    );
    if (inventoryId) {
      setInventoryList((prev) =>
        prev.map((i) => (i.id === inventoryId ? { ...i, is_lent: false } : i))
      );
    }
    await updateLoanStatus(loanId, 'rendu');
  };

  const handleCreateLoan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedItemForLoan || !borrowerContact.trim() || !selectedItemForLoan.inventoryId) return;

    const optimisticLoan: LoanItem = {
      id: `loan-${Date.now()}`,
      product_ownership_id: selectedItemForLoan.inventoryId,
      lender_id: 'me',
      borrower_id: null,
      borrower_contact: borrowerContact.trim(),
      status: 'en_cours',
      loaned_at: new Date().toISOString(),
      due_date: dueDate || null,
      returned_at: null,
    };

    setLoanList((prev) => [optimisticLoan, ...prev]);
    setInventoryList((prev) =>
      prev.map((i) => (i.id === selectedItemForLoan.inventoryId ? { ...i, is_lent: true } : i))
    );
    setIsLoanModalOpen(false);
    setBorrowerContact('');
    setDueDate('');

    const res = await createLoan({
      productOwnershipId: selectedItemForLoan.inventoryId,
      borrowerContact: optimisticLoan.borrower_contact!,
      dueDate: optimisticLoan.due_date,
    });

    if (res.success && res.loanId) {
      setLoanList((prev) =>
        prev.map((l) => (l.id === optimisticLoan.id ? { ...l, id: res.loanId! } : l))
      );
    }
  };

  const [localBagItems, setLocalBagItems] = useState<Set<string>>(new Set());

  const handleQuickAddToBag = async (item: UnifiedEquipmentItem) => {
    setLocalBagItems((prev) => new Set([...prev, item.id]));

    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('bag-item-added', {
          detail: { name: item.name, category: item.category, weightG: item.weightG },
        })
      );
    }

    await addDepartItem({
      kitId,
      name: item.name,
      category: item.category,
      weightG: item.weightG,
      isVital: false,
      addToInventory: !item.inInventory,
    });
  };

  const handleReplenishConsumable = async (item: UnifiedEquipmentItem) => {
    setLocalBagItems((prev) => new Set([...prev, item.id]));

    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('replenish-consumable', {
          detail: { name: item.name },
        })
      );
    }

    await addDepartItem({
      kitId,
      name: item.name,
      category: item.category,
      weightG: item.weightG,
      isVital: false,
      addToInventory: !item.inInventory,
    });
  };

  const handleMarkAsOwned = async (item: UnifiedEquipmentItem) => {
    const res = await addInventoryItem({
      name: item.name,
      brand: item.brand || undefined,
      category: item.category,
      weightG: item.weightG,
      condition: 'tres_bon',
      priceCents: item.priceEur ? item.priceEur * 100 : undefined,
    });
    if (res.success && res.itemId) {
      setInventoryList((prev) => [
        {
          id: res.itemId!,
          name: item.name,
          brand: item.brand,
          category: item.category,
          weight_g: item.weightG,
          price_cents: item.priceEur ? item.priceEur * 100 : null,
          condition: 'tres_bon',
          photo_url: item.image,
          is_lent: false,
          purchase_date: new Date().toISOString().slice(0, 10),
          maintenance_due_at: null,
          expiry_date: null,
          tags: [],
        },
        ...prev,
      ]);
    }
  };

  return (
    <div className="w-full space-y-4 font-sans">
      {/* ════ BASCULE MOBILE (Segmented Control iOS) ════ */}
      <div className="flex md:hidden items-center p-1 bg-black/5 dark:bg-white/10 rounded-2xl gap-1">
        <button
          type="button"
          onClick={() => setMobileTab('catalog')}
          className={cn(
            'flex-1 py-2 rounded-xl text-xs font-semibold transition-all text-center flex items-center justify-center gap-1.5 cursor-pointer',
            mobileTab === 'catalog'
              ? 'bg-[#17402C] text-white shadow-xs'
              : 'text-[#5A7064] hover:text-[#17402C]'
          )}
        >
          <Boxes size={14} />
          <span>Parc Matériel ({filteredItems.length})</span>
        </button>
        <button
          type="button"
          onClick={() => setMobileTab('bag')}
          className={cn(
            'flex-1 py-2 rounded-xl text-xs font-semibold transition-all text-center flex items-center justify-center gap-1.5 cursor-pointer',
            mobileTab === 'bag'
              ? 'bg-[#17402C] text-white shadow-xs'
              : 'text-[#5A7064] hover:text-[#17402C]'
          )}
        >
          <CheckSquare size={14} />
          <span>Sac Actif ({kitItems.filter((i) => i.is_checked).length}/{kitItems.length})</span>
        </button>
      </div>

      {/* ════ CONTENU DU PARC MATÉRIEL (Plein format sur Desktop, avec bascule sur Mobile) ════ */}
      <div className="w-full space-y-4">
        {/* Vue Mobile "Sac Actif" */}
        <div className={cn('w-full min-h-[480px]', mobileTab === 'bag' ? 'block md:hidden' : 'hidden')}>
          <DepartChecklist
            items={kitItems}
            consumables={consumables}
            participants={participants}
            kitId={kitId}
            isRealKit={isRealKit}
          />
        </div>

        {/* Vue Catalogue & Poids (Plein format Desktop, masqué sur mobile quand l'onglet sac est actif) */}
        <div className={cn('space-y-4 min-w-0 w-full', mobileTab === 'bag' ? 'hidden md:block' : 'block')}>
          {/* ════ ANALYSE DU POIDS (Plein format) ════ */}
          {weightBreakdown && weightBreakdown.length > 0 && (
            <div className="w-full">
              <DepartWeightBreakdown
                breakdown={weightBreakdown}
                totalWeightG={baseWeightG}
                baseWeightG={baseWeightG}
                wornWeightG={wornWeightG}
                consumablesWeightG={consumablesWeightG}
                items={kitItems}
                participants={participants}
                comparableTripName={comparableTripName}
              />
            </div>
          )}

          <div className="glass rounded-[28px] p-5 sm:p-6 space-y-4 border border-white/80 dark:border-white/10 shadow-sm backdrop-blur-md">
            {/* Top Header Apple */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-black/5 dark:border-white/10 pb-3.5">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-2xl bg-[#2D6B4A]/10 border border-[#2D6B4A]/20 flex items-center justify-center text-[#2D6B4A] shadow-2xs">
                  <Boxes size={18} aria-hidden="true" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-[#17402C] tracking-tight">
                    Mon Parc Matériel & Équipements
                  </h2>
                  <p className="text-[11.5px] text-[#5A7064]">
                    Gestion centralisée de vos équipements et de votre sac actif.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsAddModalOpen(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-[#17402C] text-white hover:bg-[#17402C]/90 shadow-2xs cursor-pointer transition-all active:scale-95 self-end sm:self-auto"
              >
                <Plus size={13} />
                <span>Ajouter</span>
              </button>
            </div>

            {/* Filtres de statuts (Apple Pills) */}
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-0.5">
              <button
                type="button"
                onClick={() => setStatusFilter('all')}
                className={cn(
                  'px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer flex items-center gap-1.5',
                  statusFilter === 'all'
                    ? 'bg-[#17402C] text-white shadow-xs'
                    : 'bg-black/5 dark:bg-white/10 text-[#5A7064] hover:text-[#17402C]'
                )}
              >
                <Layers size={13} />
                <span>Tous ({stats.totalCount})</span>
              </button>

              <button
                type="button"
                onClick={() => setStatusFilter('in_bag')}
                className={cn(
                  'px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer flex items-center gap-1.5',
                  statusFilter === 'in_bag'
                    ? 'bg-[#17402C] text-white shadow-xs'
                    : 'bg-black/5 dark:bg-white/10 text-[#5A7064] hover:text-[#17402C]'
                )}
              >
                <CheckSquare size={13} />
                <span>Au sac ({stats.inBagCount})</span>
              </button>

              <button
                type="button"
                onClick={() => setStatusFilter('in_inventory')}
                className={cn(
                  'px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer flex items-center gap-1.5',
                  statusFilter === 'in_inventory'
                    ? 'bg-[#17402C] text-white shadow-xs'
                    : stats.inInventoryCount === 0
                    ? 'bg-black/3 text-[#5A7064]/60'
                    : 'bg-black/5 text-[#5A7064] hover:text-[#17402C]'
                )}
              >
                <Boxes size={13} />
                <span>Inventaire ({stats.inInventoryCount})</span>
              </button>

              <button
                type="button"
                onClick={() => setStatusFilter('lent')}
                className={cn(
                  'px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer flex items-center gap-1.5',
                  statusFilter === 'lent'
                    ? 'bg-[#17402C] text-white shadow-xs'
                    : stats.lentCount === 0
                    ? 'bg-black/3 text-[#5A7064]/60'
                    : 'bg-black/5 text-[#5A7064] hover:text-[#17402C]'
                )}
              >
                <Handshake size={13} />
                <span>En prêt ({stats.lentCount})</span>
              </button>

              <button
                type="button"
                onClick={() => setStatusFilter('to_acquire')}
                className={cn(
                  'px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer flex items-center gap-1.5',
                  statusFilter === 'to_acquire'
                    ? 'bg-[#17402C] text-white shadow-xs'
                    : 'bg-black/5 dark:bg-white/10 text-[#5A7064] hover:text-[#17402C]'
                )}
              >
                <ShoppingBag size={13} />
                <span>Boutique ({stats.toAcquireCount})</span>
              </button>
            </div>

            {/* Barre de recherche large, Catégories fluides & Bascule Grille / Liste */}
            <div className="flex flex-col gap-2.5">
              <div className="flex items-center gap-2">
                <div className="relative flex-1 min-w-0">
                  <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#5A7064]" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Rechercher un équipement, une marque..."
                    className="w-full pl-9 pr-8 py-2 rounded-xl text-xs bg-white/70 dark:bg-white/10 border border-white/90 focus:outline-none focus:ring-2 focus:ring-[#17402C]/25 text-[#17402C] placeholder-[#5A7064]"
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => setSearchQuery('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#5A7064] hover:text-[#17402C] p-0.5 cursor-pointer"
                    >
                      <X size={13} />
                    </button>
                  )}
                </div>

                {/* Bascule Grille 2 colonnes / Liste */}
                <div className="flex items-center p-1 bg-black/5 dark:bg-white/10 rounded-xl gap-0.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => setViewMode('grid')}
                    className={cn(
                      'p-1.5 rounded-lg transition-colors cursor-pointer',
                      viewMode === 'grid'
                        ? 'bg-[#17402C] text-white shadow-2xs'
                        : 'text-[#5A7064] hover:text-[#17402C]'
                    )}
                    title="Vue Grille 2 colonnes"
                    aria-label="Vue Grille"
                  >
                    <LayoutGrid size={14} />
                  </button>
                  <button
                    type="button"
                    onClick={() => setViewMode('list')}
                    className={cn(
                      'p-1.5 rounded-lg transition-colors cursor-pointer',
                      viewMode === 'list'
                        ? 'bg-[#17402C] text-white shadow-2xs'
                        : 'text-[#5A7064] hover:text-[#17402C]'
                    )}
                    title="Vue Liste compacte"
                    aria-label="Vue Liste"
                  >
                    <List size={14} />
                  </button>
                </div>
              </div>

              <div className="flex gap-1.5 overflow-x-auto no-scrollbar max-w-full pb-0.5 shrink-0">
                {CATEGORIES.map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setSelectedCat(cat)}
                    className={cn(
                      'px-2.5 py-1 rounded-xl text-[11px] font-semibold whitespace-nowrap transition-all cursor-pointer',
                      selectedCat === cat
                        ? 'bg-[#17402C] text-white shadow-2xs'
                        : 'bg-white/50 text-[#5A7064] hover:text-[#17402C] hover:bg-white/80'
                    )}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>

            {/* ════ CATALOGUE : VUE GRILLE OU LISTE ════ */}
            {filteredItems.length === 0 ? (
              <div className="col-span-full py-12 px-4 text-center bg-white/40 rounded-3xl border border-dashed border-black/10 text-xs text-[#5A7064] space-y-2">
                <Boxes size={24} className="mx-auto text-[#5A7064]/60" />
                <p className="font-semibold text-[#17402C]">Aucun équipement ne correspond à vos filtres.</p>
              </div>
            ) : viewMode === 'grid' ? (
              /* ════ VUE GRILLE 2 COLONNES (Apple Store / Photos Style) ════ */
              <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-2 2xl:grid-cols-3 gap-2.5 sm:gap-4 pr-0.5">
                {filteredItems.map((item) => {
                  const cond = item.condition ? CONDITION_LABELS[item.condition] : null;
                  const isItemInBag = item.inBag || localBagItems.has(item.id);
                  const isConsumable =
                    item.category === 'Vivres & Eau' ||
                    item.category === 'Nutrition' ||
                    item.category === 'Hydratation' ||
                    item.name.toLowerCase().includes('eau') ||
                    item.name.toLowerCase().includes('gaz') ||
                    item.name.toLowerCase().includes('ration') ||
                    item.name.toLowerCase().includes('en-cas') ||
                    item.name.toLowerCase().includes('nourriture');

                  const targetUrl = item.slug
                    ? `/produit/${item.slug}`
                    : item.inInventory
                    ? `/materiel/inventaire?q=${encodeURIComponent(item.name)}`
                    : `/materiel/boutique?q=${encodeURIComponent(item.name)}`;

                  return (
                    <div
                      key={item.id}
                      className={cn(
                        'group rounded-2xl overflow-hidden border transition-all duration-200 flex flex-col justify-between shadow-2xs hover:shadow-md backdrop-blur-md',
                        item.isLent
                          ? 'bg-amber-50/70 border-amber-200/90 text-amber-950'
                          : isItemInBag
                          ? 'bg-emerald-50/50 border-emerald-200/80 text-[#17402C]'
                          : 'bg-white/85 dark:bg-white/10 border-white/80 text-[#17402C]'
                      )}
                    >
                      {/* Image Cliquable 4:3 */}
                      <Link
                        href={targetUrl}
                        className="relative w-full aspect-[4/3] overflow-hidden bg-black/5 rounded-t-2xl block cursor-pointer group/img"
                        title={`Voir la fiche détaillée de ${item.name}`}
                      >
                        <img
                          src={item.image}
                          alt={item.name}
                          className="w-full h-full object-cover object-center group-hover/img:scale-105 transition-transform duration-500"
                          loading="lazy"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-black/20 pointer-events-none" />

                        {/* Badge Catégorie */}
                        <span className="absolute top-1.5 left-1.5 text-[8px] sm:text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-md bg-black/60 text-white backdrop-blur-md shadow-xs">
                          {item.category}
                        </span>
                      </Link>

                      {/* Contenu de la Carte */}
                      <div className="p-2 sm:p-2.5 space-y-1.5 flex-1 flex flex-col justify-between">
                        <div className="space-y-0.5">
                          <Link
                            href={targetUrl}
                            className="text-[11.5px] sm:text-xs font-bold text-[#17402C] hover:text-[#2D6B4A] transition-colors leading-snug line-clamp-1 block cursor-pointer"
                            title={item.name}
                          >
                            {item.name}
                          </Link>
                          <div className="flex items-center justify-between text-[10px] font-mono text-[#5A7064]">
                            <span>{formatWeight(item.weightG)}</span>
                            {item.brand && <span className="truncate max-w-[70px]">{item.brand}</span>}
                          </div>
                        </div>

                        {/* Bouton d'Action 1-tap Compact */}
                        <div className="pt-1 border-t border-black/5">
                          {item.isLent && item.loanId ? (
                            <button
                              type="button"
                              onClick={() => handleReturnLoan(item.loanId!, item.inventoryId)}
                              className="w-full py-1 rounded-xl text-[10.5px] font-bold bg-[#17402C] text-white hover:bg-[#17402C]/90 shadow-2xs flex items-center justify-center gap-1 cursor-pointer transition-all active:scale-98"
                            >
                              <Check size={11} />
                              <span>Rendu</span>
                            </button>
                          ) : isConsumable ? (
                            <button
                              type="button"
                              onClick={() => handleReplenishConsumable(item)}
                              className="w-full py-1 rounded-xl text-[10.5px] font-bold bg-[#17402C] text-white hover:bg-[#17402C]/90 shadow-2xs flex items-center justify-center gap-1 cursor-pointer transition-all active:scale-98"
                            >
                              <RotateCcw size={11} />
                              <span>Recharger</span>
                            </button>
                          ) : isItemInBag ? (
                            <div className="w-full py-1 rounded-xl text-[10.5px] font-bold bg-emerald-100 text-emerald-900 border border-emerald-200 flex items-center justify-center gap-1">
                              <Check size={11} />
                              <span>Dans le sac</span>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleQuickAddToBag(item)}
                              className="w-full py-1 rounded-xl text-[10.5px] font-bold bg-[#17402C] text-white hover:bg-[#17402C]/90 shadow-2xs flex items-center justify-center gap-1 cursor-pointer transition-all active:scale-98"
                            >
                              <Plus size={11} />
                              <span>+ Au sac</span>
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              /* ════ VUE LISTE COMPACTE (Apple Files Style) ════ */
              <div className="flex flex-col gap-2 pr-0.5">
                {filteredItems.map((item) => {
                  const isItemInBag = item.inBag || localBagItems.has(item.id);
                  const isConsumable =
                    item.category === 'Vivres & Eau' ||
                    item.category === 'Nutrition' ||
                    item.category === 'Hydratation';

                  return (
                    <div
                      key={item.id}
                      className={cn(
                        'p-2 rounded-2xl border flex items-center justify-between gap-2.5 transition-all shadow-2xs',
                        isItemInBag
                          ? 'bg-emerald-50/60 border-emerald-200/80'
                          : 'bg-white/90 dark:bg-stone-900/90 border-white/90 dark:border-white/10'
                      )}
                    >
                      <div className="flex items-center gap-2.5 min-w-0 flex-1">
                        <img
                          src={item.image}
                          alt={item.name}
                          className="w-10 h-10 rounded-xl object-cover shrink-0 bg-black/5"
                          loading="lazy"
                        />
                        <div className="min-w-0 flex-1">
                          <h4 className="text-xs font-bold text-[#17402C] dark:text-white truncate">
                            {item.name}
                          </h4>
                          <div className="flex items-center gap-2 text-[10.5px] font-mono text-[#5A7064] mt-0.5">
                            <span>{formatWeight(item.weightG)}</span>
                            <span className="text-[9px] font-sans px-1.5 py-0.2 rounded bg-black/5 dark:bg-white/10">{item.category}</span>
                          </div>
                        </div>
                      </div>

                      <div className="shrink-0">
                        {isItemInBag ? (
                          <div className="px-2.5 py-1 rounded-xl text-[10.5px] font-bold bg-emerald-100 text-emerald-900 border border-emerald-200 flex items-center gap-1">
                            <Check size={11} />
                            <span>Dans le sac</span>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleQuickAddToBag(item)}
                            className="px-2.5 py-1 rounded-xl text-[10.5px] font-bold bg-[#17402C] text-white hover:bg-[#17402C]/90 shadow-2xs flex items-center gap-1 cursor-pointer"
                          >
                            <Plus size={11} />
                            <span>+ Sac</span>
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ════ MODALE AJOUT ÉQUIPEMENT ════ */}
      <AnimatePresence>
        {isAddModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="glass p-6 rounded-3xl max-w-md w-full border border-white/90 shadow-2xl space-y-4 bg-white/95 text-[#17402C]"
            >
              <div className="flex items-center justify-between">
                <h3 className="font-display font-bold text-base text-[#17402C] flex items-center gap-2">
                  <Boxes size={18} className="text-[#2D6B4A]" />
                  <span>Ajouter un Équipement</span>
                </h3>
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="p-1.5 rounded-xl hover:bg-black/5 text-[#5A7064] cursor-pointer"
                >
                  <X size={16} />
                </button>
              </div>

              <form onSubmit={handleAddItem} className="space-y-3.5">
                <div>
                  <label className="text-[11px] font-bold uppercase tracking-wider text-[#5A7064] block mb-1">
                    Nom de l’équipement *
                  </label>
                  <input
                    type="text"
                    required
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="Ex: Tente Big Agnes Copper Spur 2P"
                    className="w-full px-3.5 py-2.5 rounded-xl text-xs bg-black/5 border border-black/10 text-[#17402C] focus:outline-none focus:ring-2 focus:ring-[#17402C]/30"
                    autoFocus
                  />
                </div>

                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <label className="text-[11px] font-bold uppercase tracking-wider text-[#5A7064] block mb-1">
                      Marque
                    </label>
                    <input
                      type="text"
                      value={newBrand}
                      onChange={(e) => setNewBrand(e.target.value)}
                      placeholder="Ex: MSR, Sea to Summit..."
                      className="w-full px-3 py-2 rounded-xl text-xs bg-black/5 border border-black/10 text-[#17402C]"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-bold uppercase tracking-wider text-[#5A7064] block mb-1">
                      Catégorie
                    </label>
                    <select
                      value={newCategory}
                      onChange={(e) => setNewCategory(e.target.value)}
                      className="w-full px-2.5 py-2 rounded-xl text-xs bg-black/5 border border-black/10 text-[#17402C]"
                    >
                      {CATEGORIES.filter((c) => c !== 'Toutes').map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2.5">
                  <div>
                    <label className="text-[11px] font-bold uppercase tracking-wider text-[#5A7064] block mb-1">
                      Poids (g)
                    </label>
                    <input
                      type="number"
                      min={0}
                      value={newWeight}
                      onChange={(e) => setNewWeight(Number(e.target.value))}
                      className="w-full px-2.5 py-2 rounded-xl text-xs bg-black/5 border border-black/10 text-[#17402C]"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-bold uppercase tracking-wider text-[#5A7064] block mb-1">
                      État
                    </label>
                    <select
                      value={newCondition}
                      onChange={(e) => setNewCondition(e.target.value)}
                      className="w-full px-2 py-2 rounded-xl text-xs bg-black/5 border border-black/10 text-[#17402C]"
                    >
                      <option value="neuf">Neuf</option>
                      <option value="tres_bon">Très bon</option>
                      <option value="bon">Bon</option>
                      <option value="moyen">Usé</option>
                      <option value="a_remplacer">À remplacer</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-[11px] font-bold uppercase tracking-wider text-[#5A7064] block mb-1">
                      Prix (€)
                    </label>
                    <input
                      type="number"
                      min={0}
                      value={newPriceEur}
                      onChange={(e) => setNewPriceEur(e.target.value ? Number(e.target.value) : '')}
                      placeholder="Ex: 180"
                      className="w-full px-2.5 py-2 rounded-xl text-xs bg-black/5 border border-black/10 text-[#17402C]"
                    />
                  </div>
                </div>

                <div className="pt-2 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setIsAddModalOpen(false)}
                    className="px-4 py-2 rounded-xl text-xs font-semibold hover:bg-black/5 text-[#5A7064] cursor-pointer"
                  >
                    Annuler
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 rounded-xl text-xs font-bold bg-[#17402C] text-white hover:bg-[#17402C]/90 shadow-xs cursor-pointer"
                  >
                    Enregistrer
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ════ MODALE PRÊT ════ */}
      <AnimatePresence>
        {isLoanModalOpen && selectedItemForLoan && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="glass p-6 rounded-3xl max-w-md w-full border border-white/90 shadow-2xl space-y-4 bg-white/95 text-[#17402C]"
            >
              <div className="flex items-center justify-between">
                <h3 className="font-display font-bold text-base text-[#17402C] flex items-center gap-2">
                  <Handshake size={18} className="text-[#2D6B4A]" />
                  <span>Prêter un Équipement</span>
                </h3>
                <button
                  type="button"
                  onClick={() => setIsLoanModalOpen(false)}
                  className="p-1.5 rounded-xl hover:bg-black/5 text-[#5A7064] cursor-pointer"
                >
                  <X size={16} />
                </button>
              </div>

              <div className="p-3 rounded-2xl bg-black/5 text-xs font-semibold flex items-center gap-2">
                <Boxes size={14} className="text-[#2D6B4A]" />
                <span>Objet : <strong>{selectedItemForLoan.name}</strong></span>
              </div>

              <form onSubmit={handleCreateLoan} className="space-y-3.5">
                <div>
                  <label className="text-[11px] font-bold uppercase tracking-wider text-[#5A7064] block mb-1">
                    Nom ou contact de l’emprunteur *
                  </label>
                  <input
                    type="text"
                    required
                    value={borrowerContact}
                    onChange={(e) => setBorrowerContact(e.target.value)}
                    placeholder="Ex: Thomas (+33 6 12 34 56 78)"
                    className="w-full px-3.5 py-2.5 rounded-xl text-xs bg-black/5 border border-black/10 text-[#17402C] focus:outline-none focus:ring-2 focus:ring-[#17402C]/30"
                    autoFocus
                  />
                </div>

                <div>
                  <label className="text-[11px] font-bold uppercase tracking-wider text-[#5A7064] block mb-1">
                    Date de retour prévue (optionnel)
                  </label>
                  <input
                    type="date"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl text-xs bg-black/5 border border-black/10 text-[#17402C]"
                  />
                </div>

                <div className="pt-2 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setIsLoanModalOpen(false)}
                    className="px-4 py-2 rounded-xl text-xs font-semibold hover:bg-black/5 text-[#5A7064] cursor-pointer"
                  >
                    Annuler
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 rounded-xl text-xs font-bold bg-[#17402C] text-white hover:bg-[#17402C]/90 shadow-xs cursor-pointer"
                  >
                    Confirmer le prêt
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
