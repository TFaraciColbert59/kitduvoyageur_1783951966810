# Traçabilité — améliorations Communauté vs design de référence Compte

**Date :** 2026-10-26
**Statut :** revue avant implémentation — aucun code
**Référence :** `/compte`, viewport 430×932, grammaire mesurée le 25/10/2026.
**Règle :** une amélioration sans ancre Compte est **écartée** ou passe en revue produit. On ne l’invente pas.

## Légende

- **EXACT** : même primitive, même valeur mesurée → applicable.
- **ADAPTÉ** : même primitive, dimension dérivée d’une ancre → applicable après mesure.
- **SANS RÉFÉRENCE** : aucune ancre Compte → ne pas appliquer sans décision produit.
- **CONTRAINTE** : règle utilisateur (pas de titre/sous-titre/libellé) → applicable mais non issue du Compte.
- **PERF** : règle technique, pas une valeur visuelle.

## Ancres de référence

| Ancre | Sélecteur | Valeur |
|---|---|---|
| Écran verrouillé | `.lkdv-account` | 430×932, `overflow:hidden` |
| Barre haute | `.ig-top` | 12 / 6 / 406×36 |
| Pilule | `.ig-handle` | 109×34, r999, 16/600 |
| Boutons haut | `.ig-top-btn` | **38×38**, 3 boutons |
| Carte | `.card.cs` | 12 / 48 / **406×541**, r24 |
| Identité | `.ig-header` | 24 / 56 / 382×68 |
| Stats | `.ig-stat` | 100,7×38,5 |
| Bio | `.ig-bio` | 378, 12/15,6 |
| Anneaux | `.ig-hl` / `.ig-hl-ring` | 72×56 / 44 |
| Grille | `.ig-grid-wrap` / `.ig-tile` | 406, gap 3, 134 |
| Sélecteur | `.ig-tabs` / `.ig-th` | 88×30 / 41,5×25 |
| Barre basse | `.tb` / `.tb button` | 402×48 / 79,6×44, 5 items |
| Drawer | `AccountDrawerHost` | 406×541 |
| Verre | tokens | `--ga .185`, `--gb 7.2px` |
| Typo | tokens | base 14 ; label2 12,5 ; stat 10,5 ; onglet 10,8 ; anneau 9 ; barre 10 |
| Action post | `AccountActionPill` | 46×31 |
| Options post | rail | 38×38 |
| Fermer post | croix | 38×38 |

## 1. Feed

| Amélioration | Référence Compte | Verdict |
|---|---|---|
| Barre supérieure 4 px plus basse | `.ig-top` 406×36, padding 6/12/8 | EXACT (36 px, pas une valeur inventée) |
| Pilule « Pour toi » plus légère | `.ig-handle` 109×34, 16/600 | ADAPTÉ (largeur contenu) |
| Boutons `+`, recherche, cloche alignés | `.ig-top-btn` 38×38, positions 294/337/380 | EXACT |
| Badge notification à 45° | `.tb-badge` 16×16, ancré haut droite | ADAPTÉ |
| Rail Stories 10 px | `.ig-hl-row` gap 8 | SANS RÉFÉRENCE (8 px existe, 10 non) |
| Anneau non-vu 2 px | `.ig-hl-ring` 44, padding 2 | ADAPTÉ (épaisseur à mesurer) |
| Nom Story tronqué | `.ig-hl` libellé 9 px, ellipse | EXACT |
| Carte 406×541 | `.card.cs` 406×541, r24 | EXACT |
| Liseré interne carte | `.card.cs` r24, pas de bordure interne | SANS RÉFÉRENCE |
| Dégradé bas média 64 px | aucun dégradé de carte dans la grammaire | SANS RÉFÉRENCE |
| Capsule actions 3 boutons | `AccountActionPill` 46×31 | EXACT |
| Compteurs 11 px | `.ig-stat` libellé 10,5 ; `.tb` 10 | SANS RÉFÉRENCE (11 n’existe pas) |
| Compteurs tabulaires | `font-variant-numeric: tabular-nums` | EXACT (règle typo) |
| Barre basse remontée 2 px | `.tb` 402×48, bottom 0 | SANS RÉFÉRENCE (position fixe) |
| Cookies au-dessus barre | aucun élément cookies dans la grammaire | SANS RÉFÉRENCE |

