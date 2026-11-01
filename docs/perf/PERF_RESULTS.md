# PERF_RESULTS — Mission « Fusée » (point du 01/11/2026)

Méthode : `scripts/perf/measure-surfaces.mjs`, iPhone 393 × 852, **cache froid** (contexte neuf à chaque passage), profil mobile Lighthouse (CPU × 4, RTT 150 ms, 1,6 Mbit/s), connexion démo (lecture seule), 4 passages après préchauffage, médiane / p75 par interpolation. Aperçus Vercel (région des fonctions `cdg1`, même base Supabase que la production).
- **Avant** : `2265e0b` (= `main` + correctif de la boucle de l'Explorer, sans allègement), redéployé `gj92s6oau`.
- **Après** : `d691532` (allègement, écran de démarrage retiré, carte anticipée, décalage Communauté corrigé), `39cfizji2`.
- « Visible » = effacement de l'écran de démarrage quand il existe (avant), sinon LCP (après). Ces deux définitions ne mesurent pas exactement la même chose : voir la lecture sous le tableau.

## Laboratoire (ms, médiane / p75)

| Surface | TTFB avant | TTFB après | FCP avant | FCP après | Visible avant | Visible après | CLS avant | CLS après |
|---|---|---|---|---|---|---|---|---|
| HUB | 448 / 481 | 425 / 469 | 856 / 923 | 1 024 / 1 092 | 1 506 / 1 924 | **1 294 / 1 515** | 0,022 | 0,022 (préexistant) |
| Compas | 507 / 541 | 467 / 475 | 1 088 / 1 103 | 1 092 / 1 113 | 1 453 / 1 517 | 1 444 / 1 494 | 0 | 0 |
| Compte | 357 / 401 | 392 / 408 | 718 / 773 | 1 796 / 1 939 | 1 327 / 1 368 | 1 796 / 2 271 | 0 | 0 |
| Communauté | 599 / 619 | 462 / 567 | 1 002 / 1 045 | 890 / 986 | 1 515 / 1 545 | 3 272 / 3 380 | 0 | **0** (0,017 corrigé) |
| Explorer (interface) | 574 / 592 | 666 / 701 | 1 550 / 1 572 | 1 684 / 1 748 | **7 354 / 7 626** | **1 684 / 1 748** | 0 | 0 |

Lecture honnête :
- **Explorer** : l'interface (squelette, barres, contrôles) devient visible à 1,7 s au lieu de 7,4 s. Les **premiers pixels de la carte** restent tardifs : mesurés en local (même profil), ~8,6 s → ~7,9 s ; carte interactive ~16,3 s → ~15,9 s. Très loin du budget (< 0,6 s).
- **HUB** : contenu visible ~0,2 s plus tôt (médiane), ~0,4 s (p75).
- **Compte** et **Communauté** : le « visible » d'avant était l'effacement du logo, pas l'arrivée du contenu. Le contenu du Compte arrivait déjà vers 1,8 s (page entièrement rendue côté client, fond de l'app affiché en attendant) ; celui de la Communauté (vignette vidéo du fil, plus grand élément) vers 3,3 s. Pas de recul réel du contenu, mais pas de gain non plus : ce sont les prochains chantiers.
- **FCP** du HUB et du Compte plus tardif : avant, le premier « contenu » peint était le logo de démarrage, servi tout de suite ; il n'existe plus.

## Poids JS (gzip, union mise en page racine + page, `npm run perf:budget`)

| Surface | Avant (01/11, `main`) | Après | Budget mission |
|---|---|---|---|
| Mise en page racine (toutes les pages) | 518 Ko | **331 Ko** | — |
| HUB (tableau Next « First Load ») | 554 Ko | 403 Ko | 180 Ko |
| Compas (tableau Next) | 537 Ko | 387 Ko | 180 Ko |
| Page club (tableau Next) | 677 Ko | 342 Ko | 180 Ko |
| Communauté (tableau Next) | 413 Ko | 329 Ko | 180 Ko |
| Explorer (union) | — | 369 Ko | 180 Ko |

## Défauts corrigés au passage

| Défaut | Effet | Preuve |
|---|---|---|
| Boucle de rechargement de `/explorer` (2 service workers sur la même portée) | 12 rechargements en 15 s **en production** → 2 navigations (normales) sur l'aperçu | test `src/lib/pwa/__tests__/serviceWorkerScopes.test.ts` (rouge sur l'ancien code) |
| 5 vidéos (≈ 1,4 Mo) préchargées au repos sur toutes les pages, quel que soit le réseau | bande passante volée à la page en cours | suivi de la politique réseau existante |
| Décalage de 16 px du fil Communauté après le démarrage | CLS 0,017 → 0 | sonde de layout-shift |
| Test `overpassEndpoints` en échec (EISDIR sur `src/app/sw.js/`) | suite Compas rouge | 5/5 |

## Budgets de la mission : où on en est

| Budget | Cible | Statut après |
|---|---|---|
| Contenu visible / LCP < 1,2 s (plafond 2 s) | HUB 1,3 s ✓ plafond ; Compas 1,4 s ✓ plafond ; Compte 1,8 s ✓ plafond ; Communauté 3,3 s ✗ ; Explorer interface 1,7 s ✓ plafond | partiel |
| Premiers pixels de carte < 0,6 s | ~7,9 s (local) | ✗ |
| INP p75 < 150 ms | RUM 112-136 ms là où mesuré | ✓ (petit échantillon) |
| CLS 0 | Communauté 0 ; HUB 0,022 (préexistant) | partiel |
| JS par surface < 180 Ko | 330-560 Ko (union) | ✗ |

**Conclusion : l'app n'est pas encore au niveau d'Instagram.** Les gains de ce lot sont réels (Explorer utilisable 5,7 s plus tôt, −186 Ko sur toutes les pages, défaut de production corrigé), mais la carte, le poids JS et la Communauté restent hors budget. Suite : voir « Reste à faire » dans `DECISIONS.md`.
