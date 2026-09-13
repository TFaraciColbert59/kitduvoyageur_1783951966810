-- ============================================================
-- TRIBU — M9 : sondages a quorum (decisions importantes)
-- ============================================================
-- La resolution est CALCULEE A LA LECTURE (module applicatif pur),
-- aucun etat derive n'est stocke : `poll_type` + `quorum_threshold`
-- suffisent a deriver adoption et quorum a tout moment.
-- ============================================================

ALTER TABLE public.group_polls
  ADD COLUMN IF NOT EXISTS poll_type TEXT NOT NULL DEFAULT 'simple',
  ADD COLUMN IF NOT EXISTS quorum_threshold NUMERIC NOT NULL DEFAULT 0.5;

DO $$ BEGIN
  ALTER TABLE public.group_polls
    ADD CONSTRAINT group_polls_poll_type_check
    CHECK (poll_type IN ('simple', 'quorum_majority', 'organizer_approval'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.group_polls
    ADD CONSTRAINT group_polls_quorum_threshold_check
    CHECK (quorum_threshold > 0 AND quorum_threshold <= 1);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.group_poll_votes
    ADD CONSTRAINT group_poll_votes_option_index_check
    CHECK (option_index >= 0);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
