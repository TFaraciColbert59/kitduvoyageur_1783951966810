# 07 · Checklist de progression

Coche `[x]` uniquement avec une entrée correspondante dans `docs/explorer-v2/MISSION_LOG.md`. Format : **ID · tâche — preuve exigée**.

## P0 · Démarrage et audit vérifié

- [ ] **P0-01** · Branche `feat/explorer-v2` créée depuis `main` à jour — _preuve : `git log -1 --format=%H origin/main` + `git branch --show-current`_
- [ ] **P0-02** · Skills copiées dans `.agents/skills/` et `.agent/skills/` — _preuve : `ls .agents/skills | grep explorer`_
- [ ] **P0-03** · `docs/explorer-v2/` initialisé (MISSION_LOG, DECISIONS, BLOCAGES) — _preuve : `ls docs/explorer-v2`_
- [ ] **P0-04** · `scripts/explorer-v2/verify-all.mjs` + script `explorer:verify` — _preuve : sortie de `npm run explorer:verify`_
- [ ] **P0-05** · `list_projects` → ID `icxyvwzfjbflcbqukpfz` confirmé — _preuve : sortie MCP_
- [ ] **P0-06** · Chiffres BDD de `01_AUDIT.md §3` revérifiés → `AUDIT_VERIFIE.md` — _preuve : requêtes SQL et résultats_
- [ ] **P0-07** · Baseline : tests existants (liste des rouges préexistants), First Load JS `/explorer`, Lighthouse — _preuve : sorties de commandes_
- [ ] **P0-08** · Maquette servie en local et 42 captures relues — _preuve : `npx serve` + liste des captures_
- [ ] **P0-GATE** · gate de phase verte (`06_PHASES.md`)

## P1 · Données et sécurité

- [ ] **P1-01** · Géométries des 80 pays manquants importées (Natural Earth) — _preuve : `select count(*) from countries_geo where geometry is null` = 0_
- [ ] **P1-02** · Géométries admin niveau 1 importées et simplifiées, index GIST — _preuve : count non null niveau 1 ; `\d admin_regions_geo`_
- [ ] **P1-03** · Table `country_practical` + import Wikidata avec licence — _preuve : count + 3 exemples (FR, JP, US)_
- [ ] **P1-04** · POI : sommets, belvédères, cols, parkings, arrêts importés par Overpass (Alpes d’abord, puis monde par tuiles en tâche de fond) — _preuve : répartition par subtype_
- [ ] **P1-05** · RPC `explorer_pois` triée par priorité, limitée, bbox bornée — _preuve : `explain analyze` < 300 ms_
- [ ] **P1-06** · RPC `explorer_place` (compteurs réels) — _preuve : appel sur Chamonix et sur un point vide_
- [ ] **P1-07** · Tables `activity_sessions` + `activity_points` + RPC `finish_activity_session` — _preuve : insertion/finish en test puis nettoyage_
- [ ] **P1-08** · `sos_alerts` étendue — _preuve : `information_schema.columns`_
- [ ] **P1-09** · `activity_catalog` : `escalade-voie` + mapping 9 sports — _preuve : select des 9 slugs_
- [ ] **P1-10** · Flag `explorer_v2_enabled` créé à 0 % — _preuve : select feature_flags_
- [ ] **P1-11** · RLS de chaque nouvelle table + test d’intrusion croisée — _preuve : `pg_policies` + sortie du script d’intrusion_
- [ ] **P1-12** · Routes API v2 (§6 de 02) avec Zod, rate limit, cache — _preuve : tests Vitest des routes (valide, invalide, limite)_
- [ ] **P1-13** · Proxy météo MET Norway avec User-Agent et cache — _preuve : appel réel + en-têtes de cache_
- [ ] **P1-14** · CSP mise à jour + tests CSP verts — _preuve : `npx playwright test tests/security`_
- [ ] **P1-GATE** · gate de phase verte (`06_PHASES.md`)

