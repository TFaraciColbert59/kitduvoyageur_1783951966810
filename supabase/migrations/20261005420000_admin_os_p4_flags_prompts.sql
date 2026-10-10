-- ============================================================================
-- ADMIN OS P4 — flags + prompts : set_feature_flag(), registre prompts.
-- DOWN: DROP FUNCTION IF EXISTS public.set_feature_flag(text, boolean, text);
--       DROP FUNCTION IF EXISTS public.set_prompt_status(text, text, uuid);
--       DROP TABLE IF EXISTS public.ai_prompt_versions, public.ai_prompts;
-- set_feature_flag : voie UNIQUE d'écriture (SELECT seul pour authenticated).
-- set_prompt_status : promotion gouvernée — vers 'production' exige une
--   commande `ai.prompt.promote` APPROVED liée (resource_id = key).
-- ============================================================================

CREATE OR REPLACE FUNCTION public.set_feature_flag(
  p_flag_id text,
  p_enabled boolean,
  p_reason text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF char_length(btrim(coalesce(p_reason, ''))) < 10 THEN
    RAISE EXCEPTION 'reason_required' USING ERRCODE = '22023';
  END IF;
  IF NOT public.has_permission('features.flag.update') THEN
    RAISE EXCEPTION 'flag_forbidden' USING ERRCODE = '42501';
  END IF;
  UPDATE public.feature_flags
     SET enabled = p_enabled, updated_at = now(), updated_by = auth.uid()
   WHERE id = p_flag_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'flag_not_found' USING ERRCODE = '22023';
  END IF;
  RETURN p_enabled;
END;
$$;
REVOKE ALL ON FUNCTION public.set_feature_flag(text, boolean, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_feature_flag(text, boolean, text) TO authenticated;

CREATE TABLE IF NOT EXISTS public.ai_prompts (
  key text PRIMARY KEY,
  status text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'review', 'production', 'archived')),
  current_version integer NOT NULL DEFAULT 1,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES public.user_profiles(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS public.ai_prompt_versions (
  key text NOT NULL REFERENCES public.ai_prompts(key) ON DELETE CASCADE,
  version integer NOT NULL,
  content text NOT NULL,
  author_id uuid REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  test_set jsonb NOT NULL DEFAULT '[]',
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (key, version)
);

ALTER TABLE public.ai_prompts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_prompts FORCE ROW LEVEL SECURITY;
ALTER TABLE public.ai_prompt_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_prompt_versions FORCE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.ai_prompts FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.ai_prompts TO authenticated;
REVOKE ALL ON TABLE public.ai_prompt_versions FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT ON TABLE public.ai_prompt_versions TO authenticated;

DROP POLICY IF EXISTS ai_prompts_select ON public.ai_prompts;
CREATE POLICY ai_prompts_select ON public.ai_prompts
  FOR SELECT TO authenticated USING (public.has_permission('admin.access'));
DROP POLICY IF EXISTS ai_prompts_insert ON public.ai_prompts;
CREATE POLICY ai_prompts_insert ON public.ai_prompts
  FOR INSERT TO authenticated
  WITH CHECK (public.has_permission('ai.prompt.promote'));
DROP POLICY IF EXISTS ai_prompts_update ON public.ai_prompts;
CREATE POLICY ai_prompts_update ON public.ai_prompts
  FOR UPDATE TO authenticated
  USING (public.has_permission('ai.prompt.promote'))
  WITH CHECK (public.has_permission('ai.prompt.promote'));
DROP POLICY IF EXISTS ai_prompt_versions_select ON public.ai_prompt_versions;
CREATE POLICY ai_prompt_versions_select ON public.ai_prompt_versions
  FOR SELECT TO authenticated USING (public.has_permission('admin.access'));
DROP POLICY IF EXISTS ai_prompt_versions_insert ON public.ai_prompt_versions;
CREATE POLICY ai_prompt_versions_insert ON public.ai_prompt_versions
  FOR INSERT TO authenticated
  WITH CHECK (
    author_id = (select auth.uid())
    AND public.has_permission('ai.prompt.promote')
  );

CREATE OR REPLACE FUNCTION public.set_prompt_status(
  p_key text,
  p_status text,
  p_command_id uuid
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_cmd_key text;
  v_cmd_status text;
  v_cmd_resource text;
BEGIN
  IF p_status NOT IN ('draft', 'review', 'production', 'archived') THEN
    RAISE EXCEPTION 'invalid_status' USING ERRCODE = '22023';
  END IF;
  IF p_status = 'production' THEN
    SELECT c.command_key, c.status, c.resource_id
      INTO v_cmd_key, v_cmd_status, v_cmd_resource
      FROM public.admin_commands c
     WHERE c.id = p_command_id;
    IF NOT FOUND OR v_cmd_key <> 'ai.prompt.promote' OR v_cmd_resource <> p_key THEN
      RAISE EXCEPTION 'promotion_unlinked' USING ERRCODE = '22023';
    END IF;
    IF v_cmd_status <> 'approved' THEN
      RAISE EXCEPTION 'promotion_not_approved' USING ERRCODE = '22023';
    END IF;
    IF NOT public.has_permission('ai.prompt.promote') THEN
      RAISE EXCEPTION 'prompt_forbidden' USING ERRCODE = '42501';
    END IF;
  ELSE
    IF NOT public.has_permission('ai.prompt.promote') THEN
      RAISE EXCEPTION 'prompt_forbidden' USING ERRCODE = '42501';
    END IF;
  END IF;
  UPDATE public.ai_prompts
     SET status = p_status, updated_at = now(), updated_by = auth.uid()
   WHERE key = p_key;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'prompt_not_found' USING ERRCODE = '22023';
  END IF;
  RETURN p_status;
END;
$$;
REVOKE ALL ON FUNCTION public.set_prompt_status(text, text, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_prompt_status(text, text, uuid) TO authenticated;
