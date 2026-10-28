---
name: lkdv-explorer-v2-sheet
description: Use when building or changing the Explorer v2 bottom sheet, its detents, tabs, lens, mini selector, headers, toasts or any drawer content kind.
---
# Tiroir Explorer v2

- Composer à partir de l’existant : `DrawerShell`, `LensPager`, `SlotSelector` (`src/components/compte/drawer/**`) et `CapsuleTabs`. Créer `ExplorerSheet` seulement pour les crans (peek 168 px, low 300, mid 52 vh, full 88 vh).
- Glisser : framer-motion `drag="y"` avec contraintes, relâchement vers le cran le plus proche en tenant compte de la vélocité (> 600 px/s = cran suivant). Le contenu ne défile qu’au cran `full` ou dans le volet actif (`overscroll-behavior: contain`).
- En-tête : titre, sous-titre sans doublon avec les tuiles, au plus 2 boutons ronds icône seule (`aria-label` obligatoire).
- Onglets : actif = icône + libellé, autres = icône seule ; table icônes `09_DESIGN.md §2` ; libellés courts (`Départs`, `Carnets`, `Empreinte`, `Eau`, `Randos`).
- Mini-sélecteur : seulement Région (été/hiver), Lieu (2D/3D), Itinéraire (carte/survol).
- Un fichier par type dans `sheet/kinds/`. Chaque bloc de données a 3 états : chargement (squelette à la forme exacte), vide (texte prévu), données.
- Pas de voile, pas de croix, pas de modal plein écran. Fermeture : poignée, re-toucher l’onglet actif, Échap, toucher la carte.
- Toast : sous l’Island, 2,7 s, `role="status"` ; jamais de contenu dans l’Island quand l’app est au premier plan.
