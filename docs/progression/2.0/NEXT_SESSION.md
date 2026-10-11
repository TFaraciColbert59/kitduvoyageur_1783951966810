# NEXT_SESSION — reprise de l'exécution Progression 2.0

> Mis à jour : 2026-10-11 (fusion des deux sessions d'exécution). Lire d'abord
> `docs/progression/2.0/ETAT.md` (état consolidé + écarts), `DECISIONS.md`
> (session 1) et `status.json` (statuts machine T01–T48).

## Fusion des deux orchestrateurs

Deux sessions ont travaillé sur ce mandat sans se voir :
- **Session 1** (branche `chantier/progression-v2-p0-contracts`, 10/10 20:53) :
  preuves P0, contrats v2 JSON+zod (`rules-registry.json`, `v2RuleRegistry.ts`),
  T10 carte compacte, T04 (migration jobs + journal `progression_ops.job_runs`
  + réparation retry leaderboard), dossier d'évidence complet.
- **Session 2** (cette session, sur `main`) : T01 restauration isolée, T02 audit
  démo, T03 sondes, T04 migrations appliquées EN PROD (jobs `progression-*`
  observés à 12:20/12:25/12:30 UTC), T05 registre TS (fusionné dans le JSON de
  session 1 puis retiré pour éviter deux sources).

Résolution : la session 1 est retenue comme base de conception (contrat JSON
validé, T10, dossier d'évidence) ; les migrations/applications prod de la
session 2 sont conservées ; une migration additive unique réconcilie les jobs
(`lkdv-progression-*` via `progression_ops.run_job` + journal + retry réparé) et
remplace les jobs simples déjà en prod.

## État au point de reprise (après T06+T07)

- T06 TESTÉ : intentions durables (`progression_award_intents`, 6 capteurs SQL +
  préparation sentier), pgTAP 24/24.
- T07 TESTÉ : consommateur borné (réservation atomique, refus/backoff/dead),
  route `/api/cron/progression-awards`, drain opportuniste borné. 12 tests unitaires.
- Restent pour P1 : **T08 (plafonds sous concurrence + claims)** puis T09 (les
  sept preuves renforcées), T10 (carte compacte — déjà livrée session 1,
  à réconcilier au statut machine), T11 (historique sheet).

## Prochaine action concrète — T08 (plafonds sous concurrence)

1. Étendre l'attribution (`award_progression_gain` v2) : claims unitaires
   (`progression_claims`), caps par date métier (jour UTC, semaine ISO UTC,
   saison bornes [début, fin)), cap_group partagés, verrou par utilisateur,
   décision idempotente retrouvée avant les plafonds.
2. Le registre v2 (`rules-registry.json`) porte déjà cap_group et les plafonds ;
   ne pas activer (status draft_closed) — l'implémentation doit être testée
   avec des versions de test, pas en publiant le barème.
3. Tests : deux transactions concurrentes à la dernière place du quota ;
   replay après plafond ; frontières jour/semaine/saison ; TS/SQL identiques.

## Contrôle de réussite T08

- `supabase/tests/database/progression_concurrence_plafonds.test.sql` vert sur
  base locale (deux sessions réellement concurrentes).
- `npx vitest run tests/features/progression/` vert ; type-check vert.
- Aucune activation de barème : `progression_rules` reste `v1` actif en prod.

## Règles de continuation

- Ne pas refaire l'audit P0 (preuves datées dans ETAT.md + evidence/).
- Ne pas créer de seconde source de contrat économique : le JSON
  `rules-registry.json` validé par `v2RuleRegistry.ts` fait foi.
- Enchaîner T06→T11 sans validation externe (mandat permanent déjà reçu).
- Mettre à jour ETAT.md après chaque tranche (statut + preuve datée).
