'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import Header from '@/components/Header';
import Icon from '@/components/ui/AppIcon';
import { getCart, getCartTotals, clearCart, CartItem } from '@/lib/cart';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import NewFooterSection from '@/app/components/home/NewFooterSection';

type Step = 'coordonnees' | 'livraison' | 'confirmation';
type PaymentMethod = 'card' | 'apple_pay' | 'paypal' | 'alma';
type ShippingOption = 'suivie' | 'express' | 'atelier';

// ── Carte bancaire visuelle ──────────────────────────────────────────────────
function CreditCardVisual({ number, holder, expiry }: { number: string; holder: string; expiry: string }) {
  const displayNum = number.replace(/\s/g, '').padEnd(16, '·').replace(/(.{4})/g, '$1 ').trim();
  return (
    <div
      className="relative w-full max-w-xs mx-auto rounded-2xl overflow-hidden p-6 text-white select-none"
      style={{
        background: 'linear-gradient(135deg, #1C2620 0%, #2D3F35 50%, #1C2620 100%)',
        aspectRatio: '1.586',
        boxShadow: '0 20px 60px rgba(28,38,32,0.4)',
      }}
    >
      {/* Chip */}
      <div className="absolute top-5 left-6 w-8 h-6 rounded-md" style={{ background: 'linear-gradient(135deg, #C8A84B, #E8C96A)' }} />
      {/* Contactless */}
      <div className="absolute top-5 right-6 opacity-60">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.5">
          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z" opacity="0.3" />
          <path d="M12 6c-3.31 0-6 2.69-6 6s2.69 6 6 6 6-2.69 6-6-2.69-6-6-6z" opacity="0.5" />
          <path d="M12 10c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z" />
        </svg>
      </div>
      {/* Number */}
      <div className="absolute bottom-12 left-6 right-6">
        <p className="font-mono text-lg tracking-[0.25em] text-white/90">
          {displayNum.length > 0 ? displayNum : '•••• •••• •••• ••••'}
        </p>
      </div>
      {/* Holder + Expiry */}
      <div className="absolute bottom-5 left-6 right-6 flex justify-between items-end">
        <div>
          <p className="text-[8px] text-white/40 uppercase tracking-widest mb-0.5">Titulaire</p>
          <p className="text-xs font-semibold text-white uppercase tracking-wider">{holder || 'M. Chevrier'}</p>
        </div>
        <div className="text-right">
          <p className="text-[8px] text-white/40 uppercase tracking-widest mb-0.5">Expire</p>
          <p className="text-xs font-semibold text-white">{expiry || '09/28'}</p>
        </div>
        <div className="absolute right-0 bottom-0">
          <svg width="40" height="28" viewBox="0 0 40 28">
            <circle cx="14" cy="14" r="14" fill="#EB001B" opacity="0.9" />
            <circle cx="26" cy="14" r="14" fill="#F79E1B" opacity="0.9" />
          </svg>
        </div>
      </div>
    </div>
  );
}

