# Stories V2 — Architecture

## Modèle

`public.post_stories` = **une slide = une ligne** (24 h, horloge serveur).

| Colonne | Rôle |
| --- | --- |
| `image_url` (nullable) | Legacy : URL publique `carnet-media`. |
| `storage_bucket` / `storage_path` | V2 : média privé (`stories-private`, chemin `{uid}/{storyId}/{fichier}`). |
| `media_type` | `image` \| `video` \| `text` (défaut `image`). |
| `status` / `moderation_state` | `processing|ready|failed|removed` / `visible|under_review|removed`. |
| `client_request_id` | Idempotence publication (index unique partiel par auteur). |
| `visibility` | `public` \| `followers` \| `close_friends` \| `club` \| `only_me`. |
| `reply_policy`, `allow_reshare` | Permissions interaction (phases 05/08). |
| `duration_ms`, `poster_path` | Vidéo (phase 02/03). |
| `composition(_version)` | Overlays/stickers (phase 07). |
| `archived_at` | Archive privée (phase 06). |

Tables complémentaires : `story_close_friends`, `story_hidden_users` (phase 01) ; `story_views`, `story_likes` (phase 05) ; `story_highlights(+items)` (phase 06) ; votes/réponses stickers (phase 07).

## Autorisation

```
client (cookie session)
  └─ SELECT post_stories ── RLS: can_view_story(id, auth.uid())
  └─ GET /api/stories/:id/media
       ├─ lecture ligne SOUS RLS  (invisible → 404 indistinguable)
       ├─ privé  → signed URL 120 s (service_role)
       └─ legacy → 302 image_url
```

`can_view_story` : auteur (hors `removed`) ; sinon `expires_at > now()` + pas de blocage (2 sens) + pas de masquage + visibilité (`followers`→`user_follows`, `close_friends`→`story_close_friends`, `club`→`is_club_member`).

## Client

- `CommunityStoriesBar` : rail (anneaux/avatars), publication (upload privé + `client_request_id`), purge des expirées (bucket selon ligne), signalement/blocage/suppression.
- `StoriesViewer` : plein écran, gestes, clavier, pause maintien ; média = `storyMediaUrl(row)` (`/api/stories/:id/media` si privé, sinon legacy).
- `src/lib/stories/media.ts` : normalisation unique.

## Phases

| # | Contenu | État |
| --- | --- | --- |
| 01 | Média privé + ACL + route + compat | appliqué prod + code poussé |
| 02 | Player photo/vidéo fiable | à faire |
| 03 | Composer (recadrage, multi-slide, retry) | à faire |
| 04 | Audiences + rail vu/non vu + pagination | à faire |
| 05 | Vues + likes + réponses DM | à faire |
| 06 | Archive + Highlights + purge serveur | à faire |
| 07 | Overlays + stickers + actions LKDV | à faire |
| 08 | Partage + modération + anti-spam | à faire |
| 09 | Perf/a11y/tests de charge | à faire |
| 10 | Rollout + release/rollback | à faire |
