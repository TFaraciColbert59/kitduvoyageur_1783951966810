-- ============================================================================
-- T18 — Découvertes géographiques canoniques (passeport/carte).
--
-- Une découverte relie un compte à une entité géographique canonique
-- (country | region | massif) avec une PROVENANCE stricte :
--   • verified : dérivée d'une réalisation contrôlée (session traitée) ;
--   • declared : saisie personnelle ;
--   • virtual  : défi ou expédition virtuelle.
-- Les trois ne sont pas interchangeables : une déclaration ou une expédition
-- virtuelle ne devient JAMAIS une visite réelle sans preuve contrôlée
-- (seul l'événement vérifié peut remonter la provenance).
--
-- AUCUN XP : enrichir le passeport ou la carte n'émet aucun gain.
-- Aucune géométrie de monde n'est stockée : identifiants seulement.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.progression_discoveries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  entity_type text NOT NULL CHECK (entity_type IN ('country', 'region', 'massif')),
  entity_code text NOT NULL CHECK (length(entity_code) BETWEEN 2 AND 64),
  provenance text NOT NULL CHECK (provenance IN ('verified', 'declared', 'virtual')),
  source_type text,
  source_id text,
  first_seen_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, entity_type, entity_code)
);

CREATE INDEX IF NOT EXISTS progression_discoveries_user_idx
  ON public.progression_discoveries (user_id, entity_type);

ALTER TABLE public.progression_discoveries ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.progression_discoveries FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.progression_discoveries TO service_role;

-- Insertion vérifiée : seule une réalisation contrôlée peut poser/remonter
-- la provenance vers 'verified' ; une entrée existante non vérifiée est
-- remontée, une entrée vérifiée reste acquise (first_seen_at conservée).
CREATE OR REPLACE FUNCTION public.record_verified_discovery(
  p_user_id uuid,
  p_entity_type text,
  p_entity_code text,
  p_source_type text,
  p_source_id text
) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE v_inserted integer;
BEGIN
  IF p_entity_type NOT IN ('country', 'region', 'massif') THEN
    RAISE EXCEPTION 'type de découverte invalide';
  END IF;
  IF p_entity_code IS NULL OR length(trim(p_entity_code)) < 2 THEN
    RAISE EXCEPTION 'code de découverte invalide';
  END IF;

  INSERT INTO public.progression_discoveries
    (user_id, entity_type, entity_code, provenance, source_type, source_id)
  VALUES
    (p_user_id, p_entity_type, lower(trim(p_entity_code)), 'verified', p_source_type, p_source_id)
  ON CONFLICT (user_id, entity_type, entity_code) DO UPDATE
    SET provenance = 'verified',
        source_type = EXCLUDED.source_type,
        source_id = EXCLUDED.source_id,
        updated_at = now()
    WHERE public.progression_discoveries.provenance <> 'verified';
  GET DIAGNOSTICS v_inserted = ROW_COUNT;
  RETURN v_inserted > 0;
END $$;
REVOKE ALL ON FUNCTION public.record_verified_discovery(uuid, text, text, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_verified_discovery(uuid, text, text, text, text) TO service_role;
