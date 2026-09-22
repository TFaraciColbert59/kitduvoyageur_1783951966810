'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import Icon from '@/components/ui/AppIcon';
import { Badge, Button, Card, Divider, EmptyState, IconButton, LoadingState } from '@/components/ui';
import { lkvConfirm } from '@/components/ui/dialogs';
import { getCart, updateQuantity, removeFromCart, getCartTotals, applyLoyaltyFree, removeLoyaltyFree, CartItem } from '@/lib/cart';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import MobilePageShell from '@/components/mobile-nav/MobilePageShell';

const FIELD_CLASS =
  'w-full rounded-[var(--lkv-radius-md)] border border-[color:var(--lkv-border)] bg-[color:var(--lkv-field-bg)] px-[var(--space-3)] py-[var(--space-2)] text-[length:var(--lkv-text-caption)] text-[color:var(--lkv-text-primary)] placeholder:text-[color:var(--lkv-text-muted)] focus:outline-none focus:ring-2 focus:ring-[color:var(--lkv-focus-ring)]';

export default function PanierPage() {
  const [items, setItems] = useState<CartItem[]>([]);
  const [mounted, setMounted] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);
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

  const handleRemoveRequest = async (id: string) => {
    const item = items.find((i) => i.id === id);
    const confirmed = await lkvConfirm({
      title: 'Retirer cet article ?',
      message: `${item?.name ?? 'Cet article'} sera retiré de votre panier.`,
      confirmLabel: 'Retirer',
      variant: 'destructive',
    });
    if (!confirmed) return;
    setRemovingId(id);
    setTimeout(() => {
      const updated = removeFromCart(id);
      setItems(updated);
      setRemovingId(null);
    }, 300);
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
        <LoadingState label="Chargement du panier…" />
        <Footer />
      </div>
    );
  }

  return (
    <>
      {/* ── DESKTOP VIEW (fullscreen : page = 100dvh, scroll interne) ── */}
      <div className="hidden h-[100dvh] flex-col overflow-hidden bg-transparent md:flex">
        <Header />

        <div className="min-h-0 w-full flex-1 overflow-y-auto pb-6 pt-24">
          <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
            {items.length === 0 ? (
              <EmptyState
                icon={<Icon name="ShoppingBagIcon" size={36} />}
                title="Votre panier est vide"
                description="Explorez notre catalogue pour trouver votre équipement."
                actionLabel="Voir le catalogue"
                actionHref="/boutique"
              />
            ) : (
              <>
                <div className="mb-[var(--space-8)] flex flex-col justify-between gap-[var(--space-4)] md:flex-row md:items-end">
                  <h1 className="font-display text-[length:var(--lkv-text-title-lg)] font-extrabold text-[color:var(--lkv-text-primary)]">
                    Votre <em className="font-normal italic text-[color:var(--lkv-secondary)]">panier.</em>
                  </h1>
                  <p className="text-[length:var(--lkv-text-caption-2)] font-semibold uppercase tracking-[var(--tracking-wide)] text-[color:var(--lkv-text-muted)]">
                    {totalItems} article{totalItems > 1 ? 's' : ''} · {totalWeightG >= 1000 ? `${(totalWeightG / 1000).toFixed(1).replace('.', ',')} kg` : `${totalWeightG} g`} · sous-total <span className="font-mono font-bold text-[color:var(--lkv-text-primary)]">{totalPriceEur.toFixed(0)} €</span>
                  </p>
                </div>

                <div className="grid grid-cols-1 gap-[var(--space-6)] lg:grid-cols-12">
                  <div className="flex flex-col gap-[var(--space-4)] lg:col-span-7 xl:col-span-8">

                    {/* Cart items */}
                    {items.map((item) => (
                      <Card
                        key={item.id}
                        className={`flex gap-[var(--space-6)] p-[var(--space-6)] transition-all duration-300 ${removingId === item.id ? 'scale-95 opacity-0' : 'scale-100 opacity-100'}`}
                      >
                        <div className="h-32 w-32 flex-shrink-0 overflow-hidden rounded-[var(--lkv-radius-lg)] border border-[color:var(--lkv-border)] bg-[color:var(--lkv-surface-muted)]">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          {item.image ? <img src={item.image} alt={item.name} className="h-full w-full object-cover mix-blend-multiply" /> : null}
                        </div>

                        <div className="flex min-w-0 flex-1 flex-col justify-between">
                          <div className="flex items-start justify-between gap-[var(--space-4)]">
                            <div>
                              <p className="mb-[var(--space-1)] text-[length:var(--lkv-text-caption-2)] font-semibold uppercase tracking-[var(--tracking-wide)] text-[color:var(--lkv-text-muted)]">{item.category || 'PORTAGE'}</p>
                              <Link href={`/produit/${item.slug}`} className="font-display text-[length:var(--lkv-text-headline)] font-bold text-[color:var(--lkv-text-primary)] transition-colors hover:text-[color:var(--lkv-secondary)]">
                                {item.name.split(' ').map((word, i, arr) =>
                                  i >= arr.length - 2 ? <em key={i} className="ml-[var(--space-1)] font-normal italic text-[color:var(--lkv-text-secondary)]">{word}</em> : <span key={i} className="mr-[var(--space-1)]">{word}</span>
                                )}
                              </Link>
                              <div className="mt-[var(--space-2)] flex items-center gap-[var(--space-2)]">
                                <Badge tone="sage">
                                  <span className="inline-block h-2 w-2 rounded-full bg-[color:var(--lkv-primary)]" />
                                  {item.weightG >= 1000 ? `${(item.weightG / 1000).toFixed(1).replace('.', ',')} kg` : `${item.weightG} g`}
                                </Badge>
                              </div>
                            </div>

                            <div className="flex flex-col items-end">
                              <div className="flex items-center gap-[var(--space-1)] rounded-full border border-[color:var(--lkv-border)] bg-[color:var(--lkv-surface-muted)] p-[var(--space-1)]">
                                <IconButton variant="ghost" onClick={() => handleQuantity(item.id, item.quantity - 1)} aria-label="Réduire la quantité">
                                  <Icon name="MinusIcon" size={12} />
                                </IconButton>
                                <span className="w-4 text-center text-[length:var(--lkv-text-body-sm)] font-semibold text-[color:var(--lkv-text-primary)]">{item.quantity}</span>
                                <IconButton variant="ghost" onClick={() => handleQuantity(item.id, item.quantity + 1)} aria-label="Augmenter la quantité">
                                  <Icon name="PlusIcon" size={12} />
                                </IconButton>
                              </div>
                            </div>
                          </div>

                          <div className="mt-[var(--space-4)] flex items-end justify-between">
                            <div className="flex gap-[var(--space-4)]">
                              <Button variant="secondary" size="sm" icon={<Icon name="BookmarkIcon" size={14} variant="outline" />}>
                                Enregistrer
                              </Button>
                              <Button variant="secondary" size="sm" onClick={() => handleRemoveRequest(item.id)} icon={<Icon name="TrashIcon" size={14} variant="outline" />}>
                                Retirer
                              </Button>
                            </div>

                            <div className="text-right">
                              <p className="font-mono text-[length:var(--lkv-text-headline)] font-bold text-[color:var(--lkv-text-primary)]">{(item.priceEur * item.quantity).toFixed(0)} €</p>
                              <p className="text-[length:var(--lkv-text-caption-2)] text-[color:var(--lkv-text-muted)]">TVA incluse</p>
                            </div>
                          </div>
                        </div>
                      </Card>
                    ))}

                    {/* Upsell Section */}
                    <Card variant="compact" className="flex items-center justify-between gap-[var(--space-6)] p-[var(--space-6)]">
                      <div className="flex min-w-0 items-center gap-[var(--space-6)]">
                        <div className="flex h-20 w-20 flex-shrink-0 items-center justify-center overflow-hidden rounded-[var(--lkv-radius-lg)] bg-[color:var(--lkv-surface-muted)] p-[var(--space-2)]">
                          <img src="https://images.unsplash.com/photo-1504851149312-7a075b496cc7?w=400&q=80" alt="Lampe" className="h-full w-full rounded-[var(--lkv-radius-md)] object-cover" />
                        </div>
                        <div className="min-w-0">
                          <p className="mb-[var(--space-1)] text-[length:var(--lkv-text-caption-2)] font-semibold uppercase tracking-[var(--tracking-wide)] text-[color:var(--lkv-text-muted)]">ON A PENSÉ POUR VOUS</p>
                          <p className="font-display text-[length:var(--lkv-text-headline)] font-bold text-[color:var(--lkv-text-primary)]">Lampe frontale <em className="font-normal italic text-[color:var(--lkv-text-secondary)]">350 lumens.</em></p>
                          <p className="mt-[var(--space-1)] text-[length:var(--lkv-text-caption)] text-[color:var(--lkv-text-muted)]">Autonomie 45 h, batterie rechargeable. Souvent oubliée, jamais regrettée.</p>
                        </div>
                      </div>
                      <Button variant="secondary" size="sm" className="flex-shrink-0" icon={<Icon name="PlusIcon" size={14} />} iconPosition="trailing">
                        84 €
                      </Button>
                    </Card>
                  </div>

                  {/* Order summary */}
                  <div className="lg:col-span-5 xl:col-span-4">
                    <Card className="p-[var(--space-8)]">
                      <h3 className="mb-[var(--space-6)] font-display text-[length:var(--lkv-text-headline)] font-bold text-[color:var(--lkv-text-primary)]">Récapitulatif</h3>

                      <div className="mb-[var(--space-8)] space-y-[var(--space-4)]">
                        <div className="flex justify-between text-[length:var(--lkv-text-body-sm)]">
                          <span className="text-[color:var(--lkv-text-muted)]">Sous-total ({totalItems} articles)</span>
                          <span className="font-mono font-bold text-[color:var(--lkv-text-primary)]">{totalPriceEur.toFixed(0)} €</span>
                        </div>
                        <div className="flex justify-between text-[length:var(--lkv-text-body-sm)]">
                          <span className="text-[color:var(--lkv-text-muted)]">Poids total</span>
                          <span className="font-mono font-bold text-[color:var(--lkv-text-primary)]">{totalWeightG >= 1000 ? `${(totalWeightG / 1000).toFixed(1).replace('.', ',')} kg` : `${totalWeightG} g`}</span>
                        </div>
                        <div className="flex justify-between text-[length:var(--lkv-text-body-sm)]">
                          <span className="text-[color:var(--lkv-text-muted)]">Livraison suivie</span>
                          <span className="font-mono font-bold text-[color:var(--lkv-text-primary)]">{shippingEur === 0 ? 'Offerte' : `${shippingEur.toFixed(2)} €`}</span>
                        </div>
                        <div className="flex justify-between text-[length:var(--lkv-text-body-sm)]">
                          <span className="text-[color:var(--lkv-text-muted)]">Estimation TVA</span>
                          <span className="font-semibold text-[color:var(--lkv-text-muted)]">Incluse</span>
                        </div>
                      </div>

                      <div className="mb-[var(--space-8)] flex gap-[var(--space-2)]">
                        <input type="text" placeholder="Code promo" aria-label="Code promo" className={`${FIELD_CLASS} min-w-0 flex-1`} />
                        <Button variant="secondary" size="sm">Appliquer</Button>
                      </div>

                      <div className="mb-[var(--space-6)] flex items-end justify-between border-t border-[color:var(--lkv-border)] pt-[var(--space-6)] font-display text-[length:var(--lkv-text-title-sm)] font-extrabold">
                        <span className="text-[length:var(--lkv-text-headline)] text-[color:var(--lkv-text-primary)]">Total à payer</span>
                        <span className="font-mono font-bold text-[color:var(--lkv-text-primary)]">{grandTotal.toFixed(0)} €</span>
                      </div>

                      <Link href="/checkout" className="mb-[var(--space-4)] block w-full">
                        <Button variant="primary" size="lg" fullWidth>
                          Passer au paiement →
                        </Button>
                      </Link>
                      <p className="mb-[var(--space-8)] flex items-center justify-center gap-[var(--space-1)] text-center text-[length:var(--lkv-text-caption-2)] text-[color:var(--lkv-text-muted)]">
                        <Icon name="LockClosedIcon" size={12} /> Paiement sécurisé Stripe
                      </p>

                      <div className="mb-[var(--space-6)] flex justify-center gap-[var(--space-2)] opacity-60">
                        {/* Fake payment logos */}
                        <Badge tone="stone" className="font-mono">VISA</Badge>
                        <Badge tone="stone" className="font-mono">MC</Badge>
                        <Badge tone="stone" className="font-mono">AMEX</Badge>
                        <Badge tone="stone" className="font-mono">Apple Pay</Badge>
                      </div>

                      <Card variant="compact" className="flex justify-between gap-[var(--space-2)] text-center text-[length:var(--lkv-text-caption-2)] font-semibold text-[color:var(--lkv-text-muted)]">
                        <div className="flex flex-1 flex-col items-center gap-[var(--space-2)]">
                          <Icon name="StarIcon" size={16} /> Garantie à vie
                        </div>
                        <div className="flex flex-1 flex-col items-center gap-[var(--space-2)]">
                          <Icon name="ArrowPathIcon" size={16} /> Retour 30 j.
                        </div>
                        <div className="flex flex-1 flex-col items-center gap-[var(--space-2)]">
                          <Icon name="MapPinIcon" size={16} /> 100 % Europe
                        </div>
                      </Card>

                    </Card>
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
            <EmptyState
              icon={<Icon name="ShoppingBagIcon" size={32} />}
              title="Votre panier est vide"
              description="Explorez notre catalogue pour trouver votre équipement."
              actionLabel="Voir le catalogue"
              actionHref="/boutique"
            />
          ) : (
            <>
              {/* Cart header */}
              <div className="border-b border-[color:var(--lkv-border)] px-[var(--space-4)] pb-[var(--space-4)] pt-[var(--space-3)]">
                <h1 className="m-0 text-[length:var(--lkv-text-title-sm)] tracking-[var(--lkv-tracking-title)] text-[color:var(--lkv-text-primary)]">
                  {totalItems} pièce{totalItems > 1 ? 's' : ''}<br/>
                  <em className="font-normal italic text-[color:var(--lkv-secondary)]">prêtes à partir.</em>
                </h1>
                <div className="mt-0.5 font-mono text-[length:var(--lkv-text-caption)] text-[color:var(--lkv-text-muted)]">
                  MSA-CH-2026-047 · panier ouvert
                </div>
              </div>

              {/* Cart items */}
              {items.map((item) => (
                <div key={item.id} className="flex gap-[var(--space-3)] border-b border-[color:var(--lkv-border-subtle)] p-[var(--space-4)]">
                  <Link href={`/produit/${item.slug}`} aria-label={item.name} className="no-underline">
                    <div className="h-[92px] w-[76px] flex-shrink-0 overflow-hidden rounded-[var(--lkv-radius-md)] bg-[color:var(--lkv-surface-muted)]">
                      {item.image ? <img src={item.image} alt={item.name} className="h-full w-full object-cover mix-blend-multiply" /> : null}
                    </div>
                  </Link>
                  <div className="flex flex-1 flex-col justify-between">
                    <div>
                      <div className="font-mono text-[length:var(--lkv-text-caption-2)] uppercase tracking-[var(--tracking-wide)] text-[color:var(--lkv-text-muted)]">
                        {item.category || 'PORTAGE'}
                      </div>
                      <Link href={`/produit/${item.slug}`} className="no-underline">
                        <div className="mt-0.5 text-[length:var(--lkv-text-body-sm)] font-medium text-[color:var(--lkv-text-primary)]">
                          {item.name}
                        </div>
                      </Link>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-[6px] rounded-full border border-[color:var(--lkv-border)] bg-[color:var(--lkv-surface-muted)] px-[6px] py-[3px]">
                        <IconButton variant="ghost" onClick={() => handleQuantity(item.id, Math.max(1, item.quantity - 1))} aria-label="Diminuer la quantité">
                          <Icon name="MinusIcon" size={12} />
                        </IconButton>
                        <span className="min-w-[22px] text-center font-mono text-[length:var(--lkv-text-body-sm)] font-semibold text-[color:var(--lkv-text-primary)]">{item.quantity}</span>
                        <IconButton variant="ghost" onClick={() => handleQuantity(item.id, item.quantity + 1)} aria-label="Augmenter la quantité">
                          <Icon name="PlusIcon" size={12} />
                        </IconButton>
                      </div>
                      <div className="text-right">
                        <div className="font-mono text-[length:var(--lkv-text-subheadline)] font-bold text-[color:var(--lkv-text-primary)]">{(item.priceEur * item.quantity).toFixed(0)} €</div>
                        <Button variant="ghost" size="sm" className="px-[var(--space-2)]" onClick={() => handleRemoveRequest(item.id)}>Retirer</Button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}

              {/* Promo banner */}
              <Card variant="compact" className="mx-[var(--space-4)] my-[var(--space-4)] border-dashed border-[color:var(--lkv-secondary-subtle)] px-[var(--space-4)] py-[var(--space-3)]">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-mono text-[length:var(--lkv-text-caption-2)] uppercase tracking-[var(--tracking-wide)] text-[color:var(--lkv-text-muted)]">Code promo</div>
                    <div className="mt-0.5 text-[length:var(--lkv-text-footnote)] font-medium text-[color:var(--lkv-text-primary)]">BIENVENUE10</div>
                  </div>
                  <Button variant="secondary" size="sm">Appliquer →</Button>
                </div>
              </Card>

              {/* Summary card */}
              <Card className="mx-[var(--space-4)] p-[var(--space-4)]">
                <div className="mb-[var(--space-2)] flex justify-between">
                  <span className="text-[length:var(--lkv-text-footnote)] text-[color:var(--lkv-text-muted)]">Sous-total</span>
                  <span className="font-mono text-[length:var(--lkv-text-footnote)] font-bold text-[color:var(--lkv-text-primary)]">{totalPriceEur.toFixed(0)} €</span>
                </div>
                <div className="mb-[var(--space-2)] flex justify-between">
                  <span className="text-[length:var(--lkv-text-footnote)] text-[color:var(--lkv-text-muted)]">Livraison</span>
                  <span className="font-mono text-[length:var(--lkv-text-footnote)] font-bold text-[color:var(--lkv-text-primary)]">{shippingEur === 0 ? 'Offerte' : `${shippingEur.toFixed(2)} €`}</span>
                </div>
                <Divider spacing="sm" />
                <div className="flex justify-between">
                  <span className="text-[length:var(--lkv-text-subheadline)] font-bold text-[color:var(--lkv-text-primary)]">Total</span>
                  <span className="font-mono text-[length:var(--lkv-text-subheadline)] font-bold text-[color:var(--lkv-text-primary)]">{grandTotal.toFixed(0)} €</span>
                </div>
              </Card>

              {/* CTA */}
              <div className="p-[var(--space-4)]">
                <Link
                  href="/checkout"
                  className="flex min-h-[var(--control-height-lg)] w-full items-center justify-between rounded-full bg-[color:var(--lkv-action)] px-[var(--space-5)] font-semibold text-[color:var(--lkv-on-action)] no-underline transition-transform active:scale-[var(--motion-press-scale)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--lkv-focus-ring)] motion-reduce:transition-none"
                >
                  <span>Suivant</span>
                  <span className="font-mono text-[length:var(--lkv-text-caption)] opacity-75">{grandTotal.toFixed(0)} €</span>
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
