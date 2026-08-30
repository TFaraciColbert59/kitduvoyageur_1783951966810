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
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { GlassCard } from '@/components/ui/GlassCard';
import { formatWeight } from '@/features/materiel/domain/departCalculations';
import { addInventoryItem } from '@/features/materiel/actions/addInventoryItem';
import { deleteInventoryItem } from '@/features/materiel/actions/deleteInventoryItem';
import { updateLoanStatus } from '@/features/materiel/actions/updateLoanStatus';
import { createLoan } from '@/features/materiel/actions/createLoan';
import { addDepartItem } from '@/features/materiel/actions/addDepartItem';
import { cn } from '@/lib/utils';
import type { InventoryItem } from '@/features/materiel/services/getInventory';
import type { LoanItem } from '@/features/materiel/services/getLoans';
import type { ProductSuggestion } from '@/features/materiel/services/getProductSuggestions';
import type { ChecklistItem } from '@/features/materiel/types/trekHub';

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
  kitId,
  isRealKit = false,
}: DepartEquipmentHubProps) {
  const [statusFilter, setStatusFilter] = useState<'all' | 'in_bag' | 'in_inventory' | 'lent' | 'to_acquire' | 'replace'>('all');
  const [selectedCat, setSelectedCat] = useState('Toutes');
  const [searchQuery, setSearchQuery] = useState('');

  const [inventoryList, setInventoryList] = useState<InventoryItem[]>(initialInventory);
  const [loanList, setLoanList] = useState<LoanItem[]>(initialLoans);

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isLoanModalOpen, setIsLoanModalOpen] = useState(false);
  const [selectedItemForLoan, setSelectedItemForLoan] = useState<UnifiedEquipmentItem | null>(null);

  const [newName, setNewName] = useState('');
  const [newBrand, setNewBrand] = useState('');
  const [newCategory, setNewCategory] = useState('Bivouac');
  const [newWeight, setNewWeight] = useState(250);
  const [newCondition, setNewCondition] = useState('tres_bon');
  const [newPriceEur, setNewPriceEur] = useState<number | ''>('');

  const [borrowerContact, setBorrowerContact] = useState('');
  const [dueDate, setDueDate] = useState('');

  const unifiedItems: UnifiedEquipmentItem[] = useMemo(() => {
    const map = new Map<string, UnifiedEquipmentItem>();
    const normalize = (s: string) => s.toLowerCase().trim().replace(/[^a-z0-9]/g, '');

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
    <GlassCard tone="neutral" as="article" ariaLabelledBy="equipment-hub-heading" className="relative">
      <div className="p-4 sm:p-6 space-y-4">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-black/5 dark:border-white/10 pb-3.5">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-[#2D6B4A]/10 flex items-center justify-center text-[#2D6B4A]">
              <Boxes size={18} aria-hidden="true" />
            </div>
            <div>
              <h2 id="equipment-hub-heading" className="text-base sm:text-lg font-bold text-[#17402C]">
                Mon Parc Matériel & Équipements
              </h2>
              <p className="text-[11px] text-[#5A7064]">
                Vue unique consolidée : sac actif, inventaire, prêts en cours, livraisons et boutique.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setIsAddModalOpen(true)}
            className="glass-capsule-btn primary text-xs !py-1.5 !px-3 inline-flex items-center gap-1 font-bold shrink-0 shadow-2xs cursor-pointer self-end sm:self-auto"
          >
            <Plus size={13} />
            <span>Ajouter équipement</span>
          </button>
        </div>

        {/* Multi-Status Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1">
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
            <span>Dans le sac ({stats.inBagCount})</span>
          </button>

          <button
            type="button"
            onClick={() => setStatusFilter('in_inventory')}
            className={cn(
              'px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer flex items-center gap-1.5',
              statusFilter === 'in_inventory'
                ? 'bg-[#17402C] text-white shadow-xs'
                : 'bg-black/5 dark:bg-white/10 text-[#5A7064] hover:text-[#17402C]'
            )}
          >
            <Boxes size={13} />
            <span>Mon Inventaire ({stats.inInventoryCount})</span>
          </button>

          <button
            type="button"
            onClick={() => setStatusFilter('lent')}
            className={cn(
              'px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer flex items-center gap-1.5',
              statusFilter === 'lent'
                ? 'bg-[#17402C] text-white shadow-xs'
                : 'bg-black/5 dark:bg-white/10 text-[#5A7064] hover:text-[#17402C]'
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
            <span>À acquérir / Boutique ({stats.toAcquireCount})</span>
          </button>

          {stats.replaceCount > 0 && (
            <button
              type="button"
              onClick={() => setStatusFilter('replace')}
              className={cn(
                'px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer flex items-center gap-1.5',
                statusFilter === 'replace'
                  ? 'bg-red-700 text-white shadow-xs'
                  : 'bg-red-50 text-red-800 border border-red-200 hover:bg-red-100'
              )}
            >
              <AlertTriangle size={13} />
              <span>À remplacer ({stats.replaceCount})</span>
            </button>
          )}
        </div>

        {/* Search & Categories */}
        <div className="flex flex-col sm:flex-row gap-2 items-center justify-between">
          <div className="relative w-full sm:w-72">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#5A7064]" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Rechercher par nom, marque..."
              className="w-full pl-8 pr-8 py-2 rounded-xl text-xs bg-white/50 dark:bg-white/10 border border-white/60 focus:outline-none focus:ring-2 focus:ring-[#17402C]/30 text-[#17402C]"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#5A7064] p-0.5 cursor-pointer"
              >
                <X size={12} />
              </button>
            )}
          </div>

          <div className="flex gap-1 overflow-x-auto no-scrollbar max-w-full pb-1">
            {CATEGORIES.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setSelectedCat(cat)}
                className={cn(
                  'px-2.5 py-1 rounded-xl text-[11px] font-semibold whitespace-nowrap transition-colors cursor-pointer',
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

        {/* Unified Equipment Cards */}
        <div className="space-y-2 max-h-[520px] overflow-y-auto pr-0.5">
          {filteredItems.length === 0 ? (
            <div className="p-8 text-center bg-white/30 rounded-2xl border border-dashed border-black/10 text-xs text-[#5A7064]">
              Aucun équipement trouvé avec ces critères de filtre.
            </div>
          ) : (
            filteredItems.map((item) => {
              const cond = item.condition ? CONDITION_LABELS[item.condition] : null;

              return (
                <div
                  key={item.id}
                  className={cn(
                    'p-3 rounded-2xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3',
                    item.isLent
                      ? 'bg-amber-50/60 border-amber-200/80 text-amber-950'
                      : item.inBag
                      ? 'bg-emerald-50/40 border-emerald-200/70 text-[#17402C]'
                      : 'bg-white/70 dark:bg-white/10 border-white/80 text-[#17402C]'
                  )}
                >
                  <div className="flex items-start gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-xl bg-black/5 dark:bg-white/10 flex items-center justify-center font-bold text-sm shrink-0 text-[#2D6B4A] overflow-hidden relative">
                      {item.image ? (
                        <Image src={item.image} alt={item.name} fill className="object-cover" />
                      ) : (
                        item.name.charAt(0).toUpperCase()
                      )}
                    </div>

                    <div className="space-y-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-bold truncate">{item.name}</span>
                        {item.brand && (
                          <span className="text-[11px] text-[#5A7064] font-medium truncate">
                            ({item.brand})
                          </span>
                        )}
                      </div>

                      {/* Badges de statuts simultanés */}
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {item.inBag && (
                          <span className="text-[9.5px] font-bold px-2 py-0.2 rounded-md bg-[#17402C] text-white flex items-center gap-0.5">
                            <CheckSquare size={10} />
                            <span>Dans le sac</span>
                          </span>
                        )}

                        {item.inInventory && (
                          <span className="text-[9.5px] font-bold px-2 py-0.2 rounded-md bg-emerald-100 text-emerald-900 border border-emerald-200 flex items-center gap-0.5">
                            <Boxes size={10} />
                            <span>Mon Inventaire</span>
                          </span>
                        )}

                        {item.isLent && (
                          <span
                            className={cn(
                              'text-[9.5px] font-bold px-2 py-0.2 rounded-md flex items-center gap-0.5',
                              item.lentDetails?.isOverdue
                                ? 'bg-red-200 text-red-900'
                                : 'bg-amber-200 text-amber-900'
                            )}
                          >
                            <Handshake size={10} />
                            <span>
                              Prêté à {item.lentDetails?.borrower}
                              {item.lentDetails?.dueDate && ` (retour ${new Date(item.lentDetails.dueDate).toLocaleDateString('fr-FR')})`}
                            </span>
                          </span>
                        )}

                        {item.toAcquire && !item.inInventory && (
                          <span className="text-[9.5px] font-bold px-2 py-0.2 rounded-md bg-blue-100 text-blue-900 border border-blue-200 flex items-center gap-0.5">
                            <ShoppingBag size={10} />
                            <span>À acquérir / Boutique</span>
                          </span>
                        )}

                        {cond && (
                          <span className={cn('text-[9.5px] font-bold px-2 py-0.2 rounded-md', cond.tone)}>
                            {cond.label}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2 text-[11px] text-[#5A7064] pt-0.5">
                        <span>{item.category}</span>
                        {item.weightG > 0 && (
                          <>
                            <span>·</span>
                            <span className="font-mono">{formatWeight(item.weightG)}</span>
                          </>
                        )}
                        {item.priceEur !== null && (
                          <>
                            <span>·</span>
                            <span className="font-mono">{item.priceEur.toFixed(2)} €</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Actions contextuelles */}
                  <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                    {item.isLent && item.loanId && (
                      <button
                        type="button"
                        onClick={() => handleReturnLoan(item.loanId!, item.inventoryId)}
                        className="px-2.5 py-1.5 rounded-xl text-xs font-bold bg-[#17402C] text-white hover:bg-[#17402C]/90 shadow-2xs flex items-center gap-1 cursor-pointer"
                      >
                        <Check size={12} />
                        <span>Rendu</span>
                      </button>
                    )}

                    {item.inInventory && !item.isLent && (
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedItemForLoan(item);
                          setIsLoanModalOpen(true);
                        }}
                        className="px-2.5 py-1.5 rounded-xl text-xs font-semibold bg-white/80 hover:bg-white text-[#2D6B4A] border border-black/10 flex items-center gap-1 cursor-pointer"
                        title="Prêter à un contact"
                      >
                        <Handshake size={12} />
                        <span>Prêter</span>
                      </button>
                    )}

                    {!item.inBag && (
                      <button
                        type="button"
                        onClick={() => handleQuickAddToBag(item)}
                        className="px-2.5 py-1.5 rounded-xl text-xs font-bold bg-white/80 hover:bg-white text-[#17402C] border border-black/10 flex items-center gap-1 cursor-pointer"
                        title="Ajouter dans le sac de départ"
                      >
                        <Plus size={12} />
                        <span>Au sac</span>
                      </button>
                    )}

                    {!item.inInventory && item.toAcquire && (
                      <button
                        type="button"
                        onClick={() => handleMarkAsOwned(item)}
                        className="px-2 py-1.5 rounded-xl text-[11px] font-semibold bg-emerald-100 hover:bg-emerald-200 text-emerald-900 flex items-center gap-1 cursor-pointer"
                        title="J'ai déjà cet équipement chez moi"
                      >
                        <Check size={11} />
                        <span>Possédé</span>
                      </button>
                    )}

                    {item.slug && (
                      <Link
                        href={`/produit/${item.slug}`}
                        className="p-1.5 rounded-xl bg-white/80 hover:bg-white text-[#17402C] border border-black/10 flex items-center justify-center"
                        title="Voir fiche boutique"
                      >
                        <ExternalLink size={12} />
                      </Link>
                    )}

                    {item.inInventory && item.inventoryId && (
                      <button
                        type="button"
                        onClick={() => handleDeleteItem(item.inventoryId!)}
                        className="p-1.5 rounded-xl text-[#5A7064]/50 hover:text-red-600 hover:bg-red-50 cursor-pointer"
                        title="Supprimer de mon inventaire"
                      >
                        <Trash2 size={13} />
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Modal Ajout Objet */}
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

      {/* Modal Nouveau Prêt */}
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
    </GlassCard>
  );
}
