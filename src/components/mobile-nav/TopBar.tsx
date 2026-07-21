'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';

interface TopBarProps {
  cartCount?: number;
  notifCount?: number;
  showBack?: boolean;
  title?: string;
  transparent?: boolean;
}

const ROOT_TABS = ['/', '/explorer', '/ai-configurator', '/profil'];

const PARENT_TAB: Record<string, string> = {
  '/carnets': '/profil',
  '/carnet': '/profil',
  '/clubs': '/explorer',
  '/communaute': '/explorer',
  '/groupes': '/explorer',
  '/evenements': '/explorer',
  '/feed': '/explorer',
  '/boutique': '/ai-configurator',
  '/shop': '/ai-configurator',
  '/inventaire': '/profil',
  '/jumeau-3d': '/profil',
  '/kits': '/ai-configurator',
  '/catalogue': '/ai-configurator',
  '/ai-configurator': '/ai-configurator',
  '/produit': '/ai-configurator',
  '/occasion': '/ai-configurator',
  '/location': '/ai-configurator',
  '/encheres': '/ai-configurator',
  '/pays': '/explorer',
  '/guides': '/explorer',
  '/carte-interactive': '/explorer',
  '/profil': '/profil',
  '/compte': '/profil',
  '/abonnements': '/profil',
  '/fidelite': '/profil',
  '/gamification': '/profil',
  '/alertes': '/profil',
  '/mes-aventures': '/profil',
  '/rapport-expedition': '/profil',
};

const PAGE_TITLES: Record<string, string> = {
  '/': 'Le Kit du Voyageur',
  '/explorer': 'Explorer',
  '/ai-configurator': 'Mon Kit',
  '/profil': 'Profil',
  '/carnets': 'Carnets',
  '/boutique': 'Boutique',
  '/shop': 'Boutique',
  '/inventaire': 'Inventaire',
  '/jumeau-3d': 'Jumeau 3D',
  '/kits': 'Mes Kits',
  '/catalogue': 'Catalogue',
  '/occasion': 'Occasion',
  '/location': 'Location',
  '/encheres': 'Enchères',
  '/clubs': 'Clubs',
  '/communaute': 'Communauté',
  '/groupes': 'Groupes',
  '/evenements': 'Événements',
  '/pays': 'Destinations',
  '/guides': 'Guides',
  '/carte-interactive': 'Carte',
  '/compte': 'Mon Compte',
  '/abonnements': 'Abonnements',
  '/fidelite': 'Fidélité',
  '/gamification': 'Récompenses',
  '/alertes': 'Alertes',
  '/mes-aventures': 'Mes Aventures',
  '/rapport-expedition': 'Rapport',
  '/panier': 'Panier',
  '/checkout': 'Commande',
  '/connexion': 'Connexion',
  '/inscription': 'Inscription',
};

function getTitle(pathname: string): string {
  if (PAGE_TITLES[pathname]) return PAGE_TITLES[pathname];
  for (const [key, val] of Object.entries(PAGE_TITLES)) {
    if (key !== '/' && (pathname.startsWith(key + '/') || pathname === key)) return val;
  }
  return 'Le Kit du Voyageur';
}

function isRootTab(pathname: string): boolean {
  return ROOT_TABS.includes(pathname);
}

function getParentTab(pathname: string): string {
  for (const [prefix, parent] of Object.entries(PARENT_TAB)) {
    if (pathname.startsWith(prefix)) return parent;
  }
  return '/explorer';
}

