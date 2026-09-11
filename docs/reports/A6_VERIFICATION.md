# A6 — Rapport de vérification (Phase 6 : Adventure Orchestrator)

Date : 2026-09-11 · Branche : `chantier/adventure-intelligence` · Commit : `8c37cecc`
Statut : **RÉALISÉ**

## Livrables

| Livrable | Chemin |
|---|---|
| Spec + plan | `docs/superpowers/specs/2026-09-11-a6-adventure-orchestrator-design.md` |
| Domaine pur | `domain/orchestratorGraph.ts`, `engineRegistry.ts`, `candidates.ts`, `locks.ts`, `autonomy.ts`, `versioning.ts` |
| Adaptateurs | `server/adapters/*` : intent, route, budget, gear, coherence, prediction, difficulty, safety + skipped (weather/regulations/documents) |
| Orchestrateur | `server/generateAdventure.ts` (client injecté, version 1, runs, décisions, fallback IA) |
| APIs | `POST /api/adventure/generate`, `GET /api/adventure/[id]` |
| Migration | `supabase/migrations/20260911180000_a6_engine_runs_skipped.sql` (statut `skipped`) |
| Tests | 9 suites A6 (+32 tests) · **231 fichiers / 1737 tests** verts |

## Preuves

| Commande | Résultat |
|---|---|
| `npm run test` | ✅ 231 fichiers, 1737 tests, 0 échec |
| `npm run type-check` / `lint` / `verify:invariants` | ✅ exit 0 |

## Gate de sortie Phase 6 (vérifiée par revue indépendante — Approved, 0 Critical/Important)

- ✅ Une phrase → plan complet : les 19 sections du 6.1 présentes (nulles + warning si source absente).
- ✅ Trois variantes (confort, équilibré, aventure) avec budget/effort/durée/confort/risques/incertitude/raisons.
- ✅ Provenance et confiance sur chaque valeur (`PlanValue`), confiance globale = `combineConfidence`.
- ✅ Décisions requises (verrous + 5 types sensibles), aucun verrou modifié silencieusement.
- ✅ Version 1 persistée + snapshot + journal d'exécution des moteurs (id, version, statut, durée).
- ✅ **Fallback sans IA** : `explain` absent ou en échec → plan produit, `aiUsed=false`
  (test non vacuous GEN-05).
- ✅ Aucune donnée inventée : météo/réglementation/documents explicitement `skipped`.

## Notes et mineurs différés (ledger)

1. L'ordre du registre suit les dépendances déclarées par adaptateur plutôt que les paliers
   `ENGINE_NODES` — sans impact aujourd'hui, à aligner si les adaptateurs évoluent.
2. Les warnings de sections nulles vivent dans les runs/l'explication, pas sur le plan
   (pas de champ `warnings` au niveau plan).
3. `getAdventurePlan` ignore les erreurs de lecture de versions/décisions (200 partiel silencieux).
4. `started_at`/`finished_at` des runs égaux (durée mesurée côté registre).
5. Les messages d'erreur Zod de l'API renvoient les chemins, pas les messages français.
6. Branchement réel d'`askAI` (explication IA) non câblé dans l'API — fallback déterministe actif,
   conforme à la gate ; à finaliser en Phase 7/9.
