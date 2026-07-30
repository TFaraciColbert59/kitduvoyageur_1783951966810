-- ═══════════════════════════════════════════════════════════════════════════
-- MIGRATION: Fix overly permissive RLS policies (Phase 3 — Security)
-- ═══════════════════════════════════════════════════════════════════════════
--
-- P0 — Critical: Public/anon full CRUD on sensitive tables
-- P1 — Important: Authenticated full CRUD without ownership checks
--
-- ═══════════════════════════════════════════════════════════════════════════

-- ── PART A: P0 — Kill public/anon FULL CRUD policies ─────────────────────
-- These are the most critical: ANY visitor (even unauthenticated) can
-- read/write every row.

-- ── A1. user_payment_methods ──
DROP POLICY IF EXISTS "anon_all_payment_methods" ON public.user_payment_methods;
-- Authenticated policy (users_manage_own_payment_methods) already exists with
-- auth.uid() = user_id check. No further action needed.

-- ── A2. user_addresses ──
DROP POLICY IF EXISTS "anon_all_addresses" ON public.user_addresses;
-- Authenticated policy (users_manage_own_addresses) already exists with
-- auth.uid() = user_id check. No further action needed.

-- ── A3. orders (anon insert) ──
DROP POLICY IF EXISTS "anon_insert_orders" ON public.orders;
-- users_manage_own_orders already exists with user_id = auth.uid()

-- ── A4. order_items (anon insert) ──
DROP POLICY IF EXISTS "anon_insert_order_items" ON public.order_items;
-- Fix the authenticated insert policy: verify order ownership
DROP POLICY IF EXISTS "users_insert_order_items" ON public.order_items;
CREATE POLICY "users_insert_own_order_items" ON public.order_items
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.orders
      WHERE orders.id = order_items.order_id
      AND orders.user_id = auth.uid()
    )
  );

-- ── A5. outdoor_points ──
DROP POLICY IF EXISTS "anon_write_outdoor_points" ON public.outdoor_points;
DROP POLICY IF EXISTS "anon_update_outdoor_points" ON public.outdoor_points;
-- Keep: service_write_outdoor_points (service_role) + public_read_outdoor_points

-- ── A6. overpass_sync_log ──
DROP POLICY IF EXISTS "anon_write_overpass_sync_log" ON public.overpass_sync_log;
-- Keep: service_write_overpass_sync_log (service_role) + public_read_overpass_sync_log

-- ── A7. groupe_* tables (legacy groups) — drop all "Allow public all" ──
DROP POLICY IF EXISTS "Allow public all" ON public.groupes;
DROP POLICY IF EXISTS "Allow public all" ON public.groupe_membres;
DROP POLICY IF EXISTS "Allow public all" ON public.groupe_activites;
DROP POLICY IF EXISTS "Allow public all" ON public.groupe_depenses;
DROP POLICY IF EXISTS "Allow public all" ON public.groupe_depense_parts;
DROP POLICY IF EXISTS "Allow public all" ON public.groupe_equipement;
DROP POLICY IF EXISTS "Allow public all" ON public.groupe_etapes;
DROP POLICY IF EXISTS "Allow public all" ON public.groupe_hebergements;
DROP POLICY IF EXISTS "Allow public all" ON public.groupe_messages;
DROP POLICY IF EXISTS "Allow public all" ON public.groupe_taches;
DROP POLICY IF EXISTS "Allow public all" ON public.groupe_votes;
DROP POLICY IF EXISTS "Allow public all" ON public.groupe_vote_options;
DROP POLICY IF EXISTS "Allow public all" ON public.groupe_vote_choix;

-- Replace with proper policies (public read + authenticated owner/member write)
-- Helper: a member of a legacy group is someone in groupe_membres with matching groupe_id AND user_id
CREATE POLICY "public_read_groupes" ON public.groupes
  FOR SELECT TO public USING (true);
CREATE POLICY "auth_insert_groupes" ON public.groupes
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = created_by);
CREATE POLICY "auth_update_groupes" ON public.groupes
  FOR UPDATE TO authenticated USING (auth.uid() = created_by OR public.is_admin());
CREATE POLICY "auth_delete_groupes" ON public.groupes
  FOR DELETE TO authenticated USING (auth.uid() = created_by OR public.is_admin());

CREATE POLICY "public_read_groupe_membres" ON public.groupe_membres
  FOR SELECT TO public USING (true);
