'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { getCart, getCartTotals, clearCart, CartItem } from '@/lib/cart';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

type CheckoutStep = 'livraison' | 'paiement' | 'confirmation';
type PaymentMethod = 'card' | 'apple_pay' | 'paypal' | 'alma';
type ShippingOption = 'suivie' | 'express' | 'atelier';

const SHIPPING_OPTIONS: { id: ShippingOption; label: string; labelItalic: string; price: number | null; desc: string }[] = [
  { id: 'suivie', label: 'Livraison', labelItalic: 'suivie', price: 0, desc: 'Colis-relais ou domicile · 3 à 5 jours ouvrés · CO₂ compensé' },
  { id: 'express', label: 'Express', labelItalic: '48h', price: 14, desc: 'Livré à domicile en 48 h · sur créneau choisi' },
  { id: 'atelier', label: 'Retrait', labelItalic: 'en atelier', price: 0, desc: 'Manosque, Alpes-de-Haute-Provence · disponible dès demain' },
];

const PAYMENT_METHODS: { id: PaymentMethod; label: string; labelItalic?: string }[] = [
  { id: 'card', label: 'CARTE' },
  { id: 'apple_pay', label: 'APPLE PAY' },
  { id: 'paypal', label: 'COMPTE PAYPAL' },
  { id: 'alma', label: '3×', labelItalic: 'sans frais ALMA' },
];

