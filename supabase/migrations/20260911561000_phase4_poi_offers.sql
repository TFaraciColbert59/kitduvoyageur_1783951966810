-- ==============================================================================
-- Phase 4 — Séparation POI géographiques / offres commerciales / affiliation
-- Migration : 20260911561000_phase4_poi_offers.sql
--
-- CHANTIER_LANCEMENT_MONDIAL §Phase 4 :
--   • séparer : POI géographique / offre commerciale / affiliation /
--     disponibilité-prix HORODATÉ ;
--   • afficher clairement « lien affilié » ;
--   • implémenter expiration et actualisation des offres.
--
-- Existant audité :
--   • POI géographiques : trail_pois, outdoor_points, map_refuges,
--     map_summits, map_water_points (inchangés — aucune donnée inventée) ;
--   • offre commerciale : affiliate_offers (prix, disponibilité, validité) ;
--   • affiliation : affiliate_links / affiliate_partners / affiliate_programs.
--
-- Ajouts ADDITIFS :
--   • horodatage explicite de la vérification prix/disponibilité ;
--   • expiration d'offre ;
--   • lien offre → lien affilié (nullable) + vue servie qui expose
--     `has_affiliate_link` (jamais de prix/dispo inventé : NULL reste NULL).
-- Aucune donnée insérée. Aucun prix inventé.
-- ==============================================================================

-- ── 1. Horodatage et expiration des offres ───────────────────────────────────
ALTER TABLE public.affiliate_offers
  ADD COLUMN IF NOT EXISTS link_id uuid REFERENCES public.affiliate_links(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS price_checked_at timestamptz,
  ADD COLUMN IF NOT EXISTS availability_checked_at timestamptz,
  ADD COLUMN IF NOT EXISTS expires_at timestamptz;

COMMENT ON COLUMN public.affiliate_offers.price_checked_at IS
  'Phase 4 — date de dernière vérification du prix. Un prix sans horodatage n''est pas servi.';
COMMENT ON COLUMN public.affiliate_offers.availability_checked_at IS
  'Phase 4 — date de dernière vérification de la disponibilité.';
COMMENT ON COLUMN public.affiliate_offers.expires_at IS
  'Phase 4 — expiration de l''offre (NULL = inconnue, jamais inventée).';

CREATE INDEX IF NOT EXISTS idx_affiliate_offers_link
  ON public.affiliate_offers (link_id);
CREATE INDEX IF NOT EXISTS idx_affiliate_offers_expires
  ON public.affiliate_offers (expires_at)
  WHERE expires_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_affiliate_offers_price_checked
  ON public.affiliate_offers (price_checked_at)
  WHERE price IS NOT NULL;

-- ── 2. Garde-fous d'horodatage (NOT VALID : lignes historiques préservées) ───
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'affiliate_offers_price_timestamp_chk'
  ) THEN
    ALTER TABLE public.affiliate_offers
      ADD CONSTRAINT affiliate_offers_price_timestamp_chk
      CHECK (price IS NULL OR price_checked_at IS NOT NULL) NOT VALID;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'affiliate_offers_availability_timestamp_chk'
  ) THEN
    ALTER TABLE public.affiliate_offers
      ADD CONSTRAINT affiliate_offers_availability_timestamp_chk
      CHECK (availability IS NULL OR availability_checked_at IS NOT NULL) NOT VALID;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'affiliate_offers_expiry_chk'
  ) THEN
    ALTER TABLE public.affiliate_offers
      ADD CONSTRAINT affiliate_offers_expiry_chk
      CHECK (expires_at IS NULL OR expires_at >= created_at) NOT VALID;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'affiliate_offers_validity_order_chk'
  ) THEN
    ALTER TABLE public.affiliate_offers
      ADD CONSTRAINT affiliate_offers_validity_order_chk
      CHECK (valid_to IS NULL OR valid_from IS NULL OR valid_to > valid_from) NOT VALID;
  END IF;
END $$;

-- ── 3. Vue servie : POI/offres + affiliation, drapeau `has_affiliate_link` ───
-- SECURITY INVOKER : la vue respecte les RLS des tables sous-jacentes.
-- Aucune valeur dérivée inventée : le prix reste NULL s'il est inconnu ;
-- l'expiration n'est qu'un drapeau calculé, jamais une donnée fabriquée.
CREATE OR REPLACE VIEW public.poi_offers_served
WITH (security_invoker = true)
AS
SELECT
  o.id                                   AS offer_id,
  o.title,
  o.description,
  o.category,
  o.country,
  o.city,
  o.destination,
  o.price,
  o.currency,
  o.availability,
  o.price_checked_at,
  o.availability_checked_at,
  o.valid_from,
  o.valid_to,
  o.expires_at,
  (o.expires_at IS NOT NULL AND o.expires_at < now())            AS is_expired,
  (o.valid_to IS NOT NULL AND o.valid_to < now())                AS is_validity_expired,
  (o.price IS NOT NULL AND o.price_checked_at IS NOT NULL)       AS is_price_timestamped,
  (o.availability IS NOT NULL AND o.availability_checked_at IS NOT NULL) AS is_availability_timestamped,
  (l.id IS NOT NULL AND l.is_active)                             AS has_affiliate_link,
  l.id                                   AS affiliate_link_id,
  l.slug                                 AS affiliate_link_slug,
  l.target_url                           AS affiliate_target_url,
  p.slug                                 AS partner_slug,
  p.name                                 AS partner_name
FROM public.affiliate_offers o
LEFT JOIN public.affiliate_links l
  ON l.id = o.link_id
LEFT JOIN public.affiliate_programs pr
  ON pr.id = o.program_id
LEFT JOIN public.affiliate_partners p
  ON p.id = COALESCE(l.partner_id, pr.partner_id);

COMMENT ON VIEW public.poi_offers_served IS
  'Phase 4 — projection servie séparant l''offre commerciale de son lien '
  'affilié : `has_affiliate_link` = lien réel et actif (jamais déduit par '
  'défaut), horodatage prix/disponibilité exposé, prix NULL si inconnu.';

GRANT SELECT ON public.poi_offers_served TO anon, authenticated, service_role;

-- ── 4. Retrait automatique de service des offres expirées ────────────────────
-- Les offres expirées restent en base (historique/audit) mais ne sont plus
-- servies par la vue : `is_expired = true`. Aucune suppression de données.
COMMENT ON COLUMN public.affiliate_offers.availability IS
  'Phase 4 — disponibilité brute sourcée ; la vue poi_offers_served expose '
  'is_expired (valid_to/expires_at) sans modifier la donnée.';
