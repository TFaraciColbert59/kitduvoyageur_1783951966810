'use client';

import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import LkvIcon, { type LkvIconName } from '@/components/ui/LkvIcon';
import { Button, IconButton } from '@/components/ui';
import { useAuth } from '@/contexts/AuthContext';
import { useCartCount } from '@/hooks/useCartCount';
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
  icon: string;
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
          { label: 'Rapport Kit', icon: 'bag', href: '/preparer?tab=equipement' },
      { label: 'Aide / FAQ', icon: 'heart', href: '/faq' },
      { label: 'Contact', icon: 'heart', href: '/contact' },
      { label: 'CGU', icon: 'lock', href: '/cgu' },
      { label: 'CGV', icon: 'lock', href: '/cgv' },
      { label: 'Mentions Légales', icon: 'lock', href: '/mentions-legales' },
      { label: 'Politique de Confidentialité', icon: 'lock', href: '/politique-confidentialite' },
    ],
  },
];

const SECTION_LABEL_CLASS =
  'px-[var(--space-5)] pb-[var(--space-2)] pt-[var(--space-4)] text-[length:var(--lkv-text-caption-2)] font-semibold uppercase tracking-[0.04em] text-[color:var(--lkv-ink-300)]';

const ITEM_CLASS =
  'flex min-h-[var(--lkv-touch-min)] items-center gap-[var(--space-3)] px-[var(--space-5)] text-[length:var(--lkv-text-subheadline)] text-[color:var(--lkv-primary)] no-underline transition-colors hover:bg-[color:var(--lkv-hover-surface)]';

