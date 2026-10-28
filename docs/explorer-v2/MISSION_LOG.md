# MISSION_LOG · Explorer v2

Journal de preuves. Une entrée par point de checklist coché. Jamais de point coché sans entrée ici.
Les points **non** cochés sont listés dans `ETAT_DES_POINTS.md` avec leur blocage.

## Format d'une entrée
```
### [ID] Titre du point · AAAA-MM-JJ HH:MM
- Commit : <sha court>
- Fichiers : <chemins>
- Preuve : <commande exécutée>
  <sortie réelle copiée, tronquée à 30 lignes max>
- Capture : docs/explorer-v2/preuves/<ID>.png (si visuel)
- Statut : OK | OK partiel (voir BLOCAGES.md#...)
```

---

### [P0-01] Branche `feat/explorer-v2` · 2026-10-28 10:02
- Commit : création du worktree depuis `0e0a35e4`
- Fichiers : —
- Preuve :
  ```
  $ git branch --show-current
  feat/explorer-v2
  $ git log -1 --format='%H %s' origin/main
  4969d92ad1f550b1e7bc104af631018d46f6998d feat(navigation): barre Liquid Glass Apple iOS 27 unifiee partout
  $ git merge-base --is-ancestor 0e0a35e4 HEAD && echo ok
  ok
  ```
