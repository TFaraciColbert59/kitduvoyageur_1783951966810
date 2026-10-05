-- Run after the isolated fixture and migration as postgres; transactions roll back.
begin;
insert into auth.users values('11111111-1111-1111-1111-111111111111'),('22222222-2222-2222-2222-222222222222');
insert into shop_products values('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');
grant select,insert,update,delete on gear_items to authenticated;
set role authenticated;
set request.jwt.claim.sub='11111111-1111-1111-1111-111111111111';
insert into product_ownership(id,user_id,name,listing_mode,serial_number) values('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',auth.uid(),'Sac','vente','SERIAL');
do $$ begin
 begin insert into product_ownership(user_id,name,listing_mode) values(auth.uid(),'Rental','location'); raise exception 'NULL rental passed'; exception when check_violation then null; end;
 begin insert into product_ownership(user_id,name,serial_number,quantity) values(auth.uid(),'Invalid','SERIAL2',2); raise exception 'Serial quantity passed'; exception when check_violation then null; end;
 begin insert into product_ownership(user_id,name,listing_mode,status) values(auth.uid(),'Invalid','personnel','a_louer'); raise exception 'Mode passed'; exception when check_violation then null; end;
 begin insert into product_ownership(user_id,name,serial_number) values(auth.uid(),'Duplicate','serial'); raise exception 'Duplicate serial passed'; exception when unique_violation then null; end;
 begin update product_ownership set user_id='22222222-2222-2222-2222-222222222222'; raise exception 'Owner changed'; exception when check_violation then null; end;
end $$;
select transition_inventory_item('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb','vendu','en_stock');
do $$ begin
 begin perform transition_inventory_item('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb','en_stock','en_stock'); raise exception 'Stale write passed'; exception when sqlstate 'PT409' then null; end;
 begin update product_ownership set name='Changed'; raise exception 'Sold edit passed'; exception when object_not_in_prerequisite_state then null; end;
 begin delete from product_ownership; raise exception 'Sold delete passed'; exception when object_not_in_prerequisite_state then null; end;
 begin delete from inventory_status_history; raise exception 'History delete passed'; exception when insufficient_privilege then null; end;
 if (select count(*) from inventory_status_history)<>2 then raise exception 'History count wrong'; end if;
end $$;
insert into gear_items(id,user_id,name,serial_number,product_id) values('cccccccc-cccc-cccc-cccc-cccccccccccc',auth.uid(),'Compat','COMPAT','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');
do $$ begin if not exists(select 1 from gear_items where serial_number='COMPAT' and product_id='aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa') then raise exception 'Compat lost fields'; end if; end $$;
insert into materiel_loans(id,product_ownership_id,lender_id,borrower_id,status) values('dddddddd-dddd-dddd-dddd-dddddddddddd','cccccccc-cccc-cccc-cccc-cccccccccccc',auth.uid(),'22222222-2222-2222-2222-222222222222','en_cours');
do $$ begin
 if not exists(select 1 from product_ownership where id='cccccccc-cccc-cccc-cccc-cccccccccccc' and status='en_pret' and is_lent) then raise exception 'Loan not synced'; end if;
 begin update product_ownership set status='en_stock' where id='cccccccc-cccc-cccc-cccc-cccccccccccc'; raise exception 'Loan bypass passed'; exception when object_not_in_prerequisite_state then null; end;
 begin insert into materiel_loans(product_ownership_id,lender_id,status) values('cccccccc-cccc-cccc-cccc-cccccccccccc',auth.uid(),'en_cours'); raise exception 'Duplicate loan passed'; exception when object_not_in_prerequisite_state then null; end;
end $$;
set request.jwt.claim.sub='22222222-2222-2222-2222-222222222222';
do $$ begin
 if exists(select 1 from product_ownership) or exists(select 1 from inventory_status_history) or exists(select 1 from gear_items) then raise exception 'RLS leaked owner data'; end if;
 begin perform transition_inventory_item('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb','en_stock','vendu'); raise exception 'Nonowner transition passed'; exception when no_data_found then null; end;
end $$;
update materiel_loans set status='rendu' where id='dddddddd-dddd-dddd-dddd-dddddddddddd';
set request.jwt.claim.sub='11111111-1111-1111-1111-111111111111';
do $$ begin if not exists(select 1 from product_ownership where id='cccccccc-cccc-cccc-cccc-cccccccccccc' and status='en_stock' and not is_lent) then raise exception 'Borrower return not synced'; end if; end $$;
reset role;
delete from auth.users where id='11111111-1111-1111-1111-111111111111';
rollback;
