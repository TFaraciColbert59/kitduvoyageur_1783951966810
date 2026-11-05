// Formats d'affichage fr-FR du Kit Studio (porté de la maquette : kg(), fr(), wt(), lit()).
// Domaine pur : aucun import React, three ou DOM.

const NB = ' ';

/** Nombre fr-FR avec un nombre fixe de décimales (virgule décimale). */
function fr(n: number, decimals: number): string {
  return n.toLocaleString('fr-FR', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

/** Valeur finie et positive ou nulle ; sinon 0. */
function nonNegative(n: number): number {
  return Number.isFinite(n) && n > 0 ? n : 0;
}

/** Toujours en kilogrammes : « 0,8 kg ». */
export function formatKg(g: number): string {
  return `${fr(nonNegative(g) / 1000, 1)}${NB}kg`;
}

/** « 820 g » sous 1 000 g, « 10,3 kg » au-dessus. */
export function formatWeight(g: number): string {
  const v = nonNegative(g);
  return v >= 1000 ? formatKg(v) : `${Math.round(v)}${NB}g`;
}

/** Centimes → « 1 234 € » (espaces insécables). */
export function formatEuro(cents: number): string {
  return `${fr(Math.round(nonNegative(cents) / 100), 0)}${NB}€`;
}

/** « 14 % » (espace insécable avant le signe). */
export function formatPercent(n: number): string {
  return `${fr(Math.round(Number.isFinite(n) ? n : 0), 0)}${NB}%`;
}

/** « 6,5 L » sous 10 L, « 40 L » au-dessus. */
export function formatLitres(l: number): string {
  const v = nonNegative(l);
  return `${fr(v, v < 10 ? 1 : 0)}${NB}L`;
}
