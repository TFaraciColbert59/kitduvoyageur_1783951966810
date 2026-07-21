'use client';

import React, { useState, useEffect, useRef } from 'react';
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

interface Kit {
  slug: string;
  name: string;
  price: number;
  weight: string;
  image: string;
  alt: string;
  tag: string;
}

// ── Data ───────────────────────────────────────────────────────────────────────
const DESTINATIONS: Destination[] = [
  { code: 'jp', name: 'Japon', tagline: 'Temples & Forêts', image: 'https://images.unsplash.com/photo-1528360983277-13d401cdc186?w=400&q=80', alt: 'Mont Fuji enneigé au lever du soleil avec cerisiers en fleurs', badge: '🌸 Printemps' },
  { code: 'no', name: 'Norvège', tagline: 'Fjords & Aurores', image: 'https://images.unsplash.com/photo-1531366936337-7c912a4589a7?w=400&q=80', alt: 'Aurores boréales vertes au-dessus d\'un fjord norvégien', badge: '❄️ Hiver' },
  { code: 'np', name: 'Népal', tagline: 'Himalaya & Trek', image: 'https://images.unsplash.com/photo-1544735716-392fe2489ffa?w=400&q=80', alt: 'Chaîne himalayenne avec l\'Everest au coucher du soleil', badge: '🏔️ Trek' },
  { code: 'nz', name: 'Nouvelle-Zélande', tagline: 'Nature & Aventure', image: 'https://images.unsplash.com/photo-1507699622108-4be3abd695ad?w=400&q=80', alt: 'Paysage de fjords verdoyants en Nouvelle-Zélande', badge: '🌿 Nature' },
  { code: 'ma', name: 'Maroc', tagline: 'Désert & Médinas', image: 'https://images.unsplash.com/photo-1539020140153-e479b8c22e70?w=400&q=80', alt: 'Dunes de sable dorées du Sahara au coucher du soleil', badge: '🌅 Désert' },
  { code: 'pt', name: 'Portugal', tagline: 'Côtes & Chemins', image: 'https://images.unsplash.com/photo-1555881400-74d7acaacd8b?w=400&q=80', alt: 'Falaises dorées de l\'Algarve avec mer turquoise', badge: '🌊 Côtes' },
];

