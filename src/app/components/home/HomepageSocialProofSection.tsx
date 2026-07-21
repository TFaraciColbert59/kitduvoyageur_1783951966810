'use client';

import React from 'react';
import Icon from '@/components/ui/AppIcon';
import type { TrustStats } from '@/lib/home-queries';

interface Props {
  stats: TrustStats;
}

export default function HomepageSocialProofSection({ stats }: Props) {
  const hasRealUsers = stats.userCount > 0;
  const hasRealRoutes = stats.routeCount > 0;

  return (
    <section className="py-16" style={{ background: '#1C2620' }} aria-labelledby="proof-heading">
      <div className="max-w-7xl mx-auto px-5 sm:px-8 lg:px-12">
        {/* Honest launch badge */}
        <div className="flex justify-center mb-10">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}>
            <span className="w-2 h-2 rounded-full bg-green-400" aria-hidden="true" />
            <span className="text-xs font-mono text-white/50 tracking-widest uppercase" style={{ fontFamily: 'var(--font-mono)' }}>
              Lancement · Bêta ouverte
            </span>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            {
              icon: '🧭',
              value: hasRealUsers ? `${stats.userCount}` : 'Bêta',
              label: hasRealUsers ? 'Voyageurs inscrits' : 'Rejoignez les premiers',
              sub: 'Accès anticipé ouvert',
              color: '#E4501C',
            },
            {
              icon: '🥾',
              value: hasRealRoutes ? `${stats.routeCount.toLocaleString('fr-FR')}` : '1 169',
              label: 'Sentiers référencés',
              sub: 'GR, GRP, PR en France',
              color: '#5C8A3A',
            },
            {
              icon: '🤖',
              value: 'Gemini',
              label: 'IA de génération',
              sub: 'Google Gemini Pro',
              color: '#3A6EA5',
            },
            {
              icon: '📦',
              value: '48h',
              label: 'Livraison express',
              sub: 'Retour gratuit 30 jours',
              color: '#B5652D',
            },
          ].map((item) => (
            <div
              key={item.label}
              className="rounded-2xl p-6 text-center"
              style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}
            >
              <div className="text-3xl mb-3" aria-hidden="true">{item.icon}</div>
              <div className="font-mono font-bold text-2xl mb-1" style={{ color: item.color, fontFamily: 'var(--font-mono)' }}>
                {item.value}
              </div>
              <div className="text-xs font-semibold text-white/70 mb-0.5">{item.label}</div>
              <div className="text-[10px] text-white/30" style={{ fontFamily: 'var(--font-mono)' }}>{item.sub}</div>
            </div>
          ))}
        </div>

        {/* Press / credibility strip */}
        <div className="mt-10 flex flex-wrap justify-center items-center gap-6 opacity-40">
          {['Sécurisé SSL', 'RGPD Conforme', 'Hébergé en Europe', 'Open Source'].map((badge) => (
            <div key={badge} className="flex items-center gap-1.5 text-xs text-white/60 font-mono" style={{ fontFamily: 'var(--font-mono)' }}>
              <Icon name="ShieldCheckIcon" size={12} variant="outline" className="text-white/40" />
              {badge}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
