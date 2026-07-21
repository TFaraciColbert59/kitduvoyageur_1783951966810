'use client';

import Link from 'next/link';
import { useRef, useState, useEffect } from 'react';

interface BentoTile {
  id: string;
  title: string;
  subtitle: string;
  href: string;
  emoji: string;
  accent: string;
  bg: string;
  span?: 'large' | 'normal';
  badge?: string;
}

const TILES: BentoTile[] = [
  {
    id: 'kit',
    title: 'Kit du Voyageur IA',
    subtitle: 'Configurez votre équipement parfait en 2 minutes avec notre IA',
    href: '/ai-configurator',
    emoji: '🎒',
    accent: '#E4501C',
    bg: 'linear-gradient(135deg, #1C2620 0%, #2a3d30 100%)',
    span: 'large',
    badge: 'IA · 2 min',
  },
  {
    id: 'carte',
    title: 'Carte des aventures',
    subtitle: '1 169 sentiers GR/GRP/PR',
    href: '/explorer',
    emoji: '🗺️',
    accent: '#3A6EA5',
    bg: 'linear-gradient(135deg, #0d1e2e 0%, #1a3550 100%)',
  },
  {
    id: 'marketplace',
    title: 'Marketplace',
    subtitle: 'Occasion, enchères, location',
    href: '/boutique',
    emoji: '🔍',
    accent: '#B5652D',
    bg: 'linear-gradient(135deg, #2a1a0e 0%, #3d2510 100%)',
  },
  {
    id: 'trust',
    title: 'Trust Score',
    subtitle: 'Avis vérifiés par expédition',
    href: '/avis',
    emoji: '⭐',
    accent: '#5C8A3A',
    bg: 'linear-gradient(135deg, #0f1e0f 0%, #1a3020 100%)',
  },
  {
    id: 'carnets',
    title: 'Carnets d\'expédition',
    subtitle: 'Récits vérifiés de la communauté',
    href: '/carnets',
    emoji: '📖',
    accent: '#3A6EA5',
    bg: 'linear-gradient(135deg, #0d1a2a 0%, #152840 100%)',
  },
  {
    id: 'communaute',
    title: 'Communauté',
    subtitle: 'Clubs, groupes, événements',
    href: '/communaute',
    emoji: '🌍',
    accent: '#5C8A3A',
    bg: 'linear-gradient(135deg, #101e10 0%, #1c3020 100%)',
  },
];

