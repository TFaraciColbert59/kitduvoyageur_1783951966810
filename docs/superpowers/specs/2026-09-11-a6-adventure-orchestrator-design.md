# A6 — Adventure Orchestrator et génération complète — Design & Plan

Date : 2026-09-11 · Type : spec + plan combinés
Contraintes : ADR-AI-001 (AdventurePlan), ADR-AI-004 (IA explicative), ADR-AI-005/006, ADR-AI-008

## Vision

Une phrase → un `AdventurePlan` complet, trois variantes, provenance, confiance, décisions,
version. **L'échec de l'IA ne doit jamais rendre le plan inutilisable.**

## Graphe de dépendances (normatif — roadmap 6.3)

```text
intent
→ destination | dates | participants | constraints
→ route | transport | accommodations
→ weather | regulations
→ profile | terrain
→ prediction | difficulty
→ food_water | gear | budget
→ safety
→ coherence (solveur)
→ adventure_plan (assemblage + versions)
```

## Moteurs (domaine)

- `domain/orchestratorGraph.ts` :
  ```ts
  export interface EngineNode { id: EngineNodeId; dependencies: EngineNodeId[]; critical: boolean; }
  export const ENGINE_NODES: EngineNode[]; // ordre roadmap ci-dessus
  export function topologicalOrder(nodes?: EngineNode[]): EngineNodeId[]; // jette sur cycle ou dép. manquant
  export function missingDependencies(nodes?: EngineNode[]): string[];
  ```
  `EngineNodeId` : `'intent'|'destination'|'dates'|'participants'|'constraints'|'route'|'transport'|'accommodations'|'weather'|'regulations'|'profile'|'terrain'|'prediction'|'difficulty'|'food_water'|'gear'|'budget'|'safety'|'coherence'|'adventure_plan'`.
- `domain/engineRegistry.ts` :
  ```ts
  export interface EngineRunRecord { engineId: string; engineVersion: string; status: 'succeeded'|'skipped'|'failed'; durationMs: number; warnings: EngineWarning[]; error?: string; }
  export class EngineRegistry {
    register(engine: AdventureEngine<unknown, unknown>): void;
    has(id: string): boolean;
    runPipeline(context: AdventureExecutionContext, initial: unknown, resolveInput: (id: string, outputs: Map<string, unknown>) => unknown): Promise<{ outputs: Map<string, unknown>; runs: EngineRunRecord[]; planConfidence: Confidence }>;
  }
  ```
  Règles : ordre topologique ; `canRun` faux → `skipped` + warning ; exception → `failed`
  + warning, les non-critiques n'interrompent pas ; confiance du plan = `combineConfidence`
  des moteurs ayant produit ; `durationMs` mesuré ; aucun I/O dans le domaine.
- `domain/candidates.ts` : `buildCandidates(input) → AdventureCandidate[]` (3 : `comfort`,
  `balanced`, `adventure`) avec `{ id, label, budgetDeltaPct, effortDeltaPct, durationDeltaPct,
  comfortScore, riskScore, uncertainty, reasons[] }` ; `adventure` = autonomie, risques ↑,
  confort ↓ ; `comfort` = marges, pauses ↑ ; `balanced` = intermédiaire.
- `domain/locks.ts` : `detectLockViolations(before, after, locks) → string[]` ;
  verrou violé = jamais silencieux (retourne les violations, l'appelant restaure la valeur
  verrouillée et journalise une dépendance `requiresConfirmation`).
- `domain/autonomy.ts` : `AUTONOMY_LEVELS = ['advisor','copilot','guided_autopilot']` ;
  `requiredConfirmations(action: DecisionType): boolean` (réutilise A1) ;
  `AUTONOMY_CONFIRMATION_ACTIONS` = payment, cancellation, safety_change, location_share, group_change.
- `domain/versioning.ts` : `diffPlanVersions(prev, next) → { reason, changes: PlanChange[], impacts: PlanImpact[] }`
  (`PlanChange = { path: string; before: unknown; after: unknown; requiresConfirmation: boolean }`),
  `nextVersionMeta(version, reason, generatedBy, confidence)`.

