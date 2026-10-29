# Audit des entrées BDD des carnets — 29 octobre 2026

Worktree `lkdv-cf-carnet2`, branche `cf/carnet-latest`. Projet Supabase
`icxyvwzfjbflcbqukpfz`, **lecture seule** (`information_schema` et `select`).
Aucun DDL, aucun `drop`, aucun `update` : le SQL de nettoyage est écrit ici,
il sera joué plus tard par une session habilitée.

Sources lues : `src/components/compte/create/CreateDrawer.tsx` (`CarnetForm`),
`src/features/community/create/CarnetCreateForm.tsx`,
`src/components/carnets/CreateCarnetView.tsx`, `src/features/carnet/detail/**`
(`getCarnetDetail.ts`, `buildCarnetDetail.ts`, `days.ts`, `stats.ts`,
`dayinfo.ts`, `place.ts`, `useCarnetComments.ts`, `useCarnetEngagement.ts`),
`src/components/carnet/profile/**`.

État réel de la base au 29/10/2026 (comptages) : 87 carnets, 276 moments,
235 items de kit, 132 commentaires, 600 j'aime, 178 favoris, 3 266 vues,
3 collaborateurs, 149 sorties, 89 présents.

## 1. Ce que le formulaire de création écrit

`CreateDrawer` → `CarnetForm` (parcours en trois étapes : infos, couverture,
visibilité) écrit **neuf colonnes** de `public.carnets` :

`author_id`, `title`, `destination`, `description` (récit), `start_date`,
`end_date`, `visibility`, `cover_image`, `is_collaborative = false`.

Deux autres chemins de création existent, hors périmètre de refonte mais lus
ici pour la cartographie :

| Chemin | Colonnes écrites |
|---|---|
| `features/community/create/CarnetCreateForm.tsx` | les huit mêmes champs, sans `is_collaborative` |
| `components/carnets/CreateCarnetView.tsx` (legacy) | + `weather`, `route_rating`, `tags`, `distance_km`, **`elevation_m`** |

⚠️ `CreateCarnetView.tsx` envoie `elevation_m`, qui **n'existe pas** dans
`public.carnets` (la colonne réelle est `denivele_m`). Cet insert échoue donc en
base ; le chemin legacy est de facto inutilisable. À traiter hors de ce
périmètre (`src/components/carnets/**`).

## 2. Cartographie `table.colonne → écrite par / lue par / verdict`

Légende des verdicts : **garder** = lue et affichée, ou clé technique ;
**code mort** = lue dans le code mais jamais affichée (lecture retirée dans ce
lot) ; **à supprimer plus tard** = ni lue ni écrite par l'application.

### `carnets`

