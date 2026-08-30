'use client';
import React, { useState, useMemo } from 'react';
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
  DollarSign,
  Tag,
  Clock,
  User,
  ShieldAlert,
  ChevronDown,
  X,
  Sparkles,
  ExternalLink,
  CheckSquare,
  AlertTriangle,
  Layers,
  Truck,
  Eye,
  ShoppingBasket,
  ArrowUpRight,
  SlidersHorizontal,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { GlassCard } from '@/components/ui/GlassCard';
import { formatWeight } from '@/features/materiel/domain/departCalculations';
import { addInventoryItem } from '@/features/materiel/actions/addInventoryItem';
import { deleteInventoryItem } from '@/features/materiel/actions/deleteInventoryItem';
import { updateLoanStatus } from '@/features/materiel/actions/updateLoanStatus';
import { createLoan } from '@/features/materiel/actions/createLoan';
import { addDepartItem } from '@/features/materiel/actions/addDepartItem';
import { resolveGearImage } from '@/features/materiel/services/gearImageResolver';
import { DepartChecklist } from './DepartChecklist';
import { cn } from '@/lib/utils';
import type { InventoryItem } from '@/features/materiel/services/getInventory';
import type { LoanItem } from '@/features/materiel/services/getLoans';
import type { ProductSuggestion } from '@/features/materiel/services/getProductSuggestions';
import type { ChecklistItem, Participant } from '@/features/materiel/types/trekHub';

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
  kitId: string;
  isRealKit?: boolean;
}

const CATEGORIES = [
  'Toutes',
  'Bivouac',
  'Couchage',
  'Vêtements',
  'Cuisine',
  'Hydratation',
  'Sécurité',
  'Nutrition',
  'Électronique',
  'Hygiène',
  'Autre',
];

const CONDITION_LABELS: Record<string, { label: string; tone: string }> = {
  neuf: { label: 'Neuf', tone: 'bg-emerald-500/10 text-emerald-800 dark:text-emerald-300 border border-emerald-500/20' },
  tres_bon: { label: 'Très bon', tone: 'bg-emerald-500/10 text-emerald-800 dark:text-emerald-300 border border-emerald-500/20' },
  bon: { label: 'Bon état', tone: 'bg-blue-500/10 text-blue-800 dark:text-blue-300 border border-blue-500/20' },
  moyen: { label: 'Usé', tone: 'bg-amber-500/10 text-amber-800 dark:text-amber-300 border border-amber-500/20' },
  a_remplacer: { label: 'À remplacer', tone: 'bg-red-500/15 text-red-800 dark:text-red-300 border border-red-500/30' },
  pour_pieces: { label: 'Pour pièces', tone: 'bg-slate-500/10 text-slate-700 dark:text-slate-300 border border-slate-500/20' },
};