## 2. Coquille Création

| Amélioration | Référence Compte | Verdict |
|---|---|---|
| Backdrop plus flou | pas de backdrop de drawer dans la grammaire | SANS RÉFÉRENCE |
| Feuille 28 px | `AccountDrawerHost` r24, 406×541 | SANS RÉFÉRENCE (28 ≠ 24) |
| Poignée 40×4 à 6 px | poignée du drawer Compte | ADAPTÉ (mesurer la poignée) |
| Sélecteur 6×44 | `.ig-tabs` 88×30 ; `.ig-top-btn` 38 | SANS RÉFÉRENCE (44 n’existe pas) |
| Lentille 40×30 | `.ig-th` 41,5×25 | SANS RÉFÉRENCE |
| Icônes inactives 42 % | tokens `--label2` / `--label3` | ADAPTÉ (utiliser tokens) |
| Formulaire 378 px | `.card-scroll` 378 de contenu | EXACT |
| Pager collé au footer | aucun pager dans la grammaire | SANS RÉFÉRENCE |
| Footer 64 px | `.tb` 48 ; footer non documenté | SANS RÉFÉRENCE |
| Fade scroll 12 px | pas de fade documenté | SANS RÉFÉRENCE |

## 3. Publication

| Amélioration | Référence Compte | Verdict |
|---|---|---|
| Aperçu vide 96 px | pas d’aperçu vide dans la grammaire | SANS RÉFÉRENCE |
| Icône crayon 28 px | `.ig-top-btn` 38 | SANS RÉFÉRENCE |
| Segmented 32 px | `.ig-tabs` 30 | ADAPTÉ (30 px) |
| Lentille verte | `.ig-th` + `--tint` | EXACT |
| Vide supprimé | carte 541, scroll interne | SANS RÉFÉRENCE (produit) |
| Pager 30×22 | `.ig-th` 41,5×25 | SANS RÉFÉRENCE |
| Footer 44 px | `.tb button` 44 de haut | ADAPTÉ |
| Dropzone 96 px | aucun champ média dans la grammaire | SANS RÉFÉRENCE |
| Bouton `+` 36 px | `.ig-top-btn` 38 | SANS RÉFÉRENCE (36) |
| Grille média 3 col | `.ig-grid` gap 3, tuile 134 | ADAPTÉ |
| Textarea 112 px | aucun textarea dans la grammaire | SANS RÉFÉRENCE |
| Lieu/tags 44 px | aucun champ texte documenté | SANS RÉFÉRENCE |
| Tags 28 px | `.ig-tabs` 30 | ADAPTÉ |
| Select audience 44 px | aucun select documenté | SANS RÉFÉRENCE |
| Toggles icônes | aucun toggle dans la grammaire | SANS RÉFÉRENCE |
| Date FR | format produit, pas visuel | SANS RÉFÉRENCE |

## 4. Story

| Amélioration | Référence Compte | Verdict |
|---|---|---|
| Vignette 9:16 92×164 | aucun format Story dans Compte | SANS RÉFÉRENCE |
| Dropzone 96 | aucun champ média | SANS RÉFÉRENCE |
| Overlay texte/lien 44 | aucun overlay | SANS RÉFÉRENCE |
| Selects 44 | aucun select | SANS RÉFÉRENCE |
| Toggle reshare | aucun toggle | SANS RÉFÉRENCE |
| Pager 30×22 | `.ig-th` 41,5×25 | SANS RÉFÉRENCE |
| Footer 44 | `.tb button` 44 | ADAPTÉ |

## 5. Carnet

