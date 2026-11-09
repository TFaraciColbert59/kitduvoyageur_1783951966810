# 03 — Données, migrations et RPC Supabase

Projet prod : ref `icxyvwzfjbflcbqukpfz`. Convention : `supabase/migrations/YYYYMMDDHHMMSS_slug.sql` + `supabase/migrations_down/YYYYMMDDHHMMSS_slug.down.sql` ; pgTAP dans `supabase/tests/database/*.test.sql` (`BEGIN; plan(n); … ROLLBACK`, lancés par `bash scripts/db/ci/run_pgtap.sh`) ; CI : job `database-gates` de `.github/workflows/ci.yml`. Prends un horodatage strictement postérieur au dernier fichier présent (au moment de la rédaction : `20261108100005_carnet_v2_lot_e_kit_forks.sql`). Sépare les fichiers selon les deux phases de `06` § 3 : **phase 1** = ajouts purs ; **phase 2** = réécritures de fonctions et triggers existants et contrainte `clubs_privacy_check`.

**Lis d'abord `annexes/J-schema-communaute.md`** : état réel du schéma, des écritures et des pièges (tout y est sourcé `fichier:ligne`). Le SQL ci-dessous est un **brouillon de référence** : aligne types, noms et style sur les migrations récentes (idempotence, `security definer` + `set search_path = public` + `revoke … from public` + `grant … to authenticated`, `(select auth.uid())`, index sur les FK) et vérifie chaque hypothèse en base avant d'écrire la migration finale.

