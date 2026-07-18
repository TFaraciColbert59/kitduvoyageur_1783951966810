'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';

interface TopBarProps {
  cartCount?: number;
  notifCount?: number;
  showBack?: boolean;
  title?: string;
}

const ROOT_TABS = ['/explorer', '/mon-kit', '/naviguer', '/activite', '/profil'];

// Map sub-routes to their parent tab for fallback navigation
const PARENT_TAB: Record<string, string> = {
  '/carnets': '/activite',
  '/carnet': '/activite',
  '/clubs': '/activite',
  '/communaute': '/activite',
  '/groupes': '/activite',
  '/evenements': '/activite',
  '/feed': '/activite',
  '/boutique': '/mon-kit',
  '/shop': '/mon-kit',
  '/inventaire': '/mon-kit',
  '/jumeau-3d': '/mon-kit',
  '/kits': '/mon-kit',
  '/catalogue': '/mon-kit',
  '/ai-configurator': '/mon-kit',
  '/produit': '/mon-kit',
  '/occasion': '/mon-kit',
  '/location': '/mon-kit',
  '/encheres': '/mon-kit',
  '/pays': '/explorer',
  '/guides': '/explorer',
  '/carte-interactive': '/explorer',
  '/profil': '/profil',
  '/compte': '/profil',
  '/abonnements': '/profil',
  '/fidelite': '/profil',
  '/gamification': '/profil',
  '/alertes': '/profil',
  '/mes-aventures': '/activite',
  '/rapport-expedition': '/activite',
};

const PAGE_TITLES: Record<string, string> = {
  '/explorer': 'Explorer',
  '/mon-kit': 'Mon Kit',
  '/naviguer': 'Naviguer',
  '/activite': 'Activité',
  '/profil': 'Profil',
  '/carnets': 'Carnets',
  '/boutique': 'Boutique',
  '/shop': 'Boutique',
  '/inventaire': 'Inventaire',
  '/jumeau-3d': 'Jumeau 3D',
  '/kits': 'Mes Kits',
  '/catalogue': 'Catalogue',
  '/ai-configurator': 'Configurateur IA',
  '/occasion': 'Occasion',
  '/location': 'Location',
  '/encheres': 'Enchères',
  '/clubs': 'Clubs',
  '/communaute': 'Communauté',
  '/groupes': 'Groupes',
  '/evenements': 'Événements',
  '/pays': 'Pays',
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
  // Exact match first
  if (PAGE_TITLES[pathname]) return PAGE_TITLES[pathname];
  // Prefix match
  for (const [key, val] of Object.entries(PAGE_TITLES)) {
    if (pathname.startsWith(key + '/') || pathname.startsWith(key)) return val;
  }
  return 'Le Kit du Voyageur';
}

function isRootTab(pathname: string): boolean {
  return ROOT_TABS.some((tab) => pathname === tab || (tab !== '/' && pathname === tab));
}

function getParentTab(pathname: string): string {
  for (const [prefix, parent] of Object.entries(PARENT_TAB)) {
    if (pathname.startsWith(prefix)) return parent;
  }
  return '/explorer';
}

export default function TopBar({ cartCount = 0, notifCount = 0, showBack, title }: TopBarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const displayTitle = title || getTitle(pathname);
  const showNotif = pathname.startsWith('/activite');

  // Show back arrow on non-root pages (or when explicitly requested)
  const shouldShowBack = showBack !== undefined ? showBack : !isRootTab(pathname);

  const handleBack = () => {
    // Try browser history first; if empty, go to parent tab
    if (typeof window !== 'undefined' && window.history.length > 1) {
      router.back();
    } else {
      router.push(getParentTab(pathname));
    }
  };

  return (
    <header
      className="md:hidden fixed top-0 left-0 right-0 z-40 flex items-center justify-between px-4"
      style={{
        height: '52px',
        paddingTop: 'env(safe-area-inset-top)',
        background: 'rgba(231, 227, 214, 0.95)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        borderBottom: '1px solid rgba(28, 38, 32, 0.08)',
      }}
      aria-label="Barre de navigation contextuelle"
    >
      {/* Left: back arrow or logo */}
      <div className="flex items-center gap-2 min-w-[44px]">
        {shouldShowBack ? (
          <button
            onClick={handleBack}
            aria-label="Retour"
            className="flex items-center justify-center w-11 h-11 -ml-2 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E4501C] active:bg-[#1C2620]/10 transition-colors"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#1C2620" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M19 12H5M12 5l-7 7 7 7" />
            </svg>
          </button>
        ) : (
          <span className="font-display font-bold text-[#1C2620] text-base tracking-tight">
            {displayTitle}
          </span>
        )}
      </div>

      {/* Center title (only when back arrow is shown) */}
      {shouldShowBack && (
        <span className="absolute left-1/2 -translate-x-1/2 font-display font-bold text-[#1C2620] text-base tracking-tight max-w-[55vw] truncate text-center">
          {displayTitle}
        </span>
      )}

      {/* Right actions */}
      <div className="flex items-center gap-3 min-w-[44px] justify-end">
        {cartCount > 0 && (
          <Link
            href="/panier"
            aria-label={`Panier — ${cartCount} article${cartCount > 1 ? 's' : ''}`}
            className="relative flex items-center justify-center w-10 h-10 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E4501C]"
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#1C2620" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle cx="9" cy="21" r="1" />
              <circle cx="20" cy="21" r="1" />
              <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
            </svg>
            <span
              className="absolute -top-0.5 -right-0.5 flex items-center justify-center rounded-full text-white font-bold"
              style={{ width: '16px', height: '16px', fontSize: '9px', background: '#E4501C' }}
              aria-hidden="true"
            >
              {cartCount > 9 ? '9+' : cartCount}
            </span>
          </Link>
        )}

        {showNotif && (
          <button
            aria-label={notifCount > 0 ? `${notifCount} notification${notifCount > 1 ? 's' : ''} non lue${notifCount > 1 ? 's' : ''}` : 'Notifications'}
            className="relative flex items-center justify-center w-10 h-10 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E4501C]"
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#1C2620" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
              <path d="M13.73 21a2 2 0 0 1-3.46 0" />
            </svg>
            {notifCount > 0 && (
              <span
                className="absolute -top-0.5 -right-0.5 flex items-center justify-center rounded-full text-white font-bold"
                style={{ width: '16px', height: '16px', fontSize: '9px', background: '#E4501C' }}
                aria-hidden="true"
              >
                {notifCount > 9 ? '9+' : notifCount}
              </span>
            )}
          </button>
        )}
      </div>
    </header>
  );
}
