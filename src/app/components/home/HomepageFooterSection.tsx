'use client';

import React from 'react';
import Link from 'next/link';
import AppLogo from '@/components/ui/AppLogo';
import Icon from '@/components/ui/AppIcon';

const footerLinks: Record<string, { label: string; href: string }[]> = {
  Explorer: [
    { label: 'Destinations', href: '/pays' },
    { label: 'Guides terrain', href: '/guides' },
    { label: 'Copilote IA', href: '/copilote' },
    { label: 'Outils', href: '/outils' },
  ],
  Marketplace: [
    { label: 'Boutique', href: '/boutique' },
    { label: 'Location', href: '/location' },
    { label: 'Occasion', href: '/occasion' },
    { label: 'Enchères', href: '/encheres' },
  ],
  Kits: [
    { label: 'Kits populaires', href: '/kits' },
    { label: 'Configurateur IA', href: '/ai-configurator' },
    { label: 'Catalogue', href: '/catalogue' },
  ],
  Communauté: [
    { label: 'Forum', href: '/communaute' },
    { label: 'Carnets', href: '/carnets' },
    { label: 'Clubs', href: '/clubs' },
    { label: 'Créateurs', href: '/createurs' },
  ],
  'À propos': [
    { label: 'Notre vision', href: '#vision' },
    { label: 'Pass Voyageur', href: '/abonnements' },
    { label: 'Pro & Marques', href: '/pro' },
  ],
  Support: [
    { label: 'Aide', href: '#' },
    { label: 'Contact', href: '#' },
    { label: 'Confidentialité', href: '#' },
  ],
};

export default function HomepageFooterSection() {
  return (
    <footer className="bg-[#1C2620] border-t border-white/6" role="contentinfo">
      <div className="border-b border-white/6">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 flex flex-col sm:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <AppLogo size={32} />
            <div>
              <p className="text-[9px] font-mono text-white/30 tracking-[0.2em] uppercase" style={{ fontFamily: 'var(--font-mono)' }}>
                Le Kit du
              </p>
              <p className="text-white text-lg tracking-tight leading-none" style={{ fontFamily: 'var(--font-display)', fontWeight: 800 }}>
                VOYAGEUR
              </p>
            </div>
          </div>
          <Link
            href="/ai-configurator"
            className="flex items-center gap-2 bg-[#E4501C] hover:bg-[#cc3d10] text-white px-6 py-3 rounded-xl font-semibold text-sm transition-all hover:-translate-y-px hover:shadow-lg hover:shadow-[#E4501C]/30"
          >
            <Icon name="SparklesIcon" size={15} variant="outline" />
            Créer mon Kit
          </Link>
        </div>
      </div>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-8">
          {Object.entries(footerLinks)?.map(([title, links]) => (
            <div key={title}>
              <p className="text-[10px] font-mono text-white/25 tracking-[0.2em] uppercase mb-4" style={{ fontFamily: 'var(--font-mono)' }}>
                {title}
              </p>
              <ul className="space-y-2.5">
                {links?.map(({ label, href }) => (
                  <li key={label}>
                    <Link href={href} className="text-xs text-white/40 hover:text-white/80 transition-colors">
                      {label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
      <div className="border-t border-white/6">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="text-xs text-white/25">© 2026 Le Kit du Voyageur · Tous droits réservés</p>
          <div className="flex items-center gap-4 text-[10px] font-mono text-white/20" style={{ fontFamily: 'var(--font-mono)' }}>
            <span>FR</span>
            <span>·</span>
            <span>EN</span>
            <span>·</span>
            <Icon name="ShieldCheckIcon" size={11} variant="outline" />
            <span>Paiement sécurisé</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
