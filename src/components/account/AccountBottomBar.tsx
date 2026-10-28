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
            aria-label={tab.label}
            aria-current={isActive ? 'page' : undefined}
            onClick={() => router.push(tab.href)}
          >
            {content}
          </button>
        ) : (
          <Link key={tab.id} href={tab.href} prefetch={false}>
            {content}
          </Link>
        );
      })}
    </nav>
  );
}

export default AccountBottomBar;
