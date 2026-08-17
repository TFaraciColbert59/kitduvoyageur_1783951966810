"use client";

import React, { useEffect, useState, memo } from 'react';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/contexts/AuthContext';
import { useHapticFeedback } from '@/hooks/useHapticFeedback';
import { useSearchContext } from '@/contexts/SearchContext';
import LkvIcon from '@/components/ui/LkvIcon';
import { getCart } from '@/lib/cart';

interface Tab {
  href: string;
  label: string;
  iconName: 'home' | 'mountain' | 'bag' | 'box' | 'users' | 'user' | 'compass' | 'menu' | 'search';
  ariaLabel: string;
  matchPaths?: string[];
  isHero?: boolean;
}

const TABS: Tab[] = [
  {
    href: '/pays',
    label: 'Earth',
    iconName: 'compass',
    ariaLabel: 'Earth, cartographie mondiale',
    matchPaths: ['/pays'],
  },
  {
    href: '/explorer',
    label: 'Aventures',
    iconName: 'mountain',
    ariaLabel: 'Explorer les sentiers et destinations',
    matchPaths: ['/explorer', '/carte-interactive', '/hors-ligne'],
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
    matchPaths: [
      '/communaute',
      '/communaute/publier',
      '/clubs',
      '/groupes',
      '/entraide',
      '/createurs',
      '/experts',
      '/evenements',
      '/feed',
      '/messagerie',
    ],
  },
  {
    href: '/compte',
    label: 'Compte',
    iconName: 'user',
    ariaLabel: 'Mon compte',
    matchPaths: ['/compte', '/profil', '/connexion', '/inscription'],
  },
];

// A memoized tab link to avoid unnecessary re‑renders
const TabLink = memo(function TabLink({ tab, isActive, onPress }: { tab: Tab; isActive: boolean; onPress: (href: string) => void }) {
  const { triggerHaptic } = useHapticFeedback();
  const handleClick = () => {
    onPress(tab.href);
    triggerHaptic('light');
  };

  return (
    <Link
      href={tab.href}
      onClick={handleClick}
      aria-label={tab.ariaLabel}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '4px',
        textDecoration: 'none',
        color: isActive ? '#A8C4A2' : 'rgba(255, 255, 255, 0.5)',
        position: 'relative',
        transition: 'color 0.2s ease',
        userSelect: 'none',
        WebkitTapHighlightColor: 'transparent',
        width: '50px',
      }}
    >
      <motion.div
        whileTap={{ scale: 0.85 }}
        transition={{ type: 'spring', stiffness: 500, damping: 25 }}
        style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px' }}
      >
        <LkvIcon name={tab.iconName} size={22} />
        <span style={{ fontSize: '9px', fontWeight: isActive ? 600 : 500, fontFamily: 'var(--font-mono)' }}>{tab.label}</span>
      </motion.div>
      {isActive && (
        <motion.div
          layoutId="tab-indicator"
          transition={{ type: 'spring', stiffness: 450, damping: 30 }}
          style={{
            position: 'absolute',
            top: '-12px',
            width: '5px',
            height: '5px',
            borderRadius: '50%',
            background: '#A8C4A2',
            boxShadow: '0 0 10px rgba(168, 196, 162, 0.8)',
          }}
        />
      )}
    </Link>
  );
});

