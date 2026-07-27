'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import AppLogo from '@/components/ui/AppLogo';
import Icon from '@/components/ui/AppIcon';

const FOOTER_COLS = [
  {
    title: 'Explorer',
    links: [
      { label: 'Tous les équipements', href: '/boutique' },
      { label: 'Configurateur IA', href: '/ai-configurator' },
      { label: 'Destinations & Pays', href: '/pays' },
      { label: 'Guides de voyage', href: '/guides' },
    ],
  },
  {
    title: 'Engagements',
    links: [
      { label: 'Occasion vérifiée', href: '/occasion' },
      { label: 'Location de matériel', href: '/location' },
      { label: 'Notre impact éco', href: '/impact' },
      { label: 'Programme fidélité', href: '/fidelite' },
    ],
  },
  {
    title: 'Ressources',
    links: [
      { label: 'Carnets d\'expédition', href: '/carnets' },
      { label: 'La Communauté', href: '/communaute' },
      { label: 'Centre d\'aide', href: '/faq' },
      { label: 'Nous contacter', href: '/contact' },
    ],
  },
];

const LANGUAGES = [
  { code: 'fr', label: 'FR', name: 'Français' },
  { code: 'en', label: 'EN', name: 'English' },
];

export default function Footer() {
  const [lang, setLang] = useState('fr');
  const [langOpen, setLangOpen] = useState(false);

  return (
    <footer className="bg-[#1C2620] text-white overflow-hidden relative" role="contentinfo">
      {/* Background decoration */}
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[#E4501C]/50 to-transparent opacity-50" />
      
      {/* Top CTA band */}
      <div className="relative z-10 border-b border-white/5">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14 flex flex-col md:flex-row items-center justify-between gap-8">
          <div className="text-center md:text-left max-w-lg">
            <h3 className="font-display font-800 text-3xl sm:text-4xl tracking-tight mb-3">
              L'aventure commence ici.
            </h3>
            <p className="text-white/50 text-sm leading-relaxed">
              Le premier écosystème intelligent dédié à la préparation de vos voyages et expéditions. Ne laissez rien au hasard.
            </p>
          </div>
          <Link
            href="/ai-configurator"
            className="group flex-shrink-0 flex items-center justify-center gap-3 bg-[#E4501C] hover:bg-[#cc3d10] text-white px-8 py-4 rounded-xl font-semibold text-sm transition-all hover:scale-[1.02] active:scale-95 shadow-xl shadow-[#E4501C]/20"
          >
            <Icon name="SparklesIcon" size={18} />
            Créer mon kit sur-mesure
          </Link>
        </div>
      </div>

      {/* Main footer grid */}
      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-8">
          
          {/* Brand col */}
          <div className="lg:col-span-5 flex flex-col items-center lg:items-start text-center lg:text-left">
            <Link href="/" className="flex items-center gap-3 mb-6" aria-label="Kit du Voyageur">
              <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center shadow-lg">
                <AppLogo size={24} />
              </div>
              <div className="flex flex-col leading-none">
                <span className="font-display font-800 text-white text-xl tracking-tight">Le Kit du Voyageur</span>
                <span className="text-[10px] font-mono text-[#E4501C] tracking-[0.15em] uppercase mt-1">Équipement & IA</span>
              </div>
            </Link>
            <p className="text-sm text-white/50 leading-relaxed mb-8 max-w-xs">
              Conçu dans les Alpes pour les voyageurs du monde entier. La technologie au service de l'exploration.
            </p>
            {/* Social */}
            <div className="flex items-center gap-3">
              {[
                { icon: 'CameraIcon', label: 'Instagram' },
                { icon: 'GlobeAltIcon', label: 'Twitter' },
                { icon: 'PlayCircleIcon', label: 'YouTube' },
              ].map(({ icon, label }) => (
                <a
                  key={label}
                  href="#"
                  aria-label={label}
                  className="w-10 h-10 rounded-full border border-white/10 hover:border-[#E4501C]/50 hover:bg-[#E4501C]/10 flex items-center justify-center text-white/50 hover:text-[#E4501C] transition-all"
                >
                  <Icon name={icon as string} size={16} variant="outline" />
                </a>
              ))}
            </div>
          </div>

          {/* Nav cols */}
          <div className="lg:col-span-7 grid grid-cols-1 sm:grid-cols-3 gap-10 sm:gap-6 text-center sm:text-left">
            {FOOTER_COLS.map((col) => (
              <div key={col.title}>
                <h4 className="text-xs font-mono text-white/40 tracking-wider uppercase mb-5">
                  {col.title}
                </h4>
                <ul className="space-y-4">
                  {col.links.map((link) => (
                    <li key={link.href}>
                      <Link
                        href={link.href}
                        className="text-sm text-white/70 hover:text-white transition-colors relative inline-block group"
                      >
                        {link.label}
                        <span className="absolute -bottom-1 left-0 w-0 h-px bg-[#E4501C] transition-all group-hover:w-full"></span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Bottom bar */}
      <div className="relative z-10 border-t border-white/5 bg-black/20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 flex flex-col md:flex-row items-center justify-between gap-6">
          <p className="text-xs text-white/40 font-medium">
            © {new Date().getFullYear()} Le Kit du Voyageur. Tous droits réservés.
          </p>

          <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-3">
            <Link href="/mentions-legales" className="text-xs text-white/40 hover:text-white transition-colors">Mentions légales</Link>
            <Link href="/cgu" className="text-xs text-white/40 hover:text-white transition-colors">CGV / CGU</Link>
            <Link href="/politique-confidentialite" className="text-xs text-white/40 hover:text-white transition-colors">Confidentialité</Link>
            <Link href="/cookies" className="text-xs text-white/40 hover:text-white transition-colors">Cookies</Link>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 text-[10px] text-white/30 font-mono uppercase tracking-wider bg-white/5 px-3 py-1.5 rounded-lg border border-white/5">
              <Icon name="ShieldCheckIcon" size={14} variant="outline" className="text-emerald-500/80" />
              Paiement Sécurisé
            </div>
            {/* Language selector */}
            <div className="relative">
              <button
                onClick={() => setLangOpen(!langOpen)}
                className="flex items-center gap-2 text-xs font-medium text-white/50 hover:text-white transition-colors"
                aria-label="Changer de langue"
              >
                <Icon name="GlobeAltIcon" size={14} variant="outline" />
                {LANGUAGES.find(l => l.code === lang)?.label}
              </button>
              {langOpen && (
                <div className="absolute bottom-full right-0 mb-3 bg-[#2A3830] border border-white/10 rounded-xl shadow-xl overflow-hidden z-50 min-w-[120px] p-1">
                  {LANGUAGES.map(l => (
                    <button
                      key={l.code}
                      onClick={() => { setLang(l.code); setLangOpen(false); }}
                      className={`w-full flex items-center justify-between px-3 py-2 text-xs rounded-lg transition-colors ${lang === l.code ? 'bg-[#E4501C]/20 text-white font-medium' : 'text-white/60 hover:bg-white/5 hover:text-white'}`}
                    >
                      <span>{l.name}</span>
                      {lang === l.code && <Icon name="CheckIcon" size={12} className="text-[#E4501C]" />}
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

