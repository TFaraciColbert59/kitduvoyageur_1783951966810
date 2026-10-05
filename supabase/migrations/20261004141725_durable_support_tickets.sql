-- Support requests are durable private records, never simulated email delivery.
create table public.support_tickets (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 subject text not null check(subject in ('commande','retour','produit','compte','partenariat','autre')),
 message text not null check(char_length(btrim(message)) between 10 and 5000),
 status text not null default 'open' check(status in ('open','in_progress','resolved')),
 response text check(char_length(response)<=5000),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
alter table public.support_tickets enable row level security;
create policy support_tickets_read on public.support_tickets for select to authenticated using(user_id=(select auth.uid()) or public.is_admin());
revoke all on public.support_tickets from anon,authenticated;
grant select on public.support_tickets to authenticated;
create index support_tickets_owner_created on public.support_tickets(user_id,created_at desc);
create or replace function public.create_support_ticket(p_subject text,p_message text) returns public.support_tickets
language plpgsql security definer set search_path=pg_catalog,public as $$
declare v public.support_tickets; actor uuid:=auth.uid();
begin
 if actor is null or not exists(select 1 from auth.users where id=actor and email_confirmed_at is not null and coalesce(is_anonymous,false)=false) then raise exception 'Connectez-vous avec un email confirmé' using errcode='42501'; end if;
 perform pg_advisory_xact_lock(hashtextextended('support:'||actor::text,0));
 if (select count(*) from public.support_tickets where user_id=actor and created_at>now()-interval '1 hour')>=5 then raise exception 'Trop de demandes : réessayez plus tard' using errcode='PT429'; end if;
 insert into public.support_tickets(user_id,subject,message) values(actor,p_subject,btrim(p_message)) returning * into v;
 return v;
end $$;
create or replace function public.respond_support_ticket(p_id uuid,p_status text,p_response text) returns public.support_tickets
language plpgsql security definer set search_path=pg_catalog,public as $$
declare v public.support_tickets;
begin
 if auth.uid() is null or not public.is_admin() then raise exception 'Accès interdit' using errcode='42501'; end if;
 if p_status is null or p_response is null or p_status not in ('open','in_progress','resolved') or char_length(btrim(p_response)) not between 1 and 5000 then raise exception 'Réponse invalide' using errcode='22023'; end if;
 update public.support_tickets set status=p_status,response=btrim(p_response),updated_at=now() where id=p_id returning * into v;
 if not found then raise exception 'Demande introuvable' using errcode='P0002'; end if;
 return v;
end $$;
revoke all on function public.create_support_ticket(text,text),public.respond_support_ticket(uuid,text,text) from public,anon;
grant execute on function public.create_support_ticket(text,text),public.respond_support_ticket(uuid,text,text) to authenticated;
