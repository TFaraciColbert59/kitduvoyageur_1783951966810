-- Carnet par jours : tracé de chaque journée, dessiné au doigt puis accroché aux chemins.
--
-- Une ligne par (carnet, jour). `coords` est le tracé final `[[lon, lat], ...]`
-- (GeoJSON), `waypoints` les points d'appui envoyés au routeur (gardés pour
-- re-router quand on refixe un départ ou une arrivée par adresse), `snapped`
-- dit si le routeur a réellement accroché le dessin aux chemins.
--
-- Sécurité : RLS activée. Lecture comme `carnet_moments` (carnet public ou
-- auteur du carnet) ; écriture réservée à l'auteur du carnet. Aucune donnée
-- d'identité : seulement des coordonnées que l'auteur choisit de publier avec
-- un carnet public. `anon` n'a aucun droit d'écriture.
CREATE TABLE IF NOT EXISTS public.carnet_day_traces (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  carnet_id   uuid NOT NULL REFERENCES public.carnets(id) ON DELETE CASCADE,
  jour_numero integer NOT NULL,
  coords      jsonb NOT NULL DEFAULT '[]'::jsonb,
  waypoints   jsonb NOT NULL DEFAULT '[]'::jsonb,
  snapped     boolean NOT NULL DEFAULT false,
  distance_km numeric(8, 2) NOT NULL DEFAULT 0,
  end_label   text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT carnet_day_traces_jour_check CHECK (jour_numero BETWEEN 1 AND 30),
  CONSTRAINT carnet_day_traces_distance_check CHECK (distance_km >= 0),
  CONSTRAINT carnet_day_traces_coords_array CHECK (jsonb_typeof(coords) = 'array' AND jsonb_array_length(coords) <= 5000),
  CONSTRAINT carnet_day_traces_waypoints_array CHECK (jsonb_typeof(waypoints) = 'array' AND jsonb_array_length(waypoints) <= 12),
  CONSTRAINT carnet_day_traces_end_label_len CHECK (end_label IS NULL OR char_length(end_label) <= 200),
  CONSTRAINT carnet_day_traces_unique_day UNIQUE (carnet_id, jour_numero)
);

CREATE INDEX IF NOT EXISTS idx_carnet_day_traces_carnet ON public.carnet_day_traces (carnet_id);

ALTER TABLE public.carnet_day_traces ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS carnet_day_traces_read_scoped ON public.carnet_day_traces;
CREATE POLICY carnet_day_traces_read_scoped ON public.carnet_day_traces
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.carnets c
      WHERE c.id = carnet_day_traces.carnet_id
        AND (c.visibility = 'public' OR c.author_id = (SELECT auth.uid()))
    )
  );

DROP POLICY IF EXISTS carnet_day_traces_author_write ON public.carnet_day_traces;
CREATE POLICY carnet_day_traces_author_write ON public.carnet_day_traces
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.carnets c
      WHERE c.id = carnet_day_traces.carnet_id AND c.author_id = (SELECT auth.uid())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.carnets c
      WHERE c.id = carnet_day_traces.carnet_id AND c.author_id = (SELECT auth.uid())
    )
  );

REVOKE ALL ON public.carnet_day_traces FROM anon;
GRANT SELECT ON public.carnet_day_traces TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.carnet_day_traces TO authenticated;
GRANT ALL ON public.carnet_day_traces TO service_role;

COMMENT ON TABLE public.carnet_day_traces IS
  'Tracé de chaque journée d''un carnet (GeoJSON [lon,lat]), accroché aux chemins par le routeur quand `snapped`.';