## P2 · Moteur carte

- [ ] **P2-01** · `MapStage` monté une seule fois, chargé en différé — _preuve : compteur de montage en test_
- [ ] **P2-02** · Projection globe → mercator selon niveau — _preuve : captures z1, z5, z12_
- [ ] **P2-03** · Relief terrarium + hillshade dès z ≥ 9 — _preuve : capture Chamonix 3D_
- [ ] **P2-04** · Couches pays/régions/itinéraires/POI/amis/utilisateur — _preuve : e2e : chaque source chargée_
- [ ] **P2-05** · Hiérarchie P0–P3 + collisions + clustering + zones protégées — _preuve : e2e : densité ≤ 6 / 100 px, rien sous le tiroir_
- [ ] **P2-06** · 13 styles de tracés — _preuve : capture planche réelle comparée à `Traces.png`_
- [ ] **P2-07** · Plongée entre niveaux — _preuve : e2e + trace de frames_
- [ ] **P2-08** · Survol de trace — _preuve : e2e + durée mesurée_
- [ ] **P2-09** · Orbite de sommet (pause au toucher, reprise 6 s) — _preuve : e2e_
- [ ] **P2-10** · Révélation de point — _preuve : e2e_
- [ ] **P2-11** · Suivi en activité — _preuve : e2e GPS rejoué_
- [ ] **P2-12** · Vue d’ensemble — _preuve : e2e_
- [ ] **P2-13** · Réduire les animations respecté — _preuve : e2e avec `reducedMotion: reduce`_
- [ ] **P2-GATE** · gate de phase verte (`06_PHASES.md`)

## P3 · Shell et tiroir

- [ ] **P3-01** · Page plein écran, safe areas, une seule barre basse — _preuve : capture iPhone 15 webkit_
- [ ] **P3-02** · Capsule recherche + fil d’Ariane cliquable — _preuve : e2e_
- [ ] **P3-03** · Bouton calques / boussole en activité — _preuve : e2e_
- [ ] **P3-04** · `ExplorerSheet` : 4 crans, glisser suivi au doigt, inertie — _preuve : e2e drag_
- [ ] **P3-05** · Capsule d’onglets (actif = libellé) + lentille + volets — _preuve : e2e_
- [ ] **P3-06** · Mini-sélecteur uniquement Région, Lieu, Itinéraire — _preuve : e2e : absent ailleurs_
- [ ] **P3-07** · Toast sous l’Island (aucun contenu dans l’Island en app) — _preuve : e2e_
- [ ] **P3-08** · Table haptique branchée (`09_DESIGN.md §6`) — _preuve : tests unitaires du mapping_
- [ ] **P3-09** · Flag : v1 si 0 %, v2 si activé ou `?v2=1` en dev — _preuve : e2e deux modes_
- [ ] **P3-GATE** · gate de phase verte (`06_PHASES.md`)

## P4 · Niveaux

