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
      <div className="w-full bg-white/95 backdrop-blur-md shadow-sm border border-[#E8E4D8] rounded-full px-5 py-2.5 flex flex-col sm:flex-row items-center justify-between gap-3 transition-all">
        <div className="flex items-center gap-2 text-[#1C2620] text-xs font-semibold px-1">
          <span className="w-2 h-2 rounded-full bg-[#2D5A3D] animate-pulse" />
          <span>Restez informé des meilleures sorties & équipements</span>
        </div>

        {subscribed ? (
          <div className="text-xs font-bold text-[#2D5A3D] px-3 py-1 flex items-center gap-1.5 animate-fade-in">
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
              className="bg-[#F5F3ED] text-[#1C2620] text-[11px] font-medium px-3.5 py-1.5 rounded-full border border-[#E8E4D8] outline-none placeholder-[#7A8A7D] w-full sm:w-48"
            />
            <button
              type="submit"
              className="bg-[#1C2620] text-white text-[11px] font-semibold px-4 py-1.5 rounded-full hover:bg-[#2D3F35] transition-colors whitespace-nowrap shrink-0"
            >
              S'inscrire
            </button>
          </form>
        )}
      </div>

      {/* MAIN FOOTER CAPSULE (Identical style to Header) */}
      <div className="w-full bg-white/95 backdrop-blur-md shadow-sm border border-[#E8E4D8] rounded-full px-5 py-3 flex flex-col md:flex-row items-center justify-between gap-4 transition-all">
        
        {/* Left: Brand */}
        <Link href="/" className="flex items-center gap-2 group focus-visible:outline-none shrink-0">
          <div className="w-7 h-7 bg-[#1C2620] rounded-lg flex items-center justify-center">
            <svg width="14" height="14" fill="white" viewBox="0 0 24 24">
              <path d="M3 17l4-8 4 4 3-6 4 10H3z" />
            </svg>
          </div>
          <span className="font-bold text-[#1C2620] text-sm group-hover:opacity-80 transition-opacity">Le Kit du Voyageur</span>
        </Link>

        {/* Center: Navigation Links */}
        <nav className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2">
          {FOOTER_LINKS.map((link) => (
            <Link
              key={link.label}
              href={link.href}
              className="text-[11px] font-semibold tracking-wide uppercase transition-colors text-[#7A8A7D] hover:text-[#2D5A3D]"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        {/* Right: Copyright & Security badge */}
        <div className="flex items-center gap-3 shrink-0">
          <span className="text-[10px] font-semibold text-[#7A8A7D]">
            © {new Date().getFullYear()}
          </span>
          <div className="flex items-center gap-1 text-[10px] font-semibold text-[#1C2620] bg-[#F5F3ED] px-3 py-1.5 rounded-full border border-[#E8E4D8]">
            <Icon name="ShieldCheckIcon" size={12} className="text-[#2D5A3D]" />
            <span>100% Sécurisé</span>
          </div>
        </div>

      </div>

      {/* SUB-BAR: LEGAL LINKS */}
      <div className="flex flex-wrap items-center justify-center gap-4 text-[10px] font-semibold text-[#7A8A7D] px-4 pt-1">
        {LEGAL_LINKS.map((link) => (
          <Link key={link.label} href={link.href} className="hover:text-[#1C2620] transition-colors">
            {link.label}
          </Link>
        ))}
        <span>• Conçu dans les Alpes 🏔️</span>
      </div>

    </footer>
  );
}
