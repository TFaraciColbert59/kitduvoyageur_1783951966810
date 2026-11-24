# CLUB_MATRICE_DE_COUVERTURE — Inventaire Exhaustif & Statuts

> **Légende des statuts** :
> - `Fonctionnel et vérifié` : testé en navigateur et/ou tests automatisés après dernière édition.
> - `Partiellement fonctionnel` : UI/API opérationnelles avec réserve identifiée (ex. migration SQL partielle en base distante).
> - `Non vérifiable` : non exécuté en conditions réelles (ex. erreur réseau ou dépendance externe), avec justification.

---

## 1. Routes & Pages

| Élément | Emplacement | Source de données | Permissions | Statut |
|---|---|---|---|---|
| Page Club principale (`/clubs/[id]`) | `src/app/clubs/[id]/page.tsx` | SSR + `/api/clubs/[id]` + Supabase | Public / Membre | **Fonctionnel et vérifié** |
| Hub liste clubs (`/clubs` via Communauté/Hub) | `src/components/clubs/MobileClubsHub.tsx` | `/api/clubs` | Public / Auth | **Fonctionnel et vérifié** |
| Vue création club | `src/components/clubs/CreateClubView.tsx` | `POST /api/clubs` | Auth | **Fonctionnel et vérifié** |

---

## 2. Drawers, Sous-drawers & Onglets (Drawer Principal — `ClubDrawerHost.tsx`)

| Niveau | Élément | Composant source | Données / API | Statut |
|---|---|---|---|---|
| **0.0** | Stats · Perf & Score | `ClubStatsHubDrawerBody.tsx` | `GET /api/clubs/[id]/stats` | **Fonctionnel et vérifié** |
| **0.1** | Stats · Terrains & Disciplines (header rétractable + barres cliquables) | `ClubStatsHubDrawerBody.tsx` | `stats.terrains`, `stats.disciplines` | **Fonctionnel et vérifié** |
| **0.2** | Stats · Kits & Coffre (header rétractable sans barre segmentée) | `ClubStatsHubDrawerBody.tsx` + `KitCard.tsx` | `stats.kitsAndVault` | **Fonctionnel et vérifié** |
| **0.3** | Stats · Membres & Classement | `ClubStatsHubDrawerBody.tsx` | `stats.memberView` | **Fonctionnel et vérifié** |
| **1.0** | Cordée · Tous les membres | `ClubCordeeDrawerBody.tsx` | `members[]` | **Fonctionnel et vérifié** |
| **1.1** | Cordée · Encadrants & Sécurité | `ClubCordeeDrawerBody.tsx` | `members[]` filtrés `hasClubRole` | **Fonctionnel et vérifié** |
| **1.2** | Cordée · Binômes & Disponibilités | `ClubCordeeDrawerBody.tsx` | `myAvail` + `ClubG02Workspace` | **Fonctionnel et vérifié** |
| **1.M** | Sous-drawer Membre · Header `CollapsibleHeroPreview` | `ClubDrawerHost.tsx` | `inspectedMember` | **Fonctionnel et vérifié** |
| **1.M.0** | Sous-drawer Membre · `Perf & Stats` | `ClubCordeeDrawerBody.tsx` | `posts`, `outings`, `vaultGear` | **Fonctionnel et vérifié** |
| **1.M.1** | Sous-drawer Membre · `Sorties` (Timeline + carnets publics verrouillé 35 px) | `ClubCordeeDrawerBody.tsx` | `CarnetHorizontalTimeline` + `carnets` | **Fonctionnel et vérifié** |
| **1.M.2** | Sous-drawer Membre · `Sac` (clic → `KitProductSheetV2`) | `ClubCordeeDrawerBody.tsx` | `vaultGear` | **Fonctionnel et vérifié** |
| **2.0** | Sorties · Timeline (scroll vertical verrouillé) | `ClubSortiesDrawerBody.tsx` | `outings[]` | **Fonctionnel et vérifié** |
| **2.1** | Sorties · Tickets (`EventTicket` encoches + perforation) | `ClubSortiesDrawerBody.tsx` | `outings[]` | **Fonctionnel et vérifié** |
| **2.O** | Sous-drawer Fiche Sortie (détail, RSVP, covoiturage, GPX) | `ClubSortiesDrawerBody.tsx` | `/api/clubs/[id]/events/[eventId]` | **Fonctionnel et vérifié** |
| **3.0** | Coffre · Équipements prêtables + demande de prêt | `ClubCoffreDrawerBody.tsx` | `GET/POST /api/clubs/[id]/gear` | **Fonctionnel et vérifié** |
| **3.1** | Coffre · Kits types (`KitCard` 2 vues + `Clone` icône + `KitProductSheetV2`) | `ClubCoffreDrawerBody.tsx` | `standardKits` | **Fonctionnel et vérifié** |
| **3.2** | Coffre · Défis & Classement | `ClubCoffreDrawerBody.tsx` | `GET /api/clubs/[id]/challenges` | **Fonctionnel et vérifié** |
| **4.0** | Salons · Messagerie temps réel (Realtime + visibility resync, sans boutons admin) | `ClubSalonsDrawerBody.tsx` | `/api/clubs/[id]/salons` + Supabase Realtime | **Fonctionnel et vérifié** |

