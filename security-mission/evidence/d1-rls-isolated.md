# D1 — Tests RLS réels + migration sur environnement isolé (2026-10-10)

Autorisation : D1 (« vérifications en lecture seule, puis tests RLS réels et migration sur un
environnement isolé »). Aucune donnée réelle : conteneur local jetable `lkdv-rls-pg`.

## 1. Construction du clone (isolé)

- Conteneur `public.ecr.aws/supabase/postgres:17.6.1.141` (image déjà présente localement),
  port 55432, mot de passe local — rôles `anon/authenticated/service_role` et schémas
  `auth/storage/vault/extensions` fournis par l'image, `auth.uid()` lue sur
  `request.jwt.claim.sub` (compatible claims de test).
- Extensions installées dans `public` (le dump prod les y référence) : postgis, pgcrypto, pg_trgm,
  unaccent.
- Application de `supabase/baseline/prod_schema_20260911.sql` (snapshot prod schema-only,
  cutoff `20260911120000`) : **0 erreur** → 195 tables, 570 policies `public`.

## 2. Queue de migrations post-cutoff (vers l'état HEAD)

- 109 fichiers > `20260911120000` rejoués : **107 OK**, 2 échecs (voir §4).
- Effet vérifié : fermeture des profils (`public_profiles` créée, policies larges supprimées),
  hardening phase 1/8, initplan, helper `is_admin` etc. — l'état RLS testé est bien l'état HEAD.

## 3. Matrice RLS réelle (rôles DB réels, claims réels)

| # | Scénario | Attendu | Observé | Verdict |
| --- | --- | --- | --- | --- |
| 01 | anon SELECT `user_profiles` | 0 | **0** | ✅ table fermée |
| 02 | anon SELECT vue `public_profiles` | >0 | 6 | ✅ projection publique |
| 13 | anon SELECT `email` via la vue | erreur colonne | erreur « column email does not exist » | ✅ email non exposé |
| 03 | authenticated A SELECT `user_profiles` | 1 (lui) | **1** | ✅ |
| 04 | admin SELECT `user_profiles` | toutes | 6 | ✅ (fixtures + seeds post-cutoff) |
| 05 | A SELECT `crews` | ses crews + publics | 3 (2 siens + 1 public ; le 3ᵉ est l'auto-crew privé de son propre trip) | ✅ |
| 06 | C (retiré d'un crew privé) SELECT `crews` | 1 (public) | **1** | ✅ retrait effectif |
| 07 | anon SELECT `crews` | 1 (public) | **1** | ✅ |
| 08 | C non-membre SELECT `crew_members` du crew public | — | **1** | ⚠ divergence H-011 **confirmée en réel** (wiring via `lkv_can('crews')`) |
| 09 | C SELECT membres du crew privé | 0 | **0** | ✅ |
| 10/11 | C / anon SELECT `trips` | 1 (public) | **1 / 1** | ✅ |
| 12 | authenticated SELECT `ai_response_cache` | 0 | **0** | ✅ |

Aucune fuite inter-utilisateurs détectée dans ces scénarios ; la divergence H-011 est factuelle et
doit être alignée côté miroir TS ou assumée par produit.

## 4. Deux échecs de la queue (à traiter)

1. `20260925010000_messaging_rls_auth_initplan.sql` — garde anti-drift : « Messaging policy drift:
   storage.objects, storage_select_message_attachments ». Cause : le **baseline ne couvre que le
   schéma `public`** ; les policies Storage (schéma `storage`) n'y figurent pas → le clone a les
   policies Storage par défaut de l'image. **Confirme le gap sauvegarde/restauration** (les objets
   Storage et leurs policies ne sont pas dans le dump) — BACKUP_RESTORE.md mis à jour.
2. `20260929010000_route_persist.sql` — **erreur de type réelle** : `column "payload" is of type
   jsonb but expression is of type text` (insertion via fonction). Le fichier ne s'applique sur
   AUCUNE base en l'état → drift de migration (F-012).

## 5. Drift de replay complet (F-012)

`supabase start` sur base vierge échoue à `20260728160000` : `relation
"public.user_payment_methods" does not exist` — la table n'est créée par AUCUNE migration du dépôt
(seulement un `DROP POLICY`). La chaîne de migrations n'est donc **pas rejouable de zéro** ; la CI
`database-gates` (`supabase db push` sur base de test) ne peut pas être verte sur base vierge.

## 6. Validation isolée de la migration F-008

Mock `auth.users` + `user_profiles` dans le clone, puis application de
`20261009120000_invalidate_seed_credentials.sql` (version corrigée) :

| Compte | Avant | Après | Attendu | Verdict |
| --- | --- | --- | --- | --- |
| `marie.dupont@email.fr` (créé 2026-08-25) | `$2a$10$seedpasswordhash` | **`!`** | fermé | ✅ |
| `late.user@email.fr` (créé 2026-10-01) | `$2a$10$recentrealuser` | inchangé | intact | ✅ |
| `admin.seed@email.fr` (role admin) | `$2a$10$adminhash` | inchangé | intact | ✅ |

NOTICE : « invalidate_seed_credentials: 1 compte(s) de démonstration fermé(s) ». Idempotence et
garde admin/garde temporelle vérifiées.

## 7. Environnement

Conteneur `lkdv-rls-pg` conservé (isolé, aucune donnée réelle) pour les tests suivants ; à supprimer
avec `docker rm -f lkdv-rls-pg`. Scripts : `%TEMP%\opencode\rls-real-tests*.sql`,
`f008-migration-before.sql`.

## 8. Replay complet après correctifs F-012 (2026-10-10)

- 7 fichiers de migrations corrigés (guards `to_regclass`/`to_regprocedure`, DROP avant CREATE POLICY,
  type `badge_progress_result` recréé, ordre `provider`/`payload` corrigé, `carnet_moments` créé dans
  le bon ordre, vues storage gardées, colonne `quantity` ajoutée avant copie legacy).
- **Replay intégral : 252/252 migrations appliquées, 0 échec (26 s)** sur base vierge isolée
  (conteneur supabase/postgres + préparation storage + rôle supabase_admin).
- **Runner CI B8** (`scripts/verify/rls-real-tests.mjs`, Gate DB.3) : **14/14 scénarios PASS** contre
  ce clone (post-replay), exit 0. Opt-in `LKDV_DB_TESTS_ENABLED` + `LKDV_TEST_DATABASE_URL`.
- Note d'environnement : le replay manuel exige (a) un schéma `storage` minimal + fonctions
  storage-api (`foldername/filename/extension`), (b) le rôle `supabase_admin` pour l'ownership,
  (c) des grants par défaut vers anon/authenticated comme sur un projet Supabase standard.
  Ces prérequis sont ceux qu'un `supabase start`/CI fournit nativement.
