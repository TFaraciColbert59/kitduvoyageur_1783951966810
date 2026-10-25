-- ============================================================
-- Content Counters — Automatic Trigger Maintenance
--
-- Problème : likes_count, comments_count, views_count sur
-- `carnets` n'étaient jamais mis à jour automatiquement.
-- Les valeurs affichées dans CarnetsTab restaient à 0 ou
-- aux valeurs initiales du seed.
--
-- Solution : Triggers AFTER INSERT/DELETE sur les tables
-- enfants (carnet_likes, carnet_comments, carnet_views)
-- pour maintenir les compteurs atomiquement.
-- ============================================================

-- ─── 1. Trigger : carnet_likes → carnets.likes_count ─────

CREATE OR REPLACE FUNCTION public.sync_carnet_likes_count()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.carnets
    SET likes_count = likes_count + 1
    WHERE id = NEW.carnet_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.carnets
    SET likes_count = GREATEST(0, likes_count - 1)
    WHERE id = OLD.carnet_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_carnet_likes_sync_count ON public.carnet_likes;
CREATE TRIGGER trg_carnet_likes_sync_count
  AFTER INSERT OR DELETE ON public.carnet_likes
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_carnet_likes_count();

-- ─── 2. Trigger : carnet_comments → carnets.comments_count ─

CREATE OR REPLACE FUNCTION public.sync_carnet_comments_count()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.carnets
    SET comments_count = comments_count + 1
    WHERE id = NEW.carnet_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.carnets
    SET comments_count = GREATEST(0, comments_count - 1)
    WHERE id = OLD.carnet_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_carnet_comments_sync_count ON public.carnet_comments;
CREATE TRIGGER trg_carnet_comments_sync_count
  AFTER INSERT OR DELETE ON public.carnet_comments
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_carnet_comments_count();

-- ─── 3. Table + Trigger : vues ────────────────────────────

CREATE TABLE IF NOT EXISTS public.carnet_views (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  carnet_id UUID NOT NULL REFERENCES public.carnets(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  ip_address TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_carnet_views_carnet_id ON public.carnet_views(carnet_id);

ALTER TABLE public.carnet_views ENABLE ROW LEVEL SECURITY;

-- Anyone can insert views (anonymous viewing allowed)
DROP POLICY IF EXISTS "public_insert_carnet_views" ON public.carnet_views;
CREATE POLICY "public_insert_carnet_views" ON public.carnet_views
  FOR INSERT TO public WITH CHECK (true);

-- Only carnet owner or admin can read views data
DROP POLICY IF EXISTS "owner_read_carnet_views" ON public.carnet_views;
CREATE POLICY "owner_read_carnet_views" ON public.carnet_views
  FOR SELECT TO authenticated
  USING (
    carnet_id IN (
      SELECT id FROM public.carnets WHERE author_id = auth.uid()
    )
    OR EXISTS (SELECT 1 FROM public.user_profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE OR REPLACE FUNCTION public.sync_carnet_views_count()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
BEGIN
  UPDATE public.carnets
  SET views_count = views_count + 1
  WHERE id = NEW.carnet_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_carnet_views_sync_count ON public.carnet_views;
CREATE TRIGGER trg_carnet_views_sync_count
  AFTER INSERT ON public.carnet_views
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_carnet_views_count();

-- ─── 3b. Trigger : carnet_favorites → carnets.favorites_count ─

CREATE OR REPLACE FUNCTION public.sync_carnet_favorites_count()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.carnets
    SET favorites_count = favorites_count + 1
    WHERE id = NEW.carnet_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.carnets
    SET favorites_count = GREATEST(0, favorites_count - 1)
    WHERE id = OLD.carnet_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_carnet_favorites_sync_count ON public.carnet_favorites;
CREATE TRIGGER trg_carnet_favorites_sync_count
  AFTER INSERT OR DELETE ON public.carnet_favorites
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_carnet_favorites_count();

-- ─── 4. Backfill : corriger les compteurs existants ───────

-- likes_count = nombre réel de likes
UPDATE public.carnets c
SET likes_count = COALESCE(
  (SELECT COUNT(*) FROM public.carnet_likes cl WHERE cl.carnet_id = c.id),
  0
);

-- comments_count = nombre réel de commentaires
UPDATE public.carnets c
SET comments_count = COALESCE(
  (SELECT COUNT(*) FROM public.carnet_comments cc WHERE cc.carnet_id = c.id),
  0
);
