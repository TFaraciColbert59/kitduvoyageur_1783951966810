# CLUB_BACKLOG_PRIORISE — Backlog Priorisé (P0 → P3)

---

## P0 — Bloquant avant mise en production
| ID | Tâche | Cause / Fichiers concernés | Solution | Effort | Critère d'acceptation |
|---|---|---|---|---|---|
| **P0-1** | Synchroniser intégralement `20261124100100_club_admin_v2_core_ops_budget.sql` sur la base Supabase distante | Fonctions `club_actor_effective_role`, `club_transfer_ownership`, triggers et policies `club_channels` encore en attente sur `lekitduvoyageur2` | Exécuter `supabase db push` (ou appliquer le script SQL dans Supabase SQL Editor) | 15 min | `club_transfer_ownership`, `club_actor_effective_role` et `club_channels` `min_role` actifs en base |

## P1 — Forte priorité (Post-clôture immédiate)
| ID | Tâche | Cause / Fichiers concernés | Solution | Effort | Critère d'acceptation |
|---|---|---|---|---|---|
| **P1-1** | Resynchroniser les compteurs `clubs.members_count` | `35` clubs désynchronisés constatés lors de l'audit SQL | Exécuter `SELECT public.lkdv_recount_club_members(id) FROM public.clubs;` | 5 min | `clubs_bad_member_count = 0` |
| **P1-2** | Ajouter un rate-limiter sur les mutations `/salons`, `/budget`, `/permissions`, `/invites` | Risque de spam sur salons ou propositions budgétaires | Middleware Upstash / Vercel WAF | 0,5 j | Retour `429` au-delà du seuil défini |
| **P1-3** | Consolider `loadClubBundle` + `loadViewerCapabilities` en 1 RPC | 3–5 requêtes SQL par appel API (`src/app/api/clubs/_lib/db.ts`) | RPC `club_get_context_and_capabilities` | 0,5 j | Latence `p95 < 180 ms` |

## P2 — Optimisation importante
| ID | Tâche | Fichiers concernés | Solution | Effort | Critère d'acceptation |
|---|---|---|---|---|---|
| **P2-1** | Purger les 126 warnings ESLint `no-unused-vars` | `ClubSortiesDrawerBody.tsx`, `ClubStatsHubDrawerBody.tsx`, `ClubInlineFeed.tsx`, `g02/` | Supprimer les anciens états/imports morts | 2 h | `npx eslint src/.../clubs` à `0` warning |
| **P2-2** | Mettre à jour ou archiver les 2 anciens tests `g02/` | `ClubLeaderboard.test.tsx`, `ClubEventsBoard.test.tsx` | Aligner sur les composants V2 ou supprimer si obsolètes | 2 h | 100 % des suites `g02/__tests__` vertes |
| **P2-3** | Virtualiser les listes > 80 membres / équipements | `AdminTeamRolesPane.tsx`, `ClubCordeeDrawerBody.tsx`, `ClubCoffreDrawerBody.tsx` | `@tanstack/react-virtual` | 1 j | `INP < 50 ms` sur 2 000 membres |
| **P2-4** | Unifier le cache client club via TanStack Query | `salonsCache`, `statsCache`, `publicCarnetsCache` | Clés `['club', clubId, ...]` + invalidation croisée | 1 j | Zéro donnée périmée après mutation Admin |

## P3 — Amélioration avancée à moyen terme
| ID | Tâche | Solution | Effort |
|---|---|---|---|
| **P3-1** | Multiplexer Realtime sur 1 channel par club | Channel unique `club-live-${clubId}` | 1 j |
| **P3-2** | Step-up auth avant `transfer_ownership` / `club.delete` | Vérification session récente (< 5 min) | 0,5 j |
| **P3-3** | Partitionnement `club_channel_messages` & vue matérialisée stats (palier 100k–1M) | Migration Postgres + cron rafraîchissement | 2 j |
