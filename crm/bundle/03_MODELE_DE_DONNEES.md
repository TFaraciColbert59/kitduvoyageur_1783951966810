# Modèle de données — LKDV Control

État relevé en base le 8 novembre 2026 (projet `icxyvwzfjbflcbqukpfz`) : 307 tables et vues dans `public`, 176 comptes, RLS active partout sauf `spatial_ref_sys`. Relire l'état réel avant chaque migration (`list_tables`, `pg_policies`) : la base a pu changer depuis.

## 1. Faits établis à respecter

- `public.is_admin()` lit aujourd'hui `user_profiles.role = 'admin'` ; `public.is_moderateur()` lit `admin_roles` (tout rôle). Les 6 comptes concernés sont `super_admin` dans `admin_roles` **et** `admin` dans `user_profiles`. Aucun n'a de facteur MFA vérifié.
- `admin_roles` : `id, user_id (unique), role admin_role {super_admin, admin, moderateur}, created_at, created_by`.
- Déclencheur `guard_user_profile_privileged_columns` sur `user_profiles` : bloque la modification par le membre de `role, trust_score, is_suspended_groups, suspended_from_groups_at, two_fa_enabled, email, loyalty_points, loyalty_level, xp, level` ; laisse passer si `is_admin()`. **À étendre** aux nouvelles colonnes de statut.
- `community_posts` a une policy permissive « Auth update community_posts » : sans verrou, un auteur pourrait remettre `moderation_state` à `visible`. **Verrou obligatoire.**
- Politiques restrictives existantes à imiter : `essai_sans_ecriture_publique` (INSERT, `NOT is_anonymous_session()`) sur ~40 tables.
- Tables de signalement et statuts réels :
  - `post_reports` (`post_id`, `target_type` post|carnet|moment, `status` pending|reviewed|dismissed, `resolved_at`, `resolved_by`)
  - `comment_reports` (`comment_id`, `table_name`, mêmes statuts)
  - `story_reports` (`story_id`, `story_author_id`, mêmes statuts)
  - `club_reports` (`club_id`, `target_type` topic|reply|member, `target_id`, mêmes statuts, **sans** `resolved_at`/`resolved_by`)
  - `group_reports` (`reported_user_id`, `group_id`, `category`, `severity`, `status` libre)
  - `place_reports` (`status` pending|reviewed|resolved|dismissed, `resolution` accepted|rejected, motif obligatoire si rejeté ; fonction existante `resolve_place_report`)
  - `marketplace_reports` (`listing_id`|`transaction_id`, `status` open|resolved, `resolution_note`)
  - `terrain_reports` (`status` pending|confirmed|active|stale|verify|resolved|expired|rejected)