| Amélioration | Référence Compte | Verdict |
|---|---|---|
| Vignette livre 40 | `.ig-top-btn` 38 | SANS RÉFÉRENCE (40) |
| Champs 44 | aucun champ documenté | SANS RÉFÉRENCE |
| Cover 88×88 | `.ig-avi-in` 58 / `.ig-tile` 134 | SANS RÉFÉRENCE |
| Dates 44 | aucun date picker | SANS RÉFÉRENCE |
| Départ/arrivée icônes | aucune icône de champ | SANS RÉFÉRENCE |
| Distance/D+ icônes | stats ont des valeurs, pas de stepper | SANS RÉFÉRENCE |
| Note étoile | aucun rating dans la grammaire | SANS RÉFÉRENCE |
| Nuits/voyageurs steppers | aucun stepper | SANS RÉFÉRENCE |
| Météo 44 | aucun champ | SANS RÉFÉRENCE |
| Tags 28 | `.ig-tabs` 30 | ADAPTÉ |
| Description 112 | aucun textarea | SANS RÉFÉRENCE |
| Visibilité select | aucun select | SANS RÉFÉRENCE |
| Pager 5×26 | `.ig-th` 41,5×25 | SANS RÉFÉRENCE |
| Footer 44 | `.tb button` 44 | ADAPTÉ |

## 6. Sortie

| Amélioration | Référence Compte | Verdict |
|---|---|---|
| Vignette 40 | `.ig-top-btn` 38 | SANS RÉFÉRENCE |
| Champs 44 | aucun champ | SANS RÉFÉRENCE |
| Select type 44 | aucun select | SANS RÉFÉRENCE |
| Lieu/rendez-vous icônes | aucune icône de champ | SANS RÉFÉRENCE |
| Aide remontée | pas d’aide de champ | SANS RÉFÉRENCE |
| Date FR | format produit | SANS RÉFÉRENCE |
| Durée 44 | aucun champ | SANS RÉFÉRENCE |
| Niveau select | aucun select | SANS RÉFÉRENCE |
| Distance/D+ steppers | aucun stepper | SANS RÉFÉRENCE |
| Participants stepper | aucun stepper | SANS RÉFÉRENCE |
| Sécurité 44 | aucun champ | SANS RÉFÉRENCE |
| Cover 88 | aucun cover carré | SANS RÉFÉRENCE |
| Pager 4×30 | `.ig-th` 41,5×25 | SANS RÉFÉRENCE |
| Footer 44 | `.tb button` 44 | ADAPTÉ |

## 7. Kit

| Amélioration | Référence Compte | Verdict |
|---|---|---|
| Recherche 44 | aucun champ recherche | SANS RÉFÉRENCE |
| Compteur N · kg | `.ig-stat` 10,5 | ADAPTÉ |
| Ligne 60 | `.ig-hl` 56,4 | ADAPTÉ |
| Photo 48 | `.ig-hl-ring` 44 / `.ig-avi-in` 58 | SANS RÉFÉRENCE |
| État 10 | `.ig-hl` libellé 9 / `.tb` 10 | ADAPTÉ |
| Cercle 24 | `.ig-top-btn` 38 | SANS RÉFÉRENCE |
| Liste 250 px | `.card-scroll` scroll interne | SANS RÉFÉRENCE |
| Score 14 | `.ig-stat` valeur 19 | SANS RÉFÉRENCE |
| Select modèle 40 | aucun select | SANS RÉFÉRENCE |
| Chips 30 | `.ig-tabs` 30 | EXACT (hauteur) |
| Éditeur custom 4 col | aucun formulaire | SANS RÉFÉRENCE |
| Liste custom 44 | `.tb button` 44 | ADAPTÉ |
| Cover 88 | aucun cover | SANS RÉFÉRENCE |
| Pager 3×30 | `.ig-th` 41,5×25 | SANS RÉFÉRENCE |

## 8. Club

| Amélioration | Référence Compte | Verdict |
|---|---|---|
| Vignette 40 | `.ig-top-btn` 38 | SANS RÉFÉRENCE |
| Nom 44 | aucun champ | SANS RÉFÉRENCE |
| Catégorie 44 | aucun select | SANS RÉFÉRENCE |
| Lieu 44 | aucun champ | SANS RÉFÉRENCE |
| Cover 88 | aucun cover | SANS RÉFÉRENCE |
| Description 112 | aucun textarea | SANS RÉFÉRENCE |
| Règles 96 | aucun textarea | SANS RÉFÉRENCE |
| Questions 44 | aucun champ | SANS RÉFÉRENCE |
| Post accueil 96 | aucun textarea | SANS RÉFÉRENCE |
| Confidentialité 44 | aucun select | SANS RÉFÉRENCE |
| Pager 4×30 | `.ig-th` 41,5×25 | SANS RÉFÉRENCE |
| Footer 44 | `.tb button` 44 | ADAPTÉ |

