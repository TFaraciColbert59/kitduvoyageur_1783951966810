-- ==============================================================================
-- A11 — Terrain Live : fusion atomique et corroboration unique par utilisateur
--
-- Répond aux constats #18 (fusion anti-doublon non atomique), #19 (un même
-- utilisateur peut artificiellement renforcer un rapport) et #20 (course lors
-- des confirmations, couverte par le retour 23505 côté serveur) de l'audit.
--
-- Additif et idempotent. L'autorité DDL de `terrain_reports` reste
-- `20260911134000_a1_terrain_live.sql` :
--
--   • `terrain_report_contributors` : registre administratif interne (une ligne
--     par rapport et par utilisateur ayant renforcé le signalement par fusion).
--     Jamais exposé : RLS service_role uniquement, REVOKE anon/authenticated.
--   • `a11_merge_terrain_report(...)` : fusion transactionnelle. L'incrément de
--     `report_count` et l'escalade sévérité/passabilité ne s'appliquent que si
--     le contributeur est nouveau (ON CONFLICT DO NOTHING + FOUND). Le rapport
--     est toujours « touché » (`updated_at`). Retourne
--     `{ merged: boolean, report_count: integer }`.
-- ==============================================================================

-- ── 1. Registre des contributeurs de fusion (interne, jamais public) ─────────
CREATE TABLE IF NOT EXISTS public.terrain_report_contributors (
  report_id uuid NOT NULL REFERENCES public.terrain_reports(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  first_report_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (report_id, user_id)
);

COMMENT ON TABLE public.terrain_report_contributors IS
  'A11 — registre administratif des contributeurs ayant renforcé un signalement '
  'par fusion (une ligne par rapport et par utilisateur). Sert de preuve de '
  'corroboration unique : un même utilisateur ne peut incrémenter report_count '
  'qu''une seule fois. Jamais exposé (service_role uniquement).';

CREATE INDEX IF NOT EXISTS idx_terrain_report_contributors_user
  ON public.terrain_report_contributors(user_id);

ALTER TABLE public.terrain_report_contributors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.terrain_report_contributors FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "terrain_report_contributors_all_service"
  ON public.terrain_report_contributors;
CREATE POLICY "terrain_report_contributors_all_service"
  ON public.terrain_report_contributors FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- Lecture/écriture strictement internes : aucune surface anon/authenticated.
REVOKE ALL ON TABLE public.terrain_report_contributors FROM public;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE ALL ON TABLE public.terrain_report_contributors FROM anon;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    REVOKE ALL ON TABLE public.terrain_report_contributors FROM authenticated;
  END IF;
END $$;
GRANT ALL ON TABLE public.terrain_report_contributors TO service_role;

-- ── 2. Fusion transactionnelle d'un doublon ──────────────────────────────────
CREATE OR REPLACE FUNCTION public.a11_merge_terrain_report(
  p_report_id uuid,
  p_contributor_id uuid,
  p_severity text DEFAULT NULL,
  p_passability text DEFAULT NULL,
  p_now timestamptz DEFAULT now()
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_new_contributor boolean := false;
  v_report_count integer;
  v_touched_at timestamptz := coalesce(p_now, now());
BEGIN
  IF p_severity IS NOT NULL AND p_severity NOT IN ('info', 'warning', 'critical') THEN
    RAISE EXCEPTION 'a11_merge_terrain_report: severite invalide %', p_severity
      USING ERRCODE = '22023';
  END IF;
  IF p_passability IS NOT NULL
     AND p_passability NOT IN ('passable', 'difficult', 'impassable', 'unknown') THEN
    RAISE EXCEPTION 'a11_merge_terrain_report: passabilite invalide %', p_passability
      USING ERRCODE = '22023';
  END IF;

  -- Corroboration unique : seul un contributeur jamais vu incrémente le compte.
  INSERT INTO public.terrain_report_contributors (report_id, user_id, first_report_at)
  VALUES (p_report_id, p_contributor_id, v_touched_at)
  ON CONFLICT (report_id, user_id) DO NOTHING;
  v_new_contributor := FOUND;

  IF v_new_contributor THEN
    UPDATE public.terrain_reports r
    SET report_count = r.report_count + 1,
        -- Escalade seulement : la sévérité/passabilité existante n'est jamais
        -- atténuée par une fusion.
        severity = CASE
          WHEN p_severity = 'critical' OR r.severity = 'critical' THEN 'critical'
          WHEN p_severity = 'warning' OR r.severity = 'warning' THEN 'warning'
          ELSE 'info'
        END,
        passability = CASE
          WHEN p_passability = 'impassable' OR r.passability = 'impassable' THEN 'impassable'
          WHEN p_passability = 'difficult' OR r.passability = 'difficult' THEN 'difficult'
          WHEN p_passability = 'passable' OR r.passability = 'passable' THEN 'passable'
          ELSE 'unknown'
        END,
        updated_at = v_touched_at
    WHERE r.id = p_report_id
    RETURNING r.report_count INTO v_report_count;
  ELSE
    -- Fusion déjà comptée pour ce contributeur : seul updated_at est touché.
    UPDATE public.terrain_reports r
    SET updated_at = v_touched_at
    WHERE r.id = p_report_id
    RETURNING r.report_count INTO v_report_count;
  END IF;

  IF v_report_count IS NULL THEN
    RAISE EXCEPTION 'a11_merge_terrain_report: rapport % introuvable', p_report_id
      USING ERRCODE = 'no_data_found';
  END IF;

  RETURN jsonb_build_object('merged', v_new_contributor, 'report_count', v_report_count);
END;
$$;

COMMENT ON FUNCTION public.a11_merge_terrain_report(uuid, uuid, text, text, timestamptz) IS
  'A11 — fusion atomique d''un signalement doublon : enregistre le contributeur '
  '(ON CONFLICT DO NOTHING), n''incrémente report_count et n''escalade '
  'sévérité/passabilité que pour un nouveau contributeur, touche toujours '
  'updated_at, retourne { merged, report_count }. SECURITY DEFINER, '
  'search_path verrouillé, service_role uniquement.';

-- ── 3. Droits : RPC strictement serveur ──────────────────────────────────────
REVOKE ALL ON FUNCTION public.a11_merge_terrain_report(uuid, uuid, text, text, timestamptz)
  FROM public;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE ALL ON FUNCTION public.a11_merge_terrain_report(uuid, uuid, text, text, timestamptz)
      FROM anon;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    REVOKE ALL ON FUNCTION public.a11_merge_terrain_report(uuid, uuid, text, text, timestamptz)
      FROM authenticated;
  END IF;
END $$;
GRANT EXECUTE ON FUNCTION public.a11_merge_terrain_report(uuid, uuid, text, text, timestamptz)
  TO service_role;
