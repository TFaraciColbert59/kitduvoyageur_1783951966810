-- ============================================================================
-- A11 — Correctif filiation des kits : le garde anti-cycle bloquait TOUT fork.
--
-- Constat (Étape 0-B, pgTAP field_proof/lineage sur base baseline) :
-- `handle_kit_lineage()` construisait `NEW.ancestors := v_parent.ancestors || v_parent.id`
-- puis testait `NEW.forked_from = ANY(NEW.ancestors)` — or `forked_from` est,
-- par construction, toujours présent dans cette chaîne : chaque fork levait
-- « Cycle de lignée détecté ». La détection correcte d'un cycle (repointer un
-- kit vers l'un de ses descendants) est `NEW.id = ANY(NEW.ancestors)`.
--
-- Migration additive : CREATE OR REPLACE de la fonction uniquement, sans
-- toucher aux données. Idempotente.
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
  -- Lors d'un UPDATE, vérifier l'immuabilité des champs de filiation
  IF TG_OP = 'UPDATE' THEN
    IF NEW.forked_from IS NOT DISTINCT FROM OLD.forked_from THEN
      -- Tentative de modifier manuellement un champ de filiation sans changer forked_from
      IF NEW.generation IS DISTINCT FROM OLD.generation
         OR NEW.ancestors IS DISTINCT FROM OLD.ancestors
         OR NEW.lineage_root_id IS DISTINCT FROM OLD.lineage_root_id THEN
        RAISE EXCEPTION 'Les champs de filiation sont immuables après insertion';
      END IF;
      -- Pas de changement de filiation : préserver intacts les champs historiques
      NEW.lineage_root_id := OLD.lineage_root_id;
      NEW.generation      := OLD.generation;
      NEW.ancestors       := OLD.ancestors;
      RETURN NEW;
    ELSE
      -- Le parent forked_from ne peut être altéré manuellement par UPDATE (immuabilité)
      -- Seul le trigger ON DELETE SET NULL (cascade BD) peut passer forked_from à NULL
      IF NEW.forked_from IS NOT NULL THEN
        RAISE EXCEPTION 'La filiation (forked_from) est immuable après insertion';
      END IF;
    END IF;
  END IF;

  IF NEW.forked_from IS NULL THEN
    IF TG_OP = 'UPDATE' AND OLD.forked_from IS NOT NULL THEN
      -- Suppression de parent (ON DELETE SET NULL) : on conserve la lignée
      -- historique, on ne ré-encrre pas. ancestors garde l'uuid disparu.
      NEW.lineage_root_id := OLD.lineage_root_id;
      NEW.generation      := OLD.generation;
      NEW.ancestors       := OLD.ancestors;
    ELSE
      -- Racine : la lignée commence ici.
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

  -- Cycle réel : NEW.id figure déjà dans la chaîne d'ancêtres (repointer un kit
  -- vers l'un de ses descendants). `forked_from` est toujours le dernier
  -- maillon de `ancestors` : le tester ici bloquait tout fork (correctif A11).
  IF NEW.id = ANY(NEW.ancestors) THEN
    RAISE EXCEPTION 'Cycle de lignée détecté';
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.handle_kit_lineage() IS
  'A11 — filiation immuable + anti-cycle corrigé (NEW.id = ANY(ancestors)) ; '
  'les forks légitimes ne sont plus rejetés.';
