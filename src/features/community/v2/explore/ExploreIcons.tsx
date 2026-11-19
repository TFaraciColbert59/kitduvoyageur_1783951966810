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
  | 'ticket'
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
  | 'snow'
  | 'feed'
  | 'quote'
  | 'user'
  | 'map'
  | 'pen'
  | 'camera'
  | 'backpack';

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
  heart: <path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z" />,
  'heart-filled': <path d="M12 20s-6.8-4.3-8.2-8A4.6 4.6 0 0 1 12 6.4 4.6 4.6 0 0 1 20.2 12C18.8 15.7 12 20 12 20z" fill="currentColor" />,
  comment: <path d="M7.9 20A9 9 0 1 0 4 16.1L2 22z" />,
  lock: (
    <>
      <rect x="5" y="11" width="14" height="9" rx="3" />
      <path d="M8 11V8a4 4 0 0 1 8 0v3" />
    </>
  ),
  plus: <path d="M12 5v14M5 12h14" />,
  check: <path d="M5 12.5l4.5 4.5L19 7.5" />,
  clock: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5V12l3 2" />
    </>
  ),
  shield: (
    <>
      <path d="M12 3l7 3v5c0 5-3 8-7 10-4-2-7-5-7-10V6z" />
      <path d="M9 12l2.2 2.2L15.5 10" />
    </>
  ),
  calendar: (
    <>
      <rect x="4" y="5.5" width="16" height="14.5" rx="3" />
      <path d="M4 10h16M8.5 3.5v4M15.5 3.5v4" />
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
      <circle cx="6" cy="18" r="2.5" />
      <circle cx="18" cy="6" r="2.5" />
      <path d="M8.5 18H15a3 3 0 0 0 0-6H9a3 3 0 0 1 0-6h6.5" />
    </>
  ),
  eye: (
    <>
      <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z" />
      <circle cx="12" cy="12" r="3" />
    </>
  ),
  bookmark: <path d="M7 4h10v17l-5-4-5 4z" />,
  /* Pictogrammes des six types de création (maquette `IC.pen / camera / backpack`, L1557-1591). */
  pen: (
    <>
      <path d="M4 20h4L19 9l-4-4L4 16z" />
      <path d="M13.5 6.5l4 4" />
    </>
  ),
  camera: (
    <>
      <path d="M4 8h3l1.5-2.5h7L17 8h3v11H4z" />
      <circle cx="12" cy="13" r="3.5" />
    </>
  ),
  backpack: (
    <>
      <path d="M8 6a4 4 0 0 1 8 0v1H8z" />
      <path d="M6 9a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2z" />
      <path d="M9 14h6v3H9z" />
    </>
  ),
  /* Billet de la maquette (`IC.ticket`, L1651) : lentille « Mes sorties ». */
  ticket: (
    <>
      <path d="M4 8a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v2a2 2 0 0 0 0 4v2a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-2a2 2 0 0 0 0-4z" />
      <path d="M14 6v12" strokeDasharray="2 2" />
    </>
  ),
  'bookmark-filled': <path d="M7 4h10v16l-5-3.5L7 20z" fill="currentColor" />,
  send: (
    <>
      <path d="M22 2 11 13" />
      <path d="M22 2l-7 20-4-9-9-4z" />
    </>
  ),
  close: <path d="M6 6l12 12M18 6L6 18" />,
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
      <circle cx="9" cy="8" r="3" />
      <path d="M3 20a6 6 0 0 1 12 0" />
      <circle cx="17" cy="9" r="2.5" />
      <path d="M15 14a5 5 0 0 1 6 6" />
    </>
  ),
  mountain: <path d="M3 19l6-10 4 6 2.5-4L21 19z" />,
  compass: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M15.5 8.5l-2 5-5 2 2-5z" />
    </>
  ),
  book: (
    <>
      <path d="M5 4h11a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3z" />
      <path d="M5 17a3 3 0 0 1 3-3h11" />
    </>
  ),
  doc: (
    <>
      <path d="M7 3h7l4 4v14H7z" />
      <path d="M14 3v4h4M10 12h5M10 16h5" />
    </>
  ),
  filter: <path d="M4 6h16M7 12h10M10 18h4" />,
  leaf: (
    <>
      <path d="M5 19c0-8 5-13 15-14 0 9-4 14-12 14" />
      <path d="M5 19c3-5 6-8 10-10" />
    </>
  ),
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
  feed: <path d="M4 5h16M4 10h10M4 15h16M4 20h10" />,
  quote: <path d="M7 7h4v5c0 3-1 4-4 5M15 7h4v5c0 3-1 4-4 5" />,
  user: (
    <>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21a8 8 0 0 1 16 0" />
    </>
  ),
  map: (
    <>
      <path d="M9 4L3 6v14l6-2 6 2 6-2V4l-6 2z" />
      <path d="M9 4v14M15 6v14" />
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
