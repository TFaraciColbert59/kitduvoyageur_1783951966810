\set ON_ERROR_STOP on
insert into auth.users(id,email_confirmed_at) values
 ('10000000-0000-4000-8000-000000000001',now()),('10000000-0000-4000-8000-000000000002',now()),('10000000-0000-4000-8000-000000000003',now()),('10000000-0000-4000-8000-000000000004',null),('10000000-0000-4000-8000-000000000005',now());
insert into public.marketplace_test_roles values('10000000-0000-4000-8000-000000000005',true);
insert into public.product_ownership(id,user_id,name,listing_mode,serial_number,location,description) values ('20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','Compass','vente','SECRET-SERIAL','Secret exact address','Private journal'),('20000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000001','Tent','pret',null,null,null);
set role authenticated;
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000001',false);
select (public.marketplace_publish('20000000-0000-4000-8000-000000000001','Public compass description','Paris',2000,0)).id as sale_listing \gset
select (public.marketplace_publish('20000000-0000-4000-8000-000000000002','Public tent description','Lyon',0,10000)).id as loan_listing \gset
reset role;
set role anon;
do $$ declare j jsonb;begin select * into j from public.marketplace_list('vente',false); if j ? 'item_id' or j::text like '%SECRET%' or j::text like '%Private journal%' or j::text like '%Secret exact%' then raise exception 'Public privacy failure';end if;
 begin perform public.marketplace_request((j->>'id')::uuid,null,null);raise exception 'Anon request accepted';exception when insufficient_privilege then null;end;
end $$;
reset role;
set role authenticated;
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000004',false);
do $$ declare l uuid;begin select id into l from public.marketplace_listings; -- no own listings under RLS
 begin perform public.marketplace_request((select (j->>'id')::uuid from public.marketplace_list('vente',false) j limit 1));raise exception 'Unconfirmed accepted';exception when insufficient_privilege then null;end;end $$;
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000002',false);
select (public.marketplace_request(:'sale_listing')).id as sale_transaction \gset
select (public.marketplace_request(:'loan_listing',current_date,current_date+7)).id as loan_transaction \gset
-- A buyer cannot review before completion, accept their request, or mutate participants.
do $$ declare t uuid;begin select id into t from public.marketplace_transactions where mode='vente';
 begin perform public.marketplace_review(t,5,'Too early review');raise exception 'Premature review accepted';exception when sqlstate 'PT409' then null;end;
 begin perform public.marketplace_transaction_action(t,'accept');raise exception 'Buyer accepted';exception when sqlstate 'PT409' then null;end;
 begin update public.marketplace_transactions set owner_id=auth.uid() where id=t;raise exception 'Participant mutated';exception when insufficient_privilege then null;end;
end $$;
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000003',false);
do $$ begin if exists(select 1 from public.marketplace_transactions) then raise exception 'Nonparticipant sees transactions';end if;end $$;
select (public.marketplace_request(:'sale_listing')).id as other_request \gset
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000001',false);
select public.marketplace_transaction_action(:'sale_transaction','accept');
do $$ begin
 begin update public.product_ownership set name='Injected edit' where id='20000000-0000-4000-8000-000000000001';raise exception 'Committed edit accepted';exception when sqlstate 'PT409' then null;end;
 begin delete from public.product_ownership where id='20000000-0000-4000-8000-000000000001';raise exception 'Committed deletion accepted';exception when sqlstate 'PT409' then null;end;
 begin perform public.transition_inventory_item('20000000-0000-4000-8000-000000000001','vendu','en_stock');raise exception 'Committed manual transition accepted';exception when sqlstate 'PT409' then null;end;
end $$;
select public.marketplace_transaction_action(:'sale_transaction','handover',null,'MANUAL-CODE');
do $$ begin if not exists(select 1 from public.product_ownership where id='20000000-0000-4000-8000-000000000001' and status='vendu') then raise exception 'Sale handover did not mark sold';end if;end $$;
select public.marketplace_transaction_action(:'loan_transaction','accept');
select public.marketplace_transaction_action(:'loan_transaction','handover');
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000002',false);
select public.marketplace_transaction_action(:'sale_transaction','receive');
select public.marketplace_review(:'sale_transaction',5,'Manual handover completed');
do $$ declare t uuid;begin select id into t from public.marketplace_transactions where mode='vente' and status='completed';begin perform public.marketplace_review(t,5,'Duplicate review');raise exception 'Duplicate allowed';exception when sqlstate 'PT409' then null;end;end $$;
select public.marketplace_transaction_action(:'loan_transaction','dispute','Tent return needs independent discussion');
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000001',false);
do $$ begin if not exists(select 1 from public.product_ownership where id='20000000-0000-4000-8000-000000000002' and status='en_pret') then raise exception 'Dispute released item';end if;
 begin update public.product_ownership set name='Changed' where id='20000000-0000-4000-8000-000000000002';raise exception 'Dispute edit accepted';exception when sqlstate 'PT409' then null;end;
end $$;
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000003',false);
select public.marketplace_report(:'loan_listing','Potentially misleading description');
do $$ declare l uuid;begin select (j->>'id')::uuid into l from public.marketplace_list('pret',false) j; -- committed listing absent
 if l is not null then raise exception 'Committed listing still discoverable';end if;
 if (public.marketplace_moderation()->>'can_moderate')::boolean then raise exception 'User can moderate';end if;
 begin perform public.marketplace_moderate('hide','00000000-0000-4000-8000-000000000000',null,null,'Unauthorized role claim');raise exception 'User moderation accepted';exception when insufficient_privilege then null;end;