## 9. Post — Commentaires / Partage / Options

| Amélioration | Référence Compte | Verdict |
|---|---|---|
| Poignée 40×4 | poignée drawer | ADAPTÉ |
| Pillule 44 / avatar 32 / nom 12 | pillule post Compte 44, avatar 32 | EXACT |
| Croix 44 | `.ig-top-btn` 38 ; croix post 38 | SANS RÉFÉRENCE (44) |
| Squelettes commentaires | aucun skeleton dans la grammaire | SANS RÉFÉRENCE |
| Ligne commentaire 32/12/10 | `.ig-hl` 9 / `.ig-stat` 10,5 | ADAPTÉ |
| Actions 44 | `.ig-top-btn` 38 | SANS RÉFÉRENCE |
| Composer 44 | `.tb button` 44 | ADAPTÉ |
| Bouton envoyer 40 | `.ig-top-btn` 38 | SANS RÉFÉRENCE |
| Recherche 44 | aucun champ | SANS RÉFÉRENCE |
| Actions partage 44 | `.ig-top-btn` 38 | SANS RÉFÉRENCE |
| Ligne destinataire 56 | `.ig-hl` 56,4 | EXACT |
| Mini-capsule 3×44 | `.ig-tabs` 30 / `.tb` 44 | SANS RÉFÉRENCE |
| Fond panneau +0,15 | `--ga .185` | SANS RÉFÉRENCE |
| Rail options 44 | rail post 38 | SANS RÉFÉRENCE |
| Croix options 44 | croix post 38 | SANS RÉFÉRENCE |

## 10. Story viewer / options

| Amélioration | Référence Compte | Verdict |
|---|---|---|
| Progression 2 px | aucun viewer Story dans Compte | SANS RÉFÉRENCE |
| Pillule 44 | pillule post 44 | EXACT |
| Options 44 | `.ig-top-btn` 38 | SANS RÉFÉRENCE |
| Composer 44 | `.tb button` 44 | ADAPTÉ |
| Capsule like/partage 2×44 | `AccountActionPill` 46×31 | SANS RÉFÉRENCE |
| Cœur 20 | action pill icône 16 | SANS RÉFÉRENCE |
| Cookies masqués | aucun cookies | SANS RÉFÉRENCE |
| Rail options 44 | rail post 38 | SANS RÉFÉRENCE |
| Cercle vide supprimé | aucun cercle vide | SANS RÉFÉRENCE |

## 11. Transverse

| Amélioration | Référence Compte | Verdict |
|---|---|---|
| 12 px minimum partout | typo Compte : 9 / 10 / 10,5 / 10,8 / 12 | **REJETÉ** — contredit la référence |
| 44×44 universel | boutons haut 38, actions 46×31, barre 44 | **REJETÉ** — dépend du rôle |
| Blur 18/22/30 | `--gb 7.2px` | **REJETÉ** — non mesuré |
| Pager au-dessus du footer | aucun pager | SANS RÉFÉRENCE |
| Empty states enrichis | aucun empty state dans la grammaire | SANS RÉFÉRENCE |
| Date FR | format produit | SANS RÉFÉRENCE |
| Cibles 44 | dépend du rôle | ADAPTÉ par rôle |
| Textes 9–10 px conservés | tokens `--label2`, `--label3`, 9/10,5 | EXACT |
| Tokens couleurs | `--label`, `--label2`, `--tint` | EXACT |
| Tabular nums | règle typo | EXACT |

## Décision

- **À implémenter** : EXACT + ADAPTÉ, avec mesure de la primitive Compte.
- **À ne pas implémenter tel quel** : SANS RÉFÉRENCE, sauf décision produit explicite.
- **À corriger dans l’audit précédent** : le `12 px minimum` et le `44×44 universel` ne sont pas la grammaire Compte ; le Compte utilise 9–10,5 px pour les métadonnées et 38 px pour les boutons du haut.
- **Contrainte utilisateur** : aucun titre/sous-titre/libellé visible, indépendamment du Compte.

## Prochaine étape

Reprendre les éléments classés **EXACT/ADAPTÉ** uniquement, avec capture avant/après et `design:fidelity` sur `/compte` pour vérifier que la référence n’a pas bougé. Les autres attendent une décision produit.
