'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import Icon from '@/components/ui/AppIcon';

const FOOTER_LINKS = [
  { label: 'Earth', href: '/pays' },
  { label: 'Clubs', href: '/communaute' },
  { label: 'Configurateur IA', href: '/ai-configurator' },
  { label: 'FAQ & Aide', href: '/faq' },
  { label: 'Contact', href: '/contact' },
];

const LEGAL_LINKS = [
  { label: 'Mentions légales', href: '/mentions-legales' },
  { label: 'CGV / CGU', href: '/cgu' },
  { label: 'Confidentialité', href: '/cookies' },
];

const glassCapsule: React.CSSProperties = {
  background: 'linear-gradient(180deg, rgba(255, 255, 255, 0.72) 0%, rgba(255, 255, 255, 0.38) 100%)',
  backdropFilter: 'blur(20px) saturate(180%)',
  WebkitBackdropFilter: 'blur(20px) saturate(180%)',
  border: '1px solid rgba(255, 255, 255, 0.75)',
  boxShadow: 'inset 0 1px 1px rgba(255, 255, 255, 0.9)',
};

export default function Footer() {
  const [email, setEmail] = useState('');
  const [subscribed, setSubscribed] = useState(false);

  const handleSubscribe = (e: React.FormEvent) => {
    e.preventDefault();
    if (email.trim()) {
      setSubscribed(true);
      setEmail('');
      setTimeout(() => setSubscribed(false), 4000);
    }
  };

  return (
    <footer className="w-full max-w-[1000px] mx-auto px-4 pt-12 pb-8 flex flex-col gap-3 font-sans" role="contentinfo">

      {/* NEWSLETTER CAPSULE (Pill shape like header) */}
      <div className="w-full rounded-full px-5 py-2.5 flex flex-col sm:flex-row items-center justify-between gap-3 transition-all" style={glassCapsule}>
        <div className="flex items-center gap-2 text-[#17402C] text-xs font-semibold px-1">
          <span className="w-2 h-2 rounded-full bg-[#17402C] animate-pulse" />
          <span>Restez informé des meilleures sorties & équipements</span>
        </div>

        {subscribed ? (
          <div className="text-xs font-bold text-[#17402C] px-3 py-1 flex items-center gap-1.5 animate-fade-in">
            <Icon name="CheckCircleIcon" size={14} />
            <span>Bienvenue dans l'aventure !</span>
          </div>
        ) : (
          <form onSubmit={handleSubscribe} className="flex items-center gap-2 w-full sm:w-auto">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Votre email..."
              required
              className="text-[#17402C] text-[11px] font-medium px-3.5 py-1.5 rounded-full border outline-none placeholder-[#5A7064] w-full sm:w-48"
              style={{ background: 'rgba(255,255,255,0.92)', borderColor: 'rgba(255,255,255,0.60)', boxShadow: 'inset 0 1px 1px rgba(255,255,255,0.8)' }}
            />
            <button
              type="submit"
              className="glass-capsule-btn primary text-[11px] font-semibold px-4 shrink-0"
              style={{ padding: '4px 16px' }}
            >
              S'inscrire
            </button>
          </form>
        )}
      </div>

      {/* MAIN FOOTER CAPSULE (Identical style to Header) */}
      <div className="w-full rounded-full px-5 py-3 flex flex-col md:flex-row items-center justify-between gap-4 transition-all" style={glassCapsule}>

        {/* Left: Brand Logo (Sans texte) */}
        <Link href="/" className="flex items-center group focus-visible:outline-none shrink-0" aria-label="Accueil LKDV">
          <div className="w-8 h-8 min-w-[32px] min-h-[32px] max-w-[32px] max-h-[32px] rounded-full overflow-hidden border border-white/80 shadow-xs group-hover:scale-105 transition-transform bg-[#17402C]/10 shrink-0">
            <img
              src="/assets/images/app_logo.png"
              alt="LKDV"
              width={32}
              height={32}
              className="w-full h-full object-cover rounded-full"
            />
          </div>
        </Link>

        {/* Center: Navigation Links */}
        <nav className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2">
          {FOOTER_LINKS.map((link) => (
            <Link
              key={link.label}
              href={link.href}
              className="text-[11px] font-semibold tracking-wide uppercase transition-colors text-[#5A7064] hover:text-[#17402C]"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        {/* Right: Copyright & Security badge */}
        <div className="flex items-center gap-3 shrink-0">
          <span className="text-[10px] font-semibold text-[#5A7064]">
            © {new Date().getFullYear()}
          </span>
          <div className="glass-pill flex items-center gap-1 text-[10px] font-semibold text-[#17402C] px-3 py-1.5">
            <Icon name="ShieldCheckIcon" size={12} className="text-[#17402C]" />
            <span>100% Sécurisé</span>
          </div>
        </div>

      </div>

      {/* SUB-BAR: LEGAL LINKS */}
      <div className="flex flex-wrap items-center justify-center gap-4 text-[10px] font-semibold text-[#5A7064] px-4 pt-1">
        {LEGAL_LINKS.map((link) => (
          <Link key={link.label} href={link.href} className="hover:text-[#17402C] transition-colors">
            {link.label}
          </Link>
        ))}
        <span>• Conçu dans les Alpes 🏔️</span>
      </div>

    </footer>
  );
}
