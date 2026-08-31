'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import Icon from '@/components/ui/AppIcon';
import LkvButton from '@/components/ui/LkvButton';
import { getCart, getCartTotals, clearCart, CartItem } from '@/lib/cart';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import MobilePageShell from '@/components/mobile-nav/MobilePageShell';

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

  const steps: { id: Step; label: string; num: number }[] = [
    { id: 'livraison', label: 'Livraison', num: 1 },
    { id: 'paiement', label: 'Paiement', num: 2 },
    { id: 'confirmation', label: 'Confirmation', num: 3 },
  ];

  const PAYMENT_METHODS: { id: PaymentMethod; label: string; icon: string; desc: string; badge?: string }[] = [
    { id: 'card', label: 'Carte bancaire (Stripe)', icon: '💳', desc: 'Visa, Mastercard, Amex — paiement sécurisé Stripe', badge: 'Recommandé' },
    { id: 'paypal', label: 'PayPal', icon: '🅿️', desc: 'Paiement sécurisé PayPal' },
    { id: 'apple_pay', label: 'Apple Pay', icon: '🍎', desc: 'Paiement rapide Apple' },
    { id: 'google_pay', label: 'Google Pay', icon: '🔵', desc: 'Paiement rapide Google' },
    { id: 'virement', label: 'Virement bancaire', icon: '🏦', desc: 'Délai 2–3 jours ouvrés' },
  ];

  if (!mounted) {
    return (
      <div className="min-h-screen bg-[#F5F2EC]">
        <Header />
        <div className="pt-24 flex items-center justify-center min-h-[60vh]">
          <div className="w-8 h-8 border-2 border-[#17402C] border-t-transparent rounded-full animate-spin" />
        </div>
        <Footer />
      </div>
    );
  }

  return (
    <>
      {/* ── DESKTOP VIEW (fullscreen : page = 100dvh, scroll interne) ── */}
      <div className="hidden md:flex flex-col h-[100dvh] overflow-hidden bg-[#FAF8F5] text-[#17402C]">
        <Header />

        <main id="main-content" className="flex-1 min-h-0 overflow-y-auto w-full pt-24 pb-6">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 w-full">
            {step !== 'confirmation' && (
              <h1 className="font-display font-800 text-4xl text-[#17402C] mb-8">
                Presque <em className="italic font-400 text-[#365233]">parti.</em>
              </h1>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Main content */}
              <div className="lg:col-span-7 xl:col-span-8">

                {step !== 'confirmation' ? (
                  <div className="space-y-6">

                    {/* ── STEP 1: Vos coordonnées ── */}
                    <div className={`glass p-8 transition-opacity ${step !== 'livraison' ? 'opacity-50 pointer-events-none' : ''}`}>
                      <div className="flex items-center justify-between mb-6">
                        <h2 className="font-display font-700 text-xl flex items-center gap-3 text-[#17402C]">
                          <span className="font-400 italic text-[#365233]">01</span> Vos coordonnées
                        </h2>
                        <button className="text-xs font-600 text-[#17402C] hover:underline">Se connecter</button>
                      </div>

                      <div className="space-y-4">
                        <div>
                          <label className="block text-[10px] font-semibold uppercase tracking-wider text-[#5A7064] mb-1.5">Email</label>
                          <input
                            type="email"
                            autoComplete="email"
                            value={shipping.email}
                            onChange={(e) => setShipping(prev => ({ ...prev, email: e.target.value }))}
                            className={`glass-input w-full ${errors.email ? 'ring-1 ring-[#A8443A]' : ''}`}
                          />
                        </div>
                        <label className="flex items-center gap-3 cursor-pointer mt-2">
                          <div className="glass-check-circle checked">
                            <Icon name="CheckIcon" size={10} />
                          </div>
                          <span className="text-xs text-[#17402C]">Recevoir le journal du Kit — un envoi par saison, refuges et sentiers uniquement.</span>
                        </label>
                      </div>
                    </div>

                    {/* ── STEP 2: Livraison ── */}
                    <div className={`glass p-8 transition-opacity ${step !== 'livraison' ? 'opacity-50 pointer-events-none' : ''}`}>
                      <h2 className="font-display font-700 text-xl flex items-center gap-3 mb-6 text-[#17402C]">
                        <span className="font-400 italic text-[#365233]">02</span> Livraison
                      </h2>

                      <div className="grid grid-cols-2 gap-4 mb-8">
                        <div>
                          <label className="block text-[10px] font-semibold uppercase tracking-wider text-[#5A7064] mb-1.5">Prénom</label>
                          <input
                            type="text"
                            autoComplete="given-name"
                            value={shipping.prenom}
                            onChange={(e) => setShipping(prev => ({ ...prev, prenom: e.target.value }))}
                            className={`glass-input w-full ${errors.prenom ? 'ring-1 ring-[#A8443A]' : ''}`}
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-semibold uppercase tracking-wider text-[#5A7064] mb-1.5">Nom</label>
                          <input
                            type="text"
                            autoComplete="family-name"
                            value={shipping.nom}
                            onChange={(e) => setShipping(prev => ({ ...prev, nom: e.target.value }))}
                            className={`glass-input w-full ${errors.nom ? 'ring-1 ring-[#A8443A]' : ''}`}
                          />
                        </div>
                        <div className="col-span-2">
                          <label className="block text-[10px] font-semibold uppercase tracking-wider text-[#5A7064] mb-1.5">Adresse</label>
                          <input
                            type="text"
                            autoComplete="street-address"
                            value={shipping.adresse}
                            onChange={(e) => setShipping(prev => ({ ...prev, adresse: e.target.value }))}
                            className={`glass-input w-full ${errors.adresse ? 'ring-1 ring-[#A8443A]' : ''}`}
                          />
                        </div>
                        <div className="col-span-2">
                          <label className="block text-[10px] font-semibold uppercase tracking-wider text-[#5A7064] mb-1.5">Complément (Optionnel)</label>
                          <input
                            type="text"
                            autoComplete="address-line2"
                            value={shipping.complement}
                            onChange={(e) => setShipping(prev => ({ ...prev, complement: e.target.value }))}
                            placeholder="Bâtiment - étage - digicode"
                            className="glass-input w-full"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-semibold uppercase tracking-wider text-[#5A7064] mb-1.5">Code postal</label>
                          <input
                            type="text"
                            autoComplete="postal-code"
                            inputMode="numeric"
                            value={shipping.codePostal}
                            onChange={(e) => setShipping(prev => ({ ...prev, codePostal: e.target.value }))}
                            className={`glass-input w-full ${errors.codePostal ? 'ring-1 ring-[#A8443A]' : ''}`}
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-semibold uppercase tracking-wider text-[#5A7064] mb-1.5">Ville</label>
                          <input
                            type="text"
                            autoComplete="address-level2"
                            value={shipping.ville}
                            onChange={(e) => setShipping(prev => ({ ...prev, ville: e.target.value }))}
                            className={`glass-input w-full ${errors.ville ? 'ring-1 ring-[#A8443A]' : ''}`}
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-semibold uppercase tracking-wider text-[#5A7064] mb-1.5">Pays</label>
                          <select autoComplete="country" className="glass-input w-full appearance-none">
                            <option>France</option>
                            <option>Belgique</option>
                            <option>Suisse</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-[10px] font-semibold uppercase tracking-wider text-[#5A7064] mb-1.5">Téléphone</label>
                          <input
                            type="tel"
                            autoComplete="tel"
                            value={shipping.telephone}
                            onChange={(e) => setShipping(prev => ({ ...prev, telephone: e.target.value }))}
                            placeholder="+33 6 12 34 56 78"
                            className="glass-input w-full"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-[10px] font-semibold uppercase tracking-wider text-[#5A7064] mb-3">Mode d'expédition</label>
                        <div className="space-y-3">
                          {[
                            { id: 'standard', label: 'Livraison suivie', desc: 'Colis relais ou domicile - 3 à 5 jours ouvrés - CO2 compensé', price: totalPriceEur >= 99 ? 'Offerte' : '5,90 €' },
                            { id: 'express', label: 'Express 48h', desc: 'Livré à domicile en 48 h - sur créneau choisi', price: '14 €' },
                            { id: 'relay', label: 'Retrait en atelier', desc: 'Manosque, Alpes-de-Haute-Provence - disponible dès demain', price: 'Offerte' },
                          ].map((opt) => (
                            <label key={opt.id} className="glass p-4 flex items-center justify-between rounded-[16px] cursor-pointer transition-all" style={shippingOption === opt.id ? { borderColor: 'rgba(91,127,85,0.85)' } : undefined}>
                              <div className="flex items-center gap-4">
                                <div className={`w-4 h-4 rounded-full border flex items-center justify-center flex-shrink-0 ${shippingOption === opt.id ? 'border-[#17402C]' : 'border-[#365233]'}`}>
                                  {shippingOption === opt.id && <div className="w-2 h-2 bg-[#17402C] rounded-full" />}
                                </div>
                                <div>
                                  <p className="font-600 text-sm text-[#17402C]">{opt.label}</p>
                                  <p className="text-[10px] text-[#5A7064] mt-0.5">{opt.desc}</p>
                                </div>
                              </div>
                              <span className={`font-bold font-mono text-sm ${opt.price === 'Offerte' ? 'text-[#17402C]' : 'text-[#17402C]'}`}>{opt.price}</span>
                            </label>
                          ))}
                        </div>
                      </div>

                      {step === 'livraison' && (
                        <LkvButton onClick={handleShippingSubmit} variant="primary" size="lg" fullWidth className="mt-8">
                          Continuer vers le paiement →
                        </LkvButton>
                      )}
                    </div>

                    {/* ── STEP 3: Paiement ── */}
                    <div className={`glass p-8 transition-opacity ${step !== 'paiement' ? 'opacity-50 pointer-events-none' : ''}`}>
                      <h2 className="font-display font-700 text-xl flex items-center gap-3 mb-6 text-[#17402C]">
                        <span className="font-400 italic text-[#365233]">03</span> Paiement
                      </h2>

                      {step === 'paiement' && (
                        <>
                          {error && (
                            <div className="mb-8 p-4 rounded-[16px] bg-[#F5DDD9] border border-[#A8443A]/30 text-[#8A241B] text-sm leading-relaxed">
                              {error}
                            </div>
                          )}
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-8">
                            <button className="glass p-3 flex flex-col items-center justify-center rounded-[16px] text-[#17402C]" style={{ borderColor: 'rgba(91,127,85,0.85)' }}>
                              <Icon name="CreditCardIcon" size={24} className="mb-1" />
                              <span className="text-[10px] font-600 font-mono tracking-widest uppercase">Carte</span>
                            </button>
                            <button className="glass p-3 flex flex-col items-center justify-center rounded-[16px] text-[#5A7064] hover:text-[#17402C]">
                              <span className="text-xl mb-1">🍎</span>
                              <span className="text-[10px] font-600 font-mono tracking-widest uppercase">Apple Pay</span>
                            </button>
                            <button className="glass p-3 flex flex-col items-center justify-center rounded-[16px] text-[#5A7064] hover:text-[#17402C]">
                              <span className="text-xl mb-1 text-[#4B6B7C] font-bold">P</span>
                              <span className="text-[10px] font-600 font-mono tracking-widest uppercase">Compte</span>
                            </button>
                            <button className="glass p-3 flex flex-col items-center justify-center rounded-[16px] text-[#8C6418] hover:text-[#17402C]">
                              <span className="text-xs font-700 italic mb-1">3× sans frais</span>
                              <span className="text-[10px] font-600 font-mono tracking-widest uppercase">Alma</span>
                            </button>
                          </div>

                          <div className="flex justify-center mb-8">
                            {/* Fake Credit Card visual */}
                            <div className="w-full max-w-[320px] aspect-[1.586] bg-gradient-to-br from-[#17402C] to-[#365233] rounded-2xl p-6 text-white relative overflow-hidden">
                              <div className="absolute right-[-20px] top-[-20px] w-40 h-40 bg-white/5 rounded-full blur-2xl pointer-events-none" />
                              <div className="w-12 h-8 bg-[#F1EDE6] rounded bg-gradient-to-br from-[#F1EDE6] to-[#D2CABC] mb-8" />
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
                              <label className="block text-[10px] font-semibold uppercase tracking-wider text-[#5A7064] mb-1.5">Numéro de carte</label>
                              <input type="text" autoComplete="cc-number" inputMode="numeric" placeholder="1234 1234 1234 1234" className="glass-input w-full font-mono" />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                              <div>
                                <label className="block text-[10px] font-semibold uppercase tracking-wider text-[#5A7064] mb-1.5">Expiration</label>
                                <input type="text" autoComplete="cc-exp" placeholder="MM / AA" className="glass-input w-full font-mono" />
                              </div>
                              <div>
                                <label className="block text-[10px] font-semibold uppercase tracking-wider text-[#5A7064] mb-1.5">Cryptogramme</label>
                                <input type="text" autoComplete="cc-csc" inputMode="numeric" placeholder="CVC" className="glass-input w-full font-mono" />
                              </div>
                            </div>
                            <div>
                              <label className="block text-[10px] font-semibold uppercase tracking-wider text-[#5A7064] mb-1.5">Nom du titulaire</label>
                              <input type="text" autoComplete="cc-name" placeholder="Comme écrit sur la carte" className="glass-input w-full uppercase" />
                            </div>

                            <label className="flex items-center gap-3 cursor-pointer mt-4 mb-6">
                              <div className="glass-check-circle checked">
                                <Icon name="CheckIcon" size={10} />
                              </div>
                              <span className="text-xs text-[#5A7064]">Enregistrer cette carte pour un futur achat (chiffrée par Stripe).</span>
                            </label>
                          </div>

                          <LkvButton
                            onClick={handleStripeCheckout}
                            disabled={processing}
                            loading={processing}
                            variant="primary"
                            size="lg"
                            fullWidth
                          >
                            Payer {grandTotal.toFixed(2)} €
                          </LkvButton>
                        </>
                      )}
                    </div>

                  </div>
                ) : (
                  /* ── STEP 3: Confirmation ── */
                  <div className="glass p-12 text-center h-full flex flex-col items-center justify-center min-h-[420px]">
                    <div className="w-20 h-20 glass rounded-full flex items-center justify-center mb-6">
                      <Icon name="CheckIcon" size={32} className="text-[#17402C]" />
                    </div>
                    <h2 className="font-display font-800 text-3xl text-[#17402C] mb-4">Commande confirmée.</h2>
                    <p className="text-[#5A7064] mb-2">
                      {orderNumber ? (
                        <>Numéro de commande : <span className="font-mono font-600 text-[#17402C]">{orderNumber}</span></>
                      ) : (
                        'Votre numéro de commande vous sera envoyé par email.'
                      )}
                    </p>
                    <p className="text-sm text-[#5A7064] mb-8 max-w-sm mx-auto leading-relaxed">
                      Merci ! Un email de confirmation vous a été envoyé. Préparez-vous pour l'aventure.
                    </p>
                    <Link href="/explorer" className="glass-capsule-btn">
                      Voir les aventures
                    </Link>
                  </div>
                )}
              </div>

              {/* Order summary sidebar */}
              <div className="lg:col-span-5 xl:col-span-4">
                <div className="glass p-8">
                  <h3 className="font-display font-700 text-lg text-[#17402C] mb-6">Votre commande</h3>
                  <div className="space-y-4 mb-6">
                    {items.map((item) => (
                      <div key={item.slug} className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-white/40 rounded-xl flex-shrink-0 overflow-hidden border border-white/60">
                          {item.image ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={item.image} alt={item.name} className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center bg-white/40">
                              <Icon name="PhotoIcon" size={16} className="text-[#5A7064]/40" />
                            </div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-600 text-[#17402C] truncate pr-2">{item.name}</p>
                          <p className="text-[10px] text-[#5A7064] mt-0.5">Quantité : {item.quantity}</p>
                        </div>
                        <p className="text-xs font-bold font-mono whitespace-nowrap text-[#17402C]">{(item.priceEur * item.quantity).toFixed(2)} €</p>
                      </div>
                    ))}
                  </div>

                  <div className="border-t border-white/50 pt-5 space-y-2 mb-5">
                    <div className="flex justify-between text-xs">
                      <span className="text-[#5A7064]">Sous-total</span>
                      <span className="font-mono font-bold text-[#17402C]">{totalPriceEur.toFixed(2)} €</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-[#5A7064]">Livraison suivie</span>
                      <span className="font-mono font-bold text-[#17402C]">{shippingEur === 0 ? 'Offerte' : `${shippingEur.toFixed(2)} €`}</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-[#5A7064]">TVA (20 %, incluse)</span>
                      <span className="font-mono font-bold text-[#17402C]">{(totalPriceEur * 0.2).toFixed(2)} €</span>
                    </div>
                  </div>

                  <div className="flex justify-between items-end font-display font-800 text-2xl pt-5 border-t border-white/50">
                    <span className="text-lg text-[#17402C]">Total</span>
                    <span className="font-mono font-bold text-[#17402C]">{grandTotal.toFixed(2)} €</span>
                  </div>

                  {step === 'livraison' && (
                    <button onClick={handleShippingSubmit} className="glass-capsule-btn w-full mt-6">
                      Payer {grandTotal.toFixed(2)} € par carte
                    </button>
                  )}
                  {step === 'paiement' && (
                    <button onClick={handleStripeCheckout} disabled={processing} className="glass-capsule-btn w-full mt-6">
                      {processing ? 'Traitement...' : `Payer ${grandTotal.toFixed(2)} € par carte`}
                    </button>
                  )}

                  <p className="text-center text-[10px] text-[#5A7064] mt-4 max-w-[250px] mx-auto leading-relaxed">
                    En passant commande, vous acceptez les <a href="#" className="underline">CGV</a> et notre <a href="#" className="underline">politique de retour</a>. Vous ne serez débité qu'à l'expédition.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </main>

        <Footer />
      </div>

      {/* ── MOBILE VIEW (scroll natif) ── */}
      <div className="block md:hidden">
        <MobilePageShell background="#FAF8F5">
          <div style={{ padding: '12px 16px 20px' }}>
            <div style={{ display: 'flex', gap: '6px', marginBottom: '16px' }}>
              {[0,1,2,3].map(i => (
                <div key={i} style={{ flex: 1, height: '3px', borderRadius: '999px', background: i < 2 ? '#A6C1A0' : i === 2 ? '#17402C' : 'rgba(23,64,44,0.08)' }} />
              ))}
            </div>
            <div style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.14em', color: '#5A7064' }}>Étape 3 · 4 · Paiement</div>
            <h1 style={{ fontSize: '26px', letterSpacing: '-0.025em', margin: 0, color: '#17402C' }}>
              Un dernier <em style={{ fontFamily: 'Georgia, serif', fontStyle: 'italic', color: '#17402C', fontWeight: 400 }}>geste.</em>
            </h1>
          </div>

          <div className="glass" style={{ margin: '0 16px 12px', padding: '14px', borderRadius: '14px', boxShadow: 'none' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: '#FAF8F5', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#17402C" strokeWidth="1.5"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '13px', fontWeight: 500, color: '#17402C' }}>{shipping.prenom || 'Mathieu'} {shipping.nom || 'Chevrier'}</div>
                <div style={{ fontSize: '11px', color: '#5A7064' }}>{shipping.adresse || '42 Rue de la République'} · {shipping.codePostal || '38000'} {shipping.ville || 'Grenoble'}</div>
              </div>
              <div className="glass-pill" style={{ fontSize: '9px', fontWeight: 600, padding: '2px 8px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Maison</div>
            </div>
          </div>

          <div className="glass" style={{ margin: '0 16px 12px', padding: '14px', borderRadius: '14px', boxShadow: 'none' }}>
            <div style={{ fontSize: '11px', fontWeight: 500, color: '#17402C', marginBottom: '10px' }}>Mode d'expédition</div>
            {[{ id: 'standard', label: 'Livraison suivie', price: 'Offerte', desc: '3-5 jours ouvrés' }, { id: 'express', label: 'Express 48h', price: '9,90 €', desc: 'Livré à domicile' }].map(opt => (
              <label key={opt.id} onClick={() => setShippingOption(opt.id)} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 0', borderTop: '1px solid rgba(23,64,44,0.08)', cursor: 'pointer' }}>
                <div style={{ width: '18px', height: '18px', borderRadius: '999px', border: '1.5px solid', borderColor: shippingOption === opt.id ? '#17402C' : '#A6C1A0', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  {shippingOption === opt.id && <div style={{ width: '10px', height: '10px', borderRadius: '999px', background: '#17402C' }} />}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '13px', fontWeight: 500, color: '#17402C' }}>{opt.label}</div>
                  <div style={{ fontSize: '10px', color: '#5A7064' }}>{opt.desc}</div>
                </div>
                <div style={{ fontSize: '13px', fontWeight: 700, fontFamily: 'ui-monospace, monospace', color: '#17402C' }}>{opt.price}</div>
              </label>
            ))}
          </div>

          <div className="glass" style={{ margin: '0 16px 12px', padding: '14px', borderRadius: '14px', boxShadow: 'none' }}>
            <div style={{ fontSize: '11px', fontWeight: 500, color: '#17402C', marginBottom: '10px' }}>Moyen de paiement</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
              {['Carte', 'Apple Pay', 'PayPal', "3× sans frais"].map(m => (
                <button key={m} style={{ padding: '10px', borderRadius: '10px', background: '#FAF8F5', border: 'none', fontSize: '11px', fontWeight: 500, color: '#17402C', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'center' }}>
                  {m}
                </button>
              ))}
            </div>
          </div>

          {error && (
            <div style={{ margin: '0 16px 12px', padding: '12px 14px', background: '#F5DDD9', border: '1px solid rgba(168,68,58,0.4)', borderRadius: '12px', color: '#8A241B', fontSize: '12px', lineHeight: 1.5 }}>
              {error}
            </div>
          )}

          <div className="glass" style={{ margin: '12px 16px', padding: '16px', borderRadius: '16px', boxShadow: 'none' }}>
            <div style={{ fontSize: '11px', fontWeight: 500, marginBottom: '12px', opacity: 0.8, color: '#17402C' }}>Récapitulatif</div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '12px', opacity: 0.7 }}>
              <span style={{ color: '#5A7064' }}>Sous-total</span>
              <span style={{ fontWeight: 700, fontFamily: 'ui-monospace, monospace', color: '#17402C' }}>{totalPriceEur.toFixed(0)} €</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px', fontSize: '12px', opacity: 0.7 }}>
              <span style={{ color: '#5A7064' }}>Livraison</span>
              <span style={{ fontWeight: 700, fontFamily: 'ui-monospace, monospace', color: '#17402C' }}>{shippingEur === 0 ? 'Offerte' : `${shippingEur.toFixed(2)} €`}</span>
            </div>
            <div style={{ height: '1px', background: 'rgba(255,255,255,0.35)', margin: '12px 0' }} />
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '14px' }}>
              <span style={{ fontSize: '15px', fontWeight: 700, color: '#17402C' }}>Total</span>
              <span style={{ fontSize: '15px', fontWeight: 700, fontFamily: 'ui-monospace, monospace', color: '#17402C' }}>{grandTotal.toFixed(0)} €</span>
            </div>
            <button onClick={handleStripeCheckout} disabled={processing} className="glass-capsule-btn w-full" style={{ cursor: processing ? 'not-allowed' : 'pointer', fontFamily: 'inherit' }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="1" y="11" width="22" height="10" rx="2"/><path d="M6 11V7a6 6 0 0 1 12 0v4"/></svg>
              Payer {grandTotal.toFixed(0)} €
            </button>
          </div>
        </MobilePageShell>
      </div>
    </>
  );
}
