-- ==============================================================================
-- A1 — M8 : événements de domaine idempotents (ADR-AI-006)
-- adventure_domain_events + claim_pending_adventure_events (SKIP LOCKED)
-- Pattern calqué sur ai_jobs / claim_pending_ai_jobs (prouvé en production).
-- ==============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.adventure_domain_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type text NOT NULL,
  entity_type text NOT NULL,
  entity_id text NOT NULL,
  actor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'processing', 'processed', 'failed')),
  processor_version text NOT NULL,
  idempotency_key text NOT NULL,
  attempts integer NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz,
  CONSTRAINT adventure_domain_events_idempotency UNIQUE (idempotency_key)
);

COMMENT ON TABLE public.adventure_domain_events IS
  'File d''événements de domaine idempotente. Idempotence : '
  'event_type + entity_id + processor_version. Traitement service_role uniquement.';

CREATE INDEX IF NOT EXISTS idx_adventure_domain_events_status
  ON public.adventure_domain_events(status, created_at);
CREATE INDEX IF NOT EXISTS idx_adventure_domain_events_entity
  ON public.adventure_domain_events(entity_type, entity_id);

ALTER TABLE public.adventure_domain_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "adventure_domain_events_select_actor" ON public.adventure_domain_events;
CREATE POLICY "adventure_domain_events_select_actor"
  ON public.adventure_domain_events FOR SELECT TO authenticated
  USING (actor_id = auth.uid());

DROP POLICY IF EXISTS "adventure_domain_events_insert_actor" ON public.adventure_domain_events;
CREATE POLICY "adventure_domain_events_insert_actor"
  ON public.adventure_domain_events FOR INSERT TO authenticated
  WITH CHECK (actor_id = auth.uid() AND status = 'pending');

DROP POLICY IF EXISTS "adventure_domain_events_all_service" ON public.adventure_domain_events;
CREATE POLICY "adventure_domain_events_all_service"
  ON public.adventure_domain_events FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- Claim atomique : SKIP LOCKED, cap 5 tentatives (le retour rate == tentatives,
-- un job repoussé ne brûle pas de tentative côté claim).
CREATE OR REPLACE FUNCTION public.claim_pending_adventure_events(p_limit integer DEFAULT 10)
RETURNS SETOF public.adventure_domain_events
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  UPDATE public.adventure_domain_events
  SET status = 'processing'
  WHERE id IN (
    SELECT id FROM public.adventure_domain_events
    WHERE status = 'pending'
      AND attempts < 5
    ORDER BY created_at
    LIMIT greatest(p_limit, 1)
    FOR UPDATE SKIP LOCKED
  )
  RETURNING *;
$$;

REVOKE ALL ON FUNCTION public.claim_pending_adventure_events(integer) FROM public;
GRANT EXECUTE ON FUNCTION public.claim_pending_adventure_events(integer) TO service_role;

COMMIT;
