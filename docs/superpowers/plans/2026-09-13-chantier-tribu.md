# Chantier TRIBU — Implementation Plan (lot 1 : Phases 0→6)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Sécuriser les permissions des groupes (capacités + policies par commande), puis livrer le pont Club↔Hub, le groupe éclair, les délégations temporaires, les sondages à quorum, le journal d'activité et les modèles de checklist.

**Architecture:** Une couche de capacités additive (`group_capability` + defaults + overrides + délégations) remplace les policies `*_member_all` par des policies par commande (self-only pour `member`, capability pour autrui). Les fonctionnalités s'appuient ensuite sur `travel_groups` existant (TRIBU-R1/R5), avec nettoyages par crons documentés (TRIBU-R6).

**Tech Stack:** Postgres 17 / Supabase (RLS, pgTAP local via `scripts/db/install-from-baseline.ps1`), Next.js 15 App Router, Zod, Vitest, Playwright.

**Spec:** `docs/superpowers/specs/2026-09-13-chantier-tribu-design.md`

## Global Constraints

- WIP propriétaire **jamais** stagé : `src/app/hub/[section]/page.tsx`, `src/features/hub/components/HubRealtimeRefresh.tsx`, `docs/atlas/captures/*.png`, `docs/depart/*.png`, `docs/preparer/*.png`, fichiers v16/untracked racine — staging explicite uniquement.
- Migrations **additives** + `DROP POLICY IF EXISTS` par nom ; jamais `DROP TABLE`/`CASCADE` sur l'existant.
- `ALTER TYPE … ADD VALUE` : uniquement dans une migration dédiée, jamais utilisée dans la même migration.
- Gardes design UI : tokens `--lkv-*` + `.glass*` uniquement (interdits `rose-*`, `sand-*`, `forest-*`, `bg-white/60|90`, `dark:`) ; jamais `prompt (` dans un commentaire.
- TRIBU-R1 : aucune UI de gestion hors `/hub` (les nouvelles portes d'entrée naviguent) ; TRIBU-R6 : suppressions auto = crons.
- Gates par task : `npx tsc --noEmit` 0 ; `npx vitest run` (4 suites préexistantes en échec tolérées) ; `npm run lint` 0 erreur.
- DB : migrations appliquées en local via `pwsh scripts/db/install-from-baseline.ps1 -Mode upgrade` (runner TAP réel), déploiement prod `npx supabase db push --linked` en fin de lot après revues.
- Un commit par task, message imposé.

---

## Section 1 — Phase 0 (sécurité)

### Task 1: M0 alignement énum + M1 capacités

**Files:**
- Create: `supabase/migrations/20260913000000_tribu_enum_align.sql`
- Create: `supabase/migrations/20260913010000_tribu_capabilities.sql`
- Test: `supabase/tests/database/tribu_permissions.test.sql` (créer — section 1/4 capacités)

**Interfaces:**
- Produces: `public.group_capability` (10 valeurs), `public.group_role_capability_defaults`, `public.group_member_capability_overrides`, `public.group_member_has_capability(uuid, uuid, group_capability) → boolean` (priorité override > défaut rôle > false).

- [ ] **Step 1: Test rouge** — fixture A (organizer), B (member), C (observer) + groupe G. Assertions : `group_member_has_capability(G,A,'manage_members')` vrai ; `(G,B,'contribute')` vrai et `(G,B,'manage_members')` faux ; `(G,C,'contribute')` faux ; `(G, non-membre, tout)` faux. Run `pwsh scripts/db/install-from-baseline.ps1 -Mode upgrade` → FAIL attendu (objets absents).
- [ ] **Step 2: Implémenter M0** — `ALTER TYPE public.group_member_status ADD VALUE IF NOT EXISTS 'rejected';`
- [ ] **Step 3: Implémenter M1** — enum, 2 tables, seed matrice (organizer/co : toutes sauf `contribute` = true ; member : `contribute` seul ; observer : rien), fonction `SECURITY DEFINER STABLE SET search_path = public, pg_temp` + réécriture `SET search_path` de `is_group_member`, `is_group_organizer`, `lkv_can`, `is_moderateur` (corps inchangés) ; `GRANT EXECUTE` à authenticated.
- [ ] **Step 4: Run PASS** — harness `-Mode upgrade` (runner TAP) 100 % vert.
- [ ] **Step 5: Commit** — `feat(tribu): capacites de groupe (enum, matrice, overrides) + alignement enum`

### Task 2: M2 policies par commande

**Files:**
- Create: `supabase/migrations/20260913020000_tribu_policies.sql`
- Test: `supabase/tests/database/tribu_permissions.test.sql` (étendre — sections politiques)

**Interfaces:**
- Consumes: `group_member_has_capability`.
- Produces: policies par commande (matrice §3.2 spec) ; suppressions des 5 `*_member_all`, 7 `*_select_public_or_member`, `invitations_public_read_by_token` ; `groups_public_read` resserrée (`gm.status IN ('pending','active')`).

- [ ] **Step 1: Test rouge** — écrire les assertions pgTAP : observer C ne peut `INSERT` aucune des 6 tables enfant (throws_ok 42501) ni `UPDATE/DELETE` la ligne d'autrui ; member B peut `INSERT` une ligne sienne mais pas `UPDATE/DELETE` celle de A ; B ne peut pas voter pour un autre (`user_id` ≠ self rejeté) ni voter sans être membre (poller d'un groupe tiers) ; A (organizer) peut tout ; non-membre ne lit rien. Run → FAIL (fuites actuelles).
- [ ] **Step 2: Implémenter** — DROP IF EXISTS par nom (5 `*_member_all`, 7 `*_select_public_or_member`, `invitations_public_read_by_token`) ; CREATE des policies par commande ; `votes_*` self-only + appartenance via `group_polls` ; `messages` écriture `contribute` ; `members_join_group` forcée `role='member' AND status IN ('pending','active')` ; `members_organizer_insert` → `invite_members` ; `groups_organizer_update` → `manage_info` ; `group_invitations` via `invite_members` ; `groups_public_read` pending/active.
- [ ] **Step 3: Run PASS** — harness -Mode upgrade, TAP vert (aucune policy `*_member_all`/`*_select_public_or_member` restante via `pg_policies`).
- [ ] **Step 4: Commit** — `fix(tribu): policies par commande (fin des member_all et lectures publiques enfants)`

