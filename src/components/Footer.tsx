'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import AppLogo from '@/components/ui/AppLogo';
import Icon from '@/components/ui/AppIcon';

const FOOTER_COLS = [
  {
    title: 'Shop',
    links: [
      { label: 'Tous les produits', href: '/shop' },
      { label: 'Kits assemblés', href: '/shop?type=kit' },
      { label: 'Occasion vérifiée', href: '/shop?type=occasion' },
      { label: 'Enchères', href: '/shop?type=enchere' },
      { label: 'Location matériel', href: '/shop?type=location' },
    ],
  },
  {
    title: 'IA & Outils',
    links: [
      { label: 'Configurateur IA', href: '/ai-configurator' },
    ],
  },
  {
    title: 'Destinations',
    links: [
      { label: 'Toutes les destinations', href: '/pays' },
      { label: 'Guides de voyage', href: '/guides' },
    ],
  },
  {
    title: 'Communauté',
    links: [
      { label: 'Forum communauté', href: '/communaute' },
    ],
  },
];

const LANGUAGES = [
  { code: 'fr', label: 'FR', name: 'Français' },
  { code: 'en', label: 'EN', name: 'English' },
  { code: 'de', label: 'DE', name: 'Deutsch' },
  { code: 'es', label: 'ES', name: 'Español' },
];

export default function Footer() {
  const [lang, setLang] = useState('fr');
  const [langOpen, setLangOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <footer className="bg-[#1C2620] text-white/70" role="contentinfo" suppressHydrationWarning>
      {/* Top CTA band */}
      <div className="border-b border-white/8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 flex flex-col sm:flex-row items-center justify-between gap-6">
          <div>
            <p className="text-[10px] font-mono text-[#E4501C] tracking-[0.2em] uppercase mb-1.5" style={{ fontFamily: 'var(--font-mono)' }}>
              Prêt pour votre prochaine aventure ?
            </p>
            <h3 className="font-display font-800 text-white text-2xl tracking-tight" style={{ fontFamily: 'var(--font-display)', fontWeight: 800 }}>
              Configurez votre kit en 2 minutes.
            </h3>
          </div>
          <Link
            href="/ai-configurator"
            className="flex-shrink-0 flex items-center gap-2 bg-[#E4501C] hover:bg-[#cc3d10] text-white px-6 py-3 rounded-xl font-semibold text-sm transition-all hover:-translate-y-px hover:shadow-lg hover:shadow-[#E4501C]/30"
          >
            <Icon name="SparklesIcon" size={16} variant="outline" />
            Lancer le configurateur IA
          </Link>
        </div>
      </div>

      {/* Main footer grid */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-8 lg:gap-12">
          {/* Brand col */}
          <div className="col-span-2 md:col-span-1">
            <Link href="/" className="flex items-center gap-2.5 mb-5" aria-label="Kit du Voyageur">
              <AppLogo size={28} />
              <div className="flex flex-col leading-none">
                <span className="text-[9px] font-mono text-white/30 tracking-[0.2em] uppercase" style={{ fontFamily: 'var(--font-mono)' }}>Le Kit du</span>
                <span className="font-display font-800 text-white text-base tracking-tight" style={{ fontFamily: 'var(--font-display)', fontWeight: 800 }}>VOYAGEUR</span>
              </div>
            </Link>
            <p className="text-xs text-white/40 leading-relaxed mb-5">
              L&apos;équipement outdoor intelligent, configuré par l&apos;IA pour chaque destination.
            </p>
            {/* Social */}
            <div className="flex items-center gap-2">
              {[
                { icon: 'GlobeAltIcon', label: 'Twitter' },
                { icon: 'CameraIcon', label: 'Instagram' },
                { icon: 'PlayCircleIcon', label: 'YouTube' },
              ].map(({ icon, label }) => (
                <a
                  key={label}
                  href="#"
                  aria-label={label}
                  className="w-8 h-8 rounded-lg bg-white/6 hover:bg-white/12 flex items-center justify-center text-white/40 hover:text-white transition-all"
                >
                  <Icon name={icon as string} size={14} variant="outline" />
                </a>
              ))}
            </div>
          </div>

          {/* Nav cols */}
          {FOOTER_COLS.map((col) => (
            <div key={col.title}>
              <p className="text-[10px] font-mono text-white/30 tracking-[0.2em] uppercase mb-4" style={{ fontFamily: 'var(--font-mono)' }}>
                {col.title}
              </p>
              <ul className="space-y-2.5">
                {col.links.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className="text-xs text-white/50 hover:text-white transition-colors"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>

      {/* Bottom bar */}
      <div className="border-t border-white/8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="text-xs text-white/30">
            © 2026 Le Kit du Voyageur ·{' '}
            <Link href="#privacy" className="hover:text-white/60 transition-colors">Confidentialité</Link>
            {' '}·{' '}
            <Link href="#terms" className="hover:text-white/60 transition-colors">CGU</Link>
            {' '}·{' '}
            <Link href="/admin" className="hover:text-white/60 transition-colors">Admin</Link>
          </p>

          <div className="flex items-center gap-3">
            {/* Trust badges */}
            <div className="flex items-center gap-1.5 text-[10px] text-white/25 font-mono" style={{ fontFamily: 'var(--font-mono)' }}>
              <Icon name="ShieldCheckIcon" size={12} variant="outline" className="text-white/25" />
              Paiement sécurisé
            </div>
            <div className="w-px h-3 bg-white/10" />
            {/* Language selector */}
            <div className="relative">
              <button
                onClick={() => setLangOpen(!langOpen)}
                className="flex items-center gap-1.5 text-[10px] font-mono text-white/35 hover:text-white/60 transition-colors"
                style={{ fontFamily: 'var(--font-mono)' }}
                aria-label="Changer de langue"
              >
                <Icon name="GlobeAltIcon" size={12} variant="outline" />
                {LANGUAGES.find(l => l.code === lang)?.label}
                <Icon name="ChevronDownIcon" size={10} variant="outline" className={`transition-transform ${mounted && langOpen ? 'rotate-180' : ''}`} />
              </button>
              {mounted && langOpen && (
                <div className="absolute bottom-full right-0 mb-2 bg-[#243028] border border-white/10 rounded-xl shadow-xl overflow-hidden z-50 min-w-[130px]">
                  {LANGUAGES.map(l => (
                    <button
                      key={l.code}
                      onClick={() => { setLang(l.code); setLangOpen(false); }}
                      className={`w-full flex items-center gap-2.5 px-3 py-2.5 text-xs hover:bg-white/8 transition-colors ${lang === l.code ? 'text-[#E4501C]' : 'text-white/50'}`}
                    >
                      <span className="font-mono text-[10px] w-5" style={{ fontFamily: 'var(--font-mono)' }}>{l.label}</span>
                      <span>{l.name}</span>
                      {lang === l.code && <Icon name="CheckIcon" size={10} className="text-[#E4501C] ml-auto" variant="outline" />}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}