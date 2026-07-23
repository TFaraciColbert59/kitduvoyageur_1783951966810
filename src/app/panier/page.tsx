'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { getCart, updateQuantity, removeFromCart, getCartTotals, CartItem } from '@/lib/cart';

const SUGGESTED = {
  id: 'lampe-frontale',
  slug: 'lampe-frontale-350lm',
  category: 'ÉCLAIRAGE',
  name: 'Lampe frontale',
  nameItalic: '350 lumens.',
  desc: 'Autonomie 45 h, batterie rechargeable. Souvent oubliée, jamais regrettée.',
  price: 84,
  image: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=300&q=80',
  alt: 'Lampe frontale 350 lumens rechargeable pour la randonnée nocturne',
  weightG: 95,
  brand: 'Le Kit du Voyageur',
};

export default function PanierPage() {
  const [items, setItems] = useState<CartItem[]>([]);
  const [mounted, setMounted] = useState(false);
  const [promoCode, setPromoCode] = useState('');
  const [addedSuggested, setAddedSuggested] = useState(false);

  useEffect(() => {
    setItems(getCart());
    setMounted(true);
  }, []);

  const handleQuantity = (id: string, qty: number) => {
    const updated = updateQuantity(id, qty);
    setItems(updated);
    window.dispatchEvent(new Event('storage'));
  };

  const handleRemove = (id: string) => {
    const updated = removeFromCart(id);
    setItems(updated);
    window.dispatchEvent(new Event('storage'));
  };

  const handleAddSuggested = () => {
    const { addToCart } = require('@/lib/cart');
    addToCart({
      id: SUGGESTED.id,
      slug: SUGGESTED.slug,
      name: `${SUGGESTED.name} ${SUGGESTED.nameItalic}`,
      priceEur: SUGGESTED.price,
      image: SUGGESTED.image,
      imageAlt: SUGGESTED.alt,
      quantity: 1,
      weightG: SUGGESTED.weightG,
      brand: SUGGESTED.brand,
      category: SUGGESTED.category,
    });
    setItems(getCart());
    setAddedSuggested(true);
    window.dispatchEvent(new Event('storage'));
  };

  const { totalItems, totalPriceEur, totalWeightG } = getCartTotals(items);
  const shippingFree = totalPriceEur >= 99;

  if (!mounted) {
    return (
      <div className="min-h-screen" style={{ backgroundColor: '#F5F3EE' }}>
        <Header />
        <div className="pt-24 flex items-center justify-center min-h-[60vh]">
          <div className="w-6 h-6 border-2 border-[#1C2620] border-t-transparent rounded-full animate-spin" />
        </div>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#F5F3EE' }}>
      <Header />

      {/* Breadcrumb */}
      <div className="pt-14 md:pt-14 bg-white border-b border-[#E0DDD0]">
        <div className="max-w-6xl mx-auto px-6 lg:px-8 py-3">
          <nav className="flex items-center gap-2 text-xs text-[#4A6355]">
            <Link href="/" className="hover:text-[#0E1512] transition-colors">Accueil</Link>
            <span>/</span>
            <Link href="/boutique" className="hover:text-[#0E1512] transition-colors">Boutique</Link>
            <span>/</span>
            <span className="font-semibold text-[#0E1512]">Panier</span>
          </nav>
        </div>
      </div>

      <main className="max-w-6xl mx-auto px-6 lg:px-8 py-12">
        {/* Page title */}
        <div className="mb-8">
          <h1 style={{ fontFamily: '"General Sans", "DM Sans", sans-serif', fontSize: 'clamp(2rem, 4vw, 3rem)', fontWeight: 600, letterSpacing: '-0.03em', color: '#0E1512' }}>
            Votre{' '}
            <em style={{ fontFamily: 'Fraunces, Georgia, serif', fontStyle: 'italic', fontWeight: 400 }}>panier.</em>
          </h1>
          {items.length > 0 && (
            <p className="mt-2 text-sm text-[#4A6355]">
              {totalItems} article{totalItems > 1 ? 's' : ''} · {(totalWeightG / 1000).toFixed(1)} kg · sous-total {totalPriceEur} €
            </p>
          )}
        </div>

        {items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 gap-6 text-center">
            <div className="w-16 h-16 border border-[#E0DDD0] flex items-center justify-center" style={{ borderRadius: '2px' }}>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#9AAD9E" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/>
                <line x1="3" y1="6" x2="21" y2="6"/>
                <path d="M16 10a4 4 0 0 1-8 0"/>
              </svg>
            </div>
            <div>
              <p style={{ fontFamily: '"General Sans", "DM Sans", sans-serif', fontSize: '1.25rem', fontWeight: 600, color: '#0E1512' }}>Votre panier est vide</p>
              <p className="text-sm text-[#4A6355] mt-1">Explorez notre catalogue pour trouver votre équipement.</p>
            </div>
            <Link
              href="/boutique"
              className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-[#1C2620] hover:bg-[#0E1512] transition-all"
              style={{ borderRadius: '2px' }}
            >
              Voir la boutique
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
            {/* Cart items */}
            <div className="lg:col-span-2">
              {/* Items list */}
              <div className="bg-white border border-[#E0DDD0]" style={{ borderRadius: '2px' }}>
                {items.map((item, i) => (
                  <div
                    key={item.id}
                    className={`flex gap-4 p-5 ${i < items.length - 1 ? 'border-b border-[#E0DDD0]' : ''}`}
                  >
                    {/* Image */}
                    <div className="w-20 h-20 flex-shrink-0 overflow-hidden bg-[#EBF0EB]" style={{ borderRadius: '2px' }}>
                      <img src={item.image} alt={item.imageAlt} className="w-full h-full object-cover" />
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p
                            className="text-[#4A6355] mb-0.5"
                            style={{ fontFamily: '"General Sans", "DM Sans", sans-serif', fontSize: '0.6875rem', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase' }}
                          >
                            {item.category}
                          </p>
                          <p style={{ fontFamily: '"General Sans", "DM Sans", sans-serif', fontSize: '0.9375rem', fontWeight: 600, color: '#0E1512' }}>
                            {item.name}
                          </p>
                          <p className="text-xs text-[#4A6355] mt-0.5">TVA incluse</p>
                        </div>
                        <button
                          onClick={() => handleRemove(item.id)}
                          className="p-1.5 text-[#9AAD9E] hover:text-[#0E1512] transition-colors flex-shrink-0"
                          aria-label={`Retirer ${item.name}`}
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="3 6 5 6 21 6"/>
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
                          </svg>
                        </button>
                      </div>

                      <div className="flex items-center justify-between mt-3">
                        {/* Quantity */}
                        <div className="flex items-center border border-[#E0DDD0]" style={{ borderRadius: '2px' }}>
                          <button
                            onClick={() => handleQuantity(item.id, item.quantity - 1)}
                            className="w-8 h-8 flex items-center justify-center text-[#4A6355] hover:text-[#0E1512] hover:bg-[#F5F3EE] transition-colors"
                            aria-label="Diminuer"
                          >
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                              <line x1="5" y1="12" x2="19" y2="12"/>
                            </svg>
                          </button>
                          <span className="w-8 text-center text-sm font-semibold text-[#0E1512] border-x border-[#E0DDD0]">{item.quantity}</span>
                          <button
                            onClick={() => handleQuantity(item.id, item.quantity + 1)}
                            className="w-8 h-8 flex items-center justify-center text-[#4A6355] hover:text-[#0E1512] hover:bg-[#F5F3EE] transition-colors"
                            aria-label="Augmenter"
                          >
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                              <line x1="12" y1="5" x2="12" y2="19"/>
                              <line x1="5" y1="12" x2="19" y2="12"/>
                            </svg>
                          </button>
                        </div>

                        {/* Price */}
                        <span style={{ fontFamily: '"General Sans", "DM Sans", sans-serif', fontSize: '1rem', fontWeight: 600, color: '#0E1512' }}>
                          {item.priceEur * item.quantity} €
                        </span>
                      </div>

                      {/* Save link */}
                      <button className="mt-2 text-xs text-[#4A6355] hover:text-[#0E1512] transition-colors flex items-center gap-1">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
                        </svg>
                        Enregistrer
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Suggested product */}
              <div className="mt-6 bg-white border border-[#E0DDD0] p-5" style={{ borderRadius: '2px' }}>
                <p
                  className="mb-4 text-[#4A6355]"
                  style={{ fontFamily: '"General Sans", "DM Sans", sans-serif', fontSize: '0.6875rem', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase' }}
                >
                  ON A PENSÉ POUR VOUS
                </p>
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 flex-shrink-0 overflow-hidden bg-[#EBF0EB]" style={{ borderRadius: '2px' }}>
                    <img src={SUGGESTED.image} alt={SUGGESTED.alt} className="w-full h-full object-cover" />
                  </div>
                  <div className="flex-1">
                    <p style={{ fontFamily: '"General Sans", "DM Sans", sans-serif', fontSize: '0.9375rem', fontWeight: 600, color: '#0E1512' }}>
                      {SUGGESTED.name}{' '}
                      <em style={{ fontFamily: 'Fraunces, Georgia, serif', fontStyle: 'italic', fontWeight: 400 }}>{SUGGESTED.nameItalic}</em>
                    </p>
                    <p className="text-xs text-[#4A6355] mt-0.5">{SUGGESTED.desc}</p>
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <span style={{ fontFamily: '"General Sans", "DM Sans", sans-serif', fontSize: '0.9375rem', fontWeight: 600, color: '#0E1512' }}>{SUGGESTED.price} €</span>
                    <button
                      onClick={handleAddSuggested}
                      disabled={addedSuggested}
                      className="w-8 h-8 flex items-center justify-center text-white bg-[#1C2620] hover:bg-[#0E1512] transition-colors disabled:bg-[#6B8A7A]"
                      style={{ borderRadius: '2px' }}
                      aria-label="Ajouter au panier"
                    >
                      {addedSuggested ? (
                        <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                          <path d="M2 6l3 3 5-5" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      ) : (
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                          <line x1="12" y1="5" x2="12" y2="19"/>
                          <line x1="5" y1="12" x2="19" y2="12"/>
                        </svg>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Order summary */}
            <div className="lg:col-span-1">
              <div className="bg-white border border-[#E0DDD0] p-6 sticky top-20" style={{ borderRadius: '2px' }}>
                <h2 className="mb-5" style={{ fontFamily: '"General Sans", "DM Sans", sans-serif', fontSize: '1rem', fontWeight: 700, color: '#0E1512', letterSpacing: '-0.01em' }}>
                  Récapitulatif
                </h2>

                {/* Lines */}
                <div className="flex flex-col gap-3 mb-5">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-[#4A6355]">Sous-total ({totalItems} article{totalItems > 1 ? 's' : ''})</span>
                    <span className="font-semibold text-[#0E1512]">{totalPriceEur} €</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-[#4A6355]">Poids total</span>
                    <span className="font-semibold text-[#0E1512]">{(totalWeightG / 1000).toFixed(1)} kg</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-[#4A6355]">Livraison suivie</span>
                    <span className="font-semibold text-[#1C2620]">{shippingFree ? 'Offerte' : '5,90 €'}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-[#4A6355]">Estimation TVA</span>
                    <span className="text-[#4A6355]">Incluse</span>
                  </div>
                </div>

                {/* Promo */}
                <div className="flex gap-2 mb-5">
                  <input
                    type="text"
                    placeholder="Code promo"
                    value={promoCode}
                    onChange={(e) => setPromoCode(e.target.value)}
                    className="flex-1 px-3 py-2 text-sm border border-[#E0DDD0] text-[#0E1512] placeholder-[#9AAD9E] focus:outline-none focus:border-[#1C2620] transition-colors"
                    style={{ borderRadius: '2px', fontFamily: '"General Sans", "DM Sans", sans-serif' }}
                  />
                  <button
                    className="px-4 py-2 text-sm font-semibold text-[#1C2620] border border-[#1C2620] hover:bg-[#1C2620] hover:text-white transition-all"
                    style={{ borderRadius: '2px' }}
                  >
                    Appliquer
                  </button>
                </div>

                {/* Total */}
                <div className="flex items-center justify-between py-4 border-t border-[#E0DDD0] mb-5">
                  <span style={{ fontFamily: '"General Sans", "DM Sans", sans-serif', fontSize: '1rem', fontWeight: 700, color: '#0E1512' }}>Total à payer</span>
                  <span style={{ fontFamily: '"General Sans", "DM Sans", sans-serif', fontSize: '1.25rem', fontWeight: 700, color: '#0E1512' }}>{totalPriceEur} €</span>
                </div>

                {/* CTA */}
                <Link
                  href="/checkout"
                  className="flex items-center justify-center w-full py-3 text-sm font-semibold text-white bg-[#1C2620] hover:bg-[#0E1512] transition-all"
                  style={{ borderRadius: '2px', minHeight: '48px' }}
                >
                  Passer au paiement
                </Link>

                {/* Security */}
                <div className="flex items-center justify-center gap-1.5 mt-3">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#4A6355" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                    <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                  </svg>
                  <span className="text-xs text-[#4A6355]">Paiement sécurisé Stripe</span>
                </div>

                {/* Payment logos */}
                <div className="flex items-center justify-center gap-3 mt-4">
                  {['VISA', 'MC', 'AMEX', 'PayPal'].map((logo) => (
                    <span
                      key={logo}
                      className="px-2 py-1 text-[9px] font-bold text-[#4A6355] border border-[#E0DDD0]"
                      style={{ borderRadius: '2px', letterSpacing: '0.05em' }}
                    >
                      {logo}
                    </span>
                  ))}
                </div>

                {/* Trust badges */}
                <div className="flex items-center justify-between mt-5 pt-4 border-t border-[#E0DDD0]">
                  {[
                    { icon: '☆', label: 'Garantie à vie' },
                    { icon: '↶', label: 'Retour 30 j.' },
                    { icon: '◡', label: '100 % Europe' },
                  ].map(({ icon, label }) => (
                    <div key={label} className="flex flex-col items-center gap-1">
                      <span className="text-[#4A6355] text-sm">{icon}</span>
                      <span className="text-[9px] text-[#4A6355] text-center" style={{ letterSpacing: '0.05em' }}>{label}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
}