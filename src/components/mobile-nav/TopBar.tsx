'use client';

import React from 'react';
import Link from "next/link";
import { usePathname, useRouter } from 'next/navigation';
import LkvIcon from '@/components/ui/LkvIcon';
import { useSearchContext } from '@/contexts/SearchContext';
import { useHapticFeedback } from '@/hooks/useHapticFeedback';

interface TopBarProps {
  variant?: 'standard' | 'on-image';
  showBack?: boolean;
  title?: string;
  cartCount?: number;
  onMenuOpen?: () => void;
  onSearchOpen?: () => void;
  isMenuOpen?: boolean;
}

const ROOT_TABS = ['/', '/explorer', '/boutique', '/compte', '/profil', '/carnets', '/terrain'];

const PARENT_TAB: Record<string, string> = {
  '/carnets': '/carnets',
  '/clubs': '/explorer',
  '/communaute': '/explorer',
  '/groupes': '/explorer',
  '/evenements': '/explorer',
  '/feed': '/explorer',
  '/boutique': '/boutique',
  '/mon-materiel': '/compte',
  '/boussole': '/terrain',
  '/hors-ligne': '/explorer',
  '/randonnee-active': '/terrain',
  '/jumeau-3d': '/compte',
  '/kits': '/boutique',
  '/produit': '/boutique',
  '/occasion': '/boutique',
  '/location': '/boutique',
  '/encheres': '/boutique',
  '/pays': '/explorer',
  '/guides': '/explorer',
  '/carte-interactive': '/explorer',
  '/profil': '/compte',
  '/compte': '/compte',
  '/abonnements': '/compte',
  '/fidelite': '/compte',
  '/alertes': '/compte',
  '/mes-aventures': '/compte',
  '/rapport-expedition': '/compte',
  '/terrain': '/terrain',
  '/naviguer': '/terrain',
};

