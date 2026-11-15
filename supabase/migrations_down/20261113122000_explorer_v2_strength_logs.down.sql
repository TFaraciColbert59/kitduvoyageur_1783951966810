-- Rollback de 20261113122000_explorer_v2_strength_logs.
--
-- ATTENTION : ce rollback supprime les carnets de musculation serveur, y
-- compris leurs exercices et séries. Il ne touche aucune table d'activité.
-- Exporter les carnets avant exécution si leur conservation est nécessaire.
-- Les brouillons conservés dans le `localStorage` de chaque appareil ne sont
-- pas supprimés par ce fichier.

begin;

drop function if exists public.delete_strength_log(text);
drop function if exists public.read_strength_log(text);
drop function if exists public.sync_strength_log(jsonb, uuid);

drop table if exists public.strength_sets cascade;
drop table if exists public.strength_exercises cascade;
drop table if exists public.strength_logs cascade;

commit;
