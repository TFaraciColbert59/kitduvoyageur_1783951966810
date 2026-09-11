# A6 — Adventure Orchestrator et génération complète — Rapport implémenteur (commits 1 à 5)

- Worktree : `C:/Users/Tony/Downloads/LKDV/worktrees/adventure-intelligence`
- Branche : `chantier/adventure-intelligence`
- Date : 2026-09-11
- Spec normative : `docs/superpowers/specs/2026-09-11-a6-adventure-orchestrator-design.md`
- Périmètre : commits 1 à 5 (spec intégrale)

## Commits (ordre exact de la spec)

1. `ffa1e094` — `feat(a6): graphe de dependances et registre de moteurs`
2. `18b5c601` — `feat(a6): candidats, verrous, autonomie et versionnement`
3. `c5ce8374` — `feat(a6): adaptateurs des moteurs existants`
4. `d97225ac` — `feat(a6): orchestrateur de generation + persistance`
5. `8c37cecc` — `feat(a6): APIs generate et lecture + fallback IA`

## Vérifications globales

- `npx vitest run tests/adventure-intelligence` : **32 fichiers / 216 tests passés**, 0 échec.
- `npx vitest run` (suite complète) : **231 fichiers / 1737 tests passés**, 0 échec.
- `npm run type-check` : exit 0 à chaque commit.
- `npm run lint` : exit 0 à chaque commit (avertissements préexistants uniquement ; 1 avertissement A6 introduit puis supprimé avant commit).
- `npm run build` : **jamais exécuté** (contrainte respectée).

---

## Commit 1 — Graphe de dépendances et registre de moteurs

**Fichiers**
- `src/features/adventure-intelligence/domain/orchestratorGraph.ts`
- `src/features/adventure-intelligence/domain/engineRegistry.ts`
- `tests/adventure-intelligence/orchestrator-graph.spec.ts` — `TEST-A6-GRAPH-01..03` (3 tests)
- `tests/adventure-intelligence/engine-registry.spec.ts` — `TEST-A6-REG-01..05` (5 tests)

