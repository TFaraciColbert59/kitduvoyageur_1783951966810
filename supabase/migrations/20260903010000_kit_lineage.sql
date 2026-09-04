-- ============================================================================
-- 20260903010000_kit_lineage.sql
-- Chantier « Lignées de kits » — Lot 1 : filiation matérialisée (ADR-008),
-- lien catalogue shop_products sur les items, rattachement du snapshot
-- configurateur au kit vivant (ADR-007).
--
-- Règles serveur (le trigger écrase TOUTE valeur fournie par le client) :
--   • forked_from IS NULL       → racine (lineage_root_id = id, génération 0)
--   • forked_from = parent      → dérivation depuis le parent
--   • suppression du parent     → SET NULL FK, MAIS lignée conservée (pas de
--     ré-encrage) — ancestors garde l'uuid disparu, trace historique.
--   • anti-cycle + profondeur max 50 (garde-fou anti-abus).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1) Filiation sur materiel_kits
-- ----------------------------------------------------------------------------
ALTER TABLE public.materiel_kits
  ADD COLUMN IF NOT EXISTS forked_from      uuid REFERENCES public.materiel_kits(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS lineage_root_id  uuid REFERENCES public.materiel_kits(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS generation       smallint NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS ancestors        uuid[]   NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS origin           text     NOT NULL DEFAULT 'manuel',
  ADD COLUMN IF NOT EXISTS is_souche        boolean  NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS field_proven_count integer NOT NULL DEFAULT 0;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'materiel_kits_origin_chk') THEN
    ALTER TABLE public.materiel_kits
      ADD CONSTRAINT materiel_kits_origin_chk
      CHECK (origin IN ('configurateur','manuel','fork','import_gpx','souche_editoriale'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_kits_lineage_root ON public.materiel_kits (lineage_root_id);
CREATE INDEX IF NOT EXISTS idx_kits_forked_from  ON public.materiel_kits (forked_from);
CREATE INDEX IF NOT EXISTS idx_kits_ancestors    ON public.materiel_kits USING gin (ancestors);

-- ----------------------------------------------------------------------------
-- 2) Lien produit catalogue sur les items.
--    Cible : shop_products(id) — la MÊME table que order_items.product_id
--    (décision Tony, GATE 0 ; le SQL figé du plan visait products, legacy).
-- ----------------------------------------------------------------------------
ALTER TABLE public.materiel_kit_items
  ADD COLUMN IF NOT EXISTS product_id uuid REFERENCES public.shop_products(id) ON DELETE SET NULL;

-- Clé d'identité d'objet stable à travers les forks (conservation du Lot 4).
ALTER TABLE public.materiel_kit_items
  ADD COLUMN IF NOT EXISTS item_key text GENERATED ALWAYS AS (
    COALESCE(
      product_id::text,
      regexp_replace(lower(COALESCE(name,'')), '[^a-z0-9]+', '-', 'g')
    )
  ) STORED;

CREATE INDEX IF NOT EXISTS idx_kit_items_item_key ON public.materiel_kit_items (item_key);

-- ----------------------------------------------------------------------------
-- 3) Snapshot du configurateur rattaché au kit vivant.
--    ON DELETE SET NULL (écart acté à l'ADR-007 : le rapport configurateur doit
--    survivre à la suppression du kit — le plan SQL figé disait CASCADE).
-- ----------------------------------------------------------------------------
ALTER TABLE public.kit_reports
  ADD COLUMN IF NOT EXISTS kit_id uuid REFERENCES public.materiel_kits(id) ON DELETE SET NULL;

-- ----------------------------------------------------------------------------
-- 4) Trigger de filiation — dérivation serveur, SECURITY DEFINER,
--    search_path verrouillé (norme maison, cf. helpers de messagerie).
-- ----------------------------------------------------------------------------
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

  IF NEW.id = ANY(NEW.ancestors) OR NEW.forked_from = ANY(NEW.ancestors) THEN
    RAISE EXCEPTION 'Cycle de lignée détecté';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_materiel_kits_lineage ON public.materiel_kits;
CREATE TRIGGER trg_materiel_kits_lineage
BEFORE INSERT OR UPDATE ON public.materiel_kits
FOR EACH ROW EXECUTE FUNCTION public.handle_kit_lineage();