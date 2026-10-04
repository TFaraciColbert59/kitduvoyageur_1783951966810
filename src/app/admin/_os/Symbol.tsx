/**
 * Symbol — jeu d'icônes Admin OS (24 glyphes repris du design MagicPath,
 * style SF : stroke 1.8, round) + `lock` (extension LKDV pour Sécurité).
 */
import type { ReactNode } from 'react';

export type IconName =
  | 'home'
  | 'users'
  | 'community'
  | 'compass'
  | 'backpack'
  | 'bag'
  | 'shield'
  | 'support'
  | 'chart'
  | 'system'
  | 'search'
  | 'sun'
  | 'bell'
  | 'sidebar'
  | 'sparkles'
  | 'report'
  | 'chevron'
  | 'close'
  | 'check'
  | 'warning'
  | 'pulse'
  | 'clock'
  | 'eye'
  | 'bolt'
  | 'lock';

export function Symbol({ name, size = 17 }: { name: IconName; size?: number }) {
  const c = {
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.8,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  };
  const p: Record<IconName, ReactNode> = {
    home: (
      <>
        <path {...c} d="M3.5 10.5 12 3l8.5 7.5" />
        <path {...c} d="M6.5 9.3V21h11V9.3" />
        <path {...c} d="M10 21v-6h4v6" />
      </>
    ),
    users: (
      <>
        <circle {...c} cx="9" cy="8" r="3.2" />
        <circle {...c} cx="17.5" cy="9.5" r="2.5" />
        <path {...c} d="M3.8 20c.5-4 2.4-6 5.2-6s4.7 2 5.2 6" />
        <path {...c} d="M14.2 15c2.8-.8 5.2 1 5.8 4.5" />
      </>
    ),
    community: (
      <>
        <circle {...c} cx="12" cy="12" r="8.5" />
        <path {...c} d="M7 13.5c1.3 1.6 2.9 2.4 5 2.4s3.7-.8 5-2.4" />
        <path {...c} d="M8.5 9.5h.01M15.5 9.5h.01" />
      </>
    ),
    compass: (
      <>
        <circle {...c} cx="12" cy="12" r="9" />
        <path {...c} d="m15.5 8.5-2.1 4.9-4.9 2.1 2.1-4.9 4.9-2.1Z" />
      </>
    ),
    backpack: (
      <>
        <path {...c} d="M7.5 8V6.5a4.5 4.5 0 0 1 9 0V8" />
        <rect {...c} x="5" y="7.5" width="14" height="13" rx="4" />
        <path {...c} d="M8 12h8M9 16h6" />
      </>
    ),
    bag: (
      <>
        <path {...c} d="M6 9h12l1 11H5L6 9Z" />
        <path {...c} d="M9 9V7a3 3 0 0 1 6 0v2" />
      </>
    ),
    shield: (
      <>
        <path {...c} d="M12 3 19 6v5.2c0 4.3-2.7 7.6-7 9.8-4.3-2.2-7-5.5-7-9.8V6l7-3Z" />
        <path {...c} d="m9 12 2 2 4-4" />
      </>
    ),
    support: (
      <>
        <path {...c} d="M4 12a8 8 0 0 1 16 0" />
        <path {...c} d="M4 12v4a2 2 0 0 0 2 2h2v-6H4Zm16 0v4a2 2 0 0 1-2 2h-2v-6h4Z" />
        <path {...c} d="M16 20h-3" />
      </>
    ),
    chart: <path {...c} d="M4 20V10M10 20V5M16 20v-7M22 20V8" />,
    system: (
      <>
        <circle {...c} cx="12" cy="12" r="3" />
        <path {...c} d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9 7 7M17 17l2.1 2.1M19.1 4.9 17 7M7 17l-2.1 2.1" />
      </>
    ),
    search: (
      <>
        <circle {...c} cx="10.5" cy="10.5" r="6.5" />
        <path {...c} d="m15.5 15.5 5 5" />
      </>
    ),
    sun: (
      <>
        <circle {...c} cx="12" cy="12" r="3.5" />
        <path {...c} d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9 7 7M17 17l2.1 2.1M19.1 4.9 17 7M7 17l-2.1 2.1" />
      </>
    ),
    bell: (
      <>
        <path {...c} d="M6.5 10a5.5 5.5 0 0 1 11 0v4l1.5 3H5l1.5-3v-4Z" />
        <path {...c} d="M10 20h4" />
      </>
    ),
    sidebar: (
      <>
        <rect {...c} x="3" y="4" width="18" height="16" rx="3" />
        <path {...c} d="M8 4v16" />
      </>
    ),
    sparkles: (
      <>
        <path {...c} d="m12 3 1.2 3.2L16.5 7.5l-3.3 1.3L12 12l-1.2-3.2-3.3-1.3 3.3-1.3L12 3Z" />
        <path {...c} d="m18.5 13 .8 2.1 2.2.9-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.9.8-2.1Z" />
      </>
    ),
    report: (
      <>
        <path {...c} d="M5 20V8h14v12H5Z" />
        <path {...c} d="M8 5h8M9 12h6M9 16h4" />
      </>
    ),
    chevron: <path {...c} d="m9 5 7 7-7 7" />,
    close: <path {...c} d="m6 6 12 12M18 6 6 18" />,
    check: <path {...c} d="m5 12 4 4L19 6" />,
    warning: (
      <>
        <path {...c} d="m12 3 9 17H3l9-17Z" />
        <path {...c} d="M12 9v5M12 17.2h.01" />
      </>
    ),
    pulse: <path {...c} d="M3 12h4l2-5 4 10 2-5h6" />,
    clock: (
      <>
        <circle {...c} cx="12" cy="12" r="9" />
        <path {...c} d="M12 7v5l3 2" />
      </>
    ),
    eye: (
      <>
        <path {...c} d="M2.5 12s3.3-6 9.5-6 9.5 6 9.5 6-3.3 6-9.5 6-9.5-6-9.5-6Z" />
        <circle {...c} cx="12" cy="12" r="2.5" />
      </>
    ),
    bolt: <path {...c} d="m13 2-7 12h6l-1 8 7-12h-6l1-8Z" />,
    lock: (
      <>
        <rect {...c} x="5" y="11" width="14" height="9" rx="2.5" />
        <path {...c} d="M8 11V8a4 4 0 0 1 8 0v3" />
        <path {...c} d="M12 15v2.2h.01" />
      </>
    ),
  };  return (
    <svg className="sf-symbol" width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      {p[name]}
    </svg>
  );
}

export const ICON_NAMES: IconName[] = [
  'home', 'users', 'community', 'compass', 'backpack', 'bag', 'shield',
  'support', 'chart', 'system', 'search', 'sun', 'bell', 'sidebar',
  'sparkles', 'report', 'chevron', 'close', 'check', 'warning', 'pulse',
  'clock', 'eye', 'bolt', 'lock',
];
