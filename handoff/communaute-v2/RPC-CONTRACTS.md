# Contrats RPC — Communauté v2 (DB → Explorer / Création)

Source de vérité : `supabase/migrations/20261108130001` → `20261108130008`. En cas de
divergence entre ce document et le SQL, **le SQL gagne** (et ce fichier doit être corrigé).
Toutes les valeurs de retour ci-dessous sont dans l'**ordre exact** des `RETURNS TABLE`.

## 0. Règles communes

| Sujet | Règle |
|---|---|
| RPC de lecture | `security invoker`, `grant execute to authenticated, anon, service_role`. La RLS s'applique : l'invité lit ce que `anon` peut lire ; un non-membre ne voit ni club `secret` ni carnet privé. |
| RPC d'écriture | `security definer`, `search_path=public` verrouillé, `auth.uid()` **non nul et non anonyme** (session anonyme Supabase refusée), `grant execute to authenticated` uniquement. L'invité reçoit `42501` / `not_authenticated`. |
| Erreurs applicatives | SQLSTATE `P0001`, `MESSAGE` = JSON compact **`{"code","message","field"?}`**. En cas de refus d'identité : SQLSTATE `42501`. Une erreur déclenchée par un trigger/contrainte garde son message brut (non JSON) : toujours tester `JSON.parse` avec repli `message`. |
| Idempotence | Les 5 RPC `create_*` acceptent `p.client_request_id` (string) ; même valeur → même objet, `idempotent: true`, aucun doublon. Générer un UUID côté client **une fois par tentative de soumission**, réutiliser en cas de retry réseau. |
| `p_limit` | Toujours borné côté SQL : minimum 1, maximum 30 (défauts : 5 en recherche, 12 en feeds, 8 en tendances). |
| Dates/heures | Les RPC renvoient `timestamptz` en ISO 8601 (PostgREST). `event_date` est la date locale (Europe/Paris) maintenue par trigger. |

### Codes d'erreur par RPC

| `code` | Sens | RPC concernées |
|---|---|---|
| `not_authenticated` | Pas de session | toutes les écritures |
| `anonymous_not_allowed` | Session anonyme Supabase | toutes les écritures |
| `validation_failed` | Champ invalide ; `field` donne le champ à surligner | toutes les écritures |
| `slug_taken` | Slug de club déjà pris (`field: slug`) | `create_club_with_admin` |
| `not_found` | Objet introuvable | `join_club`/`leave_club`/`review_join_request` |
| `banned` | Personne exclue du club | `join_club`, `leave_club`, `review_join_request` |
| `secret_club` | Club `secret` : invitation requise | `join_club` |
| `last_admin` | Dernier admin : désigner un autre admin | `leave_club` |
| `forbidden` | Pas admin/modérateur du club | `review_join_request` |
| `club_not_member` | Non membre actif du club | `create_event_with_post`, `create_community_post` |
| `kit_not_accessible` | Kit privé d'autrui | `create_event_with_post` |

---

## 1. Recherche (lot A)

### 1.1 `community_search`
```sql
community_search(
  p_q text,
  p_scope text default 'all',          -- 'all'|'posts'|'carnets'|'clubs'|'sorties'|'membres'
  p_limit int default 5,               -- 1..30, PAR BRANCHE
  p_offset int default 0,              -- par branche
  p_lat float8 default null,
  p_lng float8 default null,
  p_filters jsonb default '{}'::jsonb  -- {"weekend":bool,"level":"facile|moyen|difficile",
)                                       --  "max_hours":num,"near":bool,"max_km":num}
```
Retour (une ligne par résultat, `p_limit` max **par type**) :

