# TRIBU — Phase 0 : preuve (sécurité des permissions de groupe)

Date : 2026-09-13 · Branche : `chantier/tribu` · Migrations : `20260913000000` → `20260913030000`

## 1. Avant / après

| Acteur | Avant (prod) | Après (Phase 0) |
|---|---|---|
| `observer` | FOR ALL sur expenses/kit/tasks/polls/album → écriture/suppression libres | Lecture seule ; toute écriture refusée (42501) |
| `member` | Écriture libre sur toutes les lignes ; auto-promotion de rôle ; join avec `role` arbitraire | Self-only (`contribute`) ; lignes d'autrui refusées ; rôle/statut verrouillés |
| `organizer`/`co` | Déjà gestionnaires (rôle) | Mêmes pouvoirs via capacités (`manage_*`), bornés : `invite_members` ne forge ni `organizer` ni `co_organizer` |
| Non-membre | Lecture publique des enfants des groupes publics (`*_select_public_or_member`) + `invitations_public_read_by_token` (tokens/emails) | Aucune lecture enfant ; agrégats publics uniquement (`group_public_card_stats`) |
| Créateur de groupe | Organizer posé par l'app (insert silencieusement ignorable) | Organizer posé par trigger `seed_group_owner_membership` (garanti, tout chemin) |

## 2. Objets créés

- `group_capability` (10 valeurs, dont `contribute`), `group_role_capability_defaults` (40 lignes seed), `group_member_capability_overrides` (+ index `user_id`).
- `group_member_has_capability()` (SECURITY DEFINER, `search_path`, priorité override > délégation > rôle) ; `EXECUTE` réservé à `authenticated`.
- `group_public_card_stats(uuid[])` : agrégats (membres actifs/pending, total dépenses) des seuls groupes `public`.
- Triggers : `enforce_group_role_change` (anti auto-promotion, transitions bornées), `seed_group_owner_membership` (bootstrap), `enforce_expense_payer_member_trg` + `enforce_kit_assignee_member_trg` (cibles membres actifs au changement).
- Durcissement `search_path` : `is_group_member`, `is_group_organizer`, `lkv_can`, `is_moderateur`, `is_group_public`.

## 3. Policies supprimées (par nom, `DROP IF EXISTS`)

- 5 `*_member_all` : `expenses_member_all`, `kit_items_member_all`, `tasks_member_all`, `polls_member_all`, `album_member_all`.
- 7 lectures publiques prod-only : `*_select_public_or_member` (expenses, kit_items, tasks, polls, members, messages, poll_votes).
- `invitations_public_read_by_token` (fuite tokens/emails, table non utilisée par l'app).
- Redéfinitions durcies : `members_join_group` (self-join `role='member'` uniquement), `members_organizer_insert` (`invite_members` + `role='member'`), `votes_*` (appartenance obligatoire, self-only), `messages_*` (`contribute`/`moderate_messages`), `groups_public_read` (pending/active), `groups_organizer_update` (`manage_info`).

## 4. Preuves exécutées

- pgTAP `supabase/tests/database/tribu_permissions.test.sql` : **70/70** (capacités 16, policies 31, intégrité 6, contre-revue 14, inventaire 3).
- Harnais local certifié : `pwsh scripts/db/install-from-baseline.ps1 -Mode install` et `-Mode upgrade` → SUCCÈS (0 échec, 210 versions au ledger, toutes suites pgTAP vertes, F1 vert, EXPLAIN 17 ms).
- Revue + contre-revue agent `database-reviewer` : C1 (bootstrap), I1 (forge organizer/co), I2 (transferts polls/album, cibles), I4 (faux positif test 52) → **tous fermés** ; verdict contre-revue : GO après `role='member'` (fait, 70/70).

## 5. Impacts app

- `src/components/pays/BouteilleALaMer.tsx` : insert organizer manuel supprimé (bootstrap DB) ; compteurs de découverte via `group_public_card_stats` (plus de lecture de lignes).
- Limitation connue acceptée : un manager peut toujours régler la dépense d'un payeur parti (cible inchangée), mais pas la réaffecter à un non-membre.
- Dette notée (hors Phase 0) : affordances UI encore trop larges (toggle tâche, settle, assign kit) → refus RLS silencieux en 0 ligne pour certains acteurs ; à aligner sur les capacités dans les phases UI du lot 1.

## 6. Fichiers

- `supabase/migrations/20260913000000_tribu_enum_align.sql`
- `supabase/migrations/20260913010000_tribu_capabilities.sql`
- `supabase/migrations/20260913020000_tribu_policies.sql`
- `supabase/migrations/20260913030000_tribu_role_integrity.sql`
- `supabase/tests/database/tribu_permissions.test.sql`
- `supabase/tests/database/phase4_coverage.test.sql` (fixture `countries_geo` autoportante, préexistant hors TRIBU)
