-- ==============================================================================
-- Migration : 20260909110000_trip_checklist_seed_template.sql
-- HUB V5 — Provisionnement automatique de la checklist : chaque nouveau
-- voyage reçoit le template canonique (J-30 / J-14 / J-7 / J-3 / J-1) via
-- trigger + backfill des voyages existants sans checklist.
-- ==============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.lkv_seed_trip_checklist_template()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.trip_checklist_items (trip_id, label, due_offset_days, position) VALUES
    (NEW.id, 'Vérifier papiers d''identité / passeport', 30, 0),
    (NEW.id, 'Souscrire l''assurance voyage', 30, 1),
    (NEW.id, 'Réserver refuges / hébergements', 30, 2),
    (NEW.id, 'Tester et vérifier le matériel', 14, 3),
    (NEW.id, 'Préparer la trousse de secours', 7, 4),
    (NEW.id, 'Recharger batteries / powerbank', 7, 5),
    (NEW.id, 'Vérifier météo et itinéraire', 3, 6),
    (NEW.id, 'Charger eau et alimentation', 1, 7),
    (NEW.id, 'Départ — dernières vérifications', 1, 8);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_trip_checklist_seed ON public.trips;
CREATE TRIGGER trg_trip_checklist_seed
  AFTER INSERT ON public.trips
  FOR EACH ROW
  EXECUTE FUNCTION public.lkv_seed_trip_checklist_template();

-- Backfill : voyages existants sans aucune item de checklist.
INSERT INTO public.trip_checklist_items (trip_id, label, due_offset_days, position)
SELECT t.id, v.label, v.due_offset_days, v.position
FROM public.trips t
CROSS JOIN (VALUES
  ('Vérifier papiers d''identité / passeport', 30, 0),
  ('Souscrire l''assurance voyage', 30, 1),
  ('Réserver refuges / hébergements', 30, 2),
  ('Tester et vérifier le matériel', 14, 3),
  ('Préparer la trousse de secours', 7, 4),
  ('Recharger batteries / powerbank', 7, 5),
  ('Vérifier météo et itinéraire', 3, 6),
  ('Charger eau et alimentation', 1, 7),
  ('Départ — dernières vérifications', 1, 8)
) AS v(label, due_offset_days, position)
WHERE NOT EXISTS (
  SELECT 1 FROM public.trip_checklist_items c WHERE c.trip_id = t.id
);

COMMIT;
