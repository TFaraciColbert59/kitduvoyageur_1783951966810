# PHASE 6 — Vérification (Cockpit terrain et hors-ligne)

**Date :** 2026-09-12
**Branche :** `feat/phase6-cockpit-offline` — commit testé `2e1b7379` (base `fa2042a5` = main)
**Environnement :** Windows / Node v24.18.0 / vitest 4.1.11 ; Supabase local Docker (`127.0.0.1:54322`) ; Upstash : **non provisionné** (`UPSTASH_REDIS_REST_*` absents)
**Responsable :** agent autonome Phase 6 (audit, implémentation, tests, preuves) ; validation humaine requise pour les items externes listés §6
**Décision :** **PASS (périmètre local)** — **INSUFFICIENT_DATA** pour Upstash réel, tuiles commerciales et tests terrain physiques (jamais `PASS`)

---

## 1. Audit — couvert par A13 vs manques Phase 6

### 1.1 Déjà couvert par A13 (vérifié dans le code, non refait)

- **Cockpit lié au plan sélectionné** : `createTripFromAutogenIntent` (Phase 3) + `select_adventure_plan_route` + gate `phase3_route_navigable` ; cockpit monté dans `HikingCockpitPage` avec `adventureIdParam` et les positions réelles.
- **GPS fixes réels** : `GPSService.watchPosition` (haute précision) → `TrackingEngine` (rejet outliers vitesse/saut/altitude, auto-pause 120 s) → `HikingController` (projection `closestOnRoute` sur le GeoJSON réel, progression projetée, bearing de route, POI).
- **Sortie de route** : polling 15 s de la RPC PostGIS `get_route_deviation` (géométrie réelle), debounce 2 lectures, seuils 50 m / retour 30 m ; `GPS_WEAK`, batterie faible, alertes.
- **Terrain Live** : carte, signalements (file hors-ligne + modération DB 10/h), météo, flag `terrain_live`.
- **Pack hors-ligne A13** : assemblage serveur borné (`buildOfflinePack`), caches Dexie partitionnés par utilisateur, worker de sync (priorité, backoff, dead-letter, reprise crash `sync_in_progress`, verrou `navigator.locks`), idempotence SHA-256 + registre `offline_sync_operations`. **Note d'audit :** la mission mentionne une « RPC `a13_offline_sync` » ; elle n'existe pas sous ce nom — la synchronisation passe par `POST /api/adventure/offline/sync` et la table registre `offline_sync_operations` (migration `20260911460000`).
- **Prédictions ETA** : `route_predictions` / `segment_predictions` persistées, P50/P90, difficulté personnelle, prochain segment critique, allure mesurée sur fixes (`paceFromPositions`).

### 1.2 Manques Phase 6 constatés → traitements livrés

| Manque constaté | Traitement |
|---|---|
| Rate limiting uniquement mémoire (token bucket `/api/terrain/conditions`) ; quotas DB pour generate/reports | Abstraction `src/lib/rate-limit` Upstash REST + repli mémoire + fail-safe explicite ; branchée sur 6 routes (conditions, generate, ai/jobs, ai/chat-completion, terrain/reports, offline/sync) |
| `OFFLINE_PACK_VERSION` déclaré mais aucune validation ; seul `typeof version === 'number'` était vérifié ; packs v2 chargés | `validateOfflineAdventurePack` (structure + versions supportées) ; refus explicite à l'écriture, la relecture et au téléchargement |
| Conflits de sync en last-write-wins global (`createdAt`) → positions/POI perdus, statut terminal ressuscitable | `domain/syncMerge.ts` : union positions/POI, métriques monotones, identités conservées, statuts terminaux protégés — appliqué dans `offlineSync.ts` |
| Aucun chiffrement local | Coffre WebCrypto AES-GCM 256 à clé **non extractible** (IndexedDB) ; brouillon de session active chiffré dans `HikingController` |
| Aucun reroutage (« no real rerouting in this project ») | Action serveur `rerouteAdventurePlanRoute` : candidats `phase3_search_navigable_routes`, revérification individuelle `phase3_route_navigable`, sélection atomique `select_adventure_plan_route` |
| `aheadBehindMinutes` toujours `null` ; aucune consommation recalculée | Calcul client sur fixes réels : avance/retard projeté vs ETA planifiée + charge A3 (durée active + D+ réels), affichés dans le cockpit |
| Détection départ/arrivée implicite (départ manuel, arrivée = POI ou arrêt manuel) | **Non implémenté** — gap résiduel documenté §6 (progression, pause auto, sortie de route sont couvertes) |

