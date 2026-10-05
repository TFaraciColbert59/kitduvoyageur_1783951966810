-- Additive private inventory lifecycle. No catalogue data is copied.
alter table public.product_ownership
 add column product_id uuid references public.shop_products(id) on delete set null,
 add column serial_number text,
 add column description text,
 add column location text,
 add column listing_mode text not null default 'personnel',
 add column status text not null default 'en_stock',
 add column rental_price_cents integer,
 add column deposit_cents integer;
update public.product_ownership p set status='en_pret',listing_mode='pret',is_lent=true
 where p.is_lent or exists(select 1 from public.materiel_loans l where l.product_ownership_id=p.id and l.status<>'rendu');
alter table public.product_ownership
 add constraint inventory_mode check(listing_mode in ('personnel','vente','location','pret')),
 add constraint inventory_status check(status in ('en_stock','a_acheter','a_louer','a_preter','en_location','en_pret','vendu')),
 add constraint inventory_prices check((price_cents is null or price_cents>=0) and (rental_price_cents is null or rental_price_cents>=0) and (deposit_cents is null or deposit_cents>=0)) not valid,
 add constraint inventory_serial_quantity check(nullif(btrim(serial_number),'') is null or quantity=1),
 add constraint inventory_rental_price check(listing_mode<>'location' or coalesce(rental_price_cents,0)>0),
 add constraint inventory_status_mode check((status not in ('a_louer','en_location') or listing_mode='location') and (status not in ('a_preter','en_pret') or listing_mode='pret') and (status<>'vendu' or listing_mode='vente'));
create unique index inventory_owner_serial on public.product_ownership(user_id,lower(btrim(serial_number))) where nullif(btrim(serial_number),'') is not null;
create table public.inventory_status_history (
 id uuid primary key default gen_random_uuid(), item_id uuid not null, user_id uuid not null references auth.users(id) on delete cascade,
 from_status text, to_status text not null, changed_at timestamptz not null default clock_timestamp()
);
alter table public.inventory_status_history enable row level security;
create policy inventory_history_owner on public.inventory_status_history for select to authenticated using(user_id=(select auth.uid()));
revoke all on public.inventory_status_history from anon, authenticated;
grant select on public.inventory_status_history to authenticated;
create or replace function public.inventory_guard() returns trigger language plpgsql security definer set search_path=public as $$
declare ignored_fields text[] := array['status','is_lent','updated_at','search_vector'];
begin
 if TG_OP='DELETE' then
  if old.status in ('en_pret','en_location','vendu') and exists(select 1 from auth.users where id=old.user_id) then raise exception 'Objet engagé ou vendu' using errcode='55000'; end if;
  return old;
 end if;
 if TG_OP='INSERT' then
  if new.status in ('en_pret','en_location','vendu') or new.is_lent then raise exception 'Transition explicite requise' using errcode='23514'; end if;
 else
  if new.user_id<>old.user_id or new.id<>old.id then raise exception 'Propriétaire immuable' using errcode='23514'; end if;
  -- FK ON DELETE SET NULL may unlink a deleted catalog; client edits still cannot.
  if new.product_id is null and old.product_id is not null and
   not exists(select 1 from public.shop_products where id=old.product_id) then
   ignored_fields := ignored_fields || array['product_id'];
  end if;
  if old.status in ('en_pret','en_location','vendu') and
   (to_jsonb(new)-ignored_fields) is distinct from (to_jsonb(old)-ignored_fields) then
   raise exception 'Objet engagé ou vendu: modification interdite' using errcode='55000';
  end if;
  if new.status<>old.status then
   if not ((old.status='en_stock' and (new.status='a_acheter' or (new.status in ('a_louer','en_location') and new.listing_mode='location') or (new.status in ('a_preter','en_pret') and new.listing_mode='pret') or (new.status='vendu' and new.listing_mode='vente')))
    or (old.status in ('a_acheter','a_louer','a_preter','en_location','en_pret') and new.status='en_stock')
    or (old.status='a_louer' and new.status='en_location' and new.listing_mode='location')
    or (old.status='a_preter' and new.status='en_pret' and new.listing_mode='pret')) then raise exception 'Transition interdite' using errcode='23514'; end if;
   if old.status='en_pret' and new.status='en_stock' and exists(select 1 from public.materiel_loans where product_ownership_id=old.id and status<>'rendu') then raise exception 'Retourner le prêt associé' using errcode='55000'; end if;
  end if;
 end if;
 new.serial_number:=nullif(btrim(new.serial_number),'');
 new.is_lent:=(new.status='en_pret');
 return new;
