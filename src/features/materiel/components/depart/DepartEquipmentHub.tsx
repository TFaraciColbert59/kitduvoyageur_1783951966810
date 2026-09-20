'use client';
import Icon from '@/components/ui/Icon';
import React, { useState, useMemo } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { ShoppingBagIcon as ShoppingBag } from '@/components/icons/shopping-bag';
import { ListIcon as List } from '@/components/icons/list';
import { LayersIcon as Layers } from '@/components/icons/layers';
import { ArrowUpRightIcon as ArrowUpRight } from '@/components/icons/arrow-up-right';
import { BoxIcon as Boxes } from '@/components/icons/box';
import { ExternalLinkIcon as ExternalLink } from '@/components/icons/external-link';
import { CheckSquareIcon as CheckSquare } from '@/components/icons/check-square';
import { LayoutGridIcon as LayoutGridAnimated } from '@/components/icons/layout-grid';
import { RotateCCWIcon as RotateCcwAnimated } from '@/components/icons/rotate-ccw';
import { Badge, Button, Card, Chip, EmptyState, IconButton, Modal, SearchField, Tabs } from '@/components/ui';
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
  neuf: {
    label: 'Neuf',
    tone: 'bg-[var(--lkv-success)]/15 text-[var(--lkv-success)] border border-[var(--lkv-success)]/30',
  },
  tres_bon: {
    label: 'Très bon',
    tone: 'bg-[var(--lkv-success)]/15 text-[var(--lkv-success)] border border-[var(--lkv-success)]/30',
  },
  bon: {
    label: 'Bon',
    tone: 'bg-[var(--lkv-info)]/15 text-[var(--lkv-info)] border border-[var(--lkv-info)]/30',
  },
  moyen: {
    label: 'Usé',
    tone: 'bg-[var(--lkv-warning)]/15 text-[var(--lkv-warning)] border border-[var(--lkv-warning)]/30',
  },
  a_remplacer: {
    label: 'À remplacer',
    tone: 'bg-[var(--lkv-danger)]/15 text-[var(--lkv-danger)] border border-[var(--lkv-danger)]/30',
  },
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
  const [statusFilter, setStatusFilter] = useState<
    'all' | 'in_bag' | 'in_inventory' | 'lent' | 'to_acquire'
  >('all');
  const [selectedCat, setSelectedCat] = useState('Toutes');
  const [searchQuery, setSearchQuery] = useState('');
  const [mobileTab, setMobileTab] = useState<'catalog' | 'bag'>('catalog');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  React.useEffect(() => {
    const handleSwitch = (e: Event) => {
      const customEvent = e as CustomEvent<string>;
      if (customEvent.detail === 'bag' || customEvent.detail === 'catalog') {
        setMobileTab(customEvent.detail);
      }
    };
    if (typeof window !== 'undefined') {
      window.addEventListener('depart-switch-mobile-tab', handleSwitch);
    }
    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('depart-switch-mobile-tab', handleSwitch);
      }
    };
  }, []);

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
    const normalize = (s: string) =>
      s
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]/g, '');

    // 1. Inventaire utilisateur
    for (const inv of inventoryList) {
      const normName = normalize(inv.name);
      const activeLoan = loanList.find(
        (l) =>
          l.product_ownership_id === inv.id && (l.status === 'en_cours' || l.status === 'en_retard')
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
      quantity: 1,
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
      prev.map((l) =>
        l.id === loanId ? { ...l, status: 'rendu', returned_at: new Date().toISOString() } : l
      )
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
          quantity: 1,
        },
        ...prev,
      ]);
    }
  };

  return (
    <div className="w-full space-y-4 font-sans">
      {/* ════ BASCULE MOBILE (Segmented Control iOS) ════ */}
      <Tabs
        className="md:hidden"
        ariaLabel="Vue matériel"
        value={mobileTab}
        onChange={(id) => setMobileTab(id === 'bag' ? 'bag' : 'catalog')}
        options={[
          {
            id: 'catalog',
            label: `Parc Matériel (${filteredItems.length})`,
            icon: <Boxes size={14} />,
          },
          {
            id: 'bag',
            label: `Sac Actif (${kitItems.filter((i) => i.is_checked).length}/${kitItems.length})`,
            icon: <CheckSquare size={14} />,
          },
        ]}
      />

      {/* ════ CONTENU DU PARC MATÉRIEL (Plein format sur Desktop, avec bascule sur Mobile) ════ */}
      <div className="w-full space-y-4">
        {/* Vue Mobile "Sac Actif" */}
        <div
          className={cn('w-full min-h-[480px]', mobileTab === 'bag' ? 'block md:hidden' : 'hidden')}
        >
          <DepartChecklist
            items={kitItems}
            consumables={consumables}
            participants={participants}
            kitId={kitId}
            isRealKit={isRealKit}
          />
        </div>

        {/* Vue Catalogue & Poids (Plein format Desktop, masqué sur mobile quand l'onglet sac est actif) */}
        <div
          className={cn(
            'space-y-4 min-w-0 w-full',
            mobileTab === 'bag' ? 'hidden md:block' : 'block'
          )}
        >
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

          <Card className="space-y-2.5 p-3 sm:space-y-3.5 sm:p-5">
            {/* Top Header Compact Apple */}
            <div className="flex items-center justify-between gap-2 border-b border-black/5 pb-2">
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-7 h-7 rounded-xl bg-[var(--lkv-primary-hover)]/10 border border-[var(--lkv-primary-hover)]/20 flex items-center justify-center text-[var(--lkv-primary-hover)] shadow-2xs shrink-0">
                  <Boxes size={14} aria-hidden="true" />
                </div>
                <div className="min-w-0">
                  <h2 className="text-xs sm:text-sm font-bold text-[var(--lkv-primary)] tracking-tight truncate">
                    Parc Matériel & Équipements
                  </h2>
                </div>
              </div>

              <Button
                size="sm"
                onClick={() => setIsAddModalOpen(true)}
                icon={<Icon name="plus" size={12} />}
                className="h-7 shrink-0 rounded-xl px-2.5 text-[11px]"
              >
                Ajouter
              </Button>
            </div>

            {/* Barre de recherche & Bascule Grille / Liste */}
            <div className="flex items-center gap-2">
              <SearchField
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onClear={() => setSearchQuery('')}
                placeholder="Rechercher un équipement..."
                className="text-xs"
                containerClassName="h-8 flex-1"
              />

              {/* Bascule Grille 2 colonnes / Liste */}
              <div className="flex shrink-0 items-center gap-0.5 rounded-xl bg-black/5 p-0.5">
                <IconButton
                  size="sm"
                  onClick={() => setViewMode('grid')}
                  className={cn(
                    'h-7 w-7 rounded-lg',
                    viewMode === 'grid'
                      ? 'bg-[var(--lkv-primary)] text-white shadow-2xs'
                      : 'text-[var(--lkv-text-muted)] hover:text-[var(--lkv-primary)]'
                  )}
                  title="Vue Grille 3 colonnes"
                  aria-label="Vue Grille"
                  aria-pressed={viewMode === 'grid'}
                >
                  <LayoutGridAnimated size={13} />
                </IconButton>
                <IconButton
                  size="sm"
                  onClick={() => setViewMode('list')}
                  className={cn(
                    'h-7 w-7 rounded-lg',
                    viewMode === 'list'
                      ? 'bg-[var(--lkv-primary)] text-white shadow-2xs'
                      : 'text-[var(--lkv-text-muted)] hover:text-[var(--lkv-primary)]'
                  )}
                  title="Vue Liste compacte"
                  aria-label="Vue Liste"
                  aria-pressed={viewMode === 'list'}
                >
                  <List size={13} />
                </IconButton>
              </div>
            </div>

            {/* Filtres de statuts & Catégories (Défilement Horizontal Unique) */}
            <div className="no-scrollbar flex items-center gap-1.5 overflow-x-auto pb-0.5">
              <Chip
                selected={statusFilter === 'all'}
                onClick={() => setStatusFilter('all')}
                className="shrink-0 whitespace-nowrap"
              >
                Tous ({stats.totalCount})
              </Chip>
              <Chip
                selected={statusFilter === 'in_bag'}
                onClick={() => setStatusFilter('in_bag')}
                className="shrink-0 whitespace-nowrap"
              >
                Au sac ({stats.inBagCount})
              </Chip>
              <Chip
                selected={statusFilter === 'in_inventory'}
                onClick={() => setStatusFilter('in_inventory')}
                className="shrink-0 whitespace-nowrap"
              >
                Inventaire ({stats.inInventoryCount})
              </Chip>

              <div className="mx-0.5 h-4 w-px shrink-0 bg-black/10" />

              {CATEGORIES.filter((c) => c !== 'Toutes').map((cat) => (
                <Chip
                  key={cat}
                  selected={selectedCat === cat}
                  onClick={() => setSelectedCat(selectedCat === cat ? 'Toutes' : cat)}
                  className="shrink-0 whitespace-nowrap"
                >
                  {cat}
                </Chip>
              ))}
            </div>

            {/* ════ CATALOGUE : VUE GRILLE OU LISTE ════ */}
            {filteredItems.length === 0 ? (
              <EmptyState
                compact
                icon={<Boxes size={24} className="text-[var(--lkv-text-muted)]/60" />}
                title="Aucun équipement ne correspond à vos filtres."
              />
            ) : viewMode === 'grid' ? (
              /* ════ VUE GRILLE 3 COLONNES (Apple Store / Photos Style) ════ */
              <div className="grid grid-cols-3 gap-2 sm:gap-3 pr-0.5">
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

                  // Seules les fiches produit opérationnelles sont cliquables
                  // (/produit/<slug>). Pas de fallback recherche inventaire/boutique.
                  const targetUrl = item.slug ? `/produit/${item.slug}` : null;

                  return (
                    <div
                      key={item.id}
                      className={cn(
                        'group rounded-2xl overflow-hidden border transition-all duration-200 flex flex-col justify-between shadow-2xs hover:shadow-md backdrop-blur-md active:scale-[0.98]',
                        item.isLent
                          ? 'bg-[var(--lkv-warning)]/10 border-[var(--lkv-warning)]/30 text-[var(--lkv-warning)]'
                          : isItemInBag
                            ? 'bg-[var(--lkv-success)]/10 border-[var(--lkv-success)]/30 text-[var(--lkv-primary)]'
                            : 'bg-white/85 border-white/80 text-[var(--lkv-primary)]'
                      )}
                    >
                      {/* Image — cliquable uniquement si fiche produit opérationnelle */}
                      {targetUrl ? (
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
                      ) : (
                        <div className="relative w-full aspect-[4/3] overflow-hidden bg-black/5 rounded-t-2xl block group/img">
                          <img
                            src={item.image}
                            alt={item.name}
                            className="w-full h-full object-cover object-center"
                            loading="lazy"
                          />
                          <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-black/20 pointer-events-none" />
                          <span className="absolute top-1.5 left-1.5 text-[8px] sm:text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-md bg-black/60 text-white backdrop-blur-md shadow-xs">
                            {item.category}
                          </span>
                        </div>
                      )}

                      {/* Contenu de la Carte */}
                      <div className="p-2 sm:p-2.5 space-y-1.5 flex-1 flex flex-col justify-between">
                        <div className="space-y-0.5">
                          {targetUrl ? (
                            <Link
                              href={targetUrl}
                              className="text-[11.5px] sm:text-xs font-bold text-[var(--lkv-primary)] hover:text-[var(--lkv-primary-hover)] transition-colors leading-snug line-clamp-1 block cursor-pointer"
                              title={item.name}
                            >
                              {item.name}
                            </Link>
                          ) : (
                            <span
                              className="text-[11.5px] sm:text-xs font-bold text-[var(--lkv-primary)] leading-snug line-clamp-1 block"
                              title={item.name}
                            >
                              {item.name}
                            </span>
                          )}
                          <div className="flex items-center justify-between text-[10px] font-mono text-[var(--lkv-text-muted)]">
                            <span>{formatWeight(item.weightG)}</span>
                            {item.brand && (
                              <span className="truncate max-w-[70px]">{item.brand}</span>
                            )}
                          </div>
                        </div>

                        {/* Bouton d'Action 1-tap Compact */}
                        <div className="pt-1 border-t border-black/5">
                          {item.isLent && item.loanId ? (
                            <Button
                              size="sm"
                              fullWidth
                              onClick={() => handleReturnLoan(item.loanId!, item.inventoryId)}
                              icon={<Icon name="check" size={11} />}
                              className="h-7 rounded-xl px-1 text-[10.5px]"
                            >
                              Rendu
                            </Button>
                          ) : isConsumable ? (
                            <Button
                              size="sm"
                              fullWidth
                              onClick={() => handleReplenishConsumable(item)}
                              icon={<RotateCcwAnimated size={11} />}
                              className="h-7 rounded-xl px-1 text-[10.5px]"
                            >
                              Recharger
                            </Button>
                          ) : isItemInBag ? (
                            <Badge tone="sage" className="w-full justify-center gap-1 py-1 text-[10.5px] font-bold">
                              <Icon name="check" size={11} />
                              Dans le sac
                            </Badge>
                          ) : (
                            <Button
                              size="sm"
                              fullWidth
                              onClick={() => handleQuickAddToBag(item)}
                              icon={<Icon name="plus" size={11} />}
                              className="h-7 rounded-xl px-1 text-[10.5px]"
                            >
                              + Au sac
                            </Button>
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
                  const listTargetUrl = item.slug ? `/produit/${item.slug}` : null;

                  return (
                    <div
                      key={item.id}
                      className={cn(
                        'p-2 rounded-2xl border flex items-center justify-between gap-2.5 transition-all shadow-2xs active:scale-[0.98]',
                        isItemInBag
                          ? 'bg-[var(--lkv-success)]/10 border-[var(--lkv-success)]/30'
                          : 'border-[color:var(--lkv-border-subtle)] bg-[color:var(--lkv-surface-card)]'
                      )}
                    >
                      <div className="flex items-center gap-2.5 min-w-0 flex-1">
                        {listTargetUrl ? (
                          <Link
                            href={listTargetUrl}
                            title={`Voir la fiche détaillée de ${item.name}`}
                            className="w-10 h-10 rounded-xl overflow-hidden shrink-0 bg-black/5 block cursor-pointer"
                          >
                            <img
                              src={item.image}
                              alt={item.name}
                              className="w-full h-full object-cover"
                              loading="lazy"
                            />
                          </Link>
                        ) : (
                          <img
                            src={item.image}
                            alt={item.name}
                            className="w-10 h-10 rounded-xl object-cover shrink-0 bg-black/5"
                            loading="lazy"
                          />
                        )}
                        <div className="min-w-0 flex-1">
                          {listTargetUrl ? (
                            <Link
                              href={listTargetUrl}
                              title={item.name}
                              className="text-xs font-bold text-[var(--lkv-primary)] truncate hover:text-[var(--lkv-primary-hover)] transition-colors block cursor-pointer"
                            >
                              {item.name}
                            </Link>
                          ) : (
                            <h4 className="text-xs font-bold text-[var(--lkv-primary)] truncate">
                              {item.name}
                            </h4>
                          )}
                          <div className="flex items-center gap-2 text-[10.5px] font-mono text-[var(--lkv-text-muted)] mt-0.5">
                            <span>{formatWeight(item.weightG)}</span>
                            <span className="text-[9px] font-sans px-1.5 py-0.2 rounded bg-black/5">
                              {item.category}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="shrink-0">
                        {isItemInBag ? (
                          <Badge tone="sage" className="gap-1 py-1 text-[10.5px] font-bold">
                            <Icon name="check" size={11} />
                            Dans le sac
                          </Badge>
                        ) : (
                          <Button
                            size="sm"
                            onClick={() => handleQuickAddToBag(item)}
                            icon={<Icon name="plus" size={11} />}
                            className="h-7 rounded-xl px-2.5 text-[10.5px]"
                          >
                            + Sac
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
        </div>
      </div>

      {/* ════ MODALE AJOUT ÉQUIPEMENT ════ */}
      <Modal
        open={isAddModalOpen}
        onOpenChange={setIsAddModalOpen}
        title="Ajouter un Équipement"
        size="md"
      >
        <form onSubmit={handleAddItem} className="space-y-3.5">
                <div>
                  <label className="text-[11px] font-bold uppercase tracking-wider text-[var(--lkv-text-muted)] block mb-1">
                    Nom de l’équipement *
                  </label>
                  <input
                    type="text"
                    required
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="Ex: Tente Big Agnes Copper Spur 2P"
                    className="w-full px-3.5 py-2.5 rounded-xl text-xs bg-black/5 border border-black/10 text-[var(--lkv-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--lkv-primary)]/30"
                    autoFocus
                  />
                </div>

                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <label className="text-[11px] font-bold uppercase tracking-wider text-[var(--lkv-text-muted)] block mb-1">
                      Marque
                    </label>
                    <input
                      type="text"
                      value={newBrand}
                      onChange={(e) => setNewBrand(e.target.value)}
                      placeholder="Ex: MSR, Sea to Summit..."
                      className="w-full px-3 py-2 rounded-xl text-xs bg-black/5 border border-black/10 text-[var(--lkv-primary)]"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-bold uppercase tracking-wider text-[var(--lkv-text-muted)] block mb-1">
                      Catégorie
                    </label>
                    <select
                      value={newCategory}
                      onChange={(e) => setNewCategory(e.target.value)}
                      className="w-full px-2.5 py-2 rounded-xl text-xs bg-black/5 border border-black/10 text-[var(--lkv-primary)]"
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
                    <label className="text-[11px] font-bold uppercase tracking-wider text-[var(--lkv-text-muted)] block mb-1">
                      Poids (g)
                    </label>
                    <input
                      type="number"
                      min={0}
                      value={newWeight}
                      onChange={(e) => setNewWeight(Number(e.target.value))}
                      className="w-full px-2.5 py-2 rounded-xl text-xs bg-black/5 border border-black/10 text-[var(--lkv-primary)]"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-bold uppercase tracking-wider text-[var(--lkv-text-muted)] block mb-1">
                      État
                    </label>
                    <select
                      value={newCondition}
                      onChange={(e) => setNewCondition(e.target.value)}
                      className="w-full px-2 py-2 rounded-xl text-xs bg-black/5 border border-black/10 text-[var(--lkv-primary)]"
                    >
                      <option value="neuf">Neuf</option>
                      <option value="tres_bon">Très bon</option>
                      <option value="bon">Bon</option>
                      <option value="moyen">Usé</option>
                      <option value="a_remplacer">À remplacer</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-[11px] font-bold uppercase tracking-wider text-[var(--lkv-text-muted)] block mb-1">
                      Prix (€)
                    </label>
                    <input
                      type="number"
                      min={0}
                      value={newPriceEur}
                      onChange={(e) => setNewPriceEur(e.target.value ? Number(e.target.value) : '')}
                      placeholder="Ex: 180"
                      className="w-full px-2.5 py-2 rounded-xl text-xs bg-black/5 border border-black/10 text-[var(--lkv-primary)]"
                    />
                  </div>
                </div>

                <div className="pt-2 flex items-center justify-end gap-2">
                  <Button variant="ghost" onClick={() => setIsAddModalOpen(false)}>
                    Annuler
                  </Button>
                  <Button type="submit">Enregistrer</Button>
                </div>
              </form>
      </Modal>

      {/* ════ MODALE PRÊT ════ */}
      <Modal
        open={isLoanModalOpen && Boolean(selectedItemForLoan)}
        onOpenChange={setIsLoanModalOpen}
        title="Prêter un Équipement"
        size="md"
      >
        {selectedItemForLoan && (
          <>
              <div className="p-3 rounded-2xl bg-black/5 text-xs font-semibold flex items-center gap-2">
                <Boxes size={14} className="text-[var(--lkv-primary-hover)]" />
                <span>
                  Objet : <strong>{selectedItemForLoan.name}</strong>
                </span>
              </div>

              <form onSubmit={handleCreateLoan} className="space-y-3.5">
                <div>
                  <label className="text-[11px] font-bold uppercase tracking-wider text-[var(--lkv-text-muted)] block mb-1">
                    Nom ou contact de l’emprunteur *
                  </label>
                  <input
                    type="text"
                    required
                    value={borrowerContact}
                    onChange={(e) => setBorrowerContact(e.target.value)}
                    placeholder="Ex: Thomas (+33 6 12 34 56 78)"
                    className="w-full px-3.5 py-2.5 rounded-xl text-xs bg-black/5 border border-black/10 text-[var(--lkv-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--lkv-primary)]/30"
                    autoFocus
                  />
                </div>

                <div>
                  <label className="text-[11px] font-bold uppercase tracking-wider text-[var(--lkv-text-muted)] block mb-1">
                    Date de retour prévue (optionnel)
                  </label>
                  <input
                    type="date"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl text-xs bg-black/5 border border-black/10 text-[var(--lkv-primary)]"
                  />
                </div>

                <div className="pt-2 flex items-center justify-end gap-2">
                  <Button variant="ghost" onClick={() => setIsLoanModalOpen(false)}>
                    Annuler
                  </Button>
                  <Button type="submit">Confirmer le prêt</Button>
                </div>
              </form>
          </>
        )}
      </Modal>
    </div>
  );
}
