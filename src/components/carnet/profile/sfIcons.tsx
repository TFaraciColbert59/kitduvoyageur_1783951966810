'use client';

import React from 'react';

export type SfIconName = 'heart' | 'heart-fill' | 'bubble' | 'bookmark' | 'bookmark-fill' | 'pencil' | 'ellipsis' | 'grid' | 'map';

/**
 * Icônes de la famille Apple (SF Symbols) / Instagram : tracé 1,7 px, bouts
 * arrondis, proportions 24 × 24. Elles remplacent les icônes génériques du
 * sélecteur pour coller à la grammaire du Compte.
 */
export function SfIcon({ name, size = 17 }: { name: SfIconName; size?: number }) {
  const common = {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.7,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true as const,
    focusable: 'false' as const,
  };

  switch (name) {
    case 'heart':
      return (
        <svg {...common}>
          <path d="M12 20.1s-7.4-4.4-7.4-9.3a4.2 4.2 0 0 1 7.4-2.7 4.2 4.2 0 0 1 7.4 2.7c0 4.9-7.4 9.3-7.4 9.3Z" />
        </svg>
      );
    case 'heart-fill':
      return (
        <svg {...common} fill="currentColor" stroke="none">
          <path d="M12 20.6s-7.9-4.7-7.9-9.8a4.6 4.6 0 0 1 7.9-3 4.6 4.6 0 0 1 7.9 3c0 5.1-7.9 9.8-7.9 9.8Z" />
        </svg>
      );
    case 'bubble':
      return (
        <svg {...common}>
          <path d="M20.5 11.6c0 3.9-3.8 7-8.5 7a9.7 9.7 0 0 1-2.6-.3L4.5 20l1.2-3.4a6.6 6.6 0 0 1-2.2-4.9c0-3.9 3.8-7 8.5-7s8.5 3.1 8.5 7Z" />
        </svg>
      );
    case 'bookmark':
      return (
        <svg {...common}>
          <path d="M6.5 4.8h11a1 1 0 0 1 1 1v14.4l-6.5-4-6.5 4V5.8a1 1 0 0 1 1-1Z" />
        </svg>
      );
    case 'bookmark-fill':
      return (
        <svg {...common} fill="currentColor" stroke="none">
          <path d="M6.5 4.3h11a1.4 1.4 0 0 1 1.4 1.4v15.1l-6.9-4.3-6.9 4.3V5.7a1.4 1.4 0 0 1 1.4-1.4Z" />
        </svg>
      );
    case 'pencil':
      return (
        <svg {...common}>
          <path d="M4.6 19.4 5.4 15 15.9 4.6a2 2 0 0 1 2.8 0l.7.7a2 2 0 0 1 0 2.8L9 18.6l-4.4.8Z" />
          <path d="M14.3 6.2 17.8 9.7" />
        </svg>
      );
    case 'ellipsis':
      return (
        <svg {...common} fill="currentColor" stroke="none">
          <circle cx="5.5" cy="12" r="1.55" />
          <circle cx="12" cy="12" r="1.55" />
          <circle cx="18.5" cy="12" r="1.55" />
        </svg>
      );
    case 'grid':
      return (
        <svg {...common} strokeWidth={1.9}>
          <rect x="4" y="4" width="6.4" height="6.4" rx="1.6" />
          <rect x="13.6" y="4" width="6.4" height="6.4" rx="1.6" />
          <rect x="4" y="13.6" width="6.4" height="6.4" rx="1.6" />
          <rect x="13.6" y="13.6" width="6.4" height="6.4" rx="1.6" />
        </svg>
      );
    case 'map':
      return (
        <svg {...common}>
          <path d="M9 4.6 4.4 6.5v13l4.6-1.9 6 1.9 4.6-1.9v-13L15 6.5 9 4.6Z" />
          <path d="M9 4.6v13M15 6.5v13" />
        </svg>
      );
    default:
      return null;
  }
}

export default SfIcon;
