'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import AppImage from '@/components/ui/AppImage';

// ── Types ──────────────────────────────────────────────────────────────────────
interface Destination {
  code: string;
  name: string;
  tagline: string;
  image: string;
  alt: string;
  badge?: string;
}

// ── Data ───────────────────────────────────────────────────────────────────────
const DESTINATIONS: Destination[] = [
  { code: 'is', name: 'Islande', tagline: 'Glaciers & Volcans', image: 'https://images.unsplash.com/photo-1476610283129-25f0ec6cb194?w=400&q=80', alt: 'Paysage volcanique islandais', badge: '🏔️ Trek' },
  { code: 'no', name: 'Norvège', tagline: 'Fjords sauvages', image: 'https://images.unsplash.com/photo-1531366936337-7c912a4589a7?w=400&q=80', alt: 'Aurores boréales et fjords', badge: '❄️ Hiver' },
  { code: 'nz', name: 'Nelle-Zélande', tagline: 'Terre d\'Aventure', image: 'https://images.unsplash.com/photo-1507699622108-4be3abd695ad?w=400&q=80', alt: 'Fjords verdoyants en NZ', badge: '🌿 Nature' },
];

// ── Sub-components ─────────────────────────────────────────────────────────────

function MobileHeroSection() {
  const [query, setQuery] = useState('');
  const [focused, setFocused] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      window.location.href = `/ai-configurator?q=${encodeURIComponent(query.trim())}`;
    }
  };

  const quickTags = ['🥾 Bivouac', '🏔️ Alpinisme', '🌲 Forêt'];

  return (
    <section
      className="relative overflow-hidden"
      style={{ minHeight: '88vh' }}
      aria-labelledby="mobile-hero-heading"
    >
      {/* Background image */}
      <div className="absolute inset-0" aria-hidden="true">
        <AppImage
          src="https://images.unsplash.com/photo-1542224566-6e85f2e6772f?w=800&q=85"
          alt="Forêt de pins dans la brume"
          fill
          priority
          sizes="100vw"
          className="object-cover object-center"
        />
        {/* Multi-layer gradient */}
        <div
          className="absolute inset-0"
          style={{
            background: 'linear-gradient(180deg, rgba(26,31,28,0.2) 0%, rgba(26,31,28,0.4) 40%, rgba(26,31,28,0.95) 85%, #1A1F1C 100%)',
          }}
        />
      </div>

      {/* Content */}
      <div
        className="relative z-10 flex flex-col justify-end px-5"
        style={{
          minHeight: '88vh',
          paddingTop: 'calc(env(safe-area-inset-top) + 64px)',
          paddingBottom: '32px',
        }}
      >
        <div
          className="inline-flex items-center gap-2 self-start mb-4 animate-fade-in"
        >
          <span
            className="w-1.5 h-1.5 rounded-full bg-forest-400"
            style={{ animation: 'pulse 2s cubic-bezier(0.4,0,0.6,1) infinite' }}
            aria-hidden="true"
          />
          <span className="text-[10px] font-mono text-forest-200 tracking-[0.15em] uppercase">
            Système IA
          </span>
        </div>

        {/* Headline */}
        <h1
          id="mobile-hero-heading"
          className="text-white font-display font-bold animate-slide-up delay-50 mb-4"
          style={{
            fontSize: 'clamp(2.4rem, 10vw, 3.5rem)',
            lineHeight: '1.05',
            letterSpacing: '-0.04em',
          }}
        >
          Là où la carte
          <br />
          <span className="italic text-forest-200 font-serif">se termine.</span>
        </h1>

        <p
          className="text-sand-200/80 animate-slide-up delay-100 text-[15px] leading-relaxed mb-6 max-w-[280px]"
        >
          Décrivez votre expédition. Notre IA assemble le kit optimal.
        </p>

        {/* Search bar */}
        <form onSubmit={handleSubmit} className="animate-slide-up delay-150 mb-4">
          <div
            className={`relative flex items-center rounded-2xl transition-all duration-300 backdrop-blur-md
              ${focused ? 'bg-white/15 border-forest-400/50' : 'bg-white/5 border-white/10'}`}
            style={{ border: '1px solid' }}
          >
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
              placeholder="Trek Vercors 4 jours, froid..."
              className="w-full bg-transparent text-white placeholder-white/40 outline-none text-[15px] py-4 pl-4 pr-14 font-sans"
              aria-label="Décrivez votre aventure"
            />
            <button
              type="submit"
              className="absolute right-2 flex items-center justify-center bg-forest-600 rounded-xl h-10 px-4 text-white text-[13px] font-semibold haptic-press"
              aria-label="Configurer mon kit"
            >
              Créer →
            </button>
          </div>
        </form>

        {/* Quick tags */}
        <div className="flex gap-2 overflow-x-auto scrollbar-hide animate-slide-up delay-200 -mx-5 px-5">
          {quickTags.map((tag) => (
            <Link
              key={tag}
              href={`/ai-configurator?q=${encodeURIComponent(tag.replace(/^[^\s]+\s/, ''))}`}
              className="flex-shrink-0 haptic-press bg-white/5 border border-white/10 rounded-full px-4 py-2 text-sand-200/80 text-[13px] font-medium whitespace-nowrap"
            >
              {tag}
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}

function MobileDestinationsSection() {
  return (
    <section className="px-5 py-12 bg-sand-50" aria-labelledby="destinations-heading">
      <div className="flex items-end justify-between mb-8">
        <h2
          id="destinations-heading"
          className="font-display font-bold text-forest-900 text-[26px] tracking-tight leading-tight"
        >
          Trois façons<br /><span className="italic font-serif">de se perdre</span>.
        </h2>
      </div>

      <div className="flex flex-col gap-6">
        {DESTINATIONS.map((dest, i) => (
          <Link
            key={dest.code}
            href={`/pays/${dest.code}`}
            className="group relative h-[300px] w-full rounded-2xl overflow-hidden haptic-press"
            style={{ animationDelay: `${i * 60}ms` }}
          >
            <AppImage
              src={dest.image}
              alt={dest.alt}
              fill
              className="object-cover transition-transform duration-700 group-hover:scale-105"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-forest-900/90 via-forest-900/20 to-transparent" />
            
            <div className="absolute bottom-0 left-0 right-0 p-6">
              {dest.badge && (
                <div className="mb-3 inline-block bg-white/10 backdrop-blur-md rounded-full px-3 py-1 text-[11px] font-mono text-sand-50 border border-white/20">
                  {dest.badge}
                </div>
              )}
              <h3 className="text-white font-display font-bold text-2xl tracking-tight mb-1">
                {dest.name}
              </h3>
              <p className="text-sand-200/70 text-sm">
                {dest.tagline}
              </p>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}

function MobileFeaturedProductSection() {
  return (
    <section className="px-5 py-16 bg-sand-100" aria-labelledby="featured-product-heading">
      <div className="mb-8">
        <div className="text-[10px] font-mono text-forest-600 tracking-[0.15em] uppercase mb-4">
          L&apos;Essentiel
        </div>
        <h2
          id="featured-product-heading"
          className="font-display font-bold text-forest-900 text-[32px] tracking-tight leading-[1.1]"
        >
          45 L, toile cirée, <br/><span className="italic font-serif text-forest-700">rien de superflu.</span>
        </h2>
      </div>

      <div className="relative aspect-[4/5] rounded-3xl overflow-hidden mb-8 shadow-green-lg">
        <AppImage
          src="https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=800&q=80"
          alt="Sac à dos 45L en toile cirée"
          fill
          className="object-cover"
        />
      </div>

      <div className="grid grid-cols-2 gap-y-6 gap-x-4 mb-8">
        <div>
          <p className="text-forest-900/50 font-mono text-[11px] uppercase mb-1">Poids</p>
          <p className="font-semibold text-forest-900">1.4 kg</p>
        </div>
        <div>
          <p className="text-forest-900/50 font-mono text-[11px] uppercase mb-1">Matériau</p>
          <p className="font-semibold text-forest-900">Toile cirée 18oz</p>
        </div>
        <div>
          <p className="text-forest-900/50 font-mono text-[11px] uppercase mb-1">Garantie</p>
          <p className="font-semibold text-forest-900">À vie</p>
        </div>
        <div>
          <p className="text-forest-900/50 font-mono text-[11px] uppercase mb-1">Prix</p>
          <p className="font-semibold text-forest-900">340 €</p>
        </div>
      </div>

      <Link
        href="/boutique/sac-45l"
        className="flex items-center justify-center w-full bg-forest-900 text-sand-50 rounded-full py-4 text-[15px] font-semibold haptic-press"
      >
        Découvrir le sac →
      </Link>
    </section>
  );
}

function MobileAISection() {
  return (
    <section
      className="py-16 px-5 bg-forest-900"
      aria-labelledby="ai-section-heading"
    >
      <div className="text-[10px] font-mono text-forest-300 tracking-[0.15em] uppercase mb-4">
        Le Système IA
      </div>
      
      <h2
        id="ai-section-heading"
        className="font-display font-bold text-sand-50 text-[32px] tracking-tight leading-[1.1] mb-6"
      >
        Un sac.<br /><span className="italic font-serif">Une carte.</span>
      </h2>

      <p className="text-forest-200/80 text-[15px] leading-relaxed mb-10">
        Pas de liste de matériel infinie. Dites-nous où vous allez, notre IA assemble exactement ce qu&apos;il vous faut pour survivre et profiter.
      </p>

      {/* Stats grid */}
      <div className="grid grid-cols-2 gap-4 mb-10">
        <div className="bg-white/5 border border-white/10 rounded-2xl p-5">
          <p className="text-forest-300 font-mono text-[11px] uppercase mb-2">Combinaisons</p>
          <p className="text-sand-50 font-display font-bold text-2xl">45k+</p>
        </div>
        <div className="bg-white/5 border border-white/10 rounded-2xl p-5">
          <p className="text-forest-300 font-mono text-[11px] uppercase mb-2">Précision</p>
          <p className="text-sand-50 font-display font-bold text-2xl">99%</p>
        </div>
        <div className="bg-white/5 border border-white/10 rounded-2xl p-5">
          <p className="text-forest-300 font-mono text-[11px] uppercase mb-2">Temps gagné</p>
          <p className="text-sand-50 font-display font-bold text-2xl">~4h</p>
        </div>
        <div className="bg-white/5 border border-white/10 rounded-2xl p-5 flex items-center justify-center">
          <Link href="/ai-configurator" className="w-12 h-12 rounded-full bg-forest-600 flex items-center justify-center text-white haptic-press">
            →
          </Link>
        </div>
      </div>
    </section>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────
export default function MobileHomePage() {
  return (
    <div
      className="md:hidden flex flex-col bg-sand-50"
      style={{ minHeight: '100vh' }}
    >
      <MobileHeroSection />
      <MobileDestinationsSection />
      <MobileAISection />
      <MobileFeaturedProductSection />

      {/* Footer spacer for bottom tab bar */}
      <div style={{ height: 'calc(60px + env(safe-area-inset-bottom) + 16px)' }} aria-hidden="true" />
    </div>
  );
}

