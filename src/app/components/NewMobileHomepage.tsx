'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import AppImage from '@/components/ui/AppImage';
import AppLogo from '@/components/ui/AppLogo';

// ── Mobile Header ──────────────────────────────────────────────────────────────
function MobileHeader() {
  return (
    <header
      className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-5"
      style={{
        paddingTop: 'calc(env(safe-area-inset-top) + 12px)',
        paddingBottom: '12px',
        background: 'transparent',
      }}
    >
      <Link href="/" className="flex items-center gap-2" aria-label="Le Kit du Voyageur — Accueil">
        <AppLogo size={26} />
        <span
          style={{
            fontFamily: 'var(--font-display)',
            fontWeight: 800,
            fontSize: '15px',
            color: '#FFFFFF',
            letterSpacing: '-0.02em',
          }}
        >
          Le Kit
        </span>
      </Link>
      <Link
        href="/connexion"
        className="flex items-center justify-center"
        style={{
          width: '36px',
          height: '36px',
          background: 'rgba(255,255,255,0.12)',
          backdropFilter: 'blur(12px)',
          border: '1px solid rgba(255,255,255,0.18)',
          borderRadius: '50%',
        }}
        aria-label="Se connecter"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
          <circle cx="12" cy="7" r="4" />
        </svg>
      </Link>
    </header>
  );
}

