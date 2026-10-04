-- Public consent snapshots, private manual agreements. No payment provider integration.
create schema if not exists marketplace_private;
revoke all on schema marketplace_private from public,anon,authenticated;
create table public.marketplace_listings (
 id uuid primary key default gen_random_uuid(), item_id uuid not null references public.product_ownership(id) on delete restrict,
 owner_id uuid not null references auth.users(id) on delete restrict,
 name text not null,brand text,category text,condition text,photo_url text,
 mode text not null check(mode in ('vente','location','pret')),
 description text not null check(length(btrim(description)) between 10 and 2000),
 public_location text not null check(length(btrim(public_location)) between 2 and 100),
 price_cents integer not null check(price_cents between 0 and 100000000), deposit_cents integer not null default 0 check(deposit_cents between 0 and 100000000),
 status text not null default 'published' check(status in ('published','withdrawn','hidden')),created_at timestamptz not null default now(),
 check(mode<>'location' or price_cents>0),check(mode<>'pret' or price_cents=0)
);
create unique index marketplace_one_published on public.marketplace_listings(item_id) where status='published';
create table public.marketplace_transactions (
 id uuid primary key default gen_random_uuid(),listing_id uuid not null references public.marketplace_listings(id),item_id uuid not null references public.product_ownership(id),
 owner_id uuid not null references auth.users(id),buyer_id uuid not null references auth.users(id),mode text not null check(mode in ('vente','location','pret')),
 status text not null default 'requested' check(status in ('requested','accepted','active','return_pending','completed','cancelled','disputed')),
 listing_snapshot jsonb not null,price_cents integer not null,deposit_cents integer not null,start_date date,end_date date,tracking_code text,
 created_at timestamptz not null default now(),updated_at timestamptz not null default now(),check(owner_id<>buyer_id),
 check((start_date is null and end_date is null) or (start_date is not null and end_date>=start_date))
);
create unique index marketplace_one_commitment on public.marketplace_transactions(item_id) where status in ('accepted','active','return_pending','disputed');
create unique index marketplace_one_request on public.marketplace_transactions(listing_id,buyer_id) where status='requested';
create table public.marketplace_events (id uuid primary key default gen_random_uuid(),transaction_id uuid not null references public.marketplace_transactions(id),actor_id uuid not null references auth.users(id),action text not null,note text,created_at timestamptz not null default now());
create table public.marketplace_reviews (id uuid primary key default gen_random_uuid(),transaction_id uuid not null references public.marketplace_transactions(id),listing_id uuid not null references public.marketplace_listings(id),author_id uuid not null references auth.users(id),subject_id uuid not null references auth.users(id),rating integer not null check(rating between 1 and 5),comment text not null check(length(btrim(comment)) between 3 and 1000),created_at timestamptz not null default now(),unique(transaction_id,author_id));
create table public.marketplace_reports (id uuid primary key default gen_random_uuid(),listing_id uuid references public.marketplace_listings(id),transaction_id uuid references public.marketplace_transactions(id),reporter_id uuid not null references auth.users(id),reason text not null check(length(btrim(reason)) between 10 and 2000),status text not null default 'open' check(status in ('open','resolved')),resolution_note text,resolved_by uuid references auth.users(id),created_at timestamptz not null default now(),resolved_at timestamptz,check(listing_id is not null or transaction_id is not null));
create table public.marketplace_listing_events(id uuid primary key default gen_random_uuid(),listing_id uuid not null references public.marketplace_listings(id),actor_id uuid not null references auth.users(id),action text not null,note text,report_id uuid references public.marketplace_reports(id),created_at timestamptz not null default now());
alter table public.marketplace_listing_events enable row level security;
create policy marketplace_listing_events_access on public.marketplace_listing_events for select to authenticated using(public.is_admin() or public.is_moderateur() or exists(select 1 from public.marketplace_listings l where l.id=listing_id and l.owner_id=auth.uid()));
revoke all on public.marketplace_listing_events from anon,authenticated;
grant select on public.marketplace_listing_events to authenticated;
create unique index marketplace_one_open_report on public.marketplace_reports(listing_id,reporter_id) where status='open' and transaction_id is null;
create index marketplace_transactions_participants on public.marketplace_transactions(owner_id,buyer_id,created_at desc);
alter table public.marketplace_listings enable row level security;
alter table public.marketplace_transactions enable row level security;
alter table public.marketplace_events enable row level security;
alter table public.marketplace_reviews enable row level security;
alter table public.marketplace_reports enable row level security;
create policy marketplace_listing_owner on public.marketplace_listings for select to authenticated using(owner_id=(select auth.uid()));
create policy marketplace_transaction_participant on public.marketplace_transactions for select to authenticated using((select auth.uid()) in (owner_id,buyer_id) or public.is_admin() or public.is_moderateur());
create policy marketplace_event_participant on public.marketplace_events for select to authenticated using(exists(select 1 from public.marketplace_transactions t where t.id=transaction_id));
create policy marketplace_review_public on public.marketplace_reviews for select to anon,authenticated using(true);
create policy marketplace_report_access on public.marketplace_reports for select to authenticated using(reporter_id=(select auth.uid()) or public.is_admin() or public.is_moderateur());
revoke all on public.marketplace_listings,public.marketplace_transactions,public.marketplace_events,public.marketplace_reviews,public.marketplace_reports from anon,authenticated;
grant select on public.marketplace_listings,public.marketplace_transactions,public.marketplace_events,public.marketplace_reports to authenticated;
grant select on public.marketplace_reviews to anon,authenticated;

