'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import Header from '@/components/Header';
import Icon from '@/components/ui/AppIcon';
import { getCart, updateQuantity, removeFromCart, getCartTotals, CartItem } from '@/lib/cart';
import NewFooterSection from '@/app/components/home/NewFooterSection';

// ─────────────────────────────────────────────────────────────────────────────
// SUGGESTION PRODUCT
// ─────────────────────────────────────────────────────────────────────────────
const SUGGESTION = {
  categorie: 'ÉCLAIRAGE',
  nom: 'Lampe frontale',
  nomItalic: '350 lm.',
  description: 'Autonomie 45 h, batterie rechargeable. Souvent oubliée, jamais regrettée.',
  prix: 84,
  image: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=200&q=80',
  alt: 'Lampe frontale noire rechargeable 350 lumens',
  slug: 'lampe-frontale-350lm',
};

// ─────────────────────────────────────────────────────────────────────────────
// CART ITEM ROW
// ─────────────────────────────────────────────────────────────────────────────
function CartItemRow({
  item,
  onQuantity,
  onRemove,
  removing,
}: {
  item: CartItem;
  onQuantity: (id: string, qty: number) => void;
  onRemove: (id: string) => void;
  removing: boolean;
}) {
  return (
    <div
      className={`flex items-start gap-5 py-6 border-b border-[#E8E4DA] transition-all duration-300 ${removing ? 'opacity-0 scale-95' : 'opacity-100'}`}
    >
      {/* Image */}
      <div className="w-24 h-24 rounded-xl overflow-hidden flex-shrink-0 bg-[#EDE9DF]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={item.image} alt={item.imageAlt} className="w-full h-full object-cover" />
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className="text-[10px] font-mono text-[#7A7A6E] uppercase tracking-widest mb-0.5">{item.category}</p>
        <Link href={`/produit/${item.slug}`} className="font-display font-700 text-[#1C2620] text-lg leading-tight hover:opacity-70 transition-opacity" style={{ fontFamily: 'var(--font-display)' }}>
          {item.name.includes('toile') || item.name.includes('titane') || item.name.includes('saisons') ? (
            <>
              {item.name.split(' ').slice(0, -2).join(' ')}{' '}
              <em className="italic font-normal">{item.name.split(' ').slice(-2).join(' ')}.</em>
            </>
          ) : (
            <>{item.name}.</>
          )}
        </Link>
        <div className="flex items-center gap-3 mt-1.5 flex-wrap">
          <span className="flex items-center gap-1 text-xs text-[#5C6B5E]">
            <span className="w-2 h-2 rounded-full bg-[#4A6741]" />
            {item.brand}
          </span>
          {item.weightG > 0 && (
            <span className="text-xs text-[#7A7A6E]">
              {item.weightG >= 1000 ? `${(item.weightG / 1000).toFixed(1)} kg` : `${item.weightG} g`}
            </span>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-4 mt-3">
          <button
            onClick={() => onRemove(item.id)}
            className="flex items-center gap-1 text-xs text-[#7A7A6E] hover:text-[#1C2620] transition-colors"
          >
            <Icon name="TrashIcon" size={12} variant="outline" />
            Retirer
          </button>
          <button className="flex items-center gap-1 text-xs text-[#7A7A6E] hover:text-[#1C2620] transition-colors">
            <Icon name="BookmarkIcon" size={12} variant="outline" />
            Enregistrer
          </button>
        </div>
      </div>

      {/* Qty + Price */}
      <div className="flex flex-col items-end gap-3 flex-shrink-0">
        {/* Quantity */}
        <div className="flex items-center gap-1 border border-[#E8E4DA] rounded-full overflow-hidden bg-white">
          <button
            onClick={() => onQuantity(item.id, item.quantity - 1)}
            className="w-9 h-9 flex items-center justify-center text-[#7A7A6E] hover:text-[#1C2620] hover:bg-[#F5F2EC] transition-all"
            aria-label="Diminuer"
          >
            <Icon name="MinusIcon" size={12} variant="outline" />
          </button>
          <span className="w-7 text-center text-sm font-semibold text-[#1C2620]">{item.quantity}</span>
          <button
            onClick={() => onQuantity(item.id, item.quantity + 1)}
            className="w-9 h-9 flex items-center justify-center text-[#7A7A6E] hover:text-[#1C2620] hover:bg-[#F5F2EC] transition-all"
            aria-label="Augmenter"
          >
            <Icon name="PlusIcon" size={12} variant="outline" />
          </button>
        </div>

        {/* Price */}
        <div className="text-right">
          <p className="font-display font-700 text-xl text-[#1C2620]">{(item.priceEur * item.quantity).toFixed(0)} €</p>
          <p className="text-[10px] text-[#7A7A6E]">TVA incluse</p>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SUGGESTION ROW
// ─────────────────────────────────────────────────────────────────────────────
function SuggestionRow({ onAdd }: { onAdd: () => void }) {
  const [added, setAdded] = useState(false);

  const handleAdd = () => {
    onAdd();
    setAdded(true);
    setTimeout(() => setAdded(false), 2000);
  };

  return (
    <div className="flex items-start gap-5 py-6 rounded-2xl bg-[#EDE9DF] px-5 mt-2">
      <div className="w-20 h-20 rounded-xl overflow-hidden flex-shrink-0 bg-[#D8D3C8]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={SUGGESTION.image} alt={SUGGESTION.alt} className="w-full h-full object-cover" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[10px] font-mono text-[#4A6741] uppercase tracking-widest font-semibold mb-0.5">ON A PENSÉ POUR VOUS</p>
        <p className="font-display font-700 text-[#1C2620] text-base leading-tight" style={{ fontFamily: 'var(--font-display)' }}>
          {SUGGESTION.nom} <em className="italic font-normal">{SUGGESTION.nomItalic}</em>
        </p>
        <p className="text-xs text-[#7A7A6E] mt-1 leading-relaxed">{SUGGESTION.description}</p>
      </div>
      <div className="flex items-center gap-3 flex-shrink-0">
        <span className="font-semibold text-[#1C2620] text-sm">{SUGGESTION.prix} €</span>
        <button
          onClick={handleAdd}
          className="w-8 h-8 rounded-full border border-[#1C2620] flex items-center justify-center hover:bg-[#1C2620] hover:text-white transition-all text-[#1C2620]"
          aria-label="Ajouter au panier"
        >
          <Icon name={added ? 'CheckIcon' : 'PlusIcon'} size={14} variant="outline" />
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ORDER SUMMARY PANEL
// ─────────────────────────────────────────────────────────────────────────────
function OrderSummary({
  totalItems,
  totalPriceEur,
  totalWeightG,
  shippingEur,
  grandTotal,
}: {
  totalItems: number;
  totalPriceEur: number;
  totalWeightG: number;
  shippingEur: number;
  grandTotal: number;
}) {
  const [promoCode, setPromoCode] = useState('');
  const [promoApplied, setPromoApplied] = useState(false);
  const [promoError, setPromoError] = useState(false);

  const handlePromo = () => {
    if (promoCode.trim().toUpperCase() === 'KDV10') {
      setPromoApplied(true);
      setPromoError(false);
    } else {
      setPromoError(true);
      setPromoApplied(false);
    }
  };

  const TRUST = [
    { icon: '⭐', label: 'Garantie à vie' },
    { icon: '↩', label: 'Retour 30 j.' },
    { icon: '✓', label: '100 % Europe' },
  ];

  const PAYMENT_ICONS = ['VISA', 'MC', 'AMEX', 'Apple Pay', 'PayPal'];

  return (
    <div className="sticky top-24 rounded-2xl bg-white border border-[#E8E4DA] overflow-hidden">
      <div className="p-6">
        <h2 className="font-display font-700 text-xl text-[#1C2620] mb-6" style={{ fontFamily: 'var(--font-display)' }}>
          Récapitulatif
        </h2>

        {/* Lines */}
        <div className="space-y-3 mb-6">
          <div className="flex justify-between text-sm">
            <span className="text-[#7A7A6E]">Sous-total ({totalItems} article{totalItems !== 1 ? 's' : ''})</span>
            <span className="font-semibold text-[#1C2620]">{totalPriceEur.toFixed(0)} €</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-[#7A7A6E]">Poids total</span>
            <span className="font-semibold text-[#1C2620]">
              {totalWeightG >= 1000 ? `${(totalWeightG / 1000).toFixed(1)} kg` : `${totalWeightG} g`}
            </span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-[#7A7A6E]">Livraison suivie</span>
            <span className={`font-semibold ${shippingEur === 0 ? 'text-[#4A6741]' : 'text-[#1C2620]'}`}>
              {shippingEur === 0 ? 'Offerte' : `${shippingEur.toFixed(2)} €`}
            </span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-[#7A7A6E]">Estimation TVA</span>
            <span className="font-semibold text-[#1C2620]">Incluse</span>
          </div>
          {promoApplied && (
            <div className="flex justify-between text-sm">
              <span className="text-[#4A6741] font-medium">Code promo KDV10</span>
              <span className="font-semibold text-[#4A6741]">-{(totalPriceEur * 0.1).toFixed(0)} €</span>
            </div>
          )}
        </div>

        {/* Promo code */}
        <div className="flex gap-2 mb-6">
          <input
            type="text"
            value={promoCode}
            onChange={e => { setPromoCode(e.target.value); setPromoError(false); }}
            placeholder="Code promo"
            className={`flex-1 px-4 py-2.5 rounded-xl border text-sm text-[#1C2620] bg-[#F5F2EC] focus:outline-none transition-colors ${promoError ? 'border-red-400' : 'border-[#E8E4DA] focus:border-[#1C2620]'}`}
          />
          <button
            onClick={handlePromo}
            className="px-5 py-2.5 rounded-xl bg-[#1C2620] text-white text-sm font-semibold hover:opacity-80 transition-opacity"
          >
            Appliquer
          </button>
        </div>
        {promoError && <p className="text-xs text-red-500 -mt-4 mb-4">Code invalide. Essayez KDV10.</p>}

        {/* Total */}
        <div className="flex justify-between items-center py-4 border-t border-[#E8E4DA] mb-5">
          <span className="font-display font-700 text-[#1C2620] text-lg">Total à payer</span>
          <span className="font-display font-800 text-3xl text-[#1C2620]" style={{ fontFamily: 'var(--font-display)' }}>
            {(promoApplied ? grandTotal * 0.9 : grandTotal).toFixed(0)} €
          </span>
        </div>

        {/* CTA */}
        <Link
          href="/checkout"
          className="w-full flex items-center justify-center gap-2 py-4 rounded-full font-semibold text-white text-sm transition-all hover:opacity-90 active:scale-95"
          style={{ background: '#1C2620' }}
        >
          <Icon name="LockClosedIcon" size={16} variant="outline" />
          Passer au paiement
        </Link>

        <p className="flex items-center justify-center gap-1.5 text-xs text-[#7A7A6E] mt-3">
          <Icon name="ShieldCheckIcon" size={12} variant="outline" />
          Paiement sécurisé Stripe
        </p>

        {/* Payment icons */}
        <div className="flex items-center justify-center gap-2 mt-4 flex-wrap">
          {PAYMENT_ICONS.map(p => (
            <span key={p} className="px-2.5 py-1 rounded-lg border border-[#E8E4DA] text-[10px] font-mono text-[#7A7A6E] bg-[#F5F2EC]">{p}</span>
          ))}
        </div>

        {/* Trust badges */}
        <div className="flex items-center justify-around mt-5 pt-5 border-t border-[#E8E4DA]">
          {TRUST.map(t => (
            <div key={t.label} className="flex flex-col items-center gap-1 text-center">
              <span className="text-lg">{t.icon}</span>
              <span className="text-[10px] text-[#7A7A6E] font-medium">{t.label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN PAGE
// ─────────────────────────────────────────────────────────────────────────────
export default function PanierPage() {
  const [items, setItems] = useState<CartItem[]>([]);
  const [mounted, setMounted] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);

  useEffect(() => {
    setItems(getCart());
    setMounted(true);
  }, []);

  const handleQuantity = (id: string, qty: number) => {
    setItems(updateQuantity(id, qty));
  };

  const handleRemove = (id: string) => {
    setRemovingId(id);
    setTimeout(() => {
      setItems(removeFromCart(id));
      setRemovingId(null);
    }, 300);
  };

  const handleAddSuggestion = () => {
    // Add suggestion to cart via cart lib
    const { addToCart } = require('@/lib/cart');
    addToCart({
      id: SUGGESTION.slug,
      slug: SUGGESTION.slug,
      name: `${SUGGESTION.nom} ${SUGGESTION.nomItalic.replace('.', '')}`,
      brand: 'Le Kit du Voyageur',
      category: SUGGESTION.categorie,
      priceEur: SUGGESTION.prix,
      weightG: 88,
      image: SUGGESTION.image,
      imageAlt: SUGGESTION.alt,
    });
    setItems(getCart());
  };

  const { totalItems, totalPriceEur, totalWeightG } = getCartTotals(items);
  const shippingEur = totalPriceEur >= 200 ? 0 : 5.9;
  const grandTotal = totalPriceEur + shippingEur;

  if (!mounted) {
    return (
      <div className="min-h-screen" style={{ background: '#F5F2EC' }}>
        <Header />
        <div className="pt-24 flex items-center justify-center min-h-[60vh]">
          <div className="w-8 h-8 border-2 border-[#1C2620] border-t-transparent rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ background: '#F5F2EC', color: '#1C2620' }}>
      <Header />

      {/* Breadcrumb */}
      <div className="pt-20">
        <div className="max-w-7xl mx-auto px-5 sm:px-8 lg:px-12 py-4">
          <nav className="flex items-center gap-2 text-xs text-[#7A7A6E]" aria-label="Fil d'Ariane">
            <Link href="/" className="hover:text-[#1C2620] transition-colors">Accueil</Link>
            <span>/</span>
            <Link href="/boutique" className="hover:text-[#1C2620] transition-colors">Boutique</Link>
            <span>/</span>
            <span className="text-[#1C2620] font-medium">Panier</span>
          </nav>
        </div>
      </div>

      <main className="max-w-7xl mx-auto px-5 sm:px-8 lg:px-12 pb-24">
        {/* Title row */}
        <div className="flex items-end justify-between mb-10">
          <h1 className="font-display font-800 text-5xl lg:text-6xl text-[#1C2620] leading-none tracking-tight" style={{ fontFamily: 'var(--font-display)' }}>
            Votre <em className="italic font-normal">panier.</em>
          </h1>
          {items.length > 0 && (
            <p className="text-sm text-[#7A7A6E] hidden sm:block">
              {totalItems} article{totalItems !== 1 ? 's' : ''} · {totalWeightG >= 1000 ? `${(totalWeightG / 1000).toFixed(1)} kg` : `${totalWeightG} g`} · sous-total {totalPriceEur.toFixed(0)} €
            </p>
          )}
        </div>

        {items.length === 0 ? (
          /* Empty state */
          <div className="flex flex-col items-center justify-center py-32 gap-6 text-center">
            <div className="w-20 h-20 rounded-full bg-white border border-[#E8E4DA] flex items-center justify-center">
              <Icon name="ShoppingBagIcon" size={36} variant="outline" className="text-[#C8C3B0]" />
            </div>
            <div>
              <p className="font-display font-700 text-2xl text-[#1C2620] mb-2">Votre panier est vide</p>
              <p className="text-[#7A7A6E] text-sm">Explorez notre catalogue pour trouver votre équipement.</p>
            </div>
            <Link
              href="/boutique"
              className="px-8 py-3 rounded-full bg-[#1C2620] text-white text-sm font-semibold hover:opacity-80 transition-opacity"
            >
              Voir la boutique
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
            {/* LEFT: Items */}
            <div className="lg:col-span-2">
              {/* Cart items */}
              <div className="bg-white rounded-2xl border border-[#E8E4DA] px-6">
                {items.map((item) => (
                  <CartItemRow
                    key={item.id}
                    item={item}
                    onQuantity={handleQuantity}
                    onRemove={handleRemove}
                    removing={removingId === item.id}
                  />
                ))}
              </div>

              {/* Suggestion */}
              <SuggestionRow onAdd={handleAddSuggestion} />

              {/* Continue shopping */}
              <Link
                href="/boutique"
                className="flex items-center gap-2 text-sm text-[#7A7A6E] hover:text-[#1C2620] transition-colors mt-6 w-fit"
              >
                <Icon name="ArrowLeftIcon" size={14} variant="outline" />
                Continuer les achats
              </Link>
            </div>

            {/* RIGHT: Summary */}
            <div className="lg:col-span-1">
              <OrderSummary
                totalItems={totalItems}
                totalPriceEur={totalPriceEur}
                totalWeightG={totalWeightG}
                shippingEur={shippingEur}
                grandTotal={grandTotal}
              />
            </div>
          </div>
        )}
      </main>

      <NewFooterSection />

      {/* Mobile sticky bottom */}
      {items.length > 0 && (
        <div className="fixed bottom-0 left-0 right-0 z-40 lg:hidden bg-white border-t border-[#E8E4DA] px-4 py-3 flex items-center gap-3 shadow-lg">
          <div className="flex-1">
            <p className="text-xs text-[#7A7A6E]">{totalItems} article{totalItems !== 1 ? 's' : ''} · {totalWeightG >= 1000 ? `${(totalWeightG / 1000).toFixed(1)} kg` : `${totalWeightG} g`}</p>
            <p className="font-display font-700 text-[#1C2620] text-sm">Sous-total {totalPriceEur.toFixed(0)} €</p>
          </div>
          <div className="flex items-center gap-2">
            <p className="font-display font-800 text-xl text-[#1C2620]">{grandTotal.toFixed(0)} €</p>
            <Link
              href="/checkout"
              className="px-6 py-3 rounded-full bg-[#1C2620] text-white text-sm font-semibold hover:opacity-80 transition-opacity"
            >
              Passer au paiement
            </Link>
          </div>
        </div>
      )}
      {items.length > 0 && <div className="h-20 lg:hidden" />}
    </div>
  );
}