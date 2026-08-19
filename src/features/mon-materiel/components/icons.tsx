/**
 * LKDV — Mon Matériel : icônes SVG monochromes (stroke, inline).
 * Remplace tous les emojis des interfaces du cockpit. Une seule source :
 * chaque icône accepte `size` et `className`.
 */

import React from 'react';

export interface CockpitIconProps {
  size?: number;
  className?: string;
  strokeWidth?: number;
}

function base(
  children: React.ReactNode,
  { size = 16, className = '', strokeWidth = 1.8 }: CockpitIconProps
): React.ReactElement {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      className={className}
    >
      {children}
    </svg>
  );
}

export function IconChecklist(p: CockpitIconProps) {
  return base(<><path d="M9 6h11M9 12h11M9 18h11" /><path d="M3.5 5l1 1 2-2M3.5 11l1 1 2-2M3.5 17l1 1 2-2" /></>, p);
}

export function IconBell(p: CockpitIconProps) {
  return base(<><path d="M18 8a6 6 0 1 0-12 0c0 7-3 8-3 8h18s-3-1-3-8" /><path d="M13.7 21a2 2 0 0 1-3.4 0" /></>, p);
}

export function IconBackpack(p: CockpitIconProps) {
  return base(<><path d="M6 9a6 6 0 0 1 12 0v11a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V9Z" /><path d="M9 6a3 3 0 0 1 6 0M8 14h8M8 18h8" /></>, p);
}

export function IconNav(p: CockpitIconProps) {
  return base(<><circle cx="12" cy="12" r="9" /><path d="M15.5 8.5l-2 5-5 2 2-5 5-2Z" /></>, p);
}

export function IconBox(p: CockpitIconProps) {
  return base(<><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z" /><path d="M3.3 7l8.7 5 8.7-5M12 22V12" /></>, p);
}

export function IconCalendar(p: CockpitIconProps) {
  return base(<><rect x="3" y="4" width="18" height="17" rx="2" /><path d="M8 2v4M16 2v4M3 9h18" /></>, p);
}

export function IconMaximize(p: CockpitIconProps) {
  return base(<><path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" /></>, { ...p, strokeWidth: 2 });
}

export function IconClose(p: CockpitIconProps) {
  return base(<><path d="M18 6 6 18M6 6l12 12" /></>, { ...p, strokeWidth: 2 });
}

export function IconPlus(p: CockpitIconProps) {
  return base(<><path d="M12 5v14M5 12h14" /></>, { ...p, strokeWidth: 2 });
}

export function IconCheck(p: CockpitIconProps) {
  return base(<path d="M20 6 9 17l-5-5" />, { ...p, strokeWidth: 2.4 });
}

export function IconChevronRight(p: CockpitIconProps) {
  return base(<path d="m9 6 6 6-6 6" />, { ...p, strokeWidth: 2 });
}

export function IconArrowRight(p: CockpitIconProps) {
  return base(<><path d="M5 12h14" /><path d="m13 6 6 6-6 6" /></>, { ...p, strokeWidth: 2 });
}

export function IconScale(p: CockpitIconProps) {
  return base(<><path d="M12 3v4M9 7h6M12 7l5 13H7l5-13Z" /><path d="M5 20h14" /></>, p);
}

export function IconSparkle(p: CockpitIconProps) {
  return base(<><path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3Z" /><path d="M19 15l.7 2 2 .7-2 .7-.7 2-.7-2-2-.7 2-.7.7-2Z" /></>, p);
}

export function IconWarn(p: CockpitIconProps) {
  return base(<><path d="M12 3 2 20h20L12 3Z" /><path d="M12 9v5M12 17.5v.5" /></>, p);
}

export function IconRefresh(p: CockpitIconProps) {
  return base(<><path d="M20 12a8 8 0 1 1-2.34-5.66" /><path d="M20 4v4h-4" /></>, { ...p, strokeWidth: 2 });
}

export function IconTrash(p: CockpitIconProps) {
  return base(<><path d="M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2M6 7l1 13a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-13" /></>, p);
}

export function IconCopy(p: CockpitIconProps) {
  return base(<><rect x="9" y="9" width="12" height="12" rx="2" /><path d="M5 15V5a2 2 0 0 1 2-2h10" /></>, p);
}

export function IconEdit(p: CockpitIconProps) {
  return base(<><path d="M12 20h9" /><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5Z" /></>, p);
}

export function IconUsers(p: CockpitIconProps) {
  return base(<><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20c.8-3.3 3.3-5 6.5-5s5.7 1.7 6.5 5" /><path d="M16 4.6a3.5 3.5 0 0 1 0 6.8M18.5 15.2c1.6.7 2.8 2.1 3.2 4.3" /></>, p);
}

export function IconShoppingCart(p: CockpitIconProps) {
  return base(<><circle cx="9" cy="20" r="1.5" /><circle cx="17.5" cy="20" r="1.5" /><path d="M2.5 3h2l2.6 13.2a1 1 0 0 0 1 .8h9.8a1 1 0 0 0 1-.8L21 7H5.5" /></>, p);
}

export function IconClock(p: CockpitIconProps) {
  return base(<><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3.5 2" /></>, p);
}

export function IconMapPin(p: CockpitIconProps) {
  return base(<><path d="M12 21s7-5.5 7-11a7 7 0 1 0-14 0c0 5.5 7 11 7 11Z" /><circle cx="12" cy="10" r="2.6" /></>, p);
}

export function IconGrip(p: CockpitIconProps) {
  return base(<><circle cx="9" cy="6" r="1" /><circle cx="15" cy="6" r="1" /><circle cx="9" cy="12" r="1" /><circle cx="15" cy="12" r="1" /><circle cx="9" cy="18" r="1" /><circle cx="15" cy="18" r="1" /></>, p);
}

export function IconShield(p: CockpitIconProps) {
  return base(<><path d="M12 22s8-3 8-10V5l-8-3-8 3v7c0 7 8 10 8 10Z" /><path d="m9 12 2 2 4-4" /></>, p);
}

export function IconSnow(p: CockpitIconProps) {
  return base(<><path d="M12 2v20M4.3 7l15.4 10M19.7 7 4.3 17" /><path d="m12 2-2 2 2 2 2-2-2-2ZM12 18l-2 2 2 2 2-2-2-2Z" /></>, p);
}

export function IconSun(p: CockpitIconProps) {
  return base(<><circle cx="12" cy="12" r="4.2" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></>, p);
}

export const COCKPIT_ICONS = {
  checklist: IconChecklist,
  bell: IconBell,
  backpack: IconBackpack,
  nav: IconNav,
  box: IconBox,
  calendar: IconCalendar,
  scale: IconScale,
  warn: IconWarn,
  users: IconUsers,
  cart: IconShoppingCart,
  clock: IconClock,
  pin: IconMapPin,
  shield: IconShield,
} as const;

export type CockpitIconName = keyof typeof COCKPIT_ICONS;