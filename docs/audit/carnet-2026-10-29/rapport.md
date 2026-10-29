# Refonte du drawer carnet — rapport des sept blocs

Worktree `lkdv-cf-carnet2`, branche `cf/carnet-latest`. Aucun déploiement, aucun push,
aucun merge. Dev `localhost:4317`, fiche de recette
`/carnets/13072b4b-fa66-40d2-b30b-a66f8aabb2c2` (30 commentaires, 15 moments avec photo,
5 sorties) et `/carnets/ea5bddab-326e-4d39-9fbb-2d63f7651785` (5 sorties, 15 moments).

## Vérifications communes

| Contrôle | Résultat |
|---|---|
| `npx vitest run src/components/carnet src/features/carnet` | **439 tests verts** (33 fichiers) — 431 au départ, +8 tests ajoutés, 6 réécrits |
| `NODE_OPTIONS=--max-old-space-size=10240 npx tsc --noEmit` | **0 erreur** |
| `scrollWidth === innerWidth` et `scrollHeight === innerHeight` | 430×932, 768×1024, 1440×900 : **9/9 états mesurés** (carte, drawer stats, drawer moments, post, commentaires, partage) |

## Bloc 1 — Audit BDD et nettoyage

- `docs/audit/carnet-2026-10-29/audit-bdd-carnets.md` : 10 tables, 96 colonnes, verdict par
  colonne (garder / code mort / à supprimer plus tard), état réel de la base au 29/10
  (87 carnets, 276 moments, 132 commentaires, 3 266 vues), SQL de nettoyage **non exécuté**.