end $$;
create trigger inventory_guard before insert or update or delete on public.product_ownership for each row execute function public.inventory_guard();
create or replace function public.inventory_record_status() returns trigger language plpgsql security definer set search_path=public as $$
begin
 if TG_OP='INSERT' then insert into public.inventory_status_history(item_id,user_id,to_status) values(new.id,new.user_id,new.status);
 elsif new.status<>old.status then insert into public.inventory_status_history(item_id,user_id,from_status,to_status) values(new.id,new.user_id,old.status,new.status); end if;
 return new;
end $$;
create trigger inventory_status_history after insert or update on public.product_ownership for each row execute function public.inventory_record_status();
create or replace function public.transition_inventory_item(p_id uuid,p_status text,p_expected_status text) returns public.product_ownership language plpgsql security invoker set search_path=public as $$
declare v public.product_ownership;
begin
 select * into v from public.product_ownership where id=p_id and user_id=auth.uid() for update;
 if not found then raise exception 'Objet introuvable' using errcode='P0002'; end if;
 if v.status<>p_expected_status then raise exception 'Le statut a changé, actualisez' using errcode='40001'; end if;
 if v.status=p_status then raise exception 'Statut identique' using errcode='23514'; end if;
 if v.status='en_pret' and p_status='en_stock' then return public.return_inventory_item(p_id); end if;
 update public.product_ownership set status=p_status where id=p_id returning * into v;
 return v;
end $$;
create or replace function public.patch_inventory_item(p_id uuid,p_patch jsonb) returns public.product_ownership language plpgsql security invoker set search_path=public as $$
declare v public.product_ownership; merged public.product_ownership;
begin
 if exists(select 1 from jsonb_object_keys(p_patch) k where k not in ('name','brand','category','weight_g','price_cents','purchase_date','condition','photo_url','barcode','maintenance_due_at','expiry_date','tags','quantity','product_id','serial_number','description','location','listing_mode','rental_price_cents','deposit_cents')) then raise exception 'Champ protégé' using errcode='23514'; end if;
 select * into v from public.product_ownership where id=p_id and user_id=auth.uid() for update;
 if not found then raise exception 'Objet introuvable' using errcode='P0002'; end if;
 merged:=jsonb_populate_record(v,p_patch);
 update public.product_ownership set name=merged.name,brand=merged.brand,category=merged.category,weight_g=merged.weight_g,price_cents=merged.price_cents,purchase_date=merged.purchase_date,condition=merged.condition,photo_url=merged.photo_url,barcode=merged.barcode,maintenance_due_at=merged.maintenance_due_at,expiry_date=merged.expiry_date,tags=merged.tags,quantity=merged.quantity,product_id=merged.product_id,serial_number=merged.serial_number,description=merged.description,location=merged.location,listing_mode=merged.listing_mode,rental_price_cents=merged.rental_price_cents,deposit_cents=merged.deposit_cents where id=p_id returning * into v;
 return v;
end $$;
revoke all on function public.transition_inventory_item(uuid,text,text),public.patch_inventory_item(uuid,jsonb) from public,anon;
grant execute on function public.transition_inventory_item(uuid,text,text),public.patch_inventory_item(uuid,jsonb) to authenticated;
-- Loan updates atomically serialize on the inventory row; borrowers cannot relink a loan.
create or replace function public.inventory_loan_guard() returns trigger language plpgsql security definer set search_path=public as $$
declare v public.product_ownership; borrower_deleted boolean := false;
begin
 if TG_OP='DELETE' then
  if old.status<>'rendu' and exists(select 1 from auth.users where id=old.lender_id) then raise exception 'Retourner le prêt avant suppression' using errcode='55000'; end if;
  return old;
 end if;
 if TG_OP='UPDATE' then
  borrower_deleted := new.borrower_id is null and old.borrower_id is not null
   and not exists(select 1 from auth.users where id=old.borrower_id);
  if new.product_ownership_id<>old.product_ownership_id or new.lender_id<>old.lender_id or
   (new.borrower_id is distinct from old.borrower_id and not borrower_deleted) then
   raise exception 'Participants et objet immuables' using errcode='23514';
  end if;
 end if;
 select * into v from public.product_ownership where id=new.product_ownership_id for update;
 if not found or v.user_id<>new.lender_id then raise exception 'Objet du prêteur introuvable' using errcode='23514'; end if;
 if auth.uid() is not null and auth.uid()<>new.lender_id and (TG_OP='INSERT' or auth.uid() is distinct from new.borrower_id) and not borrower_deleted then raise exception 'Prêt non autorisé' using errcode='42501'; end if;
 if TG_OP='UPDATE' and old.status='rendu' and new.status<>'rendu' then raise exception 'Prêt clôturé' using errcode='55000'; end if;
 if TG_OP='INSERT' and new.status<>'rendu' then
  if v.status not in ('en_stock','a_preter') then raise exception 'Objet indisponible' using errcode='55000'; end if;
  update public.product_ownership set listing_mode='pret',status='en_pret' where id=v.id;
 end if;
 if new.status='rendu' then new.returned_at:=coalesce(new.returned_at,current_date); end if;
 return new;
