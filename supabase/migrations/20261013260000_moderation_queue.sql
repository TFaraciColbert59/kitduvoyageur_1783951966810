-- ═══════════════════════════════════════════════════════════════════════════
-- MIGRATION: A-221/A-222/A-223 — file de modération unifiée et traçable
-- Chantier communauté (audit 2026-10-12) — P1 protection des membres
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Constat : trois sources de signalement coexistaient (commentaires, profils,
-- stories) sans vue commune, sans traçabilité de résolution, et sans garantir
-- que seul un modérateur/inspecteur tranche. La modération ne voyait pas
-- d'affaire réellement traitable.
--
-- Correctif :
--   1) `story_reports` reçoit le même contrat de statut que les autres
--      (pending → reviewed/dismissed) + qui/quand ;
--   2) les trois tables tracent `resolved_at`/`resolved_by` (trigger, jamais
--      fourni par le client) ;
--   3) seuls modérateurs/inspecteurs (admin_roles) lisent tout et tranchent ;
--   4) la vue `moderation_queue` (security_invoker) présente les trois sources
--      dans un contrat unique, avec aperçu de la cible — borné, jamais le
--      contenu privé d'une conversation.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1) story_reports : contrat de statut complet ───────────────────────────
ALTER TABLE public.story_reports
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'pending';
DO $$
BEGIN
  ALTER TABLE public.story_reports
    ADD CONSTRAINT story_reports_status_check CHECK (status IN ('pending', 'reviewed', 'dismissed'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ── 2) Traçabilité de résolution (les trois sources) ───────────────────────
ALTER TABLE public.story_reports ADD COLUMN IF NOT EXISTS resolved_at timestamptz;
ALTER TABLE public.story_reports ADD COLUMN IF NOT EXISTS resolved_by uuid REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public.comment_reports ADD COLUMN IF NOT EXISTS resolved_at timestamptz;
ALTER TABLE public.comment_reports ADD COLUMN IF NOT EXISTS resolved_by uuid REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public.group_reports ADD COLUMN IF NOT EXISTS resolved_at timestamptz;
ALTER TABLE public.group_reports ADD COLUMN IF NOT EXISTS resolved_by uuid REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE OR REPLACE FUNCTION public.stamp_report_resolution()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status AND NEW.status IN ('reviewed', 'dismissed') THEN
    NEW.resolved_by := COALESCE(auth.uid(), NEW.resolved_by);
    NEW.resolved_at := now();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS stamp_report_resolution ON public.story_reports;
CREATE TRIGGER stamp_report_resolution BEFORE UPDATE ON public.story_reports
  FOR EACH ROW EXECUTE FUNCTION public.stamp_report_resolution();
DROP TRIGGER IF EXISTS stamp_report_resolution ON public.comment_reports;
CREATE TRIGGER stamp_report_resolution BEFORE UPDATE ON public.comment_reports
  FOR EACH ROW EXECUTE FUNCTION public.stamp_report_resolution();
DROP TRIGGER IF EXISTS stamp_report_resolution ON public.group_reports;
CREATE TRIGGER stamp_report_resolution BEFORE UPDATE ON public.group_reports
  FOR EACH ROW EXECUTE FUNCTION public.stamp_report_resolution();

-- ── 3) Lecture/traitement réservés aux modérateurs et inspecteurs ──────────
DROP POLICY IF EXISTS story_reports_moderator_read ON public.story_reports;
CREATE POLICY story_reports_moderator_read ON public.story_reports
  FOR SELECT TO authenticated USING (public.is_moderateur());
DROP POLICY IF EXISTS story_reports_moderator_update ON public.story_reports;
CREATE POLICY story_reports_moderator_update ON public.story_reports
  FOR UPDATE TO authenticated
  USING (public.is_moderateur())
  WITH CHECK (public.is_moderateur());

DROP POLICY IF EXISTS group_reports_moderator_read ON public.group_reports;
CREATE POLICY group_reports_moderator_read ON public.group_reports
  FOR SELECT TO authenticated USING (public.is_moderateur());
DROP POLICY IF EXISTS group_reports_moderator_update ON public.group_reports;
CREATE POLICY group_reports_moderator_update ON public.group_reports
  FOR UPDATE TO authenticated
  USING (public.is_moderateur())
  WITH CHECK (public.is_moderateur());

DROP POLICY IF EXISTS comment_reports_moderator_read ON public.comment_reports;
CREATE POLICY comment_reports_moderator_read ON public.comment_reports
  FOR SELECT TO authenticated USING (public.is_moderateur());
DROP POLICY IF EXISTS comment_reports_moderator_update ON public.comment_reports;
CREATE POLICY comment_reports_moderator_update ON public.comment_reports
  FOR UPDATE TO authenticated
  USING (public.is_moderateur())
  WITH CHECK (public.is_moderateur());

-- ── 4) Vue unifiée ─────────────────────────────────────────────────────────
CREATE OR REPLACE VIEW public.community_moderation_queue
WITH (security_invoker = true)
AS
SELECT
  'comment'::text AS source,
  cr.id,
  cr.reporter_id,
  cr.status,
  cr.reason,
  cr.created_at,
  cr.resolved_at,
  cr.resolved_by,
  pc.author_id AS target_user_id,
  LEFT(COALESCE(pc.content, ''), 120) AS target_preview,
  jsonb_build_object('comment_id', cr.comment_id, 'table_name', cr.table_name, 'post_id', pc.post_id) AS context
FROM public.comment_reports cr
LEFT JOIN public.post_comments pc ON pc.id = cr.comment_id
UNION ALL
SELECT
  'profile'::text AS source,
  gr.id,
  gr.reporter_id,
  gr.status,
  COALESCE(gr.category, '') || CASE WHEN gr.reason IS NOT NULL THEN ' · ' || gr.reason ELSE '' END,
  gr.created_at,
  gr.resolved_at,
  gr.resolved_by,
  gr.reported_user_id AS target_user_id,
  NULL::text AS target_preview,
  jsonb_build_object('group_id', gr.group_id) AS context
FROM public.group_reports gr
UNION ALL
SELECT
  'story'::text AS source,
  sr.id,
  sr.reporter_id,
  sr.status,
  sr.reason,
  sr.created_at,
  sr.resolved_at,
  sr.resolved_by,
  sr.story_author_id AS target_user_id,
  LEFT(COALESCE(ps.caption, ps.image_url, ''), 120) AS target_preview,
  jsonb_build_object('story_id', sr.story_id) AS context
FROM public.story_reports sr
LEFT JOIN public.post_stories ps ON ps.id = sr.story_id;

REVOKE ALL ON public.community_moderation_queue FROM anon;
GRANT SELECT ON public.community_moderation_queue TO authenticated;

COMMENT ON VIEW public.community_moderation_queue IS
  'A-221 : file de modération unifiée (commentaires, profils, stories). security_invoker : chaque lecteur ne voit que ce que les RLS lui permettent (modérateurs : tout, déclarant : ses affaires).';
