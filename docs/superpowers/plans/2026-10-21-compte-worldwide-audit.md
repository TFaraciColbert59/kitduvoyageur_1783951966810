# Audit base de données & plan directeur — Compte / communauté, lancement mondial

**Date :** 2026-10-21  
**Périmètre :** Supabase `icxyvwzfjbflcbqukpfz` (eu-west-3), code Compte / communauté / messagerie.  
**But :** savoir ce qui existe déjà, ce qui manque, ce qui est fragile, puis exécuter sans reconstruire l’existant.

---

## 1. Verdict exécutif

La base n’est pas un prototype : **363 migrations appliquées**, 157 profils, 20 publications, 43 commentaires, 35 carnets, 20 sorties GPS, 7 stories, 3 conversations, 200 notifications, 3 commandes. Les tables, triggers, compteurs, quotas, policies RLS, messagerie, stories, modération et follow existent déjà.

Le problème n’est donc pas « il manque la base ». Le problème est que **la page Compte est restée un prototype local** qui duplique des fonctionnalités déjà réelles ailleurs. Il faut brancher ce prototype sur l’existant, pas recréer la communauté.

Trois choses sont toutefois de vrais blockers avant un lancement mondial : **des uploads storage ouverts**, **une vue profils qui contourne la RLS**, et **un compteur de likes qui double-compte**. S’y ajoutent 7 migrations présentes en base mais absentes de `main`, et 60 % du contenu communautaire produit par des profils de démonstration.

---

## 2. Ce qui existe déjà (à réutiliser, pas à refaire)

### Données réelles

| Table | Lignes | État |
|---|---:|---|
| `user_profiles` | 157 | 19 profils `is_demo` |
| `community_posts` | 20 | 12 publiés par des profils démo |
| `post_comments` | 43 | 16 par des profils démo, réponses via `parent_id` |
| `post_likes` | 10 | 10 par des profils démo |
| `post_comment_likes` | — | table présente, likes de commentaires réels |
| `post_saves` | 0 | table prête |
| `user_follows` | 5 | follow réel |
| `carnets` | 35 | visibilité publique/privée |
| `hike_sessions` | 20 | sorties GPS réelles, D+, distance, tracé |
| `post_stories` | 7 | stories réelles |
| `story_highlights` | 0 | à alimenter depuis les stories |
| `conversations` / `messages` | 3 / 3 | messagerie réelle, pièces jointes, mentions, réactions |
| `notifications` | 200 | lues/non lues, liens profonds |
| `orders` | 3 | commandes réelles |
| `clubs` / `travel_groups` | 0 / 3 | clubs vides, groupes réels |
| `user_badges` / `loyalty_history` | 10 / 10 | gamification réelle |

### Fonctionnalités déjà codées

- `CommunityPostCard` : likes via RPC, saves, commentaires paginés, réponses, likes de commentaires, signalement, partage natif/lien, masquage, realtime partiel.
- `CommentItem` : édition, suppression, réponse, signalement.
- `messagingService` : envoi, réactions, réponses, transfert, pièces jointes, mentions.
- `ForwardMessageSheet` : sélection d’une conversation pour transférer.
- `CommunityStoriesBar`, stories v2, vues, likes, highlights.
- `PublicProfilePostsGrid`, `PublicMobileProfileView`, `EditProfileView`.
- `CommandesTab`, `CarnetsTab`, `AventuresTab`, `ParametresCompteCard`.
- Triggers serveur : compteurs likes/commentaires, notifications de like/commentaire/mention, quota quotidien (30 posts, 200 commentaires, 500 likes), guard parent same post, audience RLS.
- `get_user_signature` : statistiques de terrain respectant `signature_visibility`.

**Conclusion :** commentaires, likes, follows, messages, stories, signalement et notifications sont déjà faits. Le travail est un travail de **branchement**, pas de réinvention.

---

## 3. Ce qui manque ou est faux

### 3.1 Le Compte est un mock local

`compte-liquid-glass-v8-runtime.js` contient encore :

- `_MOCK_OUTINGS` / `OUTINGS`
- `_MOCK_CARNETS` / `CARNETS`
- `_MOCK_SPECIES` / `SPECIES`
- `_MOCK_TRIBU` / `TRIBU`
- `_MOCK_CLUBS` / `CLUBS`
- `S` (profil, commandes, notifications, réglages, stats)
- `X.postComments` (commentaires locaux)
- `messagingService` : conversations et messages de démonstration, fallback local.

Aucun de ces chemins n’écrit en base. Les likes/commentaires/partages du drawer Post ne touchent pas les tables réelles.

### 3.2 Partage dans les messages absent

