-- Buyer consent belongs to the physical snapshot requested. Editing an item
-- invalidates pending consent; publishing again requires a fresh buyer request.
create or replace function public.marketplace_snapshot_invalidate()
returns trigger language plpgsql security definer set search_path='' as $$
begin
 if (new.name,new.brand,new.category,new.condition,new.photo_url,new.quantity,new.listing_mode)
  is distinct from (old.name,old.brand,old.category,old.condition,old.photo_url,old.quantity,old.listing_mode) then
  update public.marketplace_listings set status='withdrawn' where item_id=new.id and status='published';
  with cancelled as (
   update public.marketplace_transactions set status='cancelled',updated_at=now()
    where item_id=new.id and status='requested' returning id
  )
  insert into public.marketplace_events(transaction_id,actor_id,action,note)
   select id,coalesce(auth.uid(),new.user_id),'cancel','Objet modifié : une nouvelle demande est requise' from cancelled;
 end if;
 return new;
end $$;
revoke all on function public.marketplace_snapshot_invalidate() from public,anon,authenticated;

-- Repair pending agreements that became stale before this guard was installed.
-- Commitments already accepted are preserved; this only cancels requests.
with cancelled as (
 update public.marketplace_transactions t set status='cancelled',updated_at=now()
 from public.product_ownership i
 where t.item_id=i.id and t.status='requested' and (
  i.quantity<>1 or
  jsonb_build_object('name',i.name,'brand',i.brand,'category',i.category,'condition',i.condition,'photo_url',i.photo_url,'mode',i.listing_mode)
   is distinct from jsonb_build_object('name',t.listing_snapshot->'name','brand',t.listing_snapshot->'brand','category',t.listing_snapshot->'category','condition',t.listing_snapshot->'condition','photo_url',t.listing_snapshot->'photo_url','mode',t.listing_snapshot->'mode')
 ) returning t.id,t.owner_id
)
insert into public.marketplace_events(transaction_id,actor_id,action,note)
 select id,owner_id,'cancel','Objet modifié avant mise à jour : une nouvelle demande est requise' from cancelled;
