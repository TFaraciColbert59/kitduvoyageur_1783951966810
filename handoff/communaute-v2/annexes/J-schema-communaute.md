# J — Audit schéma / écritures / outillage pour la refonte de /communaute (lecture du code, aucune modification)

`R` = `/home/claude/tfaracicolbert59/kitduvoyageur_1783951966810`. Abréviations : `BL` = supabase/baseline/prod_schema_20260911.sql ; `M/` = supabase/migrations/ ; `FC/` = src/features/community/create/ ; `CARD/` = src/features/community/card/.
**« État le plus récent »** = BL (dump prod du 11 sept.) + migrations postérieures au 20260911 : c'est ce que rejoue la CI (scripts/db/ci/install.sh:3-12 ; les 143 migrations de baseline/applied_migrations.txt sont réputées déjà dans BL). Aucune base vivante interrogée.

## 0. Constats structurants

1. **Deux arbres de formulaires** : `/communaute` monte `FC/` (app/communaute/page.tsx:12,21). `CARD/` (ExplorerDrawer, CreateDrawer, wizard) n'est importé par aucun fichier hors de lui (seule référence : tests/design/community-feed-contract.spec.ts:7,36,73) ; variante non branchée (§3.1).
2. **Aucune création ne passe par RPC ni route API** : 6 flux = `insert` clients séquentiels, non atomiques (§3).
3. **`snapshot_payload` perdu** : Post et Sortie y écrivent options/niveau/RDV (FC/upload.ts:67) mais `trg_snapshot_community_post_carnet` force `NULL` si `linked_carnet_id IS NULL` (M/20260911530000_phase7_carnet_private_default.sql:94, trigger l.137). La colonne prévue `community_posts.creation_meta jsonb` existe (M/20261026130000_creation_meta.sql:1-2) mais aucun code `src/` n'y écrit.
4. **`carnet-media` incompatible avec l'UI** : images seules (jpg/jpeg/png/webp/heic/heif), ≤ 10 Mo (M/20261021093000_worldwide_security_hardening.sql:14-25, 72-75) ; FC/upload.ts:6-7,17-19 envoie images ET vidéos jusqu'à 50 Mo (déduit, non testé).
5. **Club `closed` non rejoignable** : `club_members_self_join` exige `clubs.privacy='open'` (M/20261013000000_club_members_lockdown.sql:39-49) alors que le form propose `open|closed` (FC/engine/createSchemas.ts:45) ; aucun code `src/` n'écrit `club_join_requests` (grep négatif).
6. **`clubs.rules` introuvable** dans BL (BL:4449-4466) ; seule M/20260713120000_community_features.sql:105 l'ajoute (migration déjà dans le ledger, applied_migrations.txt:7), aucune migration > 0911 ne touche `clubs`. Or FC/ClubCreateForm.tsx:118 l'insère → à vérifier sur la base réelle. **`clubs.is_private` introuvable** mais sélectionné par src/components/clubs/ClubLiquidGlassV8.tsx:896.
7. **Stories** : bucket `stories-private` = 25 Mo (M/20261013280000_stories_v2_private_media.sql:169 ; policy 20261021093000:36-41) vs UI « 50 Mo » (FC/upload.ts:7,114).
8. **Posts « pont » rejetés** : `trg_community_post_restricted_media` refuse tout post `audience<>'public'` avec `image_url`, `media_urls`, `linked_carnet_id` ou `snapshot_payload` (M/20261015231000_community_restricted_media_club_hardening.sql:3-13, l.20) ; et `validate_community_post_shared_kit` exige un kit public de l'auteur (M/20261014221000_community_post_media_and_reproduction.sql:22-27). Ponts concernés : Carnet non public (CarnetMapDrawer.tsx:535), Kit privé (KitCreateForm.tsx:169-176), Club avec cover (ClubCreateForm.tsx:138-147). Tous dans des `try/catch` muets (ClubCreateForm.tsx:149, KitCreateForm.tsx:178, SortieCreateForm.tsx:223) → échec invisible.