CREATE POLICY "auth_join_groupe" ON public.groupe_membres
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "auth_leave_groupe" ON public.groupe_membres
  FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "auth_update_own_membership" ON public.groupe_membres
  FOR UPDATE TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "public_read_groupe_activites" ON public.groupe_activites
  FOR SELECT TO public USING (true);
CREATE POLICY "auth_insert_groupe_activites" ON public.groupe_activites
  FOR INSERT TO authenticated WITH CHECK (
    auth.uid() = membre_id
    AND EXISTS (SELECT 1 FROM public.groupe_membres WHERE groupe_id = groupe_activites.groupe_id AND user_id = auth.uid())
  );
CREATE POLICY "auth_delete_own_groupe_activites" ON public.groupe_activites
  FOR DELETE TO authenticated USING (auth.uid() = membre_id);

CREATE POLICY "public_read_groupe_depenses" ON public.groupe_depenses
  FOR SELECT TO public USING (true);
CREATE POLICY "auth_insert_groupe_depenses" ON public.groupe_depenses
  FOR INSERT TO authenticated WITH CHECK (
    auth.uid() = payeur_id
    AND EXISTS (SELECT 1 FROM public.groupe_membres WHERE groupe_id = groupe_depenses.groupe_id AND user_id = auth.uid())
  );
CREATE POLICY "auth_update_own_groupe_depenses" ON public.groupe_depenses
  FOR UPDATE TO authenticated USING (auth.uid() = payeur_id);
CREATE POLICY "auth_delete_own_groupe_depenses" ON public.groupe_depenses
  FOR DELETE TO authenticated USING (auth.uid() = payeur_id);

CREATE POLICY "public_read_groupe_depense_parts" ON public.groupe_depense_parts
  FOR SELECT TO public USING (true);
CREATE POLICY "auth_insert_groupe_depense_parts" ON public.groupe_depense_parts
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = membre_id);
CREATE POLICY "auth_delete_own_groupe_depense_parts" ON public.groupe_depense_parts
  FOR DELETE TO authenticated USING (auth.uid() = membre_id);

CREATE POLICY "public_read_groupe_equipement" ON public.groupe_equipement
  FOR SELECT TO public USING (true);
CREATE POLICY "auth_insert_groupe_equipement" ON public.groupe_equipement
  FOR INSERT TO authenticated WITH CHECK (
    auth.uid() = apporte_par
    AND EXISTS (SELECT 1 FROM public.groupe_membres WHERE groupe_id = groupe_equipement.groupe_id AND user_id = auth.uid())
  );
CREATE POLICY "auth_update_own_groupe_equipement" ON public.groupe_equipement
  FOR UPDATE TO authenticated USING (auth.uid() = apporte_par);
CREATE POLICY "auth_delete_own_groupe_equipement" ON public.groupe_equipement
  FOR DELETE TO authenticated USING (auth.uid() = apporte_par);

CREATE POLICY "public_read_groupe_etapes" ON public.groupe_etapes
  FOR SELECT TO public USING (true);
CREATE POLICY "auth_insert_groupe_etapes" ON public.groupe_etapes
  FOR INSERT TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM public.groupe_membres WHERE groupe_id = groupe_etapes.groupe_id AND user_id = auth.uid())
  );
CREATE POLICY "auth_update_groupe_etapes" ON public.groupe_etapes
  FOR UPDATE TO authenticated USING (
    EXISTS (SELECT 1 FROM public.groupe_membres WHERE groupe_id = groupe_etapes.groupe_id AND user_id = auth.uid())
  );
CREATE POLICY "auth_delete_groupe_etapes" ON public.groupe_etapes
  FOR DELETE TO authenticated USING (
    EXISTS (SELECT 1 FROM public.groupe_membres WHERE groupe_id = groupe_etapes.groupe_id AND user_id = auth.uid())
  );

CREATE POLICY "public_read_groupe_hebergements" ON public.groupe_hebergements
  FOR SELECT TO public USING (true);
CREATE POLICY "auth_insert_groupe_hebergements" ON public.groupe_hebergements
  FOR INSERT TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM public.groupe_membres WHERE groupe_id = groupe_hebergements.groupe_id AND user_id = auth.uid())
  );
