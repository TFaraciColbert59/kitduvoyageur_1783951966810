'use client';

import React, { useState } from 'react';
import Header from '@/components/Header';
import NewFooterSection from '@/app/components/home/NewFooterSection';
import Image from 'next/image';
import Icon from '@/components/ui/AppIcon';
import Link from 'next/link';


interface Plan {
  id: string;
  name: string;
  price: number;
  period: string;
  badge?: string;
  features: string[];
  box?: string;
  cta: string;
  highlighted?: boolean;
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
    features: ['Configurateur IA (3 kits/mois)', 'Catalogue complet', 'Guides de destination', 'Communauté de base', 'Alertes prix'],
    cta: 'Commencer gratuitement',
  },
  {
    id: 'aventurier',
    name: 'Aventurier',
    price: 19,
    period: '/mois',
    badge: 'Populaire',
    highlighted: true,
    features: ['Tout Explorer inclus', 'Configurateur IA illimité', 'Copilote IA avancé', 'Accès communauté premium', 'Recommandations ML personnalisées', 'Rapport post-expédition', 'Remise 10% catalogue'],
    box: 'Box mensuelle en option +29€',
    cta: "Démarrer l'essai 14 jours",
  },
  {
    id: 'expedition',
    name: 'Expédition',
    price: 49,
    period: '/mois',
    badge: 'Tout inclus',
    features: ['Tout Aventurier inclus', 'Box mensuelle incluse (valeur ~120€)', 'Consultation expert mensuelle', 'Accès bêta nouvelles fonctionnalités', 'Remise 20% catalogue', 'Gamification rang Légende', 'Rapport IA détaillé post-expédition', 'Priorité support 24h'],
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

export default function AbonnementsPage() {
  const [selectedPlan, setSelectedPlan] = useState('aventurier');
  const [activeBox, setActiveBox] = useState(0);
  const [billingAnnual, setBillingAnnual] = useState(false);

  return (
    <div className="min-h-screen" style={{ background: '#F5F2EC' }}>
      <Header />

      {/* Hero */}
      <section className="relative overflow-hidden pt-20" style={{ background: '#1C2620' }}>
        <div className="absolute inset-0 bg-cover bg-center opacity-15" style={{ backgroundImage: "url('https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=1600&q=80')" }} />
        <div className="relative z-10 max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
          <nav className="flex items-center gap-2 text-xs font-mono mb-8" style={{ color: 'rgba(255,255,255,0.5)' }}>
            <Link href="/" className="hover:text-white transition-colors">Accueil</Link>
            <span>/</span>
            <span style={{ color: '#E4501C' }}>Abonnements</span>
          </nav>
          <p className="text-xs font-mono tracking-[0.2em] uppercase mb-4" style={{ color: '#4A6741' }}>Abonnements & Box</p>
          <h1 className="font-display text-5xl md:text-6xl text-white mb-4 leading-tight" style={{ fontFamily: 'var(--font-display)', fontStyle: 'italic', fontWeight: 800 }}>
            L&apos;équipement parfait,<br /><em>livré chaque mois.</em>
          </h1>
          <p className="text-white/60 text-lg max-w-xl mb-10">
            Une box mensuelle sélectionnée par notre IA selon votre profil voyageur.
          </p>
          <div className="flex flex-wrap gap-8 pt-8 border-t border-white/10">
            {[{ v: '3', l: 'Formules' }, { v: '120€', l: 'Valeur box/mois' }, { v: '-20%', l: 'Remise annuelle' }].map((s) => (
              <div key={s.l}>
                <p className="font-mono text-2xl font-700 text-white">{s.v}</p>
                <p className="text-xs text-white/40 mt-0.5">{s.l}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        {/* Billing toggle */}
        <div className="flex justify-center mb-10">
          <div className="flex items-center gap-1 p-1 rounded-2xl" style={{ background: '#fff', border: '1px solid #E8E4DA' }}>
            {[{ id: false, label: 'Mensuel' }, { id: true, label: 'Annuel', badge: '-20%' }].map((opt) => (
              <button
                key={String(opt.id)}
                onClick={() => setBillingAnnual(opt.id)}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all"
                style={billingAnnual === opt.id ? { background: '#1C2620', color: '#fff' } : { color: '#5C6B5E' }}
              >
                {opt.label}
                {opt.badge && <span className="text-xs px-1.5 py-0.5 rounded-full" style={{ background: '#4A6741', color: '#fff' }}>{opt.badge}</span>}
              </button>
            ))}
          </div>
        </div>

        {/* Plans */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-16">
          {PLANS.map((plan) => {
            const price = billingAnnual && plan.price > 0 ? Math.round(plan.price * 0.8) : plan.price;
            const isSelected = selectedPlan === plan.id;
            return (
              <div
                key={plan.id}
                onClick={() => setSelectedPlan(plan.id)}
                className="relative rounded-2xl p-7 cursor-pointer transition-all duration-300"
                style={{
                  background: plan.highlighted ? '#1C2620' : '#fff',
                  border: `2px solid ${isSelected ? '#4A6741' : plan.highlighted ? '#1C2620' : '#E8E4DA'}`,
                  boxShadow: isSelected ? '0 8px 32px rgba(74,103,65,0.2)' : 'none',
                }}
              >
                {plan.badge && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full text-xs font-bold"
                    style={{ background: plan.id === 'expedition' ? '#E4501C' : '#4A6741', color: '#fff' }}>
                    {plan.badge}
                  </div>
                )}
                <div className="mb-5">
                  <h3 className="font-display font-700 text-xl mb-2" style={{ fontFamily: 'var(--font-display)', color: plan.highlighted ? '#fff' : '#1C2620' }}>{plan.name}</h3>
                  <div className="flex items-baseline gap-1">
                    {plan.price > 0 ? (
                      <>
                        <span className="text-3xl font-bold" style={{ color: plan.highlighted ? '#fff' : '#1C2620' }}>{price}€</span>
                        <span className="text-sm" style={{ color: plan.highlighted ? 'rgba(255,255,255,0.5)' : '#7A7A6E' }}>{plan.period}</span>
                      </>
                    ) : (
                      <span className="text-2xl font-bold" style={{ color: plan.highlighted ? 'rgba(255,255,255,0.7)' : '#7A7A6E' }}>{plan.period}</span>
                    )}
                  </div>
                  {billingAnnual && plan.price > 0 && (
                    <p className="text-xs mt-1" style={{ color: '#4A6741' }}>Facturé {price * 12}€/an</p>
                  )}
                </div>
                <ul className="space-y-2.5 mb-6">
                  {plan.features.map((f, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm" style={{ color: plan.highlighted ? 'rgba(255,255,255,0.7)' : '#5C6B5E' }}>
                      <Icon name="CheckIcon" size={14} variant="outline" className="mt-0.5 flex-shrink-0" style={{ color: '#4A6741' } as React.CSSProperties} />
                      {f}
                    </li>
                  ))}
                </ul>
                {plan.box && (
                  <div className="mb-5 p-3 rounded-xl" style={{ background: 'rgba(228,80,28,0.1)', border: '1px solid rgba(228,80,28,0.2)' }}>
                    <p className="text-xs flex items-center gap-1.5" style={{ color: '#E4501C' }}>
                      <Icon name="GiftIcon" size={12} variant="outline" />
                      {plan.box}
                    </p>
                  </div>
                )}
                <button
                  className="w-full py-3 rounded-xl text-sm font-semibold transition-all"
                  style={plan.highlighted
                    ? { background: '#4A6741', color: '#fff' }
                    : plan.id === 'expedition'
                    ? { background: '#E4501C', color: '#fff' }
                    : { background: 'transparent', border: '1px solid #C8C3B0', color: '#1C2620' }
                  }
                >
                  {plan.cta}
                </button>
              </div>
            );
          })}
        </div>

        {/* Box Preview */}
        <section>
          <p className="text-xs font-mono tracking-[0.2em] uppercase mb-2" style={{ color: '#4A6741' }}>Aperçu des boxes</p>
          <h2 className="font-display text-3xl mb-8" style={{ fontFamily: 'var(--font-display)', fontStyle: 'italic', fontWeight: 800, color: '#1C2620' }}>
            Sélectionnée par l&apos;IA pour vous.
          </h2>
          <div className="flex gap-3 mb-8">
            {BOX_PREVIEWS.map((box, i) => (
              <button key={i} onClick={() => setActiveBox(i)}
                className="px-4 py-2 rounded-xl text-sm font-semibold transition-all"
                style={activeBox === i ? { background: '#1C2620', color: '#fff' } : { background: '#fff', border: '1px solid #C8C3B0', color: '#5C6B5E' }}>
                {box.month}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 rounded-2xl overflow-hidden" style={{ background: '#fff', border: '1px solid #E8E4DA' }}>
            <div className="relative" style={{ minHeight: 300 }}>
              <Image src={BOX_PREVIEWS[activeBox].image} alt={BOX_PREVIEWS[activeBox].alt} fill className="object-cover" />
              <div className="absolute inset-0" style={{ background: 'linear-gradient(to top, rgba(28,38,32,0.7) 0%, transparent 60%)' }} />
              <div className="absolute bottom-0 left-0 right-0 p-6">
                <p className="text-xs font-mono text-white/60 mb-1">{BOX_PREVIEWS[activeBox].profile}</p>
                <h3 className="font-display text-xl text-white font-700" style={{ fontFamily: 'var(--font-display)', fontStyle: 'italic' }}>
                  {BOX_PREVIEWS[activeBox].theme}
                </h3>
              </div>
            </div>
            <div className="p-7">
              <p className="text-xs font-mono tracking-[0.15em] uppercase mb-4" style={{ color: '#4A6741' }}>Contenu de la box</p>
              <div className="space-y-3 mb-6">
                {BOX_PREVIEWS[activeBox].items.map((item, i) => (
                  <div key={i} className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium" style={{ color: '#1C2620' }}>{item.name}</p>
                      <p className="text-xs" style={{ color: '#7A7A6E' }}>{item.category}</p>
                    </div>
                    <span className="text-sm font-mono font-700" style={{ color: '#4A6741' }}>{item.value}€</span>
                  </div>
                ))}
              </div>
              <div className="flex items-center justify-between pt-4" style={{ borderTop: '1px solid #E8E4DA' }}>
                <span className="text-sm font-semibold" style={{ color: '#1C2620' }}>Valeur totale</span>
                <span className="font-display text-2xl font-800" style={{ fontFamily: 'var(--font-display)', color: '#4A6741' }}>~{BOX_PREVIEWS[activeBox].totalValue}€</span>
              </div>
              <p className="text-xs mt-2" style={{ color: '#7A7A6E' }}>Incluse dans le plan Expédition (49€/mois)</p>
            </div>
          </div>
        </section>
      </main>

      <NewFooterSection />
    </div>
  );
}
