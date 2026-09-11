# Adventure Intelligence — État des lieux de l'existant

Date : 2026-09-11 · Référence audit : `main@b67bf401` · Statut : validé (Phase 0)

> Ce document remplace l'audit formel de la Phase 0. Il s'appuie sur :
> - `ADVENTURE_INTELLIGENCE_MASTER_PLAN.md` (audit macro, commit `1779502b`) ;
> - l'inspection directe du code, des 143 migrations et des tests du dépôt ;
> - les rapports existants (`docs/reports/MIGRATION_HISTORY_RECONCILIATION.md`,
>   `docs/DATA_MODEL.md`, `docs/PERMISSIONS.md`, `docs/EVENTS.md`).
>
> Limite assumée : la base de production distante (`icxyvwzfjbflcbqukpfz`) n'a pas
> été inspectée en direct. Les objets « distants seulement » sont signalés comme tels.

---

## 1. Socle technique

| Brique | Version / état |
|---|---|
| Framework | Next.js 15.5, React 19, TypeScript strict |
| BDD | Supabase PostgreSQL + PostGIS, 143 migrations |
| Validation | Zod 4 |
| État client | Zustand, TanStack Query |
| Cartes | MapLibre GL 6, Leaflet 1.9 |
| Mobile | Capacitor 8 (iOS/Android), géoloc, caméra, haptique, réseau, préférences |
| Offline | Dexie 4 (navigateur), file `localStorage` (V1) |
| IA | OpenRouter/Nemotron via `src/lib/ai`, cache JSONB, quotas, jobs async, cron |
| Paiement | Stripe (webhook, métadonnées), affiliation |
| Tests | Vitest 4 (1521 tests, 199 fichiers), Playwright E2E/a11y/visuel, pgTAP (6 suites, exécution manuelle sur copie) |
| CI | `.github/workflows/ci.yml` : type-check, lint, vitest, build, 1 e2e, invariants, a11y, visuel — **aucune étape BDD** |

---

## 2. Ce qui existe (vérifié dans le code)

### 2.1 Hub universel — `src/features/hub/`

- Composition par activité : `deriveTripProfile` → `applyActivityProfile` → catalogue
  (`registry/widgetCatalog.ts`), profils Voyage/Randonnée.
- Contexte d'aventure actif : cookie `lkv_active_adventure`, `adventureSchema`
  (possession | sortie | collectif), `suggestAdventure`.
- Données serveur : `server/getHubAdventureData.ts` (trip + crew + hiking + counts),
  `server/featureFlags.ts` (RPC `current_feature_flags`, fail-open).
- Télémétrie hub : `hub_telemetry` + vue KPI (migrations `20260909150000`, `20260909160000`).
- Refonte mobile des sections (budget, équipement, groupe, checklist, documents,
  sécurité, journal), roadbook (`20260911120000`).

### 2.2 Voyage et planification — `src/features/trips/`

- Pipeline 6 étapes : `engine/autoGenPipeline.ts` (extraction d'intention →
  blueprint → clonage des couches → cohérence → compromis → propositions).
- Extraction déterministe : `engine/tripBriefExtractor.ts`.
- Solveur : `engine/coherenceSolver.ts` (contraintes verrouillées, budget,
  hébergement, poids de sac — **règle 20 % + poids par défaut à remplacer**).
- Budget : `engine/budgetEngine.ts`; kit contextuel : `engine/contextualKitEngine.ts`.
- Schémas Zod matures : `schemas/trip.schema.ts` (575 lignes),
  `schemas/autoGen.schema.ts` (`ConfidenceLevelEnum`, `ProvenanceTypeEnum`,
  `ProvenanceSchema`, `BaseProposalSchema`).
- APIs : `/api/voyages`, `/api/hub/adventures`, actions serveur `actions/*`.

### 2.3 Randonnée — `src/features/hiking/`

- Moteurs : `engine/HikeEngine.ts`, `engine/TrackingEngine.ts` (distance, cap,
  lissage altitude, D+, outliers), `engine/HikingStateMachine.ts`,
  `engine/HikeAlertEngine.ts`, `navigation/NavigationEngine.ts`, `safety/SafetyEngine.ts`.
