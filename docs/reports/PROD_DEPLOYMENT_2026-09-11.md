# Déploiement production — 2026-09-11 (DB Adventure Intelligence)

Autorisation explicite : « je veux tout l'écriture en production » (humain, 2026-09-11).
Cible : `icxyvwzfjbflcbqukpfz` (production). Aucune donnée personnelle exportée.

## Pré-contrôles (lecture seule)

| Contrôle | Avant |
|---|---|
| Ledger | 143 versions, dernière `20260911120000` |
| `hike_sessions` / `user_profiles` | 20 / 62 (référence) |
| Policies larges `user_profiles` | **3** (`public_read_user_profiles`, `anon_read_profiles_basic`, dérive `Public read user_profiles`) |
| Vue `public_profiles` | absente |

Sauvegarde **schema-only** avant déploiement : `%TEMP%\prod_pre_deploy_schema.sql` (557 554 octets,
hors dépôt, aucune donnée). Utilisée comme référence de rollback schéma.

## Déploiement

```text
npx supabase db push --db-url <production>
→ Finished supabase db push. (exit 0)
→ 41 migrations appliquées (A1 → A13), toutes additives et idempotentes,
  déjà certifiées install + upgrade sur base reconstruite.
```

## Post-contrôles (lecture seule)

| Contrôle | Après |
|---|---|
| Ledger | **184** versions, dernière `20260911460000` |
| F1 | ✅ **0 policy large** ; `public_profiles` **créée** |
| RPC | `claim_pending_adventure_events`, `a2_claim_pending_sessions`, `a13_segment_geometries`, `a13_materialize_candidate`, `persist_processed_hike_session`, `a5_terrain_reports_near` présentes |
| Tables | `terrain_reports`, `adventure_plans`, `trail_segment_features`, + toutes tables A1/A10/A11/A13 |
| Données utilisateurs | `hike_sessions` 20 / `user_profiles` 62 — **inchangées** |
| Flags domaine | `performance_profile_v2`, `route_prediction_v2`, `collective_intelligence`, `terrain_live`, `*_shadow` → **tous false** |
| Flag actif | `hub_all_enabled` uniquement (flag hub préexistant) |

Note : `hike_sessions.processing_status` par défaut `pending` (colonne additive) — les 20
sessions existantes sont désormais éligibles au traitement GPS via cron ; elles seront
traitées en mode **legacy** (pas d'observations personnelles sans échantillons horodatés),
conforme au design.

## Rollback

- Migrations additives : aucun DROP de l'existant ; désactivation par flags (immédiate).
- Rollback schéma possible sur la base des fichiers A (DROP des seuls objets A) — référence
  `prod_pre_deploy_schema.sql` ; sauvegardes plateforme Supabase (PITR) inchangées.
- Aucune écriture de données utilisateur effectuée (hors données système : 10 buckets de
  conditions, 8 flags OFF, index/matviews).

## Sécurité

- F1 fermé en production : la lecture publique des profils passe désormais par la vue
  `public_profiles` (12 colonnes sûres) ; email/téléphone/rôle/préférences plus exposés.
- Révocations messagerie réappliquées (anon sans EXECUTE sur les 2 RPC).
- Aucun secret commité ; URL de production utilisée uniquement en ligne de commande locale.
