-- ============================================================================
-- PHASE 8B — Durcissement des 18 tables à politiques permissives
-- ============================================================================
-- Constat prod (pg_policies + has_table_privilege) : 18 tables exposaient des
-- politiques `USING(true)` / `WITH CHECK(true)` à `anon`/`authenticated`
-- (ALL/INSERT/UPDATE/DELETE hérités de la baseline et de
-- 20260728150000_create_missing_feature_tables), avec des grants DML complets
-- (INSERT/UPDATE/DELETE/TRUNCATE) pour `authenticated` et parfois `anon`.
--
-- Analyse d'usage réel (src/, détail : docs/reports/PHASE_8B_HARDENING.md) :
--   • catalogue public réellement servi par l'app (affiliate_*, club_challenges,
--     club_recommended_kits, event_expenses, experts, guides, kit_items,
--     events) → SELECT public conservé, écriture retirée des clients ;
--   • données personnelles (gear_history, gear_images, loans,
--     carnet_gear_links) → lecture/écriture du PROPRIÉTAIRE (via gear_items
--     ou carnets) + service_role ;
--   • données financières/plateforme (ambassadors, promo_codes,
--     feature_flags, stock_movements) → SELECT restreint, écriture
--     service_role/admin ;
--   • `events` : la création par un utilisateur connecté est réelle
--     (organisateur). Les mises à jour de compteurs par les participants sont
--     déplacées dans les RPC `join_event` / `leave_event` (SECURITY DEFINER)
--     afin que la policy UPDATE reste strictement organisateur/admin.
--
-- Additive uniquement : aucun DROP de table/colonne, aucune donnée réécrite.
-- Un contrôle final intégré échoue si une policy permissive d'écriture
-- subsiste sur ces 18 tables.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Affiliation — catalogue public, écriture service_role
--    (les policies SELECT publiques et service_role existantes restent)
-- ----------------------------------------------------------------------------
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
  ON public.affiliate_offers, public.affiliate_partners, public.affiliate_programs
  FROM anon, authenticated;

-- ----------------------------------------------------------------------------
-- 2. ambassadors — données financières : propriétaire/admin en lecture,
--    écriture service_role (auto-inscription retirée, aucun flux app)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS public_read_ambassadors ON public.ambassadors;
DROP POLICY IF EXISTS auth_manage_ambassadors ON public.ambassadors;
DROP POLICY IF EXISTS auth_insert_ambassadors ON public.ambassadors;

CREATE POLICY ambassadors_select_own_or_admin ON public.ambassadors
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_admin());

REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
  ON public.ambassadors FROM anon, authenticated;
REVOKE SELECT ON public.ambassadors FROM anon;

-- ----------------------------------------------------------------------------
-- 3. carnet_gear_links — données perso : auteur du carnet + service_role
--    (lecture scopée `carnet_gear_links_read_scoped` conservée)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS carnet_gear_manage ON public.carnet_gear_links;

CREATE POLICY carnet_gear_links_insert_carnet_owner ON public.carnet_gear_links
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.carnets c
      WHERE c.id = carnet_gear_links.carnet_id AND c.author_id = auth.uid()
    )
  );

CREATE POLICY carnet_gear_links_update_carnet_owner ON public.carnet_gear_links
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.carnets c
      WHERE c.id = carnet_gear_links.carnet_id AND c.author_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.carnets c
      WHERE c.id = carnet_gear_links.carnet_id AND c.author_id = auth.uid()
    )
  );

CREATE POLICY carnet_gear_links_delete_carnet_owner ON public.carnet_gear_links
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.carnets c
      WHERE c.id = carnet_gear_links.carnet_id AND c.author_id = auth.uid()
    )
  );

REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
  ON public.carnet_gear_links FROM anon;

-- ----------------------------------------------------------------------------
-- 4. club_challenges — lecture publique, écriture service_role/admin
--    (aucun flux de création via session utilisateur constaté)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Public read club_challenges" ON public.club_challenges;
DROP POLICY IF EXISTS club_challenges_read ON public.club_challenges;
DROP POLICY IF EXISTS public_read_club_challenges ON public.club_challenges;
DROP POLICY IF EXISTS club_challenges_manage ON public.club_challenges;
DROP POLICY IF EXISTS auth_insert_club_challenges ON public.club_challenges;

CREATE POLICY club_challenges_select_public ON public.club_challenges
  FOR SELECT TO anon, authenticated USING (true);

REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
  ON public.club_challenges FROM anon, authenticated;

-- ----------------------------------------------------------------------------
-- 5. club_recommended_kits — lecture publique, écriture service_role/admin
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Public read club_recommended_kits" ON public.club_recommended_kits;
DROP POLICY IF EXISTS club_kits_read ON public.club_recommended_kits;
DROP POLICY IF EXISTS club_kits_manage ON public.club_recommended_kits;

CREATE POLICY club_recommended_kits_select_public ON public.club_recommended_kits
  FOR SELECT TO anon, authenticated USING (true);

REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
  ON public.club_recommended_kits FROM anon, authenticated;

