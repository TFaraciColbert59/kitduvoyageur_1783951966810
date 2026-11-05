# Brief de Tony (source de vérité, dans l'ordre)

1. « On doit améliorer cette maquette, je veux que les éléments sélectionnables soient plus gros, **modèle 3D de l'élément au centre**, son **nom en petit style Apple en bas à droite**, ça doit être des **cartes carrées par 3 maximum**, **défilement de droite à gauche** avec **sélecteur de catégorie en bas à droite**, **même style de drawer identique à ceux de la page Compte**. Ça prend la largeur et **le sac au-dessus au centre qui se repositionne de manière cinématique si besoin**. Ça ne doit plus être affiché sans drawer **style iOS 27 fournis par Apple**, hauteur max 20 % ; **la pilule en haut de l'écran avec le poids baisse à 2 px au-dessus du drawer** en s'ouvrant ; il remplace l'actuel ; **rien ne s'ouvre en haut, seulement en bas de l'écran**. »
2. « Améliore l'UI/UX front-end considérablement, visuellement. »
3. « Règle tous les bugs visuels, défauts visuels, ce qui ne fonctionne pas visuellement. Il y a des superpositions, des éléments trop gros pour leur emplacement. **Hauteur max des drawers à 40 %.** **Retire l'affichage du titre en dessous du sac quand on change de catégorie d'éléments.** »
4. « Tous les drawers ne sont pas à 40 % et les éléments dedans s'affichent mal. **Retire les couleurs que tu as mises en bordure.** »
5. « **Retire Commander, mets-le dans un drawer.** Retire tous les éléments inutiles comme le titre et sous-titre quand on clique sur les éléments du sac. Baisse la hauteur max de tous les drawers de 10 %. » → **30 %**.
6. Objectif final : audit, implémentation autonome par un agent de code avec sous-agents, économie maximale de crédits (Haiku / Sonnet / Opus, coordinateur Opus 5.5 effort élevé), budget 0 €, carte blanche, jusqu'à l'app sur son iPhone 16 Pro via Xcode.

## Interprétations figées (ne pas rouvrir)
- « Drawer iOS 27 fourni par Apple » : feuille à détente, poignée, verre ; réalisée **dans la WebView** (voir ADR-002). Pas de `UISheetPresentationController` natif en v1.
- 30 % s'applique à **tous** les tiroirs (cartes, Bilan, fiche objet, sac, commande, deck).
- Un seul tiroir à la fois ; ouvrir un contenu **remplace** le contenu du tiroir, il ne s'empile pas.
- Aucune couleur en bordure : l'état « sélectionné » se lit par la surface et la pastille ✓ en encre.
- « Titre sous le sac » : tout `hud`, `peek`, nom de kit, toast, bulle d'aide et bouton flottant est supprimé.
