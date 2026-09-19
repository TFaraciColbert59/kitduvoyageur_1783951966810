-- ============================================================================
-- P2 — Barème v1 des producteurs vérifiés (idempotent).
-- Complète la version v1 si elle a été seedée sans actions (bases existantes).
-- ============================================================================

UPDATE public.progression_rules
SET payload = jsonb_set(payload, '{actions}', jsonb_build_object(
  'hike_session_processed', jsonb_build_object(
    'points', 40, 'max_points', 150, 'bonus_per_segment', 5,
    'weights', jsonb_build_object('explorer',1,'preparer',0,'partager',0,'entraider',0),
    'caps', jsonb_build_object('daily',3,'weekly',10,'season',60)),
  'trail_prepared', jsonb_build_object(
    'points', 30, 'max_points', 30,
    'weights', jsonb_build_object('explorer',0,'preparer',1,'partager',0,'entraider',0),
    'caps', jsonb_build_object('daily',2,'weekly',6,'season',30)),
  'kit_field_report', jsonb_build_object(
    'points', 20, 'max_points', 40, 'bonus_per_item', 2,
    'weights', jsonb_build_object('explorer',0,'preparer',0.7,'partager',0.3,'entraider',0),
    'caps', jsonb_build_object('daily',2,'weekly',6,'season',30)),
  'place_review', jsonb_build_object(
    'points', 15, 'max_points', 15,
    'weights', jsonb_build_object('explorer',0,'preparer',0,'partager',1,'entraider',0),
    'caps', jsonb_build_object('daily',3,'weekly',10,'season',50))
))
WHERE version = 'v1' AND COALESCE(payload->'actions', '{}'::jsonb) = '{}'::jsonb;
