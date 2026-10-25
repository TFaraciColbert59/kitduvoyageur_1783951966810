-- ==============================================================================
-- A10 (10.8) — Durcissement de /api/adventure/generate
--
-- Audit 31bdb279 item #10 : la route n'avait ni idempotence, ni quota, ni
-- protection contre le double clic / les générations simultanées.
--
--   • UNIQUE (user_id, idempotency_key) : une clé déjà traitée renvoie la
--     réponse d'origine (plan_id) au lieu de régénérer ;
--   • index unique partiel (user_id) WHERE status = 'pending' : une seule
--     génération active par utilisateur ;
--   • RLS propriétaire en lecture seule (écriture service_role).
--
-- Migration additive et idempotente.
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.adventure_generation_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  idempotency_key text NOT NULL,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'done', 'failed')),
  plan_id uuid REFERENCES public.adventure_plans(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT adventure_generation_requests_unique UNIQUE (user_id, idempotency_key)
);

COMMENT ON TABLE public.adventure_generation_requests IS
  'A10 — requêtes de génération d''aventure : idempotence par '
  '(user_id, idempotency_key) et une seule génération active par utilisateur. '
  'Écriture service_role, lecture propriétaire.';

CREATE INDEX IF NOT EXISTS idx_adventure_generation_requests_recent
  ON public.adventure_generation_requests(user_id, created_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS idx_adventure_generation_requests_active
  ON public.adventure_generation_requests(user_id)
  WHERE status = 'pending';

COMMENT ON INDEX public.idx_adventure_generation_requests_active IS
  'A10 — au plus une génération active (pending) par utilisateur (audit #10).';

ALTER TABLE public.adventure_generation_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.adventure_generation_requests FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "adventure_generation_requests_select_own" ON public.adventure_generation_requests;
CREATE POLICY "adventure_generation_requests_select_own"
  ON public.adventure_generation_requests FOR SELECT TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "adventure_generation_requests_all_service" ON public.adventure_generation_requests;
CREATE POLICY "adventure_generation_requests_all_service"
  ON public.adventure_generation_requests FOR ALL TO service_role
  USING (true) WITH CHECK (true);
