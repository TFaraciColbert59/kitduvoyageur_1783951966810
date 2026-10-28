# Fiche carnet — 28 finitions des drawers et sous-drawers (27 octobre 2026)

Branche `cf/carnet-latest`, worktree `lkdv-cf-carnet2`, dev `localhost:4211`.
Carnet témoin : `9ba890ca-e071-5ab8-8624-6bd8a471a6c1` (Islande, 7 moments,
3 commentaires, 24 réactions), session `demo@lkdv.app` (auteur → page Gérer).
Captures : 430 × 932, `deviceScaleFactor: 2` ; tablette 768 × 1024 et desktop
1440 × 900 pour le débordement.

## Châssis : écart 0

Mesuré avant et après, même session, même viewport (`avant-mesure.json` /
`fin-mesure.json`, sonde identique).

| Ancre | Avant | Après | Écart |
|---|---|---|---|
| feuille (carte / drawer / post) | `12 / 48 / 406 × 503,2` | `12 / 48 / 406 × 503,2` | 0 |
| poignée du post | `194 / 55 / 42 × 5` | `194 / 55 / 42 × 5` | 0 |
| en-tête du post | `22 / 58 / 386 × 44` | `22 / 58 / 386 × 44` | 0 |
| `···` | `326 / 61 / 38 × 38` | `326 / 61 / 38 × 38` | 0 |
| `×` | `370 / 59,5 / 38 × 38` | `370 / 59,5 / 38 × 38` | 0 |
| barre d'actions | `256,09 / 504,2 / 151,91 × 37` | idem | 0 |
| sélecteur | `320 / 511,2 / 88 × 30` | idem | 0 |
| barre basse | `14 / 868 / 402 × 48` | idem | 0 |
| verre + 5 ombres + rayon 24 | conformes | conformes | 0 |

Pixel : `diff-accueil.png` ne bouge **que** dans la carte du bas (tuiles
chargées entre les deux prises) ; au-dessus de `y = 559` la capture est
identique au pixel. `diff-post.png` = 0,04 % (aucune retouche visible sur la
feuille du post).

Seule différence voulue : la poignée du drawer passe de `40 × 4` à
`42 × 5` à `8 px` du bord, à `rgba(23,43,36,.18)` — c'est la finition 1.

## Les 28 finitions

| # | Finition | État | Preuve |
|---|---|---|---|
| 1 | Poignée 42 × 5, rayon 999, `.18`, 8 px du bord | fait | `fin-stats-distance.png`, test CSS |
| 2 | Voile `blur(12px)` + hairline à 8 px de scroll, fondu 160 ms | fait | `fin-stats-jours-scrolled.png` (`opacity 1`), test CSS |
| 3 | Aucun titre ; une ligne 11/500 `#6B7A70` si contexte | fait | `.ckp-stat-context` |
| 4 | Croix 36 px `rgba(255,255,255,.9)`, icône 16, toujours là | fait | `fin-stats-distance.png`, `fin-drawer-focus.png` |
| 5 | Focus `0 0 0 2px #17402C` + offset 2 px | fait | `box-shadow` mesuré = `0 0 0 2px transparent, 0 0 0 4px #17402C` |
| 6 | `prefers-reduced-motion` : fondu 160 ms, aucune translation | fait | `@keyframes ckp-fade-in`, test CSS |
| 7 | Chiffre 34/700, `-0,6px`, tabulaire ; unité 13/500 `#6B7A70` | fait | `180 km`, `1 800 m`, `7 jours` |
| 8 | Barre 6 px, 3 segments `#17402C` à 100/70/45 %, 12 px sous le chiffre | fait | `fin-stats-jours.png` |
| 9 | Marges 16 px / 20 px, hairline avant le bloc suivant | fait | `padding: 20px 16px`, `.ckp-stats-sep` |
| 10 | Aire SVG 72 px, remplissage `.12`, trait 1,5 `#17402C`, sans axe | fait, **sans donnée en prod** | test `CarnetStatsPane` (fixture 3 jours) |
| 11 | Pastille 6 px + valeur 11/600 | fait, idem | test idem |
| 12 | 3 repères 9/500 `#7A8A80`, opacité .7, alignés à droite | fait, idem | test idem |
| 13 | Barres journalières 4 px `.35`, sans chiffres | fait, idem | test idem |
| 14 | Ligne de jour 56 px, pastille 22, trait 1 px, 2 colonnes 12/600 | fait | `fin-stats-jours.png` |
| 15 | En-tête collant 40 px verre, total 12/600 | fait | `fin-stats-jours-scrolled.png` |
| 16 | Nom 12,5/600 + handle 11/500 ; texte 13/400 1,42 ; méta 10,5/500 dessous | fait | `fin-comments.png` |
| 17 | Entrée commentaire : fondu + 6 px, 180 ms, sans saut | fait | test `is-new` |
| 18 | 3 pastilles contour 1 px, 28, actif `#17402C` | fait | `fin-likes-actif.png` |
| 19 | Compteur 11/500 `#6B7A70` en haut, sans fond | fait | `24 réactions` |
| 20 | Lignes 48 px, séparateur inset, chevron 12, aucun cadre | fait | `fin-manage.png` |
| 21 | Interrupteurs 36 × 20, `#17402C` | fait | `fin-manage.png` |
| 22 | Sections 24 px d'air, en-tête 10,5/600 `.08em` `#8A968D` | fait | `fin-manage.png` |
| 23 | Barre d'actions 44 px, icônes 22 | **non appliqué** : contredit `146 × 37` du Compte (règle du châssis) | — |
| 24 | Légende : pseudo 13/600 puis texte 13/400, 1,4 | fait | `.ckp-post-pseudo` (test) |
| 25 | Hairlines `rgba(23,43,36,.06)` 0,5 px partout | fait | test CSS |
| 26 | Aucune couleur littérale nouvelle | fait | test qui liste les hex de la section ajoutée |
| 27 | Cibles ≥ 44 px | fait (croix 36+4, pastilles 28+8, sous-sélecteur 26+9) | mesure `TARGETS` |
| 28 | Aucun débordement 430 / 768 / 1440 | fait | `fin-carnet-*.png`, `fin-mesure.json` |

