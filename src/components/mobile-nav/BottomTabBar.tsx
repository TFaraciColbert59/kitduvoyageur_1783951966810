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
  iconName: 'home' | 'mountain' | 'bag' | 'doc' | 'user' | 'search' | 'chevron-left' | 'chevron-right' | 'heart' | 'bookmark' | 'bell' | 'map-pin' | 'star' | 'minus' | 'plus' | 'close' | 'menu' | 'arrow-right' | 'arrow-left' | 'lock' | 'filter' | 'users' | 'compass' | 'box' | 'sparkles' | 'tent' | 'book';
  ariaLabel: string;
  matchPaths?: string[];
  isHero?: boolean;
}

const DEFAULT_TABS: Tab[] = [
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
      '/carnets',
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

const COMMUNITY_TABS: Tab[] = [
  {
    href: '/communaute',
    label: 'Fil',
    iconName: 'sparkles',
    ariaLabel: 'Fil d’actualité communauté',
    matchPaths: ['/communaute', '/communaute/publier', '/feed'],
  },
  {
    href: '/groupes',
    label: 'Groupes',
    iconName: 'users',
    ariaLabel: 'Groupes de voyage',
    matchPaths: ['/groupes'],
  },
  {
    href: '/clubs',
    label: 'Clubs',
    iconName: 'tent',
    ariaLabel: 'Clubs outdoor',
    matchPaths: ['/clubs'],
  },
  {
    href: '/carnets',
    label: 'Carnets',
    iconName: 'book',
    ariaLabel: 'Carnets d’expédition',
    matchPaths: ['/carnets'],
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
        gap: '2px',
        textDecoration: 'none',
        color: isActive ? '#A8C4A2' : 'rgba(255, 255, 255, 0.5)',
        position: 'relative',
        transition: 'color 0.2s ease',
        userSelect: 'none',
        WebkitTapHighlightColor: 'transparent',
        width: '44px',
      }}
    >
      <motion.div
        whileTap={{ scale: 0.85 }}
        transition={{ type: 'spring', stiffness: 500, damping: 25 }}
        style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }}
      >
        <LkvIcon name={tab.iconName} size={18} />
        <span style={{ fontSize: '8.5px', fontWeight: isActive ? 600 : 500, fontFamily: 'var(--font-mono)', letterSpacing: '-0.02em' }}>{tab.label}</span>
      </motion.div>
      {isActive && (
        <motion.div
          layoutId="tab-indicator"
          transition={{ type: 'spring', stiffness: 450, damping: 30 }}
          style={{
            position: 'absolute',
            top: '-8px',
            width: '4px',
            height: '4px',
            borderRadius: '50%',
            background: '#A8C4A2',
            boxShadow: '0 0 8px rgba(168, 196, 162, 0.8)',
          }}
        />
      )}
    </Link>
  );
});

