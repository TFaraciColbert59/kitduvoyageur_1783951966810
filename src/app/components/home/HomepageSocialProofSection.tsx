'use client';

import React, { useRef, useEffect, useState } from 'react';
import type { TrustStats } from '@/lib/home-queries';
import Icon from '@/components/ui/AppIcon';

interface Props {
  stats: TrustStats;
}

const TRUST_ITEMS = [
  {
    icon: '🧭',
    label: 'Accès anticipé',
    sub: 'Rejoignez les premiers voyageurs',
    color: '#2D5A3D',
  },
  {
    icon: '🥾',
    label: '1 169 sentiers',
    sub: 'GR, GRP, PR en France',
    color: '#3D7A52',
  },
  {
    icon: '⚡',
    label: 'Gemini IA',
    sub: 'Alimenté par Google Gemini Pro',
    color: '#3E6B7A',
  },
  {
    icon: '📦',
    label: 'Livraison 48h',
    sub: 'Retour gratuit 30 jours',
    color: '#6B7568',
  },
];

export default function HomepageSocialProofSection({ stats }: Props) {
  const sectionRef = useRef<HTMLElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setVisible(true); },
      { threshold: 0.1 }
    );
    if (sectionRef.current) observer.observe(sectionRef.current);
    return () => observer.disconnect();
  }, []);

  return (
    <section
      ref={sectionRef}
      className="py-14"
      style={{ background: '#1A1F1C', borderTop: '1px solid rgba(255,255,255,0.05)' }}
      aria-labelledby="trust-heading"
    >
      <div className="max-w-7xl mx-auto px-5 sm:px-8 lg:px-12">
        {/* Beta badge */}
        <div className="flex justify-center mb-10">
          <div
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full"
            style={{
              background: 'rgba(45,90,61,0.15)',
              border: '1px solid rgba(45,90,61,0.25)',
            }}
          >
            <span className="w-2 h-2 rounded-full bg-[#4A7C5B]" aria-hidden="true" />
            <span
              className="text-xs text-[#9BBBA8] tracking-widest uppercase"
              style={{ fontFamily: 'var(--font-mono)' }}
            >
              Lancement · Bêta ouverte
            </span>
          </div>
        </div>

        <div
          className="grid grid-cols-2 md:grid-cols-4 gap-4"
          style={{
            opacity: visible ? 1 : 0,
            transition: 'opacity 0.6s ease 0.1s',
          }}
        >
          {TRUST_ITEMS.map((item, i) => (
            <div
              key={item.label}
              className="rounded-xl p-5 text-center"
              style={{
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.06)',
              }}
            >
              <div className="text-2xl mb-3" aria-hidden="true">{item.icon}</div>
              <div className="text-sm font-semibold text-white/80 mb-0.5">{item.label}</div>
              <div className="text-[10px] text-white/30" style={{ fontFamily: 'var(--font-mono)' }}>{item.sub}</div>
            </div>
          ))}
        </div>

        {/* Trust strip */}
        <div className="mt-8 flex flex-wrap justify-center items-center gap-6 opacity-35">
          {['Paiement SSL', 'RGPD Conforme', 'Hébergé en Europe', 'Open Source'].map((badge) => (
            <div
              key={badge}
              className="flex items-center gap-1.5 text-xs text-white/60"
              style={{ fontFamily: 'var(--font-mono)' }}
            >
              <Icon name="ShieldCheckIcon" size={12} variant="outline" className="text-white/40" />
              {badge}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
