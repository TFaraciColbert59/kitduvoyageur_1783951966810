"use client";

import React, { useEffect, useState, memo } from 'react';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
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
    href: '/materiel',
    label: 'Matériel',
    iconName: 'box',
    ariaLabel: 'Mon matériel, kits et prochain départ',
    matchPaths: ['/materiel', '/materiel/'],
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
    label: 'Profil',
    iconName: 'user',
    ariaLabel: 'Mon compte voyageur',
    matchPaths: ['/compte', '/connexion', '/inscription', '/profil'],
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

// A memoized tab link — Liquid Glass ultra-translucide & pilule animée glissante
const TabLink = memo(function TabLink({ tab, isActive, onPress }: { tab: Tab; isActive: boolean; onPress: (href: string) => void }) {
  const { triggerHaptic } = useHapticFeedback();
  const handleClick = () => {
    onPress(tab.href);
    triggerHaptic('light');
  };

  return (
    <Link
      href={tab.href}
      prefetch={true}
      onClick={handleClick}
      aria-label={tab.ariaLabel}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '2px',
        textDecoration: 'none',
        position: 'relative',
        userSelect: 'none',
        WebkitTapHighlightColor: 'transparent',
        width: '56px',
        height: '48px',
      }}
    >
      {isActive && (
        <motion.span
          layoutId="bottom-tab-active-pill"
          style={{
            position: 'absolute',
            inset: 0,
            borderRadius: '16px',
            background: 'rgba(23, 64, 44, 0.10)',
            border: '1px solid rgba(23, 64, 44, 0.20)',
            boxShadow: '0 4px 14px -4px rgba(23, 64, 44, 0.20), inset 0 1px 1px rgba(255,255,255,0.7)',
          }}
          transition={{ type: 'spring', stiffness: 450, damping: 32 }}
        />
      )}
      <motion.div
        whileTap={{ scale: 0.85 }}
        transition={{ type: 'spring', stiffness: 500, damping: 25 }}
        style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px', position: 'relative', zIndex: 1 }}
      >
        <LkvIcon name={tab.iconName} size={20} color={isActive ? '#17402C' : '#365233'} />
        <span style={{ fontSize: '9px', fontWeight: isActive ? 700 : 600, fontFamily: 'var(--font-mono)', letterSpacing: '-0.02em', whiteSpace: 'nowrap', color: isActive ? '#17402C' : '#365233', opacity: isActive ? 1 : 0.8 }}>{tab.label}</span>
      </motion.div>
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
          background: 'rgba(255, 255, 255, 0.25)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          border: '1px solid rgba(255, 255, 255, 0.45)',
          boxShadow: 'inset 0 1px 1px rgba(255,255,255,0.6)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#17402C',
          cursor: 'pointer',
          outline: 'none',
        }}
      >
        <LkvIcon name="menu" size={14} color="#17402C" />
      </motion.button>
      <AnimatePresence>
        {menuOpen && (
          <>
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
                bottom: '60px',
                zIndex: 56,
                background: 'rgba(255, 255, 255, 0.45)',
                backdropFilter: 'blur(12px) saturate(160%)',
                WebkitBackdropFilter: 'blur(12px) saturate(160%)',
                borderRadius: '16px',
                border: '1px solid rgba(255, 255, 255, 0.5)',
                boxShadow: '0 16px 36px rgba(0, 0, 0, 0.08), inset 0 1px 1px rgba(255,255,255,0.7)',
                padding: '8px',
                display: 'flex',
                flexDirection: 'column',
                gap: '6px',
                minWidth: '135px',
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
                  background: 'rgba(23, 64, 44, 0.06)',
                  border: 'none',
                  color: '#17402C',
                  fontSize: '13px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  textAlign: 'left',
                }}
              >
                <LkvIcon name="search" size={16} color="#17402C" />
                Recherche
              </button>

              {/* Enregistrés / Favoris */}
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
                    background: 'rgba(23, 64, 44, 0.06)',
                    textDecoration: 'none',
                    color: '#17402C',
                    fontSize: '13px',
                    fontWeight: 600,
                  }}
                >
                  <LkvIcon name="bookmark" size={16} color="#17402C" />
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
                  background: 'rgba(23, 64, 44, 0.06)',
                  textDecoration: 'none',
                  color: '#17402C',
                  fontSize: '13px',
                  fontWeight: 600,
                  position: 'relative',
                }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#17402C" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                  <path d="M13.7 21a2 2 0 0 1-3.4 0" />
                </svg>
                Alertes
                <span style={{ position: 'absolute', top: '10px', right: '10px', width: '6px', height: '6px', borderRadius: '50%', background: '#5B7F55' }} aria-hidden="true" />
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
                  background: 'rgba(23, 64, 44, 0.06)',
                  textDecoration: 'none',
                  color: '#17402C',
                  fontSize: '13px',
                  fontWeight: 600,
                  position: 'relative',
                }}
              >
                <LkvIcon name="bag" size={16} color="#17402C" />
                Panier
                {(() => {
                  const cart = getCart();
                  const count = Array.isArray(cart) ? cart.reduce((sum: number, item: { quantity?: number }) => sum + (item.quantity || 0), 0) : 0;
                  if (count > 0) {
                    return (
                      <span style={{
                        position: 'absolute',
                        top: '8px',
                        right: '8px',
                        background: '#17402C',
                        color: '#fff',
                        fontSize: '9px',
                        fontWeight: 700,
                        padding: '1px 5px',
                        borderRadius: '999px',
                        fontFamily: 'monospace',
                      }}>
                        {count}
                      </span>
                    );
                  }
                  return null;
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
  const { openSearch } = useSearchContext();
  const [mounted, setMounted] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [pressedTab, setPressedTab] = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

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

  if (!mounted) {
    return (
      <nav role="navigation" aria-label="Chargement de la navigation" className="md:hidden" style={{ position: 'fixed', left: '8px', right: '8px', bottom: '0px', paddingBottom: 'env(safe-area-inset-bottom, 0px)', zIndex: 50 }}>
        <div style={{
          height: '56px',
          background: 'linear-gradient(180deg, rgba(255,255,255,0.28) 0%, rgba(255,255,255,0.08) 100%)',
          backdropFilter: 'blur(24px) saturate(180%)',
          WebkitBackdropFilter: 'blur(24px) saturate(180%)',
          borderRadius: '24px',
          borderTop: '1.5px solid rgba(255,255,255,0.65)',
          borderLeft: '1px solid rgba(255,255,255,0.35)',
          borderRight: '1px solid rgba(255,255,255,0.35)',
          borderBottom: '1px solid rgba(255,255,255,0.15)',
          boxShadow: '0 12px 36px rgba(0,0,0,0.08), inset 0 1px 1.5px rgba(255,255,255,0.7)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-around',
          padding: '0 8px',
          gap: '2px',
        }}>
          {[...Array(6)].map((_, i) => (
            <div key={i} className="animate-pulse" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px', width: '56px', height: '48px' }}>
              <div style={{ width: '20px', height: '20px', borderRadius: '50%', background: 'rgba(23, 64, 44, 0.08)' }} />
              <div style={{ width: '30px', height: '5px', borderRadius: '4px', background: 'rgba(23, 64, 44, 0.08)' }} />
            </div>
          ))}
        </div>
      </nav>
    );
  }

  return (
    <nav role="navigation" aria-label="Navigation principale" className="md:hidden" style={{ position: 'fixed', left: '8px', right: '8px', bottom: '0px', paddingBottom: 'env(safe-area-inset-bottom, 0px)', zIndex: 50 }}>
      <div
        style={{
          height: '56px',
          background: 'linear-gradient(180deg, rgba(255,255,255,0.14) 0%, rgba(255,255,255,0.03) 100%)',
          backdropFilter: 'blur(8px) saturate(150%)',
          WebkitBackdropFilter: 'blur(8px) saturate(150%)',
          borderRadius: '24px',
          borderTop: '1.5px solid rgba(255,255,255,0.65)',
          borderLeft: '1px solid rgba(255,255,255,0.30)',
          borderRight: '1px solid rgba(255,255,255,0.30)',
          borderBottom: '1px solid rgba(255,255,255,0.12)',
          boxShadow: '0 8px 32px rgba(0,0,0,0.06), inset 0 1px 1.5px rgba(255,255,255,0.6)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-around',
          padding: '0 10px',
          gap: '2px',
        }}
      >
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
              color: '#17402C',
              cursor: 'pointer',
              userSelect: 'none',
              WebkitTapHighlightColor: 'transparent',
              width: '38px',
            }}
          >
            <LkvIcon name="arrow-left" size={17} color="#17402C" />
            <span style={{ fontSize: '8px', fontWeight: 600, fontFamily: 'var(--font-mono)', letterSpacing: '-0.02em', color: '#17402C' }}>Retour</span>
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