| Colonne | Écrite par | Lue par | Verdict |
|---|---|---|---|
| `id` | insertion | fiche, routes, listes | garder |
| `author_id` | `CarnetForm` | fiche (`isOwner`, participants), RLS | garder |
| `title` | `CarnetForm` | fiche, cartes, sitemap, recherche | garder |
| `destination` | `CarnetForm` | fiche (lieu, titre de repli) | garder |
| `description` | `CarnetForm` (récit) | fiche (volet Jours, légende du post) | garder |
| `cover_image` | `CarnetForm` | fiche (fond de page, grille), cartes | garder |
| `cover_image_alt` | `CreateCarnetView` (legacy), seed | fiche (`coverImageAlt`) | garder |
| `start_date` | `CarnetForm` | fiche (jours, date du post) | garder |
| `end_date` | `CarnetForm` | fiche (plage de dates) | garder |
| `visibility` | `CarnetForm`, `CarnetsTab` (publication) | fiche (`isPublic`), RLS | garder |
| `verified` | seed | fiche (`detail.verified`) | garder |
| `likes_count` | seed | fiche **en secours** de `counts.likes` (jamais prioritaire) | garder (secours) |
| `comments_count` | seed | fiche **en secours** de `counts.comments` | garder (secours) |
| `views_count` | seed, jamais maintenu (3 266 lignes réelles dans `carnet_views` pour 74 carnets à `views_count > 0`) | plus personne : `engagement.views` n'était affiché nulle part | **code mort → lecture retirée** |
| `distance_km` | `CreateCarnetView` (legacy) | fiche (total, repli de `hike_sessions.distance_km`) | garder |
| `denivele_m` | — (aucun formulaire) | fiche (total, repli de `elevation_gain_m`) | garder |
| `groupe_id` | conversion voyage | fiche (`groupe_etapes`, `groupe_hebergements`) | garder |
| `lieu_depart` | conversion voyage | fiche (lieu : pays · région · lieu) | garder |
| `lieu_arrivee` | conversion voyage | fiche (lieu, repli de localité) | garder |
| `country_iso` | conversion voyage | fiche (pays du lieu) | garder |
| `weather` | `CreateCarnetView` (legacy), seed | **personne** (la fiche lit `groupe_etapes.meteo`) | à supprimer plus tard |
| `route_rating` | `CreateCarnetView` (legacy), seed | cartes legacy `CarnetHubCard`/`MobileCarnetCard` seulement, hors fiche | à supprimer plus tard (après retrait des cartes) |
| `tags` | `CreateCarnetView` (legacy), seed | **personne** | à supprimer plus tard |
| `map_points` | seed uniquement (`[]`) | **personne** (la trace vient de `hike_sessions.positions_geojson`) | à supprimer plus tard |
| `is_collaborative` | `CarnetForm` (`false`), seed | **personne** (les participants viennent de `carnet_collaborators` + `hike_session_participants`) | à supprimer plus tard |
| `favorites_count` | seed | **personne** (les favoris se comptent dans `carnet_favorites`) | à supprimer plus tard |
| `nb_nuits` | `carnetConversionEngine` | **personne** | à supprimer plus tard |
| `nb_voyageurs` | `carnetConversionEngine` | **personne** | à supprimer plus tard |
| `trip_id` | conversion voyage | trips (hors fiche) | garder |
| `correlation_id` | conversion voyage | pipelines (hors fiche) | garder |
| `created_at`, `updated_at` | défaut / triggers | tris | garder |

### `carnet_moments`

| Colonne | Écrite par | Lue par | Verdict |
|---|---|---|---|
| `id` | insert | fiche (clé de liste, post) | garder |
| `carnet_id` | `CreateCarnetView`, `/api/hike-sessions` | fiche (filtre) | garder |
| `jour_numero` | `CreateCarnetView`, `/api/hike-sessions` | fiche (jours, groupement) | garder |
| `heure` | `/api/hike-sessions` | fiche (pastille d'heure, ligne de moment) | garder |
| `citation` | `CreateCarnetView` | fiche (légende de carte, légende du post) | garder |
| `lieu` | `CreateCarnetView` | fiche (lieu de la carte de moment) | garder |
| `image_url` | `CreateCarnetView`, `/api/hike-sessions` | fiche (vignette 4:3, post, viewer) | garder |
| `created_at` | défaut | tri secondaire de la fiche | garder |
| `auteur_nom` | `CreateCarnetView` (258 lignes renseignées) | plus personne : `CarnetMomentItem.authorName` n'était affiché nulle part (l'auteur du post vient de `carnets.author_id`) | **code mort → lecture retirée** |
| `auteur_id` | `CreateCarnetView` | **personne** | à supprimer plus tard |
| `moment_timestamp` | `/api/hike-sessions` | `/api/carnets/[id]`, narrative (hors fiche) | garder |
| `source` | `/api/hike-sessions` | `/api/carnets/[id]` (hors fiche) | garder |
| `hike_session_id` | `/api/hike-sessions` | `/api/carnets/[id]` (hors fiche) | garder |
| `identified_species` | `/api/carnet/identify-species` | `JournalService` (journal de rando, hors fiche) — 0 ligne aujourd'hui | garder (hors fiche) |

### `carnet_kit_items`

| Colonne | Écrite par | Lue par | Verdict |
|---|---|---|---|
| `id` | `CreateCarnetView` | fiche (clé) | garder |
| `carnet_id` | `CreateCarnetView` | fiche (filtre) | garder |
| `nom` | `CreateCarnetView` | fiche (volet Matériel) | garder |
| `detail` | `CreateCarnetView` | fiche (volet Matériel) | garder |
| `poids_g` | `CreateCarnetView` | fiche (poids total, volet Matériel) | garder |
| `couleur_tag` | `CreateCarnetView` | fiche (pastille de couleur du volet Matériel) | garder |
| `sort_order` | `CreateCarnetView` | fiche (tri) | garder |

### `carnet_comments`

