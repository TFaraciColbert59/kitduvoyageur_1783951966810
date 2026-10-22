import type { ComponentType } from 'react';
import type { V5Api } from '../context';
import type { V5IconName } from '../ui/icons';
import type { V5Space } from '../types';

/**
 * Un tiroir v5 : une capsule d'icônes (onglets, jamais de texte), un titre, une ligne de contexte et un corps.
 * Le corps lit tout ce qu'il lui faut par `useV5()` ; il écrit par `api.ctl.run(...)` (annonce dans l'îlot,
 * « Annuler » si on lui donne l'inverse) et jamais par un appel direct sans annonce.
 *
 * Un fichier de tiroir exporte UNE définition (`export const xDrawer: V5DrawerDef`) et rien d'autre de public.
 * L'écran les branche dans `drawers/index.ts` (seul fichier partagé, tenu par l'écran).
 */
export interface V5DrawerDef {
  space: V5Space;
  /** Onglets de la capsule : l'icône et le nom accessible ; vide : pas de capsule. Peut dépendre du voyage. */
  tabs: (api: V5Api) => ReadonlyArray<{ icon: V5IconName; label: string }>;
  /** Titre affiché sous la capsule (peut dépendre de l'onglet). */
  title: (api: V5Api) => string;
  /** Contexte à droite du titre (« 574 € prévus », « 10 objets »), ou null. */
  subtitle: (api: V5Api) => string | null;
  Body: ComponentType;
}
