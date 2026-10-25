import React from 'react';
import type { DestinationId } from '@/components/mobile-nav/destinationRegistry';

/**
 * Glyphes de la barre Liquid Glass — grammaire SF Symbols / Instagram 2024.
 *
 * - Inactif : trait 1.9 px, terminaisons rondes (équivalent `house`, `person.2`…).
 * - Actif : glyphe plein avec découpes réelles en `evenodd` (équivalent
 *   `house.fill`, `safari.fill`, `person.crop.circle.fill`) — les découpes
 *   laissent voir le verre, comme sur iOS.
 */
type IconPair = { outline: React.ReactNode; filled: React.ReactNode };

const stroke = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.9,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
};

export const LIQUID_TAB_ICONS: Record<DestinationId, IconPair> = {
  // Hub — maison Instagram (porte arrondie)
  adventures: {
    outline: (
      <svg className="lg-ic" viewBox="0 0 24 24" aria-hidden="true" {...stroke}>
        <path d="M3.5 10.4 12 3.6l8.5 6.8v8.8a1.8 1.8 0 0 1-1.8 1.8h-3.45v-5a2.25 2.25 0 0 0-4.5 0v5H5.3a1.8 1.8 0 0 1-1.8-1.8Z" />
      </svg>
    ),
    filled: (
      <svg className="lg-ic" viewBox="0 0 24 24" aria-hidden="true" fill="currentColor" fillRule="evenodd">
        <path d="M12 2.6c.3 0 .6.1.85.3l8.4 6.7c.48.38.75.95.75 1.56v8.04A2.8 2.8 0 0 1 19.2 22H4.8A2.8 2.8 0 0 1 2 19.2v-8.04c0-.61.27-1.18.75-1.56l8.4-6.7c.25-.2.55-.3.85-.3ZM9.9 22v-4.9a2.1 2.1 0 0 1 4.2 0V22Z" />
      </svg>
    ),
  },

  // Communauté — person.2
  community: {
    outline: (
      <svg className="lg-ic" viewBox="0 0 24 24" aria-hidden="true" {...stroke}>
        <circle cx="9" cy="8" r="3.6" />
        <path d="M2.6 20.2c.6-3.5 3.1-5.6 6.4-5.6s5.8 2.1 6.4 5.6" />
        <path d="M15.6 4.6a3.4 3.4 0 0 1 0 6.6" />
        <path d="M17.6 14.8c2.2.6 3.5 2.4 3.8 5.4" />
      </svg>
    ),
    filled: (
      <svg className="lg-ic" viewBox="0 0 24 24" aria-hidden="true" fill="currentColor">
        <circle cx="9" cy="7.9" r="4" />
        <path d="M2 20.3C2.6 16.2 5.4 13.8 9 13.8s6.4 2.4 7 6.5a.9.9 0 0 1-.9 1H2.9a.9.9 0 0 1-.9-1Z" />
        <circle cx="16.7" cy="8.4" r="3.2" opacity=".72" />
        <path opacity=".72" d="M17.4 13.9c2.8.3 4.7 2.5 5.1 5.9a1 1 0 0 1-1 1.1h-3.9a8.5 8.5 0 0 0-2.7-6.3 6 6 0 0 1 2.5-.7Z" />
      </svg>
    ),
  },

  // Explorer — safari / boussole
  explorer: {
    outline: (
      <svg className="lg-ic" viewBox="0 0 24 24" aria-hidden="true" {...stroke}>
        <circle cx="12" cy="12" r="9.2" />
        <path d="m15.9 8.1-2.4 5.4-5.4 2.4 2.4-5.4Z" />
      </svg>
    ),
    filled: (
      <svg className="lg-ic" viewBox="0 0 24 24" aria-hidden="true" fill="currentColor" fillRule="evenodd">
        <path d="M12 2a10 10 0 1 1 0 20 10 10 0 0 1 0-20Zm4.5 5.5-6.2 2.7-2.8 6.3 6.3-2.8Zm-4.5 3.2a1.3 1.3 0 1 0 0 2.6 1.3 1.3 0 0 0 0-2.6Z" />
      </svg>
    ),
  },

  // Messages — avion papier Instagram Direct
  messages: {
    outline: (
      <svg className="lg-ic" viewBox="0 0 24 24" aria-hidden="true" {...stroke}>
        <path d="M21.2 2.8 10.4 13.6" />
        <path d="M21.2 2.8 14.6 21a.4.4 0 0 1-.74.03L10.4 13.6 3 10.14a.4.4 0 0 1 .03-.74Z" />
      </svg>
    ),
    filled: (
      <svg className="lg-ic" viewBox="0 0 24 24" aria-hidden="true" fill="currentColor" fillRule="evenodd">
        <path d="M21.6 2.4c.3.3.4.7.25 1.1L15.3 21.4a1.1 1.1 0 0 1-2.04.08l-3.4-7.3-7.33-3.42a1.1 1.1 0 0 1 .08-2.03L20.5 2.15c.4-.15.8-.05 1.1.25ZM10.9 13.1l1 .1 7.4-7.4-.1-.1Z" />
      </svg>
    ),
  },

  // Compte — person.crop.circle
  me: {
    outline: (
      <svg className="lg-ic" viewBox="0 0 24 24" aria-hidden="true" {...stroke}>
        <circle cx="12" cy="12" r="9.2" />
        <circle cx="12" cy="9.6" r="3.3" />
        <path d="M6 18.3c1.4-2.2 3.5-3.4 6-3.4s4.6 1.2 6 3.4" />
      </svg>
    ),
    filled: (
      <svg className="lg-ic" viewBox="0 0 24 24" aria-hidden="true" fill="currentColor" fillRule="evenodd">
        <path d="M12 2a10 10 0 1 1 0 20 10 10 0 0 1 0-20Zm0 4.4a3.4 3.4 0 1 0 0 6.8 3.4 3.4 0 0 0 0-6.8Zm-6.1 12c1.6 1.9 3.8 2.9 6.1 2.9s4.5-1 6.1-2.9c-1.4-2.3-3.6-3.6-6.1-3.6s-4.7 1.3-6.1 3.6Z" />
      </svg>
    ),
  },
};
