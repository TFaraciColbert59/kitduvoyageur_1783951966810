-- Rollback de S6.15 — stockage des choix de visibilité par métrique.
-- Version : 20261113121000.
--
-- La table ne contient que des booléens de partage. Sa suppression ne détruit
-- aucune trace, aucune métrique et aucune donnée de santé. On refuse toutefois
-- de la retirer si des choix réels existent : le propriétaire doit d'abord
-- réinitialiser ses réglages, afin qu'un rollback ne fasse pas disparaître
-- silencieusement une décision de confidentialité.
do $$
declare
  v_count bigint;
begin
  if to_regclass('public.outing_share_metrics') is not null then
    execute 'select count(*) from public.outing_share_metrics' into v_count;
    if v_count > 0 then
      raise exception 'Rollback refusé : public.outing_share_metrics contient des choix réels. Réinitialiser les réglages avant de retirer la fonctionnalité (S6.15).';
    end if;
  end if;
end $$;

-- La table emporte ses policies et ses triggers. On ne les supprime pas
-- séparément : un second passage du rollback resterait sinon bloqué par
-- l'absence de la table.
drop table if exists public.outing_share_metrics;

drop function if exists public.outing_share_metrics_guard();
drop function if exists public.outing_metric_visibility_is_valid(jsonb);
