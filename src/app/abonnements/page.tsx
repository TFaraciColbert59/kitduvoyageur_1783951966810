'use client';

import React, { useState } from 'react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import Image from 'next/image';
import Icon from '@/components/ui/AppIcon';
import Link from 'next/link';

interface Plan {
  id: string;
  name: string;
  price: number;
  period: string;
  badge?: string;
  color: string;
  features: string[];
  box?: string;
  cta: string;
}

interface BoxContent {
  month: string;
  theme: string;
  profile: string;
  items: { name: string; value: number; category: string }[];
  totalValue: number;
  image: string;
  alt: string;
}

const PLANS: Plan[] = [
  {
    id: 'explorer',
    name: 'Explorer',
    price: 0,
    period: 'Gratuit',
    color: 'border-white/20',
    features: [
      'Configurateur IA (3 kits/mois)',
      'Catalogue complet',
      'Guides de destination',
      'Communauté de base',
      'Alertes prix',
    ],
    cta: 'Commencer gratuitement',
  },
  {
    id: 'aventurier',
    name: 'Aventurier',
    price: 19,
    period: '/mois',
    badge: 'Populaire',
    color: 'border-primary',
    features: [
      'Tout Explorer inclus',
      'Configurateur IA illimité',
      'Copilote IA avancé',
      'Accès communauté premium',
      'Recommandations ML personnalisées',
      'Rapport post-expédition',
      'Remise 10% catalogue',
    ],
    box: 'Box mensuelle en option +29€',
    cta: "Démarrer l'essai 14 jours",
  },
  {
    id: 'expedition',
    name: 'Expédition',
    price: 49,
    period: '/mois',
    badge: 'Tout inclus',
    color: 'border-amber-400',
    features: [
      'Tout Aventurier inclus',
      'Box mensuelle incluse (valeur ~120€)',
      'Consultation expert mensuelle',
      'Accès bêta nouvelles fonctionnalités',
      'Remise 20% catalogue',
      'Gamification rang Légende',
      'Rapport IA détaillé post-expédition',
      'Priorité support 24h',
    ],
    cta: 'Rejoindre Expédition',
  },
];

const BOX_PREVIEWS: BoxContent[] = [
  {
    month: 'Juillet 2026',
    theme: 'Haute Montagne',
    profile: 'Alpiniste / Trekking altitude',
    items: [
      { name: 'Crème solaire SPF 50+ montagne', value: 18, category: 'Soin' },
      { name: 'Bâtons de randonnée pliables', value: 45, category: 'Équipement' },
      { name: 'Gants liner mérinos', value: 28, category: 'Textile' },
      { name: 'Gel énergie altitude x6', value: 14, category: 'Nutrition' },
      { name: 'Carte topo laminée Alpes', value: 12, category: 'Navigation' },
    ],
    totalValue: 117,
    image: 'https://img.rocket.new/generatedImages/rocket_gen_img_1f67eeed9-1783678939279.png',
    alt: 'Box équipement haute montagne avec matériel de trekking alpin posé sur neige',
  },
  {
    month: 'Août 2026',
    theme: 'Jungle & Tropiques',
    profile: 'Aventurier tropical / Randonnée forêt',
    items: [
      { name: 'Répulsif anti-moustiques DEET 50%', value: 16, category: 'Soin' },
      { name: 'Hamac ultraléger 400g', value: 38, category: 'Couchage' },
      { name: 'Purificateur eau UV SteriPen', value: 52, category: 'Eau' },
      { name: 'T-shirt anti-UV séchage rapide', value: 24, category: 'Textile' },
    ],
    totalValue: 130,
    image: 'https://img.rocket.new/generatedImages/rocket_gen_img_1833f7ac7-1768148643508.png',
    alt: 'Équipement jungle tropical avec hamac et matériel de survie en forêt dense',
  },
];

const PROFILES = [
  { id: 'montagne', label: 'Montagne & Alpinisme', icon: 'MapPinIcon' },
  { id: 'desert', label: 'Désert & Aride', icon: 'SunIcon' },
  { id: 'jungle', label: 'Jungle & Tropical', icon: 'GlobeAltIcon' },
  { id: 'mer', label: 'Mer & Côtier', icon: 'MapIcon' },
  { id: 'urbain', label: 'Nomade Urbain', icon: 'BuildingOfficeIcon' },
  { id: 'mixte', label: 'Multi-terrain', icon: 'AdjustmentsHorizontalIcon' },
];


