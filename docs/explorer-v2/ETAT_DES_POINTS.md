# ÉTAT DES POINTS · Explorer v2

Vérité terrain au 2026-10-28 12:00. Aucune case n'est cochée sans preuve
exécutée ; les points non terminés restent **non cochés** et sont listés ici.

## Cochés (preuve dans MISSION_LOG.md)

| Phase | Points cochés | Total phase |
|---|---|---|
| P0 | P0-01, P0-02, P0-03, P0-04, P0-05, P0-06, P0-08 | 7 / 9 |
| P1 | P1-04 partiel, P1-05, P1-06, P1-07, P1-08, P1-09, P1-10, P1-11, P1-12 partiel, P1-13, P1-14 | 11 / 15 |
| P2 | P2-01, P2-02, P2-03, P2-04 | 4 / 14 |
| P3 | P3-01 partiel, P3-02 partiel, P3-04, P3-05, P3-06, P3-08, P3-09 | 7 / 10 |
| P4 | P4-01 → P4-10 partiels | 0 coché (10 partiels) |
| P5 | P5-01 → P5-08 partiels | 0 coché (8 partiels) |
| P6 | P6-01 → P6-05 partiels | 0 coché (5 partiels) |
| P7 | P7-01 → P7-12 partiels | 0 coché (12 partiels) |
| P8 | P8-01 → P8-04 partiels | 0 coché (4 partiels) |

« Partiel » = l'écran est rendu avec des données réelles, mais au moins un
élément de la spec manque (état vide au lieu d'un contenu, outil absent).

## Non cochés et pourquoi (blocage associé)

| Point | Manque | Blocage |
|---|---|---|
| P0-07 | Baseline complète (Lighthouse + liste des tests rouges préexistants) | BLOCAGES #7 (lhci absent) |
| P0-GATE / P1-GATE … | Gate de phase (`npm run explorer:verify` = 0) | voir VERIFY_LAST : lint/build OK, e2e partiel, budget de bundle non tenu |
| P1-01, P1-02 | Géométries pays/régions **en base** | BLOCAGES #1, #2 |
| P1-03 | Import Wikidata des faits pratiques | BLOCAGES #4 |
| P1-04 (reste) | Import POI mondial | BLOCAGES #3 |
| P1-12 (reste) | Rate limit + `/search` | non implémenté |
| P2-05 → P2-13 | Hiérarchie P0–P3, collisions, 13 styles de tracés, plongée, survol, orbite, révélation, suivi, vue d'ensemble, reduced-motion | non implémenté (seule la plongée de caméra existe) |
| P3-03, P3-07 | Bouton boussole (présent mais non fonctionnel), toast | partiel |
| P4-11, P4-12 | 237/246 pays ouvrables ; unités impériales | partiel / absent |
| P5-09, P5-10 | Création/confirmation de signalement | absent |
| P6-06 → P6-09 | Profil altimétrique, départ en base, recherche naturelle, zone hors ligne | BLOCAGES #8 |
| P7-13 → P7-21 | GPS rejoué, hors-trace, SOS réel, bilan en base, Live Activity | BLOCAGES #6 |
| P8-05 → P8-08 | VoiceOver, texte 200 %, cibles 44 px, i18n | partiel |
| P9 | Budgets, Lighthouse, mémoire, Rust/WASM | BLOCAGES #7 |
| P10 | Parité 42, clics 100 %, flag 100 %, legacy supprimé, PR | partiel (PR ouverte, legacy conservé) |

## Ce qui marche réellement, de bout en bout

1. `/explorer?v2=1` sert **ExplorerV2** ; `?scene=<nom>` charge un des 41 états.
2. Globe MapLibre (projection globe) → mercator, relief terrarium dès le niveau 3.
3. 237 pays réels (Natural Earth) + 239 fichiers de régions Natural Earth ;
   la région sous le doigt est résolue par point-dans-polygone.
4. Repères réels : `explorer_pois` (112 400 eau/refuges + 522 sommets/vues/cols
   importés) triés par priorité, affichés en pastilles verre.
5. Itinéraires réels : `explorer_routes` (1 181 traces OSM), tracés rouges pointillés.
6. Météo réelle MET Norway, compteurs réels `explorer_place`.
7. Feuille à 4 crans, capsule d'onglets avec lentille, mini-sélecteur,
   pastille d'activité, SOS, barre basse unique.
8. 14 tests unitaires verts, 10 tests Playwright dont 7 verts au dernier passage.
