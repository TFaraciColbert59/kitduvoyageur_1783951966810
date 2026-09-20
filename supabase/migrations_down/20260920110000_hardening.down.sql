-- Rollback 20260920110000 — retire les outils et index ajoutés par le durcissement.
-- Les corps de fonctions remplacés (attribution, classement) restent les versions
-- durcies : un rollback ne réintroduit pas les défauts corrigés.
DROP FUNCTION IF EXISTS public.replay_dead_progression_outbox(integer);
DROP FUNCTION IF EXISTS public.purge_progression_outbox(integer);
DROP FUNCTION IF EXISTS public.leaderboard_alias(uuid, text, text, text);
DROP INDEX IF EXISTS public.progression_outbox_processed_idx;
DROP INDEX IF EXISTS public.progression_outbox_pending_idx;
ALTER TABLE IF EXISTS public.user_territory DROP CONSTRAINT IF EXISTS chk_user_territory_codes;
