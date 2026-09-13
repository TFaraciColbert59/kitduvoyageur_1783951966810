-- ==============================================================================
-- Migration : 20260912300000_trip_member_profiles.sql
-- Profils membres par activite (personnalisation d'itineraire) + party_size.
-- ADDITIF UNIQUEMENT : aucune colonne/table existante modifiee sauf l'ajout de
-- trips.party_size (nullable). Un profil membre = (trip_id, user_id), donnees
-- declaratives + derivees (vitesses, portage, experience, limitations).
-- RLS : lecture de sa ligne OU du voyage (can_read_trip, SECURITY DEFINER) ;
-- ecriture strictement sur sa propre ligne.
-- ==============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.trip_member_profiles (
  trip_id uuid NOT NULL REFERENCES public.trips(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  consented_at timestamptz,
  flat_speed_kmh numeric,
  ascent_speed_m_per_h numeric,
  descent_speed_m_per_h numeric,
  pack_weight_kg numeric,
  max_carry_kg numeric,
  experience_level text,
  limitations text,
  is_child boolean NOT NULL DEFAULT false,
  sources jsonb NOT NULL DEFAULT '{}'::jsonb,
  calibration_level text,
  sample_count integer,
  party_version integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (trip_id, user_id)
);

ALTER TABLE public.trip_member_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tmprof_select ON public.trip_member_profiles;
CREATE POLICY tmprof_select ON public.trip_member_profiles
  FOR SELECT USING (user_id = auth.uid() OR public.can_read_trip(trip_id));

DROP POLICY IF EXISTS tmprof_insert ON public.trip_member_profiles;
CREATE POLICY tmprof_insert ON public.trip_member_profiles
  FOR INSERT WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS tmprof_update ON public.trip_member_profiles;
CREATE POLICY tmprof_update ON public.trip_member_profiles
  FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

GRANT SELECT, INSERT, UPDATE ON public.trip_member_profiles TO authenticated;

ALTER TABLE public.trips ADD COLUMN IF NOT EXISTS party_size integer;

COMMIT;
