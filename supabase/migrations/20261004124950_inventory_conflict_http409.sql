-- A stale expected status is a permanent business conflict, not a retryable
-- PostgreSQL serialization failure. PT409 makes PostgREST return HTTP 409
-- immediately instead of retrying the same impossible expectation.
create or replace function public.transition_inventory_item(p_id uuid,p_status text,p_expected_status text) returns public.product_ownership language plpgsql security invoker set search_path=public as $$
declare v public.product_ownership;
begin
 select * into v from public.product_ownership where id=p_id and user_id=auth.uid() for update;
 if not found then raise exception 'Objet introuvable' using errcode='P0002'; end if;
 if v.status<>p_expected_status then raise exception 'Le statut a changé, actualisez' using errcode='PT409'; end if;
 if v.status=p_status then raise exception 'Statut identique' using errcode='23514'; end if;
 if v.status='en_pret' and p_status='en_stock' then return public.return_inventory_item(p_id); end if;
 update public.product_ownership set status=p_status where id=p_id returning * into v;
 return v;
end $$;
