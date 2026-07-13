'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';

import Icon from '@/components/ui/AppIcon';

export default function HomeHeroSection() {
  const [scrollY, setScrollY] = useState(0);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const onScroll = () => setScrollY(window.scrollY);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <section className="relative min-h-screen flex items-center overflow-hidden bg-[#1C2620]">
      <div
        className="absolute inset-0 opacity-[0.06]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='400' height='400'%3E%3Cpath d='M200 50 Q300 100 350 200 Q300 300 200 350 Q100 300 50 200 Q100 100 200 50Z' fill='none' stroke='%23E7E3D6' stroke-width='1'/%3E%3Cpath d='M200 80 Q280 120 320 200 Q280 280 200 320 Q120 280 80 200 Q120 120 200 80Z' fill='none' stroke='%23E7E3D6' stroke-width='1'/%3E%3Cpath d='M200 110 Q260 140 290 200 Q260 260 200 290 Q140 260 110 200 Q140 140 200 110Z' fill='none' stroke='%23E7E3D6' stroke-width='1'/%3E%3Cpath d='M200 140 Q240 160 260 200 Q240 240 200 260 Q160 240 140 200 Q160 160 200 140Z' fill='none' stroke='%23E7E3D6' stroke-width='1'/%3E%3C/svg%3E")`,
          backgroundSize: '400px 400px',
          transform: mounted ? `translateY(${scrollY * 0.15}px)` : 'none',
        }}
      />
      <div className="absolute inset-0 bg-gradient-to-br from-[#1C2620] via-[#243028] to-[#1a1f1c]" />
      <div className="absolute inset-0 bg-gradient-to-t from-[#1C2620] via-transparent to-transparent" />
      <div
        className="absolute top-1/3 right-1/4 w-[600px] h-[600px] rounded-full opacity-[0.04]"
        style={{ background: 'radial-gradient(circle, #E4501C 0%, transparent 70%)' }}
      />
      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-24 pb-20">
        <div className="grid lg:grid-cols-2 gap-16 items-center">
          <div>
            <div className="flex items-center gap-3 mb-8">
              <div className="flex items-center gap-2 bg-white/6 border border-white/10 rounded-full px-4 py-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-[#E4501C] animate-pulse" />
                <span
                  className="text-[10px] font-mono text-white/50 tracking-[0.2em] uppercase"
                  style={{ fontFamily: 'var(--font-mono)' }}
                >
                  Intelligence artificielle · Équipement outdoor
                </span>
              </div>
            </div>

            <h1
              className="text-hero text-white mb-6 leading-[0.95]"
              style={{ fontFamily: 'var(--font-display)', fontWeight: 800 }}
            >
              Votre voyage
              <br />
              <span className="text-[#E4501C]">commence</span>
              <br />
              par le bon sac.
            </h1>

            <p className="text-white/55 text-lg leading-relaxed mb-10 max-w-lg">
              L&apos;IA qui analyse votre destination, votre style de voyage et votre équipement pour créer le kit parfait.{' '}
              <span className="text-white/80">Aucun oubli. Aucun surplus. Juste ce qu&apos;il faut.</span>
            </p>

            <div className="flex flex-col sm:flex-row gap-4 mb-10">
              <Link
                href="/ai-configurator"
                className="group flex items-center justify-center gap-2.5 bg-[#E4501C] hover:bg-[#cc3d10] text-white px-8 py-4 rounded-2xl font-semibold text-base transition-all duration-200 hover:-translate-y-0.5 hover:shadow-xl hover:shadow-[#E4501C]/30"
              >
                <Icon name="SparklesIcon" size={18} variant="outline" />
                Créer mon Kit
                <Icon name="ArrowRightIcon" size={16} variant="outline" className="transition-transform group-hover:translate-x-1" />
              </Link>
              <Link
                href="/kits"
                className="flex items-center justify-center gap-2 bg-white/8 hover:bg-white/14 border border-white/12 text-white/80 hover:text-white px-8 py-4 rounded-2xl font-medium text-base transition-all duration-200"
              >
                Découvrir les kits populaires
              </Link>
            </div>

            <div className="flex flex-wrap gap-x-6 gap-y-2">
              {[
                { icon: 'CloudIcon', label: 'Analyse météo' },
                { icon: 'ScaleIcon', label: 'Optimisation du poids' },
                { icon: 'ShieldCheckIcon', label: 'Produits vérifiés' },
                { icon: 'UserCircleIcon', label: 'Adapté à votre profil' },
              ]?.map(({ icon, label }) => (
                <div key={label} className="flex items-center gap-2">
                  <Icon name={icon} size={13} variant="outline" className="text-[#E4501C]" />
                  <span
                    className="text-[11px] font-mono text-white/45 tracking-wide"
                    style={{ fontFamily: 'var(--font-mono)' }}
                  >
                    {label}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="relative hidden lg:block">
            <div className="relative bg-[#243028] border border-white/10 rounded-3xl p-8 shadow-2xl">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <p
                    className="text-[10px] font-mono text-[#E4501C] tracking-[0.2em] uppercase mb-1"
                    style={{ fontFamily: 'var(--font-mono)' }}
                  >
                    Kit généré · Islande
                  </p>
                  <h3
                    className="text-white font-display text-xl"
                    style={{ fontFamily: 'var(--font-display)', fontWeight: 700 }}
                  >
                    Kit Islande Automne
                  </h3>
                </div>
                <div className="w-12 h-12 rounded-2xl bg-[#E4501C]/15 border border-[#E4501C]/20 flex items-center justify-center">
                  <span className="text-2xl">🏔️</span>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4 mb-6">
                {[
                  { value: '32', label: 'objets' },
                  { value: '8,4 kg', label: 'poids total' },
                  { value: '1 240 €', label: 'budget estimé' },
                ]?.map(({ value, label }) => (
                  <div key={label} className="bg-[#1C2620] rounded-xl p-3 text-center">
                    <p
                      className="text-white font-mono font-bold text-lg leading-none mb-1"
                      style={{ fontFamily: 'var(--font-mono)' }}
                    >
                      {value}
                    </p>
                    <p
                      className="text-white/35 text-[10px] font-mono tracking-wide"
                      style={{ fontFamily: 'var(--font-mono)' }}
                    >
                      {label}
                    </p>
                  </div>
                ))}
              </div>

              <div className="flex items-center gap-4 bg-[#1C2620] rounded-xl p-4">
                <div className="relative w-14 h-14 flex-shrink-0">
                  <svg viewBox="0 0 56 56" className="w-full h-full -rotate-90">
                    <circle cx="28" cy="28" r="22" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="4" />
                    <circle
                      cx="28" cy="28" r="22" fill="none"
                      stroke="#E4501C" strokeWidth="4"
                      strokeLinecap="round"
                      strokeDasharray="130.38 138.49"
                    />
                  </svg>
                  <span
                    className="absolute inset-0 flex items-center justify-center text-white font-mono font-bold text-sm"
                    style={{ fontFamily: 'var(--font-mono)' }}
                  >
                    94
                  </span>
                </div>
                <div>
                  <p
                    className="text-[10px] font-mono text-white/35 tracking-[0.15em] uppercase mb-0.5"
                    style={{ fontFamily: 'var(--font-mono)' }}
                  >
                    Trust Score
                  </p>
                  <p className="text-white/70 text-sm">Kit optimisé pour votre profil</p>
                </div>
              </div>

              <div className="mt-5 space-y-2">
                {[
                  { name: 'Sac à dos 40L Osprey', cat: 'Portage', check: true },
                  { name: 'Veste Gore-Tex imperméable', cat: 'Protection', check: true },
                  { name: 'Couche thermique Merino', cat: 'Textile', check: true },
                  { name: '+ 29 autres objets', cat: '', check: false },
                ]?.map(({ name, cat, check }, i) => (
                  <div key={i} className="flex items-center gap-3 py-1.5">
                    <div className={`w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0 ${check ? 'bg-[#E4501C]/20 border border-[#E4501C]/40' : 'bg-white/5 border border-white/10'}`}>
                      {check && <div className="w-1.5 h-1.5 rounded-full bg-[#E4501C]" />}
                    </div>
                    <span className="text-white/65 text-sm flex-1">{name}</span>
                    {cat && (
                      <span
                        className="text-[9px] font-mono text-white/25 tracking-wide"
                        style={{ fontFamily: 'var(--font-mono)' }}
                      >
                        {cat}
                      </span>
                    )}
                  </div>
                ))}
              </div>

              <div className="absolute -top-4 -right-4 bg-[#E4501C] text-white rounded-2xl px-4 py-2 shadow-lg shadow-[#E4501C]/30">
                <p
                  className="text-[10px] font-mono tracking-[0.15em] uppercase"
                  style={{ fontFamily: 'var(--font-mono)' }}
                >
                  IA · Généré en 8s
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 opacity-40">
        <div className="scroll-line-track">
          <div className="scroll-line-fill h-1/2" />
        </div>
        <span
          className="text-[9px] font-mono text-white/40 tracking-[0.2em] uppercase"
          style={{ fontFamily: 'var(--font-mono)' }}
        >
          Scroll
        </span>
      </div>
    </section>
  );
}
