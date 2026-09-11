# A13 (S5 + S6) — Cockpit live branché au tracking réel & Pack offline complet

Branche : `audit/adventure-intelligence` (worktree `ai-finalization`). Plan source :
`docs/superpowers/plans/a13-l3-produit-bout-en-bout.md` (flux S5 et S6). Environnement :
Supabase local (`.env.local` = projet de test), flags de domaine **OFF**, aucun secret
commité, aucune écriture prod, aucune modification de `src/app/hub/[section]/page.tsx`.

## Commits

| Commit | Sujet | Périmètre |
| --- | --- | --- |
| `e946dd26` | `feat(ai): A13 S5 cockpit live reel (assemblage serveur, recalcul evaluateRecalc, montage randonnee active)` | serveur + route + hook + UI + tests |
| `204ab5e0` | `feat(ai): A13 S6 pack offline complet et synchronisation reelle (route pack, ledger idempotent, transport worker)` | serveur + routes + Dexie + migration + tests |
| ce commit | `docs(a13): rapport S5 cockpit live et S6 offline pack` | ce rapport |

## A. S5 — Cockpit live réel

- **`domain/cockpitLive.ts`** (pur, client-safe) : état de recalcul froid, validation
  bornée des positions (`≤ 120`), allure mesurée sur tracé GPS réel (`haversineM`,
  jamais extrapolée en dessous de 50 m).
- **`server/cockpitData.ts`** (client injecté, `server-only`) : assemble l'entrée réelle
  de `buildCockpitView` — plan version courante + confiance (repli froid explicite si
  non conforme), prédictions persistées `route_predictions` (P50/P90 **personnalisées S1**,
  fourchette d'allure, demi-tour, difficulté), prochain segment difficile
  (`critical_segment_ids` + libellé/difficulté `trail_segments`/`segment_predictions`),
  sessions récentes `hike_sessions` (`positions_timed` uniquement), signalements Terrain
  Live gatés par le flag `terrain_live`, décisions du plan. Absence de plan ⇒ **état vide
  sûr** (`plan_not_found`), aucun appel superflu.
- **Recalcul** : `evaluateRecalc` (A7, anti-rebond 60 s) est le **seul** chemin de
  décision ; `buildCockpitLiveData` ne l'exécute qu'à l'appel, la route ne l'appelle
  qu'à la demande et le hook client ne POST que sur déclencheur (première charge,
  déplacement, pause, batterie, retour en ligne) — **jamais à chaque rendu React**.
- **`POST /api/adventure/[id]/cockpit`** : auth de session (401), UUID (404), corps Zod
  borné (400), plan inaccessible via RLS ⇒ 404, flags résolus côté serveur, réponse
  `{ input, recalc, sessionId, trackingSource, planVersion, predictionModelVersion,
  warnings }`.
- **UI** : `useAdventureCockpit` (hook client, `evaluateRecalc` local avant POST) +
  `AdventureCockpitControl` (bouton flottant 44 px + bottom sheet iOS) monté dans
  `HikingCockpitPage` via `?adventureId=` et les positions réelles `hikingStore.positions`
  (`GPSService`/`TrackingEngine`). Tokens `--lkv-*`, safe-area, `prefers-reduced-motion`
  (framer-motion conditionnel), zéro orange, aucun dialogue natif.

### Tests `TEST-A13-COCK-01..06`

`tests/adventure-intelligence/cockpit-data.spec.ts` (6 tests, client factice) :
assemblage réel (plan/prédiction/sessions/Terrain Live) (01) ; anti-rebond 60 s avec
rejeu du `nextState` (02) ; hors-ligne signalé sans bloquer (03) ; ETA fourchette même
si P90 inversée ou absente (04) ; confiance réelle puis repli froid sur confiance non
conforme (05) ; aventure absente = état vide sûr, aucun appel superflu (06).

## B. S6 — Offline réel

- **`offline/pack.ts`** : mapping **pur** pack → six stores (`offline_adventures`,
  `offline_routes`, `offline_segments`, `offline_predictions`, `offline_pois`,
  `offline_terrain_events`), ids préfixés par l'aventure ; `saveOfflinePack`
  transactionnel idempotent (purge des entrées de la même aventure puis `bulkPut`),
  `readOfflinePack`, `clearOfflinePack`, `shouldStoreOfflinePack` (plafond), relecture
  via `offlinePackRequest` et **`runAdventureSync`** (worker + transport réel).
- **`server/offlinePack.ts`** (client injecté) + **`GET /api/adventure/[id]/offline-pack`** :
  pack = plan version courante **projetée sans privé** (`participants` réduits à
  `{ id, role }`, jamais `displayName`/`profileId`, décisions jamais incluses),
  géométries `a13_segment_geometries` (ids issus de `paceStrategies`, bornés 500 par
  appel et au total), prédictions `route_predictions`/`segment_predictions`, POI eau/
  refuges `get_trail_pois_bbox` sur la bbox réelle, Terrain Live `a5_terrain_reports_near`.
  Auth + ownership par RLS (404 sinon), aucune donnée d'un autre membre.
  Bornes : segments ≤ 500, POI ≤ 150, Terrain ≤ 50, prédictions ≤ 12, **taille
  sérialisée ≤ 2 Mo** avec troncature explicite (`offline_pack_truncated`), jamais
  silencieuse ni au-delà du plafond.