| # | colonne | type | sens |
|---|---|---|---|
| 1 | `kind` | text | `'post'`\|`'carnet'`\|`'club'`\|`'sortie'`\|`'membre'` |
| 2 | `id` | uuid | id de l'objet |
| 3 | `title` | text | titre (post : titre ou début du contenu) |
| 4 | `subtitle` | text | destination / lieu·activité / handle — peut être `''` |
| 5 | `cover` | text\|null | image de couverture / avatar |
| 6 | `href` | text | lien app : `/carnets/<id>`, `/clubs/<slug>`, `/sorties/<id>`, `/communaute?post=<id>`, `/profil/<handle>` (repli id) |
| 7 | `score` | real | similarité trigram (0..1) |
| 8 | `lat` | float8\|null | point de l'objet |
| 9 | `lng` | float8\|null | idem |
| 10 | `distance_km` | float8\|null | distance depuis `p_lat/p_lng` (null si pas de position/point) |
| 11 | `starts_at` | timestamptz\|null | sorties uniquement (`starts_at`, repli `event_date`) |

Comportements : requête normalisée < 2 caractères → **zéro ligne** ; `%`, `_`, `\` de la saisie
sont des caractères littéraux (jamais des jokers) ; les filtres `near`/`max_km` excluent les
objets sans géométrie ; `weekend` ne garde que samedi/dimanche (sorties et carnets) ;
`level`/`max_hours` ne s'appliquent qu'aux sorties ; les clubs `secret` ne sortent que pour
leurs membres actifs.

### 1.2 `community_search_trending`
```sql
community_search_trending(p_limit int default 8)   -- 1..20
--> kind text ('lieu'|'tag'), label text, hits int
```
Lieux (`carnets.destination`, `events.location`) et tags (`carnets.tags`) des objets **publics**
des 7 derniers jours, filtrés par la RLS. Tri `hits desc, label asc`.

---

## 2. Feeds (lot B)

### 2.1 Curseur commun
Chaque ligne expose `sort_key numeric` en **dernière colonne** et `id uuid`. Curseur de la page
suivante (à envoyer dans `p_cursor jsonb`) :
```json
{ "v": <sort_key de la dernière ligne>, "id": "<id de la dernière ligne>" }
```
Première page : `p_cursor = null`. Sens de tri :
- **desc** (`recent`, `popular`, `duration`, `activity`, `size`) → condition `(sort_key, id) < (v, id)` ;
- **asc** (`near`, `events` chronologique) → condition `(sort_key, id) > (v, id)`.

Le serveur applique `p_limit` (≤ 30) ; `hasMore` = « la page est pleine » (ou exposer un
`next_cursor` calculé côté client = dernière ligne). Pagination stable sans doublon tant que les
données ne sont pas modifiées entre deux pages.

`travelers` / `friends` sont des objets JSON :
```json
{ "total": 3, "avatars": [ { "id": "uuid", "name": "Prénom", "avatar": "url|null" } ] }
```
`avatars` est plafonné à 3. Pour un invité (`anon`), `total = 0`, `avatars = []`.

### 2.2 `community_carnets_feed`
```sql
community_carnets_feed(
  p_filter text default 'discover',   -- 'discover'|'mine'|'followed'|'near'
  p_sort   text default 'recent',     -- 'recent'|'popular'|'near'|'duration'
  p_lat float8 default null, p_lng float8 default null,
  p_cursor jsonb default null, p_limit int default 12
)
```
Retour (ordre) : `id uuid, title text, destination text, cover_image text, author_id uuid,
author_name text, author_avatar text, start_date date, end_date date, nb_nuits int,
route_distance_km numeric, elevation_gain_m int, likes_count int, comments_count int,
liked_by_me bool, travelers jsonb, is_live bool, lat float8, lng float8,
distance_km float8, visibility text, sort_key numeric`.

- `route_distance_km` = `carnets.distance_km` (longueur du parcours) ; `distance_km` = distance
  depuis l'appelant (tri `near`, `near` uniquement).
- `likes_count`/`comments_count` tenus par les triggers existants.
- `liked_by_me` alimenté par `carnet_likes`.
- `is_live` = `carnets.live_sharing` **si la colonne existe**, sinon toujours `false`
  (chantier carnet-v2 non appliqué en prod au 2026-11-08).
- `mine` : carnets de l'auteur (les carnets collaboratifs non publics restent soumis à la RLS
  `carnets`, qui ne connaît pas les collaborateurs en prod) ; `followed` : publics d'auteurs suivis.
- `near` : `start_geom` à ≤ 100 km ; les carnets sans géométrie sont exclus.

### 2.3 `community_clubs_feed`
```sql
community_clubs_feed(
  p_filter text default 'discover',   -- 'discover'|'mine'|'near'
  p_sort   text default 'activity',   -- 'activity'|'near'|'size'
  p_activity text default null,       -- chip : comparée à activities[], category, type
  p_lat float8 default null, p_lng float8 default null,
  p_cursor jsonb default null, p_limit int default 12
)
```
Retour (ordre) : `id uuid, slug text, name text, emoji text, privacy text, cover_image text,
cover_color text, category text, activities text[], location_label text, members_count int,
is_verified bool, my_status text, events_this_month int, last_post_at timestamptz,
friends jsonb, lat float8, lng float8, distance_km float8, sort_key numeric`.

- `privacy` : `'open'|'closed'|'secret'` — `secret` **jamais** renvoyé à un non-membre.
- `my_status` : `'none'|'member'|'admin'|'pending'`.
- `events_this_month` : sorties rattachées au club (`events.club_id`) sur le mois courant.
- `last_post_at` : dernier post d'audience club lisible par l'appelant (peut être `null`).
- `friends` : membres actifs que l'appelant suit (3 avatars + total).
- `near` : `zone_geom` + `zone_radius_km` (défaut 50 km) ; `size` trie `members_count`.

### 2.4 `community_events_feed`
```sql
community_events_feed(
  p_filter text default 'discover',   -- 'discover'|'mine'|'near'
  p_day date default null,            -- bande agenda : un seul jour
  p_lat float8 default null, p_lng float8 default null,
  p_cursor jsonb default null, p_limit int default 12
)
```
Retour (ordre) : `id uuid, title text, activity text, emoji text, organizer_id uuid,
organizer_name text, organizer_avatar text, event_date date, starts_at timestamptz,
ends_at timestamptz, location text, meeting_point text, level text, route_distance_km numeric,
elevation_gain_m int, max_participants int, current_participants int, spots_left int,
waitlist_enabled bool, status text, cover_image text, my_status text, friends jsonb,
lat float8, lng float8, distance_km float8, sort_key numeric`.

- `activity` : `events.activity` (repli `type`). `level` : `facile|moyen|difficile|null`.
- `route_distance_km` = `events.distance_km` ; `distance_km` = distance depuis l'appelant.
- `spots_left` : `null` si capacité illimitée (`max_participants = 0`), sinon
  `greatest(max - current, 0)`.
- `my_status` : `'none'|'registered'|'waitlist'` (l'organisateur est `registered`).
- `friends` : participants **confirmés** que l'appelant suit.
- `discover` : à venir (`upcoming`/`full`) et date ≥ aujourd'hui ; `mine` : organisées ou
  inscrites ; `near` : `location_geom` à ≤ 100 km. Tri chronologique ascendant.
- `sort_key` = epoch de `coalesce(starts_at, event_date)`.

### 2.5 `community_events_agenda`
```sql
community_events_agenda(p_from date default null, p_days int default 14)  -- jours 1..60
--> day date, events_count int   (une ligne par jour, y compris 0)
```
`p_from = null` → aujourd'hui. Compte les sorties publiques `upcoming`/`full` groupées par
`coalesce(starts_at, event_date)::date`.

---

## 3. Clubs : adhésion et modération (lot D)

### 3.1 `check_club_slug`
```sql
check_club_slug(p_slug text) -> boolean   -- lecture, anon + authenticated
```
`true` = slug syntaxiquement valide (`^[a-z0-9][a-z0-9-]{1,59}$`) et libre. Un club `secret`
invisible par RLS peut renvoyer `true` puis échouer en `slug_taken` à la création : c'est normal,
`create_club_with_admin` reste l'autorité.

### 3.2 `join_club`
```sql
join_club(p_club uuid, p_answers jsonb default '[]'::jsonb) -> text
--   'member'  : adhésion directe (club open ; idempotent si déjà membre)
--   'pending' : demande créée/remise en attente (club closed)
-- erreurs : not_authenticated, anonymous_not_allowed, not_found, banned, secret_club, validation_failed
```
`p_answers` : tableau de chaînes, même ordre que `clubs.join_questions` (max 3).
`clubs.members_count` est recalculé dans la transaction (le trigger de compteur est absent en
prod ; il est présent en CI et idempotent).

### 3.3 `leave_club`
```sql
leave_club(p_club uuid) -> text   -- 'left' | 'none'
-- erreurs : not_found, banned, last_admin, 42501/identité
```
Un banni ne peut pas retirer sa ligne (ce serait lever son exclusion). Dernier admin →
`last_admin` (message prêt à afficher).

### 3.4 `cancel_join_request`
```sql
cancel_join_request(p_club uuid) -> text   -- 'cancelled' | 'none'
```

### 3.5 `review_join_request`
```sql
review_join_request(p_request uuid, p_approve boolean) -> jsonb
--> { "status": "approved"|"rejected"|<statut inchangé>, "changed": bool, "members_count": int, "user_id"? }
-- erreurs : not_found, forbidden, banned
```
Réservé à un admin/modérateur **actif** du club. Approbation → `club_members(member, active)`
(idempotent) + `club_join_requests.status='approved'`, `reviewed_by`. Une demande déjà traitée
renvoie `changed: false` sans erreur.

---

## 4. Créations atomiques (lot E)

Rappel : le client téléverse les médias Storage **avant** l'appel, puis supprime les objets
envoyés si l'appel échoue (comme la story). Les RPC reçoivent des chemins/URL, pas des fichiers.

### 4.1 `create_club_with_admin`
```sql
create_club_with_admin(p jsonb) -> jsonb
--> { "id": uuid, "slug": text, "privacy": "open"|"closed", "post_id": uuid|null,
      "members_count": int, "idempotent": bool }
