-- ============================================================================
-- DOWN — 20261010140000_phase1_balance_lockdown
--   • garde colonnes v1 restaurée (corps exact de 20260911551000,
--     lignes 23-68 + trigger) ;
--   • policies d'écriture legacy recréées (auth_insert_loyalty_history,
--     auth_insert_loyalty_redemptions, users_manage_own_orders) ;
--   • policy orders_select_own supprimée ;
--   • grants tables restaurés (INSERT/UPDATE/DELETE anon, authenticated) ;
--   • 8 fonctions Phase 1 supprimées + déclencheur de confirmation virement ;
--   • lignes d'ouverture 'opening:%' supprimées.
-- INTERDIT de toucher public.user_profiles (ni données ni structure).
-- ============================================================================

-- 1. Garde colonnes v1 (corps exact 20260911551000_phase8_user_profile_privileged_columns.sql)
CREATE OR REPLACE FUNCTION public.guard_user_profile_privileged_columns()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  privileged_change boolean := false;
BEGIN
  -- Rôles système : service_role, postgres, migrations, triggers auth.
  -- `auth.role()` lit le claim JWT (PostgREST) ; hors requête HTTP (migrations,
  -- service_role), il vaut NULL et le garde-fou laisse passer.
  IF auth.role() IS NULL OR auth.role() NOT IN ('authenticated', 'anon') THEN
    RETURN NEW;
  END IF;

  -- Un administrateur existant conserve ses pouvoirs.
  IF TG_OP = 'UPDATE' AND public.is_admin() THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    privileged_change :=
      NEW.role IS DISTINCT FROM 'user'
      OR NEW.trust_score IS DISTINCT FROM 50
      OR NEW.is_suspended_groups IS DISTINCT FROM false
      OR NEW.suspended_from_groups_at IS NOT NULL
      OR NEW.two_fa_enabled IS DISTINCT FROM false;
  ELSE
    privileged_change :=
      NEW.role IS DISTINCT FROM OLD.role
      OR NEW.trust_score IS DISTINCT FROM OLD.trust_score
      OR NEW.is_suspended_groups IS DISTINCT FROM OLD.is_suspended_groups
      OR NEW.suspended_from_groups_at IS DISTINCT FROM OLD.suspended_from_groups_at
      OR NEW.two_fa_enabled IS DISTINCT FROM OLD.two_fa_enabled
      OR NEW.email IS DISTINCT FROM OLD.email;
  END IF;

  IF privileged_change THEN
    RAISE EXCEPTION 'user_profiles: colonne de privilège protégée (role, trust_score, suspension, 2FA, email)'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS guard_user_profile_privileged_columns ON public.user_profiles;
CREATE TRIGGER guard_user_profile_privileged_columns
  BEFORE INSERT OR UPDATE ON public.user_profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.guard_user_profile_privileged_columns();

-- 2. Policies d'écriture legacy recréées
DROP POLICY IF EXISTS "auth_insert_loyalty_history" ON public.loyalty_history;
CREATE POLICY "auth_insert_loyalty_history"
  ON public.loyalty_history FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "auth_insert_loyalty_redemptions" ON public.loyalty_redemptions;
CREATE POLICY "auth_insert_loyalty_redemptions"
  ON public.loyalty_redemptions FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "users_manage_own_orders" ON public.orders;
CREATE POLICY "users_manage_own_orders"
  ON public.orders FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "orders_select_own" ON public.orders;

-- 3. Grants tables restaurés
GRANT INSERT, UPDATE, DELETE ON public.loyalty_history TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.loyalty_redemptions TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.orders TO anon, authenticated;

-- 4. Fonctions Phase 1 supprimées
DROP TRIGGER IF EXISTS trigger_process_pending_order_points ON public.orders;
DROP FUNCTION IF EXISTS public.process_pending_order_points();
DROP FUNCTION IF EXISTS public.create_shop_order(uuid, text, jsonb, jsonb, text);
DROP FUNCTION IF EXISTS public.legacy_loyalty_redeem(uuid, uuid);
DROP FUNCTION IF EXISTS public.legacy_loyalty_cart_refund(uuid, text);
DROP FUNCTION IF EXISTS public.legacy_loyalty_earn(uuid, integer, text, text, text);
DROP FUNCTION IF EXISTS public.legacy_loyalty_spend(uuid, integer, text, text);
DROP FUNCTION IF EXISTS public.legacy_loyalty_level_for(integer);
DROP FUNCTION IF EXISTS public.legacy_loyalty_backfill_openings(text);

-- 5. Lignes d'ouverture supprimées
DELETE FROM public.loyalty_history
WHERE type = 'opening_balance'
  AND source_id LIKE 'opening:%';
