-- ============================================================================
-- ADMIN OS P2-P5 — Remédiation RLS + fonctions (revue indépendante 10B/6M).
-- DOWN : recréer les policies d'origine (voir corps d'origine en commentaires
--   « ORIGINE » ci-dessous) ; DROP FUNCTION set_command_status,
--   get_feature_flag_cohorts, create_prompt_version.
-- 1. listings : public_read USING(true) → statut='actif' + policy admin.
-- 2. orders/trips : policies admin has_permission (additives, sans régression).
-- 3. moderation_queue : trust_score>=80 → has_permission('moderation.read').
-- 4. set_command_status() : compensation d'échec (failed/unknown).
-- 5. get_feature_flag_cohorts() : lecture cohortes admin (service_role only).
-- 6. create_prompt_version() : brouillon atomique (insert+update).
-- 7. elevations : trigger anti-tampering (seul revoked_at modifiable).
-- ACCEPTÉS (non-secrets, enforcement serveur) : feature_flags SELECT
-- authenticated, country_sync_log USING(true), hiking_routes public read.
-- ============================================================================

-- 1. listings : visibilité publique restreinte aux actifs.
-- ORIGINE (20260728150000:346) : FOR SELECT TO public USING (true)
DROP POLICY IF EXISTS "public_read_listings" ON public.listings;
CREATE POLICY "public_read_listings" ON public.listings
  FOR SELECT TO public USING (statut = 'actif');
DROP POLICY IF EXISTS "listings_admin_read" ON public.listings;
CREATE POLICY "listings_admin_read" ON public.listings
  FOR SELECT TO authenticated USING (public.has_permission('moderation.read'));

-- 2a. orders : lecture admin (additive).
DROP POLICY IF EXISTS "orders_admin_read" ON public.orders;
CREATE POLICY "orders_admin_read" ON public.orders
  FOR SELECT TO authenticated USING (public.has_permission('orders.read'));

-- 2b. trips : lecture admin (additive).
DROP POLICY IF EXISTS "trips_admin_read" ON public.trips;
CREATE POLICY "trips_admin_read" ON public.trips
  FOR SELECT TO authenticated USING (public.has_permission('trips.read'));

-- 3. moderation_queue : fin du bypass trust_score.
-- ORIGINE (20260715120000:64-72) : USING (EXISTS ... trust_score >= 80)
DROP POLICY IF EXISTS "moderation_queue_admin_read" ON public.moderation_queue;
CREATE POLICY "moderation_queue_admin_read" ON public.moderation_queue
  FOR SELECT TO authenticated
  USING (public.has_permission('moderation.read'));

-- 3b. user_profiles : lecture admin RBAC (additive — policies legacy intactes).
DROP POLICY IF EXISTS "user_profiles_admin_rbac_read" ON public.user_profiles;
CREATE POLICY "user_profiles_admin_rbac_read" ON public.user_profiles
  FOR SELECT TO authenticated USING (public.has_permission('users.read'));

-- 4. Compensation d'échec de commande (échec RPC → failed/unknown tracé).
CREATE OR REPLACE FUNCTION public.set_command_status(
  p_command_id uuid,
  p_status text,
  p_result jsonb DEFAULT NULL
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_key text;
BEGIN
  IF p_status NOT IN ('failed', 'unknown', 'cancelled') THEN
    RAISE EXCEPTION 'invalid_status' USING ERRCODE = '22023';
  END IF;
  SELECT c.command_key INTO v_key FROM public.admin_commands c WHERE c.id = p_command_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'command_not_found' USING ERRCODE = '22023';
  END IF;
  IF NOT (
    public.has_permission(v_key)
    OR public.has_active_elevation(v_key)
  ) THEN
    RAISE EXCEPTION 'command_forbidden' USING ERRCODE = '42501';
  END IF;
  UPDATE public.admin_commands
     SET status = p_status, result = coalesce(p_result, result)
   WHERE id = p_command_id;
  RETURN p_status;
END;
$$;
REVOKE ALL ON FUNCTION public.set_command_status(uuid, text, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_command_status(uuid, text, jsonb) TO authenticated;

-- 5. Lecture cohortes flags (service_role only côté table).
CREATE OR REPLACE FUNCTION public.get_feature_flag_cohorts()
RETURNS TABLE (flag_id text, percentage integer)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT c.flag_id, c.percentage FROM public.feature_flag_cohorts c
   WHERE public.has_permission('admin.access')
$$;
REVOKE ALL ON FUNCTION public.get_feature_flag_cohorts() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_feature_flag_cohorts() TO authenticated;

-- 6. Brouillon prompt atomique (insert version + bump, une transaction).
CREATE OR REPLACE FUNCTION public.create_prompt_version(
  p_key text,
  p_content text,
  p_test_set jsonb
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_next integer;
BEGIN
  IF NOT public.has_permission('ai.prompt.promote') THEN
    RAISE EXCEPTION 'prompt_forbidden' USING ERRCODE = '42501';
  END IF;
  IF char_length(p_content) < 1 OR char_length(p_content) > 200000 THEN
    RAISE EXCEPTION 'invalid_content' USING ERRCODE = '22023';
  END IF;
  INSERT INTO public.ai_prompts (key)
  VALUES (p_key)
  ON CONFLICT (key) DO NOTHING;
  SELECT coalesce(max(version), 0) + 1 INTO v_next
    FROM public.ai_prompt_versions WHERE key = p_key;
  INSERT INTO public.ai_prompt_versions (key, version, content, author_id, test_set)
  VALUES (p_key, v_next, p_content, auth.uid(), coalesce(p_test_set, '[]'));
  UPDATE public.ai_prompts
     SET current_version = v_next, updated_at = now(), updated_by = auth.uid()
   WHERE key = p_key;
  RETURN v_next;
END;
$$;
REVOKE ALL ON FUNCTION public.create_prompt_version(text, text, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_prompt_version(text, text, jsonb) TO authenticated;

-- 7. Anti-tampering élévations : seul revoked_at est modifiable en UPDATE.
CREATE OR REPLACE FUNCTION public.guard_elevation_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF OLD.user_id IS DISTINCT FROM NEW.user_id
     OR OLD.permission_code IS DISTINCT FROM NEW.permission_code
     OR OLD.reason IS DISTINCT FROM NEW.reason
     OR OLD.ticket_id IS DISTINCT FROM NEW.ticket_id
     OR OLD.granted_by IS DISTINCT FROM NEW.granted_by
     OR OLD.granted_at IS DISTINCT FROM NEW.granted_at
     OR OLD.expires_at IS DISTINCT FROM NEW.expires_at
     OR OLD.is_break_glass IS DISTINCT FROM NEW.is_break_glass THEN
    RAISE EXCEPTION 'elevation_immutable' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.guard_elevation_update() FROM PUBLIC;
DROP TRIGGER IF EXISTS trg_guard_elevation_update ON public.admin_elevations;
CREATE TRIGGER trg_guard_elevation_update
  BEFORE UPDATE ON public.admin_elevations
  FOR EACH ROW
  EXECUTE FUNCTION public.guard_elevation_update();
