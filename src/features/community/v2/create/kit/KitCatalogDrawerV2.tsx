'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  ArrowUpDown,
  Backpack,
  Bookmark,
  CalendarClock,
  Check,
  Handshake,
  LayoutGrid,
  List,
  Loader2,
  Plus,
  Repeat,
  Search,
  ShoppingBag,
  SlidersHorizontal,
  Tag,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import { useKitCatalog } from '@/features/community/create/kit/useKitCatalog';
import type { KitSource, PickerProduct } from '@/features/community/create/kit/types';
import { generatedProductImage } from '@/components/compte/drawer/cards/productImage';
import { formatKitItemWeightV2, formatKitWeightV2, type KitUnitsV2 } from './kitContextV2';
import {
  KitProductSheetV2,
  readFavoriteProductIds,
  type ProductAddOverrides,
} from './KitProductSheetV2';
import type { InventoryItemV2 } from './kitSourcesV2';

export interface KitCatalogDrawerV2Props {
  open: boolean;
  initialCategory?: string;
  inventory: Array<InventoryItemV2 | PickerProduct>;
  addedKeys: Set<string>;
  currentKitWeightG?: number;
  addedCount?: number;
  units?: KitUnitsV2;
  emptyCategories?: string[];
  onClose: () => void;
  onAddProduct: (
    product: PickerProduct,
    targetCategory?: string,
    overrides?: ProductAddOverrides,
  ) => void;
  onRemoveProduct?: (product: PickerProduct) => void;
  onCreateCustom?: (presetName: string, category?: string) => void;
}

type SortMode = 'default' | 'weight_asc' | 'weight_desc' | 'name_asc';

const SOURCES: {
  id: KitSource;
  label: string;
  Icon: React.ComponentType<{ size?: number; strokeWidth?: number; 'aria-hidden'?: boolean }>;
}[] = [
  { id: 'inventory', label: 'Nos produits', Icon: Backpack },
  { id: 'achat', label: 'Boutique', Icon: ShoppingBag },
  { id: 'location', label: 'Location', Icon: CalendarClock },
  { id: 'occasion', label: 'Occasion', Icon: Repeat },
  { id: 'pret', label: 'Prêt', Icon: Handshake },
];

const SOURCE_LABELS: Record<KitSource, string> = {
  inventory: 'Inventaire',
  achat: 'Boutique',
  location: 'Location',
  occasion: 'Occasion',
  pret: 'Gratuit',
};

const CATEGORY_ALIASES: Record<string, string[]> = {
  portage: ['sac', 'portage', 'backpack', 'dos'],
  abri: ['abri', 'tente', 'tent', 'bivouac', 'tarp', 'hamac', 'shelter'],
  couchage: ['couchage', 'sac', 'duvet', 'matelas', 'sleeping', 'pad', 'quilt'],
  cuisine: ['cuisine', 'réchaud', 'rechaud', 'popote', 'stove', 'cook', 'repas'],
  vêtements: ['vêtement', 'vetement', 'veste', 'pantalon', 'polaire', 'doudoune', 'clothing'],
  hydratation: ['hydratation', 'eau', 'gourde', 'flasque', 'filtre', 'water', 'hydration'],
  électronique: ['électronique', 'electronique', 'lampe', 'frontale', 'batterie', 'gps', 'solaire'],
  sécurité: ['sécurité', 'securite', 'secours', 'dva', 'pelle', 'sonde', 'couverture'],
  divers: ['divers', 'lampe', 'bâton', 'baton', 'secours', 'accessoire', 'other', 'gear'],
};

function matchesKitCategory(productCat: string | null | undefined, filterCat: string): boolean {
  if (!filterCat) return true;
  const prod = (productCat ?? '').trim().toLowerCase();
  const filt = filterCat.trim().toLowerCase();
  if (!prod) return false;
  if (prod === filt || prod.includes(filt) || filt.includes(prod)) return true;
  const aliases = CATEGORY_ALIASES[filt];
  return aliases ? aliases.some((a) => prod.includes(a)) : false;
}

export function formatLoanBreakageLabel(product: PickerProduct): string | null {
  if (product.source !== 'pret') return null;
  const cents = product.depositCents ?? 0;
  if (cents > 0) return `Casse/perte : ${Math.round(cents / 100)} €`;
  return 'Casse/perte : 0 €';
}

