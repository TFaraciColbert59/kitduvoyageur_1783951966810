/**
 * Palette de couleurs haute lisibilité par jour de carnet (J1, J2, J3…).
 * Partagée entre les onglets de jours, la carte du tracé (Étape 2) et
 * l'overlay carte checkpoint des moments (Étape 3).
 */
export const CARNET_DAY_TRACE_COLORS = [
  '#17402c', // J1 : Vert forêt
  '#0284c7', // J2 : Bleu alpin
  '#d97706', // J3 : Ocre ambre
  '#7c3aed', // J4 : Violet crête
  '#e11d48', // J5 : Framboise
  '#0d9488', // J6 : Sarcelle
  '#2563eb', // J7 : Cobalt
  '#ca8a04', // J8 : Doré
] as const;

export function dayTraceColor(dayIndex: number): string {
  if (dayIndex < 0) return CARNET_DAY_TRACE_COLORS[0];
  return CARNET_DAY_TRACE_COLORS[dayIndex % CARNET_DAY_TRACE_COLORS.length];
}
