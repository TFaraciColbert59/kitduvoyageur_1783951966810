import React from 'react';

/**
 * Jeu d'icônes local du tiroir Explorer (SVG stroke `currentColor`, tous
 * `aria-hidden` : le libellé est porté par le parent). Aucune couleur
 * littérale, aucune dépendance : le trait suit `color` via CSS.
 */

export type ExploreIconName =
  | 'search'
  | 'clear'
  | 'chevron-right'
  | 'chevron-left'
  | 'heart'
  | 'heart-filled'
  | 'comment'
  | 'lock'
  | 'plus'
  | 'check'
  | 'clock'
  | 'shield'
  | 'calendar'
  | 'map-pin'
  | 'route'
  | 'eye'
  | 'bookmark'
  | 'bookmark-filled'
  | 'send'
  | 'close'
  | 'cloud'
  | 'sparkles'
  | 'trend'
  | 'users'
  | 'mountain'
  | 'compass'
  | 'book'
  | 'doc'
  | 'filter'
  | 'leaf'
  | 'sun'
  | 'globe'
  | 'partly'
  | 'rain'
  | 'snow';

const PATHS: Record<ExploreIconName, React.ReactNode> = {
  globe: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18" />
    </>
  ),
  search: (
    <>
      <circle cx="11" cy="11" r="6.5" />
      <path d="M16 16l4.5 4.5" />
    </>
  ),
  clear: (
    <>
      <path d="M7 7l10 10M17 7L7 17" />
    </>
  ),
  'chevron-right': <path d="M9 5l7 7-7 7" />,
  'chevron-left': <path d="M15 5l-7 7 7 7" />,
  heart: <path d="M12 20s-6.8-4.3-8.2-8A4.6 4.6 0 0 1 12 6.4 4.6 4.6 0 0 1 20.2 12C18.8 15.7 12 20 12 20z" />,
  'heart-filled': <path d="M12 20s-6.8-4.3-8.2-8A4.6 4.6 0 0 1 12 6.4 4.6 4.6 0 0 1 20.2 12C18.8 15.7 12 20 12 20z" fill="currentColor" />,
  comment: <path d="M20 11.5a7.5 7.5 0 0 1-11 6.7L4 20l1.8-4.6A7.5 7.5 0 1 1 20 11.5z" />,
  lock: (
    <>
      <rect x="5.5" y="10.5" width="13" height="9" rx="2.4" />
      <path d="M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5" />
    </>
  ),
  plus: <path d="M12 5v14M5 12h14" />,
  check: <path d="M5 12.5l4.5 4.5L19 7.5" />,
  clock: (
    <>
      <circle cx="12" cy="12" r="7.5" />
      <path d="M12 8v4.3l2.6 1.6" />
    </>
  ),
  shield: (
    <>
      <path d="M12 3.5l6.5 2.4v5c0 4.4-3 7.3-6.5 9.1-3.5-1.8-6.5-4.7-6.5-9.1v-5z" />
      <path d="M9 12l2.2 2.2L15.5 10" />
    </>
  ),
  calendar: (
    <>
      <rect x="4" y="6" width="16" height="14" rx="2.6" />
      <path d="M4 10h16M8.5 4v4M15.5 4v4" />
    </>
  ),
  'map-pin': (
    <>
      <path d="M12 21s-6.5-6-6.5-11a6.5 6.5 0 0 1 13 0c0 5-6.5 11-6.5 11z" />
      <circle cx="12" cy="10" r="2.3" />
    </>
  ),
  route: (
    <>
      <circle cx="6" cy="6" r="2" />
      <circle cx="18" cy="18" r="2" />
      <path d="M8 6h6a4 4 0 0 1 0 8H9a4 4 0 0 0 0 8h7" />
    </>
  ),
  eye: (
    <>
      <path d="M2.5 12S6 5.8 12 5.8 21.5 12 21.5 12 18 18.2 12 18.2 2.5 12 2.5 12z" />
      <circle cx="12" cy="12" r="2.8" />
    </>
  ),
  bookmark: <path d="M7 4h10v16l-5-3.5L7 20z" />,
  'bookmark-filled': <path d="M7 4h10v16l-5-3.5L7 20z" fill="currentColor" />,
  send: <path d="M21 4L3.8 11.2l7.3 2.3 2.3 7.3z" />,
  close: <path d="M7 7l10 10M17 7L7 17" />,
  cloud: <path d="M7.5 18.5a4.5 4.5 0 0 1-.6-8.95A5.8 5.8 0 0 1 18 10.4a4.05 4.05 0 0 1-.4 8.1z" />,
  sparkles: (
    <>
      <path d="M12 4l1.4 3.6L17 9l-3.6 1.4L12 14l-1.4-3.6L7 9l3.6-1.4z" />
      <path d="M18.5 14.5l.8 2 2 .8-2 .8-.8 2-.8-2-2-.8 2-.8z" />
    </>
  ),
  // Tendance de la maquette (`maquette-communaute.html` L1574, `ic('trend')`) :
  // une seule flèche montante, commune aux lieux et aux termes.
  trend: (
    <>
      <path d="M3 17l6-6 4 4 8-8" />
      <path d="M15 7h6v6" />
    </>
  ),
  users: (
    <>
      <circle cx="9" cy="9" r="3.2" />
      <path d="M3.5 19a5.6 5.6 0 0 1 11 0M16 6.6a3.2 3.2 0 0 1 0 6M17.5 14.3a5.7 5.7 0 0 1 3 4.7" />
    </>
  ),
  mountain: <path d="M3 19.5L9.5 7l4 7.5 2-3 5.5 8z" />,
  compass: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M15.5 8.5l-2 5-5 2 2-5z" />
    </>
  ),
  book: (
    <>
      <path d="M4.5 5.5A2.5 2.5 0 0 1 7 3h12.5v16.5H7a2.5 2.5 0 0 0-2.5 2.5z" />
      <path d="M4.5 5.5v16.5" />
    </>
  ),
  doc: (
    <>
      <path d="M7 3h7l4 4v14H7z" />
      <path d="M14 3v4h4M10 12h5M10 16h5" />
    </>
  ),
  filter: <path d="M4 6h16M7 12h10M10 18h4" />,
  leaf: <path d="M5 19C5 9 13 4 20 4c0 9-5 15-15 15zM5 19l7-7" />,
  // Météo (FID-071) : mêmes familles que la maquette (`WXS`, L1071/L2466).
  sun: (
    <>
      <circle cx="12" cy="12" r="3.6" />
      <path d="M12 3v2.2M12 18.8V21M3 12h2.2M18.8 12H21M5.6 5.6l1.6 1.6M16.8 16.8l1.6 1.6M18.4 5.6l-1.6 1.6M7.2 16.8l-1.6 1.6" />
    </>
  ),
  partly: (
    <>
      <circle cx="8.5" cy="8.5" r="3" />
      <path d="M8.5 3.5v1.4M3.5 8.5h1.4M4.7 4.7l1 1" />
      <path d="M10 19.5a3.8 3.8 0 0 1-.5-7.55A4.9 4.9 0 0 1 19.1 13a3.4 3.4 0 0 1-.35 6.85z" />
    </>
  ),
  rain: (
    <>
      <path d="M7.5 15.5a4.2 4.2 0 0 1-.55-8.35A5.4 5.4 0 0 1 17.3 8.3a3.8 3.8 0 0 1-.35 7.6z" />
      <path d="M8.5 18.4l-.9 2M12.4 18.4l-.9 2M16.3 18.4l-.9 2" />
    </>
  ),
  snow: (
    <>
      <path d="M7.5 14.5a4.2 4.2 0 0 1-.55-8.35A5.4 5.4 0 0 1 17.3 7.3a3.8 3.8 0 0 1-.35 7.6z" />
      <path d="M9 18v3M7.7 18.75h2.6M7.7 20.25h2.6M15 18v3M13.7 18.75h2.6M13.7 20.25h2.6" />
    </>
  ),
};

export interface ExploreIconProps {
  name: ExploreIconName;
  size?: number;
  className?: string;
}

export function ExploreIcon({ name, size = 18, className }: ExploreIconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      className={className}
    >
      {PATHS[name]}
    </svg>
  );
}

export default ExploreIcon;
