'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import WeightGauge from '@/components/WeightGauge';
import Icon from '@/components/ui/AppIcon';
import LkvButton from '@/components/ui/LkvButton';
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
      <div className="min-h-screen bg-transparent">
        <Header />
        <div className="pt-24 flex items-center justify-center min-h-[60vh]">
          <div className="w-8 h-8 border-2 border-[var(--lkv-primary)] border-t-transparent rounded-full animate-spin" aria-label="Chargement du panier" />
        </div>
        <Footer />
      </div>
    );
  }

  return (
    <>
      {/* ── DESKTOP VIEW (fullscreen : page = 100dvh, scroll interne) ── */}
      <div className="hidden md:flex flex-col h-[100dvh] overflow-hidden bg-transparent text-[#EEF3EC]">
        <Header />

        {confirmDeleteId && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[var(--lkv-primary)]/25 backdrop-blur-sm" role="dialog" aria-modal="true">
            <div className="glass rounded-xl p-8 max-w-sm w-full text-center">
              <h2 className="font-display font-700 text-xl text-[var(--lkv-primary)] mb-3">Retirer cet article ?</h2>
              <p className="text-sm text-[var(--lkv-text-muted)] mb-6">
                {items.find((i) => i.id === confirmDeleteId)?.name} sera retiré de votre panier.
              </p>
              <div className="flex gap-3">
                <button onClick={handleRemoveCancel} className="glass-capsule-btn flex-1" autoFocus>Annuler</button>
                <button onClick={handleRemoveConfirm} className="glass-capsule-btn danger flex-1">Retirer</button>
              </div>
            </div>
          </div>
        )}

        <div className="flex-1 min-h-0 overflow-y-auto w-full pt-24 pb-6">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full">
            {items.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 gap-6 text-center">
                <div className="w-20 h-20 rounded-full glass flex items-center justify-center">
                  <Icon name="ShoppingBagIcon" size={36} className="text-[var(--lkv-primary)]/40" />
                </div>
                <div>
                  <p className="font-display font-800 text-3xl text-[#EEF3EC] mb-2">Votre <em className="italic font-400 text-[#A9C6B0]">panier.</em> est vide</p>
                  <p className="text-[#CCE0D4]">Explorez notre catalogue pour trouver votre équipement.</p>
                </div>
                <Link href="/boutique" className="glass-capsule-btn mt-4">
                  Voir le catalogue
                </Link>
              </div>
            ) : (
              <>
                <div className="flex flex-col md:flex-row md:items-end justify-between mb-8 gap-4">
                  <h1 className="font-display font-800 text-4xl text-[#EEF3EC]">
                    Votre <em className="italic font-400 text-[#A9C6B0]">panier.</em>
                  </h1>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-[#CCE0D4]">
                    {totalItems} article{totalItems > 1 ? 's' : ''} · {totalWeightG >= 1000 ? `${(totalWeightG / 1000).toFixed(1).replace('.', ',')} kg` : `${totalWeightG} g`} · sous-total <span className="font-mono font-bold text-[#EEF3EC]">{totalPriceEur.toFixed(0)} €</span>
                  </p>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                  <div className="lg:col-span-7 xl:col-span-8 flex flex-col gap-4">

                    {/* Cart items */}
                    {items.map((item) => (
                      <div key={item.id} className={`glass p-6 flex gap-6 transition-all duration-300 ${removingId === item.id ? 'opacity-0 scale-95' : 'opacity-100 scale-100'}`}>
                        <div className="w-32 h-32 flex-shrink-0 rounded-2xl overflow-hidden bg-white/40 border border-white/60">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          {item.image ? <img src={item.image} alt={item.name} className="w-full h-full object-cover mix-blend-multiply" /> : null}
                        </div>

                        <div className="flex-1 flex flex-col justify-between min-w-0">
                          <div className="flex justify-between items-start gap-4">
                            <div>
                              <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--lkv-text-muted)] mb-1">{item.category || 'PORTAGE'}</p>
                              <Link href={`/produit/${item.slug}`} className="font-display font-700 text-[var(--lkv-primary)] text-xl hover:text-[var(--lkv-forest-600)] transition-colors line-clamp-2">
                                {item.name.split(' ').map((word, i, arr) =>
                                  i >= arr.length - 2 ? <em key={i} className="italic font-400 text-[var(--lkv-forest-600)] ml-1">{word}</em> : <span key={i} className="mr-1">{word}</span>
                                )}
                              </Link>
                              <div className="flex items-center gap-2 mt-2">
                                <span className="glass-pill">
                                  <span className="w-2 h-2 rounded-full bg-[var(--lkv-primary)] inline-block" />
                                  {item.weightG >= 1000 ? `${(item.weightG / 1000).toFixed(1).replace('.', ',')} kg` : `${item.weightG} g`}
                                </span>
                              </div>
                            </div>

                            <div className="flex flex-col items-end">
                              <div className="glass-capsule-bar">
                                <button onClick={() => handleQuantity(item.id, item.quantity - 1)} aria-label="Réduire la quantité" className="glass-circle-btn !w-7 !h-7 !min-w-7 !min-h-7">
                                  <Icon name="MinusIcon" size={12} />
                                </button>
                                <span className="w-4 text-center font-600 text-sm text-[var(--lkv-primary)]">{item.quantity}</span>
                                <button onClick={() => handleQuantity(item.id, item.quantity + 1)} aria-label="Augmenter la quantité" className="glass-circle-btn !w-7 !h-7 !min-w-7 !min-h-7">
                                  <Icon name="PlusIcon" size={12} />
                                </button>
                              </div>
                            </div>
                          </div>

                          <div className="flex justify-between items-end mt-4">
                            <div className="flex gap-4">
                              <button className="glass-capsule-btn !min-h-[34px] !py-1 !px-3 !text-xs !font-bold">
                                <Icon name="BookmarkIcon" size={14} variant="outline" />
                                Enregistrer
                              </button>
                              <button onClick={() => handleRemoveRequest(item.id)} className="glass-capsule-btn !min-h-[34px] !py-1 !px-3 !text-xs !font-bold">
                                <Icon name="TrashIcon" size={14} variant="outline" />
                                Retirer
                              </button>
                            </div>

                            <div className="text-right">
                              <p className="font-mono font-bold text-[var(--lkv-primary)] text-xl">{(item.priceEur * item.quantity).toFixed(0)} €</p>
                              <p className="text-[10px] text-[var(--lkv-text-muted)]">TVA incluse</p>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}

                    {/* Upsell Section */}
                    <div className="glass-sub-card p-6 flex items-center justify-between gap-6" style={{ boxShadow: 'none' }}>
                      <div className="flex items-center gap-6 min-w-0">
                        <div className="w-20 h-20 flex-shrink-0 rounded-2xl bg-white/50 mix-blend-multiply overflow-hidden flex items-center justify-center p-2">
                          <img src="https://images.unsplash.com/photo-1572007886481-64539dc31d04?w=400&q=80" alt="Lampe" className="w-full h-full object-cover rounded-xl" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--lkv-text-muted)] mb-1">ON A PENSÉ POUR VOUS</p>
                          <p className="font-display font-700 text-lg text-[var(--lkv-primary)]">Lampe frontale <em className="italic font-400 text-[var(--lkv-forest-600)]">350 lumens.</em></p>
                          <p className="text-xs text-[var(--lkv-text-muted)] mt-1">Autonomie 45 h, batterie rechargeable. Souvent oubliée, jamais regrettée.</p>
                        </div>
                      </div>
                      <button className="glass-capsule-btn flex-shrink-0">
                        84 € <Icon name="PlusIcon" size={14} />
                      </button>
                    </div>
                  </div>

                  {/* Order summary */}
                  <div className="lg:col-span-5 xl:col-span-4">
                    <div className="glass p-8">
                      <h3 className="font-display font-700 text-xl text-[var(--lkv-primary)] mb-6">Récapitulatif</h3>

                      <div className="space-y-4 mb-8">
                        <div className="flex justify-between text-sm">
                          <span className="text-[var(--lkv-text-muted)]">Sous-total ({totalItems} articles)</span>
                          <span className="font-mono font-bold text-[var(--lkv-primary)]">{totalPriceEur.toFixed(0)} €</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-[var(--lkv-text-muted)]">Poids total</span>
                          <span className="font-mono font-bold text-[var(--lkv-primary)]">{totalWeightG >= 1000 ? `${(totalWeightG / 1000).toFixed(1).replace('.', ',')} kg` : `${totalWeightG} g`}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-[var(--lkv-text-muted)]">Livraison suivie</span>
                          <span className="font-mono font-bold text-[var(--lkv-primary)]">{shippingEur === 0 ? 'Offerte' : `${shippingEur.toFixed(2)} €`}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-[var(--lkv-text-muted)]">Estimation TVA</span>
                          <span className="font-600 text-[var(--lkv-text-muted)]">Incluse</span>
                        </div>
                      </div>

                      <div className="flex gap-2 mb-8">
                        <input type="text" placeholder="Code promo" className="glass-input flex-1 min-w-0" />
                        <LkvButton variant="secondary" size="sm">Appliquer</LkvButton>
                      </div>

                      <div className="flex justify-between items-end font-display font-800 text-2xl pt-6 border-t border-white/50 mb-6">
                        <span className="text-xl text-[var(--lkv-primary)]">Total à payer</span>
                        <span className="font-mono font-bold text-[var(--lkv-primary)]">{grandTotal.toFixed(0)} €</span>
                      </div>

                      <Link href="/checkout" className="block w-full mb-4">
                        <LkvButton variant="primary" size="lg" fullWidth>
                          Passer au paiement →
                        </LkvButton>
                      </Link>
                      <p className="text-center text-[10px] text-[var(--lkv-text-muted)] flex items-center justify-center gap-1.5 mb-8">
                        <Icon name="LockClosedIcon" size={12} /> Paiement sécurisé Stripe
                      </p>

                      <div className="flex justify-center gap-2 mb-6 opacity-60">
                        {/* Fake payment logos */}
                        <div className="glass-pill px-3 py-1.5 text-[10px] font-600 font-mono">VISA</div>
                        <div className="glass-pill px-3 py-1.5 text-[10px] font-600 font-mono">MC</div>
                        <div className="glass-pill px-3 py-1.5 text-[10px] font-600 font-mono">AMEX</div>
                        <div className="glass-pill px-3 py-1.5 text-[10px] font-600 font-mono">Apple Pay</div>
                      </div>

                      <div className="glass-sub-card rounded-md p-4 flex justify-between gap-2 text-center text-[10px] font-600 text-[var(--lkv-text-muted)]" style={{ boxShadow: 'none' }}>
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
          </div>
        </div>

        <Footer />
      </div>

      {/* ── MOBILE VIEW (scroll natif) ── */}
      <div className="block md:hidden">
        <MobilePageShell background="transparent">
          {items.length === 0 ? (
            <div style={{ padding: '60px 20px', textAlign: 'center' }}>
              <div style={{ fontSize: '22px', fontWeight: 500, color: '#EEF3EC', marginBottom: '8px' }}>
                Votre <em style={{ fontFamily: 'Georgia, serif', fontStyle: 'italic', color: '#A9C6B0', fontWeight: 400 }}>panier</em> est vide
              </div>
              <Link href="/boutique" className="glass-capsule-btn" style={{ marginTop: '16px', textDecoration: 'none' }}>
                Voir le catalogue
              </Link>
            </div>
          ) : (
            <>
              {/* Cart header */}
              <div style={{ padding: '12px 16px 16px', borderBottom: '1px solid rgba(255,255,255,0.18)' }}>
                <h1 style={{ fontSize: '28px', letterSpacing: '-0.025em', margin: 0, color: '#EEF3EC' }}>
                  {totalItems} pièce{totalItems > 1 ? 's' : ''}<br/>
                  <em style={{ fontFamily: 'Georgia, serif', fontStyle: 'italic', color: '#A9C6B0', fontWeight: 400 }}>prêtes à partir.</em>
                </h1>
                <div style={{ fontSize: '12px', color: '#CCE0D4', fontFamily: 'ui-monospace, monospace', marginTop: '2px' }}>
                  MSA-CH-2026-047 · panier ouvert
                </div>
              </div>

              {/* Cart items */}
              {items.map((item) => (
                <div key={item.id} style={{ display: 'flex', gap: '12px', padding: '16px', borderBottom: '1px solid rgba(23,64,44,0.05)' }}>
                  <Link href={`/produit/${item.slug}`} aria-label={item.name} style={{ textDecoration: 'none' }}>
                    <div style={{ width: '76px', height: '92px', borderRadius: '12px', background: 'linear-gradient(135deg, var(--lkv-primary) 0%, var(--lkv-secondary) 100%)', flexShrink: 0, overflow: 'hidden' }}>
                      {item.image ? <img src={item.image} alt={item.name} style={{ width: '100%', height: '100%', objectFit: 'cover', mixBlendMode: 'multiply' }} /> : null}
                    </div>
                  </Link>
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                    <div>
                      <div style={{ fontSize: '10px', color: 'var(--lkv-text-muted)', fontFamily: 'ui-monospace, monospace', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        {item.category || 'PORTAGE'}
                      </div>
                      <Link href={`/produit/${item.slug}`} style={{ textDecoration: 'none' }}>
                        <div style={{ fontSize: '14px', fontWeight: 500, color: 'var(--lkv-primary)', marginTop: '2px' }}>
                          {item.name}
                        </div>
                      </Link>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '3px 6px', background: 'var(--lkv-surface-muted)', borderRadius: '999px', border: '1px solid rgba(23,64,44,0.06)' }}>
                        <button onClick={() => handleQuantity(item.id, Math.max(1, item.quantity - 1))} aria-label="Diminuer la quantité" className="glass-circle-btn !w-8 !h-8 !min-w-8 !min-h-8 !text-[15px] !font-semibold">−</button>
                        <span style={{ minWidth: '22px', textAlign: 'center', fontSize: '14px', fontWeight: 600, fontFamily: 'ui-monospace, monospace', color: 'var(--lkv-primary)' }}>{item.quantity}</span>
                        <button onClick={() => handleQuantity(item.id, item.quantity + 1)} aria-label="Augmenter la quantité" className="glass-circle-btn !w-8 !h-8 !min-w-8 !min-h-8 !text-[15px] !font-semibold">+</button>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: '15px', fontWeight: 700, fontFamily: 'ui-monospace, monospace', color: 'var(--lkv-primary)' }}>{(item.priceEur * item.quantity).toFixed(0)} €</div>
                        <button onClick={() => handleRemoveRequest(item.id)} className="glass-capsule-btn !min-h-0 !py-1 !px-3 !text-[11px] !font-semibold">Retirer</button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}

              {/* Promo banner */}
              <div className="glass-sub-card" style={{ margin: '16px', padding: '12px 16px', borderRadius: '14px', border: '1.5px dashed var(--lkv-secondary-subtle)', boxShadow: 'none' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontSize: '10px', fontFamily: 'ui-monospace, monospace', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--lkv-text-muted)' }}>Code promo</div>
                    <div style={{ fontSize: '13px', fontWeight: 500, color: 'var(--lkv-primary)', marginTop: '2px' }}>BIENVENUE10</div>
                  </div>
                  <button className="glass-capsule-btn !min-h-0 !py-1.5 !px-3.5 !text-xs !font-semibold">Appliquer →</button>
                </div>
              </div>

              {/* Summary card */}
              <div className="glass" style={{ margin: '0 16px', padding: '16px', borderRadius: '16px', boxShadow: 'none' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <span style={{ fontSize: '13px', color: 'var(--lkv-text-muted)' }}>Sous-total</span>
                  <span style={{ fontSize: '13px', fontWeight: 700, fontFamily: 'ui-monospace, monospace', color: 'var(--lkv-primary)' }}>{totalPriceEur.toFixed(0)} €</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <span style={{ fontSize: '13px', color: 'var(--lkv-text-muted)' }}>Livraison</span>
                  <span style={{ fontSize: '13px', fontWeight: 700, fontFamily: 'ui-monospace, monospace', color: 'var(--lkv-primary)' }}>{shippingEur === 0 ? 'Offerte' : `${shippingEur.toFixed(2)} €`}</span>
                </div>
                <div style={{ height: '1px', background: 'rgba(23,64,44,0.08)', margin: '12px 0' }} />
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '16px', fontWeight: 700, color: 'var(--lkv-primary)' }}>Total</span>
                  <span style={{ fontSize: '16px', fontWeight: 700, fontFamily: 'ui-monospace, monospace', color: 'var(--lkv-primary)' }}>{grandTotal.toFixed(0)} €</span>
                </div>
              </div>

              {/* CTA */}
              <div style={{ padding: '16px' }}>
                <Link href="/checkout" className="glass-capsule-btn w-full" style={{ textDecoration: 'none', justifyContent: 'space-between' }}>
                  <span>Suivant</span>
                  <span style={{ fontSize: '12px', opacity: 0.75, fontFamily: 'ui-monospace, monospace', background: 'rgba(255,255,255,0.35)', padding: '2px 10px', borderRadius: '999px' }}>{grandTotal.toFixed(0)} €</span>
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
