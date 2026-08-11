'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import Header from '@/components/Header';
import Icon from '@/components/ui/AppIcon';
import { getCart, getCartTotals, clearCart, CartItem } from '@/lib/cart';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import MobilePageShell from '@/components/mobile-nav/MobilePageShell';
import NewFooterSection from '@/app/components/home/NewFooterSection';


type Step = 'coordonnees' | 'livraison' | 'paiement' | 'confirmation';
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
  const [error, setError] = useState<string | null>(null);
  const [newsletterOptIn, setNewsletterOptIn] = useState(false);
  const [saveCard, setSaveCard] = useState(false);

  const [form, setForm] = useState({
    email: '', prenom: '', nom: '', adresse: '', complement: '',
    codePostal: '', ville: '', pays: 'France', telephone: '',
    cardNumber: '', cardExpiry: '', cardCvc: '', cardHolder: '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const shipping = form;
  const setShipping = setForm;
  const handleShippingSubmit = () => {
    if (!validate()) return;
    setStep('livraison');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const { user } = useAuth();
  const supabase = createClient();

  useEffect(() => {
    setItems(getCart());
    setMounted(true);
    const stripeKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
    setStripeConfigured(!!stripeKey && !stripeKey.includes('your-stripe'));
    // Check for success redirect from Stripe — le numéro de commande est créé
    // côté serveur par le webhook (jamais fabriqué côté client).
    const params = new URLSearchParams(window.location.search);
    if (params.get('success') === 'true') {
      setStep('confirmation');
      setOrderNumber('');
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
  const _tva = (totalPriceEur + shippingEur) * 0.2;
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
      if (data.url) {
        window.location.href = data.url;
        return;
      }
      throw new Error('No redirect URL from Stripe');
    } catch (err) {
      setProcessing(false);
      setError(
        err instanceof Error && err.message === 'No redirect URL from Stripe' ? "Le paiement n'a pas pu être initié. Vérifiez votre commande et réessayez."
          : 'Impossible de contacter le service de paiement. Veuillez réessayer dans un instant.'
      );
    }
  };

  const handleConfirm = async (e: React.FormEvent) => {
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
      const finalShippingEur = shippingOption === 'suivie' && serverDiscountEligible ? 0 : serverShipping;
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

  const steps: { id: Step; label: string; num: number }[] = [
    { id: 'livraison', label: 'Livraison', num: 1 },
    { id: 'paiement', label: 'Paiement', num: 2 },
    { id: 'confirmation', label: 'Confirmation', num: 3 },
  ];

  const _stepIndex = steps.findIndex(s => s.id === step);

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
      <div className="min-h-screen bg-[#F5F2E8]">
        <Header />
        <div className="pt-24 flex items-center justify-center min-h-[60vh]">
          <div className="w-8 h-8 border-2 border-[#1C2620] border-t-transparent rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="hidden md:block">
        <div className="min-h-screen bg-[#F5F2E8] text-[#1C2620]">
      <Header />

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-24">
        {step !== 'confirmation' && (
          <h1 className="font-display font-800 text-5xl text-[#1C2620] mb-12">
            Presque <em className="italic font-400 text-[#5C6B5E]">parti.</em>
          </h1>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
          {/* Main content */}
          <div className="lg:col-span-7 xl:col-span-8">

            {step !== 'confirmation' ? (
              <div className="space-y-6">
                
                {/* ── STEP 1: Vos coordonnées ── */}
                <div className={`bg-white border border-[#C8C3B0] rounded-3xl p-8 transition-opacity ${step !== 'livraison' ? 'opacity-50 pointer-events-none' : ''}`}>
                  <div className="flex items-center justify-between mb-6">
                    <h2 className="font-display font-700 text-xl flex items-center gap-3">
                      <span className="font-400 italic text-[#5C6B5E]">01</span> Vos coordonnées
                    </h2>
                    <button className="text-xs font-600 text-[#1C2620] hover:underline">Se connecter</button>
                  </div>
                  
                  <div className="space-y-4">
                    <div>
                      <label className="block text-[10px] font-mono tracking-wider text-[#5C6B5E] uppercase mb-1.5">Email</label>
                      <input
                        type="email"
                        autoComplete="email"
                        value={shipping.email}
                        onChange={(e) => setShipping(prev => ({ ...prev, email: e.target.value }))}
                        className={`w-full px-4 py-3 rounded-xl bg-[#EBE8DD] border-none text-sm focus:outline-none focus:ring-1 focus:ring-[#1C2620] ${errors.email ? 'ring-1 ring-red-500' : ''}`}
                      />
                    </div>
                    <label className="flex items-center gap-3 cursor-pointer mt-2">
                      <div className="w-4 h-4 rounded border border-[#1C2620] bg-[#1C2620] flex items-center justify-center">
                        <Icon name="CheckIcon" size={12} className="text-white" />
                      </div>
                      <span className="text-xs text-[#1C2620]">Recevoir le journal du Kit — un envoi par saison, refuges et sentiers uniquement.</span>
                    </label>
                  </div>
                </div>

                {/* ── STEP 2: Livraison ── */}
                <div className={`bg-white border border-[#C8C3B0] rounded-3xl p-8 transition-opacity ${step !== 'livraison' ? 'opacity-50 pointer-events-none' : ''}`}>
                  <h2 className="font-display font-700 text-xl flex items-center gap-3 mb-6">
                    <span className="font-400 italic text-[#5C6B5E]">02</span> Livraison
                  </h2>
                  
                  <div className="grid grid-cols-2 gap-4 mb-8">
                    <div>
                      <label className="block text-[10px] font-mono tracking-wider text-[#5C6B5E] uppercase mb-1.5">Prénom</label>
                      <input
                        type="text"
                        autoComplete="given-name"
                        value={shipping.prenom}
                        onChange={(e) => setShipping(prev => ({ ...prev, prenom: e.target.value }))}
                        className={`w-full px-4 py-3 rounded-xl bg-[#EBE8DD] border-none text-sm focus:outline-none focus:ring-1 focus:ring-[#1C2620] ${errors.prenom ? 'ring-1 ring-red-500' : ''}`}
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-mono tracking-wider text-[#5C6B5E] uppercase mb-1.5">Nom</label>
                      <input
                        type="text"
                        autoComplete="family-name"
                        value={shipping.nom}
                        onChange={(e) => setShipping(prev => ({ ...prev, nom: e.target.value }))}
                        className={`w-full px-4 py-3 rounded-xl bg-[#EBE8DD] border-none text-sm focus:outline-none focus:ring-1 focus:ring-[#1C2620] ${errors.nom ? 'ring-1 ring-red-500' : ''}`}
                      />
                    </div>
                    <div className="col-span-2">
                      <label className="block text-[10px] font-mono tracking-wider text-[#5C6B5E] uppercase mb-1.5">Adresse</label>
                      <input
                        type="text"
                        autoComplete="street-address"
                        value={shipping.adresse}
                        onChange={(e) => setShipping(prev => ({ ...prev, adresse: e.target.value }))}
                        className={`w-full px-4 py-3 rounded-xl bg-[#EBE8DD] border-none text-sm focus:outline-none focus:ring-1 focus:ring-[#1C2620] ${errors.adresse ? 'ring-1 ring-red-500' : ''}`}
                      />
                    </div>
                    <div className="col-span-2">
                      <label className="block text-[10px] font-mono tracking-wider text-[#5C6B5E] uppercase mb-1.5">Complément (Optionnel)</label>
                      <input
                        type="text"
                        autoComplete="address-line2"
                        value={shipping.complement}
                        onChange={(e) => setShipping(prev => ({ ...prev, complement: e.target.value }))}
                        placeholder="Bâtiment - étage - digicode"
                        className="w-full px-4 py-3 rounded-xl bg-[#EBE8DD] border-none text-sm focus:outline-none focus:ring-1 focus:ring-[#1C2620]"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-mono tracking-wider text-[#5C6B5E] uppercase mb-1.5">Code postal</label>
                      <input
                        type="text"
                        autoComplete="postal-code"
                        inputMode="numeric"
                        value={shipping.codePostal}
                        onChange={(e) => setShipping(prev => ({ ...prev, codePostal: e.target.value }))}
                        className={`w-full px-4 py-3 rounded-xl bg-[#EBE8DD] border-none text-sm focus:outline-none focus:ring-1 focus:ring-[#1C2620] ${errors.codePostal ? 'ring-1 ring-red-500' : ''}`}
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-mono tracking-wider text-[#5C6B5E] uppercase mb-1.5">Ville</label>
                      <input
                        type="text"
                        autoComplete="address-level2"
                        value={shipping.ville}
                        onChange={(e) => setShipping(prev => ({ ...prev, ville: e.target.value }))}
                        className={`w-full px-4 py-3 rounded-xl bg-[#EBE8DD] border-none text-sm focus:outline-none focus:ring-1 focus:ring-[#1C2620] ${errors.ville ? 'ring-1 ring-red-500' : ''}`}
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-mono tracking-wider text-[#5C6B5E] uppercase mb-1.5">Pays</label>
                      <select autoComplete="country" className="w-full px-4 py-3 rounded-xl bg-[#EBE8DD] border-none text-sm focus:outline-none focus:ring-1 focus:ring-[#1C2620] appearance-none">
                        <option>France</option>
                        <option>Belgique</option>
                        <option>Suisse</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] font-mono tracking-wider text-[#5C6B5E] uppercase mb-1.5">Téléphone</label>
                      <input
                        type="tel"
                        autoComplete="tel"
                        value={shipping.telephone}
                        onChange={(e) => setShipping(prev => ({ ...prev, telephone: e.target.value }))}
                        placeholder="+33 6 12 34 56 78"
                        className="w-full px-4 py-3 rounded-xl bg-[#EBE8DD] border-none text-sm focus:outline-none focus:ring-1 focus:ring-[#1C2620]"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] font-mono tracking-wider text-[#5C6B5E] uppercase mb-3">Mode d&apos;expédition</label>
                    <div className="space-y-3">
                      {[
                        { id: 'standard', label: 'Livraison suivie', desc: 'Colis relais ou domicile - 3 à 5 jours ouvrés - CO2 compensé', price: totalPriceEur >= 99 ? 'Offerte' : '5,90 €' },
                        { id: 'express', label: 'Express 48h', desc: 'Livré à domicile en 48 h - sur créneau choisi', price: '14 €' },
                        { id: 'relay', label: 'Retrait en atelier', desc: 'Manosque, Alpes-de-Haute-Provence - disponible dès demain', price: 'Offerte' },
                      ].map((opt) => (
                        <label key={opt.id} className={`flex items-center justify-between p-4 rounded-2xl cursor-pointer transition-all border-2 ${shippingOption === opt.id ? 'border-[#1C2620] bg-white' : 'border-transparent bg-[#F5F2E8] hover:border-[#C8C3B0]'}`}>
                          <div className="flex items-center gap-4">
                            <div className={`w-4 h-4 rounded-full border flex items-center justify-center flex-shrink-0 ${shippingOption === opt.id ? 'border-[#1C2620]' : 'border-[#C8C3B0]'}`}>
                              {shippingOption === opt.id && <div className="w-2 h-2 bg-[#1C2620] rounded-full" />}
                            </div>
                            <div>
                              <p className="font-600 text-sm">{opt.label}</p>
                              <p className="text-[10px] text-[#5C6B5E] mt-0.5">{opt.desc}</p>
                            </div>
                          </div>
                          <span className={`font-600 text-sm ${opt.price === 'Offerte' ? 'text-[#1C2620]' : ''}`}>{opt.price}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  {step === 'livraison' && (
                    <button onClick={handleShippingSubmit} className="mt-8 w-full bg-[#1C2620] hover:bg-[#2A3830] text-white py-4 rounded-xl font-600 transition-colors">
                      Continuer vers le paiement
                    </button>
                  )}
                </div>

                {/* ── STEP 3: Paiement ── */}
                <div className={`bg-white border border-[#C8C3B0] rounded-3xl p-8 transition-opacity ${step !== 'paiement' ? 'opacity-50 pointer-events-none' : ''}`}>
                  <h2 className="font-display font-700 text-xl flex items-center gap-3 mb-6">
                    <span className="font-400 italic text-[#5C6B5E]">03</span> Paiement
                  </h2>
                  
                  {step === 'paiement' && (
                    <>
                      {error && (
                        <div className="mb-8 p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm leading-relaxed">
                          {error}
                        </div>
                      )}
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-8">
                        <button className="flex flex-col items-center justify-center p-3 border-2 border-[#1C2620] rounded-2xl bg-white text-[#1C2620]">
                          <Icon name="CreditCardIcon" size={24} className="mb-1" />
                          <span className="text-[10px] font-600 font-mono tracking-widest uppercase">Carte</span>
                        </button>
                        <button className="flex flex-col items-center justify-center p-3 border border-transparent bg-[#F5F2E8] rounded-2xl text-[#5C6B5E] hover:border-[#C8C3B0]">
                          <span className="text-xl mb-1">🍎</span>
                          <span className="text-[10px] font-600 font-mono tracking-widest uppercase">Apple Pay</span>
                        </button>
                        <button className="flex flex-col items-center justify-center p-3 border border-transparent bg-[#F5F2E8] rounded-2xl text-[#5C6B5E] hover:border-[#C8C3B0]">
                          <span className="text-xl mb-1 text-blue-600 font-bold">P</span>
                          <span className="text-[10px] font-600 font-mono tracking-widest uppercase">Compte</span>
                        </button>
                        <button className="flex flex-col items-center justify-center p-3 border border-transparent bg-[#F5F2E8] rounded-2xl text-amber-700 hover:border-[#C8C3B0]">
                          <span className="text-xs font-700 italic mb-1">3× sans frais</span>
                          <span className="text-[10px] font-600 font-mono tracking-widest uppercase">Alma</span>
                        </button>
                      </div>

                      <div className="flex justify-center mb-8">
                        {/* Fake Credit Card visual */}
                        <div className="w-full max-w-[320px] aspect-[1.586] bg-gradient-to-br from-[#1C2620] to-[#0A100C] rounded-2xl p-6 text-white shadow-xl relative overflow-hidden">
                          <div className="absolute right-[-20px] top-[-20px] w-40 h-40 bg-white/5 rounded-full blur-2xl pointer-events-none" />
                          <div className="w-12 h-8 bg-[#C8C3B0] rounded bg-gradient-to-br from-[#D9D5C4] to-[#B3AE9A] mb-8" />
                          <div className="font-mono text-xl tracking-[0.2em] mb-6 flex justify-between">
                            <span>••••</span><span>••••</span><span>••••</span><span>4242</span>
                          </div>
                          <div className="flex justify-between items-end">
                            <div>
                              <p className="text-[8px] font-mono tracking-widest uppercase opacity-60 mb-1">Titulaire</p>
                              <p className="text-sm font-600 uppercase truncate max-w-[120px]">{shipping.prenom ? `${shipping.prenom[0]}. ${shipping.nom}` : 'M. Chevrier'}</p>
                            </div>
                            <div>
                              <p className="text-[8px] font-mono tracking-widest uppercase opacity-60 mb-1">Expire</p>
                              <p className="text-sm font-600 font-mono">09/28</p>
                            </div>
                            <div className="text-2xl font-bold italic opacity-80">VISA</div>
                          </div>
                        </div>
                      </div>

                      <div className="space-y-4">
                        <div>
                          <label className="block text-[10px] font-mono tracking-wider text-[#5C6B5E] uppercase mb-1.5">Numéro de carte</label>
                          <input type="text" autoComplete="cc-number" inputMode="numeric" placeholder="1234 1234 1234 1234" className="w-full px-4 py-3 rounded-xl bg-[#EBE8DD] border-none text-sm focus:outline-none font-mono" />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="block text-[10px] font-mono tracking-wider text-[#5C6B5E] uppercase mb-1.5">Expiration</label>
                            <input type="text" autoComplete="cc-exp" placeholder="MM / AA" className="w-full px-4 py-3 rounded-xl bg-[#EBE8DD] border-none text-sm focus:outline-none font-mono" />
                          </div>
                          <div>
                            <label className="block text-[10px] font-mono tracking-wider text-[#5C6B5E] uppercase mb-1.5">Cryptogramme</label>
                            <input type="text" autoComplete="cc-csc" inputMode="numeric" placeholder="CVC" className="w-full px-4 py-3 rounded-xl bg-[#EBE8DD] border-none text-sm focus:outline-none font-mono" />
                          </div>
                        </div>
                        <div>
                          <label className="block text-[10px] font-mono tracking-wider text-[#5C6B5E] uppercase mb-1.5">Nom du titulaire</label>
                          <input type="text" autoComplete="cc-name" placeholder="Comme écrit sur la carte" className="w-full px-4 py-3 rounded-xl bg-[#EBE8DD] border-none text-sm focus:outline-none uppercase" />
                        </div>
                        
                        <label className="flex items-center gap-3 cursor-pointer mt-4 mb-6">
                          <div className="w-4 h-4 rounded border border-[#1C2620] bg-[#1C2620] flex items-center justify-center">
                            <Icon name="CheckIcon" size={12} className="text-white" />
                          </div>
                          <span className="text-xs text-[#5C6B5E]">Enregistrer cette carte pour un futur achat (chiffrée par Stripe).</span>
                        </label>
                      </div>

                      <button
                        onClick={handleStripeCheckout}
                        disabled={processing}
                        className="w-full bg-[#1C2620] hover:bg-[#2A3830] text-white py-4 rounded-xl font-600 transition-colors disabled:opacity-50"
                      >
                        {processing ? 'Traitement...' : `Payer ${grandTotal.toFixed(2)} €`}
                      </button>
                    </>
                  )}
                </div>

              </div>
            ) : (
              /* ── STEP 3: Confirmation ── */
              <div className="bg-white border border-[#C8C3B0] rounded-3xl p-12 text-center h-full flex flex-col items-center justify-center min-h-[500px]">
                <div className="w-20 h-20 bg-[#F5F2E8] border border-[#C8C3B0] rounded-full flex items-center justify-center mb-6">
                  <Icon name="CheckIcon" size={32} className="text-[#1C2620]" />
                </div>
                <h2 className="font-display font-800 text-3xl mb-4">Commande confirmée.</h2>
                <p className="text-[#5C6B5E] mb-2">
                  {orderNumber ? (
                    <>Numéro de commande : <span className="font-mono font-600 text-[#1C2620]">{orderNumber}</span></>
                  ) : (
                    'Votre numéro de commande vous sera envoyé par email.'
                  )}
                </p>
                <p className="text-sm text-[#5C6B5E] mb-8 max-w-sm mx-auto leading-relaxed">
                  Merci ! Un email de confirmation vous a été envoyé. Préparez-vous pour l&apos;aventure.
                </p>
                <Link href="/mon-materiel" className="inline-flex items-center gap-2 bg-[#1C2620] text-white px-8 py-3.5 rounded-xl font-600 text-sm hover:bg-[#2A3830] transition-colors">
                  Voir mon inventaire
                </Link>
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

          {/* Order summary sidebar */}
          <div className="lg:col-span-5 xl:col-span-4">
            <div className="bg-white border border-[#C8C3B0] rounded-3xl p-8 sticky top-24">
              <h3 className="font-display font-700 text-lg mb-6">Votre commande</h3>
              <div className="space-y-4 mb-6">
                {items.map((item) => (
                  <div key={item.slug} className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-[#F5F2E8] rounded-xl flex-shrink-0 overflow-hidden border border-[#C8C3B0]">
                      {item.image ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={item.image} alt={item.name} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-[#EBE8DD]">
                          <Icon name="PhotoIcon" size={16} className="text-[#5C6B5E]/30" />
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-600 text-[#1C2620] truncate pr-2">{item.name}</p>
                      <p className="text-[10px] text-[#5C6B5E] mt-0.5">Quantité : {item.quantity}</p>
                    </div>
                    <p className="text-xs font-600 whitespace-nowrap">{(item.priceEur * item.quantity).toFixed(2)} €</p>
                  </div>
                ))}
              </div>

              <div className="border-t border-[#C8C3B0]/50 pt-5 space-y-2 mb-5">
                <div className="flex justify-between text-xs">
                  <span className="text-[#5C6B5E]">Sous-total</span>
                  <span className="font-600">{totalPriceEur.toFixed(2)} €</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-[#5C6B5E]">Livraison suivie</span>
                  <span className="font-600 text-[#1C2620]">{shippingEur === 0 ? 'Offerte' : `${shippingEur.toFixed(2)} €`}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-[#5C6B5E]">TVA (20 %, incluse)</span>
                  <span className="font-600">{(totalPriceEur * 0.2).toFixed(2)} €</span>
                </div>
              </div>

              <div className="flex justify-between items-end font-display font-800 text-2xl pt-5 border-t border-[#C8C3B0]">
                <span className="text-lg">Total</span>
                <span>{grandTotal.toFixed(2)} €</span>
              </div>

              {step === 'livraison' && (
                <button onClick={handleShippingSubmit} className="mt-6 w-full bg-[#1C2620] hover:bg-[#2A3830] text-white py-4 rounded-xl font-600 transition-colors">
                  Payer {grandTotal.toFixed(2)} € par carte
                </button>
              )}
              {step === 'paiement' && (
                <button onClick={handleStripeCheckout} disabled={processing} className="mt-6 w-full bg-[#1C2620] hover:bg-[#2A3830] text-white py-4 rounded-xl font-600 transition-colors disabled:opacity-50">
                  {processing ? 'Traitement...' : `Payer ${grandTotal.toFixed(2)} € par carte`}
                </button>
              )}
              
              <p className="text-center text-[10px] text-[#5C6B5E] mt-4 max-w-[250px] mx-auto leading-relaxed">
                En passant commande, vous acceptez les <a href="#" className="underline">CGV</a> et notre <a href="#" className="underline">politique de retour</a>. Vous ne serez débité qu&apos;à l&apos;expédition.
              </p>
            </div>
          </div>
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
    </div>

    <div className="block md:hidden">
      <MobilePageShell>
        <div style={{ padding: '12px 16px 20px' }}>
          <div style={{ display: 'flex', gap: '6px', marginBottom: '16px' }}>
            {[0,1,2,3].map(i => (
              <div key={i} style={{ flex: 1, height: '3px', borderRadius: '999px', background: i < 2 ? '#A8C8A0' : i === 2 ? '#17402C' : 'rgba(11,31,23,0.08)' }} />
            ))}
          </div>
          <div style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.14em', color: '#6B7A72' }}>Étape 3 · 4 · Paiement</div>
          <h1 style={{ fontSize: '26px', letterSpacing: '-0.025em', margin: 0 }}>
            Un dernier <em style={{ fontFamily: 'Georgia, serif', fontStyle: 'italic', color: '#17402C', fontWeight: 400 }}>geste.</em>
          </h1>
        </div>

        <div style={{ margin: '0 16px 12px', padding: '14px', background: '#FBFAF6', borderRadius: '14px', border: '1px solid rgba(11,31,23,0.06)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: '#F4F1EA', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#17402C" strokeWidth="1.5"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '13px', fontWeight: 500, color: '#0B1F17' }}>{shipping.prenom || 'Mathieu'} {shipping.nom || 'Chevrier'}</div>
              <div style={{ fontSize: '11px', color: '#6B7A72' }}>{shipping.adresse || '42 Rue de la République'} · {shipping.codePostal || '38000'} {shipping.ville || 'Grenoble'}</div>
            </div>
            <div style={{ fontSize: '9px', fontWeight: 500, color: '#17402C', background: '#EDF3ED', padding: '2px 8px', borderRadius: '999px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Maison</div>
          </div>
        </div>

        <div style={{ margin: '0 16px 12px', padding: '14px', background: '#FBFAF6', borderRadius: '14px', border: '1px solid rgba(11,31,23,0.06)' }}>
          <div style={{ fontSize: '11px', fontWeight: 500, color: '#0B1F17', marginBottom: '10px' }}>Mode d'expédition</div>
          {[{ id: 'standard', label: 'Livraison suivie', price: 'Offerte', desc: '3-5 jours ouvrés' }, { id: 'express', label: 'Express 48h', price: '9,90 €', desc: 'Livré à domicile' }].map(opt => (
            <label key={opt.id} onClick={() => setShippingOption(opt.id as ShippingOption)} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 0', borderTop: '1px solid rgba(11,31,23,0.05)', cursor: 'pointer' }}>
              <div style={{ width: '18px', height: '18px', borderRadius: '999px', border: '1.5px solid', borderColor: shippingOption === opt.id ? '#17402C' : '#A3C4A3', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                {shippingOption === opt.id && <div style={{ width: '10px', height: '10px', borderRadius: '999px', background: '#17402C' }} />}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '13px', fontWeight: 500, color: '#0B1F17' }}>{opt.label}</div>
                <div style={{ fontSize: '10px', color: '#6B7A72' }}>{opt.desc}</div>
              </div>
              <div style={{ fontSize: '13px', fontWeight: 500, color: '#17402C' }}>{opt.price}</div>
            </label>
          ))}
        </div>

        <div style={{ margin: '0 16px 12px', padding: '14px', background: '#FBFAF6', borderRadius: '14px', border: '1px solid rgba(11,31,23,0.06)' }}>
          <div style={{ fontSize: '11px', fontWeight: 500, color: '#0B1F17', marginBottom: '10px' }}>Moyen de paiement</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
            {['Carte', 'Apple Pay', 'PayPal', "3× sans frais"].map(m => (
              <button key={m} style={{ padding: '10px', borderRadius: '10px', background: '#F4F1EA', border: 'none', fontSize: '11px', fontWeight: 500, color: '#0B1F17', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'center' }}>
                {m}
              </button>
            ))}
          </div>
        </div>

        {error && (
          <div style={{ margin: '0 16px 12px', padding: '12px 14px', background: '#FDEBE9', border: '1px solid #F2C4BC', borderRadius: '12px', color: '#A12B20', fontSize: '12px', lineHeight: 1.5 }}>
            {error}
          </div>
        )}

        <div style={{ margin: '12px 16px', padding: '16px', background: '#06120C', borderRadius: '16px', color: '#FBFAF6' }}>
          <div style={{ fontSize: '11px', fontWeight: 500, marginBottom: '12px', opacity: 0.8 }}>Récapitulatif</div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '12px', opacity: 0.7 }}>
            <span>Sous-total</span>
            <span style={{ fontWeight: 500 }}>{totalPriceEur.toFixed(0)} €</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px', fontSize: '12px', opacity: 0.7 }}>
            <span>Livraison</span>
            <span style={{ fontWeight: 500 }}>{shippingEur === 0 ? 'Offerte' : `${shippingEur.toFixed(2)} €`}</span>
          </div>
          <div style={{ height: '1px', background: 'rgba(255,255,255,0.12)', margin: '12px 0' }} />
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '14px' }}>
            <span style={{ fontSize: '15px', fontWeight: 700 }}>Total</span>
            <span style={{ fontSize: '15px', fontWeight: 700 }}>{grandTotal.toFixed(0)} €</span>
          </div>
          <button onClick={handleStripeCheckout} disabled={processing} style={{ width: '100%', padding: '14px', background: '#17402C', color: '#fff', border: 'none', borderRadius: '999px', fontSize: '14px', fontWeight: 500, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', fontFamily: 'inherit' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="1" y="11" width="22" height="10" rx="2"/><path d="M6 11V7a6 6 0 0 1 12 0v4"/></svg>
            Payer {grandTotal.toFixed(0)} €
          </button>
        </div>

        
      </MobilePageShell>
    </div>
  </>
);
}
