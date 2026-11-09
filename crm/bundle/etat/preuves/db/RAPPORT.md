# RAPPORT — Base de données LKDV Control (task-1)

**Rôle** : base-de-donnees · **Date** : 2026-11-09 · **Projet** : `icxyvwzfjbflcbqukpfz` (production — **aucune** écriture exécutée par ce rôle)

---

## 1. Ce qui est livré

### Migrations (18 fichiers, M00 → M15)

| # | Fichier | Ce qu'il pose |
| --- | --- | --- |
| M00 | `20261109090000_crm_security_fixes.sql` | Vues durcies, `REVOKE` sur la recherche vectorielle interne, refus explicite sur les **41** tables en RLS sans policy |
| M01 | `20261109090100_crm_admin_socle.sql` | Schéma `admin`, rangs, `my_role`, `assert_staff` (aal2), journal **ajout seul**, 14 motifs DSA, `member_notice`, `is_service_context` |
| M02 | `20261109090200_crm_poles_agents.sql` | 7 pôles, appartenances, agents, élévations, `solo_mode`, `can`/`assert_actor`, réécriture de `public.is_admin()` et `public.is_moderateur()`, `agent_proposals` |
| M03 | `20261109090300_crm_commands_registry.sql` | **144** lignes `admin.commands` (générées) + `commands_catalog()` |
| M04 | `20261109090400_crm_requests.sql` | Demandes à deux personnes, empreinte SHA-256, 72 h, `approve`/`reject`/`complete`, `notify_member` |
| M05 | `20261109090500_crm_moderation_states.sql` | État de modération sur **10** tables de contenu, verrou des colonnes, policies **restrictives** de lecture |
| M06 | `20261109090600_crm_account_status.sql` | `account_status`/`suspended_until`/`status_reason`, extension du garde-fou, `account_can_write()`, 22 policies restrictives d'écriture |
| M07 | `20261109090700_crm_moderation_inbox.sql` | File unifiée **14 sources**, tri EX-INBOX-02, `sla_targets`, SOS (ack/close/overdue), `requests_overdue`, `poles_summary` |
| M08 | `20261109090800_crm_sanctions_appeals.sql` | Avertissements gradués (1 an), recours DSA (6 mois), décideur ≠ auteur sauf solo |
| M09 | `20261109090900_crm_members.sql` | `member_360` (coordonnées masquées), notes internes, `reveal_pii` journalisé, `open_identity_document` (SA seul, 15 min) |
| M10 | `20261109091000_crm_support.sql` | `support_messages` (interne/public), assignation, priorité, `support_thread` |
| M11 | `20261109091100_crm_settings_ops.sql` | `app_settings` + briques désactivées, `ops.job_runs` (idempotence), `purge_logs`, `stripe_event_ingest`, `technique_status` |
| M12 | `20261109091200_crm_realtime.sql` | Émission `realtime.send` sur 16 sources, canal privé `admin:*`, publication `community_posts` (EX-RT-04) |
| M13a | `20261109091300_crm_commands_core.sql` | **Moteur** `_run_command`, `_apply`, `run_command`, `run_command_as`, `approve_request`, `undo`, `audit_page` + 51 enveloppes D1–D6 |
| M13b | `20261109091400_crm_commands_d07_d12.sql` | 51 enveloppes D7–D12 |
| M13c | `20261109091500_crm_commands_d13_d19.sql` | 42 enveloppes D13–D19, `elevate`, `settings_edit`, contrôle final 144/144 |
| M14 | `20261109091600_crm_agents_runtime.sql` | `agent_jobs` (claim `skip locked`), `agent_rate` (plafond → pause), `agent_authorize`, `agents_overview`, arrêt, 6 agents amorcés |
| M15 | `20261109091700_crm_cleanup.sql` | Journaux hérités **conservés** (preuve de lecture) + ponts vers `admin.audit_log`, `sync_profile_admin_role` |

Chaque migration a son `supabase/migrations_down/<même nom>.down.sql`.

### Tests (10 fichiers `supabase/tests/database/crm_*.test.sql`)

`crm_socle_rbac` · `crm_journal` · `crm_commands_registry` · `crm_requests_validation` · `crm_moderation_rls` · `crm_account_status` · `crm_appeals` · `crm_inbox` · `crm_realtime_policy` · `crm_migration_rollback`.

