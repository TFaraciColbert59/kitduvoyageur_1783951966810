# Carnet vs Profil — liste complète des différences (2ᵉ passe)

**Date :** 24 octobre 2026
**Méthode :** captures côte à côte fournies par l'utilisateur + `getComputedStyle` sur `/compte` et `/carnets/[id]` en production, 430 × 932.
**Constat :** la fiche a hérité des *tokens* du Compte mais pas de sa *composition*. Les blocs ne sont pas les mêmes, et trois matières manquent : les anneaux, la pilule bordée, le toggle.

---

## 1. Différences de composition (blocs)

| # | Bloc | Compte | Carnet | Verdict |
|---|---|---|---|---|
| 1 | Titre dans la carte | **aucun** — l'identité est la pilule du haut | `h2` 19/700 + ligne méta 11 | **bloc en trop** |
| 2 | Ligne auteur | **aucune** (le profil est le propriétaire) | pastille `pmi-author` 28 + score + badge Vérifié | **bloc en trop** |
| 3 | Bio | **une ligne** `Lille · Compte de démonstration…` (lieu · texte) puis le texte | ligne méta + bio séparées | à fusionner en une ligne 12 px |
| 4 | Actions rapides | rangée `ig-hl-row` **5 colonnes**, 3 remplies | 3 actions, `gap 8` | même compte, écart 4 px |
| 5 | Grille | dans la carte, pleine largeur, **+ toggle 30 en bas à droite** | dans la carte, **sans toggle** | **toggle manquant** |
| 6 | Carte carte/plan | carte séparée sous le profil, plein cadre | volet dans le drawer | structure différente |

## 2. Différences de matière et de forme

| # | Élément | Compte (mesuré) | Carnet (mesuré) | Écart |
|---|---|---|---|---|
| 7 | Visuel d'identité | cercle **66**, `padding 2.5`, **anneau conique** `conic-gradient(#17402C,#5B7F55,#96B391,#3D7A52)`, ombre `0 3px 14px rgba(23,64,44,.14)` | carré **66 r18**, aucun anneau | **forme + matière** |
| 8 | Bouton d'action | anneau **44** en `linear-gradient(145deg, rgba(23,64,44,.55), rgba(91,127,85,.35), rgba(255,255,255,.85))`, disque intérieur **40** `rgba(244,247,243,.88)` + **bord 1,5 px blanc**, libellé **9,8/500** | cercle plein `rgba(255,255,255,.5)`, libellé 9/500 | **anneau + disque manquants** |
| 9 | Pilule du haut | **176 × 34**, fond `rgba(255,255,255,.14)`, **bord 1 px `rgba(255,255,255,.3)`**, **700 16/1**, `ls -.025em`, padding `0 11`, **sans vignette** | **40** de haut, fond `.5`, sans bord, **600 13**, vignette 32 | **forme, typo, fond** |
| 10 | Barre du haut | `padding 6px 12px 8px`, hauteur utile **48** | `padding 8px`, hauteur **56** | 8 px |
| 11 | Boutons ronds du haut | 38, verre `.5`, **filtre liquid-glass `.lg`** (bord de réfraction) | 38, verre `.5`, sans `.lg` | matière (léger) |
| 12 | Cellule de stat | **101 × 39**, `padding 2px 3px`, rayon 14 | 100 × 39, `padding 0 6px` | 1 px + padding |
| 13 | Tuile | 134, r2, gap 2 — idem | idem | ✅ |
| 14 | Barre basse | 402 à x14, **lentille visible sur l'onglet actif** | 402 à x14, **aucune lentille** | état actif |
| 15 | Carte | `padding 0`, enfants inset 14, hauteur **541** (zone vide sous la grille) | `padding 14`, hauteur automatique | structure de padding |
| 16 | Ombres de carte | `inset 0 1px 0 #fff95`, `inset 0 -1px 1px #fff66`, `0 0 0 .5px rgba(23,43,36,.08)` | `inset 0 1px 0`, `0 0 0 .5px`, `0 10px 26px` | une ombre en plus (externe) |

## 3. Différences de comportement visuel

| # | Comportement | Compte | Carnet |
|---|---|---|---|
| 17 | Appui sur un bouton | `scale(.95)` / `scale(.92)` sur l'anneau | `scale(.94)` sur le disque |
| 18 | Anneau de story | conique animé quand « live » | absent |
| 19 | Toggle | bascule grille ↔ carte dans la carte | absent |
| 20 | Lentille de la barre basse | glisse vers l'onglet actif | masquée (aucun onglet actif) — **décision à confirmer** |

---

## 4. Traduction « identique » (ce que devient chaque bloc du carnet)

| Bloc du carnet | Devient |
|---|---|
| Pilule (cover 32 + titre 13) | **pilule 34, 700/16, bord 1 px, fond .14, sans vignette** — le titre du carnet y vit seul |
| `h2` titre dans la carte | **supprimé** |
| Ligne destination · dates | **fusionnée** dans la ligne bio (« Vercors, France · 5 oct. – 12 oct. 2026 · Marie Aubry ») |
| Pastille auteur + score + badge | **supprimés** de la carte (l'auteur rejoint la ligne bio) |
| Bio | **12/1.3**, 2 lignes max, même position que le Compte |
| Cover carrée r18 | **cercle 66 avec anneau conique**, image en `object-fit: cover` |
| 3 actions en cercles pleins | **3 anneaux 44 + disques 40**, libellés 9,8 |
| Grille sans toggle | grille **+ toggle 30** grille/carte, carte Leaflet dans la carte |
| Volet Parcours du drawer | **supprimé** (la carte revient dans la carte, comme le Compte) |
| Drawer | volets Commentaires / Partage / Gérer (3) |
| Barre basse | inchangée (402 à x14) ; lentille : **aucun onglet actif** (la fiche n'est pas un onglet) |

---

## 5. Plan d'amélioration (6 lots)

1. **Pilule et barre du haut** — pilule 34 / 700 16 / bord 1 px / fond .14 / sans vignette ; barre `padding 6 12 8`, hauteur 48.
2. **Couverture en anneau** — cercle 66, `padding 2.5`, `conic-gradient` identique, image intérieure ronde, ombre du Compte.
3. **Actions en anneaux** — anneau 44 + disque 40 (`rgba(244,247,243,.88)`, bord 1,5 px blanc), badge de compteur conservé sur l'anneau, libellé 9,8/500, `gap 4`.
4. **Carte sans titre ni auteur** — suppression du `h2`, de la méta et de la pastille auteur ; ligne bio unique (lieu · dates · auteur) + description 12 px sur 2 lignes.
5. **Toggle grille/carte** — capsule 30 en bas à droite de la grille, mode carte Leaflet 1:1 dans la carte, GPX dans ce mode ; suppression du volet Parcours.
6. **Finitions** — cellule de stat 101×39 / padding 2/3 ; ombre de carte sans l'ombre externe ; `scale` d'appui `.95` ; recette mesurée + captures + déploiement.

**Hors périmètre conservé :** bouton retour (une fiche est une page de détail), lentille de la barre basse (aucun onglet actif), `ReportSheet` partagé.
