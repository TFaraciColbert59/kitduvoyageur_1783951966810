import React from 'react';

/**
 * Icônes des lentilles du drawer Profil.
 *
 * Une icône par lentille (les lentilles sont affichées en icônes seules dans
 * la pilule du bas) ; toutes partagent le même vocabulaire de trait que les
 * icônes de slots : 24×24, contour 1.8, bouts arrondis.
 */
const stroke = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  vectorEffect: 'non-scaling-stroke' as const,
};

const svg = (children: React.ReactNode) => (
  <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" style={stroke}>
    {children}
  </svg>
);

export const LENS_ICONS: Record<string, React.ReactNode> = {
  stats: svg(
    <>
      <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />
    </>
  ),
  repost: svg(
    <>
      <path d="M17 2l4 4-4 4" />
      <path d="M3 11V9a3 3 0 0 1 3-3h15" />
      <path d="M7 22l-4-4 4-4" />
      <path d="M21 13v2a3 3 0 0 1-3 3H3" />
    </>
  ),
  badges: svg(
    <>
      <path d="M8 3h8v5a4 4 0 0 1-8 0V3Z" />
      <path d="M8 5H5v2a4 4 0 0 0 4 4M16 5h3v2a4 4 0 0 1-4 4" />
      <path d="M12 12v5M8 21h8M10 17h4v4h-4z" />
    </>
  ),
  kits: svg(
    <>
      <path d="M6 8h12l1 12H5L6 8Z" />
      <path d="M9 8V6a3 3 0 0 1 6 0v2M9 13h6" />
    </>
  ),
  inventory: svg(
    <>
      <rect x="3" y="3" width="7" height="7" rx="2" />
      <rect x="14" y="3" width="7" height="7" rx="2" />
      <rect x="3" y="14" width="7" height="7" rx="2" />
      <rect x="14" y="14" width="7" height="7" rx="2" />
    </>
  ),
  lender: svg(
    <>
      <path d="M12 3v12M7 8l5-5 5 5" />
      <path d="M4 14v6h16v-6" />
    </>
  ),
  borrower: svg(
    <>
      <path d="M12 21V9M7 16l5 5 5-5" />
      <path d="M4 10V4h16v6" />
    </>
  ),
  trust: svg(
    <>
      <path d="M12 3l7 3v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6l7-3Z" />
      <path d="M9 12l2 2 4-4" />
    </>
  ),
  timeline: svg(
    <>
      <path d="M4 7h10M4 12h16M4 17h7" />
      <circle cx="17" cy="7" r="2" />
      <circle cx="14" cy="17" r="2" />
    </>
  ),
  passport: svg(
    <>
      <rect x="4" y="3" width="16" height="18" rx="2" />
      <path d="M8 3v18M11 8h6M11 12h6M11 16h4" />
    </>
  ),
  souvenirs: svg(
    <>
      <rect x="3" y="4" width="18" height="16" rx="3" />
      <circle cx="9" cy="10" r="2" />
      <path d="M3 17l5-4 4 3 4-5 5 6" />
    </>
  ),
  challenges: svg(
    <>
      <path d="M6 21V4M6 4h10l-2 4 2 4H6" />
    </>
  ),
  clubs: svg(
    <>
      <circle cx="9" cy="8" r="3" />
      <circle cx="17" cy="9" r="2.5" />
      <path d="M3 20a6 6 0 0 1 12 0M14 20a5 5 0 0 1 7 0" />
    </>
  ),
  cordee: svg(
    <>
      <path d="M8 7a4 4 0 1 1 0 8 4 4 0 0 1 0-8ZM16 9a4 4 0 1 1 0 8 4 4 0 0 1 0-8Z" />
      <path d="M10.5 11.5l3 1" />
    </>
  ),
};
