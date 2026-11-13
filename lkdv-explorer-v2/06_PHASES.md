# 06 · Plan en 11 phases

Chaque phase se termine par une **gate** : toutes les commandes vertes, preuves dans `MISSION_LOG.md`, commit `chore(explorer-v2): gate Pn`. Pas de phase suivante tant que la gate est rouge. Gate commune à toutes les phases : `npm run type-check && npm run lint && npm test -- explorer-v2 && npm run build` + contrôles grep (`08_TESTS.md §6`).

| Phase | Objet | Sortie attendue | Gate spécifique |
|---|---|---|---|
| P0 | Démarrage et audit vérifié | branche, skills installées, `verify-all.mjs`, `AUDIT_VERIFIE.md` (chiffres BDD et fichiers revérifiés), baseline tests et bundle | `explorer:verify` s’exécute (même rouge) ; baseline enregistrée |
| P1 | Données et sécurité | migrations §3 de `05_DONNEES.md`, imports Natural Earth / Overpass / Wikidata, RPC, RLS, API v2 Zod + rate limit | tests SQL + intrusion RLS verts ; chaque RPC répond < 300 ms sur la BDD réelle (`explain analyze` consigné) |
| P2 | Moteur carte | `MapStage` unique, globe → mercator, relief, couches par niveau, hiérarchie, styles de tracés, caméra 6 mouvements | e2e `map-*.spec.ts` ; trace de frames ≥ 55 i/s ; capture de chaque niveau |
| P3 | Shell et tiroir | page plein écran, capsule recherche + fil d’Ariane, calques, barre basse, `ExplorerSheet` (crans, onglets, lentille, mini), toast, flag `explorer_v2_enabled` | e2e crans et onglets ; a11y axe sans violation sérieuse |
| P4 | Niveaux | Monde, Pays, Région, Lieu, Monde Asie, Japon, Nagano, USA, Chili, Mongolie (tout pays disponible, pas seulement ces 6) | parité des 10 écrans ; tout pays du globe ouvrable |
| P5 | Points | Sommet, Eau, Refuge, Bivouac, Belvédère, Danger, Accès, Ami + signalement (création, confirmation présent/disparu) | parité 8 écrans ; écriture réelle d’un signalement en base de test puis suppression |
| P6 | Itinéraire et outils | Rando (profil, survol), Départ (trips), Recherche (texte + naturel), Calques, Hors-ligne | survol mesuré ; départ créé et relu ; zone hors-ligne utilisable en mode avion simulé |
| P7 | Activités | Démarrer, 9 sports, compte à rebours, mode suivi, hors-trace, SOS simulé, bilan, Live Activity, haptique | e2e avec GPS rejoué (`tests/explorer-v2/fixtures/tracks/*.gpx`) pour chaque sport ; bilan écrit dans `hike_sessions` ; build iOS CI vert |
| P8 | États et accessibilité | Bienvenue, Sans position, Mode facile, Nuit, Hors ligne, Arrière-plan, VoiceOver, réduire les animations, textes agrandis, unités impériales | a11y complet ; captures thème sombre et texte 200 % |
| P9 | Performance et Rust | budgets `02_ARCHITECTURE.md §9`, worker géo, bench TS vs WASM, décision consignée | Lighthouse CI et `next build` dans les budgets |
| P10 | Bascule et finition | parité 42 écrans, inventaire de clics 100 %, flag 100 %, suppression legacy, `RAPPORT_FINAL.md`, PR | `npm run explorer:verify` = 0 sur deux exécutions consécutives |
