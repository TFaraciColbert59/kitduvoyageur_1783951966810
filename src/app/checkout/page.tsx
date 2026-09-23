'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import Icon from '@/components/ui/AppIcon';
import { Badge, Button, Card, Divider, LoadingState } from '@/components/ui';
import { getCart, getCartTotals, clearCart, CartItem } from '@/lib/cart';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import MobilePageShell from '@/components/mobile-nav/MobilePageShell';

type Step = 'livraison' | 'paiement' | 'confirmation';
type PaymentMethod = 'card' | 'paypal' | 'apple_pay' | 'google_pay' | 'virement';

const FIELD_CLASS =
  'w-full rounded-[var(--lkv-radius-md)] border border-[color:var(--lkv-border)] bg-[color:var(--lkv-field-bg)] px-[var(--space-3)] py-[var(--space-2)] text-[length:var(--lkv-text-caption)] text-[color:var(--lkv-text-primary)] placeholder:text-[color:var(--lkv-text-muted)] focus:outline-none focus:ring-2 focus:ring-[color:var(--lkv-focus-ring)]';

const LABEL_CLASS =
  'mb-[var(--space-2)] block text-[length:var(--lkv-text-caption-2)] font-semibold uppercase tracking-[var(--tracking-wide)] text-[color:var(--lkv-text-muted)]';

const SECONDARY_LINK_CLASS =
  'inline-flex min-h-[var(--control-height-md)] w-full items-center justify-center gap-[var(--space-2)] rounded-full border border-[color:var(--glass-border)] bg-[color:var(--card-tint-strong)] px-[var(--space-6)] text-[length:var(--lkv-text-subheadline)] font-semibold text-[color:var(--card-content)] transition-colors hover:bg-[color:var(--lkv-hover-surface)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--lkv-focus-ring)]';

