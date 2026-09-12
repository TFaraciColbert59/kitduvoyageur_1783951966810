'use client';

import Icon from '@/components/ui/Icon';
import { useMemo, useState, useTransition, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useVirtualizer } from '@tanstack/react-virtual';
import Link from 'next/link';
import { GlassCard } from '@/components/ui/GlassCard';
import { GlassCapsuleBtn } from '@/components/ui/GlassCapsuleBtn';
import { GlassModal } from '@/components/ui/GlassModal';
import { EmptyState } from '@/components/ui/EmptyState';
import { CheckCircle2, Circle, PackagePlus, Pencil, Plus, X } from 'lucide-react';
import type { TripFull, TripItem } from '../types/trip.types';
import type { TripKitAnalysis, ShopProductReference } from '../types/kit.types';
import type { InventoryItem } from '@/features/materiel/services/getInventory';
import { cleanItemName } from '@/lib/cleanItemName';
import { useHapticFeedback } from '@/hooks/useHapticFeedback';
import { classifyKitCompleteness } from '../engine/kitCompletenessEngine';
import {
  addCustomTripItemAction,
  deleteTripItemAction,
  addInventoryItemToTripAction,
  togglePackedAction,
  updateTripItemDetailsAction,
} from '@/app/voyages/kit-actions';

export interface TripItemImageRef {
  itemId: string;
  url: string | null;
}

export interface TripKitViewProps {
  trip: TripFull;
  analysis: TripKitAnalysis;
  showBackLink?: boolean;
  /** Boutique : produits candidats (hors sac) — affichés en premier, consommables prioritaires. */
  availableProducts?: ShopProductReference[];
  /** Images réelles des items du sac (trip_items → shop_products / product_ownership). */
  itemImages?: TripItemImageRef[];
  /** Inventaire personnel (product_ownership) — état possédé + stock. */
  inventoryItems?: InventoryItem[];
}

type InventoryCategory =
  | 'Sacs & Portage'
  | 'Couchage & Tentes'
  | 'Vêtements & Vestes'
  | 'Cuisine & Réchauds'
  | 'Eau & Filtres'
  | 'Lampes & Éclairage'
  | 'Navigation & GPS'
  | 'Sécurité & Soins'
  | 'Accessoires & Outils'
  | 'Autre';

function mapInventoryCategory(value: string | null | undefined): InventoryCategory {
  const v = (value ?? '').toLowerCase();
  if (/sac|portage|bag/.test(v)) return 'Sacs & Portage';
  if (/couchage|tente|bivouac|sommeil|matelas|duvet/.test(v)) return 'Couchage & Tentes';
  if (/vêtement|vetement|textile|protection|veste/.test(v)) return 'Vêtements & Vestes';
  if (/cuisine|réchaud|rechaud|gaz|popote|nutrition|repas|vivre/.test(v)) return 'Cuisine & Réchauds';
  if (/eau|hydrat|filtre/.test(v)) return 'Eau & Filtres';
  if (/lampe|éclairage|eclairage|pile|batterie|énergie|energie|électro|electro/.test(v))
    return 'Lampes & Éclairage';
  if (/navigation|gps|boussole|carte/.test(v)) return 'Navigation & GPS';
  if (/sécur|secur|urgence|soin|premiers secours/.test(v)) return 'Sécurité & Soins';
  if (/outil|accessoire|couteau|bâton|baton/.test(v)) return 'Accessoires & Outils';
  return 'Autre';
}

