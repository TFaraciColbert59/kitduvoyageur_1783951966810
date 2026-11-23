/**
 * Les trois hauteurs du tiroir (aperçu, moitié, plein) : fonctions pures, partagées par le tiroir de
 * l'itinéraire. Le tiroir du Compas, lui, vit dans les bornes de sa card et n'a pas de hauteurs.
 */
export type SheetDetent = 'peek' | 'low' | 'mid' | 'full';

export const SHEET_DETENTS: ReadonlyArray<SheetDetent> = ['peek', 'mid', 'full'];

/** Dégagement en haut (encoche + barre du haut) : le tiroir plein ne le dépasse jamais. */
const TOP_CLEARANCE = 148;

export function detentHeights(viewport: number): Record<SheetDetent, number> {
  const minH = Math.max(248, Math.round(viewport * 0.32));
  const maxH = Math.max(minH + 40, Math.min(Math.round(viewport * 0.85), viewport - TOP_CLEARANCE));
  // Aperçu : l'en-tête et la capsule ; moitié : la carte reste lisible ; plein : le maximum.
  const peek = Math.min(190, Math.max(150, Math.round(viewport * 0.2)));
  const mid = Math.min(maxH - 60, Math.max(peek + 90, Math.round(viewport * 0.5)));
  return { peek, low: mid, mid, full: maxH };
}

/** « low » (ancien cran) vaut « moitié » : trois crans seulement. */
export function shownDetent(detent: SheetDetent): SheetDetent {
  return detent === 'low' ? 'mid' : detent;
}

/**
 * Relâchement de la poignée : le cran voisin dans le sens du geste s'il est vif, la fermeture si on tire l'aperçu
 * vers le bas (ou en deçà de 82 % de sa hauteur), sinon le cran le plus proche.
 * `velocity` en px/ms, négatif vers le haut.
 */
export function settleDetent(
  current: SheetDetent,
  height: number,
  velocity: number,
  heights: Record<SheetDetent, number>,
  canClose: boolean
): SheetDetent | 'close' {
  const index = SHEET_DETENTS.indexOf(shownDetent(current));
  if (velocity < -0.3) return SHEET_DETENTS[Math.min(2, index + 1)];
  if (velocity > 0.3) {
    if (index === 0 && canClose) return 'close';
    return SHEET_DETENTS[Math.max(0, index - 1)];
  }
  if (height < heights.peek * 0.82 && canClose) return 'close';
  return SHEET_DETENTS.reduce((best, d) => (Math.abs(heights[d] - height) < Math.abs(heights[best] - height) ? d : best));
}

/** Un simple toucher sur la poignée monte d'un cran, et revient à l'aperçu depuis le plein. */
export function nextDetentOnTap(current: SheetDetent): SheetDetent {
  const index = SHEET_DETENTS.indexOf(shownDetent(current));
  return SHEET_DETENTS[index >= SHEET_DETENTS.length - 1 ? 0 : index + 1];
}

/** Flèches, Début, Fin sur la poignée : le cran voulu, ou null si la touche n'est pas la sienne. */
export function detentFromKey(current: SheetDetent, key: string): SheetDetent | null {
  const index = SHEET_DETENTS.indexOf(shownDetent(current));
  if (key === 'ArrowUp' || key === 'ArrowRight') return SHEET_DETENTS[Math.min(SHEET_DETENTS.length - 1, index + 1)];
  if (key === 'ArrowDown' || key === 'ArrowLeft') return SHEET_DETENTS[Math.max(0, index - 1)];
  if (key === 'Home') return 'peek';
  if (key === 'End') return 'full';
  return null;
}