create function marketplace_private.require_user(p_confirmed boolean default false) returns uuid language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid();begin
 if u is null or not exists(select 1 from auth.users where id=u and not coalesce(is_anonymous,false)) then raise exception 'Connexion requise' using errcode='42501';end if;
 if p_confirmed and not exists(select 1 from auth.users where id=u and email_confirmed_at is not null) then raise exception 'Confirmez votre adresse e-mail' using errcode='42501';end if;
 return u;end $$;
create function marketplace_private.is_staff() returns boolean language sql security invoker set search_path='' as $$ select auth.uid() is not null and coalesce(public.is_admin() or public.is_moderateur(),false) $$;
create function marketplace_private.committed(p_item uuid) returns boolean language sql stable security definer set search_path='' as $$ select exists(select 1 from public.marketplace_transactions where item_id=p_item and status in ('accepted','active','return_pending','disputed')) $$;
-- Invoker identity distinguishes trusted SQL RPC writes from user inventory APIs; no spoofable session flags.
create function public.marketplace_inventory_guard() returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if current_user not in ('postgres','supabase_admin') and marketplace_private.committed(old.id) then raise exception 'Objet engagé dans une transaction' using errcode='PT409';end if;
 return case when TG_OP='DELETE' then old else new end;end $$;
-- Only boolean commitment lookup is callable; private schema is not exposed through PostgREST.
grant usage on schema marketplace_private to authenticated;
grant execute on function marketplace_private.committed(uuid) to authenticated;
create trigger a_marketplace_inventory_guard before update or delete on public.product_ownership for each row execute function public.marketplace_inventory_guard();
create function public.marketplace_loan_guard() returns trigger language plpgsql security definer set search_path='' as $$
begin if marketplace_private.committed(new.product_ownership_id) then raise exception 'Objet engagé dans une transaction' using errcode='PT409';end if;return new;end $$;
create trigger marketplace_loan_guard before insert or update on public.materiel_loans for each row execute function public.marketplace_loan_guard();

create function public.marketplace_list(p_mode text default null,p_mine boolean default false) returns setof jsonb language plpgsql security definer set search_path='' as $$
begin
 if p_mode is not null and p_mode not in ('vente','location','pret') then raise exception 'Mode invalide' using errcode='23514';end if;
 if p_mine then perform marketplace_private.require_user();end if;
 return query select case when p_mine then to_jsonb(l) else to_jsonb(l)-'item_id' end from public.marketplace_listings l
 where (p_mode is null or l.mode=p_mode) and ((p_mine and l.owner_id=auth.uid()) or (not p_mine and l.status='published' and not marketplace_private.committed(l.item_id) and exists(select 1 from public.product_ownership i where i.id=l.item_id and i.status in ('en_stock','a_louer','a_preter') and i.listing_mode=l.mode and i.quantity=1))) order by l.created_at desc limit 100;
