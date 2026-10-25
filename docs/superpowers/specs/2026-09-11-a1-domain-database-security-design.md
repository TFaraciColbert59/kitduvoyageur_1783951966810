# A1 — Domaine central, BDD et sécurité — Design

Date : 2026-09-11 · Statut : à implémenter · Plan : `docs/superpowers/plans/a1-domain-database-security.md`
Contraintes : `ADR-AI-001..008` (`docs/architecture/adventure-intelligence-decisions.md`)

## Vision

Poser les contrats partagés et toute la fondation de données du système Adventure
Intelligence : domaine TypeScript pur, schémas Zod, tables additives avec RLS,
consentements, événements de domaine idempotents. **Aucune fonctionnalité visible,
aucun calcul, aucun connecteur santé réel.** La Phase 1 doit être inerte côté produit
et parfaitement testable.

## Décisions structurantes

1. **Namespace** — tout vit sous `src/features/adventure-intelligence/` et les tables
   sont préfixées par domaine (`adventure_`, `segment_`, `terrain_`, `session_`,
   `performance_`, `user_performance_`). Le mot « adventure » déjà utilisé par le Hub
   (`adventureSchema`, `lkv_active_adventure`) reste hors domaine : aucun import croisé.
2. **Réseau** — `trail_segments` reste l'unique réseau (ADR-AI-002) ; l'enrichissement
   vit dans `trail_segment_features` (1:1).
3. **Contrat moteur** — `EngineResult<T>` + `AdventureEngine<I, O>` (ADR-AI-005).
   `Confidence` est un objet `{ score, level, sampleCount, method, reasons }` ;
   **pas** de collision avec `ConfidenceLevelEnum` (trips) qui reste tel quel.
   `DataProvenance` reprend la taxonomie existante
   (`measured|official|community|computed|estimated|suggested`) + `freshnessSeconds`.
4. **Événements** — `adventure_domain_events` avec clé d'idempotence et RPC
   `claim_pending_adventure_events` calquée sur `claim_pending_ai_jobs` (ADR-AI-006).
   `lkv_events` n'est pas modifié.
5. **Santé** — contrat `ExternalReadinessProvider` + `NoopReadinessProvider` uniquement.
   `adventure_data_consents.purpose = 'external_readiness'` est **interdit à l'octroi**
   par contrainte + policy (modifiable par migration ultérieure).
6. **Sécurité données** — 4 niveaux (ADR-AI-003) matérialisés par RLS :
   privé propriétaire, agrégats service-only, surfaces publiques seuil ≥ 5.

## Matrice RLS cible

| Table | SELECT public | SELECT authenticated | Écriture |
|---|---|---|---|
| `adventure_data_consents` | non | propriétaire | propriétaire (insert/update own, `external_readiness` forcé `granted=false`) |
| `trail_segment_features` | oui (non sensible) | oui | service_role uniquement |
| `hike_sessions` (extension) | non | propriétaire (existant) | propriétaire (existant) |
| `session_segment_passages` | non | propriétaire via `hike_sessions` | service_role uniquement |
| `performance_observations` | non | propriétaire | service_role (+ insert propriétaire pour ressenti déclaré Phase 3 → non, Phase 1: service only) |
| `user_performance_profiles` (+versions) | non | propriétaire | service_role uniquement |
| `segment_condition_buckets` | oui (référentiel) | oui | service_role |
| `segment_collective_aggregates` | **seuil** `distinct_user_count >= 5` | idem | service_role |
| vue `terrain_reports_public` | oui, **sans identité** (statuts `confirmed/active` non expirés) | idem | — |
| `terrain_reports` | non (base) | propriétaire | propriétaire insert (`reporter_id = auth.uid()`, `status='pending'`), update limité au pending |
| `terrain_report_confirmations` | non | propriétaire | propriétaire insert (1 seule par user/rapport) |
| `terrain_events` | statuts `active` non expirés | idem | service_role |
| `segment_predictions` / `route_predictions` | non | propriétaire | service_role |
| `adventure_plans` | non | propriétaire + `can_read_trip(trip_id)` | propriétaire |
| `adventure_plan_versions` / `decisions` / `engine_runs` | non | accès si accès au plan | service_role (+ propriétaire pour décisions) |
| `adventure_domain_events` | non | acteur (`actor_id = auth.uid()`) | insert acteur, claim/update service_role |

## Contrats TypeScript (extraits normatifs)

```ts
// domain/confidence.ts
export type ConfidenceLevel = 'high' | 'medium' | 'low';
export interface Confidence {
  score: number; level: ConfidenceLevel; sampleCount: number;
  method: string; reasons: string[];
}

// domain/provenance.ts — taxonomie alignée sur trips/schemas/autoGen.schema.ts
export type ProvenanceSource = 'measured' | 'official' | 'community' | 'computed' | 'estimated' | 'suggested';
export interface DataProvenance {
  source: ProvenanceSource; sourceRef?: string; observedAt?: string;
  freshnessSeconds?: number; notes?: string;
}

// domain/engine.ts
export interface EngineResult<T> { /* value, confidence, provenance, assumptions, warnings, alternatives, impacts, computedAt, validUntil */ }
export interface AdventureEngine<I, O> {
  readonly id: string; readonly version: string; readonly dependencies: string[];
  canRun(context: AdventureExecutionContext): boolean;
  run(input: I, context: AdventureExecutionContext): Promise<EngineResult<O>>;
}

// domain/health.ts
export interface ExternalReadinessProvider { /* providerId, isAvailable, requestAuthorization, getDailyReadiness */ }
```

## Flux (aucun runtime en Phase 1)

```text
Zod schemas ⇄ domain types (source de vérité)
migrations additives ── tables + RLS + claim RPC
tests: vitest (contrats, schémas, matrice RLS simulée) + pgTAP (RLS réelle, sur copie)
```

## Contraintes respectées

- Migrations additives et idempotentes, jamais destructives ; timestamps `20260911130000+`.
- `trail_metadata` / `trail_scores` / `trail_pois` non touchés (distant-seulement).
- Aucune modification de `lkv_events`, `ai_jobs`, `trips`, `crews`.
- Aucun connecteur santé ; aucune donnée santé stockée.
- RLS sur toute nouvelle table, `SECURITY DEFINER` avec `search_path` verrouillé.

## Gate de sortie Phase 1

- `npm run lint`, `npm run type-check`, `npm run test` verts (tests A1 inclus).
- Migrations additives idempotentes ; validation sur copie (`supabase db push --db-url` puis
  `supabase test db --db-url`) — gate manuelle documentée (pas de replay base vide, cf. a0).
- Suites pgTAP A1 présentes ; contrats Zod ; zéro exposition privée (contrôle
  `public_read_user_profiles` inclus) ; zéro connecteur santé réel.

## Hors périmètre Phase 1

Calculs (Phase 2-3), agrégation réelle (Phase 4), UI et APIs HTTP (Phases 5-7),
orchestrateur (Phase 6), entitlements (Phase 8), connecteurs santé (hors roadmap
périphérique).