## Ce qui n'a pas pu être montré avec de la donnée réelle

Les finitions 10 à 13 (aire altimétrique, point culminant, repères, barres
journalières) et la barre de répartition (8) dépendent des valeurs **par jour**
(`CarnetDay.distanceKm`, `CarnetDay.elevationM`). En production, ces valeurs
n'existent plus : `getCarnetDetail` interroge `groupe_etapes`, renommée
`_deprecated_groupe_etapes` le 17/09/2026 puis supprimée. Résultat : aucune
fiche ne porte de distance ni de dénivelé par étape, et les journées sont
reconstruites depuis les moments (`buildCarnetDetail`, branche « pas d'étapes »).

Conséquence assumée : sur le carnet témoin, le sous-drawer Dénivelé n'affiche ni
aire ni barre (état vide honnête), et la ligne de jour n'affiche pas de colonnes
de chiffres. Les composants sont écrits et testés sur les fixtures (3 jours avec
distance et D+) ; ils s'allumeront dès qu'une source par jour existera.
**Aucune valeur n'a été inventée.**

## Deux corrections de propreté rencontrées

- Le composer de la page Commentaires passait sous le pied flottant (actions +
  capsule) dès que la liste dépassait la carte : `.ckp-page .lkdv-post-panel-foot`
  est maintenant `position: sticky; bottom: 48px`, donc toujours au-dessus du
  pied. Le post, lui, garde son pied dans sa propre feuille.
- L'en-tête collant à 72 % laissait lire le texte qui défilait dessous : fond
  passé à 88 % avec `blur(16px)`.

## Vérifications

- `npx vitest run src/components/carnet src/features/carnet` : **236 tests, 24
  fichiers, tout vert** (204 au départ ; `CarnetLens.test.ts` était déjà rouge
  avant ce lot — la lentille est passée sous `.ckp-capsule`, le test est réaligné).
- `NODE_OPTIONS=--max-old-space-size=10240 npx tsc --noEmit` : 0 erreur.
- `npx eslint src/components/carnet/profile` : 0 erreur, 3 avertissements
  préexistants (`CarnetScreen.tsx`).
- `document.documentElement.scrollWidth === innerWidth` et `scrollHeight ===
  innerHeight` à 430 × 932, 768 × 1024, 1440 × 900, écran et drawer ouverts.

## Fichiers touchés

- `src/styles/carnet-profile.css`
- `src/components/carnet/profile/CarnetDrawer.tsx`
- `src/components/carnet/profile/panes/CarnetStatsPane.tsx`
- `src/components/carnet/profile/panes/CarnetDayRow.tsx` (nouveau)
- `src/components/carnet/profile/panes/CarnetCommentsPane.tsx`
- `src/components/carnet/profile/panes/CarnetLikesPane.tsx`
- `src/components/carnet/profile/panes/CarnetManagePane.tsx`
- `src/components/carnet/profile/panes/CarnetEtapesPane.tsx`
- `src/components/carnet/profile/CarnetPostSheet.tsx`
- `src/components/carnet/profile/CarnetPages.tsx`
- `src/components/carnet/profile/statsGeometry.ts` (nouveau)
- `src/components/carnet/profile/useScrollCut.ts` (nouveau)
- `src/features/carnet/detail/useCarnetComments.ts` (handle public du commentaire)
- tests : `CarnetFinitions.test.ts` (nouveau), `CarnetLens.test.ts`,
  `CarnetStatsPane`, `CarnetCommentsPane`, `CarnetLikesPane`, `CarnetScreen`,
  `CarnetPostSheet`.

Hors périmètre, non touchés : `OverlaySheet`, `LensPager`, la feuille du Compte,
`getCarnetDetail` (source de données par jour).