### Task 3: M3 intégrité des rôles

**Files:**
- Create: `supabase/migrations/20260913030000_tribu_role_integrity.sql`
- Test: `supabase/tests/database/tribu_permissions.test.sql` (étendre — intégrité)

**Interfaces:**
- Produces: trigger `enforce_group_role_change` BEFORE UPDATE ON group_members.

- [ ] **Step 1: Test rouge** — B tente `UPDATE group_members SET role='organizer' WHERE user_id=B` → throws 42501 ; B tente `status='left'` → 42501 ; B `pending→active` sur sa propre invitation → OK ; A promeut B en co → OK ; service_role (auth.uid() NULL) peut modifier.
- [ ] **Step 2: Implémenter** — trigger (règles §3.3 spec), `SECURITY DEFINER` non requis ; garde `auth.uid() IS NULL`.
- [ ] **Step 3: Run PASS** + `npx tsc --noEmit` (aucun impact client).
- [ ] **Step 4: Commit** — `fix(tribu): integrite des roles (anti auto-promotion, transitions de statut)`

### Task 4: Revue Phase 0 + preuve avant/après

**Files:**
- Create: `docs/tribu/phase0-preuve.md`
- Test: harness complet (toutes les suites pgTAP).

**Interfaces:**
- Consumes: M0-M3.
- Produces: rapport de preuve ; verdict `database-reviewer`.

- [ ] **Step 1** — `pwsh scripts/db/install-from-baseline.ps1 -Mode install` ET `-Mode upgrade` : 0 échec, 0 migration en attente, TAP complet vert, F1/EXPLAIN verts.
- [ ] **Step 2** — Dispatch agent `database-reviewer` sur M0-M3 + `tribu_permissions.test.sql` ; corriger tout Critical/Important.
- [ ] **Step 3** — Écrire `docs/tribu/phase0-preuve.md` : avant/après (observer/member/organizer), liste des policies supprimées (requête `pg_policies`), preuve TAP.
- [ ] **Step 4: Commit** — `test(tribu): preuve phase 0 (pgTAP, policies, revue database)`

---

## Section 2 — Phase 1 (pont Club ↔ Hub)

### Task 5: M4-M6 pont club + RLS club_only

**Files:**
- Create: `supabase/migrations/20260913040000_tribu_club_bridge.sql`
- Create: `supabase/migrations/20260913050000_tribu_enum_club_only.sql`
- Create: `supabase/migrations/20260913060000_tribu_club_only_policy.sql`
- Test: `supabase/tests/database/tribu_club_bridge.test.sql` (créer)

