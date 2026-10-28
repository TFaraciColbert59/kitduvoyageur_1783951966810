import type { LKDVIconName } from './LKDVIcon';

/**
 * Icône LKDV V2 sous forme de chaîne HTML, pour les contextes hors React (marqueurs et popups Leaflet/MapLibre).
 * Même rendu que `<LKDVIcon />` : la feuille `src/styles/lkdv-icons.css` peint le masque (vert, ou blanc sur texte clair).
 */
export function lkdvIconHtml(name: LKDVIconName, size = '1em'): string {
  return `<span class="lkdv-icon lkdv-icon-inline" aria-hidden="true" style="--lkdv-icon-url:url(/icons/lkdv/${name}.svg);--lkdv-icon-size:${size}"></span>`;
}
