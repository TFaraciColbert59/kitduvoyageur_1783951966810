-- Material edits cancel outstanding consent, even if the same listing is republished.
insert into auth.users(id,email_confirmed_at) values ('40000000-0000-4000-8000-000000000001',now()),('40000000-0000-4000-8000-000000000002',now());
insert into public.product_ownership(id,user_id,name,condition,listing_mode) values ('40000000-0000-4000-8000-000000000003','40000000-0000-4000-8000-000000000001','Original compass','bon','vente');
set role authenticated;
select set_config('request.jwt.claim.sub','40000000-0000-4000-8000-000000000001',false);
select (public.marketplace_publish('40000000-0000-4000-8000-000000000003','Public compass description','Paris',1000,0)).id as obsolete_listing \gset
select set_config('request.jwt.claim.sub','40000000-0000-4000-8000-000000000002',false);
select (public.marketplace_request(:'obsolete_listing')).id as obsolete_transaction \gset
select set_config('request.jwt.claim.sub','40000000-0000-4000-8000-000000000001',false);
update public.product_ownership set name='Damaged compass',condition='pour_pieces' where id='40000000-0000-4000-8000-000000000003';
select public.marketplace_listing_action(:'obsolete_listing','publish');
do $$ declare t public.marketplace_transactions;begin
 select * into t from public.marketplace_transactions where item_id='40000000-0000-4000-8000-000000000003';
 if t.status<>'cancelled' then raise exception 'Obsolete request survived material edit and republication';end if;
 if not exists(select 1 from public.marketplace_events where transaction_id=t.id and action='cancel' and actor_id='40000000-0000-4000-8000-000000000001' and note is not null) then raise exception 'Obsolete consent cancellation missing durable audit';end if;
 begin perform public.marketplace_transaction_action(t.id,'accept');raise exception 'Obsolete agreement accepted';exception when sqlstate 'PT409' then null;end;
end $$;
reset role;