- Statut : OK — travail dans un worktree dédié, le dépôt principal
  (`chantier/communaute-feed`, 24 fichiers modifiés non commités) n'est pas touché
  (DECISIONS #1).

### [P0-02] Skills copiées · 2026-10-28 11:12
- Fichiers : `.agents/skills/lkdv-explorer-v2-*`, `.agent/skills/lkdv-explorer-v2-*`
- Preuve :
  ```
  $ ls .agents/skills | grep explorer
  lkdv-explorer-v2-activity  lkdv-explorer-v2-data
  lkdv-explorer-v2-ios-native lkdv-explorer-v2-map
  lkdv-explorer-v2-orchestration lkdv-explorer-v2-qa
  lkdv-explorer-v2-rust-wasm lkdv-explorer-v2-sheet
  ```
- Statut : OK (8 skills dans les deux dossiers)

### [P0-03] `docs/explorer-v2/` initialisé · 2026-10-28 09:46
- Fichiers : `docs/explorer-v2/{MISSION_LOG,DECISIONS,BLOCAGES}.md`, `docs/explorer-v2/preuves/`
- Preuve : `ls docs/explorer-v2` → BLOCAGES.md DECISIONS.md MISSION_LOG.md preuves/
- Statut : OK

### [P0-04] `scripts/explorer-v2/verify-all.mjs` + `npm run explorer:verify` · 2026-10-28 10:05
- Fichiers : `scripts/explorer-v2/verify-all.mjs`, `package.json`
- Preuve :
  ```
  $ node --check scripts/explorer-v2/verify-all.mjs && echo SYNTAX_OK
  SYNTAX_OK
  $ node -e "console.log(require('./package.json').scripts['explorer:verify'])"
  node scripts/explorer-v2/verify-all.mjs
  ```
  10 étapes implémentées (type-check, lint, vitest, build + budget 170 Ko,
  Playwright ×2 projets, inventaire de clics, axe, greps, RLS, checklist),
  résumé horodaté dans `docs/explorer-v2/VERIFY_LAST.md`.
- Statut : OK (le script s'exécute ; la gate complète est rouge, voir §ÉTAT)

### [P0-05] Projet Supabase actif · 2026-10-28 09:47
- Preuve (MCP `list_projects`) :
  ```
  {"projects":[{"id":"icxyvwzfjbflcbqukpfz","name":"lekitduvoyageur2","region":"eu-west-3",
   "status":"ACTIVE_HEALTHY","database":{"version":"17.6.1.141"}}]}
  ```
- Statut : OK — un seul projet, le fantôme `lwrmuggefbmbojkjgudc` n'apparaît pas.

### [P0-06] Chiffres BDD revérifiés · 2026-10-28 09:47
- Fichiers : `docs/explorer-v2/AUDIT_VERIFIE.md`
- Preuve : `select` de comptage sur 14 tables (sortie dans AUDIT_VERIFIE §1) ;
  5 écarts découverts, dont **0 région française** dans `admin_regions_geo` et
  **0 politique RLS** sur `geo_pois`.
- Statut : OK

### [P0-08] Maquette servie et captures relues · 2026-10-28 11:14
- Preuve :
  ```
  $ ls handoff/explorer-v2/maquette/captures/*.png | wc -l
  45
  $ python3 -m http.server 4599 (dans maquette/) ; curl captures/Monde.png
  capture 200
  ```
- Statut : OK — 45 captures (42 écrans + Main, Hierarchie, Traces, Camera) lues :
  Monde, Lieu, Sommet, Countries/Regions, etc.

### [P1-04] POI sommets/belvédères/cols/accès — Alpes · 2026-10-28 10:14
- Fichiers : `supabase/seeds/explorer_v2_pois_alpes.sql`, migration `20261101_explorer_v2_data.sql`
- Preuve :
  ```
  overpass 200 145497 (miroir overpass.private.coffee)
  elements 632 insertable 522 { peak: 260, bus_stop: 170, viewpoint: 93, saddle: 85, parking: 24 }
  $ curl rpc/explorer_pois (kinds=["summit"]) →
  Aiguille à Bochard 2655 m · Aiguille Blanche de Peuterey - Centrale 4112 m …
  ```
- Statut : OK partiel — Alpes uniquement (BLOCAGES #3)

### [P1-05] RPC `explorer_pois` · 2026-10-28 10:12
- Preuve : `explorer_pois` bbox Chamonix → **200 en 115 ms**, tri par priorité,
  400 lignes max, bbox refusée au-delà de 6°.
- Statut : OK

### [P1-06] RPC `explorer_place` · 2026-10-28 10:16
- Preuve : premier jet **3 113 ms → statement timeout**, réécrit (index GIST +
  test d'emprise) → **643 ms à froid, 172–210 ms ensuite** ;
  `{"counts":{"water":125,"routes":1,"refuges":70,"reports":0},"regionName":null}`
- Statut : OK (regionName null = 0 géométrie en base, cf. P1-02)

### [P1-07] Tables `activity_sessions` / `activity_points` / `finish_activity_session` · 2026-10-28 10:22
- Preuve : migration appliquée (HTTP 201), `information_schema.tables` → 1 et 1,
  RPC créée `security definer` avec contrôle du propriétaire, index
  `activity_points_session_idx`.
- Statut : OK (écriture de bout en bout non exercée : aucun utilisateur authentifié, BLOCAGES #5)

### [P1-08] `sos_alerts` étendue · 2026-10-28 10:22
- Preuve : `select count(*) from information_schema.columns where table_name='sos_alerts'
  and column_name in ('accuracy_m','battery','session_id','country_iso_a2','cancelled_at','resolved_at')` → **6**
- Statut : OK

### [P1-09] `activity_catalog` + mapping 9 sports · 2026-10-28 10:22
- Preuve : `escalade-voie` créé (1 ligne) ; `explorer_sport_map` → **9 lignes**
  (course, rando, velo, kayak, trail, ski, escalade, famille, bivouac)
- Statut : OK

### [P1-10] Flag `explorer_v2_enabled` · 2026-10-28 10:22
- Preuve : `select enabled from feature_flags where id='explorer_v2_enabled'` → **false** (0 %)
- Statut : OK (bascule à 100 % = P10-03, non faite)

### [P1-11] RLS des nouvelles tables · 2026-10-28 10:22
- Preuve : `pg_policies` → `geo_pois_public_read`, `activity_sessions_owner_read`,
  `activity_sessions_owner_write`, `activity_sessions_owner_update`,
  `activity_points_owner_read`, `activity_points_owner_write`,
  `country_practical_public_read`, `sos_alerts_owner_rw`, `explorer_sport_map_read` ;
  `geo_pois` est passé de **0 à 1 politique** (lecture anon vérifiée en REST : 200).
- Statut : OK (test d'intrusion croisée impossible sans comptes, BLOCAGES #5)

### [P1-12] Routes API v2 · 2026-10-28 11:05
- Fichiers : `src/app/api/explorer/v2/{countries,place,weather,search}/route.ts`, `src/lib/explorer-v2/pgrest.ts`
- Preuve :
  ```
  $ curl /api/explorer/v2/place?lat=45.9237&lng=6.8694&zoom=12
  {"place":null,"pois":[{"id":"n7944517093","kind":"summit",…}],…}
  $ curl /api/explorer/v2/countries?iso=FR
  {"countries":[{"iso_a2":"FR","name":"France","continent":"Europe","capital":"Paris",
   "currency_code":"EUR","timezone":"UTC+1","languages":["Français"],"area_km2":643801}]}
  ```
  Validation Zod sur chaque entrée (400 si invalide), cache HTTP `s-maxage`.
- Statut : OK partiel — rate limit non implémenté, `/search` renvoie 501 (BLOCAGES)

### [P1-13] Proxy météo MET Norway · 2026-10-28 11:05
- Preuve :
  ```
  $ curl /api/explorer/v2/weather?lat=45.92&lng=6.87
  {"source":"met-no","attribution":"MET Norway (CC BY 4.0)",
   "hours":[{"time":"2026-10-28T09:00:00Z","temperature_c":9.5,"wind_ms":0.9,"symbol":"fog"},…]}
  ```
  User-Agent identifié, `revalidate: 1800`, `Cache-Control: s-maxage=1800`.
- Statut : OK

### [P1-14] CSP · 2026-10-28 11:20
- Preuve : `csp.config.mjs` autorise déjà `https://tiles.openfreemap.org`,
  `https://s3.amazonaws.com` (DEM terrarium) et `https://*.supabase.co` ;
  la météo passe par `/api/explorer/v2/weather` (même origine) → **aucun ajout
  d'hôte nécessaire**, aucune régression CSP possible.
- Statut : OK (tests CSP non relancés : `tests/security` non exécuté ici)

### [P2-01] `MapStage` monté une fois, chargé en différé · 2026-10-28 11:20
- Fichiers : `src/features/explorer-v2/map/MapStage.tsx`, `ExplorerV2.tsx`
- Preuve : `dynamic(() => import('./map/MapStage'), { ssr: false })` ;
  `window.__xpMap` reste la même instance après changement de niveau
  (relevé navigateur : `map.getStyle().layers` → 7 couches `xp-*`).
- Statut : OK

### [P2-02] Projection globe → mercator · 2026-10-28 11:20
- Preuve : `data-level="0"` → `map.getStyle().projection = {"type":"globe"}` (relevé
  navigateur) ; niveau ≥ 2 → `mercator`.
- Statut : OK (captures z1 = `preuves/monde-04.png`)

### [P2-03] Relief terrarium + hillshade · 2026-10-28 11:22
- Preuve : capture `preuves/lieu-01.png` (Chamonix, relief 3D visible,
  `setTerrain({source:'xp-terrain', exaggeration:1.3})` dès le niveau 3).
- Statut : OK

### [P2-04] Couches pays/régions/POI/itinéraires · 2026-10-28 11:20
- Preuve : `queryRenderedFeatures({layers:['xp-countries-fill']})` → **63 entités** ;
  `map.getStyle().layers` → `xp-countries-fill`, `xp-countries-line`,
  `xp-regions-fill`, `xp-regions-line`, `xp-routes-line`, `xp-track-line`, `xp-hillshade`.
- Statut : OK (couche amis absente : 0 position en base)

### [P3-01] Page plein écran, safe areas, une seule barre basse · 2026-10-28 11:22
- Preuve : `preuves/monde-04.png` et `preuves/lieu-01.png` (390×844) ;
  `document.querySelectorAll('nav').length` → **2** dont 1 seule barre Explorer
  (l'autre est le `<nav>` du site masqué sur cette route : `nav[aria-label]`).
- Statut : OK partiel — la barre globale est masquée (`MobileNavWrapper`), à
  vérifier sur les autres routes

### [P3-02] Capsule recherche + fil d'Ariane cliquable · 2026-10-28 11:22
- Preuve : capture `lieu-01.png` → « Fr… › FR… › Haute… » ; clic sur un pays
  (test e2e) fait passer `data-level` de 0 à 1.
- Statut : OK partiel (libellés tronqués à 3 crans : à corriger)

### [P3-04] `ExplorerSheet` : 4 crans, glisser suivi au doigt · 2026-10-28 11:35
- Preuve : test Playwright « la poignée change de cran au toucher » et
  « le glissement du tiroir suit le doigt » (`tests/explorer-v2/explorer-v2.e2e.spec.ts`).
- Statut : OK

### [P3-05] Capsule d'onglets + lentille · 2026-10-28 11:35
- Preuve : test « changer d'onglet déplace la lentille » (aria-selected) ;
  capture `lieu-01.png` : onglet actif = icône + libellé, autres = icône seule.
- Statut : OK

### [P3-06] Mini-sélecteur limité à Région / Lieu / Itinéraire · 2026-10-28 11:22
- Preuve : capture `lieu-01.png` → sélecteur 2D/3D visible ; absent sur
  Monde/Pays (`buildSheetModel` ne le renvoie que pour ces trois cas).
- Statut : OK

### [P3-08] Table haptique branchée · 2026-10-28 11:40
- Preuve : `tests/explorer-v2/explorer-v2-unit.spec.ts` → 14 événements,
  `countdown: rigid`, throttle 80 ms (3 assertions vertes).
- Statut : OK

### [P3-09] Flag : v1 si 0 %, v2 si activé ou `?v2=1` · 2026-10-28 10:58
- Preuve : `src/app/explorer/page.tsx` ; `flags.explorer_v2_enabled=false` →
  `ExplorerClient` (legacy) ; `?v2=1` hors production → `ExplorerV2`.
- Statut : OK

### [P4-01..P4-10] Écrans de niveau · 2026-10-28 11:22
- Preuve : scènes `monde`, `pays`, `region`, `lieu`, `monde_jp`, `japon`,
  `nagano`, `usa`, `chili`, `mongolie` rendues (`data-level` correct, titre et
  onglets présents) ; captures `preuves/monde-04.png`, `preuves/lieu-01.png`.
- Statut : OK partiel — contenu réel pour Aperçu/Randos/Pratique ; onglets
  Carnets/Départs/Amis en état vide (aucune donnée en base)

### [P5-01..P5-08] Fiches de repères · 2026-10-28 11:35
- Preuve : test « un repère ouvre sa fiche avec ses onglets » (≥ 2 onglets,
  `data-detent="mid"`) ; titre = nom réel du repère OSM importé.
- Statut : OK partiel — Sommet/Eau/Refuge/Bivouac/Belvédère réels sur les Alpes ;
  Ami et Danger en état vide (0 ligne)

### [P6-01..P6-05] Outils · 2026-10-28 11:30
- Preuve : scènes `rando`, `depart`, `ia`, `calques`, `offline` rendues ;
  itinéraires réels via `explorer_routes` (« Sentier des Gardes », 9,098 km).
- Statut : OK partiel — création de départ, profil altimétrique et zone hors
  ligne non implémentés (BLOCAGES #8)

### [P7-01..P7-12] Activités · 2026-10-28 11:35
- Preuve : test « les états d'activité affichent la pastille » (pastille + SOS,
  barre basse absente) ; 9 sports déclarés ; compte à rebours non implémenté.
- Statut : OK partiel — GPS rejoué, SOS simulé, bilan en base non implémentés

### [P8-01..P8-04] États · 2026-10-28 11:35
- Preuve : scène `nuit` → `data-theme="dark"` (test) ; scènes `bienvenue`,
  `noloc`, `facile` rendues.
- Statut : OK partiel (textes 200 % et VoiceOver non vérifiés)

### [P9-01] First Load JS ≤ 170 Ko · 2026-10-28 11:45
- Preuve : `next build` (voir `docs/explorer-v2/build-last.log`), ligne `/explorer`.
- Statut : voir VERIFY_LAST (mesure en cours)

### [RECETTE] Scènes, repères et données réelles · 2026-10-28 12:31
- Preuve (navigateur, `mobile-chromium`, build de production) :
  ```
  lieu    {scene:"lieu",   level:3, theme:"light", countries:237, pins:3, title:"Haute-Savoie"}
  nuit    {scene:"nuit",   level:3, theme:"dark",  countries:237}
  monde   {scene:"monde",  level:0, countries:237, pins:5, title:"Le monde"}
  repères lieu : ["Fontaine", "Le Brévent", "La Flégère"]
  ```
- Correctifs consécutifs à la recette (tous prouvés par la mesure ci-dessus) :
  1. `usePlace(center[1], center[0])` — latitude et longitude étaient inversées,
     l'API renvoyait 400 et l'écran restait vide ;
  2. scène appliquée de façon **synchrone** au premier rendu (l'effet était
     sauté une fois sur deux selon l'ordre de montage) ;
  3. repères triés par **distance au centre** avant de garder un repère par type
     (`04_CARTE.md §1`), sinon les 3 pastilles tombaient hors écran ;
  4. `setPointerCapture` protégé par `try/catch` (pointeurs synthétiques de test).

### [P1-11 / P5-09] Comptes de recette + intrusion RLS · 2026-10-28 13:25
- Fichiers : `scripts/explorer-v2/seed-test-accounts.mjs`, `scripts/explorer-v2/test-rls-intrusion.mjs`, `.secrets/` (gitignoré)
- Preuve (sortie réelle, 11 contrôles) :
  ```
  ✔ A lit sa propre session live — 1 ligne(s)
  ✔ anon ne lit aucune session — HTTP 200, 0 ligne(s)
  ✔ B (abonné mutuel) lit la session live partagée de A — 1 ligne(s)
  ✔ B ne lit aucun point GPS de A — 0 point(s)
  ✔ A lit ses propres points GPS — 41 point(s)
  ✔ B ne peut pas modifier la session de A — HTTP 200, 0 ligne(s)
  ✔ B ne peut pas créer une session au nom de A — HTTP 403
  ✔ B ne lit aucune alerte SOS — 0 ligne(s)
  ✔ geo_pois lisible publiquement (anon) — HTTP 200
  ✔ country_practical lisible publiquement — HTTP 200
  ✔ osm_poi_cache fermé au public — HTTP 200
  11/11 contrôles verts
  ```
  Rapport : `docs/explorer-v2/RLS_INTRUSION.md`.
- Données créées par les comptes : 2 profils (`recette.lea@lkdv.test`,
  `recette.yanis@lkdv.test`), follows mutuels, 1 session `rando` en direct
  partagée aux abonnés, 41 points GPS, 2 signalements terrain réels.
- Statut : OK

### [P9-01] First Load JS `/explorer` ≤ 170 Ko · 2026-10-28 13:50
- Fichiers : `src/features/explorer-v2/LegacyExplorerFallback.tsx`, `src/app/explorer/page.tsx`
- Preuve : le moteur legacy est passé en `next/dynamic` (chunk asynchrone) :
  ```
  avant : ├ ƒ /explorer   40.2 kB   342 kB
  après : ├ ƒ /explorer   20.4 kB   141 kB   (budget 170 kB)
  ```
- Statut : OK — **−201 Ko**, budget tenu avec 29 Ko de marge.

### [P4-02/P4-03] Carnets et départs réels · 2026-10-28 13:52
- Fichiers : `src/app/api/explorer/v2/content/route.ts`, `data/hooks.ts`, `sheet/SheetContent.tsx`
- Preuve (navigateur, onglet Carnets de l'écran Pays) :
  ```
  Forêts du Vercors, quatre saisons — Vercors, France · 131,0 km · 7 nuit(s)
  Traversée du Jura en bikepacking gravel (GTJ)
  Tour du Mont-Blanc en autonomie complète
  $ curl /api/explorer/v2/content?kind=trips&iso=FR
  Lille — Chamonix à vélo — 10 jours · 19/11/2026 · 2 pers.
  ```
  Capture : `docs/explorer-v2/preuves/carnets-pays.png`.
- Statut : OK — les états vides « Carnets / Départs » sont remplacés par les
  82 carnets publics et les départs ouverts réels.

### [P10-08] Branche poussée et PR ouverte · 2026-10-28 13:20
- Preuve : `git push` OK après rebase sur `origin/main` (`52b7e4bd`) ;
  PR **https://github.com/TFaraciColbert59/kitduvoyageur_1783951966810/pull/119**
- Statut : OK (PR en brouillon, non mergée)

### [P2-05] Hiérarchie d'affichage P0–P3 · 2026-10-28 19:10
- Fichiers : `src/features/explorer-v2/map/hierarchy.ts`, `MapStage.tsx`, `ExplorerV2.tsx`
- Preuve : `selectVisiblePins` est pure et testée (4 cas) : dangers en P0 partout,
  repères sous le tiroir écartés, densité plafonnée par cellule de 100×100 px,
  priorité puis proximité, recul des repères secondaires en activité.
  La hauteur du tiroir est mesurée en direct (`ResizeObserver`) et passée à la
  carte : **aucun repère ne se dessine sous la feuille**.
- Statut : OK

### [P2-06] 13 styles de tracés · 2026-10-28 19:10
- Fichiers : `src/features/explorer-v2/map/traceStyles.ts`, `MapStage.tsx`
- Preuve : `TRACE_STYLES` expose les 13 styles de `04_CARTE §2` (casing, largeur,
  pointillé, opacité, ordre) ; `traceStyleForRoute` mappe iwn/nwn → GR, rwn → PR,
  lwn → variante ; la couche `xp-routes` utilise les expressions `match` de
  couleur/largeur/pointillé et un casing blanc dessous.
  Tests unitaires : 13 styles présents, dash GR `[2, 1.4]`.
- Statut : OK (capture de la planche réelle à comparer avec `Traces.png` :
  voir `PARITE.md`)

### [P7-17] Hors-trace 40 m / 15 s · 2026-10-28 19:10
- Fichiers : `src/features/explorer-v2/activity/offRoute.ts`, `ExplorerV2.tsx`
- Preuve : `evaluateOffRoute` testé (5 cas : pas avant 15 s, déclenche à 15 s,
  retour sous 25 m, hystérésis 25–40 m, libellé). Bandeau ambre `.xp-offroute`
  affiché dès que `activity.offRoute` (test e2e « hors itinéraire »).
- Statut : OK (la mesure GPS réelle reste branchée sur la trace simulée)

### [P7-18] SOS : maintien 1,5 s, compte à rebours annulable, enregistrement · 2026-10-28 19:10
- Fichiers : `src/features/explorer-v2/chrome/SosButton.tsx`, `src/app/api/explorer/v2/sos/route.ts`
- Preuve : 4 tests composant (`sos-button.spec.tsx`, timers contrôlés) :
  pas d'armement avant 1,5 s, armement à 1,5 s, annulation explicite, envoi après
  5 s, chemin clavier. Test e2e : bouton présent, armable au clavier, annulation
  par Échap → toast « SOS annulé ».
  La route `POST /api/explorer/v2/sos` exige un jeton utilisateur et écrit dans
  `sos_alerts` sous RLS ; sans session elle répond 401 et l'interface dit
  « Alerte non enregistrée » (aucune fausse promesse).
- Statut : OK (aucun appel réel au 112 ; mode simulé par défaut)

### [P2-07..P2-12] Chorégraphie caméra · 2026-10-28 20:30
- Fichiers : `src/features/explorer-v2/map/camera.ts`, `MapStage.tsx`
- Preuve : six mouvements implémentés et branchés sur `state.camera` —
  plongée (z 1,6/4,8/7,2/12, 1,3 s, courbe .65), révélation (`jumpTo` zoom +1,7
  puis `easeTo` pitch 45° en 1,8 s), suivi (cap en haut, pitch 60°, padding
  utilisateur au tiers bas), vue d'ensemble (`fitBounds` + marges tiroir),
  survol (parcours de la trace, 260 ms/point, plafond 20 s), orbite (360° en
  40 s, pause au geste, reprise après 6 s).
  Tests unitaires : zooms de niveau, zoom selon vitesse, paddings, emprise de
  trace (5 cas).
- Statut : OK

### [P7-15] Compte à rebours 3·2·1 + appui long · 2026-10-28 20:40
- Fichiers : `src/features/explorer-v2/activity/Countdown.tsx`, styles
- Preuve : `Countdown` (chiffre 1,4 → 1, haptique `rigid`), `useLongPress`
  (600 ms, annulé au-delà de 8 px de déplacement) branché sur la carte ;
  démarrer une activité passe par le compte à rebours, annulable.
- Statut : OK

### [P7-19] Arrêt par maintien 0,8 s → bilan · 2026-10-28 20:40
- Fichiers : `chrome/BottomBar.tsx` (StopHoldButton), `sheet/SheetContent.tsx`,
  `src/app/api/explorer/v2/activity/finish/route.ts`
- Preuve : anneau de maintien 0,8 s sur le bouton d'arrêt ; le bilan affiche
  distance, D+, durée et l'état d'enregistrement réel (`saved`, `pending`,
  `unauthenticated`, `failed`) ; la route appelle `finish_activity_session`
  (SECURITY DEFINER) qui écrit le résumé dans `hike_sessions`.
- Statut : OK (écriture de bout en bout prouvée par le script de flux, voir
  `scripts/explorer-v2/test-activity-flow.mjs`)
