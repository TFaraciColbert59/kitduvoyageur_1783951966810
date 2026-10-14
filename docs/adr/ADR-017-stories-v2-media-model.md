# ADR-017 — Modèle Story unique et média privé (Stories V2)

**Statut :** accepté · **Date :** 2026-10-13 · **Décideurs :** chantier Stories V2 (autonomie encadrée)

## Contexte

- `post_stories` (F-027) stocke une story = une ligne, mais `image_url` pointe vers le bucket **public** `carnet-media` : toute URL distribuée contourne la visibilité SQL. Incompatible avec `followers`, `close_friends`, `only_me` et toute révocation.
- Le client affiche `image_url` directement ; la suppression retire l'objet `carnet-media` par extraction de marqueur.
- La base possède déjà : `user_follows`, `user_blocks`, `clubs`/`club_members` (`is_club_member`), `is_anonymous_session`, `feature_flags` (+ cohortes).

## Décision

1. **Un seul modèle, additif.** `post_stories` reste l'unité (une slide = une ligne). Aucune colonne historique renommée/supprimée : `image_url` devient nullable, les lignes legacy la conservent.
2. **Média privé.** Bucket `stories-private` (`public=false`, 25 Mo, MIME whitelist), chemin `{uid}/{storyId}/{fichier}`. Policies storage : upload/lecture/suppression propriétaire uniquement.
3. **Autorisation centrale.** `public.can_view_story(story_id, viewer)` (SECURITY DEFINER, search_path épinglé) est LA source unique : RLS lecture (`stories_read_visible`) **et** route média l'utilisent. Règles : auteur toujours (hors `removed`) ; sinon non expirée + pas de blocage (2 sens) + pas de masquage + visibilité (`public` / `followers` via `user_follows` / `close_friends` via `story_close_friends` / `club` via `is_club_member`).
4. **Accès média.** `GET /api/stories/:id/media` : session obligatoire, lecture sous RLS (404 indistinguable), puis URL signée **TTL 120 s** via service_role (privé) ou redirection legacy. Aucune URL durable pour le privé.
5. **Colonnes V2.** `media_type`, `storage_bucket/path`, `mime_type`, `width/height`, `duration_ms` (≤ 60 s), `poster_path`, `composition(_version)`, `status`, `client_request_id` (idempotence, index unique partiel), `reply_policy`, `allow_reshare`, `moderation_state`, `archived_at`.
6. **Rollout.** Flag `stories_v2` (défaut `false`) + cohortes existantes ; la logique legacy reste le repli.

## Conséquences

- Les nouvelles stories ne sont **jamais** lisibles hors contrôle d'accès, même avec l'URL.
- La révocation est effective à la prochaine ouverture (TTL courte), sans promesse de « révocation instantanée » des caches déjà servis.
- Les anciennes URLs publiques restent servies (limite documentée) tant qu'une migration pilote des médias legacy n'est pas exécutée (RELEASE_ROLLBACK.md).
- `image_url` legacy continue de fonctionner sans réécriture de masse.

## Alternatives rejetées

- **Bucket public + policies** : ne protège pas le fichier, seulement la ligne.
- **URL signée stockée en base** : expire et fuit en logs ; la route revérifie à chaque accès.
- **Table `stories` séparée** : double modèle, double migration, casse l'existant.

## Rollback

Additif : recréer les 3 policies F-027, `DROP FUNCTION can_view_story`, garder les colonnes (sans effet). Le bucket privé peut rester (aucun média legacy dedans avant migration pilote).
