/**
 * Modele PUR du tiroir « Tes aventures » (maquette `01-drawer`).
 *
 * Zero React, zero `window` : toutes les chaines visibles, l'ordre des
 * actions et la derivation des lignes vivent ici pour etre testables sans
 * DOM. Le composant ne fait que le rendu.
 */

import { resolveAdventureHref } from '@/features/hub/context/adventureLists';
import type { AdventureGroups } from '@/features/hub/context/adventureLists';

/** Nature d'une aventure telle que le hub les range deja. */
export type DrawerNature = 'possession' | 'sortie' | 'collectif';

export interface DrawerAction {
  readonly id: 'prepare' | 'libre';
  readonly label: string;
  readonly description: string;
  readonly href: string;
  readonly icon: string;
  /** `primary` = le geste attendue ; `secondary` = l raccourci sans prep. */
  readonly variant: 'primary' | 'secondary';
}

export interface DrawerRow {
  readonly id: string;
  readonly nature: DrawerNature;
  readonly title: string;
  readonly subtitle: string;
  readonly href: string;
  readonly icon: string;
}

export const DRAWER_TITLE = 'Tes aventures';

export const DRAWER_SUBTITLE = 'Ouvert par un appui long sur Hub.';

export const DRAWER_LIST_HEADING = 'Tes aventures';

export const EMPTY_ADVENTURES_TITLE = "Aucune aventure pour l'instant";

export const EMPTY_ADVENTURES_HINT =
  'Crée une activité ou un voyage : le prep de parcours, du matériel et du groupe.';

/**
 * Les deux entrees ajoutees au tiroir. `prepare` passe AVANT la liste :
 * l'action principale ne doit jamais etre noyee en bas de liste, ni au
 * doigt ni au clavier (c'est le premier element focusable du panneau).
 */
export const PREPARE_ACTION: DrawerAction = {
  id: 'prepare',
  label: 'Préparer une activité',
  description: 'Trois réponses suffisent : on construit tout le reste.',
  href: '/prepare?nouvelle=1',
  icon: 'route',
  variant: 'primary',
};

export const FREE_ACTION: DrawerAction = {
  id: 'libre',
  label: 'Partir librement',
  description: 'Sans préparation, tu pars tout de suite.',
  href: '/partir-librement',
  icon: 'navigation',
  variant: 'secondary',
};

/** Ordre fige : primaire d'abord, raccourci ensuite. */
export function drawerActions(): readonly DrawerAction[] {
  return [PREPARE_ACTION, FREE_ACTION];
}

const NATURE_ICON: Record<DrawerNature, string> = {
  sortie: 'compass',
  collectif: 'users',
  possession: 'backpack',
};

const NATURE_LABEL: Record<DrawerNature, string> = {
  sortie: 'Aventure',
  collectif: 'Collectif',
  possession: 'Matériel',
};

/**
 * Combien d'aventures le tiroir peut afficher.
 *
 * Une AVENTURE est une sortie ou un collectif. L'entree « materiel » n'en est
 * pas une : la garder dans le compte ferait forever afficher l'etat vide
 * comme masque (groupAdventures pousse toujours une entree possession), et
 * « Aucune aventure pour l'instant » deviendrait un mensonge.
 */
export function countAdventures(groups: AdventureGroups): number {
  return groups.sorties.length + groups.collectifs.length;
}

export function isEmptyAdventures(groups: AdventureGroups): boolean {
  return countAdventures(groups) === 0;
}

/** Sur-titre d'une ligne : nature + detail, jamais de donnee inventee. */
function rowMeta(
  nature: DrawerNature,
  fields: { status?: string; primary_activity?: string; subtitle?: string; counts?: string },
): string {
  if (nature === 'possession') return fields.counts ?? NATURE_LABEL[nature];
  if (nature === 'collectif') return fields.subtitle ?? NATURE_LABEL[nature];
  const bits = [fields.primary_activity, fields.status].filter(Boolean);
  return bits.join(' · ') || NATURE_LABEL[nature];
}

/**
 * Derive les lignes du tiroir depuis les listes du hub. L'ordre est celui du
 * hub : sorties (les aventures vivantes), collectifs, puis possession.
 * La section de reprise vient du hub lui-meme — le tiroir n'invente rien.
 */
export function adventureRows(
  groups: AdventureGroups,
  getLastSection: (key: string) => string | null,
): DrawerRow[] {
  const detailed = groups;
  const hrefOf = (entry: unknown): string =>
    resolveAdventureHref(entry as never, getLastSection);
  const rows: DrawerRow[] = [];

  for (const trip of detailed.sorties) {
    rows.push({
      id: `sortie:${trip.slug}`,
      nature: 'sortie',
      title: trip.title,
      subtitle: rowMeta('sortie', trip),
      href: hrefOf(trip),
      icon: NATURE_ICON.sortie,
    });
  }

  for (const group of detailed.collectifs) {
    rows.push({
      id: `collectif:${group.id}`,
      nature: 'collectif',
      title: group.title,
      subtitle: rowMeta('collectif', group),
      href: hrefOf(group),
      icon: NATURE_ICON.collectif,
    });
  }

  for (const entry of detailed.possession) {
    rows.push({
      id: 'possession',
      nature: 'possession',
      title: NATURE_LABEL.possession,
      subtitle: rowMeta('possession', {
        counts: `${entry.itemsCount} article${entry.itemsCount > 1 ? 's' : ''}`,
      }),
      href: hrefOf(entry),
      icon: NATURE_ICON.possession,
    });
  }

  return rows;
}

const AUTOPEN_KEY = 'lkdv_hub_switcher_autopen';

/**
 * Consomme le signal one-shot pose par l'appui long HORS surface hub
 * (le storage est hostile ou absent : on degrade en silence, jamais en crash).
 */
export function consumeDrawerAutoOpen(storage: Storage | null | undefined): boolean {
  if (!storage) return false;
  try {
    if (storage.getItem(AUTOPEN_KEY) !== '1') return false;
    storage.removeItem(AUTOPEN_KEY);
    return true;
  } catch {
    return false;
  }
}