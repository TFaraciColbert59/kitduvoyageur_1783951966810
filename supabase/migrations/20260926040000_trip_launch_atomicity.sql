-- ============================================================================
-- Lancement atomique d'activite (preparer-sentier) — revendication verrouillee
-- ============================================================================
-- Probleme : la chaine "creer le voyage -> ecrire metadata.route_id" laissait
-- une fenetre ou un voyage existe SANS route_id. Un crash dans cette fenetre
-- produisait un orphelin invisible de findExistingTrip (filtre sur
-- metadata->>'route_id'), donc duplique a chaque nouvelle tentative.
--
-- Solution : une reservation explicite par couple (user_id, route_id) dans
-- public.trip_launches, et trois operations SECURITY DEFINER qui rendent la
-- revendication ET la compensation atomiques :
--   claim_trip_launch  : reserve le couple, ou signale l'activite deja gagnante
--   complete_trip_launch: attache route_id + marque 'ready' dans UNE transaction
--   fail_trip_launch   : supprime l'orphelin ET marque 'failed' dans la MEME
--                         transaction (plus de compensation best-effort en TS)
--
-- Le verrou consultatif pg_advisory_xact_lock serialise les revendications
-- concurrentes ; l'index unique uniq_trips_user_route reste l'arbitre final.
--
-- Grants : EXECUTE a authenticated + service_role uniquement. Chaque fonction
-- reverifie que l'appelant est soit service_role, soit le proprietaire
-- (auth.uid() = p_user_id). anon est explicitement prive d'EXECUTE.
-- ============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- Reservations de lancement
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.trip_launches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  route_id bigint NOT NULL,
  status text NOT NULL DEFAULT 'in_progress',
  trip_id uuid REFERENCES public.trips(id) ON DELETE SET NULL,
  failure_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT trip_launches_route_id_chk CHECK (route_id > 0),
  CONSTRAINT trip_launches_status_chk
    CHECK (status IN ('in_progress', 'ready', 'failed')),
  CONSTRAINT trip_launches_user_route_uniq UNIQUE (user_id, route_id)
);

CREATE INDEX IF NOT EXISTS trip_launches_status_idx
  ON public.trip_launches (status, updated_at DESC);

COMMENT ON TABLE public.trip_launches IS
  'Reservations de lancement d''activite : rend atomique la revendication du couple (user_id, route_id) et la compensation en cas d''echec.';

-- Filet anti-derive : les expeditions de securite lisent au moins une fois par
-- meme transaction pour eviter deRIALiser l'horodatage si la policy evolue.
CREATE OR REPLACE FUNCTION public.trip_launches_touch_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $function$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_trip_launches_updated_at ON public.trip_launches;
CREATE TRIGGER trg_trip_launches_updated_at
  BEFORE UPDATE ON public.trip_launches
  FOR EACH ROW EXECUTE FUNCTION public.trip_launches_touch_updated_at();

ALTER TABLE public.trip_launches ENABLE ROW LEVEL SECURITY;

-- Aucune policy : la table n'est atteignable que via les trois RPC ci-dessous
-- (ou en service_role). Un client authentifie ne lit rien directement.

