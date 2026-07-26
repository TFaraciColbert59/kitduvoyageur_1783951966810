'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import AppLogo from '@/components/ui/AppLogo';
import Icon from '@/components/ui/AppIcon';
import { getCart, getCartTotals } from '@/lib/cart';
import { useAuth } from '@/contexts/AuthContext';
import { useWishlist } from '@/contexts/WishlistContext';

interface NavItem {
  label: string;
  href: string;
  desc?: string;
  icon?: string;
}

interface NavGroup {
  label: string;
  href?: string;
  items?: NavItem[];
}

// 4 items max in desktop header
const NAV_GROUPS: NavGroup[] = [
  {
    label: 'Boutique',
    items: [
      { label: 'Tous les produits', href: '/boutique', desc: 'Équipement outdoor sélectionné', icon: 'ShoppingBagIcon' },
      { label: 'Kits assemblés', href: '/kits', desc: 'Kits prêts à l\'emploi', icon: 'CubeIcon' },
      { label: 'Occasion vérifiée', href: '/occasion', desc: 'Matériel d\'occasion certifié', icon: 'TagIcon' },
    ],
  },
  {
    label: 'Destinations',
    items: [
      { label: 'Toutes les destinations', href: '/pays', desc: 'Fiches pays & conseils terrain', icon: 'MapPinIcon' },
      { label: 'Aventures', href: '/aventures', desc: 'Itinéraires & refuges sélectionnés', icon: 'MapIcon' },
      { label: 'Explorer la carte', href: '/explorer', desc: 'Sentiers & aventures', icon: 'MapIcon' },
      { label: 'Guides de voyage', href: '/guides', desc: 'Conseils & tutoriels', icon: 'BookOpenIcon' },
    ],
  },
  {
    label: 'Configurateur IA',
    href: '/ai-configurator',
  },
  {
    label: 'Outils & Plus',
    items: [
      { label: 'Outils pratiques', href: '/outils', desc: 'Calculateurs, convertisseurs, checklist', icon: 'WrenchScrewdriverIcon' },
      { label: 'Communauté', href: '/communaute', desc: 'Échanges entre voyageurs', icon: 'UsersIcon' },
      { label: 'Carnets d\'expédition', href: '/carnets', desc: 'Récits de voyage vérifiés', icon: 'BookOpenIcon' },
      { label: 'Abonnements', href: '/abonnements', desc: 'Box mensuelle & accès premium', icon: 'StarIcon' },
      { label: 'Espace Pro', href: '/pro', desc: 'Solutions B2B & revendeurs', icon: 'BriefcaseIcon' },
    ],
  },
];