## 1. Schéma courant

### 1.1 `events` (BL:4892-4912 + M/20261013270000)
- Colonnes : `id uuid PK`, `title NOT NULL`, `type text default 'rando'` (aucun CHECK), `emoji`, `organizer_id uuid`, `event_date date NOT NULL` (pas d'heure), `duration text`, `location text`, `country default 'France'`, `max_participants int default 10`, `current_participants int default 0`, `description`, `cover_image`, `cover_alt`, `shared_kitty`/`kitty_goal numeric default 0`, `min_trust_to_organize`, `status default 'upcoming'`, `created_at`. CHECK `events_status_check` upcoming/full/past/cancelled (M/20261013270000_event_cancellation.sql:17-18). Aucun lat/lng/niveau/prix/club_id/visibilité.
- Index : `idx_events_date` (BL:9397), `idx_events_status` (BL:9401), `idx_events_title_trgm` GIN (M/20261028160000_community_search_and_club_counts.sql:35).
- RLS : `public_read_events` true (BL:14178) ; `auth_insert_events` organizer=uid (BL:12713) ; `auth_update_events`/`auth_delete_events` organisateur ou admin (M/20260911570000_phase8b_permissive_policy_hardening.sql:141-149) ; `auth_manage_events` supprimée (l.138). Pas de trigger sur `events`.

### 1.2 `event_participants` (BL:4881-4888)
- `id, event_id, user_id, created_at` ; UNIQUE (event_id,user_id) (BL:8070) ; index event_id/user_id (BL:9389,9393). Pas de statut (pas de liste d'attente).
- RLS : lecture publique (BL:14174), insert/delete propre (BL:12709,12625), ALL propre `users_manage_own_participations` (BL:14884).
- Triggers (M/20261013060000_event_participant_invariants.sql:97-110, corps final M/20261013270000) : `guard_event_participant_insert` (BEFORE INSERT, verrou, refuse past/cancelled/complet), `sync_event_participants_count` (AFTER INSERT/DELETE, recount + full/upcoming), `guard_event_participant_identity` (BEFORE UPDATE, clés immuables).
- À part : `club_events` (BL:4326-4337, `event_date timestamptz`, club_id) + `club_event_participants`, RSVP via `/api/compte/clubs` (route.ts:265) avec adhésion active (M/20261022111000_club_event_rsvp_members_only.sql). Non utilisée par /communaute. La « sortie » du tiroir /compte = `hike_sessions` + bucket `outing-media` (src/features/compte/server/sorties.ts:236).

### 1.3 `clubs` (BL:4449-4466)
- `id PK`, `slug NOT NULL UNIQUE` (BL:7925), `name NOT NULL`, `type default 'activite'`, `emoji`, `description`, `cover_color`, `cover_image`, `category default ''`, `privacy text default 'open'` (AUCUN CHECK ; valeurs vues : open, closed, secret), `members_count`, `active_this_month`, `is_verified`, `created_by`, `created_at`, `updated_at`, `country_iso`. Pas de lat/lng, pas de nom unique.
- Index : `idx_clubs_type` (BL:9205), `idx_clubs_country_iso` (BL:9201), `idx_clubs_name_trgm` GIN (M/20261028160000:34).
- RLS : `clubs_read` true (M/20260731120000_clubs_public_read_policy_fix.sql:11-13) → tout club lisible, même `closed` et en anon ; insert créateur (BL:12701) ; update/delete créateur ou admin (BL:12943,12621).
- Trigger `trg_sync_club_members_count` (AFTER INSERT/DELETE/UPDATE OF status,club_id sur `club_members`) recalcule `members_count` = actifs (M/20261028160000:39-71). Le client écrit encore le compteur à la main (sections/useCommunitySections.ts:~184,210 ; ClubCreateForm.tsx:121).

### 1.4 `club_members` et `club_join_requests`
- `club_members` (BL:4359-4368) : `id, club_id, user_id, role` CHECK admin/moderator/member, `status` CHECK active/banned/pending (défaut active), `joined_at`. UNIQUE (club_id,user_id) (BL:9181) ; index club/user (BL:9173,9185).
- Policies (M/20261013000000_club_members_lockdown.sql) : lecture publique (l.31) ; `club_members_self_join` member/active si club `open` (l.39-49) ; `club_members_creator_admin` (l.54) ; `club_members_admin_insert` (l.69) ; `club_members_admin_moderate` (l.85) ; `club_members_self_delete` (refait : un banni ne se supprime pas, M/20261022109000_club_ban_not_self_deletable.sql:4).
- Trigger `guard_club_member_privileged_columns` BEFORE INSERT/UPDATE/DELETE (M/20261013000000:180 ; version finale avec garde « dernier admin » M/20261013190000_club_last_admin_guard.sql:17-121).
- `club_join_requests` (BL:4343-4353) : `id, club_id, user_id, message, status` CHECK pending/approved/rejected, `reviewed_by, created_at, updated_at` ; UNIQUE (club_id,user_id) (M/20260731160000_club_requests_likes_rls_policies.sql:10-12) ; policies select/insert (l.18,32), `_moderate` (M/20260731171500_club_join_requests_moderate_with_check_tighten.sql:15-17), `_self_update` (M/20260731170000_club_members_policy_escalation_fix.sql:92-94). Aucun trigger/RPC « demande approuvée → club_members » (introuvable).

### 1.5 Kits : `materiel_kits` / `materiel_kit_items` (les `kits`/`kit_items` historiques sont vides, M/20261107123212_gear_taxonomy.sql:164)
- `materiel_kits` (BL:5758-5782) : `user_id NOT NULL`, `name NOT NULL`, `description`, `season` CHECK printemps/ete/automne/hiver/toute_saison, `total_weight_g` (calculé par le client, aucun trigger), `is_public`, `is_favorite`, `is_trashed`, `cover_image_url`, `tags text[]`, `search_vector`, `consumables`, lignée (`forked_from`, `origin`…), + `bag_model(_id)`, `custom_parts`, `bag_parts`, `studio_revision` (M/20261031210000_kit_studio_bag_config.sql:3-7). Pas de catégorie/activité au niveau kit.
- `materiel_kit_items` (BL:5737-5755) : `kit_id, user_id, product_ownership_id, quantity>0, category text libre, weight_g, is_checked, name, product_id, item_key` + `ownership, owner_id, condition, reason, priority, is_vital` (M/20260911540000_phase5_kit_completeness.sql:69-117), `slot_id, slot_order` (M/20261031210000:27-28), `function_id, zone, slot, load_order, carry_mode` (M/20261107123212:135-140).
- Index : user_id (BL:9697), public partiel (BL:9689), search GIN (BL:9693), items kit_id/user_id (BL:9681,9685). Triggers lineage/search_vector/updated_at (BL:10365-10373), `trg_materiel_kits_aliases_sync` (M/20261031210000:58).
- RLS : kits `select_own_or_public` (BL:13778), insert/update/delete own (BL:13774,13782,13770), `select_group` (M/20261031220000_kit_group_read.sql:79) ; items own (BL:13751-13763) + lecture via parent public (M/20261014231000_public_shared_kit_items_rls.sql:4) + `select_group` (kit_group_read:87).
- RPC existante : `replace_kit_items(p_kit_id, p_items jsonb, p_allow_empty)` SECURITY DEFINER, transactionnelle (M/20261031200000_replace_kit_items_rpc.sql) — non utilisée par KitCreateForm.

### 1.6 `community_posts` (BL:4488-4503 + migrations)
- BL : `id, author_id, content NOT NULL, image_url, image_alt, post_type` CHECK post/tip/question/share, compteurs, `is_trending`, `title`. Ajouts : `correlation_id`, `linked_carnet_id` FK (M/20260911500000_phase2_chain_integrity.sql:~64-100), `snapshot_payload/_at/snapshot_exclude_location` (M/20260911530000:58-60), `mentions uuid[]` (M/20261013150000_post_mentions.sql:17), `client_request_id` + UNIQUE partiel (author_id,client_request_id) + CHECK longueur 1-20000 (M/20261013210000_publish_idempotency_and_drafts.sql:17-35), `media_urls jsonb` ≤ 10 + `linked_kit_id` (M/20261014221000:2-9), `audience` public/abonnies/club + `club_id` (M/20261015220000_community_post_audience_rls.sql:2-9), `reposted_from_id` (M/20261022100000_profile_visibility_invitations.sql:22), `creation_meta` (M/20261026130000), `soundtrack_*` (M/20261030091225_community_post_soundtrack_metadata_opt_in.sql:2-5).
- **Pas de colonnes lieu/tags/lat-lng** : concaténés dans `content` (PostCreateForm.tsx:199-202). Pas de table média de post (`media_urls` seul).
- Index : created_at (BL:9229), author_id (BL:9221), post_type (BL:9233), `idx_community_posts_content_trgm` GIN (M/20261028160000:32), partiels linked_carnet/linked_kit/audience-club.
- RLS : lecture `community_posts_select_audience` (public / auteur / abonnés / membres actifs du club, hors `user_blocks`) (M/20261015220000:45-75) ; insert/update/delete auteur (BL:12705,12973,12651) ; `auth_like_community_posts` supprimée (M/20260911550000_phase8_rls_hardening.sql:109) ; likes par RPC `toggle_community_post_like` (M/20261021093000:91).
- Triggers : snapshot (§0.3), `trg_validate_community_post_shared_kit` (M/20261014221000:31), `trg_community_post_audience` (adhésion active requise, M/20261015220000:35), `trg_community_post_restricted_media` (§0.8), mentions (M/20261013150000:83), repost (M/20261023151000_notification_activity_triggers.sql:118).
- Brouillons serveur `community_post_drafts` existent (M/20261013210000:46) mais FC/ utilise localStorage.

### 1.7 `post_stories` (M/20261013160000_stories.sql:21-31 puis M/20261013280000_stories_v2_private_media.sql)
- `id, author_id NOT NULL, image_url` (nullable v2), `caption ≤280`, `visibility` CHECK public/followers/close_friends/club/only_me (v2 l.34-36), `club_id`, `expires_at default now()+24h` (stories.sql:28), `created_at`, + v2 : `media_type` image/video/text, `storage_bucket/path` (paire cohérente), `mime_type, width, height, duration_ms` CHECK 1..60000, `poster_path`, `composition(_version)`, `status` processing/ready/failed/removed, `client_request_id text` UNIQUE partiel, `reply_policy` everyone/followers/off, `allow_reshare`, `moderation_state`, `archived_at`.
- Index : (author_id, created_at DESC), (expires_at), client_request. RLS : lecture `stories_read_visible` = `can_view_story()` SECURITY DEFINER (blocages, masqués, followers, close friends, club) (v2 l.154) ; insert propre (l.159) ; delete propre ; restrictive anti-anonyme. Média servi par app/api/stories/[id]/media/route.ts:29. Satellites : story_reports/close_friends/hidden_users/views/likes/comments/highlights.
- Flag `feature_flags('stories_v2', false)` (M/20261013281000_stories_v2_flag.sql:3) ; lecture dans `src/` introuvable.

### 1.8 `carnets` (BL:4203-4234 + migrations)
- `id, author_id, title NOT NULL, destination NOT NULL, description, cover_image(_alt), start_date, end_date, weather, route_rating, visibility` (défaut `private` depuis M/20260911530000:17-18 ; aucun CHECK en BL), `tags, compteurs, map_points jsonb default '[]', is_collaborative, groupe_id, distance_km default 27.4, denivele_m default 1620, nb_nuits default 2, nb_voyageurs default 6, lieu_depart/arrivee` (défauts d'exemple dans BL), `country_iso, trip_id`, + `live_sharing` (M/20261108100004_carnet_v2_lot_d_nights_verdicts_live.sql:69), `correlation_id`.
- Index BL:9125-9149 (+ title trgm, M/20261028160000:33). RLS : lecture public ou auteur (BL:12168,13098), insert (BL:12050), ALL propriétaire (BL:13102). Satellites Carnet v2 (carnet_media, carnet_moments, carnet_nights, carnet_live_positions, carnet_day_*, carnet_moment_*) avec .down.

### 1.9 Profils, abonnements, lieux
- Profil = `user_profiles` (pas `profiles`) : BL:4980-5003 ; `location text default ''` (texte libre, **aucune lat/lng**), `handle NOT NULL` UNIQUE lower() (M/20261021120000_account_real_data_foundation.sql:5-6), `profile_visibility` CHECK public|prive (M/20261022100000:15-19), `is_demo`. Lecture sociale par la vue `public_profiles` (M/20261030085637_show_original_demo_seed_authors_alongside_curated_profiles.sql:3-5). Aucun index trigram sur nom/handle.
- `user_follows` (BL:7600-7605) : `follower_id, following_id`, UNIQUE (BL:10217), index (BL:10209,10213), lecture publique (BL:12258), écriture propre (BL:12114,12879), trigger activité (M/20261023151000:46) ; `follow_requests` (M/20261023090000_three_drawers.sql:53, policies M/20261023091000_three_drawers_rls.sql:40-50).
- Géo : `places` avec `geom geography(Point,4326)` (M/20260905110000_community_places.sql:18-20) non reliée à events/clubs/posts.

## 2. RPC et extensions

- **Extensions** : `postgis` (M/20260811000000_geodata_phase2_schema.sql:17), `pg_trgm` (même fichier :18 ; schéma `extensions` ou `public` selon l'environnement, M/20261028160000:15-37), `unaccent` (M/20260907000000_unify_crews_trips_rls.sql:11), `pg_cron` (M/20261008180000_anonymous_trial_purge.sql:50). `earthdistance`, `cube`, `pgvector` : introuvables. CI : PostGIS, pgTAP, pg_cron (.github/actions/ephemeral-postgres/action.yml:3-5).
- **Recherche communauté = `ilike '%q%'` côté client, aucune RPC** : sections/CommunitySectionsDrawer.tsx:181-200 (posts.content, carnets.title, clubs.name, events.title, `public_profiles` nom/handle) ; variante CARD/sections/useCommunitySearch.ts:34-38. Seuls index : 4 GIN trigram bruts (M/20261028160000:32-35), sans `unaccent`.
- **Listes** : sections/useCommunitySections.ts:75-92 (carnets 12 récents, clubs `select *` tri members_count, events `event_date>=today` `status<>cancelled`, limit 12), appartenance/inscription en requêtes séparées (l.109-114). Feed : lecture directe (features/community/feed/useCommunityFeed.ts:124). RPC « nearby » ou « feed » communautaire : introuvable. Repli accents réutilisable : `geo_places_search_norm` (M/20261017140000_geo_places_search.sql:29-41), mais `geo_places_search` est réservé service_role (l.~90).
- **RPC communauté existantes** : `join_event` (M/20261013270000:21, SECURITY DEFINER, verrou, refuse past/cancelled/complet), `leave_event` (M/20260911570000_phase8b…:422 ; grants l.467-468), `toggle_community_post_like`, `can_view_story`, `is_club_member` (M/20260913040000_tribu_club_bridge.sql:11), `replace_kit_items`, `current_feature_flags[_for]`.

## 3. Écritures actuelles par flux (arbre monté `FC/`)

Tous : client navigateur (`createClient`), RLS seule garde ; aucune server action. S = séquentiel non atomique.

| Flux | Fichier:ligne | Tables écrites | Atomicité |
|---|---|---|---|
| Post | FC/PostCreateForm.tsx:200-210 → FC/upload.ts:52-72 | Storage `carnet-media` (upload immédiat, upload.ts:14-31) puis `community_posts` | 1 insert ; médias déjà envoyés (orphelins si abandon) |
| Post « événement » | PostCreateForm.tsx:156-193 | `events` (type 'rando', pays 'France' codés en dur) PUIS `community_posts` (`share`) | S, sans rollback : event conservé si le post échoue |
| Story | FC/StoryCreateForm.tsx:136-153 ; upload FC/upload.ts:109-152 | Storage `stories-private` puis `post_stories` | S ; nettoyage Storage si insert échoue (l.154) ; trim non écrit |
| Carnet | FC/CarnetMapDrawer.tsx:524-534 (monté CreateDrawer.tsx:116) ; FC/CarnetCreateForm.tsx:144 = orphelin | `carnets` (`map_points` = objet `{trace,days}`, `cover_image:''`, médias des moments retirés l.526) puis pont `community_posts` muet (l.535) | S ; ni `carnet_media` ni `carnet_moments` |
| Sortie | FC/SortieCreateForm.tsx:193-199 (ligne l.111-137), pont l.207-223 | `events` puis `community_posts` (muet). Niveau/RDV/distance/dénivelé/attente/sécurité encodés en texte dans `description` (l.77-89) ; snapshot perdu (§0.3) | S ; `current_participants:0`, kitty 0 en dur |
| Kit | FC/KitCreateForm.tsx:125-176 | `materiel_kits` (l.127) puis `materiel_kit_items` (l.164) puis pont (l.169) | S, sans rollback : items KO → kit vide persistant ; poids calculé client (l.121-122) |
| Club | FC/ClubCreateForm.tsx:108-150 | `clubs` (slug = slugify + 4 car. aléatoires, l.105-106 ; `rules` = règles + questions concaténées, l.56-70 ; lieu dans `description`, l.99-103) puis `club_members` admin (l.128-134) puis post bienvenue muet (l.138) | S, sans rollback : club orphelin possible ; l'ordre est imposé par `club_members_creator_admin` |

### 3.1 Variante non branchée `CARD/create/`
KitCreateForm.tsx:105-124 : même séquence mais **rollback manuel** (`delete` du kit si items KO, l.122). ClubCreateForm.tsx:85 : contrôle « nom pris » par `ilike` ; l.127-149 mêmes inserts. SortieCreateForm.tsx:130 (events + pont), StoryCreateForm.tsx:81, upload.ts:42-45,77 (même bucket).

## 4. Buckets Storage (médias)

- `carnet-media` : public ; 10 Mo, images seules ; SELECT public « Lecture publique carnet-media » (M/20260718160000_storage_buckets_carnet_media.sql:26-30) ; INSERT `carnet_media_insert_owner` (1er dossier = uid ou `community-posts/<uid>`, ≤10 Mo, extensions images) (M/20261021093000:14-25) ; ancienne policy d'upload supprimée (l.8). Pas de policy UPDATE/DELETE vue.
- `stories-private` : privé, 25 Mo, jpeg/png/webp/heic/heif/mp4/quicktime/webm (M/20261013280000:167-171) ; INSERT `stories_private_insert_owner` (M/20261021093000:36-41) ; SELECT/DELETE propriétaire (M/20261013280000:181-194) ; lecture tiers par API serveur.
- `outing-media` (privé, 25 Mo, images) pour les sorties /compte (M/20261021120000_account_real_data_foundation.sql:126-157). Hors périmètre : gear-photos, group-media (M/20260815000000:272), message-attachments (M/20260831000000:412), bag-models, product-images, user-documents.
- EXIF retiré côté client pour les images seulement (upload.ts:21).

## 5. Parcours d'adhésion actuels

**Club** : (1) tiroir Explorer : insert `club_members(member, active)` + `update clubs.members_count` (sections/useCommunitySections.ts:175-195) ; quitter = delete (l.~200-215) ; réussit seulement si club `open` ; sinon toast « Action impossible. ». (2) `POST /api/compte/clubs` join/leave/rsvp (src/app/api/compte/clubs/route.ts:185-264) : idempotent si actif, 409 `membership_pending`, 403 si banni, mais même insert `member/active` (l.206) donc mêmes limites RLS ; consommé par components/compte/drawer/ClubDrawer.tsx:212,263. (3) `club_join_requests` : table prête, aucun écrivain, aucune approbation. Modération : seuls admin/modérateur actifs ajoutent ou changent rôle/statut (club_members_lockdown.sql:69,85) ; dernier admin protégé.
**Sortie** : RPC `join_event`/`leave_event` (useCommunitySections.ts:267-272). Validation base : verrou, refus past/cancelled/complet (« événement complet »), idempotence ON CONFLICT (M/20261013270000:21-81), trigger identique sur insert direct. Pas de liste d'attente, pas de validation organisateur, pas de lien à un club (`events` sans club_id).

## 6. Conventions de migration, tests, CI

- **Nommage** : `supabase/migrations/YYYYMMDDHHMMSS_slug.sql` (426 fichiers) ; 7 exceptions à 8 chiffres (20261030_explorer_v2_worldwide.sql … 20261107_explorer_v2_offline_activity.sql) ; fichiers `*_hotfix.sql` auto-horodatés. Voisins : migrations_deferred/, migrations_frozen/, proposals/, replay/, baseline/.
- **Rollback** : `supabase/migrations_down/<version>_<slug>.down.sql` (61 fichiers). Exemples : migrations_down/20261028160000_community_search_and_club_counts.down.sql (drop trigger, fonction, 4 index ; garde pg_trgm), migrations_down/20260907000000_unify_crews_trips_rls.down.sql. Règle : CLAUDE.md:18.
- **pgTAP** : supabase/tests/database/*.test.sql (99 fichiers), pattern `BEGIN; plan(n); fixtures auth.users + user_profiles; …; ROLLBACK`. Exemples : club_members_security.test.sql (plan 17), event_participants_invariants.test.sql (plan 9) ; utiles aussi : community_audience_rls, stories_v2_access, club_last_admin, event_cancellation, public_shared_kit_items. Lancement : `bash scripts/db/ci/run_pgtap.sh` (pg_prove, DATABASE_URL requis ; scripts/db/ci/run_pgtap.sh:15-26).
- **CI** (.github/workflows/) : `ci.yml` « LKDV Unified Quality Gates » (push main/chantier/**/audit/**/feature/community-instagram-inspired-v1 + PR → main, ci.yml:3-8) : jobs `quality-gates` (l.18 : type-check l.41, lint l.44, garde design tests/design/unification.spec.ts l.47, `npm test` l.50, build l.53, E2E Playwright l.86, axe l.123), `visual-gates` (l.133), `e2e-compas` (l.176), **`database-gates`** (l.253-268 : Gate DB.1 Postgres 17 éphémère via ./.github/actions/ephemeral-postgres ; Gate DB.2 pgTAP), `perf-explorer` (l.276). `database-gates` est un job de ci.yml, pas un workflow. `db-backup.yml` « Sauvegarde de la base » : cron `23 2 * * *` (l.15), pg_dump chiffré, artefact 7 jours (l.83), secrets SUPABASE_DB_URL/BACKUP_PASSPHRASE. Autres : lkdv-chantier-checks.yml, visual-regression.yml, lighthouse-ci.yml, ops-alerts.yml, geo-*.yml, ios*.yml.

## 7. Feature flags et commandes de test

- **Flags** : table `feature_flags(id, enabled, scope, updated_at, updated_by)` (BL:5134-5140) lue par RPC `current_feature_flags()` / `_for(user)` (src/features/hub/server/featureFlags.ts:60-80). Flag communauté connu : `stories_v2` (jamais lu). `NEXT_PUBLIC_*` : aucun flag communauté ; existants : `NEXT_PUBLIC_I18N_{EN,ES,DE,IT}_ENABLED` (.env.example:192-196), `NEXT_PUBLIC_FF_ITINERARY_FALLBACK` (:198), `NEXT_PUBLIC_EXPLORER_GPS_SIMULATION` (:202), `NEXT_PUBLIC_KEEP_TRIAL` (:218). Aucun interrupteur ancien/nouveau tiroir ; `CARD/` n'est piloté par aucun flag.
- **Commandes** (package.json) : lint `next lint` (l.46) ; typecheck `npm run type-check` = `tsc --noEmit` (l.50) ; unit `npm test` = `vitest run` (l.51 ; include tests/**/*.spec.ts(x) et src/**/__tests__/**/*.test.ts(x), vitest.config.ts:25) ; e2e `npm run test:e2e` = `playwright test` (l.52), `test:e2e:mobile` (l.54), `test:visual` (l.56), `test:a11y` (l.78) ; `verify:invariants` (l.64) ; build `next build` (l.43).

## 8. Écarts pour la refonte

| Besoin | État | Détail |
|---|---|---|
| RPC recherche plein texte / floue (accents) | **Manquant** | `ilike` client (CommunitySectionsDrawer.tsx:181-200). Disponibles : pg_trgm, unaccent, 4 GIN bruts ; rien sur `user_profiles` ; `materiel_kits.search_vector` (BL:9693) |
| RPC « à proximité » | **Manquant** | PostGIS actif mais aucun lat/lng/geom sur events, clubs, user_profiles |
| RPC feed paginé | **Manquant** | lecture directe `community_posts` |
| `create_club_with_admin` | **Manquant** | séquence client (ClubCreateForm.tsx:109-147) ; la policy/trigger acceptent l'admin créateur (club_members_lockdown.sql:54-65) |
| `create_event_with_post` | **Manquant** | PostCreateForm.tsx:157-193, SortieCreateForm.tsx:194-223 ; utiliser `creation_meta` (existe) |
| `join_club` / `request_join` / approbation | **Manquant** (tables et policies prêtes) | §1.4, §5 |
| `join_event` / `leave_event` | **Existe** | M/20261013270000:21 ; M/20260911570000:422 |
| `create_kit_with_items` | **Manquant** | `replace_kit_items` existe mais sur kit déjà créé |
| Event : point de RDV précis | **Manquant** | texte dans description (SortieCreateForm.tsx:81) ; aucune coordonnée |
| Event : niveau | **Manquant** | texte dans description ; `type` sans CHECK |
| Event : capacité | **Existe** | `max_participants` + triggers |
| Event : liste d'attente | **Manquant** | `join_event` lève « événement complet » ; participants sans statut |
| Event : couverture | **Existe** | `cover_image`, `cover_alt` (bucket images seules) |
| Event : prix | **Manquant** | seule `shared_kitty`/`kitty_goal` (cagnotte, 0) |
| Event : heure, fin, club, visibilité | **Manquant** | `event_date date`, `duration text` |
| Club : couverture | **Existe** | `cover_image`, `cover_color` |
| Club : activité | **Existe (partiel)** | `category` libre, `type` |
| Club : visibilité | **Existe (partiel)** | `privacy` sans CHECK ; lecture RLS ignore la valeur |
| Club : règles | **Introuvable** dans baseline+post (§0.6) | écrit par le form ; questions d'adhésion = texte |
| Club : lieu, questions structurées | **Manquant** | lieu dans `description` |
| Kit : poids | **Existe** | `total_weight_g` (client), `weight_g` par item |
| Kit : catégorie | **Existe (items)** | `materiel_kit_items.category` libre (+ `function_id`) ; rien au niveau kit |
| Story : trim début/fin | **Manquant** | `StoryTrim` décoratif ; seulement `duration_ms ≤ 60 s`, `composition` |
| Story : audience | **Existe** | `visibility` 5 valeurs ; form expose public/followers/only_me (StoryCreateForm.tsx:67-71) |
| Médias de post structurés (alt, ordre) | **Manquant** | `media_urls jsonb` ≤ 10, `image_alt` unique |
| Lieu / tags de post en colonnes | **Manquant** | dans `content` |
| Upload vidéo posts | **Manquant** | `carnet-media` images seules (§0.4) |
| Flag ancien/nouveau tiroir | **Manquant** | §7 |
