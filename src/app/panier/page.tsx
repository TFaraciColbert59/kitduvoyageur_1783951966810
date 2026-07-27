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
      <div className="min-h-screen bg-[#F5F2E8]">
        <Header />
        <div className="pt-24 flex items-center justify-center min-h-[60vh]">
          <div className="w-8 h-8 border-2 border-[#1C2620] border-t-transparent rounded-full animate-spin" aria-label="Chargement du panier" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F5F2E8] text-[#1C2620] flex flex-col">
      <Header />

      {confirmDeleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/20 backdrop-blur-sm" role="dialog" aria-modal="true">
          <div className="bg-white border border-[#C8C3B0] rounded-3xl p-8 max-w-sm w-full shadow-2xl text-center">
            <h2 className="font-display font-700 text-xl mb-3">Retirer cet article ?</h2>
            <p className="text-sm text-[#5C6B5E] mb-6">
              {items.find((i) => i.id === confirmDeleteId)?.name} sera retiré de votre panier.
            </p>
            <div className="flex gap-3">
              <button onClick={handleRemoveCancel} className="flex-1 px-4 py-3 rounded-xl border border-[#C8C3B0] text-sm font-600 hover:bg-[#F5F2E8] transition-colors" autoFocus>Annuler</button>
              <button onClick={handleRemoveConfirm} className="flex-1 px-4 py-3 rounded-xl bg-red-600 hover:bg-red-700 text-white text-sm font-600 transition-colors">Retirer</button>
            </div>
          </div>
        </div>

      <main id="main-content" className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 w-full">
        {items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 gap-6 text-center">
            <div className="w-20 h-20 rounded-full bg-white border border-[#C8C3B0] flex items-center justify-center">
              <Icon name="ShoppingBagIcon" size={36} className="text-[#1C2620]/30" />
            </div>
            <div>
              <p className="font-display font-800 text-3xl text-[#1C2620] mb-2">Votre <em className="italic font-400 text-[#5C6B5E]">panier.</em> est vide</p>
              <p className="text-[#5C6B5E]">Explorez notre catalogue pour trouver votre équipement.</p>
            </div>
            <Link href="/catalogue" className="mt-4 bg-[#1C2620] hover:bg-[#2A3830] text-white px-8 py-3.5 rounded-xl font-600 text-sm transition-colors">
              Voir le catalogue
            </Link>
          </div>
        ) : (
          <>
            <div className="flex flex-col md:flex-row md:items-end justify-between mb-12 gap-4">
              <h1 className="font-display font-800 text-5xl text-[#1C2620]">
                Votre <em className="italic font-400 text-[#5C6B5E]">panier.</em>
              </h1>
              <p className="text-sm font-600 text-[#5C6B5E]">
                {totalItems} article{totalItems > 1 ? 's' : ''} · {totalWeightG >= 1000 ? `${(totalWeightG / 1000).toFixed(1).replace('.', ',')} kg` : `${totalWeightG} g`} · sous-total {totalPriceEur.toFixed(0)} €
              </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
              <div className="lg:col-span-7 xl:col-span-8 flex flex-col gap-6">
                
                {/* Cart items */}
                {items.map((item) => (
                  <div key={item.id} className={`bg-white border border-transparent hover:border-[#C8C3B0] rounded-3xl p-6 flex gap-6 transition-all duration-300 ${removingId === item.id ? 'opacity-0 scale-95' : 'opacity-100 scale-100'}`}>
                    <div className="w-32 h-32 flex-shrink-0 rounded-2xl overflow-hidden bg-[#F5F2E8] border border-[#EBE8DD]">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      {item.image ? <img src={item.image} alt={item.name} className="w-full h-full object-cover mix-blend-multiply" /> : null}
                    </div>
                    
                    <div className="flex-1 flex flex-col justify-between min-w-0">
                      <div className="flex justify-between items-start gap-4">
                        <div>
                          <p className="font-mono text-[10px] text-[#5C6B5E] uppercase tracking-wider mb-1">{item.category || 'PORTAGE'}</p>
                          <Link href={`/produit/${item.slug}`} className="font-display font-700 text-[#1C2620] text-xl hover:text-[#5C6B5E] transition-colors line-clamp-2">
                            {item.name.split(' ').map((word, i, arr) => 
                              i >= arr.length - 2 ? <em key={i} className="italic font-400 text-[#5C6B5E] ml-1">{word}</em> : <span key={i} className="mr-1">{word}</span>
                            )}
                          </Link>
                          <div className="flex items-center gap-2 mt-2 text-xs text-[#5C6B5E]">
                            <div className="w-3 h-3 rounded-full bg-[#2A3830]"></div>
                            <span>Vert forêt · {item.weightG >= 1000 ? `${(item.weightG / 1000).toFixed(1).replace('.', ',')} kg` : `${item.weightG} g`}</span>
                          </div>
                        </div>

                        <div className="flex flex-col items-end">
                          <div className="flex items-center gap-3 bg-[#F5F2E8] rounded-full px-1 py-1">
                            <button onClick={() => handleQuantity(item.id, item.quantity - 1)} className="w-7 h-7 flex items-center justify-center rounded-full bg-white text-[#1C2620] shadow-sm hover:bg-[#EBE8DD] transition-colors">
                              <Icon name="MinusIcon" size={12} />
                            </button>
                            <span className="w-4 text-center font-600 text-sm">{item.quantity}</span>
                            <button onClick={() => handleQuantity(item.id, item.quantity + 1)} className="w-7 h-7 flex items-center justify-center rounded-full bg-white text-[#1C2620] shadow-sm hover:bg-[#EBE8DD] transition-colors">
                              <Icon name="PlusIcon" size={12} />
                            </button>
                          </div>
                        </div>
                      </div>

                      <div className="flex justify-between items-end mt-4">
                        <div className="flex gap-4">
                          <button className="flex items-center gap-1.5 text-xs font-600 text-[#5C6B5E] hover:text-[#1C2620] transition-colors">
                            <Icon name="BookmarkIcon" size={14} variant="outline" />
                            Enregistrer
                          </button>
                          <button onClick={() => handleRemoveRequest(item.id)} className="flex items-center gap-1.5 text-xs font-600 text-[#5C6B5E] hover:text-red-600 transition-colors">
                            <Icon name="TrashIcon" size={14} variant="outline" />
                            Retirer
                          </button>
                        </div>
                        
                        <div className="text-right">
                          <p className="font-600 text-[#1C2620] text-xl">{(item.priceEur * item.quantity).toFixed(0)} €</p>
                          <p className="text-[10px] text-[#5C6B5E]">TVA incluse</p>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}

                {/* Upsell Section */}
                <div className="bg-[#EAF0EB] rounded-3xl p-6 flex items-center justify-between mt-4">
                  <div className="flex items-center gap-6">
                    <div className="w-20 h-20 flex-shrink-0 rounded-2xl bg-white/50 mix-blend-multiply overflow-hidden flex items-center justify-center p-2">
                      <img src="https://images.unsplash.com/photo-1572007886481-64539dc31d04?w=400&q=80" alt="Lampe" className="w-full h-full object-cover rounded-xl" />
                    </div>
                    <div>
                      <p className="font-mono text-[10px] text-[#2A3830] uppercase tracking-wider mb-1">ON A PENSÉ POUR VOUS</p>
                      <p className="font-display font-700 text-lg text-[#1C2620]">Lampe frontale <em className="italic font-400 text-[#5C6B5E]">350 lumens.</em></p>
                      <p className="text-xs text-[#5C6B5E] mt-1">Autonomie 45 h, batterie rechargeable. Souvent oubliée, jamais regrettée.</p>
                    </div>
                  </div>
                  <button className="flex items-center gap-2 bg-white px-4 py-2 rounded-full font-600 text-sm text-[#1C2620] shadow-sm hover:bg-[#F5F2E8] transition-colors">
                    84 € <Icon name="PlusIcon" size={14} />
                  </button>
                </div>
              </div>

              {/* Order summary */}
              <div className="lg:col-span-5 xl:col-span-4">
                <div className="bg-white border border-[#C8C3B0] rounded-3xl p-8 sticky top-24">
                  <h3 className="font-display font-700 text-xl mb-6">Récapitulatif</h3>
                  
                  <div className="space-y-4 mb-8">
                    <div className="flex justify-between text-sm">
                      <span className="text-[#5C6B5E]">Sous-total ({totalItems} articles)</span>
                      <span className="font-600">{totalPriceEur.toFixed(0)} €</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-[#5C6B5E]">Poids total</span>
                      <span className="font-600">{totalWeightG >= 1000 ? `${(totalWeightG / 1000).toFixed(1).replace('.', ',')} kg` : `${totalWeightG} g`}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-[#5C6B5E]">Livraison suivie</span>
                      <span className="font-600 text-[#2A3830]">{shippingEur === 0 ? 'Offerte' : `${shippingEur.toFixed(2)} €`}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-[#5C6B5E]">Estimation TVA</span>
                      <span className="font-600 text-[#5C6B5E]">Incluse</span>
                    </div>
                  </div>

                  <div className="flex gap-2 mb-8">
                    <input type="text" placeholder="Code promo" className="flex-1 px-4 py-3 bg-[#F5F2E8] rounded-xl text-sm focus:outline-none focus:ring-1 focus:ring-[#1C2620]" />
                    <button className="bg-[#1C2620] text-white px-6 py-3 rounded-xl font-600 text-sm hover:bg-[#2A3830] transition-colors">Appliquer</button>
                  </div>

                  <div className="flex justify-between items-end font-display font-800 text-2xl pt-6 border-t border-[#C8C3B0]/50 mb-6">
                    <span className="text-xl">Total à payer</span>
                    <span>{grandTotal.toFixed(0)} €</span>
                  </div>

                  <Link href="/checkout" className="block text-center w-full bg-[#2A3830] hover:bg-[#1C2620] text-white py-4 rounded-xl font-600 transition-colors mb-4">
                    Passer au paiement
                  </Link>
                  <p className="text-center text-[10px] text-[#5C6B5E] flex items-center justify-center gap-1.5 mb-8">
                    <Icon name="LockClosedIcon" size={12} /> Paiement sécurisé Stripe
                  </p>

                  <div className="flex justify-center gap-2 mb-6 opacity-60">
                    {/* Fake payment logos */}
                    <div className="px-3 py-1.5 border border-[#C8C3B0] rounded text-[10px] font-600 font-mono">VISA</div>
                    <div className="px-3 py-1.5 border border-[#C8C3B0] rounded text-[10px] font-600 font-mono">MC</div>
                    <div className="px-3 py-1.5 border border-[#C8C3B0] rounded text-[10px] font-600 font-mono">AMEX</div>
                    <div className="px-3 py-1.5 border border-[#C8C3B0] rounded text-[10px] font-600 font-mono">Apple Pay</div>
                  </div>

                  <div className="bg-[#F5F2E8] rounded-2xl p-4 flex justify-between gap-2 text-center text-[10px] font-600 text-[#5C6B5E]">
                    <div className="flex flex-col items-center gap-2 flex-1">
                      <Icon name="StarIcon" size={16} /> Garantie à vie
                    </div>
                    <div className="flex flex-col items-center gap-2 flex-1">
                      <Icon name="ArrowPathIcon" size={16} /> Retour 30 j.
                    </div>
                    <div className="flex flex-col items-center gap-2 flex-1">
                      <Icon name="MapPinIcon" size={16} /> 100 % Europe
                    </div>
                  </div>

                </div>
              </div>
            </div>
          </>
        )}
      </main>

      <div className="bg-[#1C2620] text-white pt-16 pb-12 mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row justify-between gap-12">
            <div className="max-w-sm">
              <h4 className="font-display font-800 text-2xl mb-2">
                Ce que vous emportez, <em className="italic font-400 text-[#A3B1A6]">c'est votre voyage.</em>
              </h4>
              <p className="text-xs text-[#A3B1A6]">Grenoble, France</p>
            </div>
            <div className="flex gap-16 text-sm">
              <div className="flex flex-col gap-3">
                <span className="font-mono text-[10px] text-[#A3B1A6] tracking-wider uppercase mb-2">Boutique</span>
                <Link href="#" className="hover:text-white transition-colors">Catalogue</Link>
                <Link href="#" className="hover:text-white transition-colors">Configurateur</Link>
              </div>
              <div className="flex flex-col gap-3">
                <span className="font-mono text-[10px] text-[#A3B1A6] tracking-wider uppercase mb-2">Maison</span>
                <Link href="#" className="hover:text-white transition-colors">Méthode</Link>
              </div>
              <div className="flex flex-col gap-3">
                <span className="font-mono text-[10px] text-[#A3B1A6] tracking-wider uppercase mb-2">Service</span>
                <Link href="#" className="hover:text-white transition-colors">Livraison</Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}