## 2. Preuves brutes (commandes exécutées)

| Preuve | Commande | Résultat |
|---|---|---|
| Type-check | `npm run type-check` | **0 erreur** |
| Lint | `npm run lint` | **0 erreur** (warnings préexistants uniquement) |
| Vitest complet | `npm run test` | **303 fichiers : 299 passés / 4 skipped ; 2125 tests passés / 27 skipped ; 0 échec** |
| pgTAP complet local | `npx supabase test db --db-url postgresql://postgres:postgres@127.0.0.1:54322/postgres` | **Files=18, Tests=340, Result: PASS** (aucune migration ajoutée ; vérifie les prérequis DB du reroutage/sync) |
| Nouveaux specs Phase 6 | `npx vitest run tests/lib tests/adventure-intelligence/*phase6*` (fichiers listés §3) | **41 tests, 0 échec** |

Aucune capture d'écran : les preuves sont les sorties console ci-dessus et le diff git.

## 3. Fichiers créés / modifiés (commit `2e1b7379`)

**Créés**
- `src/lib/rate-limit/index.ts`, `memoryStore.ts`, `upstashStore.ts`
- `src/lib/security/localVault.ts`
- `src/features/adventure-intelligence/domain/reroute.ts`, `domain/syncMerge.ts`
- `src/features/adventure-intelligence/actions/rerouteAdventurePlanRoute.ts`
- `tests/lib/rate-limit.spec.ts` (8 tests), `tests/lib/local-vault.spec.ts` (6)
- `tests/adventure-intelligence/offline-pack-version.spec.ts` (6), `sync-merge.spec.ts` (6), `reroute-action.spec.ts` (7), `cockpit-live-eta.spec.ts` (4), `offline-resilience.spec.ts` (4)

**Modifiés**
- Routes : `api/terrain/conditions`, `api/adventure/generate`, `api/adventure/offline/sync`, `api/ai/jobs`, `api/ai/chat-completion`, `api/terrain/reports`
- Domaine : `domain/offlinePack.ts`, `domain/cockpitLive.ts`, `domain/cockpit.ts`
- Offline/serveur : `offline/pack.ts`, `server/offlineSync.ts`
- UI : `ui/AdventureCockpit.tsx`, `ui/AdventureCockpitControl.tsx`, `ui/useAdventureCockpit.ts`, `features/hiking/components/HikingCockpitPage.tsx`
- Persistance terrain : `features/hiking/controllers/HikingController.ts`

## 4. Rate limiting — politique de fail-safe (item clé §9.11)

