-- ==============================================================================
-- Phase 5 — Kit voyageur complet (chantier LANCEMENT_MONDIAL)
--
-- Objectif : le kit lié au voyage doit distinguer, de façon traçable et
-- modifiable, l'équipement PERSONNEL, PARTAGÉ et MANQUANT, avec poids,
-- quantité, propriétaire, état et la RAISON vérifiable de chaque
-- recommandation (règle métier ou donnée du parcours réel).
--
-- Migration strictement ADDITIVE et idempotente :
--   • trip_items.ownership     : 'personal' | 'shared' (défaut 'personal')
--   • trip_items.owner_id      : propriétaire réel (auth.users), NULL = à assigner
--   • trip_items.condition     : état déclaré, NULL = inconnu (jamais inventé)
--   • trip_items.reason        : raison de la recommandation (règle/donnée)
--   • materiel_kit_items       : mêmes métadonnées + priority + is_vital
-- Aucune politique RLS modifiée : les portées d'écriture restent portées par
-- `can_edit_trip` (trip_items) et `auth.uid() = user_id` (materiel_kit_items).
-- ==============================================================================

-- ── 1. trip_items — complétude du sac du voyage ──────────────────────────────
ALTER TABLE public.trip_items
  ADD COLUMN IF NOT EXISTS ownership TEXT,
  ADD COLUMN IF NOT EXISTS owner_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS condition TEXT,
  ADD COLUMN IF NOT EXISTS reason TEXT;

-- Défaut posé après le backfill : les lignes existantes deviennent personnelles.
UPDATE public.trip_items
  SET ownership = 'personal'
  WHERE ownership IS NULL;

ALTER TABLE public.trip_items
  ALTER COLUMN ownership SET DEFAULT 'personal';

ALTER TABLE public.trip_items
  ALTER COLUMN ownership SET NOT NULL;

ALTER TABLE public.trip_items
  DROP CONSTRAINT IF EXISTS trip_items_ownership_check;
ALTER TABLE public.trip_items
  ADD CONSTRAINT trip_items_ownership_check
  CHECK (ownership IN ('personal', 'shared'));

ALTER TABLE public.trip_items
  DROP CONSTRAINT IF EXISTS trip_items_condition_check;
ALTER TABLE public.trip_items
  ADD CONSTRAINT trip_items_condition_check
  CHECK (condition IS NULL OR condition IN ('neuf', 'bon', 'use', 'a_remplacer', 'pour_pieces'));

CREATE INDEX IF NOT EXISTS idx_trip_items_ownership
  ON public.trip_items(trip_id, ownership);

CREATE INDEX IF NOT EXISTS idx_trip_items_owner
  ON public.trip_items(trip_id, owner_id)
  WHERE owner_id IS NOT NULL;

COMMENT ON COLUMN public.trip_items.ownership IS
  'Phase 5 — personal : matériel propre au voyageur ; shared : matériel du groupe '
  '(tente, réchaud, trousse…) porté par un seul participant.';
COMMENT ON COLUMN public.trip_items.owner_id IS
  'Phase 5 — propriétaire du matériel (auth.users). NULL = à assigner ; jamais deviné.';
COMMENT ON COLUMN public.trip_items.condition IS
  'Phase 5 — état déclaré du matériel (aligné product_ownership.condition). '
  'NULL = inconnu (aucune valeur inventée).';
COMMENT ON COLUMN public.trip_items.reason IS
  'Phase 5 — raison vérifiable de la recommandation (règle métier LKDV ou donnée '
  'réelle du parcours/activité). NULL pour un ajout manuel sans recommandation.';

-- ── 2. materiel_kit_items — mêmes métadonnées pour le kit lié au voyage ──────
ALTER TABLE public.materiel_kit_items
  ADD COLUMN IF NOT EXISTS ownership TEXT,
  ADD COLUMN IF NOT EXISTS owner_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS condition TEXT,
  ADD COLUMN IF NOT EXISTS reason TEXT,
  ADD COLUMN IF NOT EXISTS priority TEXT,
  ADD COLUMN IF NOT EXISTS is_vital BOOLEAN;

UPDATE public.materiel_kit_items
  SET ownership = 'personal'
  WHERE ownership IS NULL;

UPDATE public.materiel_kit_items
  SET priority = 'recommended'
  WHERE priority IS NULL;

UPDATE public.materiel_kit_items
  SET is_vital = false
  WHERE is_vital IS NULL;

ALTER TABLE public.materiel_kit_items
  ALTER COLUMN ownership SET DEFAULT 'personal';
ALTER TABLE public.materiel_kit_items
  ALTER COLUMN priority SET DEFAULT 'recommended';
ALTER TABLE public.materiel_kit_items
  ALTER COLUMN is_vital SET DEFAULT false;

ALTER TABLE public.materiel_kit_items
  ALTER COLUMN ownership SET NOT NULL;
ALTER TABLE public.materiel_kit_items
  ALTER COLUMN priority SET NOT NULL;
ALTER TABLE public.materiel_kit_items
  ALTER COLUMN is_vital SET NOT NULL;

ALTER TABLE public.materiel_kit_items
  DROP CONSTRAINT IF EXISTS materiel_kit_items_ownership_check;
ALTER TABLE public.materiel_kit_items
  ADD CONSTRAINT materiel_kit_items_ownership_check
  CHECK (ownership IN ('personal', 'shared'));

ALTER TABLE public.materiel_kit_items
  DROP CONSTRAINT IF EXISTS materiel_kit_items_condition_check;
ALTER TABLE public.materiel_kit_items
  ADD CONSTRAINT materiel_kit_items_condition_check
  CHECK (condition IS NULL OR condition IN ('neuf', 'bon', 'use', 'a_remplacer', 'pour_pieces'));

ALTER TABLE public.materiel_kit_items
  DROP CONSTRAINT IF EXISTS materiel_kit_items_priority_check;
ALTER TABLE public.materiel_kit_items
  ADD CONSTRAINT materiel_kit_items_priority_check
  CHECK (priority IN ('vital', 'recommended', 'optional'));

CREATE INDEX IF NOT EXISTS idx_materiel_kit_items_ownership
  ON public.materiel_kit_items(kit_id, ownership);

COMMENT ON COLUMN public.materiel_kit_items.ownership IS
  'Phase 5 — personal/shared : le kit du voyage couvre le matériel individuel et collectif.';
COMMENT ON COLUMN public.materiel_kit_items.reason IS
  'Phase 5 — raison vérifiable de la recommandation (règle/donnée réelle) ; NULL sinon.';
