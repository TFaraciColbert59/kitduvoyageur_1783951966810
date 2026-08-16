// "use client";
import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion } from 'framer-motion';
import { useAuth } from '@/contexts/AuthContext';
import { useHapticFeedback } from '@/hooks/useHapticFeedback';
import LkvIcon from '@/components/ui/LkvIcon';
import { useSearchContext } from '@/contexts/SearchContext';
import { getCart } from '@/lib/cart';

interface Tab {
  href: string;
  label: string;
  iconName: 'home' | 'mountain' | 'bag' | 'box' | 'users' | 'user' | 'compass';
  ariaLabel: string;
  matchPaths?: string[];
  isHero?: boolean;
}

const TABS: Tab[] = [
  {
    href: '/boutique',
    label: 'Boutique',
    iconName: 'bag',
    ariaLabel: 'Boutique',
    matchPaths: ['/boutique', '/kits', '/occasion', '/produit', '/panier', '/checkout'],
  },
  {
    href: '/explorer',
    label: 'Aventures',
    iconName: 'mountain',
    ariaLabel: 'Explorer les sentiers et destinations',
    matchPaths: ['/explorer', '/pays', '/carte-interactive', '/hors-ligne'],
  },
  {
    href: '/mon-materiel',
    label: 'Inventaire',
    iconName: 'box',
    ariaLabel: 'Mon inventaire matériel',
    matchPaths: ['/mon-materiel'],
    isHero: true,
  },
  {
    href: '/communaute',
    label: 'Communauté',
    iconName: 'users',
    ariaLabel: 'Communauté, clubs, événements',
    matchPaths: ['/communaute', '/communaute/publier', '/clubs', '/groupes', '/entraide', '/createurs', '/experts', '/evenements', '/feed', '/messagerie'],
  },
  {
    href: '/compte',
    label: 'Compte',
    iconName: 'user',
    ariaLabel: 'Mon compte',
    matchPaths: ['/compte', '/profil', '/connexion', '/inscription'],
  },
];

function TabLink({ tab, isActive }: { tab: Tab; isActive: boolean }) {
  const { haptic } = useHapticFeedback();

  const handleTap = () => {
    haptic(isActive ? 'selection' : 'medium');
  };

  if (tab.isHero) {
    return (
      <Link
        href={tab.href}
        aria-label={tab.ariaLabel}
        aria-current={isActive ? 'page' : undefined}
        onClick={handleTap}
        className="relative flex flex-col items-center justify-center flex-1 h-full focus-visible:outline-none rounded-full"
      >
        <div
          style={{
            width: '38px',
            height: '38px',
            borderRadius: '999px',
            background: isActive ? '#17402C' : '#1E4D33',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#fff',
            boxShadow: isActive ? '0 3px 10px rgba(23,64,44,0.35)' : '0 2px 6px rgba(23,64,44,0.2)',
            transition: 'all 0.2s ease',
          }}
        >
          <LkvIcon name={tab.iconName} size={19} color="#fff" />
        </div>
      </Link>
    );
  }

  return (
    <Link
      href={tab.href}
      aria-label={tab.ariaLabel}
      aria-current={isActive ? 'page' : undefined}
      onClick={handleTap}
      className="relative flex flex-col items-center justify-center flex-1 h-full focus-visible:outline-none rounded-full"
    >
      <div className="relative flex flex-col items-center justify-center" style={{ gap: '2px' }}>
          <LkvIcon name={tab.iconName} size={19} color={isActive ? '#17402C' : '#6B7A72'} />
          {isActive && (
            <span
              style={{
                fontSize: '12px',
                letterSpacing: '0.02em',
                lineHeight: 1,
                fontFamily: 'var(--font-sans)',
                color: '#17402C',
                fontWeight: 700,
              }}
            >
              {tab.label}
            </span>
          )}
      </div>
      {isActive && (
        <motion.div
          layoutId="active-dot"
          aria-hidden="true"
          style={{
            width: '4px',
            height: '4px',
            borderRadius: '50%',
            background: '#17402C',
            position: 'absolute',
            bottom: '6px',
            left: '50%',
            marginLeft: '-2px',
          }}
          transition={{ type: 'spring', stiffness: 400, damping: 30 }}
        />
      )}
    </Link>
  );
}

