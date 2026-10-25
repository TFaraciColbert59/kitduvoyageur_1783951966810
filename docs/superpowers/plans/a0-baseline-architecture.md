# A0 — Audit, architecture et baseline — Implementation Plan & Record

> **For agentic workers:** Ce plan est exécuté. Les cases `[x]` sont une preuve
> d'exécution, pas une intention. Phase 0 ne produit **aucune fonctionnalité**.

**Goal:** Comprendre et documenter l'existant réel avant toute création, produire les
décisions d'architecture fondatrices et figer une baseline reproductible.

**Architecture:** Audit croisé code/migrations/tests, consolidation dans deux documents
d'architecture et un jeu d'ADR contraignants. Aucune modification applicative.

**Tech Stack:** Next.js 15 / TypeScript / Supabase / Vitest / pgTAP (hors CI).

**Spec:** `ADVENTURE_INTELLIGENCE_MASTER_PLAN.md` + `roadmap canonique — 10 phases.md` §Phase 0.

## Global Constraints

- Aucune fonctionnalité nouvelle (gate de sortie Phase 0).
- Aucune migration appliquée en production dans cette phase.
- Toute affirmation de l'audit est sourcée (fichier, migration, ou marquée « distant seulement »).
- Les décisions sont contraignantes pour les Phases 1-9 (voir `ADR-AI`).

---

## Livrables

| Livrable | Chemin | Statut |
|---|---|---|
| État des lieux | `docs/architecture/adventure-intelligence-current-state.md` | [x] |
| Décisions | `docs/architecture/adventure-intelligence-decisions.md` (ADR-AI-001..008) | [x] |
| Baseline | ce document (section Résultats) | [x] |

## Résultats de baseline (worktree `worktrees/adventure-intelligence`, commit de base `b67bf401`)

| Commande | Résultat | Détail |
|---|---|---|
| `npm run lint` | ✅ exit 0 | warnings `@typescript-eslint/no-unused-vars` existants (tolérés, non bloquants) |
| `npm run type-check` | ✅ exit 0 | 0 erreur |
| `npm run test` | ✅ exit 0 | **199 fichiers, 1521 tests, 0 échec** (~15 s) |
| `npm run build` | ✅ exit 0 | build Next complet, middleware 98.6 kB |
| `npm run verify:invariants` | ✅ exit 0 | tous les invariants anti-dérive validés |
| `npm run verify:icons` | ✅ exit 0 | 16 noms Heroicon non vérifiables statiquement (tolérés) |
| `npm run test:a11y` | ⏭️ non exécuté en Phase 0 | nécessite le serveur Playwright ; prévu en Phase 7/9 |
| `npm run test:e2e` | ⏭️ non exécuté en Phase 0 | nécessite le serveur ; prévu en Phase 9 |

**Conclusion baseline** : l'arbre de départ est sain (0 échec). Toute régression
ultérieure est imputable aux chantiers, à l'exception des observations ci-dessous.

## Anomalies enregistrées (avant chantier)

1. **Replay à blanc cassé** — lots 7-10 (`20260810212500` → `20260810214000`) :
   dollar-quotes échappés (`AS \$\$`) et `INDEX` inline invalides ; 8 migrations
   `placeholder`. La gate « base vide migrable » de la roadmap **ne peut pas être
   satisfaite en l'état**.
   **Ruling Phase 0** : la validation des migrations se fait sur **copie de la base
   existante** (`supabase db push --db-url` + `supabase test db --db-url`), conformément
   au protocole `docs/reports/MIGRATION_HISTORY_RECONCILIATION.md`. La réparation du
   replay complet est un chantier de durcissement séparé (Phase 9), pas un prérequis.
   *Si ce ruling est faux* : la Phase 1 ne pourra pas prouver la migrabilité depuis zéro ;
   coût = reprise du protocole de validation sur copie, sans impact code.
2. **Policy `public_read_user_profiles`** — possible lecture publique de `user_profiles`
   (email, phone, role, consentement). Créée en `20260713210000:61-65`, jamais
   supprimée par les nettoyages postérieurs. **À vérifier sur copie en Phase 1** ;
   correctif ciblé si confirmé (gate « aucune exposition de données privées »).
3. **Tables distantes sans source** — `trail_metadata`, `trail_scores`, `trail_pois`,
   RPC `get_trail_pois_bbox`. Interdiction de recréation ; introspection obligatoire
   avant toute évolution.

## Contrôle des divergences repo/objects

- Vérifié : `hike_sessions`, `trail_segments`, `hiking_routes`, `trips`, `trip_steps`,
  `trip_collaborators`/`trip_participants`, `crews`/`crew_members`, `ai_jobs`,
  `lkv_events`, `feature_flags` — tous présents avec source.
- Distant seulement : `trail_metadata`, `trail_scores`, `trail_pois`, `get_trail_pois_bbox`
  (documentés §3.2 du current-state).
- FK legacy identifiée : `lkv_events.crew_id → travel_groups` + policy `group_members`.

## Gate de sortie Phase 0

- [x] Architecture réelle documentée et sourcée.
- [x] Duplications identifiées et arbitrées (`trail_segments` unique — ADR-AI-002).
- [x] Décisions fondatrices publiées (ADR-AI-001..008).
- [x] Baseline enregistrée (commandes + sorties + anomalies).
- [x] Aucune fonctionnalité nouvelle produite.

**Verdict Phase 0 : VALIDÉE** (adaptation de la gate « base vide migrable » arbitrée
et documentée — validation sur copie de la base existante).
