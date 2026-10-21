'use client';

import React from 'react';
import type { SlotId } from './SlotShell';

const iconProps = {
  viewBox: '0 0 24 24',
  'aria-hidden': true,
  focusable: 'false',
} as const;

/**
 * Icônes uniques des 5 slots, partagées par le sélecteur `.ig-tabs` et
 * l'en-tête de la coquille. Une seule source pour éviter deux tracés
 * divergents ; la taille est pilotée par la CSS locale.
 */
export const SLOT_ICONS: Record<SlotId, React.ReactNode> = {
  vitrine: (
    <svg {...iconProps}>
      <path d="M4 10v10h16V10M3 10l1.6-5h14.8L21 10M3 10a3 3 0 0 0 6 0 3 3 0 0 0 6 0 3 3 0 0 0 6 0" />
      <path d="M9 20v-6h6v6" />
    </svg>
  ),
  kit: (
    <svg {...iconProps}>
      <path d="M9 6.5V5a3 3 0 0 1 6 0v1.5" />
      <path d="M6 10.5a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4V19a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2v-8.5Z" />
      <path d="M9.5 14h5v4h-5z" />
    </svg>
  ),
  prets: (
    <svg {...iconProps}>
      <path d="M4 8h13l3 5v5H4V8Z" />
      <path d="M4 13h16M8 18a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3ZM16 18a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Z" />
    </svg>
  ),
  souvenirs: (
    <svg {...iconProps}>
      <rect x="3" y="5" width="18" height="15" rx="2.5" />
      <circle cx="8.5" cy="10" r="1.6" />
      <path d="m4 18 5-5 4 4 3-3 4 4" />
    </svg>
  ),
  communaute: (
    <svg {...iconProps}>
      <path d="M9 11.2a3.2 3.2 0 1 0 0-6.4 3.2 3.2 0 0 0 0 6.4ZM3 19.5c.6-3.3 3-5.3 6-5.3s5.4 2 6 5.3M16.5 11a2.6 2.6 0 1 0 0-5.2M17 14.4c2.2.3 3.6 2 4 5" />
    </svg>
  ),
};