export default function CheckoutPage() {
  const [step, setStep] = useState<CheckoutStep>('livraison');
  const [items, setItems] = useState<CartItem[]>([]);
  const [mounted, setMounted] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('card');
  const [shippingOption, setShippingOption] = useState<ShippingOption>('suivie');
  const [orderNumber, setOrderNumber] = useState('');
  const [saveCard, setSaveCard] = useState(true);
  const [newsletter, setNewsletter] = useState(true);

  const [form, setForm] = useState({
    email: '',
    prenom: '',
    nom: '',
    adresse: '',
    complement: '',
    codePostal: '',
    ville: '',
    pays: 'France',
    telephone: '',
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const { user } = useAuth();
  const supabase = createClient();

  useEffect(() => {
    setItems(getCart());
    setMounted(true);
    if (user?.email) setForm(f => ({ ...f, email: user.email ?? '' }));
    const params = new URLSearchParams(window.location.search);
    if (params.get('success') === 'true') {
      setStep('confirmation');
      setOrderNumber(`KDV-2026-${Math.floor(Math.random() * 9000 + 1000)}`);
    }
  }, [user]);

  const { totalPriceEur } = getCartTotals(items);
  const shippingCost = shippingOption === 'express' ? 14 : 0;
  const grandTotal = totalPriceEur + shippingCost;
  const tva = Math.round(grandTotal * 0.2 * 100) / 100;

  const validate = () => {
    const e: Record<string, string> = {};
    if (!form.email.trim() || !/\S+@\S+\.\S+/.test(form.email)) e.email = 'Email invalide';
    if (!form.prenom.trim()) e.prenom = 'Requis';
    if (!form.nom.trim()) e.nom = 'Requis';
    if (!form.adresse.trim()) e.adresse = 'Requis';
    if (!form.codePostal.trim()) e.codePostal = 'Requis';
    if (!form.ville.trim()) e.ville = 'Requis';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleLivraisonSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setStep('paiement');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handlePay = async (e: React.FormEvent) => {
    e.preventDefault();
    setProcessing(true);
    try {
      // Stripe checkout
      const stripeKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
      if (stripeKey && !stripeKey.includes('your-stripe')) {
        const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || window.location.origin;
        const res = await fetch('/api/checkout', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            items: items.map(i => ({ name: i.name, priceEur: i.priceEur, quantity: i.quantity, image: i.image })),
            successUrl: `${siteUrl}/checkout?success=true`,
            cancelUrl: `${siteUrl}/panier`,
          }),
        });
        const data = await res.json();
        if (data.url) { window.location.href = data.url; return; }
      }
      // Fallback: simulate order
      const num = `KDV-2026-${Math.floor(Math.random() * 9000 + 1000)}`;
      setOrderNumber(num);
      clearCart();
      setStep('confirmation');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch {
      // silent
    } finally {
      setProcessing(false);
    }
  };

  const STEPS_NAV = [
    { id: 'livraison', label: 'Panier', num: 1, done: step !== 'livraison' },
    { id: 'paiement', label: 'Livraison & paiement', num: 2, done: step === 'confirmation' },
    { id: 'confirmation', label: 'Confirmation', num: 3, done: false },
  ];

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
      {/* Checkout header */}
      <header className="bg-white border-b border-[#E0DDD0] fixed top-0 left-0 right-0 z-50">
        <div className="max-w-6xl mx-auto px-6 lg:px-8 h-14 flex items-center justify-between">
          <Link href="/" className="text-sm font-semibold text-[#0E1512]" style={{ fontFamily: '"General Sans", "DM Sans", sans-serif' }}>
            Le Kit du Voyageur
          </Link>
          <div className="flex items-center gap-2 text-xs text-[#4A6355]">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
              <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
            </svg>
            Paiement sécurisé – Stripe
          </div>
          <Link href="/panier" className="text-sm text-[#4A6355] hover:text-[#0E1512] transition-colors flex items-center gap-1">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 12H5M12 5l-7 7 7 7"/>
            </svg>
            Retour au panier
          </Link>
        </div>

        {/* Step progress */}
        <div className="max-w-6xl mx-auto px-6 lg:px-8 pb-3">
          <div className="flex items-center gap-3 text-xs">
            {STEPS_NAV.map((s, i) => (
              <React.Fragment key={s.id}>
                <div className="flex items-center gap-1.5">
                  {s.done ? (
                    <div className="w-4 h-4 rounded-full bg-[#33463C] flex items-center justify-center">
                      <svg width="8" height="8" viewBox="0 0 12 12" fill="none">
                        <path d="M2 6l3 3 5-5" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </div>
                  ) : (
                    <span
                      className="w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold"
                      style={{
                        backgroundColor: step === s.id ? '#1C2620' : 'transparent',
                        border: step === s.id ? 'none' : '1.5px solid #D4CFBF',
                        color: step === s.id ? '#FFFFFF' : '#9AAD9E',
                      }}
                    >
                      {s.num}
                    </span>
                  )}
                  <span style={{ fontWeight: step === s.id ? 700 : 400, color: step === s.id ? '#0E1512' : s.done ? '#4A6355' : '#9AAD9E' }}>
                    {s.label}
                  </span>
                </div>
                {i < STEPS_NAV.length - 1 && <span className="text-[#D4CFBF]">›</span>}
              </React.Fragment>
            ))}
          </div>
        </div>
      </header>

      <main className="pt-28 pb-16 max-w-6xl mx-auto px-6 lg:px-8">
        {step === 'confirmation' ? (
          <div className="max-w-lg mx-auto text-center py-16">
            <div className="w-16 h-16 bg-[#EBF0EB] rounded-full flex items-center justify-center mx-auto mb-6">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#1C2620" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12"/>
              </svg>
            </div>
            <h1 className="mb-3" style={{ fontFamily: '"General Sans", "DM Sans", sans-serif', fontSize: '2rem', fontWeight: 600, letterSpacing: '-0.025em', color: '#0E1512' }}>
              Commande{' '}
              <em style={{ fontFamily: 'Fraunces, Georgia, serif', fontStyle: 'italic', fontWeight: 400 }}>confirmée.</em>
            </h1>
            <p className="text-sm text-[#4A6355] mb-2">Numéro de commande : <strong className="text-[#0E1512]">{orderNumber}</strong></p>
            <p className="text-sm text-[#4A6355] mb-8">Vous recevrez un email de confirmation à {form.email || 'votre adresse'}.</p>
            <Link
              href="/boutique"
              className="inline-flex items-center gap-2 px-6 py-3 text-sm font-semibold text-white bg-[#1C2620] hover:bg-[#0E1512] transition-all"
              style={{ borderRadius: '2px' }}
            >
              Retour à la boutique
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-12">
            {/* Form */}
            <div className="lg:col-span-3">
              {/* Page title */}
              <h1 className="mb-8" style={{ fontFamily: '"General Sans", "DM Sans", sans-serif', fontSize: 'clamp(2rem, 3vw, 2.75rem)', fontWeight: 600, letterSpacing: '-0.03em', color: '#0E1512' }}>
                Presque{' '}
                <em style={{ fontFamily: 'Fraunces, Georgia, serif', fontStyle: 'italic', fontWeight: 400 }}>parti.</em>
              </h1>

              {step === 'livraison' && (
                <form onSubmit={handleLivraisonSubmit} noValidate>
                  {/* Section 01 */}
                  <div className="mb-8">
                    <div className="flex items-center justify-between mb-5">
                      <h2 style={{ fontFamily: '"General Sans", "DM Sans", sans-serif', fontSize: '1rem', fontWeight: 700, color: '#0E1512' }}>
                        <span className="text-[#4A6355] mr-2">01</span>Vos coordonnées
                      </h2>
                      <Link href="/connexion" className="text-xs text-[#4A6355] hover:text-[#0E1512] transition-colors">Se connecter</Link>
                    </div>
                    <div className="flex flex-col gap-4">
                      <div>
                        <label className="form-label">EMAIL</label>
                        <input
                          type="email"
                          value={form.email}
                          onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                          className="form-input"
                          placeholder="votre@email.fr"
                        />
                        {errors.email && <p className="text-xs text-red-500 mt-1">{errors.email}</p>}
                      </div>
                      <label className="flex items-start gap-3 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={newsletter}
                          onChange={e => setNewsletter(e.target.checked)}
                          className="mt-0.5 w-4 h-4 accent-[#1C2620]"
                        />
                        <span className="text-xs text-[#4A6355] leading-relaxed">
                          Recevoir le journal du Kit — un envoi par saison, refuges et sentiers uniquement.
                        </span>
                      </label>
                    </div>
                  </div>

                  {/* Section 02 */}
                  <div className="mb-8">
                    <h2 className="mb-5" style={{ fontFamily: '"General Sans", "DM Sans", sans-serif', fontSize: '1rem', fontWeight: 700, color: '#0E1512' }}>
                      <span className="text-[#4A6355] mr-2">02</span>Livraison
                    </h2>
                    <div className="grid grid-cols-2 gap-4 mb-4">
                      <div>
                        <label className="form-label">PRÉNOM</label>
                        <input type="text" value={form.prenom} onChange={e => setForm(f => ({ ...f, prenom: e.target.value }))} className="form-input" placeholder="Marceline" />
                        {errors.prenom && <p className="text-xs text-red-500 mt-1">{errors.prenom}</p>}
                      </div>
                      <div>
                        <label className="form-label">NOM</label>
                        <input type="text" value={form.nom} onChange={e => setForm(f => ({ ...f, nom: e.target.value }))} className="form-input" placeholder="Chevrier" />
                        {errors.nom && <p className="text-xs text-red-500 mt-1">{errors.nom}</p>}
                      </div>
                    </div>
                    <div className="flex flex-col gap-4 mb-6">
                      <div>
                        <label className="form-label">ADRESSE</label>
                        <input type="text" value={form.adresse} onChange={e => setForm(f => ({ ...f, adresse: e.target.value }))} className="form-input" placeholder="14 rue du Grand Som" />
                        {errors.adresse && <p className="text-xs text-red-500 mt-1">{errors.adresse}</p>}
                      </div>
                      <div>
                        <label className="form-label">COMPLÉMENT (OPTIONNEL)</label>
                        <input type="text" value={form.complement} onChange={e => setForm(f => ({ ...f, complement: e.target.value }))} className="form-input" placeholder="Appartement, bâtiment..." />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="form-label">CODE POSTAL</label>
                          <input type="text" value={form.codePostal} onChange={e => setForm(f => ({ ...f, codePostal: e.target.value }))} className="form-input" placeholder="38380" />
                          {errors.codePostal && <p className="text-xs text-red-500 mt-1">{errors.codePostal}</p>}
                        </div>
                        <div>
                          <label className="form-label">VILLE</label>
                          <input type="text" value={form.ville} onChange={e => setForm(f => ({ ...f, ville: e.target.value }))} className="form-input" placeholder="Saint-Pierre-de-Chartreuse" />
                          {errors.ville && <p className="text-xs text-red-500 mt-1">{errors.ville}</p>}
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="form-label">PAYS</label>
                          <select value={form.pays} onChange={e => setForm(f => ({ ...f, pays: e.target.value }))} className="form-input" style={{ cursor: 'pointer' }}>
                            <option>France</option>
                            <option>Belgique</option>
                            <option>Suisse</option>
                            <option>Luxembourg</option>
                          </select>
                        </div>
                        <div>
                          <label className="form-label">TÉLÉPHONE</label>
                          <input type="tel" value={form.telephone} onChange={e => setForm(f => ({ ...f, telephone: e.target.value }))} className="form-input" placeholder="+33 6 12 34 56 78" />
                        </div>
                      </div>
                    </div>

                    {/* Shipping options */}
                    <h3 className="mb-3 text-xs font-bold text-[#4A6355] uppercase tracking-widest">MODE D&apos;EXPÉDITION</h3>
                    <div className="flex flex-col gap-2">
                      {SHIPPING_OPTIONS.map((opt) => (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() => setShippingOption(opt.id)}
                          className="radio-card text-left flex items-center justify-between"
                          style={{ borderColor: shippingOption === opt.id ? '#1C2620' : '#E0DDD0', backgroundColor: shippingOption === opt.id ? '#EBF0EB' : '#FFFFFF' }}
                        >
                          <div className="flex items-center gap-3">
                            <div
                              className="w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0"
                              style={{ borderColor: shippingOption === opt.id ? '#1C2620' : '#D4CFBF' }}
                            >
                              {shippingOption === opt.id && <div className="w-2 h-2 rounded-full bg-[#1C2620]" />}
                            </div>
                            <div>
                              <p style={{ fontFamily: '"General Sans", "DM Sans", sans-serif', fontSize: '0.875rem', fontWeight: 600, color: '#0E1512' }}>
                                {opt.label}{' '}
                                <em style={{ fontFamily: 'Fraunces, Georgia, serif', fontStyle: 'italic', fontWeight: 400 }}>{opt.labelItalic}</em>
                              </p>
                              <p className="text-xs text-[#4A6355] mt-0.5">{opt.desc}</p>
                            </div>
                          </div>
                          <span style={{ fontFamily: '"General Sans", "DM Sans", sans-serif', fontSize: '0.875rem', fontWeight: 600, color: '#0E1512', flexShrink: 0, marginLeft: '1rem' }}>
                            {opt.price === 0 ? 'Offerte' : `${opt.price} €`}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>

                  <button
                    type="submit"
                    className="w-full flex items-center justify-center py-3.5 text-sm font-semibold text-white bg-[#1C2620] hover:bg-[#0E1512] transition-all"
                    style={{ borderRadius: '2px', minHeight: '52px' }}
                  >
                    Continuer vers le paiement
                    <svg className="ml-2" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M5 12h14M12 5l7 7-7 7"/>
                    </svg>
                  </button>
                </form>
              )}

              {step === 'paiement' && (
                <form onSubmit={handlePay} noValidate>
                  {/* Collapsed sections */}
                  <div className="mb-6 flex flex-col gap-3">
                    {[
                      { num: '01', label: 'Vos coordonnées', value: form.email },
                      { num: '02', label: 'Livraison', value: `${form.prenom} ${form.nom} · ${form.adresse}, ${form.codePostal} ${form.ville}` },
                    ].map(({ num, label, value }) => (
                      <div key={num} className="flex items-center justify-between p-4 bg-white border border-[#E0DDD0]" style={{ borderRadius: '2px' }}>
                        <div>
                          <p className="text-xs font-bold text-[#4A6355] uppercase tracking-wider mb-0.5">
                            <span className="mr-2">{num}</span>{label}
                          </p>
                          <p className="text-sm text-[#0E1512] truncate max-w-xs">{value}</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => setStep('livraison')}
                          className="text-xs text-[#4A6355] hover:text-[#0E1512] transition-colors font-medium"
                        >
                          Modifier
                        </button>
                      </div>
                    ))}
                  </div>

                  {/* Section 03 — Payment */}
                  <div className="mb-8">
                    <h2 className="mb-5" style={{ fontFamily: '"General Sans", "DM Sans", sans-serif', fontSize: '1rem', fontWeight: 700, color: '#0E1512' }}>
                      <span className="text-[#4A6355] mr-2">03</span>Paiement
                    </h2>

                    {/* Payment method tabs */}
                    <div className="flex gap-2 mb-5 flex-wrap">
                      {PAYMENT_METHODS.map((pm) => (
                        <button
                          key={pm.id}
                          type="button"
                          onClick={() => setPaymentMethod(pm.id)}
                          className="px-4 py-2 text-xs font-bold transition-all"
                          style={{
                            borderRadius: '2px',
                            letterSpacing: '0.08em',
                            border: paymentMethod === pm.id ? '1.5px solid #1C2620' : '1.5px solid #E0DDD0',
                            backgroundColor: paymentMethod === pm.id ? '#1C2620' : '#FFFFFF',
                            color: paymentMethod === pm.id ? '#FFFFFF' : '#4A6355',
                            fontFamily: '"General Sans", "DM Sans", sans-serif',
                          }}
                        >
                          {pm.label}{pm.labelItalic && <em style={{ fontFamily: 'Fraunces, Georgia, serif', fontStyle: 'italic', fontWeight: 400, marginLeft: '0.25rem' }}>{pm.labelItalic}</em>}
                        </button>
                      ))}
                    </div>

                    {paymentMethod === 'card' && (
                      <div className="flex flex-col gap-4">
                        {/* Card preview */}
                        <div className="p-5 bg-[#1C2620] text-white" style={{ borderRadius: '4px', aspectRatio: '1.586 / 1', maxWidth: '280px' }}>
                          <div className="flex items-start justify-between mb-8">
                            <div className="w-8 h-6 bg-[#B5AA88] rounded-sm opacity-80" />
                            <span className="text-xs font-bold tracking-widest text-white/60">VISA</span>
                          </div>
                          <p className="text-lg font-mono tracking-widest mb-4">•••• •••• •••• 4242</p>
                          <div className="flex items-end justify-between">
                            <div>
                              <p className="text-[9px] text-white/40 uppercase tracking-wider mb-0.5">Titulaire</p>
                              <p className="text-sm font-semibold">{form.prenom ? `${form.prenom.charAt(0)}. ${form.nom}` : 'M. Chevrier'}</p>
                            </div>
                            <div className="text-right">
                              <p className="text-[9px] text-white/40 uppercase tracking-wider mb-0.5">Expire</p>
                              <p className="text-sm font-semibold">09/28</p>
                            </div>
                          </div>
                        </div>

                        {/* Card fields */}
                        <div>
                          <label className="form-label">NUMÉRO DE CARTE</label>
                          <input type="text" className="form-input" placeholder="1234 1234 1234 1234" />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="form-label">EXPIRATION</label>
                            <input type="text" className="form-input" placeholder="MM / AA" />
                          </div>
                          <div>
                            <label className="form-label">CRYPTOGRAMME</label>
                            <input type="text" className="form-input" placeholder="CVC" />
                          </div>
                        </div>
                        <div>
                          <label className="form-label">NOM DU TITULAIRE</label>
                          <input type="text" className="form-input" placeholder="Comme écrit sur la carte" />
                        </div>
                        <label className="flex items-start gap-3 cursor-pointer">
                          <input type="checkbox" checked={saveCard} onChange={e => setSaveCard(e.target.checked)} className="mt-0.5 w-4 h-4 accent-[#1C2620]" />
                          <span className="text-xs text-[#4A6355] leading-relaxed">
                            Enregistrer cette carte pour un futur achat (chiffrée par Stripe).
                          </span>
                        </label>
                      </div>
                    )}

                    {paymentMethod !== 'card' && (
                      <div className="p-8 bg-white border border-[#E0DDD0] text-center" style={{ borderRadius: '2px' }}>
                        <p className="text-sm text-[#4A6355]">
                          Vous serez redirigé vers {paymentMethod === 'paypal' ? 'PayPal' : paymentMethod === 'apple_pay' ? 'Apple Pay' : 'Alma'} pour finaliser votre paiement.
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Pay button */}
                  <button
                    type="submit"
                    disabled={processing}
                    className="w-full flex items-center justify-center py-3.5 text-sm font-semibold text-white bg-[#1C2620] hover:bg-[#0E1512] disabled:opacity-60 transition-all"
                    style={{ borderRadius: '2px', minHeight: '52px' }}
                  >
                    {processing ? (
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : (
                      `Payer ${grandTotal} € par ${paymentMethod === 'card' ? 'carte' : paymentMethod === 'paypal' ? 'PayPal' : paymentMethod === 'apple_pay' ? 'Apple Pay' : 'Alma'}`
                    )}
                  </button>

                  {/* Legal */}
                  <div className="mt-4 text-center">
                    <p className="text-xs text-[#4A6355] leading-relaxed">
                      En passant commande, vous acceptez les{' '}
                      <Link href="/cgv" className="underline hover:text-[#0E1512]">CGV</Link>
                      {' '}et notre{' '}
                      <Link href="/politique-confidentialite" className="underline hover:text-[#0E1512]">politique de retour</Link>.
                    </p>
                    <p className="text-xs text-[#4A6355] mt-1">Vous ne serez débité qu&apos;à l&apos;expédition.</p>
                  </div>
                </form>
              )}
            </div>

            {/* Order summary */}
            <div className="lg:col-span-2">
              <div className="bg-white border border-[#E0DDD0] p-6 sticky top-28" style={{ borderRadius: '2px' }}>
                <h2 className="mb-5" style={{ fontFamily: '"General Sans", "DM Sans", sans-serif', fontSize: '0.9375rem', fontWeight: 700, color: '#0E1512' }}>
                  Votre commande
                </h2>

                {/* Items */}
                <div className="flex flex-col gap-4 mb-5">
                  {items.map((item) => (
                    <div key={item.id} className="flex items-center gap-3">
                      <div className="w-12 h-12 flex-shrink-0 overflow-hidden bg-[#EBF0EB] relative" style={{ borderRadius: '2px' }}>
                        <img src={item.image} alt={item.imageAlt} className="w-full h-full object-cover" />
                        <span className="absolute -top-1 -right-1 w-4 h-4 bg-[#4A6355] text-white text-[9px] font-bold rounded-full flex items-center justify-center">
                          {item.quantity}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-[#0E1512] truncate">{item.name}</p>
                        <p className="text-xs text-[#4A6355]">{item.category}</p>
                      </div>
                      <span className="text-sm font-semibold text-[#0E1512] flex-shrink-0">{item.priceEur * item.quantity} €</span>
                    </div>
                  ))}
                </div>

                {/* Summary lines */}
                <div className="flex flex-col gap-2.5 py-4 border-t border-[#E0DDD0]">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-[#4A6355]">Sous-total</span>
                    <span className="font-semibold text-[#0E1512]">{totalPriceEur} €</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-[#4A6355]">Livraison suivie</span>
                    <span className="font-semibold text-[#1C2620]">{shippingCost === 0 ? 'Offerte' : `${shippingCost} €`}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-[#4A6355]">TVA (20 %, incluse)</span>
                    <span className="text-[#4A6355]">{tva.toFixed(2)} €</span>
                  </div>
                </div>

                {/* Total */}
                <div className="flex items-center justify-between py-4 border-t border-[#E0DDD0]">
                  <span style={{ fontFamily: '"General Sans", "DM Sans", sans-serif', fontSize: '1rem', fontWeight: 700, color: '#0E1512' }}>Total</span>
                  <span style={{ fontFamily: '"General Sans", "DM Sans", sans-serif', fontSize: '1.25rem', fontWeight: 700, color: '#0E1512' }}>{grandTotal} €</span>
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
