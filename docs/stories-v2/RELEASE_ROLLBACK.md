# Stories V2 — Release & rollback

## Post-merge (2026-10-14)

- **PR #96 mergée** (`0eaa5170`) : le client stories-v2 est **live en production Vercel**. Les migrations 01/04-05/06 sont appliquées en prod (idempotentes, rejouables).
- **Réalité du flag** : `stories_v2=false` reste en base comme **point de kill-switch documenté** ; le chemin média privé (P0) n'est **volontairement pas** réversible vers des URLs publiques — c'est le but de la phase 01. La « désactivation » se fait donc par rollback de code, pas par le flag.
- **Rollback** : `git revert -m 1 0eaa5170` (et idem pour la PR suite une fois mergée) → redeploy Vercel. La base reste : toutes les migrations sont **additives et rétro-compatibles** (l'app legacy continuerait de lire `image_url` des 3 stories historiques, servies par leurs URLs publiques existantes).

## Rollout (état)

1. Feature mergée et vérifiée par CI (quality-gates, database-gates 1539 pgTAP, e2e-compas, lighthouse, bundle, build-ios).
2. Smoke mobile = gate opérateur (comptes démo) avant d'ouvrir plus largement.
3. Backlog P2 restant : stickers interactifs, réponses DM, partage/deep link, recadrage, pagination curseur.

## Vérifications avant poursuite

- [ ] Smoke mobile (photo/vidéo/multi-slide, rail, viewer, like, archives, albums, signed URL).
- [ ] Passe appareils réels iOS/Android (phase 09 formelle).

## Rollback base (si nécessaire — inchangé, idempotent)

```sql
-- Revenir aux policies F-027 :
DROP POLICY IF EXISTS stories_read_visible ON public.post_stories;
CREATE POLICY stories_read_public ON public.post_stories FOR SELECT TO authenticated
  USING (visibility = 'public' AND expires_at > now());
CREATE POLICY stories_read_own ON public.post_stories FOR SELECT TO authenticated
  USING (author_id = auth.uid());
CREATE POLICY stories_read_club ON public.post_stories FOR SELECT TO authenticated
  USING (visibility = 'club' AND club_id IS NOT NULL AND expires_at > now() AND is_club_member(club_id, auth.uid()));
DROP FUNCTION IF EXISTS public.can_view_story(uuid, uuid);
-- Les colonnes additives restent (sans effet) ; le bucket privé peut rester.
```

## Migration des médias legacy (à décider — NON EXÉCUTÉE)

Les 3 stories publiques historiques gardent leurs URLs `carnet-media` publiques (déjà distribuées — non révocables par nature). Option future : copie vers `stories-private`, bascule `storage_bucket/path`, nettoyage public — pilote contrôlé, rollback, jamais automatique.

## Coûts

Aucun service payant introduit (pas de transcode, pas de musique, pas d'API externe). Storage/egress inchangés à volume actuel.