function stateLabel(product: PickerProduct): string {
  if (product.source === 'pret') {
    const cents = product.depositCents ?? 0;
    return cents > 0 ? `Gratuit · Casse/perte ${Math.round(cents / 100)} €` : 'Gratuit · Casse/perte 0 €';
  }
  if (product.source === 'inventory') {
    if (product.wear != null) return `Usure ${product.wear}%`;
    return 'En stock';
  }
  if (product.priceLabel) return product.priceLabel;
  return SOURCE_LABELS[product.source];
}

function mapInventoryToPicker(item: InventoryItemV2 | PickerProduct): PickerProduct {
  if ('source' in item && 'key' in item) return item;
  return {
    key: `inv-${item.ownershipId}`,
    source: 'inventory',
    id: item.ownershipId,
    name: item.name,
    brand: null,
    category: item.category,
    weightG: item.weightG,
    image: null,
    wear: null,
    priceLabel: 'Perso',
    cartable: null,
    ownershipId: item.ownershipId,
    productId: item.productId,
  };
}

function isProductAdded(product: PickerProduct, addedKeys: Set<string>): boolean {
  return (
    addedKeys.has(product.id) ||
    addedKeys.has(product.key) ||
    addedKeys.has(`name:${product.name.trim().toLowerCase()}`)
  );
}

/**
 * Tiroir Boutique / Catalogue V2 : même structure que les volets V2 — scroll plein
 * jusqu'en bas sous les contrôles flottants (zéro barre blanche), sélecteur capsule
 * unifié en bas à droite et menus modernes.
 */