export function TripKitView({
  trip,
  analysis,
  showBackLink: _showBackLink = false,
  availableProducts = [],
  itemImages = [],
  inventoryItems = [],
}: TripKitViewProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [optimisticItems, setOptimisticItems] = useState<TripItem[]>(trip.items || []);
  const [infoToast, setInfoToast] = useState<string | null>(null);
  const [ownedProducts, setOwnedProducts] = useState<InventoryItem[]>([]);
  const [busyRowKey, setBusyRowKey] = useState<string | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState<boolean>(false);
  const [showAllSuggestions, setShowAllSuggestions] = useState<boolean>(false);
  const [isInventoryModalOpen, setIsInventoryModalOpen] = useState<boolean>(false);
  const [userInventory, setUserInventory] = useState<any[]>([]);
  const [isLoadingInventory, setIsLoadingInventory] = useState<boolean>(false);
  const [inventorySearch, setInventorySearch] = useState<string>('');
  const [editingItem, setEditingItem] = useState<TripItem | null>(null);
  const [editError, setEditError] = useState<string | null>(null);
  const [busyPackedId, setBusyPackedId] = useState<string | null>(null);
  const { triggerHaptic } = useHapticFeedback();

  // Phase 5 — complétude du kit : personnel / partagé / manquant + poids connus.
  const completeness = useMemo(
    () => classifyKitCompleteness(optimisticItems),
    [optimisticItems]
  );

  const collaboratorsById = useMemo(
    () =>
      new Map(
        (trip.collaborators || []).map((collab) => [
          collab.user_id,
          collab.profile?.full_name || collab.profile?.username || 'Voyageur',
        ])
      ),
    [trip.collaborators]
  );

  const ownerLabel = (ownerId: string | null | undefined): string | null => {
    if (!ownerId) return null;
    if (ownerId === trip.user_id) return 'Vous';
    return collaboratorsById.get(ownerId) ?? 'Voyageur';
  };

  const handleTogglePacked = (item: TripItem) => {
    triggerHaptic('selection');
    const nextPacked = !item.is_packed;
    setBusyPackedId(item.id);
    setOptimisticItems((prev) =>
      prev.map((entry) =>
        entry.id === item.id
          ? { ...entry, is_packed: nextPacked, status: nextPacked ? 'packed' : 'needed' }
          : entry
      )
    );
    startTransition(async () => {
      const res = await togglePackedAction(item.id, nextPacked, trip.slug);
      if (!res.success) {
        setOptimisticItems((prev) =>
          prev.map((entry) =>
            entry.id === item.id
              ? { ...entry, is_packed: item.is_packed, status: item.status }
              : entry
          )
        );
        setInfoToast(res.error ?? 'Impossible de modifier le statut');
        setTimeout(() => setInfoToast(null), 3500);
      }
      setBusyPackedId(null);
    });
  };

  const handleUpdateItem = async (input: {
    quantity: number;
    weightGrams: number | null;
    ownership: 'personal' | 'shared';
    condition: 'neuf' | 'bon' | 'use' | 'a_remplacer' | 'pour_pieces' | null;
    ownerId: string | null;
    priority: 'vital' | 'recommended' | 'optional';
  }) => {
    if (!editingItem) return;
    const target = editingItem;
    setEditError(null);
    setOptimisticItems((prev) =>
      prev.map((entry) =>
        entry.id === target.id
          ? {
              ...entry,
              quantity: input.quantity,
              weight_grams: input.weightGrams,
              ownership: input.ownership,
              condition: input.condition,
              owner_id: input.ownerId,
              priority: input.priority,
              is_vital: input.priority === 'vital',
            }
          : entry
      )
    );
    const res = await updateTripItemDetailsAction({
      tripId: trip.id,
      tripSlug: trip.slug,
      itemId: target.id,
      quantity: input.quantity,
      weightGrams: input.weightGrams,
      ownership: input.ownership,
      condition: input.condition,
      ownerId: input.ownerId,
      priority: input.priority,
      isVital: input.priority === 'vital',
    });
    if (!res.success) {
      setOptimisticItems((prev) =>
        prev.map((entry) => (entry.id === target.id ? target : entry))
      );
      setEditError(res.error ?? 'Modification impossible');
      return;
    }
    setEditingItem(null);
    router.refresh();
  };

  const handleOpenInventory = async () => {
    triggerHaptic('light');
    setIsInventoryModalOpen(true);
    if (userInventory.length === 0) {
      setIsLoadingInventory(true);
      try {
        const res = await fetch('/api/materiel/items');
        if (res.ok) {
          const json = await res.json();
          setUserInventory(json.items || []);
        }
      } catch (err) {
        console.error('Erreur chargement inventaire:', err);
      } finally {
        setIsLoadingInventory(false);
      }
    }
  };

  const handleImportFromInventory = (item: any) => {
    triggerHaptic('selection');
    const tempId = `inv-${item.id}-${Date.now()}`;
    const newItem: TripItem = {
      id: tempId,
      trip_id: trip.id,
      item_name: item.name,
      category: item.category || 'misc',
      weight_grams: item.weight_g || null,
      quantity: 1,
      is_packed: false,
      status: 'needed',
      priority: 'recommended',
      inventory_item_id: item.id,
      packed_by: null,
      affiliate_link_id: null,
      source: 'inventory',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    setOptimisticItems((prev) => [newItem, ...prev]);

    startTransition(async () => {
      const res = await addInventoryItemToTripAction(
        trip.id,
        trip.slug,
        item.id,
        item.name,
        item.category,
        item.weight_g
      );
      if (!res.success) {
        setOptimisticItems((prev) => prev.filter((i) => i.id !== tempId));
      }
    });
  };

  const filteredInventory = userInventory.filter((item: any) => {
    if (!inventorySearch.trim()) return true;
    const q = inventorySearch.toLowerCase();
    return (
      item.name?.toLowerCase().includes(q) ||
      item.brand?.toLowerCase().includes(q) ||
      item.category?.toLowerCase().includes(q)
    );
  });

  // Sac : non emballés d'abord (actionnable), puis ordre alphabétique.
  const filteredItems = [...optimisticItems].sort(
    (a, b) =>
      Number(a.is_packed) - Number(b.is_packed) ||
      cleanItemName(a.item_name).localeCompare(cleanItemName(b.item_name), 'fr')
  );

  const imageByItemId = new Map(itemImages.map((i) => [i.itemId, i.url] as const));
  const bagProductIds = new Set(
    optimisticItems.map((i) => (i as TripItem & { shop_product_id?: string | null }).shop_product_id).filter(Boolean)
  );
  const normalizeName = (value: string) =>
    value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/\(.*?\)/g, '')
      .replace(/[^a-z0-9]+/g, ' ')
      .trim();
  const bagNames = new Set(optimisticItems.map((i) => normalizeName(cleanItemName(i.item_name))));
  const CONSUMABLE_PATTERN = /vivre|eau|nutrition|hydrat|repas|ration|barre|en-cas|cuisine|gaz/i;
  const bagInventoryIds = new Set(
    optimisticItems
      .map((i) => i.inventory_item_id)
      .filter((value): value is string => Boolean(value))
  );
  const inventoryAll = [...inventoryItems, ...ownedProducts];
  const inventoryNameSet = new Set(inventoryAll.map((inv) => normalizeName(inv.name)));
  const isConsumableInventory = (inv: InventoryItem) =>
    CONSUMABLE_PATTERN.test(`${inv.category ?? ''} ${inv.name}`);

  // Boutique : consommables d'abord (ce qu'on rachète le plus), puis score boutique.
  const shopSuggestions = availableProducts
    .filter(
      (p) =>
        !bagProductIds.has(p.id) &&
        !bagNames.has(normalizeName(p.name)) &&
        !inventoryNameSet.has(normalizeName(p.name))
    )
    .sort((a, b) => {
      const aConsumable = CONSUMABLE_PATTERN.test(`${a.category_main} ${a.name}`) ? 0 : 1;
      const bConsumable = CONSUMABLE_PATTERN.test(`${b.category_main} ${b.name}`) ? 0 : 1;
      return aConsumable - bConsumable || (b.score_kdv ?? 0) - (a.score_kdv ?? 0);
    });

  // Inventaire possédé mais pas encore dans le sac → à transférer en priorité.
  const inventorySuggestions = inventoryAll
    .filter((inv) => !bagInventoryIds.has(inv.id) && !bagNames.has(normalizeName(inv.name)))
    .sort(
      (a, b) =>
        Number(isConsumableInventory(b)) - Number(isConsumableInventory(a)) ||
        a.name.localeCompare(b.name, 'fr')
    );

  const visibleShopSuggestions = showAllSuggestions ? shopSuggestions : shopSuggestions.slice(0, 6);
  const visibleInventorySuggestions = showAllSuggestions
    ? inventorySuggestions
    : inventorySuggestions.slice(0, 6);
  const addRowsCount = shopSuggestions.length + inventorySuggestions.length;

  const handleDeleteItem = (itemId: string) => {
    triggerHaptic('medium');
    setOptimisticItems((prev) => prev.filter((i) => i.id !== itemId));

    startTransition(async () => {
      await deleteTripItemAction(itemId, trip.slug);
    });
  };

  /** Bouton boîte-flèche : ajoute le produit boutique à Mon Matériel (inventaire). */
  const handleAddToInventory = async (product: ShopProductReference) => {
    triggerHaptic('selection');
    setBusyRowKey(`shop-${product.id}`);
    try {
      const res = await fetch('/api/materiel/items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: product.name,
          brand: product.brand || null,
          category: mapInventoryCategory(product.category_main),
          weight_g: Math.round(product.weight_g || 0),
          price_cents: Number.isFinite(product.price_eur) ? Math.round(product.price_eur * 100) : null,
          photo_url: product.image ?? null,
          condition: 'neuf',
          quantity: 1,
        }),
      });
      const json = (await res.json().catch(() => null)) as
        | { item?: Partial<InventoryItem>; error?: string }
        | null;
      if (!res.ok || !json?.item) {
        throw new Error(json?.error ?? 'Erreur lors de l’ajout au matériel');
      }
      const created = json.item;
      setOwnedProducts((prev) => [
        {
          id: String(created.id ?? product.id),
          name: String(created.name ?? product.name),
          brand: created.brand ?? product.brand ?? null,
          category: created.category ?? mapInventoryCategory(product.category_main),
          weight_g: created.weight_g ?? Math.round(product.weight_g || 0),
          price_cents: created.price_cents ?? null,
          condition: created.condition ?? 'neuf',
          photo_url: created.photo_url ?? product.image ?? null,
          is_lent: false,
          purchase_date: null,
          maintenance_due_at: null,
          expiry_date: null,
          tags: null,
          quantity: Number(created.quantity ?? 1),
        },
        ...prev,
      ]);
      setInfoToast(`« ${product.name} » ajouté à Mon Matériel`);
      setTimeout(() => setInfoToast(null), 3500);
      router.refresh();
    } catch (err) {
      console.error('Ajout au matériel:', err);
    } finally {
      setBusyRowKey(null);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Toast discret (ajout au matériel) */}
      {infoToast && (
        <div className="fixed bottom-24 left-1/2 z-50 -translate-x-1/2 rounded-full bg-lkv-primary px-4 py-2 text-xs font-bold text-white shadow-xl">
          {infoToast}
        </div>
      )}

      {/* Alertes de sécurité & climat */}
      {analysis.climateWarnings.length > 0 && (
        <div className="p-4 rounded-2xl bg-[var(--lkv-warning)]/10 border border-[var(--lkv-warning)]/20 text-text-primary text-xs sm:text-sm space-y-1.5">
          <div className="font-bold flex items-center gap-2 text-[var(--lkv-warning-dark)]">
            <Icon name="alert-triangle" className="w-4 h-4 shrink-0 text-[var(--lkv-warning-dark)]" />
            Conditions de terrain identifiées pour votre expédition
          </div>
          <ul className="list-disc list-inside space-y-0.5 pl-1 text-xs text-text-secondary">
            {analysis.climateWarnings.map((w, idx) => (
              <li key={idx}>{w}</li>
            ))}
          </ul>
        </div>
      )}

      {/* 2. Recommandations : fusionnées dans « Sac & inventaire » (boutique en tête de liste) */}

      {/* 3. Sac & inventaire : ce qu'on a + ce qu'on n'a pas (boutique en tête, consommables d'abord) */}
      <GlassCard
        tone="neutral"
        blur="md"
        className="p-5 rounded-3xl border border-white/70 shadow-sm space-y-4"
      >
        <div className="flex items-center justify-between gap-3">
          <h3 className="font-display text-lg font-black text-lkv-primary">
            Sac &amp; inventaire du voyage
          </h3>
          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={handleOpenInventory}
              aria-label="Importer depuis mon matériel"
              title="Importer depuis mon matériel"
              className="glass-sub-card flex h-11 w-11 items-center justify-center rounded-full text-lkv-secondary transition-transform active:scale-95"
            >
              <Icon name="package" className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => setIsAddModalOpen(true)}
              aria-label="Ajouter un objet"
              title="Ajouter un objet"
              className="flex h-11 w-11 items-center justify-center rounded-full bg-lkv-primary text-white transition-transform active:scale-95"
            >
              <Icon name="plus" className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Phase 5 — complétude réelle du kit : personnel / partagé / manquant */}
        <div className="flex flex-wrap items-center gap-2 text-[11px]">
          <span className="rounded-full border border-white/60 bg-white/70 px-2.5 py-1 font-semibold text-[var(--lkv-text-secondary)]">
            Personnel {completeness.summary.personalCount}
          </span>
          <span className="rounded-full border border-white/60 bg-white/70 px-2.5 py-1 font-semibold text-[var(--lkv-text-secondary)]">
            Partagé {completeness.summary.sharedCount}
          </span>
          {completeness.summary.missingCount > 0 && (
            <span className="rounded-full border border-[var(--lkv-warning)]/30 bg-[var(--lkv-warning)]/10 px-2.5 py-1 font-bold text-[var(--lkv-warning-dark)]">
              Manquant {completeness.summary.missingCount}
            </span>
          )}
          <span className="rounded-full border border-white/60 bg-white/70 px-2.5 py-1 font-semibold text-[var(--lkv-text-secondary)]">
            {completeness.summary.knownWeightGrams > 0
              ? `Poids connu ${(completeness.summary.knownWeightGrams / 1000).toFixed(2)} kg`
              : 'Poids non renseigné'}
          </span>
        </div>

        {/* Boutique : les plus achetés (consommables d'abord) → boîte-flèche vers Mon Matériel */}
        {visibleShopSuggestions.length > 0 && (
          <div className="space-y-1">
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--lkv-text-secondary)]">
              À ajouter · les plus achetés
            </p>
            <div className="divide-y divide-white/40">
              {visibleShopSuggestions.map((product) => (
                <GearShopAddRow
                  key={`shop-${product.id}`}
                  product={product}
                  busy={busyRowKey === `shop-${product.id}`}
                  onAddToInventory={handleAddToInventory}
                />
              ))}
            </div>
          </div>
        )}

        {/* Mon matériel : possédé, pas encore dans le sac → + pour l'ajouter */}
        {visibleInventorySuggestions.length > 0 && (
          <div className="space-y-1">
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--lkv-text-secondary)]">
              Dans mon matériel · à mettre au sac
            </p>
            <div className="divide-y divide-white/40">
              {visibleInventorySuggestions.map((inv) => (
                <GearInventoryAddRow
                  key={`inv-${inv.id}`}
                  inv={inv}
                  busy={isPending}
                  onAdd={handleImportFromInventory}
                />
              ))}
            </div>
          </div>
        )}

        {addRowsCount > 12 && (
          <button
            type="button"
            onClick={() => setShowAllSuggestions((value) => !value)}
            className="w-full pt-1 text-center text-xs font-semibold text-lkv-primary transition-opacity active:opacity-70"
          >
            {showAllSuggestions ? 'Voir moins' : `Voir plus d’idées (${addRowsCount})`}
          </button>
        )}

        {/* Mon sac */}
        {filteredItems.length === 0 ? (
          <EmptyState
            icon={<Icon name="package" className="w-8 h-8 text-[var(--lkv-text-muted)]" />}
            title="Votre sac est vide"
            description="Ajoutez du matériel depuis les idées ci-dessus ou créez votre propre objet."
            actionLabel="+ Ajouter un équipement"
            onAction={() => setIsAddModalOpen(true)}
          />
        ) : filteredItems.length > 50 ? (
          <VirtualTripKitItemList
            items={filteredItems}
            imageByItemId={imageByItemId}
            onDeleteItem={handleDeleteItem}
            onTogglePacked={handleTogglePacked}
            onEdit={setEditingItem}
            busyPackedId={busyPackedId}
            canEdit={trip.permissions.canEdit}
          />
        ) : (
          <div className="divide-y divide-white/40">
            {filteredItems.map((item) => (
              <TripKitItemRow
                key={item.id}
                item={item}
                imageUrl={imageByItemId.get(item.id) ?? null}
                onDeleteItem={handleDeleteItem}
                onTogglePacked={handleTogglePacked}
                onEdit={setEditingItem}
                busyPacked={busyPackedId === item.id}
                ownerLabel={ownerLabel(item.owner_id)}
                canEdit={trip.permissions.canEdit}
              />
            ))}
          </div>
        )}
      </GlassCard>

      {/* Modal Ajout Rapide d'Équipement */}
      <GlassModal
        open={isAddModalOpen}
        onOpenChange={setIsAddModalOpen}
        title="Ajouter un équipement au sac"
        variant="sheet"
      >
        <div className="pb-2">
          <form
            action={(formData) => {
              startTransition(async () => {
                await addCustomTripItemAction(trip.id, trip.slug, formData);
                setIsAddModalOpen(false);
              });
            }}
            className="space-y-4"
          >
            <div>
              <label className="block text-xs font-semibold text-[var(--lkv-text-primary)] mb-1">
                Nom de l’équipement *
              </label>
              <input
                name="itemName"
                required
                placeholder="ex: Sac de couchage 0°C, Lunettes..."
                className="glass-input w-full px-3 py-2 text-sm text-[var(--lkv-text-primary)]"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-[var(--lkv-text-primary)] mb-1">
                  Catégorie
                </label>
                <select
                  name="category"
                  className="w-full px-3 py-2 text-sm rounded-[var(--lkv-radius-md)] border border-white/60 bg-white/70 backdrop-blur-md text-[var(--lkv-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--lkv-primary)]/20 shadow-2xs cursor-pointer"
                >
                  <option value="safety">Sécurité & Secours</option>
                  <option value="shelter">Abri & Tente</option>
                  <option value="sleep">Sommeil</option>
                  <option value="clothing">Vêtements</option>
                  <option value="cook">Cuisine</option>
                  <option value="water">Hydratation</option>
                  <option value="tech">Énergie & Tech</option>
                  <option value="misc">Matériel divers</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[var(--lkv-text-primary)] mb-1">
                  Poids (grammes)
                </label>
                <input
                  type="number"
                  name="weightGrams"
                  placeholder="ex: 450"
                  min={0}
                  className="glass-input w-full px-3 py-2 text-sm text-[var(--lkv-text-primary)]"
                />
              </div>
            </div>

            <div className="space-y-2 pt-2 text-xs text-[var(--lkv-text-muted)]">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" name="isVital" value="true" className="rounded" />
                <span>Équipement vital pour la sécurité ou survie</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" name="isWorn" value="true" className="rounded" />
                <span>Porté sur soi (exclu du poids de base du sac)</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" name="isConsumable" value="true" className="rounded" />
                <span>Consommable (eau, vivres, gaz)</span>
              </label>
            </div>

            <div className="flex items-center justify-end gap-3 pt-4 border-t border-white/40">
              <GlassCapsuleBtn
                type="button"
                variant="default"
                size="sm"
                onClick={() => setIsAddModalOpen(false)}
              >
                Annuler
              </GlassCapsuleBtn>
              <GlassCapsuleBtn type="submit" variant="primary" size="sm" disabled={isPending}>
                Ajouter au sac
              </GlassCapsuleBtn>
            </div>
          </form>
        </div>
      </GlassModal>

      {/* Modal Sélecteur d'inventaire personnel (Y6.3 — Pont matériel) */}
      <GlassModal
        open={isInventoryModalOpen}
        onOpenChange={setIsInventoryModalOpen}
        title="Importer depuis Mon Matériel"
        variant="sheet"
        hideTitle
      >
        <div className="pb-2">
          <div className="flex items-center gap-2 mb-1">
            <Icon
              name="package"
              className="w-5 h-5 text-lkv-secondary shrink-0"
              aria-hidden="true"
            />
            <h3 className="text-base font-bold text-[var(--lkv-text-primary)]">
              Importer depuis Mon Matériel
            </h3>
          </div>

          {/* Règle Y6.3 : Le stock n'est jamais consommé ni altéré */}
          <div className="mt-3 p-3 rounded-xl bg-white/70 border border-white/60 text-xs text-[var(--lkv-text-secondary)] flex items-center gap-2 shrink-0">
            <span className="text-base shrink-0">ℹ️</span>
            <span>
              Votre inventaire personnel reste intact — votre matériel est simplement référencé pour
              cette aventure sans décompte de stock.
            </span>
          </div>

          {/* Barre de recherche */}
          <div className="mt-3 shrink-0">
            <input
              className="glass-input w-full px-3 py-2 text-xs text-[var(--lkv-text-primary)]"
              type="text"
              placeholder="Rechercher dans mon matériel (nom, marque)..."
              value={inventorySearch}
              onChange={(e) => setInventorySearch(e.target.value)}
            />
          </div>

          {/* Liste scrollable */}
          <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar my-4 divide-y divide-white/40 pr-1">
            {isLoadingInventory ? (
              <div className="py-12 flex flex-col items-center justify-center gap-3">
                <div className="w-6 h-6 border-2 border-lkv-primary border-t-transparent rounded-full animate-spin" />
                <span className="text-xs text-[var(--lkv-text-muted)]">
                  Chargement de votre matériel...
                </span>
              </div>
            ) : filteredInventory.length === 0 ? (
              <div className="py-12 text-center text-xs text-[var(--lkv-text-muted)]">
                {userInventory.length === 0 ? (
                  <div className="space-y-3">
                    <p>Aucun équipement trouvé dans votre inventaire personnel.</p>
                    <Link
                      href="/hub"
                      className="inline-block glass-capsule-btn text-xs font-bold px-4 py-2"
                    >
                      Gérer mon matériel →
                    </Link>
                  </div>
                ) : (
                  <p>Aucun équipement ne correspond à votre recherche.</p>
                )}
              </div>
            ) : (
              filteredInventory.map((item: any) => {
                const isAlreadyInTrip = optimisticItems.some(
                  (i) =>
                    i.inventory_item_id === item.id ||
                    (i.item_name.toLowerCase() === item.name.toLowerCase() &&
                      i.source === 'inventory')
                );

                return (
                  <div key={item.id} className="py-3 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-[var(--lkv-text-primary)] truncate">
                        {item.name}
                      </p>
                      <div className="flex items-center gap-2 text-[11px] text-[var(--lkv-text-muted)] mt-0.5">
                        {item.brand && <span>{item.brand}</span>}
                        {item.category && <span>· {item.category}</span>}
                        {item.weight_g > 0 && <span>· {item.weight_g} g</span>}
                      </div>
                    </div>

                    <div className="shrink-0">
                      {isAlreadyInTrip ? (
                        <span className="text-[11px] font-mono text-[var(--lkv-text-muted)] bg-white/80 px-2.5 py-1 rounded-full border border-white/60">
                          ✓ Dans le sac
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleImportFromInventory(item)}
                          disabled={isPending}
                          className="glass-capsule-btn primary text-xs font-bold !py-1.5 !px-3 shadow-2xs min-h-[44px] flex items-center cursor-pointer"
                        >
                          + Dans mon sac
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Pied de modale */}
          <div className="pt-3 border-t border-white/40 flex items-center justify-between shrink-0">
            <Link href="/hub" className="text-xs text-lkv-secondary hover:underline font-medium">
              Ouvrir l'inventaire complet →
            </Link>
          </div>
        </div>
      </GlassModal>

      {/* Phase 5 — édition complète d'un item (poids, quantité, partage, état, propriétaire) */}
      <TripKitEditModal
        key={editingItem?.id ?? 'kit-edit'}
        item={editingItem}
        error={editError}
        currentUserId={trip.user_id}
        collaborators={trip.collaborators || []}
        onOpenChange={(open) => {
          if (!open) {
            setEditingItem(null);
            setEditError(null);
          }
        }}
        onSubmit={handleUpdateItem}
      />
    </div>
  );
}

interface TripKitEditModalProps {
  item: TripItem | null;
  error: string | null;
  currentUserId: string;
  collaborators: TripFull['collaborators'];
  onOpenChange: (open: boolean) => void;
  onSubmit: (input: {
    quantity: number;
    weightGrams: number | null;
    ownership: 'personal' | 'shared';
    condition: 'neuf' | 'bon' | 'use' | 'a_remplacer' | 'pour_pieces' | null;
    ownerId: string | null;
    priority: 'vital' | 'recommended' | 'optional';
  }) => Promise<void>;
}

/** Phase 5 — modale unique d'édition d'un item du kit (aucun écran parallèle). */
function TripKitEditModal({
  item,
  error,
  currentUserId,
  collaborators,
  onOpenChange,
  onSubmit,
}: TripKitEditModalProps) {
  const [quantity, setQuantity] = useState<string>(String(item?.quantity ?? 1));
  const [weightGrams, setWeightGrams] = useState<string>(
    item?.weight_grams != null ? String(item.weight_grams) : ''
  );
  const [ownership, setOwnership] = useState<'personal' | 'shared'>(
    item?.ownership === 'shared' ? 'shared' : 'personal'
  );
  const [condition, setCondition] = useState<string>(item?.condition ?? '');
  const [ownerId, setOwnerId] = useState<string>(item?.owner_id ?? '');
  const [priority, setPriority] = useState<'vital' | 'recommended' | 'optional'>(
    item?.priority === 'vital' || item?.is_vital
      ? 'vital'
      : item?.priority === 'optional'
        ? 'optional'
        : 'recommended'
  );
  const [busy, setBusy] = useState(false);

  return (
    <GlassModal open={item !== null} onOpenChange={onOpenChange} title="Modifier l’équipement" variant="sheet">
      <div className="space-y-4 pb-2">
        <p className="text-sm font-semibold text-[var(--lkv-text-primary)] truncate">
          {item ? cleanItemName(item.item_name) : ''}
        </p>

        {error && (
          <p role="alert" className="rounded-xl border border-[var(--lkv-danger)]/30 bg-[var(--lkv-danger)]/10 px-3 py-2 text-xs font-semibold text-[var(--lkv-danger)]">
            {error}
          </p>
        )}

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1 block text-xs font-semibold text-[var(--lkv-text-primary)]">
              Quantité
            </label>
            <input
              className="glass-input w-full px-3 py-2 text-sm text-[var(--lkv-text-primary)]"
              type="number"
              min={1}
              max={999}
              value={quantity}
              onChange={(event) => setQuantity(event.target.value)}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-[var(--lkv-text-primary)]">
              Poids unitaire (g)
            </label>
            <input
              className="glass-input w-full px-3 py-2 text-sm text-[var(--lkv-text-primary)]"
              type="number"
              min={0}
              placeholder="non renseigné"
              value={weightGrams}
              onChange={(event) => setWeightGrams(event.target.value)}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-[var(--lkv-text-primary)]">
              Type
            </label>
            <select
              className="glass-input w-full px-3 py-2 text-sm text-[var(--lkv-text-primary)]"
              value={ownership}
              onChange={(event) => setOwnership(event.target.value as 'personal' | 'shared')}
            >
              <option value="personal">Personnel</option>
              <option value="shared">Partagé (groupe)</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-[var(--lkv-text-primary)]">
              État
            </label>
            <select
              className="glass-input w-full px-3 py-2 text-sm text-[var(--lkv-text-primary)]"
              value={condition}
              onChange={(event) => setCondition(event.target.value)}
            >
              <option value="">Non renseigné</option>
              <option value="neuf">Neuf</option>
              <option value="bon">Bon état</option>
              <option value="use">Usé</option>
              <option value="a_remplacer">À remplacer</option>
              <option value="pour_pieces">Pour pièces</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-[var(--lkv-text-primary)]">
              Propriétaire
            </label>
            <select
              className="glass-input w-full px-3 py-2 text-sm text-[var(--lkv-text-primary)]"
              value={ownerId}
              onChange={(event) => setOwnerId(event.target.value)}
            >
              <option value="">À assigner</option>
              <option value={currentUserId}>Vous</option>
              {collaborators
                .filter((collab) => collab.user_id !== currentUserId)
                .map((collab) => (
                  <option key={collab.user_id} value={collab.user_id}>
                    {collab.profile?.full_name || collab.profile?.username || 'Voyageur'}
                  </option>
                ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-[var(--lkv-text-primary)]">
              Priorité
            </label>
            <select
              className="glass-input w-full px-3 py-2 text-sm text-[var(--lkv-text-primary)]"
              value={priority}
              onChange={(event) =>
                setPriority(event.target.value as 'vital' | 'recommended' | 'optional')
              }
            >
              <option value="vital">Vital</option>
              <option value="recommended">Recommandé</option>
              <option value="optional">Optionnel</option>
            </select>
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 border-t border-white/40 pt-4">
          <GlassCapsuleBtn
            type="button"
            variant="default"
            size="sm"
            onClick={() => onOpenChange(false)}
            disabled={busy}
          >
            Annuler
          </GlassCapsuleBtn>
          <GlassCapsuleBtn
            type="button"
            variant="primary"
            size="sm"
            disabled={busy}
            onClick={() => {
              setBusy(true);
              void onSubmit({
                quantity: Math.max(1, Number(quantity) || 1),
                weightGrams:
                  weightGrams.trim() === '' ? null : Math.max(0, Math.round(Number(weightGrams) || 0)),
                ownership,
                condition: (condition || null) as
                  | 'neuf'
                  | 'bon'
                  | 'use'
                  | 'a_remplacer'
                  | 'pour_pieces'
                  | null,
                ownerId: ownerId || null,
                priority,
              }).finally(() => setBusy(false));
            }}
          >
            Enregistrer
          </GlassCapsuleBtn>
        </div>
      </div>
    </GlassModal>
  );
}

interface ItemRowProps {
  item: TripItem;
  imageUrl?: string | null;
  onDeleteItem: (id: string) => void;
  onTogglePacked: (item: TripItem) => void;
  onEdit: (item: TripItem) => void;
  busyPacked: boolean;
  ownerLabel: string | null;
  canEdit: boolean;
}

function GearThumb({ url, name, size = 46 }: { url?: string | null; name: string; size?: number }) {
  if (url) {
    return (
      <img
        src={url}
        alt=""
        loading="lazy"
        className="shrink-0 rounded-xl border border-white/60 object-cover"
        style={{ width: size, height: size }}
      />
    );
  }
  return (
    <span
      className="flex shrink-0 items-center justify-center rounded-xl border border-white/60 bg-white/70 font-bold text-[var(--lkv-primary)]"
      style={{ width: size, height: size }}
      aria-hidden="true"
    >
      {name.slice(0, 1).toUpperCase()}
    </span>
  );
}

function GearStockBadge({ quantity, stock = false }: { quantity: number; stock?: boolean }) {
  if (quantity <= 1) return null;
  return (
    <span
      className="shrink-0 rounded-full border border-white/60 bg-white/70 px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-[var(--lkv-text-secondary)]"
      title={stock ? `${quantity} en stock` : `${quantity} dans le sac`}
    >
      ×{quantity}
      {stock ? ' en stock' : ''}
    </span>
  );
}

/** Ligne du sac : état emballé, badges personnel/partagé/manquant, édition. */
function TripKitItemRow({
  item,
  imageUrl,
  onDeleteItem,
  onTogglePacked,
  onEdit,
  busyPacked,
  ownerLabel,
  canEdit,
}: ItemRowProps) {
  const displayName = cleanItemName(item.item_name);
  const isMissing = item.status === 'missing';
  const conditionLabels: Record<string, string> = {
    neuf: 'Neuf',
    bon: 'Bon état',
    use: 'Usé',
    a_remplacer: 'À remplacer',
    pour_pieces: 'Pour pièces',
  };

  return (
    <div
      className={`flex items-center justify-between gap-3 py-3 transition-colors ${
        item.is_packed ? 'opacity-70' : 'opacity-100'
      }`}
    >
      <div className="flex min-w-0 items-center gap-3">
        {canEdit ? (
          <button
            type="button"
            onClick={() => onTogglePacked(item)}
            disabled={busyPacked}
            aria-label={item.is_packed ? 'Marquer non emballé' : 'Marquer emballé'}
            aria-pressed={item.is_packed}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-lkv-primary transition-transform active:scale-90 disabled:opacity-50"
          >
            {item.is_packed ? (
              <CheckCircle2 className="h-5 w-5" aria-hidden="true" />
            ) : (
              <Circle className="h-5 w-5" aria-hidden="true" />
            )}
          </button>
        ) : (
          <GearThumb url={imageUrl} name={displayName} />
        )}

        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`text-sm font-medium truncate ${
                item.is_packed
                  ? 'line-through decoration-[var(--lkv-text-muted)]/60 text-[var(--lkv-text-secondary)]'
                  : 'text-[var(--lkv-text-primary)]'
              }`}
            >
              {displayName}
            </span>
            {item.is_packed && (
              <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-[var(--lkv-success)]/10 text-[var(--lkv-success)] border border-[var(--lkv-success)]/20 shrink-0">
                emballé
              </span>
            )}
            {isMissing && (
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-[var(--lkv-warning)]/10 text-[var(--lkv-warning-dark)] border border-[var(--lkv-warning)]/30 shrink-0">
                manquant
              </span>
            )}
            {item.ownership === 'shared' && (
              <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-white/70 text-[var(--lkv-text-secondary)] border border-white/60 shrink-0">
                partagé
              </span>
            )}
            {item.quantity > 1 && item.is_consumable && <GearStockBadge quantity={item.quantity} />}
            {item.is_vital && (
              <span className="text-[10px] font-bold text-[var(--lkv-danger)]">Vital</span>
            )}
          </div>

          <div className="mt-0.5 text-[11px] text-[var(--lkv-text-secondary)]">
            {item.weight_grams ? `${item.weight_grams} g` : 'poids non renseigné'}
            {item.quantity > 1 ? ` · ×${item.quantity}` : ''}
            {ownerLabel ? ` · ${ownerLabel}` : ''}
            {item.condition ? ` · ${conditionLabels[item.condition] ?? item.condition}` : ''}
          </div>
          {item.reason && (
            <p className="mt-0.5 line-clamp-2 text-[10px] italic text-[var(--lkv-text-muted)]">
              {item.reason}
            </p>
          )}
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-1.5">
        {canEdit && (
          <button
            type="button"
            onClick={() => onEdit(item)}
            className="flex h-11 w-11 items-center justify-center rounded-full glass-sub-card border border-white/60 text-[var(--lkv-text-secondary)] transition-all hover:text-lkv-primary active:scale-90"
            title="Modifier l’équipement"
            aria-label="Modifier l’équipement"
          >
            <Pencil className="h-4 w-4" aria-hidden="true" />
          </button>
        )}
        <button
          type="button"
          onClick={() => onDeleteItem(item.id)}
          className="flex h-11 w-11 items-center justify-center rounded-full glass-sub-card border border-white/60 text-[var(--lkv-text-muted)] transition-all hover:bg-[var(--lkv-danger)]/10 hover:text-[var(--lkv-danger)] active:scale-90"
          title="Retirer du sac"
          aria-label="Retirer du sac"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}

/** Ligne « possédé, pas encore dans le sac » : bouton +. */
function GearInventoryAddRow({
  inv,
  busy,
  onAdd,
}: {
  inv: InventoryItem;
  busy: boolean;
  onAdd: (item: { id: string; name: string; category?: string | null; weight_g?: number | null }) => void;
}) {
  const consumable = /vivre|eau|nutrition|hydrat|repas|ration|barre|en-cas|cuisine|gaz/i.test(
    `${inv.category ?? ''} ${inv.name}`
  );
  return (
    <div className="flex items-center justify-between gap-3 py-3">
      <div className="flex min-w-0 items-center gap-3">
        <GearThumb url={inv.photo_url} name={inv.name} />
        <div className="min-w-0">
          <span className="block truncate text-sm font-medium text-[var(--lkv-text-primary)]">
            {inv.name}
          </span>
          <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[11px] text-[var(--lkv-text-secondary)]">
            <span>{inv.weight_g != null ? `${inv.weight_g} g` : 'poids non renseigné'}</span>
            {consumable && <GearStockBadge quantity={inv.quantity} stock />}
          </div>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-1.5">
        <button
          type="button"
          onClick={() =>
            onAdd({ id: inv.id, name: inv.name, category: inv.category, weight_g: inv.weight_g })
          }
          disabled={busy}
          className="flex h-11 w-11 items-center justify-center rounded-full bg-lkv-primary text-white transition-transform active:scale-90 disabled:opacity-50"
          title="Ajouter au sac"
          aria-label={`Ajouter ${inv.name} au sac`}
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}

/** Ligne boutique (ni possédé ni dans le sac) : bouton boîte-flèche → Mon Matériel. */
function GearShopAddRow({
  product,
  busy,
  onAddToInventory,
}: {
  product: ShopProductReference;
  busy: boolean;
  onAddToInventory: (product: ShopProductReference) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3 py-3">
      <div className="flex min-w-0 items-center gap-3">
        <GearThumb url={product.image ?? null} name={product.name} />
        <div className="min-w-0">
          <span className="block truncate text-sm font-medium text-[var(--lkv-text-primary)]">
            {product.name}
          </span>
          <span className="mt-0.5 block text-[11px] text-[var(--lkv-text-secondary)]">
            {product.price_eur} € · {product.weight_g} g
            {product.brand ? ` · ${product.brand}` : ''}
          </span>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-1.5">
        <button
          type="button"
          onClick={() => onAddToInventory(product)}
          disabled={busy}
          className="flex h-11 w-11 items-center justify-center rounded-full bg-lkv-primary text-white transition-transform active:scale-90 disabled:opacity-50"
          title="Ajouter à Mon Matériel"
          aria-label={`Ajouter ${product.name} à mon matériel`}
        >
          <PackagePlus className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}

function VirtualTripKitItemList({
  items,
  imageByItemId,
  onDeleteItem,
  onTogglePacked,
  onEdit,
  busyPackedId,
  canEdit,
}: {
  items: TripItem[];
  imageByItemId: Map<string, string | null>;
  onDeleteItem: (id: string) => void;
  onTogglePacked: (item: TripItem) => void;
  onEdit: (item: TripItem) => void;
  busyPackedId: string | null;
  canEdit: boolean;
}) {
  const parentRef = useRef<HTMLDivElement>(null);
  const rowVirtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 64,
    overscan: 6,
  });

  return (
    <div ref={parentRef} className="max-h-[500px] overflow-y-auto no-scrollbar">
      <div
        style={{
          height: `${rowVirtualizer.getTotalSize()}px`,
          width: '100%',
          position: 'relative',
        }}
      >
        {rowVirtualizer.getVirtualItems().map((virtualRow) => {
          const item = items[virtualRow.index];
          return (
            <div
              key={item.id}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                transform: `translateY(${virtualRow.start}px)`,
              }}
              className="border-b border-white/40"
            >
              <TripKitItemRow
                item={item}
                imageUrl={imageByItemId.get(item.id) ?? null}
                onDeleteItem={onDeleteItem}
                onTogglePacked={onTogglePacked}
                onEdit={onEdit}
                busyPacked={busyPackedId === item.id}
                ownerLabel={null}
                canEdit={canEdit}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
