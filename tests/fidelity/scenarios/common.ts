import type { MeasureSpec } from '../lib/types';

export const CARNET_ID = '749e9e8c-9540-5a73-8b6c-6ab07264f62f';
export const MAQUETTE_CARNET = 'handoff/carnet-v2/annexes/maquette-fiche-carnet.html';
export const MAQUETTE_COMMUNAUTE = 'handoff/communaute-v2/annexes/maquette-communaute.html';

/** Propriétés typographiques comparées. */
export const TEXT = ['font-size', 'font-weight', 'color', 'letter-spacing', 'line-height'];
/** Propriétés de boîte comparées. */
export const BOX = ['border-radius', 'background-color', 'box-shadow'];
/** Surfaces en verre : le fond est un dégradé (background-image) et un flou (backdrop-filter). */
export const GLASS = ['border-radius', 'background-color', 'background-image', 'backdrop-filter', 'box-shadow'];

/** Raccourci : mesure avec rect + propriétés. */
export function measure(id: string, app: string, maquette: string, props: string[] = [], rect = true): MeasureSpec {
  return { id, app, maquette, props, rect };
}

/**
 * Chrome de l'app absent de la maquette (barre d'onglets flottante, bannière
 * cookies, bandeau hors ligne) et faux chrome de la maquette (barre d'état,
 * île, barre d'onglets simulée) : masqués des deux côtés.
 */
export const CHROME_MASKS = {
  app: ['.lkdv-floating-tabbar', '[aria-label*="cookies" i]', '.lkdv-offline-banner'],
  maquette: ['#phone .status', '#phone .island', '#phone .tabbar'],
};
