-- ============================================================================
-- PHASE 8 — Idempotence des événements Stripe (ADDITIF)
-- ============================================================================
-- Table de suivi des événements webhook Stripe traités. Elle garantit qu'une
-- livraison dupliquée (retry Stripe, double livraison) n'est traitée qu'une
-- seule fois, indépendamment de l'idempotence métier par commande.
--
-- Aucune donnée personnelle : uniquement l'identifiant d'événement Stripe,
-- son type, sa classification interne, l'identifiant d'objet Stripe et l'état
-- de traitement. Accès service_role exclusivement (aucune policy : RLS
-- fermée par défaut ; les clients anon/authenticated ne peuvent ni lire ni
-- écrire).
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.stripe_events (
  event_id text PRIMARY KEY,
  type text NOT NULL,
  kind text NOT NULL,
  livemode boolean NOT NULL DEFAULT false,
  object_id text,
  status text NOT NULL DEFAULT 'processing'
    CHECK (status IN ('processing', 'processed', 'failed')),
  attempts integer NOT NULL DEFAULT 1,
  first_seen_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz
);

ALTER TABLE public.stripe_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stripe_events FORCE ROW LEVEL SECURITY;

REVOKE ALL ON public.stripe_events FROM anon, authenticated;
GRANT ALL ON public.stripe_events TO service_role;

CREATE INDEX IF NOT EXISTS idx_stripe_events_type
  ON public.stripe_events (type, first_seen_at DESC);

COMMENT ON TABLE public.stripe_events IS
  'Phase 8 — idempotence webhook Stripe (service_role uniquement, aucune PII).';
