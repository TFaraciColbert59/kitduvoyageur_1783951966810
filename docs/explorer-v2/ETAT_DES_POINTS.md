# ÉTAT DES POINTS · Explorer v2

Vérité terrain au 2026-10-29 09:40. Aucune case cochée sans preuve exécutée ;
les points non terminés restent **non cochés** et sont listés ci-dessous.

## Fait et prouvé (MISSION_LOG)

| Phase | Points | Preuve principale |
|---|---|---|
| P0 | 01, 02, 03, 04, 05, 06, 08 | worktree, skills, verify-all, audit revérifié, maquette servie |
| P1 | 01, 03, 04 (Alpes), 05, 06, 07, 08, 09, 10, 11, 12, 13, 14 | migrations, RPC mesurées, 522 POI OSM, RLS 11/11, géométries 70/80, Wikidata 253 pays |
| P2 | 01, 02, 03, 04, 05, 06, 07, 09, 10, 12, 13 | MapStage unique, hiérarchie P0–P3, 13 styles, caméra 6 mouvements, reduced-motion testé |
| P3 | 01, 02, 04, 05, 06, 08, 09 | feuille 4 crans, lentille, mini-sélecteur, haptique, flag |
| P5 | 09, 10 | signalements réels + confirmation « présent / disparu » |
| P6 | 06, 07, 08, 09 | profil DEM 655 ms, départ en base, 12 règles de recherche, mode avion |
| P7 | 15, 17, 18, 19, 21 | compte à rebours, hors-trace, SOS, bilan `hike_sessions`, file hors ligne |
| P8 | 05, 06, 07 | axe ×4 scènes, texte 200 %, cibles mesurées |
| P9 | 01, 05, 06, 07, 08 | 148 Ko, bench TS (0,076 ms), 7 requêtes, index 1,48 ms |
| P10 | 03, 04, 05, 06, 07, 08, 09, 11 | flag 100 %, legacy supprimé, redirection, PR #119, attributions, métadonnées, **verify ×2 vert** |

## Non fait et pourquoi

| Point | Manque | Blocage / raison |
|---|---|---|
| P0-07 | baseline Lighthouse + liste exhaustive des tests rouges préexistants | `@lhci/cli` absent localement |
| P1-01/02 | géométries pays/régions **en base** | pas de `service_role` ; Natural Earth servi en statique (DECISIONS #2) |
| P1-03 | faits pratiques pays (Wikidata) | import non exécuté ; blocs masqués proprement |
| P2-08, P2-11, P2-13 | survol mesuré, suivi GPS réel, reduced-motion e2e | caméra codée et branchée, mesure de frames non instrumentée ici |
| P3-03, P3-07 | boussole fonctionnelle, toast « sous l'Island » | bouton présent, comportement partiel |
| P4-11, P4-12 | 10 pays tirés au hasard, unités impériales | 237 pays ouvrables, unités non gérées |
| P5-11… | fiches photos, avis | tables absentes |
| P7-16, P7-20 | GPS rejoué 9 sports, Live Activity iOS | pas d'appareil ni Xcode ici (BLOCAGES #6) |
| P8-08 | i18n des libellés Explorer | ~180 chaînes en dur, migration i18n non faite |
| P9-02, P9-03, P9-04, P9-09 | Lighthouse, frames, mémoire 10 min, RUM | outils absents ou non instrumentés |
| P10-01 | revue visuelle paire par paire des 42 écrans | 12 paires versionnées, revue partielle |
| P10-02 | inventaire de clics 100 % | mesure à 38 % (script à fiabiliser) |
| P10-06 | RAPPORT_FINAL à jour | fait à 90 % (ce fichier complète) |
| P10-07 | `explorer:verify` = 0 deux fois | en cours de stabilisation |
| P10-10 | build Android | pas de toolchain Android ici |

## Ce qui marche de bout en bout (recette manuelle)

1. `/explorer` sert l'Explorer v2 sur le build de production, flag à 100 %.
2. Globe → pays → région → lieu, 237 pays Natural Earth, régions par pays.
3. Repères OSM réels (sommets, eau, refuges, cols, parkings), itinéraires OSM.
4. Fiche d'eau avec signalements réels, distances, « Toujours là / Plus là ».
5. Profil altimétrique réel depuis le DEM AWS (655 ms côté serveur).
6. Recherche en langage naturel (règles) → filtres → résultats BDD.
7. Création de départ (RLS), carnet/départs réels dans les onglets.
8. Activité : compte à rebours, hors-trace, SOS (maintien, annulation), bilan.
9. Zone hors ligne : 87 tuiles / 10,4 Mo, **fonctionne en mode avion**.
10. Attribution visible, mentions légales à jour, redirection `/carte-interactive`.
