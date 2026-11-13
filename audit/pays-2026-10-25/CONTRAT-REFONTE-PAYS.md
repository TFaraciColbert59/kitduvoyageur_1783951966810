# CONTRAT DE REFONTE — `/pays/[code]`

**Date :** 25 octobre 2026 · **Référence :** grammaire Compte mesurée (`grammaire-compte.md`, 25/10/2026, 430 × 932)
**Audit complet :** `AUDIT-PAYS.md` (même dossier)

---

## 1. Intention

La fiche pays devient un **écran verrouillé de la grammaire Compte** : une carte de 541 px qui contient l'identité du pays et son contenu, un fond photo plein écran, une barre haute de 36 px, une barre basse de 48 px, des drawers pour le reste. On ne refait ni les routes, ni les données, ni les huit sections.

**Phrase de contrôle :** à 430 × 932, `scrollHeight = innerHeight`, et la carte affiche **6 tuiles** au premier écran.

---

## 2. Anatomie cible (430 × 932)

| Part | Sélecteur | Boîte | Contenu |
|---|---|---|---|
| Écran | `.lkdv-account.pays` | 430 × 932, verrouillé | tokens §1, base 14 px |
| Fond | `.bg` | 430 × 932 | photo du pays, `cover`, `center 30%` |
| Zone haute | `.top` | 6 / 12 / 406 × 597,1 | barre haute + carte |
| Barre haute | `.ig-top` | 12 / 6 / 406 × 36 | pilule « ← Atlas » h34 + **3** ronds 38 : partager, favori, Kit IA |
| Carte | `.card.cs.pays` | 12 / 48 / 406 × **541,1**, r24 | scroll interne |
| Scroll | `.card-scroll` | pad 8 12 56, gap 7 | 477 px utiles |
| Identité | `.ig-header` | 382 × 68 | drapeau 66 + nom + **3** stats 101 × 39 : superficie, capitale, monnaie |
| Bio | `.ig-bio` | 378 × 32,6 | slogan (600/tint) + « Continent · Région · Fuseau », 2 lignes max |
| Sections | `.ig-hl-row` | 378 × 56,4 | **8 anneaux** (5 visibles, scroll-x) : Aperçu, Incontournables, Activités, Culture, Gastronomie, Hébergements, Pratique, Communauté |
| Grille | `.ig-grid-wrap` | 406, gap 3 | tuiles **134** r2 = contenu de la section active (6 visibles) |
| Sélecteur | `.ig-tabs-float` | 88 × 30 | bascule **Grille | Liste**, lentille 41,5 × 25 |
| Zone carte | `.mapzone` | 0 / 597,1 / 430 × 334,9 | carte du pays (globe actuel) + secours statique |
| Barre basse | `.tb` | 14 / 868 / 402 × **48** | 5 items 80 × 44 |

**Budget vertical de la carte :** 68 + 7 + 32,6 + 7 + 56,4 + 7 + 271 (2 × 134 + 3) = 449 + 8 (haut) + 56 (bas) = 513 < 541. Le reste (28 px) est le début de la ligne suivante : la carte défile, elle ne grandit pas.

---

## 3. Mapping source → cible

| Aujourd'hui | Cible | Sort du contenu |
|---|---|---|
| `MobileCountryDetailView` 560 l. | `PaysScreen` (composition) | aucun CSS d'écran |
| Hero photo 398 × 224 | `.bg` | la photo reste, en fond |
| 4 stats uppercase 90 × 58 | `.ig-header` 3 stats | **fuseau** descend dans le drawer « Pratique » |
| `PaysHeroOverview` (desktop) | supprimé | paragraphes → drawer « Présentation », carte → `.mapzone` |
| Rangée d'onglets 430 × 102 | `.ig-hl-row` 8 anneaux | mêmes clés de section, même événement |
| 16 cartes `glass` | `.card-scroll` + tuiles/lignes | cartes → tuiles |
| `PaysLeftSidebar` | `.ig-top` + menu de carte | PDF et Créer mon kit dans le menu |
| `PaysRightSidebar` | `.mapzone` + drawer « Pratique » | table pratique conservée telle quelle |
| `SectionBlocks` placeholder | état vide honnête | phrase + action |
| `KlookCtaBlock` | tuile partenaire + attribution | inchangé |
| `BouteilleALaMer` / clubs / carnets | tuiles « Communauté » | mêmes requêtes |