```
Payload :
```json
{
  "name": "string requis ≤80",
  "slug": "optionnel (sinon dérivé du nom)",
  "privacy": "open|closed (défaut open)",
  "type": "string (défaut 'activite')", "emoji": "string|null",
  "description": "string ≤2000", "category": "string|null",
  "cover_image": "url|null", "cover_color": "string|null", "country_iso": "string|null",
  "rules": "string ≤1000|null", "location_label": "string ≤120|null",
  "activities": ["string ≤40"], "join_questions": ["string ≤200"] (max 3),
  "welcome_post": true|false, "welcome_post_content": "string|null",
  "client_request_id": "string|null"
}
```
Le post de bienvenue n'est créé que si `privacy='open'` **et** `welcome_post=true` (audience
`club`, auteur = créateur). Le créateur devient `admin` actif dans la même transaction.
`slug_taken` (`field: slug`) = slug déjà pris.

### 4.2 `create_event_with_post`
```sql
create_event_with_post(p jsonb) -> jsonb
--> { "id": uuid, "event_date": date, "starts_at": timestamptz, "status": text,
      "current_participants": int, "waitlist_enabled": bool, "post_id": uuid|null,
      "idempotent": bool }
```
Payload :
```json
{
  "title": "string requis ≤120",
  "starts_at": "ISO 8601 requis (futur, Europe/Paris pour event_date)",
  "ends_at": "ISO 8601|null (≤ 30 jours après starts_at)",
  "event_date": "YYYY-MM-DD|null (sinon dérivée de starts_at)",
  "activity": "string ≤60|null", "type": "string (défaut 'rando')", "emoji": "string|null",
  "description": "string ≤5000|null",
  "location": "string ≤160|null", "country": "string (défaut France)",
  "location_lat": num, "location_lng": num,
  "meeting_point": "string ≤200|null", "meeting_lat": num, "meeting_lng": num,
  "level": "facile|moyen|difficile|null",
  "distance_km": "0..500", "elevation_gain_m": "0..20000",
  "max_participants": "0..500 (défaut 10 ; 0 = illimité)",
  "waitlist_enabled": bool (forcé false si capacité illimitée),
  "safety_notes": "string ≤500|null", "safety_checklist": ["string ≤120"] (max 10),
  "recurrence": "weekly|monthly|null",
  "club_id": "uuid|null (adhésion active exigée → club_not_member)",
  "kit_id": "uuid|null (kit possédé ou public → kit_not_accessible)",
  "cover_image": "url|null", "cover_alt": "string|null",
  "announce": true|false (défaut true), "announce_content": "string|null",
  "client_request_id": "string|null"
}
```
Écrit : `events` (colonnes réelles + géométries + `client_request_id`), l'organisateur en
`event_participants(status='confirmed')`, puis un post d'annonce public `post_type='share'` dont
`creation_meta.event_id` pointe la sortie (si `announce`). Une seule transaction : si le post
échoue, la sortie est annulée.

### 4.3 `create_kit_with_items`
```sql
create_kit_with_items(p jsonb) -> jsonb
--> { "id": uuid, "items_count": int, "total_weight_g": int, "is_public": bool,
      "post_id": uuid|null, "idempotent": bool }
