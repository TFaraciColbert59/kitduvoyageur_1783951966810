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

/* ---------- Retour du navigateur : une entrée d'historique par niveau ouvert (4.6) ---------- */

/** Clé posée dans `history.state` : le nombre d'entrées « niveau » empilées jusqu'à celle-ci. */
export const LEVEL_STATE_KEY = 'rcwLevel';

/** Combien de niveaux sont ouverts : menu de la carte, détail ou sous-tiroir (un seul des deux), tiroir. */
export function openLevelCount(s: LevelState): number {
  return (s.mapMenu ? 1 : 0) + (s.overlay || s.subDrawer ? 1 : 0) + (s.sheetOpen ? 1 : 0);
}

/**
 * Le niveau ouvert à l'arrivée n'est pas un piège : « Retour » doit quitter la page, pas fermer un tiroir que
 * personne n'a ouvert. La base suit donc le plus bas nombre de niveaux vu ; seul ce qui s'ouvre au-dessus compte.
 */
export function levelsAboveBase(count: number, base: number | null): { depth: number; base: number } {
  const b = base == null ? count : Math.min(base, count);
  return { depth: count - b, base: b };
}

/** Ce que l'historique doit faire pour suivre `depth` niveaux alors que `pushed` entrées sont empilées. */
export function historyMove(depth: number, pushed: number): { push: number; back: number } {
  if (depth > pushed) return { push: depth - pushed, back: 0 };
  if (depth < pushed) return { push: 0, back: pushed - depth };
  return { push: 0, back: 0 };
}

/** Profondeur d'empilement portée par une entrée d'historique (0 si l'entrée n'est pas la nôtre). */
export function stackDepthOf(state: unknown): number {
  if (!state || typeof state !== 'object') return 0;
  const n = (state as Record<string, unknown>)[LEVEL_STATE_KEY];
  return typeof n === 'number' && Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
}

/** L'état une fois le niveau le plus haut refermé (même ordre que `levelToClose`). */
export function afterClosing(s: LevelState): LevelState {
  switch (levelToClose(s)) {
    case 'map-menu':
      return { ...s, mapMenu: false };
    case 'overlay':
      return { ...s, overlay: false };
    case 'sub-drawer':
      return { ...s, subDrawer: false };
    case 'sheet':
      return { ...s, sheetOpen: false };
    default:
      return s;
  }
}