export default function AbonnementsPage() {
  const [selectedPlan, setSelectedPlan] = useState('aventurier');
  const [selectedProfile, setSelectedProfile] = useState('montagne');
  const [activeBox, setActiveBox] = useState(0);
  const [billingAnnual, setBillingAnnual] = useState(false);

  return (
    <div className="min-h-screen bg-dark-bg text-white">
      <Header />

      <main className="pt-20">
        {/* Hero */}
        <section className="relative overflow-hidden py-16 px-4">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-dark-bg to-amber-500/5 pointer-events-none" />
          <div className="absolute top-0 right-0 w-96 h-96 bg-primary/5 rounded-full blur-3xl pointer-events-none" />
          <div className="max-w-4xl mx-auto text-center relative z-10">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 border border-primary/20 text-primary text-xs font-mono mb-6" style={{ fontFamily: 'var(--font-mono)' }}>
              <Icon name="SparklesIcon" size={12} variant="outline" />
              PHASE 5 — ABONNEMENTS & BOX
            </div>
            <h1 className="font-display font-800 text-4xl sm:text-5xl text-white mb-4 tracking-tight" style={{ fontFamily: 'var(--font-display)' }}>
              L&apos;équipement parfait,<br />
              <span className="text-primary">livré chaque mois</span>
            </h1>
            <p className="text-white/60 text-lg max-w-2xl mx-auto">
              Une box mensuelle sélectionnée par notre IA selon votre profil voyageur. Chaque produit choisi pour votre prochaine expédition.
            </p>
          </div>
        </section>

        {/* Billing Toggle */}
        <section className="px-4 pb-4">
          <div className="max-w-5xl mx-auto flex justify-center">
            <div className="flex items-center gap-3 bg-card border border-border rounded-xl p-1">
              <button
                onClick={() => setBillingAnnual(false)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${!billingAnnual ? 'bg-primary text-white' : 'text-white/50 hover:text-white'}`}>
                
                Mensuel
              </button>
              <button
                onClick={() => setBillingAnnual(true)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${billingAnnual ? 'bg-primary text-white' : 'text-white/50 hover:text-white'}`}>
                
                Annuel
                <span className="text-xs bg-green-500/20 text-green-400 px-1.5 py-0.5 rounded-full">-20%</span>
              </button>
            </div>
          </div>
        </section>

        {/* Plans */}
        <section className="px-4 py-8">
          <div className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-6">
            {PLANS.map((plan) => {
              const price = billingAnnual && plan.price > 0 ? Math.round(plan.price * 0.8) : plan.price;
              const isSelected = selectedPlan === plan.id;
              return (
                <div
                  key={plan.id}
                  onClick={() => setSelectedPlan(plan.id)}
                  className={`relative rounded-2xl border-2 p-6 cursor-pointer transition-all duration-300 ${plan.color} ${isSelected ? 'bg-white/5 shadow-xl' : 'bg-card hover:bg-white/3'}`}>
                  
                  {plan.badge &&
                  <div className={`absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full text-xs font-bold ${plan.id === 'expedition' ? 'bg-amber-400 text-black' : 'bg-primary text-white'}`}>
                      {plan.badge}
                    </div>
                  }
                  <div className="mb-4">
                    <h3 className="font-display font-700 text-xl text-white mb-1" style={{ fontFamily: 'var(--font-display)' }}>{plan.name}</h3>
                    <div className="flex items-baseline gap-1">
                      {plan.price > 0 ?
                      <>
                          <span className="text-3xl font-bold text-white">{price}€</span>
                          <span className="text-white/40 text-sm">{plan.period}</span>
                        </> :

                      <span className="text-2xl font-bold text-white/60">{plan.period}</span>
                      }
                    </div>
                    {billingAnnual && plan.price > 0 &&
                    <p className="text-xs text-green-400 mt-1">Facturé {price * 12}€/an</p>
                    }
                  </div>

                  <ul className="space-y-2.5 mb-6">
                    {plan.features.map((f, i) =>
                    <li key={i} className="flex items-start gap-2 text-sm text-white/70">
                        <Icon name="CheckIcon" size={14} variant="outline" className="text-primary mt-0.5 flex-shrink-0" />
                        {f}
                      </li>
                    )}
                  </ul>

                  {plan.box &&
                  <div className="mb-4 p-3 rounded-xl bg-amber-400/10 border border-amber-400/20">
                      <p className="text-xs text-amber-300 flex items-center gap-1.5">
                        <Icon name="GiftIcon" size={12} variant="outline" />
                        {plan.box}
                      </p>
                    </div>
                  }

                  <button className={`w-full py-2.5 rounded-xl text-sm font-semibold transition-all ${plan.id === 'expedition' ? 'bg-amber-400 text-black hover:bg-amber-300' : plan.id === 'aventurier' ? 'bg-primary text-white hover:bg-primary/90' : 'border border-white/20 text-white hover:bg-white/10'}`}>
                    {plan.cta}
                  </button>
                </div>);

            })}
          </div>
        </section>

        {/* Box Preview */}
        <section className="px-4 py-12">
          <div className="max-w-5xl mx-auto">
            <div className="flex items-center justify-between mb-8">
              <div>
                <h2 className="font-display font-700 text-2xl text-white" style={{ fontFamily: 'var(--font-display)' }}>
                  Aperçu des boxes à venir
                </h2>
                <p className="text-white/50 text-sm mt-1">Sélectionnée par l&apos;IA selon votre profil</p>
              </div>
              <div className="flex gap-2">
                {BOX_PREVIEWS.map((_, i) =>
                <button
                  key={i}
                  onClick={() => setActiveBox(i)}
                  className={`w-2.5 h-2.5 rounded-full transition-all ${activeBox === i ? 'bg-primary' : 'bg-white/20'}`} />

                )}
              </div>
            </div>

            {BOX_PREVIEWS[activeBox] &&
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 bg-card border border-border rounded-2xl overflow-hidden">
                <div className="relative h-64 lg:h-auto">
                  <Image
                  src={BOX_PREVIEWS[activeBox].image}
                  alt={BOX_PREVIEWS[activeBox].alt}
                  fill
                  className="object-cover" />
                
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                  <div className="absolute bottom-4 left-4">
                    <span className="px-3 py-1 bg-primary rounded-full text-xs font-bold text-white">
                      {BOX_PREVIEWS[activeBox].month}
                    </span>
                    <h3 className="text-white font-display font-700 text-xl mt-2" style={{ fontFamily: 'var(--font-display)' }}>
                      {BOX_PREVIEWS[activeBox].theme}
                    </h3>
                  </div>
                </div>
                <div className="p-6">
                  <div className="flex items-center gap-2 mb-4">
                    <Icon name="UserIcon" size={14} variant="outline" className="text-white/40" />
                    <span className="text-xs text-white/40">{BOX_PREVIEWS[activeBox].profile}</span>
                  </div>
                  <div className="space-y-3 mb-6">
                    {BOX_PREVIEWS[activeBox].items.map((item, i) =>
                  <div key={i} className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="px-2 py-0.5 bg-white/5 rounded text-xs text-white/40">{item.category}</span>
                          <span className="text-sm text-white/80">{item.name}</span>
                        </div>
                        <span className="text-sm font-mono text-white/60" style={{ fontFamily: 'var(--font-mono)' }}>{item.value}€</span>
                      </div>
                  )}
                  </div>
                  <div className="flex items-center justify-between pt-4 border-t border-border">
                    <span className="text-white/50 text-sm">Valeur totale estimée</span>
                    <span className="font-display font-700 text-xl text-primary" style={{ fontFamily: 'var(--font-display)' }}>
                      ~{BOX_PREVIEWS[activeBox].totalValue}€
                    </span>
                  </div>
                </div>
              </div>
            }
          </div>
        </section>

        {/* Profile Selector */}
        <section className="px-4 py-12 bg-card/30">
          <div className="max-w-4xl mx-auto">
            <h2 className="font-display font-700 text-2xl text-white mb-2 text-center" style={{ fontFamily: 'var(--font-display)' }}>
              Personnalisez votre box
            </h2>
            <p className="text-white/50 text-sm text-center mb-8">Votre profil voyageur détermine le contenu de chaque box</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {PROFILES.map((p) =>
              <button
                key={p.id}
                onClick={() => setSelectedProfile(p.id)}
                className={`flex items-center gap-3 p-4 rounded-xl border transition-all text-left ${selectedProfile === p.id ? 'border-primary bg-primary/10 text-white' : 'border-border bg-card text-white/60 hover:border-white/30 hover:text-white'}`}>
                
                  <Icon name={p.icon as string} size={18} variant="outline" className={selectedProfile === p.id ? 'text-primary' : ''} />
                  <span className="text-sm font-medium">{p.label}</span>
                </button>
              )}
            </div>
            <div className="mt-6 text-center">
              <p className="text-xs text-white/30 mb-3">Profil sélectionné : <span className="text-white/60">{PROFILES.find((p) => p.id === selectedProfile)?.label}</span></p>
              <Link href="/ai-configurator" className="inline-flex items-center gap-2 px-6 py-3 bg-primary rounded-xl text-white font-semibold text-sm hover:bg-primary/90 transition-all">
                <Icon name="SparklesIcon" size={16} variant="outline" />
                Affiner mon profil avec l&apos;IA
              </Link>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>);

}