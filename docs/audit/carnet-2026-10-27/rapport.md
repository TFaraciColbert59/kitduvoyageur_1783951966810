# Fiche carnet — cinq corrections (27 octobre 2026)

Branche `cf/carnet-latest`, worktree `lkdv-cf-carnet2`, dev `localhost:4177`.
Carnet témoin : `9ba890ca-e071-5ab8-8624-6bd8a471a6c1` (Islande, public, 7 moments).
Référence : `/compte` mesuré à 430 × 932 dans le même navigateur, même dev.

## 1. Carte du bas — 430 × 335, de y 597 à 932

| Mesure | /compte (référence) | Fiche carnet |
|---|---|---|
| carte d'identité | `12 / 48 / 406 × 541.08` | `12 / 48 / 406 × 541` |
| carte du monde | `0 / 597.08 / 430 × 334.92` | `0 / 597 / 430 × 335` |

La carte occupe tout le reste de l'écran (comme le `1fr` de `.phone` sur /compte) :
`flex: 1 1 auto; min-height: 0; margin: 8px -12px 0`. L'ancien `min-height: 240px`
a disparu ; la carte d'identité garde `height: 541px; flex: none` et
`margin-bottom: 0`. Réserve basse de `.ckp-screen-body` : 0.

## 2. Grille des posts — gabarit du Compte

Mesuré sur `/compte` : colonnes `134px 134px 134px`, `gap: 2px`, tuile
`aspect-ratio 1/1`, `border-radius: 2px`, conteneur 406 px (bord à bord).
**La consigne disait `gap 3` : 3 × 134 + 2 × 3 = 408 ≠ 406.** Le gabarit réel de
`/compte` est `gap: 2` (vérifié aux computed styles), et c'est la seule valeur qui
donne 134 px dans 406. La fiche garde donc `gap: 2`.

Fiche : `.ckp-media { margin: 0 -12px }` → grille `12 / 217.19 / 406 × 406`,
tuile `12 / 217.19 / 134 × 134`. Badge d'agrandissement de tuile supprimé (absent
du Compte) ; le `+N` de dépassement reste (information, pas décoration).

## 3. Post du moment — la feuille du post du Compte

`CarnetPostDrawer` (maison) supprimé. `CarnetPostSheet` réutilise les primitives
du Compte : `OverlaySheet` (+ `.lkdv-post-drawer`, `.lkdv-post-glass-sheet`),
`LensPager` (3 panneaux, swipe + flèches), `PostAuthorPill` pour l'en-tête, et
toutes les classes `.lkdv-post-*` (média 1:1 bord à bord, `.lkdv-post-media-glass`
en bas à droite, `.lkdv-post-options-menu` en bulles de verre).

| Mesure | Post /compte | Post carnet |
|---|---|---|
| feuille | `12 / 48 / 406 × 541.1` | `12 / 48 / 406 × 541` |
| en-tête | `22 / 58 / 386 × 44` | `22 / 58 / 386 × 44` |
| poignée | `194 / 55 / 42 × 5` | `194 / 55 / 42 × 5` |
| média | `12 / 48 / 406 × 541` | `12 / 48 / 406 × 541` |
| `···` | `326 / 61 / 38 × 38` | `326 / 61 / 38 × 38` |
| `×` | `370 / 59.5 / 38 × 38` | `370 / 59.5 / 38 × 38` |

La feuille s'ancre sur la carte (`id="card"`, le repère que `OverlaySheet` mesure
déjà sur /compte) : la carte et la carte du monde restent visibles dessous.
Contenu = donnée du carnet : image du moment, `Jour N · heure · lieu · date`
(dérivée de `start_date` + jour−1), légende, ♥ et 💬 réels du carnet.
Le menu `···` porte les actions réelles : Enregistrer, Copier le lien, Partager,
Signaler. Le ♥ de la barre bascule le like du carnet, le double-tap aime, le
simple tap ouvre la visionneuse (comportement conservé).

## 4. Sélecteur — 4 segments, lentille au pixel

Capsule `231 / 549 / 177 × 30` (contre 220,5 pour 5 segments), segments
`41,5 × 25` à x `233.5`, `277`, `320.5`, `364`, aucun débordement (bord droit 408 < 430).

