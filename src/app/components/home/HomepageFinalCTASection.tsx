'use client';

import React from 'react';
import Link from 'next/link';
import Icon from '@/components/ui/AppIcon';

export default function HomepageFinalCTASection() {
  return (
    <section
      className="relative py-24 overflow-hidden"
      style={{ background: '#1C2620' }}
      aria-labelledby="final-cta-heading"
    >
      {/* Topo background */}
      <div className="absolute inset-0 opacity-[0.04]" aria-hidden="true">
        <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <pattern id="cta-topo-v1" x="0" y="0" width="160" height="160" patternUnits="userSpaceOnUse">
              <circle cx="80" cy="80" r="70" fill="none" stroke="white" strokeWidth="1" />
              <circle cx="80" cy="80" r="50" fill="none" stroke="white" strokeWidth="0.6" />
              <circle cx="80" cy="80" r="30" fill="none" stroke="white" strokeWidth="0.4" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#cta-topo-v1)" />
        </svg>
      </div>
      <div className="absolute inset-0 pointer-events-none" style={{ background: 'radial-gradient(ellipse 70% 50% at 50% 100%, rgba(228,80,28,0.1) 0%, transparent 70%)' }} aria-hidden="true" />
      <div className="relative z-10 max-w-3xl mx-auto px-5 sm:px-8 text-center">
        <p className="text-[10px] font-mono text-white/30 tracking-[0.2em] uppercase mb-6" style={{ fontFamily: 'var(--font-mono)' }}>
          — Prêt pour l&apos;aventure ?
        </p>
        <h2
          id="final-cta-heading"
          className="font-display font-800 text-white leading-[0.95] tracking-tight mb-6"
          style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 'clamp(2.2rem, 5vw, 3.5rem)' }}
        >
          Votre prochaine
          <br />
          <span style={{ color: '#E4501C' }}>expédition commence</span>
          <br />
          <span className="text-white/40">maintenant.</span>
        </h2>
        <p className="text-base text-white/50 leading-relaxed mb-10 max-w-xl mx-auto">
          Configurez votre kit en 2 minutes. Gratuit, sans inscription requise.
        </p>

        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link
            href="/ai-configurator"
            className="inline-flex items-center justify-center gap-2 px-8 py-4 rounded-2xl font-semibold text-base text-white transition-all hover:-translate-y-px min-h-[52px]"
            style={{ background: '#E4501C', boxShadow: '0 8px 32px rgba(228,80,28,0.3)' }}
          >
            <Icon name="SparklesIcon" size={18} variant="outline" />
            Configurer mon kit IA
          </Link>
          <Link
            href="/pays"
            className="inline-flex items-center justify-center gap-2 px-8 py-4 rounded-2xl font-semibold text-base transition-all hover:-translate-y-px min-h-[52px]"
            style={{ border: '1.5px solid rgba(231,227,214,0.2)', color: 'rgba(231,227,214,0.75)' }}
          >
            Explorer les destinations
          </Link>
        </div>

        {/* Honest trust strip */}
        <div className="flex flex-wrap justify-center gap-6 mt-10">
          {[
            { icon: '🔒', text: 'Paiement Stripe sécurisé' },
            { icon: '↩️', text: 'Retour gratuit 30 jours' },
            { icon: '🇪🇺', text: 'Hébergé en Europe' },
          ]?.map((item) => (
            <div key={item?.text} className="flex items-center gap-2">
              <span className="text-base" aria-hidden="true">{item?.icon}</span>
              <span className="text-xs font-mono text-white/35" style={{ fontFamily: 'var(--font-mono)' }}>{item?.text}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
