'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import type { FeaturedCarnet } from '@/lib/home-queries';

// Editorial fallback carnets when DB is empty
const EDITORIAL_CARNETS: FeaturedCarnet[] = [
  {
    id: 'ed-1',
    title: 'Tour du Mont Blanc — 11 jours en autonomie',
    destination: 'Alpes, France/Italie/Suisse',
    cover_image_url: null,
    excerpt: 'Un circuit mythique de 170 km autour du plus haut sommet d\'Europe. Refuges, bivouacs et panoramas à couper le souffle.',
    author_name: 'Marie-Claire D.',
    likes_count: 342,
    created_at: '2026-06-15',
  },
  {
    id: 'ed-2',
    title: 'GR20 Corse — La traversée intégrale',
    destination: 'Corse, France',
    cover_image_url: null,
    excerpt: 'Considéré comme le sentier de grande randonnée le plus difficile d\'Europe. 180 km de paysages sauvages et grandioses.',
    author_name: 'Thomas R.',
    likes_count: 218,
    created_at: '2026-05-20',
  },
  {
    id: 'ed-3',
    title: 'Annapurna Circuit — 21 jours au Népal',
    destination: 'Népal',
    cover_image_url: null,
    excerpt: 'Le circuit classique de l\'Himalaya. Cols d\'altitude, villages sherpa et vues imprenables sur les 8000m.',
    author_name: 'Léa M.',
    likes_count: 189,
    created_at: '2026-04-10',
  },
  {
    id: 'ed-4',
    title: 'Islande — Ring Road en van aménagé',
    destination: 'Islande',
    cover_image_url: null,
    excerpt: 'La route 1 qui fait le tour de l\'île en 14 jours. Geysers, cascades, aurores boréales et déserts de lave.',
    author_name: 'Jules B.',
    likes_count: 156,
    created_at: '2026-03-05',
  },
];

const GRADIENT_FALLBACKS = [
  'linear-gradient(135deg, #0d1a14 0%, #1a3020 100%)',
  'linear-gradient(135deg, #0d1e2e 0%, #1a3550 100%)',
  'linear-gradient(135deg, #2a1a0e 0%, #3d2510 100%)',
  'linear-gradient(135deg, #0f1e0f 0%, #1a3020 100%)',
];

const EMOJIS = ['📖', '🏔️', '🌊', '🌋'];

