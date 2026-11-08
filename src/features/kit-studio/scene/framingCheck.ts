/**
 * Contrôle de cadrage du Studio (SPEC : le sac ne sort jamais du cadre).
 *
 * Le contrôle est géométrique, pas colorimétrique : il lit le rectangle écran que la caméra
 * calcule pour le sujet (sac + modules montés), exposé par `info().view.subjectRect`. Une
 * détection par couleur dépendrait de la teinte choisie, du décor et de l'éclairage ; la
 * projection, elle, est exacte.
 */

/** Rectangle écran du sujet, en fractions : 0 = bord gauche/haut, 1 = bord droit/bas. */
export interface SubjectRect {
  readonly x0: number;
  readonly y0: number;
  readonly x1: number;
  readonly y1: number;
}

/** Hauteur minimale du sujet, en fraction d'écran. Un porteur très débordant réduit la part du sac. */
export const SUBJECT_MIN_HEIGHT = 0.3;
/** Tolérance de débordement : quelques pixels de sangle au bord ne sont pas un défaut. */
export const SUBJECT_EDGE_TOLERANCE = 0.02;

/** Raison du rejet, ou null si le cadrage est conforme. */
export function framingFailure(rect: SubjectRect | null | undefined): string | null {
  if (!rect) return 'sujet inconnu : aucune boîte de cadrage (maillage non chargé ?)';
  const t = SUBJECT_EDGE_TOLERANCE;
  const dehors: string[] = [];
  if (rect.x0 < -t) dehors.push('à gauche');
  if (rect.x1 > 1 + t) dehors.push('à droite');
  if (rect.y0 < -t) dehors.push('en haut');
  if (rect.y1 > 1 + t) dehors.push('en bas');
  if (dehors.length) return `sujet coupé ${dehors.join(' et ')}`;
  const h = rect.y1 - rect.y0;
  if (h < SUBJECT_MIN_HEIGHT) return `sujet trop petit (${Math.round(h * 100)} % de hauteur)`;
  return null;
}

/** Résumé lisible d'un rectangle, pour les journaux de capture. */
export function describeRect(rect: SubjectRect | null | undefined): string {
  if (!rect) return 'aucun rectangle';
  const pct = (v: number): string => `${Math.round(v * 100)} %`;
  return `x ${pct(rect.x0)}→${pct(rect.x1)}  y ${pct(rect.y0)}→${pct(rect.y1)}  (hauteur ${pct(rect.y1 - rect.y0)})`;
}
