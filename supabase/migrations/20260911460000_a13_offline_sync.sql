-- ==============================================================================
-- A13 (S6) — Registre d'idempotence de la synchronisation hors-ligne
--
-- Les opérations hors-ligne (sessions, signalements, décisions) portent une clé
-- d'idempotence SHA-256 (`kind:entityId:hash`, `offline/operations.ts`). Ce
-- registre mémorise les opérations ACQUITTÉES : un rejeu (transport instable,
-- crash, multi-onglets) retourne `duplicate` sans réappliquer l'opération.
--
--   • PK (user_id, idempotency_key) : unicité par utilisateur, jamais globale ;
--   • statut terminal uniquement (`applied` | `rejected`) : un échec n'est pas
--     acquitté et reste rejouable par le worker (backoff/dead-letter) ;
--   • journal immuable côté client : SELECT/INSERT propres, UPDATE/DELETE
--     réservés au service_role (jamais de réécriture destructive) ;
--   • migration additive et idempotente, aucune donnée préexistante modifiée.
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.offline_sync_operations (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  idempotency_key text NOT NULL,
  store text NOT NULL,
  kind text NOT NULL,
  status text NOT NULL CHECK (status IN ('applied', 'rejected')),
  result jsonb NOT NULL DEFAULT '{}'::jsonb,
  applied_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, idempotency_key)
);

COMMENT ON TABLE public.offline_sync_operations IS
  'A13 (S6) — registre d''idempotence des opérations hors-ligne acquittées '
  '(clé SHA-256 côté client). Rejeu ⇒ duplicate, jamais de réapplication.';

CREATE INDEX IF NOT EXISTS idx_offline_sync_operations_applied_at
  ON public.offline_sync_operations(user_id, applied_at DESC);

ALTER TABLE public.offline_sync_operations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.offline_sync_operations FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "offline_sync_operations_select_own" ON public.offline_sync_operations;
CREATE POLICY "offline_sync_operations_select_own"
  ON public.offline_sync_operations FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "offline_sync_operations_insert_own" ON public.offline_sync_operations;
CREATE POLICY "offline_sync_operations_insert_own"
  ON public.offline_sync_operations FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "offline_sync_operations_all_service" ON public.offline_sync_operations;
CREATE POLICY "offline_sync_operations_all_service"
  ON public.offline_sync_operations FOR ALL TO service_role
  USING (true) WITH CHECK (true);

REVOKE ALL ON public.offline_sync_operations FROM public;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE ALL ON public.offline_sync_operations FROM anon;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    GRANT SELECT, INSERT ON public.offline_sync_operations TO authenticated;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    GRANT ALL ON public.offline_sync_operations TO service_role;
  END IF;
END $$;