- **`server/offlineSync.ts`** + **`POST /api/adventure/offline/sync`** : batch idempotent
  (sessions, signalements, décisions) avec les clés SHA-256 de `offline/operations.ts`.
  Registre serveur **additif** `offline_sync_operations` (migration
  `20260911460000_a13_offline_sync.sql`, PK `(user_id, idempotency_key)`, RLS
  SELECT/INSERT propres, journal immuable) : rejeu ⇒ `duplicate`, jamais réappliqué.
  Conflits **last-write-wins par opération** (`createdAt`) : uniquement insert/update,
  **aucun delete** ; erreur de transport/base ⇒ `failed` (backoff/dead-letter A11),
  opération invalide ⇒ `rejected` acquittée sans boucle. L'ownership du plan est
  vérifiée explicitement avant toute décision (client service_role).
- **Worker branché sur le réel** : `createAdventureSyncTransport` (POST
  `/api/adventure/offline/sync`, un lot par opération, 2xx + statut non-`failed`
  = ack) ; `runAdventureSync(db)` câble `createDexieSyncStorage` + transport réel.

### Tests `TEST-A13-OFF-01..08`

`tests/adventure-intelligence/offline-pack-sync.spec.ts` (8 tests) : pack complet réel
sans donnée privée d'autres membres (01) ; plan absent ⇒ pack nul + warning, zéro appel
superflu (02) ; mapping six stores Dexie par aventure (03) ; idempotence SHA-256, rejeu
sans réapplication (04) ; reprise après erreur avec transport factice HTTP puis rejeu
sans perte (05) ; cycle hors-ligne → reconnexion, ordre de priorité, zéro doublon (06) ;
purge par utilisateur (base Dexie ciblée uniquement) (07) ; taille bornée avec troncature
explicite et cohérence des caches (08).

## C. Preuves d'exécution (état final `204ab5e0`)

| Vérification | Résultat |
| --- | --- |
| `npx vitest run tests/adventure-intelligence/cockpit-data.spec.ts` | 6 passed |
| `npx vitest run tests/adventure-intelligence/offline-pack-sync.spec.ts` | 8 passed |
| `npm run test` | 276 fichiers passés / 1 ignoré ; **1981 tests passés / 6 ignorés** |
| `npx tsc --noEmit` | exit 0 |
| `npm run lint` | exit 0 (warnings préexistants + 2 warnings safe-area du même type que `TerrainLiveCockpitControl`) |
| `npm run verify:invariants` | SUCCÈS (dont 1192 noms d'icônes résolus) |
| `npm run build` | exit 0, 273 pages statiques générées |
| `supabase migration up --local` | migration additive appliquée avec succès |
| pgTAP | aucune suite pgTAP ajoutée ⇒ inchangée (0 `not ok`) |

TDD : les tests `TEST-A13-COCK-*` et `TEST-A13-OFF-*` ont été écrits avant leurs modules
d'implémentation (imports inexistants à l'écriture). Un unique écart de test a été
corrigé côté test après le premier RED (signature du client factice
`listSegmentPredictions(userId, ids)`) — aucune implémentation n'a été ajustée pour faire
passer un test.

## D. Écarts / points d'attention

- **Migration additive** `20260911460000_a13_offline_sync.sql` : nécessaire à
  l'idempotence serveur multi-appareils ; registre immuable côté client (UPDATE/DELETE
  réservés au service_role), appliquée en local, **jamais appliquée en prod** dans ce flux.
- **Route sync** : le client service_role contourne la RLS ; l'appartenance du plan est
  donc vérifiée explicitement dans `applyDecision` (`plan_non_detenu` sinon). Les
  sessions/registre sont tous filtrés par `user_id` issu de la session.
- **Terrain Live dans le pack** : dépend du flag `terrain_live` ; flag OFF ⇒ tableau vide
  + warning `terrain_live_disabled` (aucune condition inventée).
- **Montage UI** : le cockpit n'apparaît que si `?adventureId=<uuid>` est présent sur
  `/randonnee-active` (aucun changement de comportement sans ce paramètre). Les E2E/a11y
  complets restent au flux S9.
- **Caches segments/POI** : le pack ne contient que les POI de la bbox réelle des
  géométries ; sans géométrie, aucune bbox n'est devinée (POI vides + warning).
- **Pas de rendu DOM dans les tests** : la logique UI (hook/contrôle) est vérifiée par
  type-check + build ; les tests couvrent l'assemblage, l'idempotence et le transport.