export default function Header() {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [activeGroup, setActiveGroup] = useState<string | null>(null);
  const [cartCount, setCartCount] = useState(0);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [mounted, setMounted] = useState(false);
  const megaRef = useRef<HTMLDivElement>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const mobileMenuRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const { user } = useAuth();
  const { count: wishlistCount } = useWishlist();

  useEffect(() => {
    setMounted(true);
  }, []);

  const onScroll = useCallback(() => setScrolled(window.scrollY > 40), []);

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

  useEffect(() => {
    if (searchOpen) {
      setTimeout(() => searchInputRef.current?.focus(), 50);
    }
  }, [searchOpen]);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setActiveGroup(null);
        setSearchOpen(false);
        if (menuOpen) setMenuOpen(false);
      }
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [menuOpen]);

  useEffect(() => {
    if (!menuOpen || !mobileMenuRef.current) return;
    const focusable = mobileMenuRef.current.querySelectorAll<HTMLElement>(
      'a, button, input, [tabindex]:not([tabIndex="-1"])'
    );
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    const trap = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;
      if (e.shiftKey) {
        if (document.activeElement === first) { e.preventDefault(); last.focus(); }
      } else {
        if (document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    };
    document.addEventListener('keydown', trap);
    first?.focus();
    return () => document.removeEventListener('keydown', trap);
  }, [menuOpen]);

  const handleGroupEnter = useCallback((label: string) => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    setActiveGroup(label);
  }, []);

  const handleGroupLeave = useCallback(() => {
    closeTimer.current = setTimeout(() => setActiveGroup(null), 120);
  }, []);

  const handleMegaEnter = useCallback(() => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
  }, []);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      router.push(`/kits?q=${encodeURIComponent(searchQuery.trim())}`);
      setSearchOpen(false);
      setSearchQuery('');
    }
  };

  return (
    <>
      <header
        suppressHydrationWarning
        className={`hidden md:block fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
          scrolled
            ? 'bg-[#1C2620]/97 backdrop-blur-md shadow-lg shadow-black/30 border-b border-white/5'
            : 'bg-[#1C2620]'
        }`}
        role="banner"
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8" suppressHydrationWarning>
          <div className="flex items-center justify-between h-16" suppressHydrationWarning>
            {/* Logo */}
            <Link href="/" className="flex items-center gap-2.5 group flex-shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E4501C] focus-visible:ring-offset-2 focus-visible:ring-offset-[#1C2620] rounded-lg" aria-label="Le Kit du Voyageur — Accueil" suppressHydrationWarning>
              <AppLogo size={30} className="flex-shrink-0" />
              <div className="flex flex-col leading-none">
                <span className="text-[9px] font-mono text-white/40 tracking-[0.2em] uppercase" style={{ fontFamily: 'var(--font-mono)' }}>
                  Le Kit du
                </span>
                <span className="font-display font-800 text-white text-[17px] tracking-tight leading-none" style={{ fontFamily: 'var(--font-display)', fontWeight: 800 }}>
                  VOYAGEUR
                </span>
              </div>
            </Link>

            {/* Desktop Nav — 4 items max */}
            <nav className="hidden lg:flex items-center gap-0.5" aria-label="Navigation principale">
              {NAV_GROUPS.map((group) => (
                <div
                  key={group.label}
                  className="relative"
                  onMouseEnter={() => group.items ? handleGroupEnter(group.label) : undefined}
                  onMouseLeave={group.items ? handleGroupLeave : undefined}
                >
                  {group.href ? (
                    <Link
                      href={group.href}
                      className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-sm font-semibold transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E4501C] focus-visible:ring-offset-1 focus-visible:ring-offset-[#1C2620] min-h-[44px] bg-[#E4501C]/10 text-[#E4501C] hover:bg-[#E4501C]/20"
                    >
                      <Icon name="SparklesIcon" size={14} variant="outline" />
                      {group.label}
                    </Link>
                  ) : (
                    <button
                      className={`flex items-center gap-1 px-3.5 py-2 rounded-lg text-sm font-medium transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E4501C] focus-visible:ring-offset-1 focus-visible:ring-offset-[#1C2620] min-h-[44px] ${
                        activeGroup === group.label
                          ? 'text-white bg-white/10' : 'text-white/75 hover:text-white hover:bg-white/8'
                      }`}
                      aria-expanded={activeGroup === group.label}
                      aria-haspopup="true"
                      onFocus={() => group.items ? handleGroupEnter(group.label) : undefined}
                      onBlur={group.items ? handleGroupLeave : undefined}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          setActiveGroup(activeGroup === group.label ? null : group.label);
                        }
                        if (e.key === 'ArrowDown') {
                          e.preventDefault();
                          setActiveGroup(group.label);
                        }
                      }}
                    >
                      {group.label}
                      <Icon
                        name="ChevronDownIcon"
                        size={12}
                        variant="outline"
                        className={`transition-transform duration-200 ${activeGroup === group.label ? 'rotate-180' : ''}`}
                      />
                    </button>
                  )}

                  {/* Dropdown */}
                  {group.items && activeGroup === group.label && (
                    <div
                      ref={megaRef}
                      className="absolute top-full left-0 mt-1 w-64 bg-[#1C2620] border border-white/10 rounded-xl shadow-2xl shadow-black/50 overflow-hidden z-50"
                      onMouseEnter={handleMegaEnter}
                      onMouseLeave={handleGroupLeave}
                      role="menu"
                      aria-label={`Menu ${group.label}`}
                    >
                      <div className="p-1.5">
                        {group.items.map((item) => (
                          <Link
                            key={item.href}
                            href={item.href}
                            role="menuitem"
                            onClick={() => setActiveGroup(null)}
                            className="flex items-start gap-3 px-3 py-2.5 rounded-lg hover:bg-white/8 transition-colors group/item focus-visible:outline-none focus-visible:bg-white/8"
                          >
                            {item.icon && (
                              <div className="flex-shrink-0 w-7 h-7 rounded-lg bg-white/6 flex items-center justify-center mt-0.5">
                                <Icon name={item.icon} size={14} variant="outline" className="text-white/50 group-hover/item:text-[#E4501C] transition-colors" />
                              </div>
                            )}
                            <div className="min-w-0">
                              <p className="text-sm font-medium text-white/85 group-hover/item:text-white transition-colors leading-tight">
                                {item.label}
                              </p>
                              {item.desc && (
                                <p className="text-xs text-white/35 mt-0.5 leading-snug">{item.desc}</p>
                              )}
                            </div>
                          </Link>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </nav>

            {/* Right actions */}
            <div className="flex items-center gap-1" suppressHydrationWarning>
              {/* Search */}
              <button
                onClick={() => setSearchOpen(!searchOpen)}
                className="w-9 h-9 rounded-lg flex items-center justify-center text-white/60 hover:text-white hover:bg-white/8 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E4501C] focus-visible:ring-offset-1 focus-visible:ring-offset-[#1C2620]"
                aria-label="Rechercher"
              >
                <Icon name="MagnifyingGlassIcon" size={18} variant="outline" />
              </button>

              {/* Wishlist */}
              {mounted && (
                <Link
                  href="/compte#wishlist"
                  className="relative w-9 h-9 rounded-lg flex items-center justify-center text-white/60 hover:text-white hover:bg-white/8 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E4501C] focus-visible:ring-offset-1 focus-visible:ring-offset-[#1C2620]"
                  aria-label={`Liste de souhaits${wishlistCount > 0 ? ` (${wishlistCount})` : ''}`}
                >
                  <Icon name="HeartIcon" size={18} variant="outline" />
                  {wishlistCount > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-[#E4501C] text-white text-[9px] font-bold flex items-center justify-center leading-none">
                      {wishlistCount > 9 ? '9+' : wishlistCount}
                    </span>
                  )}
                </Link>
              )}

              {/* Cart */}
              {mounted && (
                <Link
                  href="/panier"
                  className="relative w-9 h-9 rounded-lg flex items-center justify-center text-white/60 hover:text-white hover:bg-white/8 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E4501C] focus-visible:ring-offset-1 focus-visible:ring-offset-[#1C2620]"
                  aria-label={`Panier${cartCount > 0 ? ` (${cartCount} article${cartCount > 1 ? 's' : ''})` : ''}`}
                >
                  <Icon name="ShoppingBagIcon" size={18} variant="outline" />
                  {cartCount > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-[#E4501C] text-white text-[9px] font-bold flex items-center justify-center leading-none">
                      {cartCount > 9 ? '9+' : cartCount}
                    </span>
                  )}
                </Link>
              )}

              {/* Account */}
              <Link
                href={user ? '/compte' : '/connexion'}
                className="ml-1 flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E4501C] focus-visible:ring-offset-1 focus-visible:ring-offset-[#1C2620] min-h-[44px] bg-white/8 text-white/80 hover:bg-white/14 hover:text-white"
                aria-label={user ? 'Mon compte' : 'Se connecter'}
              >
                <Icon name="UserIcon" size={15} variant="outline" />
                <span className="hidden xl:inline">{user ? 'Mon compte' : 'Connexion'}</span>
              </Link>
            </div>
          </div>
        </div>

        {/* Search bar */}
        {searchOpen && (
          <div className="border-t border-white/8 bg-[#1C2620]">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
              <form onSubmit={handleSearch} className="flex items-center gap-3">
                <Icon name="MagnifyingGlassIcon" size={18} variant="outline" className="text-white/40 flex-shrink-0" />
                <input
                  ref={searchInputRef}
                  type="search"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Rechercher un kit, une destination, un produit…"
                  className="flex-1 bg-transparent text-white placeholder-white/30 text-sm outline-none min-h-[44px]"
                  aria-label="Recherche"
                />
                <button
                  type="button"
                  onClick={() => setSearchOpen(false)}
                  className="text-white/40 hover:text-white transition-colors p-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E4501C] rounded"
                  aria-label="Fermer la recherche"
                >
                  <Icon name="XMarkIcon" size={18} variant="outline" />
                </button>
              </form>
            </div>
          </div>
        )}
      </header>

      {/* Mobile header */}
      <header
        suppressHydrationWarning
        className={`md:hidden fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
          scrolled ? 'bg-[#1C2620]/97 backdrop-blur-md shadow-lg' : 'bg-[#1C2620]'
        }`}
        role="banner"
      >
        <div className="flex items-center justify-between h-14 px-4">
          <Link href="/" className="flex items-center gap-2" aria-label="Le Kit du Voyageur">
            <AppLogo size={26} />
            <span className="font-display font-800 text-white text-[15px] tracking-tight" style={{ fontFamily: 'var(--font-display)', fontWeight: 800 }}>
              VOYAGEUR
            </span>
          </Link>
          <div className="flex items-center gap-1">
            <Link href="/panier" className="relative w-9 h-9 flex items-center justify-center text-white/60" aria-label="Panier">
              <Icon name="ShoppingBagIcon" size={18} variant="outline" />
              {mounted && cartCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-[#E4501C] text-white text-[9px] font-bold flex items-center justify-center">
                  {cartCount > 9 ? '9+' : cartCount}
                </span>
              )}
            </Link>
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              className="w-9 h-9 flex items-center justify-center text-white/70 hover:text-white"
              aria-label={menuOpen ? 'Fermer le menu' : 'Ouvrir le menu'}
              aria-expanded={menuOpen}
            >
              <Icon name={menuOpen ? 'XMarkIcon' : 'Bars3Icon'} size={22} variant="outline" />
            </button>
          </div>
        </div>
      </header>

      {/* Mobile menu overlay — 4 sections max */}
      {menuOpen && (
        <div
          ref={mobileMenuRef}
          className="md:hidden fixed inset-0 z-40 bg-[#1C2620] overflow-y-auto"
          style={{ paddingTop: '56px' }}
          role="dialog"
          aria-modal="true"
          aria-label="Menu de navigation"
        >
          <div className="px-4 py-6 space-y-6">
            {/* Primary CTA */}
            <Link
              href="/ai-configurator"
              onClick={() => setMenuOpen(false)}
              className="flex items-center justify-center gap-2 w-full py-4 rounded-2xl bg-[#E4501C] text-white font-semibold text-base"
            >
              <Icon name="SparklesIcon" size={18} variant="outline" />
              Configurer mon kit IA
            </Link>

            {/* Section: Boutique */}
            <div>
              <p className="text-[10px] font-mono text-white/30 tracking-[0.2em] uppercase mb-3" style={{ fontFamily: 'var(--font-mono)' }}>Boutique</p>
              <div className="space-y-1">
                {[
                  { label: 'Tous les produits', href: '/boutique' },
                  { label: 'Kits assemblés', href: '/kits' },
                  { label: 'Occasion vérifiée', href: '/occasion' },
                ].map(link => (
                  <Link key={link.href} href={link.href} onClick={() => setMenuOpen(false)}
                    className="flex items-center justify-between px-3 py-3 rounded-xl text-white/75 hover:text-white hover:bg-white/6 transition-colors text-sm font-medium min-h-[44px]">
                    {link.label}
                    <Icon name="ChevronRightIcon" size={14} variant="outline" className="text-white/25" />
                  </Link>
                ))}
              </div>
            </div>

            {/* Section: Destinations */}
            <div>
              <p className="text-[10px] font-mono text-white/30 tracking-[0.2em] uppercase mb-3" style={{ fontFamily: 'var(--font-mono)' }}>Destinations</p>
              <div className="space-y-1">
                {[
                  { label: 'Toutes les destinations', href: '/pays' },
                  { label: 'Explorer la carte', href: '/explorer' },
                  { label: 'Guides de voyage', href: '/guides' },
                ].map(link => (
                  <Link key={link.href} href={link.href} onClick={() => setMenuOpen(false)}
                    className="flex items-center justify-between px-3 py-3 rounded-xl text-white/75 hover:text-white hover:bg-white/6 transition-colors text-sm font-medium min-h-[44px]">
                    {link.label}
                    <Icon name="ChevronRightIcon" size={14} variant="outline" className="text-white/25" />
                  </Link>
                ))}
              </div>
            </div>

            {/* Section: Communauté */}
            <div>
              <p className="text-[10px] font-mono text-white/30 tracking-[0.2em] uppercase mb-3" style={{ fontFamily: 'var(--font-mono)' }}>Communauté</p>
              <div className="space-y-1">
                {[
                  { label: 'Carnets d\'expédition', href: '/carnets' },
                  { label: 'Forum', href: '/communaute' },
                ].map(link => (
                  <Link key={link.href} href={link.href} onClick={() => setMenuOpen(false)}
                    className="flex items-center justify-between px-3 py-3 rounded-xl text-white/75 hover:text-white hover:bg-white/6 transition-colors text-sm font-medium min-h-[44px]">
                    {link.label}
                    <Icon name="ChevronRightIcon" size={14} variant="outline" className="text-white/25" />
                  </Link>
                ))}
              </div>
            </div>

            {/* Section: Outils & Services */}
            <div>
              <p className="text-[10px] font-mono text-white/30 tracking-[0.2em] uppercase mb-3" style={{ fontFamily: 'var(--font-mono)' }}>Outils & Services</p>
              <div className="space-y-1">
                {[
                  { label: 'Outils pratiques', href: '/outils' },
                  { label: 'Abonnements', href: '/abonnements' },
                  { label: 'Espace Pro', href: '/pro' },
                  { label: 'Programme fidélité', href: '/fidelite' },
                ].map(link => (
                  <Link key={link.href} href={link.href} onClick={() => setMenuOpen(false)}
                    className="flex items-center justify-between px-3 py-3 rounded-xl text-white/75 hover:text-white hover:bg-white/6 transition-colors text-sm font-medium min-h-[44px]">
                    {link.label}
                    <Icon name="ChevronRightIcon" size={14} variant="outline" className="text-white/25" />
                  </Link>
                ))}
              </div>
            </div>

            {/* Account */}
            <div className="border-t border-white/8 pt-4">
              <Link
                href={user ? '/compte' : '/connexion'}
                onClick={() => setMenuOpen(false)}
                className="flex items-center gap-3 px-3 py-3 rounded-xl text-white/75 hover:text-white hover:bg-white/6 transition-colors text-sm font-medium min-h-[44px]"
              >
                <Icon name="UserIcon" size={16} variant="outline" />
                {user ? 'Mon compte' : 'Se connecter'}
              </Link>
            </div>
          </div>
        </div>
      )}
    </>
  );
}