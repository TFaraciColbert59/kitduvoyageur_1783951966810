# PHASE 2 — Vérification (Unifier la chaîne d'identifiants)

**Date :** 2026-09-11
**SHAs :** couche BDD `03595239` (PR #36), couche serveur `c3ed27e5` (PR #37)
**Environnement :** Supabase local Docker + CI GitHub Actions (checks requis verts) ; **distant = INSUFFICIENT_DATA** (Phase 1 non provisionnée)
**Responsable :** agents DATABASE/BACKEND (implémentation) + ORCHESTRATOR (revue, PR, merge)
**Décision :** **PASS (périmètre local)** — distant non certifié à ce stade

---

## 1. Travaux livrés

### 1.1 Couche base de données (PR #36)
- `adventure_plans.selected_route_id bigint → hiking_routes(id) ON DELETE SET NULL` + index partiel.
- `correlation_id uuid` sur les 5 pivots de la chaîne + index (divergence assumée : `text` sur `adventure_engine_runs` A11).
- `community_posts.linked_carnet_id → carnets(id)` (FK additive, gardes d'idempotence ; colonne absente du baseline local par drift historique).
- Table `adventure_plan_route_selections` : piste d'audit mono-active par plan (index unique partiel), RLS (propriétaire/can_read_trip), écriture uniquement via RPC.
- RPC `select_adventure_plan_route(uuid, bigint, uuid)` : SECURITY DEFINER, `search_path` verrouillé, `auth.uid()` requis, propriétaire vérifié sous `FOR UPDATE`, **géométrie navigable exigée** (non nulle, non vide, ≥2 points, `ST_IsValid`), historique mono-actif, propagation `trips.metadata.route_id`.

### 1.2 Couche serveur (PR #37)
- Migration `20260911510000` + RPC `attach_adventure_plan_to_trip(uuid, uuid, uuid)` : double propriété plan/voyage sous verrou, idempotente même voyage, refus de ré-affectation, corrélation préservée.
- Projection `getTripExperience(tripId)` (`src/features/trips/server/getTripExperience.ts`) : chaîne trip → plan → version → route → kit → session → carnet → publication + `correlation_id`, client **session/RLS** (jamais service role), maillons absents = `null` (aucune invention).
- Action `selectAdventurePlanRoute` : Zod (uuid/int positif), `correlation_id` fourni ou généré (`randomUUID`), mapping 400/401/403/500.
- Propagation `correlation_id` : génération Adventure, sessions terrain (+ carnet auto), publication (`linked_carnet_id` + `correlation_id` validés), événement de création de voyage.
- Test d'intégration chaîne complète avec **échecs injectés à chaque étape** (7 scénarios, gate env, SKIP propre sans infra).

## 2. Preuves brutes

| Preuve | Résultat |
|---|---|
| pgTAP complet local | **15 fichiers / 262 tests — PASS** (13/205 avant) |
| Nouvelles assertions pgTAP | 36 (chaîne) + 21 (attach) |
| `npm run type-check` | exit 0 |
| `npm run lint` | exit 0 (0 erreur sur fichiers ajoutés/modifiés) |
| `npm run test` complet | **2042 passed / 27 skipped — 0 failed** (284 fichiers) |
| Intégration locale (7 scénarios) | **7/7 PASS** ; sans env → 7 SKIP |
| CI PR #36 / #37 | tous checks requis verts, merge squash |

## 3. Gate Phase 2

- [x] Chaîne complète créée et relue (`TEST-PHASE2-CHAIN-01`).
- [x] Aucun orphelin après échec injecté (attach non-propriétaire, route sans géométrie, session carnet inexistant, publication carnet inexistant, ré-affectation).
- [x] Projection `TripExperience` RLS (tiers ⇒ `null`).
- [x] `correlation_id` sur les commandes principales.
- [x] Transactions/SECURITY DEFINER pour les sélections et l'attachement.

## 4. Limites

- `create_adventure_plan_bundle` n'expose pas `p_correlation_id` (modification non additive refusée) → corrélation plan écrite par `attach`/`select` ; documenté dans le code.
- `trips` sans colonne `correlation_id` : propagation sans stockage.
- Certification BDD **distante** impossible sans le projet de test (Phase 1).
- Base de production non migrée (décision de déploiement ultérieure).

## 5. Risques résiduels

1. Publications historiques sans carnet (`linked_carnet_id NULL`) encore visibles.
2. Divergence `text`/`uuid` de `correlation_id` entre A11 et les pivots Phase 2.

## 6. Décision

**PASS local** ; **INSUFFICIENT_DATA** pour la certification distante (blocage Phase 1 documenté).
