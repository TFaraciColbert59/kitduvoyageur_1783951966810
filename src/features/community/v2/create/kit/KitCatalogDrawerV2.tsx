'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  Backpack,
  CalendarClock,
  Check,
  Handshake,
  Info,
  Loader2,
  Plus,
  Repeat,
  Search,
  ShoppingBag,
  SlidersHorizontal,
  Tag,
  X,
} from 'lucide-react';
import { useKitCatalog } from '@/features/community/create/kit/useKitCatalog';
import type { KitSource, PickerProduct } from '@/features/community/create/kit/types';
import { generatedProductImage } from '@/components/compte/drawer/cards/productImage';
import { KitProductSheetV2, type ProductAddOverrides } from './KitProductSheetV2';
import type { InventoryItemV2 } from './kitSourcesV2';

export interface KitCatalogDrawerV2Props {
  open: boolean;
  initialCategory?: string;
  inventory: InventoryItemV2[];
  addedKeys: Set<string>;
  currentKitWeightG?: number;
  onClose: () => void;
  onAddProduct: (
    product: PickerProduct,
    targetCategory?: string,
    overrides?: ProductAddOverrides,
  ) => void;
}

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
  achat: 'Neuf · Boutique',
  location: 'Location',
  occasion: 'Occasion',
  pret: 'Prêt',
};

