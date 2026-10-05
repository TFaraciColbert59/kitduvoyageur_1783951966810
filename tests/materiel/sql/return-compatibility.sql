begin;
insert into auth.users values('44444444-4444-4444-4444-444444444444');
set role authenticated;
set request.jwt.claim.sub='44444444-4444-4444-4444-444444444444';
insert into product_ownership(id,user_id,name) values('ffffffff-ffff-ffff-ffff-ffffffffffff',auth.uid(),'Return');
insert into materiel_loans(product_ownership_id,lender_id) values('ffffffff-ffff-ffff-ffff-ffffffffffff',auth.uid());
select transition_inventory_item('ffffffff-ffff-ffff-ffff-ffffffffffff','en_stock','en_pret');
do $$ begin
 if exists(select 1 from materiel_loans where status<>'rendu') or not exists(select 1 from product_ownership where status='en_stock' and not is_lent) then raise exception 'Return compatibility failed'; end if;
end $$;
rollback;
