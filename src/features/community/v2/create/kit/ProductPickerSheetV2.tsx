'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Backpack, Loader2, Search, ShoppingBag } from 'lucide-react';
import { addToCart } from '@/lib/cart';
import { buildCartItemFromProduct } from '@/hooks/useEquipment';
import { useToast } from '@/contexts/ToastContext';
import { matchesQuery } from '@/features/community/create/kit/catalog';
import { useKitCatalog } from '@/features/community/create/kit/useKitCatalog';
import type { PickerProduct } from '@/features/community/create/kit/types';

/**
 * Sélecteur de produit du Kit, **en sous-tiroir empilé** (via `detail` de la
 * coque) : plus de dialogue dans le dialogue (`Kit#2`). Recherche, catégories,
 * inventaire de l'utilisateur et boutique → panier existant (`addToCart`).
 */
export function ProductPickerSheetV2({
  inventory,
  inventoryLoading,
  inventoryError,
  onRetryInventory,
  onPick,
}: {
  inventory: PickerProduct[];
  inventoryLoading: boolean;
  inventoryError: string | null;
  onRetryInventory: () => void;
  onPick: (product: PickerProduct) => void;
}) {
  const { toast } = useToast();
  const [scope, setScope] = useState<'inventory' | 'boutique'>('inventory');
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<string>('');
  const remote = useKitCatalog();

  useEffect(() => {
    if (scope === 'boutique') void remote.load('achat');
  }, [remote, scope]);

  const source = scope === 'inventory' ? inventory : remote.state.achat.items;
  const loading = scope === 'inventory' ? inventoryLoading : remote.state.achat.status === 'loading';
  const error = scope === 'inventory' ? inventoryError : remote.state.achat.status === 'error' ? 'Boutique indisponible.' : null;

  const categories = useMemo(() => {
    const values = new Set<string>();
    for (const item of source) {
      const value = item.category?.trim();
      if (value) values.add(value);
    }
    return [...values].sort((left, right) => left.localeCompare(right, 'fr'));
  }, [source]);

  const filtered = useMemo(
    () =>
      source.filter((item) => {
        if (category && item.category !== category) return false;
        if (!query.trim()) return true;
        return matchesQuery(item, query);
      }),
    [category, query, source],
  );

  const addToBasket = (product: PickerProduct) => {
    if (!product.cartable) {
      toast('Produit non achetable en ligne.', 'info');
      return;
    }
    const built = buildCartItemFromProduct(product.cartable, 1);
    if (!built.ok) {
      toast('Prix inconnu : impossible de l’ajouter au panier.', 'error');
      return;
    }
    const { quantity: _quantity, ...item } = built.item;
    addToCart(item, 1);
    toast('Ajouté au panier.', 'success');
  };

  return (
    <div className="lkdv-cv2c-product-tools">
      <div className="lkdv-cv2c-product-search">
        <div className="lkdv-cv2c-place">
          <Search size={16} aria-hidden="true" />
          <input
            type="search"
            className="lkdv-cv2-input"
            value={query}
            placeholder="Chercher un produit"
            aria-label="Chercher un produit"
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>
      </div>
      <div className="lkdv-cv2-seg lkdv-cv2c-seg" role="group" aria-label="Source du produit">
        <button type="button" aria-pressed={scope === 'inventory'} onClick={() => setScope('inventory')}>
          <Backpack size={13} aria-hidden="true" /> Inventaire
        </button>
        <button type="button" aria-pressed={scope === 'boutique'} onClick={() => setScope('boutique')}>
          <ShoppingBag size={13} aria-hidden="true" /> Boutique
        </button>
      </div>
      {categories.length > 0 ? (
        <div className="lkdv-cv2-chips">
          <button
            type="button"
            className="lkdv-cv2-chip lkdv-cv2-chip--sm"
            aria-pressed={category === ''}
            onClick={() => setCategory('')}
          >
            Toutes
          </button>
          {categories.map((entry) => (
            <button
              key={entry}
              type="button"
              className="lkdv-cv2-chip lkdv-cv2-chip--sm"
              aria-pressed={category === entry}
              onClick={() => setCategory(entry)}
            >
              {entry}
            </button>
          ))}
        </div>
      ) : null}
      {loading ? (
        <p className="lkdv-cv2-field-hint" role="status">
          <Loader2 size={12} className="lkdv-cv2c-spin" aria-hidden="true" /> Chargement…
        </p>
      ) : null}
      {error ? (
        <div className="lkdv-cv2-field">
          <p className="lkdv-cv2-field-error" role="alert">
            {error}
          </p>
          {scope === 'inventory' ? (
            <button type="button" className="lkdv-cv2-chip lkdv-cv2-chip--sm" onClick={onRetryInventory}>
              Réessayer
            </button>
          ) : null}
        </div>
      ) : null}
      {!loading && !error && filtered.length === 0 ? (
        // Message unique de la maquette (HTML L3242).
        <p className="lkdv-cv2c-empty">Aucun produit trouvé.</p>
      ) : null}
      {filtered.length > 0 ? (
        <ul className="lkdv-cv2c-product-list">
          {filtered.map((product) => (
            <li key={product.key}>
              <div className="lkdv-cv2c-product-row">
                <button
                  type="button"
                  className="lkdv-cv2c-product-main"
                  onClick={() => {
                    if (scope === 'inventory') onPick(product);
                    else addToBasket(product);
                  }}
                >
                  <b>{product.name}</b>
                  <small>
                    {[product.brand, product.category, product.weightG ? `${product.weightG} g` : '', product.priceLabel]
                      .filter(Boolean)
                      .join(' · ')}
                  </small>
                </button>
                {scope === 'boutique' ? (
                  <button
                    type="button"
                    className="lkdv-cv2-chip lkdv-cv2-chip--sm"
                    onClick={() => addToBasket(product)}
                    aria-label={`Acheter ${product.name}`}
                  >
                    Acheter
                  </button>
                ) : (
                  <button
                    type="button"
                    className="lkdv-cv2-chip lkdv-cv2-chip--sm"
                    onClick={() => onPick(product)}
                    aria-label={`Ajouter ${product.name} au kit`}
                  >
                    Ajouter
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

export default ProductPickerSheetV2;
