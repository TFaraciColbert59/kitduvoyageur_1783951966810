'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import AppImage from '@/components/ui/AppImage';

export default function NewHeroSection() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <section
      className="relative w-full overflow-hidden"
      style={{ minHeight: '100svh' }}
      aria-labelledby="hero-title"
    >
      {/* Background image */}
      <div className="absolute inset-0" aria-hidden="true">
        <AppImage
          src="https://images.unsplash.com/photo-1448375240586-882707db888b?w=1920&q=90"
          alt="Forêt de conifères dans la brume matinale, lumière dorée filtrant entre les arbres"
          fill
          priority
          sizes="100vw"
          className="object-cover object-center"
        />
        {/* Multi-layer gradient overlay */}
        <div
          className="absolute inset-0"
          style={{
            background: 'linear-gradient(160deg, rgba(14,21,18,0.72) 0%, rgba(14,21,18,0.45) 40%, rgba(14,21,18,0.25) 70%, rgba(14,21,18,0.15) 100%)',
          }}
        />
        <div
          className="absolute inset-0"
          style={{
            background: 'linear-gradient(to top, rgba(14,21,18,0.9) 0%, rgba(14,21,18,0.3) 35%, transparent 60%)',
          }}
        />
        {/* Subtle noise texture */}
        <div
          className="absolute inset-0 opacity-20 mix-blend-overlay"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.4'/%3E%3C/svg%3E")`,
          }}
          aria-hidden="true"
        />
      </div>
      {/* Content */}
      <div className="relative z-10 max-w-7xl mx-auto px-5 sm:px-8 lg:px-12 xl:px-16 flex flex-col justify-end" style={{ minHeight: '100svh', paddingTop: '80px', paddingBottom: '64px' }}>
        <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-10 lg:gap-16">

          {/* Left: Main content */}
          <div className="flex-1 max-w-2xl">
            {/* Eyebrow */}
            <div
              className="inline-flex items-center gap-2 mb-6 sm:mb-8"
              style={{
                background: 'rgba(255,255,255,0.08)',
                border: '1px solid rgba(255,255,255,0.15)',
                borderRadius: '999px',
                padding: '6px 14px',
                backdropFilter: 'blur(12px)',
              }}
            >
              <span
                className="w-1.5 h-1.5 rounded-full"
                style={{ background: '#6B8A7A', animation: 'pulse 2.5s ease-in-out infinite' }}
                aria-hidden="true"
              />
              <span
                style={{
                  fontSize: '10px',
                  fontFamily: 'var(--font-mono)',
                  color: 'rgba(231,227,214,0.7)',
                  letterSpacing: '0.18em',
                  textTransform: 'uppercase',
                }}
              >
                Aventures · Refuges · Boutique
              </span>
            </div>

            {/* Headline */}
            <h1
              id="hero-title"
              style={{
                fontFamily: 'var(--font-display)',
                fontWeight: 800,
                fontSize: 'clamp(3rem, 7vw, 5.5rem)',
                lineHeight: '1.0',
                letterSpacing: '-0.04em',
                color: '#FFFFFF',
                marginBottom: '8px',
              }}
            >
              Là où la carte
            </h1>
            <h1
              style={{
                fontFamily: 'var(--font-display)',
                fontWeight: 800,
                fontSize: 'clamp(3rem, 7vw, 5.5rem)',
                lineHeight: '1.0',
                letterSpacing: '-0.04em',
                color: 'rgba(255,255,255,0.55)',
                fontStyle: 'italic',
                marginBottom: '28px',
              }}
              aria-hidden="true"
            >
              se termine.
            </h1>

            <p
              style={{
                color: 'rgba(231,227,214,0.65)',
                fontSize: 'clamp(15px, 1.8vw, 18px)',
                lineHeight: '1.65',
                maxWidth: '480px',
                marginBottom: '36px',
                fontFamily: 'var(--font-sans)',
                fontWeight: 400,
              }}
            >
              Refuges bruts, sentiers oubliés, matériel choisi à la main. Le Kit du Voyageur assemble ce qu&apos;il faut, exactement, pour partir léger — sans rien laisser au hasard.
            </p>

            {/* CTAs */}
            <div className="flex flex-wrap items-center gap-3 mb-8">
              <Link
                href="/ai-configurator"
                className="inline-flex items-center gap-2.5 font-semibold transition-all duration-200 hover:-translate-y-0.5"
                style={{
                  background: '#33463C',
                  color: '#FFFFFF',
                  borderRadius: '14px',
                  padding: '14px 24px',
                  fontSize: '15px',
                  fontFamily: 'var(--font-sans)',
                  border: '1px solid rgba(255,255,255,0.12)',
                  backdropFilter: 'blur(12px)',
                  boxShadow: '0 4px 20px rgba(14,21,18,0.4)',
                }}
              >
                Composer mon sac
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M5 12h14M12 5l7 7-7 7" />
                </svg>
              </Link>
              <Link
                href="/explorer"
                className="inline-flex items-center gap-2 font-medium transition-all duration-200 hover:text-white"
                style={{
                  color: 'rgba(231,227,214,0.7)',
                  fontSize: '15px',
                  fontFamily: 'var(--font-sans)',
                  padding: '14px 20px',
                  borderRadius: '14px',
                  border: '1px solid rgba(255,255,255,0.12)',
                  backdropFilter: 'blur(8px)',
                  background: 'rgba(255,255,255,0.05)',
                }}
              >
                Voir les aventures
              </Link>
            </div>

            {/* Rating */}
            <div className="flex items-center gap-2.5">
              <div className="flex items-center gap-0.5" aria-label="Note 4.9 sur 5">
                {[1,2,3,4,5]?.map((i) => (
                  <svg key={i} width="14" height="14" viewBox="0 0 24 24" fill={i <= 4 ? '#C8A96E' : 'none'} stroke="#C8A96E" strokeWidth="1.5" aria-hidden="true">
                    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                  </svg>
                ))}
              </div>
              <span style={{ color: 'rgba(231,227,214,0.85)', fontSize: '14px', fontWeight: 600, fontFamily: 'var(--font-sans)' }}>4,9</span>
              <span style={{ color: 'rgba(231,227,214,0.45)', fontSize: '13px', fontFamily: 'var(--font-sans)' }}>· 1 800+ voyageurs racontent leur séjour</span>
            </div>
          </div>

          {/* Right: Featured refuge card */}
          <div className="lg:flex-shrink-0 lg:w-72 xl:w-80">
            <div
              style={{
                background: 'rgba(231,227,214,0.92)',
                backdropFilter: 'blur(24px)',
                WebkitBackdropFilter: 'blur(24px)',
                borderRadius: '20px',
                padding: '20px',
                border: '1px solid rgba(255,255,255,0.5)',
                boxShadow: '0 24px 64px rgba(14,21,18,0.35)',
              }}
            >
              <p
                style={{
                  fontSize: '10px',
                  fontFamily: 'var(--font-mono)',
                  color: '#6B8A7A',
                  letterSpacing: '0.18em',
                  textTransform: 'uppercase',
                  marginBottom: '10px',
                }}
              >
                Refuge en vedette
              </p>
              <h3
                style={{
                  fontFamily: 'var(--font-display)',
                  fontWeight: 700,
                  fontSize: '18px',
                  color: '#1C2620',
                  marginBottom: '16px',
                  lineHeight: '1.2',
                }}
              >
                Cabane du Grand Vaneau
              </h3>

              {/* Dates */}
              <div className="grid grid-cols-2 gap-2 mb-4">
                {[
                  { label: 'Arrivée', value: 'Ven. 14 sept.' },
                  { label: 'Départ', value: 'Lun. 17 sept.' },
                  { label: 'Arrivée', value: 'après 16h00' },
                  { label: 'Départ', value: 'avant 11h00' },
                ]?.map((item, i) => (
                  <div
                    key={i}
                    style={{
                      background: 'rgba(28,38,32,0.06)',
                      borderRadius: '10px',
                      padding: '10px 12px',
                    }}
                  >
                    <p style={{ fontSize: '10px', color: '#6B8A7A', fontFamily: 'var(--font-mono)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '3px' }}>{item?.label}</p>
                    <p style={{ fontSize: '13px', fontWeight: 600, color: '#1C2620', fontFamily: 'var(--font-sans)' }}>{item?.value}</p>
                  </div>
                ))}
              </div>

              {/* Price & guests */}
              <div className="flex items-end justify-between mb-4">
                <div>
                  <p style={{ fontSize: '10px', color: '#6B8A7A', fontFamily: 'var(--font-mono)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '2px' }}>Prix / nuit</p>
                  <p style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '28px', color: '#1C2620', lineHeight: '1' }}>248 €</p>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <p style={{ fontSize: '10px', color: '#6B8A7A', fontFamily: 'var(--font-mono)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '2px' }}>Voyageurs</p>
                  <p style={{ fontSize: '14px', fontWeight: 600, color: '#1C2620', fontFamily: 'var(--font-sans)' }}>2–4 pers.</p>
                </div>
              </div>

              <Link
                href="/explorer"
                className="block w-full text-center font-semibold transition-all duration-200 hover:opacity-90"
                style={{
                  background: '#1C2620',
                  color: '#FFFFFF',
                  borderRadius: '12px',
                  padding: '13px',
                  fontSize: '14px',
                  fontFamily: 'var(--font-sans)',
                }}
              >
                Réserver ces dates
              </Link>
            </div>
          </div>
        </div>
      </div>
      {/* Scroll indicator */}
      <div
        className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1.5"
        aria-hidden="true"
        style={{ animation: 'float 2.5s ease-in-out infinite' }}
      >
        <div style={{ width: '1px', height: '40px', background: 'linear-gradient(to bottom, transparent, rgba(255,255,255,0.4))', borderRadius: '1px' }} />
      </div>
    </section>
  );
}