const CATEGORY_ALIASES: Record<string, string[]> = {
  abri: ['abri', 'tente', 'tent', 'bivouac', 'tarp', 'hamac', 'shelter'],
  couchage: ['couchage', 'sac', 'duvet', 'matelas', 'sleeping', 'pad', 'quilt'],
  cuisine: ['cuisine', 'réchaud', 'rechaud', 'popote', 'stove', 'cook', 'repas'],
  vêtements: ['vêtement', 'vetement', 'veste', 'pantalon', 'polaire', 'doudoune', 'clothing', 'apparel'],
  hydratation: ['hydratation', 'gourde', 'flasque', 'filtre', 'water', 'hydration'],
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

function stateLabel(product: PickerProduct): string {
  if (product.source === 'inventory') {
    if (product.wear != null) return `Usure ${product.wear}%`;
    return 'En stock';
  }
  if (product.priceLabel) return product.priceLabel;
  return SOURCE_LABELS[product.source];
}

function formatWeight(grams: number | null): string {
  if (!grams || grams <= 0) return 'Poids n.c.';
  return grams >= 1000 ? `${(grams / 1000).toFixed(1).replace('.', ',')} kg` : `${grams} g`;
}

function mapInventoryToPicker(item: InventoryItemV2): PickerProduct {
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

/**
 * Tiroir superposé niveau 1 (Catalogue unifié : Nos produits / Boutique /
 * Location / Occasion / Prêt) + niveau 2 (Fiche produit via bouton `i`).
 * Même esthétique Liquid Glass 90dvh que les tiroirs principaux, sélecteur
 * haut en icônes uniquement, fermeture niveau par niveau via `✕`.
 */
export function KitCatalogDrawerV2({
  open,
  initialCategory = '',
  inventory,
  addedKeys,
  currentKitWeightG = 0,
  onClose,
  onAddProduct,
}: KitCatalogDrawerV2Props) {
  const { state, load } = useKitCatalog();
  const [source, setSource] = useState<KitSource>(() => (inventory.length > 0 ? 'inventory' : 'achat'));
  const [query, setQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState(initialCategory);
  const [catOpen, setCatOpen] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const [maxWeightFilter, setMaxWeightFilter] = useState<'all' | '500' | '1500'>('all');
  const [onlyWithWeight, setOnlyWithWeight] = useState(false);
  const [infoProduct, setInfoProduct] = useState<PickerProduct | null>(null);

  useEffect(() => {
    if (open) {
      setSource(inventory.length > 0 ? 'inventory' : 'achat');
      setCategoryFilter(initialCategory);
      setInfoProduct(null);
      setFilterOpen(false);
      setCatOpen(false);
    }
  }, [initialCategory, inventory.length, open]);

  useEffect(() => {
    if (!open || source === 'inventory') return;
    void load(source);
  }, [load, open, source]);

  const inventoryItems = useMemo(() => inventory.map(mapInventoryToPicker), [inventory]);

  const rawItems: PickerProduct[] =
    source === 'inventory' ? inventoryItems : (state[source]?.items ?? []);

  // Si la catégorie initiale n'a aucune correspondance exacte dans cette source,
  // on bascule sur toutes les catégories pour ne jamais afficher une liste vide à tort.
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

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rawItems.filter((item) => {
      if (effectiveCategoryFilter && !matchesKitCategory(item.category, effectiveCategoryFilter)) {
        return false;
      }
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
  }, [effectiveCategoryFilter, maxWeightFilter, onlyWithWeight, query, rawItems]);

  if (!open || typeof document === 'undefined') return null;

  const isLoading = source !== 'inventory' && state[source]?.status === 'loading';
  const activeSourceIndex = Math.max(
    0,
    SOURCES.findIndex((s) => s.id === source),
  );

  return createPortal(
    <>
      <div className="lkdv-cv2c-stack-backdrop" aria-hidden="true" onClick={onClose} />
      <div
        className="lkdv-cv2c-stack-overlay"
        role="dialog"
        aria-modal="true"
        aria-label="Catalogue de matériel"
      >
        <div className="lkdv-cv2-grab" aria-hidden="true">
          <span />
        </div>
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
        </div>

        <div className="lkdv-cv2c-stack-body">
          {isLoading ? (
            <p className="lkdv-cv2-field-hint" style={{ padding: 16 }} role="status">
              <Loader2 size={14} className="lkdv-cv2c-spin" aria-hidden="true" /> Chargement…
            </p>
          ) : filtered.length === 0 ? (
            <div className="lkdv-cv2c-stack-empty">
              <b>Aucun produit trouvé</b>
              <small>Essaie une autre source ou recherche.</small>
            </div>
          ) : (
            <ul className="lkdv-cv2c-cat-list" role="list">
              {filtered.map((product) => {
                const thumb =
                  product.image || generatedProductImage(product.name, product.category ?? 'Matériel');
                const added = addedKeys.has(product.id) || addedKeys.has(product.key);
                return (
                  <li key={product.key} className="lkdv-cv2c-cat-row">
                    {/* eslint-disable-next-line @next/next/no-img-element -- vignette produit */}
                    <img src={thumb} alt="" className="lkdv-cv2c-cat-thumb" width={44} height={44} />
                    <div className="lkdv-cv2c-cat-meta">
                      <b className="lkdv-cv2c-cat-name">{product.name}</b>
                      <div className="lkdv-cv2c-cat-attrs">
                        <span className="is-name">{product.brand || product.category || 'Équipement'}</span>
                        <span className="is-dot" aria-hidden="true">·</span>
                        <span className="is-weight">{formatWeight(product.weightG)}</span>
                        <span className="is-dot" aria-hidden="true">·</span>
                        <span className="is-state">{stateLabel(product)}</span>
                      </div>
                    </div>
                    <div className="lkdv-cv2c-cat-actions">
                      <button
                        type="button"
                        className="lkdv-cv2c-prod-add"
                        data-added={added}
                        aria-label={`Ajouter ${product.name} au kit`}
                        onClick={() => onAddProduct(product, initialCategory || undefined)}
                      >
                        {added ? <Check size={13} aria-hidden="true" /> : <Plus size={13} aria-hidden="true" />}
                      </button>
                      <button
                        type="button"
                        className="lkdv-cv2c-prod-info"
                        aria-label={`Informations sur ${product.name}`}
                        onClick={() => setInfoProduct(product)}
                      >
                        <Info size={14} aria-hidden="true" />
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="lkdv-cv2c-stack-foot">
          <div className="lkdv-cv2c-stack-search">
            <Search size={14} aria-hidden="true" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Rechercher un produit…"
              aria-label="Rechercher un produit"
            />
          </div>
          <div className="lkdv-cv2c-stack-foot-right">
            <div className="lkdv-cv2c-filter-wrap">
              <button
                type="button"
                className="lkdv-cv2c-filter-btn"
                aria-expanded={catOpen}
                aria-label="Catégories"
                title="Catégories"
                data-active={Boolean(effectiveCategoryFilter)}
                onClick={() => {
                  setCatOpen((v) => !v);
                  setFilterOpen(false);
                }}
              >
                <Tag size={14} aria-hidden="true" />
              </button>
              {catOpen ? (
                <div className="lkdv-cv2c-filter-menu" role="listbox" aria-label="Catégories">
                  <span className="lkdv-cv2-field-label">Catégorie</span>
                  <div className="lkdv-cv2-chips">
                    <button
                      type="button"
                      className="lkdv-cv2-chip lkdv-cv2-chip--sm"
                      aria-pressed={!effectiveCategoryFilter}
                      onClick={() => {
                        setCategoryFilter('');
                        setCatOpen(false);
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
                          setCatOpen(false);
                        }}
                      >
                        {cat}
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
            <div className="lkdv-cv2c-filter-wrap">
              <button
                type="button"
                className="lkdv-cv2c-filter-btn"
                aria-expanded={filterOpen}
                aria-label="Filtres"
                title="Filtres"
                data-active={maxWeightFilter !== 'all' || onlyWithWeight}
                onClick={() => {
                  setFilterOpen((v) => !v);
                  setCatOpen(false);
                }}
              >
                <SlidersHorizontal size={14} aria-hidden="true" />
              </button>
              {filterOpen ? (
                <div className="lkdv-cv2c-filter-menu" role="dialog" aria-label="Filtres produits">
                  <span className="lkdv-cv2-field-label">Poids max</span>
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
                  </div>
                  <button
                    type="button"
                    className="lkdv-cv2-chip lkdv-cv2-chip--sm"
                    aria-pressed={onlyWithWeight}
                    onClick={() => setOnlyWithWeight((v) => !v)}
                  >
                    Avec poids connu
                  </button>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </div>

      {/* Tiroir superposé niveau 2 : Fiche produit blanche (20+20 améliorations) */}
      {infoProduct ? (
        <KitProductSheetV2
          product={infoProduct}
          initialCategory={initialCategory}
          currentKitWeightG={currentKitWeightG}
          onClose={() => setInfoProduct(null)}
          onAdd={(prod, overrides, keepOpen) => {
            onAddProduct(prod, overrides.category ?? (initialCategory || undefined), overrides);
            if (!keepOpen) setInfoProduct(null);
          }}
        />
      ) : null}
    </>,
    document.body,
  );
}
