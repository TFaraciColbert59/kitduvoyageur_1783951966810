# Verdict Rust/WASM — NO-GO (31/10/2026)

## Seuils du mandat (protocoles/03, templates/SEUILS_ET_BUDGETS)

Un moteur Rust/WASM n'est retenu que si **les deux** conditions sont réunies :

1. gain **≥ 2×** mesuré de bout en bout sur la charge représentative ;
2. module wasm compressé **≤ 150 Ko gzip**, sans régression de cold start, de
   mémoire, d'exactitude ni de maintenance, avec fallback TS testé.

## Ce qui a été mesuré (TypeScript, moteur réel)

Moteur : `src/features/explorer-v2/geo/track.ts` (celui du worker et de la route
API, après correction du P0). Banc : `npm run explorer:bench:geo`
(`scripts/explorer-v2/bench-geo.ts`), warm-up 3 passes, 15 passes mesurées,
traces synthétiques déterministes, machine macOS arm64 (Node 26.8.2).

| Trace | Points | Échantillons | Décimation p50 / p95 | Rééchantillonnage p50 / p95 | **Total p50 / p95** |
|---|---:|---:|---:|---:|---:|
| 12 km | 1 000 | 167 | 0,003 / 0,046 ms | 0,128 / 0,259 ms | **0,359 / 0,566 ms** |
| 120 km | 10 000 | 1 664 | 0,021 / 0,041 ms | 0,153 / 0,613 ms | **0,431 / 0,888 ms** |
| 1 200 km | 100 000 | 16 357 | 0,004 / 0,010 ms | 0,497 / 1,135 ms | **1,430 / 3,091 ms** |

Machine partagée : `load average` 3,8–34 pendant les passes (d'autres builds
tournaient). Les p95 sont donc **pessimistes** ; deux exécutions donnent
1,4–3,1 ms (p95) sur 100 000 points, toujours très en dessous du budget de frame
de 16 ms. Résultats bruts : `docs/cleanup/evidence/bench-geo-ts.json`.

## Pourquoi Rust ne peut pas gagner ici

1. **Le calcul n'est pas le goulot.** Le profil altimétrique réel paie d'abord le
   **réseau DEM** : chaque tuile AWS Terrarium est un PNG de 256×256 (~40–80 Ko)
   à télécharger et décoder ; une trace de 9 km traverse ~10 tuiles. À côté de
   dizaines/centaines de millisecondes de réseau, 1,4 ms de calcul TS est du
   bruit. Un moteur Rust n'accélère ni le téléchargement, ni le décodage PNG, ni
   la latence.
2. **Plafonds déjà en place.** La route API accepte au plus 6 000 positions et
   décime à 400 points avant échantillonnage ; le worker fait de même. La charge
   réelle est donc proche du scénario 1 000 points (p95 0,57 ms) : un gain de 2×
   y serait invisible et non mesurable de façon stable.
3. **Coût du WASM.** Il faudrait ajouter le téléchargement + compilation du
   module (cold start), la frontière JS↔WASM (copie de buffers), un second
   chemin de code à maintenir et à tester (parité numérique flottante), pour un
   budget de 150 Ko gzip. Le critère « gain ≥ 2× end-to-end » n'est pas
   atteignable quand le calcul représente < 2 % du temps perçu.
4. **L'incident P0 venait du code, pas du langage.** La boucle infinie de
   `resampleTrack` a été corrigée en TypeScript (OOM → 16 points en < 1 ms). Un
   portage Rust du même algorithme aurait reproduit le bug.

## Toolchain — contrainte d'environnement

`cargo`, `rustc`, `rustup`, `wasm-pack` et `brew` sont **absents** de la machine.
Le contrat interdit l'installation par `curl | bash` et les paquets non figés.
Un banc comparatif Rust n'est donc pas exécutable ici : `BLOCKED` pour la
mesure Rust, mais **la décision ne dépend pas de cette mesure** — le critère
end-to-end est déjà manqué par construction (voir §« Pourquoi »).

## Décision

**NO-GO Rust/WASM dans ce chantier.** Le moteur TypeScript reste la référence
unique, corrigé, testé (40 tests) et instrumenté (`explorer:bench:geo`).

## Conditions de réouverture (mesurables)

Rouvrir le sujet **si et seulement si** l'une de ces preuves existe :

- un profil sur appareil réel (iPhone milieu de gamme / Android) montre un
  p95 **> 16 ms** sur le calcul géo pour un parcours utilisateur identifié ;
- un traitement **batch** hors interaction apparaît (isochrones sur grille
  Dijkstra/Tobler, matching de 100 k+ points GPX, simplification de masse) où le
  calcul domine le temps total ;
- le réseau DEM est remplacé par un accès local (offline pack) et le calcul
  devient alors le premier poste.

Dans ces cas : prototype `crates/lkdv-geo` **derrière feature flag OFF**, chargé
uniquement depuis le worker, avec fallback TS, tests de parité (dateline, pôles,
segments vides, NaN, MultiLineString) et mesure end-to-end p50/p95 avant toute
activation.
