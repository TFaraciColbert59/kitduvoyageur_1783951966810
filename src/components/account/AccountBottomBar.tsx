'use client';

import React from 'react';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { Compass, House, CircleUserRound, Send, ShoppingBag, Users } from 'lucide-react';

/* Glyphes « à la Instagram » : traits arrondis fins, couleur du texte (jeu Lucide, ISC).
   Les pictogrammes d'Instagram sont une marque protégée : ce sont leurs équivalents les plus proches. */
const glyph = { className: 'ic', strokeWidth: 1.8, 'aria-hidden': true } as const;
const ICONS: Record<string, React.ReactNode> = {
  explorer: <Compass {...glyph} />,
  compas: <Compass {...glyph} />,
  materiel: <ShoppingBag {...glyph} />,
  hub: <House {...glyph} />,
  communaute: <Users {...glyph} />,
  messages: <Send {...glyph} />,
  compte: <CircleUserRound {...glyph} />,
};

const ACCOUNT_TABS = [
  { id: 'hub', label: 'Hub', href: '/hub' },
  { id: 'explorer', label: 'Explorer', href: '/explorer' },
  { id: 'communaute', label: 'Communauté', href: '/communaute' },
  { id: 'messages', label: 'Messages', href: '/messagerie' },
  { id: 'compte', label: 'Compte', href: '/compte' },
] as const;

/**
 * Barre basse de la page Compte, à l'identique : 48 px, 5 cellules, lentille
 * 40 px, labels 600 10 px. Sur `/communaute`, aucun onglet n'est actif : la
 * lentille est masquée.
 */
export function AccountBottomBar({
  /**
   * `link` (défaut) garde le rendu historique des écrans déjà en place.
   * `button` reproduit le DOM de la référence Compte (5 boutons 80 × 44),
   * indispensable pour que les invariants de la grammaire soient mesurables.
   */
  renderAs = 'link',
  active = null,
  badges = {},
}: {
  renderAs?: 'link' | 'button';
  active?: string | null;
  /** Pastilles réelles (jamais inventées) : `{ hub: 4 }`. */
  badges?: Partial<Record<string, number>>;
} = {}) {
  const router = useRouter();
  const pathname = usePathname();
  const lastCommunityClickRef = React.useRef<number>(0);

  const handleTabClick = (tabId: string, href: string, e?: React.MouseEvent) => {
    if (tabId === 'communaute') {
      const now = Date.now();
      const diff = now - lastCommunityClickRef.current;
      lastCommunityClickRef.current = now;

      // Double-click (< 450ms)
      if (diff > 0 && diff < 450) {
        if (e) e.preventDefault();
        lastCommunityClickRef.current = 0;
        router.push('/communaute/reels');
        return;
      }
    }
    if (e && href) {
      // standard link behavior handles it, but if button:
      router.push(href);
    }
  };

  return (
    <nav
      className="tb"
      aria-label="Navigation principale"
    >
      <span className="lens" aria-hidden="true" style={{ opacity: 0 }} />
      {ACCOUNT_TABS.map((tab) => {
        const isActive = active === tab.id || (!active && pathname?.startsWith(tab.href));
        const badge = badges[tab.id];
        const content = (
          <>
            {ICONS[tab.id]}
            {badge && badge > 0 ? (
              <i className="tb-badge" aria-hidden="true">
                {badge > 9 ? '9+' : badge}
              </i>
            ) : null}
            <span>{tab.label}</span>
          </>
        );
        return renderAs === 'button' ? (
          <button
            key={tab.id}
            type="button"
            className={isActive ? 'on' : ''}
            aria-label={tab.id === 'communaute' ? `${tab.label} (double-clic pour Freedom Reels)` : tab.label}
            aria-current={isActive ? 'page' : undefined}
            onClick={(e) => handleTabClick(tab.id, tab.href, e)}
          >
            {content}
          </button>
        ) : (
          <Link
            key={tab.id}
            href={tab.href}
            prefetch={false}
            onClick={(e) => {
              if (tab.id === 'communaute') {
                handleTabClick(tab.id, tab.href, e);
              }
            }}
          >
            {content}
          </Link>
        );
      })}
    </nav>
  );
}

export default AccountBottomBar;