end $$;
create trigger inventory_loan_guard before insert or update or delete on public.materiel_loans for each row execute function public.inventory_loan_guard();
create or replace function public.inventory_loan_return() returns trigger language plpgsql security definer set search_path=public as $$
begin
 if old.status<>'rendu' and new.status='rendu' and not exists(select 1 from public.materiel_loans where product_ownership_id=new.product_ownership_id and status<>'rendu') then update public.product_ownership set status='en_stock' where id=new.product_ownership_id and status='en_pret'; end if;
 return new;
end $$;
create trigger inventory_loan_return after update on public.materiel_loans for each row execute function public.inventory_loan_return();

-- Preserve compatibility without exposing other private inventory fields.
CREATE OR REPLACE VIEW public.gear_items
WITH (security_invoker = true) AS
SELECT
  po.id,
  po.user_id,
  po.name,
  COALESCE(po.brand, '') AS brand,
  ''::text AS model,
  COALESCE(po.category, 'autre') AS category,
  COALESCE(po.condition, 'bon') AS condition,
  po.purchase_date,
  (COALESCE(po.price_cents, 0)::numeric / 100.0) AS purchase_price,
  COALESCE(po.weight_g, 0) AS weight_g,
  po.expiry_date,
  NULL::date AS last_maintenance_date,
  po.maintenance_due_at AS next_maintenance_date,
  ''::text AS notes,
  po.serial_number,
  0::integer AS usage_count,
  COALESCE(po.photo_url, '') AS image,
  po.name AS alt,
  COALESCE(po.tags, '{}'::text[]) AS tags,
  NULL::uuid AS source_report_id,
  po.created_at,
  po.updated_at,
  po.product_id,
  'manuel'::text AS source,
  NULL::uuid AS origin_order_id,
  NULL::uuid AS origin_kit_id,
  false AS is_listed_for_sale,
  po.purchase_date AS acquired_at,
  NULL::uuid AS transferred_to_user_id,
  COALESCE(po.quantity, 1) AS quantity,
  false AS is_favorite,
  CASE WHEN po.is_lent OR po.status='en_location' THEN 'en_cours' ELSE NULL END AS loan_status,
  NULL::text AS loan_to_name,
  NULL::text AS compartment,
  NULL::integer AS wear_percentage,
  NULL::text AS size_label,
  NULL::text AS materials,
  NULL::text AS sole_type,
  NULL::text AS waterproof_rating,
  po.barcode AS ref_code,
  NULL::timestamptz AS loan_due_date,
  NULL::timestamptz AS last_used_at,
  0::integer AS sorties_count
FROM public.product_ownership po WHERE po.status NOT IN ('vendu','a_acheter');

CREATE OR REPLACE FUNCTION public.trg_compat_gear_items_insert()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE
  v_user_id UUID;