CREATE POLICY "auth_update_groupe_hebergements" ON public.groupe_hebergements
  FOR UPDATE TO authenticated USING (
    EXISTS (SELECT 1 FROM public.groupe_membres WHERE groupe_id = groupe_hebergements.groupe_id AND user_id = auth.uid())
  );
CREATE POLICY "auth_delete_groupe_hebergements" ON public.groupe_hebergements
  FOR DELETE TO authenticated USING (
    EXISTS (SELECT 1 FROM public.groupe_membres WHERE groupe_id = groupe_hebergements.groupe_id AND user_id = auth.uid())
  );

CREATE POLICY "public_read_groupe_messages" ON public.groupe_messages
  FOR SELECT TO public USING (true);
CREATE POLICY "auth_insert_groupe_messages" ON public.groupe_messages
  FOR INSERT TO authenticated WITH CHECK (
    auth.uid() = auteur_id
    AND EXISTS (SELECT 1 FROM public.groupe_membres WHERE groupe_id = groupe_messages.groupe_id AND user_id = auth.uid())
  );
CREATE POLICY "auth_delete_own_groupe_messages" ON public.groupe_messages
  FOR DELETE TO authenticated USING (auth.uid() = auteur_id);

CREATE POLICY "public_read_groupe_taches" ON public.groupe_taches
  FOR SELECT TO public USING (true);
CREATE POLICY "auth_insert_groupe_taches" ON public.groupe_taches
  FOR INSERT TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM public.groupe_membres WHERE groupe_id = groupe_taches.groupe_id AND user_id = auth.uid())
  );
CREATE POLICY "auth_update_groupe_taches" ON public.groupe_taches
  FOR UPDATE TO authenticated USING (
    EXISTS (SELECT 1 FROM public.groupe_membres WHERE groupe_id = groupe_taches.groupe_id AND user_id = auth.uid())
  );
CREATE POLICY "auth_delete_groupe_taches" ON public.groupe_taches
  FOR DELETE TO authenticated USING (
    EXISTS (SELECT 1 FROM public.groupe_membres WHERE groupe_id = groupe_taches.groupe_id AND user_id = auth.uid())
  );

CREATE POLICY "public_read_groupe_votes" ON public.groupe_votes
  FOR SELECT TO public USING (true);
CREATE POLICY "auth_insert_groupe_votes" ON public.groupe_votes
  FOR INSERT TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM public.groupe_membres WHERE groupe_id = groupe_votes.groupe_id AND user_id = auth.uid())
  );
CREATE POLICY "auth_update_own_groupe_votes" ON public.groupe_votes
  FOR UPDATE TO authenticated USING (auth.uid() = lance_par);
CREATE POLICY "auth_delete_own_groupe_votes" ON public.groupe_votes
  FOR DELETE TO authenticated USING (auth.uid() = lance_par);

CREATE POLICY "public_read_groupe_vote_options" ON public.groupe_vote_options
  FOR SELECT TO public USING (true);
CREATE POLICY "auth_insert_groupe_vote_options" ON public.groupe_vote_options
  FOR INSERT TO authenticated WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.groupe_votes
      WHERE groupe_votes.id = groupe_vote_options.vote_id
      AND EXISTS (
        SELECT 1 FROM public.groupe_membres
        WHERE groupe_membres.groupe_id = groupe_votes.groupe_id
        AND groupe_membres.user_id = auth.uid()
      )
    )
  );

CREATE POLICY "public_read_groupe_vote_choix" ON public.groupe_vote_choix
  FOR SELECT TO public USING (true);
CREATE POLICY "auth_insert_groupe_vote_choix" ON public.groupe_vote_choix
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = membre_id);
CREATE POLICY "auth_delete_own_groupe_vote_choix" ON public.groupe_vote_choix
  FOR DELETE TO authenticated USING (auth.uid() = membre_id);

-- ── A8. carnet_kit_items ──
DROP POLICY IF EXISTS "Allow public all" ON public.carnet_kit_items;
CREATE POLICY "public_read_carnet_kit_items" ON public.carnet_kit_items
  FOR SELECT TO public USING (true);
CREATE POLICY "auth_manage_carnet_kit_items" ON public.carnet_kit_items
  FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.carnets WHERE carnets.id = carnet_kit_items.carnet_id AND carnets.author_id = auth.uid())
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.carnets WHERE carnets.id = carnet_kit_items.carnet_id AND carnets.author_id = auth.uid())
  );

