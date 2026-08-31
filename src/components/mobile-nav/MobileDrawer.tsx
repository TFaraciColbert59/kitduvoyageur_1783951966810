'use client';

import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import LkvIcon from '@/components/ui/LkvIcon';
import LkvButton from '@/components/ui/LkvButton';
import { useAuth } from '@/contexts/AuthContext';
import { useCartCount } from '@/hooks/useCartCount';

interface MobileDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onSearchOpen?: () => void;
}

interface NavItem {
  label: string;
  href: string;
  action?: 'search';
  icon: 'home' | 'mountain' | 'bag' | 'doc' | 'user' | 'search' | 'chevron-left' | 'chevron-right' | 'heart' | 'bookmark' | 'bell' | 'map-pin' | 'star' | 'minus' | 'plus' | 'close' | 'menu' | 'arrow-right' | 'lock' | 'filter';
}

interface NavSection {
  label: string;
  items: NavItem[];
}

const SECTIONS: NavSection[] = [
{
        label: 'Découvrir & Terrain',
        items: [
          { label: 'Rechercher', icon: 'search', href: '', action: 'search' },
          { label: 'Panier', icon: 'bag', href: '/panier' },
          { label: 'Carte interactive', icon: 'map-pin', href: '/carte-interactive' },
          { label: 'Boussole augmentée', icon: 'search', href: '/boussole' },
          { label: 'Mode hors-ligne', icon: 'bookmark', href: '/hors-ligne' },
          { label: 'Carnets', icon: 'doc', href: '/carnets' },
          { label: 'Guides', icon: 'bookmark', href: '/guides' },
          { label: 'Blog', icon: 'doc', href: '/blog' },
          { label: 'Outils terrain', icon: 'search', href: '/outils' },
          { label: 'Mon Matériel', icon: 'bag', href: '/materiel' },
          { label: 'Mode rando GPS/SOS', icon: 'map-pin', href: '/naviguer' },
        ],
      },
  {
    label: 'Vie pro & occasion',
    items: [
      { label: 'Location', icon: 'bag', href: '/location' },
      { label: 'Enchères', icon: 'star', href: '/encheres' },
      { label: 'Espace Pro', icon: 'user', href: '/pro' },
      { label: 'Ambassadeurs', icon: 'star', href: '/ambassadeurs' },
      { label: 'Créateurs', icon: 'star', href: '/createurs' },
    ],
  },
  {
    label: 'Compte & légal',
    items: [
      { label: 'Mes Aventures', icon: 'mountain', href: '/mes-aventures' },
      { label: "Rapport d'Expédition", icon: 'doc', href: '/rapport-expedition' },
      { label: 'Rapport Kit', icon: 'bag', href: '/rapport-kit' },
      { label: 'Aide / FAQ', icon: 'heart', href: '/faq' },
      { label: 'Contact', icon: 'heart', href: '/contact' },
      { label: 'CGU', icon: 'lock', href: '/cgu' },
      { label: 'CGV', icon: 'lock', href: '/cgv' },
      { label: 'Mentions Légales', icon: 'lock', href: '/mentions-legales' },
      { label: 'Politique de Confidentialité', icon: 'lock', href: '/politique-confidentialite' },
    ],
  },
];

const sectionLabelStyle: React.CSSProperties = {
  fontSize: '11px',
  fontWeight: 600,
  color: '#8B978F',
  letterSpacing: '0.04em',
  textTransform: 'uppercase',
  padding: '16px 20px 8px',
};

const itemStyle: React.CSSProperties = {
  padding: '8px 20px',
  display: 'flex',
  alignItems: 'center',
  gap: '12px',
  color: '#17402C',
  fontSize: '15px',
  fontWeight: 400,
  textDecoration: 'none',
  cursor: 'pointer',
  transition: 'background 0.15s ease',
};

const scrimStyle: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  background: 'rgba(23,64,44,0.55)',
  backdropFilter: 'blur(2px)',
  WebkitBackdropFilter: 'blur(2px)',
  zIndex: 50,
};

const panelStyle: React.CSSProperties = {
  position: 'fixed',
  top: 0,
  left: 0,
  bottom: 0,
  width: '88%',
  maxWidth: '360px',
  background: '#FBFAF6',
  zIndex: 51,
  boxShadow: '20px 0 60px rgba(23,64,44,0.25)',
  display: 'flex',
  flexDirection: 'column',
  overflow: 'hidden',
  paddingLeft: 'env(safe-area-inset-left, 0px)',
};

const scrollableContentStyle: React.CSSProperties = {
  flex: 1,
  overflowY: 'auto',
  WebkitOverflowScrolling: 'touch',
};

