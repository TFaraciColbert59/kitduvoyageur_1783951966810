-- 2026-10-22 — Prêts : consentement (en_attente) et litige après retour.
-- Le trigger inventory_loan_guard interdisait toute suppression hors 'rendu'
-- et tout passage rendu -> litige, ce qui rendait decline et dispute
-- impossibles. On ajoute deux statuts et on assouplit les transitions.

alter table public.materiel_loans drop constraint if exists materiel_loans_status_check;
alter table public.materiel_loans add constraint materiel_loans_status_check
  check (status in ('en_attente','en_cours','rendu','en_retard','litige','annule'));

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
 -- Un prêt clôturé ne peut plus que passer en litige (signalement).
 if TG_OP='UPDATE' and old.status='rendu' and new.status not in ('rendu','litige') then raise exception 'Prêt clôturé' using errcode='55000'; end if;
 -- Un prêt annulé est terminal.
 if TG_OP='UPDATE' and old.status='annule' and new.status<>'annule' then raise exception 'Prêt annulé' using errcode='55000'; end if;
 -- Depuis une demande en attente : accepter ou annuler uniquement.
 if TG_OP='UPDATE' and old.status='en_attente' and new.status not in ('en_attente','en_cours','annule') then
  raise exception 'Transition de prêt invalide' using errcode='23514';
 end if;
 -- L'objet doit être disponible au moment de l'activation réelle.
 if (TG_OP='INSERT' and new.status in ('en_cours','rendu'))
    or (TG_OP='UPDATE' and old.status='en_attente' and new.status='en_cours') then
  if v.status not in ('en_stock','a_preter') then raise exception 'Objet indisponible' using errcode='55000'; end if;
  update public.product_ownership set listing_mode='pret',status='en_pret' where id=v.id;
 end if;
 if new.status='rendu' then new.returned_at:=coalesce(new.returned_at,current_date); end if;
 return new;
end $function$;