`CommunityPostCard.handleShare` fait : partage natif ou copie du lien. Il n’existe **aucun** chemin « envoyer ce post dans une conversation ». `ForwardMessageSheet` transfère un message, pas un post. `community_posts.shares_count` existe mais n’est alimenté par aucun code ni trigger : c’est un compteur mort.

### 3.3 Sorties : la donnée existe, pas le modèle d’affichage complet

`hike_sessions` fournit : date, distance, durée, D+, tracé, carnet lié, visibilité. Il manque :

- `max_altitude_m` (non stocké) ;
- massif (dérivable de `hiking_routes.region` + `geo_massifs`, mais pas stocké) ;
- photos de sortie (aucune table `hike_session_photos`) ;
- statut de preuve/validation (le mock affiche « Vérifiée »).

### 3.4 Profils publics : consentement et démo

- `public_profiles` est une vue **security definer** (owner `postgres`, pas de `security_invoker`) : elle contourne la RLS de `user_profiles`.
- Elle expose bio, localisation, site, points, niveau, XP de **tous** les profils, y compris les 19 profils `is_demo`.
- `user_profiles` n’a pas de colonne `profile_visibility` ; seule `signature_visibility` existe.
- `user_follows` est lisible par `public` : le graphe social est exposé.

### 3.5 Contenus de démonstration en production

12 posts sur 20, 16 commentaires sur 43 et 10 likes sur 10 viennent de profils `is_demo`. En l’état, le lancement mondial montrerait un fil majoritairement artificiel.

### 3.6 Réaltime incomplet

Publication `supabase_realtime` : conversations, conversation_members, messages, message_reactions. **Pas** de `community_posts`, `post_comments`, `post_likes`, `notifications`. Les commentaires et notifications ne se mettent pas à jour en temps réel.

### 3.7 Longueur de contenu non bornée

- `community_posts.content` : CHECK 1–20 000, mais **NOT VALID**.
- `post_comments.content` : aucune limite.
- `messages.content` : aucune limite.
- Données actuelles dans les bornes (max 128 / 99), mais rien n’empêche un abus futur.

### 3.8 Migrations désynchronisées

- Base : **363** migrations, dernière `20261017191052`.
- `main` : **361** fichiers, dernier `20261015231000`.
- 7 migrations `20261017…` (geo_places, geo_massifs, geo_areas, geo_rivers, geo_sites, geo_trails, search RPC) viennent de la branche `claude/compas-p1-referentiel` et sont appliquées en base sans être dans `main`.

C’est une dérive de schéma à corriger avant toute nouvelle migration.

---

## 4. Sécurité — findings classés

### Critique

1. **Storage public avec upload ouvert**
   - `carnet-media` et `gear-photos` : buckets publics, politiques INSERT `roles={public}`, **sans aucun check**.
   - N’importe qui, y compris anonyme, peut uploader dans ces buckets.
   - Aucune limite de taille ni de type MIME sur ces deux buckets.
   - `group-media` est public ; `user-documents` n’a pas de limite.
   - `stories-private` : INSERT authentifié sans contrainte de dossier propriétaire.
   - `message-attachments` : INSERT authentifié sans vérification d’appartenance à la conversation.

2. **`public_profiles` security definer**
   - Contourne la RLS, expose tous les profils (dont démo), sans opt-in de visibilité.
   - La vue n’expose pas email/téléphone, mais expose localisation/site/points.

### Élevé

3. **Double comptage des likes**
   - `toggle_community_post_like` met à jour `likes_count` manuellement.
   - Le trigger `sync_community_post_likes_count` le met aussi à jour.
   - Résultat : dérive constatée sur 2 posts. Un like peut compter double.

4. **`spatial_ref_sys` sans RLS**
   - Table PostGIS système, `anon`/`authenticated` peuvent la lire directement.
   - Ce n’est pas une donnée utilisateur, mais c’est un finding ERROR du linter.
   - Remédiation à décider : révoquer l’accès API direct et/ou activer RLS avec accès interne PostGIS, après test des `ST_Transform`.

5. **41 tables avec RLS activée mais aucune policy**
   - Dont `rate_limit_windows`, `ops_*`, `progression_*`, `geo_*`, `trip_launches`, `user_territory_private`.
   - Elles ne fuient pas (RLS deny-all), mais des fonctionnalités peuvent échouer silencieusement.
   - À traiter par fonctionnalité, pas en masse.

### Moyen

6. `user_follows` lisible par tous : graphe social public.
7. 19 profils démo visibles dans les surfaces publiques.
8. `post_comments` SELECT vérifie seulement que le parent existe ; la visibilité du parent doit être testée sur des posts `abonnies`/`club`.
9. Politiques dupliquées (plusieurs policies pour le même commandement) : comportement difficile à auditer, coût RLS plus élevé.

---

## 5. Performance & scalabilité mondiale

### Constats

