'use client';

import { useState, useId } from 'react';
import { useRouter } from 'next/navigation';
import HeroMapBackground from './HeroMapBackground';

const SUGGESTIONS = [
  'Randonnée facile près de Lyon',
  'Trek Alpes 5 jours',
  'Bivouac lac de montagne',
  'Road trip Bretagne',
  'Sentier GR20 Corse',
];

export default function Hero() {
  const [query, setQuery] = useState('');
  const [focused, setFocused] = useState(false);
  const router = useRouter();
  const inputId = useId();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const q = query.trim();
    if (q) {
      router.push(`/ai-configurator?q=${encodeURIComponent(q)}`);
    }
  };

  const handleSuggestion = (s: string) => {
    setQuery(s);
    router.push(`/ai-configurator?q=${encodeURIComponent(s)}`);
  };

  return (
    <section
      className="relative min-h-[85vh] md:min-h-screen flex flex-col justify-center overflow-hidden"
      aria-labelledby="hero-heading"
    >
      {/* Map background — isMobile handled inside the component via CSS */}
      <HeroMapBackground />

      {/* Content */}
      <div className="relative z-10 max-w-7xl mx-auto px-5 sm:px-8 lg:px-12 py-20 pt-28 md:pt-32 w-full">
        <div className="max-w-3xl mx-auto md:mx-0">
          {/* Eyebrow */}
          <div className="flex items-center gap-3 mb-6 md:mb-8">
            <span
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-mono tracking-widest uppercase"
              style={{
                background: 'rgba(228,80,28,0.15)',
                color: '#E4501C',
                border: '1px solid rgba(228,80,28,0.3)',
                fontFamily: 'var(--font-mono)',
              }}
            >
              <span
                className="w-1.5 h-1.5 rounded-full bg-[#E4501C]"
                style={{ animation: 'pulse 2s cubic-bezier(0.4,0,0.6,1) infinite' }}
                aria-hidden="true"
              />
              1 169 sentiers disponibles
            </span>
          </div>

          {/* Headline */}
          <h1
            id="hero-heading"
            className="text-hero text-white mb-4 md:mb-6"
            style={{ fontFamily: 'var(--font-display)' }}
          >
            Votre prochaine<br />
            <span style={{ color: '#E4501C' }}>aventure commence</span><br />
            <span className="text-white/50">ici.</span>
          </h1>

          <p
            className="text-base md:text-lg mb-8 md:mb-10 max-w-xl leading-relaxed"
            style={{ color: 'rgba(231,227,214,0.65)' }}
          >
            Décrivez votre aventure. Notre IA compose votre kit optimal
            et vous guide vers les meilleurs sentiers de France.
          </p>

          {/* Search form — first focusable element */}
          <form onSubmit={handleSubmit} className="w-full max-w-2xl" role="search">
            <label
              htmlFor={inputId}
              className="block text-sm font-semibold mb-2"
              style={{ color: 'rgba(231,227,214,0.8)', fontFamily: 'var(--font-sans)' }}
            >
              Où pars-tu ?
            </label>
            <div className="relative">
              <div className="absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none" aria-hidden="true">
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                  <path d="M10 2C6.69 2 4 4.69 4 8c0 4.5 6 10 6 10s6-5.5 6-10c0-3.31-2.69-6-6-6zm0 8.5A2.5 2.5 0 1 1 10 5.5a2.5 2.5 0 0 1 0 5z" fill="rgba(231,227,214,0.4)"/>
                </svg>
              </div>
              <input
                id={inputId}
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onFocus={() => setFocused(true)}
                onBlur={() => setTimeout(() => setFocused(false), 150)}
                placeholder="Randonnée facile près de Lille, Trek Alpes…"
                autoComplete="off"
                className="w-full pl-12 pr-32 py-4 md:py-5 rounded-2xl text-base md:text-lg text-white placeholder-white/30 outline-none transition-all duration-200"
                style={{
                  background: 'rgba(255,255,255,0.08)',
                  border: focused
                    ? '1.5px solid rgba(228,80,28,0.7)'
                    : '1.5px solid rgba(255,255,255,0.15)',
                  backdropFilter: 'blur(12px)',
                  boxShadow: focused ? '0 0 0 3px rgba(228,80,28,0.15)' : 'none',
                }}
                aria-label="Rechercher une aventure ou un lieu"
              />
              <button
                type="submit"
                className="absolute right-2 top-1/2 -translate-y-1/2 px-5 py-2.5 rounded-xl font-semibold text-sm text-white transition-all duration-200 hover:-translate-y-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-transparent min-h-[44px] min-w-[44px]"
                style={{ background: '#E4501C' }}
                aria-label="Lancer la recherche"
              >
                <span className="hidden sm:inline">Rechercher</span>
                <svg className="sm:hidden" width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
                  <path d="M3 9h12M11 5l4 4-4 4" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </button>
            </div>

            {/* Suggestions dropdown */}
            {focused && (
              <div
                className="mt-2 rounded-xl overflow-hidden shadow-2xl"
                style={{ background: 'rgba(28,38,32,0.97)', border: '1px solid rgba(255,255,255,0.1)' }}
                role="listbox"
                aria-label="Suggestions de recherche"
              >
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    type="button"
                    role="option"
                    aria-selected={false}
                    onMouseDown={() => handleSuggestion(s)}
                    className="w-full flex items-center gap-3 px-4 py-3 text-left text-sm text-white/70 hover:text-white hover:bg-white/8 transition-colors min-h-[44px] focus-visible:outline-none focus-visible:bg-white/8"
                  >
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
                      <circle cx="6" cy="6" r="4" stroke="rgba(228,80,28,0.6)" strokeWidth="1.5"/>
                      <path d="M9.5 9.5l2.5 2.5" stroke="rgba(228,80,28,0.6)" strokeWidth="1.5" strokeLinecap="round"/>
                    </svg>
                    {s}
                  </button>
                ))}
              </div>
            )}
          </form>

          {/* Quick links */}
          <div className="flex flex-wrap gap-2 mt-5">
            {['🥾 Randonnée', '⛺ Bivouac', '🚴 Vélo', '🏔️ Trek'].map((tag) => (
              <button
                key={tag}
                type="button"
                onClick={() => handleSuggestion(tag.replace(/^[^\s]+\s/, ''))}
                className="px-3 py-1.5 rounded-full text-xs font-medium transition-all duration-150 active:scale-95 min-h-[36px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E4501C]"
                style={{
                  background: 'rgba(255,255,255,0.07)',
                  color: 'rgba(231,227,214,0.7)',
                  border: '1px solid rgba(255,255,255,0.1)',
                }}
              >
                {tag}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Scroll indicator — desktop only */}
      <div
        className="hidden md:flex absolute bottom-8 left-1/2 -translate-x-1/2 flex-col items-center gap-2 opacity-40"
        aria-hidden="true"
      >
        <span
          className="text-xs font-mono tracking-widest text-white/60 uppercase"
          style={{ fontFamily: 'var(--font-mono)' }}
        >
          Défiler
        </span>
        <div className="scroll-line-track">
          <div className="scroll-line-fill h-1/2" />
        </div>
      </div>
    </section>
  );
}