// ── Mobile Hero ────────────────────────────────────────────────────────────────
function MobileHero() {
  const [query, setQuery] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      window.location.href = `/ai-configurator?q=${encodeURIComponent(query.trim())}`;
    }
  };

  return (
    <section
      className="relative overflow-hidden"
      style={{ minHeight: '100svh' }}
      aria-labelledby="mobile-hero-title"
    >
      {/* Background */}
      <div className="absolute inset-0" aria-hidden="true">
        <AppImage
          src="https://images.unsplash.com/photo-1448375240586-882707db888b?w=800&q=85"
          alt="Forêt de conifères dans la brume matinale"
          fill
          priority
          sizes="100vw"
          className="object-cover object-center"
        />
        <div
          className="absolute inset-0"
          style={{
            background: 'linear-gradient(180deg, rgba(14,21,18,0.4) 0%, rgba(14,21,18,0.15) 30%, rgba(14,21,18,0.65) 65%, rgba(14,21,18,0.97) 100%)',
          }}
        />
      </div>

      {/* Content */}
      <div
        className="relative z-10 flex flex-col justify-end px-5"
        style={{
          minHeight: '100svh',
          paddingTop: 'calc(env(safe-area-inset-top) + 80px)',
          paddingBottom: '32px',
        }}
      >
        {/* Eyebrow */}
        <div
          className="inline-flex items-center gap-2 self-start mb-5"
          style={{
            background: 'rgba(255,255,255,0.08)',
            border: '1px solid rgba(255,255,255,0.14)',
            borderRadius: '999px',
            padding: '5px 12px',
            backdropFilter: 'blur(10px)',
          }}
        >
          <span
            className="w-1.5 h-1.5 rounded-full"
            style={{ background: '#6B8A7A', animation: 'pulse 2.5s ease-in-out infinite' }}
            aria-hidden="true"
          />
          <span style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', color: 'rgba(231,227,214,0.65)', letterSpacing: '0.15em', textTransform: 'uppercase' }}>
            Aventures · Refuges · Boutique
          </span>
        </div>

        {/* Headline */}
        <h1
          id="mobile-hero-title"
          style={{
            fontFamily: 'var(--font-display)',
            fontWeight: 800,
            fontSize: 'clamp(2.6rem, 10vw, 3.5rem)',
            lineHeight: '1.0',
            letterSpacing: '-0.04em',
            color: '#FFFFFF',
            marginBottom: '6px',
          }}
        >
          Là où la carte
        </h1>
        <h2
          style={{
            fontFamily: 'var(--font-display)',
            fontWeight: 800,
            fontSize: 'clamp(2.6rem, 10vw, 3.5rem)',
            lineHeight: '1.0',
            letterSpacing: '-0.04em',
            color: 'rgba(255,255,255,0.5)',
            fontStyle: 'italic',
            marginBottom: '20px',
          }}
          aria-hidden="true"
        >
          se termine.
        </h2>

        <p
          style={{
            color: 'rgba(231,227,214,0.6)',
            fontSize: '15px',
            lineHeight: '1.6',
            maxWidth: '300px',
            marginBottom: '24px',
            fontFamily: 'var(--font-sans)',
          }}
        >
          Refuges bruts, sentiers oubliés, matériel choisi à la main.
        </p>

        {/* Search */}
        <form onSubmit={handleSubmit} style={{ marginBottom: '16px' }}>
          <div
            className="relative flex items-center"
            style={{
              background: 'rgba(255,255,255,0.09)',
              border: '1.5px solid rgba(255,255,255,0.14)',
              borderRadius: '16px',
              backdropFilter: 'blur(16px)',
            }}
          >
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Trek Islande 7 jours…"
              className="w-full bg-transparent text-white placeholder-white/30 outline-none"
              style={{ fontSize: '15px', padding: '14px 100px 14px 16px', fontFamily: 'var(--font-sans)' }}
              aria-label="Décrivez votre aventure"
            />
            <button
              type="submit"
              style={{
                position: 'absolute',
                right: '6px',
                background: '#33463C',
                borderRadius: '12px',
                padding: '9px 14px',
                color: 'white',
                fontSize: '13px',
                fontWeight: 600,
                fontFamily: 'var(--font-sans)',
                border: '1px solid rgba(255,255,255,0.1)',
                whiteSpace: 'nowrap',
              }}
              aria-label="Composer mon kit"
            >
              Composer →
            </button>
          </div>
        </form>

        {/* Quick tags */}
        <div className="flex gap-2 overflow-x-auto" style={{ scrollbarWidth: 'none', marginBottom: '0' }}>
          {['🥾 Randonnée', '⛺ Bivouac', '🏔️ Trek', '🌊 Kayak'].map((tag) => (
            <Link
              key={tag}
              href={`/ai-configurator?q=${encodeURIComponent(tag.replace(/^[^\s]+\s/, ''))}`}
              className="flex-shrink-0"
              style={{
                background: 'rgba(255,255,255,0.07)',
                border: '1px solid rgba(255,255,255,0.11)',
                borderRadius: '999px',
                padding: '7px 14px',
                color: 'rgba(231,227,214,0.7)',
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
    </section>
  );
}

// ── Mobile Adventures ──────────────────────────────────────────────────────────
const MOBILE_ADVENTURES = [
  {
    title: 'Chartreuse',
    subtitle: 'sentier des balcons',
    meta: '4 jours · 68 km',
    image: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=600&q=80',
    alt: 'Vue aérienne du massif de la Chartreuse avec sentiers de randonnée',
  },
  {
    title: 'Bivouac étoilé',
    subtitle: 'Vercors',
    meta: '2 nuits',
    image: 'https://images.unsplash.com/photo-1504280390367-361c6d9f38f4?w=600&q=80',
    alt: 'Tente de bivouac sous un ciel étoilé dans le Vercors',
  },
  {
    title: 'Kayak',
    subtitle: 'Serre-Ponçon',
    meta: '1 jour',
    image: 'https://images.unsplash.com/photo-1544551763-46a013bb70d5?w=600&q=80',
    alt: 'Kayakiste sur le lac de Serre-Ponçon avec montagnes',
  },
];

function MobileAdventures() {
  return (
    <section className="py-12 px-5" style={{ background: 'var(--background)' }} aria-labelledby="mobile-adventures-title">
      <div className="mb-8">
        <h2
          id="mobile-adventures-title"
          style={{
            fontFamily: 'var(--font-display)',
            fontWeight: 800,
            fontSize: 'clamp(1.8rem, 7vw, 2.4rem)',
            lineHeight: '1.1',
            letterSpacing: '-0.035em',
            color: '#1C2620',
          }}
        >
          Trois façons de se{' '}
          <em style={{ fontStyle: 'italic', color: '#4A6355' }}>perdre.</em>
        </h2>
      </div>

      <div className="flex flex-col gap-4">
        {MOBILE_ADVENTURES.map((adv) => (
          <Link
            key={adv.title}
            href="/explorer"
            className="relative overflow-hidden block"
            style={{ borderRadius: '18px', aspectRatio: '16/9' }}
            aria-label={`Découvrir ${adv.title} ${adv.subtitle}`}
          >
            <AppImage
              src={adv.image}
              alt={adv.alt}
              fill
              sizes="100vw"
              className="object-cover"
            />
            <div
              className="absolute inset-0"
              style={{ background: 'linear-gradient(to top, rgba(14,21,18,0.8) 0%, transparent 60%)' }}
              aria-hidden="true"
            />
            <div
              className="absolute top-3 left-3"
              style={{
                background: 'rgba(255,255,255,0.12)',
                backdropFilter: 'blur(8px)',
                border: '1px solid rgba(255,255,255,0.16)',
                borderRadius: '999px',
                padding: '4px 10px',
              }}
            >
              <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.85)', fontFamily: 'var(--font-mono)' }}>{adv.meta}</span>
            </div>
            <div className="absolute bottom-0 left-0 right-0 p-4">
              <p style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '18px', color: '#FFFFFF', lineHeight: '1.2' }}>{adv.title}</p>
              <p style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: '15px', color: 'rgba(255,255,255,0.6)', fontStyle: 'italic' }}>{adv.subtitle}</p>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}

// ── Mobile Promise ─────────────────────────────────────────────────────────────
function MobilePromise() {
  const stats = [
    { value: '47+', label: 'Refuges partenaires' },
    { value: '1,4 kg', label: 'Sac de base' },
    { value: '6 sem.', label: 'Test terrain' },
    { value: '100%', label: 'Fabriqué en Europe' },
  ];

  return (
    <section className="py-12 px-5" style={{ background: '#1C2620' }} aria-labelledby="mobile-promise-title">
      <p style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', color: '#6B8A7A', letterSpacing: '0.18em', textTransform: 'uppercase', marginBottom: '16px' }}>
        Notre promesse
      </p>
      <h2
        id="mobile-promise-title"
        style={{
          fontFamily: 'var(--font-display)',
          fontWeight: 800,
          fontSize: 'clamp(2rem, 8vw, 2.8rem)',
          lineHeight: '1.1',
          letterSpacing: '-0.04em',
          color: '#FFFFFF',
          marginBottom: '16px',
        }}
      >
        Un sac. Une carte.
        <br />
        Le <em style={{ fontStyle: 'italic', color: 'rgba(255,255,255,0.45)' }}>reste</em> vient de vous.
      </h2>
      <p style={{ color: 'rgba(231,227,214,0.5)', fontSize: '15px', lineHeight: '1.65', marginBottom: '32px', fontFamily: 'var(--font-sans)' }}>
        Nous testons chaque objet en conditions réelles pendant six semaines minimum.
      </p>

      {/* Image */}
      <div className="relative overflow-hidden mb-8" style={{ borderRadius: '18px', aspectRatio: '4/3' }}>
        <AppImage
          src="https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=800&q=80"
          alt="Randonneur sur un sentier de montagne dans la Chartreuse"
          fill
          sizes="100vw"
          className="object-cover"
        />
        <div className="absolute bottom-4 left-4 right-4" style={{ background: 'rgba(14,21,18,0.65)', backdropFilter: 'blur(10px)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', padding: '10px 14px' }}>
          <p style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', color: '#6B8A7A', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: '2px' }}>Reportage</p>
          <p style={{ fontSize: '13px', fontWeight: 600, color: '#FFFFFF', fontFamily: 'var(--font-sans)' }}>Trois jours dans la Chartreuse</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-5">
        {stats.map((stat) => (
          <div key={stat.label}>
            <p style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '2rem', color: '#FFFFFF', lineHeight: '1', letterSpacing: '-0.03em', marginBottom: '4px' }}>{stat.value}</p>
            <p style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', color: '#6B8A7A', letterSpacing: '0.12em', textTransform: 'uppercase' }}>{stat.label}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

// ── Mobile Product ─────────────────────────────────────────────────────────────
function MobileProduct() {
  return (
    <section className="py-12 px-5" style={{ background: 'var(--background)' }} aria-labelledby="mobile-product-title">
      <p style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', color: '#6B8A7A', letterSpacing: '0.18em', textTransform: 'uppercase', marginBottom: '12px' }}>
        Le sac essentiel
      </p>
      <h2
        id="mobile-product-title"
        style={{
          fontFamily: 'var(--font-display)',
          fontWeight: 800,
          fontSize: 'clamp(1.8rem, 7vw, 2.4rem)',
          lineHeight: '1.1',
          letterSpacing: '-0.035em',
          color: '#1C2620',
          marginBottom: '20px',
        }}
      >
        45 L, <em style={{ fontStyle: 'italic', color: '#4A6355' }}>toile cirée,</em>
        <br />
        rien de superflu.
      </h2>

      {/* Image */}
      <div className="relative overflow-hidden mb-6" style={{ borderRadius: '18px', background: '#E0DDD0', aspectRatio: '4/3' }}>
        <div
          className="absolute top-4 left-4 z-10"
          style={{
            background: 'rgba(231,227,214,0.92)',
            backdropFilter: 'blur(10px)',
            border: '1px solid rgba(28,38,32,0.1)',
            borderRadius: '999px',
            padding: '5px 12px',
          }}
        >
          <span style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', color: '#4A6355', letterSpacing: '0.08em' }}>✦ Édition automne</span>
        </div>
        <AppImage
          src="https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=700&q=80"
          alt="Sac à dos 45 litres en toile cirée couleur kaki, édition automne"
          fill
          sizes="100vw"
          className="object-cover object-center"
        />
      </div>

      {/* Specs */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        {[
          { label: 'Volume', value: '45 litres' },
          { label: 'Poids à sec', value: '1,4 kg' },
          { label: 'Toile', value: 'Coton huilé 12 oz' },
          { label: 'Garantie', value: 'À vie' },
        ].map((spec) => (
          <div key={spec.label}>
            <p style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', color: '#9AAD9E', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: '3px' }}>{spec.label}</p>
            <p style={{ fontSize: '14px', fontWeight: 600, color: '#1C2620', fontFamily: 'var(--font-sans)' }}>{spec.value}</p>
          </div>
        ))}
      </div>

      <div style={{ borderTop: '1px solid rgba(28,38,32,0.1)', paddingTop: '20px', marginBottom: '20px' }}>
        <p style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '2.2rem', color: '#1C2620', lineHeight: '1', letterSpacing: '-0.03em' }}>340 €</p>
      </div>

      <div className="flex gap-3">
        <Link
          href="/boutique"
          className="flex-1 text-center font-semibold"
          style={{
            background: '#1C2620',
            color: '#FFFFFF',
            borderRadius: '14px',
            padding: '14px',
            fontSize: '15px',
            fontFamily: 'var(--font-sans)',
          }}
        >
          Ajouter au sac
        </Link>
        <Link
          href="/boutique"
          className="flex-shrink-0 text-center font-medium"
          style={{
            color: '#4A6355',
            fontSize: '15px',
            fontFamily: 'var(--font-sans)',
            padding: '14px 18px',
            borderRadius: '14px',
            border: '1px solid rgba(28,38,32,0.15)',
          }}
        >
          Fiche
        </Link>
      </div>
    </section>
  );
}

// ── Mobile Footer ──────────────────────────────────────────────────────────────
function MobileFooter() {
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (email.trim()) setSubmitted(true);
  };

  return (
    <footer style={{ background: '#0E1512', paddingBottom: 'calc(env(safe-area-inset-bottom) + 80px)' }} role="contentinfo">
      <div className="px-5 pt-12 pb-8">
        <h2
          style={{
            fontFamily: 'var(--font-display)',
            fontWeight: 800,
            fontSize: 'clamp(1.6rem, 6vw, 2.2rem)',
            lineHeight: '1.15',
            letterSpacing: '-0.04em',
            color: '#FFFFFF',
            marginBottom: '32px',
          }}
        >
          Ce que vous emportez,{' '}
          <em style={{ fontStyle: 'italic', color: 'rgba(255,255,255,0.4)' }}>c&apos;est votre voyage.</em>
        </h2>

        {/* Newsletter */}
        <p style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', color: '#4A6355', letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: '8px' }}>
          Recevez le journal
        </p>
        <p style={{ fontSize: '13px', color: 'rgba(231,227,214,0.4)', fontFamily: 'var(--font-sans)', marginBottom: '12px' }}>
          Un essai par saison. Rien d&apos;autre.
        </p>

        {submitted ? (
          <p style={{ fontSize: '13px', color: '#6B8A7A', fontFamily: 'var(--font-sans)', marginBottom: '32px' }}>✓ Vous êtes inscrit.</p>
        ) : (
          <form onSubmit={handleSubmit} className="flex gap-2 mb-10">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="votre@email.fr"
              required
              className="flex-1 min-w-0 outline-none"
              style={{
                background: 'rgba(255,255,255,0.06)',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: '10px',
                padding: '11px 14px',
                fontSize: '14px',
                color: '#FFFFFF',
                fontFamily: 'var(--font-sans)',
              }}
              aria-label="Votre adresse email"
            />
            <button
              type="submit"
              style={{
                background: '#33463C',
                color: '#FFFFFF',
                borderRadius: '10px',
                padding: '11px 16px',
                fontSize: '14px',
                fontWeight: 600,
                fontFamily: 'var(--font-sans)',
                border: '1px solid rgba(255,255,255,0.1)',
                whiteSpace: 'nowrap',
              }}
            >
              S&apos;abonner
            </button>
          </form>
        )}

        {/* Links */}
        <div className="grid grid-cols-2 gap-6 mb-10">
          {[
            { title: 'Découvrir', links: [{ label: 'Aventures', href: '/explorer' }, { label: 'Refuges', href: '/explorer' }, { label: 'Guides', href: '/guides' }, { label: 'Communauté', href: '/communaute' }] },
            { title: 'Boutique', links: [{ label: 'Le sac', href: '/boutique' }, { label: 'Bivouac', href: '/boutique' }, { label: 'Vêtements', href: '/boutique' }, { label: 'Contact', href: '/contact' }] },
          ].map((col) => (
            <div key={col.title}>
              <p style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', color: '#4A6355', letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: '12px' }}>{col.title}</p>
              <ul className="space-y-2.5">
                {col.links.map((link) => (
                  <li key={link.label}>
                    <Link href={link.href} style={{ fontSize: '14px', color: 'rgba(231,227,214,0.4)', fontFamily: 'var(--font-sans)' }} className="hover:text-white transition-colors">{link.label}</Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '20px' }}>
          <p style={{ fontSize: '12px', color: 'rgba(231,227,214,0.2)', fontFamily: 'var(--font-sans)' }}>
            © 2026 Le Kit du Voyageur · Grenoble, France
          </p>
        </div>
      </div>
    </footer>
  );
}

// ── Main Export ────────────────────────────────────────────────────────────────
export default function NewMobileHomepage() {
  return (
    <>
      <MobileHeader />
      <main id="main-content">
        <MobileHero />
        <MobileAdventures />
        <MobilePromise />
        <MobileProduct />
        <MobileFooter />
      </main>
    </>
  );
}
