-- ============================================================================
-- TRIBU — Phase 4 : colonnes quorum + contraintes
-- ============================================================================
BEGIN;
SET LOCAL search_path = public;
SELECT plan(5);

SELECT ok(
  EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'group_polls'
      AND column_name = 'poll_type' AND column_default LIKE '%simple%'
  ),
  '1. QUORUM-01. group_polls.poll_type (defaut simple)'
);
SELECT ok(
  EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'group_polls'
      AND column_name = 'quorum_threshold' AND column_default LIKE '%0.5%'
  ),
  '2. QUORUM-01. group_polls.quorum_threshold (defaut 0.5)'
);
SELECT ok(
  EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'group_polls_poll_type_check' AND conrelid = 'public.group_polls'::regclass
  )
  AND EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'group_polls_quorum_threshold_check' AND conrelid = 'public.group_polls'::regclass
  )
  AND EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'group_poll_votes_option_index_check' AND conrelid = 'public.group_poll_votes'::regclass
  ),
  '3. QUORUM-02. contraintes poll_type / seuil / option_index presentes'
);

-- Fixtures minimales pour les contraintes
INSERT INTO auth.users (id, aud, role, email, encrypted_password, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
VALUES ('bd000000-0000-4000-8000-0000000000b1', 'authenticated', 'authenticated',
        'tribu_quorum@test.local', 'x', '{}', '{}', now(), now())
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.user_profiles (id, full_name, email, role, trust_score)
VALUES ('bd000000-0000-4000-8000-0000000000b1', 'QUORUM Test', 'tribu_quorum@test.local', 'user', 50)
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.travel_groups (id, name, owner_id)
VALUES ('bd000000-0000-4000-8000-0000000000b2', 'QUORUM Groupe',
        'bd000000-0000-4000-8000-0000000000b1')
ON CONFLICT (id) DO NOTHING;

SELECT throws_ok(
  $$ INSERT INTO public.group_polls (group_id, created_by, question, options, poll_type)
     VALUES ('bd000000-0000-4000-8000-0000000000b2',
             'bd000000-0000-4000-8000-0000000000b1', 'Q', '["a"]'::jsonb, 'invalide') $$,
  '23514', NULL,
  '4. QUORUM-02. poll_type invalide refuse'
);
INSERT INTO public.group_polls (id, group_id, created_by, question, options)
VALUES ('bd000000-0000-4000-8000-0000000000b3', 'bd000000-0000-4000-8000-0000000000b2',
        'bd000000-0000-4000-8000-0000000000b1', 'Q valide', '["a","b"]'::jsonb)
ON CONFLICT (id) DO NOTHING;

SELECT throws_ok(
  $$ INSERT INTO public.group_poll_votes (poll_id, user_id, option_index)
     VALUES ('bd000000-0000-4000-8000-0000000000b3',
             'bd000000-0000-4000-8000-0000000000b1', -1) $$,
  '23514', NULL,
  '5. QUORUM-02. option_index negatif refuse'
);

SELECT * FROM finish();
ROLLBACK;
