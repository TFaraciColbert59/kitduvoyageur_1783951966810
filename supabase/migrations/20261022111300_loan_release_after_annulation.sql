-- 2026-10-22 — Libération de l'objet après retour ou annulation d'un prêt actif.
--
-- Le bloc de libération ajouté à `inventory_loan_guard` (BEFORE UPDATE) ne
-- pouvait jamais aboutir : au moment où il repassait l'objet en `en_stock`, le
-- prêt était encore `en_cours`, donc `inventory_guard` refusait avec
-- « Retourner le prêt associé ». L'annulation d'un prêt actif renvoyait
-- toujours 409 et ce code était mort.
--
-- La libération appartient au trigger AFTER `inventory_loan_return`, qui voit
-- le nouveau statut du prêt. On le remplace pour couvrir `rendu` et `annule`
-- depuis un prêt réellement engageant (`en_cours`/`en_retard`), et seulement
-- lorsqu'aucun autre prêt actif ne subsiste sur l'objet.

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
 if new.status='rendu' then new.returned_at:=coalesce(new.returned_at,current_date); end if;
 return new;
end $function$;

create or replace function public.inventory_loan_return()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
 if new.status in ('rendu','annule') and old.status in ('en_cours','en_retard')
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

-- Le trigger AFTER reste la seule voie de libération de l'objet.
drop trigger if exists inventory_loan_return on public.materiel_loans;
create trigger inventory_loan_return
  after update on public.materiel_loans
  for each row execute function public.inventory_loan_return();

revoke all on function public.inventory_loan_guard() from public, anon, authenticated;
revoke all on function public.inventory_loan_return() from public, anon, authenticated;
