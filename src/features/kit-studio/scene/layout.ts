// Repères de la scène (maquette l.917 et l.949).
/** Plan de la table : le sac est posé dessus. */
export const GROUND_Y = -0.8;
/** Demi-hauteur du sac à l'échelle 1 (le sac pose son bas sur la table). */
export const BAG_HALF_HEIGHT = 0.725;
export const TABLE = { x: -0.5, w: 4.6, d: 2.5 } as const;

/** Centre de la zone « Sur toi » : les objets portés se placent autour (maquette l.1073). */
export const WORN_CENTER = [-1.3, GROUND_Y + 0.9, 0.3] as const;
/** Décalage de chaque objet porté autour du centre, par fonction (maquette WORN_OFF l.1074). */
export const WORN_OFFSETS: Readonly<Record<string, readonly [number, number, number]>> = {
  sunhead: [0, 0.74, 0], sun: [0, 0.6, 0.1], baselayer: [0, 0.3, 0], insulation: [0, 0.33, 0.12], rainshell: [0, 0.34, 0.16],
  nav: [0.26, 0.04, 0.02], comm: [-0.26, 0.04, 0.02], poles: [0.46, -0.1, 0], footwear: [0, -0.66, 0],
};
