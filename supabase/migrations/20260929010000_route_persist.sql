-- ============================================================================
-- I4 — Le cache de routage SURVIT A UN REDEPLOIEMENT.
--
-- Constat (mesure, 29/09/2026) : `routingService.ts` garde les traces en
-- MEMOIRE uniquement (`new Map`, TTL 1 h, max 200). Il n'existait aucune table
-- de cache de route. Consequence : a chaque redeploiement de l'application
-- toutes les distances Measurees repartent de zero — lent, couteux en appels
-- publics, et un « Reessayer » sur une etape deja connue est un faux depart.
--
-- La table suit EXACTEMENT le precedent deja en base (`ai_response_cache` +
-- fonctions SECURITY DEFINER `get_ai_cache` / `set_ai_cache`), parce que ce
-- besoin est le meme : un cache partage entre instances, illisible par un
-- client, dont l'echec ne doit jamais casser l'appelant.
--
-- Trois garanties non negociables, verrouillees cote TS comme ici :
--
--  1. SEULE UNE TRACE REUSSIE est persistee. Un echec (`legs: null`) ne
--     doit JAMAIS etre servi depuis le cache : une panne de cinq minutes
--     finirait par etre republiée comme une MESURE pendant une heure entiere.
--     La colonne `payload` ne porte donc que des reponses mesurees, et le
--     contrat de lecture (`get_route_cache`) refuse une entree sans `legs`.
--  2. Le TTL reste respecte ET COTE BASE : l'expiration vit dans
--     `expires_at`, pas seulement dans le `Map`. Une entree trop agee est
--     traitee comme absente, donc re-mesuree.
--  3. Le `provider` est persiste AVEC la reponse. C'est la base de H5 (le
--     credit de la source de la donnee) : le perdre au redemarrage serait une
--     regression de tracabilite, exactement ce que le `Map` faisait deja.
--
-- Le debranchement est degrade, jamais fatal : si la base est injoignable,
-- le service retombe sur son cache memoire (comportement actuel). Voir
-- `routing-service.test.ts`.
--
-- Idempotent : CREATE IF NOT EXISTS / OR REPLACE / DROP POLICY IF EXISTS,
-- comme les migrations precedentes du depot.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Table : une entree par (parametres de route) distincts.
-- La cle `cache_key` est le HASH des parametres — mode, points, profil.
-- Elle est donc bornee en largeur par construction : pas de geometrie (la
-- plus volumineuse) dans la cle, seulement dans la valeur.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.route_cache (
  cache_key   text PRIMARY KEY,
  route_mode  text NOT NULL,
  provider    text,
  payload     jsonb NOT NULL,
  hit_count   integer NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now(),
  expires_at  timestamptz NOT NULL,
  CONSTRAINT route_cache_mode_format_chk
    CHECK (route_mode ~ '^[a-z_]+$'),
  CONSTRAINT route_cache_payload_object_chk
    CHECK (jsonb_typeof(payload) = 'object')
);

-- La purge de retention balaie par fenetre d'expiration.
CREATE INDEX IF NOT EXISTS route_cache_expires_at_idx
  ON public.route_cache (expires_at);

-- ---------------------------------------------------------------------------
-- Acces : service_role UNIQUEMENT, comme `ai_response_cache`.
-- RLS active et policy SELECT false : aucun client (anon/authenticated) ne
-- peut lire le cache, meme en lecture directe. Seules les fonctions
-- SECURITY DEFINER ci-dessous y accedent.
-- ---------------------------------------------------------------------------
ALTER TABLE public.route_cache ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "route_cache_select_false" ON public.route_cache;
CREATE POLICY "route_cache_select_false" ON public.route_cache
  FOR SELECT USING (false);

-- ---------------------------------------------------------------------------
-- Lecture. Une entree EXPIREE est traitee comme ABSENTE : elle n'est pas
-- retournee, et elle est supprimee au passage. Le service re-mesurera donc,
-- ce qui respecte le TTL sans que le TS ait a le recalculer.
--
-- Renvoie l'objet stocke tel quel (avec `provider`). La colonne `hit_count`
-- est incrementee hors du SELECT principal pour ne pas transformer la lecture
-- en ecriture bloquante sur la ligne la plus lue.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_route_cache(p_cache_key text, p_now timestamptz DEFAULT now())
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_payload jsonb;
  v_expires timestamptz;
