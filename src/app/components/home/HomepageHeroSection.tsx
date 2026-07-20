'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import AppImage from '@/components/ui/AppImage';


export default function HomepageHeroSection() {
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
