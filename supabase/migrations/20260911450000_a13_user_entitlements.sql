-- ==============================================================================
-- A13 (S3) — Entitlements utilisateur (source de vérité du gating serveur)
--
-- Le domaine (`domain/entitlements.ts`) reste la seule source des règles.
-- Cette table ne fait que stocker le plan effectif et les passes actifs d'un
-- utilisateur, alimentés par les métadonnées Stripe existantes (webhook) ou
-- manuellement (service_role). Aucun prix, aucun produit, aucune invention :
-- un utilisateur absent ou inconnu retombe sur `free` sans entitlement.
--
-- Migration additive et idempotente. RLS : lecture de sa propre ligne par
-- `authenticated` ; écriture réservée à service_role.
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.user_entitlements (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  plan text NOT NULL DEFAULT 'free'
    CHECK (plan IN ('free', 'explorer', 'expedition', 'group')),
  active_passes jsonb NOT NULL DEFAULT '[]'::jsonb
    CHECK (jsonb_typeof(active_passes) = 'array'),
  source text NOT NULL DEFAULT 'default'
    CHECK (source IN ('default', 'stripe_metadata', 'manual')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.user_entitlements IS
  'A13 (S3) — plan effectif et passes actifs par utilisateur. Alimentée depuis '
  'les métadonnées Stripe existantes (webhook) ou manuellement. Le domaine '
  'des entitlements (`domain/entitlements.ts`) reste la seule autorité.';

ALTER TABLE public.user_entitlements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "user_entitlements_select_own" ON public.user_entitlements;
CREATE POLICY "user_entitlements_select_own"
  ON public.user_entitlements FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "user_entitlements_all_service" ON public.user_entitlements;
CREATE POLICY "user_entitlements_all_service"
  ON public.user_entitlements FOR ALL TO service_role
  USING (true) WITH CHECK (true);

REVOKE ALL ON public.user_entitlements FROM public;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE ALL ON public.user_entitlements FROM anon;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    GRANT SELECT ON public.user_entitlements TO authenticated;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    GRANT ALL ON public.user_entitlements TO service_role;
  END IF;
END $$;

DROP TRIGGER IF EXISTS trg_user_entitlements_updated_at ON public.user_entitlements;
CREATE TRIGGER trg_user_entitlements_updated_at
  BEFORE UPDATE ON public.user_entitlements
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
