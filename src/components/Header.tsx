'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { getCart, getCartTotals } from '@/lib/cart';
import { useAuth } from '@/contexts/AuthContext';

const NAV_LINKS = [
  { label: 'Aventures', href: '/explorer' },
  { label: 'Refuges', href: '/pays' },
  { label: 'Boutique', href: '/boutique' },
  { label: 'Journal', href: '/blog' },
];

export default function Header() {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [cartCount, setCartCount] = useState(0);
  const [mounted, setMounted] = useState(false);
  const router = useRouter();
  const { user } = useAuth();

  useEffect(() => {
    setMounted(true);
  }, []);

  const onScroll = useCallback(() => setScrolled(window.scrollY > 20), []);

  useEffect(() => {
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [onScroll]);

  useEffect(() => {
    const updateCart = () => {
      const items = getCart();
      const { totalItems } = getCartTotals(items);
      setCartCount(totalItems);
    };
    updateCart();
    window.addEventListener('storage', updateCart);
    return () => window.removeEventListener('storage', updateCart);
  }, []);

  useEffect(() => {
    document.body.style.overflow = menuOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [menuOpen]);

  return (
    <>
      <header
        suppressHydrationWarning
        className={`hidden md:block fixed top-0 left-0 right-0 z-50 transition-all duration-200 ${
          scrolled
            ? 'bg-white border-b border-[#E0DDD0] shadow-sm'
            : 'bg-white border-b border-[#E0DDD0]'
        }`}
        role="banner"
      >
        <div className="max-w-6xl mx-auto px-6 lg:px-8">
          <div className="flex items-center justify-between h-14" suppressHydrationWarning>
            {/* Logo */}
            <Link
              href="/"
              className="flex items-center gap-0 group focus-visible:outline-none"
              aria-label="Le Kit du Voyageur — Accueil"
              suppressHydrationWarning
            >
              <span
                className="text-[#0E1512] tracking-tight leading-none"
                style={{ fontFamily: '"General Sans", "DM Sans", sans-serif', fontSize: '0.9375rem', fontWeight: 600 }}
              >
                Le Kit du Voyageur
              </span>
            </Link>

            {/* Desktop Nav */}
            <nav className="hidden lg:flex items-center gap-8" aria-label="Navigation principale">
              {NAV_LINKS?.map((link) => (
                <Link
                  key={link?.href}
                  href={link?.href}
                  className="text-sm text-[#4A6355] hover:text-[#0E1512] transition-colors duration-150 font-medium"
                >
                  {link?.label}
                </Link>
              ))}
            </nav>

            {/* Right actions */}
            <div className="flex items-center gap-4" suppressHydrationWarning>
              <Link
                href="/configurateur"
                className="hidden lg:inline-flex items-center gap-1.5 text-sm font-semibold text-[#1C2620] hover:text-[#0E1512] transition-colors"
              >
                Configurateur
              </Link>
              <Link
                href="/panier"
                className="relative flex items-center gap-1.5 text-sm font-medium text-[#1C2620] hover:text-[#0E1512] transition-colors min-h-[44px]"
                aria-label={`Panier${cartCount > 0 ? ` — ${cartCount} article${cartCount > 1 ? 's' : ''}` : ''}`}
                suppressHydrationWarning
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/>
                  <line x1="3" y1="6" x2="21" y2="6"/>
                  <path d="M16 10a4 4 0 0 1-8 0"/>
                </svg>
                {mounted && cartCount > 0 && (
                  <span className="absolute -top-1 -right-2 w-4 h-4 bg-[#1C2620] text-white text-[9px] font-bold rounded-full flex items-center justify-center">
                    {cartCount > 9 ? '9+' : cartCount}
                  </span>
                )}
              </Link>
              {user ? (
                <Link
                  href="/compte"
                  className="hidden lg:flex items-center justify-center w-8 h-8 rounded-full bg-[#EBF0EB] text-[#1C2620] text-xs font-semibold hover:bg-[#C8D4C8] transition-colors"
                  aria-label="Mon compte"
                >
                  {user?.email?.charAt(0)?.toUpperCase() ?? 'M'}
                </Link>
              ) : (
                <Link
                  href="/connexion"
                  className="hidden lg:inline-flex text-sm font-medium text-[#4A6355] hover:text-[#0E1512] transition-colors"
                >
                  Connexion
                </Link>
              )}
            </div>
          </div>
        </div>
      </header>
      {/* Mobile header */}
      <header
        suppressHydrationWarning
        className="md:hidden fixed top-0 left-0 right-0 z-50 bg-white border-b border-[#E0DDD0]"
        role="banner"
      >
        <div className="flex items-center justify-between h-12 px-4">
          <Link href="/" className="text-sm font-semibold text-[#0E1512]" suppressHydrationWarning>
            Le Kit du Voyageur
          </Link>
          <div className="flex items-center gap-3">
            <Link href="/panier" className="relative" aria-label="Panier" suppressHydrationWarning>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#1C2620" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/>
                <line x1="3" y1="6" x2="21" y2="6"/>
                <path d="M16 10a4 4 0 0 1-8 0"/>
              </svg>
              {mounted && cartCount > 0 && (
                <span className="absolute -top-1 -right-1.5 w-3.5 h-3.5 bg-[#1C2620] text-white text-[8px] font-bold rounded-full flex items-center justify-center">
                  {cartCount}
                </span>
              )}
            </Link>
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              className="flex flex-col gap-1.5 p-1"
              aria-label={menuOpen ? 'Fermer le menu' : 'Ouvrir le menu'}
              aria-expanded={menuOpen}
            >
              <span className={`block w-5 h-0.5 bg-[#1C2620] transition-all duration-200 ${menuOpen ? 'rotate-45 translate-y-2' : ''}`} />
              <span className={`block w-5 h-0.5 bg-[#1C2620] transition-all duration-200 ${menuOpen ? 'opacity-0' : ''}`} />
              <span className={`block w-5 h-0.5 bg-[#1C2620] transition-all duration-200 ${menuOpen ? '-rotate-45 -translate-y-2' : ''}`} />
            </button>
          </div>
        </div>

        {/* Mobile menu */}
        {menuOpen && (
          <div className="bg-white border-t border-[#E0DDD0] px-4 py-6 flex flex-col gap-4">
            {NAV_LINKS?.map((link) => (
              <Link
                key={link?.href}
                href={link?.href}
                className="text-base font-medium text-[#1C2620] py-1"
                onClick={() => setMenuOpen(false)}
              >
                {link?.label}
              </Link>
            ))}
            <Link
              href="/configurateur"
              className="text-base font-semibold text-[#1C2620] py-1"
              onClick={() => setMenuOpen(false)}
            >
              Configurateur
            </Link>
            <div className="pt-2 border-t border-[#E0DDD0]">
              {user ? (
                <Link href="/compte" className="text-sm text-[#4A6355]" onClick={() => setMenuOpen(false)}>Mon compte</Link>
              ) : (
                <Link href="/connexion" className="text-sm text-[#4A6355]" onClick={() => setMenuOpen(false)}>Connexion</Link>
              )}
            </div>
          </div>
        )}
      </header>
    </>
  );
}