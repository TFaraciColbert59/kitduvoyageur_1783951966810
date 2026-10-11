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

## Prochaine action concrète — T06 (intention durable avec la source)

1. Migration additive via CLI : table interne `progression_award_intents`
   (user_id, action_type, source_type, source_id, business_effective_at, state,
   attempts, next_attempt_at, derniers faits) — unique par réalisation ;
   référence les preuves existantes sans copier GPS/documents ; accès
   service_role seulement.
2. Brancher les transitions finales des 7 producteurs (`producerHooks.ts`) :
   écriture de l'intention atomique avec la source ; `award-requests` reste un
   déclencheur accélérateur (déjà réparé en session 1).
3. Consommateur borné (T07) : `progression_ops` réutilisé ; décision →
   `award_production_gain` existant ; état pending/dead + reprise.
4. pgTAP : unicité, atomicité/rollback, panne entre source et appel.

## Contrôle de réussite T06

- Source finalisée puis panne avant consommation → intention `pending` unique ;
  consommation ultérieure = une décision, une transaction, un événement.
- `supabase/tests/database/intent_source_atomicity.test.sql` vert (base locale).
- `npx vitest run tests/features/progression/` vert ; type-check vert.

## Règles de continuation

- Ne pas refaire l'audit P0 (preuves datées dans ETAT.md + evidence/).
- Ne pas créer de seconde source de contrat économique : le JSON
  `rules-registry.json` validé par `v2RuleRegistry.ts` fait foi.
- Enchaîner T06→T11 sans validation externe (mandat permanent déjà reçu).
- Mettre à jour ETAT.md après chaque tranche (statut + preuve datée).
