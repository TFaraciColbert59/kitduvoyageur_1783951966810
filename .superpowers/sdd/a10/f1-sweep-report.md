# Rapport a10 — F1 sweep des lectures publiques de profils

Date : 2026-09-11 · Branche : `audit/adventure-intelligence` · Worktree : `ai-finalization`
Commit : `fix(a10): sweep des lectures publiques de profils (F1 complet)`

Périmètre : fermeture F1 après le `DROP POLICY "public_read_user_profiles"`
(`supabase/migrations/20260911290000_a10_f1_public_profiles.sql`, non appliquée) et la
création de la vue `public.public_profiles`. Objectif : fonctionnement inchangé + zéro
lecture inter-utilisateurs de la table brute `public.user_profiles`.

## Méthode

- Inventaire `rg -l "user_profiles" src -g "*.ts" -g "*.tsx"` → 42 fichiers, classés selon
  les règles de la mission (write / self authentifié / admin / service-role / SECURITY DEFINER,
  sinon migration vers la vue publique).
- Helpers réutilisés : `src/lib/queries/publicProfilesCore.ts` (client navigateur,
  `fetchPublicProfilesWith`) et `src/lib/queries/publicProfiles.ts` (serveur,
  `fetchPublicProfiles`). La projection du core a été étendue aux 12 colonnes publiques
  de la vue (`id, full_name, avatar_url, bio, location, website, trust_score,
  loyalty_points, loyalty_level, xp, level, created_at`) et le helper core est désormais
  fail-safe (`{}` sur erreur **ou** exception) pour les call sites navigateur.
- SQL : toutes les vues des migrations passées en revue — aucune ne joint `user_profiles`
  (`explore_trails`, `conversation_stats`, `unread_notifications_priority`, `kit_*`,
  `travel_groups_legacy`, `trip_collaborators_legacy`, `hub_dashboard_kpis`,
  `segment_collective_public`, `terrain_reports_public`, vues lot9/lot10 : seules des
  références documentaires). Aucune migration additive de vue n'est donc nécessaire.

## Inventaire des 42 fichiers (21 KEEP / 21 MIGRATED)

### KEEP (21)

| Fichier | Raison |
| --- | --- |
| `src/contexts/AuthContext.tsx` | Self : `eq('id', authUser.id)` + upsert de son propre profil. |
| `src/components/identity/SignatureVisibilityControl.tsx` | Self : lecture/update `signature_visibility` `.eq('id', user.id)`. |
| `src/app/admin/page.tsx` | Admin : couvert par la policy `user_profiles_select_admin` (profils + emails). |
| `src/app/checkout/page.tsx` | Self : lecture/update `loyalty_points` `.eq('id', user.id)` (fallback RPC). |
| `src/app/recompenses/page.tsx` | Self : lecture `.eq('id', user.id)`. |
| `src/components/ui/ReportBlockModal.tsx` | Write : `update` de suspension sur la ligne cible (règle 1). |
| `src/app/rapport-expedition/page.tsx` | Self : insert/lecture/update d'XP/paliers `.eq('id', user.id)`. |
| `src/app/api/seed/route.ts` | Service-role (`SUPABASE_SERVICE_ROLE_KEY`) + upsert d'administration. |
| `src/app/connexion/page.tsx` | Self : upsert du profil au login (`userId` = auth). |
| `src/app/api/identity/signature/route.ts` | Aucune requête (commentaire seulement) ; l'accès réel passe par `get_user_signature()` SECURITY DEFINER. |
| `src/app/fidelite/page.tsx` | Self : lecture/update `loyalty_points` `.eq('id', user.id)`. |
| `src/components/groupes/EquipementCard.tsx` | Consommateur du prop `user_profiles` fourni par `queries/groupe.ts` (aucun accès DB). |
| `src/components/groupes/DepensesCard.tsx` | Idem consommateur (aucun accès DB). |
| `src/app/panier/page.tsx` | Self : lecture/update `loyalty_points` `.eq('id', user.id)`. |
| `src/components/compte/modals/EditProfileDrawer.tsx` | Self : `update` de son profil (`profile?.id`). |
| `src/components/compte/MobileCompteV2.tsx` | Self : `select('*')` `.eq('id', user!.id)`. |
| `src/components/compte/FideliteTab.tsx` | Self : lecture `.eq('id', user.id)`. |
| `src/components/compte/EditProfileView.tsx` | Self : upsert de son profil. |
| `src/app/api/notifications/process/route.ts` | Service-role (`supabaseAdmin`), lecture `email` côté serveur. |
| `src/features/adventure-intelligence/server/terrainReports.ts` | Adaptateur service-role (routes/cron via `getServiceSupabase`) : `getUserModerationContext`. |
| `src/components/clubs/CreateClubView.tsx` | Self : `select('*')` `.eq('id', currentUser.id)`. |