```
Payload :
```json
{
  "name": "string requis ≤120", "description": "string ≤2000|null",
  "season": "printemps|ete|automne|hiver|toute_saison|null",
  "is_public": bool,
  "cover_image_url": "url|null", "tags": ["string ≤40"] (max 10),
  "items": [
    { "name": "string requis ≤120", "category": "string|null",
      "weight_g": "0..50000|null", "quantity": "1..99 (défaut 1)",
      "is_checked": bool, "product_ownership_id": "uuid|null (objet de SON inventaire)",
      "product_id": "uuid|null",
      "slot_id": "string|null", "slot_order": int|null }  // item_key est généré en base, ne pas l'envoyer
  ] (max 100),
  "share_content": "string|null", "client_request_id": "string|null"
}
```
`total_weight_g` est **calculé en SQL** (`Σ weight_g × quantity`) — ne pas le calculer côté
client. Validation exhaustive des items avant toute écriture (aucun kit vide partiel). Post pont
uniquement si `is_public` (le trigger existant exige un kit public de l'auteur).

### 4.4 `create_carnet_v2`
```sql
create_carnet_v2(p jsonb) -> jsonb
--> { "id": uuid, "visibility": text, "moments_count": int, "media_count": int,
      "nights_count": int, "collaborators_count": int, "post_id": uuid|null,
      "idempotent": bool }
