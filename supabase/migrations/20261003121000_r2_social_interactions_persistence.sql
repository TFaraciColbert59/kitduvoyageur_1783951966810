-- ============================================================================
-- 20261003121000_r2_social_interactions_persistence.sql
--
-- LKDV Community Architecture — Milestone 1 (Requirement R2)
-- Persistance des interactions sociales, signaux de recommandation et durcissement :
--
-- 1. Table `post_saves` :
--    • Permet la mise en favoris / sauvegarde des publications communautaires.
--    • RLS étanche : chaque utilisateur ne peut lire, insérer ou supprimer
--      que ses propres sauvegardes via `(SELECT auth.uid())`.
--    • Index optimisés sur `post_id`, `user_id` et `created_at DESC`.
--    • Contrainte d'unicité `uq_post_saves_post_user (post_id, user_id)`.
--
-- 2. Table `content_feedback` :
--    • Capture les signaux d'affinité négative / modération ('hide', 'less_like_this', 'report')
--      pour les cibles ('post', 'author', 'carnet').
--    • RLS étanche : chaque utilisateur gère exclusivement ses propres retours.
--    • Index optimisés sur `(user_id, feedback_type)` et `(target_type, target_id)`.
--    • Contrainte d'unicité `uq_content_feedback (user_id, target_type, target_id, feedback_type)`.
--
-- 3. Extension sémantique de `post_likes` :
--    • Ajout de la colonne `reaction` avec restriction CHECK :
--      ('like', 'useful', 'security', 'bag', 'heart', 'fire').
--    • Optimisation des politiques RLS avec sous-requête `(SELECT auth.uid())`.
--
-- 4. Durcissement de `user_follows` :
--    • Ajout de la contrainte `CHECK (follower_id <> following_id)` pour
--      interdire l'auto-suivi.
--    • Optimisation des politiques RLS avec sous-requête `(SELECT auth.uid())`.
--
-- 5. Fonctions RPC utilitaires :
--    • `toggle_post_save(p_post_id UUID)`
--    • `submit_content_feedback(...)`
-- ============================================================================

