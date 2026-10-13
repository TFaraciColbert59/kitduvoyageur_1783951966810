-- ═══════════════════════════════════════════════════════════════════════════
-- MIGRATION: alignement — trigger updated_at manquant sur trajectoire_plans
-- (hotfix déployé 20260930172358 sans le trigger). Idempotent.
-- ═══════════════════════════════════════════════════════════════════════════

DROP TRIGGER IF EXISTS trg_trajectoire_plans_updated_at ON public.trajectoire_plans;
CREATE TRIGGER trg_trajectoire_plans_updated_at
  BEFORE UPDATE ON public.trajectoire_plans
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
