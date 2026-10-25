/**
 * Reservation basse — source unique, partagee par le rendu ET la reservation.
 *
 * Le rail de jours se pose ~40 px AU-DESSUS de la barre, dans le meme overlay
 * fixe. Toute page qui passe dessous doit donc reserver l offset etendu, et
 * celle qui n a pas de plateau doit reserver l offset simple. Les deux
 * hauteurs sont des TOKENS (tokens.css) : aucun pixel n est calcule ici.
 *
 * Pourquoi une fonction pure plutot qu une valeur partagee : le rendu
 * (WebNavigationBar) et la reservation vivent dans deux arbres React
 * DISJOINTS — c est le meme contrat que hasExtendedNav et hasDayFocusPlateau.
 * Une seule fonction pure evaluee des deux cotes rend la divergence
 * impossible par construction.
 */

export interface BottomNavReservation {
  /** La page affiche-t-elle la barre basse ? */
  hasBottomNav: boolean;
  /** Plateau de section (sous-onglets) au-dessus de la barre. */
  hasUpperExtension: boolean;
  /** Rail de jours au-dessus de la barre. */
  hasDayPlateau: boolean;
}

/**
 * Hauteur a reserver en bas de page, exprimee en token CSS.
 *
 * L ordre des conditions est celui du rendu : sans barre, rien ; avec un
 * plateau (section OU jour), l offset etendu ; sinon l offset simple.
 */
export function bottomNavHeightToken({
  hasBottomNav,
  hasUpperExtension,
  hasDayPlateau,
}: BottomNavReservation): string {
  if (!hasBottomNav) return 'var(--page-bottom-inset-bare)';
  return hasUpperExtension || hasDayPlateau ? 'var(--nav-offset-extended)' : 'var(--nav-offset)';
}

/** Nom de la variable publiee — consommee par les feuilles de style. */
export const BOTTOM_NAV_HEIGHT_VAR = '--bottom-nav-height';

/**
 * Publie la reservation sur une racine et rend un nettoyage.
 *
 * La racine est un PARAMETRE, pas un global lu sur place : le contrat teste
 * devient verifiable sans navigateur (le repo n a pas de jsdom), et le
 * nettoyage peut restaurer la valeur precedente au lieu de l effacer — une
 * page qui publie deja sa propre reservation ne doit pas la perdre quand la
 * barre se demonte.
 */
export function applyBottomNavReservation(
  root: Pick<HTMLElement, 'style'> | null | undefined,
  token: string,
): () => void {
  if (!root) return () => undefined;
  const previous = root.style.getPropertyValue(BOTTOM_NAV_HEIGHT_VAR);
  root.style.setProperty(BOTTOM_NAV_HEIGHT_VAR, token);
  return () => {
    if (previous) root.style.setProperty(BOTTOM_NAV_HEIGHT_VAR, previous);
    else root.style.removeProperty(BOTTOM_NAV_HEIGHT_VAR);
  };
}
