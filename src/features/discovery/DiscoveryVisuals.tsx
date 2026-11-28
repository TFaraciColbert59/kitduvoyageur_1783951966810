'use client';

import React from 'react';
import type { DiscoveryVisualKind } from './catalog';

/**
 * Mini-scènes SVG animées (44×44 px) pour l'îlot de découverte LKDV.
 * Palette pure vert forêt LKDV (#17402C, #226148, #D3EBD9, #FBFAF6),
 * 0 dépendance externe, 60 FPS GPU, respect de `prefers-reduced-motion`.
 */
export function DiscoveryVisual({ kind }: { kind: DiscoveryVisualKind }) {
  return (
    <div className="lkdv-discover-visual" aria-hidden="true">
      {renderVisualSvg(kind)}
    </div>
  );
}

function renderVisualSvg(kind: DiscoveryVisualKind): React.ReactNode {
  switch (kind) {
    case 'route-draw':
      return (
        <svg viewBox="0 0 44 44" width="44" height="44" fill="none">
          <path
            d="M8 32C13 28 15 18 22 20C28 22 30 13 36 11"
            stroke="#D3EBD9"
            strokeWidth="3"
            strokeLinecap="round"
          />
          <path
            className="lkdv-dv-stroke-draw"
            d="M8 32C13 28 15 18 22 20C28 22 30 13 36 11"
            stroke="#17402C"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeDasharray="46"
            strokeDashoffset="46"
          />
          <circle cx="8" cy="32" r="3" fill="#226148" />
          <circle className="lkdv-dv-pop" cx="36" cy="11" r="3.4" fill="#17402C" />
          <circle className="lkdv-dv-ring" cx="36" cy="11" r="6" stroke="#226148" strokeWidth="1.4" />
        </svg>
      );

    case 'gps-pulse':
      return (
        <svg viewBox="0 0 44 44" width="44" height="44" fill="none">
          <circle className="lkdv-dv-radar-1" cx="22" cy="22" r="14" stroke="#226148" strokeWidth="1.5" />
          <circle className="lkdv-dv-radar-2" cx="22" cy="22" r="9" stroke="#226148" strokeWidth="1.5" />
          <circle cx="22" cy="22" r="5.5" fill="#17402C" />
          <path d="M20.5 19.3L25.5 22L20.5 24.7V19.3Z" fill="#FBFAF6" />
        </svg>
      );

    case 'map-layers':
      return (
        <svg viewBox="0 0 44 44" width="44" height="44" fill="none">
          <path
            className="lkdv-dv-layer-3"
            d="M22 25L35 19L22 13L9 19L22 25Z"
            fill="#D3EBD9"
            stroke="#226148"
            strokeWidth="1.5"
            strokeLinejoin="round"
          />
          <path
            className="lkdv-dv-layer-2"
            d="M9 24L22 30L35 24"
            stroke="#226148"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            className="lkdv-dv-layer-1"
            d="M9 29L22 35L35 29"
            stroke="#17402C"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      );

    case 'bookmark-gpx':
      return (
        <svg viewBox="0 0 44 44" width="44" height="44" fill="none">
          <path
            d="M14 10.5C14 9.67 14.67 9 15.5 9H28.5C29.33 9 30 9.67 30 10.5V34L22 28.8L14 34V10.5Z"
            fill="#D3EBD9"
            stroke="#17402C"
            strokeWidth="2"
            strokeLinejoin="round"
          />
          <path
            className="lkdv-dv-stroke-draw"
            d="M17.5 21L20.5 18L23 20.5L26.5 16"
            stroke="#226148"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeDasharray="24"
            strokeDashoffset="24"
          />
        </svg>
      );

    case 'create-plus':
      return (
        <svg viewBox="0 0 44 44" width="44" height="44" fill="none">
          <circle className="lkdv-dv-ring" cx="22" cy="22" r="14" stroke="#226148" strokeWidth="1.5" />
          <circle cx="22" cy="22" r="10" fill="#17402C" />
          <path
            className="lkdv-dv-spin-soft"
            d="M22 17V27M17 22H27"
            stroke="#FBFAF6"
            strokeWidth="2.3"
            strokeLinecap="round"
          />
        </svg>
      );

    case 'stories-swipe':
      return (
        <svg viewBox="0 0 44 44" width="44" height="44" fill="none">
          <rect x="8" y="13" width="14" height="18" rx="4" fill="#D3EBD9" stroke="#226148" strokeWidth="1.5" />
          <rect
            className="lkdv-dv-slide-x"
            x="18"
            y="11"
            width="16"
            height="22"
            rx="4.5"
            fill="#FBFAF6"
            stroke="#17402C"
            strokeWidth="2"
          />
          <path d="M22 19H30M22 24H27" stroke="#226148" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      );

    case 'reels-doubletap':
      return (
        <svg viewBox="0 0 44 44" width="44" height="44" fill="none">
          <circle className="lkdv-dv-radar-1" cx="22" cy="22" r="14" stroke="#226148" strokeWidth="1.6" />
          <circle className="lkdv-dv-radar-2" cx="22" cy="22" r="9.5" stroke="#17402C" strokeWidth="1.6" />
          <path d="M19.5 17.5L27 22L19.5 26.5V17.5Z" fill="#17402C" />
        </svg>
      );

    case 'hub-hold':
      return (
        <svg viewBox="0 0 44 44" width="44" height="44" fill="none">
          <circle cx="22" cy="22" r="13" stroke="#D3EBD9" strokeWidth="2.5" />
          <circle
            className="lkdv-dv-hold-ring"
            cx="22"
            cy="22"
            r="13"
            stroke="#17402C"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeDasharray="82"
            strokeDashoffset="82"
            transform="rotate(-90 22 22)"
          />
          <circle cx="22" cy="22" r="4.5" fill="#226148" />
        </svg>
      );

    case 'carnet-log':
      return (
        <svg viewBox="0 0 44 44" width="44" height="44" fill="none">
          <rect x="11" y="10" width="22" height="24" rx="4.5" fill="#D3EBD9" stroke="#17402C" strokeWidth="1.8" />
          <path d="M16 17H28M16 22H25M16 27H22" stroke="#17402C" strokeWidth="1.8" strokeLinecap="round" />
          <circle className="lkdv-dv-pop" cx="31" cy="13" r="4.5" fill="#226148" />
          <path d="M31 11V15M29 13H33" stroke="#FBFAF6" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
      );

    case 'messages-share':
      return (
        <svg viewBox="0 0 44 44" width="44" height="44" fill="none">
          <path
            className="lkdv-dv-slide-x"
            d="M11 22L33 12L26 33L21.5 24.5L11 22Z"
            fill="#D3EBD9"
            stroke="#17402C"
            strokeWidth="1.9"
            strokeLinejoin="round"
          />
        </svg>
      );

    case 'kit-pack':
      return (
        <svg viewBox="0 0 44 44" width="44" height="44" fill="none">
          <path
            d="M17 13V11.5C17 10.12 18.12 9 19.5 9H24.5C25.88 9 27 10.12 27 11.5V13"
            stroke="#17402C"
            strokeWidth="2"
            strokeLinecap="round"
          />
          <rect x="12" y="13" width="20" height="21" rx="6" fill="#D3EBD9" stroke="#17402C" strokeWidth="1.9" />
          <path
            className="lkdv-dv-stroke-draw"
            d="M17.5 23.5L20.8 26.8L27 20"
            stroke="#17402C"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeDasharray="24"
            strokeDashoffset="24"
          />
        </svg>
      );

    case 'compte-gear':
      return (
        <svg viewBox="0 0 44 44" width="44" height="44" fill="none">
          <circle cx="22" cy="22" r="13" stroke="#D3EBD9" strokeWidth="2.4" />
          <path
            className="lkdv-dv-stroke-draw"
            d="M12 23H16.5L19.5 16L24 28L27 21H32"
            stroke="#17402C"
            strokeWidth="2.1"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeDasharray="44"
            strokeDashoffset="44"
          />
        </svg>
      );

    case 'club-pulse':
      return (
        <svg viewBox="0 0 44 44" width="44" height="44" fill="none">
          <path d="M13 27L22 14L31 27H13Z" stroke="#226148" strokeWidth="1.6" strokeLinejoin="round" />
          <circle className="lkdv-dv-pop" cx="22" cy="14" r="3.5" fill="#17402C" />
          <circle cx="13" cy="27" r="3" fill="#226148" />
          <circle cx="31" cy="27" r="3" fill="#226148" />
        </svg>
      );

    case 'drawer-drag':
      return (
        <svg viewBox="0 0 44 44" width="44" height="44" fill="none">
          <rect
            x="9"
            y="18"
            width="26"
            height="17"
            rx="6"
            fill="#D3EBD9"
            stroke="#17402C"
            strokeWidth="1.8"
          />
          <rect
            className="lkdv-dv-layer-3"
            x="16.5"
            y="22"
            width="11"
            height="2.8"
            rx="1.4"
            fill="#17402C"
          />
          <path
            className="lkdv-dv-layer-2"
            d="M18.5 13.5L22 10L25.5 13.5"
            stroke="#226148"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      );

    case 'drawer-tabs':
      return (
        <svg viewBox="0 0 44 44" width="44" height="44" fill="none">
          <rect
            x="7"
            y="16"
            width="30"
            height="12"
            rx="6"
            fill="#D3EBD9"
            stroke="#226148"
            strokeWidth="1.5"
          />
          <rect
            className="lkdv-dv-slide-x"
            x="9.5"
            y="18.5"
            width="11"
            height="7"
            rx="3.5"
            fill="#17402C"
          />
          <circle cx="25.5" cy="22" r="1.8" fill="#226148" />
          <circle cx="31.5" cy="22" r="1.8" fill="#226148" />
        </svg>
      );

    case 'drawer-lenses':
      return (
        <svg viewBox="0 0 44 44" width="44" height="44" fill="none">
          <rect
            x="9"
            y="11"
            width="26"
            height="15"
            rx="4.5"
            fill="#FBFAF6"
            stroke="#226148"
            strokeWidth="1.5"
          />
          <path
            className="lkdv-dv-slide-x"
            d="M15 18.5H27M24 15.5L27 18.5L24 21.5"
            stroke="#17402C"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <rect x="19" y="29" width="16" height="6" rx="3" fill="#17402C" />
          <circle cx="23.5" cy="32" r="1.3" fill="#D3EBD9" />
          <circle cx="27.5" cy="32" r="1.3" fill="#FBFAF6" />
          <circle cx="31.5" cy="32" r="1.3" fill="#D3EBD9" />
        </svg>
      );

    case 'drawer-filter':
      return (
        <svg viewBox="0 0 44 44" width="44" height="44" fill="none">
          <path d="M11 16H33M11 22H33M11 28H33" stroke="#226148" strokeWidth="1.8" strokeLinecap="round" />
          <circle className="lkdv-dv-slide-x" cx="17" cy="16" r="3" fill="#17402C" />
          <circle cx="26" cy="22" r="3" fill="#D3EBD9" stroke="#17402C" strokeWidth="1.8" />
          <circle className="lkdv-dv-slide-x" cx="19" cy="28" r="3" fill="#17402C" />
        </svg>
      );
  }
}
