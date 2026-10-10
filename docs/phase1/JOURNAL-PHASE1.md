# Phase 1 — Incréments : journal de déploiement

> Branche de chantier : `chantier/phase1-points` (I1-I4) puis `chantier/phase1-incr3-producers`, `chantier/phase1-incr5-6`.
> Projet prod : `icxyvwzfjbflcbqukpfz`. Le détail complet de l'incrément 1 (sauvegardes, méthode de push, sondes) reste `docs/phase1/RAPPORT-DEPLOIEMENT-INCR1.md`.

## 1. Statut des incréments

| Incrément | Contenu | Artefacts | Statut |
|---|---|---|---|
| **I1** — verrouillage des soldes | garde colonnes, fermeture écritures clientes, backfill d'ouvertures, RPC legacy + commandes service_role | migration `20261010140000` (+ down), pgTAP `phase1_balance_lockdown.test.sql` (24/24), `RAPPORT-DEPLOIEMENT-INCR1.md` | **Appliqué en prod et prouvé** (0 écart de solde, RPC anon refusées) |
| **I1bis** — idempotence inter-utilisateurs | sources d'idempotence scopées par utilisateur | migration `20261010150000` (+ down) | **Appliqué en prod** (vérifié au smoke I1) |
| **I2** — isolation démo | `is_demo`, exclusion classements/agrégats, rejeu canonique des transactions seed | migration `20261010160000` (+ down), pgTAP `phase1_demo_isolation.test.sql` | Migration **prouvée en local** ; application prod = contrôleur |
| **I3** — producteurs d'aventure | intégration réelle des 7 producteurs (faits réels + chaîne canonique décision → ledger → outbox → projection) | `tests/phase1/producers.integration.spec.ts` (9/9 avec `PHASE1_PRODUCERS_E2E=1`) | **Prouvé en local** ; aucun changement DB |
| **I4** — réconciliation | purge projections démo sans provenance, provenance comptes économiques démo, cohérence available/lifetime | migration `20261010170000` (+ down), pgTAP `phase1_reconcile_i4.test.sql` | Migration **prouvée en local** ; application prod = contrôleur |
| **I5** — uniformisation | normalisation des `loyalty_level` sur le barème canonique `legacy_loyalty_level_for` | migration `20261010180000` (+ down), pgTAP `phase1_normalize_loyalty_levels.test.sql` | Migration **prouvée en local** ; application prod = contrôleur |
| **I6** — supervision + honnêteté UI | scan d'anomalies nocturne (lecture seule) + bannières +75 conditionnées au succès réel de l'earn | `scripts/ops/phase1_points_anomaly_scan.mjs`, `src/app/rapport-expedition/page.tsx` | **Livré** ; scan à brancher en cron/CI nocturne prod |

## 2. Rollback cumulée

Ordre : **inverse de l'application**, un fichier down par migration, du plus récent au plus ancien.

1. **Application** : redéployer le déploiement Vercel antérieur au merge (un clic tant que l'historique est récent).
2. **Base** — exécuter dans l'ordre :
   1. `supabase/migrations_down/20261010180000_phase1_normalize_loyalty_levels.down.sql` (**DROP FUNCTION seulement** — le niveau est dérivé ; re-corrompre les labels serait absurde) ;
   2. `supabase/migrations_down/20261010170000_phase1_reconcile_i4.down.sql` ;
   3. `supabase/migrations_down/20261010160000_phase1_demo_isolation.down.sql` ;
   4. `supabase/migrations_down/20261010150000_loyalty_idempotence_user_scoped.down.sql` ;
   5. `supabase/migrations_down/20261010140000_phase1_balance_lockdown.down.sql` (restaure garde v1, policies d'origine, supprime les 6 fonctions et les lignes `opening_balance`, **ne touche pas aux profils**).
3. **Données** si nécessaire : restaurations depuis `backups/phase1-*` (JSON + dump SQL data-only, cf. `RAPPORT-DEPLOIEMENT-INCR1.md` §1) ; les sauvegardes de réconciliation I4 sont dans `backups/reconcile-i4-*`.
4. Contrôle post-rollback : `node scripts/audit/phase1_reconcile_balances.mjs` (lecture seule, prod).

## 3. Supervision (I6)

```
node scripts/ops/phase1_points_anomaly_scan.mjs
```

- **Lecture seule** (aucune écriture DB, aucun RPC mutant) ; garde projet prod `icxyvwzfjbflcbqukpfz` dans `.env.local`.
- 8 contrôles : Σ journal vs profil, compte économique vs ledger, projection vs Σ événements (les écarts **démo** sont rapportés à part), outbox `dead`/`failed`, événements sans transaction, transactions de progression sans outbox, décisions awarded sans transaction, projections sans événement.
- Sortie JSON dans `backups/phase1-anomaly-scan-<horodatage>/scan.json` ; **exit 1** dès qu'une anomalie non-démo est détectée → cron/CI nocturne.

## 4. Vérifications locales des incréments

```
npx supabase test db supabase/tests/database/phase1_normalize_loyalty_levels.test.sql
npx supabase test db supabase/tests/database/phase1_reconcile_i4.test.sql
$env:PHASE1_PRODUCERS_E2E='1'; npx vitest run tests/phase1/producers.integration.spec.ts
npm run type-check && npm run lint && npx vitest run
```
