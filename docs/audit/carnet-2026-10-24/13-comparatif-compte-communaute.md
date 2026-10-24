# Fiche carnet vs Compte / Communauté — comparatif mesuré

**Date :** 24 octobre 2026
**Méthode :** production (`kitduvoyageur-…-3mppq3dod.vercel.app`), viewport 430 × 932, `getBoundingClientRect` + `getComputedStyle` sur les éléments rendus. Aucune valeur reprise de la spec : tout est mesuré.
**Référence :** `/compte` (carte profil, drawers, capsule) et `/communaute` (post, capsule d'actions, panneaux).

---

## 1. Colonne et cartes

| Élément | Compte | Communauté | Fiche actuelle | Écart |
|---|---|---|---|---|
| Colonne | 430, gouttière **12** | 430, gouttière **10** | 430, gouttière **10** | fiche ≠ Compte de 4 px |
| Carte | **406 × n, r 24** | post **410 × 410, r 28** | **410, r 28** | fiche suit le post, pas le Compte |
| Verre de carte | `blur(25.2) saturate(1.8) brightness(1.05)` | idem | idem | ✅ |
| Ombre | `inset 0 1px 0 #fff95 + 0 0 0 .5px rgba(23,43,36,.10)` | idem | idem | ✅ |
| En-tête | 40 (pilule) + gbtn 38 | 56 (8 + 40 + 8) | **54** (8 + 38 + 8) | pilule fiche 34 au lieu de 40 |

## 2. Carte d'identité (Compte) vs carte carnet

| Élément | Compte | Fiche | Écart |
|---|---|---|---|
| Avatar / couverture | cercle **66** | carré **96 r18** | forme et taille différentes (assumé : le carnet a une couverture) |
| Statistiques — valeur | **19 px / 700**, `letter-spacing -0.38px` | 17 px / 700 | **2 px** |
| Statistiques — libellé | **10,5 px / 500**, `#56665d`, **sans majuscules** | 9,5 px / 600, **majuscules** + `letter-spacing .06em` | typo + casse |
| Cellule statistique | bouton `ig-stat` **101 × 39, r 14** (3 cellules cliquables) | simple `div` sans fond ni rayon | structure |
| Bio | **12 px / 1.3**, `#56665d` | 13,5 px / 1.45, encre | 1,5 px et couleur |
| Actions rapides | **3 cercles 44 + libellé 9/500** (`ig-hl` 72 × 56) | **pilules 36** avec icône + compteur | grammaire différente |
| Grille de médias | **dans** la carte, wrap `ig-grid-wrap` 406 **r 22**, tuiles **134 px r 2**, gap 2 | **hors** carte, 410, tuiles 135 px **r 0** | structure + rayon |
| Sélecteur de sections | capsule **378 × 48**, lentille **74 × 40**, **icônes seules** | capsule 382 × 48, lentille 74 × 40, **icône + libellé** | libellés en plus |
| Barre basse | **402 × 48** à x14 | **410 × 48** à x10 | 8 px |

## 3. Post (Communauté) vs fiche

| Élément | Communauté | Fiche | Écart |
|---|---|---|---|
| Auteur | `.pmi-author` sur la photo, avatar 28, nom 12/600 + handle 10,5 | `.pmi-author` dans la carte, avatar 32 | taille d'avatar 28 vs 32 |
| Actions | capsule verre **116 × 40**, boutons **34 r50** | pilules 36 hors capsule | grammaire |
| `···` | **34 r999** en haut à droite de la photo | `gbtn` **38** dans la top bar | taille et position |
| Compteurs | aucun dans la capsule | compteurs dans les pilules | la référence n'affiche pas de compteur sur le média |

## 4. Drawers, sous-drawers, sélecteurs — **la divergence majeure**

### Compte — drawer en place dans la carte

Mesuré sur le drawer Profil et le drawer Compte :

| Élément | Valeur mesurée |
|---|---|
| Conteneur | `#sheet` = **la carte elle-même** : 406 × 541, **r 24**, fond transparent (le verre de la carte reste) |
| Voile | `.scrim` **à l'intérieur de la carte**, `rgba(255,255,255,.06)` — aucun assombrissement de page |
| Poignée | zone `.grab` **18 px** en haut du sheet |
| Sélecteur | `lkdv-capsule` **378 × 48**, lentille 74 × 40, **uniquement des icônes**, 5 cellules |
| Sous-sélecteur | capsule flottante **30 px** en bas à droite (`ig-tabs-float`), 3-4 icônes |
| En-tête | **aucun titre, aucun bouton fermer** ; fermeture par la capsule ou la poignée |
| Contenu | état vide centré : titre 15/700, texte 11,5, **pilule 36 primaire** |

### Communauté — panneau en place dans le post

| Élément | Valeur mesurée |
|---|---|
| Conteneur | `.lkdv-post-panel-slot` **410 × 346, r 28**, à l'intérieur du post (à 64 px du haut) |
| En-tête | aucun |
| Fermeture | geste (aucun bouton `aria-label` de fermeture) |
| Composition | composer **collé en bas du panneau** : champ pilule 36 + envoi rond 34 vert |

### Fiche — feuille plein écran

| Élément | Valeur mesurée |
|---|---|
| Conteneur | `.lkdv-overlay-sheet` **414 × 916** à (8, 8), **r 26** |
| Voile | `.lkdv-overlay-scrim` plein écran, `rgba(10,20,14,.32)` + `blur(6px)` |
| En-tête | **52 px** avec titre 15 et bouton fermer **32** |
| Corps | 412 × 805 |
| Pied | 57 px (composer) |

**Conclusion :** la fiche n'utilise ni la grammaire Compte ni celle de la Communauté pour ses drawers. Elle empile un modal plein écran avec voile sombre, titre et croix, là où les deux références remplacent **le contenu de la carte hôte** avec une poignée, un sélecteur 48 et un sous-sélecteur 30, sans titre ni croix.

## 5. Ce qui est identique (à ne pas toucher)

- `.gbtn` : 38 × 38, r 50 %, `rgba(255,255,255,.5)`, `blur(4) sat 1.9 brightness 1.07` — identique sur les trois pages.
- `.pmi-post-btn` : 34 × 34, r 50 % — identique.
- `.pmi-options-menu` : 226 px, lignes 44 — identique.
- Capsule 48 : `.lkdv-capsule`, lentille `calc((100%-6px)/n)`, glissement 420 ms — identique.
- Barre basse : `.tb` 48 px, lentille 40 — identique (seule la largeur diffère de 8 px, à cause de la gouttière).
- Fond, verre, encre `#17402c`, muted `#56665d`, like `#e0245e` — identiques.

## 6. Synthèse des écarts

| # | Écart | Gravité | Nature |
|---|---|---|---|
| 1 | Drawers en modal plein écran au lieu du drawer en place (poignée + capsule + sous-capsule) | **P0** | grammaire |
| 2 | Grille de moments hors carte au lieu d'être dans la carte (wrap r 22) | **P1** | structure |
| 3 | Actions en pilules 36 au lieu de cercles 44 + libellé (Compte) | **P1** | grammaire |
| 4 | Statistiques 17/700 + label 9,5/600 majuscules au lieu de 19/700 + 10,5/500 | **P1** | typo |
| 5 | Carte r 28 et colonne 410 au lieu de r 24 et 406 | **P1** | géométrie |
| 6 | Tuiles r 0 au lieu de r 2 | **P2** | géométrie |
| 7 | Pilule de titre 34 au lieu de 40 (en-tête 54 au lieu de 56) | **P2** | géométrie |
| 8 | Capsule de sections avec libellés au lieu d'icônes seules | **P2** | grammaire (choix assumé à valider) |
| 9 | Bio 13,5 px au lieu de 12 px | **P2** | typo |
| 10 | Avatar auteur 32 au lieu de 28 | **P3** | géométrie |