**Actions conservées :** Atlas, Kit IA, configurateur IA, partage, favori, PDF, sources documentaires, bascule Grille/Liste, 8 sections, 5 items de barre.

---

## 4. Tokens, matière, motion

Reprise **exacte** de la spec mesurée : tokens §1 (`--label`, `--tint`, `--page`, `--sf`…), matière §4 (verre clair, filtre liquide `url(#lf…)` du runtime), motion §5, états §6.
Interdit : couleur littérale hors table, `backdrop-filter` d'écran, classe `.pays-card`, `text-transform: uppercase` sur un libellé.

**Divergence documentée à accepter :** la grammaire utilise les rayons 2 / 24 / 22 / 14, alors que les gardes du dépôt (`tests/design/radius.spec.ts`) imposent un plancher de concentricité à 20 px pour les primitives UI. Les tuiles r2 vivront dans `src/design/account/`, hors du périmètre scanné, et l'écart est assumé au nom de la fidélité.

---

## 5. États

| État | Règle |
|---|---|
| Vide | phrase + action dans la carte, jamais `—` ni compteur inventé |
| Chargement | squelettes aux dimensions des parts (34, 38, 66, 12, 134), shimmer 1,4 s |
| Erreur | même boîte, message + réessayer |
| 404 | coquille conservée, **sans** rangée de sections |
| Invité | mêmes parts |
| Carte indisponible | secours statique (contour réel issu de `countries_geo.geometry`) |
| Mobile/desktop | un seul arbre monté selon le viewport (fin du double montage) |

---

## 6. Hors-périmètre

Bandeau cookies · barre basse globale si décision 3 = « garder 60 » · `/pays` index (redirige vers `/explorer`) · autres écrans.

---

## 7. Lots

0. **Socle grammaire** : `src/design/account/` (tokens, feuille, runtime filtres, primitives) + `design:fidelity` + `design:diff` + banc d'essai.
1. Coquille verrouillée (`.bg`, `.ig-top`, `.card.cs`, `.mapzone`).
2. En-tête identité + 3 stats réelles.
3. Anneaux 8 sections + sélecteur Grille/Liste.
4. Grille 3 colonnes + états vides honnêtes.
5. Drawers (fiche d'identité complète, pratique, sources, partage, PDF).
6. Partenaires (Klook, Discovery).
7. Desktop/tablette (colonne 430 + drawers).
8. Recette + prod.

---

## 8. Preuves de fin

- `design:fidelity` vert (14 invariants / 17 mesures, ±1 px) sur `/pays/fr`, `/pays/pt`, `/pays/np`.
- `scrollHeight = innerHeight` aux 3 viewports.
- Captures avant/après même viewport + `design:diff` ≤ 0,2 % expliqué.
- 8 sections × 3 viewports × 6 états cliqués.
- `type-check && lint && test && build` verts (26 fichiers de tests pays/discovery).
- Prod vérifiée à l'URL.

---

## 9. Décisions à trancher

| # | Question | Recommandation |
|---|---|---|
| 1 | Socle grammaire : je le porte depuis la spec, ou tu fournis le worktree/commit ? | je porte (Lot 0) |
| 2 | Desktop : colonne 430 + drawers, ou 3 colonnes conservées ? | colonne 430 + drawers |
| 3 | Barre basse : globale 48 px, ou pays garde 60 px (écart documenté) ? | globale 48, lot séparé |
| 4 | Sections vides (4/8) : tuiles avec état vide, ou masquées ? | tuiles avec état vide + action |