- 164 foreign keys sans index couvrant.
- Index dupliqués : `messages.idx_messages_conversation_id` vs `idx_messages_conv_created` (préfixe), `post_likes.idx_post_likes_post` vs unique `(post_id,user_id)`, `club_members`, `share_tokens`, `user_badges`.
- `notifications` : index `user_id` et `read` séparés, pas de composite `(user_id, read, created_at DESC)`.
- `post_comments` : index `post_id`, mais pas `(post_id, created_at)` ni `(parent_id, created_at)`.
- `community_posts` : index `created_at`, `author_id`, `post_type`, `audience/club` partiel ; pas de composite `(audience, created_at DESC)`.
- Vues matérialisées exposées dans l’API (`country_centroids`, `country_trail_density`, `kit_*`, `trail_density_geohash5`, `user_field_signature`) : stratégie de refresh à documenter.
- Une seule région DB (`eu-west-3`) pour un lancement mondial : latence élevée depuis US/Asie ; il faudra réplique de lecture, cache CDN et/ou régionalisation.
- Pas de preuve de PITR/backups lue ici ; à confirmer dans le dashboard.
- Pas de `pg_stat_statements` exploité dans cet audit ; à activer pour le suivi des requêtes lentes.

### Index prioritaires (proposition)

```sql
create index if not exists idx_notifications_user_unread_created
  on public.notifications (user_id, read, created_at desc);

create index if not exists idx_post_comments_post_created
  on public.post_comments (post_id, created_at);

create index if not exists idx_post_comments_parent_created
  on public.post_comments (parent_id, created_at);

create index if not exists idx_community_posts_audience_created
  on public.community_posts (audience, created_at desc);

create index if not exists idx_hike_sessions_user_started
  on public.hike_sessions (user_id, started_at desc);
```

Ne pas appliquer en masse : mesurer avant/après avec `EXPLAIN (ANALYZE, BUFFERS)`.

---

## 6. Plan directeur — 5 vagues

### Vague 0 — Sécuriser et stabiliser la base (bloquant)

1. **Storage** : remplacer les policies ouvertes par :
   - `carnet-media`, `gear-photos` : authenticated seulement, dossier = `auth.uid()`, MIME image uniquement, taille max 10 Mo.
   - `group-media` : lecture réservée aux membres du groupe, upload membre, 10 Mo.
   - `stories-private` : INSERT avec `foldername[1] = auth.uid()`.
   - `message-attachments` : INSERT avec `is_conversation_member(foldername[1], auth.uid())`.
   - `user-documents` : MIME PDF/image, 15 Mo.
2. **Like** : supprimer la mise à jour manuelle dans `toggle_community_post_like` ; garder le trigger comme seule source. Corriger les 2 compteurs dérivés.
3. **Profils** : remplacer la vue security definer par une projection sûre :
   - `profile_visibility` (`private` / `communaute` / `public`), défaut `communaute` ;
   - filtre `is_demo = false` sur les surfaces publiques ;
   - `security_invoker = true` + policy SELECT publique limitée aux champs publics.
4. **Migrations** : merger les 7 migrations compas dans `main` ou les rejouer proprement ; ajouter un contrôle CI `supabase db diff` / liste des migrations distantes.
5. **Longueurs** : valider le CHECK posts, ajouter 5 000 caractères comments, 10 000 messages.
6. **`spatial_ref_sys`** : révoquer `anon/authenticated` ou activer RLS avec accès interne, après test PostGIS.

**Critère de sortie :** 0 finding ERROR Supabase, storage non écrivable par anon, compteurs likes exacts, migrations alignées.

### Vague 1 — Les drawers justes (UI, sans base)

1. **Scroll** : une seule surface de scroll pleine largeur, padding intérieur sur les lignes (comme `.card-scroll`), pas de coupe horizontale, fade bas + safe area.
2. **Sélecteur** : copie exacte de `.tb` — 48 px, padding 2 px, lentille à 4 px des bords, icône 19 px, label 10 px, même verre/ombre/états, aucun scale 1.16, aucune sortie de cadre.
3. **Swipe sorties → grille** : le carrousel capture le geste. Déclencher depuis le bord/gouttière, en fin de carrousel, ou après un geste franc ; test tactile réel.

**Critère de sortie :** capture 393/375, diff géométrique sélecteur ≤ 1 px avec la bottom bar, 20/20 gestes, aucun scroll horizontal coupé.

### Vague 2 — Communauté réelle dans le Compte

1. **Post drawer** : remplacer `X.postComments` par les lectures/écritures `community_posts`, `post_likes`, `post_comments`, `post_saves` ; réutiliser la logique de `CommunityPostCard` via un hook partagé, pas une copie.
2. **Comments drawer** : liste paginée, réponses, likes de commentaires, signalement, suppression, mentions ; composer réel ; realtime.
3. **Partage universel** : un `ShareSheet` unique :
   - envoyer dans une conversation via `messagingService.sendMessage(..., 'post', metadata)`;
   - incrémenter `shares_count` via RPC atomique ;
   - créer une notification ;
   - copier le lien / partage natif.
