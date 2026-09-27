export interface PoiPopupRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface PoiPopupInsets {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/**
 * Calcule le deplacement de camera necessaire pour garder un popup MapLibre
 * entierement visible dans la zone utile de la carte, au-dessus du panneau Hub.
 * Les coordonnees sont exprimees en pixels CSS.
 */
export function getPoiPopupPanCorrection(
  mapRect: PoiPopupRect,
  popupRect: PoiPopupRect,
  insets: PoiPopupInsets
): { x: number; y: number } {
  const minX = mapRect.x + insets.left;
  const maxX = mapRect.x + mapRect.width - insets.right - popupRect.width;
  const minY = mapRect.y + insets.top;
  const maxY = mapRect.y + mapRect.height - insets.bottom - popupRect.height;

  const targetX = maxX < minX ? minX : clamp(popupRect.x, minX, maxX);
  const targetY = maxY < minY ? minY : clamp(popupRect.y, minY, maxY);

  return { x: targetX - popupRect.x, y: targetY - popupRect.y };
}

/**
 * MapLibre interprete `panBy` comme un deplacement de la carte : un point
 * ancre se deplace donc dans le sens oppose a l'offset fourni. On inverse le
 * correction ecran calculee par `getPoiPopupPanCorrection` avant de l'appliquer.
 */
export function getPoiPopupPanOffset(correction: { x: number; y: number }): { x: number; y: number } {
  return { x: -correction.x, y: -correction.y };
}
