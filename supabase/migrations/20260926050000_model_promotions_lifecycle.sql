-- ============================================================================
-- model_promotions : cycle de vie evaluate -> promote (statut explicite)
-- ============================================================================
-- La table introduite par 20260926020000 est un journal append-only ou chaque
-- INSERT signifiait deja "promu" : pas de statut, pas de gate de validation,
-- pas de promoteur identifie. Un promote etait donc impossible a exprimer.
--
-- Ajouts (additif, aucune colonne supprimee) :
--   * status text NOT NULL DEFAULT 'pending'
--       CHECK (status IN ('pending','promoted'))
--   * promoted_by uuid NULL REFERENCES auth.users(id) ON DELETE SET NULL
--   * UNIQUE partiel : au plus UNE promotion 'promoted' a la fois
--       (invariant "un seul modele actif", impossible a contourner en SQL direct)
--   * evaluate_model_promotion(...) : valide la coherence score/evidence et
--       ecrit la ligne en 'pending' (idempotent sur model_version)
--   * promote_model_version(...) : bascule 'pending' -> 'promoted' en une
--       transaction, sous advisory lock, avec previous_version calculee
--
-- Grants : les deux RPC sont authentifiees + service_role. Elles exigent
-- public.is_admin() (cote SQL, verifie dans la fonction) OU service_role, donc
-- un client authentifie non-admin ne promeut rien, meme en contournant la
-- route HTTP. anon est explicitement prive d'EXECUTE.
-- ============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- Statut explicite + promoteur
-- ---------------------------------------------------------------------------
ALTER TABLE public.model_promotions
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'pending';
ALTER TABLE public.model_promotions
  ADD COLUMN IF NOT EXISTS promoted_by uuid REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.model_promotions
  DROP CONSTRAINT IF EXISTS model_promotions_status_chk;
ALTER TABLE public.model_promotions
  ADD CONSTRAINT model_promotions_status_chk
    CHECK (status IN ('pending', 'promoted'));

-- Les lignes existantes (creees avant ce cycle de vie) sont des promotions
-- historiques : on les retro-grad ees en 'pending' est faux, on les marque
-- 'promoted' si elles etaient destinees a l'etre. Par prudence on ne touche
-- pas aux lignes deja la : on initialise seulement le defaut pour l'avenir et
-- on laisse le status a 'pending' sauf si promoted_at est renseigne ET il
-- n'existe aucune autre ligne. Les lignes d'origine (avant migration) avaient
-- promoted_at NOT NULL DEFAULT now() -> on les considere 'promoted' si et
-- seulement si c'est la seule ligne ; sinon la plus recente gagne. Ce seed est
-- fait pour rester neutre quand la table est vide ou a une seule ligne.
--
-- En pratique la migration est appliquee sur une table vide ou avec une seule
-- ligne de test : on promeut implicitement l'unique ligne existante, sinon on
-- laisse tout en 'pending' (aucune promotion implicite).
DO $seed$
DECLARE
  v_total integer;
BEGIN
  SELECT count(*) INTO v_total FROM public.model_promotions;

  IF v_total = 0 THEN
    RETURN;
  END IF;

  -- Une seule ligne historique : elle represente la promotion en cours.
  IF v_total = 1 THEN
    UPDATE public.model_promotions
    SET status = 'promoted', promoted_at = COALESCE(promoted_at, now())
    WHERE status = 'pending';
    RETURN;
  END IF;

  -- Plusieurs lignes : la plus recente (tie-break id) est 'promoted', les
  -- autres restent 'pending'. Le tri est deterministe.
  WITH ranked AS (
    SELECT id,
           row_number() OVER (ORDER BY promoted_at DESC, created_at DESC, id DESC) AS rn
    FROM public.model_promotions
  )
  UPDATE public.model_promotions mp
  SET status = CASE WHEN ranked.rn = 1 THEN 'promoted' ELSE 'pending' END,
      promoted_at = CASE WHEN ranked.rn = 1 THEN COALESCE(mp.promoted_at, now()) ELSE mp.promoted_at END
  FROM ranked
  WHERE mp.id = ranked.id;
END;
$seed$;

-- invariant : au plus une promotion 'promoted'
CREATE UNIQUE INDEX IF NOT EXISTS model_promotions_single_promoted
  ON public.model_promotions ((status))
  WHERE status = 'promoted';

-- ---------------------------------------------------------------------------
-- evaluate_model_promotion : validation + ecriture 'pending' (idempotent)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.evaluate_model_promotion(
  p_model_version text,
  p_score numeric,
  p_evidence jsonb,
  p_promote boolean DEFAULT false
)
RETURNS TABLE (status text, model_version text, score numeric, promoted boolean)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  v_is_service boolean := (auth.role() = 'service_role');
  v_id uuid;
  v_score numeric;
  v_status text;
  v_promoted boolean := false;
  v_previous text;
