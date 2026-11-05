// Couleurs de la scène 3D et de ses textures canvas (maquette Kit_Studio_v2.html, l.906-1110).
// Seul fichier, avec palette.ts, autorisé à contenir de l'hexadécimal ou rgba() : scene/ n'importe que des noms.
// Domaine pur : aucun import three ni DOM.

export type Rgb = readonly [number, number, number];

/** Chaîne `rgba(r,g,b,a)` pour un dessin canvas. */
export const rgba = (c: Rgb, a: number): string => `rgba(${c[0]},${c[1]},${c[2]},${a})`;
/** Chaîne `rgb(r,g,b)` pour un dessin canvas. */
export const rgb = (c: Rgb): string => `rgb(${c[0]},${c[1]},${c[2]})`;

/* ───────────── Encre : base de toutes les ombres et sillons de texture (jamais de noir pur) ───────────── */
/** Encre du design system (#141916, « Encre » du catalogue). */
export const INK: Rgb = [20, 25, 22];
export const WHITE: Rgb = [255, 255, 255];

/* ───────────── Lumières ───────────── */
export const LIGHT_HEMI_SKY = '#D6ECFF';
export const LIGHT_HEMI_GROUND = '#7E9A55';
export const LIGHT_SUN = '#FFF1DA';
export const LIGHT_RIM = '#E3F0FF';

/* ───────────── Panorama : ciel, soleil, nuages, montagnes, sapins, prairie ───────────── */
export const SKY_STOPS: readonly (readonly [number, string])[] = [
  [0, '#3F8ED3'],
  [0.45, '#7DBBE8'],
  [0.85, '#CDE7F4'],
  [1, '#E8F3F2'],
];
const SUN_CORE: Rgb = [255, 252, 238];
const SUN_HALO: Rgb = [255, 248, 222];
const SUN_GLOW: Rgb = [255, 244, 214];
export const SUN_STOPS: readonly (readonly [number, string])[] = [
  [0, rgba(SUN_CORE, 1)],
  [0.06, rgba(SUN_HALO, 0.9)],
  [0.3, rgba(SUN_GLOW, 0.28)],
  [1, rgba(SUN_GLOW, 0)],
];
export const CLOUD_CORE = rgba(WHITE, 0.75);
export const CLOUD_EDGE = rgba(WHITE, 0);
export const RIDGE_FAR = '#9FB9D2';
export const RIDGE_MID = '#6F98A6';
export const RIDGE_NEAR = '#5E8C55';
export const SNOW = rgba(WHITE, 0.92);
const HAZE_FAR: Rgb = [220, 236, 244];
const HAZE_MID: Rgb = [190, 222, 224];
export const HAZE_FAR_STOPS: readonly (readonly [number, string])[] = [[0, rgba(HAZE_FAR, 0)], [1, rgba(HAZE_FAR, 0.75)]];
export const HAZE_MID_STOPS: readonly (readonly [number, string])[] = [[0, rgba(HAZE_MID, 0)], [1, rgba(HAZE_MID, 0.55)]];
export const FIR_DARK = '#2F5A3A';
export const FIR_LIGHT = '#3B6B40';
export const MEADOW_STOPS: readonly (readonly [number, string])[] = [
  [0, '#7DAA55'],
  [0.5, '#6C9C47'],
  [1, '#5F8F3F'],
];
export const FLOWER_WHITE = rgba(WHITE, 0.8);
export const FLOWER_YELLOW = rgba([250, 214, 92], 0.85);
export const FLOWER_PINK = rgba([206, 140, 190], 0.7);
export const GRASS_DARK = rgba([60, 110, 40], 0.35);
export const GRASS_LIGHT = rgba([170, 210, 110], 0.35);

/* ───────────── Table en chêne clair ───────────── */
export const WOOD_PLANKS: readonly Rgb[] = [
  [226, 214, 196],
  [219, 206, 186],
  [230, 219, 202],
  [222, 209, 190],
  [228, 216, 199],
];
export const WOOD_PLANK_COUNT = WOOD_PLANKS.length;
export const woodPlank = (i: number): string => rgb(WOOD_PLANKS[i]);
const WOOD_VEIN_DARK: Rgb = [140, 118, 92];
const WOOD_VEIN_LIGHT: Rgb = [246, 238, 226];
export const woodVein = (light: boolean, alpha: number): string => rgba(light ? WOOD_VEIN_LIGHT : WOOD_VEIN_DARK, alpha);
export const WOOD_JOINT = rgba([110, 90, 70], 0.3);
/** Teinte multipliée à la texture de bois (matériau). */
export const WOOD_TINT = '#EEEAE4';

/* ───────────── Textures de tissu (blanc de base, sillons à l'encre) ───────────── */
export const TEX_BASE = rgb(WHITE);
export const inkA = (alpha: number): string => rgba(INK, alpha);
export const whiteA = (alpha: number): string => rgba(WHITE, alpha);

/* ───────────── Sac : teintes de rôle (hors coloris du catalogue) ───────────── */
export const LOOK_FALLBACK = '#888888';
export const LOOK_COVER = '#E4C27A';
export const LOOK_REFLECT = '#DDE3E0';
export const LOOK_METAL = '#B5ABA0';
export const LOOK_EMISSIVE_REFLECT = '#FFFFFF';
export const BAG_MOUTH = '#0C140F';

/* ───────────── Vignettes 3D des cartes (maquette l.1195-1209) ───────────── */
export const THUMB_HEMI_SKY = '#FFFFFF';
export const THUMB_HEMI_GROUND = '#C9D4C6';
export const THUMB_FILL = '#DDEBFF';

/* ───────────── Objets rangés : teintes de détail (hors coloris du catalogue) ───────────── */
export const ITEM_LENS = '#FFF6DD';
export const ITEM_SCREEN = '#1D2A24';
export const ITEM_BLADE = '#CFD6D2';
export const ITEM_CROSS = '#FFFFFF';
/** Objets manquants (« fantômes ») : filaire ambre et halo. */
export const GHOST_COLOR = '#C89A3B';
const GHOST_GLOW: Rgb = [200, 154, 59];
export const GHOST_HALO_STOPS: readonly (readonly [number, string])[] = [
  [0, rgba(GHOST_GLOW, 1)],
  [0.3, rgba(GHOST_GLOW, 0.7)],
  [1, rgba(GHOST_GLOW, 0)],
];

/* ───────────── Illustration du tiroir Personnaliser (drawers/PersonnaliserDrawer.tsx) ─────────────
   Dégradés et ombres du dessin SVG : mêmes valeurs que la branche hub-camp-3d, nommées ici pour que
   le tiroir n'écrive aucune couleur littérale (garde-fou `__tests__/palette.test.ts`). */
export const DRAWER_ART = {
  shade: '#0a140e',
  shadeDeep: '#0d1b13',
  shadeInk: '#0b1610',
  shadeNight: '#09140e',
  shadeAbyss: '#08100b',
  shellDark: '#172820',
  shellMid: '#2d3b34',
  shellDeep: '#172b24',
  highlight: '#d8e8dc',
  white: '#ffffff',
  white25: 'rgba(255,255,255,0.25)',
  white20: 'rgba(255,255,255,0.2)',
  white12: 'rgba(255,255,255,0.12)',
  ink30: 'rgba(0,0,0,0.3)',
} as const;
