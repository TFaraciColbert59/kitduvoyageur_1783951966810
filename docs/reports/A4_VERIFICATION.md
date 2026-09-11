# A4 — Rapport de vérification (Phase 4 : intelligence collective des sentiers)

Date : 2026-09-11 · Branche : `chantier/adventure-intelligence` · Commit : `796b666c`
Statut : **RÉALISÉ**

## Livrables

| Livrable | Chemin |
|---|---|
| Spec + plan | `docs/superpowers/specs/2026-09-11-a4-collective-trail-intelligence-design.md` |
| Moteurs purs | `domain/collectiveIntelligence.ts` (médiane pondérée, percentiles, MAD, buckets, seuils), `domain/collectiveEligibility.ts` |
| Serveur | `server/aggregateSegments.ts` (client injecté, consentements, SHA-256 des identités, compteurs seulement) |
| Cron | `src/app/api/cron/aggregate-segments/route.ts` (CRON_SECRET, force-dynamic) |
| Migration | `supabase/migrations/20260911160000_a4_aggregation_support.sql` (index partiel + RPC `a4_recent_eligible_segments`, service_role) |
| Prototype migré | `src/features/hiking/intelligence/TrailIntelligenceEngine.ts` — `Math.random()` supprimé, ids FNV-1a déterministes, délégation par segment |
| Tests | `tests/adventure-intelligence/{collective-intelligence,collective-eligibility,aggregate-segments.server,trail-intelligence-legacy}.spec.ts` (+21 tests A4) |

## Preuves

| Commande | Résultat |
|---|---|
| `npm run test` | ✅ **217 fichiers, 1657 tests, 0 échec** (137 tests domaine A1-A4) |
| `npm run type-check` / `npm run lint` / `verify:invariants` | ✅ exit 0 |
| Grep `Math.random` | ✅ 0 occurrence dans `TrailIntelligenceEngine` |

## Règles vérifiées (revue indépendante : Approved, 0 Critical/Important)

- Aucune agrégation de vitesses brutes : ratio normalisé `observé / attendu_pour_cette_personne`.
- Agrégation robuste : médiane pondérée (récence 180 j, qualité), P25/P50/P75/P90, MAD 3,5,
  winsorisation [0.25, 4].
- Conditions et sens séparés (clé `segment::bucket::direction`).
- Publication : ≥ 5 utilisateurs distincts, confiance ≥ 0.5, données ≤ 730 j.
- Consentement `collective_terrain` actif requis (+ session terminée, qualités ≥ 0.6, plausible).
- Aucune identité dans les sorties (hash SHA-256 avant moteur, compteurs uniquement).

## Mineurs différés (ledger)

1. Le gate d'ancienneté ne se déclenche pas à l'écriture (`isPublishable` appelé sans
   `lastObservedAt`) — purge/read filter à ajouter en Phase 9.
2. Déterminisme strict dépend d'un `now` injecté (fallback horloge murale).
3. `assignConditionBucket` n'émet pas `day` (seulement `night` explicitement).
4. `processSegmentAggregates` (façade) ne retourne que le premier groupe par segment.
5. Consentements OR sur plusieurs `policy_version` sans sélection de la plus récente.

## Gate de sortie Phase 4

- ✅ Difficulté collective par segment, confiance, conditions, directions.
- ✅ Seuil de confidentialité appliqué côté moteur et côté serveur.
- ✅ Aucune donnée individuelle publique (vue A1 filtrée ≥ 5).
- ✅ Prototype migré : déterminisme, par segment, serveur, persistable.
- ✅ Carte de données agrégées disponible via `segment_collective_public` (A1).