function HamburgerMenu({ menuOpen, setMenuOpen, openSearch, isCommunity }: { menuOpen: boolean; setMenuOpen: React.Dispatch<React.SetStateAction<boolean>>; openSearch?: () => void; isCommunity?: boolean }) {
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
          width: '32px',
          height: '32px',
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
        <LkvIcon name="menu" size={14} />
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

              {/* Enregistrés / Favoris (Visible in Community Section) */}
              {isCommunity && (
                <Link
                  href="/carnets?tab=favorites"
                  onClick={() => {
                    triggerHaptic('light');
                    setMenuOpen(false);
                  }}
                  aria-label="Enregistrés"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '8px 10px',
                    borderRadius: '10px',
                    background: 'rgba(255,255,255,0.06)',
                    textDecoration: 'none',
                    color: '#A8C4A2',
                    fontSize: '13px',
                    fontWeight: 600,
                  }}
                >
                  <LkvIcon name="bookmark" size={16} color="#A8C4A2" />
                  Enregistrés
                </Link>
              )}

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
  const router = useRouter();
  const { triggerHaptic } = useHapticFeedback();
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

  const isCommunitySection = Boolean(
    pathname && (
      pathname.startsWith('/communaute') ||
      pathname.startsWith('/groupes') ||
      pathname.startsWith('/clubs') ||
      pathname.startsWith('/carnets')
    )
  );

  const currentTabs = isCommunitySection ? COMMUNITY_TABS : DEFAULT_TABS;

  const isActive = (tab: Tab): boolean => {
    if (pressedTab && pressedTab === tab.href) return true;
    if (!tab.matchPaths) return pathname === tab.href;
    return tab.matchPaths.some(p => pathname === p || pathname?.startsWith(p + '/'));
  };

  const handleBack = (e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    triggerHaptic('light');
    try {
      if (typeof window !== 'undefined' && window.history.length > 1) {
        window.history.back();
      } else {
        router.push('/explorer');
      }
    } catch {
      router.push('/explorer');
    }
  };

  if (loading || !mounted) {
    return (
      <nav role="navigation" aria-label="Chargement de la navigation" className="md:hidden" style={{ position: 'fixed', left: '10px', right: '10px', bottom: 'calc(4px + env(safe-area-inset-bottom))', zIndex: 50 }}>
        <div style={{
          height: '52px',
          background: 'rgba(20, 40, 30, 0.65)',
          backdropFilter: 'blur(40px) saturate(200%)',
          WebkitBackdropFilter: 'blur(40px) saturate(200%)',
          borderRadius: '999px',
          borderTop: '1px solid rgba(255,255,255,0.25)',
          borderLeft: '1px solid rgba(255,255,255,0.12)',
          borderRight: '1px solid rgba(255,255,255,0.12)',
          borderBottom: '1px solid rgba(255,255,255,0.05)',
          boxShadow: '0 20px 40px rgba(0,0,0,0.35), inset 0 1px 6px rgba(255,255,255,0.1)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-around',
          padding: '0 8px',
        }}>
          {[...Array(5)].map((_, i) => (
            <div key={i} className="animate-pulse" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px', width: '44px' }}>
              <div style={{ width: '18px', height: '18px', borderRadius: '50%', background: 'rgba(255,255,255,0.2)' }} />
              <div style={{ width: '26px', height: '5px', borderRadius: '4px', background: 'rgba(255,255,255,0.2)' }} />
            </div>
          ))}
        </div>
      </nav>
    );
  }

  return (
    <nav role="navigation" aria-label="Navigation principale" className="md:hidden" style={{ position: 'fixed', left: '10px', right: '10px', bottom: 'calc(4px + env(safe-area-inset-bottom))', zIndex: 50 }}>
      <div
        style={{
          height: '52px',
          background: 'rgba(20, 40, 30, 0.65)',
          backdropFilter: 'blur(40px) saturate(200%)',
          WebkitBackdropFilter: 'blur(40px) saturate(200%)',
          borderRadius: '999px',
          borderTop: '1px solid rgba(255,255,255,0.25)',
          borderLeft: '1px solid rgba(255,255,255,0.12)',
          borderRight: '1px solid rgba(255,255,255,0.12)',
          borderBottom: '1px solid rgba(255,255,255,0.05)',
          boxShadow: '0 20px 40px rgba(0,0,0,0.35), inset 0 1px 6px rgba(255,255,255,0.1)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-around',
          padding: '0 8px',
        }}
      >
        {/* Left-most back arrow when in community section */}
        {isCommunitySection && (
          <motion.button
            type="button"
            whileTap={{ scale: 0.85 }}
            onClick={handleBack}
            aria-label="Retour"
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '2px',
              background: 'transparent',
              border: 'none',
              color: 'rgba(255, 255, 255, 0.8)',
              cursor: 'pointer',
              userSelect: 'none',
              WebkitTapHighlightColor: 'transparent',
              width: '38px',
            }}
          >
            <LkvIcon name="arrow-left" size={17} />
            <span style={{ fontSize: '8px', fontWeight: 600, fontFamily: 'var(--font-mono)', letterSpacing: '-0.02em' }}>Retour</span>
          </motion.button>
        )}

        {currentTabs.map(tab => (
          <TabLink key={tab.href} tab={tab} isActive={isActive(tab)} onPress={setPressedTab} />
        ))}

        <HamburgerMenu
          menuOpen={menuOpen}
          setMenuOpen={setMenuOpen}
          openSearch={openSearch}
          isCommunity={isCommunitySection}
        />
      </div>
    </nav>
  );
}

export default memo(BottomTabBar);