| Colonne | Écrite par | Lue par | Verdict |
|---|---|---|---|
| `id` | `useCarnetComments.send` | fiche (clé de ligne, `comment-<id>`) | garder |
| `carnet_id` | `useCarnetComments.send` | fiche (filtre), comptage `getCarnetDetail` | garder |
| `author_id` | `useCarnetComments.send` | fiche (propriétaire → « supprimer ») | garder |
| `content` | `useCarnetComments.send` | fiche (texte de commentaire) | garder |
| `created_at` | défaut | fiche (tri, date relative) | garder |

### `carnet_likes`

| Colonne | Écrite par | Lue par | Verdict |
|---|---|---|---|
| `id` | défaut | non lue (clé technique) | garder |
| `carnet_id` | `useCarnetEngagement.toggleLike` | fiche (filtre, comptage exact) | garder |
| `user_id` | `useCarnetEngagement.toggleLike` | fiche (état aimé, liste des 50 réactions) | garder |
| `reaction` | `useCarnetEngagement.toggleLike` (`'like'`) | fiche (`CarnetLiker.reaction`) | garder |
| `created_at` | défaut | fiche (tri des 50 dernières) | garder |

### `carnet_favorites`

| Colonne | Écrite par | Lue par | Verdict |
|---|---|---|---|
| `id` | défaut | non lue | garder (clé technique) |
| `carnet_id` | `useCarnetEngagement.toggleFavorite` | fiche (état enregistré) | garder |
| `user_id` | `useCarnetEngagement.toggleFavorite` | fiche (état enregistré) | garder |
| `created_at` | défaut | personne | garder (horodatage) |

### `carnet_views`

