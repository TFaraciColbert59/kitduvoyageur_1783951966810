'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { useRouter } from 'next/navigation';
import AppImage from '@/components/ui/AppImage';

export default function HomepageHeroSection() {
  const router = useRouter();
  const [query, setQuery] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      router.push(`/ai-configurator?q=${encodeURIComponent(query.trim())}`);
    }
  };

  return (
    <section
      className="relative w-full overflow-hidden"
      style={{ background: '#1A1F1C', minHeight: '100svh' }}
      aria-labelledby="hero-heading"
    >
      {/* Background photograph */}
      <motion.div 
        className="absolute inset-0" aria-hidden="true"
        initial={{ scale: 1.1, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 1.5, ease: [0.16, 1, 0.3, 1] }}
      >
        <AppImage
          src="https://images.unsplash.com/photo-1448375240586-882707db888b?w=1800&q=80"
          alt="Forêt dense vue en contre-plongée, lumière émeraude filtrant entre les cimes"
          fill
          priority
          sizes="100vw"
          className="object-cover object-center"
        />
        {/* Gradient overlays — dark top + stronger bottom */}
        <div
          className="absolute inset-0"
          style={{
            background:
              'linear-gradient(180deg, rgba(26,31,28,0.78) 0%, rgba(26,31,28,0.42) 40%, rgba(26,31,28,0.18) 65%, rgba(26,31,28,0.72) 100%)',
          }}
        />
      </motion.div>

      {/* ── Content ── */}
      <div className="relative z-10 flex flex-col justify-between h-full" style={{ minHeight: '100svh' }}>
        {/* Top spacer for desktop header */}
        <div className="h-16 hidden md:block" />

        {/* Main content — bottom-anchored editorial block */}
        <div className="flex-1 flex items-end">
          <div className="w-full max-w-7xl mx-auto px-5 sm:px-8 lg:px-12 pb-10 md:pb-16">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-end">

              {/* Left — headline */}
              <motion.div 
                className="lg:col-span-7"
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
              >
                {/* Eyebrow */}
                <motion.div 
                  className="flex items-center gap-2 mb-5"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6, delay: 0.3, ease: 'easeOut' }}
                >
                  <span
                    className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full"
                    style={{
                      background: 'rgba(45,90,61,0.25)',
                      border: '1px solid rgba(45,90,61,0.45)',
                    }}
                  >
                    <span
                      className="w-1.5 h-1.5 rounded-full"
                      style={{ background: '#4A7C5B', animation: 'pulse 2s ease infinite' }}
                      aria-hidden="true"
                    />
                    <span
                      className="text-[10px] tracking-[0.2em] uppercase"
                      style={{ color: '#9BBBA8', fontFamily: 'var(--font-mono)' }}
                    >
                      Configurateur IA · Équipement outdoor
                    </span>
                  </span>
                </motion.div>

                {/* Main headline */}
                <motion.h1
                  id="hero-heading"
                  className="text-white leading-[0.9] tracking-tight mb-5"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.8, delay: 0.4, ease: [0.16, 1, 0.3, 1] }}
                  style={{
                    fontFamily: 'var(--font-display)',
                    fontWeight: 800,
                    fontSize: 'clamp(3rem, 7.5vw, 6.5rem)',
                    letterSpacing: '-0.04em',
                    textWrap: 'balance'
                  }}
                >
                  Là où la carte
                  <br />
                  <span
                    className="italic font-normal"
                    style={{
                      fontWeight: 400,
                      color: 'rgba(245,243,238,0.55)',
                      fontStyle: 'italic',
                    }}
                  >
                    se termine.
                  </span>
                </motion.h1>

                <motion.p 
                  className="text-white/55 text-base sm:text-lg font-light leading-relaxed max-w-md mb-8"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.8, delay: 0.5, ease: [0.16, 1, 0.3, 1] }}
                  style={{ textWrap: 'pretty' }}
                >
                  Décrivez votre prochaine aventure. Notre IA compose votre kit parfait en 2 minutes — poids, budget, destination.
                </motion.p>

                {/* Search / CTA */}
                <motion.form 
                  onSubmit={handleSubmit} 
                  className="w-full max-w-xl mb-5"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.8, delay: 0.6, ease: [0.16, 1, 0.3, 1] }}
                >
                  <div className="relative flex items-center group">
                    <input
                      type="search"
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      placeholder="Ex : Trek Islande 7 jours, budget 800€…"
                      className="w-full pl-5 pr-40 py-4 text-sm text-white placeholder-white/30 outline-none transition-colors group-hover:bg-white/10 focus:bg-white/10"
                      style={{
                        background: 'rgba(255,255,255,0.08)',
                        border: '1.5px solid rgba(255,255,255,0.14)',
                        borderRadius: '10px',
                        backdropFilter: 'blur(16px)',
                      }}
                      aria-label="Décrivez votre aventure"
                    />
                    <motion.button
                      type="submit"
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      className="absolute right-1.5 top-1/2 -translate-y-1/2 px-5 py-2.5 text-sm font-semibold text-white rounded-lg min-h-[40px] transition-colors"
                      style={{ background: '#2D5A3D' }}
                    >
                      Configurer mon kit
                    </motion.button>
                  </div>
                </motion.form>

                {/* Quick activity tags */}
                <motion.div 
                  className="flex flex-wrap gap-2"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.8, delay: 0.8 }}
                >
                  {['Randonnée', 'Bivouac', 'Trek haute altitude', 'Kayak'].map((tag) => (
                    <Link
                      key={tag}
                      href={`/ai-configurator?q=${encodeURIComponent(tag)}`}
                      className="px-3 py-1.5 rounded-full text-xs font-medium transition-all hover:bg-white/12 hover:border-white/30"
                      style={{
                        background: 'rgba(255,255,255,0.07)',
                        color: 'rgba(245,243,238,0.6)',
                        border: '1px solid rgba(255,255,255,0.10)',
                      }}
                    >
                      {tag}
                    </Link>
                  ))}
                </motion.div>
              </motion.div>

              {/* Right — booking/trip card (desktop only) */}
              <motion.div 
                className="lg:col-span-5 hidden lg:block"
                initial={{ opacity: 0, y: 40, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ duration: 1, delay: 0.5, ease: [0.16, 1, 0.3, 1] }}
                whileHover={{ y: -5, transition: { duration: 0.3 } }}
              >
                <div
                  className="rounded-2xl overflow-hidden shadow-2xl relative"
                  style={{
                    background: 'rgba(245,243,238,0.92)',
                    backdropFilter: 'blur(24px)',
                    boxShadow: '0 24px 64px rgba(0,0,0,0.35)',
                    border: '1px solid rgba(255,255,255,0.4)',
                  }}
                >
                  {/* Card image */}
                  <div className="relative h-48 overflow-hidden group">
                    <motion.div
                      whileHover={{ scale: 1.05 }}
                      transition={{ duration: 0.6, ease: 'easeOut' }}
                      className="w-full h-full"
                    >
                      <AppImage
                        src="https://images.unsplash.com/photo-1454496522488-7a8e488e8606?w=600&q=80"
                        alt="Cabane du Grand Vaneau dans les Alpes avec vue panoramique sur les montagnes enneigées"
                        fill
                        sizes="400px"
                        loading="lazy"
                        className="object-cover"
                      />
                    </motion.div>
                    <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-black/10 to-transparent pointer-events-none" />
                    <div className="absolute top-3 left-3">
                      <span
                        className="text-[9px] tracking-[0.18em] uppercase text-white/90 font-medium px-2 py-1 rounded bg-black/30 backdrop-blur-md border border-white/20"
                        style={{ fontFamily: 'var(--font-mono)' }}
                      >
                        Coup de cœur — Alpes
                      </span>
                    </div>
                  </div>

                  {/* Card content */}
                  <div className="p-6">
                    <p className="font-display font-700 text-[#1A1F1C] text-xl leading-tight mb-1" style={{ fontFamily: 'var(--font-display)', fontWeight: 700, textWrap: 'balance' }}>
                      Cabane du Grand Vaneau.
                    </p>
                    <p className="text-xs text-[#6B7568] mb-5" style={{ fontFamily: 'var(--font-mono)' }}>
                      Refuge · Alpes françaises
                    </p>

                    {/* Stats row */}
                    <div className="grid grid-cols-3 gap-2 mb-5">
                      {[
                        { label: 'Altitude', val: '2 289 m' },
                        { label: 'Durée', val: '3 à 5 j' },
                        { label: 'Niveau', val: 'Interméd.' },
                      ].map((s) => (
                        <div key={s.label} className="text-center p-2 rounded-xl" style={{ background: '#F5F2E8', border: '1px solid rgba(0,0,0,0.03)' }}>
                          <p className="text-xs font-semibold text-[#1A1F1C]">{s.val}</p>
                          <p className="text-[9px] text-[#6B7568] mt-0.5 uppercase tracking-wide" style={{ fontFamily: 'var(--font-mono)' }}>{s.label}</p>
                        </div>
                      ))}
                    </div>

                    {/* Price + CTA */}
                    <div className="flex items-center justify-between">
                      <div>
                        <span
                          className="text-2xl font-bold"
                          style={{ fontFamily: 'var(--font-mono)', color: '#2D5A3D', fontWeight: 700 }}
                        >
                          248 €
                        </span>
                        <span className="text-xs text-[#6B7568] ml-1">/ kit</span>
                      </div>
                      <Link
                        href="/ai-configurator"
                        className="px-5 py-2.5 text-sm font-semibold text-white rounded-xl transition-all hover:opacity-90 hover:-translate-y-0.5 shadow-green"
                        style={{ background: '#2D5A3D', boxShadow: '0 8px 24px rgba(45,90,61,0.28)' }}
                      >
                        Configurer mon sac
                      </Link>
                    </div>
                  </div>
                </div>

                {/* Rating strip */}
                <motion.div 
                  className="flex items-center gap-3 mt-5 px-2"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 1, duration: 0.5 }}
                >
                  <div className="flex gap-0.5">
                    {[1,2,3,4,5].map((i) => (
                      <svg key={i} width="12" height="12" viewBox="0 0 20 20" fill="#4A7C5B" aria-hidden="true">
                        <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                      </svg>
                    ))}
                  </div>
                  <span className="text-sm font-semibold text-white">4,9</span>
                  <span className="text-white/40 text-xs" style={{ fontFamily: 'var(--font-mono)' }}>
                    · 312 aventuriers satisfaits
                  </span>
                </motion.div>
              </motion.div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
