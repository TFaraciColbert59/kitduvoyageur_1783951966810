-- ============================================================================
-- P2 — Barème : producteurs « carnet publié », « checklist complétée » et
-- « voyage terminé » (spec §3.2). Migration additive : les trois actions sont
-- fusionnées dans `payload.actions` de la version active sans écraser les
-- actions déjà présentes.
-- ============================================================================

UPDATE public.progression_rules
SET payload = jsonb_set(
      payload,
      '{actions}',
      COALESCE(payload->'actions', '{}'::jsonb) || jsonb_build_object(
        'carnet_published', jsonb_build_object(
          'points', 60, 'max_points', 60,
          'weights', jsonb_build_object('explorer',0,'preparer',0,'partager',1,'entraider',0),
          'caps', jsonb_build_object('daily',2,'weekly',5,'season',15)),
        'checklist_completed', jsonb_build_object(
          'points', 25, 'max_points', 25,
          'weights', jsonb_build_object('explorer',0,'preparer',1,'partager',0,'entraider',0),
          'caps', jsonb_build_object('daily',3,'weekly',8,'season',30)),
        'trip_completed', jsonb_build_object(
          'points', 45, 'max_points', 45,
          'weights', jsonb_build_object('explorer',0.7,'preparer',0.3,'partager',0,'entraider',0),
          'caps', jsonb_build_object('daily',2,'weekly',4,'season',10))
      )
    )
WHERE active;
