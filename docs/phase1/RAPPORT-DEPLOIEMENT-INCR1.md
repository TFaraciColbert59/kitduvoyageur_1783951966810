# Phase 1 — Incrément 1 : Rapport de déploiement (base de données)

> Date : 2026-10-10 · Branche : `chantier/phase1-points` · Projet prod : `icxyvwzfjbflcbqukpfz`

## 1. Sauvegarde préalable (avant toute écriture)

- Répertoire : `backups/phase1-2026-10-10T13-29-31-910Z/` (non commité, `.gitignore`)
- Export JSON complet + SHA-256 + manifeste des 13 tables critiques : `user_profiles` (111 lignes), `loyalty_history` (6), `loyalty_redemptions` (0), `reward_transactions` (31), `progression_outbox` (15), `progression_events` (0), `user_progression` (9), `user_season_progress` (9), `orders` (3), `progression_legacy_snapshot` (0), `reward_accounts` (111), `kit_reports` (6), `reward_config` (12).
- Dump SQL data-only `public` (hors tables géo lourdes exclues : `places_geo`, `admin_regions_geo`, `spatial_ref_sys`, `route_cache`, `hub_telemetry`) : `data_public_full.sql` (78 269 628 octets).
- Audit pré-flight : `backups/phase1-2026-10-10T13-29-02-822Z/preflight.json`.

## 2. Application de la migration

- Contexte : historiques local/distant **divergents** (31 versions distantes hors dépôt, 27 versions locales non appliquées). Un `supabase db push` direct aurait été destructeur ; refuse d'ailleurs par le CLI (`DbPushMissingLocalError`).
- Méthode employée : workdir de push isolé (`%TEMP%\opencode\phase1-push`) construit par `scripts/ops/phase1_build_push_workdir.mjs` — migrations communes (246) + placeholders vides pour les 31 versions distantes + **uniquement** notre migration en attente. `--dry-run` a confirmé : « Would push: 20261010140000_phase1_balance_lockdown.sql ».
- Commande : `npx supabase db push --linked --skip-vault --workdir <scratch>` → migration appliquée et enregistrée au ledger distant (vérifié : `20261010140000` présent en remote).

## 3. Contrôles post-migration (lecture seule + sondes)

| Contrôle | Avant | Après |
|---|---|---|
| Écarts `loyalty_points` vs Σ `loyalty_history` | **10 écarts** (9 positifs 590→2900, 1 négatif −4380) | **0 écart** |
| Lignes `opening_balance` | 0 | 10 |
| `loyalty_history` (total) | 6 | 16 |
| Soldes non nuls (profils) | 10 | 10 (aucun solde perdu) |
| Autres compteurs (ledger, outbox, projections, commandes) | — | inchangés |

Sondes REST :
- anon → `rpc legacy_loyalty_spend` (arguments complets) ⇒ **401 `42501 permission denied for function`** (fonction présente, verrouillée).
- service → même RPC avec `p_points=0` ⇒ `{"success":false,"error":"invalid_points"}` (exécution OK, **aucune écriture**).
- anon → INSERT `loyalty_history` ⇒ 401 `42501` ; INSERT `orders` ⇒ 401 `42501` (grants révoqués).

## 4. Retour arrière (procédure prête)

1. App : redéployer le déploiement Vercel précédent (un clic, tant que le merge `main` vient d'avoir lieu).
2. Base : exécuter `supabase/migrations_down/20261010140000_phase1_balance_lockdown.down.sql` (restaure garde v1, policies d'origine, supprime les 6 fonctions, supprime les lignes `opening_balance`, ne touche pas aux profils).
3. Restauration de données complète si nécessaire : `backups/phase1-2026-10-10T13-29-31-910Z/` (JSON + SQL).

## 5. Déploiement application (fait)

- Intégration : la ligne locale était en retard de 69 commits sur `origin/main` (chantier Compas). Livraison via une branche linéaire `phase1-live` construite **sur** `origin/main` (17 commits phase1 appliqués, adaptations aux modules live : garde admin `is_admin`, sélecteurs de connexion, infra rate-limit postgres). La ligne locale d'origine est préservée (`chantier/phase1-points`).
- Gates branche finale : `tsc`, `vitest` (7872), invariants anti-dérive (1-9), `build`, intégration locale **56/56** (concurrence, idempotence, earn vérifié, commande pending→confirm, annulation, invariants Σ journal).
- Push `main` : `3b96d58b..08498ef5` (fast-forward) → déploiement Vercel automatique.
- **Smoke production** : `https://kitduvoyageur-1783951966810-ruddy.vercel.app` → home 200 ; `POST /api/loyalty/spend` sans session → **401 `Authentification requise`** (routes phase1 actives) ; DB : `20261010140000` + `20261010150000` appliquées, 10 lignes d'ouverture, **0 écart** de solde, RPC anon refusées (401), RPC service opérationnelles.
- NB : le domaine custom `lekitduvoyageur.com` ne résout pas publiquement (DNS) — vérifications faites sur l'URL Vercel de référence.

## 6. Reste à faire (incréments suivants de la Phase 1)

- Incrément 2 : isolation des données de démonstration (`is_demo`, exclusion classements/agrégats) + rejeu canonique des 15 transactions seed (outbox → `progression_events`).
- Incrément 3 : audit producteurs + tests des 7 producteurs d'aventure.
- Incrément 4 : réconciliation soldes historiques.
- Incrément 5 : uniformisation niveaux/barèmes + badges/saisons/classements + états vides.
- Incrément 6 : supervision, E2E mobile, déploiement progressif/rollback.
