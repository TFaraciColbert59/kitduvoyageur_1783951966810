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

## État au point de reprise (après T12 + T13 backend)

- T12 **TESTÉ+DÉPLOYÉ** (catalogue + liaison `progression_challenge_models`,
  5 publiés / 3 conservés, pgTAP 15/15, prod vérifiée).
- T13 backend **TESTÉ+DÉPLOYÉ** (migration `20261011160430`, route
  `/api/progression/missions`, pgTAP 17/17, spec 9/9, prod vérifiée).
- Batterie du jalon : vitest **395 passés / 9 skipped**, pgTAP **112/112**
  (5 suites), invariants 9/9, `tsc` 0.

## État au point de reprise (après T14)

- T14 **TESTÉ+DÉPLOYÉ** (migration `20261011163920` : projection événements →
  avancement, distinction sans XP ; UI ≤ 3 missions sans montant). Batterie du
  jalon : vitest **395 / 9 skipped**, pgTAP **127/127** (6 suites), invariants 9/9.

## Prochaine action concrète — T37 (inventaire des droits commerciaux), T38–T42 en suite

1. T37 : script `scripts/audit/economic_entitlements_scan.mjs` (agrégats fidélité/parts/crédit boutique, sources, doublons) + doc `docs/progression/2.0/droits-et-couts.md` ; aucune conversion, mapping de continuité.
2. T38 : fidélité sur encaissement réel (état d'encaissement explicite, webhooks dupliqués/désordonnés, remboursements partiels) — gates si le cycle de paiement ne peut être vérifié.
3. T39–T42 : bons valorisés serveur, pool financé (fermé sans financement), crédits de lignée, administration des règles (simulation sans mutation).
4. P7 : T43–T48 (mobile/E2E réel = limite appareil documentée, charge, mesure, cohortes, clôture).

## Contrôle de réussite T37

- Trois familles économiques distinguées, aucune conversion automatique.
- Droits anciens avec mapping/continuité ; budget/pool connus OU activation fermée motivée.
- Rapport daté + revue de cohérence.

## Ancienne action — T13/T14 (faites)

1. Migration additive via CLI : `progression_mission_assignments`
   (user_id, model_id text du catalogue, state `active|replaced|abandoned`,
   period, target_count, created_at, replaced_at…) — **compatibilité** avec
   `user_progression.current_challenge_id` (l'ancien défi reste lisible ;
   migration douce : l'assignation legacy est dérivée à la lecture, rien
   n'est supprimé). Le client ne choisit jamais un model_id hors catalogue.
2. Serveur : étendre `challengeService.ts` — `getUserMissions(userId)`
   (≤ 3 actives, modèles publiés uniquement via `progression_challenge_models`
   où model_id non nul), `chooseMission/replaceMission/abandonMission`
   (remplacement/abandon SANS perte d'XP ni dette ; limites atomiques).
3. Route `GET|POST /api/progression/missions` (session, rate-limit, zod) —
   aucune lecture/affectation d'un autre compte (filtre user_id serveur).
4. Tests : `missionAssignments.spec.ts` (limite 3, remplacement legacy,
   permission inter-comptes) + pgTAP si la contrainte 3 est portée en SQL.
5. UI (après backend vert) : carte de mission de `MaProgressionView` affiche
   jusqu'à 3 missions (titre/avancement/unité uniquement, jamais de points)
   avec actions choisir/remplacer/abandonner.

## Contrôle de réussite T13

- Maximum 3 missions actives ; abandon/remplacement sans dette (aucun
  PROGRESSION_AWARD créé, aucun XP négatif).
- Un compte B ne peut ni lire ni affecter les missions du compte A (tests).
- `npx vitest run tests/features/progression` vert ; `npx tsc --noEmit`.

## État au point de reprise (après T10 + T11)

- T10 TESTÉ : carte compacte vérifiée sur l'état fusionné (38/38, dépendance
  T09 satisfaite). T11 : historique paginé livré (`/api/progression/history`,
  service + route 12 tests ; section gains remplacée dans MaProgressionView
  avec pending séparé et « Voir plus »). E2E appareil (focus, deep-links
  mobiles) → T43. `npm run verify:invariants` vert ; vitest progression+phase1
  **381 passés / 9 skipped**.

## Prochaine action concrète — T12 (catalogue de missions versionné)

1. Créer `src/features/progression/domain/missionCatalog.ts` : modèles
   versionnés (8 catégories du brief : découverte, préparation, progression,
   communauté, coopération, collection, formation, personnelle), chaque modèle
   exposant : critères (action source + seuil), période, provenance, version,
   producteurs réellement disponibles (aujourd'hui les 7 T09 — ne jamais
   promettre un producteur fermé, cf. PRODUCER_MATRIX.md).
2. Migration additive via CLI : réutiliser `progression_challenges`
   (dédupliquer les 26 défis historiques ; marquer provenance/version) —
   aucune nouvelle table si possible ; sinon `progression_mission_templates`.
3. Tests : `missionCatalog.spec.ts` (critères complets, aucune promesse sur
   producteur non disponible, 8 catégories couvertes ou dépendance fermée
   explicite) ; validation JSON cohérente avec `rules-registry.json`.
4. Livrable doc : `docs/progression/2.0/missions.md`.

## Contrôle de réussite T12

- Chaque mission expose critères, période, provenance et version.
- Aucun modèle ne référence un producteur désactivé (comparaison
  PRODUCER_MATRIX « Actifs »).
- `npx vitest run tests/features/progression` vert ; `npx tsc --noEmit`.

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
