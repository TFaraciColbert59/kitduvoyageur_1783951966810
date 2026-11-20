begin;
select plan(6);

insert into auth.users (id, email) values
  ('108eff63-0001-49ca-878a-fae247beccb0', 'hub-media-owner@example.invalid'),
  ('108eff63-0002-49ca-878a-fae247beccb0', 'hub-media-outsider@example.invalid');
insert into public.carnets (id, author_id, title, visibility)
values ('108eff63-0003-49ca-878a-fae247beccb0', '108eff63-0001-49ca-878a-fae247beccb0', 'HUB · Recette', 'private');

select is((select public from storage.buckets where id = 'hub-carnet-media'), false, 'Le seau est privé');
-- Le Storage API effectue les mêmes opérations avec le rôle issu du JWT.
grant select, insert, delete on storage.objects to authenticated;
grant select on storage.objects to anon;
set local role authenticated;
select set_config('request.jwt.claim.sub', '108eff63-0001-49ca-878a-fae247beccb0', true);

select lives_ok($$
  insert into storage.objects (bucket_id, name)
  values ('hub-carnet-media', '108eff63-0001-49ca-878a-fae247beccb0/carnet-moments/108eff63-0003-49ca-878a-fae247beccb0/moment.jpg')
$$, 'Le responsable dépose dans son carnet');
select is((select count(*) from storage.objects where bucket_id = 'hub-carnet-media'), 1::bigint, 'Le responsable lit son média');

select set_config('request.jwt.claim.sub', '108eff63-0002-49ca-878a-fae247beccb0', true);
select is((select count(*) from storage.objects where bucket_id = 'hub-carnet-media'), 0::bigint, 'Un autre utilisateur ne lit pas le média privé');
select throws_ok($$
  insert into storage.objects (bucket_id, name)
  values ('hub-carnet-media', '108eff63-0002-49ca-878a-fae247beccb0/carnet-moments/108eff63-0003-49ca-878a-fae247beccb0/autre.jpg')
$$, '42501', null, 'Un autre utilisateur ne dépose pas dans ce carnet');

reset role;
set local role anon;
select set_config('request.jwt.claim.sub', '', true);
select is((select count(*) from storage.objects where bucket_id = 'hub-carnet-media'), 0::bigint, 'Le visiteur ne lit pas le média privé');

select * from finish();
rollback;
