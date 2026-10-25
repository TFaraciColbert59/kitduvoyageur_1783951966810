# P0 — État réel et preuves disponibles

Relevé du 10 octobre 2026, 16:43–16:50 UTC (18:43–18:50 Europe/Paris). Environnement : cloud `/workspace/kitduvoyageur_1783951966810`. Audit confié au sous-agent `stabilization_evidence`, lectures de production uniquement. Aucun consumer, attribution, migration ou RPC mutante exécuté en production.

## Contexte du dépôt

- Branche locale initiale `work`, commit `373689c6a` ; modifications initiales : documents `docs/progression/2.0/` et `tasks/` non suivis, appartenant à l'orchestrateur.
- GitHub `main` consulté par API : `f4696770a18b61e528be7bc61f215b15f1c6e5a2`, commit du 10 octobre à 16:43:42 UTC. Ce relevé n'affirme pas que l'application Vercel exécute ce SHA.
- Quatre pipelines sur ce SHA étaient `in_progress` : quality gates `38068926132`, visual `38068926028`, iOS `38068925793`, Lighthouse `38068925779`. Aucun pipeline déclaré vert à ce relevé.
- AGENTS.md, CLAUDE.md, checklist P0, rapports Phase 1, runbooks progression/base locale et sauvegarde lus. Les rapports historiques restent des preuves antérieures, pas des tests réexécutés.
- Node `v24.19.0`, npm et `node_modules` disponibles ; Docker répond. Aucun conteneur ni image Docker au premier relevé. Aucun `psql` ou CLI Supabase local détecté ; pas de sauvegarde historique dans ce checkout avant ce travail.
- GitHub est accessible via `GH_TOKEN`. URL Supabase, clé anon et clé service présentes dans l'environnement ; rôle, référence et expiration du JWT service cohérents avec `icxyvwzfjbflcbqukpfz`. Mot de passe DB, URL SQL, jeton Supabase management, jeton Vercel et secret cron absents de l'environnement shell. Aucun secret imprimé ou écrit dans un fichier d'environnement.

## Relevé production daté

Les sondes Node nécessitent `--use-env-proxy` sur cet environnement. La première sonde sans ce réglage a échoué (`fetch failed` / `ECONNREFUSED`) ; l'essai corrigé a réussi. Cet échec était réseau et ne constitue pas une panne du consumer.

À 16:47:40 UTC, lectures REST paginées et comparaison en mémoire :

| Contrôle | Résultat observé |
|---|---|
| Profils / démo | 111 / 19 |
| Journal fidélité / comptes économiques / transactions | 16 / 111 / 33 |
| Événements / projections lifetime | 15 / 1 |
| Écart profil fidélité vs somme du journal | 0, dont 0 non-démo |
| Écart compte available/lifetime vs transactions économiques | 0, dont 0 non-démo |
| Écart projection vs somme événements | 0, dont 0 non-démo |
| Transactions `seed_ultra_demo` / événements rattachés | 15 / 15 |
| Somme seed / somme événements seed | 9400 / 9400 |
| Entrées démo au classement agrégé | 0 |
| Outbox processed sans événement correspondant | 0 |
| Ouvertures historiques fidélité | 10 |
| Snapshot incr2 / projections sans provenance incr4 / compte sans provenance incr4 | 1 / 8 / 1 |
| Labels fidélité hors barème historique canonique | 0 |

La colonne `is_demo`, les 15 événements canoniques, les snapshots incr4 et la réconciliation démontrent les effets attendus de I2/I4. Les labels sont compatibles avec I5. Ces indices **ne remplacent pas le ledger exact des migrations distantes**, qui n'a pas été lu ici. Les documents Phase 1 disant « I2/I4/I5 local seulement » sont donc à réconcilier avec les effets actuels avant toute réapplication. Aucune nouvelle émission n'a été faite par les sondes.

Sonde réelle `node --use-env-proxy scripts/ops/progression_outbox_health.mjs` : `pending=0`, `failed=0`, `dead=0`, retard outbox=0 ; file leaderboard `pending=9`, `failed=0`, retard maximal **21081 minutes**. `ok=false`, exit 1 : le classement est dégradé selon le seuil de 30 minutes. Ne pas attribuer ce retard aux seules 15 transactions de démonstration.

Smoke HTTP public : URL Vercel de référence `/` retourne **200**. Aucun parcours authentifié, attribution ou paiement testé en production par ce sous-agent.

## Sauvegarde de travail privée

Capture uniquement en lecture, autorisée par l'orchestrateur : `backups/progression-v2-2026-10-10T16-48-07-956Z/` (ignorée par Git). Répertoire `0700`, fichiers `0600`, manifeste SHA-256 vérifié pour les 18 fichiers de tables. Profils minimisés à `id, loyalty_points, loyalty_level, is_demo` ; aucun export auth/users. Les autres tables contiennent les journaux et liens nécessaires à la restauration isolée : fidélité, reward accounts/transactions/config, règles/décisions, outbox/événements/projections/snapshots, saisons/challenges et files/flags.