-- ----------------------------------------------------------------------------
-- 6. event_expenses — catalogue communautaire public en lecture (embed
--    `evenements`), écriture service_role/admin
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS auth_manage_event_expenses ON public.event_expenses;

REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
  ON public.event_expenses FROM anon, authenticated;

-- ----------------------------------------------------------------------------
-- 7. events — lecture publique, création organisateur, update/delete
--    organisateur/admin. Compteurs gérés par les RPC (section 12).
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS auth_manage_events ON public.events;

DROP POLICY IF EXISTS auth_update_events ON public.events;
CREATE POLICY auth_update_events ON public.events
  FOR UPDATE TO authenticated
  USING (auth.uid() = organizer_id OR public.is_admin())
  WITH CHECK (auth.uid() = organizer_id OR public.is_admin());

DROP POLICY IF EXISTS auth_delete_events ON public.events;
CREATE POLICY auth_delete_events ON public.events
  FOR DELETE TO authenticated
  USING (auth.uid() = organizer_id OR public.is_admin());

REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
  ON public.events FROM anon;

-- ----------------------------------------------------------------------------
-- 8. experts — catalogue public, écriture service_role/admin
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS auth_manage_experts ON public.experts;

REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
  ON public.experts FROM anon, authenticated;

-- ----------------------------------------------------------------------------
-- 9. feature_flags — lecture authenticated conservée (client + RPC DEFINER),
--    écriture service_role/admin
-- ----------------------------------------------------------------------------
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
  ON public.feature_flags FROM anon, authenticated;
REVOKE SELECT ON public.feature_flags FROM anon;

-- ----------------------------------------------------------------------------
-- 10. gear_history / gear_images / loans — données perso du propriétaire
--     de l'objet (gear_items.user_id) + service_role
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS auth_read_gear_history ON public.gear_history;
DROP POLICY IF EXISTS auth_insert_own_gear_history ON public.gear_history;

CREATE POLICY gear_history_select_owner ON public.gear_history
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.gear_items gi
      WHERE gi.id = gear_history.gear_item_id AND gi.user_id = auth.uid()
    )
  );

CREATE POLICY gear_history_insert_owner ON public.gear_history
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.gear_items gi
      WHERE gi.id = gear_history.gear_item_id AND gi.user_id = auth.uid()
    )
  );

CREATE POLICY gear_history_update_owner ON public.gear_history
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.gear_items gi
      WHERE gi.id = gear_history.gear_item_id AND gi.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.gear_items gi
      WHERE gi.id = gear_history.gear_item_id AND gi.user_id = auth.uid()
    )
  );

CREATE POLICY gear_history_delete_owner ON public.gear_history
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.gear_items gi
      WHERE gi.id = gear_history.gear_item_id AND gi.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS auth_read_gear_images ON public.gear_images;

CREATE POLICY gear_images_select_owner ON public.gear_images
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.gear_items gi
      WHERE gi.id = gear_images.gear_item_id AND gi.user_id = auth.uid()
    )
  );

CREATE POLICY gear_images_insert_owner ON public.gear_images
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.gear_items gi
      WHERE gi.id = gear_images.gear_item_id AND gi.user_id = auth.uid()
    )
  );

CREATE POLICY gear_images_update_owner ON public.gear_images
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.gear_items gi
      WHERE gi.id = gear_images.gear_item_id AND gi.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.gear_items gi
      WHERE gi.id = gear_images.gear_item_id AND gi.user_id = auth.uid()
    )
  );

CREATE POLICY gear_images_delete_owner ON public.gear_images
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.gear_items gi
      WHERE gi.id = gear_images.gear_item_id AND gi.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS auth_read_loans ON public.loans;

CREATE POLICY loans_select_owner ON public.loans
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.gear_items gi
      WHERE gi.id = loans.gear_item_id AND gi.user_id = auth.uid()
    )
  );

CREATE POLICY loans_insert_owner ON public.loans
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.gear_items gi
      WHERE gi.id = loans.gear_item_id AND gi.user_id = auth.uid()
    )
  );

CREATE POLICY loans_update_owner ON public.loans
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.gear_items gi
      WHERE gi.id = loans.gear_item_id AND gi.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.gear_items gi
      WHERE gi.id = loans.gear_item_id AND gi.user_id = auth.uid()
    )
  );

CREATE POLICY loans_delete_owner ON public.loans
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.gear_items gi
      WHERE gi.id = loans.gear_item_id AND gi.user_id = auth.uid()
    )
  );

REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
  ON public.gear_history, public.gear_images, public.loans FROM anon;

-- ----------------------------------------------------------------------------
-- 11. guides / kit_items — contenu éditorial et catalogue public,
--     écriture service_role/admin
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS public_can_read_guides ON public.guides;
DROP POLICY IF EXISTS public_read_guides ON public.guides;
DROP POLICY IF EXISTS auth_manage_guides ON public.guides;
DROP POLICY IF EXISTS users_manage_own_guides ON public.guides;

CREATE POLICY guides_select_public ON public.guides
  FOR SELECT TO anon, authenticated USING (true);

REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
  ON public.guides, public.kit_items FROM anon, authenticated;

DROP POLICY IF EXISTS auth_manage_kit_items ON public.kit_items;