function HamburgerMenu({ menuOpen, setMenuOpen, openSearch }: { menuOpen: boolean; setMenuOpen: React.Dispatch<React.SetStateAction<boolean>>; openSearch?: () => void }) {
  const { triggerHaptic } = useHapticFeedback();
  return (
    <div style={{ position: 'relative' }}>
      <motion.button
        type="button"
        whileTap={{ scale: 0.9 }}
        onClick={() => {
          triggerHaptic('selection');
          setMenuOpen(!menuOpen);
        }}
        aria-label="Menu actions"
        style={{
          width: '38px',
          height: '38px',
          borderRadius: '999px',
          background: 'rgba(255,255,255,0.1)',
          backdropFilter: 'blur(16px)',
          border: '1px solid rgba(255,255,255,0.15)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#fff',
          cursor: 'pointer',
          outline: 'none',
        }}
      >
        <LkvIcon name="menu" size={16} />
      </motion.button>
      <AnimatePresence>
        {menuOpen && (
          <>
            {/* Scrim to capture outside taps */}
            <div
              onClick={() => setMenuOpen(false)}
              style={{
                position: 'fixed',
                inset: 0,
                zIndex: 55,
              }}
              aria-hidden="true"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 8 }}
              transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
              style={{
                position: 'absolute',
                right: 0,
                bottom: '44px',
                zIndex: 56,
                background: 'rgba(11,31,23,0.92)',
                backdropFilter: 'blur(30px)',
                borderRadius: '16px',
                border: '1px solid rgba(255,255,255,0.12)',
                boxShadow: '0 12px 32px rgba(0,0,0,0.4)',
                padding: '8px',
                display: 'flex',
                flexDirection: 'column',
                gap: '6px',
                minWidth: '130px',
              }}
            >
              {/* Search */}
              <button
                onClick={() => {
                  triggerHaptic('light');
                  setMenuOpen(false);
                  openSearch?.();
                }}
                aria-label="Rechercher"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '8px 10px',
                  borderRadius: '10px',
                  background: 'rgba(255,255,255,0.06)',
                  border: 'none',
                  color: '#fff',
                  fontSize: '13px',
                  fontWeight: 500,
                  cursor: 'pointer',
                  textAlign: 'left',
                }}
              >
                <LkvIcon name="search" size={16} />
                Recherche
              </button>
              {/* Notifications */}
              <Link
                href="/alertes"
                onClick={() => {
                  triggerHaptic('light');
                  setMenuOpen(false);
                }}
                aria-label="Notifications"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '8px 10px',
                  borderRadius: '10px',
                  background: 'rgba(255,255,255,0.06)',
                  textDecoration: 'none',
                  color: '#fff',
                  fontSize: '13px',
                  fontWeight: 500,
                  position: 'relative',
                }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                  <path d="M13.7 21a2 2 0 0 1-3.4 0" />
                </svg>
                Alertes
                <span style={{ position: 'absolute', top: '10px', right: '10px', width: '6px', height: '6px', borderRadius: '50%', background: '#A8C4A2' }} aria-hidden="true" />
              </Link>
              {/* Cart */}
              <Link
                href="/panier"
                onClick={() => {
                  triggerHaptic('light');
                  setMenuOpen(false);
                }}
                aria-label="Panier"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '8px 10px',
                  borderRadius: '10px',
                  background: 'rgba(255,255,255,0.06)',
                  textDecoration: 'none',
                  color: '#fff',
                  fontSize: '13px',
                  fontWeight: 500,
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
                        marginLeft: 'auto',
                        padding: '1px 6px',
                        borderRadius: '999px',
                        background: '#A8C4A2',
                        color: '#0B1F17',
                        fontSize: '10px',
                        fontWeight: 700,
                        fontFamily: 'var(--font-mono)',
                      }}
                      aria-hidden="true"
                    >
                      {count > 9 ? '9+' : count}
                    </span>
                  ) : null;
                })()}
              </Link>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

function BottomTabBar() {
  const pathname = usePathname();
  const { loading } = useAuth();
  const { openSearch } = useSearchContext();
  const [mounted, setMounted] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [pressedTab, setPressedTab] = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Reset pressed visual state when navigation changes
  useEffect(() => {
    setPressedTab(null);
  }, [pathname]);

  const isActive = (tab: Tab): boolean => {
    if (pressedTab && pressedTab === tab.href) return true;
    if (!tab.matchPaths) return pathname === tab.href;
    return tab.matchPaths.some(p => pathname === p || pathname?.startsWith(p + '/'));
  };

  if (loading || !mounted) {
    return (
      <nav role="navigation" aria-label="Chargement de la navigation" className="md:hidden" style={{ position: 'fixed', left: '12px', right: '12px', bottom: 'calc(12px + env(safe-area-inset-bottom))', zIndex: 50 }}>
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
          justifyContent: 'space-between',
          padding: '0 8px',
        }}>
          {[...Array(5)].map((_, i) => (
            <div key={i} className="animate-pulse" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', width: '48px' }}>
              <div style={{ width: '24px', height: '24px', borderRadius: '50%', background: '#E2E8E4' }} />
              <div style={{ width: '32px', height: '6px', borderRadius: '4px', background: '#E2E8E4' }} />
            </div>
          ))}
        </div>
      </nav>
    );
  }

  return (
    <nav role="navigation" aria-label="Navigation principale" className="md:hidden" style={{ position: 'fixed', left: '16px', right: '16px', bottom: 'calc(10px + env(safe-area-inset-bottom))', zIndex: 50 }}>
      <div
        style={{
          height: '62px',
          background: 'rgba(20, 40, 30, 0.45)',
          backdropFilter: 'blur(40px) saturate(200%)',
          WebkitBackdropFilter: 'blur(40px) saturate(200%)',
          borderRadius: '999px',
          borderTop: '1px solid rgba(255,255,255,0.3)',
          borderLeft: '1px solid rgba(255,255,255,0.15)',
          borderRight: '1px solid rgba(255,255,255,0.15)',
          borderBottom: '1px solid rgba(255,255,255,0.05)',
          boxShadow: '0 30px 60px rgba(0,0,0,0.4), inset 0 2px 10px rgba(255,255,255,0.1)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-around',
          padding: '0 16px',
        }}
      >
        {TABS.map(tab => (
          <TabLink key={tab.href} tab={tab} isActive={isActive(tab)} onPress={setPressedTab} />
        ))}
        <HamburgerMenu menuOpen={menuOpen} setMenuOpen={setMenuOpen} openSearch={openSearch} />
      </div>
    </nav>
  );
}

export default memo(BottomTabBar);