BEGIN
  IF NOT v_is_service AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'model_promotions: admin_required' USING ERRCODE = '42501';
  END IF;

  IF p_model_version IS NULL OR p_model_version !~ '^[A-Za-z0-9][A-Za-z0-9._-]{1,119}$' THEN
    RAISE EXCEPTION 'model_promotions: invalid_model_version' USING ERRCODE = '22023';
  END IF;
  IF p_score IS NULL OR p_score < 0 OR p_score > 1 THEN
    RAISE EXCEPTION 'model_promotions: invalid_score' USING ERRCODE = '22023';
  END IF;
  IF p_evidence IS NULL OR jsonb_typeof(p_evidence) <> 'object' THEN
    RAISE EXCEPTION 'model_promotions: invalid_evidence' USING ERRCODE = '22023';
  END IF;

  -- Upsert 'pending' (idempotent sur model_version). Ne promeut rien.
  INSERT INTO public.model_promotions (model_version, score, evidence, status)
  VALUES (p_model_version, p_score, p_evidence, 'pending')
  ON CONFLICT (model_version) DO UPDATE
    SET score = EXCLUDED.score,
        evidence = EXCLUDED.evidence
    -- Ne jamais re-evalue une promotion deja promotee : on la laisse intacte.
    WHERE public.model_promotions.status = 'pending'
  RETURNING id, score, status INTO v_id, v_score, v_status;

  IF v_id IS NULL THEN
    -- model_version deja 'promoted' : on relit l'etat existant.
    SELECT mp.id, mp.score, mp.status
    INTO v_id, v_score, v_status
    FROM public.model_promotions mp
    WHERE mp.model_version = p_model_version;
  END IF;

  -- Promotion explicite demandee par l'appelant, meme transaction. On demote
  -- d'abord l'eventuelle promotion precedente : l'index unique partiel
  -- n'autorise qu'un seul 'promoted', l'ordre demote puis promeut garantit
  -- qu'aucun etat intermediaire ne viole la contrainte.
  IF p_promote AND v_status = 'pending' THEN
    PERFORM pg_advisory_xact_lock(hashtextextended('model_promotions.promote', 0));

    SELECT mp.model_version INTO v_previous
    FROM public.model_promotions mp
    WHERE mp.status = 'promoted';

    UPDATE public.model_promotions
    SET status = 'pending', promoted_by = NULL
    WHERE status = 'promoted';

    UPDATE public.model_promotions mp
    SET status = 'promoted',
        promoted_at = now(),
        promoted_by = auth.uid(),
        previous_version = v_previous
    WHERE mp.id = v_id
    RETURNING mp.status, mp.model_version, mp.score INTO v_status, p_model_version, v_score;

    v_promoted := true;
  END IF;

  RETURN QUERY SELECT v_status, p_model_version, v_score, v_promoted;
END;
$function$;

-- ---------------------------------------------------------------------------
-- promote_model_version : bascule pending -> promoted, transaction + verrou
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.promote_model_version(
  p_model_version text
)
RETURNS TABLE (status text, model_version text, score numeric, promoted boolean)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  v_is_service boolean := (auth.role() = 'service_role');
  v_score numeric;
  v_status text;
  v_previous text;
BEGIN
  IF NOT v_is_service AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'model_promotions: admin_required' USING ERRCODE = '42501';
  END IF;

  IF p_model_version IS NULL OR p_model_version !~ '^[A-Za-z0-9][A-Za-z0-9._-]{1,119}$' THEN
    RAISE EXCEPTION 'model_promotions: invalid_model_version' USING ERRCODE = '22023';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended('model_promotions.promote', 0));

  SELECT mp.score INTO v_score
  FROM public.model_promotions mp
  WHERE mp.model_version = p_model_version
    AND mp.status = 'pending'
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'model_promotions: not_pending' USING ERRCODE = '55000';
  END IF;

  -- Demote l'eventuelle promotion precedente, puis promeut la nouvelle.
  -- L'index unique partiel garantit qu'un seul 'promoted' subsiste meme si
  -- ce bloc est rejoue ; l'advisory lock serialise les ecritures concurrentes.
  SELECT mp.model_version INTO v_previous
  FROM public.model_promotions mp
  WHERE mp.status = 'promoted';

  UPDATE public.model_promotions
  SET status = 'pending', promoted_by = NULL
  WHERE status = 'promoted';

  UPDATE public.model_promotions mp
  SET status = 'promoted',
      promoted_at = now(),
      promoted_by = auth.uid(),
      previous_version = v_previous
  WHERE mp.model_version = p_model_version
  RETURNING mp.status, mp.model_version, mp.score INTO v_status, p_model_version, v_score;

  RETURN QUERY SELECT v_status, p_model_version, v_score, true;
END;
$function$;

-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------
REVOKE ALL ON FUNCTION public.evaluate_model_promotion(text, numeric, jsonb, boolean) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.promote_model_version(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.evaluate_model_promotion(text, numeric, jsonb, boolean)
  TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.promote_model_version(text)
  TO authenticated, service_role;

COMMENT ON COLUMN public.model_promotions.status IS
  'pending = evalue non promu ; promoted = version active (une seule a la fois).';
COMMENT ON COLUMN public.model_promotions.promoted_by IS
  'Utilisateur (ou NULL en service_role) ayant declenche la promotion.';
COMMENT ON FUNCTION public.evaluate_model_promotion(text, numeric, jsonb, boolean) IS
  'Valide score/evidence, ecrit la promotion en pending (idempotent), promeut optionnellement.';
COMMENT ON FUNCTION public.promote_model_version(text) IS
  'Bascule une promotion pending vers promoted sous advisory lock, demote l'' precedente.';

COMMIT;
