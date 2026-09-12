-- ============================================================================
-- PHASE 8 — Escalade verticale via `user_profiles` : garde-fou ADDITIF
-- ============================================================================
-- Constat (revue RLS Phase 8) : la politique `users_manage_own_profiles`
-- (FOR ALL, USING id = auth.uid()) autorise chaque utilisateur connecté à
-- modifier n'importe quelle colonne de SA ligne, y compris `role`, `trust_score`
-- ou l'état de suspension. Or :
--   • `public.is_admin()` lit `user_profiles.role = 'admin'` → auto-promotion ;
--   • la lecture de `moderation_queue` est ouverte à `trust_score >= 80`
--     → auto-élévation de réputation ;
--   • `suspended_from_groups_at` / `is_suspended_groups` portent l'état de
--     modération.
--
-- Correctif : trigger BEFORE INSERT OR UPDATE qui refuse ces colonnes de
-- privilège pour les rôles `authenticated`/`anon`, sauf admin existant.
-- Les rôles système (`service_role`, postgres, migrations) ne sont jamais
-- bloqués. Aucune donnée n'est réécrite ; les colonnes de gamification
-- (`loyalty_points`, `xp`, `level`) restent modifiables par leur propriétaire
-- (dette produit existante, documentée en Phase 8 — non un vecteur d'accès
-- inter-utilisateurs ni admin).
-- ============================================================================

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

-- ----------------------------------------------------------------------------
-- `is_admin()` : SECURITY INVOKER → SECURITY DEFINER avec search_path verrouillé.
-- Constat : appelée depuis une policy de `user_profiles` (elle-même évaluée par
-- la policy `user_profiles_select_admin`), la version INVOKER reboucle sur la
-- policy et épuise la pile dès qu'une requête non-admin la traverse (ex. la
-- policy `comment_reports_select_own_or_moderator`). La passer DEFINER (owner
-- postgres, search_path figé) supprime la récursion sans changer la sémantique :
-- elle ne lit que `role = 'admin'` pour `auth.uid()`.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_profiles
    WHERE id = auth.uid()
      AND role = 'admin'
  );
$$;

REVOKE ALL ON FUNCTION public.is_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_admin() TO anon, authenticated, service_role;