BEGIN
  SELECT payload, expires_at INTO v_payload, v_expires
  FROM public.route_cache
  WHERE cache_key = p_cache_key;

  IF v_payload IS NULL THEN
    RETURN NULL;
  END IF;

  IF v_expires <= p_now THEN
    DELETE FROM public.route_cache WHERE cache_key = p_cache_key;
    RETURN NULL;
  END IF;

  UPDATE public.route_cache
  SET hit_count = hit_count + 1
  WHERE cache_key = p_cache_key;

  RETURN v_payload;
END;
$$;

-- ---------------------------------------------------------------------------
-- Ecriture. `ON CONFLICT DO UPDATE` : la meme demande remesuree remplace
-- l'entree, et le `expires_at` repart du maintenant de l'ecriture — jamais
-- d'une valeur recyclee. Le TTL minimal (60 s) est le meme plancher que
-- `set_ai_cache`, pour qu une TTL nul ou negatif ne rende pas une entree
-- immediatement inexploitable.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.set_route_cache(
  p_cache_key text,
  p_route_mode text,
  p_payload jsonb,
  p_provider text,
  p_ttl_seconds integer
)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  INSERT INTO public.route_cache
    (cache_key, route_mode, provider, payload, hit_count, created_at, expires_at)
  VALUES (
    p_cache_key, p_route_mode, p_provider, p_payload, 0, now(),
    now() + make_interval(secs => greatest(p_ttl_seconds, 60))
  )
  ON CONFLICT (cache_key) DO UPDATE SET
    route_mode = excluded.route_mode,
    provider   = excluded.provider,
    payload    = excluded.payload,
    created_at = now(),
    expires_at = now() + make_interval(secs => greatest(p_ttl_seconds, 60));
$$;

-- ---------------------------------------------------------------------------
-- Purge des entrees expirees (a appeler par un job planifie ou au demarrage).
-- Borne sur le lot pour ne jamais bloquer les ecritures.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.purge_route_cache(p_limit integer DEFAULT 5000)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_deleted integer := 0;
BEGIN
  DELETE FROM public.route_cache
  WHERE cache_key IN (
    SELECT cache_key FROM public.route_cache
    WHERE expires_at <= now()
    ORDER BY expires_at
    LIMIT greatest(p_limit, 1)
  );
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted;
END;
$$;

-- ---------------------------------------------------------------------------
-- Durcissement des privileges.
-- ---------------------------------------------------------------------------
REVOKE ALL ON TABLE public.route_cache FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.route_cache TO service_role;

-- Supabase accorde EXECUTE sur toute fonction creee a non et
-- uthenticated via ses privileges par defaut. Un simple REVOKE ... FROM
-- PUBLIC ne suffit donc pas : le grant explicite sur ces deux roles
-- subsiste, et un client pourrait alors appeler set_route_cache en direct
-- pour y ecrire une trace INVENTEE -- ce que la garantie 1 interdit
-- explicitement. Il faut donc retirer le privilege role par role.
REVOKE ALL ON FUNCTION public.get_route_cache(text, timestamptz) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.set_route_cache(text, text, jsonb, text, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.purge_route_cache(integer) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.get_route_cache(text, timestamptz) TO service_role;
GRANT EXECUTE ON FUNCTION public.set_route_cache(text, text, jsonb, text, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.purge_route_cache(integer) TO service_role;

COMMENT ON TABLE public.route_cache IS
  'I4 — cache de traces de routage partage entre instances (survit au redeploiement). '
  'Service role uniquement ; lecture directe bloquee par policy SELECT false.';

COMMENT ON FUNCTION public.get_route_cache(text, timestamptz) IS
  'I4 — lecture d une trace encore valide ; une entree expiree est purgee et '
  'renvoyee comme absente. Renvoie le payload brut (legs + provider).';

COMMENT ON FUNCTION public.set_route_cache(text, text, jsonb, text, integer) IS
  'I4 — ecriture d une trace MESUREE, avec son provider. TTL plancher 60 s.';