-- ---------------------------------------------------------------------------
-- claim_trip_launch : reservation atomique du couple (user_id, route_id)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.claim_trip_launch(
  p_user_id uuid,
  p_route_id bigint
)
RETURNS TABLE (status text, trip_id uuid, slug text, title text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  v_existing public.trips%ROWTYPE;
  v_launch public.trip_launches%ROWTYPE;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role'
     AND (p_user_id IS NULL OR auth.uid() IS DISTINCT FROM p_user_id) THEN
    RAISE EXCEPTION 'trip_launch: forbidden' USING ERRCODE = '42501';
  END IF;
  IF p_user_id IS NULL OR p_route_id IS NULL OR p_route_id <= 0 THEN
    RAISE EXCEPTION 'trip_launch: invalid_argument' USING ERRCODE = '22023';
  END IF;

  -- Serialise les tentatives concurrentes sur le meme sentier.
  PERFORM pg_advisory_xact_lock(
    hashtextextended(p_user_id::text || ':' || p_route_id::text, 0)
  );

  SELECT t.* INTO v_existing
  FROM public.trips t
  WHERE t.user_id = p_user_id
    AND t.metadata ? 'route_id'
    AND t.metadata->>'route_id' <> ''
    AND t.metadata->>'route_id' = p_route_id::text
  ORDER BY t.created_at ASC, t.id ASC
  LIMIT 1;

  IF FOUND THEN
    INSERT INTO public.trip_launches (user_id, route_id, status, trip_id)
    VALUES (p_user_id, p_route_id, 'ready', v_existing.id)
    ON CONFLICT (user_id, route_id) DO UPDATE
      SET status = 'ready',
          trip_id = EXCLUDED.trip_id,
          failure_reason = NULL;
    RETURN QUERY SELECT 'ready'::text, v_existing.id, v_existing.slug, v_existing.title;
    RETURN;
  END IF;

  SELECT l.* INTO v_launch
  FROM public.trip_launches l
  WHERE l.user_id = p_user_id AND l.route_id = p_route_id
  FOR UPDATE;

  IF FOUND AND v_launch.status = 'in_progress' THEN
    RETURN QUERY SELECT 'in_progress'::text, v_launch.trip_id, NULL::text, NULL::text;
    RETURN;
  END IF;

  INSERT INTO public.trip_launches (user_id, route_id, status, trip_id, failure_reason)
  VALUES (p_user_id, p_route_id, 'in_progress', NULL, NULL)
  ON CONFLICT (user_id, route_id) DO UPDATE
    SET status = 'in_progress',
        trip_id = NULL,
        failure_reason = NULL;

  RETURN QUERY SELECT 'claimed'::text, NULL::uuid, NULL::text, NULL::text;
END;
$function$;

-- ---------------------------------------------------------------------------
-- complete_trip_launch : attache route_id et bascule 'ready' en une transaction
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.complete_trip_launch(
  p_user_id uuid,
  p_route_id bigint,
  p_trip_id uuid
)
RETURNS TABLE (status text, trip_id uuid, slug text, title text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  v_claim public.trip_launches%ROWTYPE;
  v_trip public.trips%ROWTYPE;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role'
     AND (p_user_id IS NULL OR auth.uid() IS DISTINCT FROM p_user_id) THEN
    RAISE EXCEPTION 'trip_launch: forbidden' USING ERRCODE = '42501';
  END IF;
  IF p_user_id IS NULL OR p_route_id IS NULL OR p_route_id <= 0
     OR p_trip_id IS NULL THEN
    RAISE EXCEPTION 'trip_launch: invalid_argument' USING ERRCODE = '22023';
  END IF;

  PERFORM pg_advisory_xact_lock(
    hashtextextended(p_user_id::text || ':' || p_route_id::text, 0)
  );

  SELECT l.* INTO v_claim
  FROM public.trip_launches l
  WHERE l.user_id = p_user_id AND l.route_id = p_route_id
  FOR UPDATE;

  IF NOT FOUND OR v_claim.status <> 'in_progress' THEN
    RAISE EXCEPTION 'trip_launch: not_claimed' USING ERRCODE = '55000';
  END IF;

  SELECT t.* INTO v_trip
  FROM public.trips t
  WHERE t.id = p_trip_id AND t.user_id = p_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'trip_launch: trip_not_found' USING ERRCODE = 'P0002';
  END IF;

  -- Si un voyage porte deja ce route_id, il est l'arbitre (index unique).
  -- Cas nominal : c'est ce voyage-ci (createTrip ecrit route_id des l'insert).
  IF v_trip.metadata ? 'route_id'
     AND v_trip.metadata->>'route_id' <> ''
     AND v_trip.metadata->>'route_id' = p_route_id::text THEN
    UPDATE public.trip_launches
    SET status = 'ready', trip_id = p_trip_id
    WHERE user_id = p_user_id AND route_id = p_route_id;
    RETURN QUERY SELECT 'ready'::text, v_trip.id, v_trip.slug, v_trip.title;
    RETURN;
  END IF;

  BEGIN
    UPDATE public.trips t
    SET metadata = COALESCE(t.metadata, '{}'::jsonb) || jsonb_build_object(
          'route_id', p_route_id::text,
          'source', 'prepare-trail',
          'enrichment_status', COALESCE(t.metadata->>'enrichment_status', 'pending')
        ),
        launch_state = 'ready'
    WHERE t.id = p_trip_id AND t.user_id = p_user_id;
  EXCEPTION WHEN unique_violation THEN
    -- Course perdue au dernier moment : un autre voyage porte le route_id.
    SELECT t.* INTO v_trip
    FROM public.trips t
    WHERE t.user_id = p_user_id
      AND t.metadata ? 'route_id'
      AND t.metadata->>'route_id' <> ''
      AND t.metadata->>'route_id' = p_route_id::text
    ORDER BY t.created_at ASC, t.id ASC
    LIMIT 1;

    IF FOUND THEN
      UPDATE public.trip_launches
      SET status = 'ready', trip_id = v_trip.id
      WHERE user_id = p_user_id AND route_id = p_route_id;
      RETURN QUERY SELECT 'lost'::text, v_trip.id, v_trip.slug, v_trip.title;
      RETURN;
    END IF;
    RAISE;
  END;

  UPDATE public.trip_launches
  SET status = 'ready', trip_id = p_trip_id
  WHERE user_id = p_user_id AND route_id = p_route_id;

  RETURN QUERY SELECT 'ready'::text, v_trip.id, v_trip.slug, v_trip.title;
END;
$function$;

-- ---------------------------------------------------------------------------
-- fail_trip_launch : compensation atomique (suppression + statut 'failed')
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fail_trip_launch(
  p_user_id uuid,
  p_route_id bigint,
  p_trip_id uuid,
  p_reason text
)
RETURNS TABLE (status text, trip_id uuid, slug text, title text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  v_launch public.trip_launches%ROWTYPE;
  v_deleted uuid;
  v_reason text;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role'
     AND (p_user_id IS NULL OR auth.uid() IS DISTINCT FROM p_user_id) THEN
    RAISE EXCEPTION 'trip_launch: forbidden' USING ERRCODE = '42501';
  END IF;
  IF p_user_id IS NULL OR p_route_id IS NULL OR p_route_id <= 0 THEN
    RAISE EXCEPTION 'trip_launch: invalid_argument' USING ERRCODE = '22023';
  END IF;

  PERFORM pg_advisory_xact_lock(
    hashtextextended(p_user_id::text || ':' || p_route_id::text, 0)
  );

  v_reason := left(COALESCE(p_reason, 'unspecified'), 200);

  SELECT l.* INTO v_launch
  FROM public.trip_launches l
  WHERE l.user_id = p_user_id AND l.route_id = p_route_id
  FOR UPDATE;

  -- Un 'ready' est definitif : on ne supprime jamais une activite deja gagnee.
  IF FOUND AND v_launch.status = 'ready' THEN
    RETURN QUERY SELECT 'ready'::text, v_launch.trip_id, NULL::text, NULL::text;
    RETURN;
  END IF;

  -- Un orphelin est par definition un voyage SANS route_id : c'est la seule
  -- suppression autorisee. Un voyage qui porte le route_id est un gagnant.
  IF p_trip_id IS NOT NULL THEN
    SELECT t.id INTO v_deleted
    FROM public.trips t
    WHERE t.id = p_trip_id
      AND t.user_id = p_user_id
      AND NOT (t.metadata ? 'route_id' AND t.metadata->>'route_id' <> '')
    FOR UPDATE;

    IF FOUND THEN
      DELETE FROM public.trips WHERE id = v_deleted;
    ELSE
      v_deleted := NULL;
    END IF;
  END IF;

  INSERT INTO public.trip_launches (user_id, route_id, status, trip_id, failure_reason)
  VALUES (p_user_id, p_route_id, 'failed', NULL, v_reason)
  ON CONFLICT (user_id, route_id) DO UPDATE
    SET status = 'failed',
        trip_id = NULL,
        failure_reason = EXCLUDED.failure_reason
  WHERE public.trip_launches.status = 'in_progress';

  RETURN QUERY SELECT 'failed'::text, v_deleted, NULL::text, NULL::text;
END;
$function$;

-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------
REVOKE ALL ON TABLE public.trip_launches FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.trip_launches TO service_role;

REVOKE ALL ON FUNCTION public.trip_launches_touch_updated_at() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.trip_launches_touch_updated_at() TO service_role;

REVOKE ALL ON FUNCTION public.claim_trip_launch(uuid, bigint) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.complete_trip_launch(uuid, bigint, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.fail_trip_launch(uuid, bigint, uuid, text) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.claim_trip_launch(uuid, bigint)
  TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.complete_trip_launch(uuid, bigint, uuid)
  TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.fail_trip_launch(uuid, bigint, uuid, text)
  TO authenticated, service_role;

COMMENT ON FUNCTION public.claim_trip_launch(uuid, bigint) IS
  'Reserve atomiquement le couple (user_id, route_id). SECURITY DEFINER, proprietaire ou service_role uniquement.';
COMMENT ON FUNCTION public.complete_trip_launch(uuid, bigint, uuid) IS
  'Attache route_id et bascule la reservation en ready dans une transaction unique.';
COMMENT ON FUNCTION public.fail_trip_launch(uuid, bigint, uuid, text) IS
  'Compense atomiquement : supprime l''orphelin sans route_id et marque la reservation failed.';

COMMIT;
