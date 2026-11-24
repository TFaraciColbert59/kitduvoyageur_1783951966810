# CLUB_NETTOYAGE_CODE_ET_BDD — Code & Base de Données Supabase

---

## 1. Nettoyage du code effectué et restant

### Effectué dans cette passe
1. **Décomposition du monolithe Admin** : remplacement de `ClubSettingsDrawerBody.tsx` (~1 902 lignes) par `src/components/clubs/drawer/admin/` (15 fichiers modulaires : config déclarative, hook `useClubCapabilities`, shell `ClubAdminDrawerShell`, 12 sous-volets).
2. **Correction Hook conditionnel** (`react-hooks/rules-of-hooks`) dans [ClubCordeeDrawerBody.tsx](file:///Users/fr168256/Documents/Codex/2026-11-11/files-pasted-by-the-user-lkdv/work/lkdv-reference/src/components/clubs/drawer/ClubCordeeDrawerBody.tsx) : déplacement de `visibleMembers` avant le `if (members.length === 0)` → **ESLint `--quiet` à 0 erreur**.
3. **Zéro `any` injustifié** : vérification sur `src/features/clubs/`, `src/app/api/clubs/` et `src/components/clubs/drawer/admin/`.
4. **Suppression des contrôles admin hors-drawer** : retrait des 2 boutons de gestion de salons et du formulaire inline de `ClubSalonsDrawerBody.tsx`.

### Reliquats P2 identifiés (non bloquants, 126 warnings ESLint `no-unused-vars`)
- `ClubSortiesDrawerBody.tsx` : anciens états terrain/météo inutilisés (`terrainReports`, `reportDraft`, `reportCategory`, `weatherWindow`, `upcomingKpis`, `ClubStaggerList`).
- `ClubStatsHubDrawerBody.tsx` : imports inutilisés (`Award`, `RefreshCw`, `ShieldCheck`, `Sparkles`, `Switch`) et `handleToggleStoryPerm` / `savingStoryPermId`.
- `ClubInlineFeed.tsx` : icônes inutilisées (`Eye`, `Pencil`, `X`, `SfIcon`).
- `g02/ClubEventsBoard.tsx` & `ClubLeaderboard.tsx` : variables non utilisées et 2 vieux fichiers de tests (`ClubLeaderboard.test.tsx`, `ClubEventsBoard.test.tsx`).

---

## 2. Audit Supabase (`lekitduvoyageur2` — `icxyvwzfjbflcbqukpfz`)

### Intégrité des données mesurée (SQL en lecture seule)
| Contrôle | Résultat mesuré | Statut |
|---|---|---|
| RLS activé sur les 40 tables `club*` / liées | `40/40` (`rowsecurity = true`) | **OK** |
| Orphelins (`members`, `events`, `channels`, `messages`, `gear`, `loans`) | `0` sur toutes les tables | **OK** |
| Rôles invalides hors `('founder','admin','moderator','volunteer','member')` | `0` | **OK** |
| Adhésions dupliquées `(club_id, user_id)` | `0` | **OK** |
| Advisors Sécurité & Performance Supabase sur `club*` | `0` alerte | **OK** |
| **Compteurs `clubs.members_count` désynchronisés** | **`35` clubs** (`members_count != COUNT(active)`) | **À resynchroniser (P1)** |

### État des migrations `20261124100000` & `20261124100100`
- **Déjà appliqué en base** : `20261124100000_club_admin_v2_enum.sql` (13 valeurs d'enum), tables `club_role_capability_policies`, `club_event_volunteer_shifts`, `club_event_volunteer_assignments`, `club_budget_entries`, colonnes `club_channels`, leurs policies RLS, `club_role_rank`, `club_get_viewer_capabilities`, seeds `club_role_capability_defaults`.
- **À pousser via `supabase db push` (ou SQL Editor)** pour finaliser la synchronisation :
  - `club_actor_effective_role()`
  - `club_has_capability()` (résolution 3 niveaux)
  - `club_role_cap_policies_write` & `club_member_cap_overrides_write`
  - `guard_club_member_privileged_columns()` (cascade DELETE + séparation `role/status/mute`)
  - `club_transfer_ownership()` & `cancel_club_event()`
  - `club_permission_audit` (`target_user_id DROP NOT NULL`, `target_role`, triggers)
  - Policies `club_channels` avec `min_role`
  - Recalcul des compteurs : `SELECT public.lkdv_recount_club_members(id) FROM public.clubs;`
