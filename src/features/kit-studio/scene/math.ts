// Petits utilitaires numériques de la scène (maquette l.588-590).
export const clamp = (v: number, a: number, b: number): number => Math.max(a, Math.min(b, v));
export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;
/** Facteur d'amortissement exponentiel indépendant de la fréquence d'image. */
export const damp = (k: number, dt: number): number => 1 - Math.exp(-k * dt);
/** Dépassement « back-out » de l'apparition des pièces (maquette l.995). */
export const backOut = (t: number): number => 1 + 2.70158 * Math.pow(t - 1, 3) + 1.70158 * Math.pow(t - 1, 2);
