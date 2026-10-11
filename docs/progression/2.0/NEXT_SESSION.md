# NEXT_SESSION — reprise de l'exécution Progression 2.0

> Mis à jour : 2026-10-11. Lire d'abord `docs/progression/2.0/ETAT.md` (statuts, écarts, preuves).

## Prochaine action concrète

**T04 — Observer les traitements de progression** (P0, dernier de la phase) :

1. Créer la migration de jobs pg_cron (rôle de job dédié, lots bornés) :
   - `process_progression_outbox(50)` toutes les 5 min ;
   - `purge_progression_outbox(90)` une fois par jour ;
   - refresh classement (`refresh_progression_leaderboard`) toutes les 15 min si fonction SQL vérifiée.
2. Ajouter l'adaptateur GET (Bearer `CRON_SECRET`) à `src/app/api/cron/progression-outbox/route.ts`.
3. Tester en local Docker : exécution du lot, panne simulée (status outbox forcé), reprise sans double.
4. Pousser via workdir isolé (`scripts/ops/phase1_build_push_workdir.mjs` + `supabase db push --linked --workdir …`).
5. Observer en prod (cron.job_run_details) et vérifier la remontée dégradée (`scripts/ops/progression_outbox_health.mjs`).

## Contrôle de réussite

- `select jobname, schedule, active from cron.job` en prod montre les jobs progression.
- `cron.job_run_details` montre ≥ 2 exécutions réussies espacées du schedule.
- Simulation de panne locale : aucun événement dupliqué après reprise (Σ projection = Σ événements).
- `node scripts/ops/progression_outbox_health.mjs` sort 0 avec ≥1 lot traité.

## Suite

Puis T05 (contrat économique v2 — registre versionné, date d'effet, familles, caps, scopes)
selon `tasks/todo.md`, sans attendre de validation externe.