end $$;
create function public.marketplace_publish(p_item_id uuid,p_description text,p_public_location text,p_price_cents integer,p_deposit_cents integer default 0) returns public.marketplace_listings language plpgsql security definer set search_path='' as $$
declare u uuid:=marketplace_private.require_user(true);i public.product_ownership;l public.marketplace_listings;
begin
 select * into i from public.product_ownership where id=p_item_id and user_id=u for update;
 if not found then raise exception 'Objet introuvable' using errcode='P0002';end if;
 if i.status not in ('en_stock','a_louer','a_preter') or i.listing_mode not in ('vente','location','pret') or i.quantity<>1 or marketplace_private.committed(i.id) then raise exception 'Objet indisponible; choisissez un objet unique et son mode' using errcode='PT409';end if;
 perform pg_advisory_xact_lock(hashtextextended(u::text,0));
 if (select count(*) from public.marketplace_listings where owner_id=u and created_at>now()-interval '1 day')>=20 then raise exception 'Quota quotidien atteint' using errcode='PT429';end if;
 if exists(select 1 from public.marketplace_listings where item_id=i.id and status in ('published','hidden')) then raise exception 'Annonce déjà publiée ou masquée par la modération' using errcode='PT409';end if;
 insert into public.marketplace_listings(item_id,owner_id,name,brand,category,condition,photo_url,mode,description,public_location,price_cents,deposit_cents) values(i.id,u,i.name,i.brand,i.category,i.condition,i.photo_url,i.listing_mode,p_description,p_public_location,p_price_cents,coalesce(p_deposit_cents,0)) returning * into l;return l;end $$;
create function public.marketplace_listing_action(p_id uuid,p_action text) returns public.marketplace_listings language plpgsql security definer set search_path='' as $$
declare u uuid:=marketplace_private.require_user();l public.marketplace_listings;i public.product_ownership;
begin
 select * into l from public.marketplace_listings where id=p_id;
 if not found then raise exception 'Annonce introuvable' using errcode='P0002';end if;
 select * into i from public.product_ownership where id=l.item_id for update;
 select * into l from public.marketplace_listings where id=p_id for update;
 if p_action is null or p_action not in ('hide','withdraw','publish') then raise exception 'Action invalide' using errcode='23514';end if;
 if p_action='hide' then if not marketplace_private.is_staff() then raise exception 'Modération requise' using errcode='42501';end if;
 elsif l.owner_id<>u then raise exception 'Action non autorisée' using errcode='42501';end if;
 if l.status='hidden' and p_action<>'hide' then raise exception 'Annonce masquée par la modération' using errcode='42501';end if;
 if p_action is null or p_action not in ('hide','withdraw','publish') then raise exception 'Action invalide' using errcode='23514';end if;
 if p_action='publish' then
 perform marketplace_private.require_user(true);
 if l.status='hidden' or i.status not in ('en_stock','a_louer','a_preter') or i.listing_mode<>l.mode or i.quantity<>1 or marketplace_private.committed(i.id) then raise exception 'Annonce indisponible' using errcode='PT409';end if;
 end if;
 update public.marketplace_listings set name=case when p_action='publish' then i.name else name end,brand=case when p_action='publish' then i.brand else brand end,category=case when p_action='publish' then i.category else category end,condition=case when p_action='publish' then i.condition else condition end,photo_url=case when p_action='publish' then i.photo_url else photo_url end,status=case p_action when 'publish' then 'published' when 'hide' then 'hidden' else 'withdrawn' end where id=p_id returning * into l;
 insert into public.marketplace_listing_events(listing_id,actor_id,action) values(l.id,u,p_action);return l;end $$;
