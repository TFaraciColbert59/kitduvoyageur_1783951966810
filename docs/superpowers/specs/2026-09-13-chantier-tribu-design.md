# Chantier TRIBU — Évolution du système Groupe — Design Spec

Date : 2026-09-13 · Branche : `chantier/tribu` (lot 1 : Phases 0→6) puis `chantier/tribu-live` (lot 2 : Phase 7)
Plan d'exécution : `docs/superpowers/plans/2026-09-13-chantier-tribu.md`

## 1. Goal

Sécuriser les permissions des groupes de voyage (`travel_groups`) puis les faire évoluer : pont Club↔Groupe, groupe éclair, délégations temporaires, sondages à quorum, journal d'activité, modèles de checklist, et (lot 2) partage de position live sur la carte.

Règles non négociables (TRIBU-R1..R6) :

| Code | Règle |
|---|---|
| TRIBU-R1 | `/hub` (section groupe + `AdventureSwitcher`) reste l'unique interface de gestion. Toute nouvelle porte d'entrée (Club, Explorer) navigue vers cet écran — jamais de duplication. |
| TRIBU-R2 | Aucune policy `*_member_all` ne subsiste après la Phase 0. |
| TRIBU-R3 | Les rôles existants ne changent pas de nom/sémantique — la couche capacités s'ajoute. |
| TRIBU-R4 | (Lot 2) Partage de position désactivé par défaut, opt-in explicite, indicateur visible, arrêt 1 tap. |
| TRIBU-R5 | Un groupe éclair utilise `travel_groups` + indicateur `is_ephemeral` — pas de table parallèle. |
| TRIBU-R6 | Toute suppression automatique (éclair expiré, positions périmées) passe par un cron `/api/cron/*` documenté, jamais par une suppression synchrone utilisateur. |

Rulings propriétaire :

