'use client';

import React, { useState } from 'react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import Icon from '@/components/ui/AppIcon';


interface ProPlan {
  id: string;
  name: string;
  price: number;
  period: string;
  description: string;
  features: string[];
  highlighted: boolean;
  badge?: string;
}

interface BulkProduct {
  id: string;
  name: string;
  category: string;
  unitPrice: number;
  proPrice: number;
  minQty: number;
  stock: number;
  image: string;
  alt: string;
}

const PRO_PLANS: ProPlan[] = [
{
  id: 'guide',
  name: 'Guide Indépendant',
  price: 29,
  period: 'mois',
  description: 'Pour les guides de montagne et accompagnateurs indépendants',
  features: [
  'Tarifs pro -15% sur tout le catalogue',
  'Commandes groupées jusqu\'à 10 personnes',
  'Accès aux kits guides certifiés',
  'Facturation professionnelle',
  'Support prioritaire',
  'Badge "Guide Certifié" sur profil'],

  highlighted: false
},
{
  id: 'agence',
  name: 'Agence & Opérateur',
  price: 89,
  period: 'mois',
  description: 'Pour les agences de voyage aventure et opérateurs de trek',
  features: [
  'Tarifs pro -25% sur tout le catalogue',
  'Commandes groupées illimitées',
  'Gestionnaire de compte dédié',
  'Facturation mensuelle consolidée',
  'API d\'intégration catalogue',
  'Personnalisation des kits clients',
  'Tableau de bord équipes',
  'Formation produit incluse'],

  highlighted: true,
  badge: 'Populaire'
},
{
  id: 'revendeur',
  name: 'Revendeur B2B',
  price: 149,
  period: 'mois',
  description: 'Pour les boutiques outdoor et revendeurs professionnels',
  features: [
  'Tarifs grossiste -35% sur tout le catalogue',
  'Accès au catalogue wholesale',
  'Dropshipping disponible',
  'Marges configurables',
  'Catalogue white-label',
  'Intégration ERP/WMS',
  'Conditions de paiement 30 jours',
  'Responsable commercial dédié'],

  highlighted: false
}];


const BULK_PRODUCTS: BulkProduct[] = [
{
  id: 'bp1',
  name: 'Sac à dos Osprey Atmos 65 — Pack groupe',
  category: 'Sacs à dos',
  unitPrice: 349,
  proPrice: 262,
  minQty: 5,
  stock: 48,
  image: "https://img.rocket.new/generatedImages/rocket_gen_img_1de5a8766-1772222096368.png",
  alt: 'Sac à dos de randonnée Osprey vert posé sur rocher en montagne'
},
{
  id: 'bp2',
  name: 'Tente MSR Hubba Hubba NX 2P — Pack',
  category: 'Tentes',
  unitPrice: 599,
  proPrice: 449,
  minQty: 3,
  stock: 22,
  image: "https://img.rocket.new/generatedImages/rocket_gen_img_10c4b4fa4-1783676147611.png",
  alt: 'Tente MSR Hubba Hubba montée dans un paysage alpin au coucher du soleil'
},
{
  id: 'bp3',
  name: 'Kit Cuisine Jetboil Flash — Pack groupe',
  category: 'Cuisine',
  unitPrice: 129,
  proPrice: 97,
  minQty: 8,
  stock: 65,
  image: "https://images.unsplash.com/photo-1662148460486-c8ca9372e13e",
  alt: 'Réchaud Jetboil avec casserole sur rocher en plein air'
},
{
  id: 'bp4',
  name: 'Sac de couchage Cumulus Panyam 450 — Pack',
  category: 'Couchage',
  unitPrice: 299,
  proPrice: 224,
  minQty: 5,
  stock: 30,
  image: "https://images.unsplash.com/photo-1722495274040-463c786b09b6",
  alt: 'Sac de couchage duvet bleu déroulé dans une tente avec vue sur montagne'
}];


interface CartItem {
  product: BulkProduct;
  qty: number;
}