- [ ] **P4-01** · Écran **Monde** (Monde · globe) : contenu, onglets, boutons, données réelles [03_ECRANS#monde] — _preuve : capture réelle `preuves/Monde.png` + e2e `Monde.spec.ts`_
- [ ] **P4-02** · Écran **Pays** (Pays · France) : contenu, onglets, boutons, données réelles [03_ECRANS#pays] — _preuve : capture réelle `preuves/Pays.png` + e2e `Pays.spec.ts`_
- [ ] **P4-03** · Écran **Region** (Région · Auvergne-Rhône-Alpes) : contenu, onglets, boutons, données réelles [03_ECRANS#region] — _preuve : capture réelle `preuves/Region.png` + e2e `Region.spec.ts`_
- [ ] **P4-04** · Écran **Lieu** (Lieu · Chamonix) : contenu, onglets, boutons, données réelles [03_ECRANS#lieu] — _preuve : capture réelle `preuves/Lieu.png` + e2e `Lieu.spec.ts`_
- [ ] **P4-05** · Écran **MondeAsie** (Globe · un pays touché) : contenu, onglets, boutons, données réelles [03_ECRANS#mondeasie] — _preuve : capture réelle `preuves/MondeAsie.png` + e2e `MondeAsie.spec.ts`_
- [ ] **P4-06** · Écran **Japon** (Pays · Japon) : contenu, onglets, boutons, données réelles [03_ECRANS#japon] — _preuve : capture réelle `preuves/Japon.png` + e2e `Japon.spec.ts`_
- [ ] **P4-07** · Écran **Nagano** (Région · Nagano) : contenu, onglets, boutons, données réelles [03_ECRANS#nagano] — _preuve : capture réelle `preuves/Nagano.png` + e2e `Nagano.spec.ts`_
- [ ] **P4-08** · Écran **USA** (Pays · États-Unis, unités) : contenu, onglets, boutons, données réelles [03_ECRANS#usa] — _preuve : capture réelle `preuves/USA.png` + e2e `USA.spec.ts`_
- [ ] **P4-09** · Écran **Chili** (Pays · Chili, hémisphère sud) : contenu, onglets, boutons, données réelles [03_ECRANS#chili] — _preuve : capture réelle `preuves/Chili.png` + e2e `Chili.spec.ts`_
- [ ] **P4-10** · Écran **Mongolie** (Pays peu documenté) : contenu, onglets, boutons, données réelles [03_ECRANS#mongolie] — _preuve : capture réelle `preuves/Mongolie.png` + e2e `Mongolie.spec.ts`_
- [ ] **P4-11** · Tout pays du globe ouvrable (pas seulement les 6 de la maquette) — _preuve : e2e sur 10 pays tirés au hasard_
- [ ] **P4-12** · Unités impériales pour US, LR, MM ; réglage utilisateur — _preuve : e2e_
- [ ] **P4-GATE** · gate de phase verte (`06_PHASES.md`)

## P5 · Points d’intérêt

- [ ] **P5-01** · Écran **Sommet** (Sommet · Le Brévent) : contenu, onglets, boutons, données réelles [03_ECRANS#sommet] — _preuve : capture réelle `preuves/Sommet.png` + e2e `Sommet.spec.ts`_
- [ ] **P5-02** · Écran **Eau** (Point d’eau · Chéserys) : contenu, onglets, boutons, données réelles [03_ECRANS#eau] — _preuve : capture réelle `preuves/Eau.png` + e2e `Eau.spec.ts`_
- [ ] **P5-03** · Écran **Refuge** (Refuge) : contenu, onglets, boutons, données réelles [03_ECRANS#refuge] — _preuve : capture réelle `preuves/Refuge.png` + e2e `Refuge.spec.ts`_
- [ ] **P5-04** · Écran **Bivouac** (Bivouac signalé) : contenu, onglets, boutons, données réelles [03_ECRANS#bivouac] — _preuve : capture réelle `preuves/Bivouac.png` + e2e `Bivouac.spec.ts`_
- [ ] **P5-05** · Écran **Belvedere** (Point de vue) : contenu, onglets, boutons, données réelles [03_ECRANS#belvedere] — _preuve : capture réelle `preuves/Belvedere.png` + e2e `Belvedere.spec.ts`_
- [ ] **P5-06** · Écran **Danger** (Danger signalé) : contenu, onglets, boutons, données réelles [03_ECRANS#danger] — _preuve : capture réelle `preuves/Danger.png` + e2e `Danger.spec.ts`_
- [ ] **P5-07** · Écran **Acces** (Accès et transports) : contenu, onglets, boutons, données réelles [03_ECRANS#acces] — _preuve : capture réelle `preuves/Acces.png` + e2e `Acces.spec.ts`_
- [ ] **P5-08** · Écran **Ami** (Ami sur la carte) : contenu, onglets, boutons, données réelles [03_ECRANS#ami] — _preuve : capture réelle `preuves/Ami.png` + e2e `Ami.spec.ts`_
- [ ] **P5-09** · Créer un signalement + confirmer présent/disparu (base de test) — _preuve : lignes créées puis supprimées_
- [ ] **P5-10** · États vides propres quand aucune donnée — _preuve : captures_
- [ ] **P5-GATE** · gate de phase verte (`06_PHASES.md`)

## P6 · Itinéraire et outils

- [ ] **P6-01** · Écran **Rando** (Randonnée · survol 3D) : contenu, onglets, boutons, données réelles [03_ECRANS#rando] — _preuve : capture réelle `preuves/Rando.png` + e2e `Rando.spec.ts`_
- [ ] **P6-02** · Écran **Depart** (Créer un départ) : contenu, onglets, boutons, données réelles [03_ECRANS#depart] — _preuve : capture réelle `preuves/Depart.png` + e2e `Depart.spec.ts`_
- [ ] **P6-03** · Écran **Recherche** (Recherche IA) : contenu, onglets, boutons, données réelles [03_ECRANS#recherche] — _preuve : capture réelle `preuves/Recherche.png` + e2e `Recherche.spec.ts`_
- [ ] **P6-04** · Écran **Calques** (Calques de la carte) : contenu, onglets, boutons, données réelles [03_ECRANS#calques] — _preuve : capture réelle `preuves/Calques.png` + e2e `Calques.spec.ts`_
- [ ] **P6-05** · Écran **HorsLigne** (Hors ligne) : contenu, onglets, boutons, données réelles [03_ECRANS#horsligne] — _preuve : capture réelle `preuves/HorsLigne.png` + e2e `HorsLigne.spec.ts`_
- [ ] **P6-06** · Profil altimétrique depuis DEM (worker) — _preuve : test unitaire sur trace connue_
- [ ] **P6-07** · Départ réel écrit dans `trips` puis relu — _preuve : SQL_
- [ ] **P6-08** · Recherche naturelle : 10 requêtes types → filtres attendus — _preuve : tests Vitest_
- [ ] **P6-09** · Zone hors-ligne : téléchargement, taille, purge, mode avion — _preuve : e2e `context.setOffline(true)`_
- [ ] **P6-GATE** · gate de phase verte (`06_PHASES.md`)

## P7 · Activités

- [ ] **P7-01** · Écran **Demarrer** (Démarrer une activité) : contenu, onglets, boutons, données réelles [03_ECRANS#demarrer] — _preuve : capture réelle `preuves/Demarrer.png` + e2e `Demarrer.spec.ts`_
- [ ] **P7-02** · Écran **Course** (Course en direct · Island) : contenu, onglets, boutons, données réelles [03_ECRANS#course] — _preuve : capture réelle `preuves/Course.png` + e2e `Course.spec.ts`_
- [ ] **P7-03** · Écran **Kayak** (Kayak en direct) : contenu, onglets, boutons, données réelles [03_ECRANS#kayak] — _preuve : capture réelle `preuves/Kayak.png` + e2e `Kayak.spec.ts`_
- [ ] **P7-04** · Écran **RandoLive** (Randonnée en direct) : contenu, onglets, boutons, données réelles [03_ECRANS#randolive] — _preuve : capture réelle `preuves/RandoLive.png` + e2e `RandoLive.spec.ts`_
- [ ] **P7-05** · Écran **Velo** (Vélo en direct) : contenu, onglets, boutons, données réelles [03_ECRANS#velo] — _preuve : capture réelle `preuves/Velo.png` + e2e `Velo.spec.ts`_
- [ ] **P7-06** · Écran **SkiRando** (Ski de rando en direct) : contenu, onglets, boutons, données réelles [03_ECRANS#skirando] — _preuve : capture réelle `preuves/SkiRando.png` + e2e `SkiRando.spec.ts`_
- [ ] **P7-07** · Écran **Escalade** (Escalade en direct) : contenu, onglets, boutons, données réelles [03_ECRANS#escalade] — _preuve : capture réelle `preuves/Escalade.png` + e2e `Escalade.spec.ts`_
- [ ] **P7-08** · Écran **Trail** (Trail en direct) : contenu, onglets, boutons, données réelles [03_ECRANS#trail] — _preuve : capture réelle `preuves/Trail.png` + e2e `Trail.spec.ts`_
- [ ] **P7-09** · Écran **Famille** (Balade en famille) : contenu, onglets, boutons, données réelles [03_ECRANS#famille] — _preuve : capture réelle `preuves/Famille.png` + e2e `Famille.spec.ts`_
- [ ] **P7-10** · Écran **BivouacNuit** (Bivouac de nuit) : contenu, onglets, boutons, données réelles [03_ECRANS#bivouacnuit] — _preuve : capture réelle `preuves/BivouacNuit.png` + e2e `BivouacNuit.spec.ts`_
- [ ] **P7-11** · Écran **HorsTrace** (Hors itinéraire) : contenu, onglets, boutons, données réelles [03_ECRANS#horstrace] — _preuve : capture réelle `preuves/HorsTrace.png` + e2e `HorsTrace.spec.ts`_
- [ ] **P7-12** · Écran **SOS** (SOS) : contenu, onglets, boutons, données réelles [03_ECRANS#sos] — _preuve : capture réelle `preuves/SOS.png` + e2e `SOS.spec.ts`_
- [ ] **P7-13** · Écran **Bilan** (Fin de sortie) : contenu, onglets, boutons, données réelles [03_ECRANS#bilan] — _preuve : capture réelle `preuves/Bilan.png` + e2e `Bilan.spec.ts`_
- [ ] **P7-14** · Écran **Arriere** (Arrière-plan · Live Activity) : contenu, onglets, boutons, données réelles [03_ECRANS#arriere] — _preuve : capture réelle `preuves/Arriere.png` + e2e `Arriere.spec.ts`_
- [ ] **P7-15** · Compte à rebours 3·2·1 + appui long carte pour lancer — _preuve : e2e_
- [ ] **P7-16** · GPS rejoué pour les 9 sports, métriques cohérentes — _preuve : e2e + valeurs attendues_
- [ ] **P7-17** · Hors-trace : seuils 40 m / 15 s, retour 25 m — _preuve : e2e_
- [ ] **P7-18** · SOS : maintien 1,5 s, compte à rebours annulable, appel simulé, ligne `sos_alerts` — _preuve : e2e + SQL_
- [ ] **P7-19** · Stop par maintien 0,8 s → bilan → `hike_sessions` — _preuve : SQL_
- [ ] **P7-20** · Plugin Live Activity Swift + pont JS no-op web — _preuve : build iOS CI vert_
- [ ] **P7-21** · Hors ligne pendant activité : file `offline_sync_operations` puis synchro — _preuve : e2e_
- [ ] **P7-GATE** · gate de phase verte (`06_PHASES.md`)

## P8 · États et accessibilité

- [ ] **P8-01** · Écran **Bienvenue** (Bienvenue · profil) : contenu, onglets, boutons, données réelles [03_ECRANS#bienvenue] — _preuve : capture réelle `preuves/Bienvenue.png` + e2e `Bienvenue.spec.ts`_
- [ ] **P8-02** · Écran **SansPosition** (Position refusée) : contenu, onglets, boutons, données réelles [03_ECRANS#sansposition] — _preuve : capture réelle `preuves/SansPosition.png` + e2e `SansPosition.spec.ts`_
- [ ] **P8-03** · Écran **Facile** (Mode facile) : contenu, onglets, boutons, données réelles [03_ECRANS#facile] — _preuve : capture réelle `preuves/Facile.png` + e2e `Facile.spec.ts`_
- [ ] **P8-04** · Écran **Nuit** (Mode sombre) : contenu, onglets, boutons, données réelles [03_ECRANS#nuit] — _preuve : capture réelle `preuves/Nuit.png` + e2e `Nuit.spec.ts`_
- [ ] **P8-05** · VoiceOver : libellés, ordre, annonces toast — _preuve : audit axe + liste des libellés_
- [ ] **P8-06** · Texte 200 % sans chevauchement — _preuve : captures_
- [ ] **P8-07** · Cibles ≥ 44 px — _preuve : test automatique des tailles_
- [ ] **P8-08** · Tous les textes via le système i18n existant (`docs/I18N_STRATEGY.md`), français complet, clés prêtes pour l’anglais — _preuve : `rg` des chaînes en dur dans `src/features/explorer-v2` = 0_
- [ ] **P8-GATE** · gate de phase verte (`06_PHASES.md`)

## P9 · Performance et Rust

- [ ] **P9-01** · First Load JS `/explorer` ≤ 170 Ko — _preuve : sortie `next build`_
- [ ] **P9-02** · LCP ≤ 2,0 s, INP ≤ 100 ms (Lighthouse CI mobile) — _preuve : rapport_
- [ ] **P9-03** · ≥ 55 i/s pendant chaque mouvement de caméra — _preuve : trace Playwright_
- [ ] **P9-04** · Mémoire après 10 min d’activité simulée < +40 Mo — _preuve : mesure `performance.memory` / CDP_
- [ ] **P9-05** · Worker géo TS + bench — _preuve : `bench-geo.mjs`_
- [ ] **P9-06** · Crate Rust/WASM si gain ≥ 2× (sinon décision consignée) — _preuve : bench comparé_
- [ ] **P9-07** · Requêtes au démarrage ≤ 12 hors tuiles — _preuve : HAR_
- [ ] **P9-08** · Index BDD vérifiés pour chaque RPC — _preuve : `explain analyze`_
- [ ] **P9-09** · Erreurs client journalisées sans coordonnées précises (RUM/console serveur existants) — _preuve : test qui force une erreur et lit le journal_
- [ ] **P9-GATE** · gate de phase verte (`06_PHASES.md`)

## P10 · Bascule et finition

- [ ] **P10-01** · `PARITE.md` : 42 paires de captures maquette/réel — _preuve : fichier + images_
- [ ] **P10-02** · Inventaire de clics 100 % (`08_TESTS.md §3`) — _preuve : rapport de couverture_
- [ ] **P10-03** · Flag `explorer_v2_enabled` à 100 % — _preuve : SQL_
- [ ] **P10-04** · Legacy Explorer supprimé (ExplorerClient, ExplorerMap…) sans casser d’import — _preuve : `next build` + `rg ExplorerClient`_
- [ ] **P10-05** · `/carte-interactive` redirige vers `/explorer` — _preuve : e2e_
- [ ] **P10-06** · `RAPPORT_FINAL.md` complet — _preuve : fichier_
- [ ] **P10-07** · `npm run explorer:verify` = 0 deux fois de suite — _preuve : sorties_
- [ ] **P10-08** · Branche poussée, PR ouverte vers `main` — _preuve : URL de la PR_
- [ ] **P10-09** · Attributions carte (OSM, OpenFreeMap, AWS Terrain, Natural Earth, MET Norway, Wikidata) visibles + page mentions légales et son test mis à jour — _preuve : capture + test vert_
- [ ] **P10-10** · Build Android (`android/`) toujours compilable, aucune régression des autres routes (suite e2e globale relancée) — _preuve : sorties_
- [ ] **P10-11** · Métadonnées `/explorer` (titre, description, Open Graph) — _preuve : `curl` de la page_
- [ ] **P10-GATE** · gate de phase verte (`06_PHASES.md`)

Total : 135 points.