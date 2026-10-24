-- 2026-10-22 — Intégrité des notes et de la date de retour d'un prêt.
-- La politique RLS `materiel_loans_update_involved` autorise chaque partie à
-- modifier la ligne entière : sans ce trigger, un emprunteur pouvait réécrire
-- sa propre réputation (`borrower_rating`), celle du prêteur (`lender_rating`)
-- ou falsifier `returned_at`, en contournant l'API. `mapTrust` affiche
-- directement ces valeurs.
--
-- Règles :
--  - le prêteur note l'emprunteur (`borrower_rating`), l'emprunteur note le
--    prêteur (`lender_rating`), jamais l'inverse ;
--  - une note ne s'écrit qu'une fois et uniquement après le retour (`rendu`) ;
--  - `returned_at` est décidée par le serveur au passage à `rendu`, puis figée ;
--  - `auth.uid()` NULL (service role, migrations) reste autorisé.

create or replace function public.materiel_loan_trust_guard()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
 -- Service role / migrations : aucune identité, aucune restriction de camp.
 if auth.uid() is null then
  return new;
 end if;

 -- La date de retour n'est jamais fournie par le client : elle est figée au
 -- passage à rendu et ne peut plus bouger ensuite.
 if new.status = 'rendu' and old.status <> 'rendu' then
  new.returned_at := coalesce(old.returned_at, current_date);
 elsif new.returned_at is distinct from old.returned_at then
  raise exception 'Date de retour immuable' using errcode='23514';
 end if;

 -- Le prêteur note l'emprunteur, une seule fois, après le retour.
 if new.borrower_rating is distinct from old.borrower_rating then
  if auth.uid() is distinct from old.lender_id then
   raise exception 'Seul le prêteur peut noter l''emprunteur' using errcode='42501';
  end if;
  if old.status <> 'rendu' or new.status <> 'rendu' then
   raise exception 'La note de l''emprunteur n''est possible qu''après le retour' using errcode='23514';
  end if;
  if old.borrower_rating is not null then
   raise exception 'La note de l''emprunteur est déjà enregistrée' using errcode='23514';
  end if;
 end if;

 -- L'emprunteur note le prêteur, une seule fois, après le retour.
 if new.lender_rating is distinct from old.lender_rating then
  if auth.uid() is distinct from old.borrower_id then
   raise exception 'Seul l''emprunteur peut noter le prêteur' using errcode='42501';
  end if;
  if old.status <> 'rendu' or new.status <> 'rendu' then
   raise exception 'La note du prêteur n''est possible qu''après le retour' using errcode='23514';
  end if;
  if old.lender_rating is not null then
   raise exception 'La note du prêteur est déjà enregistrée' using errcode='23514';
  end if;
 end if;

 return new;
end $function$;

drop trigger if exists materiel_loan_trust_guard on public.materiel_loans;
create trigger materiel_loan_trust_guard
  before update on public.materiel_loans
  for each row execute function public.materiel_loan_trust_guard();

revoke all on function public.materiel_loan_trust_guard() from public, anon, authenticated;
