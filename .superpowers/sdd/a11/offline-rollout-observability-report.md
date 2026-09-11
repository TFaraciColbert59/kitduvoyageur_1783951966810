# A11 — Offline, cohortes de rollout et observabilité (P1 bêta publique)

Branche : `audit/adventure-intelligence` · Worktree : `ai-finalization`
Périmètre audit : items **#26, #27, #28** (offline), **#29** (worker de sync),
**#33** (cohortes), **#34** (observabilité), **#36** (clé anon).

## Commits

| # | Sujet | Fichiers principaux |
|---|-------|---------------------|
| 1 | `feat(a11): offline par utilisateur et idempotence SHA-256` | `offline/db.ts`, `offline/operations.ts`, tests `TEST-A11-OFF-01..08` |
| 2 | `feat(a11): worker de synchronisation offline` | `offline/syncWorker.ts`, `offline/db.ts` (adaptateur Dexie), tests `TEST-A11-SYNC-01..06` |
| 3 | `feat(a11): cohortes de rollout et observabilite` | 2 migrations, `domain/flagRollout.ts`, `server/featureFlags.ts`, `server/generateAdventure.ts`, `domain/engineRegistry.ts`, tests `TEST-A11-ROLL-01..06`, `TEST-A11-OBS-01..03` |
| 4 | `fix(a11): cle anon plus jamais en dur (fail fast)` | `lib/supabase/client.ts`, `tests/countries_geo.spec.ts`, tests `TEST-A11-KEY-01..02` |

## Conceptions

### #26/#28 — Partition offline par utilisateur
- `offlineDbNameForUser(userId)` → `lkdv-adventure-offline-v2-<userId>` ; une
  base Dexie par utilisateur, cache interne, champ `userId` indexé sur les
  trois files ; `purgeOfflineData(userId, { deleteDatabase })` ferme et
  supprime la base (dépendance injectable pour les tests).
- `planLegacyGlobalMigration(raw, userId)` : pur (async pour le hash),
  réattribue les lignes de la base globale V1, **préserve la clé
  d'idempotence existante** (ne rejoue jamais un acquittement), recalcule
  sinon en SHA-256, compte les entrées non exploitables.
- `markSynced(db, entries: {store,id}[])` et `markFailed` ne touchent plus que
  les stores nommés (`groupOperationsByStore`, pur et testé).
- `planLegacyMigration(raw, userId?)` produit des opérations par utilisateur.

### #27 — Idempotence SHA-256
- `makeIdempotencyKeySha256` / `hashPayloadSha256` : `crypto.subtle.digest`
  (hex 64), `createOfflineOperation` asynchrone l'utilise par défaut.
- FNV-1a conservé **uniquement** comme repli documenté non sécurisé quand
  `crypto.subtle` est absent (32 bits, collisions possibles) — testé
  explicitement (`TEST-A11-OFF-04`).

### #29 — Worker de synchronisation
- `nextRetryAt(attempts, now)` : `min(5 s × 2^attempts, 6 h) × (0,85 + 0,15 ×
  jitter déterministe)` ; strictement croissant sous le plafond (démontré
  `TEST-A11-SYNC-01`).
- `prioritizeOperations` : priorité décroissante → ancienneté → id (stable).
- Dead-letter à 8 tentatives (`lastError`, `deadLetteredAt`, terminale) ;
  expiration à 30 jours par défaut (`expiresAt` sinon `createdAt + 30 j`).
- Reprise après crash : `sync_metadata['sync_in_progress']` écrit avant envoi,
  relu/effacé au démarrage, opération rejouée (idempotence aval).
- Verrou multi-onglets `navigator.locks` feature-detect, repli no-op sans
  échec. Transport et stockage injectés ; adaptateur `createDexieSyncStorage`.

### #33 — Cohortes de rollout
- Migration `20260911330000_a11_flag_cohorts.sql` : table
  `feature_flag_cohorts` (percentage 0..100, allowlist, exclusions,
  `updated_by`, `updated_at`), RLS + REVOKE anon/authenticated, service_role
  seul. RPC `current_feature_flags_for(uuid)` SECURITY DEFINER
  (`search_path = public, pg_temp`) ; un flag sans ligne de cohorte conserve
  son état global (compatibilité), sinon `enabled ET (allowlist OU (non exclu
  ET bucket < pourcentage))`. `a11_cohort_bucket` = 8 premiers hex du SHA-256
  de l'UUID modulo 100 (helper interne, search_path verrouillé).
