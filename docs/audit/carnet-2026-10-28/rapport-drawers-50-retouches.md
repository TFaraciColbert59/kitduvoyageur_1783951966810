# Fiche carnet — 50 retouches des drawers et sous-drawers (28 octobre 2026)

Branche `cf/carnet-latest`, worktree `lkdv-cf-carnet2`, dev `localhost:4233`.
Carnet témoin : `9ba890ca-e071-5ab8-8624-6bd8a471a6c1` (Islande, 7 moments,
3 commentaires, 24 réactions). Captures 430 × 932, `deviceScaleFactor: 2`.
Référence : `/compte` (châssis mesuré, non touché).

## Châssis : écart 0

Mesuré après refonte, drawer ouvert (`captures/apres/mesure.json`) :

| Ancre | Valeur mesurée | État |
|---|---|---|
| feuille | `12 / 48 / 406 × 487,39` (adaptative), 503 au plafond | conforme |
| rayon / verre / flou | `24px`, `linear-gradient(rgba(255,255,255,.486), rgba(255,255,255,.384))`, `blur(25.2px) saturate(1.8) brightness(1.05)` | **identique** |
| ombres | 3 `inset` + liseré `.5px` — inchangées | **identique** |
| poignée | `194 / 56 / 42 × 5` | identique |
| croix | `370 / 56 / 36 × 36` (désormais en absolu) | dessin identique |
| capsule | `318 / 493,39 / 88 × 30` → **12 px** des bords | conforme (34) |
| barre basse | `402 × 48` | **non touchée** |

Débordement, drawer ouvert : `scrollWidth === innerWidth` et
`scrollHeight === innerHeight` à **430 × 932, 768 × 1024, 1440 × 900**
(`overflow-*` du `mesure.json`).

## Ce qui change, mesuré

| Point | Avant | Après |
|---|---|---|
| tête de feuille | poignée 21 px **+ ligne de croix 42 px** = 63 px | poignée 13 px, croix en absolu |
| premier contenu | ~63 px sous le bord | `y = 77` → **16 px sous la poignée** (1) |
| hauteur de feuille | `100 %` (503,2 figés) | `auto`, plafond `min(100%, 503px)` (2) |
| corps | `padding: 0 0 52px` | `padding: 16px 16px 64px` (4, 37) |
| gouttière des volets | 12 px + gaps de 8 px | 16 px, rythme 12 / 20 / 32 (3, 5) |
| chiffre héros | 34/700, `-0,6px`, unité 13/500, contexte « distance totale » | **40/700, `-1px`, interligne 1**, unité 14/500, plus aucun libellé (9-14) |
| barre | 3 segments 6 px à 12 px | piste `rgba(23,43,36,.08)` + remplissage `#17402C`, 12 px sous le chiffre (12) |
| sous-sélecteur | pastille 3 textes | **129,5 × 30**, lentille `41,5 × 25`, 3 icônes `aria-label` (29-32) |
| lignes de données | rangées de 40 px, filet, valeur 12/600 | **champs de 48 px**, rayon 12, `rgba(255,255,255,.55)`, libellé placeholder 12/500 `#8A968D` (46 % max, ellipse), valeur 13/600 tabulaire en colonne de 120 px (15-28) |
| capsule | `right/bottom: 10px` | `12px` + ombre `0 2px 8px rgba(23,43,36,.10)` (34, 36) |
| états | phrases (« Chargement… », « Sois le premier à répondre. », « Connectez-vous pour commenter. », « Dénivelé non renseigné. ») | squelette 5 × 48 px + héros 40 px (shimmer 1,4 s), glyphe 32 px à 30 % + `—`, porte d'auth en champ (38-42) |

## Les 50 retouches

| # | Retouche | Où |
|---|---|---|
| 1 | contenu à 16 px sous la poignée | `.ckp-grabber` 13 px + `.ckp-drawer-body` `padding-top: 16px` |
| 2 | hauteur = contenu + réserve, plafond 503 | `.ckp-card.ckp-card--drawer` (`flex: 0 0 auto`, `max-height: min(100%,503px)`) |
| 3 | rythme 12 / 20 / 32 | `.ckp-group` gap 12, blocs 20, héros 24 |
| 4 | marges internes 16 px | `.ckp-drawer-body`, `.ckp-page-pad--dense` |
| 5 | une seule ligne de base | tous les volets partent de 16 px (`x = 28` mesuré) |
| 6 | 24 px avant la première donnée | `.ckp-pane-body > .ckp-hero`, `.ckp-pane-share > :first-child` |
| 7 | aucune section encadrée | `.ckp-manage-section`, `.ckp-section-head`, `.ckp-set`, `.ckp-share-row` supprimés |
| 8 | 64 px de réserve basse | `padding-bottom: 64px` |
| 9-10 | 40/700 tabulaire, `-1px`, interligne 1 ; unité 14/500 | `.ckp-hero-num`, `.ckp-hero-unit` |
| 11 | `— km` si absent | `splitUnit()` + `data-missing` |
| 12 | barre 6 px sous le chiffre | `.ckp-hero-bar` + `documentedShare()` |
| 13 | trois sous-valeurs 12/600 tabulaires | `.ckp-hero-sub` |
| 14 | aucun libellé « distance totale » | `.ckp-stat-context` supprimé |
| 15-16 | ligne 48 px, colonne 120 px à droite | `.ckp-field`, `.ckp-field-value` |
| 17 | filet 0,5 px `rgba(23,43,36,.06)` | `.ckp-liker`, `.ckp-day`, `.ckp-comment` |
| 18 | ligne sans donnée → `—` | `CarnetField` (`is-missing`) |
| 19 | pas de filet en tête de groupe | `.ckp-likers > :first-child`, `.ckp-day:first-child` |
| 20 | 3 lignes max, 20 px entre groupes | `chunk(…, 3)` + `margin-top: 20px` |
| 21 | icône 16 px seulement si utile | `map-pin` (départ), `flag` (arrivée), `route` (trace) |
| 22 | aucun chevron | supprimés de Gérer et des champs |
| 23-28 | libellés = placeholders, valeurs réelles | `CarnetField` + `.ckp-field-*` |
| 29-33 | sous-sélecteur 30 px, lentille 41,5 × 25, icônes seules | `CarnetSubCapsule` (`ckp-sub--icons`) |
| 34-37 | capsule 12 px, voile 24 px, ombre, réserve 64 | `.ckp-drawer-foot`, `.ckp-drawer-veil` |
| 38-42 | squelette, vide, erreur, partiel, fondu 160 ms | `CarnetStates.tsx`, `data-error`, `.ckp-comments-list[data-state]` |
| 43 | entrée `translateY(12px)` + fondu 220 ms | `@keyframes ckp-drawer-in` |
| 44 | sous-onglet : fondu + 8 px, 180 ms | `@keyframes ckp-hero-in` |
| 45 | rouleau 400 ms, une fois | `CarnetRollValue` + `@keyframes ckp-roll` |
| 46 | mouvement réduit : aucune translation, fondu 120 ms | bloc `prefers-reduced-motion` |
| 47-50 | méta `#6B7A70` 11/500, tabulaire partout, pas de capitale, un seul accent | `.ckp-comment-meta`, `.ckp-liker*`, `.ckp-field-*`, `.ckp-hero-*` |