-- ── 1. Table post_saves ──────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.post_saves (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES public.community_posts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT uq_post_saves_post_user UNIQUE (post_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_post_saves_post_id ON public.post_saves (post_id);
CREATE INDEX IF NOT EXISTS idx_post_saves_user_id ON public.post_saves (user_id);
CREATE INDEX IF NOT EXISTS idx_post_saves_created_at ON public.post_saves (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_post_saves_user_created ON public.post_saves (user_id, created_at DESC);

ALTER TABLE public.post_saves ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS post_saves_select_own ON public.post_saves;
CREATE POLICY post_saves_select_own ON public.post_saves
  FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS post_saves_insert_own ON public.post_saves;
CREATE POLICY post_saves_insert_own ON public.post_saves
  FOR INSERT TO authenticated
  WITH CHECK (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS post_saves_delete_own ON public.post_saves;
CREATE POLICY post_saves_delete_own ON public.post_saves
  FOR DELETE TO authenticated
  USING (user_id = (SELECT auth.uid()));

REVOKE ALL ON public.post_saves FROM PUBLIC, anon;
GRANT SELECT, INSERT, DELETE ON public.post_saves TO authenticated;
GRANT ALL ON public.post_saves TO service_role;

COMMENT ON TABLE public.post_saves IS
  'Sauvegardes et favoris des publications communautaires avec isolation RLS stricte.';


-- ── 2. Table content_feedback ────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.content_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  target_type TEXT NOT NULL CHECK (target_type IN ('post', 'author', 'carnet')),
  target_id UUID NOT NULL,
  feedback_type TEXT NOT NULL CHECK (feedback_type IN ('hide', 'less_like_this', 'report')),
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT uq_content_feedback UNIQUE (user_id, target_type, target_id, feedback_type)
);

CREATE INDEX IF NOT EXISTS idx_content_feedback_user_feedback ON public.content_feedback (user_id, feedback_type);
CREATE INDEX IF NOT EXISTS idx_content_feedback_target ON public.content_feedback (target_type, target_id);
CREATE INDEX IF NOT EXISTS idx_content_feedback_created_at ON public.content_feedback (created_at DESC);

ALTER TABLE public.content_feedback ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS content_feedback_select_own ON public.content_feedback;
CREATE POLICY content_feedback_select_own ON public.content_feedback
  FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS content_feedback_insert_own ON public.content_feedback;
CREATE POLICY content_feedback_insert_own ON public.content_feedback
  FOR INSERT TO authenticated
  WITH CHECK (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS content_feedback_delete_own ON public.content_feedback;
CREATE POLICY content_feedback_delete_own ON public.content_feedback
  FOR DELETE TO authenticated
  USING (user_id = (SELECT auth.uid()));

REVOKE ALL ON public.content_feedback FROM PUBLIC, anon;
GRANT SELECT, INSERT, DELETE ON public.content_feedback TO authenticated;
GRANT ALL ON public.content_feedback TO service_role;

COMMENT ON TABLE public.content_feedback IS
  'Retours et signaux de modération/filtrage (hide, less_like_this, report) par utilisateur.';


-- ── 3. Extension de post_likes avec réactions sémantiques ────────────────────

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND table_name = 'post_likes' 
      AND column_name = 'reaction'
  ) THEN
    ALTER TABLE public.post_likes 
      ADD COLUMN reaction TEXT NOT NULL DEFAULT 'like';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'post_likes_reaction_check' 
      AND conrelid = 'public.post_likes'::regclass
  ) THEN
    ALTER TABLE public.post_likes 
      ADD CONSTRAINT post_likes_reaction_check 
      CHECK (reaction IN ('like', 'useful', 'security', 'bag', 'heart', 'fire'));
  END IF;
END $$;

-- Optimisation RLS sur post_likes avec mise en cache InitPlan (SELECT auth.uid())
ALTER TABLE public.post_likes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read post_likes" ON public.post_likes;
DROP POLICY IF EXISTS "post_likes_read" ON public.post_likes;
DROP POLICY IF EXISTS "post_likes_select" ON public.post_likes;
CREATE POLICY "post_likes_select" ON public.post_likes
  FOR SELECT TO public
  USING (true);

DROP POLICY IF EXISTS "Auth manage post_likes" ON public.post_likes;
DROP POLICY IF EXISTS "post_likes_manage" ON public.post_likes;
DROP POLICY IF EXISTS "post_likes_insert" ON public.post_likes;
DROP POLICY IF EXISTS "post_likes_update" ON public.post_likes;
DROP POLICY IF EXISTS "post_likes_delete" ON public.post_likes;

CREATE POLICY "post_likes_insert" ON public.post_likes
  FOR INSERT TO authenticated
  WITH CHECK (user_id = (SELECT auth.uid()));

CREATE POLICY "post_likes_update" ON public.post_likes
  FOR UPDATE TO authenticated
  USING (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()));

CREATE POLICY "post_likes_delete" ON public.post_likes
  FOR DELETE TO authenticated
  USING (user_id = (SELECT auth.uid()));


-- ── 4. Sécurisation de user_follows (interdiction auto-suivi & RLS) ──────────

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'user_follows_no_self_follow'
      AND conrelid = 'public.user_follows'::regclass
  ) THEN
    ALTER TABLE public.user_follows
      ADD CONSTRAINT user_follows_no_self_follow
      CHECK (follower_id <> following_id);
  END IF;
END $$;

-- Optimisation RLS sur user_follows avec mise en cache InitPlan (SELECT auth.uid())
ALTER TABLE public.user_follows ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read user_follows" ON public.user_follows;
DROP POLICY IF EXISTS "public_read_user_follows" ON public.user_follows;
DROP POLICY IF EXISTS "user_follows_read" ON public.user_follows;
DROP POLICY IF EXISTS "user_follows_select" ON public.user_follows;
CREATE POLICY "user_follows_select" ON public.user_follows
  FOR SELECT TO public
  USING (true);

DROP POLICY IF EXISTS "Auth manage user_follows" ON public.user_follows;
DROP POLICY IF EXISTS "auth_manage_own_user_follows" ON public.user_follows;
DROP POLICY IF EXISTS "user_follows_manage" ON public.user_follows;
DROP POLICY IF EXISTS "user_follows_insert" ON public.user_follows;
DROP POLICY IF EXISTS "user_follows_delete" ON public.user_follows;

