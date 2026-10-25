# CARNET — alignement sur la référence Compte (25/10/2026, 14 h)

## 1. Référence remesurée

**Source :** `https://kitduvoyageur-1783951966810-izl5lz705.vercel.app/compte` — compte démo **`lea.fontaine`** connecté (18 publications, 50 abonnés, 34 abonnements, sac 9,4 kg), 430 × 932.

| Constat | Résultat |
|---|---|
| Géométrie des 17 ancres | **inchangée** : top 597,1 / carte 12-48-406×541,1 r24 / grille 406 gap 3, tuiles 134 r2 / sélecteur 88×30, lentille 41,5×25 / barre 14-868-402×48 |
| Tokens | inchangés (`--label #172B24`, `--tint #17402C`, `--page #F5F2EC`, `--sf`…) |
| Typographie | inchangée (base 14 / −0,14 ; stat 19/700 + libellé 10,5 ; bio 12/15,6) |
| Matière | inchangée (carte `.486→.384`, blur 25,2 sat 1,8 ; verre clair ; lentille `url(#lf…)`) |
| **Zone carte** | **a évolué** : carte réelle Esri/OSM + `border-radius: 32px 32px 0 0`, attribution 178,9 × 22 à (241,1 ; 838), contrôles de verre h34 (échelle en haut à gauche, colonne de contrôles à droite) |
| Captures | `ref-prod-latest.png`, `ref-prod-latest.json` (matière + typo complètes) |

## 2. Fiche carnet `/carnets/[id]`

| | Avant | Après |
|---|---|---|
| Hauteur | **1 298 px** qui défile | **932 = innerHeight** |
| Coquille | `.lkdv-feed-shell` + `.ckp-*` (variante) | `.lkdv-compte-v8 > .stage > .pwrap > .phone.hasnext` |
| Barre haute | `ckp-topbar` 406 × 38, boutons coupés à droite | `.ig-top` 406 × 36, pilule h34 + **3 ronds 38** (partager, enregistrer, commentaires) |
| Carte | 4 cartes empilées | **1 carte 406 × 541,1 r24**, scroll interne |
| Identité | cover 210 × 210 + 2 stats | **cover 66 + 3 stats 101 × 39 r14** (distance, dénivelé, j’aime), libellés en minuscules |
| Bio | 3 blocs | **2 lignes 378** (pays · dates · auteur / description) |
| Sections | capsule 5 onglets dans la carte | **5 anneaux 72 × 56** → drawers |
| Médias | bloc séparé | **grille 3 colonnes 406 gap 3, tuiles 134 r2** + bascule Grille/Liste 88 × 30 |
| Carte du parcours | feuille | **`.mapzone` 430 × 334,9** avec `CarnetTraceMap` (GPX réel), état vide honnête |
| Barre basse | 48 (déjà) | 48, **5 boutons 80 × 44** |
| Gestes conservés | like, favori, commentaires, partage, copie, export JSON, GPX, gestion, signalement, viewer, 5 sections | **tous**, relogés en pilule + 3 ronds + drawers |

**Porte : 19/19 ancres conformes** (`npm run design:fidelity -- /carnets/b2000000-…-011`).
Captures : `apres-carnet-fiche-430.png`, `apres-carnet-recit-430.png`, `apres-carnet-1440.png` ; avant : `avant-carnet-fiche-430.png` (1 298 px).

## 3. Mod `refonte` mis à jour

| Fichier | Ajout |
|---|---|
| `references/grammaire-compte.md` | **§0 « Où vit la grammaire »** (3 feuilles + runtime, ancêtres `.lkdv-compte-v8 > .stage > .pwrap > .phone`, extraits partageables, 6 pièges mesurés) · **§3.11 Zone carte** (Esri/OSM, r32, contrôles) · sources et date à jour · **§9 Précédents alignés** (`/pays/[code]`, `/carnets/[id]` — 19/19) |
| `SKILL.md` | imports exacts du socle, ancêtres obligatoires, commandes `design:fidelity` / `design:diff`, porte qui passe aussi sur `/compte` |

## 4. Preuves

| Route | Porte |
|---|---|
| `/compte` (référence) | **19/19** |
| `/pays/fr` | **19/19** |
| `/carnets/b2000000-…-011` | **19/19** |
| Tests carnet colocalisés | **33 / 33** |
| Tests pays + discovery + geo | **192 / 192** (6 ignorés) |
| Erreurs console (3 écrans) | 0 |

## 5. Reste à faire

| Lot | État |
|---|---|
| **Hub `/carnets`** | **encore legacy** : 17 px blanc, 56 198 px de haut, deux barres superposées (capsule Explorer/Mes carnets + barre globale). À remonter sur la grammaire : top bar (recherche + Écrire), carte 541 (titre, 3 stats, anneaux de filtres, grille de couvertures), barre 48. |
| Drawers | `CarnetStorySection` / `CarnetKitSection` dessinent encore une carte `.ckp-*` dans la feuille → à passer en contenu simple. |
| Carte | brancher les contrôles de la nouvelle référence (échelle, calques, zoom) sur `CarnetTraceMap`. |
| Recette | invité, carnet sans photo, carnet sans trace, propriétaire, 768/1440, diff pixel par section. |
