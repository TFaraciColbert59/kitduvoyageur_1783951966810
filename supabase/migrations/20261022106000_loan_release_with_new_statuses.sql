-- 2026-10-22 — Libération de l'objet cohérente avec les nouveaux statuts.
-- Un prêt annulé ou en attente ne doit plus bloquer la remise en stock :
-- seuls en_cours et en_retard sont considérés comme engageants.

create or replace function public.inventory_loan_return()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
 if old.status<>'rendu' and new.status='rendu'
    and not exists(
      select 1 from public.materiel_loans
      where product_ownership_id=new.product_ownership_id
        and status in ('en_cours','en_retard')
    ) then
  update public.product_ownership set status='en_stock'
   where id=new.product_ownership_id and status='en_pret';
 end if;
 return new;
end $function$;

create or replace function public.inventory_guard()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
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
   if old.status='en_pret' and new.status='en_stock'
      and exists(
        select 1 from public.materiel_loans
        where product_ownership_id=old.id and status in ('en_cours','en_retard')
      ) then raise exception 'Retourner le prêt associé' using errcode='55000'; end if;
  end if;
 end if;
 new.serial_number:=nullif(btrim(new.serial_number),'');
 new.is_lent:=(new.status='en_pret');
 return new;
end $function$;

create or replace function public.return_inventory_item(p_id uuid)
returns public.product_ownership
language plpgsql
set search_path to 'public'
as $function$
declare v public.product_ownership;
begin
 select * into v from public.product_ownership where id=p_id and user_id=auth.uid() for update;
 if not found then raise exception 'Objet introuvable' using errcode='P0002'; end if;
 if v.status<>'en_pret' then raise exception 'Objet non prêté' using errcode='55000'; end if;
 update public.materiel_loans set status='rendu',returned_at=current_date
  where product_ownership_id=p_id and lender_id=auth.uid() and status in ('en_cours','en_retard');
 update public.product_ownership set status='en_stock' where id=p_id returning * into v;
 return v;
end $function$;

create or replace function public.inventory_loan_guard()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare v public.product_ownership; borrower_deleted boolean := false;
begin
 if TG_OP='DELETE' then
  if old.status not in ('rendu','annule') and exists(select 1 from auth.users where id=old.lender_id) then
   raise exception 'Retourner ou annuler le prêt avant suppression' using errcode='55000';
  end if;
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
 if TG_OP='UPDATE' and old.status='rendu' and new.status not in ('rendu','litige') then raise exception 'Prêt clôturé' using errcode='55000'; end if;
 if TG_OP='UPDATE' and old.status='annule' and new.status<>'annule' then raise exception 'Prêt annulé' using errcode='55000'; end if;
 if TG_OP='UPDATE' and old.status='en_attente' and new.status not in ('en_attente','en_cours','annule') then
  raise exception 'Transition de prêt invalide' using errcode='23514';
 end if;
 if (TG_OP='INSERT' and new.status in ('en_cours','rendu'))
    or (TG_OP='UPDATE' and old.status='en_attente' and new.status='en_cours') then
  if v.status not in ('en_stock','a_preter') then raise exception 'Objet indisponible' using errcode='55000'; end if;
  update public.product_ownership set listing_mode='pret',status='en_pret' where id=v.id;
 end if;
 -- Annulation d'un prêt actif : l'objet redevient disponible s'il n'est plus engagé.
 if TG_OP='UPDATE' and new.status='annule' and old.status in ('en_cours','en_retard') then
  if not exists(
    select 1 from public.materiel_loans l
    where l.product_ownership_id=new.product_ownership_id
      and l.id<>new.id and l.status in ('en_cours','en_retard')
  ) then
   update public.product_ownership set status='en_stock'
    where id=new.product_ownership_id and status='en_pret';
  end if;
 end if;
 if new.status='rendu' then new.returned_at:=coalesce(new.returned_at,current_date); end if;
 return new;
end $function$;
