-- Rollback de la configuration privée des zones et seuils (S2.10–S2.12).
-- La table ne contient que des configurations saisies par leur propriétaire ;
-- sa suppression est donc un retour arrière complet, sans donnée partagée.
begin;

drop function if exists public.save_activity_zone_config(
  text, text, text, text, text, text, text, numeric, text, text, timestamptz, timestamptz, timestamptz, jsonb
);

drop table if exists public.activity_zone_configs;

commit;
