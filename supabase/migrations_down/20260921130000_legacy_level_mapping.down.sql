-- Rollback 20260921130000 — retire la correspondance des niveaux hérités.
-- Les cumuls déjà appliqués restent (aucune baisse rétroactive).
DROP FUNCTION IF EXISTS public.apply_legacy_level_mapping(uuid, text);
DROP TABLE IF EXISTS public.progression_legacy_mapping;
