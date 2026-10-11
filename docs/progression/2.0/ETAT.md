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
| T01 — Figer l'état et vérifier la restauration | TESTÉ | Scan prod 2026-10-11 (0 anomalie) ; rapport incr1 ; relevé ledger migrations (2026-10-11). Restauration isolée : à rejouer sur base locale depuis `backups/phase1-2026-10-10T13-29-31-910Z` (script `scripts/ops/phase1_prod_backup.mjs` produit les dumps). |
| T02 — Isoler les données de démonstration | DÉPLOYÉ | Migration `20261010160000` en prod ; `is_demo` actif ; 19 comptes démo isolés des agrégats (scan 0 écart non-démo) ; 15 transactions seed traçables, non recréditées. Reste : script d'audit dédié `scripts/audit/phase1_demo_and_projection_scan.mjs` (créé cette session). |
| T03 — Vérifier les parcours de fidélité protégés | TESTÉ | Suites `tests/phase1/loyalty-validation.spec.ts`, `checkout-pricing.spec.ts`, `routes.spec.ts`, pgTAP `phase1_balance_lockdown.test.sql` ; sondes prod 401 documentées (incr1 §3). Reste : doc de sondes (créé cette session). |
| T04 — Observer les traitements de progression | EN COURS | pg_cron 1.6.4 installé en prod ; 2 jobs existants (purge-essais-anonymes, ops-daily-report) ; **aucun job progression/classement**. Migration de jobs créée cette session + route cron outbox existante (`src/app/api/cron/progression-outbox/route.ts`, POST, Bearer CRON_SECRET). |

## P1 — Visibilité et attribution fiable

| Tâche | Statut | Preuves / notes |
|---|---|---|
| T05 — Geler le contrat économique v2 | À FAIRE | |
| T06 — Intention durable avec la source | À FAIRE | |
| T07 — Consommer et reprendre les intentions | À FAIRE | |
| T08 — Plafonds sous concurrence | À FAIRE | |
| T09 — Renforcer les sept preuves | À FAIRE | |
| T10 — Progression compacte fiable | À FAIRE | |
| T11 — Bilan et historique dans la sheet | À FAIRE | |

## P2 — Missions et distinctions

| Tâche | Statut |
|---|---|
| T12 — Versionner le catalogue de missions | À FAIRE |
| T13 — Trois missions choisies | À FAIRE |
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
