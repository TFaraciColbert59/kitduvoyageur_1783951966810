/**
 * Deux niveaux au plus (4.6) : le tiroir, puis UN seul niveau posé dessus (un sous-tiroir ou le détail
 * superposé d'une journée / d'un point). Échap et « Retour » ferment un seul niveau à la fois.
 * Module pur : la décision est calculée ici, le composant n'a qu'à l'exécuter.
 */
export interface LevelState {
  readonly sheetOpen: boolean;
  readonly subDrawer: boolean;
  readonly overlay: boolean;
  /** Menu « Carte et affichage » ouvert : il se referme avant tout le reste. */
  readonly mapMenu: boolean;
}

export type LevelTarget = 'map-menu' | 'overlay' | 'sub-drawer' | 'sheet' | 'none';

/** Ce que ferme un Échap (ou un « Retour ») : le niveau le plus haut, un seul. */
export function levelToClose(s: LevelState): LevelTarget {
  if (s.mapMenu) return 'map-menu';
  if (s.overlay) return 'overlay';
  if (s.subDrawer) return 'sub-drawer';
  if (s.sheetOpen) return 'sheet';
  return 'none';
}

/**
 * Quand un second niveau s'ouvre alors qu'un autre est déjà ouvert, le nouveau remplace l'ancien : la pile ne
 * dépasse jamais deux niveaux. `opened` est celui qui vient de s'ouvrir.
 */
export function levelToDrop(s: Pick<LevelState, 'subDrawer' | 'overlay'>, opened: 'sub-drawer' | 'overlay'): 'sub-drawer' | 'overlay' | null {
  if (!s.subDrawer || !s.overlay) return null;
  return opened === 'overlay' ? 'sub-drawer' : 'overlay';
}

/** Un champ de saisie garde son Échap (annuler la frappe) : on ne ferme pas le niveau sous ses doigts. */
export function isEditableTarget(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  if (!el || typeof el.tagName !== 'string') return false;
  const tag = el.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el.isContentEditable === true;
}