end $$;
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000005',false);
select public.marketplace_moderate('resolve_dispute',null,:'loan_transaction',null,'Returned tent verified manually by moderator','completed');
reset role;
do $$ begin
 if not exists(select 1 from public.product_ownership where id='20000000-0000-4000-8000-000000000002' and status='en_stock') then raise exception 'Resolution did not release tent';end if;
 if not exists(select 1 from public.marketplace_reports where transaction_id is not null and status='resolved' and resolution_note is not null) then raise exception 'Missing durable resolution';end if;
 if (select count(*) from public.marketplace_events)<8 then raise exception 'Missing audit';end if;
end $$;
-- Published consent does not allow selling a later multi-unit inventory row.
insert into public.product_ownership(id,user_id,name,listing_mode) values('20000000-0000-4000-8000-000000000004','10000000-0000-4000-8000-000000000001','Quantity regression','vente');
set role authenticated;
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000001',false);
select (public.marketplace_publish('20000000-0000-4000-8000-000000000004','Single compass consent','Paris',1000,0)).id as quantity_listing \gset
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000002',false);
select (public.marketplace_request(:'quantity_listing')).id as quantity_transaction \gset
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000001',false);
update public.product_ownership set quantity=2 where id='20000000-0000-4000-8000-000000000004';
do $$ declare t uuid;begin select id into t from public.marketplace_transactions where item_id='20000000-0000-4000-8000-000000000004';begin perform public.marketplace_transaction_action(t,'accept');raise exception 'Multi-unit row accepted';exception when sqlstate 'PT409' then null;end;end $$;
reset role;
-- A moderator hide cannot be laundered through withdraw -> publish by the owner.
set role authenticated;
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000005',false);
select public.marketplace_listing_action(:'quantity_listing','hide');
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000001',false);
do $$ declare l uuid;begin select id into l from public.marketplace_listings where item_id='20000000-0000-4000-8000-000000000004';begin perform public.marketplace_listing_action(l,'withdraw');raise exception 'Moderation hide bypassed';exception when insufficient_privilege then null;end;begin perform public.marketplace_listing_action(l,'publish');raise exception 'Hidden listing republished';exception when insufficient_privilege then null;end;end $$;
reset role;
set role authenticated;
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000001',false);
update public.product_ownership set quantity=1 where id='20000000-0000-4000-8000-000000000004';
do $$ begin
 begin perform public.marketplace_publish('20000000-0000-4000-8000-000000000004','Bypass via a fresh listing','Paris',1000,0);raise exception 'Hidden item bypass via new listing';exception when sqlstate 'PT409' then null;end;
end $$;
reset role;
set role authenticated;
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000005',false);
select public.marketplace_moderate('hide',:'quantity_listing',null,null,'Listing violates the marketplace rules');
reset role;
do $$ begin if not exists(select 1 from public.marketplace_listing_events where action='hide_decision' and actor_id='10000000-0000-4000-8000-000000000005' and note='Listing violates the marketplace rules') then raise exception 'Moderation decision not persisted';end if;end $$;
set role authenticated;
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000001',false);
do $$ declare l uuid;begin select id into l from public.marketplace_listings where item_id='20000000-0000-4000-8000-000000000004';begin perform public.marketplace_listing_action(l,null);raise exception 'NULL action bypassed moderation';exception when check_violation then null;end;end $$;
reset role;
-- Database quotas remain effective when callers bypass the HTTP rate limiter.
insert into auth.users(id,email_confirmed_at) values('10000000-0000-4000-8000-000000000006',now()),('10000000-0000-4000-8000-000000000007',now());
insert into public.product_ownership(id,user_id,name,listing_mode) select ('30000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,'10000000-0000-4000-8000-000000000006','Quota compass '||n,'vente' from generate_series(1,21) n;
set role authenticated;
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000006',false);
do $$ declare n integer;begin for n in 1..20 loop perform public.marketplace_publish(('30000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,'Public quota test compass','Paris',1000,0);end loop;
 begin perform public.marketplace_publish('30000000-0000-4000-8000-000000000021','Beyond publication quota','Paris',1000,0);raise exception 'Publication quota absent';exception when sqlstate 'PT429' then null;end;end $$;
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000003',false);
do $$ declare l uuid;begin for l in select (j->>'id')::uuid from public.marketplace_list('vente',false) j where j->>'name' like 'Quota compass %' limit 9 loop perform public.marketplace_report(l,'Durable report quota test');end loop;
 select (j->>'id')::uuid into l from public.marketplace_list('vente',false) j where j->>'name'='Quota compass 20';
 begin perform public.marketplace_report(l,'Beyond the report quota');raise exception 'Report quota absent';exception when sqlstate 'PT429' then null;end;end $$;
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000007',false);
do $$ declare l uuid;begin for l in select (j->>'id')::uuid from public.marketplace_list('vente',false) j where j->>'name' like 'Quota compass %' limit 20 loop perform public.marketplace_request(l);end loop;
 select (j->>'id')::uuid into l from public.marketplace_list('vente',false) j where j->>'name'='Quota compass 20';
 begin perform public.marketplace_request(l);raise exception 'Request quota absent';exception when sqlstate 'PT429' then null;end;end $$;
reset role;