---

## 3. Drawer Administration Unifié (`ClubAdminDrawerShell.tsx`)

| Pôle | Sous-volet | Composant source | Permissions requises | Statut |
|---|---|---|---|---|
| **1. Pilotage** | Vue d'ensemble | `AdminOverviewPane.tsx` | ≥ 1 capacité admin | **Fonctionnel et vérifié** |
| **1. Pilotage** | Paramètres & Identité | `AdminSettingsPane.tsx` | `club.edit_settings` | **Fonctionnel et vérifié** |
| **1. Pilotage** | Sécurité & Audit (journal + transfert propriété + suppression) | `AdminSecurityAuditPane.tsx` | `members.view_audit_log` / `founder` | **Partiellement fonctionnel** *(RPC `club_transfer_ownership` à pousser en DB distante)* |
| **2. Communauté** | Adhésions & Invitations | `AdminMembersAccessPane.tsx` | `members.review_requests` / `manage_invites` | **Fonctionnel et vérifié** |
| **2. Communauté** | Salons du club (CRUD + `min_role` + archivage) | `AdminSalonsPane.tsx` | `salons.create` / `edit_settings` / `archive_or_delete` | **Partiellement fonctionnel** *(policies `min_role` à pousser en DB distante)* |
| **2. Communauté** | Modération & Signalements | `AdminModerationPane.tsx` | `moderation.resolve_reports` / `members.mute` / `ban_or_kick` | **Fonctionnel et vérifié** |
| **3. Opérations** | Événements & Bénévoles (postes, créneaux, check-in) | `AdminEventsOpsPane.tsx` | `volunteers.manage_shifts` | **Fonctionnel et vérifié** |
| **3. Opérations** | Matériel & Prêts (workflow 4 étapes) | `AdminLoansGearPane.tsx` | `gear.approve_club_loans` / `manage_club_inventory` | **Fonctionnel et vérifié** |
| **3. Opérations** | Budget collaboratif + export CSV | `AdminBudgetPane.tsx` | `budget.view` / `propose_expense` / `approve_and_manage` | **Fonctionnel et vérifié** |
| **3. Opérations** | Défis du club | `AdminChallengesPane.tsx` | `challenges.manage` | **Fonctionnel et vérifié** |
| **4. Équipe & Droits** | Membres & Grades + 34 switches individuels | `AdminTeamRolesPane.tsx` | `members.manage_roles` / `permissions.delegate` | **Partiellement fonctionnel** *(fonction `club_has_capability` 3 niveaux à pousser en DB distante)* |
| **4. Équipe & Droits** | Matrice des rôles (défauts par grade) | `AdminRoleMatrixPane.tsx` | `permissions.delegate` | **Partiellement fonctionnel** *(policy `club_role_cap_policies_write` à pousser en DB distante)* |

---

## 4. Intégrations transversales LKDV

| Pilier LKDV | Point de couplage | Source | Statut |
|---|---|---|---|
| **Messagerie** | Onglet `Clubs` intégrant `<ClubSalonsDrawerBody />` dans `MessagesScreen.tsx` | `src/components/messaging/` | **Fonctionnel et vérifié** |
| **Communauté** | Réutilisation de `<EventTicket />`, `<CollapsibleHeroPreview />`, `<KitProductSheetV2 />` | `src/features/community/v2/` | **Fonctionnel et vérifié** |
| **Profils / Carnet** | Réutilisation de `<KitCard />`, `<CarnetHorizontalTimeline />`, requête `carnets` publics | `src/components/carnet/`, `compte/` | **Fonctionnel et vérifié** |
| **Explorer / Carte** | `onFlyToCoords` depuis les sorties et tickets vers la carte principale | `ClubLiquidGlassV8.tsx` | **Fonctionnel et vérifié** |
