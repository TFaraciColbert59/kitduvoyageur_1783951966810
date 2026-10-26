# Audit élément par élément — drawers et sous-drawers Communauté

**Date :** 2026-10-26
**Version auditée :** Worker `https://kitduvoyageur.faracitonyp.workers.dev` après déploiement des formulaires v2.
**Captures :** `docs/communaute/audit-elements/` (29 PNG).
**Règle :** aucune amélioration ne consiste à ajouter un titre, un sous-titre ou un libellé visible. On corrige par la forme, l’icône, l’espace, le contraste, la position ou l’état.

---

## 1. Feed / page Communauté

| Élément | Amélioration visuelle |
|---|---|
| Barre supérieure | Réduire sa hauteur de 4 px et aligner ses trois boutons sur une même ligne optique à 44 px. |
| Pilule « Pour toi » | Poser un chevron plus petit et plus proche du texte, avec une lentille de 1 px autour. |
| Bouton `+` | Unifier son verre avec les deux autres boutons et retirer le halo bleu. |
| Bouton recherche | Même taille et même ombre que `+` ; icône à 18 px. |
| Bouton notifications | Décoller le badge du bord et le placer à 45° sans dépasser le cercle. |
| Rail Stories | Ramener l’écart entre avatars à 10 px et réserver 64 px sous chaque anneau. |
| Anneau Story | Épaissir l’anneau non-vu à 2 px et désaturer l’anneau vu. |
| Nom sous Story | Tronquer à 9 caractères avec fade à droite, sans changer la hauteur du rail. |
| Carte post | Garder 406×541 et ajouter un liseré interne de 0,5 px pour détacher la carte du fond. |
| Média de carte | Poser un dégradé bas de 64 px pour garantir la lisibilité de la capsule d’actions. |
| Capsule d’actions | Réduire l’écart entre les trois boutons à 1 px et aligner les compteurs sur la même baseline. |
| Compteur like | Passer le chiffre en 11 px medium et le cœur en 17 px. |
| Compteur commentaire | Même graisse que le like, sans dépasser 2 chiffres visibles. |
| Compteur partage | Aligner l’icône et le chiffre à 6 px, comme les deux autres. |
| Barre basse | Remonter la barre de 2 px et réduire l’opacité du fond de 4 %. |
| Bandeau cookies | Le décaler au-dessus de la barre basse et réduire sa largeur à 390 px. |

## 2. Drawer Création — coquille

| Élément | Amélioration visuelle |
|---|---|
| Backdrop | Augmenter le flou de 2 px et baisser l’opacité noire de 0,05. |
| Feuille | Poser une bordure interne blanche de 0,5 px et un rayon de 28 px constant. |
| Poignée | Centrer à 40×4 px et la remonter à 6 px du bord. |
| Sélecteur 6 types | Réduire la capsule à 6×44 px, icônes à 18 px, écart 0. |
| Icône active | Ajouter une lentille blanche de 40×30 px et une ombre douce. |
| Icônes inactives | Passer à `rgba(23,64,44,.42)` pour un contraste homogène. |
| Zone formulaire | Borner la largeur à 378 px et supprimer le vide vertical supérieur à 24 px. |
| Pager d’étapes | Le poser sur le bord supérieur du footer, plus jamais au milieu du contenu. |
| Footer | Passer à 64 px, bouton à 44 px de haut, marge basse safe-area. |
| Scroll | Ajouter un fade de 12 px en haut et en bas de la zone scrollable. |

## 3. Publication — 4 étapes

### Étape 1 — Format
| Élément | Amélioration visuelle |
|---|---|
| Aperçu vide | Remplacer la grande carte blanche par une vignette 4:3 à 96 px, centrée. |
| Icône crayon | La poser dans un disque de 28 px, pas dans une carte de 378 px. |
| Segmented Photo/Billet/Question/Événement | Passer les options en capsules de 32 px, écart 4, icône + texte 11 px. |
| Option active | Lentille vert foncé, texte blanc, ombre interne. |
| Vide sous les options | Supprimer 180 px de vide en centrant le bloc format. |
| Pager | Le coller au footer et réduire les pastilles à 30×22 px. |
| Footer Continuer | Hauteur 44 px, rayon 14, texte 13 px. |