export default function BentoGrid() {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [activeIdx, setActiveIdx] = useState(0);
  const [prefersReduced, setPrefersReduced] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setPrefersReduced(mq.matches);
    const h = (e: MediaQueryListEvent) => setPrefersReduced(e.matches);
    mq.addEventListener('change', h);
    return () => mq.removeEventListener('change', h);
  }, []);

  // Track scroll position for dot indicators
  const handleScroll = () => {
    if (!scrollRef.current) return;
    const { scrollLeft, clientWidth } = scrollRef.current;
    const idx = Math.round(scrollLeft / (clientWidth * 0.85));
    setActiveIdx(Math.max(0, Math.min(idx, TILES.length - 1)));
  };

  // Keyboard navigation for carousel
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!scrollRef.current) return;
    const tileWidth = scrollRef.current.clientWidth * 0.85;
    if (e.key === 'ArrowRight') {
      e.preventDefault();
      scrollRef.current.scrollBy({ left: tileWidth, behavior: prefersReduced ? 'auto' : 'smooth' });
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      scrollRef.current.scrollBy({ left: -tileWidth, behavior: prefersReduced ? 'auto' : 'smooth' });
    }
  };

  const largeTile = TILES.find((t) => t.span === 'large')!;
  const normalTiles = TILES.filter((t) => t.span !== 'large');

  return (
    <section
      className="py-16 md:py-24"
      style={{ background: 'var(--background)' }}
      aria-labelledby="bento-heading"
    >
      <div className="max-w-7xl mx-auto px-5 sm:px-8 lg:px-12">
        {/* Section header */}
        <div className="flex items-end justify-between mb-8 md:mb-12">
          <div>
            <p
              className="text-xs font-mono uppercase tracking-widest mb-2"
              style={{ color: 'var(--primary)', fontFamily: 'var(--font-mono)' }}
            >
              — Modules
            </p>
            <h2
              id="bento-heading"
              className="text-section-title"
              style={{ color: 'var(--foreground)' }}
            >
              Tout pour votre<br />
              <span style={{ color: 'var(--primary)' }}>prochaine aventure.</span>
            </h2>
          </div>
        </div>

        {/* ── DESKTOP: asymmetric bento grid ── */}
        <div
          className="hidden md:grid gap-4"
          style={{ gridTemplateColumns: '2fr 1fr 1fr', gridTemplateRows: 'auto auto' }}
        >
          {/* Large tile — col-span-1 row-span-2 */}
          <Link
            href={largeTile.href}
            className="group relative rounded-2xl overflow-hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E4501C] focus-visible:ring-offset-2"
            style={{
              background: largeTile.bg,
              gridRow: 'span 2',
              minHeight: 320,
            }}
            aria-label={`${largeTile.title} — ${largeTile.subtitle}`}
          >
            <div
              className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
              style={{ background: 'rgba(228,80,28,0.06)' }}
              aria-hidden="true"
            />
            <div
              className="absolute inset-0 transition-transform duration-300 group-hover:-translate-y-0.5"
              style={{ transform: 'translateY(0)' }}
            >
              <div className="p-8 h-full flex flex-col justify-between">
                <div>
                  <div className="flex items-start justify-between mb-6">
                    <span className="text-5xl" aria-hidden="true">{largeTile.emoji}</span>
                    {largeTile.badge && (
                      <span
                        className="px-3 py-1 rounded-full text-xs font-mono font-semibold"
                        style={{
                          background: `${largeTile.accent}25`,
                          color: largeTile.accent,
                          border: `1px solid ${largeTile.accent}40`,
                          fontFamily: 'var(--font-mono)',
                        }}
                      >
                        {largeTile.badge}
                      </span>
                    )}
                  </div>
                  <h3
                    className="font-display font-bold text-white text-2xl mb-3 leading-tight"
                    style={{ fontFamily: 'var(--font-display)' }}
                  >
                    {largeTile.title}
                  </h3>
                  <p className="text-sm leading-relaxed" style={{ color: 'rgba(231,227,214,0.6)' }}>
                    {largeTile.subtitle}
                  </p>
                </div>
                <div
                  className="inline-flex items-center gap-2 text-sm font-semibold mt-6 transition-all duration-200 group-hover:gap-3"
                  style={{ color: largeTile.accent }}
                >
                  Configurer mon kit
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
                    <path d="M2.5 7h9M8 3.5l3.5 3.5L8 10.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </div>
              </div>
            </div>
          </Link>

          {/* Normal tiles */}
          {normalTiles.map((tile) => (
            <Link
              key={tile.id}
              href={tile.href}
              className="group relative rounded-2xl overflow-hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E4501C] focus-visible:ring-offset-2 transition-transform duration-150 hover:-translate-y-0.5"
              style={{ background: tile.bg, minHeight: 150 }}
              aria-label={`${tile.title} — ${tile.subtitle}`}
            >
              <div
                className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-200"
                style={{ background: `${tile.accent}08` }}
                aria-hidden="true"
              />
              <div className="p-6 h-full flex flex-col justify-between">
                <div>
                  <span className="text-3xl mb-3 block" aria-hidden="true">{tile.emoji}</span>
                  <h3
                    className="font-display font-bold text-white text-base leading-tight mb-1"
                    style={{ fontFamily: 'var(--font-display)' }}
                  >
                    {tile.title}
                  </h3>
                  <p className="text-xs" style={{ color: 'rgba(231,227,214,0.5)' }}>
                    {tile.subtitle}
                  </p>
                </div>
                <div
                  className="w-6 h-6 rounded-full flex items-center justify-center mt-3 opacity-0 group-hover:opacity-100 transition-all duration-200 translate-x-1 group-hover:translate-x-0"
                  style={{ background: `${tile.accent}30` }}
                  aria-hidden="true"
                >
                  <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                    <path d="M2 5h6M5 2l3 3-3 3" stroke={tile.accent} strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </div>
              </div>
            </Link>
          ))}
        </div>

        {/* ── MOBILE: horizontal scroll carousel ── */}
        <div className="md:hidden">
          <div
            ref={scrollRef}
            onScroll={handleScroll}
            onKeyDown={handleKeyDown}
            role="region"
            aria-label="Modules — défiler horizontalement ou utiliser les touches fléchées"
            tabIndex={0}
            className="flex gap-3 overflow-x-auto pb-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E4501C] focus-visible:ring-offset-2 rounded-lg"
            style={{
              scrollSnapType: 'x mandatory',
              WebkitOverflowScrolling: 'touch',
              scrollbarWidth: 'none',
              msOverflowStyle: 'none',
            }}
          >
            {TILES.map((tile) => (
              <Link
                key={tile.id}
                href={tile.href}
                className="flex-none rounded-2xl overflow-hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E4501C] active:scale-[0.98] transition-transform duration-100"
                style={{
                  width: '85vw',
                  maxWidth: 320,
                  height: 192,
                  scrollSnapAlign: 'center',
                  background: tile.bg,
                }}
                aria-label={`${tile.title} — ${tile.subtitle}`}
              >
                <div className="p-5 h-full flex flex-col justify-between">
                  <div>
                    <div className="flex items-start justify-between mb-3">
                      <span className="text-3xl" aria-hidden="true">{tile.emoji}</span>
                      {tile.badge && (
                        <span
                          className="px-2 py-0.5 rounded-full text-[10px] font-mono"
                          style={{
                            background: `${tile.accent}25`,
                            color: tile.accent,
                            fontFamily: 'var(--font-mono)',
                          }}
                        >
                          {tile.badge}
                        </span>
                      )}
                    </div>
                    <h3
                      className="font-display font-bold text-white text-base leading-tight mb-1"
                      style={{ fontFamily: 'var(--font-display)' }}
                    >
                      {tile.title}
                    </h3>
                    <p className="text-xs" style={{ color: 'rgba(231,227,214,0.55)' }}>
                      {tile.subtitle}
                    </p>
                  </div>
                  <div
                    className="inline-flex items-center gap-1.5 text-xs font-semibold"
                    style={{ color: tile.accent }}
                  >
                    Explorer
                    <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden="true">
                      <path d="M2 5h6M5 2l3 3-3 3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </div>
                </div>
              </Link>
            ))}
          </div>

          {/* Dot indicators */}
          <div className="flex justify-center gap-1.5 mt-4" role="tablist" aria-label="Position dans le carousel">
            {TILES.map((tile, i) => (
              <button
                key={tile.id}
                role="tab"
                aria-selected={activeIdx === i}
                aria-label={`Aller à ${tile.title}`}
                onClick={() => {
                  if (!scrollRef.current) return;
                  const tileWidth = scrollRef.current.clientWidth * 0.85;
                  scrollRef.current.scrollTo({
                    left: i * tileWidth,
                    behavior: prefersReduced ? 'auto' : 'smooth',
                  });
                  setActiveIdx(i);
                }}
                className="rounded-full transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E4501C] min-h-[20px] min-w-[20px] flex items-center justify-center"
                style={{
                  width: activeIdx === i ? 20 : 6,
                  height: 6,
                  background: activeIdx === i ? '#E4501C' : 'rgba(28,38,32,0.25)',
                }}
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