-- ----------------------------------------------------------------------------
-- 12. promo_codes — SELECT ambassadeur propriétaire/admin, écriture service
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS auth_manage_promo_codes ON public.promo_codes;
DROP POLICY IF EXISTS public_read_promo_codes ON public.promo_codes;

CREATE POLICY promo_codes_select_ambassador_or_admin ON public.promo_codes
  FOR SELECT TO authenticated
  USING (
    public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.ambassadors a
      WHERE a.id = promo_codes.ambassador_id AND a.user_id = auth.uid()
    )
  );

REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
  ON public.promo_codes FROM anon, authenticated;
REVOKE SELECT ON public.promo_codes FROM anon;

-- ----------------------------------------------------------------------------
-- 13. stock_movements — lecture/écriture admin (UI admin en session),
--     journal des ventes via RPC DEFINER (decrement_stock_on_order)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS public_read_stock_movements ON public.stock_movements;

CREATE POLICY stock_movements_select_admin ON public.stock_movements
  FOR SELECT TO authenticated
  USING (public.is_admin());

REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
  ON public.stock_movements FROM anon;
REVOKE UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
  ON public.stock_movements FROM authenticated;
REVOKE SELECT ON public.stock_movements FROM anon;

-- ----------------------------------------------------------------------------
-- 14. events — RPC d'inscription/désinscription (compteurs atomiques)
--     SECURITY DEFINER : les participants n'ont plus besoin d'UPDATE direct.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.join_event(p_event_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_count integer;
  v_max integer;
  v_status text;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'authentification requise' USING ERRCODE = '42501';
  END IF;

  SELECT COALESCE(current_participants, 0), COALESCE(max_participants, 0), status
    INTO v_count, v_max, v_status
    FROM public.events
   WHERE id = p_event_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'événement introuvable' USING ERRCODE = 'P0002';
  END IF;
  IF v_status = 'past' THEN
    RAISE EXCEPTION 'événement terminé' USING ERRCODE = 'P0001';
  END IF;
  IF v_max > 0 AND v_count >= v_max THEN
    RAISE EXCEPTION 'événement complet' USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO public.event_participants (event_id, user_id)
  VALUES (p_event_id, v_uid)
  ON CONFLICT (event_id, user_id) DO NOTHING;

  IF FOUND THEN
    v_count := v_count + 1;
    v_status := CASE WHEN v_max > 0 AND v_count >= v_max THEN 'full' ELSE 'upcoming' END;
    UPDATE public.events
       SET current_participants = v_count,
           status = v_status
     WHERE id = p_event_id;
  ELSE
    v_status := COALESCE(v_status, 'upcoming');
  END IF;

  RETURN jsonb_build_object(
    'registered', true,
    'current_participants', v_count,
    'status', v_status
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.leave_event(p_event_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_count integer;
  v_status text;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'authentification requise' USING ERRCODE = '42501';
  END IF;

  DELETE FROM public.event_participants
   WHERE event_id = p_event_id AND user_id = v_uid;

  IF FOUND THEN
    UPDATE public.events
       SET current_participants = GREATEST(COALESCE(current_participants, 1) - 1, 0),
           status = CASE WHEN status = 'full' THEN 'upcoming' ELSE status END
     WHERE id = p_event_id
    RETURNING current_participants, status INTO v_count, v_status;
  ELSE
    SELECT COALESCE(current_participants, 0), COALESCE(status, 'upcoming')
      INTO v_count, v_status
      FROM public.events
     WHERE id = p_event_id;
  END IF;

  IF v_count IS NULL THEN
    RAISE EXCEPTION 'événement introuvable' USING ERRCODE = 'P0002';
  END IF;

  RETURN jsonb_build_object(
    'registered', false,
    'current_participants', v_count,
    'status', v_status
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.join_event(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.leave_event(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.join_event(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.leave_event(uuid) TO authenticated, service_role;

-- ----------------------------------------------------------------------------
-- 15. Contrôle final — aucune policy permissive d'ÉCRITURE ne doit subsister
--     pour anon/authenticated/public sur les 18 tables.
-- ----------------------------------------------------------------------------
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT tablename, policyname, cmd
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = ANY (ARRAY[
        'affiliate_offers', 'affiliate_partners', 'affiliate_programs',
        'ambassadors', 'carnet_gear_links', 'club_challenges',
        'club_recommended_kits', 'event_expenses', 'events', 'experts',
        'feature_flags', 'gear_history', 'gear_images', 'guides',
        'kit_items', 'loans', 'promo_codes', 'stock_movements'
      ])
      AND cmd <> 'SELECT'
      AND (roles @> ARRAY['anon']::name[]
           OR roles @> ARRAY['authenticated']::name[]
           OR roles @> ARRAY['public']::name[])
      AND COALESCE(qual, 'true') IN ('true', '(true)')
      AND COALESCE(with_check, 'true') IN ('true', '(true)')
  LOOP
    RAISE EXCEPTION 'Phase 8B : policy permissive résiduelle %.% (%)',
      r.tablename, r.policyname, r.cmd;
  END LOOP;
END $$;