### MIGRATED (21)

| Fichier | Avant → Après |
| --- | --- |
| `src/lib/home-queries.ts` | `count` sur `user_profiles` → `count` sur `public_profiles` (même compteur public, visible anon/authenticated). |
| `src/lib/queries-trips.ts` | Lecture directe des profils collaborateurs/payeurs → `fetchPublicProfiles` (serveur), mêmes champs. |
| `src/lib/queries-crews.ts` | Embed `profile:user_profiles!crew_members_user_id_fkey(full_name, username, avatar_url)` → `crew_members` sans embed + `fetchPublicProfiles` ; `username` absent de la vue → `null` explicite. |
| `src/lib/queries/groupe.ts` | 5 embeds FK (membres, tâches, kit, dépenses, messages) → sélections sans embed + un `fetchPublicProfilesWith` batch ; clé `user_profiles` conservée pour les composants consommateurs. |
| `src/lib/supabase/queries-compte.ts` | `fetchFullProfile` servait le dashboard **et** `/profil/[id]` (lecture inter-utilisateurs indirecte, hors inventaire chaîne) : split self (table brute + policy self, champs `role`) / public (`public_profiles`). |
| `src/app/communaute/page.tsx` | 2 embeds (`community_posts`, `carnets`) → sélections sans embed + profils batch (dont `loyalty_level`). |
| `src/components/compte/CarnetsTab.tsx` | Embed `followers:user_profiles!user_follows_follower_id_fkey(...)` → `user_follows` sans embed + profils batch (dont `location`). |
| `src/components/pays/PaysCarnetsList.tsx` | Embed auteur carnets → profils batch + merge `author`. |
| `src/components/pays/BouteilleALaMer.tsx` | Embeds `owner` + `profile` demandeurs → deux étapes ; updates self `age_confirmed_at` conservés sur la table. |
| `src/components/communaute/CommentItem.tsx` | Embed sur l'insert de réponse → insert sans embed + `fetchPublicProfilesWith([currentUser.id])`. |
| `src/components/social/PostCard.tsx` | Embeds sur lecture et insert de commentaires → deux étapes ; fallback historique conservé. |
| `src/app/clubs/page.tsx` | 3 embeds (topics, membres, demandes) → deux étapes. |
| `src/app/clubs/[id]/page.tsx` | 5 embeds (topics, membres, 2 commentaires, participants) → deux étapes. |
| `src/app/evenements/page.tsx` | Embed `organizer` → `events` sans embed + profils batch (full_name, trust_score). |
| `src/app/guides/[slug]/GuideDetailClient.tsx` | Embed auteur → guide sans embed + profil. |
| `src/components/groupes/VoyageursCard.tsx` | Embed `group_members` + recherche sur la table → deux étapes + recherche `.from('public_profiles')` (mêmes champs). |
| `src/components/groupes/TachesCard.tsx` | Embed `user_profiles!group_tasks_assigned_to_fkey` sur l'insert (write) → `select('*')` ; le nom affiché provenait déjà de la liste `members`. |
| `src/app/api/materiel/fork/route.ts` | Lecture `full_name` du créateur source → `fetchPublicProfiles` (serveur). |
| `src/app/api/produit/trust-score-check/route.ts` | Lecture `trust_score` vendeur (publique) → `fetchPublicProfilesWith` ; `display_name` sélectionné mais inutilisé est abandonné. |
| `src/features/messaging/services/messagingService.ts` | 4 embeds (`conversation_members` ×2, `messages` ×2) → sélections sans embed + profils batch ; `username` absent → `undefined`. |
| `src/features/messaging/components/NewConversationModal.tsx` | Annuaire `user_profiles` (+ `username` inexistant) → recherche sur `public_profiles` ; `username` → fallback « Membre LKDV ». |

