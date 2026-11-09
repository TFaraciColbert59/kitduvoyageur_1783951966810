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

/* ───────────── Modules 3D (vignettes) ───────────── */
export const MODULE_THUMB_OLIVE = '#3D4E3B';
export const MODULE_THUMB_TRIM = '#222823';
export const MODULE_THUMB_ACCENT = '#D4973B';
export const MODULE_THUMB_NET = '#2B3629';

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

/** Mur de l'atelier : valeurs déjà présentes dans la palette, sans nouvelle teinte. */
export const WALL_STOPS: readonly (readonly [number, string])[] = [
  [0, LOOK_METAL],
  [1, WOOD_TINT],
];
