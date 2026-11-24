# CLUB_AUDIT_FINAL — Audit Définitif de la Page Club (`Le Kit du Voyageur`)

> **Date** : 24 novembre 2026  
> **Branche** : `feat/clubs-hierarchy-inventory`  
> **Périmètre** : `src/app/clubs/`, `src/app/api/clubs/`, `src/components/clubs/`, `src/features/clubs/`, `supabase/migrations/*club*`, et intégrations transversales (`/communaute`, `/messagerie`, `/explorer`, `/profil`, `/hub`).

---

## 1. Synthèse de l'architecture auditée

La page Club repose sur une route Next.js App Router (`/clubs/[id]`, [page.tsx](file:///Users/fr168256/Documents/Codex/2026-11-11/files-pasted-by-the-user-lkdv/work/lkdv-reference/src/app/clubs/%5Bid%5D/page.tsx)) qui monte le shell Liquid Glass [ClubLiquidGlassV8.tsx](file:///Users/fr168256/Documents/Codex/2026-11-11/files-pasted-by-the-user-lkdv/work/lkdv-reference/src/components/clubs/ClubLiquidGlassV8.tsx), connecté à :
- **1 drawer principal unifié** (`ClubDrawerHost.tsx`) à 5 onglets (`Stats`, `Cordée`, `Sorties`, `Coffre`, `Salons`) et 14 sous-volets + vues empilées (`InspectedMemberPane` à 3 lentilles, `InspectedOutingPane`).
- **1 drawer Administration unifié** (`ClubAdminDrawerShell.tsx`) à 4 pôles (`Pilotage`, `Communauté`, `Opérations`, `Équipe & Droits`) et 12 sous-volets filtrés dynamiquement par `viewerCapabilities`.
- **1 drawer de création de club** (`ClubCreateDrawerBody.tsx`).
- **15 groupes de routes API** sous `/api/clubs/*` et **32 migrations Supabase** dédiées (`*club*`).

---

## 2. Anomalies détectées et corrigées au cours de la clôture

| ID | Gravité | Anomalie constatée | Cause racine | Correction appliquée |
|---|---|---|---|---|
| **A-01** | **P0** | Erreur ESLint bloquante `react-hooks/rules-of-hooks` dans `CordeeMemberList` | `useMemo` appelé après `if (members.length === 0) return ...` dans `ClubCordeeDrawerBody.tsx` | `useMemo` déplacé avant le `return` anticipé (`ClubCordeeDrawerBody.tsx`) |
| **A-02** | **P0** | Requête Supabase `rest/v1/carnets` en **HTTP 400** sur `m-outings` | Colonnes inexistantes demandées (`user_id`, `slug`, `massif`) | Requête corrigée vers `author_id` et `destination` (`ClubCordeeDrawerBody.tsx`) |
| **A-03** | **P0** | HTTP 500 sur `/api/clubs/[id]/volunteers` et `/budget` si tables absentes | Erreur Postgres `42P01` / `PGRST205` non interceptée | Fallback gracieux + création effective des tables sur `lekitduvoyageur2` |
| **A-04** | **P0** | Split-brain UI ↔ RLS sur les permissions et défauts du trigger `guard_club_member_privileged_columns` | Anciens booléens `can_manage_gear/stories` non reliés à `club_has_capability`, `transfer_ownership` non atomique, `DELETE` fondateur bloqué | Architecture 3 niveaux (34 capacités × 5 rôles), RPC atomique `club_transfer_ownership`, fix trigger dans `20261124100100_club_admin_v2_core_ops_budget.sql` |
| **A-05** | **P1** | Aperçu profil membre sur `m-outings` se redéplie ou reste bloqué ouvert | `disabled={true}` sur `useScrollCollapsePreview` force `collapsed=false` + sélecteur `.lkdv-lens-pane:not([hidden])` invalide | `active` désactivé sur `m-outings`, `setMemberHeaderCompact(memberLensIndex === 1)`, verrou tactile/molette (`ClubDrawerHost.tsx`) |
| **A-06** | **P1** | Boutons d'administration exposés dans le drawer public `Salons` | Boutons `Créer un salon` et `Gérer les salons` présents dans `ClubSalonsDrawerBody.tsx` | Retrait total ; gestion déplacée dans `AdminSalonsPane.tsx` |
| **A-07** | **P1** | Double flèche (`▼` + `v`) sur `<select className="club-glass-input">` | `#sheet select` dans `compte-v8.css` injectait un `background-image` concurrent | Surcharge spécifique `#sheet .lkdv-club-carnet-drawer select.club-glass-input` + `::picker-icon` (`club-drawers-v2.css`) |
| **A-08** | **P1** | 3 tests drawer en échec (`clubDrawerM1.test.tsx`, `clubDrawerM2M3M5.test.tsx`) | Tests désynchronisés suite à l'évolution vers `CollapsibleHeroPreview` et `Tickets 2.1` | Tests mis à jour → **56/56 tests passés** |

---

## 3. État de synchronisation BDD & écarts restants

1. **Désynchronisation partielle des migrations sur `lekitduvoyageur2`** *(P0 avant mise en production)* :
   - Les tables `club_role_capability_policies`, `club_event_volunteer_shifts`, `club_event_volunteer_assignments`, `club_budget_entries` et les 13 nouvelles valeurs d'enum `club_capability` sont appliquées.
   - **Reste à appliquer via `supabase db push` (ou SQL Editor)** : la seconde moitié de `20261124100100_club_admin_v2_core_ops_budget.sql` (`club_actor_effective_role`, `club_has_capability` 3 niveaux, `guard_club_member_privileged_columns`, `club_transfer_ownership`, `cancel_club_event`, policies `club_channels` `min_role`, triggers d'audit).
2. **Compteurs `clubs.members_count` désynchronisés (`35` clubs)** *(P1)* :
   - Requête SQL de contrôle : `35` clubs ont `members_count != COUNT(club_members active)` (0 orphelin, 0 doublon). Exécution de `SELECT public.lkdv_recount_club_members(id) FROM public.clubs;` requise après validation.
3. **Module secondaire `src/components/clubs/g02/__tests__/`** :
   - 2 fichiers de tests hérités (`ClubLeaderboard.test.tsx` : 1/5 échec, `ClubEventsBoard.test.tsx` : 3/6 échecs) sont désynchronisés par rapport au composant V2 principal (`ClubDrawerHost`). Non bloquants pour `/clubs/[id]`, classés en P2.
