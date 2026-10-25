-- ============================================================================
-- A11 — Filiation des kits : immuabilité réellement appliquée + cycle explicite.
--
-- Constats (Étape 0-B, pgTAP lineage sur base baseline) :
--   1. Le trigger `trg_materiel_kits_lineage` n'était déclaré que sur
--      `UPDATE OF forked_from` : modifier `generation`, `ancestors` ou
--      `lineage_root_id` ne déclenchait RIEN (immuabilité contournable).
--   2. Une tentative de repointer `forked_from` vers un descendant (cycle)
--      levait « filiation immuable » au lieu de « Cycle de lignée détecté ».
--
-- Correctif : trigger élargi aux quatre champs de filiation + détection du
-- cycle AVANT le refus d'immuabilité. Aucun changement de données.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.handle_kit_lineage()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_parent public.materiel_kits%ROWTYPE;
BEGIN
  -- Lors d'un UPDATE : immuabilité des champs de filiation, avec un message
  -- de cycle explicite si la nouvelle cible est un descendant (tentative de
  -- boucle), avant tout autre refus.
  IF TG_OP = 'UPDATE' THEN
    IF NEW.forked_from IS NOT DISTINCT FROM OLD.forked_from THEN
      IF NEW.generation IS DISTINCT FROM OLD.generation
         OR NEW.ancestors IS DISTINCT FROM OLD.ancestors
         OR NEW.lineage_root_id IS DISTINCT FROM OLD.lineage_root_id THEN
        RAISE EXCEPTION 'Les champs de filiation sont immuables après insertion';
      END IF;
      NEW.lineage_root_id := OLD.lineage_root_id;
      NEW.generation      := OLD.generation;
      NEW.ancestors       := OLD.ancestors;
      RETURN NEW;
    ELSE
      IF NEW.forked_from IS NOT NULL THEN
        -- Détection de cycle d'abord : le nouveau parent est-il un descendant ?
        SELECT * INTO v_parent FROM public.materiel_kits WHERE id = NEW.forked_from;
        IF FOUND AND (NEW.id = v_parent.id OR NEW.id = ANY(v_parent.ancestors)) THEN
          RAISE EXCEPTION 'Cycle de lignée détecté';
        END IF;
        RAISE EXCEPTION 'La filiation (forked_from) est immuable après insertion';
      END IF;
    END IF;
  END IF;

  IF NEW.forked_from IS NULL THEN
    IF TG_OP = 'UPDATE' AND OLD.forked_from IS NOT NULL THEN
      NEW.lineage_root_id := OLD.lineage_root_id;
      NEW.generation      := OLD.generation;
      NEW.ancestors       := OLD.ancestors;
    ELSE
      NEW.lineage_root_id := NEW.id;
      NEW.generation      := 0;
      NEW.ancestors       := '{}'::uuid[];
    END IF;
    RETURN NEW;
  END IF;

  IF NEW.forked_from = NEW.id THEN
    RAISE EXCEPTION 'Un kit ne peut pas être son propre parent (forked_from = id)';
  END IF;

  SELECT * INTO v_parent FROM public.materiel_kits WHERE id = NEW.forked_from;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Kit parent introuvable (forked_from = %)', NEW.forked_from;
  END IF;

  NEW.lineage_root_id := v_parent.lineage_root_id;
  NEW.generation      := v_parent.generation + 1;
  NEW.ancestors       := v_parent.ancestors || v_parent.id;

  IF NEW.generation > 50 THEN
    RAISE EXCEPTION 'Profondeur de lignée maximale (50) dépassée';
  END IF;

  IF NEW.id = ANY(NEW.ancestors) THEN
    RAISE EXCEPTION 'Cycle de lignée détecté';
  END IF;

  RETURN NEW;
END;
$$;

-- Trigger élargi : toute modification d'un champ de filiation déclenche le garde.
DROP TRIGGER IF EXISTS trg_materiel_kits_lineage ON public.materiel_kits;
CREATE TRIGGER trg_materiel_kits_lineage
  BEFORE INSERT OR UPDATE OF forked_from, generation, ancestors, lineage_root_id
  ON public.materiel_kits
  FOR EACH ROW EXECUTE FUNCTION public.handle_kit_lineage();