export function DepartEquipmentHub({
  inventory: initialInventory,
  loans: initialLoans,
  products,
  kitItems,
  consumables = {},
  participants = [],
  kitId,
  isRealKit = false,
}: DepartEquipmentHubProps) {
  const [statusFilter, setStatusFilter] = useState<'all' | 'in_bag' | 'in_inventory' | 'lent' | 'to_acquire' | 'replace'>('all');
  const [selectedCat, setSelectedCat] = useState('Toutes');
  const [searchQuery, setSearchQuery] = useState('');
  const [mobileTab, setMobileTab] = useState<'catalog' | 'bag'>('catalog');

  const [inventoryList, setInventoryList] = useState<InventoryItem[]>(initialInventory);
  const [loanList, setLoanList] = useState<LoanItem[]>(initialLoans);

  // Modales
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isLoanModalOpen, setIsLoanModalOpen] = useState(false);
  const [selectedItemForLoan, setSelectedItemForLoan] = useState<UnifiedEquipmentItem | null>(null);

  // Formulaires
  const [newName, setNewName] = useState('');
  const [newBrand, setNewBrand] = useState('');
  const [newCategory, setNewCategory] = useState('Bivouac');
  const [newWeight, setNewWeight] = useState(250);
  const [newCondition, setNewCondition] = useState('tres_bon');
  const [newPriceEur, setNewPriceEur] = useState<number | ''>('');

  const [borrowerContact, setBorrowerContact] = useState('');
  const [dueDate, setDueDate] = useState('');

  // ════ CONSOLIDATION UNIFIÉE SANS DOUBLON & AVEC IMAGERIE HD ════
  const unifiedItems: UnifiedEquipmentItem[] = useMemo(() => {
    const map = new Map<string, UnifiedEquipmentItem>();
    const normalize = (s: string) => s.toLowerCase().trim().replace(/[^a-z0-9]/g, '');

    // 1. Inventaire possédé
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

    // 2. Items requis dans le kit
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
          toAcquire: true,
          condition: null,
          inventoryId: null,
          loanId: null,
          kitItemId: ki.id || null,
        });
      } else {
        const existing = map.get(normName)!;
        existing.inBag = true;
        existing.kitItemId = ki.id || existing.kitItemId;
        if (!existing.image || existing.image.includes('no_image')) {
          existing.image = image;
        }
      }
    }

    // 3. Produits Boutique LKDV
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
          priceEur: p.priceEur || 0,
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
    const replaceCount = unifiedItems.filter(
      (i) => i.condition === 'a_remplacer' || i.condition === 'pour_pieces'
    ).length;

    return { totalCount, inBagCount, inInventoryCount, lentCount, toAcquireCount, replaceCount };
  }, [unifiedItems]);

  const filteredItems = useMemo(() => {
    return unifiedItems.filter((item) => {
      if (statusFilter === 'in_bag' && !item.inBag) return false;
      if (statusFilter === 'in_inventory' && !item.inInventory) return false;
      if (statusFilter === 'lent' && !item.isLent) return false;
      if (statusFilter === 'to_acquire' && !item.toAcquire) return false;
      if (statusFilter === 'replace' && item.condition !== 'a_remplacer' && item.condition !== 'pour_pieces') return false;

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

  const handleQuickAddToBag = async (item: UnifiedEquipmentItem) => {
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

      {/* ════ DISPOSITION D'ÉLITE 2 COLONNES ════ */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* ── COLONNE PRINCIPALE : CATALOGUE 3-CARDS (Span 8) ── */}
        <div className={cn('space-y-4 min-w-0', mobileTab === 'bag' ? 'hidden md:block lg:col-span-8' : 'lg:col-span-8')}>
          <div className="glass rounded-[28px] p-4.5 sm:p-6 space-y-4.5 border border-white/80 dark:border-white/10 shadow-sm backdrop-blur-md">
            {/* Top Header iOS */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-black/5 dark:border-white/10 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-[#2D6B4A]/10 border border-[#2D6B4A]/20 flex items-center justify-center text-[#2D6B4A] shadow-2xs">
                  <Boxes size={20} aria-hidden="true" />
                </div>
                <div>
                  <h2 className="text-base sm:text-lg font-bold text-[#17402C] tracking-tight">
                    Mon Parc Matériel & Équipements
                  </h2>
                  <p className="text-xs text-[#5A7064] font-medium">
                    Gestion unifiée des statuts : dans le sac, inventaire, prêts & boutique.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsAddModalOpen(true)}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-[#17402C] text-white hover:bg-[#17402C]/90 shadow-xs cursor-pointer transition-all self-end sm:self-auto active:scale-95"
              >
                <Plus size={14} />
                <span>+ Ajouter équipement</span>
              </button>
            </div>

            {/* Barre de filtres de statuts (Style Apple Pills) */}
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1">
              <button
                type="button"
                onClick={() => setStatusFilter('all')}
                className={cn(
                  'px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer flex items-center gap-1.5',
                  statusFilter === 'all'
                    ? 'bg-[#17402C] text-white shadow-xs'
                    : 'bg-black/5 dark:bg-white/10 text-[#5A7064] hover:text-[#17402C] hover:bg-black/10'
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
                    : 'bg-black/5 dark:bg-white/10 text-[#5A7064] hover:text-[#17402C] hover:bg-black/10'
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
                    : 'bg-black/5 dark:bg-white/10 text-[#5A7064] hover:text-[#17402C] hover:bg-black/10'
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
                    : 'bg-black/5 dark:bg-white/10 text-[#5A7064] hover:text-[#17402C] hover:bg-black/10'
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
                    : 'bg-black/5 dark:bg-white/10 text-[#5A7064] hover:text-[#17402C] hover:bg-black/10'
                )}
              >
                <ShoppingBag size={13} />
                <span>Boutique ({stats.toAcquireCount})</span>
              </button>
            </div>

            {/* Recherche fluide & Catégories Apple */}
            <div className="flex flex-col sm:flex-row gap-2.5 items-center justify-between">
              <div className="relative w-full sm:w-72">
                <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#5A7064]" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Rechercher par nom, marque..."
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

              <div className="flex gap-1.5 overflow-x-auto no-scrollbar max-w-full pb-0.5">
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

            {/* ════ GRILLE DES CARTES PAR 3 (iOS Apple Card Layout) ════ */}
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3.5 max-h-[640px] overflow-y-auto no-scrollbar pr-0.5">
              {filteredItems.length === 0 ? (
                <div className="col-span-full py-12 px-4 text-center bg-white/40 rounded-3xl border border-dashed border-black/10 text-xs text-[#5A7064] space-y-2">
                  <Boxes size={24} className="mx-auto text-[#5A7064]/60" />
                  <p className="font-semibold text-[#17402C]">Aucun équipement trouvé pour ces critères.</p>
                  <p className="text-[11px]">Essayez de réinitialiser la recherche ou les filtres.</p>
                </div>
              ) : (
                filteredItems.map((item) => {
                  const cond = item.condition ? CONDITION_LABELS[item.condition] : null;

                  return (
                    <div
                      key={item.id}
                      className={cn(
                        'group rounded-[22px] overflow-hidden border transition-all duration-200 flex flex-col justify-between shadow-xs hover:shadow-lg backdrop-blur-md',
                        item.isLent
                          ? 'bg-amber-50/70 border-amber-200/90 text-amber-950'
                          : item.inBag
                          ? 'bg-emerald-50/60 border-emerald-200/90 text-[#17402C]'
                          : 'bg-white/85 dark:bg-white/10 border-white/80 text-[#17402C]'
                      )}
                    >
                      {/* 1. Zone Hero Image Outdoor (Haute Définition) */}
                      <div className="relative w-full h-36 overflow-hidden bg-black/5">
                        <img
                          src={item.image}
                          alt={item.name}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                          loading="lazy"
                        />
                        {/* Dégradé doux */}
                        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/25 pointer-events-none" />

                        {/* Badge Catégorie Flottant Haut-Gauche */}
                        <span className="absolute top-2.5 left-2.5 text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-lg bg-black/60 text-white backdrop-blur-md shadow-xs">
                          {item.category}
                        </span>

                        {/* Badge Statut Haut-Droite */}
                        <div className="absolute top-2.5 right-2.5 flex items-center gap-1">
                          {item.inBag && (
                            <span className="text-[9px] font-bold px-2 py-0.5 rounded-lg bg-[#17402C] text-white flex items-center gap-1 shadow-xs">
                              <CheckSquare size={10} />
                              <span>Au sac</span>
                            </span>
                          )}

                          {item.isLent && (
                            <span
                              className={cn(
                                'text-[9px] font-bold px-2 py-0.5 rounded-lg shadow-xs flex items-center gap-1',
                                item.lentDetails?.isOverdue
                                  ? 'bg-red-600 text-white'
                                  : 'bg-amber-500 text-white'
                              )}
                            >
                              <Handshake size={10} />
                              <span>Prêté</span>
                            </span>
                          )}
                        </div>

                        {/* Marque / Poids incrusté en bas de l'image */}
                        <div className="absolute bottom-2 left-2.5 right-2.5 flex items-center justify-between text-white text-[11px] font-medium drop-shadow-md">
                          <span className="truncate max-w-[65%] font-semibold">
                            {item.brand || item.name.split(' ')[0]}
                          </span>
                          <span className="font-mono text-[10.5px] font-bold px-1.5 py-0.2 rounded-md bg-black/40 backdrop-blur-xs">
                            {formatWeight(item.weightG)}
                          </span>
                        </div>
                      </div>

                      {/* 2. Contenu & Titre */}
                      <div className="p-3 space-y-2.5 flex-1 flex flex-col justify-between">
                        <div>
                          <h3 className="text-xs sm:text-[13px] font-bold text-[#17402C] leading-snug line-clamp-2">
                            {item.name}
                          </h3>

                          {/* Multi-Statuts Badges */}
                          <div className="flex items-center gap-1 flex-wrap mt-1.5">
                            {item.inInventory && (
                              <span className="text-[8.5px] font-bold px-1.5 py-0.5 rounded-md bg-emerald-100 text-emerald-900 border border-emerald-200 flex items-center gap-0.5">
                                <Boxes size={9} />
                                <span>Mon Inventaire</span>
                              </span>
                            )}

                            {item.toAcquire && !item.inInventory && (
                              <span className="text-[8.5px] font-bold px-1.5 py-0.5 rounded-md bg-blue-100 text-blue-900 border border-blue-200 flex items-center gap-0.5">
                                <ShoppingBag size={9} />
                                <span>Boutique</span>
                              </span>
                            )}

                            {item.isLent && item.lentDetails && (
                              <span className="text-[8.5px] font-semibold px-1.5 py-0.5 rounded-md bg-amber-100 text-amber-900 border border-amber-200">
                                Prêté à {item.lentDetails.borrower}
                              </span>
                            )}

                            {cond && (
                              <span className={cn('text-[8.5px] font-semibold px-1.5 py-0.5 rounded-md', cond.tone)}>
                                {cond.label}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* 3. Actions & Prix */}
                        <div className="pt-2 border-t border-black/5 dark:border-white/5 space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-[11px] font-semibold text-[#5A7064]">
                              {item.priceEur !== null ? (
                                <strong className="text-xs text-[#17402C] font-mono">{item.priceEur.toFixed(2)} €</strong>
                              ) : (
                                <span className="italic text-[10px]">Prix N/D</span>
                              )}
                            </span>

                            {item.inInventory && (
                              <button
                                type="button"
                                onClick={() => item.inventoryId && handleDeleteItem(item.inventoryId)}
                                className="text-[10px] text-red-500 hover:text-red-700 p-1 rounded-md hover:bg-red-50 cursor-pointer"
                                title="Supprimer de l'inventaire"
                              >
                                <Trash2 size={11} />
                              </button>
                            )}
                          </div>

                          {/* Rangée de boutons Apple style */}
                          <div className="grid grid-cols-2 gap-1.5">
                            {item.isLent && item.loanId ? (
                              <button
                                type="button"
                                onClick={() => handleReturnLoan(item.loanId!, item.inventoryId)}
                                className="col-span-2 py-1.5 rounded-xl text-xs font-bold bg-[#17402C] text-white hover:bg-[#17402C]/90 shadow-xs flex items-center justify-center gap-1 cursor-pointer transition-all active:scale-98"
                              >
                                <Check size={12} />
                                <span>Marquer Rendu</span>
                              </button>
                            ) : item.inBag ? (
                              <div className="col-span-2 py-1.5 rounded-xl text-xs font-bold bg-emerald-100 text-emerald-900 border border-emerald-200 flex items-center justify-center gap-1">
                                <Check size={12} />
                                <span>Dans le sac ✓</span>
                              </div>
                            ) : (
                              <button
                                type="button"
                                onClick={() => handleQuickAddToBag(item)}
                                className="col-span-2 py-1.5 rounded-xl text-xs font-bold bg-[#17402C] text-white hover:bg-[#17402C]/90 shadow-xs flex items-center justify-center gap-1 cursor-pointer transition-all active:scale-98"
                                title="Ajouter cet équipement au sac actif"
                              >
                                <Plus size={13} />
                                <span>Ajouter au sac</span>
                              </button>
                            )}

                            {item.inInventory && !item.isLent && (
                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedItemForLoan(item);
                                  setIsLoanModalOpen(true);
                                }}
                                className="col-span-2 py-1.5 rounded-xl text-[11px] font-semibold bg-white hover:bg-black/5 text-[#2D6B4A] border border-black/10 flex items-center justify-center gap-1 cursor-pointer transition-all"
                              >
                                <Handshake size={12} />
                                <span>Prêter cet objet</span>
                              </button>
                            )}

                            {!item.inInventory && item.toAcquire && (
                              <button
                                type="button"
                                onClick={() => handleMarkAsOwned(item)}
                                className="py-1.5 rounded-xl text-[11px] font-semibold bg-emerald-100 hover:bg-emerald-200 text-emerald-900 flex items-center justify-center gap-1 cursor-pointer transition-all"
                                title="J'ai déjà cet équipement"
                              >
                                <Check size={11} />
                                <span>J'ai déjà</span>
                              </button>
                            )}

                            {item.slug && (
                              <Link
                                href={`/produit/${item.slug}`}
                                className="py-1.5 rounded-xl bg-white hover:bg-black/5 text-[#17402C] border border-black/10 text-[11px] font-semibold flex items-center justify-center gap-1 transition-all"
                                title="Voir la fiche produit boutique"
                              >
                                <ExternalLink size={11} />
                                <span>Boutique</span>
                              </Link>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* ── COLONNE DROITE : CHECKLIST ACTIVE DU SAC (Span 4) ── */}
        <div className={cn('space-y-3', mobileTab === 'catalog' ? 'hidden md:block lg:col-span-4' : 'lg:col-span-4')}>
          <div className="sticky top-3 space-y-2">
            <div className="flex items-center justify-between px-1.5">
              <span className="text-xs font-bold uppercase tracking-wider text-[#5A7064] flex items-center gap-1.5">
                <CheckSquare size={14} className="text-[#2D6B4A]" />
                <span>Checklist du Sac en Direct</span>
              </span>
              <span className="text-xs font-mono font-bold px-2.5 py-0.5 rounded-full bg-[#17402C]/10 text-[#17402C]">
                {kitItems.filter((i) => i.is_checked).length}/{kitItems.length} prêts
              </span>
            </div>

            <DepartChecklist
              items={kitItems}
              consumables={consumables}
              participants={participants}
              kitId={kitId}
              isRealKit={isRealKit}
            />
          </div>
        </div>
      </div>

      {/* ════ MODALE AJOUT ÉQUIPEMENT (iOS Sheet) ════ */}
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

      {/* ════ MODALE PRÊT (iOS Sheet) ════ */}
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
