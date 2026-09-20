'use client';

import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import LkvIcon, { type LkvIconName } from '@/components/ui/LkvIcon';
import { Button } from '@/components/ui';
import { useAuth } from '@/contexts/AuthContext';
import { useCartCount } from '@/hooks/useCartCount';
import { zIndex } from '@/lib/ui/zIndex';
import { DESTINATIONS } from '@/components/mobile-nav/destinationRegistry';

interface MobileDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onSearchOpen?: () => void;
}

interface NavItem {
  label: string;
  href: string;
  action?: 'search';
  icon: LkvIconName;
}

interface NavSection {
  label: string;
  items: NavItem[];
}

// M02 — les destinations principales viennent du registre unique
// (destinationRegistry) : mêmes href/libellés/icônes que la BottomTabBar.
const DESTINATION_SECTION: NavSection = {
  label: 'Destinations',
  items: DESTINATIONS.map((destination) => ({
    label: destination.label.fr,
    icon: destination.iconName,
    href: destination.href,
  })),
};

const SECTIONS: NavSection[] = [
  DESTINATION_SECTION,
{
        label: 'Découvrir & Terrain',
        items: [
          { label: 'Rechercher', icon: 'search', href: '', action: 'search' },
          { label: 'Panier', icon: 'bag', href: '/panier' },
          { label: 'Carte interactive', icon: 'map-pin', href: '/explorer' },
          { label: 'Boussole augmentée', icon: 'search', href: '/randonnee-active' },
          { label: 'Mode hors-ligne', icon: 'bookmark', href: '/hors-ligne' },
          { label: 'Carnets', icon: 'doc', href: '/carnets' },
          { label: 'Guides', icon: 'bookmark', href: '/guides' },
          { label: 'Blog', icon: 'doc', href: '/blog' },
          { label: 'Outils terrain', icon: 'search', href: '/outils' },
          { label: 'Mode rando GPS/SOS', icon: 'map-pin', href: '/randonnee-active' },
        ],
      },
  {
    label: 'Vie pro & occasion',
    items: [
      { label: 'Location', icon: 'bag', href: '/location' },
          { label: 'Enchères', icon: 'star', href: '/occasion' },
      { label: 'Espace Pro', icon: 'user', href: '/pro' },
      { label: 'Ambassadeurs', icon: 'star', href: '/ambassadeurs' },
      { label: 'Créateurs', icon: 'star', href: '/createurs' },
    ],
  },
  {
    label: 'Compte & légal',
    items: [
      { label: "Rapport d'Expédition", icon: 'doc', href: '/rapport-expedition' },
          { label: 'Rapport Kit', icon: 'bag', href: '/ai-configurator' },
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
  touchAction: 'none',
  overscrollBehavior: 'none',
  zIndex: zIndex.sheet,
};

const panelStyle: React.CSSProperties = {
  position: 'fixed',
  top: 0,
  left: 0,
  bottom: 0,
  width: '88%',
  maxWidth: '360px',
  background: '#EEF3EC',
  // Même couche que le scrim : le panneau suit le scrim dans le DOM.
  zIndex: zIndex.sheet,
  boxShadow: '20px 0 60px rgba(23,64,44,0.25)',
  display: 'flex',
  flexDirection: 'column',
  overflow: 'hidden',
  paddingLeft: 'var(--safe-left)',
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

  // P1-3 (C-17 suite) — sortie animée sans framer-motion : le panneau reste
  // monté le temps de l'animation CSS de fermeture (--closing), puis unmount.
  const [visible, setVisible] = useState(isOpen);
  const [closing, setClosing] = useState(false);
  useEffect(() => {
    if (isOpen) {
      setVisible(true);
      setClosing(false);
      return;
    }
    if (!visible) return;
    setClosing(true);
    const timer = setTimeout(() => {
      setClosing(false);
      setVisible(false);
    }, 240);
    return () => clearTimeout(timer);
  }, [isOpen, visible]);

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
    visible && (
      <>
        {/* Scrim */}
        <div
          key="drawer-scrim"
          className={`lkv-drawer-scrim${closing ? ' lkv-drawer-scrim--closing' : ''}`}
          style={scrimStyle}
          onClick={onClose}
          aria-hidden="true"
        />

        {/* Panel */}
        <div
          key="drawer-panel"
          id="mobile-drawer"
          ref={panelRef}
          className={`lkv-drawer-panel${closing ? ' lkv-drawer-panel--closing' : ''}`}
          style={panelStyle}
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
                  padding: 'calc(40px + var(--safe-top)) 20px 22px',
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
                  className="glass-circle-btn"
                  style={{
                    position: 'absolute',
                    top: 'calc(var(--safe-top) + var(--space-3))',
                    right: '12px',
                    width: '44px',
                    height: '44px',
                  }}
                  aria-label="Fermer le menu"
                >
                  <LkvIcon name="close" size={14} color="#17402C" />
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
                      <Button variant="secondary" size="sm">
                        Se connecter
                      </Button>
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
                  padding: '14px 16px calc(20px + var(--safe-bottom))',
                  borderTop: '1px solid rgba(23,64,44,0.06)',
                  background: '#F4F1EA',
                }}
              >
                <Link
                  href="/abonnements"
                  onClick={onClose}
                  className="glass"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    padding: '12px',
                    borderRadius: '14px',
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
        </div>
      </>
    )
  );
}