## 0. Faits qui conditionnent tout (extraits de J)
- **Aucune création n'est atomique aujourd'hui** : 6 flux d'`insert` clients séquentiels ; posts « pont » dans des `try/catch` muets (J § 3).
- `community_posts.snapshot_payload` est remis à `NULL` par trigger sans `linked_carnet_id` → les options écrites dedans sont perdues ; la colonne prévue est **`creation_meta jsonb`** (existe, jamais écrite) (J § 0.3).
- `trg_community_post_restricted_media` refuse tout post non public avec médias ou lien carnet/kit (J § 0.8) → **un post pont n'est créé que si l'objet est public**, sinon aucun post (et l'UI le dit).
- Bucket `carnet-media` : **images seules, 10 Mo** ; `stories-private` : 25 Mo, vidéos acceptées (J § 4). Décision : l'UI s'aligne sur ces limites (voir § 7). On **ne modifie pas** les politiques Storage.
- Club `closed` : l'auto-adhésion est refusée par RLS et `club_join_requests` n'a ni écrivain ni approbation (J § 1.4, § 5).
- `clubs.rules` : présence en prod **à vérifier** (`select column_name from information_schema.columns where table_name='clubs'`) ; `clubs.is_private` n'existe pas (référence morte dans `ClubLiquidGlassV8.tsx:896`, hors périmètre : la noter dans le rapport).
- Extensions présentes : `postgis`, `pg_trgm` (schéma `extensions` ou `public` selon l'environnement : qualifie les appels comme le fait `20261028160000_community_search_and_club_counts.sql`), `unaccent` (créée sans schéma). Une fonction immuable `public.unaccent_lower(text)` existe déjà (migration `20260812*`) : c'est la base de la normalisation. Pas d'`earthdistance` : utilise PostGIS.
- `carnet_moments(carnet_id, jour_numero, heure, citation, image_url, moment_timestamp, …)` et `carnet_media(carnet_id, url, type, caption, position)` existent en prod (baseline) ; seule `carnet_nights` vient de carnet-v2. `carnets.likes_count` / `comments_count` sont tenus par trigger (`sync_carnet_likes_count`…) : utilise-les directement.
- `join_event(uuid)` / `leave_event(uuid)` renvoient un `jsonb {registered, current_participants, status}` : conserve ce contrat. `replace_kit_items(uuid, jsonb, boolean)`.
- Kits = `materiel_kits` / `materiel_kit_items` (pas `kits`). RPC `replace_kit_items` existe. Profils = `user_profiles` / vue `public_profiles`.

## 1. Lot A — Recherche tolérante (Recherche#9)

```sql
-- Normalisation immuable, basée sur la fonction existante.
create or replace function public.lkdv_norm(t text)
returns text language sql immutable parallel safe set search_path = public as $$
  select public.unaccent_lower(coalesce(t,''))
$$;

-- Index trigram : l'opclass doit être qualifiée par le schéma réel de pg_trgm (même méthode que 20261028160000).
do $$
declare v_schema text := (select n.nspname from pg_extension e join pg_namespace n on n.oid = e.extnamespace where e.extname = 'pg_trgm');
begin
  execute format('create index if not exists idx_carnets_title_norm_trgm on public.carnets using gin (public.lkdv_norm(title) %I.gin_trgm_ops)', v_schema);
  -- idem : carnets.destination, clubs.name, events.title, events.location, community_posts.content,
  --        user_profiles.full_name, user_profiles.handle
end $$;

-- SECURITY INVOKER : la RLS de chaque table s'applique, l'appelant ne voit que ce qu'il peut lire.
create or replace function public.community_search(
  p_q text, p_scope text default 'all', p_limit int default 5, p_offset int default 0,
  p_lat float8 default null, p_lng float8 default null, p_filters jsonb default '{}'::jsonb)
returns table(kind text, id uuid, title text, subtitle text, cover text, href text, score real,
              lat float8, lng float8, distance_km float8, starts_at timestamptz)
language plpgsql stable security invoker set search_path = public as $$
declare n text := public.lkdv_norm(trim(p_q));
        pat text := '%' || replace(replace(replace(n, '\', '\\'), '%', '\%'), '_', '\_') || '%';  -- saisie échappée
begin
  if length(n) < 2 then return; end if;
  -- une branche par type (carnet, club, sortie, post, membre) : filtre `lkdv_norm(col) % n or lkdv_norm(col) like pat escape '\'`,
  -- score = similarity, distance via ST_Distance(<geom>, ST_MakePoint(p_lng,p_lat)::geography)/1000 si p_lat/p_lng,
  -- p_filters : {"weekend":true,"level":"facile","max_hours":2,"near":true} appliqués aux sorties et carnets,
  -- clubs `secret` exclus sauf membres ; tri par score puis distance ; limit p_limit offset p_offset par branche.
end $$;
revoke execute on function public.community_search(text,text,int,int,float8,float8,jsonb) from public;
grant execute on function public.community_search(text,text,int,int,float8,float8,jsonb) to authenticated, anon;

-- Accueil de la recherche (Recherche#4) : termes et lieux tendance calculés sur les 7 derniers jours d'objets publics.
create or replace function public.community_search_trending(p_limit int default 8)
returns table(kind text, label text, hits int) language sql stable security invoker set search_path = public as $$ /* … */ $$;
grant execute on function public.community_search_trending(int) to authenticated, anon;
```
- Le paramètre est **lié**, jamais concaténé dans un filtre PostgREST : virgules et parenthèses ne cassent plus rien.
- Requête < 2 caractères → la fonction renvoie vide. Fixe `pg_trgm.similarity_threshold` localement si besoin (`set local` dans une fonction plpgsql), ne modifie pas le réglage global.
- Mesure le plan (`explain analyze`) sur une copie : chaque branche doit utiliser son index GIN.

## 2. Lot B — Listes paginées, compteurs serveur, « Près de moi »

Colonnes géographiques additives (nullable, aucune recopie de masse) :
```sql
alter table public.carnets  add column if not exists start_geom geography(Point,4326);
alter table public.clubs    add column if not exists zone_geom  geography(Point,4326),
                            add column if not exists zone_radius_km numeric check (zone_radius_km is null or zone_radius_km between 1 and 500);
alter table public.events   add column if not exists location_geom geography(Point,4326),
                            add column if not exists meeting_geom  geography(Point,4326);
create index if not exists idx_carnets_start_geom on public.carnets using gist (start_geom);
create index if not exists idx_clubs_zone_geom    on public.clubs   using gist (zone_geom);
create index if not exists idx_events_loc_geom    on public.events  using gist (location_geom);
```
Les objets existants sans coordonnées sont simplement absents de « Près de moi » (noté dans le rapport). Les nouvelles créations les renseignent.

RPC de liste, toutes `security invoker`, pagination par curseur `(clé_de_tri, id)`, `p_limit` ≤ 30 :
Toutes ces RPC de lecture : `revoke … from public`, `grant execute … to authenticated, anon` (`00` § 4.3).
- `community_carnets_feed(p_filter text /*discover|mine|followed|near*/, p_sort text /*recent|popular|near|duration*/, p_lat float8, p_lng float8, p_cursor jsonb, p_limit int)` → colonnes de tuile + `likes_count`, `comments_count`, `liked_by_me`, `travelers` (3 avatars + total), `is_live`, `distance_km`. Les compteurs viennent de sous-requêtes agrégées (ou des colonnes compteurs existantes de `carnets` si elles sont tenues par trigger — vérifier), **plus jamais** des 5 000 lignes chargées côté client.
- `community_clubs_feed(p_filter /*discover|mine|near*/, p_sort /*activity|near|size*/, p_activity text, p_lat, p_lng, p_cursor, p_limit)` → + `my_status` (`none|member|pending|admin`), `events_this_month`, `last_post_at`, `friends_count` + 3 avatars d'amis membres.
- `community_events_feed(p_filter /*discover|mine|near*/, p_day date, p_lat, p_lng, p_cursor, p_limit)` → + `my_status` (`none|registered|waitlist`), `spots_left`, `friends` ; et `community_events_agenda(p_from date, p_days int default 14)` → nombre de sorties par jour pour la bande agenda.

## 3. Lot C — Sorties : vraies colonnes, heure, liste d'attente

```sql
alter table public.events
  add column if not exists starts_at timestamptz,
  add column if not exists ends_at timestamptz,
  add column if not exists level text check (level is null or level in ('facile','moyen','difficile')),
  add column if not exists distance_km numeric check (distance_km is null or distance_km between 0 and 500),
  add column if not exists elevation_gain_m int check (elevation_gain_m is null or elevation_gain_m between 0 and 20000),
  add column if not exists meeting_point text,
  add column if not exists waitlist_enabled boolean not null default false,
  add column if not exists safety_notes text check (safety_notes is null or length(safety_notes) <= 500),
  add column if not exists safety_checklist text[] not null default '{}',
  add column if not exists recurrence text check (recurrence is null or recurrence in ('weekly','monthly')),
  add column if not exists club_id uuid references public.clubs(id) on delete set null,
  add column if not exists kit_id uuid references public.materiel_kits(id) on delete set null,
  add column if not exists activity text;
create index if not exists idx_events_starts_at on public.events(starts_at);
create index if not exists idx_events_club_id   on public.events(club_id);
create index if not exists idx_events_kit_id    on public.events(kit_id);

alter table public.event_participants
  add column if not exists status text not null default 'confirmed' check (status in ('confirmed','waitlist'));
create index if not exists idx_event_participants_event_status on public.event_participants(event_id, status);
```
- `event_date` reste renseignée (= `starts_at::date`) : tout le code existant continue de marcher.
- `kit_id` : vérifie que la RLS de lecture des kits ne révèle pas un kit privé via la fiche sortie (la fiche ne lit le kit que s'il est public ou au lecteur).
- **Phase 2** (réécritures ; copie d'abord les corps actuels dans le `.down.sql`) :
  - `guard_event_participant_insert` (BEFORE INSERT) lève aujourd'hui « événement complet » dès que `current_participants >= max_participants` : laisse passer `status='waitlist'` quand `waitlist_enabled`, refuse toujours `confirmed` sur un événement complet ;
  - `join_event` : comportement **identique** quand `waitlist_enabled = false` ; si complet et `waitlist_enabled`, insère `status='waitlist'` ; contrat de retour `jsonb {registered, current_participants, status}` conservé (+ clé `waitlisted`) ;
  - `leave_event` : commence par `select … from events where id = p_event for update` (il n'en prend aucun aujourd'hui), **supprime la décrémentation manuelle** de `current_participants` (le recount du trigger suffit), puis promeut le plus ancien `waitlist` en `confirmed` ;
  - `sync_event_participants_count` : ne compte que `confirmed` (corps final de `20261013270000_event_cancellation.sql`, signature inchangée) ;
  - `guard_event_participant_identity` : autorise la seule transition `waitlist → confirmed` faite par ces fonctions.
- Les pgTAP existants `event_participants_invariants` et `event_cancellation` doivent rester verts tels quels.
- Pas de recopie des anciennes métadonnées encodées dans `description` : les sorties existantes gardent leur affichage actuel (les champs vides sont simplement masqués). Aucun update de masse n'est nécessaire.

## 4. Lot D — Clubs : adhésion complète

```sql
alter table public.clubs
  add column if not exists rules text check (rules is null or length(rules) <= 1000),   -- no-op si déjà présente
  add column if not exists join_questions jsonb not null default '[]'::jsonb
      check (jsonb_typeof(join_questions) = 'array' and jsonb_array_length(join_questions) <= 3),
  add column if not exists activities text[] not null default '{}',
  add column if not exists location_label text;
-- Phase 2, conditionnelle : poser la contrainte SEULEMENT si
--   select privacy, count(*) from clubs group by 1;  ne renvoie que open / closed / secret.
-- Sinon ne pas la poser (un CHECK NOT VALID s'applique aux UPDATE et bloquerait le trigger de compteur
-- sur une ligne hors liste) et le noter dans le journal.
alter table public.clubs drop constraint if exists clubs_privacy_check;
alter table public.clubs add constraint clubs_privacy_check check (privacy in ('open','closed','secret'));
alter table public.club_join_requests add column if not exists answers jsonb not null default '[]'::jsonb;
```
RPC (`security definer`, contrôle explicite de `auth.uid()`, verrou `for update` sur le club) :
- `join_club(p_club uuid, p_answers jsonb default '[]') returns text` : `open` → insert `club_members(member, active)` (idempotent, `on conflict do nothing`), retourne `member` ; `closed` → upsert `club_join_requests(pending, answers)`, retourne `pending` ; `secret` → erreur sauf invitation (hors périmètre) ; banni → erreur `banned`. Le compteur reste tenu **uniquement** par `trg_sync_club_members_count` : supprime dans la V2 toute écriture client de `members_count`.
- `leave_club(p_club uuid)` : respecte la garde « dernier admin » existante (message clair si refus).
- `cancel_join_request(p_club uuid)`.
- `review_join_request(p_request uuid, p_approve boolean)` : réservé admin/modérateur actif du club ; approuve → insert `club_members(member, active)` + statut `approved`, `reviewed_by` ; refuse → `rejected`. Utilisée par la pile « Demandes (n) » du détail de club V2 (`00` § 3), lue via `club_join_requests` sous sa RLS `_moderate`.
- Mapping : `open` = Ouvert, `closed` = Sur validation ; `secret` n'est proposé par aucun formulaire V2.
- Lecture des clubs `secret` : la politique actuelle `clubs_read` les rend lisibles par tous. **Ne la change pas** dans ce chantier (risque de régression sur `/clubs`) ; filtre `secret` dans `community_clubs_feed` et `community_search` (visible seulement des membres), et note la faille dans le rapport comme suite prioritaire.

## 5. Lot E — Créations atomiques

Toutes `security definer`, `auth.uid()` obligatoire et non anonyme, validation des longueurs et énumérations identique aux schémas zod, `p_client_request_id text` pour l'idempotence (même valeur → même résultat, pas de doublon), une seule transaction. Colonnes d'idempotence à ajouter (phase 1) :
```sql
alter table public.clubs         add column if not exists client_request_id text;
alter table public.events        add column if not exists client_request_id text;
alter table public.materiel_kits add column if not exists client_request_id text;
alter table public.carnets       add column if not exists client_request_id text;
create unique index if not exists uq_clubs_client_req    on public.clubs(created_by, client_request_id)      where client_request_id is not null;
create unique index if not exists uq_events_client_req   on public.events(organizer_id, client_request_id)   where client_request_id is not null;
create unique index if not exists uq_kits_client_req     on public.materiel_kits(user_id, client_request_id) where client_request_id is not null;
create unique index if not exists uq_carnets_client_req  on public.carnets(author_id, client_request_id)     where client_request_id is not null;
```
(`community_posts` et `post_stories` ont déjà la leur.)

| RPC | Écrit | Remplace |
|---|---|---|
| `create_club_with_admin(p jsonb)` | `clubs` (slug vérifié : erreur `slug_taken`), `club_members` admin actif, post de bienvenue **seulement si** `privacy='open'` et post demandé (sinon aucun) | `ClubCreateForm` séquentiel (club orphelin possible) |
| `check_club_slug(p_slug text) returns boolean` | — (lecture, `security invoker`) | Club#5 vérification en direct |
| `create_event_with_post(p jsonb)` | `events` (toutes les colonnes du lot C, `event_date` dérivée), organisateur inscrit `confirmed`, post d'annonce `community_posts(post_type 'share', creation_meta = options)` **si** public ; métadonnées dans les colonnes, plus dans `description` | `SortieCreateForm` et le format « Événement » de Publication |
| `create_kit_with_items(p jsonb)` | `materiel_kits` + items (même logique que `replace_kit_items`, réutilise-la si appelable à l'intérieur), `total_weight_g` **calculé en SQL**, post pont si kit public | `KitCreateForm` (kit vide persistant si items KO) |
| `create_carnet_v2(p jsonb)` | `carnets` (visibilité choisie, `start_geom`, `cover_image` = une photo téléversée), `carnet_moments`, `carnet_media` (toujours), `carnet_nights` seulement si `to_regclass('public.carnet_nights')` n'est pas null, `carnet_collaborators` invités, post pont si public | `CarnetMapDrawer` (photos perdues, couverture vide, public forcé) |
| `create_community_post(p jsonb)` | `community_posts` avec `audience`, `media_urls` (+ texte alternatif par média dans `creation_meta.media_alts`), `creation_meta` (sondage, options, programmation), `place_label`, `place_geom`, `tags` (colonnes ajoutées ci-dessous) | insert client direct |

```sql
alter table public.community_posts
  add column if not exists place_label text check (place_label is null or length(place_label) <= 120),
  add column if not exists place_geom geography(Point,4326),
  add column if not exists tags text[] not null default '{}' check (cardinality(tags) <= 10);
create index if not exists idx_community_posts_tags on public.community_posts using gin (tags);
```
- Les téléversements Storage restent faits par le client **avant** l'appel (les RPC reçoivent des chemins) ; si la RPC échoue, le client supprime les objets qu'il vient d'envoyer (comme le fait déjà la story).
- Vérifie que les triggers existants (`trg_community_post_audience`, `trg_community_post_restricted_media`, `trg_validate_community_post_shared_kit`, mentions) s'exécutent normalement à l'intérieur des RPC et que leurs erreurs remontent avec un code lisible par l'UI.
- Sondage, `allowComments` / `allowLikes`, programmation (Publication#11, #13, #14) : reportés (`01` § 6) ; la V2 ne les propose pas.

## 6. Lot F — Stories
```sql
alter table public.post_stories
  add column if not exists trim_start_ms int check (trim_start_ms is null or trim_start_ms >= 0),
  add column if not exists trim_end_ms   int check (trim_end_ms is null or trim_end_ms > coalesce(trim_start_ms,0)),
  add column if not exists linked_carnet_id uuid references public.carnets(id) on delete set null,
  add column if not exists linked_carnet_day int check (linked_carnet_day is null or linked_carnet_day between 1 and 60),
  add column if not exists alt_text text check (alt_text is null or length(alt_text) <= 200);
create index if not exists idx_post_stories_linked_carnet on public.post_stories(linked_carnet_id);
```
Le visualiseur lit `trim_*` pour la lecture vidéo. Audience : expose aussi `close_friends` (déjà en base). Un lien vers un carnet n'est affiché qu'aux lecteurs qui peuvent voir ce carnet.

## 7. Limites de médias (décision)
- Publication, Sortie, Club, Kit, Carnet : **images seules, ≤ 10 Mo** (limite du bucket `carnet-media`). L'UI refuse dès la sélection, avec un message clair. La vidéo dans les publications est **reportée** (ajoute-la à `01` § 6 dans le rapport) : elle demande un bucket dédié et une revue sécurité.
- Story : images et vidéos, **≤ 25 Mo**, ≤ 60 s (limites du bucket et de `duration_ms`). Corrige le « 50 Mo » de l'UI.

## 8. Tests pgTAP à écrire (un fichier par lot)
1. `community_search` : trouve « Chamonix » avec « chamonix » et « chamonix, » ; ne renvoie pas un carnet privé d'autrui, un post d'audience restreinte non autorisée, un club `secret` à un non-membre.
2. Feeds : pagination stable (pas de doublon entre pages), compteurs justes, `liked_by_me`, filtre `near` exclut les objets sans géométrie.
3. Sorties : `join_event` inchangé sans liste d'attente ; complet + liste d'attente → `waitlist` ; `leave_event` promeut le premier en attente ; compteur = confirmés ; un tiers ne peut pas changer le statut.
4. Clubs : `join_club` open → membre, idempotent (double appel = une ligne) ; closed → demande ; banni refusé ; `review_join_request` refusé à un simple membre, accepté à un admin, crée le membre ; `members_count` juste ; dernier admin ne peut pas partir.
5. `create_club_with_admin` : club + admin dans la même transaction ; slug pris → erreur et **aucune** ligne ; même `client_request_id` → un seul club.
6. `create_event_with_post` : sortie + post ; échec du post (audience restreinte avec média) → **ni sortie ni post** ; non public → pas de post.
7. `create_kit_with_items` : items invalides → aucun kit ; poids total calculé en SQL.
8. `create_carnet_v2` : moments, médias, nuits, collaborateurs écrits ; visibilité privée respectée en lecture par un tiers.
9. Toutes les RPC `security definer` : appel anonyme refusé ; impossible d'écrire au nom d'un autre utilisateur. RPC de lecture : `anon` lit (sous RLS), `anon` n'écrit rien.
11. Recherche : une saisie contenant `%` ou `_` n'élargit pas les résultats.
10. Rollbacks : chaque `.down.sql` s'applique proprement après sa migration (CI éphémère).

## 9. Rollback
Règle d'usage : `06` § 3.5 (après le premier usage réel, on ne supprime rien). Chaque `.down.sql` commence, pour toute colonne qu'il supprime, par un contrôle qui lève une erreur si elle contient des données, puis : `drop function if exists` (avec signature), `drop index if exists`, `drop column if exists` **uniquement** pour les colonnes créées par ce chantier, restauration des corps précédents de `join_event`, `leave_event`, `sync_event_participants_count`, `guard_event_participant_insert`, `guard_event_participant_identity` (copier les corps actuels **avant** de les modifier), `drop constraint if exists clubs_privacy_check`. Ne jamais supprimer `clubs.rules` si elle existait avant toi (le noter dans le down).