create function public.marketplace_request(p_listing_id uuid,p_start_date date default null,p_end_date date default null) returns public.marketplace_transactions language plpgsql security definer set search_path='' as $$
declare u uuid:=marketplace_private.require_user(true);l public.marketplace_listings;i public.product_ownership;t public.marketplace_transactions;
begin
 select * into l from public.marketplace_listings where id=p_listing_id;
 if not found then raise exception 'Annonce introuvable' using errcode='P0002';end if;
 select * into i from public.product_ownership where id=l.item_id for update;
 select * into l from public.marketplace_listings where id=p_listing_id for update;
 if l.owner_id=u then raise exception 'Auto-demande interdite' using errcode='23514';end if;
 if l.status<>'published' or i.status not in ('en_stock','a_louer','a_preter') or i.listing_mode<>l.mode or i.quantity<>1 or marketplace_private.committed(i.id) then raise exception 'Annonce indisponible' using errcode='PT409';end if;
 if l.mode<>'vente' and (p_start_date is null or p_end_date is null or p_start_date<current_date or p_end_date<p_start_date) then raise exception 'Dates requises ou invalides' using errcode='23514';end if;
 perform pg_advisory_xact_lock(hashtextextended(u::text,0));
 if (select count(*) from public.marketplace_transactions where buyer_id=u and created_at>now()-interval '1 day')>=20 then raise exception 'Quota quotidien atteint' using errcode='PT429';end if;
 insert into public.marketplace_transactions(listing_id,item_id,owner_id,buyer_id,mode,listing_snapshot,price_cents,deposit_cents,start_date,end_date) values(l.id,l.item_id,l.owner_id,u,l.mode,to_jsonb(l)-'item_id',l.price_cents,l.deposit_cents,p_start_date,p_end_date) returning * into t;
 insert into public.marketplace_events(transaction_id,actor_id,action) values(t.id,u,'request');return t;end $$;
create function public.marketplace_transaction_action(p_id uuid,p_action text,p_note text default null,p_tracking_code text default null) returns public.marketplace_transactions language plpgsql security definer set search_path='' as $$
declare u uuid:=marketplace_private.require_user();t public.marketplace_transactions;i public.product_ownership;next_status text;
begin
 select * into t from public.marketplace_transactions where id=p_id and u in (owner_id,buyer_id);
 if not found then raise exception 'Transaction introuvable' using errcode='P0002';end if;
 -- Every lifecycle RPC locks inventory first, then transaction/listing: consistent order.
 select * into i from public.product_ownership where id=t.item_id for update;
 select * into t from public.marketplace_transactions where id=p_id for update;
 if length(coalesce(p_note,''))>2000 or length(coalesce(p_tracking_code,''))>100 then raise exception 'Texte trop long' using errcode='23514';end if;
 if p_action='accept' and u=t.owner_id and t.status='requested' then
 if marketplace_private.committed(i.id) or i.status not in ('en_stock','a_louer','a_preter') or i.listing_mode<>t.mode or i.quantity<>1 or not exists(select 1 from public.marketplace_listings where id=t.listing_id and status='published') then raise exception 'Objet indisponible' using errcode='PT409';end if;
 next_status:='accepted';
 elsif p_action='handover' and u=t.owner_id and t.status='accepted' then
 if i.quantity<>1 or i.listing_mode<>t.mode or i.status not in ('en_stock','a_louer','a_preter') then raise exception 'Objet indisponible' using errcode='PT409';end if;next_status:='active';
 elsif p_action='receive' and u=t.buyer_id and t.mode='vente' and t.status='active' then next_status:='completed';
 elsif p_action='return' and u=t.buyer_id and t.mode<>'vente' and t.status='active' then next_status:='return_pending';
 elsif p_action='complete_return' and u=t.owner_id and t.status='return_pending' then next_status:='completed';
 elsif p_action='cancel' and t.status in ('requested','accepted') then next_status:='cancelled';
 elsif p_action='dispute' and t.status in ('active','return_pending') then
 if length(btrim(coalesce(p_note,'')))<10 then raise exception 'Décrivez le litige' using errcode='23514';end if;next_status:='disputed';
 else raise exception 'Transition non autorisée' using errcode='PT409';end if;
 update public.marketplace_transactions set status=next_status,tracking_code=case when p_action='handover' then nullif(btrim(p_tracking_code),'') else tracking_code end,updated_at=now() where id=p_id returning * into t;
 if p_action='accept' then
 with cancelled as (update public.marketplace_transactions set status='cancelled',updated_at=now() where item_id=t.item_id and id<>t.id and status='requested' returning id) insert into public.marketplace_events(transaction_id,actor_id,action,note) select id,u,'cancel','Autre demande acceptée pour cet objet' from cancelled;
 elsif p_action='handover' then
 update public.product_ownership set status=case t.mode when 'vente' then 'vendu' when 'location' then 'en_location' else 'en_pret' end where id=t.item_id;
 if t.mode='vente' then update public.marketplace_listings set status='withdrawn' where item_id=t.item_id and status='published';end if;
 elsif p_action='complete_return' then update public.product_ownership set status='en_stock' where id=t.item_id;
 elsif p_action='dispute' then insert into public.marketplace_reports(listing_id,transaction_id,reporter_id,reason) values(t.listing_id,t.id,u,btrim(p_note));end if;
 insert into public.marketplace_events(transaction_id,actor_id,action,note) values(t.id,u,p_action,nullif(btrim(p_note),''));return t;end $$;