- Copilote : `copilot/CopilotEngine.ts` — **allure standard fixe 15 min/km à remplacer**.
- Intelligence : `intelligence/HikerProfileEngine.ts` (profil V1 statique),
  `intelligence/TrailIntelligenceEngine.ts` (**prototype : `Math.random()`, calcul client,
  route-level, non persistant — à migrer en Phase 4**), `TrailRecommendationEngine.ts`.
- Offline V1 : `offline/OfflineManager.ts` (file `localStorage` → cible Dexie en Phase 7).
- Services : GPS, sessions, profil, météo, narration, GPX.
- Types : `types/index.ts` (interfaces pures).

### 2.4 Infrastructure IA — `src/lib/ai/`

- `askAI.ts` : point d'entrée unique, fournisseurs interchangeables, cache, quotas,
  fallbacks, registre de features.
- Jobs : table `ai_jobs` + RPC `claim_pending_ai_jobs` (SKIP LOCKED, cap 5 tentatives),
  route cron `/api/cron/process-ai-jobs` (CRON_SECRET), client service-role.
- **Règle d'architecture** : « L'IA enrichit, les moteurs déterministes décident. »

### 2.5 Événements, flags, monétisation

- Bus : `lkv_events` (`src/lib/events/eventBus.ts`, handlers feed/notifications/scoring,
  purge RGPD 13 mois). **Fire-and-forget, FK `crew_id` legacy vers `travel_groups`.**
- Feature flags : table `feature_flags` + RPC `current_feature_flags()` (SECURITY DEFINER).
- Affiliation : `src/features/affiliation/*`; Stripe : webhook + métadonnées.

---

## 3. État BDD

### 3.1 Tables structurantes présentes

| Table | Migration source | Notes |
|---|---|---|
| `hike_sessions` | `20260809200000` (+ `20260903020000`) | `positions_geojson`, RLS propriétaire, kit_id |
| `trail_segments` | `20260717110000` | réseau OSM central (LineString 4326), lecture publique |
| `hiking_routes` | `20260717110000` (+ `20260903020000`) | itinéraires nommés GR/PR |
| `trips` / `trip_steps` | `20260904050000` | RLS via `can_read_trip` / `can_edit_trip` |
| `trip_collaborators` / `trip_participants` | `20260904050000` / `20260907000000` | modèle unifié |
| `crews` / `crew_members` | `20260907000000` | RLS via `lkv_can` |
| `travel_groups` / `group_members` | `20260716000000` | legacy, migré vers crews |
| `ai_jobs` | `20260903000000` | user_id devenu nullable (`20260904030000`) |
| `lkv_events` | `20260907010000` | `crew_id` FK legacy + policy `group_members` |
| `feature_flags` | `20260909140000` | FORCE RLS, RPC dédié |
| `user_profiles` | `20260713170000` (+ ~12 altérations) | RLS fragmentée, voir §5 |
| `user_orientation` | `20260904010000` | démographie privée, owner-only |

### 3.2 Objets « distants seulement » (absents du dépôt)

`trail_metadata`, `trail_scores`, `trail_pois`, RPC `get_trail_pois_bbox` existent en
production mais **aucun `CREATE` n'existe dans `supabase/migrations/`**. Forme déduite
du code consommateur (`RouteService.ts`, `lib/queries/pois.ts`, migrations qui les lisent).
**Interdiction de recréer** : toute évolution devra les introspecter puis les étendre par
migrations additives.

### 3.3 Conventions RLS établies

- Helpers anti-récursion `STABLE SECURITY DEFINER` : `is_admin()`, `can_read_trip(uuid)`,
  `can_edit_trip(uuid)`, `lkv_can(uid, resource, id, action)`, `is_group_member`,
  `is_group_organizer`, helpers messagerie.
- Agrégats privés exposés via fonctions `SECURITY DEFINER` verrouillées :
  `get_kit_journal`, `get_user_signature` (gate consentement + matview révoquée).
- Privilèges explicites : `REVOKE ALL ... FROM public` puis `GRANT EXECUTE` ciblé.

### 3.4 Tests BDD

