# A5 — Terrain Live — Rapport implémenteur (commits 1 à 4)

- Worktree : `C:/Users/Tony/Downloads/LKDV/worktrees/adventure-intelligence`
- Branche : `chantier/adventure-intelligence`
- Date : 2026-09-11
- Spec normative : `docs/superpowers/specs/2026-09-11-a5-terrain-live-design.md`
- Périmètre : commits 1 à 4 uniquement (commit 5 = UI mobile, autre agent)
- Commits (ordre exact de la spec) :
  1. `4fcc3e56` — `feat(a5): cycle de vie, confiance, dedup et moderation Terrain Live`
  2. `ab901501` — `feat(a5): detection automatique shadow (ralentissements, demi-tours, sorties)`
  3. `464e6a5e` — `feat(db): a5 proximite terrain (geog generee + index GiST + RPC sans identite)`
  4. `4df7f9ee` — `feat(a5): serveur signalements, confirmations, expiration + APIs`

---

## Commit 1 — Cycle de vie, confiance, déduplication, modération (et flux 3 gestes)

**Fichiers**
- `src/features/adventure-intelligence/domain/terrainLive.ts`
- `src/features/adventure-intelligence/domain/terrainReportFlow.ts`
- `tests/adventure-intelligence/terrain-live.spec.ts` — `TEST-A5-LIFE-01..08`, `TEST-A5-CONF-01..06`, `TEST-A5-DEDUP-01..04`, `TEST-A5-MOD-01..06` (24 tests)
- `tests/adventure-intelligence/terrain-report-flow.spec.ts` — `TEST-A5-FLOW-01..04` (4 tests)

**Implémentation**
- `MVP_TERRAIN_CATEGORIES` (6 catégories MVP) ; les 13 catégories A1 restent acceptées par la logique (types importés de `schemas/live.schema.ts`, aucune duplication).
- `nextReportStatus` : `pending → confirmed` (1ʳᵉ confirmation) → `active` (≥ `CONFIRMATIONS_TO_ACTIVATE` = 2 présents) ; `age` fait `confirmed/active → stale → verify` (jamais un `pending`) ; `resolve` exige ≥ `CONTRADICTIONS_TO_RESOLVE` = 3 « disparu » **et** `contradicts > confirmationsPresent` **et** un statut non-pending ; `reject` immédiat ; `expire` refusé avant `expiresAt` (autorisé si `expiresAt` absent) ; statuts terminaux immuables.
- `shouldExpire` : non terminal + `expiresAt` dépassé ; `expiresAt` illisible ne périme jamais.
- `computeReportConfidence` : positifs (part de présents, utilisateurs distincts, récence ≤ 72 h, GPS ≤ 15 m, photo, source officielle, corroboration de trace) − négatifs (part de disparus, ancienneté > 72 h, GPS > 100 m) ; borné via `makeConfidence`, méthode `terrain_report_confidence_a5`, `sampleCount` = total des votes, « sais pas » neutre.
- `deduplicateReports` : même catégorie **et** (même segment **ou** ≤ `DEDUP_MAX_DISTANCE_M` = 150 m) **et** fenêtre ≤ `DEDUP_WINDOW_HOURS` = 6 h ; le candidat le plus proche gagne ; raisons stables (`doublon_meme_segment`, `doublon_proximite`, `aucun_doublon_hors_fenetre`, `aucun_doublon_hors_distance`, `aucun_doublon_categorie_differente`). Distance via `haversineM` de `domain/geo.ts` (réutilisation).
- `moderationDecision` : rate limit 10/h (3/h si compte < 1 jour), cooldown 2 confirmations, description ≤ 1000, photo déclarée ⇒ URL http(s) **et** taille ∈ ]0 ; 5 Mo], réputation normalisée [0 ; 100] (faible signalée sans bloquer seule), source officielle prioritaire (neutralise rate limit/cooldown, **pas** la validation de contenu).
- `terrainReportFlow.ts` : machine pure `idle → category → severity → confirm`, `back` écran par écran sans perte de saisie, `cancel` réinitialise, `canSubmit` = catégorie + gravité, actions hors étape ignorées, description bornée à 1000.

**TDD**
- RED : `npx vitest run tests/adventure-intelligence/terrain-live.spec.ts tests/adventure-intelligence/terrain-report-flow.spec.ts` → `Cannot find package '@/features/adventure-intelligence/domain/terrainLive'` et `.../domain/terrainReportFlow'` — 2 fichiers en échec, 0 test.
- GREEN après implémentation : 28/28 (24 + 4) au premier passage.
- Suite complète : 20 fichiers / 164 tests passés ; `npm run type-check` exit 0.

## Commit 2 — Détection automatique shadow