BEGIN
  v_user_id := COALESCE(NEW.user_id, auth.uid());
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'user_id requis pour ajouter un équipement';
  END IF;

  INSERT INTO public.product_ownership (
    id,
    user_id,
    product_id,
    serial_number,
    name,
    brand,
    category,
    weight_g,
    price_cents,
    purchase_date,
    condition,
    photo_url,
    barcode,
    tags,
    quantity,
    created_at,
    updated_at
  ) VALUES (
    COALESCE(NEW.id, gen_random_uuid()),
    v_user_id,
    NEW.product_id,
    NEW.serial_number,
    COALESCE(NEW.name, 'Équipement sans nom'),
    NEW.brand,
    NEW.category,
    COALESCE(NEW.weight_g, 0),
    CASE WHEN NEW.purchase_price IS NOT NULL THEN (NEW.purchase_price * 100)::int ELSE 0 END,
    NEW.purchase_date,
    CASE WHEN NEW.condition IN ('neuf','bon','use','a_remplacer','pour_pieces') THEN NEW.condition ELSE 'bon' END,
    NULLIF(NEW.image, ''),
    NEW.ref_code,
    COALESCE(NEW.tags, '{}'::text[]),
    GREATEST(1, COALESCE(NEW.quantity, 1)),
    COALESCE(NEW.created_at, now()),
    COALESCE(NEW.updated_at, now())
  )
  RETURNING id INTO NEW.id;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_gear_items_insert ON public.gear_items;
CREATE TRIGGER trg_gear_items_insert
  INSTEAD OF INSERT ON public.gear_items
  FOR EACH ROW EXECUTE FUNCTION public.trg_compat_gear_items_insert();

CREATE OR REPLACE FUNCTION public.trg_compat_gear_items_update()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
BEGIN
  UPDATE public.product_ownership SET
    product_id = NEW.product_id,
    serial_number = NEW.serial_number,
    name = COALESCE(NEW.name, OLD.name),
    brand = COALESCE(NEW.brand, OLD.brand),
    category = COALESCE(NEW.category, OLD.category),
    weight_g = COALESCE(NEW.weight_g, OLD.weight_g),
    price_cents = CASE WHEN NEW.purchase_price IS NOT NULL THEN (NEW.purchase_price * 100)::int ELSE (COALESCE(OLD.purchase_price, 0) * 100)::int END,
    purchase_date = COALESCE(NEW.purchase_date, OLD.purchase_date),
    condition = CASE WHEN NEW.condition IN ('neuf','bon','use','a_remplacer','pour_pieces') THEN NEW.condition ELSE OLD.condition END,
    photo_url = CASE WHEN NEW.image IS NOT NULL THEN NULLIF(NEW.image, '') ELSE NULLIF(OLD.image, '') END,
    barcode = COALESCE(NEW.ref_code, OLD.ref_code),
    tags = COALESCE(NEW.tags, OLD.tags),
    quantity = GREATEST(1, COALESCE(NEW.quantity, OLD.quantity)),
    updated_at = now()
  WHERE id = OLD.id
    AND (auth.uid() IS NULL OR user_id = auth.uid());
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_gear_items_update ON public.gear_items;
CREATE TRIGGER trg_gear_items_update
  INSTEAD OF UPDATE ON public.gear_items
  FOR EACH ROW EXECUTE FUNCTION public.trg_compat_gear_items_update();

CREATE OR REPLACE FUNCTION public.trg_compat_gear_items_delete()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
BEGIN
  DELETE FROM public.product_ownership
  WHERE id = OLD.id
    AND (auth.uid() IS NULL OR user_id = auth.uid());
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_gear_items_delete ON public.gear_items;
CREATE TRIGGER trg_gear_items_delete
  INSTEAD OF DELETE ON public.gear_items
  FOR EACH ROW EXECUTE FUNCTION public.trg_compat_gear_items_delete();


revoke all on function public.inventory_guard(), public.inventory_record_status(), public.inventory_loan_guard(), public.inventory_loan_return() from public,anon,authenticated;
-- Compatibility action: owner returns all linked active historical loans atomically.
create or replace function public.return_inventory_item(p_id uuid) returns public.product_ownership language plpgsql security invoker set search_path=public as $$
declare v public.product_ownership;
begin
 select * into v from public.product_ownership where id=p_id and user_id=auth.uid() for update;
 if not found then raise exception 'Objet introuvable' using errcode='P0002'; end if;
 if v.status<>'en_pret' then raise exception 'Objet non prêté' using errcode='55000'; end if;
 update public.materiel_loans set status='rendu',returned_at=current_date where product_ownership_id=p_id and lender_id=auth.uid() and status<>'rendu';
 update public.product_ownership set status='en_stock' where id=p_id returning * into v;
 return v;
end $$;
revoke all on function public.return_inventory_item(uuid) from public,anon;
grant execute on function public.return_inventory_item(uuid) to authenticated;
