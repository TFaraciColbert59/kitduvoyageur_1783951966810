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
| T14 — Avancement depuis les événements | **TESTÉ + DÉPLOYÉ** — migration `20261011163920` : `progression_mission_model_actions` (miroir SQL des modèles publiés) + `refresh_progression_mission_progress(user)` idempotent — **réalisations sources distinctes** (événements), fenêtres ever/semaine ISO/saison, **borne à la cible**, `completed_at` = **distinction sans aucun PROGRESSION_AWARD** ; recalcul à la lecture de `GET /api/progression/missions` (échec de recalcul ne bloque jamais la liste). pgTAP `mission_projection.test.sql` **15/15** (un événement → plusieurs vues, aucun doublon d'événement, aucune transaction créée, rejeu stable, fenêtre hebdo, privilèges). UI : section « Missions choisies » dans `MaProgressionView` (≤ 3 actives, avancement n/target, distinction, abandon, ajout depuis les modèles publiés — **aucun montant affiché**). Batterie : vitest **395**, pgTAP **127/127** (6 suites), invariants 9/9 ; prod vérifiée (colonne + fonction + 5 correspondances). |
| T15 — Unifier les distinctions | **TESTÉ + DÉPLOYÉ** — migration `20261011173333` : `progression_badge_links` (clé canonique = nom normalisé, `condition_version`, provenance) ; prod vérifiée : **32 liaisons → 19 clés** (doublons regroupés sans suppression), **10 possessions intactes**, **0 promesse de points restante** (12 `points_reward` remis à zéro — promesses, pas des droits). Service `distinctions.ts` (dédup à l'affichage, possession historique préférée, **aucune écriture**), UI sans montant (`FideliteTab` : rareté au lieu de « +X pts »). pgTAP 10/10 ; spec 5/5 |
| T16 — Rythme choisi | **TESTÉ + DÉPLOYÉ** — migration `20261011173630` : `progression_user_preferences` + `update_progression_preferences` (scopée utilisateur) ; domaine `rhythm.ts` (3 rythmes, semaine ISO UTC, pause = masquage sans perte, aucune pénalité) ; route `GET|POST /api/progression/preferences` ; UI bloc « Rythme (facultatif) » (chips + pause/reprendre). Specs 8/8 ; prod vérifiée (table + fonction) |
| T17 — Suggestions en catalogue fermé | **TESTÉ** — `missionSuggestions.ts` (déterministe d'abord : priorité de catégorie + départage hash stable, exclusions actives/distinctions) + IA **facultative** qui ne peut que réordonner des IDs serveur (hors catalogue/malformé/panne → repli) ; route `GET /api/progression/suggestions` (aucun montant). Spec 7/7 |

## P3 — Passeport, carte et matériel

| Tâche | Statut |
|---|---|
| T18 — Découvertes géographiques | **TESTÉ + DÉPLOYÉ** — migration `20261011174153` : `progression_discoveries` (provenance stricte verified/declared/virtual, unique par entité) + `record_verified_discovery` (seule une réalisation contrôlée pose/remonte 'verified' ; déclaration/virtuel jamais interchangeables) ; dérivation région+pays depuis session traitée via le consommateur, best-effort sans XP. Spec 6/6 ; prod vérifiée |
| T19 — Passeport privé | **TESTÉ** — route `GET /api/progression/passport` (privé, no-store) + `PassportSection` (comptes pays/régions/massifs, provenance lisible, dates, **aucune trace/identité/coordonnée** — payload hostile testé, 20 vignettes max) intégrée à la sheet. Spec 4/4 |
| T20 — Couche carte | **TESTÉ** — route `GET /api/progression/discoveries` (identifiants seulement, 100 bornés) + `DiscoveryMapLayer` (auto-chargée, null à vide/panne, jamais les extras) **montée dans `ExplorerMap`** en dynamic import ssr:false. Spec 4/4 (`discoveryMap.spec.tsx` — extension .tsx au lieu de .ts pour le JSX) |
| T21 — Activités hors randonnée | **TESTÉ** — `activityAdapters.ts` : registre (randonnée seule active ; vélo/urbain/accessible FERMÉS avec critères publiés), résolution multitag → UN adaptateur, clé d'évidence commune `activity:<session>` + claim `activity_completed`, gardes serveur (durée/mouvement/objectif adapté). Spec 6/6. Sources de données des modes fermés = dépendance P3 nommée |
| T22 — Préparation Compas pertinente | **TESTÉ (émission fermée v1)** — `awardCompasPrepared` : voyage hors brouillon + métadonnées `compas` exigées, création vide → refus, aventure liée à un sentier → refus ; **claim d'aventure partagé** `preparation_exclusive:aventure:<tripId>` porté aussi par `trail_prepared` (exclusivité symétrique) ; `compas_prepared` absent du barème v1 → refus `action_non_autorisee` attendu. Specs producerHooks 12/12. Module d'apprentissage éditorial : fermé (registre) |
| T23 — Kit éprouvé | **TESTÉ (émission fermée v1)** — `kitImprovementProof.ts` : diff entre versions persistées (historique), problème terrain (`defaillant`/`manquait`) RÉSOLU dans la version postérieure, **éléments vitaux conservés** (retrait → refus), version inverse/insuffisante → refus, auto-fork exclu, payloads illisibles → fail-closed ; hook `awardKitImproved` avec claim par version. Spec 6/6 |

## P4 — Contributions utiles

| Tâche | Statut |
|---|---|
| T24 — Corrections utiles | **TESTÉ+DÉPLOYÉ** — migration `20261011175418` : résolution SQL (validateur indépendant ≠ auteur, raison de refus obligatoire, une résolution) + `contributionValidation.ts` + hook claim unique `place_report:report:<id>` (correction↔accessibilité). Specs 6/6 ; prod vérifiée |
| T25 — Réponses acceptées | **TESTÉ+DÉPLOYÉ** — migration `20261011175540` : seul le demandeur accepte (auto-réponse et vote seul refusés), 1 réponse acceptée/question, **anti-collusion paire** (≤2/30 j), trace accepted_by/at (recours) ; `answerProof.ts` + route `/api/progression/answers/accept` (identité session) + hook claim par QUESTION. Specs 7/7 ; prod vérifiée |
| T26 — Médias dédupliqués | **TESTÉ (émission fermée v1)** — `mediaClaim.ts` : empreinte SHA-256 normalisée (domaine, query, dérivés évidents) partagée carnet↔lieu ; hook photo (EXIF retiré + visite prouvée par avis, modération/plafond 3-activité = fermeture nommée). Spec 4/4 |
| T27 — Contributions éditoriales | **TESTÉ (fermé v1)** — `editorialProof.ts` : licence permise, langue cible, IA brute refusée, copie non inédite, claim par empreinte (traduction répétée exclue). Spec 8/8 (3 fichiers) |
| T28 — Traces contributives | **TESTÉ (fermé v1)** — `traceProof.ts` : import seul refusé, réalisation contrôlée exigée, clone/déjà inclus exclu, zone sensible expurgée, licence. Spec inclus (8/8 groupés T27-T29) |
| T29 — Usage matériel / contribution locale | **TESTÉ (fermé v1)** — `gearReviewProof.ts` : possédé=emprunté, usage terrain exigé, recopie du débrief exclue, contenu minimal. Spec inclus |

## P5 — Coopération et ligues

| Tâche | Statut |
|---|---|
| T30 — Sortie collective | **TESTÉ (fermé v1)** — `groupPresenceProof.ts` : inscription/auto-check-in refusés, ≥3 participants vérifiés distincts, double activité exclue. Spec 3/3 |
| T31 — Tâches collectives | **TESTÉ (fermé v1)** — `groupTaskProof.ts` : confirmateur distinct, anti-micro-partition, pas de double organisation, claim empreinte. Spec 2/2 |
| T32 — Cycle d'un prêt | **TESTÉ (fermé v1)** — `loanProof.ts` : prêt à soi refusé, ≥24 h, DEUX confirmations, 1 gain/rôle, objet/paire 90 j. Spec 3/3 |
| T33 — Intervention matériel | **TESTÉ (fermé v1)** — `interventionProof.ts` : alerte seule refusée, acte unique entretien/réparation, objet 90 j. Spec 3/3 |
| T34 — Actions collectives encadrées | **TESTÉ (fermé v1)** — `collectiveProof.ts` : accompagnement consenti double-confirmé (paire 1/mois), environnement encadré sans lieu fragile, observation IA seule refusée. Spec 4/4 |
| T35 — Classements volontaires | **TESTÉ+DÉPLOYÉ** — migration `20261011180234` : `competition_opt_in` (défaut faux) + `set_competition_optin` : **retrait EFFECTIF** (suppression immédiate des agrégats), distinct de la confidentialité ; exposé via `/api/progression/preferences` ; 1 km toujours fermé ; démos déjà exclues. pgTAP 8/8 (avec T36) ; prod vérifiée |
| T36 — Ligues sur population suffisante | **TESTÉ+DÉPLOYÉ** — migration `20261011180236` : `progression_league_cohorts` gelées + `create_league_cohorts` (≥20 éligibles RÉELS : non-démo + opt-in ; refus `population_insuffisante` ; re-gel refusé) + domaine `leagues.ts` (ordre déterministe points desc/user asc). pgTAP 8/8 ; prod vérifiée |

## P6 — Avantages financés

| Tâche | Statut |
|---|---|
| T37 — Inventorier les droits commerciaux | TESTÉ | `scripts/audit/economic_entitlements_scan.mjs` 2026-10-11T18:06Z : 3 familles (fidélité, parts, crédits), **0 écart**, 19 démos ; doc `droits-et-couts.md` (chaque droit : nature, source, dérive fermée). |
| T38 — Fidélité sur encaissement réel | DÉPLOYÉ | Migration `20261011180627` en prod (ledger vérifié) : `record_order_encashment_event` (service_role, idempotent par event_id, remboursements partiels bornés par l'encaissé), tables `order_encashment_events` + colonnes `payment_state`/`paid_/refunded_merchandise_cents`. **Triggers legacy d'émission-par-statut retirés en prod** (`legacy_triggers=0` vérifié) — pgTAP `loyalty_payment_lifecycle` 13/13 ; suite `phase1_balance_lockdown` réconciliée (confirmation seule ne crédite plus). **BRANCHEMENT CODE TERMINÉ** : webhook Stripe (`checkout.session.completed` → encaissement carte idempotent `stripe:<session>`, rejeu re-tenté, échec ⇒ événement non traité/Stripe rejoue ; `charge.refunded` → encaissement inverse borné par le débit réel) + confirmation virement admin (`admin-transfer:<orderId>` émis AVANT la transition, échec ⇒ commande reste `pending`) — 35/35 tests dédiés. Reste : clé webhook + rejeu réel en prod (environnement). |
| T39 — Bons valorisés serveur | TESTÉ (fermé) | `voucherValue.ts` (valorisation pure, plafond de dérive), spec 4/4. Publication de catalogue commercial fermée (financement inconnu) — refus explicite, jamais de valeur client. |
| T40 — Parts sur pool financé | TESTÉ (fermé) | `fundedPool.ts` (allocation pure par financement réel), spec 4/4. Distribution fermée tant qu'aucun financement n'est enregistré (aucune émission à vide). |
| T41 — Crédits de lignée | TESTÉ (fermé) | `creatorCredits.ts` (provisoire/confirmé, simulation), spec `creatorCreditView` 3/3. UI section fermée par dépendance (émission v2 close, T42). |
| T42 — Administration avec prévisualisation | DÉPLOYÉ (moteur + UI) | `rulePublication.ts` (simulation sans mutation, diff par version), table `progression_rule_publications` (migration `20261011181159`) en prod ; spec 3/3. **Réévaluation des refus temporaires** (migration `20261011183000` en prod) : un refus de plafond gravé est promu au gain quand le fait est représenté après la fenêtre (hardening 13/13 après réconciliation). **UI ADMIN CONSTRUITE** : `/admin/progression` (RuleSimulator client + route `POST /api/admin/progression/simulate` gardée `is_admin`, rate-limit, no-store, échantillon borné) + entrée sidebar admin — 9/9 tests dédiés (403/400/200/no-store + rendu du rapport/erreur honnête). Publication réelle : opération journalisée distincte, jamais depuis l'UI de simulation. |

## P7 — Validation et déploiement

| Tâche | Statut |
|---|---|
| T43 — Parcours mobiles réels | TESTÉ (web mobile) | Specs e2e exécutées et vertes (`scripts/e2e/progression-mobile.spec.ts` 2/2, `progression-offline.spec.ts` 1/1) contre le serveur local — déplacées sous `scripts/e2e/` (testDir Playwright) : deep-link `/progression → /hub?panel=points`, nav chargée en différé attendue proprement, destinations bornées/orientées, halte réseau sans faux gain. Appareil réel (VoiceOver/TalkBack, Capacitor) NON exécuté — aucun téléphone dans cet environnement ; limite consignée. |
| T44 — Confidentialité et vie du compte | TESTÉ | `privacyLifecycle.spec.ts` 2/2 (401 sans session, no-store sur réponse privée), audits de payloads sans donnée privée, cache privé par session. |
| T45 — Charge et coûts du pipeline | MESURÉ (local) | Migration index `20261011182000` **en prod** (ledger vérifié) ; `scripts/ops/progression_load.mjs` : 200 cycles = 82 ms (0,41 ms/cycle) sur local ; EXPLAIN : requêtes chaudes servies par index. Mesure prod sous charge réelle = non exécutable ici (consignée). |
| T46 — Compréhension et qualité | TESTÉ | `analytics.ts` (payloads assainis, patterns email/coordonnées neutralisés), spec 3/3 ; `mesures.md` (XP ≠ qualité, pilote ≥ 8/10 planifié, non exécuté — population réelle requise). |
| T47 — Déploiement par cohortes | TESTÉ | `docs/progression/DEPLOYMENT.md` §9 (familles de flags indépendantes, paliers conditionnés par preuves, retour arrière sans destruction) + `scripts/ops/progression_rollout_check.mjs` (contrôle lecture seule pré-palier). |
| T48 — Clôture avec preuves | DÉPLOYÉ | `rapport-final.md` ; batterie complète : **vitest intégral 8286/8286** (41 skip gated), tsc 0 erreur, invariants OK, pgTAP **62 fichiers / 1164 tests PASS**, e2e mobile **3/3** (Playwright contre serveur local), **suites env-gated réconciliées 43/43** (producers 9/9 verts — paliers T09 + itinérance 2 jours, countries local seedé prod→local, a14/a15/phase2 séquentiels), ledger prod vérifié (182000 + 183000). Limites déclarées : clé webhook Stripe + rejeu réel, téléphone réel, pilote compréhension, financements. |

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
