-- ============================================================================
-- TRIBU — Phase 2 : groupe eclair (colonnes, index)
-- ============================================================================
BEGIN;
SET LOCAL search_path = public;
SELECT plan(5);

SELECT ok(
  EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'travel_groups'
      AND column_name = 'is_ephemeral'
      AND data_type = 'boolean' AND is_nullable = 'NO'
      AND column_default = 'false'
  ),
  '1. EPHEM-01. is_ephemeral boolean NOT NULL DEFAULT false'
);
SELECT ok(
  EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'travel_groups'
      AND column_name = 'auto_dissolve_at' AND data_type = 'timestamp with time zone'
  ),
  '2. EPHEM-01. auto_dissolve_at timestamptz'
);
SELECT ok(
  EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public' AND indexname = 'idx_travel_groups_ephemeral_dissolve'
  ),
  '3. EPHEM-02. index de dissolution present'
);
SELECT ok(
  (SELECT indexdef FROM pg_indexes
    WHERE schemaname = 'public' AND indexname = 'idx_travel_groups_ephemeral_dissolve')
    LIKE '%WHERE%is_ephemeral%',
  '4. EPHEM-02. index partiel (WHERE is_ephemeral)'
);
INSERT INTO auth.users (id, aud, role, email, encrypted_password, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
VALUES ('bd000000-0000-4000-8000-0000000000aa', 'authenticated', 'authenticated',
        'tribu_ephem@test.local', 'x', '{}', '{}', now(), now())
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.user_profiles (id, full_name, email, role, trust_score)
VALUES ('bd000000-0000-4000-8000-0000000000aa', 'TRIBU Ephem', 'tribu_ephem@test.local', 'user', 50)
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.travel_groups (id, name, owner_id)
VALUES ('bd000000-0000-4000-8000-0000000000fa', 'TRIBU Ephem Groupe',
        'bd000000-0000-4000-8000-0000000000aa')
ON CONFLICT (id) DO NOTHING;
SELECT is(
  (SELECT (is_ephemeral, auto_dissolve_at IS NULL)::text FROM public.travel_groups
   WHERE id = 'bd000000-0000-4000-8000-0000000000fa'),
  '(f,t)',
  '5. EPHEM-03. groupe classique par defaut (false, NULL)'
);

SELECT * FROM finish();
ROLLBACK;
