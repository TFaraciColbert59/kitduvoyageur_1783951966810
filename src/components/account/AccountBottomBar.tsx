'use client';

import React from 'react';
import Link from 'next/link';

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
      <path d="M4 5h11a1 1 0 0 1 1 1v7a1 1 0 0 1-1 1H9l-4 3v-3H4a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1Z" />
    </svg>
  ),
  compte: (
    <svg className="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM4 20c.8-3.8 3.8-6 8-6s7.2 2.2 8 6" />
    </svg>
  ),
};

const ACCOUNT_TABS = [
  { id: 'explorer', label: 'Explorer', href: '/explorer' },
  { id: 'compas', label: 'Compas', href: '/compas' },
  { id: 'materiel', label: 'Matériel', href: '/materiel' },
  { id: 'hub', label: 'Hub', href: '/hub' },
  { id: 'compte', label: 'Compte', href: '/compte' },
] as const;

/**
 * Barre basse de la page Compte, à l'identique : 48 px, 5 cellules, lentille
 * 40 px, labels 600 10 px. Sur `/communaute`, aucun onglet n'est actif : la
 * lentille est masquée.
 */
export function AccountBottomBar() {
  return (
    <nav className="tb" aria-label="Navigation principale">
      <span className="lens" aria-hidden="true" style={{ opacity: 0 }} />
      {ACCOUNT_TABS.map((tab) => (
        <Link key={tab.id} href={tab.href}>
          {ICONS[tab.id]}
          <span>{tab.label}</span>
        </Link>
      ))}
    </nav>
  );
}

export default AccountBottomBar;
