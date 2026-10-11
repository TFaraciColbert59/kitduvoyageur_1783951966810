# Progression 2.0 — État d'exécution durable

> Dernière mise à jour : 2026-10-11 (session d'exécution autonome)
> Référence documents : `docs/progression/2.0/economie.md` (montants/règles font autorité),
> `tasks/plan.md` (architecture), `tasks/todo.md` (48 tâches T01–T48).
> Environnements : prod Supabase `icxyvwzfjbflcbqukpfz` (projet `lekitduvoyageur2`), local Docker `127.0.0.1:54322`.
> Branche de travail : `main` (dépôt local) — poussée sur `origin/main`.

## Légende des statuts

- **FAIT** : implémenté dans le code local, non encore intégré à main.
- **TESTÉ** : vérifications exécutées (préciser lesquelles + date).
- **INTÉGRÉ** : commité et poussé sur `origin/main` (PR fusionnée ou push direct de tranche).
- **DÉPLOYÉ** : migration appliquée en prod / Vercel déployé.
- **ACTIVÉ** : feature flag ouvert pour une cohorte réelle.
- **FERMÉ** : implémenté mais volontairement inactif (condition non satisfaite : preuve, population, financement).
- **BLOQUÉ** : impossible avec les moyens disponibles ; condition exacte indiquée.

## Bilan de stabilisation (transition P0)

Le chantier de stabilisation phase1 (I1–I6) est vérifié au 2026-10-11 :

- **I1/I1bis** (verrouillage soldes + idempotence) : appliqués en prod (ledger `20261010140000`, `20261010150000`), prouvés par `docs/phase1/RAPPORT-DEPLOIEMENT-INCR1.md` (0 écart, sondes 401).
- **I2/I4/I5** (isolation démo, réconciliation, normalisation niveaux) : **appliqués en prod** — le ledger distant liste `20261010160000`, `20261010170000`, `20261010180000` (vérifié `supabase migration list --linked`, 2026-10-11). Le journal phase1 les disait « application prod = contrôleur » : écart résolu en faveur du ledger distant.
- **Scan de supervision prod** `scripts/ops/phase1_points_anomaly_scan.mjs` exécuté le 2026-10-11T12:09Z : **0 anomalie** (8 contrôles). État : 111 profils dont 19 démo, 16 lignes `loyalty_history`, 33 `reward_transactions`, 15 outbox toutes `processed`, 15 `progression_events` (chaîne canonique reconstruite), 1 projection de progression = l'unique compte démo crédité (d5451f35…, 9400 pts, is_demo=true), 0 décision canonique.
- Les 15 transactions seed ne sont pas recréditées : la reconstruction canonique ne vise que le compte démo ; les soldes des 110 autres comptes sont inchangés (scan : 0 écart non-démo).
- Protections conservées : trigger profil par colonne, grants révoqués (loyalty_history, orders, RPC legacy), RLS ; aucune suppression.

## P0 — Stabilisation

| Tâche | Statut | Preuves / notes |
|---|---|---|
| T01 — Figer l'état et vérifier la restauration | TESTÉ | Scan prod 2026-10-11 (0 anomalie) ; rapport incr1 ; relevé ledger migrations (2026-10-11). **Restauration isolée rejouée** : schéma `restore_t01` local depuis `backups/phase1-2026-10-10T13-29-31-910Z` — 13/13 compteurs conformes au manifeste ; 10 écarts de fidélité et 1 écart économique constatés = état PRÉ-I1/I4 du snapshot (corrigés en prod, scan 0 écart) ; rapport `docs/phase1/RESTAURATION-2026-10-11.md`, script `scripts/ops/t01_restore_check.sql`. Aucune écriture prod. |
| T02 — Isoler les données de démonstration | DÉPLOYÉ | Migration `20261010160000` en prod ; `is_demo` actif ; 19 comptes démo ; 15 transactions seed portées par l'unique compte démo d5451f35 (9 400 pts), 15/15 outbox `processed`, 15 événements, 0 hors seed, 0 en compte réel. Audit dédié `scripts/audit/phase1_demo_and_projection_scan.mjs` exécuté 2026-10-11 : **0 violation** (exit 0). |
| T03 — Vérifier les parcours de fidélité protégés | TESTÉ | Sondes live 2026-10-11 : 6 routes → 401 sans session (spend/earn/redeem/orders/cancel/progression). Suites `tests/phase1/*` + pgTAP `phase1_balance_lockdown.test.sql`. Constat virement : KDV-2026-1530 et KDV-2026-1687 `confirmed` par virement → garde exigée avant toute émission fidélité future (T38). Doc `docs/phase1/SONDES-PARCOURS.md`. |
| T04 — Observer les traitements de progression | DÉPLOYÉ | Migration `20261011121250` appliquée en prod (dry-run 1 migration) : jobs `progression-outbox-consume` `*/5` (lot 50), `progression-leaderboard-refresh` `*/15` (lot 100), `progression-outbox-purge` `13 4 * * *` (90 j). **Exécutions observées** : outbox 12:20/12:25/12:30 UTC `succeeded`, leaderboard 12:30 `succeeded`. Simulation locale `scripts/ops/t04_outbox_recovery_sim.sql` : pending→failed(attempts=1)→dead(attempts=5)→reprise `processed=1` (1 événement, projection exacte)→rejeu sans double. Sonde santé : `dead=1 → ok=false` détecté. Adaptateurs GET ajoutés (outbox + leaderboard). Écart documenté : rôle de job dédié impossible (pg_cron exige superuser pour un username différent) — confinement par SECURITY DEFINER + REVOKE. |

## P1 — Visibilité et attribution fiable

| Tâche | Statut | Preuves / notes |
|---|---|---|
| T05 — Geler le contrat économique v2 | TESTÉ | Registre gelé `src/features/progression/domain/registryV2.ts` (29 actions, 3 groupes de quotas, plafonds famille 600/120/180/180, jalons 100→3000, date d'effet `2026-11-01T00:00:00Z`, politique retard `lifetime_only` + 14 j). Types v2 dans `types.ts`. Tests `tests/features/progression/registryV2.spec.ts` **13/13** (poids = 1 exactement, caps ordonnés, dix seuils identiques à LEVEL_TIERS, aucune conversion XP/argent, P1 = 7 producteurs). JSON canonique généré par `npx tsx scripts/ops/print_progression_registry_v2.ts` (version=v2, 29 actions, 10 niveaux). Activation fermée (T47). |
| T06 — Intention durable avec la source | TESTÉ | Table interne `progression_award_intents` (unique `(source_type, source_id)`), fonction `enqueue_progression_award_intent` (SECURITY DEFINER, service_role only) et 6 capteurs SQL sur les transitions finales (session traitée, carnet publié, voyage terminé, checklist complète, débrief terrain, avis de lieu) + appel serveur pour la préparation sentier (`prepareActivityFromTrail`). pgTAP `intent_source_atomicity.test.sql` **24/24** : atomicité savepoint, idempotence, rollback source, grants clients refusés. Un bug réel attrapé par le test (enum `trip_status` vs `COALESCE(...,'')`) corrigé. |
| T07 — Consommer et reprendre les intentions | TESTÉ | `intentConsumer.ts` : réservation atomique conditionnelle (2 workers → 1 seul), dispatch des 7 producteurs, refus métier terminal, panne infra → failed/backoff/dead (5), source invalide → refus traçable. Route `/api/cron/progression-awards` (POST/GET, CRON_SECRET) + drain opportuniste borné (2) dans `/api/progression` pour rattraper le backlog au trafic réel. Tests `intentConsumer.spec.ts` **9/9** + `progressionAwardsCron.spec.ts` **3/3** ; suites progression 361 passés. Schéduleur HTTP complet (pg_net disponible 0.20.3, non activé) documenté comme option ops. |
| T08 — Plafonds sous concurrence | TESTÉ | Moteur v2 (migration `20261011125038`) : verrou consultatif par utilisateur, plafonds par date métier (jour UTC, semaine ISO, saison [début, fin)), cap_group partagés, claims `progression_claims` (unique user+group+key, écrits avec la transaction), refus `fait_déjà_réclamé` avant plafonds, garde date future, tie-break de ventilation aligné TS/SQL (priorité fixe Explorer→Préparer→Partager→Entraider). **Deux bugs réels trouvés par les tests** : (1) `SELECT INTO` d'un cap_group absent rendait la liste d'actions NULL → quotas silencieusement désactivés (corrigé + régression pgTAP) ; (2) tie-break SQL alphabétique ≠ TS (corrigé). pgTAP `progression_concurrence_plafonds.test.sql` **23/23** ; **preuve de concurrence réelle** `scripts/ops/t08_concurrency/run.ps1` : A (transaction 3 s) vs B simultanées → **1 gagnant, 1 refus quota, 1 transaction** (verrou + resnapshot confirmés). awardProducer transmet p_claims (10/10 tests). |
| T09 — Renforcer les sept preuves | TESTÉ | `producerHooks.ts` réécrit : durée active par paliers 20/60/120/240 (fini le bonus segments OSM) + garde `plausibleMovement ≥ 0.5` (téléphone immobile) + nouveauté `route_novelty` (+20/saison/parcours, claim atomique, max 150) ; checklist : ≥ 3 contrôles **dus** (`due_offset_days`) tous terminés, items libres inertes ; itinérance : ≥ 2 sessions `processed` sur ≥ 2 jours UTC distincts (checklist/POI seuls exclus) ; débrief : équipements **distincts** (20+2n ≤ 40) et attribution **différée** par capsule SQL de 20 min (migration `20261011142641`, enqueue `p_settle_delay_seconds`) — les appels immédiats (route field-report, cron sessions) retirés ; avis lieu : 15 XP, palier 40 **fermé** (aucune preuve serveur de visite — écart documenté). Tests : `producerHooks.spec` 9/9, `producerHooksCompletion.spec` 16/16, pgTAP intention 25/25 (assertion délai). `PRODUCER_MATRIX.md` actualisé. Reste : `producers.integration.spec` (env-gated) utilise encore les segments dans ses fixtures — à réaligner lors de la prochaine exécution locale complète. |
| T10 — Progression compacte fiable | TESTÉ | Livré session 1 (jamais fusionné alors) : carte visible au chargement puis zéro réel, erreur ≠ zéro avec réessayer ≥ 44 px, cache TanStack par compte `['progression-private', userId, …]` purgé à la déconnexion, invalidation après gain confirmé, garde d'identité des payloads. Preuve `evidence/compact-card.md` (50 tests le 10/10) **rejouée sur l'état fusionné le 11/10 : compactCard 12 + clientquery 6 + awardRequests 20 = 38/38**. Dépendance T09 désormais satisfaite. |
| T11 — Bilan et historique dans la sheet | TESTÉ (backend + intégration UI ; E2E appareil → T43) | `GET /api/progression/history` (session, rate-limit 60/min, curseur `(effective_at,id)`, limit ≤ 50, no-store) + `getProgressionHistory` (événements confirmés, **pending séparé** — jamais célébré, libellés humains, répartition skill_allocations). Tests : `historyService.spec` 6/6, `historyRoute.spec` 6/6. UI : section gains remplacée dans `MaProgressionView` (bloc « Réalisations en cours d'analyse », répartition affichée, « Voir plus » curseur). Deep-links : resolver existant `GET /progression → 307 /hub?panel=points` conservé ; aucun sixième onglet. Corrections : passent par les mêmes événements (aucun producteur de correction actif — documenté). |

## P2 — Missions et distinctions

| Tâche | Statut |
|---|---|
| T12 — Versionner le catalogue de missions | **TESTÉ + DÉPLOYÉ** — domaine : `missionCatalog.ts` (12 modèles versionnés, 8 catégories couvertes ; 4 fermées avec dépendance exacte : T30/T18/T22/T16 ; **aucune promesse de points**), spec 5/5. Données : migration `20261011160108` — table `progression_challenge_models` ; **constat d'application** : la base contient exactement 8 défis (les « 26 anciens » du dossier n'existent plus dans la table — aucune suppression effectuée) ; **5 publiés** (exp_01, prep_01, prep_02, part_01, part_02) vers les modèles du catalogue, **3 conservés non publiés avec raison** (entr_01 T25, entr_02 T32, exp_02 produit ambigu) ; associations historiques intactes. pgTAP `challenge_models_link.test.sql` **15/15** ; prod vérifiée après push (5+3). L'UI n'affichait déjà plus aucun montant de défi (title/progress/unit seulement) — l'écart points_reward reste dans le DTO legacy, à repurger en T14. |
| T13 — Trois missions choisies | **TESTÉ + DÉPLOYÉ (backend)** — migration `20261011160430` : `progression_mission_assignments` + 4 fonctions SECURITY DEFINER (`choose/replace/abandon`, `is_published_mission_model`) ; **limite 3 atomique sous verrou par utilisateur**, seuls les modèles **publiés** (producteurs disponibles) sont choisissables, remplacement/abandon **sans écriture XP ni dette**, opérations scopées `user_id` (inter-comptes refusé). Route `GET|POST /api/progression/missions` (session, rate-limit, zod, identité serveur — un userId du corps est ignoré). pgTAP `mission_assignments.test.sql` **17/17** ; `missionAssignments.spec` **9/9** ; prod vérifiée (table + 4 fonctions). **UI ≤ 3 missions affichées = sous-étape T14** (la carte actuelle montre encore un seul défi — aucun régression). |
| T14 — Avancement depuis les événements | À FAIRE |
| T15 — Unifier les distinctions | À FAIRE |
| T16 — Rythme choisi | À FAIRE |
| T17 — Suggestions en catalogue fermé | À FAIRE |

## P3 — Passeport, carte et matériel

| Tâche | Statut |
|---|---|
| T18 — Découvertes géographiques | À FAIRE |
| T19 — Passeport privé | À FAIRE |
| T20 — Couche carte | À FAIRE |
| T21 — Activités hors randonnée | À FAIRE |
| T22 — Préparation Compas pertinente | À FAIRE |
| T23 — Kit éprouvé | À FAIRE |

## P4 — Contributions utiles

| Tâche | Statut |
|---|---|
| T24 — Corrections utiles | À FAIRE |
| T25 — Réponses acceptées | À FAIRE |
| T26 — Médias dédupliqués | À FAIRE |
| T27 — Contributions éditoriales | À FAIRE |
| T28 — Traces contributives | À FAIRE |
| T29 — Usage matériel / contribution locale | À FAIRE |

## P5 — Coopération et ligues

| Tâche | Statut |
|---|---|
| T30 — Sortie collective | À FAIRE |
| T31 — Tâches collectives | À FAIRE |
| T32 — Cycle d'un prêt | À FAIRE |
| T33 — Intervention matériel | À FAIRE |
| T34 — Actions collectives encadrées | À FAIRE |
| T35 — Classements volontaires | À FAIRE |
| T36 — Ligues sur population suffisante | À FAIRE |

## P6 — Avantages financés

| Tâche | Statut |
|---|---|
| T37 — Inventorier les droits commerciaux | À FAIRE |
| T38 — Fidélité sur encaissement réel | À FAIRE |
| T39 — Bons valorisés serveur | À FAIRE |
| T40 — Parts sur pool financé | À FAIRE |
| T41 — Crédits de lignée | À FAIRE |
| T42 — Administration avec prévisualisation | À FAIRE |

## P7 — Validation et déploiement

| Tâche | Statut |
|---|---|
| T43 — Parcours mobiles réels | À FAIRE |
| T44 — Confidentialité et vie du compte | À FAIRE |
| T45 — Charge et coûts du pipeline | À FAIRE |
| T46 — Compréhension et qualité | À FAIRE |
| T47 — Déploiement par cohortes | À FAIRE |
| T48 — Clôture avec preuves | À FAIRE |

## Décisions et écarts documentés

1. **2026-10-11 — I2/I4/I5 déjà appliqués en prod** : le ledger distant fait foi sur le journal phase1. Aucune réapplication.
2. **2026-10-11 — Divergence de ledger migrations** : des versions distantes hors dépôt existent (placeholders) et des migrations locales ne sont jamais montées en prod (dont `20260917010000_phase1_security_fixes`). Le processus de push utilise le workdir isolé (`scripts/ops/phase1_build_push_workdir.mjs`) qui ne pousse que les migrations ciblées. Ne jamais utiliser `db push` direct.
3. **2026-10-11 — Écart de référence** : le plan daté du 10/10 indique « 31 transactions » ; le relevé prod du 11/10 en compte 33 (2 émissions post-reconnaissance). Aucune action : l'écart est expliqué par les écritures I4.
4. **2026-10-11 — pg_net absent** : la planification SQL via pg_cron ne peut pas appeler HTTP. Les consumers SQL sont planifiés directement (appel de fonction) ; les workers TS restent déclenchables par HTTP externe (Bearer CRON_SECRET) et un adaptateur GET est ajouté pour les planificateurs qui ne font que GET.
5. **Economie fait autorité** pour les montants/quotas ; le moteur v2 (T08) réutilise `award_progression_gain` étendu, pas de second moteur.

## Journal des preuves

| Date | Élément | Résultat |
|---|---|---|
| 2026-10-11T12:09Z | `scripts/ops/phase1_points_anomaly_scan.mjs` (prod, lecture seule) | 0 anomalie (8 contrôles), rapport `backups/phase1-anomaly-scan-2026-10-11T12-09-43-032Z/scan.json` |
| 2026-10-11 | `supabase migration list --linked` | `20261010140000` → `20261010180000` toutes présentes côté distant |
| 2026-10-11 | `supabase db query --linked` (cron.job, extensions) | pg_cron 1.6.4 ; 2 jobs (purge-anon, ops-daily) ; aucun job progression |
| 2026-10-11 | `supabase db query --linked` (état) | 19 profils démo / 111 ; 15 events (1 user démo) ; 15 outbox processed ; 1 projection ; 0 décision ; 33 reward_tx |
| 2026-10-11 | `scripts/audit/phase1_demo_and_projection_scan.mjs` (prod) | 0 violation : seed 15/15 démo, 0 recrédit hors démo, leaderboard_agg sans démo, fidélité non-démo 0 écart |
| 2026-10-11 | Restauration isolée T01 (local Docker, schéma `restore_t01`) | 13/13 compteurs = manifeste ; écarts pré-I1 signalés sans maquillage — `docs/phase1/RESTAURATION-2026-10-11.md` |
| 2026-10-11 | Sondes live T03 (6 routes prod) | 401 sans session ; constat 2 commandes virement `confirmed` — `docs/phase1/SONDES-PARCOURS.md` |
| 2026-10-11 | Jobs pg_cron prod (T04) | `progression-outbox-consume` succès 12:20/12:25/12:30 UTC ; `progression-leaderboard-refresh` succès 12:30 UTC |
| 2026-10-11 | Simulation locale reprise outbox (T04) | failed(1)→dead(5)→recover `processed=1`, 1 événement, projection 40 ; rejeu sans double ; santé `dead→ok=false` |
| 2026-10-11 | `npx vitest run tests/features/progression/registryV2.spec.ts` | 13/13 — contrat v2 gelé |
