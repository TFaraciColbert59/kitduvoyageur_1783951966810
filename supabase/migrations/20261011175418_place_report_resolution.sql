-- ============================================================================
-- T24 — Résolution des signalements de lieux (corrections utiles).
--
-- Un rapport en attente ne rapporte RIEN ; l'acceptation exige un validateur
-- INDÉPENDANT (≠ auteur) et un delta précis. La correction et la variante
-- accessibilité du MÊME rapport partagent le claim `place_report` — jamais
-- deux récompenses pour le même problème.
-- Colonnes additives uniquement : aucune donnée existante n'est modifiée.
-- ============================================================================

ALTER TABLE public.place_reports
  ADD COLUMN IF NOT EXISTS resolved_by uuid,
  ADD COLUMN IF NOT EXISTS resolution text,
  ADD COLUMN IF NOT EXISTS resolution_reason text,
  ADD COLUMN IF NOT EXISTS resolved_at timestamptz;

ALTER TABLE public.place_reports DROP CONSTRAINT IF EXISTS place_reports_resolution_check;
ALTER TABLE public.place_reports ADD CONSTRAINT place_reports_resolution_check
  CHECK (resolution IS NULL OR resolution IN ('accepted', 'rejected'));

-- Cohérence : une résolution implique un validateur et une date ; un refus
-- exige une raison visible (recours).
ALTER TABLE public.place_reports DROP CONSTRAINT IF EXISTS place_reports_resolution_coherence;
ALTER TABLE public.place_reports ADD CONSTRAINT place_reports_resolution_coherence
  CHECK (
    resolution IS NULL
    OR (resolved_by IS NOT NULL AND resolved_at IS NOT NULL
        AND (resolution <> 'rejected' OR (resolution_reason IS NOT NULL AND length(trim(resolution_reason)) > 0)))
  );

-- Résolution scopée : validateur distinct de l'auteur, rapport en attente.
CREATE OR REPLACE FUNCTION public.resolve_place_report(
  p_report_id uuid,
  p_resolved_by uuid,
  p_resolution text,
  p_reason text DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE v_report RECORD;
BEGIN
  IF p_resolution NOT IN ('accepted', 'rejected') THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'resolution_invalide');
  END IF;
  IF p_resolution = 'rejected' AND (p_reason IS NULL OR length(trim(p_reason)) = 0) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'raison_requise');
  END IF;

  SELECT id, reporter_id, status, resolution INTO v_report
  FROM public.place_reports WHERE id = p_report_id FOR UPDATE;
  IF v_report.id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'rapport_introuvable');
  END IF;
  IF v_report.resolution IS NOT NULL OR v_report.status <> 'pending' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'deja_resolu');
  END IF;
  IF v_report.reporter_id = p_resolved_by THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'independant_requis');
  END IF;

  UPDATE public.place_reports
  SET status = CASE WHEN p_resolution = 'accepted' THEN 'accepted' ELSE 'rejected' END,
      resolution = p_resolution,
      resolution_reason = NULLIF(trim(COALESCE(p_reason, '')), ''),
      resolved_by = p_resolved_by,
      resolved_at = now()
  WHERE id = p_report_id;

  RETURN jsonb_build_object('ok', true, 'resolution', p_resolution);
END $$;
REVOKE ALL ON FUNCTION public.resolve_place_report(uuid, uuid, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.resolve_place_report(uuid, uuid, text, text) TO service_role;
