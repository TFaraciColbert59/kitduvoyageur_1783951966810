'use client';

import React from 'react';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';

const ICONS: Record<string, React.ReactNode> = {
  explorer: (
    <svg className="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18ZM3.5 9h17M3.5 15h17M12 3c2.5 2.6 3.6 5.6 3.6 9s-1.1 6.4-3.6 9c-2.5-2.6-3.6-5.6-3.6-9S9.5 5.6 12 3Z" />
    </svg>
  ),
  compas: (
    <svg className="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18ZM15.5 8.5l-2.2 4.8-4.8 2.2 2.2-4.8 4.8-2.2Z" />
    </svg>
  ),
  materiel: (
    <svg className="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M5 8h14l-1 12H6L5 8ZM9 8a3 3 0 0 1 6 0" />
    </svg>
  ),
  hub: (
    <svg className="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-5v-6H10v6H5a1 1 0 0 1-1-1v-9.5Z" />
    </svg>
  ),
  communaute: (
    <svg className="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M9 11.2a3.2 3.2 0 1 0 0-6.4 3.2 3.2 0 0 0 0 6.4ZM3 19.5c.6-3.3 3-5.3 6-5.3s5.4 2 6 5.3M16.5 11a2.6 2.6 0 1 0 0-5.2M17 14.4c2.1.4 3.5 2.2 4 4.6" />
    </svg>
  ),
  messages: (
    <svg className="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M21 12a8 8 0 0 1-8 8H8l-5 3 1.4-4.6A8 8 0 1 1 21 12Z" />
    </svg>
  ),
  compte: (
    <svg className="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM4 20c.8-3.8 3.8-6 8-6s7.2 2.2 8 6" />
    </svg>
  ),
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