### Étape 2 — Médias
| Élément | Amélioration visuelle |
|---|---|
| Dropzone | Passer à 96 px de haut, bord pointillé 0,75 px, fond blanc 0,55. |
| Bouton `+` | Le poser dans un disque 36 px centré, sans bordure. |
| Compteur médias | Le placer à droite de la dropzone, 10 px, opacité 0,65. |
| Aperçu média | Ajouter une grille 3 colonnes, coins 10 px, cover au centre. |
| Bouton Retour | Même hauteur que les pastilles, à gauche du pager. |
| Vide | Supprimer le grand blanc sous la dropzone. |

### Étape 3 — Détails
| Élément | Amélioration visuelle |
|---|---|
| Textarea | Hauteur 112 px, fond blanc 0,72, placeholder 12 px. |
| Champ lieu | Icône épingle à gauche, hauteur 44 px. |
| Champ tags | Icône dièse à gauche, hauteur 44 px. |
| Suggestions tags | Capsules 28 px, écart 4, texte 10 px. |
| Compteur 0/10 | Le coller à droite du champ tags, 10 px. |
| Pager | Même position que les autres étapes, sans chevaucher les tags. |

### Étape 4 — Publication
| Élément | Amélioration visuelle |
|---|---|
| Select audience | Hauteur 44, chevron 16, fond blanc 0,8. |
| Toggle commentaires | Mettre une icône bulle dans le pouce et colorer l’état actif. |
| Toggle likes | Mettre une icône cœur dans le pouce et colorer l’état actif. |
| Date de planification | Forcer le format `JJ/MM/AAAA`, icône calendrier à droite, 44 px. |
| Texte d’aide planification | Le supprimer visuellement ou le réduire à 10 px. |
| Pager | Le poser au-dessus du footer, sans recouvrir la date. |
| Footer Publier | Passer en 44 px, pleine largeur, sans marge latérale. |

## 4. Story — 3 étapes

| Élément | Amélioration visuelle |
|---|---|
| Aperçu vide | Vignette 9:16 à 92×164 px, centrée, fond verre. |
| Dropzone | Même traitement que Publication, 96 px. |
| Overlay texte | Champ 44 px avec icône `T` à gauche. |
| Overlay lien | Champ 44 px avec icône lien à gauche. |
| Select audience | 44 px, chevron 16. |
| Select réponses | 44 px, icône réponse à gauche. |
| Toggle reshare | Pouce avec icône partage, état actif vert. |
| Pager | 3 pastilles de 30×22, collées au footer. |
| Footer | 44 px, label court, sans débordement. |

## 5. Carnet — 5 étapes

| Élément | Amélioration visuelle |
|---|---|
| Vignette livre | Disque 40 px, icône 18 px, pas de carte 378 px. |
| Champ titre | 44 px, placeholder 12 px, fond blanc 0,78. |
| Champ destination | Icône épingle à gauche, 44 px. |
| Cover | Dropzone carrée 88×88 à gauche du bloc, pas pleine largeur. |
| Compteur médias | À droite de la cover, 10 px. |
| Dates | Deux champs 44 px, icône calendrier, écart 6. |
| Départ / arrivée | Icônes `flag` et `map-pin` dans les champs, sans label visible. |
| Distance / D+ | Icônes `route` et `mountain`, steppers 38 px. |
| Note d’itinéraire | Select 44 px, étoile à gauche, valeur à droite. |
| Nuits / voyageurs | Steppers 38 px avec icônes lit et personnes dans les boutons. |
| Météo | Champ 44 px avec icône soleil/nuage. |
| Tags | Capsules 28 px, écart 4, compteur à droite. |
| Description | 112 px, compteur en bas à droite. |
| Visibilité | Select 44 px, icône œil à gauche. |
| Pager 5 étapes | Pastilles 26×22, écart 3, collées au footer. |
| Footer | 44 px, sans chevauchement de la description. |
| Vide | Supprimer le blanc entre cover et dates. |
| Scroll | Fade bas de 12 px au-dessus du pager. |