export default function MobileDrawer({ isOpen, onClose, onSearchOpen }: MobileDrawerProps) {
  const pathname = usePathname();
  const { user, profile } = useAuth();
  const cartCount = useCartCount();

  const [visible, setVisible] = useState(isOpen);
  const [closing, setClosing] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  // P1-3 (C-17 suite) — sortie animée sans framer : le panneau reste
  // monté le temps de l'animation CSS de fermeture (--closing), puis unmount.
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
  const version = 'v0.1.0';

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
          className={`lkv-drawer-scrim fixed inset-0 z-[var(--z-sheet)] touch-none overscroll-none bg-[color:var(--lkv-overlay-scrim)] backdrop-blur-[var(--blur-sm)]${closing ? ' lkv-drawer-scrim--closing' : ''}`}
          onClick={onClose}
          aria-hidden="true"
        />

        {/* Panel */}
        <div
          key="drawer-panel"
          id="mobile-drawer"
          ref={panelRef}
          className={`lkv-drawer-panel fixed inset-y-0 left-0 z-[var(--z-sheet)] flex w-[88%] max-w-[360px] flex-col overflow-hidden bg-[color:var(--glass-bg-medium)] border border-[color:var(--glass-border)] backdrop-blur-[var(--glass-blur-sm)] saturate-[var(--glass-sat)] pl-[var(--safe-left)] shadow-elevation-5${closing ? ' lkv-drawer-panel--closing' : ''}`}
          role="dialog"
          aria-modal="true"
          aria-label="Navigation principale"
        >
            <div className="flex-1 overflow-y-auto overscroll-contain">
              {/* Header */}
              <header className="relative overflow-hidden bg-[color:var(--glass-bg-medium)] border border-[color:var(--glass-border)] backdrop-blur-[var(--glass-blur-sm)] saturate-[var(--glass-sat)] lkv-rim-inset px-[var(--space-5)] pb-[22px] pt-[calc(40px+var(--safe-top))] text-[color:var(--lkv-text-primary)]">
                {/* Glow circle decoration */}
                <div
                  className="absolute -bottom-[50px] -right-[30px] h-[180px] w-[180px] rounded-full bg-[radial-gradient(circle,var(--sage-300)_0%,transparent_65%)] opacity-40"
                  aria-hidden="true"
                />

                {/* Close button */}
                <IconButton
                  onClick={onClose}
                  aria-label="Fermer le menu"
                  className="absolute right-[var(--space-3)] top-[calc(var(--safe-top)+var(--space-3))] bg-[color:var(--glass-bg-medium)] border border-[color:var(--glass-border)] backdrop-blur-[var(--glass-blur-sm)] saturate-[var(--glass-sat)] lkv-rim-inset text-[color:var(--lkv-primary)]"
                >
                  <LkvIcon name="close" size={14} />
                </IconButton>

                {/* Logo + Brand */}
                <div className="relative z-[var(--z-dropdown)] mb-[22px] flex items-center gap-[10px]">
                  <LkvIcon name="mountain" size={28} className="text-[color:var(--sage-300)]" />
                  <div>
                    <div className="text-[length:var(--lkv-text-footnote)] font-medium">
                      Le Kit du Voyageur
                    </div>
                    <em className="block font-serif text-[length:var(--lkv-text-caption-1)] italic text-[color:var(--lkv-forest-100)]">
                      édition {season} · {currentYear}
                    </em>
                  </div>
                </div>

                {/* User section */}
                {user ? (
                  <div className="relative z-[var(--z-dropdown)] flex items-center gap-[var(--space-3)]">
                    <div className="flex h-11 w-11 items-center justify-center rounded-full border-2 border-white/20 bg-[color:var(--lkv-secondary)] font-serif text-[length:var(--lkv-text-title-sm)] italic text-[color:var(--lkv-forest-950)]">
                      {(profile?.full_name?.[0] || user?.email?.[0] || '?').toUpperCase()}
                    </div>
                    <div>
                      <div className="text-[length:var(--lkv-text-subheadline)] font-medium">
                        {profile?.full_name || 'Voyageur'}
                      </div>
                      <div className="font-mono text-[length:var(--lkv-text-caption-2)] text-white/60">
                        MEMBRE · NIVEAU {profile?.level || 1}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="relative z-[var(--z-dropdown)]">
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
                    <div className={SECTION_LABEL_CLASS}>{section.label}</div>
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
                            className={`${ITEM_CLASS} w-full border-none bg-transparent text-left`}
                          >
                            <LkvIcon name="search" size={20} />
                            <span className="flex-1">{item.label}</span>
                            <LkvIcon name="chevron-right" size={16} className="text-[color:var(--ink-300)]" />
                          </button>
                        ) : (
                        <Link
                          key={item.href + item.label}
                          href={item.href}
                          onClick={onClose}
                          className={`${ITEM_CLASS} ${
                            isActive ? 'bg-[color:var(--lkv-hover-surface)] font-medium' : ''
                          }`}
                        >
                          <LkvIcon name={item.icon as LkvIconName} size={20} />
                          <span className="flex-1">{item.label}</span>
                          {item.href === '/panier' && cartCount > 0 && (
                            <span className="mr-1 rounded-full bg-[color:var(--lkv-secondary)] px-1.5 py-px font-mono text-[10px] font-bold text-[color:var(--lkv-text-inverted)]">
                              {cartCount > 9 ? '9+' : cartCount}
                            </span>
                          )}
                          <LkvIcon
                            name="chevron-right"
                            size={16}
                            className="text-[color:var(--ink-300)]"
                          />
                        </Link>
                        )
                      );
                    })}
                  </div>
                ))}
              </nav>

              {/* Footer */}
              <footer className="border-t border-[color:var(--lkv-border-subtle)] bg-[color:var(--stone-100)] px-[var(--space-4)] pb-[calc(var(--safe-bottom)+20px)] pt-[14px]">
                <Link
                  href="/abonnements"
                  onClick={onClose}
                  className="flex items-center gap-[var(--space-3)] rounded-[var(--lkv-radius-control)] border border-[color:var(--glass-border)] bg-[color:var(--card-tint-strong)] p-[var(--space-3)] no-underline backdrop-blur-[var(--blur-md)]"
                >
                  <LkvIcon name="star" size={20} />
                  <div>
                    <div className="text-[length:var(--lkv-text-caption-1)] font-semibold text-[color:var(--lkv-primary)]">
                      Premium Voyageur
                    </div>
                    <div className="text-[length:var(--lkv-text-caption-2)] text-[color:var(--lkv-text-muted)]">
                      Débloquez toutes les fonctionnalités
                    </div>
                  </div>
                  <LkvIcon name="arrow-right" size={16} className="text-[color:var(--lkv-primary)]" />
                </Link>
                <div className="mt-[14px] text-center font-mono text-[10px] text-[color:var(--ink-300)]">
                  {version} · GRENOBLE · FR
                </div>
              </footer>
            </div>
        </div>
      </>
    )
  );
}