function TrustScoreRing({ score, size = 64 }: {score: number;size?: number;}) {
  const radius = (size - 8) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - score / 100 * circumference;
  return (
    <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth={4} />
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="#E4501C" strokeWidth={4}
        strokeDasharray={circumference} strokeDashoffset={offset} strokeLinecap="round" />
      </svg>
      <span className="absolute font-mono-data font-700 text-white" style={{ fontSize: size * 0.22 }}>{score}</span>
    </div>);

}

export default function B2BPage() {
  const [activeTab, setActiveTab] = useState<'plans' | 'catalogue' | 'dashboard'>('plans');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [_selectedPlan, setSelectedPlan] = useState<string | null>(null);
  const [showContactModal, setShowContactModal] = useState(false);
  const [contactSent, setContactSent] = useState(false);

  const addToCart = (product: BulkProduct) => {
    setCart((prev) => {
      const existing = prev.find((i) => i.product.id === product.id);
      if (existing) return prev.map((i) => i.product.id === product.id ? { ...i, qty: i.qty + product.minQty } : i);
      return [...prev, { product, qty: product.minQty }];
    });
  };

  const cartTotal = cart.reduce((s, i) => s + i.product.proPrice * i.qty, 0);
  const cartSavings = cart.reduce((s, i) => s + (i.product.unitPrice - i.product.proPrice) * i.qty, 0);

  return (
    <main className="min-h-screen bg-background">
      <Header />
      <div className="pt-16 lg:pt-18">
        {/* Hero */}
        <section className="bg-dark-bg text-white py-20 px-4 relative overflow-hidden">
          <div className="absolute inset-0">
            <div className="absolute top-0 right-0 w-[600px] h-[600px] rounded-full bg-primary/10 blur-3xl" />
            <div className="absolute bottom-0 left-0 w-80 h-80 rounded-full bg-secondary/20 blur-3xl" />
          </div>
          <div className="max-w-7xl mx-auto relative">
            <div className="max-w-2xl">
              <div className="flex items-center gap-2 mb-5">
                <span className="tag-badge bg-primary/20 text-primary border border-primary/30 text-[10px]">PHASE 2</span>
                <span className="text-white/50 text-xs font-mono-data">ESPACE PROFESSIONNEL B2B</span>
              </div>
              <h1 className="text-hero text-white mb-4">
                L&apos;équipement outdoor<br />pour les pros
              </h1>
              <p className="text-white/60 text-lg max-w-xl mb-8">
                Tarifs préférentiels, commandes groupées et outils dédiés pour les guides, agences de voyage et revendeurs professionnels.
              </p>
              <div className="flex gap-4">
                <button onClick={() => setShowContactModal(true)} className="btn-primary py-3.5 px-7">
                  <Icon name="BuildingOfficeIcon" size={18} />
                  Demander un accès pro
                </button>
                <button onClick={() => setActiveTab('catalogue')} className="btn-ghost-white py-3.5 px-7">
                  Voir le catalogue pro
                </button>
              </div>
            </div>

            {/* Pro stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-14">
              {[
              { value: '340+', label: 'Professionnels actifs', icon: 'UsersIcon' },
              { value: '-35%', label: 'Remise max revendeurs', icon: 'TagIcon' },
              { value: '48h', label: 'Livraison pro garantie', icon: 'TruckIcon' },
              { value: '30j', label: 'Paiement différé', icon: 'CreditCardIcon' }].
              map((stat) =>
              <div key={stat.label} className="bg-white/5 border border-white/10 rounded-2xl p-4">
                  <Icon name={stat.icon} size={20} className="text-primary mb-2" />
                  <p className="font-display font-800 text-white text-2xl">{stat.value}</p>
                  <p className="text-white/50 text-xs mt-0.5">{stat.label}</p>
                </div>
              )}
            </div>
          </div>
        </section>

        {/* Tabs */}
        <section className="sticky top-16 z-30 bg-background/95 backdrop-blur-md border-b border-border">
          <div className="max-w-7xl mx-auto px-4">
            <div className="flex gap-0">
              {[
              { id: 'plans', label: 'Offres pro', icon: 'SparklesIcon' },
              { id: 'catalogue', label: 'Catalogue B2B', icon: 'TagIcon' },
              { id: 'dashboard', label: 'Dashboard pro', icon: 'ChartBarIcon' }].
              map((tab) =>
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as typeof activeTab)}
                className={`flex items-center gap-2 px-5 py-4 text-sm font-600 border-b-2 transition-all ${
                activeTab === tab.id ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`
                }>
                
                  <Icon name={tab.icon} size={16} />
                  {tab.label}
                </button>
              )}
            </div>
          </div>
        </section>

        <div className="max-w-7xl mx-auto px-4 py-10">
          {/* Plans */}
          {activeTab === 'plans' &&
          <div>
              <div className="text-center mb-10">
                <h2 className="font-display font-700 text-foreground text-2xl mb-2">Choisissez votre offre professionnelle</h2>
                <p className="text-muted-foreground">Accès immédiat après validation de votre statut professionnel</p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {PRO_PLANS.map((plan) =>
              <div
                key={plan.id}
                className={`topo-card p-6 flex flex-col relative ${plan.highlighted ? 'ring-2 ring-primary' : ''}`}>
                
                    {plan.badge &&
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                        <span className="bg-primary text-white text-xs font-700 px-3 py-1 rounded-full">{plan.badge}</span>
                      </div>
                }
                    <div className="mb-5">
                      <h3 className="font-display font-700 text-foreground text-lg mb-1">{plan.name}</h3>
                      <p className="text-sm text-muted-foreground mb-4">{plan.description}</p>
                      <div className="flex items-end gap-1">
                        <span className="font-display font-800 text-foreground text-3xl">{plan.price}€</span>
                        <span className="text-muted-foreground text-sm mb-1">/{plan.period}</span>
                      </div>
                    </div>
                    <ul className="space-y-2.5 flex-1 mb-6">
                      {plan.features.map((feature) =>
                  <li key={feature} className="flex items-start gap-2 text-sm text-foreground">
                          <Icon name="CheckIcon" size={16} className="text-emerald-500 flex-shrink-0 mt-0.5" />
                          {feature}
                        </li>
                  )}
                    </ul>
                    <button
                  onClick={() => {setSelectedPlan(plan.id);setShowContactModal(true);}}
                  className={`w-full py-3 rounded-xl font-600 text-sm transition-all ${
                  plan.highlighted ? 'btn-primary justify-center' : 'btn-secondary justify-center'}`
                  }>
                  
                      Choisir cette offre
                    </button>
                  </div>
              )}
              </div>

              {/* Trust section */}
              <div className="mt-12 bg-dark-bg rounded-2xl p-8 text-white">
                <div className="flex flex-col md:flex-row items-center gap-8">
                  <div className="flex-1">
                    <h3 className="font-display font-700 text-white text-xl mb-3">Validation professionnelle rapide</h3>
                    <p className="text-white/60 text-sm mb-4">Envoyez votre Kbis, numéro SIRET ou carte professionnelle. Validation sous 24h ouvrées.</p>
                    <div className="flex gap-4">
                      {['Kbis', 'SIRET', 'Carte pro', 'Agrément guide'].map((doc) =>
                    <span key={doc} className="text-xs bg-white/10 border border-white/20 rounded-lg px-2.5 py-1 text-white/70">{doc}</span>
                    )}
                    </div>
                  </div>
                  <div className="flex items-center gap-6">
                    <TrustScoreRing score={96} size={80} />
                    <div>
                      <p className="text-white font-display font-700 text-lg">Trust Score Pro</p>
                      <p className="text-white/50 text-sm">Visible sur votre profil public</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          }

          {/* Catalogue B2B */}
          {activeTab === 'catalogue' &&
          <div>
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="font-display font-700 text-foreground text-xl">Catalogue tarifs professionnels</h2>
                  <p className="text-sm text-muted-foreground mt-0.5">Prix affichés avec remise pro Agence (-25%)</p>
                </div>
                {cart.length > 0 &&
              <div className="bg-primary/10 border border-primary/30 rounded-xl px-4 py-2 flex items-center gap-3">
                    <Icon name="ShoppingBagIcon" size={16} className="text-primary" />
                    <div>
                      <p className="text-sm font-700 text-foreground">{cartTotal.toLocaleString('fr-FR')}€ HT</p>
                      <p className="text-xs text-emerald-600">Économie : {cartSavings.toLocaleString('fr-FR')}€</p>
                    </div>
                    <button className="btn-primary py-1.5 px-3 text-xs">Commander</button>
                  </div>
              }
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {BULK_PRODUCTS.map((product) => {
                const discount = Math.round((1 - product.proPrice / product.unitPrice) * 100);
                const inCart = cart.find((i) => i.product.id === product.id);
                return (
                  <div key={product.id} className="topo-card flex gap-4 p-4">
                      <div className="w-24 h-24 rounded-xl overflow-hidden flex-shrink-0">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={product.image} alt={product.alt} className="w-full h-full object-cover" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[10px] font-mono-data text-muted-foreground uppercase mb-0.5">{product.category}</p>
                        <h3 className="font-display font-700 text-foreground text-sm leading-tight mb-2">{product.name}</h3>
                        <div className="flex items-center gap-3 mb-3">
                          <div>
                            <p className="font-display font-800 text-foreground text-lg">{product.proPrice}€ <span className="text-xs font-400 text-muted-foreground">HT/unité</span></p>
                            <p className="text-xs text-muted-foreground line-through">{product.unitPrice}€ public</p>
                          </div>
                          <span className="bg-primary text-white text-xs font-700 px-2 py-0.5 rounded-lg">-{discount}%</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <p className="text-xs text-muted-foreground">Min. {product.minQty} unités · Stock: {product.stock}</p>
                          <button
                          onClick={() => addToCart(product)}
                          className={`text-xs py-1.5 px-3 rounded-lg font-600 transition-all ${
                          inCart ? 'bg-emerald-100 text-emerald-700 border border-emerald-200' : 'btn-primary'}`
                          }>
                          
                            {inCart ? `✓ ${inCart.qty} ajoutés` : `Ajouter (×${product.minQty})`}
                          </button>
                        </div>
                      </div>
                    </div>);

              })}
              </div>
            </div>
          }

          {/* Dashboard */}
          {activeTab === 'dashboard' &&
          <div>
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                  <Icon name="LockClosedIcon" size={18} className="text-primary" />
                </div>
                <div>
                  <h2 className="font-display font-700 text-foreground text-xl">Dashboard professionnel</h2>
                  <p className="text-sm text-muted-foreground">Accès réservé aux comptes pro validés</p>
                </div>
              </div>

              {/* Blurred preview */}
              <div className="relative rounded-2xl overflow-hidden border border-border">
                <div className="blur-sm pointer-events-none select-none">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-6 bg-card">
                    {[
                  { label: 'Commandes ce mois', value: '12', sub: '+3 vs mois dernier' },
                  { label: 'Volume d\'achat', value: '4 820€', sub: 'HT ce mois' },
                  { label: 'Économies réalisées', value: '1 640€', sub: 'grâce aux tarifs pro' },
                  { label: 'Clients équipés', value: '34', sub: 'ce trimestre' }].
                  map((stat) =>
                  <div key={stat.label} className="bg-background rounded-xl border border-border p-4">
                        <p className="text-xs text-muted-foreground mb-1">{stat.label}</p>
                        <p className="font-display font-800 text-foreground text-2xl">{stat.value}</p>
                        <p className="text-xs text-emerald-600 mt-0.5">{stat.sub}</p>
                      </div>
                  )}
                  </div>
                  <div className="h-48 bg-card border-t border-border flex items-center justify-center">
                    <div className="w-full h-32 mx-6 bg-background rounded-xl border border-border" />
                  </div>
                </div>
                <div className="absolute inset-0 flex items-center justify-center bg-background/60 backdrop-blur-sm">
                  <div className="text-center p-8">
                    <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                      <Icon name="BuildingOfficeIcon" size={28} className="text-primary" />
                    </div>
                    <h3 className="font-display font-700 text-foreground text-lg mb-2">Accès professionnel requis</h3>
                    <p className="text-sm text-muted-foreground mb-5 max-w-xs">Activez votre compte pro pour accéder au tableau de bord, aux statistiques et à la gestion de vos équipes.</p>
                    <button onClick={() => {setActiveTab('plans');}} className="btn-primary justify-center py-3 px-6">
                      <Icon name="SparklesIcon" size={16} />
                      Voir les offres pro
                    </button>
                  </div>
                </div>
              </div>
            </div>
          }
        </div>
      </div>

      {/* Contact Modal */}
      {showContactModal &&
      <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setShowContactModal(false)}>
          <div className="bg-card rounded-2xl border border-border p-6 max-w-md w-full" onClick={(e) => e.stopPropagation()}>
            {!contactSent ?
          <>
                <div className="flex items-center justify-between mb-5">
                  <h3 className="font-display font-700 text-foreground text-lg">Demande d&apos;accès professionnel</h3>
                  <button onClick={() => setShowContactModal(false)} className="p-1.5 rounded-lg hover:bg-muted transition-colors">
                    <Icon name="XMarkIcon" size={18} />
                  </button>
                </div>
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-600 text-muted-foreground uppercase tracking-wider block mb-1.5">Prénom</label>
                      <input className="input-field" placeholder="Jean" />
                    </div>
                    <div>
                      <label className="text-xs font-600 text-muted-foreground uppercase tracking-wider block mb-1.5">Nom</label>
                      <input className="input-field" placeholder="Dupont" />
                    </div>
                  </div>
                  <div>
                    <label className="text-xs font-600 text-muted-foreground uppercase tracking-wider block mb-1.5">Email professionnel</label>
                    <input type="email" className="input-field" placeholder="jean@agence-trek.fr" />
                  </div>
                  <div>
                    <label className="text-xs font-600 text-muted-foreground uppercase tracking-wider block mb-1.5">Structure / Entreprise</label>
                    <input className="input-field" placeholder="Agence Trek Aventures" />
                  </div>
                  <div>
                    <label className="text-xs font-600 text-muted-foreground uppercase tracking-wider block mb-1.5">Type de professionnel</label>
                    <select className="input-field">
                      <option>Guide de montagne</option>
                      <option>Agence de voyage aventure</option>
                      <option>Opérateur de trek</option>
                      <option>Revendeur outdoor</option>
                      <option>Autre</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-600 text-muted-foreground uppercase tracking-wider block mb-1.5">SIRET / N° professionnel</label>
                    <input className="input-field" placeholder="123 456 789 00012" />
                  </div>
                </div>
                <div className="flex gap-3 mt-6">
                  <button onClick={() => setShowContactModal(false)} className="btn-secondary flex-1 justify-center py-3">Annuler</button>
                  <button onClick={() => setContactSent(true)} className="btn-primary flex-1 justify-center py-3">
                    <Icon name="PaperAirplaneIcon" size={16} />
                    Envoyer la demande
                  </button>
                </div>
              </> :

          <div className="text-center py-8">
                <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-4">
                  <Icon name="CheckIcon" size={28} className="text-emerald-600" />
                </div>
                <h3 className="font-display font-700 text-foreground text-lg mb-2">Demande envoyée !</h3>
                <p className="text-sm text-muted-foreground mb-1">Votre dossier sera examiné sous 24h ouvrées.</p>
                <p className="text-sm text-muted-foreground mb-6">Vous recevrez un email de confirmation avec vos accès pro.</p>
                <button onClick={() => {setShowContactModal(false);setContactSent(false);}} className="btn-primary justify-center px-8 py-3">Fermer</button>
              </div>
          }
          </div>
        </div>
      }

      <Footer />
    </main>);

}