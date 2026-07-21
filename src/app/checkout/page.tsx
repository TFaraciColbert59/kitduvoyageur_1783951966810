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
  const [stripeConfigured, setStripeConfigured] = useState(false);

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
    } catch {
      setProcessing(false);
    }
  };

  const handleVirementSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setProcessing(true);
    try {
      await saveOrderToSupabase('virement');
      const num = `KDV-2026-${Math.floor(Math.random() * 9000 + 1000)}`;
      setOrderNumber(num);
      setStep('confirmation');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch {
      // silent
    } finally {
      setProcessing(false);
    }
  };

  const saveOrderToSupabase = async (method: string) => {
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
          payment_method: method,
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

      // Decrement stock
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
              notes: `Importé automatiquement depuis la commande ${num}`,
              acquired_at: new Date().toISOString().split('T')[0],
            });
          }
        } catch {
          // Best-effort
        }
      }
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
    { id: 'card', label: 'Carte bancaire (Stripe)', icon: '💳', desc: 'Visa, Mastercard, Amex — paiement sécurisé Stripe', badge: 'Recommandé' },
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
                  <span className={`text-xs font-medium ${step === s.id ? 'text-white' : 'text-white/40'}`}>{s.label}</span>
                </div>
                {i < steps.length - 1 && <div className="flex-1 h-px bg-white/10 mx-3" />}
              </React.Fragment>
            ))}
          </div>
        </div>
      </section>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main content */}
          <div className="lg:col-span-2">

            {/* ── STEP 1: Livraison ── */}
            {step === 'livraison' && (
              <form onSubmit={handleShippingSubmit} className="space-y-6">
                <div className="bg-card border border-border rounded-2xl p-6">
                  <h2 className="font-semibold text-lg mb-5 flex items-center gap-2">
                    <Icon name="TruckIcon" size={18} variant="outline" className="text-primary" />
                    Adresse de livraison
                  </h2>
                  <div className="grid grid-cols-2 gap-4">
                    {[
                      { key: 'prenom', label: 'Prénom', col: 1 },
                      { key: 'nom', label: 'Nom', col: 1 },
                      { key: 'email', label: 'Email', col: 2 },
                      { key: 'telephone', label: 'Téléphone', col: 2 },
                    ].map(({ key, label, col }) => (
                      <div key={key} className={col === 2 ? 'col-span-2' : ''}>
                        <label className="block text-sm font-medium mb-1.5">{label}</label>
                        <input
                          type={key === 'email' ? 'email' : 'text'}
                          value={(shipping as Record<string, string>)[key]}
                          onChange={(e) => setShipping(prev => ({ ...prev, [key]: e.target.value }))}
                          className={`w-full px-3 py-2.5 rounded-xl border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 ${errors[key] ? 'border-red-500' : 'border-border'}`}
                        />
                        {errors[key] && <p className="text-red-500 text-xs mt-1">{errors[key]}</p>}
                      </div>
                    ))}
                    <div className="col-span-2">
                      <label className="block text-sm font-medium mb-1.5">Adresse</label>
                      <input
                        type="text"
                        value={shipping.adresse}
                        onChange={(e) => setShipping(prev => ({ ...prev, adresse: e.target.value }))}
                        className={`w-full px-3 py-2.5 rounded-xl border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 ${errors.adresse ? 'border-red-500' : 'border-border'}`}
                      />
                      {errors.adresse && <p className="text-red-500 text-xs mt-1">{errors.adresse}</p>}
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1.5">Code postal</label>
                      <input
                        type="text"
                        value={shipping.codePostal}
                        onChange={(e) => setShipping(prev => ({ ...prev, codePostal: e.target.value }))}
                        className={`w-full px-3 py-2.5 rounded-xl border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 ${errors.codePostal ? 'border-red-500' : 'border-border'}`}
                      />
                      {errors.codePostal && <p className="text-red-500 text-xs mt-1">{errors.codePostal}</p>}
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1.5">Ville</label>
                      <input
                        type="text"
                        value={shipping.ville}
                        onChange={(e) => setShipping(prev => ({ ...prev, ville: e.target.value }))}
                        className={`w-full px-3 py-2.5 rounded-xl border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 ${errors.ville ? 'border-red-500' : 'border-border'}`}
                      />
                      {errors.ville && <p className="text-red-500 text-xs mt-1">{errors.ville}</p>}
                    </div>
                  </div>
                </div>

                {/* Shipping options */}
                <div className="bg-card border border-border rounded-2xl p-6">
                  <h2 className="font-semibold text-lg mb-4 flex items-center gap-2">
                    <Icon name="TruckIcon" size={18} variant="outline" className="text-primary" />
                    Mode de livraison
                  </h2>
                  <div className="space-y-3">
                    {[
                      { id: 'standard', label: 'Livraison standard', delay: '3–5 jours', price: totalPriceEur >= 99 ? 'Gratuit' : '5,90 €' },
                      { id: 'express', label: 'Livraison express', delay: '1–2 jours', price: '9,90 €' },
                      { id: 'relay', label: 'Point relais', delay: '2–4 jours', price: '3,90 €' },
                    ].map((opt) => (
                      <label key={opt.id} className={`flex items-center justify-between p-4 rounded-xl border cursor-pointer transition-all ${shippingOption === opt.id ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/40'}`}>
                        <div className="flex items-center gap-3">
                          <input type="radio" name="shipping" value={opt.id} checked={shippingOption === opt.id} onChange={() => setShippingOption(opt.id)} className="text-primary" />
                          <div>
                            <p className="font-medium text-sm">{opt.label}</p>
                            <p className="text-xs text-muted-foreground">{opt.delay}</p>
                          </div>
                        </div>
                        <span className="font-semibold text-sm">{opt.price}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <button type="submit" className="w-full bg-primary hover:bg-primary/90 text-white py-4 rounded-xl font-semibold flex items-center justify-center gap-2 transition-all">
                  Continuer vers le paiement
                  <Icon name="ArrowRightIcon" size={16} variant="outline" />
                </button>
              </form>
            )}

            {/* ── STEP 2: Paiement ── */}
            {step === 'paiement' && (
              <div className="space-y-6">
                <div className="bg-card border border-border rounded-2xl p-6">
                  <h2 className="font-semibold text-lg mb-5 flex items-center gap-2">
                    <Icon name="LockClosedIcon" size={18} variant="outline" className="text-primary" />
                    Mode de paiement
                  </h2>

                  <div className="space-y-3 mb-6">
                    {PAYMENT_METHODS.map((pm) => (
                      <label key={pm.id} className={`flex items-center gap-3 p-4 rounded-xl border cursor-pointer transition-all ${paymentMethod === pm.id ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/40'}`}>
                        <input type="radio" name="payment" value={pm.id} checked={paymentMethod === pm.id} onChange={() => setPaymentMethod(pm.id)} className="text-primary" />
                        <span className="text-xl">{pm.icon}</span>
                        <div className="flex-1">
                          <p className="font-medium text-sm">{pm.label}</p>
                          <p className="text-xs text-muted-foreground">{pm.desc}</p>
                        </div>
                        {pm.badge && <span className="text-[10px] font-mono bg-primary/10 text-primary px-2 py-0.5 rounded-full">{pm.badge}</span>}
                      </label>
                    ))}
                  </div>

                  {/* Card payment — redirect to Stripe */}
                  {paymentMethod === 'card' && (
                    <div className="space-y-4">
                      {stripeConfigured ? (
                        <div className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-xl p-4">
                          <div className="flex items-start gap-3">
                            <Icon name="ShieldCheckIcon" size={18} variant="outline" className="text-emerald-600 mt-0.5 flex-shrink-0" />
                            <div>
                              <p className="font-semibold text-sm text-emerald-700 dark:text-emerald-400">Paiement 100 % sécurisé via Stripe</p>
                              <p className="text-xs text-emerald-600/80 dark:text-emerald-500 mt-1">
                                Vos données bancaires sont saisies directement sur les serveurs de Stripe, certifiés PCI-DSS niveau 1.
                                Aucune donnée de carte ne transite par nos serveurs.
                              </p>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-4">
                          <div className="flex items-start gap-3">
                            <Icon name="ExclamationTriangleIcon" size={18} variant="outline" className="text-amber-600 mt-0.5 flex-shrink-0" />
                            <div>
                              <p className="font-semibold text-sm text-amber-700 dark:text-amber-400">Paiement par carte temporairement indisponible</p>
                              <p className="text-xs text-amber-600/80 dark:text-amber-500 mt-1">
                                L&apos;intégration Stripe est en cours de configuration. Veuillez utiliser le virement bancaire ou réessayer ultérieurement.
                              </p>
                            </div>
                          </div>
                        </div>
                      )}

                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        <Icon name="LockClosedIcon" size={12} variant="outline" />
                        <span>Connexion SSL 256-bit · Certifié PCI-DSS · Aucune donnée bancaire stockée</span>
                      </div>

                      <button
                        onClick={handleStripeCheckout}
                        disabled={processing || !stripeConfigured}
                        className="w-full bg-primary hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed text-white py-4 rounded-xl font-semibold flex items-center justify-center gap-2 transition-all"
                      >
                        {processing ? (
                          <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Redirection vers Stripe…</>
                        ) : (
                          <><Icon name="LockClosedIcon" size={16} variant="outline" /> Payer {grandTotal.toFixed(2)} € en sécurité</>
                        )}
                      </button>
                    </div>
                  )}

                  {/* Virement */}
                  {paymentMethod === 'virement' && (
                    <form onSubmit={handleVirementSubmit} className="space-y-4">
                      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-4 text-sm">
                        <p className="font-semibold text-blue-700 dark:text-blue-400 mb-2">Coordonnées bancaires</p>
                        <div className="space-y-1 text-blue-600/80 dark:text-blue-500 font-mono text-xs">
                          <p>IBAN : FR76 XXXX XXXX XXXX XXXX XXXX XXX</p>
                          <p>BIC : XXXXXXXX</p>
                          <p>Référence : votre email</p>
                        </div>
                        <p className="text-xs text-blue-600/60 dark:text-blue-600 mt-2">La commande sera traitée à réception du virement (2–3 jours ouvrés).</p>
                      </div>
                      <button
                        type="submit"
                        disabled={processing}
                        className="w-full bg-primary hover:bg-primary/90 disabled:opacity-50 text-white py-4 rounded-xl font-semibold flex items-center justify-center gap-2 transition-all"
                      >
                        {processing ? (
                          <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Traitement…</>
                        ) : (
                          <>Confirmer la commande par virement</>
                        )}
                      </button>
                    </form>
                  )}

                  {/* Other methods */}
                  {(paymentMethod === 'paypal' || paymentMethod === 'apple_pay' || paymentMethod === 'google_pay') && (
                    <div className="bg-muted/50 rounded-xl p-4 text-center">
                      <p className="text-sm text-muted-foreground">
                        Ce mode de paiement sera disponible prochainement. Veuillez utiliser la carte bancaire ou le virement.
                      </p>
                    </div>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => setStep('livraison')}
                  className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  <Icon name="ArrowLeftIcon" size={14} variant="outline" />
                  Modifier la livraison
                </button>
              </div>
            )}

            {/* ── STEP 3: Confirmation ── */}
            {step === 'confirmation' && (
              <div className="bg-card border border-border rounded-2xl p-8 text-center">
                <div className="w-16 h-16 bg-emerald-100 dark:bg-emerald-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Icon name="CheckCircleIcon" size={32} variant="outline" className="text-emerald-500" />
                </div>
                <h2 className="font-display font-800 text-2xl mb-2" style={{ fontFamily: 'var(--font-display)', fontWeight: 800 }}>Commande confirmée !</h2>
                <p className="text-muted-foreground mb-2">Numéro de commande : <span className="font-mono font-semibold text-foreground">{orderNumber}</span></p>
                <p className="text-sm text-muted-foreground mb-6">Un email de confirmation vous a été envoyé. Votre inventaire a été mis à jour automatiquement.</p>
                <div className="flex flex-col sm:flex-row gap-3 justify-center">
                  <Link href="/inventaire" className="inline-flex items-center gap-2 bg-primary text-white px-6 py-3 rounded-xl font-semibold text-sm hover:bg-primary/90 transition-all">
                    <Icon name="ArchiveBoxIcon" size={16} variant="outline" />
                    Voir mon inventaire
                  </Link>
                  <Link href="/shop" className="inline-flex items-center gap-2 border border-border px-6 py-3 rounded-xl font-medium text-sm hover:bg-accent transition-all">
                    Continuer mes achats
                  </Link>
                </div>
              </div>
            )}
          </div>

          {/* Order summary sidebar */}
          {step !== 'confirmation' && (
            <div className="lg:col-span-1">
              <div className="bg-card border border-border rounded-2xl p-5 sticky top-24">
                <h3 className="font-semibold mb-4">Récapitulatif</h3>
                <div className="space-y-3 mb-4">
                  {items.map((item) => (
                    <div key={item.slug} className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-muted rounded-lg flex-shrink-0 overflow-hidden">
                        {item.image && (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={item.image} alt={item.name} className="w-full h-full object-cover" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium truncate">{item.name}</p>
                        <p className="text-xs text-muted-foreground">×{item.quantity}</p>
                      </div>
                      <p className="text-xs font-semibold">{(item.priceEur * item.quantity).toFixed(2)} €</p>
                    </div>
                  ))}
                </div>
                <div className="border-t border-border pt-4 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Sous-total</span>
                    <span>{totalPriceEur.toFixed(2)} €</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Livraison</span>
                    <span>{shippingEur === 0 ? 'Gratuit' : `${shippingEur.toFixed(2)} €`}</span>
                  </div>
                  <div className="flex justify-between font-semibold text-base pt-2 border-t border-border">
                    <span>Total</span>
                    <span>{grandTotal.toFixed(2)} €</span>
                  </div>
                </div>
                <div className="mt-4 flex items-center gap-2 text-xs text-muted-foreground">
                  <Icon name="ShieldCheckIcon" size={12} variant="outline" className="text-emerald-500" />
                  Paiement 100 % sécurisé
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <Footer />
    </div>
  );
}