## Tests

- `tests/adventure-intelligence/public-profiles.spec.ts` étendu :
  - `TEST-A10-F1-04` (nouveau) : helper core navigateur — dédup/cap 200, projection exacte,
    `{}` sur erreur PostgREST, sur exception et sur liste vide (aucun appel client).
  - `TEST-A10-F1-05` (nouveau) : sur une liste fixe de 23 fichiers (call sites F1
    antérieurs inclus), assertion par `fs` qu'aucune syntaxe d'embed public ne subsiste
    (`user_profiles!`, `:user_profiles(`, ainsi que l'embed nu `user_profiles (`).
  - `TEST-A10-F1-01` : l'assertion du `select` exact est remplacée par
    `PUBLIC_PROFILES_SELECT` (même intention ; projection étendue aux colonnes publiques
    nécessaires à F1-03). Aucun test supprimé, aucun périmètre affaibli.
  - L'ancien test statique migrations est renuméroté `TEST-A10-F1-06` (contenu inchangé).

## Vérifications

| Gate | Résultat |
| --- | --- |
| `npx vitest run tests/adventure-intelligence` | **50 fichiers / 319 tests verts** |
| `npm run test` (suite complète) | **249 fichiers / 1840 tests verts** |
| `npm run type-check` | exit 0 |
| `npm run lint` | exit 0 (warnings préexistants uniquement) |
| `npm run build` | non lancé (contrainte) |
| Commandes Supabase | non lancées (contrainte) |

## Items différés / préoccupations

1. **`anon_read_profiles_basic` toujours active (à traiter par l'humain).** Créée en
   `20260712235900_fixes_and_enhancements.sql` (`FOR SELECT TO anon USING (true)`), jamais
   supprimée. Comme les policies permissives sont combinées en OR, `anon` peut encore lire
   la table brute (`profile_select_public_subset USING(false)` n'annule pas l'autre policy).
   Le DROP demandé ne visait que `public_read_user_profiles`. L'ajout d'un DROP dans
   `20260911300000_a10_f1_public_views.sql` a été écarté : aucune vue SQL n'a besoin d'être
   remplacée (scope explicite « CREATE OR REPLACE only those views »), et une modification
   de policy DB mérite sa propre migration. Recommandation : `DROP POLICY IF EXISTS
   "anon_read_profiles_basic" ON public.user_profiles;` dans un lot DB dédié, le code anon
   passant désormais par la vue.
2. **Colonnes absentes de la vue** : `username` (messagerie, crews) et `first_name`
   (fallbacks existants) → `undefined`/`null` explicites, affichage inchangé (« Membre LKDV »,
   `full_name`, « Voyageur »). `display_name` (trust-score-check) était déjà inutilisé.
3. **Migration 20260911290000 non exécutée** : la validation BDD (replay + pgTAP) reste à
   faire côté humain, comme prévu par le lot 10.2.
4. **Extension de projection du helper** : `PublicProfile` accepte désormais les 12 colonnes
   publiques (champs additionnels optionnels) ; aucun champ sensible n'a été ajouté à la vue
   ni au helper.
