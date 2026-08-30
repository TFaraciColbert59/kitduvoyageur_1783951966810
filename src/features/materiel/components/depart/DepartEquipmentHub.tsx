'use client';
import { useState, useMemo } from 'react';
import Link from 'next/link';
import Image from 'next/image';
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
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { GlassCard } from '@/components/ui/GlassCard';
import { formatWeight } from '@/features/materiel/domain/departCalculations';
import { addInventoryItem } from '@/features/materiel/actions/addInventoryItem';
import { deleteInventoryItem } from '@/features/materiel/actions/deleteInventoryItem';
import { updateLoanStatus } from '@/features/materiel/actions/updateLoanStatus';
import { createLoan } from '@/features/materiel/actions/createLoan';
import { addDepartItem } from '@/features/materiel/actions/addDepartItem';
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
  image: string | null;
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
  neuf: { label: 'Neuf', tone: 'bg-emerald-100 text-emerald-800' },
  tres_bon: { label: 'Très bon', tone: 'bg-emerald-50 text-emerald-900 border border-emerald-200' },
  bon: { label: 'Bon état', tone: 'bg-blue-50 text-blue-900 border border-blue-200' },
  moyen: { label: 'Usé', tone: 'bg-amber-50 text-amber-900 border border-amber-200' },
  a_remplacer: { label: 'À remplacer', tone: 'bg-red-100 text-red-800' },
  pour_pieces: { label: 'Pour pièces', tone: 'bg-slate-100 text-slate-700' },
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

  // ════ CONSOLIDATION UNIFIÉE SANS DOUBLON ════
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

      const item: UnifiedEquipmentItem = {
        id: `inv-${inv.id}`,
        name: inv.name,
        brand: inv.brand,
        category: inv.category || 'Autre',
        weightG: inv.weight_g || 0,
        priceEur: inv.price_cents ? inv.price_cents / 100 : null,
        image: inv.photo_url,
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
      if (!map.has(normName)) {
        map.set(normName, {
          id: `kit-${ki.id || normName}`,
          name: ki.name,
          brand: null,
          category: ki.category || 'Autre',
          weightG: ki.weight_g || 0,
          priceEur: null,
          image: ki.photoUrl || null,
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
      }
    }

    // 3. Produits Boutique LKDV
    for (const p of products) {
      const normName = normalize(p.name);
      if (!map.has(normName)) {
        map.set(normName, {
          id: `shop-${p.id}`,
          name: p.name,
          brand: null,
          category: p.category || 'Autre',
          weightG: p.weightG || 0,
          priceEur: p.priceEur || 0,
          image: p.image,
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

    const optimisticItem: InventoryItem = {
      id: `temp-${Date.now()}`,
      name: newName.trim(),
      brand: newBrand.trim() || null,
      category: newCategory,
      weight_g: Number(newWeight) || 0,
      price_cents: newPriceEur ? Number(newPriceEur) * 100 : null,
      condition: newCondition,
      photo_url: null,
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
    <div className="w-full space-y-4">
      {/* Bascule Mobile Catalogue vs Sac */}
      <div className="flex md:hidden items-center justify-center p-1 bg-black/5 dark:bg-white/10 rounded-2xl gap-1">
        <button
          type="button"
          onClick={() => setMobileTab('catalog')}
          className={cn(
            'flex-1 py-1.5 rounded-xl text-xs font-bold transition-all text-center flex items-center justify-center gap-1.5',
            mobileTab === 'catalog' ? 'bg-[#17402C] text-white shadow-xs' : 'text-[#5A7064]'
          )}
        >
          <Boxes size={13} />
          <span>Parc Matériel ({filteredItems.length})</span>
        </button>
        <button
          type="button"
          onClick={() => setMobileTab('bag')}
          className={cn(
            'flex-1 py-1.5 rounded-xl text-xs font-bold transition-all text-center flex items-center justify-center gap-1.5',
            mobileTab === 'bag' ? 'bg-[#17402C] text-white shadow-xs' : 'text-[#5A7064]'
          )}
        >
          <CheckSquare size={13} />
          <span>Sac Actif ({kitItems.filter((i) => i.is_checked).length}/{kitItems.length})</span>
        </button>
      </div>

      {/* Disposition Desktop 2 Colonnes (Hub 3-Cards à gauche + Checklist à droite) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 lg:gap-5 items-start">
        {/* COLONNE GAUCHE / CENTRE : CATALOGUE 3-CARDS (Span 8 ou 12) */}
        <div className={cn('space-y-4 min-w-0', mobileTab === 'bag' ? 'hidden md:block lg:col-span-8' : 'lg:col-span-8')}>
          <GlassCard tone="neutral" as="article" ariaLabelledBy="equipment-hub-heading" className="p-4 sm:p-5 space-y-4">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-black/5 dark:border-white/10 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-[#2D6B4A]/10 flex items-center justify-center text-[#2D6B4A]">
                  <Boxes size={18} aria-hidden="true" />
                </div>
                <div>
                  <h2 id="equipment-hub-heading" className="text-sm sm:text-base font-bold text-[#17402C]">
                    Mon Parc Matériel & Équipements
                  </h2>
                  <p className="text-[10.5px] text-[#5A7064]">
                    Affichage unifié avec multi-statuts en direct.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsAddModalOpen(true)}
                className="glass-capsule-btn primary text-xs !py-1.5 !px-3 inline-flex items-center gap-1 font-bold shrink-0 shadow-2xs cursor-pointer self-end sm:self-auto"
              >
                <Plus size={13} />
                <span>Ajouter</span>
              </button>
            </div>

            {/* Filtres de multi-statuts */}
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1">
              <button
                type="button"
                onClick={() => setStatusFilter('all')}
                className={cn(
                  'px-2.5 py-1 rounded-xl text-[11px] font-semibold whitespace-nowrap transition-all cursor-pointer flex items-center gap-1',
                  statusFilter === 'all'
                    ? 'bg-[#17402C] text-white shadow-xs'
                    : 'bg-black/5 dark:bg-white/10 text-[#5A7064] hover:text-[#17402C]'
                )}
              >
                <Layers size={11} />
                <span>Tous ({stats.totalCount})</span>
              </button>

              <button
                type="button"
                onClick={() => setStatusFilter('in_bag')}
                className={cn(
                  'px-2.5 py-1 rounded-xl text-[11px] font-semibold whitespace-nowrap transition-all cursor-pointer flex items-center gap-1',
                  statusFilter === 'in_bag'
                    ? 'bg-[#17402C] text-white shadow-xs'
                    : 'bg-black/5 dark:bg-white/10 text-[#5A7064] hover:text-[#17402C]'
                )}
              >
                <CheckSquare size={11} />
                <span>Au sac ({stats.inBagCount})</span>
              </button>

              <button
                type="button"
                onClick={() => setStatusFilter('in_inventory')}
                className={cn(
                  'px-2.5 py-1 rounded-xl text-[11px] font-semibold whitespace-nowrap transition-all cursor-pointer flex items-center gap-1',
                  statusFilter === 'in_inventory'
                    ? 'bg-[#17402C] text-white shadow-xs'
                    : 'bg-black/5 dark:bg-white/10 text-[#5A7064] hover:text-[#17402C]'
                )}
              >
                <Boxes size={11} />
                <span>Inventaire ({stats.inInventoryCount})</span>
              </button>

              <button
                type="button"
                onClick={() => setStatusFilter('lent')}
                className={cn(
                  'px-2.5 py-1 rounded-xl text-[11px] font-semibold whitespace-nowrap transition-all cursor-pointer flex items-center gap-1',
                  statusFilter === 'lent'
                    ? 'bg-[#17402C] text-white shadow-xs'
                    : 'bg-black/5 dark:bg-white/10 text-[#5A7064] hover:text-[#17402C]'
                )}
              >
                <Handshake size={11} />
                <span>Prêt ({stats.lentCount})</span>
              </button>

              <button
                type="button"
                onClick={() => setStatusFilter('to_acquire')}
                className={cn(
                  'px-2.5 py-1 rounded-xl text-[11px] font-semibold whitespace-nowrap transition-all cursor-pointer flex items-center gap-1',
                  statusFilter === 'to_acquire'
                    ? 'bg-[#17402C] text-white shadow-xs'
                    : 'bg-black/5 dark:bg-white/10 text-[#5A7064] hover:text-[#17402C]'
                )}
              >
                <ShoppingBag size={11} />
                <span>Boutique ({stats.toAcquireCount})</span>
              </button>
            </div>

            {/* Barre de recherche et catégories */}
            <div className="flex flex-col sm:flex-row gap-2 items-center justify-between">
              <div className="relative w-full sm:w-64">
                <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#5A7064]" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Rechercher équipement..."
                  className="w-full pl-8 pr-7 py-1.5 rounded-xl text-xs bg-white/50 dark:bg-white/10 border border-white/60 focus:outline-none focus:ring-2 focus:ring-[#17402C]/30 text-[#17402C]"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-[#5A7064] p-0.5 cursor-pointer"
                  >
                    <X size={11} />
                  </button>
                )}
              </div>

              <div className="flex gap-1 overflow-x-auto no-scrollbar max-w-full pb-0.5">
                {CATEGORIES.map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setSelectedCat(cat)}
                    className={cn(
                      'px-2 py-0.5 rounded-xl text-[10.5px] font-semibold whitespace-nowrap transition-colors cursor-pointer',
                      selectedCat === cat
                        ? 'bg-[#17402C] text-white shadow-2xs'
                        : 'bg-white/40 text-[#5A7064] hover:text-[#17402C]'
                    )}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>

            {/* ════ GRILLE DES CARTES PAR 3 (grid-cols-1 sm:grid-cols-2 xl:grid-cols-3) ════ */}
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3 max-h-[600px] overflow-y-auto pr-0.5">
              {filteredItems.length === 0 ? (
                <div className="col-span-full p-8 text-center bg-white/30 rounded-2xl border border-dashed border-black/10 text-xs text-[#5A7064]">
                  Aucun équipement correspondant à ces critères.
                </div>
              ) : (
                filteredItems.map((item) => {
                  const cond = item.condition ? CONDITION_LABELS[item.condition] : null;

                  return (
                    <div
                      key={item.id}
                      className={cn(
                        'p-3 rounded-2xl border transition-all flex flex-col justify-between space-y-2.5 shadow-2xs hover:shadow-md backdrop-blur-xs',
                        item.isLent
                          ? 'bg-amber-50/70 border-amber-200/90 text-amber-950'
                          : item.inBag
                          ? 'bg-emerald-50/50 border-emerald-200/80 text-[#17402C]'
                          : 'bg-white/80 dark:bg-white/10 border-white/80 text-[#17402C]'
                      )}
                    >
                      {/* Image & Badges hauts */}
                      <div className="space-y-2">
                        <div className="relative w-full h-32 rounded-xl overflow-hidden bg-black/5 flex items-center justify-center">
                          {item.image ? (
                            <Image
                              src={item.image}
                              alt={item.name}
                              fill
                              className="object-cover"
                              sizes="(max-width: 640px) 100vw, 33vw"
                            />
                          ) : (
                            <div className="w-12 h-12 rounded-2xl bg-black/5 flex items-center justify-center font-bold text-lg text-[#2D6B4A]">
                              {item.name.charAt(0).toUpperCase()}
                            </div>
                          )}

                          <span className="absolute top-2 left-2 text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-lg bg-black/60 text-white backdrop-blur-xs">
                            {item.category}
                          </span>
                        </div>

                        {/* Titre & Marque */}
                        <div>
                          <div className="flex items-center justify-between gap-1">
                            <h3 className="text-xs font-bold text-[#17402C] line-clamp-1 leading-snug">
                              {item.name}
                            </h3>
                            {item.brand && (
                              <span className="text-[10px] text-[#5A7064] font-medium shrink-0">
                                {item.brand}
                              </span>
                            )}
                          </div>

                          {/* Multi-Statuts Badges */}
                          <div className="flex items-center gap-1 flex-wrap mt-1">
                            {item.inBag && (
                              <span className="text-[8.5px] font-bold px-1.5 py-0.2 rounded-md bg-[#17402C] text-white flex items-center gap-0.5">
                                <CheckSquare size={9} />
                                <span>Dans le sac</span>
                              </span>
                            )}

                            {item.inInventory && (
                              <span className="text-[8.5px] font-bold px-1.5 py-0.2 rounded-md bg-emerald-100 text-emerald-900 border border-emerald-200 flex items-center gap-0.5">
                                <Boxes size={9} />
                                <span>Inventaire</span>
                              </span>
                            )}

                            {item.isLent && (
                              <span
                                className={cn(
                                  'text-[8.5px] font-bold px-1.5 py-0.2 rounded-md flex items-center gap-0.5',
                                  item.lentDetails?.isOverdue
                                    ? 'bg-red-200 text-red-900'
                                    : 'bg-amber-200 text-amber-900'
                                )}
                              >
                                <Handshake size={9} />
                                <span>Prêté ({item.lentDetails?.borrower})</span>
                              </span>
                            )}

                            {item.toAcquire && !item.inInventory && (
                              <span className="text-[8.5px] font-bold px-1.5 py-0.2 rounded-md bg-blue-100 text-blue-900 border border-blue-200 flex items-center gap-0.5">
                                <ShoppingBag size={9} />
                                <span>Boutique</span>
                              </span>
                            )}

                            {cond && (
                              <span className={cn('text-[8.5px] font-bold px-1.5 py-0.2 rounded-md', cond.tone)}>
                                {cond.label}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Métriques Poids / Prix & Boutons d'Action */}
                      <div className="space-y-2 pt-2 border-t border-black/5">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-[11px] font-mono text-[#5A7064] flex items-center gap-0.5">
                            <Scale size={11} />
                            <span>{formatWeight(item.weightG)}</span>
                          </span>

                          {item.priceEur !== null && (
                            <span className="font-mono font-bold text-[#17402C] text-xs">
                              {item.priceEur.toFixed(2)} €
                            </span>
                          )}
                        </div>

                        {/* Actions contextuelles */}
                        <div className="grid grid-cols-2 gap-1.5">
                          {item.isLent && item.loanId ? (
                            <button
                              type="button"
                              onClick={() => handleReturnLoan(item.loanId!, item.inventoryId)}
                              className="col-span-2 py-1.5 rounded-xl text-[11px] font-bold bg-[#17402C] text-white hover:bg-[#17402C]/90 shadow-2xs flex items-center justify-center gap-1 cursor-pointer"
                            >
                              <Check size={11} />
                              <span>Marquer Rendu</span>
                            </button>
                          ) : item.inBag ? (
                            <div className="col-span-2 py-1 rounded-xl text-[10.5px] font-bold bg-emerald-100/90 text-emerald-900 flex items-center justify-center gap-1">
                              <Check size={11} />
                              <span>Dans le sac ✓</span>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleQuickAddToBag(item)}
                              className="py-1.5 rounded-xl text-[10.5px] font-bold bg-[#17402C] text-white hover:bg-[#17402C]/90 shadow-2xs flex items-center justify-center gap-1 cursor-pointer"
                              title="Ajouter au sac actif"
                            >
                              <Plus size={11} />
                              <span>Au sac</span>
                            </button>
                          )}

                          {item.inInventory && !item.isLent && !item.inBag && (
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedItemForLoan(item);
                                setIsLoanModalOpen(true);
                              }}
                              className="py-1.5 rounded-xl text-[10.5px] font-semibold bg-white/80 hover:bg-white text-[#2D6B4A] border border-black/10 flex items-center justify-center gap-1 cursor-pointer"
                            >
                              <Handshake size={11} />
                              <span>Prêter</span>
                            </button>
                          )}

                          {!item.inInventory && item.toAcquire && (
                            <button
                              type="button"
                              onClick={() => handleMarkAsOwned(item)}
                              className="py-1.5 rounded-xl text-[10.5px] font-semibold bg-emerald-100 hover:bg-emerald-200 text-emerald-900 flex items-center justify-center gap-1 cursor-pointer"
                              title="J'ai déjà cet équipement"
                            >
                              <Check size={11} />
                              <span>Possédé</span>
                            </button>
                          )}

                          {item.slug && (
                            <Link
                              href={`/produit/${item.slug}`}
                              className="py-1.5 rounded-xl bg-white/80 hover:bg-white text-[#17402C] border border-black/10 text-[10.5px] font-semibold flex items-center justify-center gap-1"
                              title="Voir en boutique"
                            >
                              <ExternalLink size={11} />
                              <span>Boutique</span>
                            </Link>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </GlassCard>
        </div>

        {/* COLONNE DROITE : CHECKLIST DU SAC INTÉGRÉE (Span 4) */}
        <div className={cn('space-y-4', mobileTab === 'catalog' ? 'hidden md:block lg:col-span-4' : 'lg:col-span-4')}>
          <div className="sticky top-4 space-y-2">
            <div className="flex items-center justify-between px-1">
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#5A7064] flex items-center gap-1.5">
                <CheckSquare size={13} className="text-[#2D6B4A]" />
                <span>Checklist du Sac en direct</span>
              </span>
              <span className="text-[10.5px] font-mono font-bold px-2 py-0.5 rounded-full bg-[#17402C]/10 text-[#17402C]">
                {kitItems.filter((i) => i.is_checked).length}/{kitItems.length}
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

      {/* Modale Ajout Objet */}
      <AnimatePresence>
        {isAddModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="glass p-5 rounded-3xl max-w-md w-full border border-white/80 shadow-2xl space-y-4 bg-white/95 text-[#17402C]"
            >
              <div className="flex items-center justify-between">
                <h3 className="font-display font-bold text-base text-[#17402C]">
                  Ajouter un Équipement
                </h3>
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="p-1.5 rounded-xl hover:bg-black/5 text-[#5A7064] cursor-pointer"
                >
                  <X size={15} />
                </button>
              </div>

              <form onSubmit={handleAddItem} className="space-y-3">
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
                    className="w-full px-3 py-2 rounded-xl text-xs bg-black/5 border border-black/10 text-[#17402C]"
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
                      placeholder="Ex: Sea to Summit, MSR..."
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
                    className="px-3.5 py-2 rounded-xl text-xs font-semibold hover:bg-black/5 text-[#5A7064] cursor-pointer"
                  >
                    Annuler
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 rounded-xl text-xs font-bold bg-[#17402C] text-white hover:bg-[#17402C]/90 shadow-2xs cursor-pointer"
                  >
                    Enregistrer
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Modale Prêt */}
      <AnimatePresence>
        {isLoanModalOpen && selectedItemForLoan && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="glass p-5 rounded-3xl max-w-md w-full border border-white/80 shadow-2xl space-y-4 bg-white/95 text-[#17402C]"
            >
              <div className="flex items-center justify-between">
                <h3 className="font-display font-bold text-base text-[#17402C] flex items-center gap-1.5">
                  <Handshake size={16} className="text-[#2D6B4A]" />
                  <span>Prêter un équipement</span>
                </h3>
                <button
                  type="button"
                  onClick={() => setIsLoanModalOpen(false)}
                  className="p-1.5 rounded-xl hover:bg-black/5 text-[#5A7064] cursor-pointer"
                >
                  <X size={15} />
                </button>
              </div>

              <div className="p-2.5 rounded-2xl bg-black/5 text-xs font-semibold">
                <span>Objet à prêter : <strong>{selectedItemForLoan.name}</strong></span>
              </div>

              <form onSubmit={handleCreateLoan} className="space-y-3">
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
                    className="w-full px-3 py-2 rounded-xl text-xs bg-black/5 border border-black/10 text-[#17402C]"
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
                    className="px-3.5 py-2 rounded-xl text-xs font-semibold hover:bg-black/5 text-[#5A7064] cursor-pointer"
                  >
                    Annuler
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 rounded-xl text-xs font-bold bg-[#17402C] text-white hover:bg-[#17402C]/90 shadow-2xs cursor-pointer"
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