const KITS: Kit[] = [
  { slug: 'trek-alpin', name: 'Trek Alpin', price: 349, weight: '4.2 kg', image: 'https://images.unsplash.com/photo-1551632811-561732d1e306?w=400&q=80', alt: 'Équipement de trek alpin complet avec sac à dos et matériel technique', tag: 'Bestseller' },
  { slug: 'bivouac-leger', name: 'Bivouac Léger', price: 229, weight: '2.8 kg', image: 'https://images.unsplash.com/photo-1504280390367-361c6d9f38f4?w=400&q=80', alt: 'Tente légère de bivouac installée dans une prairie alpine au coucher du soleil', tag: 'Nouveau' },
  { slug: 'voyage-urbain', name: 'Voyage Urbain', price: 189, weight: '1.9 kg', image: 'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=400&q=80', alt: 'Sac à dos urbain minimaliste avec accessoires de voyage essentiels', tag: 'Populaire' },
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

  const quickTags = ['🥾 Randonnée', '⛺ Bivouac', '🏔️ Haute altitude', '🌊 Kayak'];

  return (
    <section
      className="relative overflow-hidden"
      style={{ minHeight: '88vh' }}
      aria-labelledby="mobile-hero-heading"
    >
      {/* Background image */}
      <div className="absolute inset-0" aria-hidden="true">
        <AppImage
          src="https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=800&q=85"
          alt="Randonneur au sommet d'une montagne avec vue panoramique sur les Alpes"
          fill
          priority
          sizes="100vw"
          className="object-cover object-center"
        />
        {/* Multi-layer gradient */}
        <div
          className="absolute inset-0"
          style={{
            background: 'linear-gradient(180deg, rgba(14,21,18,0.3) 0%, rgba(14,21,18,0.1) 30%, rgba(14,21,18,0.6) 70%, rgba(14,21,18,0.95) 100%)',
          }}
        />
        {/* Noise texture */}
        <div
          className="absolute inset-0 opacity-30"
          style={{
            backgroundImage: 'url("data:image/svg+xml,%3Csvg viewBox=\'0 0 200 200\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'n\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'0.75\' numOctaves=\'4\' stitchTiles=\'stitch\'/%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23n)\' opacity=\'0.15\'/%3E%3C/svg%3E")',
            mixBlendMode: 'overlay',
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
        {/* Badge */}
        <div
          className="inline-flex items-center gap-2 self-start mb-4 animate-fade-in"
          style={{
            background: 'rgba(228,80,28,0.15)',
            border: '1px solid rgba(228,80,28,0.3)',
            borderRadius: '999px',
            padding: '5px 12px',
          }}
        >
          <span
            className="w-1.5 h-1.5 rounded-full bg-[#E4501C]"
            style={{ animation: 'pulse 2s cubic-bezier(0.4,0,0.6,1) infinite' }}
            aria-hidden="true"
          />
          <span
            style={{
              fontSize: '10px',
              fontFamily: 'var(--font-mono)',
              color: '#E4501C',
              letterSpacing: '0.15em',
              textTransform: 'uppercase',
            }}
          >
            IA · Équipement outdoor
          </span>
        </div>

        {/* Headline */}
        <h1
          id="mobile-hero-heading"
          className="text-white font-display font-extrabold animate-slide-up delay-50"
          style={{
            fontSize: 'clamp(2.4rem, 9vw, 3.5rem)',
            lineHeight: '1.0',
            letterSpacing: '-0.04em',
            marginBottom: '12px',
          }}
        >
          L&apos;équipement
          <br />
          <span style={{ color: '#E4501C' }}>intelligent</span>
          <br />
          pour chaque
          <br />
          aventure.
        </h1>

        <p
          className="text-white/60 animate-slide-up delay-100"
          style={{ fontSize: '15px', lineHeight: '1.5', marginBottom: '24px', maxWidth: '280px' }}
        >
          Décrivez votre voyage. Notre IA compose votre kit en 2 minutes.
        </p>

        {/* Search bar */}
        <form onSubmit={handleSubmit} className="animate-slide-up delay-150" style={{ marginBottom: '16px' }}>
          <div
            className="relative flex items-center"
            style={{
              background: focused ? 'rgba(255,255,255,0.14)' : 'rgba(255,255,255,0.10)',
              border: `1.5px solid ${focused ? 'rgba(228,80,28,0.6)' : 'rgba(255,255,255,0.15)'}`,
              borderRadius: '18px',
              transition: 'all 300ms cubic-bezier(0.16,1,0.3,1)',
              backdropFilter: 'blur(16px)',
              WebkitBackdropFilter: 'blur(16px)',
            }}
          >
            <svg
              className="absolute left-4"
              width="18" height="18" viewBox="0 0 24 24" fill="none"
              stroke="rgba(255,255,255,0.5)" strokeWidth="2" strokeLinecap="round"
              aria-hidden="true"
            >
              <circle cx="11" cy="11" r="7" />
              <path d="M21 21l-4.35-4.35" />
            </svg>
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
              placeholder="Trek Islande 7 jours, budget 800€…"
              className="w-full bg-transparent text-white placeholder-white/30 outline-none"
              style={{
                fontSize: '15px',
                padding: '14px 48px 14px 44px',
                fontFamily: 'var(--font-sans)',
              }}
              aria-label="Décrivez votre aventure"
            />
            <button
              type="submit"
              className="absolute right-2 flex items-center justify-center haptic-press"
              style={{
                background: '#E4501C',
                borderRadius: '12px',
                padding: '8px 14px',
                minHeight: '36px',
                color: 'white',
                fontSize: '13px',
                fontWeight: 600,
                fontFamily: 'var(--font-sans)',
              }}
              aria-label="Configurer mon kit"
            >
              IA →
            </button>
          </div>
        </form>

        {/* Quick tags */}
        <div className="flex gap-2 overflow-x-auto scrollbar-hide animate-slide-up delay-200" style={{ marginBottom: '0' }}>
          {quickTags.map((tag) => (
            <Link
              key={tag}
              href={`/ai-configurator?q=${encodeURIComponent(tag.replace(/^[^\s]+\s/, ''))}`}
              className="flex-shrink-0 haptic-press"
              style={{
                background: 'rgba(255,255,255,0.08)',
                border: '1px solid rgba(255,255,255,0.12)',
                borderRadius: '999px',
                padding: '7px 14px',
                color: 'rgba(231,227,214,0.75)',
                fontSize: '12px',
                fontWeight: 500,
                whiteSpace: 'nowrap',
                fontFamily: 'var(--font-sans)',
              }}
            >
              {tag}
            </Link>
          ))}
        </div>
      </div>

      {/* Scroll indicator */}
      <div
        className="absolute bottom-6 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1"
        aria-hidden="true"
        style={{ animation: 'float 2s ease-in-out infinite' }}
      >
        <div className="scroll-line-track">
          <div className="scroll-line-fill" />
        </div>
      </div>
    </section>
  );
}

function MobileDestinationsSection() {
  return (
    <section className="px-5 py-8" aria-labelledby="destinations-heading">
      <div className="flex items-center justify-between mb-5">
        <h2
          id="destinations-heading"
          className="font-display font-bold text-[#1C2620]"
          style={{ fontSize: '22px', letterSpacing: '-0.03em' }}
        >
          Destinations
        </h2>
        <Link
          href="/pays"
          className="text-[#E4501C] font-semibold"
          style={{ fontSize: '14px' }}
        >
          Voir tout →
        </Link>
      </div>

      {/* Horizontal scroll */}
      <div className="flex gap-3 overflow-x-auto scrollbar-hide -mx-5 px-5">
        {DESTINATIONS.map((dest, i) => (
          <Link
            key={dest.code}
            href={`/pays/${dest.code}`}
            className="flex-shrink-0 haptic-press"
            style={{
              width: '140px',
              animationDelay: `${i * 60}ms`,
            }}
          >
            <div
              className="relative overflow-hidden"
              style={{
                height: '180px',
                borderRadius: '20px',
                boxShadow: 'var(--shadow-md)',
              }}
            >
              <AppImage
                src={dest.image}
                alt={dest.alt}
                fill
                sizes="140px"
                className="object-cover"
              />
              <div
                className="absolute inset-0"
                style={{ background: 'linear-gradient(180deg, transparent 40%, rgba(14,21,18,0.85) 100%)' }}
              />
              {dest.badge && (
                <div
                  className="absolute top-3 left-3"
                  style={{
                    background: 'rgba(237,234,224,0.92)',
                    backdropFilter: 'blur(8px)',
                    borderRadius: '999px',
                    padding: '3px 8px',
                    fontSize: '10px',
                    fontWeight: 600,
                    color: '#1C2620',
                  }}
                >
                  {dest.badge}
                </div>
              )}
              <div className="absolute bottom-0 left-0 right-0 p-3">
                <p
                  className="text-white font-display font-bold"
                  style={{ fontSize: '15px', letterSpacing: '-0.02em', lineHeight: 1.2 }}
                >
                  {dest.name}
                </p>
                <p
                  className="text-white/60"
                  style={{ fontSize: '11px', marginTop: '2px' }}
                >
                  {dest.tagline}
                </p>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}

function MobileKitsSection() {
  return (
    <section
      className="px-5 py-8"
      style={{ background: '#1C2620' }}
      aria-labelledby="kits-heading"
    >
      <div className="flex items-center justify-between mb-5">
        <h2
          id="kits-heading"
          className="font-display font-bold text-white"
          style={{ fontSize: '22px', letterSpacing: '-0.03em' }}
        >
          Kits prêts à partir
        </h2>
        <Link
          href="/boutique"
          className="font-semibold"
          style={{ fontSize: '14px', color: '#E4501C' }}
        >
          Boutique →
        </Link>
      </div>

      <div className="flex flex-col gap-4">
        {KITS.map((kit, i) => (
          <Link
            key={kit.slug}
            href={`/kits/${kit.slug}`}
            className="flex items-center gap-4 haptic-press"
            style={{
              background: 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: '20px',
              padding: '14px',
              animationDelay: `${i * 80}ms`,
            }}
          >
            <div
              className="relative flex-shrink-0 overflow-hidden"
              style={{ width: '72px', height: '72px', borderRadius: '14px' }}
            >
              <AppImage
                src={kit.image}
                alt={kit.alt}
                fill
                sizes="72px"
                className="object-cover"
              />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span
                  style={{
                    background: 'rgba(228,80,28,0.15)',
                    color: '#E4501C',
                    borderRadius: '999px',
                    padding: '2px 8px',
                    fontSize: '10px',
                    fontWeight: 600,
                    letterSpacing: '0.02em',
                  }}
                >
                  {kit.tag}
                </span>
              </div>
              <p
                className="text-white font-display font-semibold truncate"
                style={{ fontSize: '16px', letterSpacing: '-0.02em' }}
              >
                {kit.name}
              </p>
              <div className="flex items-center gap-3 mt-1">
                <span className="text-white/50" style={{ fontSize: '12px' }}>
                  ⚖️ {kit.weight}
                </span>
                <span
                  className="font-display font-bold"
                  style={{ fontSize: '16px', color: '#E4501C' }}
                >
                  {kit.price}€
                </span>
              </div>
            </div>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
              <path d="M9 18l6-6-6-6" />
            </svg>
          </Link>
        ))}
      </div>
    </section>
  );
}

function MobileAISection() {
  return (
    <section
      className="mx-5 my-8 overflow-hidden"
      style={{
        background: 'linear-gradient(135deg, #1C2620 0%, #33463C 100%)',
        borderRadius: '28px',
        padding: '28px 24px',
        position: 'relative',
      }}
      aria-labelledby="ai-section-heading"
    >
      {/* Decorative orb */}
      <div
        aria-hidden="true"
        style={{
          position: 'absolute',
          top: '-40px',
          right: '-40px',
          width: '160px',
          height: '160px',
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(228,80,28,0.3) 0%, transparent 70%)',
          filter: 'blur(20px)',
        }}
      />

      <div
        className="inline-flex items-center gap-2 mb-4"
        style={{
          background: 'rgba(228,80,28,0.15)',
          border: '1px solid rgba(228,80,28,0.25)',
          borderRadius: '999px',
          padding: '4px 12px',
        }}
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="#E4501C" aria-hidden="true">
          <path d="M12 2l2 7h7l-5.5 4 2 7L12 16l-5.5 4 2-7L3 9h7z" />
        </svg>
        <span style={{ fontSize: '10px', color: '#E4501C', fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', fontFamily: 'var(--font-mono)' }}>
          Configurateur IA
        </span>
      </div>

      <h2
        id="ai-section-heading"
        className="font-display font-extrabold text-white"
        style={{ fontSize: '26px', letterSpacing: '-0.03em', lineHeight: 1.1, marginBottom: '10px' }}
      >
        Votre kit parfait
        <br />
        en 2 minutes.
      </h2>

      <p
        className="text-white/55"
        style={{ fontSize: '14px', lineHeight: 1.5, marginBottom: '24px' }}
      >
        Décrivez votre aventure. L&apos;IA analyse destination, météo, durée et budget pour composer votre équipement optimal.
      </p>

      {/* Steps */}
      <div className="flex flex-col gap-3 mb-6">
        {[
          { step: '01', text: 'Décrivez votre voyage' },
          { step: '02', text: 'L\'IA analyse vos besoins' },
          { step: '03', text: 'Recevez votre kit personnalisé' },
        ].map((item) => (
          <div key={item.step} className="flex items-center gap-3">
            <span
              className="flex-shrink-0 font-mono"
              style={{
                fontSize: '11px',
                color: '#E4501C',
                fontFamily: 'var(--font-mono)',
                width: '24px',
              }}
            >
              {item.step}
            </span>
            <div
              style={{
                flex: 1,
                height: '1px',
                background: 'rgba(255,255,255,0.08)',
              }}
            />
            <span
              className="text-white/70"
              style={{ fontSize: '13px', fontWeight: 500 }}
            >
              {item.text}
            </span>
          </div>
        ))}
      </div>

      <Link
        href="/ai-configurator"
        className="flex items-center justify-center gap-2 w-full haptic-press"
        style={{
          background: '#E4501C',
          borderRadius: '16px',
          padding: '15px',
          color: 'white',
          fontWeight: 700,
          fontSize: '15px',
          fontFamily: 'var(--font-sans)',
          boxShadow: '0 8px 24px rgba(228,80,28,0.4)',
        }}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M12 2l2 7h7l-5.5 4 2 7L12 16l-5.5 4 2-7L3 9h7z" />
        </svg>
        Configurer mon kit IA
      </Link>
    </section>
  );
}

function MobileQuickActions() {
  const actions = [
    { href: '/explorer', icon: '🗺️', label: 'Explorer', sub: 'Sentiers & cartes' },
    { href: '/pays', icon: '🌍', label: 'Destinations', sub: '50+ pays' },
    { href: '/occasion', icon: '♻️', label: 'Occasion', sub: 'Équipement d\'occasion' },
    { href: '/communaute', icon: '👥', label: 'Communauté', sub: 'Voyageurs passionnés' },
  ];

  return (
    <section className="px-5 py-6" aria-label="Actions rapides">
      <div className="grid grid-cols-2 gap-3">
        {actions.map((action, i) => (
          <Link
            key={action.href}
            href={action.href}
            className="haptic-press"
            style={{ animationDelay: `${i * 50}ms` }}
          >
            <div
              style={{
                background: '#EDEAE0',
                border: '1px solid rgba(28,38,32,0.06)',
                borderRadius: '20px',
                padding: '18px 16px',
                boxShadow: 'var(--shadow-xs)',
              }}
            >
              <span style={{ fontSize: '28px', display: 'block', marginBottom: '8px' }} aria-hidden="true">
                {action.icon}
              </span>
              <p
                className="font-display font-bold text-[#1C2620]"
                style={{ fontSize: '15px', letterSpacing: '-0.02em' }}
              >
                {action.label}
              </p>
              <p
                className="text-[#5C6B5E]"
                style={{ fontSize: '12px', marginTop: '2px' }}
              >
                {action.sub}
              </p>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────
export default function MobileHomePage() {
  return (
    <div
      className="md:hidden flex flex-col"
      style={{ background: 'var(--background)', minHeight: '100vh' }}
    >
      <MobileHeroSection />
      <MobileQuickActions />
      <MobileDestinationsSection />
      <MobileAISection />
      <MobileKitsSection />

      {/* Footer spacer for bottom tab bar */}
      <div style={{ height: 'calc(60px + env(safe-area-inset-bottom) + 16px)' }} aria-hidden="true" />
    </div>
  );
}
