# A10 — Rapport de vérification (P0 · Préproduction)

Date : 2026-09-11 · Branche : `audit/adventure-intelligence` · Dernier commit : `e0faa113`
Statut : **code complet — gate BDD en attente (bloquée par l'environnement)**

## Lots livrés

| Lot | Contenu | Commit(s) |
|---|---|---|
| 10.1 | CI : `audit/**`, `verify:icons`, actions épinglées SHA, Node 22, portes base-dépendantes opt-in, job pgTAP opt-in | `a40591e9`, `31458f36`, `f43e4d1b` |
| 10.3 | GPS horodaté (`positions_timed`), fin des intervalles artificiels pour les observations | `ddb7ba67` |
| 10.4 | RPC transactionnelles (`persist_processed_hike_session`, `create_adventure_plan_bundle`), clé complète de rattachement | `9c925856` |
| 10.5 | Lease / retry / `dead_letter` + backfill + claim renforcé | `cc3b1bd5` (backfill `3705dae1`) |
| 10.6 | Map-matching batch PostGIS (`a2_match_track_candidates`), fin du N+1 | `661c56b3` |
| 10.7 | Consentements imposés (`has_active_consent` dernière version), `consent.revoked` sécurisé + purge | `96b682fa`, `3705dae1` |
| 10.8 | `Idempotency-Key`, quota 5/h, génération unique | `247b3680` |
| 10.9 | Profil réel injecté + prédictions persistées (`a10-v1`) | `6eb2f333` |
| 10.10 | Shadow runners + `adventure_shadow_runs` | `b22ff1e5` |
| 10.11 | Montage Hub/Cockpit + E2E Adventure Intelligence | `c7449420` |
| 10.2 | Réparation lots 7-10 (replay), F1 `public_profiles` + sweep 42 fichiers | `668e03e2`, `4f0354bd`, `cfb9f170`, `0618ef70` |

**Revue indépendante** : pipeline/consents → *Rejected narrow* (1 Critique : purge cross-user
falsifiable ; 2 Importants) → corrigé et vérifié (`3705dae1`).

## Preuves

| Contrôle | Résultat |
|---|---|
| `npm test` (worktree) | ✅ 262 fichiers / 1896 tests verts (+1 skip `countries_geo` sans env) |
| `type-check` / `lint` | ✅ exit 0 |
| `npm run build` | ✅ exit 0 (artefacts icônes restaurés) |
| **CI GitHub sur `audit/**`** | ✅ **success** (`f43e4d1`, `0618ef7`, `73e27ce`) — première CI verte de la branche |
| pgTAP / migrations | ⏳ **non exécutés** (voir gate bloquée) |

## F1 — fermé côté code, vérifié en lecture seule sur la production

Lecture seule de `icxyvwzfjbflcbqukpfz` (2026-09-11) : la prod n'a **aucune** migration A
appliquée (dernière : `20260911120000`) et `user_profiles` portait **trois** policies SELECT
larges : `public_read_user_profiles`, `anon_read_profiles_basic`, et **`"Public read user_profiles"`
(dérive hors dépôt)**. Les trois sont supprimées par la migration F1 ; la lecture publique
passe par la vue `public_profiles` (12 colonnes sûres) et le sweep a migré 21 fichiers,
21 conservés (self/write/admin/service-role). `"Users insert own profile"` (dérive prod) est
bornée par `auth.uid() = id` — laissée.

## Gate bloquée : validation BDD

L'URL fournie est **la production** (`db.icxyvwzfjbflcbqukpfz.supabase.co`), pas une copie.
Conformément au protocole du dépôt (et à votre décision explicite « validation sur copie »),
**aucune écriture n'y a été faite**. La voie locale (`supabase start`) échoue : le moteur
Docker Desktop répond `500 Internal Server Error` sur toute l'API (`/v1.55` et `/v1.44`),
indépendamment du projet. La validation (base vide + copie historique + pgTAP) reste donc à
exécuter dès que Docker répond ou qu'une copie est fournie.

## Ce qui reste pour clore a10

1. Redémarrer Docker Desktop (ou fournir une copie) → `supabase db reset` (replay base vide)
   puis `supabase test db` ; restaurer un dump prod pour le scénario historique.
2. Rejouer la requête `pg_policies` post-migration pour confirmer les 3 suppressions.
3. Brancher les variables/secrets de dépôt (`LKDV_E2E_ENABLED`, `LKDV_DB_TESTS_ENABLED`,
   `SUPABASE_TEST_URL/ANON_KEY`, `LKDV_TEST_DATABASE_URL`) pour activer e2e/a11y/visuel/pgTAP en CI.
