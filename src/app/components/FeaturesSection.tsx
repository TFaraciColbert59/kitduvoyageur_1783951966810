'use client';

import React from 'react';
import Link from 'next/link';
import Icon from '@/components/ui/AppIcon';

const FEATURES = [
  {
    icon: 'SparklesIcon',
    title: 'Configurateur IA',
    desc: 'Décrivez votre voyage, l\'IA compose votre kit optimal en 2 minutes — poids, budget, destination.',
    href: '/ai-configurator',
    cta: 'Configurer mon kit',
    accent: '#E4501C'
  },
  {
    icon: 'GlobeAltIcon',
    title: 'Pages Pays',
    desc: 'Fiches détaillées pour 94 destinations : météo, visa, équipement recommandé, niveau de danger.',
    href: '/pays',
    cta: 'Explorer les pays',
    accent: '#3E6B7A'
  },
  {
    icon: 'ChatBubbleLeftRightIcon',
    title: 'Copilote IA',
    desc: 'Votre assistant voyage intelligent, disponible 24h/24 pour répondre à toutes vos questions terrain.',
    href: '/copilote',
    cta: 'Parler au copilote',
    accent: '#33463C'
  }
];

export default function FeaturesSection() {
  return (
    <section className="bg-[#E7E3D6] py-20 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-12">
          <div>
            <p className="text-[10px] font-mono text-[#E4501C] tracking-[0.2em] uppercase mb-2" style={{ fontFamily: 'var(--font-mono)' }}>Fonctionnalités clés</p>
            <h2 className="font-display font-800 text-[#1C2620] text-3xl sm:text-4xl tracking-tight" style={{ fontFamily: 'var(--font-display)', fontWeight: 800 }}>
              Tout pour votre<br />prochaine expédition.
            </h2>
          </div>
          <Link href="/catalogue" className="text-sm font-medium text-[#1C2620]/60 hover:text-[#1C2620] flex items-center gap-1.5 transition-colors">
            Voir tout <Icon name="ArrowRightIcon" size={14} variant="outline" />
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {FEATURES.map((feat, i) => (
            <div
              key={feat.title}
              className={`relative rounded-2xl overflow-hidden p-7 flex flex-col justify-between min-h-[260px] ${
                i === 0 ? 'md:col-span-1 md:row-span-1' : ''
              }`}
              style={{ background: i === 0 ? '#1C2620' : i === 1 ? '#33463C' : '#243028' }}
            >
              <div>
                <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-5" style={{ background: `${feat.accent}25` }}>
                  <Icon name={feat.icon as string} size={20} variant="outline" style={{ color: feat.accent }} />
                </div>
                <h3 className="font-display font-700 text-white text-xl mb-2.5" style={{ fontFamily: 'var(--font-display)' }}>{feat.title}</h3>
                <p className="text-white/50 text-sm leading-relaxed">{feat.desc}</p>
              </div>
              <Link
                href={feat.href}
                className="mt-6 inline-flex items-center gap-2 text-sm font-medium transition-all"
                style={{ color: feat.accent }}
              >
                {feat.cta}
                <Icon name="ArrowRightIcon" size={13} variant="outline" />
              </Link>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
