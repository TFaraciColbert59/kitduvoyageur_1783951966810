/**
 * Mathematique du curseur d'echelle, isolee du composant pour etre testee.
 *
 * L'axe est logarithmique (1 h -> 720 h) : un pas de 2 % de l'axe donne un
 * pas d'environ 15 min a 1 h et d'environ 15 h a 720 h, ce qui est le
 * comportement attendu d'un reglage d'echelle.
 */

import {
  H_MAX,
  H_MIN,
  ZONES,
  clamp,
  tAtZoneMiddle,
  tFromHours,
  zoneIndex,
} from '@/features/trajectoire/domain/scaleAxis';
import type { TrajectoireZone } from '@/features/trajectoire/domain/scaleAxis';

/** Un pas de fleche, en fraction de l'axe. */
export const ARROW_STEP = 0.02;
/** Un pas Page Up / Page Down : une zone entiere. */
export const ZONE_JUMP: Record<'next' | 'prev', (t: number) => number> = {
  next: (t) => tAtZoneMiddle(ZONES[Math.min(ZONES.length - 1, zoneIndexAt(t) + 1)].id),
  prev: (t) => tAtZoneMiddle(ZONES[Math.max(0, zoneIndexAt(t) - 1)].id),
};

function zoneIndexAt(t: number): number {
  const tClamped = clamp(t, 0, 1);
  // On se base sur la zone courante, pas sur t brut, pour rester monotone.
  let index = 0;
  for (let i = 0; i < ZONES.length; i += 1) {
    if (tClamped >= tAtZoneMiddle(ZONES[i].id) - 1e-9) index = i;
  }
  return index;
}

export type RulerKeyAction = { type: 'set'; t: number } | { type: 'none' };

/**
 * Traduit une touche en deplacement. Les touches non gerees rendent `none`
 * pour que l'appelant laisse le navigateur faire son travail (tabulation).
 */
export function rulerKeyAction(key: string, t: number): RulerKeyAction {
  const current = clamp(t, 0, 1);
  switch (key) {
    case 'ArrowRight':
    case 'ArrowUp':
      return { type: 'set', t: clamp(current + ARROW_STEP, 0, 1) };
    case 'ArrowLeft':
    case 'ArrowDown':
      return { type: 'set', t: clamp(current - ARROW_STEP, 0, 1) };
    case 'Home':
      return { type: 'set', t: tFromHours(H_MIN) };
    case 'End':
      return { type: 'set', t: tFromHours(H_MAX) };
    case 'PageUp':
      return { type: 'set', t: clamp(ZONE_JUMP.next(current), 0, 1) };
    case 'PageDown':
      return { type: 'set', t: clamp(ZONE_JUMP.prev(current), 0, 1) };
    default:
      return { type: 'none' };
  }
}

/** Position du pointeur -> position sur l'axe, en 0-1. */
export function tFromPointer(clientX: number, rectLeft: number, rectWidth: number): number {
  if (rectWidth <= 0) return 0;
  return clamp((clientX - rectLeft) / rectWidth, 0, 1);
}

/** Reperes de graduation : 1 h, 6 h, 1 j, 3 j, 7 j, 14 j, 30 j. */
export const RULER_TICKS: readonly { hours: number; label: string }[] = [
  { hours: 1, label: '1 h' },
  { hours: 6, label: '6 h' },
  { hours: 24, label: '1 j' },
  { hours: 72, label: '3 j' },
  { hours: 168, label: '7 j' },
  { hours: 336, label: '14 j' },
  { hours: 720, label: '30 j' },
];

/** Position d'un repere sur l'axe, en pourcentage. */
export function tickPercent(hours: number): number {
  return tFromHours(hours) * 100;
}