CREATE POLICY "user_follows_insert" ON public.user_follows
  FOR INSERT TO authenticated
  WITH CHECK (follower_id = (SELECT auth.uid()));

CREATE POLICY "user_follows_delete" ON public.user_follows
  FOR DELETE TO authenticated
  USING (follower_id = (SELECT auth.uid()));


-- ── 5. Fonctions RPC utilitaires pour l'application ──────────────────────────

CREATE OR REPLACE FUNCTION public.toggle_post_save(p_post_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_exists BOOLEAN;
  v_is_saved BOOLEAN;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentification requise' USING ERRCODE = '42501';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.community_posts WHERE id = p_post_id) THEN
    RAISE EXCEPTION 'Publication inexistante' USING ERRCODE = 'P0002';
  END IF;

  SELECT EXISTS(
    SELECT 1 FROM public.post_saves WHERE post_id = p_post_id AND user_id = v_user_id
  ) INTO v_exists;

  IF v_exists THEN
    DELETE FROM public.post_saves WHERE post_id = p_post_id AND user_id = v_user_id;
    v_is_saved := false;
  ELSE
    INSERT INTO public.post_saves (post_id, user_id) VALUES (p_post_id, v_user_id)
    ON CONFLICT (post_id, user_id) DO NOTHING;
    v_is_saved := true;
  END IF;

  RETURN jsonb_build_object('saved', v_is_saved, 'post_id', p_post_id);
END;
$$;

REVOKE ALL ON FUNCTION public.toggle_post_save(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.toggle_post_save(UUID) TO authenticated, service_role;


CREATE OR REPLACE FUNCTION public.submit_content_feedback(
  p_target_type TEXT,
  p_target_id UUID,
  p_feedback_type TEXT,
  p_reason TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_feedback_id UUID;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentification requise' USING ERRCODE = '42501';
  END IF;

  IF p_target_type NOT IN ('post', 'author', 'carnet') THEN
    RAISE EXCEPTION 'Type de cible invalide: %', p_target_type USING ERRCODE = '22023';
  END IF;

  IF p_feedback_type NOT IN ('hide', 'less_like_this', 'report') THEN
    RAISE EXCEPTION 'Type de feedback invalide: %', p_feedback_type USING ERRCODE = '22023';
  END IF;

  -- Validation d'existence de la cible
  IF p_target_type = 'post' THEN
    IF NOT EXISTS (SELECT 1 FROM public.community_posts WHERE id = p_target_id) THEN
      RAISE EXCEPTION 'Publication inexistante' USING ERRCODE = 'P0002';
    END IF;
  ELSIF p_target_type = 'author' THEN
    IF NOT EXISTS (SELECT 1 FROM public.user_profiles WHERE id = p_target_id) THEN
      RAISE EXCEPTION 'Auteur introuvable' USING ERRCODE = 'P0002';
    END IF;
  ELSIF p_target_type = 'carnet' THEN
    IF NOT EXISTS (SELECT 1 FROM public.carnets WHERE id = p_target_id) THEN
      RAISE EXCEPTION 'Carnet introuvable' USING ERRCODE = 'P0002';
    END IF;
  END IF;

  INSERT INTO public.content_feedback (
    user_id,
    target_type,
    target_id,
    feedback_type,
    reason
  ) VALUES (
    v_user_id,
    p_target_type,
    p_target_id,
    p_feedback_type,
    p_reason
  )
  ON CONFLICT (user_id, target_type, target_id, feedback_type)
  DO UPDATE SET
    reason = COALESCE(EXCLUDED.reason, public.content_feedback.reason),
    created_at = timezone('utc'::text, now())
  RETURNING id INTO v_feedback_id;

  RETURN v_feedback_id;
END;
$$;

REVOKE ALL ON FUNCTION public.submit_content_feedback(TEXT, UUID, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.submit_content_feedback(TEXT, UUID, TEXT, TEXT) TO authenticated, service_role;
