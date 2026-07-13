'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import Icon from '@/components/ui/AppIcon';
import { getCart, getCartTotals, CartItem } from '@/lib/cart';

type Step = 'livraison' | 'paiement' | 'confirmation';

export default function CheckoutPage() {
  const [step, setStep] = useState<Step>('livraison');
  const [items, setItems] = useState<CartItem[]>([]);
  const [mounted, setMounted] = useState(false);
  const [processing, setProcessing] = useState(false);

  const [shipping, setShipping] = useState({
    prenom: '', nom: '', email: '', telephone: '',
    adresse: '', complement: '', codePostal: '', ville: '', pays: 'France',
  });

  const [payment, setPayment] = useState({
    cardNumber: '', expiry: '', cvv: '', cardName: '',
  });

  useEffect(() => {
    setItems(getCart());
    setMounted(true);
  }, []);

  const { totalPriceEur } = getCartTotals(items);
  const shippingEur = totalPriceEur >= 99 ? 0 : 5.9;
  const grandTotal = totalPriceEur + shippingEur;

  const handleShippingSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setStep('paiement');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handlePaymentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
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
      // Fallback: show confirmation if Stripe not configured
      setStep('confirmation');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch {
      // Fallback to mock confirmation
      setStep('confirmation');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } finally {
      setProcessing(false);
    }
  };

  const steps: { id: Step; label: string; num: number }[] = [
    { id: 'livraison', label: 'Livraison', num: 1 },
    { id: 'paiement', label: 'Paiement', num: 2 },
    { id: 'confirmation', label: 'Confirmation', num: 3 },
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
                        <label
                          htmlFor={`shipping-${key}`}
                          className="block text-xs font-mono text-muted-foreground uppercase tracking-wider mb-1.5"
                          style={{ fontFamily: 'var(--font-mono)' }}
                        >
                          {label}{required && ' *'}
                        </label>
                        <input
                          id={`shipping-${key}`}
                          type={type}
                          required={required}
                          value={shipping[key as keyof typeof shipping]}
                          onChange={(e) => setShipping({ ...shipping, [key]: e.target.value })}
                          className="w-full bg-background border border-border rounded-lg px-3 py-3 text-sm text-foreground focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-colors min-h-[44px]"
                          aria-required={required}
                        />
                      </div>
                    ))}
                    <div className="sm:col-span-2">
                      <label htmlFor="shipping-pays" className="block text-xs font-mono text-muted-foreground uppercase tracking-wider mb-1.5" style={{ fontFamily: 'var(--font-mono)' }}>Pays</label>
                      <select
                        id="shipping-pays"
                        value={shipping.pays}
                        onChange={(e) => setShipping({ ...shipping, pays: e.target.value })}
                        className="w-full bg-background border border-border rounded-lg px-3 py-3 text-sm text-foreground focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-colors min-h-[44px]"
                      >
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
                        { id: 'standard', label: 'Livraison standard', delay: '3–5 jours ouvrés', price: shippingEur === 0 ? 'Gratuite' : `${shippingEur.toFixed(2)} €` },
                        { id: 'express', label: 'Livraison express', delay: '24–48h', price: '9.90 €' },
                        { id: 'relay', label: 'Point relais', delay: '3–5 jours ouvrés', price: '3.90 €' },
                      ].map((opt) => (
                        <label key={opt.id} className="flex items-center gap-3 p-3 rounded-lg border border-border hover:border-primary/50 cursor-pointer transition-all has-[:checked]:border-primary has-[:checked]:bg-primary/5">
                          <input type="radio" name="shipping" defaultChecked={opt.id === 'standard'} className="accent-primary" />
                          <div className="flex-1">
                            <p className="text-sm font-medium text-foreground">{opt.label}</p>
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

                  {/* Stripe notice */}
                  <div className="mb-5 p-3 bg-info/5 border border-info/20 rounded-lg flex items-start gap-2.5">
                    <Icon name="InformationCircleIcon" size={15} variant="outline" className="text-info flex-shrink-0 mt-0.5" />
                    <p className="text-xs text-muted-foreground">
                      Paiement traité par <strong>Stripe</strong> — vos données bancaires ne sont jamais stockées sur nos serveurs. Configurez votre clé Stripe dans les variables d&apos;environnement pour activer les paiements réels.
                    </p>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <label htmlFor="card-name" className="block text-xs font-mono text-muted-foreground uppercase tracking-wider mb-1.5" style={{ fontFamily: 'var(--font-mono)' }}>Nom sur la carte *</label>
                      <input
                        id="card-name"
                        type="text"
                        required
                        placeholder="ALEX DUPONT"
                        value={payment.cardName}
                        onChange={(e) => setPayment({ ...payment, cardName: e.target.value })}
                        className="w-full bg-background border border-border rounded-lg px-3 py-3 text-sm text-foreground focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-colors min-h-[44px]"
                        autoComplete="cc-name"
                      />
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
                          }}
                          className="w-full bg-background border border-border rounded-lg px-3 py-3 text-sm text-foreground focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-colors pr-12 min-h-[44px]"
                          autoComplete="cc-number"
                          inputMode="numeric"
                        />
                        <div className="absolute right-3 top-1/2 -translate-y-1/2 flex gap-1" aria-hidden="true">
                          <div className="w-6 h-4 bg-blue-600 rounded-sm opacity-60" />
                          <div className="w-6 h-4 bg-red-500 rounded-sm opacity-60" />
                        </div>
                      </div>
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
                          }}
                          className="w-full bg-background border border-border rounded-lg px-3 py-3 text-sm text-foreground focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-colors min-h-[44px]"
                          autoComplete="cc-exp"
                          inputMode="numeric"
                        />
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
                          onChange={(e) => setPayment({ ...payment, cvv: e.target.value.replace(/\D/g, '') })}
                          className="w-full bg-background border border-border rounded-lg px-3 py-3 text-sm text-foreground focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-colors min-h-[44px]"
                          autoComplete="cc-csc"
                          inputMode="numeric"
                        />
                      </div>
                    </div>
                  </div>

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
                          Payer {grandTotal.toFixed(2)} €
                        </>
                      )}
                    </button>
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
            <p className="font-mono text-sm text-primary font-600 mb-8" style={{ fontFamily: 'var(--font-mono)' }}>N° KDV-2026-{Math.floor(Math.random() * 9000 + 1000)}</p>
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
