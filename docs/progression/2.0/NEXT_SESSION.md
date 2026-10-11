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

## État au point de reprise (après T06+T07+T08)

- T06 TESTÉ : intentions durables (pgTAP 24/24). T07 TESTÉ : consommateur borné
  (12 tests unitaires ; route 401 prouvée en prod ; drain opportuniste actif).
- T08 TESTÉ + DÉPLOYÉ EN PROD (migration `20261011125038`) : verrou consultatif,
  plafonds par date métier, cap_group, claims atomiques, fallback sans cap_groups.
  pgTAP 23/23 + preuve de concurrence réelle 1 gagnant/1 refus/1 transaction
  (`scripts/ops/t08_concurrency/run.ps1`). Scan prod 0 anomalie après déploiement.
- Utilisation active des claims par les producteurs : à faire en T09 (le moteur
  et le passthrough `awardProducer.p_claims` existent déjà).

## Prochaine action concrète — T09 (renforcer les sept preuves existantes)

1. ProducerHooks : durée active réelle (paliers 20/60/120/240) au lieu du bonus
   par segments OSM ; nouveauté de parcours via claim `route_novelty` (même
   gain, +20, max 150) ; `adaptedObjectiveFloor` si objectif adapté vérifié.
2. Checklist : exiger ≥ 3 contrôles dus pertinents (documenter la colonne qui
   distingue « dû » d'« ajout libre » — sinon le dire et fermer la variante).
3. Itinérance (`trip_completed`) : ≥ 2 journées distinctes + 2 réalisations
   liées ; une checklist seule ne prouve plus le voyage.
4. Débrief : attribution à la finalisation (20 + 2×items, cap 40) ; avis de
   lieu : 15 ou 40 si visite contrôlée ; carnet : inchangé (60) + claim média
   pour préparer T26.
5. Tests : `producerHooks.spec.ts` et `producerHooksCompletion.spec.ts` étendus
   (gain nominal, rejeu, refus) + intégration source→intention→décision→outbox.

## Contrôle de réussite T09

- Les sept producteurs ont gain nominal + rejeu + refus testés (vitest vert).
- Aucun changement de montant pour les gains historiques (déjà en décisions).
- `npx tsc --noEmit` ; `npx vitest run tests/features/progression tests/phase1`.

## Rappels de continuation

- Ne pas publier le barème v2 (`rules-registry.json` reste `draft_closed`).
- T10 (carte compacte) est déjà livré session 1 — vérifier avant de refaire.
- T11 backend 20 tests existe session 1 — intégrer plutôt que réécrire.

## Règles de continuation

- Ne pas refaire l'audit P0 (preuves datées dans ETAT.md + evidence/).
- Ne pas créer de seconde source de contrat économique : le JSON
  `rules-registry.json` validé par `v2RuleRegistry.ts` fait foi.
- Enchaîner T06→T11 sans validation externe (mandat permanent déjà reçu).
- Mettre à jour ETAT.md après chaque tranche (statut + preuve datée).
