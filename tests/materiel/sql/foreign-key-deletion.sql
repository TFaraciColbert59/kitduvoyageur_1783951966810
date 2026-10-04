-- Regression: FK maintenance remains possible while client rewrites stay blocked.
begin;
insert into auth.users values ('55555555-5555-5555-5555-555555555555'), ('66666666-6666-6666-6666-666666666666');
insert into shop_products values ('abababab-abab-abab-abab-abababababab');
set role authenticated;
set request.jwt.claim.sub='55555555-5555-5555-5555-555555555555';
insert into product_ownership(id,user_id,name,product_id,listing_mode) values ('cdcdcdcd-cdcd-cdcd-cdcd-cdcdcdcdcdcd',auth.uid(),'Sold catalogue','abababab-abab-abab-abab-abababababab','vente');
select transition_inventory_item('cdcdcdcd-cdcd-cdcd-cdcd-cdcdcdcdcdcd','vendu','en_stock');
insert into product_ownership(id,user_id,name) values ('efefefef-efef-efef-efef-efefefefefef',auth.uid(),'Loan');
insert into materiel_loans(id,product_ownership_id,lender_id,borrower_id) values ('99999999-9999-9999-9999-999999999999','efefefef-efef-efef-efef-efefefefefef',auth.uid(),'66666666-6666-6666-6666-666666666666');
do $$ begin
 begin update product_ownership set product_id=null where status='vendu'; raise exception 'Client unlinked active catalogue'; exception when object_not_in_prerequisite_state then null; end;
 begin update materiel_loans set borrower_id=null; raise exception 'Client cleared borrower'; exception when check_violation then null; end;
end $$;
reset role;
set request.jwt.claim.sub='66666666-6666-6666-6666-666666666666';
delete from auth.users where id='66666666-6666-6666-6666-666666666666';
delete from shop_products where id='abababab-abab-abab-abab-abababababab';
do $$ begin
 if exists(select 1 from materiel_loans where id='99999999-9999-9999-9999-999999999999' and borrower_id is not null) then raise exception 'Deleted borrower retained'; end if;
 if exists(select 1 from product_ownership where id='cdcdcdcd-cdcd-cdcd-cdcd-cdcdcdcdcdcd' and product_id is not null) then raise exception 'Deleted catalogue retained'; end if;
 if not exists(select 1 from product_ownership where id='efefefef-efef-efef-efef-efefefefefef' and status='en_pret') then raise exception 'Borrower deletion falsely returned object'; end if;
end $$;
rollback;
