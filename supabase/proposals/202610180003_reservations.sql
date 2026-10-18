-- Proposition de primitive transactionnelle. Aucun paiement ni API publique.
-- Installer btree_gist sous controle DBA : son schema reel doit etre audite.
BEGIN;
CREATE EXTENSION IF NOT EXISTS btree_gist;
ALTER TABLE public.gear_items ADD CONSTRAINT gear_items_sim_owner_unique UNIQUE(id,user_id);
CREATE TABLE public.kit_gear_reservations (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 gear_item_id uuid NOT NULL,owner_id uuid NOT NULL,
 borrower_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 idempotency_key text NOT NULL CHECK(length(idempotency_key) BETWEEN 16 AND 128),
 during tstzrange NOT NULL,
 state text NOT NULL CHECK(state IN('held','confirmed','cancelled','completed')),
 created_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(gear_item_id,owner_id) REFERENCES public.gear_items(id,user_id) ON DELETE RESTRICT,
 CHECK(owner_id<>borrower_id),
 CHECK(NOT isempty(during) AND NOT lower_inf(during) AND NOT upper_inf(during)),
 CHECK(lower_inc(during) AND NOT upper_inc(during)),
 CHECK(upper(during)-lower(during)<=interval '31 days'),
 UNIQUE(borrower_id,idempotency_key),
 EXCLUDE USING gist(gear_item_id WITH =,during WITH &&)
 WHERE(state IN('held','confirmed'))
);
CREATE INDEX kit_gear_reservations_borrower ON public.kit_gear_reservations(borrower_id,created_at DESC);
CREATE INDEX kit_gear_reservations_owner ON public.kit_gear_reservations(owner_id,created_at DESC);
ALTER TABLE public.kit_gear_reservations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.kit_gear_reservations FROM anon,authenticated;
GRANT SELECT ON public.kit_gear_reservations TO authenticated;
GRANT ALL ON public.kit_gear_reservations TO service_role;
CREATE POLICY reservation_party_read ON public.kit_gear_reservations FOR SELECT TO authenticated
 USING(owner_id=(SELECT auth.uid()) OR borrower_id=(SELECT auth.uid()));
COMMIT;