```
Payload :
```json
{
  "title": "string requis ≤140", "destination": "string requis ≤120",
  "description": "string ≤10000|null",
  "visibility": "public|private|friends (défaut private ; 'prive' normalisé en 'private')",
  "start_date": "YYYY-MM-DD|null", "end_date": "YYYY-MM-DD|null (≥ start_date)",
  "cover_image": "url|null", "cover_image_alt": "string|null",
  "tags": ["string"] (max 10), "distance_km": num, "denivele_m": int,
  "nb_nuits": "0..120", "nb_voyageurs": "1..100",
  "lieu_depart": "string|null", "lieu_arrivee": "string|null", "country_iso": "string|null",
  "map_points": "objet JSON|null (tracé/jours)", "start_lat": num, "start_lng": num,
  "is_collaborative": bool, "collaborators": ["uuid"] (max 20),
  "moments": [{ "jour_numero": int, "heure": "string|null", "citation": "string|null",
                "auteur_nom": "string|null", "lieu": "string|null", "image_url": "url|null",
                "moment_timestamp": "ISO|null", "source": "manuel|auto" }],
  "media": [{ "url": "url requise", "type": "image|video", "caption": "string|null",
              "position": int|null }],
  "nights": [{ "jour_numero": "int ≥1", "nom": "string requis",
              "type": "refuge|gite|bivouac|hotel|camping|autre",
              "altitude_m": int|null, "infos": "string|null", "lat": num, "lng": num }],
  "post": { "enabled": bool, "content": "string|null" },
  "client_request_id": "string|null"
}
```
- `cover_image` = une des photos téléversées (choisie par l'UI) ; `start_geom` dérivée de
  `start_lat/lng`.
- `carnet_moments` et `carnet_media` sont **toujours** écrits (même sans couverture).
- `carnet_nights` n'est écrite **que si la table existe** ; sinon les nuits sont ignorées
  silencieusement (l'UI masque l'étape quand `to_regclass('public.carnet_nights') is null`)
  et `nights_count = 0`.
- Collaborateurs : ids `uuid[]`, insérés en `contributor` (l'auteur exclu).
- Post pont uniquement si `visibility='public'` et `post.enabled` ≠ false. Un carnet privé ne
  produit **jamais** de post (aucun média ne fuit).

### 4.5 `create_community_post`
```sql
create_community_post(p jsonb) -> jsonb
--> { "id": uuid, "audience": text, "created_at": timestamptz, "idempotent": bool }
```
Payload :
```json
{
  "content": "string requis 1..20000",
  "post_type": "post|tip|question|share (défaut post)",
  "audience": "public|abonnies|club (défaut public)",
  "club_id": "uuid requis si audience=club, interdit sinon (adhésion active exigée)",
  "image_url": "url|null",
  "media_urls": ["url"] (max 10),
  "creation_meta": { "object libre ≤20 Ko" },
  "place_label": "string ≤120|null", "place_lat": num, "place_lng": num,
  "tags": ["string ≤40"] (max 10),
  "linked_carnet_id": "uuid|null — carnet DE L'AUTEUR uniquement",
  "client_request_id": "uuid-string|null (idempotence community_posts)"
}
```
Serveur : contenu obligatoire, audience/média cohérents (une publication non publique ne peut
pas porter de média ni de carnet lié → `validation_failed` **avant** les triggers), tag de lieu
optionnel, `creation_meta` stocké tel quel (ex. `{"media_alts": [...]}`). Les triggers existants
(audience, média restreint, kit lié, mentions/quota, snapshot carnet) s'appliquent ensuite : si
l'un refuse, toute la RPC échoue (`P0001`/`23514`, message brut non JSON).
`p.client_request_id` doit être un **uuid** (colonne `community_posts.client_request_id` uuid).

---

## 5. Ce que les mappers doivent produire

- Feeds : itérer jusqu'à `items.length < p_limit` → `hasMore = false` ; mémoriser
  `{v: last.sort_key, id: last.id}` comme `p_cursor` suivant.
- Ne pas filtrer/trier à nouveau côté client (le serveur garantit tri + pagination) ; ne pas
  recalculer les compteurs (`likes_count`, `spots_left`, `my_status`, `distance_km`).
- `liked_by_me`, `my_status`, `waitlisted` : état réel par appelant ; rafraîchir après mutation
  (`join_club`, `join_event`…) par un re-fetch de la page courante.
- `travelers`/`friends` : `avatars` peut être `[]` mais jamais `null`.
- `is_live` reste `false` tant que le chantier carnet-v2 n'a pas appliqué `carnets.live_sharing`.
