/**
 * Échelle de z-index partagée LKDV (M04).
 *
 * Une seule source de vérité pour les couches d'interface. Toute nouvelle
 * surface superposée doit piocher ici plutôt que d'inventer une valeur :
 *
 * - nav    : barre d'onglets principale mobile (sous les feuilles/modales)
 * - sheet  : tiroirs, feuilles, menus contextuels (Drawer, Sheet, Hamburger)
 * - modal  : modales et dialogues plein écran (Glass*, PremiumBottomSheet)
 * - toast  : bandeaux de statut transitoires (hors ligne, confirmations)
 * - debug  : outils de développement uniquement
 */
export const zIndex = {
  nav: 40,
  sheet: 50,
  modal: 60,
  toast: 70,
  debug: 80,
} as const;

export type ZIndexLayer = keyof typeof zIndex;
