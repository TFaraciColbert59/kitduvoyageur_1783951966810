'use client';

import React from 'react';
import Link from 'next/link';
import Icon from '@/components/ui/AppIcon';

export default function HomepageAIDemoSection() {
  const steps = [
    { step: '01', title: 'Décrivez votre aventure', desc: '"Trek Islande 7 jours, budget 800€, débutant"', icon: '💬' },
    { step: '02', title: 'L\'IA analyse votre profil', desc: 'Destination, météo, niveau, budget, poids cible', icon: '🤖' },
    { step: '03', title: 'Kit personnalisé généré', desc: 'Liste complète avec prix, poids, alternatives', icon: '🎒' },
  ];

  const kitItems = [
    { name: 'Sac à dos 50L', brand: 'Osprey Farpoint', weight: '1.4 kg', price: '189€', essential: true },
    { name: 'Veste imperméable', brand: 'Patagonia Torrentshell', weight: '0.3 kg', price: '149€', essential: true },
    { name: 'Chaussures de trek', brand: 'Salomon X Ultra 4', weight: '0.8 kg', price: '159€', essential: true },
    { name: 'Tente 2 places', brand: 'MSR Hubba Hubba', weight: '1.7 kg', price: '399€', essential: false },
  ];

  return (
    <section className="py-20" style={{ background: 'var(--dark-bg)' }} aria-labelledby="ai-demo-heading">
      <div className="max-w-7xl mx-auto px-5 sm:px-8 lg:px-12">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          {/* Left: explanation */}
          <div>
            <p className="text-[10px] font-mono text-[#E4501C] tracking-[0.2em] uppercase mb-4" style={{ fontFamily: 'var(--font-mono)' }}>
              — Configurateur IA
            </p>
            <h2
              id="ai-demo-heading"
              className="font-display font-800 text-white text-3xl md:text-4xl tracking-tight mb-6"
              style={{ fontFamily: 'var(--font-display)', fontWeight: 800 }}
            >
              Votre kit optimal
              <br />
              <span style={{ color: '#E4501C' }}>en 2 minutes.</span>
            </h2>
            <p className="text-white/55 text-base leading-relaxed mb-8">
              Notre IA analyse votre destination, la météo prévue, votre niveau et votre budget pour composer un kit précis — sans superflu, sans oubli.
            </p>

            <div className="space-y-4">
              {steps?.map((s) => (
                <div key={s?.step} className="flex items-start gap-4">
                  <div className="flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center text-lg" style={{ background: 'rgba(228,80,28,0.12)', border: '1px solid rgba(228,80,28,0.2)' }}>
                    {s?.icon}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-white mb-0.5">{s?.title}</p>
                    <p className="text-xs text-white/40 italic">{s?.desc}</p>
                  </div>
                </div>
              ))}
            </div>

            <Link
              href="/ai-configurator"
              className="inline-flex items-center gap-2 mt-8 px-6 py-3.5 rounded-xl font-semibold text-sm text-white transition-all hover:-translate-y-px hover:shadow-xl hover:shadow-[#E4501C]/30"
              style={{ background: '#E4501C' }}
            >
              <Icon name="SparklesIcon" size={16} variant="outline" />
              Essayer gratuitement
            </Link>
          </div>

          {/* Right: mock UI preview */}
          <div className="relative">
            <div className="rounded-2xl overflow-hidden" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
              {/* Header bar */}
              <div className="flex items-center gap-2 px-4 py-3 border-b border-white/6">
                <div className="w-2.5 h-2.5 rounded-full bg-red-400/60" />
                <div className="w-2.5 h-2.5 rounded-full bg-yellow-400/60" />
                <div className="w-2.5 h-2.5 rounded-full bg-green-400/60" />
                <span className="ml-2 text-xs text-white/30 font-mono" style={{ fontFamily: 'var(--font-mono)' }}>Configurateur IA — Kit Islande</span>
              </div>
              {/* Content */}
              <div className="p-5 space-y-3">
                <div className="rounded-xl p-3.5" style={{ background: 'rgba(228,80,28,0.08)', border: '1px solid rgba(228,80,28,0.15)' }}>
                  <p className="text-xs text-white/50 mb-1">Votre demande</p>
                  <p className="text-sm text-white font-medium">&ldquo;Trek Islande 7 jours, budget 800€, débutant&rdquo;</p>
                </div>
                {kitItems?.map((item) => (
                  <div key={item?.name} className="flex items-center justify-between py-2 border-b border-white/5 last:border-0">
                    <div className="flex items-center gap-2.5">
                      <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${item?.essential ? 'bg-[#E4501C]' : 'bg-white/20'}`} />
                      <div>
                        <p className="text-xs font-medium text-white/85">{item?.name}</p>
                        <p className="text-[10px] text-white/35">{item?.brand} · {item?.weight}</p>
                      </div>
                    </div>
                    <span className="text-xs font-mono font-semibold text-white/70" style={{ fontFamily: 'var(--font-mono)' }}>{item?.price}</span>
                  </div>
                ))}
                <div className="flex items-center justify-between pt-2">
                  <div className="text-xs text-white/40">Total estimé</div>
                  <div className="text-sm font-mono font-bold text-[#E4501C]" style={{ fontFamily: 'var(--font-mono)' }}>896€ · 4.2 kg</div>
                </div>
              </div>
            </div>
            {/* Glow */}
            <div className="absolute -inset-4 rounded-3xl pointer-events-none" style={{ background: 'radial-gradient(ellipse at center, rgba(228,80,28,0.08) 0%, transparent 70%)' }} aria-hidden="true" />
          </div>
        </div>
      </div>
    </section>
  );
}