export default function CheckoutPage() {
  const [step, setStep] = useState<Step>('coordonnees');
  const [items, setItems] = useState<CartItem[]>([]);
  const [mounted, setMounted] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('card');
  const [shippingOption, setShippingOption] = useState<ShippingOption>('suivie');
  const [orderNumber, setOrderNumber] = useState('');
  const [stripeConfigured, setStripeConfigured] = useState(false);
  const [newsletterOptIn, setNewsletterOptIn] = useState(true);
  const [saveCard, setSaveCard] = useState(true);

  const [form, setForm] = useState({
    email: '', prenom: '', nom: '', adresse: '', complement: '',
    codePostal: '', ville: '', pays: 'France', telephone: '',
    cardNumber: '', cardExpiry: '', cardCvc: '', cardHolder: '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const { user } = useAuth();
  const supabase = createClient();

  useEffect(() => {
    setItems(getCart());
    setMounted(true);
    const stripeKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
    setStripeConfigured(!!stripeKey && !stripeKey.includes('your-stripe'));
    const params = new URLSearchParams(window.location.search);
    if (params.get('success') === 'true') {
      setStep('confirmation');
      setOrderNumber(`KDV-2026-${Math.floor(Math.random() * 9000 + 1000)}`);
    }
    if (user?.email) setForm(prev => ({ ...prev, email: user.email ?? '' }));
  }, [user]);

  const { totalPriceEur } = getCartTotals(items);
  const shippingCosts: Record<ShippingOption, number> = {
    suivie: totalPriceEur >= 99 ? 0 : 5.9,
    express: 14,
    atelier: 0,
  };
  const shippingEur = shippingCosts[shippingOption];
  const tva = (totalPriceEur + shippingEur) * 0.2;
  const grandTotal = totalPriceEur + shippingEur;

  const validate = () => {
    const e: Record<string, string> = {};
    if (!form.email || !/\S+@\S+\.\S+/.test(form.email)) e.email = 'Email invalide';
    if (!form.prenom.trim()) e.prenom = 'Requis';
    if (!form.nom.trim()) e.nom = 'Requis';
    if (!form.adresse.trim()) e.adresse = 'Requis';
    if (!form.codePostal.trim()) e.codePostal = 'Requis';
    if (!form.ville.trim()) e.ville = 'Requis';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleContinue = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setStep('livraison');
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
          items: items.map((i) => ({ name: i.name, priceEur: i.priceEur, quantity: i.quantity, image: i.image })),
          successUrl: `${siteUrl}/checkout?success=true`,
          cancelUrl: `${siteUrl}/panier`,
        }),
      });
      const data = await res.json();
      if (data.url) { window.location.href = data.url; return; }
      throw new Error('No redirect URL');
    } catch {
      setProcessing(false);
    }
  };

  const handleConfirm = async (e: React.FormEvent) => {
    e.preventDefault();
    setProcessing(true);
    try {
      const num = `KDV-2026-${Math.floor(Math.random() * 9000 + 1000)}`;
      await supabase.from('orders').insert({
        user_id: user?.id ?? null,
        order_number: num,
        status: 'confirmed',
        payment_method: paymentMethod,
        shipping_address: { prenom: form.prenom, nom: form.nom, adresse: form.adresse, codePostal: form.codePostal, ville: form.ville, pays: form.pays },
        items: items.map(i => ({ name: i.name, quantity: i.quantity, unit_price_eur: i.priceEur })),
        subtotal_eur: totalPriceEur,
        shipping_eur: shippingEur,
        total_eur: grandTotal,
      });
      clearCart();
      setOrderNumber(num);
      setStep('confirmation');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch {
      // silent
    } finally {
      setProcessing(false);
    }
  };

  const STEPS = [
    { id: 'coordonnees' as Step, num: 1, label: 'Panier' },
    { id: 'livraison' as Step, num: 2, label: 'Livraison & paiement' },
    { id: 'confirmation' as Step, num: 3, label: 'Confirmation' },
  ];

  const stepIndex = STEPS.findIndex(s => s.id === step);

  const SHIPPING_OPTIONS: { id: ShippingOption; label: string; sub: string; price: string; badge?: string }[] = [
    { id: 'suivie', label: 'Livraison suivie', sub: 'Colis-relais ou domicile · 3 à 5 jours ouvrés · CO₂ compensé', price: shippingCosts.suivie === 0 ? 'Offerte' : `${shippingCosts.suivie} €`, badge: 'Offerte' },
    { id: 'express', label: 'Express 48h', sub: 'Livré à domicile en 48 h · sur créneau choisi', price: '14 €' },
    { id: 'atelier', label: 'Retrait en atelier', sub: 'Manosque, Alpes-de-Haute-Provence · disponible dès demain', price: 'Offerte' },
  ];

  const PAYMENT_TABS: { id: PaymentMethod; label: string; sub?: string }[] = [
    { id: 'card', label: 'CARTE' },
    { id: 'apple_pay', label: 'Pay', sub: 'APPLE PAY' },
    { id: 'paypal', label: 'PayPal', sub: 'COMPTE' },
    { id: 'alma', label: '3× sans frais', sub: 'ALMA' },
  ];

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
    <div className="min-h-screen" style={{ background: '#F5F2EC', fontFamily: 'var(--font-sans)' }}>
      {/* ── HEADER CHECKOUT ── */}
      <div className="sticky top-0 z-40 border-b border-[#E8E4DA]" style={{ background: '#F5F2EC' }}>
        <div className="max-w-5xl mx-auto px-4 md:px-8 h-14 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <Icon name="MapIcon" size={18} className="text-[#1C2620]" />
            <span className="text-sm font-semibold text-[#1C2620]">Le Kit du Voyageur</span>
          </Link>
          <div className="flex items-center gap-2 text-xs text-[#7A7A6E]">
            <Icon name="LockClosedIcon" size={12} className="text-[#4A6741]" />
            <span>Paiement sécurisé · Stripe</span>
          </div>
          <Link href="/panier" className="text-xs text-[#7A7A6E] hover:text-[#1C2620] transition-colors flex items-center gap-1">
            <Icon name="ArrowLeftIcon" size={12} /> Retour au panier
          </Link>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 md:px-8 py-8">
        {/* ── STEPPER ── */}
        <div className="flex items-center gap-0 mb-10">
          {STEPS.map((s, i) => (
            <React.Fragment key={s.id}>
              <div className="flex items-center gap-2">
                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-mono font-bold transition-all ${
                  stepIndex > i ? 'bg-[#4A6741] text-white' :
                  stepIndex === i ? 'bg-[#1C2620] text-white' : 'bg-[#E8E4DA] text-[#7A7A6E]'
                }`}>
                  {stepIndex > i ? '✓' : s.num}
                </div>
                <span className={`text-xs font-medium ${stepIndex === i ? 'text-[#1C2620]' : 'text-[#7A7A6E]'}`}>{s.label}</span>
              </div>
              {i < STEPS.length - 1 && (
                <div className={`flex-1 h-px mx-3 transition-all ${stepIndex > i ? 'bg-[#4A6741]' : 'bg-[#E8E4DA]'}`} />
              )}
            </React.Fragment>
          ))}
          <div className="ml-auto">
            <span className="text-[10px] font-mono text-[#4A6741] bg-[#4A6741]/10 px-3 py-1 rounded-full flex items-center gap-1">
              <Icon name="LockClosedIcon" size={10} className="text-[#4A6741]" /> Paiement 100 % sécurisé
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
          {/* ── MAIN FORM ── */}
          <div className="lg:col-span-3">

            {/* ── CONFIRMATION ── */}
            {step === 'confirmation' && (
              <div className="text-center py-16">
                <div className="w-16 h-16 bg-[#4A6741]/10 rounded-full flex items-center justify-center mx-auto mb-6">
                  <Icon name="CheckCircleIcon" size={32} className="text-[#4A6741]" />
                </div>
                <h2 className="text-3xl font-bold text-[#1C2620] mb-2">
                  Commande <em className="font-light italic" style={{ fontFamily: 'Georgia, serif' }}>confirmée.</em>
                </h2>
                <p className="text-[#7A7A6E] mb-1">Numéro de commande : <span className="font-mono font-semibold text-[#1C2620]">{orderNumber}</span></p>
                <p className="text-sm text-[#7A7A6E] mb-8">Un email de confirmation vous a été envoyé. Votre inventaire a été mis à jour.</p>
                <div className="flex flex-col sm:flex-row gap-3 justify-center">
                  <Link href="/inventaire" className="inline-flex items-center gap-2 bg-[#1C2620] text-white px-6 py-3 rounded-full font-semibold text-sm hover:bg-[#1C2620]/80 transition-all">
                    <Icon name="ArchiveBoxIcon" size={16} className="text-white" /> Voir mon inventaire
                  </Link>
                  <Link href="/boutique" className="inline-flex items-center gap-2 border border-[#C8C3B0] px-6 py-3 rounded-full font-medium text-sm hover:border-[#1C2620] transition-all text-[#1C2620]">
                    Continuer mes achats
                  </Link>
                </div>
              </div>
            )}

            {/* ── STEP 1 : COORDONNÉES ── */}
            {step === 'coordonnees' && (
              <form onSubmit={handleContinue} className="space-y-8">
                <div>
                  <h1 className="text-4xl font-bold text-[#1C2620] mb-8">
                    Presque <em className="font-light italic" style={{ fontFamily: 'Georgia, serif' }}>parti.</em>
                  </h1>

                  {/* 01 Coordonnées */}
                  <div className="mb-8">
                    <div className="flex items-baseline justify-between mb-5">
                      <h2 className="text-lg font-semibold text-[#1C2620] flex items-center gap-3">
                        <span className="text-3xl font-bold text-[#E8E4DA] select-none leading-none" style={{ fontFamily: 'Georgia, serif' }}>01</span>
                        Vos coordonnées
                      </h2>
                      {!user && (
                        <Link href="/connexion" className="text-xs text-[#4A6741] hover:text-[#1C2620] transition-colors">Se connecter</Link>
                      )}
                    </div>
                    <div className="space-y-3">
                      <div>
                        <label className="block text-xs font-medium text-[#7A7A6E] uppercase tracking-wider mb-1.5">Email</label>
                        <input
                          type="email"
                          value={form.email}
                          onChange={(e) => setForm(p => ({ ...p, email: e.target.value }))}
                          placeholder="marceline@lechevier.fr"
                          className={`w-full px-4 py-3 rounded-xl border bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[#1C2620]/20 transition-all ${errors.email ? 'border-red-400' : 'border-[#E8E4DA] hover:border-[#C8C3B0]'}`}
                        />
                        {errors.email && <p className="text-red-500 text-xs mt-1">{errors.email}</p>}
                      </div>
                      <label className="flex items-center gap-2.5 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={newsletterOptIn}
                          onChange={(e) => setNewsletterOptIn(e.target.checked)}
                          className="w-4 h-4 rounded border-[#C8C3B0] accent-[#1C2620]"
                        />
                        <span className="text-xs text-[#7A7A6E]">Recevoir le Journal du Kit — un envoi par saison, refuges et sentiers uniquement.</span>
                      </label>
                    </div>
                  </div>

                  {/* 02 Livraison */}
                  <div>
                    <h2 className="text-lg font-semibold text-[#1C2620] flex items-center gap-3 mb-5">
                      <span className="text-3xl font-bold text-[#E8E4DA] select-none leading-none" style={{ fontFamily: 'Georgia, serif' }}>02</span>
                      Livraison
                    </h2>
                    <div className="grid grid-cols-2 gap-3">
                      {[
                        { key: 'prenom', label: 'Prénom', placeholder: 'Marceline', col: 1 },
                        { key: 'nom', label: 'Nom', placeholder: 'Chevrier', col: 1 },
                      ].map(({ key, label, placeholder }) => (
                        <div key={key}>
                          <label className="block text-xs font-medium text-[#7A7A6E] uppercase tracking-wider mb-1.5">{label}</label>
                          <input
                            type="text"
                            value={(form as Record<string, string>)[key]}
                            onChange={(e) => setForm(p => ({ ...p, [key]: e.target.value }))}
                            placeholder={placeholder}
                            className={`w-full px-4 py-3 rounded-xl border bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[#1C2620]/20 transition-all ${errors[key] ? 'border-red-400' : 'border-[#E8E4DA] hover:border-[#C8C3B0]'}`}
                          />
                          {errors[key] && <p className="text-red-500 text-xs mt-1">{errors[key]}</p>}
                        </div>
                      ))}
                      <div className="col-span-2">
                        <label className="block text-xs font-medium text-[#7A7A6E] uppercase tracking-wider mb-1.5">Adresse</label>
                        <input
                          type="text"
                          value={form.adresse}
                          onChange={(e) => setForm(p => ({ ...p, adresse: e.target.value }))}
                          placeholder="14 rue du Grand Som"
                          className={`w-full px-4 py-3 rounded-xl border bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[#1C2620]/20 transition-all ${errors.adresse ? 'border-red-400' : 'border-[#E8E4DA] hover:border-[#C8C3B0]'}`}
                        />
                        {errors.adresse && <p className="text-red-500 text-xs mt-1">{errors.adresse}</p>}
                      </div>
                      <div className="col-span-2">
                        <label className="block text-xs font-medium text-[#7A7A6E] uppercase tracking-wider mb-1.5">Complément (optionnel)</label>
                        <input
                          type="text"
                          value={form.complement}
                          onChange={(e) => setForm(p => ({ ...p, complement: e.target.value }))}
                          placeholder="Bâtiment · étage · digicode"
                          className="w-full px-4 py-3 rounded-xl border border-[#E8E4DA] hover:border-[#C8C3B0] bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[#1C2620]/20 transition-all"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-[#7A7A6E] uppercase tracking-wider mb-1.5">Code postal</label>
                        <input
                          type="text"
                          value={form.codePostal}
                          onChange={(e) => setForm(p => ({ ...p, codePostal: e.target.value }))}
                          placeholder="38380"
                          className={`w-full px-4 py-3 rounded-xl border bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[#1C2620]/20 transition-all ${errors.codePostal ? 'border-red-400' : 'border-[#E8E4DA] hover:border-[#C8C3B0]'}`}
                        />
                        {errors.codePostal && <p className="text-red-500 text-xs mt-1">{errors.codePostal}</p>}
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-[#7A7A6E] uppercase tracking-wider mb-1.5">Ville</label>
                        <input
                          type="text"
                          value={form.ville}
                          onChange={(e) => setForm(p => ({ ...p, ville: e.target.value }))}
                          placeholder="Saint-Pierre-de-Chartreuse"
                          className={`w-full px-4 py-3 rounded-xl border bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[#1C2620]/20 transition-all ${errors.ville ? 'border-red-400' : 'border-[#E8E4DA] hover:border-[#C8C3B0]'}`}
                        />
                        {errors.ville && <p className="text-red-500 text-xs mt-1">{errors.ville}</p>}
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-[#7A7A6E] uppercase tracking-wider mb-1.5">Pays</label>
                        <select
                          value={form.pays}
                          onChange={(e) => setForm(p => ({ ...p, pays: e.target.value }))}
                          className="w-full px-4 py-3 rounded-xl border border-[#E8E4DA] hover:border-[#C8C3B0] bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[#1C2620]/20 transition-all"
                        >
                          <option>France</option>
                          <option>Belgique</option>
                          <option>Suisse</option>
                          <option>Luxembourg</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-[#7A7A6E] uppercase tracking-wider mb-1.5">Téléphone</label>
                        <input
                          type="tel"
                          value={form.telephone}
                          onChange={(e) => setForm(p => ({ ...p, telephone: e.target.value }))}
                          placeholder="+33 6 12 34 56 78"
                          className="w-full px-4 py-3 rounded-xl border border-[#E8E4DA] hover:border-[#C8C3B0] bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[#1C2620]/20 transition-all"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Mode d'expédition */}
                  <div className="mt-8">
                    <label className="block text-xs font-medium text-[#7A7A6E] uppercase tracking-wider mb-3">Mode d&apos;expédition</label>
                    <div className="space-y-2">
                      {SHIPPING_OPTIONS.map((opt) => (
                        <label
                          key={opt.id}
                          className={`flex items-center gap-4 p-4 rounded-xl border cursor-pointer transition-all ${shippingOption === opt.id ? 'border-[#1C2620] bg-white shadow-sm' : 'border-[#E8E4DA] bg-white hover:border-[#C8C3B0]'}`}
                        >
                          <div className={`w-4 h-4 rounded-full border-2 flex-shrink-0 flex items-center justify-center transition-all ${shippingOption === opt.id ? 'border-[#1C2620]' : 'border-[#C8C3B0]'}`}>
                            {shippingOption === opt.id && <div className="w-2 h-2 rounded-full bg-[#1C2620]" />}
                          </div>
                          <input type="radio" name="shipping" value={opt.id} checked={shippingOption === opt.id} onChange={() => setShippingOption(opt.id)} className="sr-only" />
                          <div className="flex-1">
                            <p className="text-sm font-semibold text-[#1C2620]">
                              {opt.label.split(' ')[0]}{' '}
                              <em className="font-light italic" style={{ fontFamily: 'Georgia, serif' }}>{opt.label.split(' ').slice(1).join(' ')}</em>
                            </p>
                            <p className="text-xs text-[#7A7A6E] mt-0.5">{opt.sub}</p>
                          </div>
                          <span className={`text-sm font-semibold flex-shrink-0 ${opt.price === 'Offerte' ? 'text-[#4A6741]' : 'text-[#1C2620]'}`}>{opt.price}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                </div>

                <button
                  type="submit"
                  className="w-full py-4 rounded-full font-semibold text-white text-sm flex items-center justify-center gap-2 transition-all hover:opacity-90"
                  style={{ background: '#1C2620' }}
                >
                  Continuer vers le paiement
                  <Icon name="ArrowRightIcon" size={16} className="text-white" />
                </button>
              </form>
            )}

            {/* ── STEP 2 : PAIEMENT ── */}
            {step === 'livraison' && (
              <form onSubmit={handleConfirm} className="space-y-8">
                <div>
                  <h1 className="text-4xl font-bold text-[#1C2620] mb-8">
                    Presque <em className="font-light italic" style={{ fontFamily: 'Georgia, serif' }}>parti.</em>
                  </h1>

                  {/* Récap coordonnées */}
                  <div className="mb-6 p-4 bg-white rounded-2xl border border-[#E8E4DA]">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-xs font-mono text-[#7A7A6E] uppercase tracking-wider">01 Vos coordonnées</span>
                      <button type="button" onClick={() => setStep('coordonnees')} className="text-xs text-[#4A6741] hover:text-[#1C2620]">Modifier</button>
                    </div>
                    <p className="text-sm text-[#1C2620]">{form.email || 'marceline@lechevier.fr'}</p>
                  </div>

                  <div className="mb-6 p-4 bg-white rounded-2xl border border-[#E8E4DA]">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-xs font-mono text-[#7A7A6E] uppercase tracking-wider">02 Livraison</span>
                      <button type="button" onClick={() => setStep('coordonnees')} className="text-xs text-[#4A6741] hover:text-[#1C2620]">Modifier</button>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-sm text-[#1C2620]">
                      <span>{form.prenom || 'Marceline'}</span>
                      <span>{form.nom || 'Chevrier'}</span>
                      <span className="col-span-2">{form.adresse || 'Adresse'}</span>
                      <span>{form.codePostal || '38380'}</span>
                      <span>{form.ville || 'Ville'}</span>
                    </div>
                    <div className="mt-3 space-y-2">
                      {SHIPPING_OPTIONS.map((opt) => (
                        <label key={opt.id} className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${shippingOption === opt.id ? 'border-[#1C2620] bg-[#F5F2EC]' : 'border-[#E8E4DA] hover:border-[#C8C3B0]'}`}>
                          <div className={`w-4 h-4 rounded-full border-2 flex-shrink-0 flex items-center justify-center ${shippingOption === opt.id ? 'border-[#1C2620]' : 'border-[#C8C3B0]'}`}>
                            {shippingOption === opt.id && <div className="w-2 h-2 rounded-full bg-[#1C2620]" />}
                          </div>
                          <input type="radio" name="shipping2" value={opt.id} checked={shippingOption === opt.id} onChange={() => setShippingOption(opt.id)} className="sr-only" />
                          <div className="flex-1">
                            <p className="text-xs font-semibold text-[#1C2620]">{opt.label}</p>
                          </div>
                          <span className={`text-xs font-semibold ${opt.price === 'Offerte' ? 'text-[#4A6741]' : 'text-[#1C2620]'}`}>{opt.price}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  {/* 03 Paiement */}
                  <div>
                    <h2 className="text-lg font-semibold text-[#1C2620] flex items-center gap-3 mb-5">
                      <span className="text-3xl font-bold text-[#E8E4DA] select-none leading-none" style={{ fontFamily: 'Georgia, serif' }}>03</span>
                      Paiement
                    </h2>

                    {/* Tabs méthodes */}
                    <div className="grid grid-cols-4 gap-2 mb-6">
                      {PAYMENT_TABS.map((pm) => (
                        <button
                          key={pm.id}
                          type="button"
                          onClick={() => setPaymentMethod(pm.id)}
                          className={`flex flex-col items-center justify-center py-3 px-2 rounded-xl border text-xs font-semibold transition-all ${paymentMethod === pm.id ? 'border-[#1C2620] bg-white shadow-sm text-[#1C2620]' : 'border-[#E8E4DA] bg-white text-[#7A7A6E] hover:border-[#C8C3B0]'}`}
                        >
                          {pm.id === 'card' && <Icon name="CreditCardIcon" size={18} className={paymentMethod === pm.id ? 'text-[#1C2620]' : 'text-[#7A7A6E]'} />}
                          {pm.id === 'apple_pay' && <span className="text-base">🍎</span>}
                          {pm.id === 'paypal' && <span className="text-base font-bold" style={{ color: '#003087' }}>P</span>}
                          {pm.id === 'alma' && <span className="text-[10px] font-bold text-[#E4501C]">3×</span>}
                          <span className="mt-1 text-[9px] uppercase tracking-wider">{pm.sub ?? pm.label}</span>
                        </button>
                      ))}
                    </div>

                    {/* Carte bancaire */}
                    {paymentMethod === 'card' && (
                      <div className="space-y-5">
                        <CreditCardVisual
                          number={form.cardNumber}
                          holder={form.cardHolder || `${form.prenom} ${form.nom}`}
                          expiry={form.cardExpiry}
                        />
                        <div className="space-y-3">
                          <div>
                            <label className="block text-xs font-medium text-[#7A7A6E] uppercase tracking-wider mb-1.5">Numéro de carte</label>
                            <input
                              type="text"
                              value={form.cardNumber}
                              onChange={(e) => setForm(p => ({ ...p, cardNumber: e.target.value.replace(/\D/g, '').replace(/(.{4})/g, '$1 ').trim().slice(0, 19) }))}
                              placeholder="1234 1234 1234 1234"
                              maxLength={19}
                              className="w-full px-4 py-3 rounded-xl border border-[#E8E4DA] hover:border-[#C8C3B0] bg-white text-sm font-mono focus:outline-none focus:ring-2 focus:ring-[#1C2620]/20 transition-all"
                            />
                          </div>
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <label className="block text-xs font-medium text-[#7A7A6E] uppercase tracking-wider mb-1.5">Expiration</label>
                              <input
                                type="text"
                                value={form.cardExpiry}
                                onChange={(e) => setForm(p => ({ ...p, cardExpiry: e.target.value }))}
                                placeholder="MM / AA"
                                maxLength={7}
                                className="w-full px-4 py-3 rounded-xl border border-[#E8E4DA] hover:border-[#C8C3B0] bg-white text-sm font-mono focus:outline-none focus:ring-2 focus:ring-[#1C2620]/20 transition-all"
                              />
                            </div>
                            <div>
                              <label className="block text-xs font-medium text-[#7A7A6E] uppercase tracking-wider mb-1.5">Cryptogramme</label>
                              <input
                                type="text"
                                value={form.cardCvc}
                                onChange={(e) => setForm(p => ({ ...p, cardCvc: e.target.value.replace(/\D/g, '').slice(0, 4) }))}
                                placeholder="CVC"
                                maxLength={4}
                                className="w-full px-4 py-3 rounded-xl border border-[#E8E4DA] hover:border-[#C8C3B0] bg-white text-sm font-mono focus:outline-none focus:ring-2 focus:ring-[#1C2620]/20 transition-all"
                              />
                            </div>
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-[#7A7A6E] uppercase tracking-wider mb-1.5">Nom du titulaire</label>
                            <input
                              type="text"
                              value={form.cardHolder}
                              onChange={(e) => setForm(p => ({ ...p, cardHolder: e.target.value }))}
                              placeholder="Comme écrit sur la carte"
                              className="w-full px-4 py-3 rounded-xl border border-[#E8E4DA] hover:border-[#C8C3B0] bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[#1C2620]/20 transition-all"
                            />
                          </div>
                          <label className="flex items-center gap-2.5 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={saveCard}
                              onChange={(e) => setSaveCard(e.target.checked)}
                              className="w-4 h-4 rounded border-[#C8C3B0] accent-[#1C2620]"
                            />
                            <span className="text-xs text-[#7A7A6E]">Enregistrer cette carte pour un futur achat (chiffrée par Stripe).</span>
                          </label>
                        </div>
                      </div>
                    )}

                    {/* Apple Pay / PayPal / Alma */}
                    {(paymentMethod === 'apple_pay' || paymentMethod === 'paypal' || paymentMethod === 'alma') && (
                      <div className="p-6 bg-white rounded-2xl border border-[#E8E4DA] text-center">
                        <p className="text-sm text-[#7A7A6E]">
                          {paymentMethod === 'apple_pay' && 'Vous serez redirigé vers Apple Pay pour finaliser votre paiement.'}
                          {paymentMethod === 'paypal' && 'Vous serez redirigé vers PayPal pour finaliser votre paiement.'}
                          {paymentMethod === 'alma' && 'Paiement en 3× sans frais. Vous serez redirigé vers Alma pour finaliser.'}
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                {/* CTA Payer */}
                {paymentMethod === 'card' && stripeConfigured ? (
                  <button
                    type="button"
                    onClick={handleStripeCheckout}
                    disabled={processing}
                    className="w-full py-4 rounded-full font-semibold text-white text-sm flex items-center justify-center gap-2 transition-all hover:opacity-90 disabled:opacity-50"
                    style={{ background: '#1C2620' }}
                  >
                    {processing ? (
                      <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Redirection Stripe…</>
                    ) : (
                      <><Icon name="LockClosedIcon" size={14} className="text-white" /> Payer {grandTotal.toFixed(0)} € par carte</>
                    )}
                  </button>
                ) : (
                  <button
                    type="submit"
                    disabled={processing}
                    className="w-full py-4 rounded-full font-semibold text-white text-sm flex items-center justify-center gap-2 transition-all hover:opacity-90 disabled:opacity-50"
                    style={{ background: '#1C2620' }}
                  >
                    {processing ? (
                      <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Traitement…</>
                    ) : (
                      <><Icon name="LockClosedIcon" size={14} className="text-white" /> Payer {grandTotal.toFixed(0)} € par {paymentMethod === 'card' ? 'carte' : paymentMethod}</>
                    )}
                  </button>
                )}

                <p className="text-center text-xs text-[#7A7A6E]">
                  En passant commande, vous acceptez les{' '}
                  <Link href="/cgv" className="underline hover:text-[#1C2620]">CGV</Link>{' '}
                  et notre{' '}
                  <Link href="/politique-confidentialite" className="underline hover:text-[#1C2620]">politique de retour</Link>.{' '}
                  Vous ne serez débité qu&apos;à l&apos;expédition.
                </p>
              </form>
            )}
          </div>

          {/* ── RÉCAPITULATIF ── */}
          {step !== 'confirmation' && (
            <div className="lg:col-span-2">
              <div className="sticky top-20 bg-white rounded-2xl border border-[#E8E4DA] p-5">
                <h3 className="font-semibold text-sm text-[#1C2620] mb-4">Votre commande</h3>

                {/* Articles */}
                <div className="space-y-3 mb-5">
                  {items.length > 0 ? items.map((item) => (
                    <div key={item.slug} className="flex items-start gap-3">
                      <div className="relative w-12 h-12 rounded-xl overflow-hidden flex-shrink-0 bg-[#F5F2EC]">
                        {item.image && (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={item.image} alt={item.name} className="w-full h-full object-cover" />
                        )}
                        <div className="absolute -top-1 -right-1 w-4 h-4 bg-[#1C2620] rounded-full flex items-center justify-center">
                          <span className="text-white text-[8px] font-bold">{item.quantity}</span>
                        </div>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-[#1C2620] truncate">{item.name}</p>
                        <p className="text-[10px] text-[#7A7A6E]">{item.quantity > 1 ? `×${item.quantity}` : ''}</p>
                      </div>
                      <p className="text-xs font-semibold text-[#1C2620] flex-shrink-0">{(item.priceEur * item.quantity).toFixed(0)} €</p>
                    </div>
                  )) : (
                    /* Demo items */
                    [
                      { name: 'Sac 45 L', sub: 'Vert forêt · 45 L · Ventrale + poitrine', price: 340, qty: 1 },
                      { name: 'Duvet 3 saisons', sub: 'Régulier · -10 °C', price: 248, qty: 1 },
                      { name: 'Gourde snow 1 L', sub: 'Sauge · 1 L', price: 68, qty: 1 },
                    ].map((item) => (
                      <div key={item.name} className="flex items-start gap-3">
                        <div className="relative w-12 h-12 rounded-xl overflow-hidden flex-shrink-0 bg-[#F5F2EC]">
                          <div className="w-full h-full flex items-center justify-center text-lg">🎒</div>
                          <div className="absolute -top-1 -right-1 w-4 h-4 bg-[#1C2620] rounded-full flex items-center justify-center">
                            <span className="text-white text-[8px] font-bold">{item.qty}</span>
                          </div>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold text-[#1C2620]">{item.name}</p>
                          <p className="text-[10px] text-[#7A7A6E]">{item.sub}</p>
                        </div>
                        <p className="text-xs font-semibold text-[#1C2620]">{item.price} €</p>
                      </div>
                    ))
                  )}
                </div>

                {/* Totaux */}
                <div className="border-t border-[#E8E4DA] pt-4 space-y-2">
                  <div className="flex justify-between text-xs text-[#7A7A6E]">
                    <span>Sous-total</span>
                    <span className="text-[#1C2620]">{items.length > 0 ? `${totalPriceEur.toFixed(0)} €` : '656 €'}</span>
                  </div>
                  <div className="flex justify-between text-xs text-[#7A7A6E]">
                    <span>Livraison suivie</span>
                    <span className="text-[#4A6741] font-semibold">Offerte</span>
                  </div>
                  <div className="flex justify-between text-xs text-[#7A7A6E]">
                    <span>TVA (20 %, incluse)</span>
                    <span className="text-[#1C2620]">{items.length > 0 ? `${tva.toFixed(2)} €` : '109,33 €'}</span>
                  </div>
                  <div className="flex justify-between font-bold text-base pt-2 border-t border-[#E8E4DA] text-[#1C2620]">
                    <span>Total</span>
                    <span>{items.length > 0 ? `${grandTotal.toFixed(0)} €` : '656 €'}</span>
                  </div>
                </div>

                {/* CTA récap */}
                {step === 'coordonnees' && (
                  <button
                    type="button"
                    onClick={() => {
                      const form_el = document.querySelector('form');
                      form_el?.requestSubmit();
                    }}
                    className="w-full mt-4 py-3.5 rounded-full font-semibold text-white text-sm flex items-center justify-center gap-2 transition-all hover:opacity-90"
                    style={{ background: '#1C2620' }}
                  >
                    Payer {items.length > 0 ? `${grandTotal.toFixed(0)} €` : '656 €'} par carte
                  </button>
                )}

                <div className="mt-4 flex items-center gap-2 text-[10px] text-[#7A7A6E]">
                  <Icon name="ShieldCheckIcon" size={12} className="text-[#4A6741]" />
                  <span>Paiement 100 % sécurisé · SSL 256-bit</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── MOBILE STICKY BOTTOM ── */}
      {step !== 'confirmation' && (
        <div className="lg:hidden fixed bottom-0 left-0 right-0 z-40 border-t border-[#E8E4DA] px-4 py-3" style={{ background: '#F5F2EC' }}>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-[#7A7A6E]">Total</span>
            <span className="font-bold text-[#1C2620]">{items.length > 0 ? `${grandTotal.toFixed(0)} €` : '656 €'}</span>
          </div>
          <div className="flex items-center justify-between text-xs text-[#7A7A6E] mb-3">
            <span>Livraison</span>
            <span className="text-[#4A6741] font-semibold">Offerte</span>
          </div>
          <button
            className="w-full py-3.5 rounded-full font-semibold text-white text-sm flex items-center justify-center gap-2"
            style={{ background: '#1C2620' }}
          >
            Payer {items.length > 0 ? `${grandTotal.toFixed(0)} €` : '656 €'} par carte
          </button>
        </div>
      )}

      <NewFooterSection />
    </div>
  );
}