- `domain/flagRollout.ts` pur : `cohortBucketFromSha256Hex`,
  `cohortBucket(userId)` (Web Crypto), `evaluateUserFlag` — priorité
  désactivé > allowlist > exclusions > pourcentage.
- `server/featureFlags.ts` : `currentAdventureFeatureFlags(userId?)` appelle
  `current_feature_flags_for` si `userId`, sinon `current_feature_flags` ;
  quatre clés toujours présentes, repli fail-safe tout à `false`.

### #34 — Observabilité
- Migration `20260911340000_a11_engine_runs_observability.sql` : colonnes
  `correlation_id`, `pipeline_version`, `external_calls` (jsonb, `[]`),
  `fallback_count` (+ CHECK ≥ 0, index partiel corrélation) ; RPC
  `create_adventure_plan_bundle` remplacée pour propager ces champs.
- `EngineRunRecord` porte `startedAt`/`finishedAt` réels mesurés par le
  registre (`finishedAt ≥ startedAt + 1 ms` si le moteur a tourné) ; plus de
  timestamps égaux fabriqués avec `now`.
- `generateAdventure` génère **un** `correlationId` (`randomUUID`) par
  génération, propagé au bundle et aux runs orphelins (`insertEngineRun`),
  journalise `pipeline_version = 'a11-v1'` et `fallback_count` (codes de
  repli documentés `FALLBACK_WARNING_CODES`).

### #36 — Clé anon fail-fast
- `lib/supabase/client.ts` : plus AUCUNE URL/clé en dur ; `getSupabaseConfig`
  miroir de `server.ts`, erreur française explicite si
  `NEXT_PUBLIC_SUPABASE_URL`/`NEXT_PUBLIC_SUPABASE_ANON_KEY` manquent.
- `tests/countries_geo.spec.ts` : test d'intégration désormais `skipIf` sans
  variables d'environnement + import dynamique (il dépendait du fallback vers
  la production). `rg eyJ` ⇒ aucune occurrence restante.

## Preuves TDD

- Rédaction des tests d'abord par lot (`offline-a11`, `offline-sync-worker`,
  `flag-rollout`, `engine-runs-observability`, `supabase-client-key`), puis
  implémentation jusqu'au vert ; tests A7 existants adaptés (factories
  devenues asynchrones).
- Exécutions : `npx vitest run tests/adventure-intelligence` → **60 fichiers,
  366 tests verts** après chaque commit (commits 1/2/3).
- Avant commit 4 : `npm run test` complet → **259 fichiers verts + 1 skip**
  (`countries_geo` sans env, 6 tests), **1883 tests verts**, 0 échec.
- `npm run type-check` : 0 erreur après chaque commit.
- `npm run lint` : 0 erreur/warning sur tous les fichiers modifiés (le dépôt
  conserve ses warnings historiques hors périmètre).
- Aucun `npm run build` exécuté (contrainte respectée). Aucun fichier
  `src/app/hub/[section]/page.tsx` ni `src/features/hub/mobile/export*`
  touché.

## Points de vigilance / suites

1. **Migrations non exécutées** : aucune base Supabase locale/CI dans cet
   environnement ; les migrations sont idempotentes et suivent les patterns
   existants, mais restent à valider via `supabase db push` + pgTAP (audit #2).
2. `a11_cohort_bucket` parité SQL/TS : suppose que `('x'||substr(hex,1,8))::bit(32)::bigint`
   est non signé (0..2^32-1). À confirmer par un test pgTAP sur la RPC.
3. `external_calls` reste `[]` (aucune source externe branchée) ; à alimenter
   quand météo/réglementation arriveront.
4. Les routes appellent encore `currentAdventureFeatureFlags()` sans `userId`
   (état global) : brancher `userId` par route est un suivi naturel, aucune
   activation de flag dans ce lot.
5. Aucun flag activé ; pas de donnée santé ; commentaires/messages en français.