-- ── A9. carnet_moments ──
DROP POLICY IF EXISTS "Allow public all" ON public.carnet_moments;
CREATE POLICY "public_read_carnet_moments" ON public.carnet_moments
  FOR SELECT TO public USING (true);
CREATE POLICY "auth_manage_carnet_moments" ON public.carnet_moments
  FOR ALL TO authenticated
  USING (auth.uid() = auteur_id)
  WITH CHECK (auth.uid() = auteur_id);


-- ── PART B: P1 — Fix authenticated full CRUD without ownership checks ──
-- These policies require any logged-in user, which is much better than public
-- access, but still allows any registered user to modify any data.

-- ── B1. badges ──
DROP POLICY IF EXISTS "auth_manage_badges" ON public.badges;
CREATE POLICY "admin_manage_badges" ON public.badges
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());
-- public_read_badges already exists

-- ── B2. challenges ──
DROP POLICY IF EXISTS "auth_manage_challenges" ON public.challenges;
CREATE POLICY "admin_manage_challenges" ON public.challenges
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());
-- public_read_challenges already exists

-- ── B3. clubs ──
-- clubs_manage gives ALL to any authenticated. Replace with owner/admin policies.
-- auth_insert_clubs already checks created_by = auth.uid() — keep it.
DROP POLICY IF EXISTS "clubs_manage" ON public.clubs;
CREATE POLICY "auth_update_clubs" ON public.clubs
  FOR UPDATE TO authenticated
  USING (auth.uid() = created_by OR public.is_admin());
CREATE POLICY "auth_delete_clubs" ON public.clubs
  FOR DELETE TO authenticated
  USING (auth.uid() = created_by OR public.is_admin());
-- clubs_read / public_read_clubs already exist

-- ── B4. kits ──
DROP POLICY IF EXISTS "auth_manage_kits" ON public.kits;
CREATE POLICY "admin_manage_kits" ON public.kits
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());
-- public_read_kits already exists

-- ── B5. loyalty_rewards ──
DROP POLICY IF EXISTS "auth_manage_loyalty_rewards" ON public.loyalty_rewards;
CREATE POLICY "admin_manage_loyalty_rewards" ON public.loyalty_rewards
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());
-- public_read_loyalty_rewards already exists

-- ── B6. product_alternatives ──
DROP POLICY IF EXISTS "auth_admin_write_alternatives" ON public.product_alternatives;
CREATE POLICY "admin_write_alternatives" ON public.product_alternatives
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());
-- public_read_alternatives already exists

-- ── B7. product_compatibilities ──
DROP POLICY IF EXISTS "auth_admin_write_compatibilities" ON public.product_compatibilities;
CREATE POLICY "admin_write_compatibilities" ON public.product_compatibilities
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());
-- public_read_compatibilities already exists

-- ── B8. product_images ──
DROP POLICY IF EXISTS "auth_manage_product_images" ON public.product_images;
CREATE POLICY "admin_manage_product_images" ON public.product_images
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());
-- public_read_product_images already exists

-- ── B9. stock_movements ──
DROP POLICY IF EXISTS "system_insert_stock_movements" ON public.stock_movements;
CREATE POLICY "admin_insert_stock_movements" ON public.stock_movements
  FOR INSERT TO authenticated
  WITH CHECK (public.is_admin());
-- public_read_stock_movements already exists

-- ── B10. admin_audit_logs ──
DROP POLICY IF EXISTS "admin_insert_audit_logs" ON public.admin_audit_logs;
DROP POLICY IF EXISTS "admin_read_audit_logs" ON public.admin_audit_logs;
CREATE POLICY "admin_insert_audit_logs" ON public.admin_audit_logs
  FOR INSERT TO authenticated
  WITH CHECK (public.is_admin());
CREATE POLICY "admin_read_audit_logs" ON public.admin_audit_logs
  FOR SELECT TO authenticated
  USING (public.is_admin());

-- ── B11. club_challenges ──
DROP POLICY IF EXISTS "auth_insert_club_challenges" ON public.club_challenges;
CREATE POLICY "auth_insert_club_challenges" ON public.club_challenges
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.club_members
      WHERE club_members.club_id = club_challenges.club_id
      AND club_members.user_id = auth.uid()
    )
    OR public.is_admin()
  );
-- public_read_club_challenges already exists
