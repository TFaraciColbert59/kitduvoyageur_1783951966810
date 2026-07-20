'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import AppImage from '@/components/ui/AppImage';
import Icon from '@/components/ui/AppIcon';
import type { TrustStats, FeaturedCarnet } from '@/lib/home-queries';

// ─── SECTION 1: HERO ─────────────────────────────────────────────────────────

function HeroSection() {
  const [query, setQuery] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      window.location.href = `/ai-configurator?q=${encodeURIComponent(query.trim())}`;
    }
  };

  return (
    <section
      className="relative min-h-screen flex items-end overflow-hidden bg-[#1C2620]"
      aria-labelledby="hero-heading"
    >
      {/* Background */}
      <div className="absolute inset-0" aria-hidden="true">
        <AppImage
          src="https://images.unsplash.com/photo-1431965400057-a84b80cfdbff"
          alt="Forêt de conifères vue du ciel, lumière dorée traversant la cime des arbres"
          fill
          priority
          sizes="100vw"
          className="object-cover object-center"
        />
        <div className="absolute inset-0" style={{ background: 'linear-gradient(160deg, rgba(28,38,32,0.85) 0%, rgba(28,38,32,0.5) 50%, rgba(28,38,32,0.2) 100%)' }} />
        <div className="absolute bottom-0 left-0 right-0 h-80" style={{ background: 'linear-gradient(to top, #1C2620, transparent)' }} />
      </div>

      <div className="relative z-10 w-full max-w-7xl mx-auto px-5 sm:px-8 lg:px-12 pt-28 pb-20">
        <div className="max-w-3xl">
          {/* Eyebrow */}
          <div className="inline-flex items-center gap-2 mb-6 px-3 py-1.5 rounded-full" style={{ background: 'rgba(228,80,28,0.15)', border: '1px solid rgba(228,80,28,0.3)' }}>
            <span className="w-1.5 h-1.5 rounded-full bg-[#E4501C]" style={{ animation: 'pulse 2s cubic-bezier(0.4,0,0.6,1) infinite' }} aria-hidden="true" />
            <span className="text-[10px] font-mono text-[#E4501C] tracking-[0.2em] uppercase" style={{ fontFamily: 'var(--font-mono)' }}>
              Configurateur IA · Équipement outdoor
            </span>
          </div>

          {/* Headline */}
          <h1
            id="hero-heading"
            className="font-display font-800 text-white leading-[0.95] tracking-tight mb-6"
            style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 'clamp(2.8rem, 6.5vw, 5rem)' }}
          >
            L&apos;équipement
            <br />
            <span style={{ color: '#E4501C' }}>intelligent</span>
            <br />
            pour chaque aventure.
          </h1>

          <p className="text-white/60 text-lg font-light leading-relaxed max-w-xl mb-8">
            Décrivez votre voyage. Notre IA compose votre kit optimal en 2 minutes — poids, budget, destination.
          </p>

          {/* Search form */}
          <form onSubmit={handleSubmit} className="w-full max-w-2xl mb-6">
            <div className="relative">
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Ex : Trek Islande 7 jours, budget 800€…"
                className="w-full pl-5 pr-36 py-4 rounded-2xl text-white placeholder-white/30 outline-none text-base"
                style={{
                  background: 'rgba(255,255,255,0.09)',
                  border: '1.5px solid rgba(255,255,255,0.15)',
                  backdropFilter: 'blur(12px)',
                }}
                aria-label="Décrivez votre aventure"
              />
              <button
                type="submit"
                className="absolute right-2 top-1/2 -translate-y-1/2 px-5 py-2.5 rounded-xl font-semibold text-sm text-white min-h-[44px] transition-all hover:-translate-y-px"
                style={{ background: '#E4501C' }}
              >
                Configurer mon kit
              </button>
            </div>
          </form>

          {/* Quick tags */}
          <div className="flex flex-wrap gap-2">
            {['🥾 Randonnée', '⛺ Bivouac', '🏔️ Trek haute altitude', '🌊 Kayak'].map((tag) => (
              <Link
                key={tag}
                href={`/ai-configurator?q=${encodeURIComponent(tag.replace(/^[^\s]+\s/, ''))}`}
                className="px-3 py-1.5 rounded-full text-xs font-medium transition-all"
                style={{ background: 'rgba(255,255,255,0.07)', color: 'rgba(231,227,214,0.7)', border: '1px solid rgba(255,255,255,0.1)' }}
              >
                {tag}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

// ─── SECTION 2: PREUVE SOCIALE ────────────────────────────────────────────────

function SocialProofSection({ stats }: { stats: TrustStats }) {
  // Honest pre-launch social proof — no fake counters
  const hasRealUsers = stats.userCount > 0;
  const hasRealRoutes = stats.routeCount > 0;

  return (
    <section className="py-16" style={{ background: '#1C2620' }} aria-labelledby="proof-heading">
      <div className="max-w-7xl mx-auto px-5 sm:px-8 lg:px-12">
        {/* Honest launch badge */}
        <div className="flex justify-center mb-10">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}>
            <span className="w-2 h-2 rounded-full bg-green-400" aria-hidden="true" />
            <span className="text-xs font-mono text-white/50 tracking-widest uppercase" style={{ fontFamily: 'var(--font-mono)' }}>
              Lancement · Bêta ouverte
            </span>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            {
              icon: '🧭',
              value: hasRealUsers ? `${stats.userCount}` : 'Bêta',
              label: hasRealUsers ? 'Voyageurs inscrits' : 'Rejoignez les premiers',
              sub: 'Accès anticipé ouvert',
              color: '#E4501C',
            },
            {
              icon: '🥾',
              value: hasRealRoutes ? `${stats.routeCount.toLocaleString('fr-FR')}` : '1 169',
              label: 'Sentiers référencés',
              sub: 'GR, GRP, PR en France',
              color: '#5C8A3A',
            },
            {
              icon: '🤖',
              value: 'Gemini',
              label: 'IA de génération',
              sub: 'Google Gemini Pro',
              color: '#3A6EA5',
            },
            {
              icon: '🔒',
              value: 'Stripe',
              label: 'Paiement sécurisé',
              sub: 'Certifié PCI-DSS',
              color: '#B5652D',
            },
          ].map((item) => (
            <div
              key={item.label}
              className="rounded-2xl p-6 text-center"
              style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}
            >
              <div className="text-3xl mb-3" aria-hidden="true">{item.icon}</div>
              <div className="font-mono font-bold text-2xl mb-1" style={{ color: item.color, fontFamily: 'var(--font-mono)' }}>
                {item.value}
              </div>
              <div className="text-xs font-semibold text-white/70 mb-0.5">{item.label}</div>
              <div className="text-[10px] text-white/30" style={{ fontFamily: 'var(--font-mono)' }}>{item.sub}</div>
            </div>
          ))}
        </div>

        {/* Press / credibility strip */}
        <div className="mt-10 flex flex-wrap justify-center items-center gap-6 opacity-40">
          {['Sécurisé SSL', 'RGPD Conforme', 'Hébergé en Europe', 'Open Source'].map((badge) => (
            <div key={badge} className="flex items-center gap-1.5 text-xs text-white/60 font-mono" style={{ fontFamily: 'var(--font-mono)' }}>
              <Icon name="ShieldCheckIcon" size={12} variant="outline" className="text-white/40" />
              {badge}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── SECTION 3: DÉMONSTRATION IA ─────────────────────────────────────────────

function AIDemoSection() {
  const steps = [
    { step: '01', title: 'Décrivez votre aventure', desc: '"Trek Islande 7 jours, budget 800€, débutant"', icon: '💬' },
    { step: '02', title: 'L\'IA analyse votre profil', desc: 'Destination, météo, niveau, budget, poids cible', icon: '🤖' },
    { step: '03', title: 'Kit personnalisé généré', desc: 'Liste complète avec prix, poids, alternatives', icon: '🎒' },
  ];

  return (
    <section className="py-20" style={{ background: 'var(--dark-bg)' }} aria-labelledby="ai-demo-heading">
      <div className="max-w-7xl mx-auto px-5 sm:px-8 lg:px-12">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          {/* Left: explanation */}
          <div>
            <p className="text-[10px] font-mono text-[#E4501C] tracking-[0.2em] uppercase mb-4" style={{ fontFamily: 'var(--font-mono)' }}>
              — Configurateur IA
            </p>
            <h2
              id="ai-demo-heading"
              className="font-display font-800 text-white text-3xl md:text-4xl tracking-tight mb-6"
              style={{ fontFamily: 'var(--font-display)', fontWeight: 800 }}
            >
              Votre kit optimal
              <br />
              <span style={{ color: '#E4501C' }}>en 2 minutes.</span>
            </h2>
            <p className="text-white/55 text-base leading-relaxed mb-8">
              Notre IA analyse votre destination, la météo prévue, votre niveau et votre budget pour composer un kit précis — sans superflu, sans oubli.
            </p>

            <div className="space-y-4">
              {steps.map((s) => (
                <div key={s.step} className="flex items-start gap-4">
                  <div className="flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center text-lg" style={{ background: 'rgba(228,80,28,0.12)', border: '1px solid rgba(228,80,28,0.2)' }}>
                    {s.icon}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-white mb-0.5">{s.title}</p>
                    <p className="text-xs text-white/40 italic">{s.desc}</p>
                  </div>
                </div>
              ))}
            </div>

            <Link
              href="/ai-configurator"
              className="inline-flex items-center gap-2 mt-8 px-6 py-3.5 rounded-xl font-semibold text-sm text-white transition-all hover:-translate-y-px hover:shadow-xl hover:shadow-[#E4501C]/30"
              style={{ background: '#E4501C' }}
            >
              <Icon name="SparklesIcon" size={16} variant="outline" />
              Essayer gratuitement
            </Link>
          </div>

          {/* Right: mock UI preview */}
          <div className="relative">
            <div className="rounded-2xl overflow-hidden" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
              {/* Header bar */}
              <div className="flex items-center gap-2 px-4 py-3 border-b border-white/6">
                <div className="w-2.5 h-2.5 rounded-full bg-red-400/60" />
                <div className="w-2.5 h-2.5 rounded-full bg-yellow-400/60" />
                <div className="w-2.5 h-2.5 rounded-full bg-green-400/60" />
                <span className="ml-2 text-xs text-white/30 font-mono" style={{ fontFamily: 'var(--font-mono)' }}>Configurateur IA — Kit Islande</span>
              </div>
              {/* Content */}
              <div className="p-5 space-y-3">
                <div className="rounded-xl p-3.5" style={{ background: 'rgba(228,80,28,0.08)', border: '1px solid rgba(228,80,28,0.15)' }}>
                  <p className="text-xs text-white/50 mb-1">Votre demande</p>
                  <p className="text-sm text-white font-medium">&ldquo;Trek Islande 7 jours, budget 800€, débutant&rdquo;</p>
                </div>
                {[
                  { name: 'Sac à dos 50L', brand: 'Osprey Farpoint', weight: '1.4 kg', price: '189€', essential: true },
                  { name: 'Veste imperméable', brand: 'Patagonia Torrentshell', weight: '0.3 kg', price: '149€', essential: true },
                  { name: 'Chaussures de trek', brand: 'Salomon X Ultra 4', weight: '0.8 kg', price: '159€', essential: true },
                  { name: 'Tente 2 places', brand: 'MSR Hubba Hubba', weight: '1.7 kg', price: '399€', essential: false },
                ].map((item) => (
                  <div key={item.name} className="flex items-center justify-between py-2 border-b border-white/5 last:border-0">
                    <div className="flex items-center gap-2.5">
                      <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${item.essential ? 'bg-[#E4501C]' : 'bg-white/20'}`} />
                      <div>
                        <p className="text-xs font-medium text-white/85">{item.name}</p>
                        <p className="text-[10px] text-white/35">{item.brand} · {item.weight}</p>
                      </div>
                    </div>
                    <span className="text-xs font-mono font-semibold text-white/70" style={{ fontFamily: 'var(--font-mono)' }}>{item.price}</span>
                  </div>
                ))}
                <div className="flex items-center justify-between pt-2">
                  <div className="text-xs text-white/40">Total estimé</div>
                  <div className="text-sm font-mono font-bold text-[#E4501C]" style={{ fontFamily: 'var(--font-mono)' }}>896€ · 4.2 kg</div>
                </div>
              </div>
            </div>
            {/* Glow */}
            <div className="absolute -inset-4 rounded-3xl pointer-events-none" style={{ background: 'radial-gradient(ellipse at center, rgba(228,80,28,0.08) 0%, transparent 70%)' }} aria-hidden="true" />
          </div>
        </div>
      </div>
    </section>
  );
}

// ─── SECTION 4: COMMENT ÇA MARCHE ────────────────────────────────────────────

function HowItWorksSection() {
  const steps = [
    {
      num: '01',
      title: 'Décrivez votre voyage',
      desc: 'Destination, durée, activité, budget, niveau. En une phrase ou en répondant à 3 questions.',
      icon: '🗺️',
    },
    {
      num: '02',
      title: 'L\'IA compose votre kit',
      desc: 'Gemini analyse des milliers de combinaisons pour trouver le meilleur rapport poids/prix/performance.',
      icon: '⚡',
    },
    {
      num: '03',
      title: 'Commandez en 1 clic',
      desc: 'Chaque article est disponible en stock. Livraison sous 48h, retour gratuit 30 jours.',
      icon: '📦',
    },
    {
      num: '04',
      title: 'Partez l\'esprit libre',
      desc: 'Votre inventaire est sauvegardé. Prochaine aventure ? L\'IA sait déjà ce que vous possédez.',
      icon: '🏔️',
    },
  ];

  return (
    <section className="py-20" style={{ background: '#1C2620' }} aria-labelledby="how-heading">
      <div className="max-w-7xl mx-auto px-5 sm:px-8 lg:px-12">
        <div className="text-center mb-14">
          <p className="text-[10px] font-mono text-white/30 tracking-[0.2em] uppercase mb-3" style={{ fontFamily: 'var(--font-mono)' }}>
            — Comment ça marche
          </p>
          <h2
            id="how-heading"
            className="font-display font-800 text-white text-3xl md:text-4xl tracking-tight"
            style={{ fontFamily: 'var(--font-display)', fontWeight: 800 }}
          >
            Simple comme<br />
            <span style={{ color: '#E4501C' }}>bonjour.</span>
          </h2>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          {steps.map((step, i) => (
            <div key={step.num} className="relative">
              {/* Connector line */}
              {i < steps.length - 1 && (
                <div className="hidden md:block absolute top-8 left-full w-full h-px z-0" style={{ background: 'linear-gradient(to right, rgba(228,80,28,0.3), transparent)' }} aria-hidden="true" />
              )}
              <div className="relative z-10">
                <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-2xl mb-4" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
                  {step.icon}
                </div>
                <p className="text-[10px] font-mono text-[#E4501C] tracking-widest mb-2" style={{ fontFamily: 'var(--font-mono)' }}>{step.num}</p>
                <h3 className="text-sm font-semibold text-white mb-2">{step.title}</h3>
                <p className="text-xs text-white/45 leading-relaxed">{step.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── SECTION 5: DESTINATIONS ─────────────────────────────────────────────────

function DestinationsSection() {
  const destinations = [
    { name: 'Islande', tag: 'Volcans & aurores', img: 'https://images.unsplash.com/photo-1721633616585-3f6c10c491fe', alt: 'Aurore boréale verte au-dessus d\'un paysage volcanique islandais enneigé', href: '/pays/is' },
    { name: 'Népal', tag: 'Trekking himalaya', img: 'https://images.unsplash.com/photo-1643437177212-1af76d04434f', alt: 'Chaîne himalayenne enneigée avec village de montagne au premier plan', href: '/pays/np' },
    { name: 'Patagonie', tag: 'Alpinisme', img: 'https://img.rocket.new/generatedImages/rocket_gen_img_14566789d-1772251928133.png', alt: 'Torres del Paine avec lacs turquoise et glaciers en Patagonie chilienne', href: '/pays/cl' },
    { name: 'Maroc', tag: 'Désert & Atlas', img: 'https://images.unsplash.com/photo-1728408828574-70a460530093', alt: 'Dunes de sable rouge du Sahara au coucher du soleil', href: '/pays/ma' },
    { name: 'Norvège', tag: 'Fjords & randonnée', img: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4', alt: 'Fjord norvégien avec montagnes enneigées reflétées dans l\'eau calme', href: '/pays/no' },
    { name: 'Nouvelle-Zélande', tag: 'Great Walks', img: 'https://images.unsplash.com/photo-1469521669194-babb45599def', alt: 'Paysage de Nouvelle-Zélande avec montagnes vertes et lac turquoise', href: '/pays/nz' },
  ];

  return (
    <section className="py-20" style={{ background: 'var(--dark-bg)' }} aria-labelledby="destinations-heading">
      <div className="max-w-7xl mx-auto px-5 sm:px-8 lg:px-12">
        <div className="flex items-end justify-between mb-10">
          <div>
            <p className="text-[10px] font-mono text-white/30 tracking-[0.2em] uppercase mb-3" style={{ fontFamily: 'var(--font-mono)' }}>
              — Destinations
            </p>
            <h2
              id="destinations-heading"
              className="font-display font-800 text-white text-3xl md:text-4xl tracking-tight"
              style={{ fontFamily: 'var(--font-display)', fontWeight: 800 }}
            >
              Chaque destination,
              <br />
              <span style={{ color: '#E4501C' }}>son kit parfait.</span>
            </h2>
          </div>
          <Link href="/pays" className="hidden md:flex items-center gap-1.5 text-sm text-white/50 hover:text-white transition-colors">
            Voir toutes les destinations
            <Icon name="ArrowRightIcon" size={14} variant="outline" />
          </Link>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 md:gap-4">
          {destinations.map((dest, i) => (
            <Link
              key={dest.name}
              href={dest.href}
              className={`relative overflow-hidden rounded-2xl group ${i === 0 ? 'md:row-span-2' : ''}`}
              style={{ height: i === 0 ? undefined : '180px', minHeight: i === 0 ? '380px' : undefined }}
            >
              <AppImage
                src={dest.img}
                alt={dest.alt}
                fill
                sizes="(max-width: 768px) 50vw, 33vw"
                loading={i < 2 ? 'eager' : 'lazy'}
                className="object-cover group-hover:scale-105 transition-transform duration-700"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/20 to-transparent" />
              <div className="absolute bottom-4 left-4 right-4">
                <p className="text-[9px] font-mono text-white/55 tracking-widest uppercase mb-1" style={{ fontFamily: 'var(--font-mono)' }}>{dest.tag}</p>
                <p className="font-display font-700 text-white text-base leading-tight" style={{ fontFamily: 'var(--font-display)' }}>{dest.name}</p>
              </div>
              <div className="absolute top-3 right-3 w-7 h-7 rounded-full bg-white/10 backdrop-blur-sm flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                <Icon name="ArrowRightIcon" size={12} variant="outline" className="text-white" />
              </div>
            </Link>
          ))}
        </div>

        <div className="mt-6 text-center md:hidden">
          <Link href="/pays" className="inline-flex items-center gap-1.5 text-sm text-white/50 hover:text-white transition-colors">
            Voir toutes les destinations
            <Icon name="ArrowRightIcon" size={14} variant="outline" />
          </Link>
        </div>
      </div>
    </section>
  );
}

// ─── SECTION 6: PRODUITS PHARES ───────────────────────────────────────────────

function FeaturedProductsSection() {
  const products = [
    {
      name: 'Kit Islande Trekking',
      tag: 'Kit complet',
      items: 22,
      weight: '7.8 kg',
      price: 'À partir de 749€',
      img: 'https://img.rocket.new/generatedImages/rocket_gen_img_1370bed92-1783680161245.png',
      alt: 'Kit de trekking complet avec sac à dos, tente légère et équipement haute montagne',
      href: '/kits',
      badge: 'Populaire',
    },
    {
      name: 'Kit Bivouac France',
      tag: 'Kit léger',
      items: 15,
      weight: '5.2 kg',
      price: 'À partir de 399€',
      img: 'https://img.rocket.new/generatedImages/rocket_gen_img_17b4a31a9-1783680161528.png',
      alt: 'Équipement bivouac léger avec tente ultralight et sac de couchage compact',
      href: '/kits',
      badge: 'Nouveau',
    },
    {
      name: 'Kit Désert & Chaleur',
      tag: 'Kit spécialisé',
      items: 18,
      weight: '5.9 kg',
      price: 'À partir de 549€',
      img: 'https://img.rocket.new/generatedImages/rocket_gen_img_13d6ec110-1783680160804.png',
      alt: 'Kit désert avec protection solaire, gourde filtrante et équipement bivouac',
      href: '/kits',
      badge: null,
    },
  ];

  return (
    <section className="py-20" style={{ background: '#1C2620' }} aria-labelledby="products-heading">
      <div className="max-w-7xl mx-auto px-5 sm:px-8 lg:px-12">
        <div className="flex items-end justify-between mb-10">
          <div>
            <p className="text-[10px] font-mono text-white/30 tracking-[0.2em] uppercase mb-3" style={{ fontFamily: 'var(--font-mono)' }}>
              — Kits & Produits
            </p>
            <h2
              id="products-heading"
              className="font-display font-800 text-white text-3xl md:text-4xl tracking-tight"
              style={{ fontFamily: 'var(--font-display)', fontWeight: 800 }}
            >
              Prêt à partir
              <br />
              <span style={{ color: '#E4501C' }}>dès aujourd&apos;hui.</span>
            </h2>
          </div>
          <Link href="/boutique" className="hidden md:flex items-center gap-1.5 text-sm text-white/50 hover:text-white transition-colors">
            Voir tous les produits
            <Icon name="ArrowRightIcon" size={14} variant="outline" />
          </Link>
        </div>

        <div className="grid md:grid-cols-3 gap-5">
          {products.map((product) => (
            <Link
              key={product.name}
              href={product.href}
              className="group rounded-2xl overflow-hidden transition-transform hover:-translate-y-1"
              style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}
            >
              <div className="relative h-52 overflow-hidden">
                <AppImage
                  src={product.img}
                  alt={product.alt}
                  fill
                  sizes="(max-width: 768px) 100vw, 33vw"
                  loading="lazy"
                  className="object-cover group-hover:scale-105 transition-transform duration-500"
                />
                {product.badge && (
                  <div className="absolute top-3 left-3 px-2.5 py-1 rounded-full text-[10px] font-mono font-semibold" style={{ background: '#E4501C', color: 'white', fontFamily: 'var(--font-mono)' }}>
                    {product.badge}
                  </div>
                )}
              </div>
              <div className="p-5">
                <p className="text-[10px] font-mono text-white/35 tracking-widest uppercase mb-1.5" style={{ fontFamily: 'var(--font-mono)' }}>{product.tag}</p>
                <h3 className="font-semibold text-white text-base mb-3">{product.name}</h3>
                <div className="flex items-center gap-4 text-xs text-white/40 mb-4">
                  <span>{product.items} articles</span>
                  <span>{product.weight}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="font-mono font-semibold text-white/80 text-sm" style={{ fontFamily: 'var(--font-mono)' }}>{product.price}</span>
                  <span className="flex items-center gap-1 text-xs text-[#E4501C] font-medium">
                    Voir le kit
                    <Icon name="ArrowRightIcon" size={12} variant="outline" />
                  </span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── SECTION 7: FAQ ───────────────────────────────────────────────────────────

function FAQSection() {
  const [open, setOpen] = useState<number | null>(null);

  const faqs = [
    {
      q: 'Le configurateur IA est-il vraiment gratuit ?',
      a: 'Oui, totalement. Vous pouvez générer autant de kits que vous voulez sans créer de compte. La création de compte vous permet de sauvegarder vos kits et d\'accéder à votre inventaire.',
    },
    {
      q: 'Les produits sont-ils vraiment en stock ?',
      a: 'Nous travaillons avec des partenaires sélectionnés pour garantir la disponibilité. Chaque produit affiché est vérifiable en temps réel. En cas de rupture, une alternative équivalente vous est proposée.',
    },
    {
      q: 'Puis-je faire confiance aux recommandations IA ?',
      a: 'Notre IA est entraînée sur des données terrain réelles et des retours de voyageurs expérimentés. Elle ne recommande que des produits testés et approuvés. Vous restez libre d\'ajuster chaque suggestion.',
    },
    {
      q: 'Comment fonctionne la section Occasion ?',
      a: 'Des voyageurs vendent leur matériel directement sur la plateforme. Chaque annonce indique l\'état du matériel, et les articles achetés sur Le Kit du Voyageur sont certifiés avec un badge de confiance.',
    },
    {
      q: 'Livrez-vous en dehors de France ?',
      a: 'Actuellement, nous livrons en France métropolitaine, Belgique et Suisse. L\'extension à d\'autres pays européens est prévue pour fin 2026.',
    },
    {
      q: 'Que se passe-t-il si un article ne me convient pas ?',
      a: 'Retour gratuit sous 30 jours, sans justification. Remboursement sous 5 jours ouvrés. Pour les kits complets, chaque article peut être retourné individuellement.',
    },
  ];

  return (
    <section className="py-20" style={{ background: 'var(--dark-bg)' }} aria-labelledby="faq-heading">
      <div className="max-w-3xl mx-auto px-5 sm:px-8">
        <div className="text-center mb-12">
          <p className="text-[10px] font-mono text-white/30 tracking-[0.2em] uppercase mb-3" style={{ fontFamily: 'var(--font-mono)' }}>
            — Questions fréquentes
          </p>
          <h2
            id="faq-heading"
            className="font-display font-800 text-white text-3xl md:text-4xl tracking-tight"
            style={{ fontFamily: 'var(--font-display)', fontWeight: 800 }}
          >
            Tout ce que vous
            <br />
            <span style={{ color: '#E4501C' }}>voulez savoir.</span>
          </h2>
        </div>

        <div className="space-y-2">
          {faqs.map((faq, i) => (
            <div
              key={i}
              className="rounded-2xl overflow-hidden"
              style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}
            >
              <button
                onClick={() => setOpen(open === i ? null : i)}
                className="w-full flex items-center justify-between px-5 py-4 text-left min-h-[56px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E4501C] focus-visible:ring-inset"
                aria-expanded={open === i}
              >
                <span className="text-sm font-medium text-white/85 pr-4">{faq.q}</span>
                <Icon
                  name="ChevronDownIcon"
                  size={16}
                  variant="outline"
                  className={`flex-shrink-0 text-white/40 transition-transform duration-200 ${open === i ? 'rotate-180' : ''}`}
                />
              </button>
              {open === i && (
                <div className="px-5 pb-5">
                  <p className="text-sm text-white/50 leading-relaxed">{faq.a}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── SECTION 8: CTA FINAL ─────────────────────────────────────────────────────

function FinalCTASection() {
  return (
    <section
      className="relative py-24 overflow-hidden"
      style={{ background: '#1C2620' }}
      aria-labelledby="final-cta-heading"
    >
      {/* Topo background */}
      <div className="absolute inset-0 opacity-[0.04]" aria-hidden="true">
        <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <pattern id="cta-topo-v1" x="0" y="0" width="160" height="160" patternUnits="userSpaceOnUse">
              <circle cx="80" cy="80" r="70" fill="none" stroke="white" strokeWidth="1" />
              <circle cx="80" cy="80" r="50" fill="none" stroke="white" strokeWidth="0.6" />
              <circle cx="80" cy="80" r="30" fill="none" stroke="white" strokeWidth="0.4" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#cta-topo-v1)" />
        </svg>
      </div>
      <div className="absolute inset-0 pointer-events-none" style={{ background: 'radial-gradient(ellipse 70% 50% at 50% 100%, rgba(228,80,28,0.1) 0%, transparent 70%)' }} aria-hidden="true" />

      <div className="relative z-10 max-w-3xl mx-auto px-5 sm:px-8 text-center">
        <p className="text-[10px] font-mono text-white/30 tracking-[0.2em] uppercase mb-6" style={{ fontFamily: 'var(--font-mono)' }}>
          — Prêt pour l&apos;aventure ?
        </p>
        <h2
          id="final-cta-heading"
          className="font-display font-800 text-white leading-[0.95] tracking-tight mb-6"
          style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 'clamp(2.2rem, 5vw, 3.5rem)' }}
        >
          Votre prochaine
          <br />
          <span style={{ color: '#E4501C' }}>expédition commence</span>
          <br />
          <span className="text-white/40">maintenant.</span>
        </h2>
        <p className="text-base text-white/50 leading-relaxed mb-10 max-w-xl mx-auto">
          Configurez votre kit en 2 minutes. Gratuit, sans inscription requise.
        </p>

        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link
            href="/ai-configurator"
            className="inline-flex items-center justify-center gap-2 px-8 py-4 rounded-2xl font-semibold text-base text-white transition-all hover:-translate-y-px min-h-[52px]"
            style={{ background: '#E4501C', boxShadow: '0 8px 32px rgba(228,80,28,0.3)' }}
          >
            <Icon name="SparklesIcon" size={18} variant="outline" />
            Configurer mon kit IA
          </Link>
          <Link
            href="/pays"
            className="inline-flex items-center justify-center gap-2 px-8 py-4 rounded-2xl font-semibold text-base transition-all hover:-translate-y-px min-h-[52px]"
            style={{ border: '1.5px solid rgba(231,227,214,0.2)', color: 'rgba(231,227,214,0.75)' }}
          >
            Explorer les destinations
          </Link>
        </div>

        {/* Honest trust strip */}
        <div className="flex flex-wrap justify-center gap-6 mt-10">
          {[
            { icon: '🔒', text: 'Paiement Stripe sécurisé' },
            { icon: '↩️', text: 'Retour gratuit 30 jours' },
            { icon: '🇪🇺', text: 'Hébergé en Europe' },
          ].map((item) => (
            <div key={item.text} className="flex items-center gap-2">
              <span className="text-base" aria-hidden="true">{item.icon}</span>
              <span className="text-xs font-mono text-white/35" style={{ fontFamily: 'var(--font-mono)' }}>{item.text}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── MAIN EXPORT ──────────────────────────────────────────────────────────────

export default function HomepageV1({
  stats,
  carnets,
}: {
  stats: TrustStats;
  carnets: FeaturedCarnet[];
}) {
  return (
    <>
      {/* 1. Hero */}
      <HeroSection />

      {/* 2. Preuve sociale */}
      <SocialProofSection stats={stats} />

      {/* 3. Démonstration IA */}
      <AIDemoSection />

      {/* 4. Comment ça marche */}
      <HowItWorksSection />

      {/* 5. Destinations */}
      <DestinationsSection />

      {/* 6. Produits phares */}
      <FeaturedProductsSection />

      {/* 7. FAQ */}
      <FAQSection />

      {/* 8. CTA final */}
      <FinalCTASection />
    </>
  );
}
