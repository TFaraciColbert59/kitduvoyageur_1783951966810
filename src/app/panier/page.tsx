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
      <div className="min-h-screen bg-background">
        <Header />
        <div className="pt-24 flex items-center justify-center min-h-[60vh]">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" aria-label="Chargement du panier" />
        </div>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Header />

      {confirmDeleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="confirm-delete-title">
          <div className="bg-background border border-border rounded-2xl p-6 max-w-sm w-full shadow-2xl">
            <h2 id="confirm-delete-title" className="font-display font-700 text-lg text-foreground mb-2">Retirer cet article ?</h2>
            <p className="text-sm text-muted-foreground mb-5">
              {items.find((i) => i.id === confirmDeleteId)?.name} sera retiré de votre panier.
            </p>
            <div className="flex gap-3">
              <button onClick={handleRemoveCancel} className="flex-1 px-4 py-2.5 rounded-xl border border-border text-sm font-medium text-foreground hover:bg-muted transition-colors min-h-[44px]" autoFocus>Annuler</button>
              <button onClick={handleRemoveConfirm} className="flex-1 px-4 py-2.5 rounded-xl bg-red-500 hover:bg-red-600 text-white text-sm font-medium transition-colors min-h-[44px]">Retirer</button>
            </div>
          </div>
        </div>
      )}

      <section className="pt-20 pb-0 bg-dark-bg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
          <div className="flex items-start gap-4">
            <div className="w-1 h-10 bg-primary flex-shrink-0 mt-1" aria-hidden="true" />
            <div>
              <p className="font-mono text-xs text-primary tracking-widest uppercase mb-1">PANIER — {totalItems} ARTICLE{totalItems !== 1 ? 'S' : ''}</p>
              <h1 className="font-display font-800 text-3xl md:text-4xl text-white tracking-tight">MON PANIER</h1>
            </div>
          </div>
        </div>
      </section>

      <main id="main-content" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        {items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 gap-6 text-center">
            <div className="w-20 h-20 rounded-full bg-card border border-border flex items-center justify-center">
              <Icon name="ShoppingBagIcon" size={36} variant="outline" className="text-muted-foreground" />
            </div>
            <div>
              <p className="font-display font-700 text-2xl text-foreground mb-2">Votre panier est vide</p>
              <p className="text-muted-foreground">Explorez notre catalogue pour trouver votre équipement.</p>
            </div>
            <Link href="/catalogue" className="btn-primary">
              <Icon name="MagnifyingGlassIcon" size={16} variant="outline" />
              Voir le catalogue
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 flex flex-col gap-4">
              {/* Loyalty banner */}
              {user && loyaltyPoints > 0 && (
                <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl flex items-center gap-3">
                  <Icon name="StarIcon" size={20} variant="solid" className="text-amber-500 flex-shrink-0" />
                  <div className="flex-1">
                    <p className="text-sm font-700 text-amber-800">Vous avez {loyaltyPoints.toLocaleString()} points fidélité</p>
                    <p className="text-xs text-amber-700">Utilisez vos points pour rendre des articles gratuits (100 pts = 10€)</p>
                  </div>
                  <Link href="/fidelite" className="text-xs font-600 text-amber-700 hover:text-amber-900 underline flex-shrink-0">Gérer</Link>
                </div>
              )}

              {/* Weight summary bar */}
              <div className="p-4 bg-dark-bg rounded-xl border border-white/10">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-mono text-xs text-white/50 uppercase tracking-wider">POIDS TOTAL DU PANIER</span>
                  <span className="font-mono text-sm font-600 text-info">
                    {totalWeightG >= 1000 ? `${(totalWeightG / 1000).toFixed(2)} kg` : `${totalWeightG} g`}
                  </span>
                </div>
                <WeightGauge weightG={totalWeightG} maxG={20000} showLabel={false} size="lg" />
              </div>

              {/* Cart items */}
              {items.map((item) => (
                <div key={item.id} className={`topo-card p-4 flex gap-4 transition-all duration-300 ${removingId === item.id ? 'opacity-0 scale-95' : 'opacity-100 scale-100'}`}>
                  <div className="w-20 h-20 flex-shrink-0 rounded-lg overflow-hidden bg-muted">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={item.image} alt={item.imageAlt} className="w-full h-full object-cover" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider mb-0.5">{item.brand} · {item.category}</p>
                        <Link href={`/produit/${item.slug}`} className="font-display font-700 text-foreground text-base hover:text-primary transition-colors leading-tight">
                          {item.name}
                        </Link>
                        {item.loyaltyFree && (
                          <span className="ml-2 text-[10px] font-700 px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">🎁 Offert (fidélité)</span>
                        )}
                      </div>
                      <button onClick={() => handleRemoveRequest(item.id)} className="p-2 rounded-lg text-muted-foreground hover:text-red-500 hover:bg-red-500/10 transition-all flex-shrink-0 min-h-[44px] min-w-[44px] flex items-center justify-center" aria-label={`Retirer ${item.name} du panier`}>
                        <Icon name="TrashIcon" size={16} variant="outline" />
                      </button>
                    </div>

                    <div className="mt-2 mb-3">
                      <WeightGauge weightG={item.weightG * item.quantity} maxG={5000} size="sm" />
                    </div>

                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <div className="flex items-center gap-1 bg-background border border-border rounded-lg overflow-hidden">
                        <button onClick={() => handleQuantity(item.id, item.quantity - 1)} className="w-10 h-10 flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-all" aria-label="Diminuer la quantité">
                          <Icon name="MinusIcon" size={14} variant="outline" />
                        </button>
                        <span className="w-8 text-center font-mono text-sm font-600 text-foreground" aria-live="polite">{item.quantity}</span>
                        <button onClick={() => handleQuantity(item.id, item.quantity + 1)} className="w-10 h-10 flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-all" aria-label="Augmenter la quantité">
                          <Icon name="PlusIcon" size={14} variant="outline" />
                        </button>
                      </div>

                      <div className="flex items-center gap-3">
                        {/* Loyalty free button */}
                        {user && !item.loyaltyFree && item.priceEur > 0 && (
                          <button
                            onClick={() => handleApplyLoyaltyFree(item.id, item.priceEur)}
                            disabled={loyaltyPoints < pointsNeededForFree(item.priceEur) || applyingLoyalty === item.id}
                            className="text-[10px] font-600 px-2 py-1 rounded-lg bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                            title={`${pointsNeededForFree(item.priceEur)} pts nécessaires`}
                          >
                            {applyingLoyalty === item.id ? '...' : `🎁 Gratuit (${pointsNeededForFree(item.priceEur)} pts)`}
                          </button>
                        )}
                        {item.loyaltyFree && (
                          <button
                            onClick={() => handleRemoveLoyaltyFree(item.id, item.originalPriceEur ?? item.priceEur)}
                            className="text-[10px] font-600 px-2 py-1 rounded-lg bg-amber-100 text-amber-700 border border-amber-200 hover:bg-amber-200 transition-colors"
                          >
                            ✕ Annuler offre
                          </button>
                        )}

                        <div className="text-right">
                          {item.loyaltyFree ? (
                            <div>
                              <p className="font-mono font-700 text-emerald-600 text-base line-through text-muted-foreground text-xs">{((item.originalPriceEur ?? 0) * item.quantity).toFixed(2)} €</p>
                              <p className="font-mono font-700 text-emerald-600 text-base">0,00 € 🎁</p>
                            </div>
                          ) : (
                            <div>
                              <p className="font-mono font-700 text-foreground text-base">{(item.priceEur * item.quantity).toFixed(2)} €</p>
                              {item.quantity > 1 && <p className="font-mono text-[10px] text-muted-foreground">{item.priceEur.toFixed(2)} € / unité</p>}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}

              <Link href="/catalogue" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-primary transition-colors mt-2 w-fit">
                <Icon name="ArrowLeftIcon" size={14} variant="outline" />
                Continuer les achats
              </Link>
            </div>

            {/* Order summary */}
            <div className="lg:col-span-1">
              <div className="sticky top-24">
                <div className="topo-card p-6">
                  <h2 className="font-display font-700 text-lg text-foreground mb-5 tracking-tight">Récapitulatif</h2>

                  <div className="space-y-3 mb-5">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Sous-total ({totalItems} article{totalItems !== 1 ? 's' : ''})</span>
                      <span className="font-mono font-600 text-foreground">{totalPriceEur.toFixed(2)} €</span>
                    </div>
                    {savedEur > 0 && (
                      <div className="flex justify-between text-sm">
                        <span className="text-emerald-600 flex items-center gap-1"><Icon name="StarIcon" size={12} variant="solid" className="text-amber-500" />Économies fidélité</span>
                        <span className="font-mono font-600 text-emerald-600">-{savedEur.toFixed(2)} €</span>
                      </div>
                    )}
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Livraison</span>
                      <span className={`font-mono font-600 ${shippingEur === 0 ? 'text-emerald-600' : 'text-foreground'}`}>
                        {shippingEur === 0 ? 'Gratuite' : `${shippingEur.toFixed(2)} €`}
                      </span>
                    </div>
                    {shippingEur > 0 && (
                      <p className="text-[11px] text-muted-foreground bg-muted/50 rounded-lg px-3 py-2">
                        Livraison gratuite dès 99 € d&apos;achat — il vous manque {(99 - totalPriceEur).toFixed(2)} €
                      </p>
                    )}
                    {loyaltyDiscount > 0 && (
                      <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl">
                        <p className="text-xs font-700 text-amber-800">🏆 Niveau {loyaltyLevel}</p>
                        <p className="text-xs text-amber-700">{(loyaltyDiscount * 100).toFixed(0)}% de réduction permanente appliquée</p>
                      </div>
                    )}
                    <div className="border-t border-border pt-3 flex justify-between">
                      <span className="font-display font-700 text-foreground">Total</span>
                      <span className="font-mono font-700 text-xl text-primary">{grandTotal.toFixed(2)} €</span>
                    </div>
                  </div>

                  <div className="mb-5 p-3 bg-background rounded-lg border border-border">
                    <WeightGauge weightG={totalWeightG} maxG={20000} size="sm" />
                    <p className="text-[10px] text-muted-foreground mt-1.5 font-mono">
                      {items.length} référence{items.length !== 1 ? 's' : ''} · {totalItems} article{totalItems !== 1 ? 's' : ''}
                    </p>
                  </div>

                  <Link href="/checkout" className="btn-primary w-full justify-center py-3.5 text-base min-h-[44px]">
                    <Icon name="LockClosedIcon" size={16} variant="outline" />
                    Commander — {grandTotal.toFixed(2)} €
                  </Link>

                  <div className="mt-4 flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
                    <Icon name="ShieldCheckIcon" size={12} variant="outline" aria-hidden="true" />
                    Paiement 100% sécurisé
                  </div>
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