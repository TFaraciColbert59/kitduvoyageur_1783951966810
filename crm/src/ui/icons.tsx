/**
 * Icônes sobres, SVG maison, inline. Aucune icône exotique, aucun emoji.
 * Décoratives par défaut (`aria-hidden`), le libellé porte le sens.
 */
import type { SVGProps } from 'react';

type IconProps = SVGProps<SVGSVGElement> & { size?: number };

function base({ size = 18, ...rest }: IconProps) {
  return {
    width: size,
    height: size,
    viewBox: '0 0 18 18',
    'aria-hidden': true as const,
    focusable: 'false' as const,
    ...rest
  };
}

export function IconSearch(props: IconProps) {
  return (
    <svg {...base(props)}>
      <circle cx="7.5" cy="7.5" r="5" fill="none" stroke="currentColor" strokeWidth="1.6" />
      <path d="M11.5 11.5l4 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

export function IconBell(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M4 13V8a5 5 0 0110 0v5l1.5 1.5h-13z" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M7.5 16h3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

export function IconChevronLeft(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M11 3L5 9l6 6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function IconChevronRight(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M7 3l6 6-6 6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function IconCheck(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M3.5 9.5l4 4 7-9" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function IconAlert(props: IconProps) {
  return (
    <svg {...base(props)}>
      <circle cx="9" cy="9" r="7.5" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <path d="M9 5v5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M9 12.5v.6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

export function IconClose(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M4 4l10 10M14 4L4 14" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}

export function IconClock(props: IconProps) {
  return (
    <svg {...base(props)}>
      <circle cx="9" cy="9" r="7" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <path d="M9 5v4.2l3 1.8" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

export function IconPlay(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M6 4l8 5-8 5z" fill="currentColor" />
    </svg>
  );
}

export function IconStop(props: IconProps) {
  return (
    <svg {...base(props)}>
      <rect x="5" y="5" width="8" height="8" rx="1.5" fill="currentColor" />
    </svg>
  );
}

export function IconRobot(props: IconProps) {
  return (
    <svg {...base(props)}>
      <rect x="2.5" y="4.5" width="13" height="10" rx="3.5" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="6.5" cy="9.5" r="1.1" fill="currentColor" />
      <circle cx="11.5" cy="9.5" r="1.1" fill="currentColor" />
      <path d="M9 1.8v2.7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

export function IconArrowRight(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M3 9h11M10 5l4 4-4 4" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function IconMenu(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M3 5h12M3 9h12M3 13h12" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}

export function IconRefresh(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M14.5 9a5.5 5.5 0 11-1.9-4.2" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M14.8 2.5v3.2h-3.2" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function IconLock(props: IconProps) {
  return (
    <svg {...base(props)}>
      <rect x="4" y="8" width="10" height="7" rx="2" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <path d="M6.5 8V6a2.5 2.5 0 015 0v2" fill="none" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

export function IconEye(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M1.8 9S4.5 4.5 9 4.5 16.2 9 16.2 9 13.5 13.5 9 13.5 1.8 9 1.8 9z" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="9" cy="9" r="2.2" fill="none" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

export function IconPhone(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M5 3.5h2.2l1.1 3-1.6 1.2a9 9 0 003.6 3.6l1.2-1.6 3 1.1V13a1.5 1.5 0 01-1.6 1.5C8.3 14 4 9.7 3.5 5.1A1.5 1.5 0 015 3.5z" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
    </svg>
  );
}

export function IconUser(props: IconProps) {
  return (
    <svg {...base(props)}>
      <circle cx="9" cy="6.5" r="3" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <path d="M3.5 15a5.5 5.5 0 0111 0" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

/** Logo LKDV Control : cercle forêt + aiguille d'acier. */
export function BrandMark({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 28 28" aria-hidden="true" focusable="false">
      <circle cx="14" cy="14" r="12.5" fill="var(--lkv-primary)" />
      <path d="M14 6l3 8-3 8-3-8z" fill="var(--lkv-action-soft)" />
    </svg>
  );
}
