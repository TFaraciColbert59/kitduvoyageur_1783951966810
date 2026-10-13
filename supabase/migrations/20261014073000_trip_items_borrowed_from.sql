-- Compas (lot AH) — « emprunté à » : un objet du kit prêté par quelqu'un de l'équipe.
--
-- ⚠ NE PAS APPLIQUER à la main : migration additive, à passer par le circuit habituel
-- (validation sur copie d'abord).
--
-- Rien dans `trip_items` ne dit qu'un objet est emprunté :
--   • `owner_id` / `ownership` disent QUI le porte et s'il est commun, pas s'il existe (la répartition
--     du matériel commun confie aussi des objets qui manquent encore) ;
--   • `purchase_state` (needed → added → in_cart → shipping) est la file d'ACHAT : y mettre un emprunt
--     le mélangerait avec « ajouté à la liste » du Hub ;
--   • `inventory_item_id` relie à l'inventaire de la personne connectée (privé : on ne voit pas celui
--     des autres) ;
--   • `status` (packed, needed, optional, missing) est l'état d'emballage.
-- Sans colonne dédiée, un objet emprunté restait « à trouver » et proposait encore Emprunter / Louer /
-- Acheter. `borrowed_from` est la personne qui prête ; non nul = l'objet est DISPONIBLE (lu ainsi par
-- `buildCompasModel`). Si la personne quitte la plateforme (`auth.users` supprimé), l'emprunt tombe et
-- l'objet redevient à trouver : jamais un prêteur fantôme.
--
-- Strictement additif : une colonne nullable, un index partiel. Aucune politique RLS touchée : la
-- lecture reste `can_read_trip(trip_id)`, l'écriture `can_edit_trip(trip_id)` (USING et WITH CHECK).

ALTER TABLE public.trip_items
  ADD COLUMN IF NOT EXISTS borrowed_from uuid REFERENCES auth.users(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.trip_items.borrowed_from IS
  'Compas — personne de l''équipe qui prête cet objet (auth.users). Non nul = emprunté donc disponible ; '
  'NULL = rien d''emprunté. Posé par compasBorrowItemAction (personne du voyage, jamais soi-même).';

-- Ce que l'emprunt a remplacé (porteur, mode), pour que « Annuler l'emprunt » le rétablisse
-- même longtemps après (constat Codex, PR #94). Posés par compasBorrowItemAction au premier
-- emprunt (un second prêteur ne les écrase pas), vidés à l'annulation.
ALTER TABLE public.trip_items
  ADD COLUMN IF NOT EXISTS borrow_prev_owner_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS borrow_prev_ownership text
    CHECK (borrow_prev_ownership IS NULL OR borrow_prev_ownership IN ('personal', 'shared'));

CREATE INDEX IF NOT EXISTS idx_trip_items_borrowed_from
  ON public.trip_items(trip_id, borrowed_from)
  WHERE borrowed_from IS NOT NULL;