Couverture demandée : aal1 refusé · non-équipe refusée · journal immuable · 144 commandes + drapeaux · auto-validation refusée hors solo · empreinte modifiée refusée · agent ne valide jamais · contenu masqué invisible au membre / visible à l'auteur · auteur incapable de se réafficher · suspendu n'écrit plus (et peut signaler) · recours tranché par un autre · rollback.

### Outillage

- `crm/scripts/gen-commands.mjs` — génère M03 depuis `04_CATALOGUE_ACTIONS.md` (même parsing que `gen-catalog.mjs`), `--check` pour la CI.
- `crm/scripts/catalog-diff.mjs` — catalogue ↔ registre ↔ fonctions ↔ tests, JSON + code 1 si écart (`SUPABASE_DB_URL` → vérifie aussi la base).
- `crm/src/types/db.ts` — types `public` + `admin` (tables, vues, 60+ RPC), `npx tsc --noEmit` **exit 0**.

---

## 2. Preuves exécutées (hors production)

Base Postgres locale éphémère (`127.0.0.1:55432`, base `lkdv_shim`), schéma de substitution reproduisant les objets touchés + claims JWT simulés.

| Vérification | Commande | Résultat |
| --- | --- | --- |
| Application M00→M15 | `node /tmp/dbcheck.mjs` | **18/18 OK** |
| Rollback des 18 | `node /tmp/dbdown.mjs` | **18/18 OK** |
| Réapplication après rollback (idempotence) | idem | **18/18 OK** |
| Fumée fonctionnelle (droits, moteur, demandes, undo, SOS, PII, agents, purge) | `node /tmp/smoke.mjs` | **41 ok, 0 échec** |
| pgTAP (10 fichiers, substitut local de l'extension) | `node /tmp/runtests.mjs` | **10/10 verts** |
| Parité catalogue | `node crm/scripts/catalog-diff.mjs` | `ok:true`, 144/144, 0 écart de drapeau |
| Types | `npx tsc --noEmit` (crm) | exit 0 |

Relevés en lecture sur la production (métadonnées seulement) avant écriture : colonnes des 10 tables de contenu, des 8 tables de signalement, `sos_alerts`, `support_tickets`, `orders`, `notifications`, `auth.users`, `app_errors` (`at`, pas `created_at`), `progression_ops.job_runs`; policies des tables cibles; 41 tables RLS sans policy; 6 comptes `super_admin`.

---

## 3. Décisions prises (à porter dans `DECISIONS.md` par l'orchestrateur)

1. **`public_profiles` reste `SECURITY DEFINER`.** Passer en `security_invoker` casserait `/profil/[id]` : la vue est lue par le **navigateur** (`src/lib/supabase/client.ts`), et la RLS de `user_profiles` n'autorise que sa propre ligne. Une policy permissive sur `user_profiles` exposerait `email`/`phone` via PostgREST. Durcissement retenu : `security_barrier`, révocation des droits DML, commentaire explicite. `hub_dashboard_kpis` : `anon` révoqué, vue laissée DEFINER (lecteur = route authentifiée `is_admin()`).
2. **`public.is_admin()` n'inclut PAS les responsables de pôle.** Élargir `is_admin()` aurait donné à 7 pôles la lecture de `user_profiles` (donc e-mail/téléphone) via les policies existantes. Les responsables passent par `admin.is_team_member()` et les commandes de leur pôle. Le garde-fou `user_profiles` accepte désormais « admin **ou** membre d'équipe » pour laisser le moteur agir.
3. **`current_user` n'est pas l'appelant dans une fonction `SECURITY DEFINER`.** Toutes les gardes « tâche serveur » passent par `admin.is_service_context()` (uid nul + rôle JWT `service_role`).
4. **L'auteur d'une action validée est le demandeur**, l'approbateur est `second_approver_id` (`admin.log` accepte un acteur explicite). Sans cela, un recours déposé contre une décision validée aurait été jugé par la mauvaise personne.
5. **`member_ban` est déléguée** : la base écrit `account_status='banned'`, la route fait le bannissement Auth (`banned_until` + révocation) puis `complete_request`.
6. **M15 ne supprime rien** : `src/app/admin/produits/AdminProductsManager.tsx` lit encore `admin_audit_logs`. Les deux journaux hérités restent, avec un pont vers `admin.audit_log`.
7. **`admin.app_settings` + briques** : aucune clé secrète en base, seulement des indicateurs `{enabled, reason, env}`.
8. **`admin.agent_proposals` est créée en M02** (structure), pas en M07 : les fonctions `language sql` de la file ne doivent dépendre d'aucun ordre de fichier.

---

## 4. Ce qui n'est pas couvert

### 4.1 Commandes sans effet porté par le moteur (23/144)

Elles lèvent `0A000` + `hint='domain_pending'` (jamais un faux succès). Il manque **le schéma réel** de leur table cible (non relevé pour ne pas deviner) :

`place_set_verified`, `place_update`, `place_merge`, `place_photo_set`, `map_point_verify`, `story_comment_remove`, `carnet_media_remove`, `club_event_cancel`, `trip_unpublish`, `qa_moderate`, `ama_schedule`, `ama_question_moderate`, `badge_create`, `badge_award_revoke`, `challenge_create`, `season_open_close`, `progression_event_reverse`, `content_feature`, `route_revision_fix`, `gear_function_review`, `affiliate_clicks_view`, `ai_usage_view`, `delivery_failures_view`.

Répartition des 144 : **61** effets réels en base · **53** déléguées à une route serveur (droits vérifiés, journal écrit, demande créée) · **7** validation seule · **23** ci-dessus.

### 4.2 Points non testables ici

- pgTAP réel : extension absente du Postgres local → exécution via un substitut (`/tmp/pgtap_stub.sql`). À rejouer en CI avec la vraie extension.
- Advisors Supabase et `get_advisors` après application : à lancer par l'orchestrateur (rôle `deploiement`).
- Le shim ne reproduit pas les 307 tables de production : la CI avec la baseline assainie reste la référence.

### 4.3 Écarts ouverts

1. **M00 partiel** : `security_invoker` non appliqué à `hub_dashboard_kpis`/`public_profiles` (justifié § 3.1). L'avertissement advisor « security definer view » restera sur `public_profiles`.
2. **`admin.my_context`, `admin.order_detail`, `admin.agent_inbox`** : portées par le backend (`20261109093000_crm_context_agent_inbox.sql`), pas par ce rôle. `db.ts` accepte `p_order_id` **et** `p_order` (transition).
3. **`public.app_settings_public()`** n'est pas encore branchée dans LKDV (le code LKDV n'est pas modifiable par ce rôle).
4. **`admin.undo`** ne couvre que 8 familles de cibles (post, comment, story, place_review, product_review, member, listing, carnet) ; les autres rendent `undo_not_allowed`.
5. **Politiques restrictives de modération** : elles s'ajoutent aux policies existantes ; si une nouvelle policy permissive apparaît côté LKDV sur ces tables, elle élargira la lecture (à contrôler en revue).

