-- Rollback de 20261113120000_gear_mileage_alerts.
--
-- Retour arrière de sécurité : les quatre tables du lot sont supprimées et les
-- deux colonnes ajoutées à `hike_session_gear` sont retirées. Les backfills de
-- lien et de sport sont donc perdus, mais aucune autre donnée n'est touchée.
-- À exécuter uniquement après avoir arrêté les écritures du lot D04.

begin;

drop table if exists public.gear_sport_defaults cascade;
drop table if exists public.gear_components cascade;
drop table if exists public.gear_alert_history cascade;
drop table if exists public.gear_mileage_settings cascade;

drop index if exists public.hike_session_gear_gear_item_idx;

alter table public.hike_session_gear
  drop column if exists sport,
  drop column if exists gear_item_id;

commit;