## 6. Sortie — 4 étapes

| Élément | Amélioration visuelle |
|---|---|
| Vignette bottine | Disque 40 px, icône 18 px. |
| Champ titre | 44 px, placeholder 12 px. |
| Select type | 44 px, icône activité à gauche. |
| Champ lieu | Icône épingle, 44 px. |
| Point de rendez-vous | Icône drapeau, 44 px, marge sous le champ. |
| Aide sous le champ | La remonter au-dessus du pager, jamais coupée. |
| Date | 44 px, icône calendrier, format local. |
| Durée | 44 px, suffixe `j` discret. |
| Select niveau | 44 px, icône montagne. |
| Aide niveau | La réduire à 10 px et l’aligner sous le select. |
| Distance / D+ | Icônes `route`/`mountain`, steppers 38 px. |
| Participants | Stepper 38 px, icône personnes dans les boutons. |
| Sécurité | Champ 44 px, icône bouclier. |
| Cover | Dropzone 88×88, pas pleine largeur. |
| Pager | 4 pastilles 30×22, collées au footer. |
| Footer | 44 px, sans recouvrir l’aide. |

## 7. Kit — 3 étapes

| Élément | Amélioration visuelle |
|---|---|
| Recherche | 44 px, icône 16, placeholder 11 px, compteur à droite. |
| Compteur sélection | `N · kg` en 10 px, aligné à droite, sans retour à la ligne. |
| Ligne produit | 60 px, photo 48, nom 12, état 10, écart 10. |
| Photo produit | Coins 11 px, fond 0,08, image cover. |
| État/usure | Passer « Neuf/Usé » en 10 px, capitales initiales, opacité 0,7. |
| Cercle de sélection | 24 px, bord 1 px, check blanc sur vert. |
| Liste | Max-height 250 px, fade bas, scroll contenu. |
| Score de complétude | Passer le `0 %` en 14 px, barre 42×5, écart 6. |
| Select modèle | 40 px, chevron 16, fond blanc 0,7. |
| Chips catégories | 30 px, écart 4, texte 10 px, icône `+` à gauche. |
| Éditeur custom | Grille 4 colonnes, champs 38 px, bouton `+` 44 px. |
| Liste custom | Lignes 44 px, nom 11, méta 9, bouton `×` 30 px. |
| Cover | Dropzone 88×88, pas pleine largeur. |
| Pager | 3 pastilles 30×22, collées au footer. |

## 8. Club — 4 étapes

| Élément | Amélioration visuelle |
|---|---|
| Vignette club | Disque 40 px, icône 18 px. |
| Champ nom | 44 px, placeholder 12 px. |
| Catégorie | 44 px, icône tag à gauche. |
| Lieu | 44 px, icône épingle. |
| Cover | Dropzone 88×88, pas pleine largeur. |
| Description | 112 px, compteur bas droite. |
| Règles | 96 px, fond blanc 0,7, compteur. |
| Questions d’adhésion | Trois champs 44 px, puces 1/2/3 à gauche. |
| Post d’accueil | 96 px, compteur. |
| Confidentialité | Select 44 px, icône cadenas. |
| Pager | 4 pastilles 30×22, collées au footer. |
| Footer | 44 px, sans recouvrir les questions. |

## 9. Drawer Post — Commentaires