---

## 5. Risques et parades

| Risque | Parade déjà en place |
| --- | --- |
| Casser LKDV par une policy trop stricte | Policies **restrictives** uniquement (jamais de `using(true)` en écriture), colonnes ajoutées avec défaut, aucun `DROP COLUMN` |
| Agent qui contourne l'équipe | `agent_authorize` + allowlist `admin.agents.tools` + `_actor_check` + arrêt vérifié à chaque appel |
| Auto-validation | Auteur ≠ approbateur hors solo, empreinte vérifiée, agent refusé |
| Journal falsifié | UPDATE/DELETE/TRUNCATE refusés par déclencheur ; `admin.log` non exécutable par `authenticated` |
| Double exécution | Empreinte SHA-256, statut `pending/approved/executed/failed`, idempotence `stripe_event_ingest`, `ops.job_runs` |
| Coût explosif des agents | `agent_rate` + pause automatique au dépassement (`rate_limited`) |

---

## 6. Fichiers touchés

```
supabase/migrations/2026110909{0000..1700}_crm_*.sql        (18)
supabase/migrations_down/2026110909{0000..1700}_crm_*.down.sql (18)
supabase/tests/database/crm_*.test.sql                     (10)
crm/scripts/gen-commands.mjs
crm/scripts/catalog-diff.mjs
crm/src/types/db.ts
crm/bundle/etat/preuves/db/RAPPORT.md
```

Aucun fichier de `src/` LKDV, aucun `crm/src/app`, `crm/tests`, aucune exécution SQL en production, aucun commit.