**Implémentation**
- `ENGINE_NODES` : 20 nœuds dans l'ordre roadmap ; dépendances sémantiques pointant toutes vers un index antérieur.
- `topologicalOrder` : Kahn stable, sélection du plus petit index de déclaration parmi les nœuds prêts ⇒ ordre **exactement** identique à `ENGINE_NODES` (vérifié par test). Jette sur dépendance manquante puis sur cycle (messages français distincts).
- `missingDependencies(nodes?)` : dédupliqué + trié, compatible graphes partiels.
- `isCriticalEngine(id)` : criticité issue du graphe, inconnu ⇒ non critique.
- `EngineRegistry` : ordre par dépendances enregistrées (index d'enregistrement pour départager), `canRun` faux ⇒ `skipped` + warning explicite (`skipReason` duck-typé préféré), `EngineSkipSignal` ⇒ `skipped` motivé, exception ⇒ `failed` + warning `engine_failed`, moteur critique ⇒ `CriticalEngineError` (porte les runs déjà calculés). `durationMs` mesuré, confiance du plan = `combineConfidence` des seuls moteurs ayant produit (sinon confiance froide).
- `outputs` stocke le `EngineResult` complet (valeur + confiance + provenance) — décision nécessaire pour que l'assemblage du plan porte confiance/provenance par section.

**TDD**
- RED : 2 suites en échec, `Cannot find package '@/features/adventure-intelligence/domain/orchestratorGraph'` et `.../engineRegistry'` — 0 test collecté.
- GREEN : 8/8 après implémentation. Aller-retour : le test REG-01 omettait `canRun: () => false` (bug de test, corrigé) ; `position.get(...)` typé `number | undefined` corrigé pour TS strict.
- `npm run type-check` exit 0, `npm run lint` exit 0.

## Commit 2 — Candidats, verrous, autonomie et versionnement

**Fichiers**
- `src/features/adventure-intelligence/domain/candidates.ts`
- `src/features/adventure-intelligence/domain/locks.ts`
- `src/features/adventure-intelligence/domain/autonomy.ts`
- `src/features/adventure-intelligence/domain/versioning.ts`
- `tests/adventure-intelligence/candidates.spec.ts` — `TEST-A6-CAND-01..03`
- `tests/adventure-intelligence/locks.spec.ts` — `TEST-A6-LOCK-01..03`
- `tests/adventure-intelligence/autonomy.spec.ts` — `TEST-A6-AUTO-01..02`
- `tests/adventure-intelligence/versioning.spec.ts` — `TEST-A6-VER-01..03`

**Implémentation**
- `buildCandidates` : 3 variantes `comfort/balanced/adventure` ; monotonicité stricte effort (`-12 < 0 < +22`), risque (`0.2 < 0.45 < 0.72`), confort décroissant (`0.85 > 0.6 > 0.35`) ; raisons non vides contextualisées (jours, groupe, palier budget).
- `detectLockViolations` : valeur modifiée, verrou retiré ou contrainte disparue ⇒ identifiant listé ; les contraintes non verrouillées restent libres.
- `restoreLockedConstraints` : réapplique valeur + drapeau des verrous violés, ajoute les verrous disparus, préserve tout le reste.
- `buildLockConfirmationDecisions` : décision `proposed`, `requiresConfirmation: true`, impact `warning`, ID déterministe.
- `autonomy` : `AUTONOMY_LEVELS`, `AUTONOMY_CONFIRMATION_ACTIONS` = 5 types structurants (réutilise `requiresConfirmation` A1), `canAutoExecute` n'autorise que `other` et jamais pour `advisor`.
- `diffPlanVersions` : comparaison section par section (19 clés, ordre normatif), impacts avec gravité (`safetyPlan` critical, `budget/bookings/regulations` warning, sinon info), `requiresConfirmation` sur sections sensibles. `nextVersionMeta` incrémente et horodate (`planId` ajouté par l'appelant).

**TDD**
- RED : 4 suites en échec, modules introuvables — 0 test collecté.
- GREEN : 11/11. Correction TS : `planWithSections()` sans argument dans le test VER-02.
- Type-check/lint exit 0.

## Commit 3 — Adaptateurs des moteurs existants

**Fichiers**
- `src/features/adventure-intelligence/server/adapters/adapterSupport.ts`
- `.../intentAdapter.ts`, `routeAdapter.ts`, `budgetAdapter.ts`, `gearAdapter.ts`, `coherenceAdapter.ts`
- `.../predictionAdapter.ts`, `difficultyAdapter.ts`, `safetyAdapter.ts`, `skippedAdapters.ts`, `index.ts`
- `tests/adventure-intelligence/adapters.spec.ts` — `TEST-A6-ADP-01..08`

**Adaptateurs live (source déterministe existante)**
| Adaptateur | Moteur enveloppé | Données | Confiance/provenance |
|---|---|---|---|
| `intent` | `tripBriefExtractor` | extraction déterministe du texte | `computed` + score `stated/inferred/defaulted` (0.85/0.6/0.3), warning si destination/durée par défaut |
| `route` | `runAutoGenPipeline` + blueprints | couches catalogue | confiance de la proposition (catalogue `low` ⇒ 0.35), provenance `estimated` dédupliquée |
| `budget` | `budgetEngine.calculateBudgetSummary` | couche `budget` du blueprint, dépenses réelles vides | confiance de la proposition ; skip motivé si couche absente |
| `gear` | `contextualKitEngine.generateTripContextualKit` | règles contextuelles pays/saison/durée | `computed`, inventaire vide déclaré (warning + hypothèse) |
| `coherence` | `coherenceSolver.solveCoherence` | couches + verrous utilisateur | `computed`; verrous liés par id de proposition/slot/couche/constante, restauration + `lockReport` en cas de violation résiduelle |
| `prediction` | A3 `predictRoute` | agrégats blueprint découpés uniformément, profil optionnel | confiance A3 (profil fourni, sinon repli standard froid), hypothèses explicites |
| `difficulty` | A3 `predictSegment` agrégé | mêmes étapes ; difficulté groupe uniquement si 1 participant, sinon `null` | confiance combinée des segments |
| `safety` | couche `safety` du blueprint | numéros/unités catalogue | `estimated` + warning « à vérifier avant départ » ; skip motivé si couche absente |

**Adaptateurs skipped (aucune source déterministe — aucune donnée inventée)**
- `weather` : `weather_no_deterministic_source` ⇒ section `liveConditions` null.
- `regulations` : `regulations_no_deterministic_source` ⇒ section `regulations` null. Décision : ne PAS exposer la couche `compliance` du blueprint comme réglementation (estimations catalogue ≠ réglementation vérifiée).
- `documents` : `documents_no_deterministic_source` ⇒ section `documents` null.

Chacun expose `canRun() === false` + `skipReason` et `run()` jette `EngineSkipSignal` ; le registre les journalise en `skipped` (jamais un faux succès).

**TDD**
- RED : 1 suite en échec, adaptateurs introuvables — 0 test collecté.
- GREEN : 8/8. Corrections : texte du test ADP-01 sans mois ⇒ confiance 0.3 (ajout d'un mois explicite) ; `SegmentPrediction` importé du schéma (pas du domaine) ; type `SkippedAdapter` pour exposer `skipReason`.
- Type-check/lint exit 0.

## Commit 4 — Orchestrateur de génération + persistance

**Fichiers**
- `src/features/adventure-intelligence/server/generateAdventure.ts`
- `supabase/migrations/20260911180000_a6_engine_runs_skipped.sql`
- `tests/adventure-intelligence/generate-adventure.spec.ts` — `TEST-A6-GEN-01..05`

**Implémentation**
- `generateAdventure` : brief → registre (adaptateurs) → assemblage `AdventurePlan` (19 sections, chaque valeur en `PlanValue`) → candidats → décisions → version 1 + runs + décisions persistés → explication IA (`explain` injecté) avec repli déterministe local ; `aiUsed` reflète la réalité.
- Résolveur d'entrées : `intent/route` reçoivent le texte ; `budget/gear/coherence/prediction/difficulty/safety` reçoivent l'itinéraire, les verrous et la taille de groupe résolue depuis la sortie `intent` (le groupe déclaré alimente donc le budget groupe).
- Sections : transport/localMobility/accommodations/dailyStages/activityRoutes/terrainAnalysis/foodAndWater via couches (résolues par le solveur de cohérence quand disponible) ; personalDifficulty/groupDifficulty/paceStrategies/gearPlan/budget/safetyPlan via résultats moteurs ; alternatives = 3 variantes ; bookings/documents/regulations/offlinePackage/liveConditions = `null` explicite.
- Décisions : verrous violés (déjà restaurés, à confirmer) + `payment` (budget) + `safety_change` (plan de sécurité), toutes `requiresConfirmation: true`, persitées via `insertDecisions`.
- Persistance Supabase : `createSupabaseAdventurePersistence` (insert plan/version/run/décisions, planId retourné par la base) ; lecture `getAdventurePlan` (plan + version courante + décisions, snapshot validé Zod, repli sûr).
- Migration additive : la contrainte A1 `adventure_engine_runs_status_check` n'autorisait que `running|succeeded|failed` — ajout de `skipped` (statut du registre). Idempotente (`DROP CONSTRAINT IF EXISTS` + `ADD CONSTRAINT`).
- Échec d'un moteur critique : runs déjà calculés persistés avec `plan_id = NULL` (autorisé par le schéma A1, observabilité globale) puis erreur d'origine relancée.
- Explication locale déterministe : destination, jours, variantes, confiance, moteurs skippés, sections vides — jamais de faits externes.

**TDD**
- RED : 1 suite en échec, module introuvable — 0 test collecté.
- GREEN : 5/5 après implémentation. Corrections : signature générique `planValueFromResult<T, V>`, helper de test `deps(persistence, overrides)` typé, taille de groupe résolue depuis `intent`.
- Type-check/lint exit 0.

## Commit 5 — APIs generate et lecture + fallback IA

**Fichiers**
- `src/app/api/adventure/generate/route.ts` (POST)
- `src/app/api/adventure/[id]/route.ts` (GET)
- `tests/adventure-intelligence/adventure-api.spec.ts` — `TEST-A6-API-01..04`

**Implémentation**
- `POST /api/adventure/generate` : `force-dynamic`, auth obligatoire (401 `{ error: 'Unauthorized', details: 'Session requise' }`), zod français `{ text: 10..2000, locks? }` (400 `{ error, details }`), service requis (503), 201 `{ planId, version, candidates, explanation, aiUsed }`.
- `GET /api/adventure/[id]` : `force-dynamic`, UUID validé, client de session (policies A1 propriétaire/collaborateur via `can_read_trip`), 404 pour tout plan inexistant/inaccessible/non authentifié (`{ error: 'Plan introuvable' }`), 200 `{ plan, version, decisions }`.
- Fallback IA : couvert par `TEST-A6-GEN-05` (explain absent, rejeté ou vide ⇒ plan produit, `aiUsed=false`, explication locale non vide ; explain résolu ⇒ `aiUsed=true`).

**TDD**
- RED : 1 suite en échec, routes introuvables — 0 test collecté.
- GREEN : 4/4. Un aller-retour : `'trop court'` fait exactement 10 caractères et passe `min(10)` — test corrigé avec `'court'`.
- Type-check/lint exit 0.

---

## Décisions notables

1. **`outputs` du registre = `EngineResult` complets** (et non la seule valeur) : indispensable pour que chaque `PlanValue` porte la confiance/provenance du moteur qui l'a produite, sans re-calcul ni fabrication.
2. **Réglementation non dérivée de la couche `compliance`** : la spec interdit de fabriquer du contenu réglementaire ; le catalogue n'est pas une source réglementaire vérifiée. `regulations/documents/weather` skippent toujours en l'absence de source déterministe injectée.
3. **Sécurité dérivée du blueprint** (source déterministe existante) avec provenance `estimated` + warning « à vérifier avant départ » + hypothèse dédiée.
4. **Prédiction/difficulté sur étapes uniformes** : les agrégats blueprint (distance/D+/D-/nb étapes) sont découpés uniformément faute de géométrie de trace dans l'entrée de génération. Hypothèse + warning explicites (`uniform_segmentation`).
5. **Difficulté groupe `null` au-delà d'un participant** : aucune moyenne inventée sans profils des participants.
6. **Verrous liés aux couches** par identifiants (proposition, slot, couche, clé) ; budget verrouillé numérique alimente `maxBudgetEur` du solveur ; toute violation résiduelle est restaurée puis transformée en décision à confirmer.
7. **Migration `skipped`** : nécessaire pour une observabilité honnête ; additive et idempotente.
8. **GET non authentifié ⇒ 404** (et non 401) pour ne pas révéler l'existence d'un plan ; seul `generate` est explicitement 401 (spec).

## Concerns

- **IA explicative non branchée côté API** : aucune provider n'est injecté dans la route ; le résumé local déterministe est toujours utilisé (`aiUsed=false`). Le contrat `explain` est prêt et testé ; le branchement IA se fera dans un lot ultérieur.
- **Persistance du plan complet dans `adventure_plan_versions.snapshot`** : la table `adventure_plans` A1 ne porte ni sections, ni participants, ni dates/destinations. La lecture dépend du snapshot ; si un snapshot est invalide, `getAdventurePlan` retombe sur la ligne + sections null (dégradé mais jamais faux).
- **Budget** : `calculateBudgetSummary` est appelé sans dépenses réelles ; le résumé documente l'enveloppe prévisionnelle, pas des dépenses. La section budget utilise la couche résolue par cohérence, mais le montant total peut différer du résumé recalculé (le solveur ajuste la couche).
- **Runs critiques** : en cas d'échec critique, les runs sont persistés avec `plan_id NULL` ; si le service est indisponible, la persistance d'observabilité est silencieusement ignorée pour ne pas masquer l'erreur d'origine.
- **`durationMs` mesuré avec `Date.now()`** (précision ms) — suffisant pour l'observabilité, non monotone par nature.
- **Moteurs non enregistrés** (`destination`, `dates`, `participants`, `constraints`, `profile`, `terrain`, `transport`, `accommodations`, `food_water`) : couverts fonctionnellement par les adaptateurs `intent`/`route` ; le graphe reste normatif pour la criticité (seuls `intent`, `route`, `coherence`, `adventure_plan` critiques).