| Élément | Amélioration visuelle |
|---|---|
| Poignée | 40×4, à 6 px du haut. |
| Pillule auteur | 44 px, avatar 32, nom 12, méta 10. |
| Croix | 38→44 px, verre plus opaque, ombre douce. |
| Zone de chargement | Remplacer le contenu fantôme par 3 squelettes de commentaires. |
| Ligne commentaire | Avatar 32, nom 12, texte 12, méta 10, écart 8. |
| Actions commentaire | Icônes 16 px, cibles 44 px, couleur 0,7. |
| Composer | 44 px, fond blanc 0,95, placeholder 12. |
| Bouton envoyer | 40×40, flèche 16, désactivé à 0,35. |

## 10. Drawer Post — Partage

| Élément | Amélioration visuelle |
|---|---|
| Recherche | 44 px, icône 16, placeholder 11. |
| Trois actions | 44×44, écart 8, verre homogène, icônes 19. |
| Ligne destinataire | 56 px, avatar 32, nom 12, type 10. |
| Bouton envoyer | 44×44, flèche 16, pas de texte. |
| Mini-capsule | 3×44 px, collée au bas du panneau, sans chevaucher la dernière ligne. |
| Fond | Augmenter l’opacité de 0,15 pour supprimer le ghost du post. |
| Dernière ligne | Ajouter un padding bas de 56 px pour la mini-capsule. |
| Croix | 44 px, alignée avec la recherche. |

## 11. Drawer Post — Options

| Élément | Amélioration visuelle |
|---|---|
| Croix | 44 px, verre identique aux options. |
| Rail | Icônes 38→44 px, écart 8, aligné à droite. |
| Bookmark | Fond blanc 0,7, icône 18, ombre interne. |
| Lien | Même taille, même verre, icône 18. |
| Repeat | Même taille, même verre, icône 18. |
| Flag | Même taille, couleur danger à 0,8. |
| Position | Rail à 8 px du bord droit, sous la croix, sans dépasser la carte. |

## 12. Story viewer

| Élément | Amélioration visuelle |
|---|---|
| Progression | Épaissir à 2 px, espace 3 px, fond noir 0,25. |
| Pillule auteur | 44 px, avatar 32, nom 12, méta 10, fond verre 0,55. |
| Options | Cercle 44 px, icône 18, verre 0,5. |
| Composer | 44 px, verre blanc 0,72, placeholder 12. |
| Capsule like/partage | 2×44 px, écart 4, verre identique au composer. |
| Cœur | 20 px, rose si actif, animation 0,46 s. |
| Partager | 20 px, flèche, cible 44. |
| Bandeau cookies | Le masquer pendant le viewer ou le décaler au-dessus du composer. |

## 13. Story options

| Élément | Amélioration visuelle |
|---|---|
| Déclencheur | 44 px, icône `···` 18, fond verre 0,55. |
| Lien | 44 px, icône 18, fond verre identique. |
| Repeat | 44 px, icône 18, fond identique. |
| Flag | 44 px, icône 18, couleur danger. |
| Cercle vide | Supprimer tout cercle sans icône visible. |
| Rail | Écart 8, aligné à droite, sans déborder sur l’image. |

## 14. Problèmes transverses

| Élément | Amélioration visuelle |
|---|---|
| Vide dans les formulaires | Centrer verticalement le contenu de l’étape quand elle contient moins de 3 champs. |
| Pager | Le fixer au-dessus du footer, jamais dans la zone scrollable. |
| Contenu coupé | Ajouter un padding bas de 56 px à chaque pane pour le pager. |
| Ghost des panneaux | Augmenter l’opacité du verre et réduire le blur à 18 px. |
| Champs sans repère | Ajouter une icône à gauche (épingle, route, montagne, lit, personnes, calendrier), jamais un libellé. |
| Toggles | Mettre une icône dans le pouce (bulle, cœur, partage). |
| Dates | Forcer le format français et une icône calendrier. |
| Textes secondaires | Passer tous les 9–10 px à 11–12 px. |
| Cibles | Passer toutes les cibles 38 px à 44 px. |
| Cookie banner | Le sortir des drawers ou le décaler au-dessus du footer. |
