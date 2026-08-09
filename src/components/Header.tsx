'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import Icon from '@/components/ui/AppIcon';
import { useAuth } from '@/contexts/AuthContext';
import GlobalSearchModal from '@/components/ui/GlobalSearchModal';

const NAV_LINKS = [
  { label: 'Aventures', href: '/explorer' },
  { label: 'Earth', href: '/pays' },
  { label: 'Boutique', href: '/boutique' },
  { label: 'Communauté', href: '/communaute' },
];

export default function Header() {
  const pathname = usePathname();
  const { user } = useAuth();
  const [mounted, setMounted] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    setMounted(true);

    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <>
      <header className="fixed top-3 sm:top-4 left-1/2 -translate-x-1/2 z-[1000] w-full max-w-[1020px] px-3 sm:px-4 pointer-events-none transition-all duration-300">
        <div
          className={`w-full rounded-full px-4 sm:px-5 transition-all duration-300 flex items-center justify-between pointer-events-auto cursor-default ${
            scrolled
              ? 'bg-white/95 backdrop-blur-2xl shadow-xl border border-[#1C2620]/20 py-2'
              : 'bg-white/95 backdrop-blur-xl shadow-md border border-[#E8E4D8] py-2.5'
          }`}
        >
          {/* Left: Logo */}
          <Link
            href="/"
            className="flex items-center gap-2 group focus-visible:outline-none active:scale-95 transition-transform cursor-pointer touch-manipulation py-1"
          >
            <div className="w-8 h-8 bg-[#1C2620] rounded-xl flex items-center justify-center group-hover:scale-105 transition-transform shadow-sm">
              <svg width="15" height="15" fill="white" viewBox="0 0 24 24">
                <path d="M3 17l4-8 4 4 3-6 4 10H3z" />
              </svg>
            </div>
            <span className="font-bold text-[#1C2620] text-sm tracking-tight group-hover:opacity-80 transition-opacity">
              Le Kit du Voyageur
            </span>
          </Link>

          {/* Center: Navigation Links */}
          <nav className="flex items-center gap-1 sm:gap-4 md:gap-6 overflow-x-auto no-scrollbar py-0.5">
            {NAV_LINKS.map((link) => {
              const isActive = pathname === link.href || (link.href !== '/' && pathname?.startsWith(link.href));
              return (
                <Link
                  key={link.label}
                  href={link.href}
                  className={`relative text-[11px] sm:text-xs font-bold tracking-wide uppercase transition-all duration-200 px-2 py-2 rounded-full cursor-pointer touch-manipulation hover:text-[#2D5A3D] whitespace-nowrap ${
                    isActive ? 'text-[#1C2620] bg-[#1C2620]/05' : 'text-[#6B7A72]'
                  }`}
                >
                  <span>{link.label}</span>
                  {isActive && (
                    <span className="absolute bottom-0 left-2 right-2 h-[2px] bg-[#1C2620] rounded-full" />
                  )}
                </Link>
              );
            })}
          </nav>

          {/* Right: Actions */}
          <div className="flex items-center gap-1.5 sm:gap-2.5">
            {/* Bouton Lancer Rando */}
            <Link
              href="/randonnee-active"
              className="hidden lg:inline-flex items-center gap-1.5 bg-[#2D6A4F] text-white text-[11px] font-bold px-3.5 py-2 min-h-[38px] rounded-full hover:bg-[#1B4332] active:scale-95 transition-all shadow-sm cursor-pointer touch-manipulation whitespace-nowrap"
              title="Lancer le mode randonnée GPS"
            >
              <span>🥾</span>
              <span>Lancer rando</span>
            </Link>

            {/* Panier */}
            <Link
              href="/panier"
              className="w-10 h-10 text-[#1C2620] hover:text-[#2D5A3D] hover:bg-[#F5F2EA] transition-all rounded-full active:scale-90 flex items-center justify-center relative cursor-pointer touch-manipulation"
              aria-label="Panier"
              title="Panier"
            >
              <Icon name="ShoppingBagIcon" size={18} />
            </Link>

            {/* Recherche */}
            <button
              onClick={() => setSearchOpen(true)}
              className="w-10 h-10 text-[#1C2620] hover:text-[#2D5A3D] hover:bg-[#F5F2EA] transition-all rounded-full active:scale-90 flex items-center justify-center cursor-pointer touch-manipulation"
              aria-label="Rechercher sur tout le site"
              title="Rechercher sur tout le site"
            >
              <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
            </button>

            {/* Mon Compte */}
            <Link
              href={user ? '/compte' : '/connexion'}
              className="bg-[#1C2620] text-white text-[11px] font-bold px-3.5 py-2 min-h-[38px] rounded-full hover:bg-[#2D3F35] active:scale-95 transition-all shadow-sm whitespace-nowrap flex items-center justify-center cursor-pointer touch-manipulation"
            >
              {mounted && user ? 'Mon compte' : 'Se connecter'}
            </Link>
          </div>
        </div>
      </header>

      {/* Global Site Search Overlay */}
      <GlobalSearchModal isOpen={searchOpen} onClose={() => setSearchOpen(false)} />
    </>
  );
}