| Segment | Page ouverte | Lentille | Delta |
|---|---|---|---|
| ♥ | `carnet-page-likes` | `233.5 / 551.5 / 41.5 × 25` | 0 / 0 / 0 / 0 |
| 💬 | `carnet-page-comments` | `277 / 551.5 / 41.5 × 25` | 0 / 0 / 0 / 0 |
| ▦ | `carnet-page-posts` | `320.5 / 551.5 / 41.5 × 25` | 0 / 0 / 0 / 0 |
| 🗺 | `carnet-page-parcours` | `364 / 551.5 / 41.5 × 25` | 0 / 0 / 0 / 0 |

Clavier vérifié : `ArrowRight`/`ArrowLeft` sur les onglets (bouclage, focus suivi),
`Entrée` sur les actions. `aria-current="page"` suit la page affichée.
🔖 Enregistrer quitte la capsule et reste dans le menu `···` de la barre du haut.

## 5. Ligne de lieu — texte seul

`Islande · 7 jours · 180 km · 1 800 m D+ · 25 avr. – 6 mai 2026`
(`500 12px`, `#3f4f46`, `letter-spacing -.14px`, ` · ` — mesuré sur `.ig-bio-stats`
de /compte). Aucune pastille, aucun fond, aucun bouton. Valeur absente → `—`
(la ligne entière disparaît si le carnet n'a réellement aucune valeur).
La plage de dates, qui n'existait que dans la ligne de pastilles, est conservée
en fin de ligne ; la localité (`lieu_depart`) reste lisible dans l'onglet Étapes.

## Tests et types

- `npx vitest run src/components/carnet src/features/carnet` : **201 tests verts**
  (178 avant), 22 fichiers.
- `NODE_OPTIONS=--max-old-space-size=10240 npx tsc --noEmit` : **0 erreur**.
- Suite complète (`npx vitest run`) : 74 échecs, **tous hors périmètre**
  (`tests/design/**` Compte v8→v14, `src/components/compte/**`, clubs) — aucun
  test carnet en échec.
- `npm run design:diff` est cassé dans ce worktree (`scripts/design/visual-diff.mjs`
  absent) : diff recalculé à la main (`diff-430.png`, Pillow ×4).

## Diff avant/après (430 × 932)

Bandes modifiées : **y 151 → 588** uniquement.
- y 151 : la ligne de lieu remplace les deux pastilles + la date (3 lignes → 1).
- y 217 : la grille remonte de 8,4 px (la ligne de texte est plus courte).
- y 505 → 580 : la capsule perd un segment (177 px), la lentille change de pas.
- Aucun pixel touché sur la barre du haut, le cadre de la carte et la carte du monde.

## Captures (`docs/audit/carnet-2026-10-27/`)

- `avant-430.png`, `apres-430.png`, `apres-768.png`, `apres-1440.png`, `diff-430.png`
- `ref-compte-post-filled-430.png` (post du Compte, référence) vs `apres-post-430.png`
- `apres-post-comments-430.png`, `apres-post-share-430.png`, `apres-post-menu-430.png`
- `apres-selecteur-posts-x3.png`, `apres-selecteur-likes-x3.png`, `apres-selecteur-parcours-x3.png`

## Ce qui reste incertain

1. **`gap: 3` demandé vs `gap: 2` mesuré** : la contrainte 134 × 3 + gouttières dans
   406 impose 2. Si le 3 est voulu, les tuiles tombent à 133,33 px (écart 1 px) —
   à trancher.
2. **Recentrement carte** : la ligne de lieu n'étant plus un bouton, le recentrage
   sur le lieu/tracé n'a plus de déclencheur (`CarnetMapCard.focus` reste une API
   sans appelant).
3. **Localité** (`Landmannalaugar`) retirée de la carte : elle reste dans Étapes.
4. **Panneaux commentaires/partage** : la feuille et les marges sont celles du
   Compte, mais les rangées de commentaires gardent la grammaire carnet
   (`.ckp-comment`), pas `.lkdv-comment`.
5. `CarnetScreen` porte deux variables mortes préexistantes (`showCover`,
   `coverCss`) signalées par ESLint, non supprimées ici (hors des 5 corrections).