export default function BottomTabBar() {
  const pathname = usePathname();
  const { loading } = useAuth();
  const { openSearch } = useSearchContext();
  const [mounted, setMounted] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const isActive = (tab: Tab): boolean => {
    if (!tab.matchPaths) return pathname === tab.href;
    return tab.matchPaths.some(p => pathname === p || pathname?.startsWith(p + '/'));
  };

  if (loading || !mounted) {
    return (
      <nav role="navigation" aria-label="Chargement de la navigation" className="md:hidden" style={{
        position: 'fixed',
        left: '12px',
        right: '12px',
        bottom: 'calc(12px + env(safe-area-inset-bottom))',
        zIndex: 50,
      }}>
        <div style={{
          height: '62px',
          background: 'rgba(255,255,255,0.85)',
          backdropFilter: 'blur(24px) saturate(1.5)',
          WebkitBackdropFilter: 'blur(24px) saturate(1.5)',
          borderRadius: '22px',
          border: '1px solid rgba(11,31,23,0.06)',
          boxShadow: '0 10px 30px rgba(11,31,23,0.1)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-around',
          padding: '0 8px',
        }}>
          {[...Array(5)].map((_, i) => (
            <div key={i} className="animate-pulse" style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '4px',
              width: '48px',
            }}>
              <div style={{ width: '24px', height: '24px', borderRadius: '50%', background: '#E2E8E4' }} />
              <div style={{ width: '32px', height: '6px', borderRadius: '4px', background: '#E2E8E4' }} />
            </div>
          ))}
        </div>
      </nav>
    );
  }

  return (
    <nav role="navigation" aria-label="Navigation principale" className="md:hidden" style={{
      position: 'fixed',
      left: '16px',
      right: '16px',
      bottom: 'calc(10px + env(safe-area-inset-bottom))',
      zIndex: 50,
    }}>
      <div style={{
        height: '52px',
        background: 'rgba(255,255,255,0.78)',
        backdropFilter: 'blur(20px) saturate(1.8)',
        WebkitBackdropFilter: 'blur(20px) saturate(1.8)',
        borderRadius: '999px',
        border: '1px solid rgba(255,255,255,0.6)',
        boxShadow: '0 8px 24px rgba(11,31,23,0.08)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-around',
        padding: '0 10px',
      }}>
        {TABS.map(tab => (
          <TabLink key={tab.href} tab={tab} isActive={isActive(tab)} />
        ))}
        {/* Hamburger menu for actions */}
        <div style={{ position: 'relative' }}>
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            aria-label="Menu actions"
            style={{
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
              cursor: 'pointer',
              outline: 'none',
            }}
          >
            <LkvIcon name="menu" size={16} />
          </button>
          {menuOpen && (
            <div
              style={{
                position: 'absolute',
                right: 0,
                bottom: '44px',
                background: 'rgba(255,255,255,0.95)',
                borderRadius: '12px',
                border: '1px solid rgba(11,31,23,0.1)',
                boxShadow: '0 8px 24px rgba(11,31,23,0.1)',
                padding: '8px',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
                minWidth: '120px',
              }}
            >
              {/* Search */}
              <button
                onClick={() => { setMenuOpen(false); openSearch?.(); }}
                aria-label="Rechercher"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '6px 8px',
                  borderRadius: '8px',
                  background: 'rgba(0,0,0,0.05)',
                }}
              >
                <LkvIcon name="search" size={16} />
                Recherche
              </button>
              {/* Notifications */}
              <Link
                href="/alertes"
                aria-label="Notifications"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '6px 8px',
                  borderRadius: '8px',
                  background: 'rgba(0,0,0,0.05)',
                  textDecoration: 'none',
                  color: 'inherit',
                }}
              >
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                  <path d="M13.7 21a2 2 0 0 1-3.4 0" />
                </svg>
                Alertes
                <span style={{ position: 'absolute', top: '2px', right: '2px', width: '7px', height: '7px', borderRadius: '50%', background: '#2D6A4F' }} aria-hidden="true" />
              </Link>
              {/* Cart */}
              <Link
                href="/panier"
                aria-label="Panier"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '6px 8px',
                  borderRadius: '8px',
                  background: 'rgba(0,0,0,0.05)',
                  textDecoration: 'none',
                  color: 'inherit',
                  position: 'relative',
                }}
              >
                <LkvIcon name="bag" size={16} />
                Panier
                {(() => {
                  const cart = getCart();
                  const count = cart.reduce((acc, i) => acc + i.quantity, 0);
                  return count > 0 ? (
                    <span
                      style={{
                        position: 'absolute',
                        top: '-4px',
                        right: '-4px',
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
                      {count > 9 ? '9+' : count}
                    </span>
                  ) : null;
                })()}
              </Link>
            </div>
          )}
        </div>
      </div>
    </nav>
  );
}