export default function CheckoutPage() {
  const [step, setStep] = useState<Step>('livraison');
  const [items, setItems] = useState<CartItem[]>([]);
  const [mounted, setMounted] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('card');
  const [orderNumber, setOrderNumber] = useState('');
  const [shippingOption, setShippingOption] = useState('standard');
  const [stripeConfigured, setStripeConfigured] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [shipping, setShipping] = useState({
    prenom: '', nom: '', email: '', telephone: '',
    adresse: '', complement: '', codePostal: '', ville: '', pays: 'France',
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  const { user } = useAuth();
  const supabase = createClient();

  useEffect(() => {
    setItems(getCart());
    setMounted(true);
    // Check if Stripe is configured
    const stripeKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
    setStripeConfigured(!!stripeKey && !stripeKey.includes('your-stripe'));
    // Check for success redirect from Stripe — le numéro de commande est créé
    // côté serveur par le webhook (jamais fabriqué côté client).
    const params = new URLSearchParams(window.location.search);
    if (params.get('success') === 'true') {
      setStep('confirmation');
      setOrderNumber('');
    }
  }, []);

  const { totalPriceEur } = getCartTotals(items);
  const shippingCosts: Record<string, number> = {
    standard: totalPriceEur >= 99 ? 0 : 5.9,
    express: 9.9,
    relay: 3.9,
  };
  const shippingEur = shippingCosts[shippingOption] ?? 5.9;
  const grandTotal = totalPriceEur + shippingEur;

  const validateShipping = () => {
    const newErrors: Record<string, string> = {};
    if (!shipping.prenom.trim()) newErrors.prenom = 'Requis';
    if (!shipping.nom.trim()) newErrors.nom = 'Requis';
    if (!shipping.email.trim() || !/\S+@\S+\.\S+/.test(shipping.email)) newErrors.email = 'Email invalide';
    if (!shipping.adresse.trim()) newErrors.adresse = 'Requis';
    if (!shipping.codePostal.trim()) newErrors.codePostal = 'Requis';
    if (!shipping.ville.trim()) newErrors.ville = 'Requis';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleShippingSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateShipping()) return;
    setStep('paiement');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleStripeCheckout = async () => {
    setProcessing(true);
    try {
      const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || window.location.origin;
      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: items.map((i) => ({
            name: i.name,
            priceEur: i.priceEur,
            quantity: i.quantity,
            image: i.image,
          })),
          successUrl: `${siteUrl}/checkout?success=true`,
          cancelUrl: `${siteUrl}/panier`,
        }),
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
        return;
      }
      throw new Error('No redirect URL from Stripe');
    } catch (err) {
      setProcessing(false);
      setError(
        err instanceof Error && err.message === 'No redirect URL from Stripe'
          ? "Le paiement n'a pas pu être initié. Vérifiez votre commande et réessayez."
          : 'Impossible de contacter le service de paiement. Veuillez réessayer dans un instant.'
      );
    }
  };

  const handleVirementSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setProcessing(true);
    try {
      const realNumber = await saveOrderToSupabase('virement');
      setOrderNumber(realNumber);
      setStep('confirmation');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch {
      setError("L'enregistrement de votre commande a échoué. Veuillez réessayer.");
    } finally {
      setProcessing(false);
    }
  };

  const saveOrderToSupabase = async (method: string): Promise<string> => {
    try {
      // Prix serveur uniquement (products) — jamais les prix du panier client.
      const slugs = items.map((i) => i.slug).filter(Boolean);
      const { data: serverProducts } = slugs.length > 0
        ? await supabase.from('products').select('id, slug, name, price_eur').in('slug', slugs)
        : { data: [] };
      const priceBySlug = new Map<string, { id: string; slug: string; name: string; price_eur: number }>(
        (serverProducts || []).map((p: any) => [p.slug, p])
      );

      const orderItems = items.map((i) => {
        const server = i.slug ? priceBySlug.get(i.slug) : null;
        return {
          name: server?.name || i.name,
          quantity: i.quantity,
          unit_price_eur: Number(server?.price_eur ?? 0),
          slug: i.slug,
        };
      });

      const serverSubtotal = orderItems.reduce((s, it) => s + it.unit_price_eur * it.quantity, 0);
      const serverShipping = shippingCosts[shippingOption] ?? 5.9;
      const serverDiscountEligible = serverSubtotal >= 99;
      const finalShippingEur = shippingOption === 'standard' && serverDiscountEligible ? 0 : serverShipping;
      const finalTotal = serverSubtotal + finalShippingEur;

      // order_number : généré par la base (défaut `KDV-…`), jamais par le client.
      const { data: orderData, error: orderError } = await supabase
        .from('orders')
        .insert({
          user_id: user?.id ?? null,
          status: 'confirmed',
          payment_method: method,
          shipping_address: shipping,
          items: orderItems,
          subtotal_eur: serverSubtotal,
          shipping_eur: finalShippingEur,
          total_eur: finalTotal,
          loyalty_points_earned: Math.floor(finalTotal * 10),
        })
        .select('id, order_number')
        .single();

      if (orderError) throw orderError;

      const realNumber = orderData?.order_number || '';

      // Decrement stock
      for (const item of items) {
        if (!item.slug) continue;
        const productData = priceBySlug.get(item.slug);
        if (!productData) continue;

        const { data: currentRow } = await supabase
          .from('products')
          .select('stock')
          .eq('id', productData.id)
          .single();
        const currentStock = Number(currentRow?.stock ?? 0);
        const newStock = Math.max(0, currentStock - item.quantity);
        await supabase.from('products').update({
          stock: newStock,
          updated_at: new Date().toISOString(),
        }).eq('id', productData.id);

        await supabase.from('stock_movements').insert({
          product_id: productData.id,
          product_slug: productData.slug,
          product_name: productData.name,
          movement_type: 'sale',
          quantity_change: -item.quantity,
          quantity_before: currentStock,
          quantity_after: newStock,
          reference_type: 'order',
          reference_id: orderData?.id ?? null,
          user_id: user?.id ?? null,
          notes: realNumber ? `Vente via commande ${realNumber}` : 'Vente via commande',
        });
      }

      // Award loyalty points
      if (user) {
        const pointsEarned = Math.floor(finalTotal * 10);
        try {
          await supabase.rpc('increment_loyalty_points' as never, {
            p_user_id: user.id,
            p_points: pointsEarned,
          });
        } catch {
          const { data } = await supabase.from('user_profiles')
            .select('loyalty_points')
            .eq('id', user.id)
            .single();
          if (data) {
            await supabase.from('user_profiles').update({
              loyalty_points: ((data as { loyalty_points?: number }).loyalty_points ?? 0) + pointsEarned,
            }).eq('id', user.id);
          }
        }

        await supabase.from('loyalty_history').insert({
          user_id: user.id,
          action: realNumber ? `Commande ${realNumber}` : 'Commande virement',
          points: Math.floor(finalTotal * 10),
          type: 'earned',
        });
      }

      clearCart();

      // B1: Auto-populate gear_items
      if (user && orderData?.id) {
        try {
          for (const item of orderItems) {
            if (!item.name) continue;
            await supabase.from('gear_items').insert({
              user_id: user.id,
              name: item.name,
              category: 'autre',
              condition: 'neuf',
              source: 'achat',
              origin_order_id: orderData.id,
              weight_g: 0,
              brand: '',
              model: '',
              notes: realNumber ? `Importé automatiquement depuis la commande ${realNumber}` : 'Importé automatiquement depuis une commande',
              acquired_at: new Date().toISOString().split('T')[0],
            });
          }
        } catch {
          // Best-effort
        }
      }

      return realNumber;
    } catch (err) {
      console.error('Order save error:', err);
    }
    return '';
  };

  const formatPriceEur = (val: number): string => {
    return val.toLocaleString('fr-FR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }) + ' €';
  };

  const steps: { id: Step; label: string; num: number }[] = [
    { id: 'livraison', label: 'Livraison', num: 1 },
    { id: 'paiement', label: 'Paiement', num: 2 },
    { id: 'confirmation', label: 'Confirmation', num: 3 },
  ];

  const PAYMENT_METHODS = [
    {
      id: 'card' as PaymentMethod,
      label: 'Carte bancaire',
      icon: '💳',
      desc: 'Visa, Mastercard, Amex — paiement sécurisé Stripe',
      badge: 'Recommandé',
      disabled: false,
    },
    {
      id: 'apple_pay' as PaymentMethod,
      label: 'Apple Pay',
      icon: '🍎',
      desc: 'Paiement express avec Touch ID / Face ID',
      badge: 'Safari iOS',
      disabled: true,
      note: 'Disponible sur Safari iOS avec appareil compatible',
    },
    {
      id: 'paypal' as PaymentMethod,
      label: 'PayPal',
      icon: '🅿️',
      desc: 'Paiement sécurisé via votre compte PayPal',
      disabled: false,
    },
    {
      id: 'virement' as PaymentMethod,
      label: 'Virement bancaire',
      icon: '🏦',
      desc: 'Délai 2–3 jours ouvrés — validation manuelle',
      disabled: false,
    },
  ];

  if (!mounted) {
    return (
      <div className="min-h-screen bg-transparent">
        <Header />
        <LoadingState label="Chargement de la commande…" />
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
          <div className="mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8">
            {step !== 'confirmation' && (
              <h1 className="mb-[var(--space-8)] font-display text-[length:var(--lkv-text-title-lg)] font-extrabold text-[color:var(--lkv-text-primary)]">
                Presque <em className="font-normal italic text-[color:var(--lkv-secondary)]">parti.</em>
              </h1>
            )}

            <div className="grid grid-cols-1 gap-[var(--space-6)] lg:grid-cols-12">
              {/* Main content */}
              <div className="lg:col-span-7 xl:col-span-8">

                {step !== 'confirmation' ? (
                  <div className="space-y-[var(--space-6)]">

                    {/* ── STEP 1: Vos coordonnées ── */}
                    <Card className={`p-[var(--space-8)] transition-opacity ${step !== 'livraison' ? 'pointer-events-none opacity-50' : ''}`}>
                      <div className="mb-[var(--space-6)] flex items-center justify-between">
                        <h2 className="flex items-center gap-[var(--space-3)] font-display text-[length:var(--lkv-text-headline)] font-bold text-[color:var(--lkv-text-primary)]">
                          <span className="font-normal italic text-[color:var(--lkv-text-secondary)]">01</span> Vos coordonnées
                        </h2>
                        <Button variant="secondary" size="sm">Se connecter</Button>
                      </div>

                      <div className="space-y-[var(--space-4)]">
                        <div>
                          <label htmlFor="checkout-email" className={LABEL_CLASS}>Email</label>
                          <input
                            id="checkout-email"
                            type="email"
                            autoComplete="email"
                            value={shipping.email}
                            onChange={(e) => setShipping(prev => ({ ...prev, email: e.target.value }))}
                            className={`${FIELD_CLASS} ${errors.email ? 'ring-1 ring-[color:var(--lkv-danger)]' : ''}`}
                          />
                        </div>
                        <label className="mt-[var(--space-2)] flex cursor-pointer items-center gap-[var(--space-3)]">
                          <span aria-hidden="true" className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-[color:var(--btn-tint)] border border-[color:var(--btn-glass-border)] backdrop-blur-[var(--btn-blur)] saturate-[var(--btn-saturate)] lkv-rim-btn text-[color:var(--lkv-text-primary)]">
                            <Icon name="CheckIcon" size={10} />
                          </span>
                          <span className="text-[length:var(--lkv-text-caption)] text-[color:var(--lkv-text-primary)]">Recevoir le journal du Kit — un envoi par saison, refuges et sentiers uniquement.</span>
                        </label>
                      </div>
                    </Card>

                    {/* ── STEP 2: Livraison ── */}
                    <Card className={`p-[var(--space-8)] transition-opacity ${step !== 'livraison' ? 'pointer-events-none opacity-50' : ''}`}>
                      <h2 className="mb-[var(--space-6)] flex items-center gap-[var(--space-3)] font-display text-[length:var(--lkv-text-headline)] font-bold text-[color:var(--lkv-text-primary)]">
                        <span className="font-normal italic text-[color:var(--lkv-text-secondary)]">02</span> Livraison
                      </h2>

                      <div className="mb-[var(--space-8)] grid grid-cols-2 gap-[var(--space-4)]">
                        <div>
                          <label htmlFor="checkout-prenom" className={LABEL_CLASS}>Prénom</label>
                          <input
                            id="checkout-prenom"
                            type="text"
                            autoComplete="given-name"
                            value={shipping.prenom}
                            onChange={(e) => setShipping(prev => ({ ...prev, prenom: e.target.value }))}
                            className={`${FIELD_CLASS} ${errors.prenom ? 'ring-1 ring-[color:var(--lkv-danger)]' : ''}`}
                          />
                        </div>
                        <div>
                          <label htmlFor="checkout-nom" className={LABEL_CLASS}>Nom</label>
                          <input
                            id="checkout-nom"
                            type="text"
                            autoComplete="family-name"
                            value={shipping.nom}
                            onChange={(e) => setShipping(prev => ({ ...prev, nom: e.target.value }))}
                            className={`${FIELD_CLASS} ${errors.nom ? 'ring-1 ring-[color:var(--lkv-danger)]' : ''}`}
                          />
                        </div>
                        <div className="col-span-2">
                          <label htmlFor="checkout-adresse" className={LABEL_CLASS}>Adresse</label>
                          <input
                            id="checkout-adresse"
                            type="text"
                            autoComplete="street-address"
                            value={shipping.adresse}
                            onChange={(e) => setShipping(prev => ({ ...prev, adresse: e.target.value }))}
                            className={`${FIELD_CLASS} ${errors.adresse ? 'ring-1 ring-[color:var(--lkv-danger)]' : ''}`}
                          />
                        </div>
                        <div className="col-span-2">
                          <label htmlFor="checkout-complement" className={LABEL_CLASS}>Complément (Optionnel)</label>
                          <input
                            id="checkout-complement"
                            type="text"
                            autoComplete="address-line2"
                            value={shipping.complement}
                            onChange={(e) => setShipping(prev => ({ ...prev, complement: e.target.value }))}
                            placeholder="Bâtiment - étage - digicode"
                            className={FIELD_CLASS}
                          />
                        </div>
                        <div>
                          <label htmlFor="checkout-code-postal" className={LABEL_CLASS}>Code postal</label>
                          <input
                            id="checkout-code-postal"
                            type="text"
                            autoComplete="postal-code"
                            inputMode="numeric"
                            value={shipping.codePostal}
                            onChange={(e) => setShipping(prev => ({ ...prev, codePostal: e.target.value }))}
                            className={`${FIELD_CLASS} ${errors.codePostal ? 'ring-1 ring-[color:var(--lkv-danger)]' : ''}`}
                          />
                        </div>
                        <div>
                          <label htmlFor="checkout-ville" className={LABEL_CLASS}>Ville</label>
                          <input
                            id="checkout-ville"
                            type="text"
                            autoComplete="address-level2"
                            value={shipping.ville}
                            onChange={(e) => setShipping(prev => ({ ...prev, ville: e.target.value }))}
                            className={`${FIELD_CLASS} ${errors.ville ? 'ring-1 ring-[color:var(--lkv-danger)]' : ''}`}
                          />
                        </div>
                        <div>
                          <label htmlFor="checkout-pays" className={LABEL_CLASS}>Pays</label>
                          <select id="checkout-pays" autoComplete="country" className={`${FIELD_CLASS} appearance-none`}>
                            <option>France</option>
                            <option>Belgique</option>
                            <option>Suisse</option>
                          </select>
                        </div>
                        <div>
                          <label htmlFor="checkout-telephone" className={LABEL_CLASS}>Téléphone</label>
                          <input
                            id="checkout-telephone"
                            type="tel"
                            autoComplete="tel"
                            value={shipping.telephone}
                            onChange={(e) => setShipping(prev => ({ ...prev, telephone: e.target.value }))}
                            placeholder="+33 6 12 34 56 78"
                            className={FIELD_CLASS}
                          />
                        </div>
                      </div>

                      <div>
                        <span className={`${LABEL_CLASS} mb-[var(--space-3)]`}>Mode d&apos;expédition</span>
                        <div className="space-y-[var(--space-3)]">
                          {[
                            { id: 'standard', label: 'Livraison suivie', desc: 'Colis relais ou domicile - 3 à 5 jours ouvrés - CO2 compensé', price: totalPriceEur >= 99 ? 'Offerte' : '5,90 €' },
                            { id: 'express', label: 'Express 48h', desc: 'Livré à domicile en 48 h - sur créneau choisi', price: '14 €' },
                            { id: 'relay', label: 'Retrait en atelier', desc: 'Manosque, Alpes-de-Haute-Provence - disponible dès demain', price: 'Offerte' },
                          ].map((opt) => (
                            <label
                              key={opt.id}
                              className={`flex cursor-pointer items-center justify-between rounded-[var(--lkv-radius-md)] border bg-[color:var(--glass-bg-medium)] backdrop-blur-[var(--glass-blur-sm)] saturate-[var(--glass-sat)] lkv-rim-inset p-[var(--space-4)] transition-colors ${shippingOption === opt.id ? 'border-[color:var(--lkv-secondary)]' : 'border-[color:var(--glass-border)]'}`}
                            >
                              <div className="flex items-center gap-[var(--space-4)]">
                                <span className={`flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-full border ${shippingOption === opt.id ? 'border-[color:var(--lkv-primary)]' : 'border-[color:var(--lkv-text-secondary)]'}`}>
                                  {shippingOption === opt.id && <span className="h-2 w-2 rounded-full bg-[color:var(--lkv-primary)]" />}
                                </span>
                                <div>
                                  <p className="text-[length:var(--lkv-text-body-sm)] font-semibold text-[color:var(--lkv-text-primary)]">{opt.label}</p>
                                  <p className="mt-0.5 text-[length:var(--lkv-text-caption-2)] text-[color:var(--lkv-text-muted)]">{opt.desc}</p>
                                </div>
                              </div>
                              <span className="font-mono text-[length:var(--lkv-text-body-sm)] font-bold text-[color:var(--lkv-text-primary)]">{opt.price}</span>
                            </label>
                          ))}
                        </div>
                      </div>

                      {step === 'livraison' && (
                        <Button onClick={handleShippingSubmit} variant="primary" size="lg" fullWidth className="mt-[var(--space-8)]">
                          Continuer vers le paiement →
                        </Button>
                      )}
                    </Card>

                    {/* ── STEP 3: Paiement ── */}
                    <Card className={`p-[var(--space-8)] transition-opacity ${step !== 'paiement' ? 'pointer-events-none opacity-50' : ''}`}>
                      <h2 className="mb-[var(--space-6)] flex items-center gap-[var(--space-3)] font-display text-[length:var(--lkv-text-headline)] font-bold text-[color:var(--lkv-text-primary)]">
                        <span className="font-normal italic text-[color:var(--lkv-text-secondary)]">03</span> Paiement
                      </h2>

                      {step === 'paiement' && (
                        <>
                          {error && (
                            <div role="alert" className="mb-[var(--space-8)] rounded-[var(--lkv-radius-md)] border border-[color:var(--lkv-danger)] bg-[color:var(--lkv-danger-bg)] p-[var(--space-4)] text-[length:var(--lkv-text-body-sm)] leading-[var(--leading-relaxed)] text-[color:var(--lkv-danger-dark)]">
                              {error}
                            </div>
                          )}
                          <div role="radiogroup" aria-label="Moyen de paiement" className="mb-[var(--space-8)] grid grid-cols-2 gap-[var(--space-2)] sm:grid-cols-4">
                            {PAYMENT_METHODS.map((method) => {
                              const isSelected = paymentMethod === method.id;
                              return (
                                <button
                                  key={method.id}
                                  type="button"
                                  role="radio"
                                  aria-checked={isSelected}
                                  disabled={method.disabled}
                                  onClick={() => !method.disabled && setPaymentMethod(method.id)}
                                  className={`group relative flex h-auto flex-col items-center justify-center gap-[var(--space-1)] rounded-[var(--lkv-radius-md)] border p-[var(--space-3)] text-center transition-all ${
                                    isSelected
                                      ? 'border-[color:var(--glass-rim)] bg-[color:var(--g3-bg)] text-[color:var(--g3-text)] shadow-md'
                                      : method.disabled
                                      ? 'cursor-not-allowed border-[color:var(--glass-border)] bg-[color:var(--glass-bg-subtle)] opacity-40'
                                      : 'border-[color:var(--glass-border)] bg-[color:var(--glass-bg-medium)] text-[color:var(--glass-label)] hover:bg-[color:var(--lkv-hover-surface)]'
                                  }`}
                                >
                                  <span className="text-[20px]">{method.icon}</span>
                                  <span className="font-mono text-[length:var(--lkv-text-caption-2)] font-semibold uppercase tracking-[var(--tracking-caps)]">
                                    {method.label}
                                  </span>
                                  {method.note && (
                                    <span className="mt-0.5 text-[9px] leading-tight opacity-75">
                                      {method.note}
                                    </span>
                                  )}
                                </button>
                              );
                            })}
                          </div>

                          <div className="mb-[var(--space-8)] flex justify-center">
                            {/* Fake Credit Card visual — Monochrome Liquid Glass (iOS 27 HIG) */}
                            <div className="relative aspect-[1.586] w-full max-w-[320px] overflow-hidden rounded-[var(--lkv-radius-lg)] border border-[color:var(--glass-rim)] bg-gradient-to-br from-[var(--glass-bg-prominent)] to-[var(--glass-bg-medium)] p-[var(--space-6)] text-[color:var(--glass-label)] shadow-md backdrop-blur-xl">
                              <div className="pointer-events-none absolute right-[-20px] top-[-20px] h-40 w-40 rounded-full bg-white/5 blur-2xl" />
                              <div className="mb-[var(--space-8)] h-8 w-12 rounded border border-white/20 bg-gradient-to-br from-white/20 to-white/5" />
                              <div className="mb-[var(--space-6)] flex justify-between font-mono text-[length:var(--lkv-text-headline)] tracking-[var(--tracking-caps)]">
                                <span>••••</span><span>••••</span><span>••••</span><span>4242</span>
                              </div>
                              <div className="flex items-end justify-between">
                                <div>
                                  <p className="mb-[var(--space-1)] font-mono text-[length:var(--lkv-text-caption-2)] uppercase tracking-[var(--tracking-caps)] opacity-60">Titulaire</p>
                                  <p className="max-w-[120px] truncate text-[length:var(--lkv-text-body-sm)] font-semibold uppercase">{shipping.prenom ? `${shipping.prenom[0]}. ${shipping.nom}` : 'M. Chevrier'}</p>
                                </div>
                                <div>
                                  <p className="mb-[var(--space-1)] font-mono text-[length:var(--lkv-text-caption-2)] uppercase tracking-[var(--tracking-caps)] opacity-60">Expire</p>
                                  <p className="font-mono text-[length:var(--lkv-text-body-sm)] font-semibold">09/28</p>
                                </div>
                                <div className="text-[length:var(--lkv-text-title-sm)] font-bold italic opacity-80">VISA</div>
                              </div>
                            </div>
                          </div>

                          <div className="space-y-[var(--space-4)]">
                            <div>
                              <label htmlFor="checkout-card-number" className={LABEL_CLASS}>Numéro de carte</label>
                              <input id="checkout-card-number" type="text" autoComplete="cc-number" inputMode="numeric" placeholder="1234 1234 1234 1234" className={`${FIELD_CLASS} font-mono`} />
                            </div>
                            <div className="grid grid-cols-2 gap-[var(--space-4)]">
                              <div>
                                <label htmlFor="checkout-card-exp" className={LABEL_CLASS}>Expiration</label>
                                <input id="checkout-card-exp" type="text" autoComplete="cc-exp" placeholder="MM / AA" className={`${FIELD_CLASS} font-mono`} />
                              </div>
                              <div>
                                <label htmlFor="checkout-card-cvc" className={LABEL_CLASS}>Cryptogramme</label>
                                <input id="checkout-card-cvc" type="text" autoComplete="cc-csc" inputMode="numeric" placeholder="CVC" className={`${FIELD_CLASS} font-mono`} />
                              </div>
                            </div>
                            <div>
                              <label htmlFor="checkout-card-name" className={LABEL_CLASS}>Nom du titulaire</label>
                              <input id="checkout-card-name" type="text" autoComplete="cc-name" placeholder="Comme écrit sur la carte" className={`${FIELD_CLASS} uppercase`} />
                            </div>

                            <label className="mb-[var(--space-6)] mt-[var(--space-4)] flex cursor-pointer items-center gap-[var(--space-3)]">
                              <span aria-hidden="true" className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-[color:var(--btn-tint)] border border-[color:var(--btn-glass-border)] backdrop-blur-[var(--btn-blur)] saturate-[var(--btn-saturate)] lkv-rim-btn text-[color:var(--lkv-text-primary)]">
                                <Icon name="CheckIcon" size={10} />
                              </span>
                              <span className="text-[length:var(--lkv-text-caption)] text-[color:var(--lkv-text-muted)]">Enregistrer cette carte pour un futur achat (chiffrée par Stripe).</span>
                            </label>
                          </div>

                          <Button
                            onClick={handleStripeCheckout}
                            disabled={processing}
                            loading={processing}
                            variant="primary"
                            size="lg"
                            fullWidth
                            icon={<Icon name="LockClosedIcon" size={18} />}
                          >
                            Payer {formatPriceEur(grandTotal)}
                          </Button>
                        </>
                      )}
                    </Card>

                  </div>
                ) : (
                  /* ── STEP 3: Confirmation ── */
                  <Card className="flex h-full min-h-[420px] flex-col items-center justify-center p-[var(--space-12)] text-center">
                    <div className="mb-[var(--space-6)] flex h-20 w-20 items-center justify-center rounded-full bg-[color:var(--lkv-success-bg)]">
                      <Icon name="CheckIcon" size={32} className="text-[color:var(--lkv-primary)]" />
                    </div>
                    <h2 className="mb-[var(--space-4)] font-display text-[length:var(--lkv-text-title-sm)] font-extrabold text-[color:var(--lkv-text-primary)]">Commande confirmée.</h2>
                    <p className="mb-[var(--space-2)] text-[color:var(--lkv-text-muted)]">
                      {orderNumber ? (
                        <>Numéro de commande : <span className="font-mono font-semibold text-[color:var(--lkv-text-primary)]">{orderNumber}</span></>
                      ) : (
                        'Votre numéro de commande vous sera envoyé par email.'
                      )}
                    </p>
                    <p className="mx-auto mb-[var(--space-8)] max-w-sm text-[length:var(--lkv-text-body-sm)] leading-[var(--leading-relaxed)] text-[color:var(--lkv-text-muted)]">
                      Merci ! Un email de confirmation vous a été envoyé. Préparez-vous pour l'aventure.
                    </p>
                    <Link
                      href="/explorer"
                      className="inline-flex min-h-[var(--control-height-md)] items-center justify-center rounded-full border border-[color:var(--glass-border)] bg-[color:var(--card-tint-strong)] px-[var(--space-6)] text-[length:var(--lkv-text-subheadline)] font-semibold text-[color:var(--card-content)] transition-colors hover:bg-[color:var(--lkv-hover-surface)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--lkv-focus-ring)]"
                    >
                      Voir les aventures
                    </Link>
                  </Card>
                )}
              </div>

              {/* Order summary sidebar */}
              <div className="lg:col-span-5 xl:col-span-4">
                <Card className="p-[var(--space-8)]">
                  <h3 className="mb-[var(--space-6)] font-display text-[length:var(--lkv-text-headline)] font-bold text-[color:var(--lkv-text-primary)]">Votre commande</h3>
                  <div className="mb-[var(--space-6)] space-y-[var(--space-4)]">
                    {items.map((item) => (
                      <div key={item.slug} className="flex items-center gap-[var(--space-4)]">
                        <div className="h-12 w-12 flex-shrink-0 overflow-hidden rounded-[var(--lkv-radius-md)] border border-[color:var(--glass-border)] bg-[color:var(--glass-bg-medium)]">
                          {item.image ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={item.image} alt={item.name} className="h-full w-full object-cover" />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center bg-[color:var(--glass-bg-medium)]">
                              <Icon name="PhotoIcon" size={16} className="text-[color:var(--lkv-text-muted)]" />
                            </div>
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate pr-[var(--space-2)] text-[length:var(--lkv-text-caption)] font-semibold text-[color:var(--lkv-text-primary)]">{item.name}</p>
                          <p className="mt-0.5 text-[length:var(--lkv-text-caption-2)] text-[color:var(--lkv-text-muted)]">Quantité : {item.quantity}</p>
                        </div>
                        <p className="whitespace-nowrap font-mono text-[length:var(--lkv-text-caption)] font-bold text-[color:var(--lkv-text-primary)]">{formatPriceEur(item.priceEur * item.quantity)}</p>
                      </div>
                    ))}
                  </div>

                  <div className="mb-[var(--space-5)] space-y-[var(--space-2)] border-t border-[color:var(--lkv-border)] pt-[var(--space-5)]">
                    <div className="flex justify-between text-[length:var(--lkv-text-caption)]">
                      <span className="text-[color:var(--lkv-text-muted)]">Sous-total</span>
                      <span className="font-mono font-bold text-[color:var(--lkv-text-primary)]">{formatPriceEur(totalPriceEur)}</span>
                    </div>
                    <div className="flex justify-between text-[length:var(--lkv-text-caption)]">
                      <span className="text-[color:var(--lkv-text-muted)]">Livraison suivie</span>
                      <span className="font-mono font-bold text-[color:var(--lkv-text-primary)]">{shippingEur === 0 ? 'Offerte' : formatPriceEur(shippingEur)}</span>
                    </div>
                    <div className="flex justify-between text-[length:var(--lkv-text-caption)]">
                      <span className="text-[color:var(--lkv-text-muted)]">TVA (20 %, incluse)</span>
                      <span className="font-mono font-bold text-[color:var(--lkv-text-primary)]">{formatPriceEur(totalPriceEur * 0.2)}</span>
                    </div>
                  </div>

                  <div className="flex items-end justify-between border-t border-[color:var(--lkv-border)] pt-[var(--space-5)] font-display text-[length:var(--lkv-text-title-sm)] font-extrabold">
                    <span className="text-[length:var(--lkv-text-headline)] text-[color:var(--lkv-text-primary)]">Total</span>
                    <span className="font-mono font-bold text-[color:var(--lkv-text-primary)]">{formatPriceEur(grandTotal)}</span>
                  </div>

                  {step === 'livraison' && (
                    <Button onClick={handleShippingSubmit} fullWidth className="mt-[var(--space-6)]" icon={<Icon name="LockClosedIcon" size={16} />}>
                      Payer {formatPriceEur(grandTotal)} par carte
                    </Button>
                  )}
                  {step === 'paiement' && (
                    <Button onClick={handleStripeCheckout} disabled={processing} loading={processing} fullWidth className="mt-[var(--space-6)]" icon={<Icon name="LockClosedIcon" size={16} />}>
                      {processing ? 'Traitement...' : `Payer ${formatPriceEur(grandTotal)} par carte`}
                    </Button>
                  )}

                  <p className="mx-auto mt-[var(--space-4)] max-w-[250px] text-center text-[length:var(--lkv-text-caption-2)] leading-[var(--leading-relaxed)] text-[color:var(--lkv-text-muted)]">
                    En passant commande, vous acceptez les <Link href="/cgv" target="_blank" className="underline">CGV</Link> et notre <Link href="/politique-confidentialite" target="_blank" className="underline">politique de retour</Link>. Vous ne serez débité qu'à l'expédition.
                  </p>
                </Card>
              </div>
            </div>
          </div>
        </div>

        <Footer />
      </div>

      {/* ── MOBILE VIEW (scroll natif) ── */}
      <div className="block md:hidden">
        <MobilePageShell background="transparent" hasBottomNav={false}>
          <div className="px-[var(--space-4)] pb-[var(--space-5)] pt-[var(--space-3)]">
            <div className="mb-[var(--space-4)] flex gap-[6px]">
              {[0, 1, 2, 3].map(i => (
                <div key={i} className={`h-[3px] flex-1 rounded-full ${i < 2 ? 'bg-[color:var(--lkv-secondary-subtle)]' : i === 2 ? 'bg-[color:var(--glass-label)]' : 'bg-[color:var(--lkv-border)]'}`} />
              ))}
            </div>
            <div className="text-[length:var(--lkv-text-caption-2)] uppercase tracking-[var(--tracking-caps)] text-[color:var(--lkv-text-muted)]">Étape 3 sur 4 · Paiement</div>
            <h1 className="m-0 text-[length:var(--lkv-text-title-sm)] tracking-[var(--lkv-tracking-title)] text-[color:var(--lkv-text-primary)]">
              Un dernier <em className="font-normal italic text-[color:var(--lkv-secondary)]">geste.</em>
            </h1>
          </div>

          <Card variant="compact" className="mx-[var(--space-4)] mb-[var(--space-3)] p-[var(--space-4)]">
            <div className="flex items-center gap-[var(--space-3)]">
              <div className="flex h-9 w-9 items-center justify-center rounded-[var(--lkv-radius-md)] bg-[color:var(--glass-bg-medium)]">
                <Icon name="MapPinIcon" size={16} variant="outline" className="text-[color:var(--glass-label)]" />
              </div>
              <div className="flex-1">
                <div className="text-[length:var(--lkv-text-footnote)] font-medium text-[color:var(--lkv-text-primary)]">{shipping.prenom || 'Mathieu'} {shipping.nom || 'Chevrier'}</div>
                <div className="text-[length:var(--lkv-text-caption)] text-[color:var(--lkv-text-muted)]">{shipping.adresse || '42 Rue de la République'} · {shipping.codePostal || '38000'} {shipping.ville || 'Grenoble'}</div>
              </div>
              <Badge tone="stone" className="uppercase">Maison</Badge>
            </div>
          </Card>

          <Card variant="compact" className="mx-[var(--space-4)] mb-[var(--space-3)] p-[var(--space-4)]">
            <div className="mb-[var(--space-2)] text-[length:var(--lkv-text-caption)] font-medium text-[color:var(--lkv-text-primary)]">Mode d&apos;expédition</div>
            {[{ id: 'standard', label: 'Livraison suivie', price: 'Offerte', desc: '3-5 jours ouvrés' }, { id: 'express', label: 'Express 48h', price: '9,90 €', desc: 'Livré à domicile' }].map(opt => (
              <label key={opt.id} onClick={() => setShippingOption(opt.id)} className="flex cursor-pointer items-center gap-[var(--space-3)] border-t border-[color:var(--lkv-border-subtle)] py-[var(--space-3)]">
                <span className={`flex h-[18px] w-[18px] flex-shrink-0 items-center justify-center rounded-full border-[1.5px] ${shippingOption === opt.id ? 'border-[color:var(--glass-label)]' : 'border-[color:var(--lkv-secondary-subtle)]'}`}>
                  {shippingOption === opt.id && <span className="h-[10px] w-[10px] rounded-full bg-[color:var(--glass-label)]" />}
                </span>
                <span className="flex-1">
                  <span className="block text-[length:var(--lkv-text-footnote)] font-medium text-[color:var(--lkv-text-primary)]">{opt.label}</span>
                  <span className="block text-[length:var(--lkv-text-caption-2)] text-[color:var(--lkv-text-muted)]">{opt.desc}</span>
                </span>
                <span className="font-mono text-[length:var(--lkv-text-footnote)] font-bold text-[color:var(--lkv-text-primary)]">{opt.price}</span>
              </label>
            ))}
          </Card>

          <Card variant="compact" className="mx-[var(--space-4)] mb-[var(--space-3)] p-[var(--space-4)]">
            <div className="mb-[var(--space-3)] text-[length:var(--lkv-text-caption)] font-semibold text-[color:var(--glass-label)]">Moyen de paiement</div>
            <div role="radiogroup" aria-label="Moyen de paiement" className="space-y-[var(--space-2)]">
              {PAYMENT_METHODS.map(m => {
                const isSelected = paymentMethod === m.id;
                return (
                  <button
                    key={m.id}
                    type="button"
                    role="radio"
                    aria-checked={isSelected}
                    disabled={m.disabled}
                    onClick={() => !m.disabled && setPaymentMethod(m.id)}
                    className={`flex w-full items-center justify-between rounded-[var(--lkv-radius-md)] border p-[var(--space-3)] text-left transition-all ${
                      isSelected
                        ? 'border-[color:var(--glass-rim)] bg-[color:var(--g3-bg)] text-[color:var(--g3-text)] shadow-md'
                        : m.disabled
                        ? 'cursor-not-allowed border-[color:var(--glass-border)] bg-[color:var(--glass-bg-subtle)] opacity-45'
                        : 'border-[color:var(--glass-border)] bg-[color:var(--glass-bg-medium)] text-[color:var(--glass-label)] active:scale-[0.99]'
                    }`}
                  >
                    <div className="flex items-center gap-[var(--space-3)]">
                      <span className={`flex h-[18px] w-[18px] flex-shrink-0 items-center justify-center rounded-full border-[1.5px] ${
                        isSelected
                          ? 'border-current'
                          : 'border-[color:var(--glass-label-secondary)]'
                      }`}>
                        {isSelected && <span className="h-[9px] w-[9px] rounded-full bg-current" />}
                      </span>
                      <div>
                        <div className="flex items-center gap-1.5 font-medium text-[length:var(--lkv-text-footnote)]">
                          <span>{m.icon}</span>
                          <span>{m.label}</span>
                          {m.badge && (
                            <span className="rounded-full border border-current/20 px-1.5 py-0.5 text-[9px] uppercase tracking-wide opacity-80">
                              {m.badge}
                            </span>
                          )}
                        </div>
                        {m.note ? (
                          <div className="text-[10px] opacity-75 mt-0.5">{m.note}</div>
                        ) : (
                          <div className="text-[10px] opacity-75 mt-0.5">{m.desc}</div>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </Card>

          {error && (
            <div role="alert" className="mx-[var(--space-4)] mb-[var(--space-3)] rounded-[var(--lkv-radius-md)] border border-[color:var(--lkv-danger)] bg-[color:var(--lkv-danger-bg)] p-[var(--space-3)] text-[length:var(--lkv-text-caption)] leading-[var(--leading-relaxed)] text-[color:var(--lkv-danger-dark)]">
              {error}
            </div>
          )}

          <Card className="mx-[var(--space-4)] my-[var(--space-3)] p-[var(--space-4)]">
            <div className="mb-[var(--space-3)] text-[length:var(--lkv-text-caption)] font-medium text-[color:var(--lkv-text-primary)]">Récapitulatif</div>
            <div className="mb-[var(--space-2)] flex justify-between text-[length:var(--lkv-text-caption)]">
              <span className="text-[color:var(--lkv-text-muted)]">Sous-total</span>
              <span className="font-mono font-bold text-[color:var(--lkv-text-primary)]">{formatPriceEur(totalPriceEur)}</span>
            </div>
            <div className="mb-[var(--space-3)] flex justify-between text-[length:var(--lkv-text-caption)]">
              <span className="text-[color:var(--lkv-text-muted)]">Livraison</span>
              <span className="font-mono font-bold text-[color:var(--lkv-text-primary)]">{shippingEur === 0 ? 'Offerte' : formatPriceEur(shippingEur)}</span>
            </div>
            <Divider spacing="sm" />
            <div className="mb-[var(--space-4)] flex justify-between">
              <span className="text-[length:var(--lkv-text-subheadline)] font-bold text-[color:var(--lkv-text-primary)]">Total</span>
              <span className="font-mono text-[length:var(--lkv-text-subheadline)] font-bold text-[color:var(--lkv-text-primary)]">{formatPriceEur(grandTotal)}</span>
            </div>
            <Button onClick={handleStripeCheckout} disabled={processing} loading={processing} fullWidth icon={<Icon name="LockClosedIcon" size={16} />}>
              Payer {formatPriceEur(grandTotal)}
            </Button>
          </Card>
        </MobilePageShell>
      </div>
    </>
  );
}