- Lectures mortes retirées du code : `carnets.views_count`, `carnet_moments.auteur_nom`,
  `carnet_collaborators.role`, `hike_session_participants.role`. Aucune valeur affichée ne
  change (ces quatre colonnes n'étaient peintes par aucun composant).
- Deux constats hors périmètre, documentés : `CreateCarnetView.tsx` insère `elevation_m`,
  colonne **inexistante** (la vraie est `denivele_m`) — ce chemin de création échoue ;
  `carnet_views` a 3 266 lignes mais `carnets.views_count` n'est pas maintenu.

## Bloc 2 — Statistiques manquantes

Ajouts calculés sur la donnée réelle, tous rendus par `CarnetField` (valeur absente → `—`) :

| Volet | Nouvelles lignes | Mesure réelle (fiche de recette) |
|---|---|---|
| Distance | allure moyenne, durée totale, dénivelé par km, jours, moments | `47,3 min/km` · `28 h 30` · `44 m/km` · `5` · `15` |
| Dénivelé | dénivelé max daté, moyenne par jour | `1 320 m D+ · J3` · `992 m D+` |
| Jours | jours documentés, jour le plus long, jour le plus court | `5 / 5` · `—` · `—` (aucune étape ne déclare de distance — aucune valeur n'est inventée) |

Deux corrections de justesse : l'allure moyenne est la **moyenne des allures journalières**
(jamais une durée totale divisée par une distance qui ne couvre pas les mêmes jours), et les
bornes « jour le plus long / le plus court » ne comparent que les distances **déclarées**
(`groupe_etapes`), pour ne pas contredire le total.

La pastille de rappel du total (`.ckp-stats-sticky`) recouvrait une ligne de donnée pendant
le défilement : elle vit désormais dans la bande du voile de coupe (`top: -24px`, `z-index 8`),
sans jamais masquer un champ.

## Bloc 3 — Moments en cartes

- Une carte par moment, grille **2 colonnes** (181 px à 430), photo **4:3** (181 × 136),
  rayon **14**, heure en pastille blanche en haut à gauche, lieu sur un voile local
  `rgba(10,20,14,.18)` (mesuré), légende **2 lignes** dans la carte — aucun texte à même le verre.
- Regroupement par jour dès que la liste en couvre plusieurs : pastille `J1 · 8 juin · 3 moments`.
- Moment sans photo : même carte, glyphe 24 px à 50 % et lieu dans la surface (aucun trou dans la grille).

## Bloc 4 — Le sélecteur principal

Mesuré à 430 × 932 : `.ckp-drawer-select` **374 × 44** à `x = 28` (pleine largeur, 16 px des
bords), rayon 999, fond `rgba(23,43,36,.06)`, lentille blanche de 122 × 38 au pas des segments,
**un segment par volet** (Statistiques / Moments / Partage) avec icône 18 + libellé 12,5/600.
Il pilote les trois volets ; aucun autre sélecteur de niveau drawer n'existe (la capsule de
pied ne commande que les sous-volets des statistiques, le sélecteur de la carte commande les
pages du carrousel).

## Bloc 5 — La croix est partie

- `0` bouton `.ckp-drawer-close` dans le DOM ; l'en-tête ne contient plus qu'un bouton, la
  poignée, `aria-label="Fermer le panneau"`.
- Fermeture par glissement vers le bas : la feuille suit le doigt (`--ckp-drag`, mesuré
  `translateY(60px)`), se ferme au-delà de **30 %** de sa hauteur (seuil testé :
  120 px → non, 121 px → oui pour une feuille de 400 px), revient en **200 ms** sinon.
- Alternatives accessibles (WCAG 2.2 « dragging movements ») : `Échap` au clavier (vérifié :
  sortie de 180 ms puis démontage) et l'appui simple sur la poignée.

## Bloc 6 — Mouvement

| Étape | Mesure |
|---|---|
| Ouverture | `ckp-drawer-in` **0,26 s** `cubic-bezier(0.22, 1, 0.36, 1)`, `translateY(24px) → 0` + fondu |
| Contenu | `ckp-drawer-content-in` **0,26 s** avec **délai 0,04 s** |
| Fermeture | `ckp-drawer-out` **0,18 s** (plus rapide que l'entrée), fondu + `translateY(16px)` — mesuré à mi-course : `opacity .358`, `translateY(10,3px)` |
| Glissement | translation réelle sous le doigt ; retour `transform .2s` |
| Mouvement réduit | fondu **120 ms**, aucune translation — vérifié en émulation `prefers-reduced-motion: reduce` : `animation-name` = `ckp-fade-in` sur la feuille **et** sur le corps, `transform: none` (la règle porte la même spécificité `.ckp-card.ckp-card--drawer` que l'ouverture, sinon la translation de 24 px survivait) |

## Bloc 7 — Commentaires et partage du post

- `docs/audit/carnet-2026-10-29/audit-post-communaute.md` : propriété → valeur mesurée sur
  `/communaute` → où l'appliquer, plus les écarts assumés.
- Commentaires : `.lkdv-comment*` du fil (avatar 30, gap 9, nom 600 13, date 10,5, texte
  13,5/1,45, actions 11/600), corps `8px 12px 4px`, pied `8px 10px 10px` + filet 0,5 px,
  états mot pour mot (« Sois le premier à répondre. », « Chargement… », porte
  `.lkdv-comments-gate`), composer `PostReplyComposer` inchangé.
- Partage : `.lkdv-search-box`, `.lkdv-share-actions` (4 colonnes de **91 px**, valeurs du fil :
  92), `.lkdv-share-action` + `.ico` 42 rond, `.lkdv-share-conv` (8/2, filet 0,5), `.lkdv-share-mini`.
- Une cause de divergence a été trouvée puis neutralisée : `components/compte/overlay/compte-overlay.css`
  redéfinissait `.lkdv-comment*` et `.lkdv-share-*` avec `!important` sur la feuille de post.
  Ce fichier est **hors périmètre** (lecture seule) : les valeurs du fil sont rétablies par des
  règles `.ckp-post-sheet` portées par `carnet-profile.css`, avec les mêmes nombres.
  Deux couleurs du fil (`#222`, `#3f5148`) sont rendues par les jetons de la maison
  (`#172B24`, `#56665D`) — écart imperceptible, imposé par la garde de tokens.
- Aucun CSS du fil dupliqué en double : seules trois règles nouvelles sont préfixées `lkdv-`
  (`.lkdv-comment-handle`, `.lkdv-comments-sort`, et les valeurs `.ckp-post-sheet` ci-dessus).

## Captures (430 × 932, lues une par une)

`captures/b2-02-stats-distance-430.png`, `b2-02b-stats-distance-bas-430.png`,
`b2-03-stats-denivele-430.png`, `b2-04-stats-jours-430.png`, `b3-01-moments-430.png`,
`b4-01-selecteur-430.png`, `b5-01-sans-croix-430.png`, `b6-01-glissement-430.png`,
`b6-02-fermeture-430.png`, `b7-01-fil-commentaires-430.png`, `b7-02-fil-partage-430.png`,
`b7-03-carnet-commentaires-430.png`, `b7-04-carnet-partage-430.png`.

## Reste incertain / à faire

1. **DDL** : le SQL de nettoyage (colonnes mortes, `views_count`) n'est pas joué — la base
   n'est pas modifiable depuis cette session.
2. **Parité de comportement des commentaires** : ♥, réponse, édition et signalement d'un
   commentaire de carnet exigent des colonnes qui n'existent pas (`parent_id`, réactions).
3. **Données incohérentes en base** : la distance totale affichée (`14,1 km`, dernière sortie)
   ne couvre pas les cinq jours (89 km de sorties) ; les distances par jour ne sont déclarées
   par aucune étape, donc « jour le plus long / plus court » restent `—`. Ce n'est pas un bug
   d'affichage : c'est une donnée de seed incomplète.
4. **`CreateCarnetView.tsx`** insère une colonne inexistante (`elevation_m`) : chemin de
   création cassé, hors périmètre.
5. Le voile de coupe du chrome laisse parfois une valeur fantôme sous le `backdrop-filter`
   pendant un défilement programmatique (Chromium) : la pastille de rappel a été déplacée hors
   du corps, ce qui rend le défaut inoffensif, mais la cause racine (flou + masque) reste.