create function public.marketplace_review(p_transaction_id uuid,p_rating integer,p_comment text) returns public.marketplace_reviews language plpgsql security definer set search_path='' as $$
declare u uuid:=marketplace_private.require_user();t public.marketplace_transactions;r public.marketplace_reviews;
begin select * into t from public.marketplace_transactions where id=p_transaction_id and u in (owner_id,buyer_id) for update;
 if not found then raise exception 'Transaction introuvable' using errcode='P0002';end if;
 if t.status<>'completed' then raise exception 'Transaction non terminée' using errcode='PT409';end if;
 if exists(select 1 from public.marketplace_reviews where transaction_id=t.id and author_id=u) then raise exception 'Avis déjà enregistré' using errcode='PT409';end if;
 insert into public.marketplace_reviews(transaction_id,listing_id,author_id,subject_id,rating,comment) values(t.id,t.listing_id,u,case when u=t.owner_id then t.buyer_id else t.owner_id end,p_rating,btrim(p_comment)) returning * into r;return r;end $$;
create function public.marketplace_report(p_listing_id uuid,p_reason text) returns public.marketplace_reports language plpgsql security definer set search_path='' as $$
declare u uuid:=marketplace_private.require_user();r public.marketplace_reports;
begin
 if not exists(select 1 from public.marketplace_listings where id=p_listing_id and status='published') then raise exception 'Annonce introuvable' using errcode='P0002';end if;
 perform pg_advisory_xact_lock(hashtextextended(u::text,0));
 if exists(select 1 from public.marketplace_reports where listing_id=p_listing_id and reporter_id=u and transaction_id is null and status='open') then raise exception 'Signalement déjà reçu' using errcode='PT409';end if;
 if (select count(*) from public.marketplace_reports where reporter_id=u and created_at>now()-interval '1 day')>=10 then raise exception 'Quota quotidien atteint' using errcode='PT429';end if;
 insert into public.marketplace_reports(listing_id,reporter_id,reason) values(p_listing_id,u,btrim(p_reason)) returning * into r;return r;end $$;
create function public.marketplace_moderation() returns jsonb language plpgsql security definer set search_path='' as $$
begin perform marketplace_private.require_user();
 if not marketplace_private.is_staff() then return jsonb_build_object('can_moderate',false,'reports','[]'::jsonb,'disputes','[]'::jsonb);end if;
 return jsonb_build_object('can_moderate',true,'reports',coalesce((select jsonb_agg(to_jsonb(r)) from public.marketplace_reports r where r.status='open'),'[]'::jsonb),'disputes',coalesce((select jsonb_agg(to_jsonb(t)) from public.marketplace_transactions t where t.status='disputed'),'[]'::jsonb));end $$;