export default function MobileDrawer({ isOpen, onClose, onSearchOpen }: MobileDrawerProps) {
  const pathname = usePathname();
  const { user, profile } = useAuth();
  const cartCount = useCartCount();
  
  const [hoveredItem, setHoveredItem] = useState<string | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth();
  const season = currentMonth >= 2 && currentMonth <= 4 ? 'printemps'
    : currentMonth >= 5 && currentMonth <= 7 ? 'été'
    : currentMonth >= 8 && currentMonth <= 10 ? 'automne'
    : 'hiver';
  const version = 'v0.1.0'; // Should ideally come from package.json but hardcoded to package.json version for simplicity

  // Lock body scroll and handle focus trap / escape key
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      previousFocusRef.current = document.activeElement as HTMLElement;
      
      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
          onClose();
        } else if (e.key === 'Tab') {
          if (!panelRef.current) return;
          const focusable = panelRef.current.querySelectorAll(
            'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
          );
          if (focusable.length === 0) return;
          
          const first = focusable[0] as HTMLElement;
          const last = focusable[focusable.length - 1] as HTMLElement;
          
          if (e.shiftKey && document.activeElement === first) {
            e.preventDefault();
            last.focus();
          } else if (!e.shiftKey && document.activeElement === last) {
            e.preventDefault();
            first.focus();
          }
        }
      };
      
      document.addEventListener('keydown', handleKeyDown);
      
      // Focus close button or panel
      setTimeout(() => {
        if (panelRef.current) {
          const closeBtn = panelRef.current.querySelector('button');
          if (closeBtn) closeBtn.focus();
        }
      }, 50);

      return () => {
        document.body.style.overflow = '';
        document.removeEventListener('keydown', handleKeyDown);
        if (previousFocusRef.current) previousFocusRef.current.focus();
      };
    } else {
      document.body.style.overflow = '';
    }
  }, [isOpen, onClose]);

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Scrim */}
          <motion.div
            key="drawer-scrim"
            style={scrimStyle}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
            aria-hidden="true"
          />

          {/* Panel */}
          <motion.div
            key="drawer-panel"
            id="mobile-drawer"
            ref={panelRef}
            style={panelStyle}
            initial={{ x: '-100%' }}
            animate={{ x: 0 }}
            exit={{ x: '-100%' }}
            transition={{
              type: 'spring',
              damping: 28,
              stiffness: 300,
              mass: 0.8,
            }}
            role="dialog"
            aria-modal="true"
            aria-label="Navigation principale"
          >
            <div style={scrollableContentStyle}>
              {/* Header */}
              <header
                style={{
                  background: '#17402C',
                  color: '#fff',
                  padding: 'calc(40px + env(safe-area-inset-top)) 20px 22px',
                  position: 'relative',
                  overflow: 'hidden',
                }}
              >
                {/* Glow circle decoration */}
                <div
                  style={{
                    position: 'absolute',
                    bottom: '-50px',
                    right: '-30px',
                    width: '180px',
                    height: '180px',
                    borderRadius: '50%',
                    background:
                      'radial-gradient(circle, rgba(168,200,160,0.4) 0%, transparent 65%)',
                  }}
                  aria-hidden="true"
                />

                {/* Close button */}
                <button
                  onClick={onClose}
                  style={{
                    position: 'absolute',
                    top: 'calc(env(safe-area-inset-top, 0px) + 12px)',
                    right: '12px',
                    width: '44px',
                    height: '44px',
                    borderRadius: '999px',
                    background: 'rgba(255,255,255,0.14)',
                    color: '#fff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    border: 'none',
                    cursor: 'pointer',
                  }}
                  aria-label="Fermer le menu"
                >
                  <LkvIcon name="close" size={14} />
                </button>

                {/* Logo + Brand */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    marginBottom: '22px',
                    position: 'relative',
                    zIndex: 2,
                  }}
                >
                  <LkvIcon name="mountain" size={28} color="#A8C8A0" />
                  <div>
                    <div style={{ fontSize: '14px', fontWeight: 500 }}>
                      Le Kit du Voyageur
                    </div>
                    <em
                      style={{
                        display: 'block',
                        fontFamily: 'var(--font-serif)',
                        fontStyle: 'italic',
                        color: '#C6DCBE',
                        fontSize: '12px',
                      }}
                    >
                      édition {season} · {currentYear}
                    </em>
                  </div>
                </div>

                {/* User section */}
                {user ? (
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      position: 'relative',
                      zIndex: 2,
                    }}
                  >
                    <div
                      style={{
                        width: '44px',
                        height: '44px',
                        borderRadius: '999px',
                        background: '#A8C8A0',
                        color: '#06120C',
                        fontFamily: 'var(--font-serif)',
                        fontStyle: 'italic',
                        fontSize: '18px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        border: '2px solid rgba(255,255,255,0.2)',
                      }}
                    >
                      {(profile?.full_name?.[0] || user?.email?.[0] || '?').toUpperCase()}
                    </div>
                    <div>
                      <div style={{ fontSize: '15px', fontWeight: 500 }}>
                        {profile?.full_name || 'Voyageur'}
                      </div>
                      <div
                        style={{
                          fontSize: '11px',
                          color: 'rgba(255,255,255,0.6)',
                          fontFamily: 'var(--font-mono)',
                        }}
                      >
                        MEMBRE · NIVEAU {profile?.level || 1}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div style={{ position: 'relative', zIndex: 2 }}>
                    <Link href="/connexion" onClick={onClose}>
                      <LkvButton variant="secondary" size="sm">
                        Se connecter
                      </LkvButton>
                    </Link>
                  </div>
                )}
              </header>

              {/* Navigation Sections */}
              <nav>
                {SECTIONS.map((section) => (
                  <div key={section.label}>
                    <div style={sectionLabelStyle}>{section.label}</div>
                    {section.items.map((item) => {
                      const isActive =
                        pathname === item.href ||
                        (item.href !== '/' && pathname?.startsWith(item.href));

                      return (
                        item.action === 'search' ? (
                          <button
                            key={item.href + item.label}
                            type="button"
                            onClick={() => {
                              onClose();
                              onSearchOpen?.();
                            }}
                            style={{
                              ...itemStyle,
                              width: '100%',
                              border: 'none',
                              background: 'transparent',
                              fontFamily: 'inherit',
                              textAlign: 'left',
                            }}
                          >
                            <LkvIcon name="search" size={20} color="#17402C" />
                            <span style={{ flex: 1 }}>{item.label}</span>
                            <LkvIcon name="chevron-right" size={16} color="#AEB7B1" />
                          </button>
                        ) : (
                        <Link
                          key={item.href + item.label}
                          href={item.href}
                          onClick={onClose}
                          style={{
                            ...itemStyle,
                            background: isActive
                              ? 'rgba(23,64,44,0.04)'
                              : hoveredItem === item.href
                              ? 'rgba(23,64,44,0.03)'
                              : 'transparent',
                            fontWeight: isActive ? 500 : 400,
                          }}
                          onMouseEnter={() => setHoveredItem(item.href)}
                          onMouseLeave={() => setHoveredItem(null)}
                        >
                          <LkvIcon
                            name={item.icon}
                            size={20}
                            color={isActive ? '#17402C' : '#17402C'}
                          />
                          <span style={{ flex: 1 }}>{item.label}</span>
                          {item.href === '/panier' && cartCount > 0 && (
                            <span style={{
                              background: '#5B7F55',
                              color: '#fff',
                              fontSize: '10px',
                              fontWeight: 700,
                              padding: '1px 6px',
                              borderRadius: '999px',
                              fontFamily: 'monospace',
                              marginRight: '4px',
                            }}>
                              {cartCount > 9 ? '9+' : cartCount}
                            </span>
                          )}
                          <LkvIcon
                            name="chevron-right"
                            size={16}
                            color="#AEB7B1"
                          />
                        </Link>
                        )
                      );
                    })}
                  </div>
                ))}
              </nav>

              {/* Footer */}
              <footer
                style={{
                  padding: '14px 16px calc(20px + env(safe-area-inset-bottom))',
                  borderTop: '1px solid rgba(23,64,44,0.06)',
                  background: '#F4F1EA',
                }}
              >
                <Link
                  href="/abonnements"
                  onClick={onClose}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    padding: '12px',
                    background: '#FBFAF6',
                    borderRadius: '14px',
                    border: '1px solid rgba(23,64,44,0.05)',
                    textDecoration: 'none',
                  }}
                >
                  <LkvIcon name="star" size={20} color="#17402C" />
                  <div>
                    <div style={{ fontSize: '13px', fontWeight: 600, color: '#17402C' }}>
                      Premium Voyageur
                    </div>
                    <div style={{ fontSize: '11px', color: '#6B7A72' }}>
                      Débloquez toutes les fonctionnalités
                    </div>
                  </div>
                  <LkvIcon
                    name="arrow-right"
                    size={16}
                    color="#17402C"
                  />
                </Link>
                <div
                  style={{
                    fontSize: '10px',
                    color: '#8B978F',
                    textAlign: 'center',
                    marginTop: '14px',
                    fontFamily: 'var(--font-mono)',
                  }}
                >
                  {version} · GRENOBLE · FR
                </div>
              </footer>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
