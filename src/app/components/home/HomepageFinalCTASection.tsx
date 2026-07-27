'use client';

import React from 'react';
import Link from 'next/link';
import AppImage from '@/components/ui/AppImage';
import Icon from '@/components/ui/AppIcon';

export default function HomepageFinalCTASection() {
  return (
    <section
      className="relative overflow-hidden py-24 md:py-32"
      style={{ background: '#1A1F1C' }}
      aria-labelledby="final-cta-heading"
    >
      {/* Background image — editorial travel mood */}
      <div className="absolute inset-0" aria-hidden="true">
        <AppImage
          src="https://images.unsplash.com/photo-1448375240586-882707db888b?w=1600&q=70"
          alt=""
          fill
          sizes="100vw"
          loading="lazy"
          className="object-cover object-center"
        />
        <div
          className="absolute inset-0"
          style={{ background: 'linear-gradient(135deg, rgba(26,31,28,0.95) 0%, rgba(26,31,28,0.75) 60%, rgba(36,48,40,0.90) 100%)' }}
        />
      </div>

      {/* Topo rings */}
      <div className="absolute inset-0 pointer-events-none opacity-[0.04]" aria-hidden="true">
        <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <pattern id="cta-rings" x="0" y="0" width="200" height="200" patternUnits="userSpaceOnUse">
              <circle cx="100" cy="100" r="90" fill="none" stroke="white" strokeWidth="1"/>
              <circle cx="100" cy="100" r="65" fill="none" stroke="white" strokeWidth="0.7"/>
              <circle cx="100" cy="100" r="40" fill="none" stroke="white" strokeWidth="0.5"/>
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#cta-rings)"/>
        </svg>
      </div>

      <div className="relative z-10 max-w-4xl mx-auto px-5 sm:px-8 text-center">
        <p className="label-eyebrow-dark mb-6">— Prêt pour l&apos;aventure ?</p>

        <h2
          id="final-cta-heading"
          className="text-white mb-6"
          style={{
            fontFamily: 'var(--font-display)',
            fontWeight: 800,
            fontSize: 'clamp(2.5rem, 6vw, 5rem)',
            lineHeight: '0.95',
            letterSpacing: '-0.04em',
          }}
        >
          Ce que vous emportez,
          <br />
          <em
            className="not-italic"
            style={{ fontStyle: 'italic', fontWeight: 400, color: 'rgba(245,243,238,0.45)' }}
          >
            c&apos;est votre voyage.
          </em>
        </h2>

        <p className="text-white/50 text-base leading-relaxed mb-12 max-w-xl mx-auto">
          Configurez votre kit en 2 minutes. Gratuitement, sans inscription requise.
        </p>

        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link
            href="/ai-configurator"
            className="btn-primary text-base px-8 py-4 min-h-[52px] justify-center"
          >
            <Icon name="SparklesIcon" size={18} variant="outline" />
            Configurer mon kit IA
          </Link>
          <Link
            href="/pays"
            className="btn-ghost-dark text-base px-8 py-4 min-h-[52px] justify-center"
          >
            Explorer les destinations
          </Link>
        </div>

        {/* Trust badges */}
        <div className="flex flex-wrap justify-center gap-6 mt-12">
          {[
            { icon: '🔒', text: 'Paiement Stripe sécurisé' },
            { icon: '↩️', text: 'Retour gratuit 30 jours' },
            { icon: '🇪🇺', text: 'Hébergé en Europe' },
          ].map((item) => (
            <div key={item.text} className="flex items-center gap-2">
              <span className="text-base" aria-hidden="true">{item.icon}</span>
              <span
                className="text-xs text-white/30"
                style={{ fontFamily: 'var(--font-mono)' }}
              >
                {item.text}
              </span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