export default function TopBar({ cartCount = 0, notifCount = 0, showBack, title, transparent = false }: TopBarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const displayTitle = title || getTitle(pathname);
  const isHome = pathname === '/';

  const shouldShowBack = showBack !== undefined ? showBack : !isRootTab(pathname);

  const handleBack = () => {
    if (typeof window !== 'undefined' && window.history.length > 1) {
      router.back();
    } else {
      router.push(getParentTab(pathname));
    }
  };

  return (
    <header
      className="md:hidden fixed top-0 left-0 right-0 z-40"
      style={{
        paddingTop: 'env(safe-area-inset-top)',
        background: transparent ? 'transparent' : 'rgba(231,227,214,0.88)',
        backdropFilter: transparent ? 'none' : 'blur(28px) saturate(200%)',
        WebkitBackdropFilter: transparent ? 'none' : 'blur(28px) saturate(200%)',
        borderBottom: transparent ? 'none' : '0.5px solid rgba(255,255,255,0.5)',
        boxShadow: transparent ? 'none' : '0 1px 0 rgba(28,38,32,0.05)',
      }}
      aria-label="Barre de navigation contextuelle"
    >
      <div
        className="flex items-center justify-between px-4"
        style={{ height: '52px' }}
      >
        {/* Left */}
        <div className="flex items-center gap-2" style={{ minWidth: '44px' }}>
          {shouldShowBack ? (
            <button
              onClick={handleBack}
              aria-label="Retour"
              className="flex items-center justify-center w-11 h-11 -ml-2 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E4501C] active:bg-[#1C2620]/08 transition-colors haptic-press"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#1C2620" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M19 12H5M12 5l-7 7 7 7" />
              </svg>
            </button>
          ) : isHome ? (
            <span
              className="font-display font-extrabold text-[#1C2620] tracking-tight"
              style={{ fontSize: '17px', letterSpacing: '-0.02em' }}
            >
              Kit<span style={{ color: '#E4501C' }}>.</span>
            </span>
          ) : (
            <span
              className="font-display font-bold text-[#1C2620] tracking-tight"
              style={{ fontSize: '17px', letterSpacing: '-0.02em' }}
            >
              {displayTitle}
            </span>
          )}
        </div>

        {/* Center title (only when back arrow is shown) */}
        {shouldShowBack && (
          <span
            className="absolute left-1/2 -translate-x-1/2 font-display font-semibold text-[#1C2620] max-w-[55vw] truncate text-center"
            style={{ fontSize: '17px', letterSpacing: '-0.02em' }}
          >
            {displayTitle}
          </span>
        )}

        {/* Right actions */}
        <div className="flex items-center gap-1" style={{ minWidth: '44px', justifyContent: 'flex-end' }}>
          {/* Search */}
          {isHome && (
            <Link
              href="/ai-configurator"
              aria-label="Rechercher"
              className="flex items-center justify-center w-10 h-10 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E4501C] haptic-press"
              style={{ background: 'rgba(28,38,32,0.06)' }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#1C2620" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <circle cx="11" cy="11" r="7" />
                <path d="M21 21l-4.35-4.35" />
              </svg>
            </Link>
          )}

          {/* Cart */}
          <Link
            href="/panier"
            aria-label={cartCount > 0 ? `Panier — ${cartCount} article${cartCount > 1 ? 's' : ''}` : 'Panier'}
            className="relative flex items-center justify-center w-10 h-10 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E4501C] haptic-press"
            style={{ background: cartCount > 0 ? 'rgba(228,80,28,0.08)' : 'rgba(28,38,32,0.06)' }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={cartCount > 0 ? '#E4501C' : '#1C2620'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle cx="9" cy="21" r="1" />
              <circle cx="20" cy="21" r="1" />
              <path d="M1 1h4l2.68 13.39a2 2 0 002 1.61h9.72a2 2 0 002-1.61L23 6H6" />
            </svg>
            {cartCount > 0 && (
              <span
                className="absolute -top-0.5 -right-0.5 flex items-center justify-center rounded-full text-white font-bold"
                style={{ width: '16px', height: '16px', fontSize: '9px', background: '#E4501C', fontFamily: 'var(--font-mono)' }}
                aria-hidden="true"
              >
                {cartCount > 9 ? '9+' : cartCount}
              </span>
            )}
          </Link>
        </div>
      </div>
    </header>
  );
}