## Adaptateurs (serveur)

`server/adapters/` — wraps des moteurs existants, chacun expose `AdventureEngine` :
- `intentAdapter` → `src/features/trips/engine/tripBriefExtractor.ts` (extraction d'intention) ;
- `routeAdapter` → `autoGenPipeline.ts` (couches/étapes via blueprint) ;
- `budgetAdapter` → `budgetEngine.ts` ;
- `gearAdapter` → `contextualKitEngine.ts` ;
- `coherenceAdapter` → `coherenceSolver.ts` ;
- `predictionAdapter` → A3 `predictRoute` (avec profil fourni, sinon fallback standard) ;
- `difficultyAdapter` → A3 `predictSegment` agrégé ;
- `safetyAdapter`, `weatherAdapter`, `regulationsAdapter`, `documentsAdapter` : uniquement si
  une source déterministe existe ; sinon l'adaptateur retourne `skipped` avec warning explicite
  (jamais de données inventées).

## Orchestrateur serveur

`server/generateAdventure.ts` (client injecté) :
```ts
export interface AdventureEnginePersistence {
  insertPlan(row: unknown): Promise<{ id: string }>;
  insertPlanVersion(row: unknown): Promise<void>;
  insertEngineRun(row: unknown): Promise<void>;
  insertDecisions(rows: unknown[]): Promise<void>;
}
export interface AdventureGenerationInput { ownerId: string; text: string; locks?: AdventureConstraint[]; participantsCount?: number; now?: string; }
export interface AdventureGenerationResult { plan: AdventurePlan; candidates: AdventureCandidate[]; runs: EngineRunRecord[]; explanation: string; aiUsed: boolean; }
export async function generateAdventure(input, deps: { registry; persistence; explain?: (ctx) => Promise<string> }): Promise<AdventureGenerationResult>;
```
Flux : brief → registre (adaptateurs) → assemblage `AdventurePlan` (toutes les sections du
6.1, chaque valeur en `PlanValue` avec confiance/provenance) → candidats → décisions requises
(verrous + confirmations) → version 1 + runs persistés → explication IA via `explain`
(fallback déterministe généré localement si absent/échec ; `aiUsed` le reflète).

## APIs

- `POST /api/adventure/generate` : auth requise, zod `{ text: min 10 max 2000, locks? }`,
  `force-dynamic`, 201 `{ planId, version, candidates, explanation, aiUsed }` ; 401/400/503.
- `GET /api/adventure/[id]` : lecture du plan + version courante + décisions (propriétaire ou
  collaborateur via policy A1), 404 sinon.

## Tests (IDs)

- `TEST-A6-GRAPH-01..03` : ordre topologique conforme roadmap, cycle détecté, dépendance manquante.
- `TEST-A6-REG-01..05` : skip motivé, échec non critique isolé, confiance combinée, runs enregistrés, `canRun` respecté.
- `TEST-A6-CAND-01..03` : 3 candidats, raisons non vides, monotonicité effort/risque comfort<balanced<adventure.
- `TEST-A6-LOCK-01..03` : violation détectée, restauration, décision `requiresConfirmation`.
- `TEST-A6-AUTO-01..02` : mapping confirmations ; niveaux d'autonomie.
- `TEST-A6-VER-01..03` : diff par section, impacts, version suivante.
- `TEST-A6-GEN-01..05` : phrase → plan complet (toutes sections présentes), provenance+confiance partout, 3 candidats, décisions requises, **échec de `explain` → plan quand même généré (`aiUsed=false`)**.

## Commits

1. `feat(a6): graphe de dependances et registre de moteurs`
2. `feat(a6): candidats, verrous, autonomie et versionnement`
3. `feat(a6): adaptateurs des moteurs existants`
4. `feat(a6): orchestrateur de generation + persistance`
5. `feat(a6): APIs generate et lecture + fallback IA`

## Gate de sortie

Une phrase produit un plan complet, trois variantes, provenance, confiance, décisions,
version, fallback sans IA.