- Journaux existants vides : `admin_audit_log`, `admin_audit_logs` (à remplacer par `admin.audit_log`, puis à supprimer en fin de chantier après vérification qu'aucun code ne les lit).
- `notifications` : `user_id, type, title, message, related_type, related_id, link, group (défaut 'system')`, sans contrainte sur `type`.
- `realtime.send(payload jsonb, event text, topic text, private boolean)` existe ; `realtime.messages` n'a aucune policy.
- Publication `supabase_realtime` : `post_comments, notifications, conversations, messages, conversation_members, message_reactions`.

## 2. Migrations, dans l'ordre

Nommage : `supabase/migrations/2026111XHHMMSS_crm_<sujet>.sql` + `supabase/migrations_down/<même nom>.down.sql`. Chaque migration : idempotente (`if not exists`, `create or replace`), répétée sur base éphémère avec ses tests pgTAP avant la production, advisors relancés après.

| # | Migration | Contenu | Tests pgTAP obligatoires |
| --- | --- | --- | --- |
| M00 | `crm_security_fixes` | `hub_dashboard_kpis` et `public_profiles` → `security_invoker = true` (vérifier que LKDV fonctionne encore : leurs lecteurs actuels) ; `REVOKE EXECUTE … FROM anon` sur les fonctions `SECURITY DEFINER` non destinées au public (liste établie à partir des advisors et de l'usage dans `src/`) ; policy explicite (souvent `using (false)` pour `anon`/`authenticated`) sur les 41 tables RLS sans policy | Les pages LKDV qui lisent ces vues fonctionnent ; `anon` ne peut plus appeler les fonctions retirées |
| M01 | `crm_admin_socle` | Schéma `admin`, `admin.role_rank`, `admin.my_role`, `admin.assert_staff(min_role)` avec contrôle `aal2`, `admin.audit_log` en ajout seul (déclencheurs refusant UPDATE/DELETE/TRUNCATE), `admin.log(...)` interne, `admin.reason_codes` + amorçage, `admin.member_notice`, policy Realtime `admin:%`. Brouillon : `sql/001_socle_admin.sql` | `aal1` refusé ; non-équipe refusée ; journal immuable ; motifs présents |
| M02 | `crm_poles_agents` | `admin.poles` (7), `admin.staff_memberships`, `admin.agents`, `admin.elevations`, `admin.is_solo_mode()`, `admin.can(actor, command)`, `admin.assert_actor(command)` ; migration des rôles `admin`/`moderateur` existants vers des appartenances (aucun aujourd'hui) ; `public.is_admin()` réécrite pour lire `admin_roles` (`super_admin`) + responsables de pôle | Matrice de droits complète (`02_ARCHITECTURE.md` § 5), mode solo on/off |
| M03 | `crm_commands_registry` | `admin.commands` + amorçage des 144 lignes depuis `04_CATALOGUE_ACTIONS.md` | 144 lignes ; chaque ligne a pôle, rôle min, drapeaux |
| M04 | `crm_requests` | `admin.requests` (auteur, commande, paramètres, empreinte, statut pending/approved/rejected/expired/executing/executed/failed, approbateur, `solo` bool), `admin.request_*`, `admin.approve_request`, `admin.complete_request` ; expiration à 72 h | Auto-validation refusée hors solo ; empreinte modifiée → refus ; agent ne valide jamais |
| M05 | `crm_moderation_states` | Colonnes `moderation_state` (`visible`/`hidden`/`removed`, défaut `visible`), `moderated_by`, `moderated_at`, `moderation_reason` sur les 8 tables de contenu (EX-LKDV-01) ; déclencheur de verrou (seule une commande admin, repérée par `set_config('lkdv.admin_cmd','on', true)` **et** l'appartenance à l'équipe, peut les modifier) ; politiques **restrictives** `SELECT` : `moderation_state = 'visible' or auteur = auth.uid() or équipe` | Membre ne voit plus un post masqué ; l'auteur le voit ; l'auteur ne peut pas le réafficher ; LKDV : tests existants verts |
| M06 | `crm_account_status` | `user_profiles.account_status` (`active`/`suspended`/`banned`), `suspended_until`, `status_reason` ; extension du déclencheur `guard_user_profile_privileged_columns` à ces colonnes ; `public.account_can_write()` ; politiques restrictives INSERT `compte_actif_pour_ecrire` sur les tables d'écriture des membres (contenus, messages, avis, signalements exceptés : un suspendu peut toujours signaler) | Suspendu ne publie plus ; suspension expirée → réécrit ; signalement toujours possible |
| M07 | `crm_moderation_inbox` | `admin.moderation_inbox()` (8 sources normalisées, regroupées par cible), `admin.inbox()` (file globale : SOS, tickets, demandes, contributions, alertes, propositions d'agents), compte à rebours par type (délais dans `admin.sla_targets`) | Chaque source apparaît ; ordre correct |
| M08 | `crm_sanctions_appeals` | `admin.strikes` (avertissements, expiration 1 an, tolérance zéro), `admin.appeals` (recours DSA, 6 mois, attribution ≠ décideur sauf solo), notifications avec lien de recours | Échelle graduée ; recours bout en bout |
| M09 | `crm_members` | `admin.member_notes`, `admin.member_360(user_id)` (vue agrégée), consultations sensibles journalisées (`admin.reveal_pii`, `admin.open_identity_document` super admin + motif + 15 min) | Journal écrit à chaque affichage ; pôles/agents refusés pour les documents |
| M10 | `crm_support` | `public.support_messages` (fil, interne/public), statut et assignation des tickets, délais | RLS membre / équipe |
| M11 | `crm_settings_ops` | `admin.app_settings` (TVA, frais de port, seuils, plafond IA, indicateurs de briques en attente de secret), `ops.job_runs`, purge des journaux (3 ans / 1 an) | Lecture par LKDV via fonction publique en lecture seule des réglages non sensibles |
| M12 | `crm_realtime` | Déclencheurs `realtime.send` sur les sources ; présence ; publication de `community_posts` côté LKDV pour EX-RT-04 | Événement reçu par l'équipe, refusé au membre |
| M13 | `crm_commands_<domaine>` (une par domaine 1 à 19) | Les fonctions `admin.cmd_*` du domaine | Un test par commande : droits, motif, effet, journal, notification, temps réel |
| M14 | `crm_agents_runtime` | `admin.agent_jobs`, `admin.agent_rate`, comptes de service des 6 agents (création via API Auth, côté script) | Plafond, arrêt, refus de validation |
| M15 | `crm_cleanup` (dernière) | Suppression de `admin_audit_log` et `admin_audit_logs` si aucun lecteur ; `user_profiles.role` conservée en colonne dérivée (lecture seule) tant que LKDV la lit | Recherche de références dans `src/` = 0 avant suppression |

## 3. Règles d'écriture SQL

- Toute fonction `SECURITY DEFINER` : `set search_path = ''`, noms entièrement qualifiés, `REVOKE ALL ON FUNCTION … FROM public, anon`, `GRANT EXECUTE … TO authenticated` seulement si elle contrôle l'acteur.
- Opérations d'argent et multi-étapes : `SET TRANSACTION ISOLATION LEVEL SERIALIZABLE` (règle LKDV) ou verrou de ligne `FOR UPDATE` sur la commande/le paiement.
- Jamais de `DROP TABLE`, `DROP COLUMN`, `TRUNCATE`, `DELETE` sans `WHERE` sur une table de données métier, sauf M15 avec preuve d'absence d'usage et sauvegarde.
- Chaque migration a son `.down.sql` testé : appliquer → rollback → réappliquer sur la base éphémère.
- Après chaque migration en production : `get_advisors` (security + performance), puis régénération des types.