**Fichiers**
- `src/features/adventure-intelligence/domain/terrainAutoDetection.ts`
- `tests/adventure-intelligence/terrain-auto-detection.spec.ts` — `TEST-A5-AUTO-01..04` (4 tests)

**Implémentation**
- Entrée `CollectivePassage[]` (type A4 réutilisé), regroupement par segment, sortie triée (segment, catégorie) et déterministe.
- Signaux : médiane des ratios ≥ 1,6× (≥ 3 passages valides) → `obstacle` (`ralentissement_collectif_x…`) ; ≥ 3 demi-tours → `closure` ; ≥ 3 sorties de trace → `marking` ; ≥ 3 contournements (off-route sans demi-tour, ralentis ≥ 1,3×) → `obstacle` (`contournements_repetes_…`, raison fusionnée si l'obstacle existe déjà).
- Shadow garanti structurellement : `AUTO_DETECTION_SHADOW = true`, chaque candidat porte `sourceType: 'auto'` + `shadow: true`, aucun champ `status`, aucune écriture.

**TDD**
- RED : `Cannot find package '@/features/adventure-intelligence/domain/terrainAutoDetection'` — 1 fichier en échec.
- GREEN : 4/4 après implémentation. Un aller-retour de correction de test : le `find` par segment renvoyait d'abord la catégorie `marking` (tri alphabétique) ; l'assertion cible désormais `(segment, category)`.
- Suite complète : 21 fichiers / 168 tests passés ; `npm run type-check` exit 0.

## Commit 3 — Migration proximité Terrain Live

**Fichier**
- `supabase/migrations/20260911170000_a5_terrain_nearby.sql`

**Contenu**
- `ALTER TABLE ... ADD COLUMN IF NOT EXISTS geog geography(Point,4326) GENERATED ALWAYS AS (ST_SetSRID(ST_MakePoint(lng::float8, lat::float8),4326)::geography) STORED` + commentaire.
- `CREATE INDEX IF NOT EXISTS idx_terrain_reports_geog ... USING gist (geog)`.
- RPC `a5_terrain_reports_near(p_lat, p_lng, p_radius_m DEFAULT 2000)` : `LANGUAGE sql STABLE SECURITY INVOKER`, lit **uniquement** `terrain_reports_public` (colonnes de la vue + `distance_m` calculée, jamais `reporter_id`), rayon borné 1 m – 50 km, `LIMIT 200`, tri par distance.
- Droits explicites : `REVOKE ALL FROM public` + revokes conditionnels `anon`/`authenticated`/`service_role`, puis `GRANT EXECUTE` à `anon, authenticated` et `service_role` (lecture seule via fonction ; aucune écriture octroyée).
- Additif et idempotent : aucune table/policy/vue recréée, `ADD COLUMN IF NOT EXISTS` + `CREATE INDEX IF NOT EXISTS` + `CREATE OR REPLACE FUNCTION` + COMMENT/GRANT rejouables.

**TDD** : pas de test unitaire associé (DDL). Suite complète 21 fichiers / 168 tests passés ; `npm run type-check` exit 0.

## Commit 4 — Serveur signalements, confirmations, expiration + APIs

**Fichiers**
- `src/features/adventure-intelligence/server/terrainReports.ts`
- `src/app/api/terrain/reports/route.ts` (POST)
- `src/app/api/terrain/reports/[id]/confirm/route.ts` (POST)
- `src/app/api/terrain/conditions/route.ts` (GET `lat&lng&radius`)
- `src/app/api/cron/expire-terrain-reports/route.ts` (POST, `CRON_SECRET`)
- `tests/adventure-intelligence/terrain-reports.server.spec.ts` — `TEST-A5-SRV-01..05` (8 tests)

**Implémentation**
- Client injecté `TerrainReportsClient` (aucun Supabase dans les fonctions). `createTerrainReport` : modération (compteurs 1 h + contexte profil) → anti-doublon → fusion motivée ou rejet `{ reasons }` ; utilisateur ⇒ `pending`/`user`, officiel ⇒ `active`/`official`. `confirmTerrainReport` : refus `not_found`/`closed`, unicité par utilisateur (`confirmationExists` + contrainte A1), insertion (compteurs trigger A1), statut recalculé par `nextReportStatus('confirm')`. `listNearbyTerrainReports` : filtre défensif terminaux/expirés, tri distance, plafond 200, rayon borné 1 m – 50 km, aucune identité. `expireStaleReports` : `expire` (expiration dépassée) puis `age` (inactif ≥ 24 h), écritures seulement si le statut change, retour `{ scanned, aged, expired }`.
- Adaptateur `createSupabaseTerrainReportsClient(supabase)` embarqué dans le module serveur : comptages, contexte `user_profiles.trust_score/created_at` (repli réputation 50), candidats dédup non terminaux, RPC `a5_terrain_reports_near`, candidats d'expiration.
- Routes : Zod 4 avec messages français sur toutes les entrées, `force-dynamic`, erreurs `{ error, details? }`, identité **toujours** issue de la session (`user.id`), jamais du corps. `GET /conditions` public (lit la vue sans identité). Cron : Bearer `CRON_SECRET`, réponse = compteurs.

**TDD**
- RED : reproduction contrôlée (module temporairement absent) → `Cannot find package '@/features/adventure-intelligence/server/terrainReports'` — 1 fichier en échec, 0 test.
- GREEN : 8/8 après implémentation.
- Suite complète : 22 fichiers / 176 tests passés ; `npm run type-check` exit 0.

---

## Preuves de vérification (avant chaque commit)

- `npx vitest run tests/adventure-intelligence` : commit 1 = 20 fichiers / 164 tests ; commit 2 = 21 / 168 ; commit 3 = 21 / 168 ; commit 4 = 22 / 176 (tous passés).
- `npm run type-check` (`tsc --noEmit`) : exit 0 avant chacun des 4 commits.
- `npm run build` : **jamais exécuté** (contrainte respectée).
- Aucune écriture `source_type='auto'` : le moteur ne produit que des candidats shadow, aucune route/job ne les persiste.

## Décisions notables

1. **Flux 3 gestes dans le commit 1** : `terrainReportFlow.ts` est un moteur pur et le commit 5 est réservé à l'UI ; `TEST-A5-FLOW-01..04` sont donc livrés avec le commit 1, bien que le sujet du commit ne cite pas le flux.
2. **Activation à 2 présents** : `pending → confirmed` à la 1ʳᵉ confirmation, `confirmed → active` à partir de 2 confirmations « présents » (les deux statuts restent exposés par la vue A1).
3. **Réputation** : normalisée [0 ; 100] avant lecture, une réputation faible est une note informative (`reputation_faible`) qui ne bloque jamais seule — preuve par équivalence `-50 ≡ 0` et `10 000 ≡ 100`.
4. **Adaptateur Supabase embarqué** dans `server/terrainReports.ts` plutôt qu'un 5ᵉ fichier partagé : évite de dupliquer l'adaptateur dans 4 routes, les fonctions d'orchestration restent à client injecté.
5. **Fusion minimale** : touche l'existant (`updated_at`, + `severity`/`passability` si fournis) ; le schéma A1 n'a pas de colonnes de fusion et `terrain_events` n'est pas écrit (aucune nouvelle surface).
6. **RPC sur la vue** : la vue A1 n'expose pas `geog`, la distance est donc recalculée depuis `lat`/`lng` de la vue ; l'index GiST reste sur la table de base pour les requêtes de proximité et une future variante.
7. **Cooldown** : `confirmationsLastHour` (signature normative) est compté sur 1 h, donc plus strict que « 2 / 5 min ».
8. **`GET /conditions` sans session** : lecture publique via `service_role` + RPC (la RPC est exécutable par `anon`), pas d'exigence d'authentification pour la carte.

## Concerns

1. **Migration non exécutée** contre une instance PostGIS/Supabase dans cet environnement (pas de `supabase db` local lancé) : à valider en staging — immuabilité de l'expression générée, index GiST et syntaxe de la RPC. En particulier la RPC ne peut pas utiliser l'index GiST (elle lit la vue sans `geog`) ; volumétrie OK tant que la vue reste limitée (< 200 résultats), sinon prévoir une variante base-table filtrée statuts.
2. **Flag `terrain_auto_detection_shadow`** non inséré dans `feature_flags` : aucune route/job ne consomme encore les candidats auto (shadow pur). À ajouter quand le job shadow sera planifié.
3. **GEO-01..02** (`toTerrainGeoJson` sans `reporter_id`) appartiennent au commit 5 UI (`TerrainLiveLayer.tsx`) — non implémentés ici, conformément au périmètre.
4. **Dedup** : `findDedupCandidates` limite à 200 candidats par catégorie/fenêtre (adaptateur) — suffisant à cette échelle, à surveiller.
5. **`getUserModerationContext`** s'appuie sur `user_profiles.trust_score`/`created_at` (accord implicite non documenté ailleurs) avec repli réputation 50 ; `accountAgeDays` utilise `Date.now()` (non injectable dans l'adaptateur).
6. **Aucun test d'intégration HTTP** des routes (pas de serveur Next en test) : Zod/statuts validés par relecture + type-check ; à couvrir par tests e2e en Phase 9.
7. Fichier de spec A5 laissé non committé (untracked), comme A4.

