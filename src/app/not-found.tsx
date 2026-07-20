'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Icon from '@/components/ui/AppIcon';

const POPULAR_PAGES = [
  { label: 'Configurateur IA', href: '/ai-configurator', icon: 'SparklesIcon' },
  { label: 'Boutique', href: '/shop', icon: 'ShoppingBagIcon' },
  { label: 'Destinations', href: '/pays', icon: 'GlobeAltIcon' },
  { label: 'Mon inventaire', href: '/inventaire', icon: 'ArchiveBoxIcon' },
];

export default function NotFound() {
  const router = useRouter();

  const handleGoBack = () => {
    if (typeof window !== 'undefined') {
      window.history?.back();
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#1C2620] p-4">
      <div className="text-center max-w-lg">
        {/* 404 number */}
        <div className="flex justify-center mb-6">
          <h1
            className="text-[10rem] font-bold leading-none"
            style={{
              fontFamily: 'var(--font-display)',
              color: '#E4501C',
              opacity: 0.2,
            }}
          >
            404
          </h1>
        </div>

        {/* Label */}
        <p
          className="text-[10px] font-mono text-[#E4501C] tracking-[0.25em] uppercase mb-3"
          style={{ fontFamily: 'var(--font-mono)' }}
        >
          Page introuvable
        </p>

        <h2
          className="text-2xl font-bold text-white mb-3"
          style={{ fontFamily: 'var(--font-display)' }}
        >
          Cette page n&apos;existe pas
        </h2>
        <p className="text-white/50 mb-8 text-sm leading-relaxed">
          La page que vous cherchez a peut-être été déplacée, renommée ou n&apos;existe plus.
          Voici quelques liens utiles pour reprendre votre aventure.
        </p>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-3 justify-center mb-10">
          <button
            onClick={handleGoBack}
            className="inline-flex items-center justify-center gap-2 bg-white/10 hover:bg-white/20 text-white px-6 py-3 rounded-xl font-medium text-sm transition-all"
          >
            <Icon name="ArrowLeftIcon" size={16} variant="outline" />
            Retour
          </button>
          <Link
            href="/"
            className="inline-flex items-center justify-center gap-2 bg-[#E4501C] hover:bg-[#cc3d10] text-white px-6 py-3 rounded-xl font-semibold text-sm transition-all hover:-translate-y-px hover:shadow-lg hover:shadow-[#E4501C]/30"
          >
            <Icon name="HomeIcon" size={16} variant="outline" />
            Accueil
          </Link>
        </div>

        {/* Popular pages */}
        <div>
          <p className="text-xs text-white/30 font-mono tracking-widest uppercase mb-4" style={{ fontFamily: 'var(--font-mono)' }}>
            Pages populaires
          </p>
          <div className="grid grid-cols-2 gap-2">
            {POPULAR_PAGES.map((page) => (
              <Link
                key={page.href}
                href={page.href}
                className="flex items-center gap-2.5 bg-white/5 hover:bg-white/10 border border-white/8 rounded-xl px-4 py-3 text-sm text-white/60 hover:text-white transition-all"
              >
                <Icon name={page.icon as string} size={14} variant="outline" className="text-[#E4501C]" />
                {page.label}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}