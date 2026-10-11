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

## État au point de reprise (après T09)

- T09 TESTÉ : preuves renforcées (durée active par paliers + nouveauté claim,
  checklist 3 contrôles dus, itinérance 2 jours, débrief différé 20 min,
  avis lieu 15 seul — palier 40 fermé). Suites : producerHooks 9/9,
  completion 16/16, pgTAP intention 25/25. Migration `20261011142641` à pousser
  en prod (workdir OURS à compléter).
- Dette consignée : `tests/phase1/producers.integration.spec.ts` (env-gated)
  utilise des fixtures `session_segment_passages` — réaligner lors de la
  prochaine exécution locale complète.

## Prochaine action concrète — T10 puis T11 (vérifier l'existant session 1, ne pas refaire)

1. T10 : la carte compacte a été livrée par la session 1 (`ProgressionCompactCard`,
   `client/progressionQuery.ts`, `compactCard.spec` 12 tests, preuve
   `docs/progression/2.0/evidence/compact-card.md`). Vérifier les 3 critères sur
   l'état fusionné : carte visible à 0 XP, erreur ≠ zéro (action réessayer),
   cache isolé par compte + invalidation après gain/déconnexion. Corriger tout
   écart constaté, puis statuer T10 = TESTÉ/DÉPLOYÉ.
2. T11 : intégrer le backend historique (20 tests session 1) plutôt que le
   réécrire : historique paginé (`/api/progression/history`), sheet Ma
   progression avec résolveur d'ouverture (Hub/Compte, anciens deep-links),
   bilan gain confirmé ≠ pending. Contrôles : `sheetFlow.spec` + focus clavier.

## Rappels de continuation

- Ne pas publier le barème v2 (`rules-registry.json` reste `draft_closed`).
- Rappels T09 : avis de lieu 40 = fermé (pas de preuve visite) ; débrief = jamais
  d'appel direct d'attribution (capsule de stabilisation uniquement).

## Règles de continuation

- Ne pas refaire l'audit P0 (preuves datées dans ETAT.md + evidence/).
- Ne pas créer de seconde source de contrat économique : le JSON
  `rules-registry.json` validé par `v2RuleRegistry.ts` fait foi.
- Enchaîner T06→T11 sans validation externe (mandat permanent déjà reçu).
- Mettre à jour ETAT.md après chaque tranche (statut + preuve datée).
