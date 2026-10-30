'use client';

import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import Icon from '@/components/ui/Icon';
import { useToast } from '@/contexts/ToastContext';
import { addToCart } from '@/lib/cart';
import { buildCartItemFromProduct } from '@/hooks/useEquipment';
import { Carousel } from '@/features/community/card/explore/Carousel';
import { chunk, matchesQuery } from './catalog';
import { SHOP_SOURCES, type KitSource, type PickerProduct } from './types';
import { useKitCatalog } from './useKitCatalog';
import { WearBar } from './WearBar';

const PER_PAGE = 4;

/**
 * Sélecteur de produit, posé par-dessus le drawer (portail dans la carte) :
 * recherche en haut, grille balayée par pages de quatre, et en bas à droite le
 * sélecteur Inventaire / Boutique (la boutique se précise en Achat, Location,
 * Occasion ou Prêt). Seuls les produits d'achat ont un bouton panier.
 */
export function KitProductPicker({
  userId,
  onPick,
  onClose,
}: {
  userId: string | undefined;
  onPick: (product: PickerProduct) => void;
  onClose: () => void;
}) {
  const anchor = useRef<HTMLSpanElement>(null);
  const [host, setHost] = useState<Element | null>(null);
  const [scope, setScope] = useState<'inventory' | 'boutique'>('inventory');
  const [shop, setShop] = useState<Exclude<KitSource, 'inventory'>>('achat');
  const [query, setQuery] = useState('');
  const { toast } = useToast();
  const { state, load } = useKitCatalog(userId);
  const searchId = useId();
  const source: KitSource = scope === 'inventory' ? 'inventory' : shop;
  const current = state[source];

  useEffect(() => {
    setHost(anchor.current?.closest('.lkdv-cd') ?? null);
  }, []);

  useEffect(() => {
    void load(source);
  }, [load, source]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      // Échap ferme le sélecteur seul, pas tout le drawer.
      event.stopPropagation();
      onClose();
    };
    document.addEventListener('keydown', onKey, true);
    return () => document.removeEventListener('keydown', onKey, true);
  }, [onClose]);

  const visible = useMemo(
    () => current.items.filter((item) => matchesQuery(item, query)),
    [current.items, query]
  );
  const pages = useMemo(() => chunk(visible, PER_PAGE), [visible]);

  const sendToCart = (product: PickerProduct) => {
    if (!product.cartable) return;
    const built = buildCartItemFromProduct(product.cartable, 1);
    if (!built.ok) {
      toast('Prix inconnu : impossible de l’ajouter au panier.', 'error');
      return;
    }
    const { quantity: _quantity, ...item } = built.item;
    addToCart(item, 1);
    toast('Ajouté au panier.', 'success');
  };

  const body = (() => {
    if (current.status === 'idle' || current.status === 'loading') {
      return (
        <p className="lkdv-kp-note" role="status">
          Chargement…
        </p>
      );
    }
    if (current.status === 'error') {
      return (
        <div className="lkdv-kp-note">
          <p>Liste indisponible pour l’instant.</p>
          <button
            type="button"
            className="lkdv-ex-secondary"
            onClick={() => void load(source, true)}
          >
            Réessayer
          </button>
        </div>
      );
    }
    if (visible.length === 0) {
      return (
        <p className="lkdv-kp-note">
          {query.trim()
            ? `Rien pour « ${query.trim()} ».`
            : source === 'inventory'
              ? 'Ton inventaire est vide. Choisis la boutique en bas à droite.'
              : 'Aucune annonce pour l’instant.'}
        </p>
      );
    }
    return (
      <Carousel
        label="Produits"
        resetKey={`${source}|${query}`}
        pages={pages.map((page, index) => (
          <ul key={index} className="lkdv-kp-grid">
            {page.map((product) => (
              <li key={product.key} className="lkdv-kp-item">
                <button
                  type="button"
                  className="lkdv-kp-card"
                  onClick={() => onPick(product)}
                  aria-label={`Ajouter ${product.name} au kit`}
                >
                  <span className="lkdv-kp-img" aria-hidden="true">
                    {product.image ? (
                      // eslint-disable-next-line @next/next/no-img-element -- images de catalogue distantes
                      <img src={product.image} alt="" loading="lazy" decoding="async" />
                    ) : (
                      <b>{product.name.charAt(0).toUpperCase()}</b>
                    )}
                  </span>
                  <span className="lkdv-kp-txt">
                    <b>{product.name}</b>
                    <small>
                      {[product.brand, product.priceLabel].filter(Boolean).join(' · ') ||
                        product.category ||
                        ' '}
                    </small>
                  </span>
                  {product.wear !== null ? <WearBar percent={product.wear} /> : null}
                </button>
                {product.cartable ? (
                  <button
                    type="button"
                    className="lkdv-kp-cart"
                    aria-label={`Ajouter ${product.name} au panier`}
                    onClick={() => sendToCart(product)}
                  >
                    <Icon name="shopping-cart" size={15} aria-hidden="true" />
                  </button>
                ) : null}
              </li>
            ))}
          </ul>
        ))}
      />
    );
  })();

  return (
    <>
      <span ref={anchor} hidden />
      {host
        ? createPortal(
            <div
              className="lkdv-kp"
              role="dialog"
              aria-label="Choisir un produit"
              data-no-swipe="true"
            >
              <div className="lkdv-kp-head">
                <label className="lkdv-kp-search" htmlFor={searchId}>
                  <Icon name="search" size={16} aria-hidden="true" />
                  <input
                    id={searchId}
                    type="search"
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Chercher un produit"
                    aria-label="Chercher un produit"
                  />
                </label>
                <button
                  type="button"
                  className="lkdv-kp-close"
                  aria-label="Fermer le choix de produit"
                  onClick={onClose}
                >
                  <Icon name="x" size={18} aria-hidden="true" />
                </button>
              </div>

              <div className="lkdv-kp-body">{body}</div>

              <div className="lkdv-kp-selectors">
                {scope === 'boutique' ? (
                  <div className="lkdv-kp-seg" role="tablist" aria-label="Rubrique de la boutique">
                    {SHOP_SOURCES.map((entry) => (
                      <button
                        key={entry.id}
                        type="button"
                        role="tab"
                        aria-selected={shop === entry.id}
                        onClick={() => setShop(entry.id)}
                      >
                        {entry.label}
                      </button>
                    ))}
                  </div>
                ) : null}
                <div className="lkdv-kp-seg" role="tablist" aria-label="Source des produits">
                  <button
                    type="button"
                    role="tab"
                    aria-selected={scope === 'inventory'}
                    onClick={() => setScope('inventory')}
                  >
                    Inventaire
                  </button>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={scope === 'boutique'}
                    onClick={() => setScope('boutique')}
                  >
                    Boutique
                  </button>
                </div>
              </div>
            </div>,
            host
          )
        : null}
    </>
  );
}

export default KitProductPicker;