---

# Correctifs post-revue (2026-09-11)

- Commit : `76030f4f` — `fix(a5): moderation cooldown, corroboration de fusion et expiration par defaut`
- Périmètre : retours « Important 1 », « Important 2 » et mineurs 3, 4, 5 uniquement ; shadow auto-detection, projection de confidentialité et code non lié inchangés.

## Important 1 — Cooldown des confirmations

**Fichiers** : `server/terrainReports.ts`, `src/app/api/terrain/reports/[id]/confirm/route.ts`, `tests/adventure-intelligence/terrain-reports.server.spec.ts`.

- `confirmTerrainReport` : après les contrôles `not_found`/`closed`/`duplicate`, appelle `countConfirmationsSince(userId, isoBefore(now, 5/60))` ; si `>= MAX_CONFIRMATIONS_COOLDOWN` (2, réutilisé du domaine) ⇒ `{ status: 'rate_limited', reason: 'confirmation_cooldown' }`, aucune confirmation insérée, aucun statut modifié.
- Nouvel export `CONFIRMATION_COOLDOWN_MINUTES = 5`.
- Route : `429 { error: 'Trop de confirmations récentes', details: 'confirmation_cooldown' }`.
- TDD : RED `expected { status: 'confirmed' } to deeply equal { status: 'rate_limited' }` ; GREEN avec `TEST-A5-SRV-06` (3ᵉ confirmation refusée sans écriture, fenêtre de 5 min vérifiée sur l'appel client, seuil 2, et confirmation autorisée à 1).

## Important 2 — Corroboration de fusion (`report_count`)

**Fichiers** : migration `20260911170000_a5_terrain_nearby.sql`, `schemas/live.schema.ts`, `server/terrainReports.ts`, `TerrainReportCard.tsx`, tests.

- Migration : `ADD COLUMN IF NOT EXISTS report_count integer NOT NULL DEFAULT 1` + contrainte `CHECK (report_count >= 1)` ajoutée par bloc `DO` gardé (`pg_constraint.conrelid`), colonne commentée. RPC : `report_count integer` ajouté au `RETURNS TABLE` et au `SELECT r.report_count` ; `DROP FUNCTION IF EXISTS` avant `CREATE OR REPLACE` car le type de sortie change (idempotence).
- Schéma : `reportCount: z.number().int(...).min(1).default(1)` dans `terrainReportSchema` (la surface publique en hérite).
- Serveur : à la fusion, `getReport(existant)` → patch `{ report_count: max(1, reportCount) + 1, updated_at, + severity/passability si fournis }` ; à la création, `report_count: 1` explicite. `TerrainReportRow`/`toReportRow`/`toNearbyReport`/`listExpirationCandidates` mis à jour.
- UI : `TerrainReportCard` affiche ` · signalé ${reportCount} fois` quand `reportCount > 1`, sinon le libellé de confirmation.
- TDD : RED `report_count: 2` manquant (fusion) et `report_count: 1` manquant (création) ; GREEN avec `TEST-A5-SRV-02` étendu (patch `report_count: 2` + lecture de l'existant) et `TEST-A5-SRV-01` (création `report_count: 1`).

## Mineurs

3. **`severity` requis** dans le zod de `POST /api/terrain/reports` (`terrainSeveritySchema` sans `.optional()`), messages français conservés ; l'UI envoie déjà la gravité (QuickReportSheet).
4. **Expiration par défaut** : `defaultExpiryHours(category)` pur dans `domain/terrainLive.ts` (obstacle 72 h, closure 168 h, mud 24 h, snow_ice/water 72 h, danger 48 h, étendues 72 h) + `DEFAULT_EXPIRY_HOURS = 72` ; la création pose `expires_at = now + durée`. `TEST-A5-LIFE-09` (map complète) + assertions `expires_at` dans `TEST-A5-SRV-01`.
5. **Carte** : le fragment « confirmé par N » n'apparaît que si `report.presentCount > 0` (plus de « confirmé par 0 personne »).

## Vérifications

- RED ciblé : 4 échecs (`TEST-A5-LIFE-09`, `TEST-A5-SRV-01`, `TEST-A5-SRV-02`, `TEST-A5-SRV-06`).
- GREEN : `npx vitest run tests/adventure-intelligence` → 23 fichiers / **180 tests** passés.
- `npm run type-check` : exit 0. `npm run lint` : exit 0 (warnings préexistants uniquement).
- `npm run build` : **jamais exécuté** (contrainte).

## Notes / concerns ajoutées

- La migration modifiée n'a pas été exécutée contre PostGIS dans cet environnement ; le `DROP FUNCTION` est indispensable si la version précédente de la RPC a déjà été appliquée (changement de type de retour).
- `report_count` n'est pas exposé par la vue A1 (`terrain_reports_public`) ; la RPC de proximité le projette depuis la table de base. La vue reste inchangée (pas de `CREATE OR REPLACE VIEW`).
- Le cooldown est vérifié après le contrôle d'unicité : une confirmation déjà enregistrée répond `duplicate`, pas `rate_limited`.

