'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import AppLogo from '@/components/ui/AppLogo';
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

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <>
      <header className="fixed top-4 left-1/2 -translate-x-1/2 z-50 w-full max-w-[1000px] px-4">
        <div className="w-full bg-white/95 backdrop-blur-md shadow-sm border border-[#E8E4D8] rounded-full px-5 py-2.5 flex items-center justify-between transition-all">
          {/* Left: Logo */}
          <Link href="/" className="flex items-center gap-2 group focus-visible:outline-none">
            <div className="w-7 h-7 bg-[#1C2620] rounded-lg flex items-center justify-center">
              <svg width="14" height="14" fill="white" viewBox="0 0 24 24">
                <path d="M3 17l4-8 4 4 3-6 4 10H3z" />
              </svg>
            </div>
            <span className="font-bold text-[#1C2620] text-sm group-hover:opacity-80 transition-opacity">Le Kit du Voyageur</span>
          </Link>

          {/* Center: Links (hidden on mobile) */}
          <nav className="hidden md:flex items-center gap-6">
            {NAV_LINKS.map((link) => {
              const isActive = pathname === link.href;
              return (
                <Link
                  key={link.label}
                  href={link.href}
                  className={`text-[11px] font-semibold tracking-wide uppercase transition-colors hover:text-[#2D5A3D] ${
                    isActive ? 'text-[#1C2620]' : 'text-[#7A8A7D]'
                  }`}
                >
                  {link.label}
                </Link>
              );
            })}
          </nav>

          {/* Right: Actions */}
          <div className="flex items-center gap-3">
            <Link href="/panier" className="text-[#1C2620] hover:text-[#2D5A3D] transition-colors p-1 relative" aria-label="Panier">
              <Icon name="ShoppingBagIcon" size={16} />
            </Link>
            <button
              onClick={() => setSearchOpen(true)}
              className="text-[#1C2620] hover:text-[#2D5A3D] transition-colors p-1 flex items-center gap-1.5"
              aria-label="Rechercher sur tout le site"
              title="Rechercher sur tout le site"
            >
              <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
            </button>

            <Link
              href={user ? '/compte' : '/connexion'}
              className="bg-[#1C2620] text-white text-[11px] font-semibold px-4 py-2 rounded-full hover:bg-[#2D3F35] transition-colors whitespace-nowrap"
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