Comptages complémentaires : règles=1, décisions=0, saisons=1, challenges=8, outbox=15, season projections=1, snapshots=10, leaderboard queue=9, leaderboard aggregates=0, flags=15, redemptions=0.

**Limite :** ces lectures paginées REST ne forment pas une transaction PostgreSQL unique ; le manifeste indique cette limite. Les hachages et droits de fichiers sont vérifiés ; la restauration reste à exécuter par l'orchestrateur sur sa base isolée. Ne pas déclarer T01 terminé avant cette comparaison.

Sauvegarde GitHub existante consultée : run `38038684099` du 10 octobre à 08:40 UTC, statut success mais **aucun artefact**. Les étapes installation PostgreSQL, dump et upload sont **skipped** ; seul le contrôle des secrets a réussi. Ce run ne constitue pas une sauvegarde. La configuration exige `SUPABASE_DB_URL` et `BACKUP_PASSPHRASE` dans les secrets Actions.

## Vérifications réellement exécutées

Commande ciblée :

```sh
npx vitest run tests/phase1/loyalty-validation.spec.ts tests/phase1/checkout-pricing.spec.ts tests/phase1/routes.spec.ts tests/features/progression/progressionOutboxCron.spec.ts tests/features/progression/progressionCronPurge.spec.ts tests/features/progression/producerHooks.spec.ts tests/features/progression/producerHooksCompletion.spec.ts
```

Résultat à 16:46:03 UTC : **7 fichiers, 104 tests réussis**, exit 0. Cette preuve valide les tests applicatifs présents ; elle ne prouve pas les grants PostgreSQL ou les parcours physiques réels.

Contrôle élargi `npx vitest run tests/features/progression tests/phase1/producers.integration.spec.ts` : **4 fichiers échoués, 11 réussis, 1 ignoré ; 17 tests échoués, 153 réussis, 9 ignorés**, exit 1, confirmé à 16:49:54 UTC. Notamment `canonicalRoutes.spec.ts` et `territoryRoute.spec.ts` atteignent une frontière réseau Supabase non mockée : la garde no-network refuse l'appel, le rate limiter fermé renvoie 503. Les mocks de ces fichiers ne couvrent pas `@/lib/rate-limit/routes`, pourtant importé par les routes actuelles. Le test producteurs est ignoré faute de `PHASE1_PRODUCERS_E2E=1`, ce qui n'est pas une réussite d'intégration. Ne pas désactiver la garde réseau pour obtenir des tests verts ; corriger les frontières de tests et vérifier le main courant avant d'intégrer. Les quatre fichiers échoués comprennent des erreurs de garde après test ; ce relevé ne réduit pas ces erreurs aux deux fichiers cités.

Les tests pgTAP Phase 1 et la suite producteurs avec `PHASE1_PRODUCERS_E2E=1` n'ont pas été exécutés par ce sous-agent : aucune base locale n'était disponible au relevé. Types/build/invariants/rollback/restauration ne sont pas revendiqués ici ; l'orchestrateur en est responsable.

## Statut P0 et prochaines actions

| Tâche | Preuve disponible | Condition restante |
|---|---|---|
| T01 | État daté, snapshot privé et hashes, zéro écriture prod | Lire ledger migrations exact, restaurer snapshot isolé et comparer journaux/soldes ; identifier SHA de déploiement et version saine |
| T02 | Effets démo actuels observés, seed traçable 15/15, 0 écarts, 0 agrégat démo | Tests SQL exclusion/rebuild puis rollback sur base isolée, comparer données avant/après |
| T03 | Tests validation/pricing/routes réussis, compteurs réconciliés | Grants et guards SQL, sonde profil authentifiée staging, annulation et virement non encaissé ; aucun paiement réel revendiqué |
| T04 | Routes cron testées, sonde dégradation réelle | Identifier jobs/rôles/schedules actuels ; observer lot et panne/reprise isolés ; remédier aux 9 refresh en attente après restauration et vérification rollback |

Le dépôt planifie des purges via `pg_cron` (`20261008190000`), mais aucune planification du consumer progression ou refresh leaderboard n'a été trouvée dans les migrations examinées. `vercel.json` ne contient que la région ; les runbooks du 20 septembre indiquent explicitement « planification non configurée ». Cela établit l'état des fichiers, pas celui de `cron.job` distant.

Travail immédiatement réalisable : base Supabase/PostgreSQL isolée depuis baseline puis migrations strictes ; restauration de la capture ; suites pgTAP et intégration sept producteurs avec URL locale ; simulation interruption/reprise ; vérification des protections et des descentes **sur base isolée uniquement**. L'accès SQL/management absent du shell peut être disponible via le connecteur Supabase de l'orchestrateur. Le classement à 1 km, les cohortes commerciales sans preuve de financement et la validation appareils réels restent fermés ou non revendiqués.
