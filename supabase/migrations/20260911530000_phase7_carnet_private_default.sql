-- ==============================================================================
-- Phase 7 — Carnet privé par défaut + publication en snapshot figé
--
-- Chantier LANCEMENT_MONDIAL §Phase 7 :
--   • La visibilité initiale d'un carnet passe de `public` à `private` ;
--     publier dans la communauté devient un geste explicite (opt-in).
--   • Une publication liée à un carnet (community_posts.linked_carnet_id) est un
--     instantané figé : le trigger copie le carnet dans `snapshot_payload` à
--     l'insertion et ne le rafraîchit JAMAIS. Modifier le carnet privé après
--     publication n'expose donc aucune donnée nouvelle.
--
-- Migration additive et idempotente : aucun UPDATE de données existantes, le
-- seul ALTER de colonne est un SET DEFAULT (sans réécriture).
-- ==============================================================================

-- ── 1. Visibilité privée par défaut ──────────────────────────────────────────
ALTER TABLE public.carnets
  ALTER COLUMN visibility SET DEFAULT 'private';

COMMENT ON COLUMN public.carnets.visibility IS
  'Phase 7 — private par défaut : la publication communautaire est un geste '
  'explicite, jamais un effet de bord de la création.';

-- ── 2. Chaîne session → voyage (Phase 7, lien carnet/trip) ───────────────────
ALTER TABLE public.hike_sessions
  ADD COLUMN IF NOT EXISTS trip_id uuid;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint c
    JOIN pg_attribute a
      ON a.attrelid = c.conrelid AND a.attnum = ANY (c.conkey)
    WHERE c.conrelid = 'public.hike_sessions'::regclass
      AND c.contype = 'f'
      AND c.confrelid = 'public.trips'::regclass
      AND a.attname = 'trip_id'
  ) THEN
    ALTER TABLE public.hike_sessions
      ADD CONSTRAINT hike_sessions_trip_id_fkey
      FOREIGN KEY (trip_id)
      REFERENCES public.trips(id)
      ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_hike_sessions_trip
  ON public.hike_sessions(trip_id)
  WHERE trip_id IS NOT NULL;

COMMENT ON COLUMN public.hike_sessions.trip_id IS
  'Phase 7 — voyage réellement associé à la session quand le contexte le '
  'fournit ; permet de renseigner carnets.trip_id sans carnet orphelin.';

-- ── 3. Snapshot de publication ───────────────────────────────────────────────
ALTER TABLE public.community_posts
  ADD COLUMN IF NOT EXISTS snapshot_payload jsonb,
  ADD COLUMN IF NOT EXISTS snapshot_at timestamptz,
  ADD COLUMN IF NOT EXISTS snapshot_exclude_location boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.community_posts.snapshot_payload IS
  'Phase 7 — copie figée du carnet au moment de la publication (contenu réel '
  'au moment du geste). Jamais rafraîchie quand le carnet source change.';
COMMENT ON COLUMN public.community_posts.snapshot_at IS
  'Phase 7 — horodatage de la copie figée ; estampille de la version publiée.';
COMMENT ON COLUMN public.community_posts.snapshot_exclude_location IS
  'Phase 7 — true = les points de carte du carnet sont exclus du snapshot '
  '(retrait des coordonnées avant publication).';

COMMENT ON COLUMN public.community_posts.linked_carnet_id IS
  'Phase 2/7 — carnet source de la publication (FK additive, NULL toléré). '
  'Le contenu publié vit dans snapshot_payload, pas dans une lecture live.';

CREATE OR REPLACE FUNCTION public.snapshot_community_post_carnet()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $fn$
DECLARE
  v_carnet  public.carnets%ROWTYPE;
  v_payload jsonb;
BEGIN
  -- UPDATE : le snapshot est immuable. Aucune modification du post (likes,
  -- contenu) ni du carnet ne peut le rafraîchir ou le réécrire.
  IF TG_OP = 'UPDATE' THEN
    NEW.snapshot_payload := OLD.snapshot_payload;
    NEW.snapshot_at := OLD.snapshot_at;
    RETURN NEW;
  END IF;

  -- Publication sans carnet : aucun snapshot toléré (pas de contenu forgé).
  IF NEW.linked_carnet_id IS NULL THEN
    NEW.snapshot_payload := NULL;
    NEW.snapshot_at := NULL;
    RETURN NEW;
  END IF;

  -- La lecture respecte la RLS `carnets` : un utilisateur ne peut publier un
  -- carnet que s'il en est l'auteur ou si le carnet est public. Sinon la ligne
  -- est invisible ici et l'insertion est refusée (pas de fuite d'existence).
  SELECT * INTO v_carnet
  FROM public.carnets
  WHERE id = NEW.linked_carnet_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION
      'phase7: carnet % introuvable ou non publiable par cet utilisateur',
      NEW.linked_carnet_id
      USING ERRCODE = 'foreign_key_violation';
  END IF;

  -- Copie générique (to_jsonb) : robuste au drift de colonnes, jamais de
  -- lecture live après publication. Les compteurs et l'auteur ne sont pas
  -- recopiés ; map_points est retiré si l'auteur a demandé le retrait.
  v_payload := to_jsonb(v_carnet)
    - 'author_id' - 'correlation_id' - 'likes_count' - 'comments_count'
    - 'favorites_count' - 'views_count' - 'verified' - 'visibility';

  IF COALESCE(NEW.snapshot_exclude_location, false) THEN
    v_payload := v_payload - 'map_points';
  END IF;

  NEW.snapshot_payload := jsonb_strip_nulls(v_payload);
  NEW.snapshot_at := now();
  RETURN NEW;
END;
$fn$;

COMMENT ON FUNCTION public.snapshot_community_post_carnet() IS
  'Phase 7 — gate de publication : copie figée du carnet dans '
  'community_posts.snapshot_payload à l''insertion. Le snapshot est immuable '
  '(préservé sur UPDATE) : modifier le carnet après publication ne change pas '
  'le contenu publié. Refuse les carnets inaccessibles (RLS).';

DROP TRIGGER IF EXISTS trg_snapshot_community_post_carnet ON public.community_posts;
CREATE TRIGGER trg_snapshot_community_post_carnet
  BEFORE INSERT OR UPDATE ON public.community_posts
  FOR EACH ROW EXECUTE FUNCTION public.snapshot_community_post_carnet();