| Colonne | Écrite par | Lue par | Verdict |
|---|---|---|---|
| `id` | défaut | non lue | garder |
| `carnet_id` | `useCarnetEngagement.registerView` | **personne** (aucun compteur affiché) | garder (télémétrie brute) |
| `user_id` | `useCarnetEngagement.registerView` | **personne** | garder |
| `ip_address` | jamais (colonne laissée nulle) | **personne** | à supprimer plus tard |
| `created_at` | défaut | **personne** | garder (horodatage d'insertion) |

### `carnet_collaborators`

| Colonne | Écrite par | Lue par | Verdict |
|---|---|---|---|
| `id` | outillage externe | non lue | garder |
| `carnet_id` | outillage externe | fiche (filtre) | garder |
| `user_id` | outillage externe | fiche (participants, profil public) | garder |
| `role` | outillage externe | plus personne : le rôle affiché vient de la **source** (`collaborator` / `participant`), jamais de la colonne | **code mort → lecture retirée** |
| `created_at` | défaut | fiche (tri des participants) | garder |

### `hike_sessions`

| Colonne | Écrite par | Lue par | Verdict |
|---|---|---|---|
| `id` | `/api/hike-sessions` | fiche (clé de sortie, participants) | garder |
| `carnet_id` | `/api/hike-sessions` | fiche (filtre) | garder |
| `started_at` | `/api/hike-sessions` | fiche (date du jour, tri des sorties) | garder |
| `distance_km` | `/api/hike-sessions` | fiche (totaux, jours) | garder |
| `elevation_gain_m` | `/api/hike-sessions` | fiche (D+ total et par jour) | garder |
| `duration_seconds` | `/api/hike-sessions` | fiche (durée par jour) | garder |
| `positions_geojson` | `/api/hike-sessions` | fiche (trace 3D, jours) | garder |
| `positions_timed` | `/api/hike-sessions` | fiche (heure réelle par point) | garder |
| `ended_at`, `user_id`, `route_id` | `/api/hike-sessions` | autres écrans (hors fiche) | garder |
| `poi_events`, `narratives` | `/api/hike-sessions` | autres écrans (hors fiche) | garder |
| `processing_status`, `processor_version`, `processing_*`, `track_quality`, `last_processing_error`, `next_retry_at` | pipeline `processHikeSession` | crons et progression (hors fiche) | garder (hors fiche) |
| `visibility`, `title`, `max_altitude_m`, `weather`, `notes`, `kit_id`, `trip_id`, `correlation_id` | `/api/hike-sessions` | autres écrans (hors fiche) | garder (hors fiche) |

### `hike_session_participants`

| Colonne | Écrite par | Lue par | Verdict |
|---|---|---|---|
| `session_id` | `/api/hike-sessions` | fiche (jointure aux sorties du carnet) | garder |
| `user_id` | `/api/hike-sessions` | fiche (participants, profil public) | garder |
| `role` | `/api/hike-sessions` | plus personne (même règle que `carnet_collaborators.role`) | **code mort → lecture retirée** |
| `created_at` | défaut | fiche (tri) | garder |

## 3. Nettoyage appliqué dans le code (aucune valeur affichée ne change)

| Retrait | Fichiers | Preuve d'innocuité |
|---|---|---|
| `carnets.views_count` retiré du `select` et de `CarnetRow` ; `CarnetEngagement.views` supprimé | `features/carnet/detail/getCarnetDetail.ts`, `types.ts`, `buildCarnetDetail.ts`, fixtures et tests | `engagement.views` n'était peint par aucun composant de la fiche (`CarnetCard` : « ne porte plus les vues ») |
| `carnet_moments.auteur_nom` retiré du `select`, de `MomentRow` et de `CarnetMomentItem.authorName` | `getCarnetDetail.ts`, `types.ts`, `days.ts`, fixtures et tests | l'auteur affiché d'un moment est celui du carnet (`carnets.author_id` → `public_profiles`) |
| `carnet_collaborators.role` et `hike_session_participants.role` retirés des `select` et de `ParticipantRow.role` | `getCarnetDetail.ts`, `types.ts`, `participants.test.ts` | `buildParticipants` ne lisait déjà que `row.source` pour remplir `CarnetParticipant.role` |

Vérification : `npx vitest run src/components/carnet src/features/carnet` →
**33 fichiers, 431 tests verts** ; `npx tsc --noEmit` → **0 erreur**.

## 4. SQL de nettoyage — à jouer plus tard (aucun DDL exécuté ici)

Étapes proposées, dans cet ordre, chacune derrière une sauvegarde
(`pg_dump -t <table>`) et une requête de contrôle avant/après.

```sql
-- 0. Contrôles avant (lecture seule) --------------------------------
select count(*) filter (where weather is not null)        as weather,
       count(*) filter (where tags is not null)           as tags,
       count(*) filter (where map_points is not null)     as map_points,
       count(*) filter (where is_collaborative)           as collab,
       count(*) filter (where favorites_count > 0)        as favoris,
       count(*) filter (where nb_nuits is not null)       as nuits,
       count(*) filter (where nb_voyageurs is not null)   as voyageurs
from public.carnets;
-- 29/10/2026 : 87 / 70 / 87 / 0 / 0 / 87 / 87

-- 1. Colonnes jamais lues ni écrites par l'application --------------
alter table public.carnets drop column if exists weather;
alter table public.carnets drop column if exists tags;
alter table public.carnets drop column if exists map_points;
alter table public.carnets drop column if exists is_collaborative;
alter table public.carnets drop column if exists favorites_count;
alter table public.carnets drop column if exists nb_nuits;
alter table public.carnets drop column if exists nb_voyageurs;
alter table public.carnets drop column if exists route_rating;   -- après retrait des cartes legacy
alter table public.carnets drop column if exists views_count;    -- compteur non maintenu

alter table public.carnet_moments drop column if exists auteur_id;
alter table public.carnet_views  drop column if exists ip_address;

alter table public.carnet_collaborators      drop column if exists role;
alter table public.hike_session_participants drop column if exists role;

-- 2. Reprise des lectures supprimées côté code ----------------------
--    (aucune : les trois colonnes retirées ne sont plus sélectionnées)

-- 3. Vues réelles, pour ne pas perdre l'information utile -----------
create or replace view public.carnet_views_count as
  select carnet_id, count(*)::int as views
  from public.carnet_views
  group by carnet_id;
```

Points de vigilance avant le `drop` :

1. `carnets.tags` et `carnets.weather` ont des valeurs réelles (70 et 87
   lignes) : elles ne sont plus lues, mais un export est nécessaire si le
   contenu doit être réaffiché un jour.
2. `is_collaborative` est écrit à `false` par le formulaire : retirer la colonne
   impose de retirer aussi la clé de l'insert (`CreateDrawer`, `CarnetForm`),
   sinon la création casse.
3. `route_rating` est encore lu par `CarnetHubCard` et `MobileCarnetCard` :
   ne pas le supprimer avant ces deux cartes.
4. `auteur_nom` (258 lignes renseignées) est la seule trace du nom d'auteur au
   moment de la prise : à archiver si l'on veut un jour l'afficher.
