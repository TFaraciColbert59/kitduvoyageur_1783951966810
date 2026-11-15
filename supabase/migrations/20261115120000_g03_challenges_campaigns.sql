-- ============================================================================
-- G03 : Défis privés (S5.21), Meilleur effort (S5.22), Courses virtuelles (S5.23),
--       Campagnes partenaires B2B (S6.26) et compensation idempotente C-REWARD.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.g03_challenges (
  id TEXT PRIMARY KEY,
  version INTEGER NOT NULL DEFAULT 1,
  kind TEXT NOT NULL CHECK (
    kind IN ('public', 'sponsored', 'private_invite', 'best_effort', 'virtual_race', 'campaign')
  ),
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  sport TEXT NOT NULL DEFAULT 'all',
  criterion TEXT NOT NULL CHECK (
    criterion IN (
      'distance_meters',
      'elevation_gain_meters',
      'duration_sec',
      'activity_count',
      'zone_visit',
      'gps_point_radius',
      'best_effort_time'
    )
  ),
  target_value NUMERIC NOT NULL,
  unit TEXT NOT NULL,
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ NOT NULL,
  reward_badge_id TEXT NOT NULL DEFAULT '',
  reward_title TEXT NOT NULL DEFAULT '',
  reward_points INTEGER NOT NULL DEFAULT 0,
  created_by UUID REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  invited_user_ids UUID[] NOT NULL DEFAULT '{}'::uuid[],
  sponsor_id TEXT,
  sponsor_name TEXT,
  partner_id TEXT,
  partner_available BOOLEAN NOT NULL DEFAULT true,
  max_duration_sec INTEGER,
  registration_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_g03_challenges_kind ON public.g03_challenges (kind, ends_at DESC);
CREATE INDEX IF NOT EXISTS idx_g03_challenges_created_by ON public.g03_challenges (created_by);

ALTER TABLE public.g03_challenges ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "g03_challenges_select" ON public.g03_challenges;
CREATE POLICY "g03_challenges_select"
  ON public.g03_challenges FOR SELECT TO authenticated
  USING (
    kind IN ('public', 'sponsored', 'virtual_race')
    OR (kind = 'best_effort' AND created_by = auth.uid())
    OR (
      kind = 'private_invite'
      AND (created_by = auth.uid() OR auth.uid() = ANY(invited_user_ids))
    )
    OR public.is_admin()
  );

DROP POLICY IF EXISTS "g03_challenges_insert_own" ON public.g03_challenges;
CREATE POLICY "g03_challenges_insert_own"
  ON public.g03_challenges FOR INSERT TO authenticated
  WITH CHECK (
    created_by = auth.uid()
    AND kind IN ('private_invite', 'best_effort')
  );

DROP POLICY IF EXISTS "g03_challenges_admin_all" ON public.g03_challenges;
CREATE POLICY "g03_challenges_admin_all"
  ON public.g03_challenges FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- Inscriptions aux courses virtuelles partenaires (S5.23)
CREATE TABLE IF NOT EXISTS public.g03_virtual_race_registrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  challenge_id TEXT NOT NULL REFERENCES public.g03_challenges(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'registered' CHECK (status IN ('registered', 'withdrawn')),
  registered_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (challenge_id, user_id)
);

ALTER TABLE public.g03_virtual_race_registrations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "g03_race_reg_own" ON public.g03_virtual_race_registrations;
CREATE POLICY "g03_race_reg_own"
  ON public.g03_virtual_race_registrations FOR ALL TO authenticated
  USING (user_id = auth.uid() OR public.is_admin())
  WITH CHECK (user_id = auth.uid() OR public.is_admin());

-- Campagnes sponsorisées B2B (S6.26 — réservées admin / partenaire)
CREATE TABLE IF NOT EXISTS public.g03_campaigns (
  campaign_id TEXT PRIMARY KEY,
  sponsor_id TEXT NOT NULL,
  sponsor_name TEXT NOT NULL,
  title TEXT NOT NULL,
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ NOT NULL,
  allowed_sports TEXT[] NOT NULL DEFAULT ARRAY['all']::text[],
  min_distance_meters INTEGER,
  min_elevation_gain_meters INTEGER,
  requires_public_visibility BOOLEAN NOT NULL DEFAULT true,
  created_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.g03_campaigns ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "g03_campaigns_admin" ON public.g03_campaigns;
CREATE POLICY "g03_campaigns_admin"
  ON public.g03_campaigns FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- Compensation idempotente C-REWARD lors d'une suppression / invalidation / bascule privée
CREATE OR REPLACE FUNCTION public.compensate_progression_source(
  p_user_id UUID,
  p_source_type TEXT,
  p_source_id TEXT,
  p_reason TEXT DEFAULT 'revoked'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tx RECORD;
  v_comp_key TEXT;
  v_alloc JSONB;
  v_count INTEGER := 0;
  v_points INTEGER := 0;
BEGIN
  IF p_user_id IS NULL OR COALESCE(btrim(p_source_type), '') = '' OR COALESCE(btrim(p_source_id), '') = '' THEN
    RETURN jsonb_build_object('compensatedCount', 0, 'reversedPoints', 0);
  END IF;

  FOR v_tx IN
    SELECT *
    FROM public.reward_transactions
    WHERE user_id = p_user_id
      AND reference_type = p_source_type
      AND COALESCE(metadata->>'source_id', '') = p_source_id
      AND points > 0
  LOOP
    v_comp_key := 'compensate:' || COALESCE(v_tx.idempotency_key, v_tx.id::text);

    IF v_tx.skill_allocations IS NOT NULL AND jsonb_typeof(v_tx.skill_allocations) = 'array' THEN
      SELECT jsonb_agg(
        jsonb_build_object(
          'skill', elem->>'skill',
          'weight', COALESCE((elem->>'weight')::numeric, 0),
          'points', -COALESCE((elem->>'points')::integer, 0)
        )
      )
      INTO v_alloc
      FROM jsonb_array_elements(v_tx.skill_allocations) elem;
    ELSE
      v_alloc := NULL;
    END IF;

    INSERT INTO public.reward_transactions (
      user_id,
      points,
      transaction_type,
      reference_id,
      reference_type,
      metadata,
      idempotency_key,
      effective_at,
      season_id,
      rules_version,
      skill_allocations,
      counts_for_progression,
      affects_balance
    )
    VALUES (
      v_tx.user_id,
      -v_tx.points,
      'FRAUD_REVERSAL',
      v_tx.id,
      v_tx.reference_type,
      COALESCE(v_tx.metadata, '{}'::jsonb) || jsonb_build_object(
        'compensated_tx_id', v_tx.id,
        'compensation_reason', COALESCE(NULLIF(btrim(p_reason), ''), 'revoked'),
        'source_id', p_source_id
      ),
      v_comp_key,
      now(),
      v_tx.season_id,
      v_tx.rules_version,
      v_alloc,
      v_tx.counts_for_progression,
      v_tx.affects_balance
    )
    ON CONFLICT (idempotency_key) WHERE idempotency_key IS NOT NULL DO NOTHING;

    IF FOUND THEN
      v_count := v_count + 1;
      v_points := v_points + v_tx.points;
    END IF;
  END LOOP;

  RETURN jsonb_build_object('compensatedCount', v_count, 'reversedPoints', v_points);
END;
$$;

REVOKE ALL ON FUNCTION public.compensate_progression_source(UUID, TEXT, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.compensate_progression_source(UUID, TEXT, TEXT, TEXT) TO service_role;