export function KitCatalogDrawerV2({
  open,
  initialCategory = '',
  inventory,
  addedKeys,
  currentKitWeightG = 0,
  units = 'metric',
  onClose,
  onAddProduct,
  onRemoveProduct,
  onCreateCustom,
}: KitCatalogDrawerV2Props) {
  const { state, load } = useKitCatalog();
  const [source, setSource] = useState<KitSource>(() => (inventory.length > 0 ? 'inventory' : 'achat'));
  const [query, setQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState(initialCategory);
  const [maxWeightFilter, setMaxWeightFilter] = useState<'all' | '500' | '1500'>('all');
  const [onlyWithWeight, setOnlyWithWeight] = useState(false);
  const [onlyFavorites, setOnlyFavorites] = useState(false);
  const [hideAdded, setHideAdded] = useState(false);
  const [sortMode, setSortMode] = useState<SortMode>('default');
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');
  const [favIds, setFavIds] = useState<string[]>(() => readFavoriteProductIds());
  const [openMenu, setOpenMenu] = useState<'cat' | 'filter' | null>(null);
  const [infoProduct, setInfoProduct] = useState<PickerProduct | null>(null);
  const swipeStartY = useRef<number | null>(null);

  useEffect(() => {
    if (open) {
      setSource(inventory.length > 0 ? 'inventory' : 'achat');
      setCategoryFilter(initialCategory);
      setInfoProduct(null);
      setOpenMenu(null);
      setFavIds(readFavoriteProductIds());
    }
  }, [initialCategory, inventory.length, open]);

  useEffect(() => {
    if (!open || source === 'inventory') return;
    void load(source);
  }, [load, open, source]);

  useEffect(() => {
    if (!open || infoProduct) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        if (openMenu) setOpenMenu(null);
        else onClose();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [infoProduct, onClose, open, openMenu]);

  const inventoryItems = useMemo(() => inventory.map(mapInventoryToPicker), [inventory]);
  const rawItems: PickerProduct[] =
    source === 'inventory' ? inventoryItems : (state[source]?.items ?? []);

  const effectiveCategoryFilter = useMemo(() => {
    if (!categoryFilter) return '';
    const hasAny = rawItems.some((item) => matchesKitCategory(item.category, categoryFilter));
    return hasAny ? categoryFilter : '';
  }, [categoryFilter, rawItems]);

  const categories = useMemo(() => {
    const set = new Set<string>();
    rawItems.forEach((p) => {
      if (p.category?.trim()) set.add(p.category.trim());
    });
    if (initialCategory) set.add(initialCategory);
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'fr'));
  }, [initialCategory, rawItems]);

  const favSet = useMemo(() => new Set(favIds), [favIds]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = rawItems.filter((item) => {
      if (effectiveCategoryFilter && !matchesKitCategory(item.category, effectiveCategoryFilter)) {
        return false;
      }
      if (hideAdded && isProductAdded(item, addedKeys)) return false;
      if (onlyFavorites && !favSet.has(item.id)) return false;
      if (onlyWithWeight && (!item.weightG || item.weightG <= 0)) return false;
      if (maxWeightFilter === '500' && item.weightG && item.weightG > 500) return false;
      if (maxWeightFilter === '1500' && item.weightG && item.weightG > 1500) return false;
      if (!q) return true;
      return (
        item.name.toLowerCase().includes(q) ||
        (item.brand ?? '').toLowerCase().includes(q) ||
        (item.category ?? '').toLowerCase().includes(q)
      );
    });
    if (sortMode === 'weight_asc') {
      return [...list].sort((a, b) => (a.weightG ?? 999999) - (b.weightG ?? 999999));
    }
    if (sortMode === 'weight_desc') {
      return [...list].sort((a, b) => (b.weightG ?? -1) - (a.weightG ?? -1));
    }
    if (sortMode === 'name_asc') {
      return [...list].sort((a, b) => a.name.localeCompare(b.name, 'fr'));
    }
    return list;
  }, [
    addedKeys,
    effectiveCategoryFilter,
    favSet,
    hideAdded,
    maxWeightFilter,
    onlyFavorites,
    onlyWithWeight,
    query,
    rawItems,
    sortMode,
  ]);

  const fmtItemWeight = (g: number | null) =>
    !g || g <= 0 ? 'Poids n.c.' : formatKitItemWeightV2(g, units);
  const fmtTotalWeight = (g: number) => formatKitWeightV2(g, units);

  const handleQuickAdd = (event: React.MouseEvent, product: PickerProduct) => {
    event.stopPropagation();
    onAddProduct(product, initialCategory || undefined);
    toast.success(`${product.name} ajouté`);
  };

  const resetFilters = () => {
    setQuery('');
    setCategoryFilter('');
    setMaxWeightFilter('all');
    setOnlyWithWeight(false);
    setOnlyFavorites(false);
    setHideAdded(false);
    setSortMode('default');
  };

  const infoIndex = infoProduct ? filtered.findIndex((p) => p.key === infoProduct.key) : -1;

  if (!open || typeof document === 'undefined') return null;

  const isLoading = source !== 'inventory' && state[source]?.status === 'loading';
  const activeSourceIndex = Math.max(
    0,
    SOURCES.findIndex((s) => s.id === source),
  );
  const hasActiveFilter =
    Boolean(query) ||
    Boolean(effectiveCategoryFilter) ||
    maxWeightFilter !== 'all' ||
    onlyWithWeight ||
    onlyFavorites ||
    hideAdded ||
    sortMode !== 'default';

  return createPortal(
    <>
      <div className="lkdv-cv2c-stack-backdrop" aria-hidden="true" onClick={onClose} />
      <div
        className="lkdv-cv2c-stack-overlay"
        role="dialog"
        aria-modal="true"
        aria-label="Catalogue de matériel"
      >
        <div
          className="lkdv-cv2-grab"
          aria-hidden="true"
          onPointerDown={(e) => {
            swipeStartY.current = e.clientY;
          }}
          onPointerUp={(e) => {
            if (swipeStartY.current != null && e.clientY - swipeStartY.current > 75) {
              onClose();
            }
            swipeStartY.current = null;
          }}
        >
          <span />
        </div>

        {/* En-tête épuré : fermer + sources + poids kit */}
        <div className="lkdv-cv2c-stack-head">
          <button
            type="button"
            className="lkdv-cv2c-stack-close"
            aria-label="Fermer le catalogue"
            onClick={onClose}
          >
            <X size={16} aria-hidden="true" />
          </button>
          <div
            className="segc lg-tabs lens-on lkdv-capsule lkdv-cv2-capsule lkdv-cv2c-stack-capsule"
            role="tablist"
            aria-label="Source des produits"
            style={{ '--n': SOURCES.length } as React.CSSProperties}
          >
            <span
              className="sel-lens"
              aria-hidden="true"
              style={{ '--i': activeSourceIndex } as React.CSSProperties}
            />
            {SOURCES.map(({ id, label, Icon }) => {
              const active = source === id;
              return (
                <button
                  key={id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  aria-label={label}
                  title={label}
                  className={active ? 'active' : ''}
                  onClick={() => setSource(id)}
                >
                  <span className="ic s">
                    <Icon size={18} strokeWidth={1.8} aria-hidden />
                  </span>
                </button>
              );
            })}
          </div>
          <span className="lkdv-cv2c-cat-kpi" aria-label="Poids actuel du kit">
            {fmtTotalWeight(currentKitWeightG)}
          </span>
        </div>

        {/* Barre unique calme */}
        <div className="lkdv-cv2c-cat-bar">
          <div className="lkdv-cv2c-cat-bar-chips">
            <button
              type="button"
              className="lkdv-cv2-chip lkdv-cv2-chip--sm"
              aria-pressed={!hasActiveFilter}
              onClick={resetFilters}
            >
              Tous ({rawItems.length})
            </button>
            <button
              type="button"
              className="lkdv-cv2-chip lkdv-cv2-chip--sm"
              aria-pressed={sortMode === 'weight_asc'}
              onClick={() => setSortMode((s) => (s === 'weight_asc' ? 'default' : 'weight_asc'))}
            >
              <ArrowUpDown size={11} aria-hidden="true" /> + légers
            </button>
            <button
              type="button"
              className="lkdv-cv2-chip lkdv-cv2-chip--sm"
              aria-pressed={onlyFavorites}
              onClick={() => setOnlyFavorites((v) => !v)}
            >
              <Bookmark size={11} aria-hidden="true" /> Favoris
            </button>
            {effectiveCategoryFilter ? (
              <button
                type="button"
                className="lkdv-cv2-chip lkdv-cv2-chip--sm"
                aria-pressed={true}
                onClick={() => setCategoryFilter('')}
              >
                {effectiveCategoryFilter} ×
              </button>
            ) : null}
          </div>
        </div>

        {/* Corps scrollable plein jusqu'en bas sous le dock flottant */}
        <div className="lkdv-cv2c-stack-body" onClick={() => openMenu && setOpenMenu(null)}>
          {isLoading ? (
            <p className="lkdv-cv2-field-hint" style={{ padding: 20 }} role="status">
              <Loader2 size={14} className="lkdv-cv2c-spin" aria-hidden="true" /> Chargement…
            </p>
          ) : filtered.length === 0 ? (
            <div className="lkdv-cv2c-stack-empty">
              <b>Aucun produit trouvé</b>
              <small>Essaie une autre source ou réinitialise les filtres.</small>
              <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap', justifyContent: 'center' }}>
                {hasActiveFilter ? (
                  <button
                    type="button"
                    className="lkdv-cv2-chip lkdv-cv2-chip--sm"
                    onClick={resetFilters}
                  >
                    Réinitialiser
                  </button>
                ) : null}
                {query.trim() && onCreateCustom ? (
                  <button
                    type="button"
                    className="lkdv-cv2-chip lkdv-cv2-chip--sm"
                    onClick={() => onCreateCustom(query.trim(), effectiveCategoryFilter || undefined)}
                  >
                    <Plus size={12} aria-hidden="true" /> Créer « {query.trim()} »
                  </button>
                ) : null}
              </div>
            </div>
          ) : viewMode === 'grid' ? (
            <ul className="lkdv-cv2c-cat-grid" role="list">
              {filtered.map((product) => {
                const thumb = product.image || generatedProductImage(product.name, 192);
                const added = isProductAdded(product, addedKeys);
                return (
                  <li
                    key={product.key}
                    className={`lkdv-cv2c-cat-card ${added ? 'is-added' : ''}`}
                    style={{ cursor: 'pointer' }}
                    onClick={() => setInfoProduct(product)}
                  >
                    <div className="lkdv-cv2c-cat-card-top">
                      {/* eslint-disable-next-line @next/next/no-img-element -- vignette produit */}
                      <img src={thumb} alt="" />
                    </div>
                    <b className="lkdv-cv2c-cat-card-name">{product.name}</b>
                    <div className="lkdv-cv2c-cat-attrs" style={{ justifyContent: 'space-between' }}>
                      <span className="is-weight">{fmtItemWeight(product.weightG)}</span>
                      <span className="is-state">{stateLabel(product)}</span>
                    </div>
                    <button
                      type="button"
                      className="lkdv-cv2c-prod-add"
                      data-added={added}
                      style={{ width: '100%', gap: 4 }}
                      aria-label={`Ajouter ${product.name} au kit`}
                      onClick={(e) => handleQuickAdd(e, product)}
                    >
                      {added ? <Check size={13} aria-hidden="true" /> : <Plus size={13} aria-hidden="true" />}
                      <span style={{ fontSize: '0.72rem', fontWeight: 700 }}>
                        {added ? 'Ajouté' : 'Ajouter'}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : (
            <ul className="lkdv-cv2c-cat-list" role="list">
              {filtered.map((product) => {
                const thumb = product.image || generatedProductImage(product.name, 96);
                const added = isProductAdded(product, addedKeys);
                return (
                  <li
                    key={product.key}
                    className={`lkdv-cv2c-cat-row ${added ? 'is-added' : ''}`}
                    style={{ cursor: 'pointer' }}
                    onClick={() => setInfoProduct(product)}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element -- vignette produit */}
                    <img src={thumb} alt="" className="lkdv-cv2c-cat-thumb" width={44} height={44} />
                    <div className="lkdv-cv2c-cat-meta">
                      <b className="lkdv-cv2c-cat-name">{product.name}</b>
                      <div className="lkdv-cv2c-cat-attrs">
                        <span className="is-name">{product.brand || product.category || 'Équipement'}</span>
                        <span className="is-dot" aria-hidden="true">·</span>
                        <span className="is-weight">{fmtItemWeight(product.weightG)}</span>
                        <span className="is-dot" aria-hidden="true">·</span>
                        <span className="is-state">{stateLabel(product)}</span>
                      </div>
                    </div>
                    <button
                      type="button"
                      className="lkdv-cv2c-prod-add"
                      data-added={added}
                      aria-label={`Ajouter ${product.name} au kit`}
                      onClick={(e) => handleQuickAdd(e, product)}
                    >
                      {added ? <Check size={14} aria-hidden="true" /> : <Plus size={14} aria-hidden="true" />}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* Dock flottant bas transparent (zéro barre blanche) : recherche glass + sélecteur style étapes */}
        <div className="lkdv-cv2c-stack-float-dock">
          <div className="lkdv-cv2c-stack-search-glass">
            <Search size={14} aria-hidden="true" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Rechercher un produit…"
              aria-label="Rechercher un produit"
            />
            {query ? (
              <button
                type="button"
                aria-label="Effacer la recherche"
                style={{ border: 0, background: 'transparent', cursor: 'pointer', padding: 0, color: '#64748b' }}
                onClick={() => setQuery('')}
              >
                <X size={13} />
              </button>
            ) : null}
          </div>

          <div className="lkdv-cv2c-filter-wrap">
            <div className="lkdv-cv2c-pill-seg" role="group" aria-label="Catégories et filtres">
              <button
                type="button"
                className="lkdv-cv2c-pill-seg-btn"
                aria-expanded={openMenu === 'cat'}
                aria-label="Catégories"
                title="Catégories"
                data-active={openMenu === 'cat' || Boolean(effectiveCategoryFilter)}
                onClick={() => setOpenMenu((m) => (m === 'cat' ? null : 'cat'))}
              >
                <Tag size={14} aria-hidden="true" />
              </button>
              <button
                type="button"
                className="lkdv-cv2c-pill-seg-btn"
                aria-expanded={openMenu === 'filter'}
                aria-label="Filtres et affichage"
                title="Filtres et affichage"
                data-active={
                  openMenu === 'filter' ||
                  maxWeightFilter !== 'all' ||
                  onlyWithWeight ||
                  hideAdded ||
                  viewMode === 'grid' ||
                  sortMode !== 'default'
                }
                onClick={() => setOpenMenu((m) => (m === 'filter' ? null : 'filter'))}
              >
                <SlidersHorizontal size={14} aria-hidden="true" />
              </button>
            </div>

            {openMenu === 'cat' ? (
              <div className="lkdv-cv2c-dock-menu" role="listbox" aria-label="Catégories">
                <div className="lkdv-cv2c-dock-menu-head">
                  <b>Catégorie</b>
                  {effectiveCategoryFilter ? (
                    <button
                      type="button"
                      className="lkdv-cv2c-dock-menu-reset"
                      onClick={() => {
                        setCategoryFilter('');
                        setOpenMenu(null);
                      }}
                    >
                      Toutes
                    </button>
                  ) : null}
                </div>
                <div className="lkdv-cv2-chips">
                  <button
                    type="button"
                    className="lkdv-cv2-chip lkdv-cv2-chip--sm"
                    aria-pressed={!effectiveCategoryFilter}
                    onClick={() => {
                      setCategoryFilter('');
                      setOpenMenu(null);
                    }}
                  >
                    Toutes
                  </button>
                  {categories.map((cat) => (
                    <button
                      key={cat}
                      type="button"
                      className="lkdv-cv2-chip lkdv-cv2-chip--sm"
                      aria-pressed={effectiveCategoryFilter === cat}
                      onClick={() => {
                        setCategoryFilter(cat);
                        setOpenMenu(null);
                      }}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}

            {openMenu === 'filter' ? (
              <div className="lkdv-cv2c-dock-menu" role="dialog" aria-label="Filtres produits">
                <div className="lkdv-cv2c-dock-menu-head">
                  <b>Affichage & Filtres</b>
                  <button
                    type="button"
                    className="lkdv-cv2c-dock-menu-reset"
                    onClick={() => {
                      resetFilters();
                      setViewMode('list');
                    }}
                  >
                    Réinitialiser
                  </button>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <span className="lkdv-cv2-field-label">Affichage</span>
                  <div className="lkdv-cv2-chips">
                    <button
                      type="button"
                      className="lkdv-cv2-chip lkdv-cv2-chip--sm"
                      aria-pressed={viewMode === 'list'}
                      onClick={() => setViewMode('list')}
                    >
                      <List size={11} aria-hidden="true" /> Liste
                    </button>
                    <button
                      type="button"
                      className="lkdv-cv2-chip lkdv-cv2-chip--sm"
                      aria-pressed={viewMode === 'grid'}
                      onClick={() => setViewMode('grid')}
                    >
                      <LayoutGrid size={11} aria-hidden="true" /> Grille
                    </button>
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <span className="lkdv-cv2-field-label">Trier par</span>
                  <div className="lkdv-cv2-chips">
                    {[
                      { id: 'default', label: 'Défaut' },
                      { id: 'weight_asc', label: 'Poids ↑' },
                      { id: 'weight_desc', label: 'Poids ↓' },
                      { id: 'name_asc', label: 'A → Z' },
                    ].map((opt) => (
                      <button
                        key={opt.id}
                        type="button"
                        className="lkdv-cv2-chip lkdv-cv2-chip--sm"
                        aria-pressed={sortMode === opt.id}
                        onClick={() => setSortMode(opt.id as SortMode)}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <span className="lkdv-cv2-field-label">Poids max & Options</span>
                  <div className="lkdv-cv2-chips">
                    {[
                      { id: 'all', label: 'Tous' },
                      { id: '500', label: '≤ 500 g' },
                      { id: '1500', label: '≤ 1,5 kg' },
                    ].map((opt) => (
                      <button
                        key={opt.id}
                        type="button"
                        className="lkdv-cv2-chip lkdv-cv2-chip--sm"
                        aria-pressed={maxWeightFilter === opt.id}
                        onClick={() => setMaxWeightFilter(opt.id as 'all' | '500' | '1500')}
                      >
                        {opt.label}
                      </button>
                    ))}
                    <button
                      type="button"
                      className="lkdv-cv2-chip lkdv-cv2-chip--sm"
                      aria-pressed={onlyWithWeight}
                      onClick={() => setOnlyWithWeight((v) => !v)}
                    >
                      Poids connu
                    </button>
                    <button
                      type="button"
                      className="lkdv-cv2-chip lkdv-cv2-chip--sm"
                      aria-pressed={hideAdded}
                      onClick={() => setHideAdded((v) => !v)}
                    >
                      Masquer ajoutés
                    </button>
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </div>

      {/* Tiroir superposé niveau 2 : Fiche produit */}
      {infoProduct ? (
        <KitProductSheetV2
          product={infoProduct}
          initialCategory={initialCategory}
          currentKitWeightG={currentKitWeightG}
          units={units}
          alreadyInKit={isProductAdded(infoProduct, addedKeys)}
          positionLabel={infoIndex >= 0 ? `${infoIndex + 1} / ${filtered.length}` : undefined}
          hasPrev={infoIndex > 0}
          hasNext={infoIndex >= 0 && infoIndex < filtered.length - 1}
          onPrev={() => {
            if (infoIndex > 0) setInfoProduct(filtered[infoIndex - 1]);
          }}
          onNext={() => {
            if (infoIndex >= 0 && infoIndex < filtered.length - 1) setInfoProduct(filtered[infoIndex + 1]);
          }}
          onFavoriteChange={() => setFavIds(readFavoriteProductIds())}
          onClose={() => setInfoProduct(null)}
          onAdd={(prod, overrides, keepOpen) => {
            onAddProduct(prod, overrides.category ?? (initialCategory || undefined), overrides);
            if (!keepOpen) setInfoProduct(null);
          }}
          onRemove={
            onRemoveProduct
              ? (prod) => {
                  onRemoveProduct(prod);
                }
              : undefined
          }
        />
      ) : null}
    </>,
    document.body,
  );
}
