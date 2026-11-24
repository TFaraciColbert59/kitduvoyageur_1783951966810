# CLUB_PLAN_PERFORMANCE — Feuille de Route Performance (10 Piliers)

> **Principe** : Chaque piste est ancrée sur l'architecture réelle mesurée de LKDV (Next.js 15 App Router + React 19 + Supabase Postgres/Realtime + Vercel).

---

## 1. Référentiel & Objectifs cibles

| Indicateur | Cible production | Mesure / Observation actuelle |
|---|---|---|
| **LCP** (`/clubs/[id]`) | `< 2,0 s` (4G mobile) | Rendu initial rapide, mais fallback transitoire (`Club LKDV`) visible avant hydratation client |
| **INP** (changement d'onglet / lentille) | `< 100 ms` | Fluide sur 500 membres, mais `ClubDrawerHost` + `ClubLiquidGlassV8` sont volumineux |
| **CLS** | `< 0,05` | Maîtrisé grâce aux hauteurs fixes `SlotShell` (`48px` top, `30px` bottom) |
| **Ouverture drawer / sous-drawer** | `< 120 ms` | Lazy loading déjà actif sur `KitProductSheetV2` |
| **Latence API `/api/clubs/[id]/*`** | `p95 < 180 ms` | `loadClubBundle` exécute 3 requêtes parallèles par appel |

---

## 2. Plan d'action détaillé par pilier

### Pilier 1 — Frontend & React (P1/P2)
- **Problème** : `ClubLiquidGlassV8.tsx` (> 2 800 lignes) et `ClubStatsHubDrawerBody.tsx` (> 1 900 lignes) concentrent de nombreux états et calculs dérivés.
- **Solution** : Scinder `ClubLiquidGlassV8` (carte 3D / runtime overlays / drawer host) et memoïser `buildStatsFromProps` hors rendu.
- **Gain espéré** : `-25 à -35 %` de JS parsé au premier chargement de `/clubs/[id]`.
- **Risque / Retour arrière** : Faible ; découpage pur avec ré-exports.

### Pilier 2 — Drawers & Fluidité (P1)
- **Problème** : `ClubAdminDrawerShell` monte les 12 sous-volets selon `activeSubTab`, et les listes longues (500+ membres, 200+ équipements) rendent jusqu'à 35–50 cartes DOM d'un coup.
- **Solution** : Virtualisation légère (`@tanstack/react-virtual` ou fenêtre glissante) au-delà de 80 items dans `AdminTeamRolesPane`, `CordeeMemberList` et `ClubCoffreDrawerBody`.
- **Gain espéré** : `INP < 50 ms` même à 5 000 membres dans un club marathon.

### Pilier 3 — Réseau & API (P1)
- **Problème** : Chaque route (`/permissions`, `/budget`, `/volunteers`, `/salons`, `/moderation`) appelle `loadClubBundle` + `hasClubCapability`, générant 3 à 5 allers-retours Postgres par requête HTTP.
- **Solution** : Créer une RPC consolidée `club_get_context_and_capabilities(p_club_id)` et activer la déduplication côté client (SWR / TanStack Query avec `staleTime: 30_000`).
- **Gain espéré** : `-40 %` de latence `p95` sur les appels API club.

### Pilier 4 — PostgreSQL & Supabase (P1/P2)
- **Problème** : Les politiques RLS sur `club_channel_messages` et `club_budget_entries` appellent `club_has_capability()` et `club_actor_effective_role()` par ligne.
- **Solution** : Wrapper `auth.uid()` dans `(SELECT auth.uid())` dans toutes les policies (initPlan Postgres), maintenir des index composites `(club_id, status)` et `(club_id, created_at DESC)`, et passer les timelines longues en pagination par curseur `(created_at, id)`.
- **Gain espéré** : Division par `3–5×` du coût CPU Postgres sur scans de tables > 100k lignes.

### Pilier 5 — Cache & Synchronisation (P2)
- **Problème** : Les caches locaux (`salonsCache`, `statsCache`, `publicCarnetsCache`) sont des `Map` module-level non invalidées globalement après mutation croisée (ex. création d'un salon dans l'Admin).
- **Solution** : Centraliser l'invalidation via un bus d'événements ou TanStack Query (`queryClient.invalidateQueries(['club', clubId])`).

### Pilier 6 — Realtime (P1/P2)
- **Problème** : Chaque onglet Salons ouvre un channel `club-salon-live-${channelId}`. En multi-onglets ou trafic élevé (marathon), cela multiplie les sockets.
- **Solution** : Multiplexer sur 1 channel par club (`club-live-${clubId}`) filtré côté client, avec `removeChannel` systématique et backoff exponentiel sur reconnexion.

### Pilier 7 — Images, Vidéos & Médias (P2)
- **Problème** : Plusieurs `<img>` natifs (avatars membres, couvertures kits, photos feed) chargent la taille source sans transformation adaptative.
- **Solution** : Utiliser `next/image` ou les transformations Supabase Storage (`?width=160&quality=75&format=webp`) pour les avatars 30–64 px et miniatures kits.

### Pilier 8 — Infrastructure & Déploiement (P2)
- **Problème** : Cold starts des Route Handlers Node.js sur Vercel + connexions Postgres directes.
- **Solution** : Utiliser systématiquement le pooler Supavisor (Transaction mode port 6543) pour les routes serverless, et déporter l'export CSV massif ou les notifications de masse (marathon) sur Vercel Queues / Workflows.

### Pilier 9 — Mobile & Réseau dégradé (P1)
- **Problème** : `backdrop-filter: blur(14px–20px)` empilé sur plusieurs couches peut solliciter le GPU sur smartphones d'entrée de gamme.
- **Solution** : Conserver le fallback `@media (prefers-reduced-transparency: reduce)` déjà présent et limiter les `backdrop-filter` aux conteneurs fixes (capsules/drawers), jamais sur les cartes répétées en liste.

### Pilier 10 — Scalabilité (1k → 1M utilisateurs)
| Palier | Goulot principal anticipé | Mitigation requise |
|---|---|---|
| **1 000 – 10 000** | Aucun blocage structurel | Index existants + pooler Supabase |
| **100 000** | RLS par ligne sur `club_channel_messages` & `club_members` | `(SELECT auth.uid())` initPlan + pagination par curseur + stats pré-agrégées (`lkdv_club_stats_agg` en vue matérialisée) |
| **1 000 000** | Concurrence Realtime sur grands événements (marathons) & compteurs chauds | Partitionnement `club_channel_messages` par mois, file asynchrone pour compteurs (`members_count`), CDN cache sur clubs publics |
