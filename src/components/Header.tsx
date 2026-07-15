'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import AppLogo from '@/components/ui/AppLogo';
import Icon from '@/components/ui/AppIcon';
import { getCart, getCartTotals } from '@/lib/cart';
import { useAuth } from '@/contexts/AuthContext';
import { useWishlist } from '@/contexts/WishlistContext';

interface NavGroup {
  label: string;
  items: { label: string; href: string; desc?: string; icon?: string }[];
}

const NAV_GROUPS: NavGroup[] = [
  {
    label: 'Boutique',
    items: [
      { label: 'Boutique', href: '/boutique', desc: 'Moteur d\'optimisation voyage', icon: 'ShoppingBagIcon' },
      { label: 'Kits assemblés', href: '/kits', desc: 'Kits prêts à l\'emploi', icon: 'CubeIcon' },
      { label: 'Enchères', href: '/encheres', desc: 'Équipement aux enchères', icon: 'BoltIcon' },
      { label: 'Location', href: '/location', desc: 'Louer du matériel', icon: 'KeyIcon' },
      { label: 'Occasion', href: '/occasion', desc: 'Matériel d\'occasion', icon: 'TagIcon' },
    ],
  },
  {
    label: 'Explorer',
    items: [
      { label: 'Explorer', href: '/explorer', desc: 'Destinations, guides & outils', icon: 'GlobeAltIcon' },
      { label: 'Destinations', href: '/pays', desc: 'Fiches pays & sécurité', icon: 'MapPinIcon' },
      { label: 'Guides terrain', href: '/guides', desc: 'Conseils & tutoriels', icon: 'BookOpenIcon' },
      { label: 'Outils', href: '/outils', desc: 'Calculateurs & planners', icon: 'WrenchScrewdriverIcon' },
      { label: 'Empreinte carbone', href: '/carbone', desc: 'Calculer & compenser', icon: 'GlobeAmericasIcon' },
      { label: 'Copilote IA', href: '/copilote', desc: 'Assistant voyage Gemini', icon: 'SparklesIcon' },
    ],
  },
  {
    label: 'Communauté',
    items: [
      { label: 'Communauté', href: '/communaute', desc: 'Hub communautaire complet', icon: 'UsersIcon' },
      { label: 'Carnets d\'expédition', href: '/carnets', desc: 'Récits de voyage vérifiés', icon: 'BookOpenIcon' },
      { label: 'Clubs', href: '/clubs', desc: 'Clubs activité & destination', icon: 'UserGroupIcon' },
      { label: 'Groupes de voyage', href: '/groupes', desc: 'Voyages collaboratifs en groupe', icon: 'MapIcon' },
      { label: 'Événements', href: '/evenements', desc: 'Sorties organisées', icon: 'CalendarIcon' },
      { label: 'Entraide SOS', href: '/entraide', desc: 'Réseau d\'entraide géolocalisé', icon: 'HandRaisedIcon' },
      { label: 'Créateurs', href: '/createurs', desc: 'Guides & itinéraires vérifiés', icon: 'SparklesIcon' },
    ],
  },
  {
    label: 'Mon compte',
    items: [
      { label: 'Mon compte', href: '/compte', desc: 'Profil & paramètres', icon: 'UserIcon' },
      { label: 'Inventaire', href: '/inventaire', desc: 'Mon équipement', icon: 'ArchiveBoxIcon' },
      { label: 'Mes groupes', href: '/groupes', desc: 'Groupes de voyage', icon: 'MapIcon' },
      { label: 'Fidélité & Défis', href: '/fidelite', desc: 'Points & badges', icon: 'TrophyIcon' },
      { label: 'Commandes', href: '/compte#commandes', desc: 'Historique & suivi', icon: 'ShoppingBagIcon' },
      { label: 'Documents', href: '/compte#documents', desc: 'Passeports, visas, assurances', icon: 'FolderIcon' },
      { label: 'Configurateur IA', href: '/ai-configurator', desc: 'Kit personnalisé en 2 min', icon: 'CpuChipIcon' },
      { label: 'Rapport Kit', href: '/rapport-kit', desc: 'Rapport personnalisé IA', icon: 'DocumentChartBarIcon' },
    ],
  },
];

