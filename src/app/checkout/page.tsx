'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import Icon from '@/components/ui/AppIcon';
import { getCart, getCartTotals, clearCart, CartItem } from '@/lib/cart';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

type Step = 'livraison' | 'paiement' | 'confirmation';
type PaymentMethod = 'card' | 'paypal' | 'apple_pay' | 'google_pay' | 'virement';

export default function CheckoutPage() {
  const [step, setStep] = useState<Step>('livraison');
  const [items, setItems] = useState<CartItem[]>([]);
  const [mounted, setMounted] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('card');
  const [orderNumber, setOrderNumber] = useState('');
  const [shippingOption, setShippingOption] = useState('standard');

  const [shipping, setShipping] = useState({
    prenom: '', nom: '', email: '', telephone: '',
    adresse: '', complement: '', codePostal: '', ville: '', pays: 'France',
  });

  const [payment, setPayment] = useState({
    cardNumber: '', expiry: '', cvv: '', cardName: '',
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  const { user } = useAuth();
  const supabase = createClient();

  useEffect(() => {
    setItems(getCart());
    setMounted(true);
    // Check for success redirect from Stripe
    const params = new URLSearchParams(window.location.search);
    if (params.get('success') === 'true') {
      setStep('confirmation');
      setOrderNumber(`KDV-2026-${Math.floor(Math.random() * 9000 + 1000)}`);
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

  const validateCard = () => {
    const newErrors: Record<string, string> = {};
    if (!payment.cardName.trim()) newErrors.cardName = 'Requis';
    if (payment.cardNumber.replace(/\s/g, '').length < 16) newErrors.cardNumber = 'Numéro invalide';
    if (!payment.expiry || payment.expiry.length < 5) newErrors.expiry = 'Date invalide';
    if (!payment.cvv || payment.cvv.length < 3) newErrors.cvv = 'CVV invalide';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleShippingSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateShipping()) return;
    setStep('paiement');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handlePaymentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (paymentMethod === 'card' && !validateCard()) return;
    setProcessing(true);
    try {
      if (paymentMethod === 'card') {
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
      }
      // Save order to Supabase
      await saveOrderToSupabase();
      const num = `KDV-2026-${Math.floor(Math.random() * 9000 + 1000)}`;
      setOrderNumber(num);
      setStep('confirmation');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch {
      const num = `KDV-2026-${Math.floor(Math.random() * 9000 + 1000)}`;
      setOrderNumber(num);
      setStep('confirmation');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } finally {
      setProcessing(false);
    }
  };

  const saveOrderToSupabase = async () => {
    try {
      const num = `KDV-2026-${Math.floor(Math.random() * 9000 + 1000)}`;
      const orderItems = items.map((i) => ({
        name: i.name,
        quantity: i.quantity,
        unit_price_eur: i.priceEur,
        slug: i.slug,
      }));

      const { data: orderData, error: orderError } = await supabase
        .from('orders')
        .insert({
          user_id: user?.id ?? null,
          order_number: num,
          status: 'confirmed',
          payment_method: paymentMethod,
          shipping_address: shipping,
          items: orderItems,
          subtotal_eur: totalPriceEur,
          shipping_eur: shippingEur,
          total_eur: grandTotal,
          loyalty_points_earned: Math.floor(grandTotal * 10),
        })
        .select('id')
        .single();

      if (orderError) throw orderError;

      // Decrement stock for each product
      for (const item of items) {
        if (!item.slug) continue;
        const { data: productData } = await supabase
          .from('shop_products')
          .select('id, stock, name, slug')
          .eq('slug', item.slug)
          .single();

        if (productData) {
          const newStock = Math.max(0, (productData.stock ?? 0) - item.quantity);
          await supabase.from('shop_products').update({
            stock: newStock,
            updated_at: new Date().toISOString(),
          }).eq('id', productData.id);

          await supabase.from('stock_movements').insert({
            product_id: productData.id,
            product_slug: productData.slug,
            product_name: productData.name,
            movement_type: 'sale',
            quantity_change: -item.quantity,
            quantity_before: productData.stock ?? 0,
            quantity_after: newStock,
            reference_type: 'order',
            reference_id: orderData?.id ?? null,
            user_id: user?.id ?? null,
            notes: `Vente via commande ${num}`,
          });
        }
      }

      // Award loyalty points
      if (user) {
        const pointsEarned = Math.floor(grandTotal * 10);
        try {
          await supabase.rpc('increment_loyalty_points' as never, {
            p_user_id: user.id,
            p_points: pointsEarned,
          });
        } catch {
          // Fallback: direct update
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
          action: `Commande ${num}`,
          points: Math.floor(grandTotal * 10),
          type: 'earned',
        });
      }

      // Clear cart after successful order
      clearCart();
    } catch (err) {
      console.error('Order save error:', err);
    }
  };

  const steps: { id: Step; label: string; num: number }[] = [
    { id: 'livraison', label: 'Livraison', num: 1 },
    { id: 'paiement', label: 'Paiement', num: 2 },
    { id: 'confirmation', label: 'Confirmation', num: 3 },
  ];

  const PAYMENT_METHODS: { id: PaymentMethod; label: string; icon: string; desc: string; badge?: string }[] = [
    { id: 'card', label: 'Carte bancaire', icon: '💳', desc: 'Visa, Mastercard, Amex', badge: 'Recommandé' },
    { id: 'paypal', label: 'PayPal', icon: '🅿️', desc: 'Paiement sécurisé PayPal' },
    { id: 'apple_pay', label: 'Apple Pay', icon: '🍎', desc: 'Paiement rapide Apple' },
    { id: 'google_pay', label: 'Google Pay', icon: '🔵', desc: 'Paiement rapide Google' },
    { id: 'virement', label: 'Virement bancaire', icon: '🏦', desc: 'Délai 2–3 jours ouvrés' },
  ];

  if (!mounted) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="pt-24 flex items-center justify-center min-h-[60vh]">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Header />

      <section className="pt-20 pb-0 bg-dark-bg">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
          <p className="font-mono text-xs text-primary tracking-widest uppercase mb-2" style={{ fontFamily: 'var(--font-mono)' }}>COMMANDE SÉCURISÉE</p>
          <h1 className="font-display font-800 text-3xl text-white tracking-tight" style={{ fontFamily: 'var(--font-display)', fontWeight: 800 }}>FINALISER MA COMMANDE</h1>

          {/* Step indicator */}
          <div className="flex items-center gap-0 mt-6">
            {steps.map((s, i) => (
              <React.Fragment key={s.id}>
                <div className="flex items-center gap-2">
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-mono font-700 transition-all ${
                    step === s.id ? 'bg-primary text-white' :
                    steps.findIndex(x => x.id === step) > i ? 'bg-emerald-500 text-white' : 'bg-white/10 text-white/40'
                  }`} style={{ fontFamily: 'var(--font-mono)' }}>
                    {steps.findIndex(x => x.id === step) > i ? '✓' : s.num}
                  </div>
                  <span className={`text-sm font-medium hidden sm:block ${step === s.id ? 'text-white' : 'text-white/40'}`}>{s.label}</span>
                </div>
                {i < steps.length - 1 && (
                  <div className={`flex-1 h-px mx-3 ${steps.findIndex(x => x.id === step) > i ? 'bg-emerald-500/50' : 'bg-white/10'}`} />
                )}
              </React.Fragment>
            ))}
          </div>
        </div>
      </section>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        {step !== 'confirmation' ? (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Form */}
            <div className="lg:col-span-2">
              {/* LIVRAISON */}
              {step === 'livraison' && (
                <form onSubmit={handleShippingSubmit} className="topo-card p-6" noValidate>
                  <h2 className="font-display font-700 text-lg text-foreground mb-5" style={{ fontFamily: 'var(--font-display)' }}>Adresse de livraison</h2>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {[
                      { label: 'Prénom', key: 'prenom', required: true },
                      { label: 'Nom', key: 'nom', required: true },
                      { label: 'Email', key: 'email', type: 'email', required: true, full: true },
                      { label: 'Téléphone', key: 'telephone', type: 'tel' },
                      { label: 'Adresse', key: 'adresse', required: true, full: true },
                      { label: 'Complément', key: 'complement', full: true },
                      { label: 'Code postal', key: 'codePostal', required: true },
                      { label: 'Ville', key: 'ville', required: true },
                    ].map(({ label, key, type = 'text', required, full }) => (
                      <div key={key} className={full ? 'sm:col-span-2' : ''}>
                        <label htmlFor={`shipping-${key}`} className="block text-xs font-mono text-muted-foreground uppercase tracking-wider mb-1.5" style={{ fontFamily: 'var(--font-mono)' }}>
                          {label}{required && ' *'}
                        </label>
                        <input
                          id={`shipping-${key}`}
                          type={type}
                          required={required}
                          value={shipping[key as keyof typeof shipping]}
                          onChange={(e) => { setShipping({ ...shipping, [key]: e.target.value }); if (errors[key]) setErrors(prev => { const n = {...prev}; delete n[key]; return n; }); }}
                          className={`w-full bg-background border rounded-lg px-3 py-3 text-sm text-foreground focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-colors min-h-[44px] ${errors[key] ? 'border-red-400' : 'border-border'}`}
                          aria-required={required}
                        />
                        {errors[key] && <p className="text-xs text-red-500 mt-1">{errors[key]}</p>}
                      </div>
                    ))}
                    <div className="sm:col-span-2">
                      <label htmlFor="shipping-pays" className="block text-xs font-mono text-muted-foreground uppercase tracking-wider mb-1.5" style={{ fontFamily: 'var(--font-mono)' }}>Pays</label>
                      <select id="shipping-pays" value={shipping.pays} onChange={(e) => setShipping({ ...shipping, pays: e.target.value })} className="w-full bg-background border border-border rounded-lg px-3 py-3 text-sm text-foreground focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-colors min-h-[44px]">
                        {['France', 'Belgique', 'Suisse', 'Luxembourg', 'Canada'].map((p) => (
                          <option key={p} value={p}>{p}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Shipping options */}
                  <div className="mt-6">
                    <h3 className="font-display font-700 text-base text-foreground mb-3" style={{ fontFamily: 'var(--font-display)' }}>Mode de livraison</h3>
                    <div className="flex flex-col gap-2">
                      {[
                        { id: 'standard', label: 'Livraison standard', delay: '3–5 jours ouvrés', price: totalPriceEur >= 99 ? 'Gratuite' : '5.90 €', badge: totalPriceEur >= 99 ? 'Gratuit' : '' },
                        { id: 'express', label: 'Livraison express', delay: '24–48h', price: '9.90 €', badge: 'Rapide' },
                        { id: 'relay', label: 'Point relais', delay: '3–5 jours ouvrés', price: '3.90 €', badge: 'Économique' },
                      ].map((opt) => (
                        <label key={opt.id} className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all ${shippingOption === opt.id ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'}`}>
                          <input type="radio" name="shipping" value={opt.id} checked={shippingOption === opt.id} onChange={() => setShippingOption(opt.id)} className="accent-primary" />
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <p className="text-sm font-medium text-foreground">{opt.label}</p>
                              {opt.badge && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-primary/10 text-primary font-semibold">{opt.badge}</span>}
                            </div>
                            <p className="text-xs text-muted-foreground">{opt.delay}</p>
                          </div>
                          <span className="font-mono text-sm font-600 text-foreground" style={{ fontFamily: 'var(--font-mono)' }}>{opt.price}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  <button type="submit" className="btn-primary w-full justify-center mt-6 py-3.5">
                    Continuer vers le paiement
                    <Icon name="ArrowRightIcon" size={16} variant="outline" />
                  </button>
                </form>
              )}

              {/* PAIEMENT */}
              {step === 'paiement' && (
                <form onSubmit={handlePaymentSubmit} className="topo-card p-6">
                  <div className="flex items-center justify-between mb-5">
                    <h2 className="font-display font-700 text-lg text-foreground" style={{ fontFamily: 'var(--font-display)' }}>Paiement sécurisé</h2>
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Icon name="LockClosedIcon" size={12} variant="outline" />
                      SSL 256-bit
                    </div>
                  </div>

                  {/* Payment method selector */}
                  <div className="mb-6">
                    <p className="text-xs font-mono text-muted-foreground uppercase tracking-wider mb-3" style={{ fontFamily: 'var(--font-mono)' }}>Choisissez votre moyen de paiement</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {PAYMENT_METHODS.map((m) => (
                        <button
                          key={m.id}
                          type="button"
                          onClick={() => { setPaymentMethod(m.id); setErrors({}); }}
                          className={`relative flex items-center gap-3 p-3 rounded-xl border-2 text-left transition-all ${paymentMethod === m.id ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/40'}`}
                        >
                          {m.badge && (
                            <span className="absolute top-2 right-2 text-[9px] px-1.5 py-0.5 rounded-full bg-primary text-white font-semibold">{m.badge}</span>
                          )}
                          <span className="text-xl flex-shrink-0">{m.icon}</span>
                          <div>
                            <p className={`text-sm font-semibold ${paymentMethod === m.id ? 'text-primary' : 'text-foreground'}`}>{m.label}</p>
                            <p className="text-xs text-muted-foreground">{m.desc}</p>
                          </div>
                          {paymentMethod === m.id && (
                            <div className="ml-auto w-4 h-4 rounded-full bg-primary flex items-center justify-center flex-shrink-0">
                              <Icon name="CheckIcon" size={10} variant="outline" className="text-white" />
                            </div>
                          )}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Card form */}
                  {paymentMethod === 'card' && (
                    <div className="space-y-4 p-4 rounded-xl bg-muted/30 border border-border">
                      <div>
                        <label htmlFor="card-name" className="block text-xs font-mono text-muted-foreground uppercase tracking-wider mb-1.5" style={{ fontFamily: 'var(--font-mono)' }}>Nom sur la carte *</label>
                        <input
                          id="card-name"
                          type="text"
                          required
                          placeholder="ALEX DUPONT"
                          value={payment.cardName}
                          onChange={(e) => { setPayment({ ...payment, cardName: e.target.value }); if (errors.cardName) setErrors(prev => { const n = {...prev}; delete n.cardName; return n; }); }}
                          className={`w-full bg-background border rounded-lg px-3 py-3 text-sm text-foreground focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-colors min-h-[44px] ${errors.cardName ? 'border-red-400' : 'border-border'}`}
                          autoComplete="cc-name"
                        />
                        {errors.cardName && <p className="text-xs text-red-500 mt-1">{errors.cardName}</p>}
                      </div>
                      <div>
                        <label htmlFor="card-number" className="block text-xs font-mono text-muted-foreground uppercase tracking-wider mb-1.5" style={{ fontFamily: 'var(--font-mono)' }}>Numéro de carte *</label>
                        <div className="relative">
                          <input
                            id="card-number"
                            type="text"
                            required
                            placeholder="4242 4242 4242 4242"
                            maxLength={19}
                            value={payment.cardNumber}
                            onChange={(e) => {
                              let v = e.target.value.replace(/\D/g, '').replace(/(.{4})/g, '$1 ').trim();
                              setPayment({ ...payment, cardNumber: v });
                              if (errors.cardNumber) setErrors(prev => { const n = {...prev}; delete n.cardNumber; return n; });
                            }}
                            className={`w-full bg-background border rounded-lg px-3 py-3 text-sm text-foreground focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-colors pr-16 min-h-[44px] ${errors.cardNumber ? 'border-red-400' : 'border-border'}`}
                            autoComplete="cc-number"
                            inputMode="numeric"
                          />
                          <div className="absolute right-3 top-1/2 -translate-y-1/2 flex gap-1" aria-hidden="true">
                            <div className="w-6 h-4 bg-blue-600 rounded-sm opacity-60" />
                            <div className="w-6 h-4 bg-red-500 rounded-sm opacity-60" />
                          </div>
                        </div>
                        {errors.cardNumber && <p className="text-xs text-red-500 mt-1">{errors.cardNumber}</p>}
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label htmlFor="card-expiry" className="block text-xs font-mono text-muted-foreground uppercase tracking-wider mb-1.5" style={{ fontFamily: 'var(--font-mono)' }}>Expiration *</label>
                          <input
                            id="card-expiry"
                            type="text"
                            required
                            placeholder="MM/AA"
                            maxLength={5}
                            value={payment.expiry}
                            onChange={(e) => {
                              let v = e.target.value.replace(/\D/g, '');
                              if (v.length >= 2) v = v.slice(0, 2) + '/' + v.slice(2);
                              setPayment({ ...payment, expiry: v });
                              if (errors.expiry) setErrors(prev => { const n = {...prev}; delete n.expiry; return n; });
                            }}
                            className={`w-full bg-background border rounded-lg px-3 py-3 text-sm text-foreground focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-colors min-h-[44px] ${errors.expiry ? 'border-red-400' : 'border-border'}`}
                            autoComplete="cc-exp"
                            inputMode="numeric"
                          />
                          {errors.expiry && <p className="text-xs text-red-500 mt-1">{errors.expiry}</p>}
                        </div>
                        <div>
                          <label htmlFor="card-cvv" className="block text-xs font-mono text-muted-foreground uppercase tracking-wider mb-1.5" style={{ fontFamily: 'var(--font-mono)' }}>CVV *</label>
                          <input
                            id="card-cvv"
                            type="text"
                            required
                            placeholder="123"
                            maxLength={4}
                            value={payment.cvv}
                            onChange={(e) => { setPayment({ ...payment, cvv: e.target.value.replace(/\D/g, '') }); if (errors.cvv) setErrors(prev => { const n = {...prev}; delete n.cvv; return n; }); }}
                            className={`w-full bg-background border rounded-lg px-3 py-3 text-sm text-foreground focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-colors min-h-[44px] ${errors.cvv ? 'border-red-400' : 'border-border'}`}
                            autoComplete="cc-csc"
                            inputMode="numeric"
                          />
                          {errors.cvv && <p className="text-xs text-red-500 mt-1">{errors.cvv}</p>}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* PayPal */}
                  {paymentMethod === 'paypal' && (
                    <div className="p-6 rounded-xl bg-[#003087]/5 border border-[#003087]/20 text-center">
                      <div className="text-4xl mb-3">🅿️</div>
                      <p className="text-sm font-semibold text-foreground mb-1">Payer avec PayPal</p>
                      <p className="text-xs text-muted-foreground">Vous serez redirigé vers PayPal pour finaliser votre paiement de <strong>{grandTotal.toFixed(2)} €</strong></p>
                    </div>
                  )}

                  {/* Apple Pay / Google Pay */}
                  {(paymentMethod === 'apple_pay' || paymentMethod === 'google_pay') && (
                    <div className="p-6 rounded-xl bg-muted/30 border border-border text-center">
                      <div className="text-4xl mb-3">{paymentMethod === 'apple_pay' ? '🍎' : '🔵'}</div>
                      <p className="text-sm font-semibold text-foreground mb-1">Payer avec {paymentMethod === 'apple_pay' ? 'Apple Pay' : 'Google Pay'}</p>
                      <p className="text-xs text-muted-foreground">Authentification biométrique requise. Montant : <strong>{grandTotal.toFixed(2)} €</strong></p>
                    </div>
                  )}

                  {/* Virement */}
                  {paymentMethod === 'virement' && (
                    <div className="p-5 rounded-xl bg-muted/30 border border-border space-y-3">
                      <p className="text-sm font-semibold text-foreground">Coordonnées bancaires</p>
                      {[
                        { label: 'Bénéficiaire', value: 'Le Kit du Voyageur SAS' },
                        { label: 'IBAN', value: 'FR76 3000 4028 3700 0100 0000 943' },
                        { label: 'BIC', value: 'BNPAFRPPXXX' },
                        { label: 'Référence', value: `KDV-${Date.now().toString().slice(-8)}` },
                        { label: 'Montant', value: `${grandTotal.toFixed(2)} €` },
                      ].map(({ label, value }) => (
                        <div key={label} className="flex justify-between text-sm">
                          <span className="text-muted-foreground">{label}</span>
                          <span className="font-mono font-semibold text-foreground" style={{ fontFamily: 'var(--font-mono)' }}>{value}</span>
                        </div>
                      ))}
                      <p className="text-xs text-amber-600 bg-amber-50 p-2 rounded-lg">⚠️ Votre commande sera traitée à réception du virement (2–3 jours ouvrés)</p>
                    </div>
                  )}

                  <div className="flex gap-3 mt-6">
                    <button type="button" onClick={() => setStep('livraison')} className="flex items-center gap-2 px-4 py-3 rounded-full border border-border text-sm text-muted-foreground hover:text-foreground transition-all">
                      <Icon name="ArrowLeftIcon" size={14} variant="outline" />
                      Retour
                    </button>
                    <button type="submit" disabled={processing} className="btn-primary flex-1 justify-center py-3.5">
                      {processing ? (
                        <>
                          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          Traitement en cours…
                        </>
                      ) : (
                        <>
                          <Icon name="LockClosedIcon" size={16} variant="outline" />
                          {paymentMethod === 'card' ? `Payer ${grandTotal.toFixed(2)} €` :
                           paymentMethod === 'paypal' ? 'Continuer vers PayPal' :
                           paymentMethod === 'apple_pay' ? 'Payer avec Apple Pay' :
                           paymentMethod === 'google_pay'? 'Payer avec Google Pay' : 'Confirmer la commande'}
                        </>
                      )}
                    </button>
                  </div>

                  {/* Security badges */}
                  <div className="mt-4 flex items-center justify-center gap-4 text-xs text-muted-foreground">
                    <div className="flex items-center gap-1"><Icon name="LockClosedIcon" size={10} variant="outline" />Paiement chiffré</div>
                    <div className="flex items-center gap-1"><Icon name="ShieldCheckIcon" size={10} variant="outline" />3D Secure</div>
                    <div className="flex items-center gap-1"><Icon name="CheckCircleIcon" size={10} variant="outline" />Données protégées</div>
                  </div>
                </form>
              )}
            </div>

            {/* Order summary sidebar */}
            <div className="lg:col-span-1">
              <div className="topo-card p-5 sticky top-24">
                <h3 className="font-display font-700 text-base text-foreground mb-4" style={{ fontFamily: 'var(--font-display)' }}>Votre commande</h3>
                <div className="space-y-3 mb-4">
                  {items.map((item) => (
                    <div key={item.id} className="flex items-center gap-3">
                      <div className="relative w-10 h-10 flex-shrink-0">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={item.image} alt={item.imageAlt} className="w-full h-full object-cover rounded-lg" />
                        <span className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-primary text-white text-[9px] font-bold rounded-full flex items-center justify-center">{item.quantity}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-foreground truncate">{item.name}</p>
                        <p className="text-[10px] text-muted-foreground">{item.brand}</p>
                      </div>
                      <span className="font-mono text-xs font-600 text-foreground flex-shrink-0" style={{ fontFamily: 'var(--font-mono)' }}>
                        {(item.priceEur * item.quantity).toFixed(2)} €
                      </span>
                    </div>
                  ))}
                </div>
                <div className="border-t border-border pt-3 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Sous-total</span>
                    <span className="font-mono font-600" style={{ fontFamily: 'var(--font-mono)' }}>{totalPriceEur.toFixed(2)} €</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Livraison</span>
                    <span className={`font-mono font-600 ${shippingEur === 0 ? 'text-emerald-600' : ''}`} style={{ fontFamily: 'var(--font-mono)' }}>
                      {shippingEur === 0 ? 'Gratuite' : `${shippingEur.toFixed(2)} €`}
                    </span>
                  </div>
                  <div className="flex justify-between font-700 text-base pt-1 border-t border-border">
                    <span>Total</span>
                    <span className="font-mono text-primary" style={{ fontFamily: 'var(--font-mono)' }}>{grandTotal.toFixed(2)} €</span>
                  </div>
                </div>
                {totalPriceEur < 99 && (
                  <div className="mt-3 p-2.5 rounded-lg bg-primary/5 border border-primary/20 text-xs text-primary">
                    Plus que <strong>{(99 - totalPriceEur).toFixed(2)} €</strong> pour la livraison gratuite !
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : (
          /* CONFIRMATION */
          <div className="max-w-lg mx-auto text-center py-12">
            <div className="w-20 h-20 rounded-full bg-emerald-100 border-2 border-emerald-300 flex items-center justify-center mx-auto mb-6">
              <Icon name="CheckIcon" size={36} variant="outline" className="text-emerald-600" />
            </div>
            <h2 className="font-display font-800 text-3xl text-foreground mb-3" style={{ fontFamily: 'var(--font-display)', fontWeight: 800 }}>Commande confirmée !</h2>
            <p className="text-muted-foreground mb-2">Merci pour votre commande. Un email de confirmation a été envoyé à <strong>{shipping.email || 'votre adresse'}</strong>.</p>
            <p className="font-mono text-sm text-primary font-600 mb-8" style={{ fontFamily: 'var(--font-mono)' }}>N° {orderNumber}</p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Link href="/compte" className="btn-primary py-3 px-6">
                <Icon name="UserIcon" size={16} variant="outline" />
                Suivre ma commande
              </Link>
              <Link href="/catalogue" className="btn-secondary py-3 px-6 border-border text-foreground">
                <Icon name="ShoppingBagIcon" size={16} variant="outline" />
                Continuer mes achats
              </Link>
            </div>
          </div>
        )}
      </div>

      <Footer />
    </div>
  );
}
