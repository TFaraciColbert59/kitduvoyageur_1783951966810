'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import WeightGauge from '@/components/WeightGauge';
import Icon from '@/components/ui/AppIcon';
import { getCart, updateQuantity, removeFromCart, getCartTotals, applyLoyaltyFree, removeLoyaltyFree, CartItem } from '@/lib/cart';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import MobilePageShell from '@/components/mobile-nav/MobilePageShell';

export default function PanierPage() {
  const [items, setItems] = useState<CartItem[]>([]);
  const [mounted, setMounted] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [loyaltyPoints, setLoyaltyPoints] = useState(0);
  const [loyaltyLevel, setLoyaltyLevel] = useState('Explorateur');
  const [applyingLoyalty, setApplyingLoyalty] = useState<string | null>(null);
  const { user } = useAuth();
  const supabase = createClient();

  useEffect(() => {
    const cart = getCart();
    setItems(cart);
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!user) return;
    supabase.from('user_profiles').select('loyalty_points, loyalty_level').eq('id', user.id).single().then(({ data }) => {
      if (data) {
        setLoyaltyPoints(data.loyalty_points ?? 0);
        setLoyaltyLevel(data.loyalty_level ?? 'Explorateur');
      }
    });
  }, [user, supabase]);

  // Loyalty discount thresholds by level
  const getLoyaltyDiscount = () => {
    if (loyaltyLevel === 'Légende du Voyage') return 0.20;
    if (loyaltyLevel === 'Guide de Montagne') return 0.15;
    if (loyaltyLevel === 'Randonneur Expert') return 0.10;
    if (loyaltyLevel === 'Aventurier') return 0.05;
    return 0;
  };

  // Points needed to make an item free (100 pts per 10€)
  const pointsNeededForFree = (priceEur: number) => Math.ceil(priceEur * 10);

  const handleQuantity = (id: string, qty: number) => {
    const updated = updateQuantity(id, qty);
    setItems(updated);
  };

  const handleRemoveRequest = (id: string) => {
    setConfirmDeleteId(id);
  };

  const handleRemoveConfirm = () => {
    if (!confirmDeleteId) return;
    setRemovingId(confirmDeleteId);
    setConfirmDeleteId(null);
    setTimeout(() => {
      const updated = removeFromCart(confirmDeleteId);
      setItems(updated);
      setRemovingId(null);
    }, 300);
  };

  const handleRemoveCancel = () => {
    setConfirmDeleteId(null);
  };

  const handleApplyLoyaltyFree = async (itemId: string, itemPrice: number) => {
    if (!user) return;
    const needed = pointsNeededForFree(itemPrice);
    if (loyaltyPoints < needed) return;
    setApplyingLoyalty(itemId);
    try {
      // Deduct points from DB
      const newPoints = loyaltyPoints - needed;
      await supabase.from('user_profiles').update({ loyalty_points: newPoints }).eq('id', user.id);
      await supabase.from('loyalty_history').insert({
        user_id: user.id,
        action: `Article offert via fidélité (panier)`,
        points: -needed,
        type: 'spent',
      });
      setLoyaltyPoints(newPoints);
      const updated = applyLoyaltyFree(itemId);
      setItems(updated);
    } catch (err) {
      console.error(err);
    } finally {
      setApplyingLoyalty(null);
    }
  };

  const handleRemoveLoyaltyFree = async (itemId: string, originalPrice: number) => {
    if (!user) return;
    const needed = pointsNeededForFree(originalPrice);
    // Refund points
    const newPoints = loyaltyPoints + needed;
    await supabase.from('user_profiles').update({ loyalty_points: newPoints }).eq('id', user.id);
    await supabase.from('loyalty_history').insert({
      user_id: user.id,
      action: `Remboursement points — article retiré du panier`,
      points: needed,
      type: 'earned',
    });
    setLoyaltyPoints(newPoints);
    const updated = removeLoyaltyFree(itemId);
    setItems(updated);
  };

  const { totalItems, totalPriceEur, totalWeightG, savedEur } = getCartTotals(items);
  const shippingEur = totalPriceEur >= 99 ? 0 : 5.9;
  const grandTotal = totalPriceEur + shippingEur;
  const loyaltyDiscount = getLoyaltyDiscount();

  if (!mounted) {
    return (
      <div className="min-h-screen bg-[#F5F2E8]">
        <Header />
        <div className="pt-24 flex items-center justify-center min-h-[60vh]">
          <div className="w-8 h-8 border-2 border-[#1C2620] border-t-transparent rounded-full animate-spin" aria-label="Chargement du panier" />
        </div>
        <Footer />
      </div>
    );
  }

  return (
    <>
      <div className="hidden md:block min-h-screen bg-[#F5F2E8] text-[#1C2620] flex flex-col">
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
      )}

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
            <Link href="/boutique" className="mt-4 bg-[#1C2620] hover:bg-[#2A3830] text-white px-8 py-3.5 rounded-xl font-600 text-sm transition-colors">
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

    {/* ── MOBILE VIEW ── */}
    <div className="block md:hidden">
      <MobilePageShell background="#F5F2E8">
        {items.length === 0 ? (
          <div style={{ padding: '60px 20px', textAlign: 'center' }}>
            <div style={{ fontSize: '22px', fontWeight: 500, color: '#0B1F17', marginBottom: '8px' }}>
              Votre <em style={{ fontFamily: 'Georgia, serif', fontStyle: 'italic', color: '#17402C', fontWeight: 400 }}>panier</em> est vide
            </div>
            <Link href="/boutique" style={{ display: 'inline-block', marginTop: '16px', padding: '12px 24px', background: '#0B1F17', color: '#fff', borderRadius: '999px', fontSize: '14px', fontWeight: 500, textDecoration: 'none' }}>
              Voir le catalogue
            </Link>
          </div>
        ) : (
          <>
            {/* Cart header */}
            <div style={{ padding: '12px 16px 16px', borderBottom: '1px solid rgba(11,31,23,0.05)' }}>
              <h1 style={{ fontSize: '28px', letterSpacing: '-0.025em', margin: 0 }}>
                {totalItems} pièce{totalItems > 1 ? 's' : ''}<br/>
                <em style={{ fontFamily: 'Georgia, serif', fontStyle: 'italic', color: '#17402C', fontWeight: 400 }}>prêtes à partir.</em>
              </h1>
              <div style={{ fontSize: '12px', color: '#6B7A72', fontFamily: 'ui-monospace, monospace', marginTop: '2px' }}>
                MSA-CH-2026-047 · panier ouvert
              </div>
            </div>

            {/* Cart items */}
            {items.map((item) => (
              <div key={item.id} style={{ display: 'flex', gap: '12px', padding: '16px', borderBottom: '1px solid rgba(11,31,23,0.05)' }}>
                <Link href={`/produit/${item.slug}`} aria-label={item.name} style={{ textDecoration: 'none' }}>
                  <div style={{ width: '76px', height: '92px', borderRadius: '12px', background: 'linear-gradient(135deg, #17402C 0%, #2D6B4A 100%)', flexShrink: 0, overflow: 'hidden' }}>
                    {item.image ? <img src={item.image} alt={item.name} style={{ width: '100%', height: '100%', objectFit: 'cover', mixBlendMode: 'multiply' }} /> : null}
                  </div>
                </Link>
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                  <div>
                    <div style={{ fontSize: '10px', color: '#6B7A72', fontFamily: 'ui-monospace, monospace', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      {item.category || 'PORTAGE'}
                    </div>
                    <Link href={`/produit/${item.slug}`} style={{ textDecoration: 'none' }}>
                      <div style={{ fontSize: '14px', fontWeight: 500, color: '#0B1F17', marginTop: '2px' }}>
                        {item.name}
                      </div>
                    </Link>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '4px', background: '#F4F1EA', borderRadius: '999px' }}>
                      <button onClick={() => handleQuantity(item.id, Math.max(1, item.quantity - 1))} style={{ width: '24px', height: '24px', borderRadius: '999px', background: '#FBFAF6', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', color: '#0B1F17', fontFamily: 'inherit' }}>−</button>
                      <span style={{ minWidth: '18px', textAlign: 'center', fontSize: '13px', fontWeight: 500, fontFamily: 'ui-monospace, monospace', color: '#0B1F17' }}>{item.quantity}</span>
                      <button onClick={() => handleQuantity(item.id, item.quantity + 1)} style={{ width: '24px', height: '24px', borderRadius: '999px', background: '#FBFAF6', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', color: '#0B1F17', fontFamily: 'inherit' }}>+</button>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: '15px', fontWeight: 600, color: '#0B1F17' }}>{(item.priceEur * item.quantity).toFixed(0)} €</div>
                      <button onClick={() => handleRemoveRequest(item.id)} style={{ fontSize: '11px', color: '#9AA89C', background: 'none', border: 'none', cursor: 'pointer', padding: '4px 0', fontFamily: 'inherit' }}>Retirer</button>
                    </div>
                  </div>
                </div>
              </div>
            ))}

            {/* Promo banner */}
            <div style={{ margin: '16px', padding: '12px 16px', background: '#EDF3ED', borderRadius: '14px', border: '1.5px dashed #A3C4A3' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontSize: '10px', fontFamily: 'ui-monospace, monospace', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#6B7A72' }}>Code promo</div>
                  <div style={{ fontSize: '13px', fontWeight: 500, color: '#0B1F17', marginTop: '2px' }}>BIENVENUE10</div>
                </div>
                <button style={{ fontSize: '12px', fontWeight: 500, color: '#17402C', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>Appliquer →</button>
              </div>
            </div>

            {/* Summary card */}
            <div style={{ margin: '0 16px', padding: '16px', background: '#FBFAF6', borderRadius: '16px', border: '1px solid #EDF3ED' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span style={{ fontSize: '13px', color: '#6B7A72' }}>Sous-total</span>
                <span style={{ fontSize: '13px', fontWeight: 500, color: '#0B1F17' }}>{totalPriceEur.toFixed(0)} €</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span style={{ fontSize: '13px', color: '#6B7A72' }}>Livraison</span>
                <span style={{ fontSize: '13px', fontWeight: 500, color: '#0B1F17' }}>{shippingEur === 0 ? 'Offerte' : `${shippingEur.toFixed(2)} €`}</span>
              </div>
              <div style={{ height: '1px', background: '#EDF3ED', margin: '12px 0' }} />
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '16px', fontWeight: 700, color: '#0B1F17' }}>Total</span>
                <span style={{ fontSize: '16px', fontWeight: 700, color: '#0B1F17' }}>{grandTotal.toFixed(0)} €</span>
              </div>
            </div>

            {/* CTA */}
            <div style={{ padding: '16px' }}>
              <Link href="/checkout" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', padding: '14px 20px', background: '#0B1F17', color: '#fff', borderRadius: '999px', fontSize: '15px', fontWeight: 500, textDecoration: 'none', fontFamily: 'inherit' }}>
                <span>Suivant</span>
                <span style={{ fontSize: '12px', opacity: 0.7, fontFamily: 'ui-monospace, monospace', background: 'rgba(255,255,255,0.15)', padding: '2px 10px', borderRadius: '999px' }}>{grandTotal.toFixed(0)} €</span>
              </Link>
            </div>

            {/* Footer spacer */}
            
          </>
        )}
      </MobilePageShell>
    </div>
    </>
  );
}