create function public.marketplace_moderate(p_action text,p_listing_id uuid default null,p_transaction_id uuid default null,p_report_id uuid default null,p_note text default null,p_resolution text default null) returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid:=marketplace_private.require_user();t public.marketplace_transactions;i public.product_ownership;r public.marketplace_reports;l public.marketplace_listings;
begin
 if not marketplace_private.is_staff() then raise exception 'Modération requise' using errcode='42501';end if;
 if length(btrim(coalesce(p_note,''))) not between 10 and 2000 then raise exception 'Décision documentée requise' using errcode='23514';end if;
 if p_action='hide' then
 if p_report_id is not null and not exists(select 1 from public.marketplace_reports where id=p_report_id and listing_id=p_listing_id) then raise exception 'Signalement associé introuvable' using errcode='P0002';end if;
 l:=public.marketplace_listing_action(p_listing_id,'hide');
 insert into public.marketplace_listing_events(listing_id,actor_id,action,note,report_id) values(l.id,u,'hide_decision',btrim(p_note),p_report_id);return to_jsonb(l);
 elsif p_action='dismiss_report' then
 select * into r from public.marketplace_reports where id=p_report_id for update;
 if not found then raise exception 'Signalement introuvable' using errcode='P0002';end if;
 if r.reporter_id=u then raise exception 'Un modérateur indépendant doit traiter ce dossier' using errcode='42501';end if;
 if r.transaction_id is not null then raise exception 'Résolvez le litige associé' using errcode='PT409';end if;
 update public.marketplace_reports set status='resolved',resolution_note=btrim(p_note),resolved_by=u,resolved_at=now() where id=r.id returning * into r;return to_jsonb(r);
 elsif p_action='resolve_dispute' then
 select * into t from public.marketplace_transactions where id=p_transaction_id;
 if not found then raise exception 'Transaction introuvable' using errcode='P0002';end if;
 if u in (t.owner_id,t.buyer_id) then raise exception 'Un modérateur indépendant doit traiter ce dossier' using errcode='42501';end if;
 select * into i from public.product_ownership where id=t.item_id for update;
 select * into t from public.marketplace_transactions where id=t.id for update;
 if t.status<>'disputed' or p_resolution is null or p_resolution not in ('completed','cancelled') then raise exception 'Résolution invalide' using errcode='PT409';end if;
 -- A handed-over sale cannot be magically reversed. A return is physically confirmed by this documented moderator decision.
 if t.mode='vente' and p_resolution='cancelled' then raise exception 'Vente remise irréversible; résolution terminée requise' using errcode='PT409';end if;
 update public.marketplace_transactions set status=p_resolution,updated_at=now() where id=t.id returning * into t;
 if t.mode<>'vente' then update public.product_ownership set status='en_stock' where id=t.item_id;end if;
 update public.marketplace_reports set status='resolved',resolution_note=btrim(p_note),resolved_by=u,resolved_at=now() where transaction_id=t.id and status='open';
 insert into public.marketplace_events(transaction_id,actor_id,action,note) values(t.id,u,'resolve_'||p_resolution,btrim(p_note));return to_jsonb(t);
 else raise exception 'Action invalide' using errcode='23514';end if;end $$;
-- New functions have no ambient PUBLIC execute privileges.
revoke all on all functions in schema marketplace_private from public,anon,authenticated;
grant execute on function marketplace_private.committed(uuid) to authenticated;
revoke all on function public.marketplace_inventory_guard(),public.marketplace_loan_guard(),public.marketplace_list(text,boolean),public.marketplace_publish(uuid,text,text,integer,integer),public.marketplace_listing_action(uuid,text),public.marketplace_request(uuid,date,date),public.marketplace_transaction_action(uuid,text,text,text),public.marketplace_review(uuid,integer,text),public.marketplace_report(uuid,text),public.marketplace_moderation(),public.marketplace_moderate(text,uuid,uuid,uuid,text,text) from public,anon,authenticated;
grant execute on function public.marketplace_list(text,boolean) to anon,authenticated;
grant execute on function public.marketplace_publish(uuid,text,text,integer,integer),public.marketplace_listing_action(uuid,text),public.marketplace_request(uuid,date,date),public.marketplace_transaction_action(uuid,text,text,text),public.marketplace_review(uuid,integer,text),public.marketplace_report(uuid,text),public.marketplace_moderation(),public.marketplace_moderate(text,uuid,uuid,uuid,text,text) to authenticated;

-- Material edits require the owner to explicitly publish an accurate snapshot again.
create function public.marketplace_snapshot_invalidate() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if (new.name,new.brand,new.category,new.condition,new.photo_url,new.quantity,new.listing_mode) is distinct from (old.name,old.brand,old.category,old.condition,old.photo_url,old.quantity,old.listing_mode) then
 update public.marketplace_listings set status='withdrawn' where item_id=new.id and status='published';
 end if;return new;end $$;
create trigger marketplace_snapshot_invalidate after update on public.product_ownership for each row execute function public.marketplace_snapshot_invalidate();
revoke all on function public.marketplace_snapshot_invalidate() from public,anon,authenticated;
