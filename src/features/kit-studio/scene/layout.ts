// Repères de la scène (maquette l.917 et l.949).
/** Plan de la table : le sac est posé dessus. */
export const GROUND_Y = -0.8;
/** Demi-hauteur du sac à l'échelle 1 (le sac pose son bas sur la table). */
export const BAG_HALF_HEIGHT = 0.725;
export const TABLE = { x: -0.5, z: -0.66, w: 4.6, d: 1.8 } as const;

/** Centre de la zone « Sur toi » : les objets portés se placent autour (maquette l.1073). */
export const WORN_CENTER = [-1.3, GROUND_Y + 0.9, 0.3] as const;
/** Emplacements sur l'établi des objets de « Sur toi ». Y est résolu par la boîte réelle de chaque forme. */
export const WORN_OFFSETS: Readonly<Record<string, readonly [number, number, number]>> = {
  sunhead: [0.65, 0, -0.75], sun: [0.6, 0, -0.25], baselayer: [0.7, 0, -0.8],
  insulation: [0.6, 0, -0.22], rainshell: [0.5, 0, -0.45],
  nav: [0.8, 0, -0.7], comm: [0.8, 0, -0.2], poles: [0.3, 0, -0.75], footwear: [0.75, 0, -0.22],
};