## Arbitrages (contradictions du brief)

1. **`#B4BDB6`** est imposé par la retouche 24 alors que la règle absolue n'autorise
   que six jetons. Appliqué au seul `—` absent, et nommé dans le test de jetons.
2. **« contenu + 88 px »** : avec « 16 px sous la poignée » (1) et « 64 px de
   réserve » (8), la somme hors contenu vaut **93 px** (les 5 px de la poignée).
   J'ai gardé 16 et 64, mesurables, plutôt que 88.
3. **Filet vs champ** : la retouche 17 (filet inset) et la 23 (champ blanc arrondi)
   ne peuvent pas coexister sur la même ligne. Les lignes de *donnée* prennent le
   champ (23-28) ; le filet reste sur les *listes* sans champ (réactions, jours,
   commentaires).
4. **Groupes de 3** : appliqué aux séries de champs (distance par jour, dénivelé
   par jour). La liste des jours et celle des réactions restent des listes
   continues à filets — ce sont des listes, pas des groupes de champs.
5. **Icônes seules** : réservées aux trois sous-onglets. Le tri des commentaires
   et les filtres de réaction gardent des libellés courts (aucune icône ne les
   nomme) dans le même gabarit de 30 px ; la cellule active y reçoit la même
   lentille blanche, à sa largeur.
6. **Chevron** : les quatre destinations du partage portent un glyphe
   `external-link` (affordance d'ouverture, pas un chevron de navigation).
7. **Bandeau collant** des statistiques : il portait le mot « Jours » — un titre.
   Il ne montre plus que l'icône du sous-onglet et le total.
8. **`.ckp-pages` passe de `overflow: hidden` à `clip`** : le pied collant des
   commentaires se cale enfin sur le vrai défileur et ne passe plus sous la
   capsule de la carte (avant : composeur sous les boutons ♥ / 💬).

## Vérification

- `npx vitest run src/components/carnet src/features/carnet` → **258 tests verts**
  (244 avant, 14 ajoutés : squelette, chargement partiel, état vide sans phrase,
  part documentée, rouleau joué une fois, champs, jetons).
- `NODE_OPTIONS=--max-old-space-size=10240 npx tsc --noEmit` → **0 erreur**.
- Captures : `captures/apres/` (stats ×3 + défilé, partage, j’aime, commentaires,
  gérer, 430 / 768 / 1440), avant dans `captures/avant/`.
- Outil de capture reproductible : `outils/captures.mjs`
  (`CKP_BASE=… CKP_TAG=… node outils/captures.mjs`).

## Ce qui n'a pas pu être prouvé avec une session réelle

- **Page Gérer** : la session démo (`compas.demo@`) n'est pas l'autrice du carnet
  témoin. La capture a été prise avec `isOwner` forcé localement, puis le drapeau
  **retiré** (`git diff` : 2 lignes en moins dans `CarnetScreen.tsx`, non
  commitées). La capture prouve la forme, pas la permission.
- **`partager…`** : absent de la capture, `navigator.share` n'existe pas dans le
  navigateur headless. La rangée reste montée sur mobile.
- **Barre de 6 px** : aucune fiche de production ne porte de distance ni de
  dénivelé par jour (`groupe_etapes` supprimée). La seule progression mesurable
  est « jours documentés / jours » → la barre est vide sur Distance et Dénivelé
  sur le carnet témoin, pleine sur Jours. Honnête, mais visuellement une piste
  nue.

## Reste incertain

- Le **rouleau** est une montée masquée de `0,16em` + fondu, pas des colonnes de
  0 à 9 : dupliquer les chiffres dans le DOM casserait les noms accessibles et les
  tests. Un vrai odomètre demanderait un `aria-hidden` doublé d'un texte caché.
- Le contenu qui défile passe **sous la capsule flottante** en cours de scroll
  (la réserve de 64 px garantit qu'aucune ligne n'est perdue en fin de course).
  C'est la grammaire du Compte ; le voile de 24 px est en place.
