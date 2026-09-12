# PHASE 3 — Vérification (Finaliser la création de voyage)

**Date :** 2026-09-11
**Branche :** `feat/phase3-autogen-chain` (`c0769076`) → PR #39
**Environnement :** Supabase local Docker + CI GitHub Actions ; **distant = INSUFFICIENT_DATA** (Phase 1 non provisionnée)
**Responsable :** agents BACKEND/FRONTEND + ORCHESTRATOR (revue/PR/merge)
**Décision :** **PASS (périmètre local)**

---

## 1. Ce qui a changé

- **Commande canonique** `createTripFromAutogenIntent` : brief + couches AutoGen → recherche de parcours **réels** (PostGIS borné, index GIST, ≤ 3 candidats) → création du voyage → 1-3 plans persistés (bundle existant) → `attach_adventure_plan_to_trip` → `select_adventure_plan_route` **uniquement si géométrie navigable** → kit/budget/checklist/documents → redirection vers l'aperçu réel.
- **Migration additive** `20260911520000` : `phase3_route_navigable(bigint)` (prédicat exact de la RPC de sélection) + `phase3_search_navigable_routes(lat,lng,radius,terms,limit)` (0 coord + 0 terme ⇒ 0 résultat).
- **Gate navigation unique** (`hikingNavigation.ts`) : le CTA « Démarrer la randonnée » exige `routeNavigable` (calculé serveur, même prédicat que la RPC). Le repli `uniform_from_blueprint` ne peut jamais activer la navigation. Câblé sur tous les points d'entrée réels (`SortieMenu`, `NextActionCard`, `SortieMoment`, `HikingBlocks`).
- **Robustesse** : erreurs typées 400/401/403/409/429/500/503, idempotence par `correlation_id`, compensation best-effort (voyage + plan) sur échec, reprise après statut `failed`.

## 2. Preuves brutes

| Preuve | Résultat |
|---|---|
| pgTAP complet local | **16 fichiers / 292 tests — PASS** (30 nouvelles assertions Phase 3) |
| `npm run test` | **2063 passed / 27 skipped — 0 failed** (287 fichiers) |
| `npm run type-check` / `lint` / `build` | exit 0 / exit 0 / exit 0 |
| E2E local `a13-journey.spec.ts` | **2 passed / 0 failed** (E2E-01 + E2E-02 Phase 3) |
| CI PR #39 | checks requis + snapshots régénérés |

## 3. Gate Phase 3 (doc §Phase 3)

- [x] AutoGen relié à la vraie commande (fini le voyage minimal).
- [x] Brief persisté (`trips.metadata.autogen` : `raw_input`, `brief`, `layers`, `locks`, `pipeline_version`).
- [x] Recherche **d'abord** les randonnées réelles disponibles.
- [x] 1-3 propositions sur géométries réelles ; appel Adventure Intelligence.
- [x] Persistance de la proposition choisie (plan attaché + parcours sélectionné).
- [x] Kit, budget, checklist/documents créés automatiquement (best-effort documenté).
- [x] Redirection vers l'aperçu réel (pas d'écran parallèle).
- [x] 401/409/429/500/503 gérés + reprise.
- [x] Règle géographique appliquée (gate fermé sans tracé réel).
- [ ] E2E **distant** (bloqué Phase 1).

## 4. Limites (honnêtes)

1. Migration non poussée en distant ; sans migration le gate reste **fermé** (fail-safe) et la création aboutit sans parcours.
2. `trip_documents.file_url NOT NULL` → « documents attendus » pris en charge via `trip_checklist_items`.
3. Pas de matérialisation automatique d'un candidat de plan : le plan contient les 3 candidats ; seule la sélection du **parcours** est automatisée.
4. Distance/D+/ETA P50-P90 persistés mais non re-rendus dans le flux (le chantier interdit l'écran parallèle).
5. E2E local uniquement (le `.env.local` pointe un distant ; le run a utilisé la stack locale).

## 5. Risques résiduels

- `phase3_search_navigable_routes` dépend de la qualité des données `hiking_routes` (couverture encore absente → Phase 4).
- Compensation basée sur `getServiceSupabase()` : suppression best-effort du plan uniquement, jamais de lecture croisée.

## 6. Décision

**PASS local** ; distant **INSUFFICIENT_DATA** (Phase 1).
