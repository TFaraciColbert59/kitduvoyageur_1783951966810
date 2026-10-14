# Stories V2 — Release & rollback

## Rollout

1. Flag `stories_v2` : `false` par défaut (global) ; activation progressive par cohortes via `current_feature_flags_for` (système existant).
2. Migrations **additives uniquement** ; aucune donnée historique supprimée. La migration phase 01 est déjà appliquée en production (SQL idempotent) et le fichier `20261013280000_stories_v2_private_media.sql` reste rejouable sans effet.
3. Déploiement client : PR `feat/stories-v2` → `main` → Vercel. La route `/api/stories/:id/media` et le bucket privé sont déjà provisionnés (ordre sûr : base avant client).
4. Parkings migrations : les 3 gates humaines (`base_scheduled_purges`, `app_errors_purge`, `geo_pois`) restent hors de `supabase db push` (routine opérateur inchangée).

## Vérifications avant activation

- [ ] CI verte sur la branche (type-check, vitest, pgTAP local).
- [ ] Matrice prod (SECURITY_MATRIX) sur comptes démo.
- [ ] Smoke mobile : rail, ouverture viewer, publication photo privée, rechargement (signed URL).

## Rollback

### Base (immédiat, sans perte)

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

### Client

- `git revert` du merge de la PR ; le flag `stories_v2=false` suffit à couper la nouvelle logique si elle est conditionnée.

## Migration des médias legacy (à décider — NON EXÉCUTÉE)

Les 3 stories publiques historiques gardent leurs URLs `carnet-media` publiques (déjà distribuées — non révocables par nature). Option future : copie vers `stories-private`, bascule `storage_bucket/path`, nettoyage public — **pilote contrôlé, rollback, jamais automatique**.

## Coûts

Aucun service payant introduit (pas de transcode, pas de musique, pas d'API externe). Storage/egress inchangés à volume actuel.