- 6 suites pgTAP dans `supabase/tests/database/`, exécutées **manuellement** sur copie :
  `supabase test db --db-url "<copie>"` (BEGIN/ROLLBACK, `SET LOCAL ROLE`,
  `request.jwt.claim.sub`).
- Tests RLS côté TS : **simulations** (`tests/trips/rls-isolation.spec.ts`,
  `tests/security/rlsMatrix.spec.ts`) — aucune exécution Postgres en CI.
- Protocole officiel : `docs/reports/MIGRATION_HISTORY_RECONCILIATION.md`
  (copie → push → tests → prod, projet fantôme interdit).

### 3.5 Dette BDD

1. Replay à blanc impossible : lots 7-10 contiennent `AS \$\$` échappés et des `INDEX`
   inline invalides ; 8 migrations `placeholder`.
2. Drift repo/prod : objets distants sans source (voir §3.2).
3. `lkv_events` : FK `crew_id` → `travel_groups` et policy basée sur `group_members`,
   deux objets legacy après l'unification crews.
4. Client Supabase **non typé** (`src/lib/supabase/types.ts` artisanal, pas de
   `supabase gen types`).

---

## 4. Écarts vs vision Adventure Intelligence

Synthèse du master plan §7-10, confirmée par inspection :

| Domaine | État | Commentaire |
|---|---|---|
| Hub / UI mobile | 75-80 % | base réutilisable |
| Voyage / planification | 65 % | pipeline présent, pas d'orchestrateur |
| Matériel / budget | 75 % | moteurs + UI présents |
| GPS randonnée | 55 % | traces collectées, pas de passages |
| Profil de performance personnel | 0-10 % | `HikerProfileEngine` V1 statique |
| Calculs physiologiques / ETA | 5 % | 15 min/km fixe |
| Segmentation collective | 0 % | `TrailIntelligenceEngine` prototype |
| Terrain Live | 0 % | rien |
| Orchestration globale | 25 % | couches juxtaposées |
| Jobs/événements domaine | 30 % | `ai_jobs` + `lkv_events`, pas de queue domaine |
| Santé connectée | 0 % | hors périmètre, contrats futurs seulement |
| Monétisation | 30 % | affiliation + Stripe, pas d'entitlements |

---

## 5. Risques techniques identifiés (entrée des ADR et de la Phase 1)

1. **Exposition potentielle `user_profiles`** — une policy
   `public_read_user_profiles FOR SELECT TO public USING (true)`
   (créée en `20260713210000:61-65`) n'est jamais supprimée par les nettoyages
   ultérieurs (qui visent `public_read_profiles`). À vérifier sur copie et corriger
   en Phase 1 (gate « aucune exposition de données privées »).
2. **Aucun consentement structuré** : seul `user_profiles.signature_visibility` existe.
3. **Replay cassé** — la gate « base vide migrable » de la roadmap est inatteignable
   en l'état ; la validation se fera sur copie de la base existante (décision Phase 0).
4. **Tables distantes non versionnées** — risque de divergence à chaque évolution.
5. **Nommage « adventure » surchargé** — le hub utilise déjà `adventure*` ; le nouveau
   domaine sera isolé sous `src/features/adventure-intelligence/` (namespace explicite).
6. **Arbre git sale hors chantier** — neutralisé par le worktree
   `worktrees/adventure-intelligence` (branche `chantier/adventure-intelligence`).

---

## 6. Capacités futures préparées (hors périmètre santé)

- `ExternalReadinessProvider` + `NoopReadinessProvider` (Phase 1) : contrat seulement,
  aucun HealthKit / Health Connect / Garmin / Fitbit / BLE.
- Aucun stockage de données de santé réelles dans les tables du domaine.

---

## Références

- `ADVENTURE_INTELLIGENCE_MASTER_PLAN.md` (vision, §27 architecture de données cible).
- `roadmap canonique — 10 phases.md` (ordre d'exécution canonique).
- `docs/architecture/adventure-intelligence-decisions.md` (ADR-AI-001..008).
- `docs/superpowers/plans/a0-baseline-architecture.md` (baseline reproductible).