const PAGE_TITLES: Record<string, string> = {
  '/': 'Le Kit du Voyageur',
  '/explorer': 'Explorer',
  '/boussole': 'Boussole AR',
  '/hors-ligne': 'Hors-Ligne',
  '/mon-materiel': 'Inventaire',
  '/randonnee-active': 'Randonnée Active',
  '/boutique': 'Boutique',
  '/carnets': 'Carnets',
  '/compte': 'Mon Compte',
  '/jumeau-3d': 'Jumeau 3D',
  '/kits': 'Mes Kits',
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
  '/abonnements': 'Abonnements',
  '/fidelite': 'Fidélité',
  '/alertes': 'Alertes',
  '/mes-aventures': 'Mes Aventures',
  '/rapport-expedition': 'Rapport',
  '/panier': 'Panier',
  '/checkout': 'Commande',
  '/connexion': 'Connexion',
  '/inscription': 'Inscription',
  '/terrain': 'Mode Terrain',
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

export default function TopBar({ variant = 'standard', cartCount = 0, showBack, title, onMenuOpen, onSearchOpen }: TopBarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { haptic } = useHapticFeedback();
  const currentPath = pathname || '/';
  const displayTitle = title || getTitle(currentPath);
  const isHome = currentPath === '/';
  const isOnImage = variant === 'on-image';

  const shouldShowBack = showBack !== undefined ? showBack : !isRootTab(currentPath);

  const handleBack = () => {
    haptic('selection');
    if (typeof window !== 'undefined' && window.history.length > 1) {
      router.back();
    } else {
      router.push(getParentTab(currentPath));
    }
  };

  const standardStyle: React.CSSProperties = {
    background: '#FBFAF6',
    borderBottom: '1px solid rgba(11,31,23,0.05)',
  };

  const onImageStyle: React.CSSProperties = {
    background: 'transparent',
    position: 'absolute',
    top: '40px',
    left: 0,
    right: 0,
    zIndex: 2,
  };

  const mBtnStandard: React.CSSProperties = {
    width: '34px',
    height: '34px',
    borderRadius: '999px',
    background: 'rgba(255,255,255,0.85)',
    backdropFilter: 'blur(16px)',
    border: '1px solid rgba(255,255,255,0.5)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#0B1F17',
    touchAction: 'manipulation',
    transition: 'background-color 200ms ease, opacity 150ms ease',
  };

  const mBtnOnImage: React.CSSProperties = {
    width: '34px',
    height: '34px',
    borderRadius: '999px',
    background: 'rgba(28,38,32,0.65)',
    backdropFilter: 'blur(16px)',
    WebkitBackdropFilter: 'blur(16px)',
    border: '1px solid rgba(255,255,255,0.25)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#fff',
    touchAction: 'manipulation',
    transition: 'background-color 200ms ease, opacity 150ms ease',
  };

  const mBtnStyle = isOnImage ? mBtnOnImage : mBtnStandard;

  return (
    <header
      className="md:hidden fixed top-0 left-0 right-0 z-40"
      style={{
        paddingTop: 'env(safe-area-inset-top)',
        ...(isOnImage ? onImageStyle : standardStyle),
      }}
      aria-label="Barre de navigation contextuelle"
    >
      <div
        className="flex items-center justify-between"
        style={{ height: '46px', padding: '0 14px' }}
      >
        {/* Left */}
        <div className="flex items-center gap-2 relative z-10 pointer-events-auto" style={{ minWidth: '38px' }}>
          {shouldShowBack ? (
            <button
              onClick={handleBack}
              aria-label="Retour"
              className="hover:opacity-85 active:opacity-75 transition-opacity"
              style={{
                ...mBtnStyle,
                cursor: 'pointer',
                outline: 'none',
              }}
              onFocus={(e) => {
                e.currentTarget.style.outline = '2px solid #2D6B4A';
                e.currentTarget.style.outlineOffset = '2px';
              }}
              onBlur={(e) => {
                e.currentTarget.style.outline = 'none';
              }}
            >
              <LkvIcon name="chevron-left" size={20} />
            </button>
          ) : isHome ? (
            <>
              <button
                onClick={onMenuOpen}
                aria-label="Menu"
                style={{
                  ...mBtnStyle,
                  cursor: 'pointer',
                  outline: 'none',
                }}
                onFocus={(e) => {
                  e.currentTarget.style.outline = '2px solid #2D6B4A';
                  e.currentTarget.style.outlineOffset = '2px';
                }}
                onBlur={(e) => {
                  e.currentTarget.style.outline = 'none';
                }}
              >
                <LkvIcon name="menu" size={20} />
              </button>
              <span
                style={{
                  fontSize: '17px',
                  fontWeight: 700,
                  letterSpacing: '-0.02em',
                  color: '#0B1F17',
                }}
              >
                Le Kit du <em style={{ fontFamily: 'Georgia, serif', fontStyle: 'italic' }}>Voyageur</em>
              </span>
            </>
          ) : (
            <span
              style={{
                fontSize: '17px',
                fontWeight: 700,
                letterSpacing: '-0.02em',
                color: '#0B1F17',
              }}
            >
              {displayTitle}
            </span>
          )}
        </div>

        {/* Center title (only when back arrow is shown) */}
        {shouldShowBack && (
          <span
            className="absolute left-1/2 -translate-x-1/2 max-w-[55vw] truncate text-center pointer-events-none z-0"
            style={{
              fontSize: '17px',
              fontWeight: 600,
              letterSpacing: '-0.02em',
              color: '#0B1F17',
            }}
          >
            {displayTitle}
          </span>
        )}

        {/* Right actions */}
        <div className="flex items-center gap-1 relative z-10 pointer-events-auto" style={{ minWidth: '38px', justifyContent: 'flex-end' }}>
          {/* Search — visible on all pages */}
          <button
            onClick={() => {
              haptic('selection');
              onSearchOpen?.();
            }}
            aria-label="Rechercher"
            style={{
              ...mBtnStyle,
              cursor: 'pointer',
              outline: 'none',
            }}
            onFocus={(e) => {
              e.currentTarget.style.outline = '2px solid #2D6B4A';
              e.currentTarget.style.outlineOffset = '2px';
            }}
            onBlur={(e) => {
              e.currentTarget.style.outline = 'none';
            }}
          >
            <LkvIcon name="search" size={18} />
          </button>

          {/* Cart */}
          <Link
            href="/panier"
            aria-label={cartCount > 0 ? `Panier — ${cartCount} article${cartCount > 1 ? 's' : ''}` : 'Panier'}
            style={{
              ...mBtnStyle,
              position: 'relative',
              textDecoration: 'none',
              background: cartCount > 0 && !isOnImage ? 'rgba(23,64,44,0.08)' : mBtnStyle.background,
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle cx="9" cy="21" r="1" />
              <circle cx="20" cy="21" r="1" />
              <path d="M1 1h4l2.68 13.39a2 2 0 002 1.61h9.72a2 2 0 002-1.61L23 6H6" />
            </svg>
            {cartCount > 0 && (
              <span
                style={{
                  position: 'absolute',
                  top: '-2px',
                  right: '-2px',
                  width: '16px',
                  height: '16px',
                  borderRadius: '50%',
                  background: '#17402C',
                  color: '#fff',
                  fontSize: '9px',
                  fontWeight: 700,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontFamily: 'var(--font-mono)',
                }}
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
