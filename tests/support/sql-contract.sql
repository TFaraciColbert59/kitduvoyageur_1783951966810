set role authenticated;
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000001',false);
select (public.create_support_ticket('compte','A durable support request')).id as ticket_id \gset
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000002',false);
do $$ begin if exists(select 1 from public.support_tickets) then raise exception 'Support privacy violation'; end if;
 begin perform public.respond_support_ticket((select id from public.support_tickets limit 1),'resolved','Bad');raise exception 'Unauthorized reply';exception when insufficient_privilege then null;end;
end $$;
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000004',false);
do $$ begin begin perform public.create_support_ticket('autre','Unconfirmed message');raise exception 'Unconfirmed accepted';exception when insufficient_privilege then null;end;end $$;
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000005',false);
select public.respond_support_ticket(:'ticket_id','resolved','Persisted admin response');
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000001',false);
do $$ begin
 if not exists(select 1 from public.support_tickets where status='resolved' and response='Persisted admin response') then raise exception 'Response not persisted';end if;
 for i in 1..4 loop perform public.create_support_ticket('autre','Rate limit request');end loop;
 begin perform public.create_support_ticket('autre','The sixth request');raise exception 'Rate cap missing';exception when sqlstate 'PT429' then null;end;
 begin update public.support_tickets set status='resolved';raise exception 'Direct write allowed';exception when insufficient_privilege then null;end;
end $$;
reset role;