4. **Profil** : ouvrir le profil réel depuis un commentaire, un like, un partage.
5. **Realtime** : ajouter `post_comments` et `notifications` à la publication ; ne pas ajouter le feed complet.

**Critère de sortie :** deux comptes, commentaire/réponse/like/suppression/signalement/partage dans un message, rechargement, realtime, RLS.

### Vague 3 — Tous les drawers en vraie donnée

| Drawer | Source | Action |
|---|---|---|
| Profil | `user_profiles`, `community_posts`, `user_follows` | lecture + édition réelle |
| Abonnés / abonnements | `user_follows` + `public_profiles` | follow/unfollow |
| Grille | `community_posts`, `carnets` | pagination + ouverture post |
| Sorties | `hike_sessions`, `hiking_routes`, `geo_massifs` | D+ réel, massif dérivé ; ajouter `max_altitude_m` et `hike_session_photos` |
| Post | `community_posts`, `post_likes`, `post_saves` | réutiliser le hook social |
| Commentaires | `post_comments`, `post_comment_likes` | réel + realtime |
| Compte | `orders`, `notifications`, `notification_preferences` | états vides réels |
| Stories | `post_stories`, `story_highlights` | highlights réels |
| Clubs / Tribu | `clubs`, `group_members`, `travel_groups` | réel |
| Partage | `conversations`, `messages` | `ShareSheet` |

**Architecture :** garder la coque et les gestes v20 ; remplacer chaque contenu par un îlot React branché sur des hooks/services. Un flag par drawer permet de basculer réel/démo, puis on supprime le démo.

**Critère de sortie :** aucun `_MOCK_`, `S`, `OUTINGS`, `CARNETS`, `TRIBU`, `CLUBS`, `X.postComments` dans le chemin Compte ; chaque drawer a loading / vide / erreur.

### Vague 4 — Retrait des mocks et préparation mondiale

1. Supprimer `buildDemoConversations`, `localDemoMessages`, les fallbacks démo de `messagingService`.
2. Supprimer les 19 profils `is_demo` des surfaces publiques ; décider purge ou conservation staging.
3. Ajouter les index prioritaires, supprimer les index dupliqués.
4. Ajouter rate limits sur commentaires/messages/partages (les quotas existent pour posts/likes/comments, vérifier messages).
5. Observabilité : `pg_stat_statements`, slow query log, alertes erreurs, suivi des files.
6. Backup/PITR, test de restauration.
7. Latence mondiale : réplique de lecture, cache CDN, images optimisées, tests depuis US/Asie.
8. RGPD : visibilité profil, export/suppression, durée de conservation, consentement.

**Critère de sortie :** 0 mock, 0 finding critique, tests E2E deux comptes, p95 < 100 ms sur les requêtes chaudes, restauration testée.

---

## 7. Décisions à prendre avant la vague 3

| Sujet | Recommandation |
|---|---|
| Visibilité profil par défaut | `communaute` (connectés), `public` en opt-in |
| Profils démo | exclus des surfaces publiques ; conservation staging uniquement |
| Photos de sortie | nouvelle table `hike_session_photos` (storage privé) |
| Altitude max | colonne `hike_sessions.max_altitude_m` |
| Partage | message `message_type='post'` + table `post_shares` pour l’analytique |
| Réplique DB | réplique de lecture avant lancement US/Asie |
| Migrations compas | merger dans `main` avant toute nouvelle migration |

---

## 8. Ce qu’il ne faut pas faire

- Ne pas reconstruire les commentaires, likes, follows, stories, messages : ils existent.
- Ne pas brancher le runtime de 4 700 lignes ligne par ligne sur Supabase : créer des hooks/adaptateurs et des îlots React.
- Ne pas supprimer les mocks avant que le drawer réel soit vérifié.
- Ne pas ajouter d’index en masse sans `EXPLAIN`.
- Ne pas activer RLS sur `spatial_ref_sys` sans tester PostGIS.
- Ne pas purger les profils démo sans décision produit.

---

## 9. Ordre d’exécution

1. Vague 0 — sécurité base.
2. Vague 1 — drawers (scroll, sélecteur, swipe).
3. Vague 2 — commentaires et partage réels.
4. Vague 3 — profil, grille, sorties, compte, stories, clubs.
5. Vague 4 — suppression des mocks, performance, monde.

Chaque vague est un plan exécutable séparé, avec tests et revue. La vague 1 peut démarrer immédiatement ; la vague 3 attend les décisions du §7.