const QUICK_LINKS = [
  { label: 'Pass Voyageur', href: '/abonnements' },
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

  // Fixed: useCallback for scroll handler to prevent re-renders
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

  // Focus search input when opened
  useEffect(() => {
    if (searchOpen) {
      setTimeout(() => searchInputRef.current?.focus(), 50);
    }
  }, [searchOpen]);

  // Keyboard: close mega menu on Escape
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

  // Focus trap for mobile menu
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
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
          scrolled
            ? 'bg-[#1C2620]/97 backdrop-blur-md shadow-lg shadow-black/30 border-b border-white/5'
            : 'bg-[#1C2620]'
        }`}
        role="banner"
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8" suppressHydrationWarning>
          <div className="flex items-center justify-between h-16" suppressHydrationWarning>
            {/* Logo */}
            <Link href="/" className="flex items-center gap-2.5 group flex-shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E4501C] focus-visible:ring-offset-2 focus-visible:ring-offset-[#1C2620] rounded-lg" aria-label="Le Kit du Voyageur — Accueil">
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

            {/* Desktop Nav — grouped with keyboard support */}
            <nav className="hidden lg:flex items-center gap-0.5" aria-label="Navigation principale">
              {NAV_GROUPS.map((group) => (
                <div
                  key={group.label}
                  className="relative"
                  onMouseEnter={() => handleGroupEnter(group.label)}
                  onMouseLeave={handleGroupLeave}
                >
                  <button
                    className={`flex items-center gap-1 px-3.5 py-2 rounded-lg text-sm font-medium transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E4501C] focus-visible:ring-offset-1 focus-visible:ring-offset-[#1C2620] min-h-[44px] ${
                      activeGroup === group.label
                        ? 'text-white bg-white/10' : 'text-white/75 hover:text-white hover:bg-white/8'
                    }`}
                    aria-expanded={activeGroup === group.label}
                    aria-haspopup="true"
                    onFocus={() => handleGroupEnter(group.label)}
                    onBlur={handleGroupLeave}
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

                  {/* Mega menu dropdown */}
                  {activeGroup === group.label && (
                    <div
                      ref={megaRef}
                      className="absolute top-full left-0 mt-1 w-64 bg-[#1C2620] border border-white/10 rounded-xl shadow-2xl shadow-black/50 overflow-hidden z-50"
                      onMouseEnter={handleMegaEnter}
                      onMouseLeave={handleGroupLeave}
                      role="menu"
                      aria-label={`Menu ${group.label}`}
                    >
                      {group.items.map((item) => (
                        <Link
                          key={item.label}
                          href={item.href}
                          role="menuitem"
                          className="flex items-start gap-3 px-4 py-3 hover:bg-white/8 transition-colors focus-visible:outline-none focus-visible:bg-white/10 focus-visible:ring-inset focus-visible:ring-2 focus-visible:ring-[#E4501C]"
                          onClick={() => setActiveGroup(null)}
                        >
                          {item.icon && (
                            <Icon name={item.icon as Parameters<typeof Icon>[0]['name']} size={16} variant="outline" className="text-[#E4501C] flex-shrink-0 mt-0.5" />
                          )}
                          <div>
                            <p className="text-sm font-medium text-white">{item.label}</p>
                            {item.desc && <p className="text-xs text-white/45 mt-0.5">{item.desc}</p>}
                          </div>
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              ))}
              {/* Quick links */}
              <div className="w-px h-4 bg-white/15 mx-1" aria-hidden="true" />
              {QUICK_LINKS.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="px-3 py-2 rounded-lg text-sm font-medium text-white/60 hover:text-white hover:bg-white/8 transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E4501C] focus-visible:ring-offset-1 focus-visible:ring-offset-[#1C2620] min-h-[44px] flex items-center"
                >
                  {link.label}
                </Link>
              ))}
            </nav>

            {/* Right Actions */}
            <div className="flex items-center gap-1.5" suppressHydrationWarning>
              {/* Search */}
              <button
                className="hidden sm:flex p-2 rounded-lg text-white/60 hover:text-white hover:bg-white/10 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E4501C] focus-visible:ring-offset-1 focus-visible:ring-offset-[#1C2620] min-h-[44px] min-w-[44px] items-center justify-center"
                aria-label="Ouvrir la recherche"
                onClick={() => setSearchOpen(true)}
              >
                <Icon name="MagnifyingGlassIcon" size={18} variant="outline" />
              </button>

              {/* Wishlist */}
              <Link
                href="/compte"
                className="relative hidden sm:flex p-2 rounded-lg text-white/60 hover:text-white hover:bg-white/10 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E4501C] focus-visible:ring-offset-1 focus-visible:ring-offset-[#1C2620] min-h-[44px] min-w-[44px] items-center justify-center"
                aria-label="Favoris"
                suppressHydrationWarning
              >
                <Icon name="HeartIcon" size={18} variant="outline" />
                <span
                  className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-[#E4501C] text-white text-[9px] font-mono font-700 rounded-full flex items-center justify-center"
                  aria-hidden="true"
                  suppressHydrationWarning
                  style={{ display: mounted && wishlistCount > 0 ? 'flex' : 'none' }}
                >
                  {mounted ? (wishlistCount > 9 ? '9+' : wishlistCount) : ''}
                </span>
              </Link>

              {/* Cart */}
              <Link
                href="/panier"
                className="relative flex p-2 rounded-lg text-white/60 hover:text-white hover:bg-white/10 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E4501C] focus-visible:ring-offset-1 focus-visible:ring-offset-[#1C2620] min-h-[44px] min-w-[44px] items-center justify-center"
                aria-label="Panier"
                suppressHydrationWarning
              >
                <Icon name="ShoppingBagIcon" size={18} variant="outline" />
                <span
                  className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-[#E4501C] text-white text-[9px] font-mono font-700 rounded-full flex items-center justify-center"
                  aria-hidden="true"
                  suppressHydrationWarning
                  style={{ display: mounted && cartCount > 0 ? 'flex' : 'none' }}
                >
                  {mounted ? (cartCount > 9 ? '9+' : cartCount) : ''}
                </span>
              </Link>

              {/* Auth — always render both, toggle visibility after mount */}
              <Link
                href="/connexion"
                className="hidden sm:flex items-center gap-2 px-4 py-2 rounded-lg bg-[#E4501C] hover:bg-[#cc3d10] text-white text-sm font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E4501C] focus-visible:ring-offset-2 focus-visible:ring-offset-[#1C2620] min-h-[44px]"
                suppressHydrationWarning
                style={mounted ? { display: user ? 'none' : undefined } : undefined}
              >
                <Icon name="ArrowRightOnRectangleIcon" size={16} variant="outline" />
                Connexion
              </Link>
              <Link
                href="/compte"
                className="hidden sm:flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium text-white/70 hover:text-white hover:bg-white/10 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E4501C] focus-visible:ring-offset-1 focus-visible:ring-offset-[#1C2620] min-h-[44px]"
                aria-label="Mon compte"
                suppressHydrationWarning
                style={mounted ? { display: user ? undefined : 'none' } : { display: 'none' }}
              >
                <Icon name="UserCircleIcon" size={18} variant="outline" />
                <span className="hidden md:block">Mon compte</span>
              </Link>

              {/* Mobile menu toggle */}
              <button
                className="lg:hidden flex p-2 rounded-lg text-white/70 hover:text-white hover:bg-white/10 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E4501C] focus-visible:ring-offset-1 focus-visible:ring-offset-[#1C2620] min-h-[44px] min-w-[44px] items-center justify-center"
                aria-label={menuOpen ? 'Fermer le menu' : 'Ouvrir le menu'}
                aria-expanded={menuOpen}
                aria-controls="mobile-menu"
                onClick={() => setMenuOpen(!menuOpen)}
              >
                <Icon name={menuOpen ? 'XMarkIcon' : 'Bars3Icon'} size={22} variant="outline" />
              </button>
            </div>
          </div>
        </div>

        {/* Search overlay */}
        {searchOpen && (
          <div className="absolute inset-x-0 top-0 bg-[#1C2620] border-b border-white/10 z-50" role="search">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center gap-3">
              <Icon name="MagnifyingGlassIcon" size={18} variant="outline" className="text-white/40 flex-shrink-0" aria-hidden="true" />
              <form onSubmit={handleSearch} className="flex-1" role="search" aria-label="Recherche de produits">
                <input
                  ref={searchInputRef}
                  type="search"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Rechercher un produit, une destination…"
                  className="w-full bg-transparent text-white placeholder:text-white/30 text-sm focus:outline-none"
                  aria-label="Rechercher"
                />
              </form>
              <button
                onClick={() => { setSearchOpen(false); setSearchQuery(''); }}
                className="p-2 rounded-lg text-white/40 hover:text-white hover:bg-white/10 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E4501C] min-h-[44px] min-w-[44px] flex items-center justify-center"
                aria-label="Fermer la recherche"
              >
                <Icon name="XMarkIcon" size={18} variant="outline" />
              </button>
            </div>
          </div>
        )}
      </header>

      {/* Mobile menu */}
      {menuOpen && (
        <div
          id="mobile-menu"
          ref={mobileMenuRef}
          className="fixed inset-0 z-40 lg:hidden"
          role="dialog"
          aria-modal="true"
          aria-label="Menu de navigation mobile"
        >
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setMenuOpen(false)}
            aria-hidden="true"
          />

          {/* Panel */}
          <div className="absolute top-0 right-0 bottom-0 w-full max-w-sm bg-[#1C2620] shadow-2xl overflow-y-auto">
            <div className="flex items-center justify-between px-4 h-16 border-b border-white/10">
              <span className="font-display font-700 text-white text-base" style={{ fontFamily: 'var(--font-display)' }}>Menu</span>
              <button
                onClick={() => setMenuOpen(false)}
                className="p-2 rounded-lg text-white/60 hover:text-white hover:bg-white/10 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E4501C] min-h-[44px] min-w-[44px] flex items-center justify-center"
                aria-label="Fermer le menu"
              >
                <Icon name="XMarkIcon" size={20} variant="outline" />
              </button>
            </div>

            {/* Mobile search */}
            <div className="px-4 py-3 border-b border-white/10">
              <form onSubmit={(e) => { handleSearch(e); setMenuOpen(false); }} role="search" aria-label="Recherche mobile">
                <div className="flex items-center gap-2 bg-white/8 rounded-xl px-3 py-2.5">
                  <Icon name="MagnifyingGlassIcon" size={16} variant="outline" className="text-white/40" aria-hidden="true" />
                  <input
                    type="search"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Rechercher…"
                    className="flex-1 bg-transparent text-white placeholder:text-white/30 text-sm focus:outline-none"
                    aria-label="Rechercher"
                  />
                </div>
              </form>
            </div>

            <nav className="px-4 py-4" aria-label="Navigation mobile">
              {NAV_GROUPS.map((group) => (
                <div key={group.label} className="mb-4">
                  <p className="text-[10px] font-mono text-white/30 tracking-[0.2em] uppercase mb-2" style={{ fontFamily: 'var(--font-mono)' }}>
                    {group.label}
                  </p>
                  <div className="space-y-1">
                    {group.items.map((item) => (
                      <Link
                        key={`${group.label}-${item.label}`}
                        href={item.href}
                        onClick={() => setMenuOpen(false)}
                        className="flex items-center gap-3 px-3 py-3 rounded-xl text-white/70 hover:text-white hover:bg-white/8 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E4501C] min-h-[44px]"
                      >
                        {item.icon && (
                          <Icon name={item.icon as Parameters<typeof Icon>[0]['name']} size={16} variant="outline" className="text-[#E4501C] flex-shrink-0" />
                        )}
                        <span className="text-sm font-medium">{item.label}</span>
                      </Link>
                    ))}
                  </div>
                </div>
              ))}

              <div className="border-t border-white/10 pt-4 mt-2 space-y-1">
                {QUICK_LINKS.map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    onClick={() => setMenuOpen(false)}
                    className="flex items-center px-3 py-3 rounded-xl text-white/60 hover:text-white hover:bg-white/8 transition-all text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E4501C] min-h-[44px]"
                  >
                    {link.label}
                  </Link>
                ))}
              </div>

              <div className="border-t border-white/10 pt-4 mt-4" suppressHydrationWarning>
                <Link
                  href="/compte"
                  onClick={() => setMenuOpen(false)}
                  className="flex items-center gap-3 px-3 py-3 rounded-xl text-white/70 hover:text-white hover:bg-white/8 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E4501C] min-h-[44px]"
                  suppressHydrationWarning
                  style={mounted ? { display: user ? undefined : 'none' } : { display: 'none' }}
                >
                  <Icon name="UserCircleIcon" size={18} variant="outline" className="text-[#E4501C]" />
                  <span className="text-sm font-medium">Mon compte</span>
                </Link>
                <Link
                  href="/connexion"
                  onClick={() => setMenuOpen(false)}
                  className="flex items-center justify-center gap-2 w-full px-4 py-3 rounded-xl bg-[#E4501C] hover:bg-[#cc3d10] text-white text-sm font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E4501C] focus-visible:ring-offset-2 focus-visible:ring-offset-[#1C2620] min-h-[44px]"
                  suppressHydrationWarning
                  style={mounted ? { display: user ? 'none' : undefined } : undefined}
                >
                  <Icon name="ArrowRightOnRectangleIcon" size={16} variant="outline" />
                  Connexion
                </Link>
              </div>
            </nav>
          </div>
        </div>
      )}
    </>
  );
}