**Interfaces:**
- Produces: `travel_groups.parent_club_id`, `public.is_club_member(uuid, uuid)`, visibilité `club_only`, policy `groups_club_read`.

- [ ] **Step 1: Test rouge** — fixture club + membres ; groupe `club_only` : membre club lit, non-membre ne lit pas (même en connaissant l'id) ; membre d'un autre club ne lit pas. → FAIL (valeur enum absente).
- [ ] **Step 2: Implémenter** M4 (colonne + index + `is_club_member` `SECURITY DEFINER STABLE SET search_path`, `club_members.status='active'`), M5 (`ADD VALUE IF NOT EXISTS 'club_only'` seule instruction), M6 (policy SELECT additionnelle).
- [ ] **Step 3: Run PASS** + harness complet.
- [ ] **Step 4: Commit** — `feat(tribu): pont club (parent_club_id, is_club_member, visibilite club_only)`

### Task 6: UI onglet Groupes + action création + badge retour

**Files:**
- Modify: `src/app/clubs/[id]/page.tsx` + composants onglets desktop/mobile (paths exacts au step 1)
- Create: `src/features/tribu/actions/createGroupFromClub.ts` (server action)
- Modify: `src/features/hub/server/getGroupeComplet.ts` (badge club) + `HubGroupeCockpit`/mobile
- Test: `tests/tribu/create-group-from-club.spec.ts` + `scripts/e2e/club-group-bridge.spec.ts`

**Interfaces:**
- Consumes: `setActiveAdventure` (`src/features/hub/context/activeAdventureServer.ts`).
- Produces: `createGroupFromClub({ clubId, name, memberIds }) → { ok, groupId }` ; cartes groupe naviguant vers `/hub/groupe`.

- [ ] **Step 1** — Explorer les composants onglets réels (`ClubVerticalTabs`, `MobileClubDetailView`, `BottomTabBar`) et écrire le test rouge du render (onglet « Groupes » absent).
- [ ] **Step 2** — Server action (Zod, auth, owner organizer, `visibility='club_only'`, membres club `pending`) + tests unitaires (auth requise, membres filtrés aux membres actifs du club).
- [ ] **Step 3** — UI : onglet + liste + CTA création (modal) + navigation cookie → `/hub/groupe` ; badge « Né du club X » + lien retour.
- [ ] **Step 4** — `npx tsc --noEmit`, `npx vitest run tests/tribu`, e2e bridge (création → apparition dans `/hub` du créateur).
- [ ] **Step 5: Commit** — `feat(tribu): onglet groupes du club et creation vers le hub (TRIBU-R1)`

---

## Section 3 — Phase 2 (groupe éclair)

### Task 7: M7 colonnes éphémères + cron nettoyage

**Files:**
- Create: `supabase/migrations/20260913070000_tribu_ephemeral.sql`
- Create: `src/app/api/cron/cleanup-ephemeral-groups/route.ts`
- Test: `supabase/tests/database/tribu_ephemeral.test.sql` + `tests/tribu/cleanup-ephemeral-groups.spec.ts`

- [ ] **Step 1: Test rouge** — pgTAP : colonnes/defaults/index ; vitest : route 401 sans `Bearer CRON_SECRET`, 503 sans service, supprime uniquement `is_ephemeral AND auto_dissolve_at < now()` (mock client).
- [ ] **Step 2: Implémenter** colonnes + index partiel + route (pattern `cleanup-solo-crews`).
- [ ] **Step 3: Run PASS** + harness.
- [ ] **Step 4: Commit** — `feat(tribu): groupe ephemere (colonnes, index, cron de dissolution)`

### Task 8: Sélecteur social + action création éclair (Explorer)

**Files:**
- Create: `src/features/tribu/actions/createEphemeralGroup.ts`
- Create: `src/features/tribu/components/EphemeralGroupSheet.tsx` (+ suggestions serveur)
- Modify: `src/components/explorer/ExplorerClient.tsx` (CTA « Créer une sortie avec des amis »)
- Test: `tests/tribu/create-ephemeral-group.spec.ts`

**Interfaces:**
- Produces: `getSocialSuggestions() → { coMembers, following, }` (union dédupliquée) ; `createEphemeralGroup({ title, userLat, userLng, inviteeIds })`.

- [ ] **Step 1: Test rouge** — action : auth requise ; `is_ephemeral=true`, `auto_dissolve_at` = départ+24h sinon now+7j ; owner organizer + invités `pending` ; cookie posé.
- [ ] **Step 2: Implémenter** serveur (requêtes union co-membres/`user_follows`/recherche `public_profiles` via service consent-gated) + UI sheet Liquid Glass (tokens `--lkv-*`) + CTA Explorer.
- [ ] **Step 3: Run PASS** + `tsc` + lint.
- [ ] **Step 4: Commit** — `feat(tribu): creation de sortie ephemere depuis l'explorer (co-membres, abonnements, recherche)`

### Task 9: Hub léger + conversion

**Files:**
- Modify: `src/features/hub/components/collectif/HubGroupeCockpit.tsx` (+ mobile)
- Create: `src/features/tribu/actions/convertEphemeralGroup.ts`
- Test: `tests/tribu/ephemeral-hub.spec.ts`

- [ ] **Step 1: Test rouge** — render : badge « Sortie du jour » + compte à rebours visibles si `is_ephemeral`, absents sinon ; conversion met `is_ephemeral=false` / `auto_dissolve_at=NULL`.
- [ ] **Step 2: Implémenter** + action.
- [ ] **Step 3: Run PASS** + e2e cycle complet (création → hub → conversion).
- [ ] **Step 4: Commit** — `feat(tribu): traitement hub du groupe ephemere (badge, compte a rebours, conversion)`

---

## Section 4 — Phase 3 (délégations)

### Task 10: M8 table + fonction étendue

**Files:**
- Create: `supabase/migrations/20260913080000_tribu_delegations.sql`
- Test: `supabase/tests/database/tribu_delegations.test.sql`

- [ ] **Step 1: Test rouge** — membre D (member) avec délégation active `organizer` : `manage_tasks` vrai pendant la fenêtre, faux après ; délégation expirée ignorée ; override `false` gagne sur délégation ; délégation vers non-membre ignorée.
- [ ] **Step 2: Implémenter** table + indexes + RLS + `CREATE OR REPLACE group_member_has_capability` (branche `bool_or` délégations actives).
- [ ] **Step 3: Run PASS** + harness complet.
- [ ] **Step 4: Commit** — `feat(tribu): delegations temporaires de role (table, RLS, capacite active)`

### Task 11: UI délégation

**Files:**
- Modify: drawer membres hub desktop/mobile (paths au step 1)
- Create: `src/features/tribu/actions/delegateRole.ts` + `revokeDelegation.ts`
- Test: `tests/tribu/delegation-ui.spec.ts`

- [ ] **Step 1: Test rouge** — render bouton « Déléguer temporairement » (organizer/co seulement) + « Reprendre la main » si délégation sortante active ; actions auth + membre.
- [ ] **Step 2: Implémenter** UI + actions.
- [ ] **Step 3: Run PASS** + `tsc`/lint.
- [ ] **Step 4: Commit** — `feat(tribu): delegation de role depuis le hub (UI + actions)`

---

## Section 5 — Phase 4 (quorum)

### Task 12: M9 colonnes + résolution à la lecture

**Files:**
- Create: `supabase/migrations/20260913090000_tribu_polls_quorum.sql`
- Create: `src/lib/queries/pollResolution.ts`
- Test: `supabase/tests/database/tribu_quorum.test.sql` + `tests/tribu/poll-resolution.spec.ts`

**Interfaces:**
- Produces: `resolvePoll({ poll, votes, activeMembers, organizerIds }) → { winnerIndex, counts, adopted, reason }`.

- [ ] **Step 1: Tests rouges** — vitest : `simple` (gagnant/égalité), `quorum_majority` (atteint/non atteint), `organizer_approval` (organizer pour/absent) ; pgTAP : colonnes + CHECK `quorum_threshold` + `option_index >= 0`.
- [ ] **Step 2: Implémenter** migration + module pur.
- [ ] **Step 3: Run PASS** + harness.
- [ ] **Step 4: Commit** — `feat(tribu): sondages a quorum (types, seuil, resolution en lecture)`

### Task 13: UI décision importante

**Files:**
- Modify: `src/components/groupes/DecisionsCard.tsx` + `src/lib/queries/groupe.ts`
- Test: `tests/tribu/decisions-card-quorum.spec.ts`

- [ ] **Step 1: Test rouge** — toggle « Décision importante » → `poll_type='quorum_majority'` ; affichage adopté/quorum/seuil.
- [ ] **Step 2: Implémenter** (rendu via `resolvePoll`).
- [ ] **Step 3: Run PASS** + `tsc`/lint.
- [ ] **Step 4: Commit** — `feat(tribu): UI des decisions a quorum dans les sondages`

---

## Section 6 — Phases 5 & 6 (journal, modèles)

### Task 14: M10 journal d'activité

**Files:**
- Create: `supabase/migrations/20260913100000_tribu_activity_log.sql`
- Test: `supabase/tests/database/tribu_activity_log.test.sql`

- [ ] **Step 1: Test rouge** — 1 mutation sur chacune des 6 tables → 1 ligne `group_activity_log` correcte (action_type/entity_type/summary/actor) ; SELECT réservé aux membres ; INSERT direct refusé.
- [ ] **Step 2: Implémenter** table + RLS + fonction trigger générique + 6 triggers.
- [ ] **Step 3: Run PASS** + harness complet.
- [ ] **Step 4: Commit** — `feat(tribu): journal d'activite du groupe (triggers, RLS lecture membre)`

### Task 15: Panneau Journal

**Files:**
- Create: `src/features/tribu/components/GroupActivityLog.tsx`
- Modify: `src/features/hub/server/getGroupeComplet.ts` + onglet hub groupe
- Test: `tests/tribu/activity-log-ui.spec.ts`

- [ ] **Step 1: Test rouge** — chronologie inversée, vide → message ; données injectées.
- [ ] **Step 2: Implémenter** + brancher l'onglet.
- [ ] **Step 3: Run PASS** + `tsc`/lint.
- [ ] **Step 4: Commit** — `feat(tribu): panneau journal du groupe dans le hub`

### Task 16: M11 modèles de checklist

**Files:**
- Create: `supabase/migrations/20260913110000_tribu_task_templates.sql`
- Test: `supabase/tests/database/tribu_task_templates.test.sql`

- [ ] **Step 1: Test rouge** — lecture modèle club par membre, refus non-membre ; écriture `source='club'` par membre actif ; `official` refusé aux utilisateurs.
- [ ] **Step 2: Implémenter** tables + RLS.
- [ ] **Step 3: Run PASS** + harness.
- [ ] **Step 4: Commit** — `feat(tribu): modeles de checklist par club (tables et RLS)`

### Task 17: UI modèles (publication club + application groupe)

**Files:**
- Create: `src/features/tribu/actions/publishTaskTemplate.ts` + `applyTaskTemplate.ts`
- Modify: onglet Groupes club (publication) + création de groupe/hub (suggestion + application)
- Test: `tests/tribu/task-templates.spec.ts` + `scripts/e2e/task-template.spec.ts`

- [ ] **Step 1: Test rouge** — publish (club actif) / apply (insert tasks `created_by=self`, capacité `contribute`).
- [ ] **Step 2: Implémenter** actions + UI.
- [ ] **Step 3: Run PASS** + e2e bout-en-bout (publication → application dans un groupe).
- [ ] **Step 4: Commit** — `feat(tribu): modeles de checklist du club appliques au groupe`

---

## Section 7 — Clôture lot 1

### Task 18: Gates finaux, revues, déploiement, merge

**Files:**
- Modify: `MISSION_LOG.md`
- Create: `docs/tribu/rapport-lot1.md`

- [ ] **Step 1** — Gates : `npx tsc --noEmit` ; `npm run lint` ; `npx vitest run` (2664+ attendus, 4 échecs préexistants) ; `npm run build` ; harness `-Mode install` + `-Mode upgrade` (TAP complet) ; e2e `preparer-sentier` + `depart-cockpit` + `atlas-explorer` non régressés.
- [ ] **Step 2** — Revues agents : `database-reviewer` (final), `security-reviewer` (surface nouvelle), `silent-failure-hunter` (actions + refus RLS silencieux).
- [ ] **Step 3** — Corriger, re-gates ; `npx supabase db push --linked` (prod) + requêtes de contrôle (`pg_policies` : 0 `*_member_all`).
- [ ] **Step 4** — `MISSION_LOG.md` + `docs/tribu/rapport-lot1.md` ; merge `--no-ff` sur `main` ; push.
- [ ] **Step 5: Commit** — `docs(tribu): rapport lot 1 et journal de mission`