1. Fermer **toutes** les escalades trouvées par l'audit Phase 0 (pas seulement les 5 `*_member_all`).
2. `member` = self-only ; les capacités donnent des droits sur autrui ; capability de base `contribute` ajoutée (écart assumé au document d'origine).
3. Pont sur `travel_groups` ; `/nouveau-groupe` (legacy `groupes`) jamais réutilisé.
4. Groupe éclair : sélection = co-membres de mes groupes ∪ personnes que je suis (`user_follows`) ∪ recherche par nom (`public_profiles`). Aucun nouveau système social.
5. (Lot 2) Partage de position : table de session `group_live_sessions` + positions rattachées.
6. Ordre : Phases 0→6 (lot 1) puis Phase 7 (lot 2) après revue.

## 2. Écarts document v2 vs réalité (vérifiés fichier:ligne)

- `/hub` n'a **pas** d'onglets « Mes groupes / découverte » : le multi-groupes est le global `AdventureSwitcher` (`src/features/hub/components/AdventureSwitcher.tsx:385`), monté par `HubShell`. `src/components/groupes/MobileGroupesV2.tsx` est du code mort (aucun import). Le champ réel est `groups: HubGroupLite[]` (`src/features/hub/server/getHubAdventureData.ts:37`), pas `myGroups`.
- Découverte publique : `BouteilleALaMer` dans les pages pays (`src/components/pays/BouteilleALaMer.tsx:72`), pas dans le hub.
- Aucune notion « amis » : `user_follows` (dirigé) + co-membres + recherche nom. Pas de table contacts/friend_requests.
- Aucun scheduler versionné (pas de `vercel.json`, pas de pg_cron) : 11 routes `/api/cron/*` déclenchées en externe, protégées par `CRON_SECRET`. Pattern : `src/app/api/cron/cleanup-solo-crews/route.ts`.
- `ActiveAdventure` n'a pas de dates (`nature` + id/slug/title, cookie `lkv_active_adventure`) ; la phase « en cours » se dérive du voyage (`temporalPhaseEngine`) et `travel_groups.departure_date` existe.
- `UnifiedExplorerMap` n'expose aucune injection de couche externe (`onMapReady` sans instance) — lot 2 devra ajouter une API dédiée.
- Prod (baseline `prod_schema_20260911.sql`) contient 7 policies `*_select_public_or_member` (group_expenses/kit_items/tasks/polls/members/messages/poll_votes) basées sur `is_group_public(group_id)` — **absentes des migrations**, à `DROP IF EXISTS` par nom. Le baseline contient aussi `'rejected'` dans `group_member_status` (drift migration) et `votes_member_own` sans vérification d'appartenance.
- `group_invitations` n'est **pas utilisée** par l'app (les invitations réelles = `group_members.status='pending'` + `invite_code`) → la fuite `invitations_public_read_by_token USING(true)` (tokens/emails lisibles publiquement) est supprimée.
- Intégrité : `members_update_own` permet l'auto-promotion de rôle ; `members_join_group` permet `role` arbitraire à l'insert ; `votes_member_own` (INSERT) ne vérifie pas l'appartenance au groupe.
- Harnais DB : Docker Desktop + Supabase local + `pwsh scripts/db/install-from-baseline.ps1 -Mode install|upgrade` (runner TAP réel, F1/EXPLAIN bloquants) ; pgTAP actif dans `supabase/tests/database/` (22 suites). CI opt-in `database-gates`.
- Utilisateurs/fixtures e2e existants : `y-demo@lekitduvoyageur.fr`, groupe seed `00000000-0000-4000-8000-000000000001` (« Tour des Écrins — Équipée »), membres `aa000001-…-0001/0002`.

## 3. Phase 0 — Capacités & policies

### 3.1 Modèle de capacités

```sql
CREATE TYPE public.group_capability AS ENUM (
  'manage_info','manage_members','manage_expenses','manage_tasks','manage_kit',
  'manage_polls','manage_album','moderate_messages','invite_members','contribute'
);
```

- `group_role_capability_defaults(role, capability, allowed)` — matrice seed :

| capability | organizer | co_organizer | member | observer |
|---|---|---|---|---|
| toutes les `manage_*` + `moderate_messages` + `invite_members` | true | true | false | false |
| `contribute` | true | true | **true** | false |

- `group_member_capability_overrides(group_id, user_id, capability, allowed)` — PK composite.
- `is_club_member(p_club_id, p_user_id)` (Phase 1) : `club_members.status='active'`.
- `group_member_has_capability(p_group_id, p_user_id, p_capability)` : `SECURITY DEFINER`, `STABLE`, `SET search_path = public, pg_temp` ; priorité `override > délégation active > défaut de rôle > false` ; appartenance `status='active'` requise.
- Durcissement : réécriture de `is_group_member`, `is_group_organizer`, `lkv_can`, `is_moderateur` avec `SET search_path = public, pg_temp` (corps inchangés, lus depuis le baseline prod).

### 3.2 Policies par commande (matrice)

| Table | SELECT | INSERT | UPDATE | DELETE |
|---|---|---|---|---|
| `group_expenses` | membre | `contribute` + `paid_by∈{NULL, self}` (sinon `manage_expenses` + payeur membre actif) | self (payeur) OU `manage_expenses` | self OU `manage_expenses` |
| `group_kit_items` | membre | `contribute` + `assigned_to∈{NULL, self}` (sinon `manage_kit`) | `manage_kit` OU `assigned_to=self` | idem UPDATE |
| `group_tasks` | membre | `contribute` + `created_by=self` (sinon `manage_tasks`) | `manage_tasks` OU `created_by=self` OU `assigned_to=self` | idem UPDATE |
| `group_polls` | membre | `contribute` + `created_by=self` | `manage_polls` OU `created_by=self` | idem UPDATE |
| `group_poll_votes` | membre du groupe du sondage OU self | self + **membre du groupe du sondage** | self | self |
| `group_album` | membre | `contribute` + `uploaded_by=self` | `manage_album` OU `uploaded_by=self` | idem UPDATE |
| `group_messages` | membre | `contribute` + `user_id=self` | auteur OU `moderate_messages` | idem UPDATE |
| `travel_groups` | inchangé (public / owner / membre / pending) | owner=self | owner OU `manage_info` | owner |
| `group_members` | inchangé | self-join : `user_id=self AND role='member' AND status IN (pending,active) AND (public OR owner)` ; invitation : `invite_members` | self OU `manage_members` (contraint par trigger) | self OU `manage_members` |
| `group_invitations` | organisateur seul (drop du public) | `invite_members` | `invite_members` | `invite_members` |

Suppressions : `expenses_member_all`, `kit_items_member_all`, `tasks_member_all`, `polls_member_all`, `album_member_all` + les 7 `*_select_public_or_member` + `invitations_public_read_by_token`, `DROP POLICY IF EXISTS` par nom (idempotent replay).

### 3.3 Intégrité des rôles (trigger)

`enforce_group_role_change` (BEFORE UPDATE ON group_members) :
- `auth.uid()` NULL (service_role) → laisser passer.
- changement de `role`/`user_id`/`group_id` → exige `manage_members`, sinon exception `42501 role_change_forbidden`.
- self-update `status` → uniquement `pending → active|rejected` ; toute autre transition exige `manage_members`.

## 4. Phase 1 — Pont Club ↔ Hub

- `travel_groups.parent_club_id uuid REFERENCES clubs(id) ON DELETE SET NULL` + index.
- `group_visibility` + valeur `'club_only'` (migration d'énum dédiée, jamais utilisée dans la même migration).
- Policy lecture additionnelle `groups_club_read` : `visibility='club_only' AND parent_club_id IS NOT NULL AND is_club_member(parent_club_id, auth.uid())`.
- Onglet « Groupes » sur `/clubs/[id]` (desktop `ClubVerticalTabs`, mobile `MobileClubDetailView`/`BottomTabBar`) : liste des `travel_groups` du club visibles ; chaque carte **pose le cookie d'aventure** (`setActiveAdventure`) puis navigue `/hub/groupe?onglet=apercu` (TRIBU-R1).
- CTA « Créer un groupe de voyage depuis ce club » → server action `createGroupFromClub` (owner=self, visibility `club_only`, `parent_club_id` ; membres du club volontaires en `pending`) — **pas** `/nouveau-groupe`.
- Retour : badge « Né du club X » dans `/hub/groupe` (données `getGroupeComplet` enrichies).

## 5. Phase 2 — Groupe éclair

- Colonnes `is_ephemeral boolean DEFAULT false`, `auto_dissolve_at timestamptz` + index partiel `WHERE is_ephemeral`.
- Explorer : action « Créer une sortie avec des amis » → sélecteur (co-membres ∪ `user_follows` ∪ recherche `public_profiles`) → server action `createEphemeralGroup` : groupe minimal (`is_ephemeral=true`, destination = zone visible, `auto_dissolve_at` = départ+24h sinon now+7j), owner organizer, invités `pending`, cookie d'aventure posé, retour vers `/hub/groupe`.
- Traitement hub allégé : badge « Sortie du jour », compte à rebours, CTA « Transformer en groupe complet » (`is_ephemeral=false`, `auto_dissolve_at=NULL`).
- Cron `GET /api/cron/cleanup-ephemeral-groups` (`CRON_SECRET`, service role, batch delete `auto_dissolve_at < now()`), documenté (TRIBU-R6).

## 6. Phase 3 — Délégations temporaires

- `group_role_delegations(id, group_id, from_user_id, to_user_id, delegated_role, starts_at, ends_at, created_at)` + index `(group_id, to_user_id, ends_at)`, `(from_user_id)`.
- RLS : SELECT = membre du groupe ; INSERT = `from_user_id=auth.uid()` + membre actif + rôle délégué ≤ rôle détenu (`manage_members` pour déléguer un autre rôle) ; DELETE = `from_user_id=self` OU `to_user_id=self` OU `manage_members`.
- `group_member_has_capability` étendue : branche délégation = `bool_or(d.allowed)` sur délégations actives (`starts_at ≤ now() < ends_at`) du rôle délégué, cible membre actif.
- UI `/hub/groupe` : « Déléguer temporairement mon rôle » (destinataire + durée, défaut fin de sortie) et « Reprendre la main ».

## 7. Phase 4 — Sondages à quorum

- `group_polls.poll_type text DEFAULT 'simple' CHECK (poll_type IN ('simple','quorum_majority','organizer_approval'))`, `quorum_threshold numeric DEFAULT 0.5 CHECK (> 0 AND <= 1)` ; `group_poll_votes.option_index >= 0` check.
- Résolution **calculée à la lecture** (aucun état stocké) dans un module pur `src/lib/queries/pollResolution.ts` :
  - `simple` : gagnant = max voix (égalité → pas de gagnant), adopté informatif.
  - `quorum_majority` : adopté si `voix(gagnant) ≥ ceil(quorum_threshold × membres actifs)`.
  - `organizer_approval` : adopté si ≥1 `organizer`/`co_organizer` actif a voté pour l'option gagnante.
- UI `DecisionsCard` : toggle « Décision importante » (→ `quorum_majority`), affichage adoption/quorum.

## 8. Phase 5 — Journal d'activité

- `group_activity_log(id, group_id, actor_id, action_type, entity_type, entity_id, summary, created_at)` + index `(group_id, created_at DESC)`.
- Peuplé **uniquement** par triggers `AFTER INSERT/UPDATE/DELETE` (fonction `log_group_activity()` `SECURITY DEFINER`) sur `group_expenses, group_tasks, group_kit_items, group_polls, group_album, group_members`.
- RLS : SELECT membre ; aucune policy d'écriture (les triggers `SECURITY DEFINER` écrivent).
- UI : panneau « Journal » (chronologie inversée) dans `/hub/groupe`.

## 9. Phase 6 — Modèles de checklist

- `group_task_templates(id, club_id NULL, title, source CHECK official|club|community, created_by, created_at)` + `group_task_template_items(id, template_id, title, default_role, position)`.
- RLS : lecture = `club_id IS NULL` OU membre actif du club ; écriture `source='club'` = membre actif du club + `created_by=self` (`source='official'` par service role) ; DELETE = auteur OU admin club.
- Suggestion à la création d'un groupe avec `parent_club_id` ; « Appliquer ce modèle » → insert en masse dans `group_tasks` (capacité `contribute`).

## 10. Lot 2 — Phase 7 (résumé, spec dédiée à venir)

`group_live_sessions` (démarrer/arrêter, `expires_at` unique, `stopped_at`) + `group_live_positions` (PK `(session_id,user_id)`, dernière position seule, `expires_at`). Opt-in explicite par sortie (fenêtre `departure_date` ou bascule « Sortie en cours »), indicateur permanent, arrêt 1 tap, expiration par cron `expire-live-positions`, canal Realtime `group:{id}` throttlé 30-60 s, nouvelle API de couche dans `UnifiedExplorerMap` (avatars Liquid Glass, membres seulement), zéro historique de trace. Skills UI + `silent-failure-hunter` obligatoires.

## 11. Definition of Done (lot 1)

- [ ] 0 policy `*_member_all` et 0 `*_select_public_or_member` restantes ; `invitations_public_read_by_token` supprimée.
- [ ] `observer` sans override ne peut écrire nulle part ; comportement organizer/co/member existant préservé (self-only).
- [ ] Trigger d'intégrité : auto-promotion et transitions de statut interdites hors `manage_members`.
- [ ] Pont Club↔Hub fonctionnel (création depuis club → `/hub` ; badge retour) ; RLS `club_only` prouvée.
- [ ] Groupe éclair : création depuis Explorer → `/hub` → conversion OU suppression cron testées.
- [ ] Délégation : fenêtre temporelle respectée (pgTAP).
- [ ] Quorum : 3 types de résolution testés (vitest).
- [ ] Journal : 6 tables → 6 lignes de log (pgTAP) ; aucune écriture applicative.
- [ ] Modèles : publication club → application groupe (e2e).
- [ ] Gates : `tsc`/`lint`/`vitest`/`build` verts (hors 4 suites préexistantes en échec) ; pgTAP local verts ; e2e préparer/depart/atlas non régressés ; `MISSION_LOG.md` ; merge `--no-ff` + push.

## 12. Hors scope

- Système d'amis complet (demandes/acceptation) — chantier séparé.
- Refonte `/hub` en onglets « Mes groupes/découverte » — le `AdventureSwitcher` couvre le besoin (TRIBU-R1).
- Migration du legacy `/nouveau-groupe` (`groupes`) — non réutilisé.