export default function FeaturedJournal({ carnets }: { carnets: FeaturedCarnet[] }) {
  const displayCarnets = carnets.length > 0 ? carnets : EDITORIAL_CARNETS;
  const [activeIdx, setActiveIdx] = useState(0);
  const [prefersReduced, setPrefersReduced] = useState(false);
  const autoRotateRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [isPaused, setIsPaused] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setPrefersReduced(mq.matches);
    const h = (e: MediaQueryListEvent) => setPrefersReduced(e.matches);
    mq.addEventListener('change', h);
    return () => mq.removeEventListener('change', h);
  }, []);

  // Desktop auto-rotation every 8s — paused on hover
  useEffect(() => {
    if (prefersReduced || isPaused) return;
    autoRotateRef.current = setInterval(() => {
      setActiveIdx((prev) => (prev + 1) % displayCarnets.length);
    }, 8000);
    return () => {
      if (autoRotateRef.current) clearInterval(autoRotateRef.current);
    };
  }, [displayCarnets.length, prefersReduced, isPaused]);

  // Mobile: track scroll for dot indicators
  const handleMobileScroll = () => {
    if (!scrollRef.current) return;
    const { scrollLeft, clientWidth } = scrollRef.current;
    const idx = Math.round(scrollLeft / (clientWidth * 0.88));
    setActiveIdx(Math.max(0, Math.min(idx, displayCarnets.length - 1)));
  };

  const active = displayCarnets[activeIdx];

  return (
    <section
      className="py-16 md:py-24"
      style={{ background: 'var(--background)' }}
      aria-labelledby="journal-heading"
    >
      <div className="max-w-7xl mx-auto px-5 sm:px-8 lg:px-12">
        {/* Header */}
        <div className="flex items-end justify-between mb-8 md:mb-12">
          <div>
            <p
              className="text-xs font-mono uppercase tracking-widest mb-2"
              style={{ color: 'var(--primary)', fontFamily: 'var(--font-mono)' }}
            >
              — Carnets d&apos;expédition
            </p>
            <h2
              id="journal-heading"
              className="text-section-title"
              style={{ color: 'var(--foreground)' }}
            >
              Récits vérifiés<br />
              <span style={{ color: 'var(--primary)' }}>de la communauté.</span>
            </h2>
          </div>
          <Link
            href="/carnets"
            className="hidden md:inline-flex items-center gap-2 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E4501C] focus-visible:ring-offset-2 rounded-lg px-1"
            style={{ color: 'var(--primary)' }}
          >
            Tous les carnets
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
              <path d="M2.5 7h9M8 3.5l3.5 3.5L8 10.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </Link>
        </div>

        {/* ── DESKTOP: fade carousel ── */}
        <div
          className="hidden md:block"
          onMouseEnter={() => setIsPaused(true)}
          onMouseLeave={() => setIsPaused(false)}
        >
          <div className="grid md:grid-cols-5 gap-6">
            {/* Main featured card */}
            <div className="md:col-span-3 relative">
              {displayCarnets.map((carnet, i) => (
                <div
                  key={carnet.id}
                  className="rounded-2xl overflow-hidden"
                  style={{
                    position: i === 0 ? 'relative' : 'absolute',
                    inset: i === 0 ? undefined : 0,
                    opacity: activeIdx === i ? 1 : 0,
                    transition: prefersReduced ? 'none' : 'opacity 0.5s ease',
                    pointerEvents: activeIdx === i ? 'auto' : 'none',
                    background: GRADIENT_FALLBACKS[i % GRADIENT_FALLBACKS.length],
                    minHeight: 320,
                  }}
                  aria-hidden={activeIdx !== i}
                >
                  {carnet.cover_image_url ? (
                    <div className="absolute inset-0">
                      <Image
                        src={carnet.cover_image_url}
                        alt={`Couverture du carnet : ${carnet.title}`}
                        fill
                        className="object-cover"
                        sizes="(max-width: 768px) 100vw, 60vw"
                        loading="lazy"
                      />
                      <div
                        className="absolute inset-0"
                        style={{ background: 'linear-gradient(to top, rgba(28,38,32,0.95) 0%, rgba(28,38,32,0.3) 60%, transparent 100%)' }}
                        aria-hidden="true"
                      />
                    </div>
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center opacity-20" aria-hidden="true">
                      <span className="text-8xl">{EMOJIS[i % EMOJIS.length]}</span>
                    </div>
                  )}
                  <div className="relative z-10 p-8 flex flex-col justify-end h-full" style={{ minHeight: 320 }}>
                    {carnet.destination && (
                      <span
                        className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono mb-3 self-start"
                        style={{
                          background: 'rgba(228,80,28,0.2)',
                          color: '#E4501C',
                          border: '1px solid rgba(228,80,28,0.3)',
                          fontFamily: 'var(--font-mono)',
                        }}
                      >
                        📍 {carnet.destination}
                      </span>
                    )}
                    <h3
                      className="font-display font-bold text-white text-xl md:text-2xl mb-3 leading-tight"
                      style={{ fontFamily: 'var(--font-display)' }}
                    >
                      {carnet.title}
                    </h3>
                    {carnet.excerpt && (
                      <p
                        className="text-sm leading-relaxed mb-4 line-clamp-2"
                        style={{ color: 'rgba(231,227,214,0.7)' }}
                      >
                        {carnet.excerpt}
                      </p>
                    )}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div
                          className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white"
                          style={{ background: '#E4501C' }}
                          aria-hidden="true"
                        >
                          {carnet.author_name?.[0] ?? '?'}
                        </div>
                        <span className="text-sm text-white/70">{carnet.author_name ?? 'Voyageur'}</span>
                      </div>
                      <div className="flex items-center gap-1.5 text-sm text-white/50">
                        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
                          <path d="M7 1.5C4 1.5 1.5 4 1.5 7S4 12.5 7 12.5 12.5 10 12.5 7 10 1.5 7 1.5z" stroke="currentColor" strokeWidth="1.2"/>
                          <path d="M7 4v3l2 1.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
                        </svg>
                        <span
                          className="font-mono text-xs"
                          style={{ fontFamily: 'var(--font-mono)' }}
                        >
                          {carnet.likes_count} ❤️
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Sidebar list */}
            <div className="md:col-span-2 flex flex-col gap-3">
              {displayCarnets.map((carnet, i) => (
                <button
                  key={carnet.id}
                  onClick={() => setActiveIdx(i)}
                  className="text-left rounded-xl p-4 transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E4501C] focus-visible:ring-offset-2 min-h-[44px]"
                  style={{
                    background: activeIdx === i ? 'rgba(228,80,28,0.08)' : 'var(--card)',
                    border: activeIdx === i ? '1px solid rgba(228,80,28,0.25)' : '1px solid var(--border)',
                  }}
                  aria-pressed={activeIdx === i}
                  aria-label={`Voir le carnet : ${carnet.title}`}
                >
                  <div className="flex items-start gap-3">
                    <span className="text-xl flex-shrink-0 mt-0.5" aria-hidden="true">
                      {EMOJIS[i % EMOJIS.length]}
                    </span>
                    <div className="min-w-0">
                      <h4
                        className="font-semibold text-sm leading-tight mb-1 line-clamp-2"
                        style={{ color: activeIdx === i ? 'var(--foreground)' : 'var(--foreground)', fontFamily: 'var(--font-display)' }}
                      >
                        {carnet.title}
                      </h4>
                      {carnet.destination && (
                        <p
                          className="text-xs truncate"
                          style={{ color: 'var(--muted-foreground)', fontFamily: 'var(--font-mono)' }}
                        >
                          {carnet.destination}
                        </p>
                      )}
                    </div>
                  </div>
                </button>
              ))}

              <Link
                href={`/carnets/${active.id}`}
                className="mt-2 inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl font-semibold text-sm text-white transition-all duration-200 hover:-translate-y-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E4501C] focus-visible:ring-offset-2 min-h-[44px]"
                style={{ background: '#E4501C' }}
              >
                Lire ce carnet
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
                  <path d="M2.5 7h9M8 3.5l3.5 3.5L8 10.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </Link>
            </div>
          </div>
        </div>

        {/* ── MOBILE: swipeable single-item carousel ── */}
        <div className="md:hidden">
          <div
            ref={scrollRef}
            onScroll={handleMobileScroll}
            role="region"
            aria-label="Carnets d'expédition — défiler horizontalement"
            className="flex gap-3 overflow-x-auto pb-4"
            style={{
              scrollSnapType: 'x mandatory',
              WebkitOverflowScrolling: 'touch',
              scrollbarWidth: 'none',
              msOverflowStyle: 'none',
            }}
          >
            {displayCarnets.map((carnet, i) => (
              <div
                key={carnet.id}
                className="flex-none rounded-2xl overflow-hidden relative"
                style={{
                  width: '88vw',
                  maxWidth: 340,
                  minHeight: 260,
                  scrollSnapAlign: 'center',
                  background: GRADIENT_FALLBACKS[i % GRADIENT_FALLBACKS.length],
                }}
              >
                {carnet.cover_image_url && (
                  <div className="absolute inset-0">
                    <Image
                      src={carnet.cover_image_url}
                      alt={`Couverture : ${carnet.title}`}
                      fill
                      className="object-cover"
                      sizes="88vw"
                      loading="lazy"
                    />
                    <div
                      className="absolute inset-0"
                      style={{ background: 'linear-gradient(to top, rgba(28,38,32,0.95) 0%, rgba(28,38,32,0.2) 100%)' }}
                      aria-hidden="true"
                    />
                  </div>
                )}
                {!carnet.cover_image_url && (
                  <div className="absolute inset-0 flex items-center justify-center opacity-15" aria-hidden="true">
                    <span className="text-7xl">{EMOJIS[i % EMOJIS.length]}</span>
                  </div>
                )}
                <div className="relative z-10 p-5 flex flex-col justify-end h-full" style={{ minHeight: 260 }}>
                  {carnet.destination && (
                    <span
                      className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-mono mb-2 self-start"
                      style={{
                        background: 'rgba(228,80,28,0.2)',
                        color: '#E4501C',
                        fontFamily: 'var(--font-mono)',
                      }}
                    >
                      📍 {carnet.destination}
                    </span>
                  )}
                  <h3
                    className="font-display font-bold text-white text-base leading-tight mb-2"
                    style={{ fontFamily: 'var(--font-display)' }}
                  >
                    {carnet.title}
                  </h3>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-white/60">{carnet.author_name ?? 'Voyageur'}</span>
                    <span
                      className="text-xs font-mono text-white/50"
                      style={{ fontFamily: 'var(--font-mono)' }}
                    >
                      {carnet.likes_count} ❤️
                    </span>
                  </div>
                  <Link
                    href={`/carnets/${carnet.id}`}
                    className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E4501C] min-h-[36px]"
                    style={{ color: '#E4501C' }}
                  >
                    Lire le carnet
                    <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden="true">
                      <path d="M2 5h6M5 2l3 3-3 3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </Link>
                </div>
              </div>
            ))}
          </div>

          {/* Dot indicators */}
          <div className="flex justify-center gap-1.5 mt-4" role="tablist" aria-label="Position dans le carousel des carnets">
            {displayCarnets.map((_, i) => (
              <button
                key={i}
                role="tab"
                aria-selected={activeIdx === i}
                aria-label={`Carnet ${i + 1}`}
                onClick={() => {
                  if (!scrollRef.current) return;
                  const w = scrollRef.current.clientWidth * 0.88;
                  scrollRef.current.scrollTo({ left: i * w, behavior: 'smooth' });
                  setActiveIdx(i);
                }}
                className="rounded-full transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E4501C] min-h-[20px] min-w-[20px] flex items-center justify-center"
                style={{
                  width: activeIdx === i ? 20 : 6,
                  height: 6,
                  background: activeIdx === i ? '#E4501C' : 'rgba(28,38,32,0.2)',
                }}
              />
            ))}
          </div>

          <div className="text-center mt-6">
            <Link
              href="/carnets"
              className="inline-flex items-center gap-2 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E4501C] focus-visible:ring-offset-2 rounded-lg px-1 min-h-[44px]"
              style={{ color: 'var(--primary)' }}
            >
              Tous les carnets
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
                <path d="M2.5 7h9M8 3.5l3.5 3.5L8 10.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
