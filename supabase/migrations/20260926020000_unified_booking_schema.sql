-- ============================================================================
-- Moteur de préparation unifié — schéma additif
--
-- public.activities reste la table des sessions et de l'historique.
-- public.trips reste la source de vérité des voyages.
-- Ce migration ajoute uniquement :
--   - le catalogue d'activités et ses métriques ;
--   - le panier commun produits + réservations ;
--   - les réservations fournisseurs ;
--   - la trace des promotions de modèle.
--
-- Règles :
--   - aucune donnée distante n'est touchée par ce fichier ;
--   - RLS explicite everywhere ;
--   - les écritures métier restent côté serveur ;
--   - chaque objet est replay-safe (IF EXISTS / DROP ... IF EXISTS).
-- ============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- Types additifs
-- ---------------------------------------------------------------------------
DO $migration$
BEGIN
  CREATE TYPE public.activity_logistics_scope AS ENUM (
    'none',
    'access',
    'stages',
    'full'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END
$migration$;

DO $migration$
BEGIN
  CREATE TYPE public.activity_metric_kind AS ENUM (
    'number',
    'duration',
    'distance',
    'elevation',
    'days',
    'budget',
    'technicity'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END
$migration$;

DO $migration$
BEGIN
  CREATE TYPE public.booking_vertical AS ENUM (
    'flight',
    'hotel',
    'car',
    'activity'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END
$migration$;

DO $migration$
BEGIN
  CREATE TYPE public.booking_provider AS ENUM (
    'routestack',
    'viator',
    'affiliate'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END
$migration$;

DO $migration$
BEGIN
  CREATE TYPE public.booking_status AS ENUM (
    'draft',
    'pending',
    'held',
    'confirmed',
    'cancelled',
    'expired',
    'failed',
    'refunded'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END
$migration$;

DO $migration$
BEGIN
  CREATE TYPE public.booking_checkout_mode AS ENUM (
    'deeplink',
    'acp'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END
$migration$;

DO $migration$
BEGIN
  CREATE TYPE public.cart_line_kind AS ENUM (
    'product',
    'booking'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END
$migration$;

-- ---------------------------------------------------------------------------
-- Catalogue d'activités
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.activity_catalog (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL,
  label text NOT NULL,
  family text NOT NULL,
  description text NOT NULL DEFAULT '',
  logistics_scope public.activity_logistics_scope NOT NULL,
  sport_tags text[] NOT NULL DEFAULT '{}',
  metrics jsonb NOT NULL DEFAULT '{}',
  is_seed boolean NOT NULL DEFAULT true,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT activity_catalog_slug_format_chk
    CHECK (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$' AND length(slug) BETWEEN 3 AND 120),
  CONSTRAINT activity_catalog_family_format_chk
    CHECK (family ~ '^[a-z0-9_]+$'),
  CONSTRAINT activity_catalog_label_chk
    CHECK (length(btrim(label)) BETWEEN 2 AND 160),
  CONSTRAINT activity_catalog_metrics_object_chk
    CHECK (jsonb_typeof(metrics) = 'object')
);

CREATE UNIQUE INDEX IF NOT EXISTS activity_catalog_slug_uniq
  ON public.activity_catalog (slug);
CREATE INDEX IF NOT EXISTS activity_catalog_scope_active_idx
  ON public.activity_catalog (logistics_scope, family)
  WHERE is_active;
CREATE INDEX IF NOT EXISTS activity_catalog_family_active_idx
  ON public.activity_catalog (family, label)
  WHERE is_active;

CREATE TABLE IF NOT EXISTS public.activity_catalog_metrics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  activity_id uuid NOT NULL
    REFERENCES public.activity_catalog(id) ON DELETE CASCADE,
  metric_key text NOT NULL,
  label text NOT NULL,
  unit text,
  value_kind public.activity_metric_kind NOT NULL,
  required boolean NOT NULL DEFAULT false,
  default_value numeric,
  min_value numeric,
  max_value numeric,
  weight smallint NOT NULL DEFAULT 1,
  position smallint NOT NULL DEFAULT 0,
  help_text text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT activity_catalog_metrics_key_format_chk
    CHECK (metric_key ~ '^[a-z][a-z0-9_]*$'),
  CONSTRAINT activity_catalog_metrics_label_chk
    CHECK (length(btrim(label)) BETWEEN 2 AND 120),
  CONSTRAINT activity_catalog_metrics_bounds_chk
    CHECK (
      min_value IS NULL
      OR max_value IS NULL
      OR min_value <= max_value
    ),
  CONSTRAINT activity_catalog_metrics_default_bounds_chk
    CHECK (
      default_value IS NULL
      OR (min_value IS NULL OR default_value >= min_value)
    ),
  CONSTRAINT activity_catalog_metrics_default_max_chk
    CHECK (
      default_value IS NULL
      OR (max_value IS NULL OR default_value <= max_value)
    ),
  CONSTRAINT activity_catalog_metrics_weight_chk
    CHECK (weight BETWEEN 0 AND 100),
  CONSTRAINT activity_catalog_metrics_position_chk
    CHECK (position >= 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS activity_catalog_metrics_activity_key_uniq
  ON public.activity_catalog_metrics (activity_id, metric_key);
CREATE INDEX IF NOT EXISTS activity_catalog_metrics_activity_position_idx
  ON public.activity_catalog_metrics (activity_id, position, id);

-- ---------------------------------------------------------------------------
-- Réservations fournisseurs
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.bookings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id uuid NOT NULL
    REFERENCES public.trips(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  vertical public.booking_vertical NOT NULL,
  provider public.booking_provider NOT NULL,
  external_ref text,
  amount_eur numeric(12,2) NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'EUR',
  status public.booking_status NOT NULL DEFAULT 'pending',
  checkout_mode public.booking_checkout_mode NOT NULL DEFAULT 'deeplink',
  metadata jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT bookings_amount_chk CHECK (amount_eur >= 0),
  CONSTRAINT bookings_currency_chk CHECK (currency ~ '^[A-Z]{3}$'),
  CONSTRAINT bookings_external_ref_chk
    CHECK (external_ref IS NULL OR length(btrim(external_ref)) BETWEEN 1 AND 255),
  CONSTRAINT bookings_metadata_object_chk CHECK (jsonb_typeof(metadata) = 'object')
);

CREATE UNIQUE INDEX IF NOT EXISTS bookings_provider_external_ref_uniq
  ON public.bookings (provider, external_ref)
  WHERE external_ref IS NOT NULL;
CREATE INDEX IF NOT EXISTS bookings_trip_id_idx
  ON public.bookings (trip_id, created_at DESC);
CREATE INDEX IF NOT EXISTS bookings_user_id_idx
  ON public.bookings (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS bookings_trip_status_idx
  ON public.bookings (trip_id, status);

-- ---------------------------------------------------------------------------
-- Panier unique : produits boutique + réservations
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.cart_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  trip_id uuid NOT NULL
    REFERENCES public.trips(id) ON DELETE CASCADE,
  kind public.cart_line_kind NOT NULL,
  ref_id uuid NOT NULL,
  quantity integer NOT NULL DEFAULT 1,
  unit_price_eur numeric(12,2) NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'EUR',
  metadata jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT cart_lines_quantity_chk CHECK (quantity > 0),
  CONSTRAINT cart_lines_price_chk CHECK (unit_price_eur >= 0),
  CONSTRAINT cart_lines_currency_chk CHECK (currency ~ '^[A-Z]{3}$'),
  CONSTRAINT cart_lines_metadata_object_chk CHECK (jsonb_typeof(metadata) = 'object')
);

CREATE UNIQUE INDEX IF NOT EXISTS cart_lines_owner_trip_kind_ref_uniq
  ON public.cart_lines (user_id, trip_id, kind, ref_id);
CREATE INDEX IF NOT EXISTS cart_lines_trip_id_idx
  ON public.cart_lines (trip_id, created_at DESC);
CREATE INDEX IF NOT EXISTS cart_lines_user_id_idx
  ON public.cart_lines (user_id, updated_at DESC);

-- ---------------------------------------------------------------------------
--Promotion de modèle : journal append-only, piloté service_role
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.model_promotions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  model_version text NOT NULL,
  previous_version text,
  score numeric(7,6) NOT NULL,
  promoted_at timestamptz NOT NULL DEFAULT now(),
  evidence jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT model_promotions_version_chk
    CHECK (model_version ~ '^[A-Za-z0-9][A-Za-z0-9._-]{1,119}$'),
  CONSTRAINT model_promotions_previous_version_chk
    CHECK (previous_version IS NULL OR previous_version <> model_version),
  CONSTRAINT model_promotions_score_chk CHECK (score >= 0 AND score <= 1),
  CONSTRAINT model_promotions_evidence_object_chk
    CHECK (jsonb_typeof(evidence) = 'object')
);

CREATE UNIQUE INDEX IF NOT EXISTS model_promotions_model_version_uniq
  ON public.model_promotions (model_version);
CREATE INDEX IF NOT EXISTS model_promotions_score_idx
  ON public.model_promotions (score DESC, promoted_at DESC);

-- ---------------------------------------------------------------------------
-- Validation de la référence du panier
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.validate_cart_line_reference()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  referenced_trip_id uuid;
  referenced_user_id uuid;
BEGIN
  IF NEW.kind = 'product' THEN
    IF NOT EXISTS (
      SELECT 1
      FROM public.shop_products
      WHERE id = NEW.ref_id
        AND COALESCE(is_active, true) = true
    ) THEN
      RAISE EXCEPTION 'cart_lines: product reference does not exist'
        USING ERRCODE = '23503';
    END IF;
  ELSIF NEW.kind = 'booking' THEN
    SELECT trip_id, user_id
    INTO referenced_trip_id, referenced_user_id
    FROM public.bookings
    WHERE id = NEW.ref_id;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'cart_lines: booking reference does not exist'
        USING ERRCODE = '23503';
    END IF;

    IF referenced_trip_id <> NEW.trip_id OR referenced_user_id <> NEW.user_id THEN
      RAISE EXCEPTION 'cart_lines: booking reference does not belong to the cart owner'
        USING ERRCODE = '23514';
    END IF;
  ELSE
    RAISE EXCEPTION 'cart_lines: unsupported kind'
      USING ERRCODE = '22023';
  END IF;

  RETURN NEW;
END
$function$;

DROP TRIGGER IF EXISTS cart_lines_validate_reference ON public.cart_lines;
CREATE TRIGGER cart_lines_validate_reference
  BEFORE INSERT OR UPDATE OF user_id, trip_id, kind, ref_id
  ON public.cart_lines
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_cart_line_reference();

-- ---------------------------------------------------------------------------
-- updated_at
-- ---------------------------------------------------------------------------
DROP TRIGGER IF EXISTS trg_activity_catalog_updated_at ON public.activity_catalog;
CREATE TRIGGER trg_activity_catalog_updated_at
  BEFORE UPDATE ON public.activity_catalog
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_activity_catalog_metrics_updated_at
  ON public.activity_catalog_metrics;
CREATE TRIGGER trg_activity_catalog_metrics_updated_at
  BEFORE UPDATE ON public.activity_catalog_metrics
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_bookings_updated_at ON public.bookings;
CREATE TRIGGER trg_bookings_updated_at
  BEFORE UPDATE ON public.bookings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_cart_lines_updated_at ON public.cart_lines;
CREATE TRIGGER trg_cart_lines_updated_at
  BEFORE UPDATE ON public.cart_lines
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
ALTER TABLE public.activity_catalog ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_catalog_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cart_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.model_promotions ENABLE ROW LEVEL SECURITY;

-- Catalogue public : lecture des seules entrées publiées.
DROP POLICY IF EXISTS activity_catalog_public_read ON public.activity_catalog;
CREATE POLICY activity_catalog_public_read
  ON public.activity_catalog
  FOR SELECT
  TO anon, authenticated
  USING (is_active);

DROP POLICY IF EXISTS activity_catalog_admin_write ON public.activity_catalog;
CREATE POLICY activity_catalog_admin_write
  ON public.activity_catalog
  FOR ALL
  TO authenticated
  USING ((SELECT public.is_admin()))
  WITH CHECK ((SELECT public.is_admin()));

-- Les métriques d'une activité publiée sont publiques ; celles d'un draft ne le sont pas.
DROP POLICY IF EXISTS activity_catalog_metrics_public_read
  ON public.activity_catalog_metrics;
CREATE POLICY activity_catalog_metrics_public_read
  ON public.activity_catalog_metrics
  FOR SELECT
  TO anon, authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.activity_catalog catalog
      WHERE catalog.id = activity_id
        AND catalog.is_active
    )
  );

DROP POLICY IF EXISTS activity_catalog_metrics_admin_write
  ON public.activity_catalog_metrics;
CREATE POLICY activity_catalog_metrics_admin_write
  ON public.activity_catalog_metrics
  FOR ALL
  TO authenticated
  USING ((SELECT public.is_admin()))
  WITH CHECK ((SELECT public.is_admin()));

-- Réservations : lecture par le propriétaire ou un éditeur du voyage ;
-- écriture uniquement par un éditeur du voyage, et toujours sous son user_id.
DROP POLICY IF EXISTS bookings_owner_read ON public.bookings;
CREATE POLICY bookings_owner_read
  ON public.bookings
  FOR SELECT
  TO authenticated
  USING (
    (SELECT auth.uid()) = user_id
    OR public.can_edit_trip(trip_id)
  );

DROP POLICY IF EXISTS bookings_trip_editor_write ON public.bookings;
CREATE POLICY bookings_trip_editor_write
  ON public.bookings
  FOR ALL
  TO authenticated
  USING (
    (SELECT auth.uid()) = user_id
    AND public.can_edit_trip(trip_id)
  )
  WITH CHECK (
    (SELECT auth.uid()) = user_id
    AND public.can_edit_trip(trip_id)
  );

-- Panier : mêmes règles que les réservations.
DROP POLICY IF EXISTS cart_lines_owner_read ON public.cart_lines;
CREATE POLICY cart_lines_owner_read
  ON public.cart_lines
  FOR SELECT
  TO authenticated
  USING (
    (SELECT auth.uid()) = user_id
    OR public.can_edit_trip(trip_id)
  );

DROP POLICY IF EXISTS cart_lines_trip_editor_write ON public.cart_lines;
CREATE POLICY cart_lines_trip_editor_write
  ON public.cart_lines
  FOR ALL
  TO authenticated
  USING (
    (SELECT auth.uid()) = user_id
    AND public.can_edit_trip(trip_id)
  )
  WITH CHECK (
    (SELECT auth.uid()) = user_id
    AND public.can_edit_trip(trip_id)
  );

-- Promotion : lecture authentifiée, aucune écriture client.
DROP POLICY IF EXISTS model_promotions_authenticated_read
  ON public.model_promotions;
CREATE POLICY model_promotions_authenticated_read
  ON public.model_promotions
  FOR SELECT
  TO authenticated
  USING (true);

-- ---------------------------------------------------------------------------
-- RPC catalogue
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.activities_by_scope(
  p_scope public.activity_logistics_scope
)
RETURNS SETOF public.activity_catalog
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $function$
  SELECT catalog.*
  FROM public.activity_catalog catalog
  WHERE catalog.is_active
    AND catalog.logistics_scope = p_scope
  ORDER BY catalog.family, catalog.label, catalog.slug
$function$;

REVOKE ALL ON FUNCTION public.activities_by_scope(
  public.activity_logistics_scope
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.activities_by_scope(
  public.activity_logistics_scope
) TO anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;

GRANT SELECT ON TABLE public.activity_catalog, public.activity_catalog_metrics
  TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.activity_catalog,
  public.activity_catalog_metrics
  TO authenticated, service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.bookings, public.cart_lines
  TO authenticated, service_role;

GRANT SELECT ON TABLE public.model_promotions TO authenticated, service_role;
GRANT INSERT, UPDATE, DELETE ON TABLE public.model_promotions TO service_role;

REVOKE ALL ON FUNCTION public.validate_cart_line_reference() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.validate_cart_line_reference() TO service_role;

COMMENT ON TABLE public.activity_catalog IS
  'Catalogue public des activités. public.activities reste reserved aux sessions/historique.';
COMMENT ON TABLE public.activity_catalog_metrics IS
  'MétriquesCanonicales utilisées par /prepare pour adapter automatiquement le formulaire.';
COMMENT ON TABLE public.bookings IS
  'Réservations fournisseurs liées à un voyage; écriture via BookingProvider côté serveur.';
COMMENT ON TABLE public.cart_lines IS
  'Panier unique LKDV : produits boutique et offres de réservation sélectionnées.';
COMMENT ON TABLE public.model_promotions IS
  'Journal append-only des promotions de modèle, alimenté par evaluate → promote.';

COMMIT;