- **Non configuré** (`UPSTASH_REDIS_REST_URL`/`TOKEN` absents) : repli mémoire (fenêtre fixe locale) — comportement best-effort conservé.
- **Configuré** : Upstash REST `/pipeline` (`INCR`, `PEXPIRE … NX`, `PTTL`), timeout 750 ms.
- **Configuré mais injoignable** :
  - `failMode: 'closed'` → `unavailable` traduit en **503 explicite**, jamais de bypass : `adventure/generate`, `ai/jobs`, `ai/chat-completion` (ressources payantes) ;
  - `failMode: 'open'` → repli mémoire **dégradé** signalé (`degraded`, `X-RateLimit-Degraded`) : `terrain/conditions` (lecture publique), `terrain/reports` (la modération DB reste l'autorité), `offline/sync` (la synchronisation de données terrain prime).
- Clés : `scope:userId` (routes authentifiées) ou `scope:IP` (`x-forwarded-for`/`x-real-ip`, conditions et chat hors production).

## 5. Gate Phase 6 (doc §Phase 6) — état honnête

- [x] Relier le plan sélectionné au cockpit — déjà A13/Phase 3 (vérifié).
- [x] Utiliser les GPS fixes réels — déjà A13 (vérifié) ; ETA/consommation désormais recalculées dessus.
- [~] Détecter départ, progression, pause, sortie de route et arrivée — progression/pause auto/sortie couvertes ; **départ et arrivée de session non automatisés** (gap résiduel).
- [x] Rerouter uniquement sur une géométrie réelle — action Phase 6, prédicat `phase3_route_navigable` revérifié, aucune estimation.
- [x] Recalculer ETA et consommation — avance/retard + charge A3 sur fixes réels ; `null` sans données suffisantes.
- [x] Intégrer Terrain Live — déjà A13 (vérifié).
- [x] Remplacer le rate limiter mémoire par un stockage distribué — abstraction + 6 routes ; Upstash réel **non testé** (compte absent, fetch mocké).
- [x] Construire un pack hors-ligne versionné — validation + refus des versions inconnues.
- [x] Chiffrer les données sensibles locales — brouillon de session active (AES-GCM, clé non extractible) ; reste en clair documenté §6.
- [x] Définir les conflits de synchronisation champ par champ — politique explicite + implémentation + tests.
- [~] Tester extinction réseau, redémarrage, batterie faible et reprise — simulations unitaires (perte réseau, crash/reprise, reconnexion, non-duplication) ; **tests physiques humains** non réalisés.
- [ ] Brancher un fournisseur de tuiles avec contrat commercial — **hors code, humain/externe** (non contourné).

## 6. Limites, blocages et risques résiduels (honnêtes)

1. **Upstash non provisionné** : la logique est testée avec `fetch` mocké (quota, fenêtre, failover open/closed, timeout, réponse invalide) ; l'intégration réseau réelle n'a pas été exercée. Action humaine : créer la base Upstash et poser `UPSTASH_REDIS_REST_URL`/`UPSTASH_REDIS_REST_TOKEN`, puis valider en préproduction.
2. **Données locales encore en clair** (non prétendu chiffré) : caches Dexie A13 (`offline_adventures`, routes, segments, POI, prédictions, file de sync), file `tripOfflineSyncQueue` (localStorage synchrone) et file legacy `OfflineManager`. Le coffre Phase 6 ne couvre que le brouillon de session active ; migrer ces files vers des API asynchrones + coffre est un chantier distinct.
3. **Reroutage non monté dans l'UI** : l'action serveur est testée et n'accepte que des géométries réelles, mais aucun bouton du panneau hors-trace ne l'appelle encore.
4. **Départ/arrivée automatiques** : `startHike` est manuel et l'arrivée n'est inférée que par POI atteint ou arrêt manuel ; aucun événement « départ détecté »/« arrivée détectée » dans la machine à états.
5. **Tests terrain physiques** : mode avion réel, fermeture/réouverture de l'application native, batterie faible, perte/retour radio réels = **humains** ; les specs `offline-resilience.spec.ts` simulent réseau et redémarrage par mocks.
6. **Tuiles commerciales** : contrat fournisseur non traité (externe).
7. **E2E/CI** : aucun run CI ni E2E distant sur cette branche (pas de PR) ; preuves locales uniquement.
8. **`chat-completion` hors production** : l'identité n'est pas vérifiée hors `NODE_ENV=production` ; la limite est alors par IP (comportement préexistant conservé).

## 7. Snapshots visuels

**Aucun snapshot impacté.** `tests/visual` ne couvre que `pays-visual.spec.ts` et `voyages-y-profiles-visual.spec.ts` ; aucun spec visuel ou a11y ne rend `AdventureCockpit`/`HikingCockpitPage`. La ligne « Charge consommée » n'apparaît qu'avec des fixes GPS réels et n'est pas couverte par une baseline. Aucune régénération demandée.

## 8. Décision

- **PASS (périmètre local)** : type-check 0, lint 0, 2125 tests verts, pgTAP 340 tests PASS, 41 nouveaux tests Phase 6.
- **INSUFFICIENT_DATA** (jamais `PASS`) : Upstash réel, fournisseur de tuiles, tests terrain physiques, E2E/CI distant.
